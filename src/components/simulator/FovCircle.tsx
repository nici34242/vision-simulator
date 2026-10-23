import { useEffect, useRef } from "react";
import { settingsStore, useStore } from "@/lib/simulator/store";
import type { ViewRect } from "./VideoPreview";

/**
 * Visual FOV circle at the preview center. Purely an orientation aid — it
 * never triggers any targeting or input.
 */
export function FovCircle({ viewRect }: { viewRect: ViewRect }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { showFovCircle, showCrosshair, fovRadius, fovColor, fovOpacity, fovThickness } =
    useStore(settingsStore);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || viewRect.width < 2) return;
    const dpr = window.devicePixelRatio || 1;
    const w = viewRect.width;
    const h = viewRect.height;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.max(8, fovRadius * (Math.min(w, h) / 2));

    if (showFovCircle) {
      ctx.globalAlpha = fovOpacity;
      ctx.strokeStyle = fovColor;
      ctx.lineWidth = fovThickness;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (showCrosshair) {
      const gap = 6;
      const len = 12;
      ctx.globalAlpha = Math.max(0.35, fovOpacity);
      ctx.strokeStyle = fovColor;
      ctx.lineWidth = Math.max(1, fovThickness - 1);
      ctx.beginPath();
      ctx.moveTo(cx - gap - len, cy);
      ctx.lineTo(cx - gap, cy);
      ctx.moveTo(cx + gap, cy);
      ctx.lineTo(cx + gap + len, cy);
      ctx.moveTo(cx, cy - gap - len);
      ctx.lineTo(cx, cy - gap);
      ctx.moveTo(cx, cy + gap);
      ctx.lineTo(cx, cy + gap + len);
      ctx.stroke();
      ctx.globalAlpha = Math.max(0.35, fovOpacity);
      ctx.fillStyle = fovColor;
      ctx.beginPath();
      ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }, [
    viewRect,
    showFovCircle,
    showCrosshair,
    fovRadius,
    fovColor,
    fovOpacity,
    fovThickness,
  ]);

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
