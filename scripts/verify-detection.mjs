/**
 * Headless verification of the detection pipeline math (mirrors
 * src/lib/simulator/detector.worker.ts exactly):
 *   letterbox → CHW tensor → YOLOv10 inference → decode → normalized boxes.
 * Run: bun scripts/verify-detection.mjs
 */
import ort from "onnxruntime-node";
import sharp from "sharp";

const MODEL = "./node_modules/.cache/yolo-verify/model.onnx";
const IMAGE = process.argv[2] ?? "./node_modules/.cache/yolo-verify/bus.jpg";
const MODEL_INPUT = 640;

// Emulate the app's capture pre-scaling: a 1280×720-ish source is resized to
// (round(w*scale), round(h*scale)) BEFORE the worker sees it — exactly like
// engine.ts does with createImageBitmap(video, { resizeWidth, resizeHeight }).
const raw = sharp(IMAGE);
const meta = await raw.metadata();
const srcW = meta.width;
const srcH = meta.height;
const captureScale = Math.min(MODEL_INPUT / srcW, MODEL_INPUT / srcH);
const resizeWidth = Math.max(2, Math.round(srcW * captureScale));
const resizeHeight = Math.max(2, Math.round(srcH * captureScale));
console.log(`source image: ${srcW}x${srcH} → pre-scaled bitmap: ${resizeWidth}x${resizeHeight}`);

// Worker letterbox of the pre-scaled bitmap.
const scale = Math.min(MODEL_INPUT / resizeWidth, MODEL_INPUT / resizeHeight);
const dw = Math.round(resizeWidth * scale);
const dh = Math.round(resizeHeight * scale);
const padX = Math.floor((MODEL_INPUT - dw) / 2);
const padY = Math.floor((MODEL_INPUT - dh) / 2);
console.log(`letterbox: scale=${scale.toFixed(3)} dw=${dw} dh=${dh} padX=${padX} padY=${padY}`);

// Build the 640×640 RGBA frame with gray padding, exactly like the worker canvas.
const resized = await sharp(IMAGE)
  .resize(resizeWidth, resizeHeight)
  .removeAlpha()
  .raw()
  .toBuffer();
const frame = Buffer.alloc(MODEL_INPUT * MODEL_INPUT * 3, 114); // rgb(114,114,114)
for (let y = 0; y < dh; y++) {
  for (let x = 0; x < dw; x++) {
    const src = (y * resizeWidth + x) * 3;
    const dst = ((y + padY) * MODEL_INPUT + (x + padX)) * 3;
    frame[dst] = resized[src];
    frame[dst + 1] = resized[src + 1];
    frame[dst + 2] = resized[src + 2];
  }
}

// HWC RGBA → CHW float32 RGB, 0..1 (worker's toTensor).
const n = MODEL_INPUT * MODEL_INPUT;
const tensorData = new Float32Array(3 * n);
for (let p = 0; p < n; p++) {
  tensorData[p] = frame[p * 3] / 255;
  tensorData[n + p] = frame[p * 3 + 1] / 255;
  tensorData[2 * n + p] = frame[p * 3 + 2] / 255;
}

const session = await ort.InferenceSession.create(MODEL, { executionProviders: ["cpu"] });
console.log("model inputs:", session.inputNames, "outputs:", session.outputNames);
const tensor = new ort.Tensor("float32", tensorData, [1, 3, MODEL_INPUT, MODEL_INPUT]);
const results = await session.run({ [session.inputNames[0]]: tensor });
const out = results[session.outputNames[0]];
console.log("output dims:", out.dims, "type:", out.type);

// Worker decode with the production meta (videoW/H = pre-scaled bitmap dims).
const rows = out.dims[1];
const stride = out.dims[2];
const minScore = 0.35;
const detections = [];
for (let r = 0; r < rows; r++) {
  const base = r * stride;
  const x1 = out.data[base];
  const y1 = out.data[base + 1];
  const x2 = out.data[base + 2];
  const y2 = out.data[base + 3];
  const score = out.data[base + 4];
  const classId = Math.round(out.data[base + 5]);
  if (!Number.isFinite(score) || score < minScore) continue;
  if (x2 - x1 < 2 || y2 - y1 < 2) continue;
  const px1 = (x1 - padX) / scale;
  const py1 = (y1 - padY) / scale;
  const px2 = (x2 - padX) / scale;
  const py2 = (y2 - padY) / scale;
  const x = Math.max(0, Math.min(1, px1 / resizeWidth));
  const y = Math.max(0, Math.min(1, py1 / resizeHeight));
  const w = Math.max(0.001, Math.min(1, px2 / resizeWidth) - x);
  const h = Math.max(0.001, Math.min(1, py2 / resizeHeight) - y);
  detections.push({ x, y, w, h, score, classId });
}

console.log(`\ndecoded ${detections.length} detections (minScore=${minScore}):`);
for (const d of detections.slice(0, 10)) {
  const cx = (d.x + d.w / 2).toFixed(2);
  const cy = (d.y + d.h / 2).toFixed(2);
  console.log(
    `  class=${d.classId} score=${(d.score * 100).toFixed(0)}%  box(x=${d.x.toFixed(2)}, y=${d.y.toFixed(2)}, w=${d.w.toFixed(2)}, h=${d.h.toFixed(2)})  center=(${cx},${cy})`,
  );
}
