# AI Vision Simulator

A browser-based **AI aim-assist / ESP simulator** for training, analysis and
demonstration purposes. Point it at any screen, window or browser tab (a
YouTube gameplay video works great) and watch real YOLO object detection,
ESP bounding boxes, a configurable FOV circle and object tracking rendered as
a live overlay.

> **This is a visual simulation only.** The app never simulates mouse or
> keyboard input, never reads game memory, never injects into any process and
> never attempts to bypass anti-cheat systems. All processing is local — no
> frames are ever recorded or uploaded.

## Features

- **Live screen capture** via `navigator.mediaDevices.getDisplayMedia()` —
  screen, window or tab, with start / pause / resume / stop and full handling
  of denied permissions and externally ended sharing.
- **Real object detection**: YOLOv10n (COCO) runs in a Web Worker through
  **ONNX Runtime Web** with automatic **WebGPU → WASM** backend fallback.
- **Honest model story**: the preset detects COCO *“person”* — an honest proxy
  for enemy-like figures, **not** a Valorant-specific model. The model
  interface is documented and swappable (see below). A clearly-labeled
  **demo mode** with synthetic targets lets you test the overlay pipeline
  without any model.
- **ESP overlay**: bounding boxes with color/thickness/transparency controls,
  confidence labels, optional center dots, optional *simulated* (non-real)
  distance readouts and optional center-to-target lines. Confirmed and
  suspected (single-sighting) tracks are drawn differently (solid vs dashed).
- **FOV circle + crosshair**: configurable radius, color, transparency,
  thickness; optional highlighting of targets inside the FOV. Purely visual.
- **Object tracking**: IoU matching + exponential smoothing keeps boxes stable
  between frames; tracks age out gracefully.
- **Performance monitoring**: status bar with processing FPS, inference
  latency, backend, model status and detection counts, plus an adaptive
  frame-sampling rate when the hardware can't keep up.
- **Up to 60 FPS (experimental)**: the overlay renders at display rate with
  interpolated boxes; 60 detections/s need the WebGPU backend and a fast GPU
  — on WASM the engine throttles honestly below the target instead of
  stuttering.
- **Live detection log** and a full settings panel with reset-to-defaults.
- Letterbox-aware overlay scaling: boxes stay glued to the video across
  resolutions, aspect ratios and window resizes.

## Quickstart

Requirements: [Bun](https://bun.sh) (or Node 20+ with npm).

```bash
bun install
bun run dev        # dev server on http://localhost:5173
```

Production build:

```bash
bun run build      # typecheck + vite build
bun run preview    # serve the production build
```

The app uses Convex Auth (email OTP / anonymous sign-in). The Convex
deployment and `VITE_CONVEX_URL` are preconfigured in this environment; for a
fresh checkout run `bun convex dev` once and set `VITE_CONVEX_URL`.

## Usage

1. Sign in and open the **Vision Console** (`/dashboard`).
2. Press **Start Capture** and pick a screen, window or browser tab (e.g. a
   YouTube Valorant gameplay video in full-screen).
3. The model downloads once (~9.4 MB fp32 or ~2.7 MB int8) and then runs
   fully locally. Watch the status bar until the backend reports ready.
4. Tune the FOV circle, ESP boxes, confidence threshold and processing speed
   in the right-hand settings panel.
5. If you just want to inspect the overlay visuals without a model, flip on
   **Demo mode** — synthetic, clearly-labeled targets.

### Honest limitations

- The preset model is a general COCO person detector. It detects *humans* —
  it is not trained on Valorant character renders, so in-game enemy detection
  quality varies. It demonstrates the pipeline truthfully; it does not fake
  detections.
- Screen capture requires a browser with `getDisplayMedia` (Chrome, Edge,
  Firefox; Safari ≥ 13). WebGPU acceleration needs a WebGPU-capable browser.

## Bring your own model (swappable model interface)

The worker (`src/lib/simulator/detector.worker.ts`) expects:

- **Input**: `float32 [1, 3, 640, 640]`, NCHW, RGB, values 0–1, letterboxed
  (letterboxing and un-mapping to source coordinates are handled for you).
- **Output**: YOLOv10 end-to-end tensor `[1, 300, 6]` with rows
  `(x1, y1, x2, y2, score, classId)` in letterbox pixel coordinates
  (NMS built into the model). Only `classId 0` (“person”) is tracked.

To plug in a gameplay-trained detector:

1. Fine-tune a YOLOv8/v10/v11 variant on annotated gameplay frames (enemy
   characters as one class).
2. Export end-to-end ONNX, e.g. with Ultralytics:
   `model.export(format="onnx", nms=True)`.
3. Host the `.onnx` file on any CORS-enabled host (Hugging Face, jsDelivr,
   your own CDN).
4. In the settings panel choose **Custom ONNX URL…**, paste the URL and press
   **Load / reload**.

For raw YOLOv8/v11 output tensors (no built-in NMS), extend the `decode`
function in the worker — it is isolated and documented.

## Architecture

```
src/
  lib/simulator/
    types.ts             # shared types, model presets, default settings
    store.ts             # tiny external stores (settings/status/capture/model/log)
    useScreenCapture.ts  # getDisplayMedia lifecycle hook
    detector.worker.ts   # ONNX Runtime Web worker: letterbox → infer → decode
    tracker.ts           # IoU multi-object tracker with EMA smoothing
    engine.ts            # DetectionEngine: adaptive sampling, demo mode, status
  components/simulator/
    ScreenCapture.tsx    # capture controls + status badge
    VideoPreview.tsx     # <video> + letterbox math + overlay layering
    EspOverlay.tsx       # ESP canvas (rAF loop, no React state in hot path)
    FovCircle.tsx        # FOV circle + crosshair canvas
    SettingsPanel.tsx    # all detection/appearance/model controls
    PerformanceMonitor.tsx
    DetectionLog.tsx
    InfoPanels.tsx       # Model & Integration docs, Privacy & Security
  pages/
    Landing.tsx          # public landing page
    Dashboard.tsx        # protected vision console
```

Design notes:

- Overlay canvases read tracks/settings directly from stores inside a
  `requestAnimationFrame` loop, so slider changes never re-render the frame
  pipeline.
- Frames are transferred to the worker as zero-copy `ImageBitmap`s and closed
  immediately after inference.
- Processing is throttled to the selected target FPS and automatically backs
  off (adaptive sampling) when inference latency exceeds the frame budget.

## Privacy & security

- Capture is **always user-initiated**; there is no hidden recording.
- Frames are processed in-tab and discarded immediately. **Nothing is ever
  uploaded.**
- You can stop at any time — and ending sharing via the browser UI is
  detected and honored.
- **No game integration of any kind**: no input simulation, no process/memory
  access, no anti-cheat circumvention, no auto-targeting. The FOV circle is
  an orientation aid only.

Use responsibly and only on content you are allowed to analyze.
