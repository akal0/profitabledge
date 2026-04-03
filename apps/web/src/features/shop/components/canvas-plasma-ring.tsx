"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type CanvasPlasmaRingProps = {
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

export function CanvasPlasmaRing({
  color = "#a855f7",
  secondaryColor = "#e879f9",
  compact = false,
  className,
}: CanvasPlasmaRingProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let frameId = 0;
    const dpr = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const blobCount = compact ? 5 : 8;

    // Stable blob seeds
    const blobs = Array.from({ length: blobCount }, (_, i) => ({
      angleOffset: (i / blobCount) * Math.PI * 2,
      speed: 0.4 + (i % 3) * 0.15,
      sizePhase: i * 1.3,
      sizeBase: 0.6 + (i % 4) * 0.15,
      secondaryBlend: i % 2 === 0,
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

      // Draw plasma blobs orbiting and morphing along the ring
      blobs.forEach((blob) => {
        const angle = blob.angleOffset + time * blob.speed;
        const breathe = 0.7 + Math.sin(time * 2.4 + blob.sizePhase) * 0.3;
        const blobRadius = radius * 0.08 * blob.sizeBase * breathe * (compact ? 0.8 : 1);

        const bx = centerX + Math.cos(angle) * radius;
        const by = centerY + Math.sin(angle) * radius;

        // Wobble the blob shape with Lissajous-like distortion
        const wobbleX = Math.sin(time * 3.1 + blob.sizePhase) * blobRadius * 0.4;
        const wobbleY = Math.cos(time * 2.7 + blob.sizePhase) * blobRadius * 0.35;

        const blobColor = blob.secondaryBlend ? secondaryColor : color;
        const otherColor = blob.secondaryBlend ? color : secondaryColor;

        // Outer glow
        const gradient = context.createRadialGradient(
          bx + wobbleX, by + wobbleY, 0,
          bx + wobbleX, by + wobbleY, blobRadius * 2.5
        );
        gradient.addColorStop(0, hexToRgba(blobColor, 0.5 * breathe));
        gradient.addColorStop(0.4, hexToRgba(blobColor, 0.2 * breathe));
        gradient.addColorStop(1, hexToRgba(blobColor, 0));

        context.fillStyle = gradient;
        context.beginPath();
        context.arc(bx + wobbleX, by + wobbleY, blobRadius * 2.5, 0, Math.PI * 2);
        context.fill();

        // Inner bright core
        const coreGrad = context.createRadialGradient(
          bx + wobbleX, by + wobbleY, 0,
          bx + wobbleX, by + wobbleY, blobRadius
        );
        coreGrad.addColorStop(0, hexToRgba("#ffffff", 0.6 * breathe));
        coreGrad.addColorStop(0.5, hexToRgba(otherColor, 0.4 * breathe));
        coreGrad.addColorStop(1, hexToRgba(blobColor, 0));

        context.fillStyle = coreGrad;
        context.beginPath();
        context.arc(bx + wobbleX, by + wobbleY, blobRadius, 0, Math.PI * 2);
        context.fill();
      });

      // Draw connecting tendrils between adjacent blobs
      const tendrilCount = compact ? 3 : 5;
      for (let i = 0; i < tendrilCount; i += 1) {
        const idx = i * 2;
        const blobA = blobs[idx % blobs.length]!;
        const blobB = blobs[(idx + 1) % blobs.length]!;

        const aAngle = blobA.angleOffset + time * blobA.speed;
        const bAngle = blobB.angleOffset + time * blobB.speed;

        const ax = centerX + Math.cos(aAngle) * radius;
        const ay = centerY + Math.sin(aAngle) * radius;
        const bxPos = centerX + Math.cos(bAngle) * radius;
        const byPos = centerY + Math.sin(bAngle) * radius;

        const dist = Math.hypot(bxPos - ax, byPos - ay);
        if (dist > radius * 0.9) continue; // too far apart, skip tendril

        const fade = 1 - dist / (radius * 0.9);
        const pulse = 0.5 + Math.sin(time * 4 + i * 1.5) * 0.5;

        context.beginPath();
        const midAngle = (aAngle + bAngle) / 2;
        const cpX = centerX + Math.cos(midAngle) * (radius + radius * 0.06 * Math.sin(time * 3 + i));
        const cpY = centerY + Math.sin(midAngle) * (radius + radius * 0.06 * Math.sin(time * 3 + i));
        context.moveTo(ax, ay);
        context.quadraticCurveTo(cpX, cpY, bxPos, byPos);

        context.lineWidth = compact ? 1.2 : 1.8;
        context.strokeStyle = hexToRgba(secondaryColor, 0.3 * fade * pulse);
        context.shadowBlur = compact ? 6 : 10;
        context.shadowColor = hexToRgba(color, 0.5 * fade * pulse);
        context.stroke();
      }

      context.shadowBlur = 0;
      frameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameId);
  }, [color, compact, secondaryColor]);

  return <canvas ref={canvasRef} className={cn("absolute inset-0 h-full w-full", className)} />;
}
