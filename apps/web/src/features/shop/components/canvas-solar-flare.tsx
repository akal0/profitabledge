"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type CanvasSolarFlareProps = {
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

export function CanvasSolarFlare({
  color = "#fbbf24",
  secondaryColor = "#fef3c7",
  compact = false,
  className,
}: CanvasSolarFlareProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let frameId = 0;
    const dpr = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const flareCount = compact ? 3 : 5;

    const flares = Array.from({ length: flareCount }, (_, i) => ({
      angle: (i / flareCount) * Math.PI * 2,
      maxHeight: 0.12 + (i % 3) * 0.04,
      speed: 0.8 + (i % 2) * 0.4,
      phase: i * 1.4,
      arcWidth: 0.15 + (i % 3) * 0.06,
      wobbleSpeed: 1.5 + (i % 2) * 0.5,
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

      // Subtle corona glow
      const coronaPulse = 0.85 + Math.sin(time * 2) * 0.15;
      const coronaGrad = context.createRadialGradient(
        centerX, centerY, radius * 0.9,
        centerX, centerY, radius * 1.2
      );
      coronaGrad.addColorStop(0, hexToRgba(color, 0.08 * coronaPulse));
      coronaGrad.addColorStop(0.5, hexToRgba(color, 0.04 * coronaPulse));
      coronaGrad.addColorStop(1, hexToRgba(color, 0));
      context.fillStyle = coronaGrad;
      context.fillRect(0, 0, width, height);

      // Draw solar prominences — curved arcs that erupt outward
      flares.forEach((flare) => {
        const cycle = (time * flare.speed + flare.phase) % (Math.PI * 2);
        const erupt = Math.pow(Math.max(0, Math.sin(cycle)), 2);
        if (erupt < 0.02) return;

        const flareHeight = radius * flare.maxHeight * erupt;
        const halfArc = flare.arcWidth / 2;
        const angle = flare.angle + time * 0.08;
        const wobble = Math.sin(time * flare.wobbleSpeed + flare.phase) * 0.03;

        // Build prominence as a curved arc from ring surface outward and back
        const steps = compact ? 12 : 20;
        const outerPoints: Array<[number, number]> = [];
        const innerPoints: Array<[number, number]> = [];

        for (let s = 0; s <= steps; s += 1) {
          const t = s / steps;
          const a = angle - halfArc + flare.arcWidth * t;
          // Prominence height follows a parabolic curve (highest in the middle)
          const heightFactor = 4 * t * (1 - t); // parabola peaking at t=0.5
          const jitter = Math.sin(time * 8 + s * 0.7) * radius * 0.005;

          const outerR = radius + flareHeight * heightFactor + jitter;
          const innerR = radius + flareHeight * heightFactor * 0.4;

          outerPoints.push([
            centerX + Math.cos(a + wobble) * outerR,
            centerY + Math.sin(a + wobble) * outerR,
          ]);
          innerPoints.push([
            centerX + Math.cos(a + wobble) * innerR,
            centerY + Math.sin(a + wobble) * innerR,
          ]);
        }

        // Draw filled prominence shape
        context.beginPath();
        outerPoints.forEach(([x, y], i) => {
          if (i === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        for (let s = innerPoints.length - 1; s >= 0; s -= 1) {
          const [x, y] = innerPoints[s]!;
          context.lineTo(x, y);
        }
        context.closePath();

        const flareGrad = context.createRadialGradient(
          centerX, centerY, radius,
          centerX, centerY, radius + flareHeight
        );
        flareGrad.addColorStop(0, hexToRgba(secondaryColor, 0.4 * erupt));
        flareGrad.addColorStop(0.4, hexToRgba(color, 0.25 * erupt));
        flareGrad.addColorStop(1, hexToRgba(color, 0));

        context.fillStyle = flareGrad;
        context.shadowBlur = compact ? 8 : 14;
        context.shadowColor = hexToRgba(color, 0.5 * erupt);
        context.fill();

        // Bright edge along the outer curve
        context.beginPath();
        outerPoints.forEach(([x, y], i) => {
          if (i === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.lineWidth = compact ? 0.8 : 1.2;
        context.strokeStyle = hexToRgba(secondaryColor, 0.5 * erupt);
        context.shadowBlur = compact ? 4 : 8;
        context.shadowColor = hexToRgba(secondaryColor, 0.6 * erupt);
        context.stroke();
      });

      // Hot spots — bright pulsing dots along the ring surface
      const spotCount = compact ? 4 : 7;
      for (let s = 0; s < spotCount; s += 1) {
        const sAngle = (s / spotCount) * Math.PI * 2 + time * 0.2;
        const pulse = (Math.sin(time * 4 + s * 1.8) + 1) / 2;
        const sx = centerX + Math.cos(sAngle) * radius;
        const sy = centerY + Math.sin(sAngle) * radius;

        const spotGrad = context.createRadialGradient(sx, sy, 0, sx, sy, compact ? 4 : 6);
        spotGrad.addColorStop(0, hexToRgba(secondaryColor, 0.7 * pulse));
        spotGrad.addColorStop(0.5, hexToRgba(color, 0.3 * pulse));
        spotGrad.addColorStop(1, hexToRgba(color, 0));
        context.fillStyle = spotGrad;
        context.beginPath();
        context.arc(sx, sy, compact ? 4 : 6, 0, Math.PI * 2);
        context.fill();
      }

      context.shadowBlur = 0;
      frameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameId);
  }, [color, compact, secondaryColor]);

  return <canvas ref={canvasRef} className={cn("absolute inset-0 h-full w-full", className)} />;
}
