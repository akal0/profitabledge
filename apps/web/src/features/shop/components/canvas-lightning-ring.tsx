"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type CanvasLightningRingProps = {
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

  midpointDisplace(
    startX,
    startY,
    displacedMidX,
    displacedMidY,
    displacement * 0.6,
    depth - 1,
    points
  );
  midpointDisplace(
    displacedMidX,
    displacedMidY,
    endX,
    endY,
    displacement * 0.6,
    depth - 1,
    points
  );
}

export function CanvasLightningRing({
  color = "#93c5fd",
  secondaryColor = "#ffffff",
  compact = false,
  className,
}: CanvasLightningRingProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

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
      const strikeCount = compact ? 2 : 3;

      for (let strike = 0; strike < strikeCount; strike += 1) {
        const startAngle = time * (0.8 + strike * 0.14) + strike * 2.1;
        const arcLength = compact ? 0.68 : 0.84;
        const startX = centerX + Math.cos(startAngle) * radius;
        const startY = centerY + Math.sin(startAngle) * radius;
        const endX = centerX + Math.cos(startAngle + arcLength) * radius;
        const endY = centerY + Math.sin(startAngle + arcLength) * radius;
        const points: Array<[number, number]> = [[startX, startY]];

        midpointDisplace(
          startX,
          startY,
          endX,
          endY,
          radius * 0.1,
          compact ? 3 : 4,
          points
        );

        context.beginPath();
        context.moveTo(points[0]?.[0] ?? 0, points[0]?.[1] ?? 0);
        points.forEach(([x, y], index) => {
          if (index === 0) return;
          context.lineTo(x, y);
        });

        context.lineWidth = compact ? 1.4 : 1.8;
        context.strokeStyle = secondaryColor;
        context.shadowBlur = compact ? 8 : 12;
        context.shadowColor = hexToRgba(color, 0.9);
        context.stroke();

        context.beginPath();
        context.moveTo(points[0]?.[0] ?? 0, points[0]?.[1] ?? 0);
        points.forEach(([x, y], index) => {
          if (index === 0) return;
          context.lineTo(x, y);
        });
        context.lineWidth = compact ? 2.6 : 3.6;
        context.strokeStyle = hexToRgba(color, 0.26);
        context.shadowBlur = compact ? 14 : 22;
        context.shadowColor = hexToRgba(color, 0.7);
        context.stroke();
      }

      frameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(frameId);
  }, [color, compact, secondaryColor]);

  return <canvas ref={canvasRef} className={cn("absolute inset-0 h-full w-full", className)} />;
}
