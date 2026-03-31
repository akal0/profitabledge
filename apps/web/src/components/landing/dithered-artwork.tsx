"use client";

import { useEffect, useRef } from "react";
import { useInView } from "motion/react";
import { cn } from "@/lib/utils";

const BAYER_8X8 = [
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
] as const;

const MOUSE_RADIUS = 72;
const MOUSE_RADIUS_SQ = MOUSE_RADIUS * MOUSE_RADIUS;
const MOUSE_FORCE_PEAK = 18;
const EASING = 0.16;
const SNAP_THRESHOLD = 0.025;

interface DitheredArtworkProps {
  src: string;
  alt: string;
  className?: string;
  tint?: string;
  baseOpacity?: number;
  pointOpacity?: number;
  pointScale?: number;
  threshold?: number;
  contrast?: number;
  gamma?: number;
  blur?: number;
  highlightsCompression?: number;
  fit?: "contain" | "cover";
  interactive?: boolean;
  animateIdle?: boolean;
  idleAmplitude?: number;
  idleSpeed?: number;
  cropToVisibleBounds?: boolean;
  alphaCutoff?: number;
}

interface LoadedImage {
  image: HTMLImageElement;
  cleanup?: () => void;
}

interface ProcessedImage {
  grayscale: Uint8Array;
  alpha: Uint8Array;
  width: number;
  height: number;
}

interface DotSystem {
  count: number;
  baseX: Float32Array;
  baseY: Float32Array;
  dx: Float32Array;
  dy: Float32Array;
  size: number;
}

function sanitizeSvgMarkup(markup: string) {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(markup, "image/svg+xml");

  documentNode.querySelectorAll("foreignObject").forEach((node) => {
    node.remove();
  });

  return new XMLSerializer().serializeToString(documentNode);
}

async function loadImage(src: string): Promise<LoadedImage> {
  if (src.endsWith(".svg")) {
    const response = await fetch(src, { cache: "force-cache" });
    const markup = await response.text();
    const sanitized = sanitizeSvgMarkup(markup);
    const blob = new Blob([sanitized], {
      type: "image/svg+xml;charset=utf-8",
    });
    const blobUrl = URL.createObjectURL(blob);
    const image = new Image();

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = reject;
      image.src = blobUrl;
    });

    return {
      image,
      cleanup: () => URL.revokeObjectURL(blobUrl),
    };
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ image });
    image.onerror = reject;
    image.src = src;
  });
}

function processImage(
  img: HTMLImageElement,
  maxDimension: number,
  contrast: number,
  gamma: number,
  blur: number,
  highlightsCompression: number
): ProcessedImage {
  const aspect = img.naturalWidth / img.naturalHeight;
  const outW =
    aspect >= 1 ? maxDimension : Math.max(1, Math.round(maxDimension * aspect));
  const outH =
    aspect >= 1 ? Math.max(1, Math.round(maxDimension / aspect)) : maxDimension;

  const alphaCanvas = document.createElement("canvas");
  alphaCanvas.width = outW;
  alphaCanvas.height = outH;
  const alphaCtx = alphaCanvas.getContext("2d");
  if (!alphaCtx) {
    return {
      grayscale: new Uint8Array(),
      alpha: new Uint8Array(),
      width: outW,
      height: outH,
    };
  }

  alphaCtx.imageSmoothingEnabled = true;
  alphaCtx.imageSmoothingQuality = "high";
  alphaCtx.drawImage(img, 0, 0, outW, outH);
  const alphaData = alphaCtx.getImageData(0, 0, outW, outH).data;

  const pad = Math.ceil(blur * 3);
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = img.naturalWidth + pad * 2;
  sourceCanvas.height = img.naturalHeight + pad * 2;
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) {
    return {
      grayscale: new Uint8Array(),
      alpha: new Uint8Array(),
      width: outW,
      height: outH,
    };
  }

  if (blur > 0) {
    sourceCtx.filter = `blur(${blur}px)`;
  }
  sourceCtx.drawImage(img, pad, pad, img.naturalWidth, img.naturalHeight);
  sourceCtx.filter = "none";

  const downsampleCanvas = document.createElement("canvas");
  downsampleCanvas.width = outW;
  downsampleCanvas.height = outH;
  const downsampleCtx = downsampleCanvas.getContext("2d");
  if (!downsampleCtx) {
    return {
      grayscale: new Uint8Array(),
      alpha: new Uint8Array(),
      width: outW,
      height: outH,
    };
  }

  downsampleCtx.imageSmoothingEnabled = true;
  downsampleCtx.imageSmoothingQuality = "high";
  downsampleCtx.drawImage(
    sourceCanvas,
    pad,
    pad,
    img.naturalWidth,
    img.naturalHeight,
    0,
    0,
    outW,
    outH
  );

  const imageData = downsampleCtx.getImageData(0, 0, outW, outH).data;
  const grayscale = new Uint8Array(outW * outH);
  const alpha = new Uint8Array(outW * outH);
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const index = (y * outW + x) * 4;
      const blurredAlpha = imageData[index + 3] / 255;
      const rawAlpha = alphaData[index + 3];

      alpha[y * outW + x] = rawAlpha;

      const r = imageData[index];
      const g = imageData[index + 1];
      const b = imageData[index + 2];

      let luma =
        blurredAlpha > 0.01
          ? (0.299 * r + 0.587 * g + 0.114 * b) / blurredAlpha
          : 0;

      if (contrast !== 0) {
        luma = contrastFactor * (luma - 128) + 128;
      }

      if (gamma !== 1) {
        luma = 255 * Math.pow(Math.max(0, luma / 255), 1 / gamma);
      }

      if (highlightsCompression > 0) {
        const normalized = luma / 255;
        const compressed =
          normalized < 0.5
            ? normalized
            : 0.5 + (normalized - 0.5) * (1 - highlightsCompression);
        luma = compressed * 255;
      }

      grayscale[y * outW + x] = Math.max(0, Math.min(255, Math.round(luma)));
    }
  }

  return { grayscale, alpha, width: outW, height: outH };
}

function bayerDither(
  grayscale: Uint8Array,
  alpha: Uint8Array,
  width: number,
  height: number,
  threshold: number,
  alphaCutoff: number
) {
  const positions: number[] = [];
  const bias = (threshold - 128) / 255;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (alpha[index] < alphaCutoff) {
        continue;
      }

      const luma = grayscale[index] / 255;
      const bayerValue = (BAYER_8X8[(y & 7) * 8 + (x & 7)] + 1) / 65;
      if (luma + bias > bayerValue) {
        positions.push(x, y);
      }
    }
  }

  return new Float32Array(positions);
}

function cropProcessedImage(
  processed: ProcessedImage,
  alphaCutoff: number
): ProcessedImage {
  const { grayscale, alpha, width, height } = processed;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] < alphaCutoff) {
        continue;
      }

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return processed;
  }

  const nextWidth = maxX - minX + 1;
  const nextHeight = maxY - minY + 1;
  if (nextWidth === width && nextHeight === height) {
    return processed;
  }

  const nextGrayscale = new Uint8Array(nextWidth * nextHeight);
  const nextAlpha = new Uint8Array(nextWidth * nextHeight);

  for (let y = 0; y < nextHeight; y++) {
    const sourceStart = (minY + y) * width + minX;
    const targetStart = y * nextWidth;
    nextGrayscale.set(
      grayscale.subarray(sourceStart, sourceStart + nextWidth),
      targetStart
    );
    nextAlpha.set(
      alpha.subarray(sourceStart, sourceStart + nextWidth),
      targetStart
    );
  }

  return {
    grayscale: nextGrayscale,
    alpha: nextAlpha,
    width: nextWidth,
    height: nextHeight,
  };
}

function createDotSystem(
  points: Float32Array,
  scaleFactor: number,
  pointScale: number,
  offsetX: number,
  offsetY: number
): DotSystem {
  const count = points.length / 2;
  const baseX = new Float32Array(count);
  const baseY = new Float32Array(count);
  const dx = new Float32Array(count);
  const dy = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    baseX[i] = offsetX + points[i * 2] * scaleFactor;
    baseY[i] = offsetY + points[i * 2 + 1] * scaleFactor;
  }

  return {
    count,
    baseX,
    baseY,
    dx,
    dy,
    size: Math.max(0.65, scaleFactor * pointScale),
  };
}

function updateDots(
  system: DotSystem,
  mouseX: number,
  mouseY: number,
  mouseActive: boolean,
  time: number,
  animateIdle: boolean,
  idleAmplitude: number,
  idleSpeed: number
) {
  let hasMotion = animateIdle;
  const idleTime = time * idleSpeed;

  for (let i = 0; i < system.count; i++) {
    let targetFx = 0;
    let targetFy = 0;

    if (animateIdle) {
      const phase =
        i * 0.173 +
        system.baseX[i] * 0.011 +
        system.baseY[i] * 0.009;
      targetFx += Math.sin(idleTime + phase) * idleAmplitude;
      targetFy += Math.cos(idleTime * 0.93 + phase * 1.17) * idleAmplitude;
    }

    if (mouseActive) {
      const vx = system.baseX[i] + system.dx[i] - mouseX;
      const vy = system.baseY[i] + system.dy[i] - mouseY;
      const dist2 = vx * vx + vy * vy;

      if (dist2 > 0.1 && dist2 < MOUSE_RADIUS_SQ) {
        const dist = Math.sqrt(dist2);
        const falloff = 1 - dist / MOUSE_RADIUS;
        const force = falloff * falloff * falloff * MOUSE_FORCE_PEAK;
        targetFx += (vx / dist) * force;
        targetFy += (vy / dist) * force;
      }
    }

    system.dx[i] += (targetFx - system.dx[i]) * EASING;
    system.dy[i] += (targetFy - system.dy[i]) * EASING;

    if (Math.abs(system.dx[i]) < SNAP_THRESHOLD) {
      system.dx[i] = 0;
    }
    if (Math.abs(system.dy[i]) < SNAP_THRESHOLD) {
      system.dy[i] = 0;
    }

    if (system.dx[i] !== 0 || system.dy[i] !== 0) {
      hasMotion = true;
    }
  }

  return hasMotion || mouseActive;
}

function renderDotSystem(
  ctx: CanvasRenderingContext2D,
  system: DotSystem,
  canvasWidth: number,
  canvasHeight: number,
  tint: string,
  pointOpacity: number
) {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = tint;
  ctx.globalAlpha = pointOpacity;

  const size = system.size;
  for (let i = 0; i < system.count; i++) {
    ctx.fillRect(
      system.baseX[i] + system.dx[i],
      system.baseY[i] + system.dy[i],
      size,
      size
    );
  }

  ctx.globalAlpha = 1;
}

export function DitheredArtwork({
  src,
  alt,
  className,
  tint = "#eef7ff",
  baseOpacity = 1,
  pointOpacity = 0.14,
  pointScale = 0.14,
  threshold = 152,
  contrast = 14,
  gamma = 1.02,
  blur = 1.2,
  highlightsCompression = 0.04,
  fit = "contain",
  interactive = true,
  animateIdle = false,
  idleAmplitude = 0.45,
  idleSpeed = 0.0012,
  cropToVisibleBounds = false,
  alphaCutoff = 128,
}: DitheredArtworkProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const systemRef = useRef<DotSystem | null>(null);
  const animationFrameRef = useRef<number>(0);
  const runningRef = useRef(false);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const isInView = useInView(containerRef, {
    once: true,
    amount: 0.15,
  });

  useEffect(() => {
    if (!isInView) {
      return;
    }

    let cancelled = false;

    const draw = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      const system = systemRef.current;
      if (!container || !canvas || !system) {
        runningRef.current = false;
        return;
      }

      const rect = container.getBoundingClientRect();
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        runningRef.current = false;
        return;
      }

      const hasMotion = updateDots(
        system,
        mouseRef.current.x,
        mouseRef.current.y,
        mouseRef.current.active,
        performance.now(),
        animateIdle,
        idleAmplitude,
        idleSpeed
      );

      renderDotSystem(ctx, system, rect.width, rect.height, tint, pointOpacity);

      if (hasMotion) {
        animationFrameRef.current = requestAnimationFrame(draw);
      } else {
        runningRef.current = false;
      }
    };

    const startLoop = () => {
      if (runningRef.current) {
        return;
      }
      runningRef.current = true;
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    const rebuild = async () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) {
        return;
      }

      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const loadedImage = await loadImage(src);
      if (cancelled) {
        loadedImage.cleanup?.();
        return;
      }

      const processed = processImage(
        loadedImage.image,
        Math.max(256, Math.round(Math.max(rect.width, rect.height) * 0.92)),
        contrast,
        gamma,
        blur,
        highlightsCompression
      );

      const prepared = cropToVisibleBounds
        ? cropProcessedImage(processed, alphaCutoff)
        : processed;

      const positions = bayerDither(
        prepared.grayscale,
        prepared.alpha,
        prepared.width,
        prepared.height,
        threshold,
        alphaCutoff
      );

      const scale =
        fit === "cover"
          ? Math.max(rect.width / prepared.width, rect.height / prepared.height)
          : Math.min(
              rect.width / prepared.width,
              rect.height / prepared.height
            );
      const offsetX = (rect.width - prepared.width * scale) / 2;
      const offsetY = (rect.height - prepared.height * scale) / 2;

      systemRef.current = createDotSystem(
        positions,
        scale,
        pointScale,
        offsetX,
        offsetY
      );

      renderDotSystem(
        ctx,
        systemRef.current,
        rect.width,
        rect.height,
        tint,
        pointOpacity
      );

      if (animateIdle) {
        startLoop();
      }

      loadedImage.cleanup?.();
    };

    const container = containerRef.current;
    const handlePointerMove = (event: PointerEvent) => {
      if (!interactive) {
        return;
      }
      const currentContainer = containerRef.current;
      if (!currentContainer) {
        return;
      }
      const rect = currentContainer.getBoundingClientRect();
      mouseRef.current.x = event.clientX - rect.left;
      mouseRef.current.y = event.clientY - rect.top;
      mouseRef.current.active = true;
      startLoop();
    };

    const handlePointerLeave = () => {
      if (!interactive) {
        return;
      }
      mouseRef.current.active = false;
      startLoop();
    };

    if (container && interactive) {
      container.addEventListener("pointermove", handlePointerMove);
      container.addEventListener("pointerleave", handlePointerLeave);
    }

    void rebuild();

    const resizeObserver = new ResizeObserver(() => {
      void rebuild();
    });
    if (container) {
      resizeObserver.observe(container);
    }

    return () => {
      cancelled = true;
      runningRef.current = false;
      cancelAnimationFrame(animationFrameRef.current);
      resizeObserver.disconnect();
      if (container && interactive) {
        container.removeEventListener("pointermove", handlePointerMove);
        container.removeEventListener("pointerleave", handlePointerLeave);
      }
    };
  }, [
    src,
    tint,
    pointOpacity,
    pointScale,
    threshold,
    contrast,
    gamma,
    blur,
    highlightsCompression,
    fit,
    interactive,
    animateIdle,
    idleAmplitude,
    idleSpeed,
    cropToVisibleBounds,
    alphaCutoff,
    isInView,
  ]);

  return (
    <div
      ref={containerRef}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={cn("relative size-full overflow-hidden", className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        style={{ opacity: baseOpacity, objectFit: fit }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ mixBlendMode: "screen" }}
        aria-hidden="true"
      />
    </div>
  );
}
