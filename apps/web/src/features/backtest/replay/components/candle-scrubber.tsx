"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Time } from "lightweight-charts";

import type { CandleData } from "@/components/charts/trading-view-chart";
import { cn } from "@/lib/utils";

type ReplayTradePosition = {
  entryTime: Time;
  entryTimeUnix?: number;
  exitTime?: Time;
  exitTimeUnix?: number;
  pnl?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getEntryUnix(trade: ReplayTradePosition) {
  return trade.entryTimeUnix ?? (trade.entryTime as number);
}

function getExitUnix(trade: ReplayTradePosition) {
  if (trade.exitTimeUnix) return trade.exitTimeUnix;
  if (typeof trade.exitTime === "number") return trade.exitTime;
  return undefined;
}

export function CandleScrubber({
  candles,
  trades,
  currentIndex,
  onSeek,
}: {
  candles: CandleData[];
  trades: ReplayTradePosition[];
  currentIndex: number;
  onSeek: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [width, setWidth] = useState(0);

  const tradeRanges = useMemo(() => {
    if (!candles.length) return [];

    return trades
      .map((trade) => {
        const entryIndex = candles.findIndex(
          (candle) => (candle.time as number) >= getEntryUnix(trade)
        );

        if (entryIndex === -1 || entryIndex > currentIndex) return null;

        const rawExitUnix = getExitUnix(trade);
        const exitIndex =
          rawExitUnix == null
            ? currentIndex
            : candles.findIndex((candle) => (candle.time as number) >= rawExitUnix);

        return {
          entryIndex,
          exitIndex: exitIndex === -1 ? currentIndex : Math.min(exitIndex, currentIndex),
          pnl: trade.pnl || 0,
        };
      })
      .filter(Boolean) as { entryIndex: number; exitIndex: number; pnl: number }[];
  }, [candles, currentIndex, trades]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      setWidth(nextWidth);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width || !candles.length) return;

    const dpr = window.devicePixelRatio || 1;
    const heatmapHeight = 22;
    const tradeHeight = 6;
    const playheadHeight = 8;
    const totalHeight = heatmapHeight + tradeHeight + playheadHeight;

    canvas.width = width * dpr;
    canvas.height = totalHeight * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${totalHeight}px`;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, totalHeight);

    const total = candles.length;
    const barWidth = Math.max(width / total, 0.5);
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    candles.forEach((candle) => {
      minPrice = Math.min(minPrice, candle.low);
      maxPrice = Math.max(maxPrice, candle.high);
    });
    const range = maxPrice - minPrice || 1;

    candles.forEach((candle, index) => {
      const x = (index / total) * width;
      const strength = (candle.close - minPrice) / range;
      const alpha = index <= currentIndex ? 0.42 + strength * 0.28 : 0.08 + strength * 0.06;
      context.fillStyle =
        candle.close >= candle.open
          ? `rgba(20,184,166,${alpha})`
          : `rgba(251,113,133,${alpha})`;
      context.fillRect(x, 0, Math.max(1, barWidth), heatmapHeight);
    });

    context.fillStyle = "rgba(255,255,255,0.03)";
    context.fillRect(0, heatmapHeight, width, tradeHeight);

    tradeRanges.forEach((rangeItem) => {
      const x1 = (rangeItem.entryIndex / total) * width;
      const x2 = (rangeItem.exitIndex / total) * width;
      context.fillStyle =
        rangeItem.pnl >= 0 ? "rgba(45,212,191,0.85)" : "rgba(251,113,133,0.85)";
      context.fillRect(x1, heatmapHeight + 1, Math.max(3, x2 - x1), tradeHeight - 2);
    });

    const playheadY = heatmapHeight + tradeHeight;
    context.fillStyle = "rgba(255,255,255,0.03)";
    context.fillRect(0, playheadY, width, playheadHeight);

    const playheadX = (currentIndex / Math.max(total - 1, 1)) * width;
    context.fillStyle = "rgba(250,204,21,0.3)";
    context.fillRect(playheadX - 0.5, 0, 1, heatmapHeight + tradeHeight);
    context.fillStyle = "#facc15";
    context.beginPath();
    context.roundRect(playheadX - 4, playheadY + 1, 8, playheadHeight - 2, 3);
    context.fill();
  }, [candles, currentIndex, tradeRanges, width]);

  const handlePointerEvent = useCallback(
    (event: React.PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || !candles.length) return;
      const x = clamp(event.clientX - rect.left, 0, rect.width);
      const index = Math.round((x / rect.width) * (candles.length - 1));
      onSeek(index);
    },
    [candles.length, onSeek]
  );

  return (
    <div className="py-0.5">
      <div
        ref={containerRef}
        className={cn(
          "relative overflow-hidden rounded-xl bg-black/15 transition-colors",
          isScrubbing ? "cursor-grabbing" : "cursor-grab"
        )}
        style={{ height: 40 }}
        onPointerDown={(event) => {
          isDragging.current = true;
          setIsScrubbing(true);
          (event.target as HTMLElement).setPointerCapture(event.pointerId);
          handlePointerEvent(event);
        }}
        onPointerMove={(event) => {
          if (isDragging.current) handlePointerEvent(event);
        }}
        onPointerUp={() => {
          isDragging.current = false;
          setIsScrubbing(false);
        }}
        onPointerCancel={() => {
          isDragging.current = false;
          setIsScrubbing(false);
        }}
        onPointerLeave={() => {
          if (!isDragging.current) return;
          isDragging.current = false;
          setIsScrubbing(false);
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
