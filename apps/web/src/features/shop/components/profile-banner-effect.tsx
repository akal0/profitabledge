"use client";

import {
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  Application as PixiApplication,
  Graphics,
  type Filter,
  type Graphics as PixiGraphics,
} from "pixi.js";
import { AdvancedBloomFilter } from "pixi-filters/advanced-bloom";
import { GlitchFilter } from "pixi-filters/glitch";
import { GlowFilter } from "pixi-filters/glow";
import { RGBSplitFilter } from "pixi-filters/rgb-split";

import {
  BANNER_PARTICLES,
  BANNER_SPARKLES,
  CONFETTI_PARTICLES,
  MATRIX_COLUMNS,
} from "@/features/shop/lib/profile-banner-effects";
import { cn } from "@/lib/utils";

type ProfileBannerEffectProps = {
  effect?: string | null;
  compact?: boolean;
  animate?: boolean;
  className?: string;
};

type Size = {
  width: number;
  height: number;
};

type FilterBundle = {
  filters: Filter[];
  glitch?: GlitchFilter;
  rgbSplit?: RGBSplitFilter;
};

function useElementSize<T extends HTMLElement>(): [RefObject<T | null>, Size] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const update = () => {
      const nextWidth = element.clientWidth;
      const nextHeight = element.clientHeight;

      setSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight }
      );
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return [ref, size];
}

function parseSeconds(value: string) {
  return Number.parseFloat(value.replace("s", ""));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function drawCircle(
  graphics: PixiGraphics,
  x: number,
  y: number,
  radius: number,
  color: number,
  alpha: number
) {
  graphics.setFillStyle({ color, alpha });
  graphics.circle(x, y, radius);
  graphics.fill();
}

function drawRect(
  graphics: PixiGraphics,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  alpha: number
) {
  graphics.setFillStyle({ color, alpha });
  graphics.rect(x, y, width, height);
  graphics.fill();
}

function drawPolygon(
  graphics: PixiGraphics,
  points: number[],
  color: number,
  alpha: number
) {
  graphics.setFillStyle({ color, alpha });
  graphics.poly(points);
  graphics.fill();
}

function drawPolyline(
  graphics: PixiGraphics,
  points: readonly number[],
  color: number,
  alpha: number,
  width: number
) {
  graphics.setStrokeStyle({
    color,
    alpha,
    width,
    cap: "round",
    join: "round",
  });
  graphics.moveTo(points[0] ?? 0, points[1] ?? 0);

  for (let index = 2; index < points.length; index += 2) {
    graphics.lineTo(points[index] ?? 0, points[index + 1] ?? 0);
  }

  graphics.stroke();
}

function getSegmentLength(x1: number, y1: number, x2: number, y2: number) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function trimPolyline(points: readonly number[], progress: number) {
  const clampedProgress = clamp(progress, 0, 1);

  if (points.length <= 2 || clampedProgress >= 1) {
    return points;
  }

  if (clampedProgress <= 0) {
    return points.slice(0, 2);
  }

  let totalLength = 0;
  for (let index = 0; index < points.length - 2; index += 2) {
    totalLength += getSegmentLength(
      points[index] ?? 0,
      points[index + 1] ?? 0,
      points[index + 2] ?? 0,
      points[index + 3] ?? 0
    );
  }

  if (totalLength <= 0) {
    return points.slice(0, 2);
  }

  const targetLength = totalLength * clampedProgress;
  const trimmed = [points[0] ?? 0, points[1] ?? 0];
  let walked = 0;

  for (let index = 0; index < points.length - 2; index += 2) {
    const x1 = points[index] ?? 0;
    const y1 = points[index + 1] ?? 0;
    const x2 = points[index + 2] ?? 0;
    const y2 = points[index + 3] ?? 0;
    const segmentLength = getSegmentLength(x1, y1, x2, y2);

    if (walked + segmentLength >= targetLength) {
      const segmentProgress = segmentLength <= 0 ? 0 : (targetLength - walked) / segmentLength;
      trimmed.push(lerp(x1, x2, segmentProgress), lerp(y1, y2, segmentProgress));
      return trimmed;
    }

    trimmed.push(x2, y2);
    walked += segmentLength;
  }

  return trimmed;
}

function createRotatedRectPoints(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  rotation: number
) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const corners = [
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
    [halfWidth, halfHeight],
    [-halfWidth, halfHeight],
  ] as const;

  return corners.flatMap(([x, y]) => [
    centerX + x * cos - y * sin,
    centerY + x * sin + y * cos,
  ]);
}

function createEllipsePoints(
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  rotation: number,
  segments = 12
) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const points: number[] = [];

  for (let index = 0; index < segments; index += 1) {
    const angle = (Math.PI * 2 * index) / segments;
    const x = Math.cos(angle) * radiusX;
    const y = Math.sin(angle) * radiusY;
    points.push(centerX + x * cos - y * sin, centerY + x * sin + y * cos);
  }

  return points;
}

function drawParticleField(
  graphics: PixiGraphics,
  options: {
    time: number;
    color: number;
    particles: typeof BANNER_PARTICLES | typeof CONFETTI_PARTICLES;
    width: number;
    height: number;
    compact: boolean;
    direction: "fall" | "rise";
    shape: "circle" | "diamond" | "petal" | "confetti";
    timeOffset?: number;
    xShift?: number;
    sizeMultiplier?: number;
    alphaMultiplier?: number;
  }
) {
  const {
    time,
    color,
    particles,
    width,
    height,
    compact,
    direction,
    shape,
    timeOffset = 0,
    xShift = 0,
    sizeMultiplier = 1,
    alphaMultiplier = 1,
  } = options;

  particles.forEach((particle, index) => {
    const duration = parseSeconds(particle.duration);
    const delay = parseSeconds(particle.delay);
    const progress = ((time + timeOffset + delay) % duration) / duration;
    const xBase = (particle.left / 100) * width + xShift * width;
    const driftX = particle.driftX * (width / 260);
    const x =
      xBase +
      Math.sin(progress * Math.PI * 2 + index * 0.8) * driftX * 0.45 +
      driftX * (progress - 0.5) * 0.8;
    const startY = direction === "fall" ? -height * 0.2 : height * 1.2;
    const endY = direction === "fall" ? height * 1.18 : -height * 0.25;
    const y = lerp(startY, endY, progress) + (particle.top / 100) * height * 0.08;
    const alpha =
      particle.opacity * (1 - Math.abs(progress - 0.5) * 1.1) * alphaMultiplier;
    const rotation = (particle.rotate * Math.PI) / 180 + progress * Math.PI * 1.6;
    const baseSize = particle.size * (compact ? 0.9 : 1.05) * sizeMultiplier;

    if (shape === "circle") {
      drawCircle(graphics, x, y, baseSize, color, clamp(alpha, 0.16, 1));
      return;
    }

    if (shape === "diamond") {
      drawPolygon(
        graphics,
        createRotatedRectPoints(x, y, baseSize * 1.4, baseSize * 1.4, Math.PI / 4 + rotation),
        color,
        clamp(alpha, 0.16, 1)
      );
      return;
    }

    if (shape === "petal") {
      drawPolygon(
        graphics,
        createEllipsePoints(x, y, baseSize * 1.45, baseSize * 0.8, rotation),
        color,
        clamp(alpha, 0.16, 1)
      );
      return;
    }

    drawPolygon(
      graphics,
      createRotatedRectPoints(x, y, baseSize * 1.1, baseSize * 2.1, rotation),
      color,
      clamp(alpha, 0.18, 1)
    );
  });
}

function drawSakuraBloomCluster(
  graphics: PixiGraphics,
  options: {
    centerX: number;
    centerY: number;
    bloomRadius: number;
    petalSize: number;
    time: number;
    compact: boolean;
    rotationOffset?: number;
    opacity?: number;
  }
) {
  const {
    centerX,
    centerY,
    bloomRadius,
    petalSize,
    time,
    compact,
    rotationOffset = 0,
    opacity = 1,
  } = options;
  const petalCount = compact ? 5 : 7;

  for (let index = 0; index < petalCount; index += 1) {
    const angle =
      rotationOffset + (Math.PI * 2 * index) / petalCount + Math.sin(time * 0.8 + index) * 0.08;
    const petalX = centerX + Math.cos(angle) * bloomRadius;
    const petalY = centerY + Math.sin(angle) * bloomRadius * 0.8;
    const petalRotation = angle + Math.PI / 2 + Math.sin(time * 1.1 + index) * 0.1;

    drawPolygon(
      graphics,
      createEllipsePoints(
        petalX,
        petalY,
        petalSize * 1.55,
        petalSize * 0.92,
        petalRotation,
        16
      ),
      0xfbcfe8,
      0.2 * opacity
    );
    drawPolygon(
      graphics,
      createEllipsePoints(
        petalX,
        petalY,
        petalSize * 0.88,
        petalSize * 0.52,
        petalRotation,
        12
      ),
      0xf9a8d4,
      0.26 * opacity
    );
  }

  drawCircle(graphics, centerX, centerY, petalSize * 0.62, 0xfef3c7, 0.22 * opacity);
}

function drawSakuraGarden(
  graphics: PixiGraphics,
  time: number,
  width: number,
  height: number,
  compact: boolean
) {
  drawCircle(graphics, width * 0.12, height * 0.24, width * 0.18, 0xfbcfe8, 0.06);
  drawCircle(graphics, width * 0.9, height * 0.18, width * 0.16, 0xf9a8d4, 0.05);
  drawCircle(graphics, width * 0.08, height * 0.74, width * 0.14, 0xfbcfe8, 0.04);

  drawSakuraBloomCluster(graphics, {
    centerX: width * 0.08,
    centerY: height * 0.2,
    bloomRadius: compact ? 8 : 12,
    petalSize: compact ? 4.5 : 6.5,
    time,
    compact,
    rotationOffset: 0.3,
    opacity: 1,
  });
  drawSakuraBloomCluster(graphics, {
    centerX: width * 0.13,
    centerY: height * 0.34,
    bloomRadius: compact ? 6 : 10,
    petalSize: compact ? 3.8 : 5.5,
    time: time + 0.8,
    compact,
    rotationOffset: -0.2,
    opacity: 0.82,
  });
  drawSakuraBloomCluster(graphics, {
    centerX: width * 0.89,
    centerY: height * 0.16,
    bloomRadius: compact ? 7 : 11,
    petalSize: compact ? 4.2 : 6,
    time: time + 0.45,
    compact,
    rotationOffset: 0.5,
    opacity: 0.92,
  });
  drawSakuraBloomCluster(graphics, {
    centerX: width * 0.93,
    centerY: height * 0.31,
    bloomRadius: compact ? 5 : 8,
    petalSize: compact ? 3.2 : 4.8,
    time: time + 1.2,
    compact,
    rotationOffset: -0.4,
    opacity: 0.72,
  });
}

function drawMatrixRain(
  graphics: PixiGraphics,
  time: number,
  width: number,
  height: number,
  compact: boolean
) {
  const columns = compact ? MATRIX_COLUMNS.slice(0, 8) : MATRIX_COLUMNS;

  columns.forEach((column, index) => {
    const duration = parseSeconds(column.duration);
    const delay = parseSeconds(column.delay);
    const progress = ((time + delay) % duration) / duration;
    const x = (column.left / 100) * width;
    const headY = lerp(-height * 0.35, height * 1.2, progress);
    const cellHeight = compact ? 4.5 : 6;
    const cellWidth = compact ? 3.5 : 5;
    const trailLength = compact ? 10 : 16;

    for (let row = 0; row < trailLength; row += 1) {
      const y = headY - row * cellHeight * 1.35;
      const alpha =
        clamp(0.82 - row * 0.065, 0, 1) *
        (0.72 + Math.sin(time * 7.5 + index + row * 0.75) * 0.18);

      if (y < -cellHeight * 2 || y > height + cellHeight * 2) {
        continue;
      }

      drawRect(
        graphics,
        x - cellWidth / 2,
        y,
        cellWidth,
        cellHeight,
        row === 0 ? 0xbbf7d0 : 0x4ade80,
        clamp(alpha, 0.06, 1)
      );
    }
  });
}

function drawSparkleDust(
  graphics: PixiGraphics,
  time: number,
  width: number,
  height: number,
  compact: boolean
) {
  const sparkles = compact ? BANNER_SPARKLES.slice(0, 4) : BANNER_SPARKLES;

  sparkles.forEach((sparkle, index) => {
    const duration = parseSeconds(sparkle.duration);
    const delay = parseSeconds(sparkle.delay);
    const progress = ((time + delay) % duration) / duration;
    const pulse = 0.45 + Math.sin(progress * Math.PI * 2) * 0.45;
    const x = (sparkle.left / 100) * width;
    const y = (sparkle.top / 100) * height;
    const radius = sparkle.size * (0.7 + pulse * 0.35);

    drawCircle(graphics, x, y, radius, 0xffffff, clamp(pulse, 0.15, 0.92));
    drawRect(
      graphics,
      x - radius * 0.1,
      y - radius * 1.8,
      radius * 0.2,
      radius * 3.6,
      0xffffff,
      pulse * 0.45
    );
    drawRect(
      graphics,
      x - radius * 1.8,
      y - radius * 0.1,
      radius * 3.6,
      radius * 0.2,
      0xffffff,
      pulse * 0.45
    );

    if (!compact && index % 2 === 0) {
      drawCircle(
        graphics,
        x + radius * 6.5,
        y + radius * 2.2,
        radius * 0.55,
        0xe2e8f0,
        pulse * 0.32
      );
    }
  });
}

function drawAurora(
  graphics: PixiGraphics,
  time: number,
  width: number,
  height: number,
  compact: boolean
) {
  const shift = compact ? 0.35 : 1;

  drawPolygon(
    graphics,
    createEllipsePoints(
      width * (0.28 + Math.sin(time * 0.35) * 0.05),
      height * (0.34 + Math.cos(time * 0.22) * 0.04),
      width * 0.34,
      height * 0.46,
      Math.sin(time * 0.18) * 0.24,
      24
    ),
    0x34d399,
    0.16 * shift
  );
  drawPolygon(
    graphics,
    createEllipsePoints(
      width * (0.56 + Math.cos(time * 0.3) * 0.05),
      height * (0.3 + Math.sin(time * 0.24) * 0.04),
      width * 0.36,
      height * 0.44,
      -0.28 + Math.sin(time * 0.16) * 0.2,
      24
    ),
    0x22d3ee,
    0.13 * shift
  );
  drawPolygon(
    graphics,
    createEllipsePoints(
      width * (0.74 + Math.sin(time * 0.28) * 0.04),
      height * (0.46 + Math.cos(time * 0.18) * 0.05),
      width * 0.28,
      height * 0.36,
      0.22,
      24
    ),
    0x818cf8,
    0.16 * shift
  );
  drawCircle(graphics, width * 0.78, height * 0.16, width * 0.16, 0xf472b6, 0.08 * shift);
}

function drawLiquidGradient(
  graphics: PixiGraphics,
  time: number,
  width: number,
  height: number,
  compact: boolean
) {
  const blobs = [
    { color: 0x22d3ee, x: 0.2, y: 0.32, radius: compact ? 0.18 : 0.24, speed: 0.24 },
    { color: 0x818cf8, x: 0.58, y: 0.24, radius: compact ? 0.2 : 0.28, speed: 0.18 },
    { color: 0xf472b6, x: 0.78, y: 0.58, radius: compact ? 0.16 : 0.22, speed: 0.28 },
    { color: 0x34d399, x: 0.36, y: 0.68, radius: compact ? 0.14 : 0.2, speed: 0.22 },
  ] as const;

  blobs.forEach((blob, index) => {
    const driftX = Math.sin(time * blob.speed + index) * width * 0.05;
    const driftY = Math.cos(time * (blob.speed + 0.09) + index * 0.8) * height * 0.06;
    drawCircle(
      graphics,
      width * blob.x + driftX,
      height * blob.y + driftY,
      width * blob.radius,
      blob.color,
      compact ? 0.12 : 0.18
    );
  });
}

function drawStarfield(
  graphics: PixiGraphics,
  time: number,
  width: number,
  height: number,
  compact: boolean
) {
  const starCount = compact ? 24 : 44;
  for (let index = 0; index < starCount; index += 1) {
    const layer = index % 2 === 0 ? 1 : 0.55;
    const seed = index * 0.371;
    const x = ((index * 37) % 100) / 100 * width + Math.sin(time * 0.08 * layer + seed) * width * 0.03;
    const y = (((index * 17) % 100) / 100 * height + time * 6 * layer + seed * 7) % (height + 12) - 6;
    const radius = (index % 5 === 0 ? 1.8 : 1.1) * (compact ? 0.8 : 1);
    const alpha = 0.3 + ((Math.sin(time * 1.6 + seed * 6) + 1) / 2) * 0.45;
    drawCircle(graphics, x, y, radius, index % 4 === 0 ? 0xbfdbfe : 0xffffff, alpha);
  }
}

function drawHolographicCard(
  graphics: PixiGraphics,
  time: number,
  width: number,
  height: number
) {
  const sweep = ((time * 70) % (width * 1.8)) - width * 0.4;
  drawRect(graphics, 0, 0, width, height, 0xffffff, 0.03);
  drawPolygon(
    graphics,
    [
      sweep - width * 0.22,
      0,
      sweep,
      0,
      sweep + width * 0.22,
      height,
      sweep,
      height,
    ],
    0x22d3ee,
    0.12
  );
  drawPolygon(
    graphics,
    [
      sweep + width * 0.06,
      0,
      sweep + width * 0.18,
      0,
      sweep + width * 0.42,
      height,
      sweep + width * 0.28,
      height,
    ],
    0xf472b6,
    0.1
  );
  drawCircle(graphics, width * 0.18, height * 0.22, width * 0.12, 0xfbbf24, 0.06);
  drawCircle(graphics, width * 0.82, height * 0.74, width * 0.14, 0x818cf8, 0.07);
}

function drawBullBearBackdrop(
  graphics: PixiGraphics,
  color: number,
  width: number,
  height: number
) {
  drawRect(graphics, 0, 0, width, height, color, 0.03);
  drawCircle(graphics, width * 0.76, height * 0.18, width * 0.22, color, 0.08);
  drawCircle(graphics, width * 0.2, height * 0.82, width * 0.25, color, 0.05);
}

function drawLightning(
  graphics: PixiGraphics,
  time: number,
  width: number,
  height: number
) {
  const cycleDuration = 2.6;
  const strikes = [
    {
      offset: 0,
      flashStrength: 1,
      glowX: width * 0.11,
      glowY: height * 0.2,
      main: [
        width * 0.08,
        height * 0.02,
        width * 0.12,
        height * 0.16,
        width * 0.07,
        height * 0.3,
        width * 0.15,
        height * 0.47,
        width * 0.09,
        height * 0.64,
        width * 0.13,
        height * 0.84,
        width * 0.1,
        height * 0.98,
      ],
      forks: [
        {
          startAt: 0.3,
          points: [
            width * 0.072,
            height * 0.3,
            width * 0.02,
            height * 0.4,
            width * 0.05,
            height * 0.54,
          ],
        },
        {
          startAt: 0.58,
          points: [
            width * 0.094,
            height * 0.64,
            width * 0.04,
            height * 0.74,
            width * 0.07,
            height * 0.86,
          ],
        },
      ],
    },
    {
      offset: 0.14,
      flashStrength: 0.82,
      glowX: width * 0.18,
      glowY: height * 0.32,
      main: [
        width * 0.17,
        height * 0.06,
        width * 0.21,
        height * 0.2,
        width * 0.16,
        height * 0.34,
        width * 0.23,
        height * 0.5,
        width * 0.18,
        height * 0.69,
        width * 0.22,
        height * 0.89,
      ],
      forks: [
        {
          startAt: 0.38,
          points: [
            width * 0.165,
            height * 0.34,
            width * 0.12,
            height * 0.43,
            width * 0.145,
            height * 0.56,
          ],
        },
      ],
    },
    {
      offset: 0.56,
      flashStrength: 0.96,
      glowX: width * 0.88,
      glowY: height * 0.18,
      main: [
        width * 0.92,
        height * 0.03,
        width * 0.88,
        height * 0.15,
        width * 0.93,
        height * 0.31,
        width * 0.85,
        height * 0.46,
        width * 0.91,
        height * 0.64,
        width * 0.87,
        height * 0.82,
        width * 0.9,
        height * 0.98,
      ],
      forks: [
        {
          startAt: 0.28,
          points: [
            width * 0.928,
            height * 0.31,
            width * 0.98,
            height * 0.38,
            width * 0.95,
            height * 0.52,
          ],
        },
        {
          startAt: 0.6,
          points: [
            width * 0.907,
            height * 0.64,
            width * 0.97,
            height * 0.71,
            width * 0.94,
            height * 0.84,
          ],
        },
      ],
    },
    {
      offset: 0.72,
      flashStrength: 0.76,
      glowX: width * 0.8,
      glowY: height * 0.28,
      main: [
        width * 0.81,
        height * 0.08,
        width * 0.77,
        height * 0.19,
        width * 0.82,
        height * 0.36,
        width * 0.75,
        height * 0.52,
        width * 0.8,
        height * 0.72,
        width * 0.76,
        height * 0.92,
      ],
      forks: [
        {
          startAt: 0.44,
          points: [
            width * 0.818,
            height * 0.36,
            width * 0.87,
            height * 0.45,
            width * 0.84,
            height * 0.58,
          ],
        },
      ],
    },
  ] as const;

  let flash = 0;

  strikes.forEach((strike) => {
    const cycle = (time + strike.offset) % cycleDuration;
    const revealProgress = clamp((cycle - 1.55) / 0.16, 0, 1);
    const tailFade = 1 - clamp((cycle - 1.76) / 0.42, 0, 1);
    const alpha =
      Math.max(revealProgress, tailFade * 0.74) * strike.flashStrength;

    if (alpha <= 0.01) {
      return;
    }

    flash += alpha * 0.06;

    drawCircle(
      graphics,
      strike.glowX,
      strike.glowY,
      width * 0.08,
      0xdbeafe,
      alpha * 0.08
    );

    const mainPath = trimPolyline(strike.main, revealProgress);
    if (mainPath.length >= 4) {
      drawPolyline(
        graphics,
        mainPath,
        0x93c5fd,
        alpha * 0.26,
        Math.max(2.4, width * 0.008)
      );
      drawPolyline(
        graphics,
        mainPath,
        0xffffff,
        alpha * 0.96,
        Math.max(1.05, width * 0.0034)
      );
    }

    strike.forks.forEach((fork) => {
      const forkProgress = clamp((revealProgress - fork.startAt) / (1 - fork.startAt), 0, 1);
      if (forkProgress <= 0) {
        return;
      }

      const forkPath = trimPolyline(fork.points, forkProgress);
      if (forkPath.length < 4) {
        return;
      }

      drawPolyline(
        graphics,
        forkPath,
        0xbfdbfe,
        alpha * 0.18,
        Math.max(1.8, width * 0.0055)
      );
      drawPolyline(
        graphics,
        forkPath,
        0xe0f2fe,
        alpha * 0.78,
        Math.max(0.8, width * 0.0026)
      );
    });
  });

  drawRect(graphics, 0, 0, width, height, 0xffffff, clamp(flash, 0, 0.18));
}

function drawGlitch(graphics: PixiGraphics, time: number, width: number, height: number) {
  for (let index = 0; index < 12; index += 1) {
    const y = (height / 12) * index;
    drawRect(graphics, 0, y, width, 1, 0xffffff, 0.05 + (index % 2) * 0.02);
  }

  for (let index = 0; index < 5; index += 1) {
    const phase = Math.sin(time * 3.6 + index * 1.3);
    const barY = ((index + 1) / 6) * height + phase * 7;
    const barHeight = 5 + (index % 3) * 2;
    drawRect(
      graphics,
      0,
      barY,
      width,
      barHeight,
      index % 2 === 0 ? 0x22d3ee : 0xf472b6,
      0.12
    );
  }

  drawCircle(graphics, width * 0.84, height * 0.22, width * 0.16, 0x22d3ee, 0.06);
  drawCircle(graphics, width * 0.18, height * 0.7, width * 0.18, 0xf472b6, 0.05);
}

function drawBannerEffect(
  graphics: PixiGraphics,
  effect: string,
  time: number,
  width: number,
  height: number,
  compact: boolean
) {
  graphics.clear();

  switch (effect) {
    case "falling_stars": {
      drawCircle(graphics, width * 0.5, height * 0.08, width * 0.44, 0x93c5fd, 0.12);
      drawCircle(graphics, width * 0.18, height * 0.18, width * 0.2, 0xe0f2fe, 0.08);
      drawParticleField(graphics, {
        time,
        color: 0xe0f2fe,
        particles: BANNER_PARTICLES,
        width,
        height,
        compact,
        direction: "fall",
        shape: "circle",
      });
      return;
    }
    case "fire_embers": {
      drawCircle(graphics, width * 0.5, height * 1.03, width * 0.48, 0xfb923c, 0.12);
      drawCircle(graphics, width * 0.2, height * 0.92, width * 0.24, 0xef4444, 0.08);
      drawParticleField(graphics, {
        time,
        color: 0xfb923c,
        particles: BANNER_PARTICLES,
        width,
        height,
        compact,
        direction: "rise",
        shape: "circle",
      });
      return;
    }
    case "snow": {
      drawParticleField(graphics, {
        time,
        color: 0xffffff,
        particles: BANNER_PARTICLES,
        width,
        height,
        compact,
        direction: "fall",
        shape: "circle",
      });
      return;
    }
    case "sakura_petals": {
      drawSakuraGarden(graphics, time, width, height, compact);
      drawParticleField(graphics, {
        time,
        color: 0xfbcfe8,
        particles: BANNER_PARTICLES,
        width,
        height,
        compact,
        direction: "fall",
        shape: "petal",
        sizeMultiplier: compact ? 1.2 : 1.45,
        alphaMultiplier: 1.08,
      });
      drawParticleField(graphics, {
        time,
        color: 0xf9a8d4,
        particles: compact ? BANNER_PARTICLES.slice(0, 8) : BANNER_PARTICLES,
        width,
        height,
        compact,
        direction: "fall",
        shape: "petal",
        timeOffset: 1.35,
        xShift: compact ? 0.03 : 0.05,
        sizeMultiplier: compact ? 0.95 : 1.15,
        alphaMultiplier: 0.92,
      });
      return;
    }
    case "glitch": {
      drawGlitch(graphics, time, width, height);
      return;
    }
    case "matrix_rain": {
      drawMatrixRain(graphics, time, width, height, compact);
      return;
    }
    case "aurora_borealis": {
      drawAurora(graphics, time, width, height, compact);
      return;
    }
    case "lightning": {
      drawLightning(graphics, time, width, height);
      return;
    }
    case "confetti": {
      drawParticleField(graphics, {
        time,
        color: 0xfb7185,
        particles: compact ? CONFETTI_PARTICLES.slice(0, 4) : CONFETTI_PARTICLES,
        width,
        height,
        compact,
        direction: "fall",
        shape: "confetti",
      });
      return;
    }
    case "sparkle_dust": {
      drawSparkleDust(graphics, time, width, height, compact);
      return;
    }
    case "bull_run": {
      drawBullBearBackdrop(graphics, 0x22c55e, width, height);
      drawParticleField(graphics, {
        time,
        color: 0x4ade80,
        particles: BANNER_PARTICLES,
        width,
        height,
        compact,
        direction: "rise",
        shape: "circle",
      });
      return;
    }
    case "bear_market": {
      drawBullBearBackdrop(graphics, 0xef4444, width, height);
      drawParticleField(graphics, {
        time,
        color: 0xf87171,
        particles: BANNER_PARTICLES,
        width,
        height,
        compact,
        direction: "fall",
        shape: "circle",
      });
      return;
    }
    case "diamond_rain": {
      drawParticleField(graphics, {
        time,
        color: 0xe0f2fe,
        particles: BANNER_PARTICLES,
        width,
        height,
        compact,
        direction: "fall",
        shape: "diamond",
      });
      return;
    }
    case "liquid_gradient": {
      drawLiquidGradient(graphics, time, width, height, compact);
      return;
    }
    case "starfield": {
      drawStarfield(graphics, time, width, height, compact);
      return;
    }
    case "holographic_card": {
      drawHolographicCard(graphics, time, width, height);
      return;
    }
    case "pulse_wave": {
      drawPulseWave(graphics, time, width, height, compact);
      return;
    }
    case "candlestick_rain": {
      drawCandlestickRain(graphics, time, width, height, compact);
      return;
    }
    case "firefly_field": {
      drawFireflyField(graphics, time, width, height, compact);
      return;
    }
    case "rain_storm": {
      drawRainStorm(graphics, time, width, height, compact);
      return;
    }
    case "ticker_tape": {
      drawTickerTape(graphics, time, width, height, compact);
      return;
    }
    default:
      return;
  }
}

function drawPulseWave(
  graphics: PixiGraphics,
  time: number,
  width: number,
  height: number,
  compact: boolean
) {
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const maxRadius = Math.hypot(width, height) * 0.6;
  const waveCount = compact ? 3 : 5;
  const interval = 2.4;

  for (let wave = 0; wave < waveCount; wave += 1) {
    const progress = ((time / interval + wave / waveCount) % 1);
    const radius = progress * maxRadius;
    const alpha = (1 - progress) * 0.28;

    if (alpha <= 0.01) continue;

    // Outer ring
    graphics.setStrokeStyle({ color: 0x22d3ee, alpha, width: compact ? 1.2 : 2 });
    graphics.circle(centerX, centerY, radius);
    graphics.stroke();

    // Inner glow ring
    graphics.setStrokeStyle({ color: 0xe0f2fe, alpha: alpha * 0.5, width: compact ? 0.6 : 1 });
    graphics.circle(centerX, centerY, radius * 0.97);
    graphics.stroke();
  }
}

function drawCandlestickRain(
  graphics: PixiGraphics,
  time: number,
  width: number,
  height: number,
  compact: boolean
) {
  const candleCount = compact ? 8 : 14;

  for (let i = 0; i < candleCount; i += 1) {
    const speed = 25 + (i % 5) * 8;
    const x = ((i * width) / candleCount) + Math.sin(i * 1.7) * 12;
    const y = ((i * 37 + time * speed) % (height * 1.4)) - height * 0.2;
    const isBull = i % 3 !== 0;
    const bodyColor = isBull ? 0x22c55e : 0xef4444;
    const wickColor = isBull ? 0x4ade80 : 0xf87171;
    const bodyHeight = compact ? 6 + (i % 3) * 3 : 8 + (i % 4) * 4;
    const bodyWidth = compact ? 4 : 5;
    const wickHeight = bodyHeight * 0.6;
    const alpha = 0.4 * (1 - Math.abs((y / height) - 0.5) * 1.4);
    const rotation = Math.sin(time * 2 + i) * 0.15;

    if (alpha <= 0.02) continue;

    // Wick
    graphics.setStrokeStyle({ color: wickColor, alpha: alpha * 0.6, width: 0.8 });
    graphics.moveTo(x, y - wickHeight);
    graphics.lineTo(x, y + bodyHeight + wickHeight * 0.5);
    graphics.stroke();

    // Body
    graphics.setFillStyle({ color: bodyColor, alpha });
    graphics.rect(x - bodyWidth / 2, y, bodyWidth, bodyHeight);
    graphics.fill();
  }
}

function drawFireflyField(
  graphics: PixiGraphics,
  time: number,
  width: number,
  height: number,
  compact: boolean
) {
  const count = compact ? 10 : 18;

  for (let i = 0; i < count; i += 1) {
    const seed = i * 0.731;
    const wanderX = Math.sin(time * 0.3 + seed * 5.3) * width * 0.35
      + Math.sin(time * 0.5 + seed * 3.1) * width * 0.15;
    const wanderY = Math.cos(time * 0.25 + seed * 4.7) * height * 0.35
      + Math.cos(time * 0.4 + seed * 2.9) * height * 0.12;
    const x = width * 0.5 + wanderX;
    const y = height * 0.5 + wanderY;

    // Blink cycle
    const blinkCycle = (time * 1.8 + seed * 3) % 3.5;
    const blink = blinkCycle < 1.2 ? Math.sin((blinkCycle / 1.2) * Math.PI) : 0;

    if (blink < 0.05) continue;

    const color = i % 3 === 0 ? 0xfde047 : i % 3 === 1 ? 0xa3e635 : 0x4ade80;
    const size = (compact ? 2 : 3) * (0.5 + blink * 0.5);

    // Glow halo
    drawCircle(graphics, x, y, size * 3, color, blink * 0.08);
    // Core
    drawCircle(graphics, x, y, size, color, blink * 0.7);
    drawCircle(graphics, x, y, size * 0.4, 0xffffff, blink * 0.5);
  }
}

function drawRainStorm(
  graphics: PixiGraphics,
  time: number,
  width: number,
  height: number,
  compact: boolean
) {
  const dropCount = compact ? 20 : 40;
  const windAngle = 0.15; // slight diagonal

  for (let i = 0; i < dropCount; i += 1) {
    const speed = 60 + (i % 7) * 15;
    const seed = i * 0.371;
    const x = ((seed * width * 1.3 + time * 15) % (width * 1.2)) - width * 0.1;
    const y = ((seed * height * 1.5 + time * speed) % (height * 1.4)) - height * 0.2;
    const length = compact ? 8 : 12 + (i % 4) * 3;
    const alpha = 0.2 + ((i % 5) / 10);

    graphics.setStrokeStyle({
      color: i % 5 === 0 ? 0xbfdbfe : 0x93c5fd,
      alpha: alpha * (1 - Math.abs((y / height) - 0.5) * 1.2),
      width: 0.8,
      cap: "round",
    });
    graphics.moveTo(x, y);
    graphics.lineTo(x - length * windAngle, y + length);
    graphics.stroke();
  }

  // Occasional lightning flash
  const flashCycle = time % 4.5;
  if (flashCycle > 3.8 && flashCycle < 3.95) {
    drawRect(graphics, 0, 0, width, height, 0xffffff, 0.06);
  }
}

function drawTickerTape(
  graphics: PixiGraphics,
  time: number,
  width: number,
  height: number,
  compact: boolean
) {
  // Scrolling ticker line at ~70% height
  const tickerY = height * 0.72;
  const lineAlpha = 0.15;

  // Ticker background strip
  drawRect(graphics, 0, tickerY - 1, width, compact ? 12 : 16, 0x0f172a, 0.4);

  // Separator lines
  graphics.setStrokeStyle({ color: 0xfbbf24, alpha: lineAlpha, width: 0.5 });
  graphics.moveTo(0, tickerY - 1);
  graphics.lineTo(width, tickerY - 1);
  graphics.stroke();
  graphics.moveTo(0, tickerY + (compact ? 11 : 15));
  graphics.lineTo(width, tickerY + (compact ? 11 : 15));
  graphics.stroke();

  // Scrolling price segments
  const segmentWidth = compact ? 50 : 70;
  const segmentCount = Math.ceil(width / segmentWidth) + 2;
  const scrollOffset = (time * 40) % segmentWidth;

  for (let i = 0; i < segmentCount; i += 1) {
    const x = i * segmentWidth - scrollOffset;
    const isUp = (i + Math.floor(time)) % 3 !== 0;
    const barColor = isUp ? 0x4ade80 : 0xef4444;

    // Small price bar indicator
    const barHeight = 4 + (i % 3) * 2;
    const barY = tickerY + (compact ? 3 : 5);
    drawRect(graphics, x + 4, barY, 3, barHeight, barColor, 0.5);

    // Arrow indicator
    const arrowY = isUp ? barY - 1 : barY + barHeight + 1;
    const arrowDir = isUp ? -1 : 1;
    drawPolygon(
      graphics,
      [x + 5.5, arrowY, x + 3.5, arrowY + arrowDir * 2, x + 7.5, arrowY + arrowDir * 2],
      barColor,
      0.4
    );

    // Separator dot
    if (i > 0) {
      drawCircle(graphics, x - 2, tickerY + (compact ? 5 : 7), 1, 0xfbbf24, 0.2);
    }
  }

  // Ambient glow
  drawCircle(graphics, width * 0.5, tickerY + 6, width * 0.35, 0xfbbf24, 0.03);
}

function createFilters(effect: string, compact: boolean): FilterBundle {
  switch (effect) {
    case "falling_stars":
      return {
        filters: [
          new GlowFilter({
            color: 0x93c5fd,
            distance: compact ? 8 : 14,
            outerStrength: compact ? 1 : 1.8,
            alpha: compact ? 0.4 : 0.55,
            quality: 0.08,
          }),
        ],
      };
    case "fire_embers":
      return {
        filters: [
          new GlowFilter({
            color: 0xfb923c,
            distance: compact ? 8 : 14,
            outerStrength: compact ? 1 : 1.8,
            alpha: compact ? 0.38 : 0.52,
            quality: 0.08,
          }),
        ],
      };
    case "sakura_petals":
      return {
        filters: [
          new GlowFilter({
            color: 0xf9a8d4,
            distance: compact ? 8 : 14,
            outerStrength: compact ? 0.9 : 1.5,
            alpha: compact ? 0.36 : 0.48,
            quality: 0.08,
          }),
        ],
      };
    case "confetti":
      return {
        filters: [
          new GlowFilter({
            color: 0xffffff,
            distance: 8,
            outerStrength: 1,
            alpha: 0.25,
            quality: 0.08,
          }),
        ],
      };
    case "sparkle_dust":
      return {
        filters: [
          new GlowFilter({
            color: 0xffffff,
            distance: compact ? 6 : 12,
            outerStrength: compact ? 0.8 : 1.4,
            alpha: compact ? 0.45 : 0.6,
            quality: 0.08,
          }),
        ],
      };
    case "matrix_rain":
      return {
        filters: [
          new GlowFilter({
            color: 0x4ade80,
            distance: compact ? 6 : 10,
            outerStrength: compact ? 0.9 : 1.5,
            alpha: compact ? 0.35 : 0.48,
            quality: 0.08,
          }),
        ],
      };
    case "aurora_borealis":
      return {
        filters: [
          new AdvancedBloomFilter({
            threshold: 0.05,
            bloomScale: compact ? 0.7 : 1.2,
            brightness: 1.1,
            blur: compact ? 4 : 7,
            quality: 3,
          }),
        ],
      };
    case "lightning":
      return {
        filters: [
          new GlowFilter({
            color: 0xe0e7ff,
            distance: compact ? 8 : 16,
            outerStrength: compact ? 1.1 : 1.8,
            alpha: compact ? 0.4 : 0.55,
            quality: 0.08,
          }),
        ],
      };
    case "bull_run":
      return {
        filters: [
          new GlowFilter({
            color: 0x22c55e,
            distance: compact ? 8 : 14,
            outerStrength: compact ? 0.9 : 1.5,
            alpha: compact ? 0.32 : 0.42,
            quality: 0.08,
          }),
        ],
      };
    case "bear_market":
      return {
        filters: [
          new GlowFilter({
            color: 0xef4444,
            distance: compact ? 8 : 14,
            outerStrength: compact ? 0.9 : 1.5,
            alpha: compact ? 0.32 : 0.42,
            quality: 0.08,
          }),
        ],
      };
    case "diamond_rain":
      return {
        filters: [
          new GlowFilter({
            color: 0xe0f2fe,
            distance: compact ? 8 : 14,
            outerStrength: compact ? 1 : 1.8,
            alpha: compact ? 0.4 : 0.56,
            quality: 0.08,
          }),
        ],
      };
    case "liquid_gradient":
      return {
        filters: [
          new AdvancedBloomFilter({
            threshold: 0.02,
            bloomScale: compact ? 0.8 : 1.25,
            brightness: 1.05,
            blur: compact ? 5 : 8,
            quality: 3,
          }),
        ],
      };
    case "starfield":
      return {
        filters: [
          new GlowFilter({
            color: 0xe0f2fe,
            distance: compact ? 6 : 10,
            outerStrength: compact ? 0.8 : 1.2,
            alpha: compact ? 0.3 : 0.42,
            quality: 0.08,
          }),
        ],
      };
    case "holographic_card":
      return {
        filters: [
          new AdvancedBloomFilter({
            threshold: 0.04,
            bloomScale: compact ? 0.7 : 1,
            brightness: 1.06,
            blur: compact ? 4 : 6,
            quality: 3,
          }),
        ],
      };
    case "pulse_wave":
      return {
        filters: [
          new GlowFilter({
            color: 0x22d3ee,
            distance: compact ? 8 : 14,
            outerStrength: compact ? 1 : 1.6,
            alpha: compact ? 0.35 : 0.48,
            quality: 0.08,
          }),
        ],
      };
    case "candlestick_rain":
      return {
        filters: [
          new GlowFilter({
            color: 0xfbbf24,
            distance: compact ? 6 : 10,
            outerStrength: compact ? 0.7 : 1.2,
            alpha: compact ? 0.28 : 0.38,
            quality: 0.08,
          }),
        ],
      };
    case "firefly_field":
      return {
        filters: [
          new GlowFilter({
            color: 0xa3e635,
            distance: compact ? 10 : 16,
            outerStrength: compact ? 1.2 : 2,
            alpha: compact ? 0.42 : 0.58,
            quality: 0.08,
          }),
        ],
      };
    case "rain_storm":
      return {
        filters: [
          new GlowFilter({
            color: 0x93c5fd,
            distance: compact ? 6 : 10,
            outerStrength: compact ? 0.7 : 1,
            alpha: compact ? 0.25 : 0.35,
            quality: 0.08,
          }),
        ],
      };
    case "ticker_tape":
      return {
        filters: [
          new GlowFilter({
            color: 0xfbbf24,
            distance: compact ? 6 : 10,
            outerStrength: compact ? 0.6 : 1,
            alpha: compact ? 0.2 : 0.3,
            quality: 0.08,
          }),
        ],
      };
    case "glitch": {
      const glitch = new GlitchFilter({
        slices: compact ? 4 : 6,
        offset: compact ? 10 : 18,
        average: true,
        seed: 0.4,
      });
      const rgbSplit = new RGBSplitFilter({ red: [-4, 0], green: [0, 0], blue: [4, 0] });
      return {
        filters: [glitch, rgbSplit],
        glitch,
        rgbSplit,
      };
    }
    default:
      return { filters: [] };
  }
}

function updateFilters(bundle: FilterBundle, time: number, compact: boolean) {
  if (!bundle.glitch || !bundle.rgbSplit) {
    return;
  }

  bundle.glitch.seed = (Math.sin(time * 3.1) + 1) / 2;
  bundle.glitch.offset =
    (compact ? 8 : 12) +
    Math.abs(Math.sin(time * 6.4)) * (compact ? 10 : 18);
  bundle.glitch.direction = Math.sin(time * 0.7) * 12;
  bundle.glitch.refresh();
  bundle.rgbSplit.red = [
    -(compact ? 3 : 4) - Math.sin(time * 10) * (compact ? 1.5 : 3),
    0,
  ];
  bundle.rgbSplit.blue = [
    (compact ? 3 : 4) + Math.cos(time * 9) * (compact ? 1.5 : 3),
    0,
  ];
}

export function ProfileBannerEffect({
  effect,
  compact = false,
  animate = true,
  className,
}: ProfileBannerEffectProps) {
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (
      !effect ||
      effect === "none" ||
      !canvasRef.current ||
      size.width <= 0 ||
      size.height <= 0
    ) {
      return;
    }

    let mounted = true;
    let frameId = 0;
    let bundle: FilterBundle | null = null;

    const app = new PixiApplication();

    void (async () => {
      const resolution =
        typeof window === "undefined"
          ? 1
          : Math.min(window.devicePixelRatio || 1, compact ? 1 : 1.5);

      await app.init({
        canvas: canvasRef.current ?? undefined,
        width: size.width,
        height: size.height,
        preference: "webgl",
        powerPreference: "high-performance",
        backgroundAlpha: 0,
        antialias: !compact,
        autoDensity: true,
        resolution,
        autoStart: false,
      });

      if (!mounted) {
        app.destroy(true);
        return;
      }

      const graphics = new Graphics();
      bundle = createFilters(effect, compact);

      if (bundle.filters.length > 0) {
        graphics.filters = bundle.filters;
      }

      app.stage.addChild(graphics);

      let lastWidth = size.width;
      let lastHeight = size.height;
      let renderFailed = false;

      const drawAndRender = () => {
        if (renderFailed) {
          return false;
        }

        const nextWidth = containerRef.current?.clientWidth ?? size.width;
        const nextHeight = containerRef.current?.clientHeight ?? size.height;

        if (nextWidth !== lastWidth || nextHeight !== lastHeight) {
          lastWidth = nextWidth;
          lastHeight = nextHeight;
          app.renderer.resize(nextWidth, nextHeight);
        }

        const time = performance.now() / 1000;
        updateFilters(bundle ?? { filters: [] }, time, compact);
        drawBannerEffect(graphics, effect, time, nextWidth, nextHeight, compact);
        try {
          app.render();
          return true;
        } catch (error) {
          renderFailed = true;
          console.error("ProfileBannerEffect render failed", {
            effect,
            compact,
            error,
          });
          graphics.clear();
          graphics.filters = [];
          return false;
        }
      };

      if (!animate) {
        drawAndRender();
        return;
      }

      const renderFrame = () => {
        if (!mounted || renderFailed) {
          return;
        }

        const rendered = drawAndRender();
        if (!rendered) {
          return;
        }

        frameId = requestAnimationFrame(renderFrame);
      };

      renderFrame();
    })();

    return () => {
      mounted = false;
      cancelAnimationFrame(frameId);
      if (bundle) {
        bundle.filters.forEach((filter) => filter.destroy());
      }
      app.destroy(true);
    };
  }, [animate, compact, effect, size.height, size.width, containerRef]);

  if (!effect || effect === "none") {
    return null;
  }

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]",
        className
      )}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
