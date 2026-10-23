/**
 * Shared types for the AI Vision Simulator.
 *
 * IMPORTANT: This app is a purely visual simulation. It never simulates
 * mouse/keyboard input, never touches a game process, and never uploads
 * captured frames anywhere. Everything runs locally in the browser.
 */

export interface RawDetection {
  /** Normalized (0..1) top-left corner in source-video coordinates. */
  x: number;
  y: number;
  /** Normalized (0..1) size in source-video coordinates. */
  w: number;
  h: number;
  /** Detection confidence, 0..1. */
  score: number;
  classId: number;
  className: string;
}

export interface Track {
  id: number;
  /** Normalized (0..1), temporally smoothed box (top-left + size). */
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
  className: string;
  /**
   * true  = confirmed track (seen in multiple consecutive frames)
   * false = suspected track (single sighting, might be noise)
   */
  confirmed: boolean;
  /** True when the box center lies inside the FOV circle (visual only). */
  insideFov: boolean;
}

export type CaptureStatus =
  | "idle"
  | "starting"
  | "live"
  | "paused"
  | "ended"
  | "error";

export type ModelState =
  | "unloaded"
  | "loading"
  | "ready"
  | "error"
  | "demo";

export interface EngineStatus {
  /** Smoothed processing FPS (detections per second). */
  processingFps: number;
  /** Smoothed pure inference latency in ms. */
  inferenceMs: number;
  /** Smoothed end-to-end frame pipeline latency in ms. */
  frameMs: number;
  /** Number of raw detections in the latest processed frame. */
  detections: number;
  /** Number of active tracks (confirmed + suspected). */
  tracks: number;
  /** Inference backend actually in use, e.g. "webgpu" or "wasm". */
  backend: string;
  /** True when adaptive sampling slowed the pipeline below the target FPS. */
  adaptive: boolean;
}

export interface LogEntry {
  id: number;
  time: string;
  kind: "info" | "detect" | "lost" | "warn" | "error" | "success";
  message: string;
}

/** COCO-80 class names (YOLOv10n default). */
export const COCO_CLASSES: string[] = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train",
  "truck", "boat", "traffic light", "fire hydrant", "stop sign",
  "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep",
  "cow", "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella",
  "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard",
  "sports ball", "kite", "baseball bat", "baseball glove", "skateboard",
  "surfboard", "tennis racket", "bottle", "wine glass", "cup", "fork",
  "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
  "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair",
  "couch", "potted plant", "bed", "dining table", "toilet", "tv",
  "laptop", "mouse", "remote", "keyboard", "cell phone", "microwave",
  "oven", "toaster", "sink", "refrigerator", "book", "clock", "vase",
  "scissors", "teddy bear", "hair drier", "toothbrush",
];

export interface ModelPreset {
  label: string;
  url: string;
  inputSize: number;
  /** Number of output classes of the preset model. */
  classes: string[];
}

/**
 * Swappable model interface. Any ONNX model that takes a
 * [1, 3, inputSize, inputSize] NCHW float32 tensor (RGB, 0..1, letterboxed)
 * and outputs YOLOv10-style [1, 300, 6] rows (x1, y1, x2, y2, score, class)
 * works out of the box. See README ("Bring your own model").
 */
export const MODEL_PRESETS: Record<string, ModelPreset> = {
  "yolov10n-fp32": {
    label: "YOLOv10n · fp32 (9.4 MB)",
    url: "https://huggingface.co/onnx-community/yolov10n/resolve/main/onnx/model.onnx",
    inputSize: 640,
    classes: COCO_CLASSES,
  },
  "yolov10n-int8": {
    label: "YOLOv10n · int8 (2.7 MB, fastest)",
    url: "https://huggingface.co/onnx-community/yolov10n/resolve/main/onnx/model_quantized.onnx",
    inputSize: 640,
    classes: COCO_CLASSES,
  },
  custom: {
    label: "Custom ONNX URL…",
    url: "",
    inputSize: 640,
    classes: COCO_CLASSES,
  },
};

export interface SimulatorSettings {
  showEspBoxes: boolean;
  showCenterDot: boolean;
  showConfidence: boolean;
  /** Purely simulated, non-real distance estimate derived from box height. */
  showDistance: boolean;
  showCenterLines: boolean;
  boxColor: string;
  boxThickness: number;
  boxOpacity: number;
  showFovCircle: boolean;
  /** FOV radius as a fraction (0.05..1) of half the preview's min dimension. */
  fovRadius: number;
  fovColor: string;
  fovOpacity: number;
  fovThickness: number;
  showCrosshair: boolean;
  highlightInFov: boolean;
  confidenceThreshold: number;
  targetFps: number;
  /** Clearly-labeled demo mode with synthetic targets (no real AI). */
  demoMode: boolean;
  modelId: string;
  customModelUrl: string;
}

export const DEFAULT_SETTINGS: SimulatorSettings = {
  showEspBoxes: true,
  showCenterDot: true,
  showConfidence: true,
  showDistance: false,
  showCenterLines: false,
  boxColor: "#22d3ee",
  boxThickness: 2,
  boxOpacity: 0.9,
  showFovCircle: true,
  fovRadius: 0.45,
  fovColor: "#22d3ee",
  fovOpacity: 0.6,
  fovThickness: 2,
  showCrosshair: true,
  highlightInFov: true,
  confidenceThreshold: 0.45,
  targetFps: 10,
  demoMode: false,
  modelId: "yolov10n-fp32",
  customModelUrl: "",
};

export function resolveModelUrl(settings: SimulatorSettings): string {
  if (settings.modelId === "custom") {
    return settings.customModelUrl.trim();
  }
  return MODEL_PRESETS[settings.modelId]?.url ?? "";
}

/** Colors offered as quick swatches in the settings panel. */
export const COLOR_SWATCHES = [
  "#22d3ee",
  "#4ade80",
  "#facc15",
  "#f472b6",
  "#a78bfa",
  "#f87171",
  "#ffffff",
];
