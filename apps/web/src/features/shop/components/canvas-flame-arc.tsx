"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type CanvasFlameArcProps = {
  color?: string;
  secondaryColor?: string;
  compact?: boolean;
  className?: string;
};

function hexToRgba(hex: string, alpha: number) {
  const sanitized = hex.replace("#", "");
  const r = Number.parseInt(sanitized.slice(0, 2), 16);
  const g = Number.parseInt(sanitized.slice(2, 4), 16);
  const b = Number.parseInt(sanitized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lerpColor(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number, t: number) {
  return [
    Math.round(r1 + (r2 - r1) * t),
    Math.round(g1 + (g2 - g1) * t),
    Math.round(b1 + (b2 - b1) * t),
  ] as const;
}

function midpointDisplace(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  displacement: number,
  depth: number,
  points: Array<[number, number]>,
  biasY: number
) {
  if (depth <= 0) {
    points.push([endX, endY]);
    return;
  }

  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.hypot(dx, dy) || 1;
  const normalX = -dy / length;
  const normalY = dx / length;
  const offset = (Math.random() * 2 - 1) * displacement;
  const displacedMidX = midX + normalX * offset;
  const displacedMidY = midY + normalY * offset + biasY * displacement * 0.3;

  midpointDisplace(startX, startY, displacedMidX, displacedMidY, displacement * 0.55, depth - 1, points, biasY);
  midpointDisplace(displacedMidX, displacedMidY, endX, endY, displacement * 0.55, depth - 1, points, biasY);
}

export function CanvasFlameArc({
  color = "#fb923c",
  secondaryColor = "#fbbf24",
  compact = false,
  className,
}: CanvasFlameArcProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let frameId = 0;
    const dpr = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);

    const render = () => {
      const width = canvas.clientWidth || 120;
      const height = canvas.clientHeight || 120;

      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      context.clearRect(0, 0, width, height);
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.42;
      const time = performance.now() / 1000;
      const tendrilCount = compact ? 3 : 5;

      for (let tendril = 0; tendril < tendrilCount; tendril += 1) {
        const baseAngle = time * (0.6 + tendril * 0.12) + tendril * (Math.PI * 2) / tendrilCount;
        const arcLength = compact ? 0.5 : 0.7;
        const flicker = 0.7 + Math.sin(time * 8 + tendril * 2.3) * 0.3;

        const startX = centerX + Math.cos(baseAngle) * radius;
        const startY = centerY + Math.sin(baseAngle) * radius;
        const endX = centerX + Math.cos(baseAngle + arcLength) * radius;
        const endY = centerY + Math.sin(baseAngle + arcLength) * radius;

        // Flame rises upward — bias displacement toward negative Y
        const biasY = -1;
        const points: Array<[number, number]> = [[startX, startY]];
        midpointDisplace(startX, startY, endX, endY, radius * 0.14, compact ? 3 : 4, points, biasY);

        // Outer glow — warm orange
        context.beginPath();
        context.moveTo(points[0]?.[0] ?? 0, points[0]?.[1] ?? 0);
        points.forEach(([x, y], i) => {
          if (i === 0) return;
          context.lineTo(x, y);
        });
        context.lineWidth = compact ? 3 : 4.5;
        context.strokeStyle = hexToRgba(color, 0.22 * flicker);
        context.shadowBlur = compact ? 16 : 24;
        context.shadowColor = hexToRgba(color, 0.7 * flicker);
        context.stroke();

        // Inner bright core — yellow-white
        context.beginPath();
        context.moveTo(points[0]?.[0] ?? 0, points[0]?.[1] ?? 0);
        points.forEach(([x, y], i) => {
          if (i === 0) return;
          context.lineTo(x, y);
        });
        context.lineWidth = compact ? 1.2 : 1.6;
        context.strokeStyle = hexToRgba(secondaryColor, 0.9 * flicker);
        context.shadowBlur = compact ? 8 : 12;
        context.shadowColor = hexToRgba(secondaryColor, 0.8 * flicker);
        context.stroke();

        // Small ember particles along the arc
        const [cr, cg, cb] = lerpColor(251, 146, 60, 239, 68, 68, Math.sin(time * 3 + tendril) * 0.5 + 0.5);
        for (let ember = 0; ember < (compact ? 2 : 4); ember += 1) {
          const t = (ember + Math.sin(time * 5 + tendril + ember)) / (compact ? 2 : 4);
          const idx = Math.floor(t * (points.length - 1));
          const [px, py] = points[Math.min(idx, points.length - 1)] ?? [0, 0];
          const drift = Math.sin(time * 6 + ember * 1.7 + tendril) * radius * 0.06;
          const rise = Math.cos(time * 4 + ember) * radius * 0.04;

          context.beginPath();
          context.arc(px + drift, py + rise - radius * 0.03, compact ? 1.2 : 1.8, 0, Math.PI * 2);
          context.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${0.6 * flicker})`;
          context.shadowBlur = 6;
          context.shadowColor = `rgba(${cr}, ${cg}, ${cb}, 0.5)`;
          context.fill();
        }
      }

      context.shadowBlur = 0;
      frameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameId);
  }, [color, compact, secondaryColor]);

  return <canvas ref={canvasRef} className={cn("absolute inset-0 h-full w-full", className)} />;
}
