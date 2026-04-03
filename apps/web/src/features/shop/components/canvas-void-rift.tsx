"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type CanvasVoidRiftProps = {
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

function midpointDisplace(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  displacement: number,
  depth: number,
  points: Array<[number, number]>
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
  const displacedMidY = midY + normalY * offset;

  midpointDisplace(startX, startY, displacedMidX, displacedMidY, displacement * 0.55, depth - 1, points);
  midpointDisplace(displacedMidX, displacedMidY, endX, endY, displacement * 0.55, depth - 1, points);
}

export function CanvasVoidRift({
  color = "#7c3aed",
  secondaryColor = "#c084fc",
  compact = false,
  className,
}: CanvasVoidRiftProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let frameId = 0;
    const dpr = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const riftCount = compact ? 3 : 5;

    const rifts = Array.from({ length: riftCount }, (_, i) => ({
      angleStart: (i / riftCount) * Math.PI * 2,
      arcLength: 0.3 + (i % 3) * 0.15,
      pulsePhase: i * 1.1,
      pulseSpeed: 0.8 + (i % 2) * 0.4,
      depth: compact ? 3 : 4,
    }));

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

      // Dark aura base — subtle pulsing shadow ring
      const auraPulse = 0.8 + Math.sin(time * 1.5) * 0.2;
      const auraGrad = context.createRadialGradient(
        centerX, centerY, radius * 0.85,
        centerX, centerY, radius * 1.15
      );
      auraGrad.addColorStop(0, hexToRgba(color, 0));
      auraGrad.addColorStop(0.5, hexToRgba(color, 0.08 * auraPulse));
      auraGrad.addColorStop(1, hexToRgba(color, 0));
      context.fillStyle = auraGrad;
      context.fillRect(0, 0, width, height);

      // Draw rift cracks — like lightning but darker, with energy leaking through
      rifts.forEach((rift) => {
        const pulse = (Math.sin(time * rift.pulseSpeed + rift.pulsePhase) + 1) / 2;
        const angle = rift.angleStart + time * 0.15;

        const startX = centerX + Math.cos(angle) * radius;
        const startY = centerY + Math.sin(angle) * radius;
        const endX = centerX + Math.cos(angle + rift.arcLength) * radius;
        const endY = centerY + Math.sin(angle + rift.arcLength) * radius;

        const points: Array<[number, number]> = [[startX, startY]];
        midpointDisplace(startX, startY, endX, endY, radius * 0.08, rift.depth, points);

        // Wide dark crack outline
        context.beginPath();
        context.moveTo(points[0]?.[0] ?? 0, points[0]?.[1] ?? 0);
        points.forEach(([x, y], i) => { if (i > 0) context.lineTo(x, y); });
        context.lineWidth = compact ? 3 : 4.5;
        context.strokeStyle = hexToRgba("#0f0a1a", 0.5 * pulse);
        context.shadowBlur = compact ? 3 : 5;
        context.shadowColor = hexToRgba("#0f0a1a", 0.4);
        context.stroke();

        // Energy glow bleeding through the crack
        context.beginPath();
        context.moveTo(points[0]?.[0] ?? 0, points[0]?.[1] ?? 0);
        points.forEach(([x, y], i) => { if (i > 0) context.lineTo(x, y); });
        context.lineWidth = compact ? 1.8 : 2.5;
        context.strokeStyle = hexToRgba(secondaryColor, 0.5 * pulse);
        context.shadowBlur = compact ? 10 : 18;
        context.shadowColor = hexToRgba(secondaryColor, 0.7 * pulse);
        context.stroke();

        // Bright inner core of the rift
        context.beginPath();
        context.moveTo(points[0]?.[0] ?? 0, points[0]?.[1] ?? 0);
        points.forEach(([x, y], i) => { if (i > 0) context.lineTo(x, y); });
        context.lineWidth = compact ? 0.6 : 0.9;
        context.strokeStyle = hexToRgba("#ffffff", 0.4 * pulse);
        context.shadowBlur = compact ? 4 : 6;
        context.shadowColor = hexToRgba("#ffffff", 0.3 * pulse);
        context.stroke();

        // Void particles escaping from the rift
        const escapeCount = compact ? 2 : 4;
        for (let e = 0; e < escapeCount; e += 1) {
          const t = (e + 0.5) / escapeCount;
          const idx = Math.floor(t * (points.length - 1));
          const [px, py] = points[Math.min(idx, points.length - 1)] ?? [0, 0];
          const escape = Math.sin(time * 3 + e * 2 + rift.pulsePhase);
          const dist = escape * radius * 0.06;
          const pAngle = angle + rift.arcLength * t;
          const epx = px + Math.cos(pAngle + Math.PI / 2) * dist;
          const epy = py + Math.sin(pAngle + Math.PI / 2) * dist;
          const particleAlpha = Math.abs(escape) * 0.6 * pulse;

          const pGrad = context.createRadialGradient(epx, epy, 0, epx, epy, compact ? 3 : 5);
          pGrad.addColorStop(0, hexToRgba(secondaryColor, particleAlpha));
          pGrad.addColorStop(1, hexToRgba(color, 0));
          context.fillStyle = pGrad;
          context.beginPath();
          context.arc(epx, epy, compact ? 3 : 5, 0, Math.PI * 2);
          context.fill();
        }
      });

      context.shadowBlur = 0;
      frameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameId);
  }, [color, compact, secondaryColor]);

  return <canvas ref={canvasRef} className={cn("absolute inset-0 h-full w-full", className)} />;
}
