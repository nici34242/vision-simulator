import { BookOpen, Cpu, Package, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { modelMessageStore, modelStore, useStore } from "@/lib/simulator/store";
import type { DetectionEngine } from "@/lib/simulator/engine";

function PanelHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <h2 className="tracking-tight font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

/**
 * Documents the swappable model interface and how to plug in a
 * gameplay-trained model. This is real documentation, not marketing copy.
 */
export function ModelInfoPanel({ engine }: { engine: DetectionEngine }) {
  const modelState = useStore(modelStore);
  const message = useStore(modelMessageStore);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <PanelHeader
        icon={<Cpu className="size-5" />}
        title="Model & Integration"
        subtitle="Which model runs, what it can and cannot do, and how to swap it."
      />

      <section className="rounded-lg border border-border/70 bg-card/50 p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Package className="size-4 text-primary" />
          Current model
        </h3>
        <p className="text-sm leading-6 text-muted-foreground">
          The preset model is <strong className="text-foreground">YOLOv10n</strong>{" "}
          (COCO-80), served from the{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">onnx-community/yolov10n</code>{" "}
          Hugging Face repository and executed with ONNX Runtime Web. The worker
          tries the <strong className="text-foreground">WebGPU</strong> backend
          first and falls back to <strong className="text-foreground">WASM</strong>.
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          <strong className="text-amber-400">Honest limitation:</strong> a
          general COCO person model detects <em>humans</em>, not Valorant
          enemies. It works well on live-action footage and reasonably on
          gameplay where figures resemble people, but it is{" "}
          <strong className="text-foreground">not</strong> trained on Valorant
          character renders. Treat its output as a demonstration of the
          pipeline, not a gameplay-grade enemy detector.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border/70 px-2.5 py-0.5 text-xs">
            Status:{" "}
            <span
              className={
                modelState === "ready"
                  ? "text-emerald-400"
                  : modelState === "error"
                    ? "text-destructive"
                    : "text-muted-foreground"
              }
            >
              {modelState}
            </span>
          </span>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => engine.loadModel()}
          >
            Load / reload model
          </Button>
        </div>
        {message && (
          <p className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
            {message}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-border/70 bg-card/50 p-4">
        <h3 className="mb-2 text-sm font-semibold">Model interface (swap-ready)</h3>
        <p className="text-sm leading-6 text-muted-foreground">
          Any ONNX model matching this contract runs without code changes —
          pick “Custom ONNX URL…” in the settings panel and paste the URL:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            Input: <code className="rounded bg-muted px-1 text-xs">float32 [1, 3, 640, 640]</code>,
            NCHW, RGB, 0–1, letterboxed (the worker handles letterboxing and
            un-mapping boxes).
          </li>
          <li>
            Output: <code className="rounded bg-muted px-1 text-xs">[1, 300, 6]</code> —
            per row <code className="rounded bg-muted px-1 text-xs">(x1, y1, x2, y2, score, classId)</code>{" "}
            in letterbox pixels (YOLOv10 end-to-end format; NMS built into the
            model).
          </li>
          <li>
            Only <code className="rounded bg-muted px-1 text-xs">classId 0</code>{" "}
            (“person”) is tracked as an enemy-like figure.
          </li>
        </ul>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          To train a Valorant-style detector: fine-tune a YOLOv8/v10/v11 variant
          on annotated gameplay frames (enemy characters as one class), export
          with{" "}
          <code className="rounded bg-muted px-1 text-xs">
            model.export(format="onnx", nms=True)
          </code>{" "}
          (or the matching end-to-end export for your framework), host the{" "}
          <code className="rounded bg-muted px-1 text-xs">.onnx</code> file on
          any CORS-enabled host (Hugging Face, jsDelivr, your own CDN) and load
          it via the custom URL. For YOLOv8/v11 raw output tensors instead of
          end-to-end exports, extend{" "}
          <code className="rounded bg-muted px-1 text-xs">
            src/lib/simulator/detector.worker.ts
          </code>{" "}
          — the decode function is isolated in one place and documented.
        </p>
      </section>

      <section className="rounded-lg border border-border/70 bg-card/50 p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="size-4 text-primary" />
          Pipeline overview
        </h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Screen capture frames → transferable ImageBitmaps (zero-copy).</li>
          <li>Worker letterboxes to 640×640 and builds the NCHW tensor.</li>
          <li>ONNX Runtime Web infers (WebGPU, else WASM) — fully local.</li>
          <li>Detections → IoU tracker: smoothing, confirm/suspect, age-out.</li>
          <li>Overlay canvases render tracks; adaptive sampling keeps FPS stable.</li>
        </ol>
      </section>
    </div>
  );
}

/** Static privacy & security facts. */
export function PrivacyPanel() {
  const items: [string, string][] = [
    [
      "Capture is always opt-in",
      "Recording starts only when you press “Start Capture” and pick a source in the browser dialog. There is no hidden or background capture.",
    ],
    [
      "Frames never leave your device",
      "Every frame is analyzed in this browser tab (Web Worker + WebGPU/WASM). Nothing is uploaded, stored or logged — frames are discarded immediately after inference.",
    ],
    [
      "You can always stop",
      "Pause or stop processing at any time; ending sharing in the browser UI is detected and honored too.",
    ],
    [
      "No game integration whatsoever",
      "The simulator does not read game memory, does not inject into any process, does not simulate mouse or keyboard input and does not attempt to bypass anti-cheat systems. The FOV circle is a visual aid only — it never triggers targeting.",
    ],
  ];
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <PanelHeader
        icon={<ShieldCheck className="size-5" />}
        title="Privacy & Security"
        subtitle="What this simulator does — and, just as importantly, what it never does."
      />
      <section className="rounded-lg border border-border/70 bg-card/50 p-4">
        <ul className="space-y-3">
          {items.map(([title, body]) => (
            <li key={title} className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-sm leading-6 text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-xs leading-5 text-muted-foreground">
        This project is an educational visualization of how detection overlays
        work. Use it only on content you are allowed to analyze (e.g. your own
        screen or gameplay videos) and respect the terms of any game you
        observe.
      </p>
    </div>
  );
}
