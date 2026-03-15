"use client";

import type { Time, UTCTimestamp } from "lightweight-charts";
import type { CandleData } from "@/features/charts/trading-view/lib/trading-view-types";

export function serializeTime(time: Time): string {
  if (typeof time === "number" || typeof time === "string") {
    return String(time);
  }

  return `${time.year}-${time.month}-${time.day}`;
}

export function dateToChartTime(date: Date | string | number): UTCTimestamp {
  const normalized = new Date(date);
  return Math.floor(normalized.getTime() / 1000) as UTCTimestamp;
}

export function generateSampleCandles(
  startDate: Date,
  endDate: Date,
  openPrice: number,
  closePrice: number,
  options?: {
    volatility?: number;
    intervalMinutes?: number;
    mfePips?: number;
    maePips?: number;
    pipSize?: number;
  }
): CandleData[] {
  const {
    volatility = 0.001,
    intervalMinutes = 5,
    mfePips,
    maePips,
    pipSize = 0.0001,
  } = options || {};

  const candles: CandleData[] = [];
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  const intervalMs = intervalMinutes * 60 * 1000;
  const numCandles = Math.ceil((endTime - startTime) / intervalMs);

  if (numCandles <= 0) return [];

  const isLong = closePrice > openPrice;
  const peakPrice = mfePips
    ? isLong
      ? openPrice + mfePips * pipSize
      : openPrice - mfePips * pipSize
    : closePrice + (isLong ? 1 : -1) * Math.abs(closePrice - openPrice) * 0.3;
  const troughPrice = maePips
    ? isLong
      ? openPrice - maePips * pipSize
      : openPrice + maePips * pipSize
    : openPrice + (isLong ? -1 : 1) * Math.abs(closePrice - openPrice) * 0.2;

  let currentPrice = openPrice;

  for (let index = 0; index <= numCandles; index += 1) {
    const progress = index / numCandles;
    const time = new Date(startTime + index * intervalMs);

    let targetPrice: number;
    if (progress < 0.2) {
      const drawdownProgress = progress / 0.2;
      targetPrice = openPrice + (troughPrice - openPrice) * drawdownProgress;
    } else if (progress < 0.6) {
      const peakProgress = (progress - 0.2) / 0.4;
      targetPrice = troughPrice + (peakPrice - troughPrice) * peakProgress;
    } else {
      const closeProgress = (progress - 0.6) / 0.4;
      targetPrice = peakPrice + (closePrice - peakPrice) * closeProgress;
    }

    const noise = (Math.random() - 0.5) * 2 * volatility * openPrice;
    const candleOpen = currentPrice;
    const candleClose = targetPrice + noise;
    const candleHigh =
      Math.max(candleOpen, candleClose) + Math.random() * volatility * openPrice;
    const candleLow =
      Math.min(candleOpen, candleClose) - Math.random() * volatility * openPrice;

    candles.push({
      time: dateToChartTime(time),
      open: candleOpen,
      high: candleHigh,
      low: candleLow,
      close: candleClose,
      volume: Math.floor(Math.random() * 1000) + 100,
    });

    currentPrice = candleClose;
  }

  return candles;
}
