import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { captureStore, pushLog } from "./store";
import type { CaptureStatus } from "./types";

/**
 * Screen capture via navigator.mediaDevices.getDisplayMedia().
 * The stream stays entirely local: nothing is recorded, stored or uploaded.
 * Capture is always started by an explicit user action and can be stopped at
 * any time.
 */
export function useScreenCapture(
  videoRef: React.RefObject<HTMLVideoElement | null>,
) {
  const streamRef = useRef<MediaStream | null>(null);
  const status = useSyncExternalStore(
    captureStore.subscribe,
    captureStore.get,
    captureStore.get,
  );

  const setStatus = useCallback(
    (s: CaptureStatus) => captureStore.set(s),
    [],
  );

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
    setStatus("idle");
    pushLog("info", "Screen capture stopped — all frames discarded.");
  }, [videoRef, setStatus]);

  const start = useCallback(async () => {
    const video = videoRef.current;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setStatus("error");
      toast.error("Screen capture is not supported in this browser.");
      return;
    }
    setStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 60 } },
        audio: false,
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      // The user can also end sharing from the browser UI — handle that.
      track.addEventListener("ended", () => {
        streamRef.current = null;
        if (video) video.srcObject = null;
        setStatus("ended");
        pushLog("warn", "Capture ended (sharing stopped outside the app).");
      });
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      setStatus("live");
      pushLog("success", `Screen capture started · ${track.label || "display"}`);
    } catch (err) {
      streamRef.current = null;
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setStatus("idle");
        toast.info("Screen sharing was cancelled.");
        pushLog("warn", "Screen sharing permission denied or cancelled.");
      } else {
        setStatus("error");
        const message = err instanceof Error ? err.message : String(err);
        toast.error(`Could not start capture: ${message}`);
        pushLog("error", `Capture error: ${message}`);
      }
    }
  }, [videoRef, setStatus]);

  const pause = useCallback(() => {
    videoRef.current?.pause();
    setStatus("paused");
    pushLog("info", "Processing paused — capture keeps running.");
  }, [videoRef, setStatus]);

  const resume = useCallback(async () => {
    await videoRef.current?.play().catch(() => undefined);
    setStatus("live");
    pushLog("info", "Processing resumed.");
  }, [videoRef, setStatus]);

  // Stop the stream (and its indicator) when the page unloads.
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    },
    [],
  );

  return {
    status,
    start,
    pause,
    resume,
    stop,
    isSupported:
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getDisplayMedia,
  };
}
