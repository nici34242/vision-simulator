import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, MonitorPlay, ScanEye } from "lucide-react";
import { EspOverlay } from "./EspOverlay";
import { FovCircle } from "./FovCircle";
import { modelStore, captureStore, settingsStore, useStore } from "@/lib/simulator/store";
import type { DetectionEngine } from "@/lib/simulator/engine";

/** Rendered video area inside the preview container, in CSS pixels. */
export interface ViewRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface VideoPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  engine: DetectionEngine;
}

/**
 * Preview surface. The <video> element uses object-contain, so the overlay
 * canvases must sit exactly on the letterboxed video area — computed here from
 * the container size and the video's intrinsic resolution, updated on window
 * resizes, container resizes and source resolution changes.
 */
export function VideoPreview({ videoRef, engine }: VideoPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewRect, setViewRect] = useState<ViewRect>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
  const settings = useStore(settingsStore);
  const modelState = useStore(modelStore);
  const captureStatus = useStore(captureStore);

  const recompute = useCallback(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const vw = video?.videoWidth || 16;
    const vh = video?.videoHeight || 9;
    const scale = Math.min(cw / vw, ch / vh);
    const width = vw * scale;
    const height = vh * scale;
    setViewRect({
      left: (cw - width) / 2,
      top: (ch - height) / 2,
      width,
      height,
    });
  }, [videoRef]);

  useEffect(() => {
    recompute();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(recompute);
    observer.observe(container);
    window.addEventListener("resize", recompute);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [recompute]);

  // Re-fit when the stream resolution changes.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handler = () => recompute();
    video.addEventListener("loadedmetadata", handler);
    video.addEventListener("resize", handler);
    return () => {
      video.removeEventListener("loadedmetadata", handler);
      video.removeEventListener("resize", handler);
    };
  }, [videoRef, recompute]);

  return (
    <div
      ref={containerRef}
      className="relative aspect-video w-full overflow-hidden rounded-lg border border-border/70 bg-black"
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-contain"
        playsInline
        muted
      />
      <FovCircle viewRect={viewRect} />
      <EspOverlay engine={engine} viewRect={viewRect} />

      {!settings.demoMode && modelState === "loading" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          Loading detection model…
        </div>
      )}
      {!settings.demoMode && modelState === "error" && (
        <div className="absolute top-3 left-1/2 flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-full border border-destructive/40 bg-background/80 px-3 py-1 text-xs text-destructive backdrop-blur">
          <AlertTriangle className="size-3.5 shrink-0" />
          Model failed to load — see the Model & Integration tab.
        </div>
      )}
      {settings.demoMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400 backdrop-blur">
          DEMO MODE — synthetic targets, no real detection
        </div>
      )}

      {(captureStatus === "idle" || captureStatus === "ended" || captureStatus === "error") && (
        <PreviewPlaceholder />
      )}
    </div>
  );
}

function PreviewPlaceholder() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-center">
      <div className="flex size-12 items-center justify-center rounded-full border border-border/70 bg-background/60">
        <MonitorPlay className="size-6 text-muted-foreground" />
      </div>
      <div>
        <p className="flex items-center justify-center gap-2 text-sm font-medium">
          <ScanEye className="size-4 text-primary" />
          No capture active
        </p>
        <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
          Start a screen, window or browser-tab capture above — a YouTube
          gameplay video works great. Frames are processed locally and never
          leave your device.
        </p>
      </div>
    </div>
  );
}
