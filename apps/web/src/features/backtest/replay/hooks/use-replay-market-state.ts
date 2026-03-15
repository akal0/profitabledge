"use client";

import { useMemo } from "react";
import type { Time } from "lightweight-charts";

import type {
  CandleData,
  ChartAnnotation,
} from "@/components/charts/trading-view-chart";
import type {
  BacktestPendingOrder,
  BacktestTimeframe,
  BacktestTrade,
  ChallengeConfig,
  ContextPaneMode,
  ContextPaneSeriesItem,
  IndicatorSettings,
  ReplayNewsEvent,
  ReplaySimulationConfig,
} from "@/features/backtest/replay/lib/replay-domain";
import { LAST_CONTEXT_CANDLE_COUNT } from "@/features/backtest/replay/lib/replay-domain";
import {
  formatPrice,
  getEntryUnix,
  getEventImpactMultiplier,
  getExitUnix,
  getIntrabarPath,
  getIntrabarTraceForCandle,
  getSessionExecutionMultiplier,
  getSwapDays,
  getSymbolDisplayName,
  getSymbolExecutionProfile,
  getTimeframeCompactLabel,
  nearestCandleIndex,
  parseUnitsInput,
  round,
} from "@/features/backtest/replay/lib/replay-utils";
import { atr, bollingerBands, ema, macd, rsi, sma } from "@/lib/indicators";

export function useReplayMarketState({
  activeContextTimeframes,
  allCandles,
  annotations,
  barMagnifierCandles,
  calendarEvents,
  challengeConfig,
  contextCandles,
  contextPaneModes,
  currentIndex,
  defaultSLPips,
  defaultTPPips,
  entryMode,
  indicators,
  initialBalance,
  pendingOrders,
  pipSize,
  riskPercent,
  selectedAnnotationId,
  showSLTP,
  simulationConfig,
  symbol,
  ticketPrice,
  ticketUnits,
  timeframe,
  trades,
  calculatePnL,
  calculatePips,
}: {
  activeContextTimeframes: BacktestTimeframe[];
  allCandles: CandleData[];
  annotations: ChartAnnotation[];
  barMagnifierCandles: CandleData[];
  calendarEvents: ReplayNewsEvent[];
  challengeConfig: ChallengeConfig;
  contextCandles: Partial<Record<BacktestTimeframe, CandleData[]>>;
  contextPaneModes: Partial<Record<BacktestTimeframe, ContextPaneMode>>;
  currentIndex: number;
  defaultSLPips: number;
  defaultTPPips: number;
  entryMode: "market" | "limit" | "stop" | "stop-limit";
  indicators: IndicatorSettings;
  initialBalance: number;
  pendingOrders: BacktestPendingOrder[];
  pipSize: number;
  riskPercent: number;
  selectedAnnotationId: string | null;
  showSLTP: boolean;
  simulationConfig: ReplaySimulationConfig;
  symbol: string;
  ticketPrice: string;
  ticketUnits: string;
  timeframe: BacktestTimeframe;
  trades: BacktestTrade[];
  calculatePnL: (trade: BacktestTrade, price: number) => number;
  calculatePips: (trade: BacktestTrade, price: number) => number;
}) {
  const visibleCandles = useMemo(
    () => allCandles.slice(0, currentIndex + 1),
    [allCandles, currentIndex]
  );

  const currentCandle = visibleCandles[visibleCandles.length - 1];
  const currentPrice = currentCandle?.close ?? 0;
  const currentTime = (currentCandle?.time ?? 0) as Time;
  const currentTimeUnix = Number(currentTime || 0);

  const currentIntrabarTrace = useMemo(() => {
    if (!currentCandle) return [];
    return simulationConfig.intrabarMode === "bar-magnifier"
      ? getIntrabarTraceForCandle(currentCandle, timeframe, barMagnifierCandles)
      : getIntrabarPath(currentCandle);
  }, [barMagnifierCandles, currentCandle, simulationConfig.intrabarMode, timeframe]);

  const executionEnvironment = useMemo(() => {
    const profile = getSymbolExecutionProfile(symbol);
    const sessionProfile = getSessionExecutionMultiplier(
      currentTimeUnix || Math.floor(Date.now() / 1000)
    );
    const eventProfile = getEventImpactMultiplier(calendarEvents, currentTimeUnix);

    return {
      spread:
        profile.baseSpread * sessionProfile.spread * eventProfile.spread,
      slippagePips:
        profile.slippagePips * sessionProfile.slippage * eventProfile.slippage,
      commissionPerLot: profile.commissionPerLot,
      swapPerDayPerLot: profile.swapPerDayPerLot,
      liquidityUnits:
        profile.sessionLiquidityUnits *
        sessionProfile.liquidity *
        eventProfile.liquidity,
      sessionLabel: eventProfile.event ?? sessionProfile.session,
    };
  }, [calendarEvents, currentTimeUnix, symbol]);

  const replayTrades = useMemo(() => {
    return trades
      .filter((trade) => getEntryUnix(trade) <= currentTimeUnix)
      .map((trade) => {
        const exitUnix = getExitUnix(trade);
        if (exitUnix && exitUnix <= currentTimeUnix) {
          return trade;
        }

        const accruedSwap =
          (trade.swap || 0) +
          getSwapDays(getEntryUnix(trade), currentTimeUnix) *
            (executionEnvironment.swapPerDayPerLot * trade.volume);
        const livePnl = currentPrice
          ? calculatePnL(trade, currentPrice) - (trade.fees || 0) - accruedSwap
          : 0;
        const livePips = currentPrice ? calculatePips(trade, currentPrice) : 0;

        return {
          ...trade,
          status: "open" as const,
          exitPrice: undefined,
          exitTime: undefined,
          exitTimeUnix: undefined,
          pnl: livePnl,
          pnlPips: livePips,
          realizedRR:
            trade.slPips && trade.slPips > 0
              ? livePips / trade.slPips
              : undefined,
          swap: accruedSwap,
        };
      });
  }, [
    calculatePips,
    calculatePnL,
    currentPrice,
    currentTimeUnix,
    executionEnvironment.swapPerDayPerLot,
    trades,
  ]);

  const openTrades = useMemo(
    () => replayTrades.filter((trade) => trade.status === "open"),
    [replayTrades]
  );

  const replayPendingOrders = useMemo(
    () =>
      pendingOrders.filter(
        (order) =>
          order.createdAtUnix <= currentTimeUnix &&
          (!order.filledAtUnix || order.filledAtUnix > currentTimeUnix) &&
          (!order.cancelledAtUnix || order.cancelledAtUnix > currentTimeUnix)
      ),
    [currentTimeUnix, pendingOrders]
  );

  const closedTrades = useMemo(
    () => replayTrades.filter((trade) => trade.status !== "open"),
    [replayTrades]
  );

  const realizedPnL = useMemo(
    () => closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0),
    [closedTrades]
  );
  const openPnL = useMemo(
    () => openTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0),
    [openTrades]
  );
  const cashBalance = initialBalance + realizedPnL;
  const equity = cashBalance + openPnL;

  const openRisk = useMemo(
    () =>
      openTrades.reduce((sum, trade) => {
        if (!trade.sl) return sum;
        return sum + Math.abs(calculatePnL(trade, trade.sl));
      }, 0),
    [calculatePnL, openTrades]
  );

  const stats = useMemo(() => {
    const wins = closedTrades.filter((trade) => (trade.pnl || 0) > 0);
    const losses = closedTrades.filter((trade) => (trade.pnl || 0) < 0);
    const totalWins = wins.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const totalLosses = Math.abs(
      losses.reduce((sum, trade) => sum + (trade.pnl || 0), 0)
    );
    const rrValues = closedTrades
      .map((trade) => trade.realizedRR)
      .filter((value): value is number => typeof value === "number");
    const avgRR =
      rrValues.length > 0
        ? rrValues.reduce((sum, value) => sum + value, 0) / rrValues.length
        : 0;
    const noteCoverage =
      replayTrades.length > 0
        ? replayTrades.filter((trade) => trade.notes?.trim()).length /
          replayTrades.length
        : 0;
    const structureRate =
      replayTrades.length > 0
        ? replayTrades.filter((trade) => trade.sl && trade.tp).length /
          replayTrades.length
        : 0;
    const rrPlannedRate =
      replayTrades.length > 0
        ? replayTrades.filter(
            (trade) =>
              typeof trade.slPips === "number" &&
              typeof trade.tpPips === "number" &&
              trade.slPips > 0 &&
              trade.tpPips / trade.slPips >= 1.5
          ).length / replayTrades.length
        : 0;
    const processScore = Math.round(
      (noteCoverage * 35 + structureRate * 35 + rrPlannedRate * 30) * 100
    );

    return {
      total: closedTrades.length,
      wins: wins.length,
      losses: losses.length,
      winRate:
        closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0,
      profitFactor:
        totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
      avgRR,
      noteCoverage,
      structureRate,
      processScore,
      averageHoldTime:
        closedTrades.length > 0
          ? closedTrades.reduce(
              (sum, trade) => sum + (trade.holdTimeSeconds || 0),
              0
            ) / closedTrades.length
          : 0,
    };
  }, [closedTrades, replayTrades]);

  const challengeStatus = useMemo(() => {
    let runningBalance = initialBalance;
    let peakBalance = initialBalance;
    let maxHistoricalDrawdownPct = 0;

    const orderedClosedTrades = [...closedTrades].sort(
      (left, right) =>
        (getExitUnix(left) || getEntryUnix(left)) -
        (getExitUnix(right) || getEntryUnix(right))
    );

    orderedClosedTrades.forEach((trade) => {
      runningBalance += trade.pnl || 0;
      peakBalance = Math.max(peakBalance, runningBalance);
      const drawdownPct =
        peakBalance > 0
          ? ((peakBalance - runningBalance) / peakBalance) * 100
          : 0;
      maxHistoricalDrawdownPct = Math.max(
        maxHistoricalDrawdownPct,
        drawdownPct
      );
    });

    const currentDrawdownPct =
      peakBalance > 0 ? ((peakBalance - equity) / peakBalance) * 100 : 0;

    const currentDayKey = currentTimeUnix
      ? new Date(currentTimeUnix * 1000).toISOString().slice(0, 10)
      : null;
    const closedWithExit = closedTrades.filter((trade) => getExitUnix(trade));
    const dayStartBalance =
      currentDayKey === null
        ? initialBalance
        : initialBalance +
          closedWithExit
            .filter((trade) => {
              const exitUnix = getExitUnix(trade);
              return exitUnix
                ? new Date(exitUnix * 1000).toISOString().slice(0, 10) <
                    currentDayKey
                : false;
            })
            .reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const dayClosedPnL =
      currentDayKey === null
        ? 0
        : closedWithExit
            .filter((trade) => {
              const exitUnix = getExitUnix(trade);
              return exitUnix
                ? new Date(exitUnix * 1000).toISOString().slice(0, 10) ===
                    currentDayKey
                : false;
            })
            .reduce((sum, trade) => sum + (trade.pnl || 0), 0);

    const dayPnL = dayClosedPnL + openPnL;
    const dailyLossPct =
      dayStartBalance > 0 && dayPnL < 0
        ? Math.abs(dayPnL / dayStartBalance) * 100
        : 0;
    const profitPct = ((equity - initialBalance) / initialBalance) * 100;

    const profitTargetReached =
      challengeConfig.profitTargetPct > 0 &&
      profitPct >= challengeConfig.profitTargetPct;
    const maxDrawdownBreached =
      challengeConfig.maxDrawdownPct > 0 &&
      currentDrawdownPct >= challengeConfig.maxDrawdownPct;
    const dailyLossBreached =
      challengeConfig.dailyLossPct > 0 &&
      dailyLossPct >= challengeConfig.dailyLossPct;

    return {
      profitPct,
      currentDrawdownPct: Math.max(0, currentDrawdownPct),
      maxHistoricalDrawdownPct,
      dailyLossPct,
      dayPnL,
      profitTargetReached,
      maxDrawdownBreached,
      dailyLossBreached,
      challengeLocked:
        challengeConfig.enforce &&
        (profitTargetReached || maxDrawdownBreached || dailyLossBreached),
    };
  }, [challengeConfig, closedTrades, currentTimeUnix, equity, initialBalance, openPnL]);

  const selectedAnnotation = useMemo(
    () =>
      annotations.find((annotation) => annotation.id === selectedAnnotationId) ??
      null,
    [annotations, selectedAnnotationId]
  );

  const tradeSizer = useMemo(() => {
    const riskAmount = cashBalance * (riskPercent / 100);
    const lotSize =
      showSLTP && defaultSLPips > 0
        ? Math.max(0.01, round(riskAmount / (defaultSLPips * 10), 2))
        : 0;

    return {
      riskAmount,
      lotSize,
      targetAtTP:
        showSLTP && defaultTPPips > 0
          ? round((defaultTPPips * lotSize * 10) || 0, 2)
          : 0,
    };
  }, [cashBalance, defaultSLPips, defaultTPPips, riskPercent, showSLTP]);

  const calculatedIndicators = useMemo(() => {
    if (visibleCandles.length < 50) return {};

    const candleData = visibleCandles.map((candle) => ({
      time: candle.time as number,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }));

    return {
      sma1: indicators.sma1.enabled ? sma(candleData, indicators.sma1.period) : [],
      sma2: indicators.sma2.enabled ? sma(candleData, indicators.sma2.period) : [],
      ema1: indicators.ema1.enabled ? ema(candleData, indicators.ema1.period) : [],
      rsi: indicators.rsi.enabled ? rsi(candleData, indicators.rsi.period) : [],
      macd: indicators.macd.enabled
        ? macd(
            candleData,
            indicators.macd.fastPeriod,
            indicators.macd.slowPeriod,
            indicators.macd.signalPeriod
          )
        : [],
      bb: indicators.bb.enabled
        ? bollingerBands(candleData, indicators.bb.period, indicators.bb.stdDev)
        : [],
      atr: indicators.atr.enabled ? atr(candleData, indicators.atr.period) : [],
    };
  }, [indicators, visibleCandles]);

  const bidPrice = currentPrice
    ? Math.max(0, currentPrice - executionEnvironment.spread / 2)
    : 0;
  const askPrice = currentPrice
    ? currentPrice + executionEnvironment.spread / 2
    : 0;
  const defaultUnits = Math.max(
    1000,
    Math.round(Math.max(tradeSizer.lotSize, 0.01) * 100000)
  );
  const effectiveTicketPrice =
    ticketPrice ||
    formatPrice(symbol, entryMode === "market" ? currentPrice || 0 : currentPrice || 0);
  const effectiveTicketUnits = ticketUnits || String(defaultUnits);
  const parsedUnits = parseUnitsInput(effectiveTicketUnits);
  const effectiveUnitsNumber = Number.isFinite(parsedUnits)
    ? parsedUnits
    : defaultUnits;
  const effectiveVolume = Math.max(0.01, round(effectiveUnitsNumber / 100000, 2));
  const effectivePriceNumber =
    Number.isFinite(Number(effectiveTicketPrice)) && Number(effectiveTicketPrice) > 0
      ? Number(effectiveTicketPrice)
      : currentPrice || 0;
  const estimatedTradeValue = effectiveUnitsNumber * effectivePriceNumber;
  const estimatedMargin = estimatedTradeValue / 50;
  const availableFunds = Math.max(0, equity - openRisk);
  const estimatedTargetAtTP =
    showSLTP && defaultTPPips > 0 ? round(defaultTPPips * effectiveVolume * 10, 2) : 0;

  const domLevels = useMemo(() => {
    if (!currentPrice) return [];

    const increment = pipSize * (symbol.includes("XAU") ? 5 : 2);
    return Array.from({ length: 17 }, (_, index) => {
      const offset = 8 - index;
      const price = currentPrice + offset * increment;
      const matchingOrders = replayPendingOrders.filter(
        (order) => Math.abs(order.entryPrice - price) <= increment / 2
      );

      return {
        price,
        isAsk: Math.abs(price - askPrice) <= increment / 2,
        isBid: Math.abs(price - bidPrice) <= increment / 2,
        matchingOrders,
      };
    }).sort((left, right) => right.price - left.price);
  }, [askPrice, bidPrice, currentPrice, pipSize, replayPendingOrders, symbol]);

  const contextPaneSeries = useMemo<ContextPaneSeriesItem[]>(() => {
    return activeContextTimeframes
      .map((contextTimeframe) => {
        const candles = contextCandles[contextTimeframe] || [];
        if (candles.length === 0 || !currentTimeUnix) return null;

        const index = nearestCandleIndex(candles, currentTimeUnix);
        const mode = contextPaneModes[contextTimeframe] ?? "recent";
        const startIndex =
          mode === "full"
            ? 0
            : mode === "last"
              ? Math.max(0, index - (LAST_CONTEXT_CANDLE_COUNT - 1))
              : Math.max(0, index - 80);

        return {
          timeframe: contextTimeframe,
          label: getTimeframeCompactLabel(contextTimeframe),
          mode,
          candles: candles.slice(startIndex, index + 1),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [activeContextTimeframes, contextCandles, contextPaneModes, currentTimeUnix]);

  const headerProgress =
    allCandles.length > 0 ? ((currentIndex + 1) / allCandles.length) * 100 : 0;
  const timeframeCompactLabel = getTimeframeCompactLabel(timeframe);
  const symbolDisplayName = getSymbolDisplayName(symbol);
  const currentBias = currentCandle
    ? currentCandle.close >= currentCandle.open
      ? "Bull candle"
      : "Bear candle"
    : "No data";
  const priceDecimals = symbol.includes("JPY") || symbol.includes("XAU") ? 3 : 5;
  const currentCandleDelta = currentCandle ? currentCandle.close - currentCandle.open : 0;
  const currentCandleDeltaPct =
    currentCandle && currentCandle.open !== 0
      ? (currentCandleDelta / currentCandle.open) * 100
      : 0;
  const challengeHelper =
    challengeConfig.profitTargetPct > 0
      ? `${challengeStatus.profitPct.toFixed(1)}% / ${challengeConfig.profitTargetPct}% target`
      : "No challenge target";

  return {
    askPrice,
    availableFunds,
    bidPrice,
    calculatedIndicators,
    cashBalance,
    challengeHelper,
    challengeStatus,
    closedTrades,
    contextPaneSeries,
    currentBias,
    currentCandle,
    currentCandleDelta,
    currentCandleDeltaPct,
    currentIntrabarTrace,
    currentPrice,
    currentTime,
    currentTimeUnix,
    domLevels,
    effectivePriceNumber,
    effectiveTicketPrice,
    effectiveTicketUnits,
    effectiveUnitsNumber,
    effectiveVolume,
    equity,
    estimatedMargin,
    estimatedTargetAtTP,
    estimatedTradeValue,
    executionEnvironment,
    headerProgress,
    openPnL,
    openRisk,
    openTrades,
    priceDecimals,
    realizedPnL,
    replayPendingOrders,
    replayTrades,
    selectedAnnotation,
    stats,
    symbolDisplayName,
    timeframeCompactLabel,
    tradeSizer,
    visibleCandles,
  };
}
