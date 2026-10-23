import { useRef } from "react";
import {
  Crosshair,
  FileVideo,
  Layers,
  MonitorOff,
  Pause,
  Play,
  ShieldCheck,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useVideoSource } from "@/lib/simulator/useVideoSource";

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

const SOURCE_LABEL: Record<string, string> = {
  none: "no source",
  capture: "screen capture",
  file: "video file",
};

/**
 * Source controls: live screen capture and local video files, with
 * start / pause / resume / stop. Nothing is recorded or uploaded —
 * every frame stays in this tab.
 */
export function ScreenCapture({ videoRef }: ScreenCaptureProps) {
  const { status, sourceKind, start, selectFile, pause, resume, stop, isSupported } =
    useVideoSource(videoRef);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const live = status === "live";
  const paused = status === "paused";
  const active = live || paused || status === "starting";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!active ? (
        <>
          <Button onClick={() => void start()} className="gap-2" disabled={!isSupported}>
            <Crosshair className="size-4" />
            Start Capture
          </Button>
          <Button
            variant="secondary"
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileVideo className="size-4" />
            Video file…
          </Button>
        </>
      ) : (
        <>
          {paused ? (
            <Button onClick={() => void resume()} className="gap-2">
              <Play className="size-4" />
              Resume
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={pause}
              className="gap-2"
              disabled={status === "starting"}
            >
              <Pause className="size-4" />
              Pause
            </Button>
          )}
          <Button variant="destructive" onClick={stop} className="gap-2">
            <Square className="size-4" />
            Stop
          </Button>
          {sourceKind === "capture" && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileVideo className="size-4" />
              Switch to file…
            </Button>
          )}
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) selectFile(file);
          e.target.value = "";
        }}
      />

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
        {sourceKind !== "none" && ` · ${SOURCE_LABEL[sourceKind]}`}
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
        {isSupported && sourceKind === "none" && (
          <span className="ml-2 flex items-center gap-1">
            <Layers className="size-3.5" />
            Screen · window · tab · file
          </span>
        )}
      </span>
    </div>
  );
}
