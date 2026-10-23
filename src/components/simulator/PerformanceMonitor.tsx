import { Activity, Cpu, Gauge, ScanEye, Users } from "lucide-react";
import { captureStore, modelStore, statusStore, useStore } from "@/lib/simulator/store";
import type { CaptureStatus, ModelState } from "@/lib/simulator/types";

const MODEL_LABEL: Record<ModelState, string> = {
  unloaded: "not loaded",
  loading: "loading…",
  ready: "ready",
  error: "error",
  demo: "demo",
};

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={accent ? "text-primary" : "text-muted-foreground"}>{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono text-[11px] ${accent ? "text-primary" : ""}`}>{value}</span>
    </span>
  );
}

/** Status bar with live pipeline metrics. Values update ~2×/s, not per frame. */
export function PerformanceMonitor() {
  const status = useStore(statusStore);
  const captureStatus = useStore<CaptureStatus>(captureStore);
  const modelState = useStore<ModelState>(modelStore);

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg border border-border/70 bg-card/50 px-3 py-2 text-xs">
      <Stat
        icon={<Activity className="size-3.5" />}
        label="Capture"
        value={captureStatus}
        accent={captureStatus === "live"}
      />
      <Stat
        icon={<Gauge className="size-3.5" />}
        label="Processing"
        value={`${status.processingFps.toFixed(1)} fps${status.adaptive ? " · adaptive" : ""}`}
        accent
      />
      <Stat
        icon={<Cpu className="size-3.5" />}
        label="Inference"
        value={`${status.inferenceMs.toFixed(0)} ms · ${status.frameMs.toFixed(0)} ms/frame`}
      />
      <Stat
        icon={<ScanEye className="size-3.5" />}
        label="Backend"
        value={status.backend}
      />
      <Stat
        icon={<Cpu className="size-3.5" />}
        label="Model"
        value={MODEL_LABEL[modelState]}
        accent={modelState === "ready"}
      />
      <Stat
        icon={<Users className="size-3.5" />}
        label="Detections"
        value={`${status.detections} raw · ${status.tracks} tracked`}
        accent={status.tracks > 0}
      />
    </div>
  );
}
