import { Crosshair, Layers, MonitorOff, Pause, Play, ShieldCheck, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useScreenCapture } from "@/lib/simulator/useScreenCapture";

interface ScreenCaptureProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

const STATUS_LABEL: Record<string, string> = {
  idle: "Idle",
  starting: "Starting…",
  live: "Live",
  paused: "Paused",
  ended: "Ended",
  error: "Error",
};

/**
 * Capture controls: start / pause / resume / stop for the local screen
 * capture. Nothing is recorded or uploaded — the stream lives in this tab only.
 */
export function ScreenCapture({ videoRef }: ScreenCaptureProps) {
  const { status, start, pause, resume, stop, isSupported } =
    useScreenCapture(videoRef);

  const live = status === "live";
  const paused = status === "paused";
  const active = live || paused || status === "starting";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!active ? (
        <Button onClick={() => void start()} className="gap-2" disabled={!isSupported}>
          <Crosshair className="size-4" />
          Start Capture
        </Button>
      ) : (
        <>
          {paused ? (
            <Button onClick={() => void resume()} className="gap-2">
              <Play className="size-4" />
              Resume
            </Button>
          ) : (
            <Button variant="secondary" onClick={pause} className="gap-2" disabled={status === "starting"}>
              <Pause className="size-4" />
              Pause
            </Button>
          )}
          <Button variant="destructive" onClick={stop} className="gap-2">
            <Square className="size-4" />
            Stop
          </Button>
        </>
      )}

      <Badge
        variant="outline"
        className={
          live
            ? "border-primary/50 text-primary"
            : paused
              ? "border-amber-500/50 text-amber-400"
              : status === "error"
                ? "border-destructive/50 text-destructive"
                : "text-muted-foreground"
        }
      >
        <span
          className={`mr-1 inline-block size-1.5 rounded-full ${
            live
              ? "animate-pulse bg-primary"
              : paused
                ? "bg-amber-400"
                : status === "error"
                  ? "bg-destructive"
                  : "bg-muted-foreground"
          }`}
        />
        {STATUS_LABEL[status] ?? status}
      </Badge>

      <span className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
        <ShieldCheck className="size-3.5 text-primary" />
        Local processing only — nothing is recorded or uploaded
        {!isSupported && (
          <span className="ml-2 flex items-center gap-1 text-destructive">
            <MonitorOff className="size-3.5" />
            getDisplayMedia unsupported
          </span>
        )}
        {isSupported && status === "idle" && (
          <span className="ml-2 flex items-center gap-1">
            <Layers className="size-3.5" />
            Screen · window · tab
          </span>
        )}
      </span>
    </div>
  );
}
