import { useEffect, useRef } from "react";
import type { DetectionEngine } from "@/lib/simulator/engine";
import { settingsStore } from "@/lib/simulator/store";
import type { Track } from "@/lib/simulator/types";
import type { ViewRect } from "./VideoPreview";

interface EspOverlayProps {
  engine: DetectionEngine;
  viewRect: ViewRect;
}

/**
 * ESP overlay. Draws one animation loop that reads the engine's latest tracks
 * and the current settings directly from the stores — no React state in the
 * hot path, so toggling sliders never re-renders the frame pipeline.
 *
 * All box geometry is normalized (0..1) in source-video coordinates and is
 * mapped onto the letterboxed preview rect, so overlays stay glued to the
 * video across resolutions, aspect ratios and window resizes.
 */
export function EspOverlay({ engine, viewRect }: EspOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rectRef = useRef(viewRect);
  rectRef.current = viewRect;

  useEffect(() => {
    let rafId = 0;

    const draw = () => {
      rafId = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const rect = rectRef.current;
      if (!canvas || rect.width < 2) return;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const settings = settingsStore.get();
      const tracks = engine.getTracks();
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      for (const track of tracks) {
        drawTrack(ctx, track, rect, settings, cx, cy);
      }
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [engine]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute"
      style={{
        left: viewRect.left,
        top: viewRect.top,
        width: viewRect.width,
        height: viewRect.height,
      }}
    />
  );
}

function drawTrack(
  ctx: CanvasRenderingContext2D,
  track: Track,
  rect: { width: number; height: number },
  s: ReturnType<typeof settingsStore.get>,
  centerX: number,
  centerY: number,
) {
  const x = track.x * rect.width;
  const y = track.y * rect.height;
  const w = track.w * rect.width;
  const h = track.h * rect.height;
  const alpha = s.boxOpacity * (track.confirmed ? 1 : 0.65);
  const color = s.boxColor;

  // Optional connection line from screen center to the box center.
  if (s.showCenterLines) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.45;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(x + w / 2, y + h / 2);
    ctx.stroke();
    ctx.restore();
  }

  if (s.showEspBoxes) {
    // Suspected (single-sighting) tracks are dashed; confirmed are solid.
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = s.boxThickness;
    if (!track.confirmed) ctx.setLineDash([6, 5]);
    ctx.strokeRect(x, y, w, h);
    if (s.highlightInFov && track.insideFov) {
      // Corner ticks highlight objects inside the FOV circle (visual only).
      ctx.setLineDash([]);
      ctx.globalAlpha = alpha * 0.8;
      const t = s.boxThickness + 3;
      const tick = Math.min(w, h) * 0.25;
      ctx.beginPath();
      ctx.moveTo(x - t, y - t + tick); ctx.lineTo(x - t, y - t); ctx.lineTo(x - t + tick, y - t);
      ctx.moveTo(x + w + t - tick, y - t); ctx.lineTo(x + w + t, y - t); ctx.lineTo(x + w + t, y - t + tick);
      ctx.moveTo(x + w + t, y + h + t - tick); ctx.lineTo(x + w + t, y + h + t); ctx.lineTo(x + w + t - tick, y + h + t);
      ctx.moveTo(x - t + tick, y + h + t); ctx.lineTo(x - t, y + h + t); ctx.lineTo(x - t, y + h + t - tick);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (s.showCenterDot) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Label: confidence % (+ simulated distance + track id).
  const lines: string[] = [];
  if (s.showConfidence) {
    lines.push(
      `${track.confirmed ? "" : "~"}${Math.round(track.score * 100)}%`,
    );
  }
  if (s.showDistance) {
    // Simulated, non-real distance derived from box height — display only.
    const meters = Math.max(1, Math.round(2.2 / Math.max(0.01, track.h)));
    lines.push(`${meters} m · sim`);
  }
  if (lines.length > 0) {
    const label = lines.join("  ·  ");
    ctx.save();
    ctx.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
    const metrics = ctx.measureText(label);
    const padX = 4;
    const boxW = metrics.width + padX * 2;
    const boxH = 16;
    const lx = x;
    const ly = Math.max(0, y - boxH - 2);
    ctx.globalAlpha = alpha * 0.85;
    ctx.fillStyle = "rgba(8, 12, 18, 0.72)";
    ctx.fillRect(lx, ly, boxW, boxH);
    ctx.fillStyle = color;
    ctx.fillText(label, lx + padX, ly + 11.5);
    ctx.restore();
  }
}
