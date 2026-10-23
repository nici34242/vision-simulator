import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { captureStore, pushLog, sourceStore } from "./store";
import type { CaptureStatus } from "./types";

export type SourceKind = "none" | "capture" | "file";

/**
 * Unified video source for the engine: either a live screen capture
 * (`getDisplayMedia`) or a local video file (object URL, looped).
 *
 * Both stay entirely local — nothing is recorded, stored or uploaded.
 * Starting one source always stops the other; everything can be paused,
 * resumed and stopped at any time.
 */
export function useVideoSource(
  videoRef: React.RefObject<HTMLVideoElement | null>,
) {
  const streamRef = useRef<MediaStream | null>(null);
  const fileUrlRef = useRef<string | null>(null);
  const sourceKindRef = useRef<SourceKind>("none");

  const status = useSyncExternalStore(
    captureStore.subscribe,
    captureStore.get,
    captureStore.get,
  );
  const sourceKind = useSyncExternalStore(
    sourceStore.subscribe,
    sourceStore.get,
    sourceStore.get,
  );

  const setStatus = useCallback((s: CaptureStatus) => captureStore.set(s), []);

  const clearFile = useCallback(() => {
    if (fileUrlRef.current) {
      URL.revokeObjectURL(fileUrlRef.current);
      fileUrlRef.current = null;
    }
  }, []);

  const clearCapture = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const detachVideo = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
      video.removeAttribute("src");
      video.load();
    }
  }, [videoRef]);

  const stop = useCallback(() => {
    clearCapture();
    clearFile();
    detachVideo();
    sourceKindRef.current = "none";
    sourceStore.set("none");
    setStatus("idle");
    pushLog("info", "Source stopped — all frames discarded.");
  }, [clearCapture, clearFile, detachVideo, setStatus]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setStatus("error");
      toast.error("Screen capture is not supported in this browser.");
      return;
    }
    // Starting a capture replaces a loaded video file.
    clearFile();
    detachVideo();
    sourceKindRef.current = "none";
    sourceStore.set("none");

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
        detachVideo();
        sourceKindRef.current = "none";
        sourceStore.set("none");
        setStatus("ended");
        pushLog("warn", "Capture ended (sharing stopped outside the app).");
      });
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.loop = false;
        await video.play().catch(() => undefined);
      }
      sourceKindRef.current = "capture";
      sourceStore.set("capture");
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
  }, [videoRef, setStatus, clearFile, detachVideo]);

  const selectFile = useCallback(
    (file: File) => {
      const video = videoRef.current;
      if (!video) return;
      // A video file replaces an active capture.
      clearCapture();
      setStatus("starting");
      try {
        clearFile();
        const url = URL.createObjectURL(file);
        fileUrlRef.current = url;
        video.srcObject = null;
        video.src = url;
        video.loop = true;
        video.muted = true;
        void video.play().catch(() => undefined);
        sourceKindRef.current = "file";
        sourceStore.set("file");
        setStatus("live");
        pushLog("success", `Local video loaded · ${file.name} (${(file.size / 1e6).toFixed(1)} MB, looped)`);
      } catch (err) {
        setStatus("error");
        const message = err instanceof Error ? err.message : String(err);
        toast.error(`Could not load video: ${message}`);
        pushLog("error", `Video file error: ${message}`);
      }
    },
    [videoRef, setStatus, clearCapture, clearFile],
  );

  const pause = useCallback(() => {
    videoRef.current?.pause();
    setStatus("paused");
    pushLog("info", "Processing paused — source keeps running.");
  }, [videoRef, setStatus]);

  const resume = useCallback(async () => {
    await videoRef.current?.play().catch(() => undefined);
    setStatus("live");
    pushLog("info", "Processing resumed.");
  }, [videoRef, setStatus]);

  // Keep the status badge honest when the user pauses/plays via native
  // video controls (file mode).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPause = () => {
      if (sourceKindRef.current !== "none") setStatus("paused");
    };
    const onPlay = () => {
      if (sourceKindRef.current !== "none") setStatus("live");
    };
    video.addEventListener("pause", onPause);
    video.addEventListener("play", onPlay);
    return () => {
      video.removeEventListener("pause", onPause);
      video.removeEventListener("play", onPlay);
    };
  }, [videoRef, setStatus]);

  // Release the stream and object URL when the page unloads.
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
      fileUrlRef.current = null;
    },
    [],
  );

  return {
    status,
    sourceKind,
    start,
    selectFile,
    pause,
    resume,
    stop,
    isSupported:
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getDisplayMedia,
  };
}
