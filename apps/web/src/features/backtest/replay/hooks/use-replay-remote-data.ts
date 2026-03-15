"use client";

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useEffect } from "react";
import type { Time } from "lightweight-charts";

import type { CandleData } from "@/components/charts/trading-view-chart";
import type {
  BacktestTimeframe,
  ReplayNewsEvent,
  ReplaySimulationConfig,
  RuleSetOption,
  RulebookCoachingResult,
} from "@/features/backtest/replay/lib/replay-domain";
import { getBarMagnifierTimeframe } from "@/features/backtest/replay/lib/replay-utils";
import { trpcClient } from "@/utils/trpc";

function mapHistoricalCandles(result: any): CandleData[] {
  return result.candles.map((candle: any) => ({
    time: candle.time as Time,
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
    volume: Number(candle.volume || 0),
  }));
}

export function useReplayRemoteData({
  activeContextTimeframes,
  barMagnifierRequestRef,
  contextRequestRef,
  endDate,
  linkedRuleSetId,
  sessionId,
  simulationConfig,
  startDate,
  symbol,
  timeframe,
  tradesLength,
  setBarMagnifierCandles,
  setBarMagnifierTimeframe,
  setCalendarEvents,
  setContextCandles,
  setIsLoadingRulebook,
  setRuleSets,
  setRulebookCoaching,
}: {
  activeContextTimeframes: BacktestTimeframe[];
  barMagnifierRequestRef: MutableRefObject<number>;
  contextRequestRef: MutableRefObject<number>;
  endDate: string;
  linkedRuleSetId: string | null;
  sessionId: string | null;
  simulationConfig: ReplaySimulationConfig;
  startDate: string;
  symbol: string;
  timeframe: BacktestTimeframe;
  tradesLength: number;
  setBarMagnifierCandles: Dispatch<SetStateAction<CandleData[]>>;
  setBarMagnifierTimeframe: Dispatch<SetStateAction<BacktestTimeframe | null>>;
  setCalendarEvents: Dispatch<SetStateAction<ReplayNewsEvent[]>>;
  setContextCandles: Dispatch<
    SetStateAction<Partial<Record<BacktestTimeframe, CandleData[]>>>
  >;
  setIsLoadingRulebook: Dispatch<SetStateAction<boolean>>;
  setRuleSets: Dispatch<SetStateAction<RuleSetOption[]>>;
  setRulebookCoaching: Dispatch<SetStateAction<RulebookCoachingResult | null>>;
}) {
  useEffect(() => {
    if (activeContextTimeframes.length === 0) {
      setContextCandles({});
      return;
    }

    const requestId = ++contextRequestRef.current;

    void Promise.all(
      activeContextTimeframes.map(async (contextTimeframe) => {
        const result = await trpcClient.marketData.fetchHistoricalCandles.query({
          symbol,
          timeframe: contextTimeframe,
          from: startDate,
          to: endDate,
        });

        return [contextTimeframe, mapHistoricalCandles(result)] as const;
      })
    )
      .then((entries) => {
        if (requestId !== contextRequestRef.current) return;
        setContextCandles(
          Object.fromEntries(entries) as Partial<
            Record<BacktestTimeframe, CandleData[]>
          >
        );
      })
      .catch((error) => {
        if (requestId !== contextRequestRef.current) return;
        console.error("Failed to fetch context candles:", error);
        setContextCandles({});
      });
  }, [
    activeContextTimeframes,
    contextRequestRef,
    endDate,
    setContextCandles,
    startDate,
    symbol,
  ]);

  useEffect(() => {
    let cancelled = false;

    void trpcClient.rules.listRuleSets
      .query()
      .then((result: any[]) => {
        if (cancelled) return;
        setRuleSets(
          result.map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setRuleSets([]);
      });

    return () => {
      cancelled = true;
    };
  }, [setRuleSets]);

  useEffect(() => {
    const magnifierTimeframe =
      simulationConfig.intrabarMode === "bar-magnifier"
        ? getBarMagnifierTimeframe(timeframe)
        : null;

    if (!magnifierTimeframe) {
      setBarMagnifierTimeframe(null);
      setBarMagnifierCandles([]);
      return;
    }

    const requestId = ++barMagnifierRequestRef.current;
    setBarMagnifierTimeframe(magnifierTimeframe);

    void trpcClient.marketData.fetchHistoricalCandles
      .query({
        symbol,
        timeframe: magnifierTimeframe,
        from: startDate,
        to: endDate,
      })
      .then((result: any) => {
        if (requestId !== barMagnifierRequestRef.current) return;
        setBarMagnifierCandles(mapHistoricalCandles(result));
      })
      .catch((error: unknown) => {
        if (requestId !== barMagnifierRequestRef.current) return;
        console.error("Failed to fetch bar magnifier candles:", error);
        setBarMagnifierCandles([]);
      });
  }, [
    barMagnifierRequestRef,
    endDate,
    setBarMagnifierCandles,
    setBarMagnifierTimeframe,
    simulationConfig.intrabarMode,
    startDate,
    symbol,
    timeframe,
  ]);

  useEffect(() => {
    if (!sessionId || !linkedRuleSetId) {
      setRulebookCoaching(null);
      return;
    }

    let cancelled = false;
    setIsLoadingRulebook(true);

    void trpcClient.backtest
      .getRulebookCoaching
      .query({
        sessionId,
        ruleSetId: linkedRuleSetId,
      })
      .then((result) => {
        if (cancelled) return;
        setRulebookCoaching(result as RulebookCoachingResult);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("Failed to load rulebook coaching:", error);
        setRulebookCoaching(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRulebook(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    linkedRuleSetId,
    sessionId,
    setIsLoadingRulebook,
    setRulebookCoaching,
    tradesLength,
  ]);

  useEffect(() => {
    let cancelled = false;

    void fetch(`/api/economic-calendar?start=${startDate}&end=${endDate}`)
      .then(async (response) => {
        if (!response.ok) return [];
        return (await response.json()) as Array<Record<string, unknown>>;
      })
      .then((payload) => {
        if (cancelled || !Array.isArray(payload)) return;
        const mappedEvents = payload
          .map((event, index): ReplayNewsEvent | null => {
            const timeUnix = Math.floor(
              new Date(String(event.date || "")).getTime() / 1000
            );
            if (!Number.isFinite(timeUnix)) return null;
            return {
              id: `news-${index}-${timeUnix}`,
              title: String(event.title || "Economic event"),
              country: String(event.country || "Global"),
              date: String(event.date || ""),
              timeUnix,
              impact: String(event.impact || "Low") as ReplayNewsEvent["impact"],
              actual: typeof event.actual === "string" ? event.actual : null,
              forecast:
                typeof event.forecast === "string" ? event.forecast : null,
              previous:
                typeof event.previous === "string" ? event.previous : null,
            };
          })
          .filter((event): event is ReplayNewsEvent => event !== null);

        setCalendarEvents(mappedEvents);
      })
      .catch(() => {
        if (!cancelled) setCalendarEvents([]);
      });

    return () => {
      cancelled = true;
    };
  }, [endDate, setCalendarEvents, startDate]);
}
