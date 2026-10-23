/// <reference lib="webworker" />
/**
 * Detection worker: runs a YOLOv10 ONNX model with ONNX Runtime Web entirely
 * off the main thread. Frames arrive as transferable ImageBitmaps, are
 * letterboxed to the model input size, and decoded into normalized
 * detections. Nothing is ever sent to a server — inference is 100% local.
 */
import type { InferenceSession, Tensor } from "onnxruntime-web";
import { COCO_CLASSES, type RawDetection } from "./types";

const ORT_CDN = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/";
const MODEL_INPUT = 640;

interface LoadMsg {
  type: "load";
  url: string;
}

interface InferMsg {
  type: "infer";
  frameId: number;
  bitmap: ImageBitmap;
  videoW: number;
  videoH: number;
  minScore: number;
  t0: number;
}

type WorkerMsg = LoadMsg | InferMsg;

let session: InferenceSession | null = null;
let scratchCanvas: OffscreenCanvas | null = null;
let scratchCtx: OffscreenCanvasRenderingContext2D | null = null;
/** Cached runtime module + preallocated input buffer for hot-loop reuse. */
let ort: typeof import("onnxruntime-web") | null = null;
let inputBuffer: Float32Array | null = null;

function post(msg: unknown, transfer?: Transferable[]) {
  (self as unknown as Worker).postMessage(msg, transfer ?? []);
}

async function loadModel(url: string) {
  try {
    ort = await import("onnxruntime-web");
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.simd = true;
    (ort.env.wasm as { wasmPaths?: string }).wasmPaths = ORT_CDN;
    ort.env.logLevel = "error";

    const gpuAvailable =
      typeof navigator !== "undefined" &&
      "gpu" in navigator &&
      navigator.gpu !== null;

    let backend = "wasm";
    if (gpuAvailable) {
      try {
        session = await ort.InferenceSession.create(url, {
          executionProviders: ["webgpu", "wasm"],
        });
        backend = "webgpu";
      } catch (err) {
        console.warn("[detector] WebGPU init failed, falling back to wasm:", err);
        session = null;
      }
    }
    if (!session) {
      session = await ort.InferenceSession.create(url, {
        executionProviders: ["wasm"],
      });
    }

    scratchCanvas = new OffscreenCanvas(MODEL_INPUT, MODEL_INPUT);
    scratchCtx = scratchCanvas.getContext("2d", { willReadFrequently: true });
    if (!scratchCtx) throw new Error("OffscreenCanvas 2D context unavailable");
    inputBuffer = new Float32Array(3 * MODEL_INPUT * MODEL_INPUT);

    post({ type: "loaded", backend, inputSize: MODEL_INPUT });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: "load-error", message });
  }
}

/** Letterbox `bitmap` into the scratch canvas; returns reverse-mapping metadata. */
function letterbox(bitmap: ImageBitmap) {
  const ctx = scratchCtx!;
  const scale = Math.min(MODEL_INPUT / bitmap.width, MODEL_INPUT / bitmap.height);
  const dw = Math.round(bitmap.width * scale);
  const dh = Math.round(bitmap.height * scale);
  const padX = Math.floor((MODEL_INPUT - dw) / 2);
  const padY = Math.floor((MODEL_INPUT - dh) / 2);
  ctx.fillStyle = "rgb(114,114,114)";
  ctx.fillRect(0, 0, MODEL_INPUT, MODEL_INPUT);
  ctx.drawImage(bitmap, padX, padY, dw, dh);
  return { scale, padX, padY };
}

/** HWC RGBA → CHW float32 RGB tensor, normalized to 0..1. Reuses its buffer. */
function toTensor(): Float32Array {
  const ctx = scratchCtx!;
  const img = ctx.getImageData(0, 0, MODEL_INPUT, MODEL_INPUT);
  const px = img.data;
  const n = MODEL_INPUT * MODEL_INPUT;
  const buffer = inputBuffer!;
  for (let p = 0; p < n; p++) {
    buffer[p] = px[p * 4] / 255;
    buffer[n + p] = px[p * 4 + 1] / 255;
    buffer[2 * n + p] = px[p * 4 + 2] / 255;
  }
  return buffer;
}

/**
 * Decode a YOLOv10 end-to-end output [1, 300, 6]:
 * rows are (x1, y1, x2, y2, score, classId) in letterbox pixel coordinates.
 */
function decode(
  data: Float32Array,
  rows: number,
  stride: number,
  meta: {
    scale: number;
    padX: number;
    padY: number;
    videoW: number;
    videoH: number;
  },
  minScore: number,
): RawDetection[] {
  const out: RawDetection[] = [];
  for (let r = 0; r < rows; r++) {
    const base = r * stride;
    const x1 = data[base];
    const y1 = data[base + 1];
    const x2 = data[base + 2];
    const y2 = data[base + 3];
    const score = data[base + 4];
    const classId = Math.round(data[base + 5]);
    if (!Number.isFinite(score) || score < minScore) continue;
    if (x2 - x1 < 2 || y2 - y1 < 2) continue;
    // Letterbox pixel coords → source-video pixel coords → normalized 0..1.
    const px1 = (x1 - meta.padX) / meta.scale;
    const py1 = (y1 - meta.padY) / meta.scale;
    const px2 = (x2 - meta.padX) / meta.scale;
    const py2 = (y2 - meta.padY) / meta.scale;
    const x = Math.max(0, Math.min(1, px1 / meta.videoW));
    const y = Math.max(0, Math.min(1, py1 / meta.videoH));
    const w = Math.max(0.001, Math.min(1, px2 / meta.videoW) - x);
    const h = Math.max(0.001, Math.min(1, py2 / meta.videoH) - y);
    out.push({
      x,
      y,
      w,
      h,
      score,
      classId,
      className: COCO_CLASSES[classId] ?? `class-${classId}`,
    });
  }
  return out;
}

self.onmessage = async (event: MessageEvent<WorkerMsg>) => {
  const msg = event.data;
  try {
    if (msg.type === "load") {
      await loadModel(msg.url);
      return;
    }
    if (msg.type === "infer") {
      const { frameId, bitmap, videoW, videoH, minScore } = msg;
      if (!session || !scratchCtx || !ort || !inputBuffer) {
        bitmap.close();
        post({ type: "error", frameId, message: "Model not loaded yet" });
        return;
      }
      const tRecv = performance.now();
      const meta = letterbox(bitmap);
      const videoAspect = { videoW, videoH };
      bitmap.close();
      const input = toTensor();
      const tPrep = performance.now();

      const tensor = new ort.Tensor("float32", input, [1, 3, MODEL_INPUT, MODEL_INPUT]);
      const feeds: Record<string, Tensor> = { [session.inputNames[0]]: tensor };
      const results = await session.run(feeds);
      const tInfer = performance.now();

      const out = results[session.outputNames[0]];
      if (!out || out.dims.length !== 3) {
        post({
          type: "error",
          frameId,
          message: `Unexpected model output shape: ${out?.dims?.join("x") ?? "unknown"}. This model is not YOLOv10-style; see the Model & Integration docs.`,
        });
        return;
      }
      const detections = decode(
        out.data as Float32Array,
        out.dims[1],
        out.dims[2],
        { ...meta, ...videoAspect },
        minScore,
      );
      post(
        {
          type: "result",
          frameId,
          detections,
          timings: { tPrep: tPrep - tRecv, tInfer: tInfer - tPrep },
        },
        [],
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: "error", message });
  }
};
