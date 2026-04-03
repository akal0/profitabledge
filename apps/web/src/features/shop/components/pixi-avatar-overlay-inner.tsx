"use client";

import { useEffect, useRef } from "react";

import {
  AVATAR_OVERLAY_CONFIGS,
  type AvatarOverlayEffectKey,
} from "@/features/shop/lib/pixi-particle-configs";
import { cn } from "@/lib/utils";

export type PixiAvatarOverlayProps = {
  effect?: string | null;
  className?: string;
  active?: boolean;
};

type Particle = {
  seed: number;
  sizeMix: number;
  speedMix: number;
  color: number;
};

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function drawGlobalOverlay(
  context: CanvasRenderingContext2D,
  motion: "water" | "pixelate" | "crt" | "godray" | "glitch" | "vhs" | "heartbeat" | "radar" | "binary",
  time: number,
  width: number,
  height: number,
  colors: number[],
  opacity: number
) {
  if (motion === "water") {
    for (let band = 0; band < 4; band += 1) {
      const y = height * (0.18 + band * 0.18);
      const waveAmplitude = height * 0.035;
      context.beginPath();
      for (let x = 0; x <= width; x += 6) {
        const offsetY =
          y +
          Math.sin(time * 1.6 + band + x / 28) * waveAmplitude +
          Math.cos(time * 1.2 + band * 1.4 + x / 41) * waveAmplitude * 0.45;
        if (x === 0) context.moveTo(x, offsetY);
        else context.lineTo(x, offsetY);
      }
      context.strokeStyle = colorToRgba(colors[band % colors.length] ?? 0xffffff, opacity * (0.46 - band * 0.06));
      context.lineWidth = 2;
      context.shadowBlur = 10;
      context.shadowColor = colorToRgba(colors[band % colors.length] ?? 0xffffff, 0.35);
      context.stroke();
      context.shadowBlur = 0;
    }

    const gloss = context.createLinearGradient(0, 0, width, height);
    gloss.addColorStop(0, colorToRgba(0xe0f2fe, 0.1));
    gloss.addColorStop(0.5, colorToRgba(0x22d3ee, 0.02));
    gloss.addColorStop(1, colorToRgba(0xe0f2fe, 0.08));
    context.fillStyle = gloss;
    context.fillRect(0, 0, width, height);
    return;
  }

  if (motion === "pixelate") {
    const pulse = (Math.sin(time * 1.8) + 1) / 2;
    const cell = Math.round(6 + pulse * 8);
    for (let y = 0; y < height; y += cell) {
      for (let x = 0; x < width; x += cell) {
        const mix = ((x + y) / cell) % colors.length;
        const alpha = opacity * (0.12 + pulse * 0.3) * (((x + y) / cell) % 2 === 0 ? 1 : 0.65);
        context.fillStyle = colorToRgba(colors[Math.floor(mix)] ?? 0xffffff, alpha);
        context.fillRect(x, y, Math.max(1, cell - 1), Math.max(1, cell - 1));
      }
    }
    return;
  }

  if (motion === "crt") {
    const lineGap = 4;
    for (let line = 0; line < height; line += lineGap) {
      context.fillStyle = colorToRgba(colors[0] ?? 0x67e8f9, opacity * 0.22);
      context.fillRect(0, line, width, 1);
    }
    const sweepY = ((time * 38) % (height + 24)) - 12;
    context.fillStyle = colorToRgba(0xffffff, 0.08);
    context.fillRect(0, sweepY, width, 10);
    context.strokeStyle = colorToRgba(colors[0] ?? 0x67e8f9, 0.2);
    context.lineWidth = 1;
    drawRoundedRect(context, 1, 1, width - 2, height - 2, Math.min(18, width * 0.16));
    context.stroke();
    return;
  }

  if (motion === "godray") {
    for (let ray = 0; ray < 3; ray += 1) {
      const sweep = ((time * (24 + ray * 8)) % (width * 1.6)) - width * 0.3;
      const gradient = context.createLinearGradient(sweep, 0, sweep + width * 0.24, height);
      gradient.addColorStop(0, colorToRgba(colors[ray % colors.length] ?? 0xffffff, 0));
      gradient.addColorStop(
        0.5,
        colorToRgba(colors[ray % colors.length] ?? 0xffffff, opacity * (0.45 - ray * 0.08))
      );
      gradient.addColorStop(1, colorToRgba(colors[ray % colors.length] ?? 0xffffff, 0));
      context.fillStyle = gradient;
      context.beginPath();
      context.moveTo(sweep, 0);
      context.lineTo(sweep + width * 0.12, 0);
      context.lineTo(sweep + width * 0.42, height);
      context.lineTo(sweep + width * 0.26, height);
      context.closePath();
      context.fill();
    }
    return;
  }

  if (motion === "glitch") {
    const burst = (Math.sin(time * 4.2) + 1) / 2;
    if (burst > 0.44) {
      for (let slice = 0; slice < 7; slice += 1) {
        const y = (((slice * 19) % 100) / 100) * height;
        const sliceHeight = 4 + (slice % 3) * 2;
        const xOffset = Math.sin(time * 15 + slice) * 8;
        context.fillStyle = colorToRgba(
          colors[slice % colors.length] ?? 0xffffff,
          0.12 + burst * 0.22
        );
        context.fillRect(xOffset, y, width, sliceHeight);
      }
    }
    return;
  }

  if (motion === "heartbeat") {
    const centerY = height / 2;
    const speed = 1.2;
    const cycle = (time * speed) % 1;

    context.beginPath();
    context.moveTo(0, centerY);
    for (let x = 0; x <= width; x += 1) {
      const t = x / width;
      const phase = (t - cycle + 1) % 1;
      let y = centerY;

      // ECG waveform shape
      if (phase > 0.35 && phase < 0.38) {
        y = centerY - height * 0.06;
      } else if (phase > 0.38 && phase < 0.4) {
        y = centerY + height * 0.03;
      } else if (phase > 0.4 && phase < 0.44) {
        y = centerY - height * 0.28;
      } else if (phase > 0.44 && phase < 0.48) {
        y = centerY + height * 0.12;
      } else if (phase > 0.48 && phase < 0.52) {
        y = centerY - height * 0.04;
      } else if (phase > 0.55 && phase < 0.62) {
        y = centerY - height * 0.06 * Math.sin((phase - 0.55) / 0.07 * Math.PI);
      }

      context.lineTo(x, y);
    }

    context.lineWidth = 1.8;
    context.strokeStyle = colorToRgba(colors[0] ?? 0x4ade80, opacity);
    context.shadowBlur = 8;
    context.shadowColor = colorToRgba(colors[0] ?? 0x4ade80, 0.6);
    context.stroke();

    // Dot at the leading edge
    const dotX = cycle * width;
    context.beginPath();
    context.arc(dotX, centerY, 3, 0, Math.PI * 2);
    context.fillStyle = colorToRgba(colors[0] ?? 0x4ade80, 0.9);
    context.fill();
    context.shadowBlur = 0;
    return;
  }

  if (motion === "radar") {
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) * 0.44;
    const sweepAngle = (time * 2.2) % (Math.PI * 2);

    // Concentric range rings
    for (let ring = 1; ring <= 3; ring += 1) {
      const r = (ring / 3) * maxRadius;
      context.beginPath();
      context.arc(centerX, centerY, r, 0, Math.PI * 2);
      context.strokeStyle = colorToRgba(colors[0] ?? 0x22d3ee, 0.08);
      context.lineWidth = 0.5;
      context.stroke();
    }

    // Cross hairs
    context.beginPath();
    context.moveTo(centerX - maxRadius, centerY);
    context.lineTo(centerX + maxRadius, centerY);
    context.moveTo(centerX, centerY - maxRadius);
    context.lineTo(centerX, centerY + maxRadius);
    context.strokeStyle = colorToRgba(colors[0] ?? 0x22d3ee, 0.06);
    context.lineWidth = 0.5;
    context.stroke();

    // Sweep wedge with gradient fade
    const sweepGrad = context.createConicGradient(sweepAngle - Math.PI / 3, centerX, centerY);
    sweepGrad.addColorStop(0, colorToRgba(colors[0] ?? 0x22d3ee, 0));
    sweepGrad.addColorStop(0.08, colorToRgba(colors[0] ?? 0x22d3ee, opacity * 0.6));
    sweepGrad.addColorStop(0.12, colorToRgba(colors[0] ?? 0x22d3ee, 0));
    sweepGrad.addColorStop(1, colorToRgba(colors[0] ?? 0x22d3ee, 0));

    context.fillStyle = sweepGrad;
    context.beginPath();
    context.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
    context.fill();

    // Blips on the sweep trail
    for (let blip = 0; blip < 4; blip += 1) {
      const blipAngle = sweepAngle - 0.15 - blip * 0.08;
      const blipR = maxRadius * (0.3 + ((blip * 37 + 11) % 7) / 10);
      const bx = centerX + Math.cos(blipAngle) * blipR;
      const by = centerY + Math.sin(blipAngle) * blipR;
      const fade = 1 - blip * 0.25;

      context.beginPath();
      context.arc(bx, by, 2, 0, Math.PI * 2);
      context.fillStyle = colorToRgba(colors[0] ?? 0x22d3ee, opacity * fade);
      context.shadowBlur = 6;
      context.shadowColor = colorToRgba(colors[0] ?? 0x22d3ee, 0.5 * fade);
      context.fill();
    }

    context.shadowBlur = 0;
    return;
  }

  if (motion === "binary") {
    const colCount = Math.floor(width / 9);
    const rowHeight = 8;
    const totalRows = Math.ceil(height / rowHeight) + 4;

    for (let col = 0; col < colCount; col += 1) {
      const speed = 0.8 + ((col * 13) % 7) / 10;
      const offset = ((col * 31) % 100) / 100 * height;
      const x = col * 9 + 2;

      for (let row = 0; row < totalRows; row += 1) {
        const y = (offset + row * rowHeight + time * 30 * speed) % (height + rowHeight * 4) - rowHeight * 2;
        if (y < -rowHeight || y > height + rowHeight) continue;

        const char = ((col * 7 + row * 3 + Math.floor(time * 4)) % 2) === 0 ? "0" : "1";
        const headDist = row === 0 ? 1 : Math.max(0, 1 - row * 0.1);
        const alpha = opacity * headDist * 0.6;

        context.font = "7px monospace";
        context.fillStyle = colorToRgba(
          row === 0 ? (colors[2] ?? 0xbbf7d0) : (colors[col % colors.length] ?? 0x4ade80),
          alpha
        );
        context.fillText(char, x, y);
      }
    }
    return;
  }

  // VHS fallback
  for (let line = 0; line < height; line += 5) {
    context.fillStyle = colorToRgba(0xffffff, opacity * 0.12);
    context.fillRect(0, line, width, 1);
  }
  const trackingY = ((time * 62) % (height + 18)) - 8;
  const trackingGradient = context.createLinearGradient(0, trackingY, 0, trackingY + 16);
  trackingGradient.addColorStop(0, colorToRgba(0xffffff, 0));
  trackingGradient.addColorStop(0.5, colorToRgba(0xffffff, 0.12));
  trackingGradient.addColorStop(1, colorToRgba(0xffffff, 0));
  context.fillStyle = trackingGradient;
  context.fillRect(0, trackingY, width, 16);

  for (let noise = 0; noise < 18; noise += 1) {
    const x = ((noise * 37) % 100) / 100 * width;
    const y = (((noise * 53) % 100) / 100 * height + time * 18) % height;
    context.fillStyle = colorToRgba(colors[noise % colors.length] ?? 0xffffff, 0.08);
    context.fillRect(x, y, 2, 1);
  }
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function colorToRgba(color: number, alpha: number) {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawPetal(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
  color: string
) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.fillStyle = color;
  context.beginPath();
  context.ellipse(0, 0, size, size * 0.58, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

export function PixiAvatarOverlayInner({
  effect,
  className,
  active = true,
}: PixiAvatarOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!effect || effect === "none" || effect === "holographic_overlay" || !active) {
      return;
    }

    const config = AVATAR_OVERLAY_CONFIGS[effect as AvatarOverlayEffectKey];
    const canvas = canvasRef.current;
    if (!config || !canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let frameId = 0;
    const particles: Particle[] = Array.from(
      { length: config.particleCount },
      (_, index) => ({
        seed: index * 0.731,
        sizeMix: ((index * 13) % 11) / 10,
        speedMix: ((index * 17) % 9) / 8,
        color: config.colors[index % config.colors.length] ?? 0xffffff,
      })
    );

    const render = () => {
      const width = canvas.clientWidth || 120;
      const height = canvas.clientHeight || 120;
      const dpr =
        typeof window === "undefined"
          ? 1
          : Math.min(window.devicePixelRatio || 1, 2);

      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      context.clearRect(0, 0, width, height);
      const time = performance.now() / 1000;
      const centerX = width / 2;
      const centerY = height / 2;

      if (
        config.motion === "water" ||
        config.motion === "pixelate" ||
        config.motion === "crt" ||
        config.motion === "godray" ||
        config.motion === "glitch" ||
        config.motion === "vhs" ||
        config.motion === "heartbeat" ||
        config.motion === "radar" ||
        config.motion === "binary"
      ) {
        drawGlobalOverlay(
          context,
          config.motion,
          time,
          width,
          height,
          config.colors,
          config.opacity
        );
        frameId = requestAnimationFrame(render);
        return;
      }

      particles.forEach((particle, index) => {
        const size = lerp(
          config.sizeRange[0],
          config.sizeRange[1],
          particle.sizeMix
        );
        const speed = lerp(
          config.speedRange[0],
          config.speedRange[1],
          particle.speedMix
        );

        if (config.motion === "firefly") {
          // Organic wandering movement with pulsing glow
          const wanderX = Math.sin(time * speed * 0.8 + particle.seed * 5.3) * width * 0.28
            + Math.sin(time * speed * 1.3 + particle.seed * 3.1) * width * 0.12;
          const wanderY = Math.cos(time * speed * 0.7 + particle.seed * 4.7) * height * 0.28
            + Math.cos(time * speed * 1.1 + particle.seed * 2.9) * height * 0.12;
          const x = centerX + wanderX;
          const y = centerY + wanderY;

          // Pulse: fireflies blink on/off smoothly
          const blinkCycle = (time * 2.5 + particle.seed * 3) % 3;
          const blink = blinkCycle < 1 ? Math.sin(blinkCycle * Math.PI) : 0;
          const alpha = config.opacity * blink;
          if (alpha < 0.05) {
            return;
          }

          const fill = colorToRgba(particle.color, clamp(alpha, 0, 0.95));
          context.shadowBlur = 12;
          context.shadowColor = fill;
          context.fillStyle = fill;
          context.beginPath();
          context.arc(x, y, size * (0.6 + blink * 0.5), 0, Math.PI * 2);
          context.fill();
          context.shadowBlur = 0;
          return;
        }

        if (config.motion === "rain") {
          // Rain streaks falling diagonally
          const fallSpeed = speed * 80;
          const rainY = ((particle.seed * height + time * fallSpeed) % (height * 1.4)) - height * 0.2;
          const rainX = (particle.seed * width * 1.2) % width + time * 8 * (index % 2 === 0 ? 1 : -0.3);
          const streakLen = size * 6;
          const alpha = config.opacity * (1 - Math.abs((rainY / height) - 0.5) * 1.2);
          if (alpha < 0.05) {
            return;
          }

          const fill = colorToRgba(particle.color, clamp(alpha, 0, 0.65));
          context.strokeStyle = fill;
          context.lineWidth = size * 0.5;
          context.beginPath();
          context.moveTo(rainX, rainY);
          context.lineTo(rainX - streakLen * 0.15, rainY + streakLen);
          context.stroke();
          return;
        }

        if (config.motion === "orbit") {
          const orbitRadius = lerp(
            (config.radiusRange?.[0] ?? 0.34) * width,
            (config.radiusRange?.[1] ?? 0.48) * width,
            (index % 5) / 4
          );
          const angle = time * speed * 2.2 + particle.seed * Math.PI * 2;
          const x = centerX + Math.cos(angle) * orbitRadius;
          const y = centerY + Math.sin(angle) * orbitRadius * 0.86;
          const alpha = config.opacity * (0.55 + Math.sin(time * 4 + particle.seed) * 0.18);
          const fill = colorToRgba(particle.color, clamp(alpha, 0.18, 0.95));

          context.shadowBlur = 10;
          context.shadowColor = fill;
          if (effect === "orbiting_petals") {
            drawPetal(context, x, y, size * 0.9, angle, fill);
          } else {
            context.fillStyle = fill;
            context.beginPath();
            context.arc(x, y, size, 0, Math.PI * 2);
            context.fill();
          }
          context.shadowBlur = 0;
          return;
        }

        if (config.motion === "surface-sparkle") {
          const localTime = time * speed + particle.seed * 3;
          const pulse = (Math.sin(localTime * 3.4) + 1) / 2;
          const radius = width * 0.31 * Math.sqrt(((index * 37) % 100) / 100);
          const angle = particle.seed * 8.2;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          const alpha = config.opacity * pulse;
          const fill = colorToRgba(particle.color, clamp(alpha, 0.08, 0.95));

          context.fillStyle = fill;
          context.shadowBlur = 12;
          context.shadowColor = fill;
          context.beginPath();
          context.arc(x, y, size * (0.55 + pulse * 0.5), 0, Math.PI * 2);
          context.fill();

          context.fillStyle = colorToRgba(0xffffff, alpha * 0.42);
          context.fillRect(x - size * 0.1, y - size, size * 0.2, size * 2);
          context.fillRect(x - size, y - size * 0.1, size * 2, size * 0.2);
          context.shadowBlur = 0;
          return;
        }

        const rise = (time * speed + particle.seed) % 1;
        const x =
          centerX +
          (Math.sin(particle.seed * 5.7) * width * 0.18 +
            Math.sin(time * 1.4 + particle.seed * 8) * width * (config.drift ?? 0.08));
        const y = height * 0.88 - rise * height * 0.78;
        const alpha = config.opacity * (1 - rise) * 0.9;
        const fill = colorToRgba(particle.color, clamp(alpha, 0.03, 0.22));

        context.fillStyle = fill;
        context.shadowBlur = 18;
        context.shadowColor = fill;
        context.beginPath();
        context.arc(x, y, size * (1 + rise * 0.6), 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;
      });

      frameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameId);
  }, [active, effect]);

  if (!effect || effect === "none" || effect === "holographic_overlay") {
    return null;
  }

  return <canvas ref={canvasRef} className={cn("absolute inset-0 h-full w-full", className)} />;
}
