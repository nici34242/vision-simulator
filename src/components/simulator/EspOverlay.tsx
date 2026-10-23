import { useEffect, useRef } from "react";
import type { DetectionEngine } from "@/lib/simulator/engine";
import { settingsStore } from "@/lib/simulator/store";
import type { Track } from "@/lib/simulator/types";
import type { ViewRect } from "./VideoPreview";

interface EspOverlayProps {
  engine: DetectionEngine;
  viewRect: ViewRect;
}

interface DrawEntry {
  /** Currently drawn (interpolated) normalized box. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Latest track this entry follows. */
  target: Track | null;
  lastSeen: number;
}

/**
 * ESP overlay. A rAF render loop (display rate, up to 60 fps) reads the
 * engine's latest tracks and settings directly from the stores — no React
 * state in the hot path.
 *
 * Detection runs slower than display (adaptive sampling), so drawn boxes are
 * exponentially interpolated toward the newest detected position each frame.
 * The overlay stays fluid at high refresh rates while the tracker remains the
 * source of truth. All geometry is normalized (0..1) in source-video
 * coordinates and mapped onto the letterboxed preview rect.
 */
export function EspOverlay({ engine, viewRect }: EspOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rectRef = useRef(viewRect);
  rectRef.current = viewRect;

  useEffect(() => {
    let rafId = 0;
    const entries = new Map<number, DrawEntry>();
    let lastFrame = performance.now();

    const draw = () => {
      rafId = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const rect = rectRef.current;
      if (!canvas || rect.width < 2) return;
      const now = performance.now();
      const dt = Math.min(100, now - lastFrame);
      lastFrame = now;

      const dpr = window.devicePixelRatio || 1;
      if (
        canvas.width !== Math.round(rect.width * dpr) ||
        canvas.height !== Math.round(rect.height * dpr)
      ) {
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

      // Time-constant exponential interpolation: identical detection rate,
      // independent of refresh rate (0.5 convergence in ~60 ms).
      const ease = 1 - Math.exp(-dt / 85);
      const seen = new Set<number>();
      for (const track of tracks) {
        seen.add(track.id);
        let entry = entries.get(track.id);
        if (!entry) {
          entry = { x: track.x, y: track.y, w: track.w, h: track.h, target: track, lastSeen: now };
          entries.set(track.id, entry);
        }
        entry.target = track;
        entry.lastSeen = now;
        entry.x += (track.x - entry.x) * ease;
        entry.y += (track.y - entry.y) * ease;
        entry.w += (track.w - entry.w) * ease;
        entry.h += (track.h - entry.h) * ease;
        drawTrack(ctx, track, entry, rect, settings, cx, cy);
      }

      // Age out stale entries with a short fade (covers tracker age-out delay).
      for (const [id, entry] of entries) {
        if (seen.has(id)) continue;
        const age = now - entry.lastSeen;
        if (age > 160) {
          entries.delete(id);
          continue;
        }
        if (entry.target) {
          const ghost: Track = {
            ...entry.target,
            confirmed: false,
            insideFov: false,
          };
          drawTrack(ctx, ghost, entry, rect, settings, cx, cy, 1 - age / 160);
        }
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
  entry: DrawEntry,
  rect: { width: number; height: number },
  s: ReturnType<typeof settingsStore.get>,
  centerX: number,
  centerY: number,
  fade = 1,
) {
  const x = entry.x * rect.width;
  const y = entry.y * rect.height;
  const w = entry.w * rect.width;
  const h = entry.h * rect.height;
  const alpha = s.boxOpacity * (track.confirmed ? 1 : 0.65) * fade;
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

  // Label: confidence % (+ simulated distance). Hidden while fading ghosts.
  if (fade >= 1) {
    const lines: string[] = [];
    if (s.showConfidence) {
      lines.push(`${track.confirmed ? "" : "~"}${Math.round(track.score * 100)}%`);
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
}
