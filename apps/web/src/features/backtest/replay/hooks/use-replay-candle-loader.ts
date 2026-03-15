"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { Time } from "lightweight-charts";
import { toast } from "sonner";

import type { CandleData } from "@/components/charts/trading-view-chart";
import { trpcClient } from "@/utils/trpc";

import type { BacktestTimeframe } from "../lib/replay-domain";
import { nearestCandleIndex, toDateTimeLocalValue } from "../lib/replay-utils";

export type ReplayFetchCandlesArgs = {
  symbol: string;
  timeframe: BacktestTimeframe;
  startDate: string;
  endDate: string;
  savedIndex?: number;
  savedTimeUnix?: number;
};

type UseReplayCandleLoaderArgs = {
  symbol: string;
  timeframe: BacktestTimeframe;
  startDate: string;
  endDate: string;
  requestRef: MutableRefObject<number>;
  setAllCandles: Dispatch<SetStateAction<CandleData[]>>;
  setCurrentIndex: Dispatch<SetStateAction<number>>;
  setGoToDateTime: Dispatch<SetStateAction<string>>;
  setIsLoadingCandles: Dispatch<SetStateAction<boolean>>;
};

export function useReplayCandleLoader({
  symbol,
  timeframe,
  startDate,
  endDate,
  requestRef,
  setAllCandles,
  setCurrentIndex,
  setGoToDateTime,
  setIsLoadingCandles,
}: UseReplayCandleLoaderArgs) {
  return useCallback(
    async (params?: ReplayFetchCandlesArgs) => {
      const query = params ?? {
        symbol,
        timeframe,
        startDate,
        endDate,
      };

      const requestId = ++requestRef.current;
      setIsLoadingCandles(true);

      try {
        const result = await trpcClient.marketData.fetchHistoricalCandles.query({
          symbol: query.symbol,
          timeframe: query.timeframe,
          from: query.startDate,
          to: query.endDate,
        });

        const candles: CandleData[] = result.candles.map((candle: any) => ({
          time: candle.time as Time,
          open: Number(candle.open),
          high: Number(candle.high),
          low: Number(candle.low),
          close: Number(candle.close),
          volume: Number(candle.volume || 0),
        }));

        if (requestId !== requestRef.current) {
          return candles;
        }

        setAllCandles(candles);

        let nextIndex = 0;
        if (candles.length > 0) {
          if (
            typeof query.savedTimeUnix === "number" &&
            Number.isFinite(query.savedTimeUnix)
          ) {
            nextIndex = nearestCandleIndex(candles, query.savedTimeUnix);
          } else {
            nextIndex = Math.min(
              query.savedIndex ?? Math.min(120, candles.length - 1),
              candles.length - 1
            );
          }
        }

        setCurrentIndex(nextIndex);
        setGoToDateTime(toDateTimeLocalValue(candles[nextIndex]?.time ?? null));
        return candles;
      } catch (error: any) {
        if (requestId !== requestRef.current) {
          return [];
        }

        console.error("Failed to fetch candles:", error);
        toast.error(error?.message || "Failed to fetch candles from Dukascopy");
        return [];
      } finally {
        if (requestId === requestRef.current) {
          setIsLoadingCandles(false);
        }
      }
    },
    [
      endDate,
      requestRef,
      setAllCandles,
      setCurrentIndex,
      setGoToDateTime,
      setIsLoadingCandles,
      startDate,
      symbol,
      timeframe,
    ]
  );
}
