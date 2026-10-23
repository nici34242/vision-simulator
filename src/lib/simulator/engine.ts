import {
  modelMessageStore,
  modelStore,
  pushLog,
  settingsStore,
  statusStore,
} from "./store";
import { ObjectTracker } from "./tracker";
import type { EngineStatus, RawDetection, Track } from "./types";
import { DETECTION_INPUT_SIZE, resolveModelUrl } from "./types";

/** Only COCO "person" is tracked — an honest proxy for enemy-like figures. */
const PERSON_CLASS = "person";
const STATUS_PUSH_MS = 400;
const EMA = 0.25;

interface ResultMsg {
  type: "result";
  frameId: number;
  detections: RawDetection[];
  timings: { tPrep: number; tInfer: number };
}

interface LoadedMsg {
  type: "loaded";
  backend: string;
  inputSize: number;
}

interface LoadErrorMsg {
  type: "load-error";
  message: string;
}

interface ErrorMsg {
  type: "error";
  frameId?: number;
  message: string;
}

type WorkerMsg = ResultMsg | LoadedMsg | LoadErrorMsg | ErrorMsg;

/**
 * Owns the detection worker, runs the capture → infer → track pipeline and
 * publishes smoothed tracks for the overlay plus throttled status for the UI.
 *
 * The FOV circle and all overlay elements are visual-only: this engine never
 * issues any input events and never interacts with any game process.
 */
export class DetectionEngine {
  private worker: Worker | null = null;
  private tracker = new ObjectTracker();
  private video: HTMLVideoElement | null = null;
  private running = false;
  private busy = false;
  private rafId = 0;
  private lastProcessAt = 0;
  private frameId = 0;
  private latestTracks: Track[] = [];
  /** Track ID → was confirmed at previous frame, to emit log events on change. */
  private knownTracks = new Map<number, boolean>();
  private lastStatusPush = 0;
  private backend = "—";
  private inferEma = 0;
  private fpsEma = 0;
  private frameEma = 0;
  private demoPhase = Math.random() * 1000;

  /** Lazily create the module worker (avoids work when never used). */
  private ensureWorker(): Worker {
    if (!this.worker) {
      const worker = new Worker(
        new URL("./detector.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.onmessage = (event: MessageEvent<WorkerMsg>) =>
        this.onWorkerMessage(event.data);
      worker.onerror = (err) => {
        pushLog("error", `Detection worker error: ${err.message}`);
      };
      this.worker = worker;
    }
    return this.worker;
  }

  /** Load (or reload) the model selected in settings. */
  loadModel(): void {
    const settings = settingsStore.get();
    const url = resolveModelUrl(settings);
    if (!url) {
      pushLog(
        "warn",
        "No model URL configured — enter a custom ONNX URL or pick a preset.",
      );
      return;
    }
    this.ensureWorker();
    modelStore.set("loading");
    modelMessageStore.set("");
    pushLog("info", `Loading model… ${url.split("/").slice(-1)[0]}`);
    this.worker!.postMessage({ type: "load", url });
  }

  attachVideo(video: HTMLVideoElement | null) {
    this.video = video;
    if (!video) this.stop();
  }

  /** Begin the processing loop (safe to call repeatedly). */
  start() {
    if (this.running) return;
    this.ensureWorker();
    this.running = true;
    this.lastProcessAt = 0;
    const tick = () => {
      if (!this.running) return;
      this.processOnce();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  getTracks(): Track[] {
    return this.latestTracks;
  }

  resetTracking() {
    this.tracker.reset();
    this.latestTracks = [];
    this.knownTracks.clear();
  }

  dispose() {
    this.stop();
    this.worker?.terminate();
    this.worker = null;
  }

  private onWorkerMessage(msg: WorkerMsg) {
    switch (msg.type) {
      case "loaded":
        this.backend = msg.backend;
        modelStore.set("ready");
        pushLog("success", `Model ready · ${msg.backend.toUpperCase()} backend`);
        break;
      case "load-error":
        this.backend = "—";
        modelStore.set("error");
        modelMessageStore.set(msg.message);
        pushLog("error", `Model failed to load: ${msg.message}`);
        break;
      case "error":
        pushLog("warn", msg.message);
        break;
      case "result":
        this.onResult(msg);
        break;
    }
  }

  private onResult(msg: ResultMsg) {
    this.busy = false;
    const now = performance.now();
    const tInfer = Math.max(0, msg.timings.tInfer);
    this.inferEma = this.inferEma * (1 - EMA) + tInfer * EMA;
    this.frameEma = this.frameEma * (1 - EMA) + (now - this.lastSentAt) * EMA;
    this.fpsEma =
      this.fpsEma * (1 - EMA) + (1000 / Math.max(1, now - this.lastProcessAt)) * EMA;

    const settings = settingsStore.get();
    // Only "person" detections are enemy-like proxies; other classes are noise
    // here. Re-apply the user's threshold so stale in-flight jobs (sent with an
    // older threshold) can't surface detections above the current setting.
    const persons = msg.detections.filter(
      (d) => d.className === PERSON_CLASS && d.score >= settings.confidenceThreshold,
    );
    const fovMeta = this.fovMeta(settings.fovRadius);
    const tracks = this.tracker.update(persons, now);
    for (const t of tracks) t.insideFov = this.isInsideFov(t, fovMeta);
    this.latestTracks = tracks;
    this.emitTrackEvents(tracks);
    this.pushStatus(persons.length, tracks.length);
  }

  private lastSentAt = performance.now();

  private processOnce() {
    const settings = settingsStore.get();
    const now = performance.now();

    // Demo mode runs standalone so overlays can be tested before capture.
    if (settings.demoMode) {
      const demoInterval = Math.max(1000 / settings.targetFps, 16);
      if (now - this.lastProcessAt < demoInterval) return;
      this.lastProcessAt = now;
      this.processDemo(settings, now);
      return;
    }

    const video = this.video;
    if (!video || video.readyState < 2 || video.paused || video.ended) return;

    const inferBudget = this.inferEma;
    // Adaptive sampling: never schedule faster than the hardware keeps up.
    // Tight floor so 60 FPS is reachable on fast WebGPU backends, while slow
    // WASM inference still throttles honestly via the same formula.
    const interval = Math.max(
      1000 / settings.targetFps,
      inferBudget * 1.1 + 8,
    );
    if (this.busy || now - this.lastProcessAt < interval) return;

    if (!this.worker || this.backend === "—") return;

    const sentAt = performance.now();
    this.lastSentAt = sentAt;
    // Pre-scale on capture so the worker skips downscaling a full-res frame.
    // Rounded dims introduce ≤0.5 px error, which the letterbox math absorbs.
    const vw = video.videoWidth || 16;
    const vh = video.videoHeight || 9;
    const scale = Math.min(DETECTION_INPUT_SIZE / vw, DETECTION_INPUT_SIZE / vh);
    const resizeWidth = Math.max(2, Math.round(vw * scale));
    const resizeHeight = Math.max(2, Math.round(vh * scale));
    createImageBitmap(video, { resizeWidth, resizeHeight, resizeQuality: "low" })
      .then((bitmap) => {
        this.busy = true;
        this.lastProcessAt = performance.now();
        this.frameId += 1;
        this.worker!.postMessage(
          {
            type: "infer",
            frameId: this.frameId,
            bitmap,
            // The frame was pre-scaled at capture: the worker un-maps its
            // letterbox output into THIS bitmap's pixel space, whose aspect
            // ratio equals the source video's. Normalized coords are then
            // identical to video-relative coordinates.
            videoW: resizeWidth,
            videoH: resizeHeight,
            minScore: settings.confidenceThreshold,
            t0: this.lastProcessAt,
          },
          [bitmap],
        );
      })
      .catch((err) => {
        pushLog("warn", `Frame capture failed: ${err?.message ?? err}`);
      });
  }

  /** Clearly-labeled synthetic targets so the overlay pipeline can be tested. */
  private processDemo(settings: { targetFps: number; fovRadius: number }, now: number) {
    const t = now / 1000;
    const synth: RawDetection[] = [];
    const paths = [
      { cx: 0.5, cy: 0.42, ax: 0.26, ay: 0.1, fx: 0.5, fy: 0.31, w: 0.05, h: 0.16, phase: 0 },
      { cx: 0.36, cy: 0.55, ax: 0.14, ay: 0.07, fx: 0.83, fy: 0.47, w: 0.035, h: 0.11, phase: 2.1 },
      { cx: 0.66, cy: 0.6, ax: 0.1, ay: 0.12, fx: 0.61, fy: 0.4, w: 0.028, h: 0.09, phase: 4.4 },
    ];
    for (const p of paths) {
      synth.push({
        x: p.cx + Math.sin(t * p.fx + p.phase) * p.ax - p.w / 2,
        y: p.cy + Math.sin(t * p.fy + p.phase * 1.7) * p.ay - p.h / 2,
        w: p.w,
        h: p.h,
        score: 0.78 + 0.18 * Math.abs(Math.sin(t * 0.9 + p.phase)),
        classId: -1,
        className: PERSON_CLASS,
      });
    }
    const fovMeta = this.fovMeta(settings.fovRadius);
    const tracks = this.tracker.update(synth, now);
    for (const track of tracks) track.insideFov = this.isInsideFov(track, fovMeta);
    this.latestTracks = tracks;
    this.fpsEma = this.fpsEma * (1 - EMA) + (1000 / settings.targetFps) * EMA;
    this.inferEma = 2;
    this.frameEma = 4;
    this.backend = "demo";
    this.emitTrackEvents(tracks);
    this.pushStatus(synth.length, tracks.length);
  }

  /** (width-normalized distance metric, radius) describing the FOV circle. */
  private fovMeta(fovRadius: number) {
    const video = this.video;
    const w = video?.videoWidth || 1920;
    const h = video?.videoHeight || 1080;
    return { w, h, radius: Math.max(0.02, fovRadius) * (Math.min(w, h) / 2) };
  }

  private isInsideFov(
    t: Track,
    meta: { w: number; h: number; radius: number },
  ): boolean {
    const dx = (t.x + t.w / 2 - 0.5) * meta.w;
    const dy = (t.y + t.h / 2 - 0.5) * meta.h;
    return Math.hypot(dx, dy) <= meta.radius;
  }

  /** Log confirmed/lost transitions, throttled to keep the log readable. */
  private emitTrackEvents(tracks: Track[]) {
    const seen = new Set<number>();
    for (const t of tracks) {
      seen.add(t.id);
      const wasConfirmed = this.knownTracks.get(t.id);
      if (t.confirmed && wasConfirmed === false) {
        pushLog(
          "detect",
          `Target #${t.id} confirmed · ${(t.score * 100).toFixed(0)}% · ${t.insideFov ? "in FOV" : "outside FOV"}`,
        );
      }
      this.knownTracks.set(t.id, t.confirmed);
    }
    for (const [id, wasConfirmed] of this.knownTracks) {
      if (!seen.has(id) && wasConfirmed) {
        pushLog("lost", `Target #${id} lost`);
        this.knownTracks.delete(id);
      } else if (!seen.has(id)) {
        this.knownTracks.delete(id);
      }
    }
  }

  private pushStatus(detections: number, tracks: number, adaptiveOverride?: boolean) {
    const now = performance.now();
    if (now - this.lastStatusPush < STATUS_PUSH_MS) return;
    this.lastStatusPush = now;
    const settings = settingsStore.get();
    const adaptive =
      adaptiveOverride ??
      (this.inferEma * 1.1 + 8 > 1000 / settings.targetFps);
    const status: EngineStatus = {
      processingFps: this.fpsEma,
      inferenceMs: this.inferEma,
      frameMs: this.frameEma,
      detections,
      tracks,
      backend: this.backend,
      adaptive,
    };
    statusStore.set(status);
  }
}
