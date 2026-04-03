"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type CanvasFrostShardsProps = {
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

export function CanvasFrostShards({
  color = "#7dd3fc",
  secondaryColor = "#e0f2fe",
  compact = false,
  className,
}: CanvasFrostShardsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let frameId = 0;
    const dpr = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const shardCount = compact ? 6 : 10;

    const shards = Array.from({ length: shardCount }, (_, i) => ({
      angle: (i / shardCount) * Math.PI * 2 + (i % 2 === 0 ? 0.1 : -0.1),
      length: 0.08 + (i % 3) * 0.03,
      width: 0.012 + (i % 4) * 0.004,
      growPhase: i * 0.8,
      growSpeed: 1.2 + (i % 3) * 0.3,
      facets: 2 + (i % 3),
      rotateSpeed: 0.05 + (i % 2) * 0.03,
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

      // Draw subtle frost ring base
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.strokeStyle = hexToRgba(color, 0.08 + Math.sin(time * 1.5) * 0.03);
      context.lineWidth = compact ? 1.5 : 2;
      context.shadowBlur = compact ? 6 : 10;
      context.shadowColor = hexToRgba(color, 0.3);
      context.stroke();
      context.shadowBlur = 0;

      // Draw ice shards growing outward from the ring
      shards.forEach((shard) => {
        const grow = (Math.sin(time * shard.growSpeed + shard.growPhase) + 1) / 2;
        const currentLength = radius * shard.length * grow;
        if (currentLength < 1) return;

        const angle = shard.angle + time * shard.rotateSpeed;
        const baseX = centerX + Math.cos(angle) * radius;
        const baseY = centerY + Math.sin(angle) * radius;
        const tipX = centerX + Math.cos(angle) * (radius + currentLength);
        const tipY = centerY + Math.sin(angle) * (radius + currentLength);

        const perpX = -Math.sin(angle);
        const perpY = Math.cos(angle);
        const halfWidth = radius * shard.width * (compact ? 0.8 : 1);

        // Main shard — elongated triangle
        context.beginPath();
        context.moveTo(baseX + perpX * halfWidth, baseY + perpY * halfWidth);
        context.lineTo(tipX, tipY);
        context.lineTo(baseX - perpX * halfWidth, baseY - perpY * halfWidth);
        context.closePath();

        const shardGrad = context.createLinearGradient(baseX, baseY, tipX, tipY);
        shardGrad.addColorStop(0, hexToRgba(secondaryColor, 0.5 * grow));
        shardGrad.addColorStop(0.6, hexToRgba(color, 0.3 * grow));
        shardGrad.addColorStop(1, hexToRgba(color, 0));

        context.fillStyle = shardGrad;
        context.shadowBlur = compact ? 4 : 8;
        context.shadowColor = hexToRgba(color, 0.4 * grow);
        context.fill();

        // Sharp edge highlight
        context.beginPath();
        context.moveTo(baseX, baseY);
        context.lineTo(tipX, tipY);
        context.strokeStyle = hexToRgba(secondaryColor, 0.6 * grow);
        context.lineWidth = compact ? 0.5 : 0.8;
        context.shadowBlur = compact ? 3 : 5;
        context.shadowColor = hexToRgba(secondaryColor, 0.5 * grow);
        context.stroke();

        // Sub-facets branching off the main shard
        for (let f = 0; f < shard.facets; f += 1) {
          const t = 0.3 + (f / shard.facets) * 0.5;
          const branchX = baseX + (tipX - baseX) * t;
          const branchY = baseY + (tipY - baseY) * t;
          const branchAngle = angle + (f % 2 === 0 ? 0.4 : -0.4);
          const branchLen = currentLength * 0.35 * (1 - t);

          const fbX = branchX + Math.cos(branchAngle) * branchLen;
          const fbY = branchY + Math.sin(branchAngle) * branchLen;

          context.beginPath();
          context.moveTo(branchX, branchY);
          context.lineTo(fbX, fbY);
          context.strokeStyle = hexToRgba(secondaryColor, 0.35 * grow);
          context.lineWidth = compact ? 0.4 : 0.6;
          context.stroke();
        }
      });

      // Floating ice particles
      const particleCount = compact ? 4 : 8;
      for (let p = 0; p < particleCount; p += 1) {
        const pAngle = time * 0.3 + p * (Math.PI * 2 / particleCount);
        const pRadius = radius + Math.sin(time * 1.8 + p * 1.2) * radius * 0.08;
        const px = centerX + Math.cos(pAngle) * pRadius;
        const py = centerY + Math.sin(pAngle) * pRadius;
        const sparkle = (Math.sin(time * 5 + p * 2.1) + 1) / 2;

        context.beginPath();
        context.arc(px, py, (compact ? 1 : 1.5) * sparkle, 0, Math.PI * 2);
        context.fillStyle = hexToRgba(secondaryColor, 0.6 * sparkle);
        context.shadowBlur = 4;
        context.shadowColor = hexToRgba(secondaryColor, 0.4 * sparkle);
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
