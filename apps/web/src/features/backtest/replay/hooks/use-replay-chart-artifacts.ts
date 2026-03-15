"use client";

import { useMemo } from "react";
import type { Time } from "lightweight-charts";
import type {
  BollingerBandsResult,
  IndicatorPoint,
  MACDResult,
} from "@/lib/indicators";
import type {
  ExecutionOverlay,
  IndicatorLine,
  PriceLine,
  TradeMarker,
} from "@/components/charts/trading-view-chart";
import type {
  BacktestPendingOrder,
  BacktestTimeframe,
  BacktestTrade,
  IndicatorSettings,
} from "@/features/backtest/replay/lib/replay-domain";
import { getTimeframeCompactLabel, nearestCandleIndex } from "@/features/backtest/replay/lib/replay-utils";
import type { CandleData } from "@/components/charts/trading-view-chart";

type ReplayCalculatedIndicators = {
  sma1?: IndicatorPoint[];
  sma2?: IndicatorPoint[];
  ema1?: IndicatorPoint[];
  rsi?: IndicatorPoint[];
  macd?: MACDResult[];
  bb?: BollingerBandsResult[];
  atr?: IndicatorPoint[];
};

type ReplayContextSnapshot = {
  timeframe: BacktestTimeframe;
  label: string;
  bias: "Bull" | "Bear";
  close: number;
  deltaPct: number;
};

export function useReplayChartArtifacts({
  indicators,
  calculatedIndicators,
  activeContextTimeframes,
  contextCandles,
  currentTimeUnix,
  replayTrades,
  replayPendingOrders,
  openTrades,
  currentTime,
  visibleCandles,
  isTradeHistoricallyClosed,
}: {
  indicators: IndicatorSettings;
  calculatedIndicators: ReplayCalculatedIndicators;
  activeContextTimeframes: BacktestTimeframe[];
  contextCandles: Partial<Record<BacktestTimeframe, CandleData[]>>;
  currentTimeUnix: number;
  replayTrades: BacktestTrade[];
  replayPendingOrders: BacktestPendingOrder[];
  openTrades: BacktestTrade[];
  currentTime: Time;
  visibleCandles: CandleData[];
  isTradeHistoricallyClosed: (tradeId: string) => boolean;
}) {
  const latestIndicators = useMemo(() => {
    const latest: Record<string, number> = {};
    const lastSma1 = calculatedIndicators.sma1?.[calculatedIndicators.sma1.length - 1];
    const lastSma2 = calculatedIndicators.sma2?.[calculatedIndicators.sma2.length - 1];
    const lastEma1 = calculatedIndicators.ema1?.[calculatedIndicators.ema1.length - 1];
    const lastRsi = calculatedIndicators.rsi?.[calculatedIndicators.rsi.length - 1];
    const lastMacd = calculatedIndicators.macd?.[calculatedIndicators.macd.length - 1];
    const lastAtr = calculatedIndicators.atr?.[calculatedIndicators.atr.length - 1];
    const lastBb = calculatedIndicators.bb?.[calculatedIndicators.bb.length - 1];

    if (lastSma1?.value != null) latest.sma1 = lastSma1.value;
    if (lastSma2?.value != null) latest.sma2 = lastSma2.value;
    if (lastEma1?.value != null) latest.ema1 = lastEma1.value;
    if (lastRsi?.value != null) latest.rsi = lastRsi.value;
    if (lastMacd) {
      latest.macd = lastMacd.macd;
      latest.macdSignal = lastMacd.signal;
      latest.macdHist = lastMacd.histogram;
    }
    if (lastAtr?.value != null) latest.atr = lastAtr.value;
    if (lastBb) {
      latest.bbUpper = lastBb.upper;
      latest.bbMiddle = lastBb.middle;
      latest.bbLower = lastBb.lower;
    }

    return latest;
  }, [calculatedIndicators]);

  const indicatorLines = useMemo<IndicatorLine[]>(() => {
    const lines: IndicatorLine[] = [];

    if (indicators.sma1.enabled && calculatedIndicators.sma1?.length) {
      lines.push({
        id: "sma1",
        data: calculatedIndicators.sma1
          .filter((item): item is { time: number; value: number } => item.value != null)
          .map((item) => ({ time: item.time as Time, value: item.value })),
        color: indicators.sma1.color,
        lineWidth: 2,
        title: `SMA ${indicators.sma1.period}`,
      });
    }

    if (indicators.sma2.enabled && calculatedIndicators.sma2?.length) {
      lines.push({
        id: "sma2",
        data: calculatedIndicators.sma2
          .filter((item): item is { time: number; value: number } => item.value != null)
          .map((item) => ({ time: item.time as Time, value: item.value })),
        color: indicators.sma2.color,
        lineWidth: 2,
        title: `SMA ${indicators.sma2.period}`,
      });
    }

    if (indicators.ema1.enabled && calculatedIndicators.ema1?.length) {
      lines.push({
        id: "ema1",
        data: calculatedIndicators.ema1
          .filter((item): item is { time: number; value: number } => item.value != null)
          .map((item) => ({ time: item.time as Time, value: item.value })),
        color: indicators.ema1.color,
        lineWidth: 2,
        title: `EMA ${indicators.ema1.period}`,
      });
    }

    if (indicators.bb.enabled && calculatedIndicators.bb?.length) {
      const data = calculatedIndicators.bb.filter(
        (
          item
        ): item is { time: number; upper: number; middle: number; lower: number } =>
          item.upper != null && item.middle != null && item.lower != null
      );

      lines.push(
        {
          id: "bb-upper",
          data: data.map((item) => ({ time: item.time as Time, value: item.upper })),
          color: "#A855F7",
          lineWidth: 1,
          lineStyle: "dashed",
          title: "BB Upper",
        },
        {
          id: "bb-middle",
          data: data.map((item) => ({ time: item.time as Time, value: item.middle })),
          color: "#A855F7",
          lineWidth: 1,
          title: "BB Mid",
        },
        {
          id: "bb-lower",
          data: data.map((item) => ({ time: item.time as Time, value: item.lower })),
          color: "#A855F7",
          lineWidth: 1,
          lineStyle: "dashed",
          title: "BB Lower",
        }
      );
    }

    return lines;
  }, [calculatedIndicators, indicators]);

  const contextSnapshots = useMemo<ReplayContextSnapshot[]>(() => {
    return activeContextTimeframes
      .map((contextTimeframe) => {
        const candles = contextCandles[contextTimeframe] || [];
        if (!candles.length || !currentTimeUnix) return null;

        const index = nearestCandleIndex(candles, currentTimeUnix);
        const candle = candles[index];
        if (!candle) return null;

        const previous = candles[Math.max(0, index - 1)];
        const deltaPct =
          previous?.close && previous.close !== 0
            ? ((candle.close - previous.close) / previous.close) * 100
            : 0;

        return {
          timeframe: contextTimeframe,
          label: getTimeframeCompactLabel(contextTimeframe),
          bias: candle.close >= candle.open ? "Bull" : "Bear",
          close: candle.close,
          deltaPct,
        };
      })
      .filter((item): item is ReplayContextSnapshot => Boolean(item));
  }, [activeContextTimeframes, contextCandles, currentTimeUnix]);

  const markers = useMemo<TradeMarker[]>(() => {
    const result: TradeMarker[] = [];

    replayTrades.forEach((trade) => {
      result.push({
        time: trade.entryTime,
        position: trade.direction === "long" ? "belowBar" : "aboveBar",
        color: trade.direction === "long" ? "#14B8A6" : "#FB7185",
        shape: trade.direction === "long" ? "arrowUp" : "arrowDown",
        size: 0.6,
      });

      if (trade.status !== "open" && trade.exitTime) {
        result.push({
          time: trade.exitTime,
          position:
            trade.status === "stopped"
              ? trade.direction === "long"
                ? "belowBar"
                : "aboveBar"
              : trade.direction === "long"
                ? "aboveBar"
                : "belowBar",
          color:
            trade.status === "target"
              ? "#14B8A6"
              : trade.status === "stopped"
                ? "#FB7185"
                : "#94A3B8",
          shape: "circle",
          size: 0.6,
        });
      }
    });

    return result;
  }, [replayTrades]);

  const priceLines = useMemo<PriceLine[]>(() => {
    const lines: PriceLine[] = [];

    replayPendingOrders.forEach((order) => {
      if (order.orderType === "stop-limit" && order.triggerPrice) {
        lines.push({
          price: order.triggerPrice,
          color: "#C084FC",
          lineWidth: 1,
          lineStyle: "dotted",
          title: `${order.direction === "long" ? "BUY" : "SELL"} TRIGGER`,
          axisLabelVisible: false,
        });
      }

      lines.push({
        price: order.entryPrice,
        color: order.direction === "long" ? "#60A5FA" : "#F59E0B",
        lineWidth: 1,
        lineStyle: "dotted",
        title: `${order.direction === "long" ? "BUY" : "SELL"} ${order.orderType.toUpperCase()} ${Math.max(0, Math.round(order.remainingUnits ?? order.units)).toLocaleString()}`,
        axisLabelVisible: false,
      });

      if (order.sl) {
        lines.push({
          price: order.sl,
          color: "rgba(251,113,133,0.55)",
          lineWidth: 1,
          lineStyle: "dashed",
          title: "SL",
          axisLabelVisible: false,
        });
      }

      if (order.tp) {
        lines.push({
          price: order.tp,
          color: "rgba(20,184,166,0.55)",
          lineWidth: 1,
          lineStyle: "dashed",
          title: "TP",
          axisLabelVisible: false,
        });
      }
    });

    openTrades.forEach((trade) => {
      lines.push({
        price: trade.entryPrice,
        color: "rgba(255,255,255,0.45)",
        lineWidth: 1,
        lineStyle: "dashed",
        title: trade.direction === "long" ? "BUY" : "SELL",
        axisLabelVisible: false,
      });

      if (trade.sl) {
        lines.push({
          price: trade.sl,
          color: "#FB7185",
          lineWidth: 1,
          lineStyle: "dashed",
          title: "SL",
          axisLabelVisible: false,
        });
      }

      if (trade.tp) {
        lines.push({
          price: trade.tp,
          color: "#14B8A6",
          lineWidth: 1,
          lineStyle: "dashed",
          title: "TP",
          axisLabelVisible: false,
        });
      }
    });

    return lines;
  }, [openTrades, replayPendingOrders]);

  const executionOverlays = useMemo<ExecutionOverlay[]>(() => {
    const overlayEndTime =
      (currentTime || visibleCandles[visibleCandles.length - 1]?.time || 0) as Time;
    const overlays: ExecutionOverlay[] = [];

    replayPendingOrders.forEach((order) => {
      overlays.push({
        id: `order:${order.id}`,
        startTime: order.createdAt,
        endTime: overlayEndTime,
        labelTime: order.createdAt,
        direction: order.direction,
        pending: true,
        levels: {
          trigger:
            typeof order.triggerPrice === "number"
              ? {
                  price: order.triggerPrice,
                  color: "#C084FC",
                  label: "Trigger",
                  draggable: true,
                }
              : undefined,
          entry: {
            price: order.entryPrice,
            color: order.direction === "long" ? "#60A5FA" : "#F59E0B",
            label: `${order.direction === "long" ? "Buy" : "Sell"} ${order.orderType}`,
            draggable: true,
          },
          sl:
            typeof order.sl === "number"
              ? {
                  price: order.sl,
                  color: "#FB7185",
                  label: "SL",
                  draggable: true,
                }
              : undefined,
          tp:
            typeof order.tp === "number"
              ? {
                  price: order.tp,
                  color: "#14B8A6",
                  label: "TP",
                  draggable: true,
                }
              : undefined,
        },
      });
    });

    openTrades.forEach((trade) => {
      const tradeLocked = isTradeHistoricallyClosed(trade.id);
      overlays.push({
        id: `trade:${trade.id}`,
        startTime: trade.entryTime,
        endTime: overlayEndTime,
        labelTime: trade.entryTime,
        direction: trade.direction,
        levels: {
          entry: {
            price: trade.entryPrice,
            color: trade.direction === "long" ? "#14B8A6" : "#FB7185",
            label: trade.direction === "long" ? "Long entry" : "Short entry",
          },
          sl:
            typeof trade.sl === "number"
              ? {
                  price: trade.sl,
                  color: "#FB7185",
                  label: "SL",
                  draggable: !tradeLocked,
                }
              : undefined,
          tp:
            typeof trade.tp === "number"
              ? {
                  price: trade.tp,
                  color: "#14B8A6",
                  label: "TP",
                  draggable: !tradeLocked,
                }
              : undefined,
        },
      });
    });

    return overlays;
  }, [
    currentTime,
    isTradeHistoricallyClosed,
    openTrades,
    replayPendingOrders,
    visibleCandles,
  ]);

  return {
    latestIndicators,
    indicatorLines,
    contextSnapshots,
    markers,
    priceLines,
    executionOverlays,
  };
}
