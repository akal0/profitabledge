import { useCallback, useEffect } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { Time } from "lightweight-charts";
import { toast } from "sonner";

import type {
  BacktestPendingOrder,
  BacktestTrade,
  TimeInForce,
} from "../lib/replay-domain";
import {
  clamp,
  formatPrice,
  getEntryUnix,
  getExitUnix,
  getSwapDays,
  getTimeInForceExpiryUnix,
  parseTags,
  parseUnitsInput,
  resolvePathHitOrder,
  round,
} from "../lib/replay-utils";
import { trpcClient } from "@/utils/trpc";

type ExecutionEnvironment = {
  slippagePips: number;
  swapPerDayPerLot: number;
  commissionPerLot: number;
  spread: number;
  liquidityUnits: number;
};

type LatestIndicators = {
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  atr?: number;
  sma1?: number;
  sma2?: number;
  ema1?: number;
  bbUpper?: number;
  bbMiddle?: number;
  bbLower?: number;
};

type ReplayTradeDrafts = Record<string, { sl: string; tp: string }>;

type UseReplayTradeEngineInput = {
  sessionId: string | null;
  symbol: string;
  currentCandle: { high: number; low: number; volume?: number | null } | null;
  currentTime: Time;
  currentTimeUnix: number;
  currentPrice: number;
  pipSize: number;
  showSLTP: boolean;
  defaultSLPips: number;
  defaultTPPips: number;
  entryMode: "market" | "limit" | "stop" | "stop-limit";
  ticketPrice: string;
  ticketSecondaryPrice: string;
  ticketUnits: string;
  timeInForce: TimeInForce;
  ocoEnabled: boolean;
  riskPercent: number;
  nextTradeNotes: string;
  nextTradeTags: string;
  challengeLocked: boolean;
  cashBalance: number;
  tradeSizerLotSize: number;
  executionEnvironment: ExecutionEnvironment;
  latestIndicators: LatestIndicators;
  trades: BacktestTrade[];
  openTrades: BacktestTrade[];
  replayPendingOrders: BacktestPendingOrder[];
  tradeDrafts: ReplayTradeDrafts;
  currentIntrabarTrace: number[];
  tradeMfeRef: MutableRefObject<Record<string, number>>;
  tradeMaeRef: MutableRefObject<Record<string, number>>;
  pendingOrderProcessingRef: MutableRefObject<Set<string>>;
  setTrades: Dispatch<SetStateAction<BacktestTrade[]>>;
  setPendingOrders: Dispatch<SetStateAction<BacktestPendingOrder[]>>;
  setTradeDrafts: Dispatch<SetStateAction<ReplayTradeDrafts>>;
  setNextTradeNotes: Dispatch<SetStateAction<string>>;
  setNextTradeTags: Dispatch<SetStateAction<string>>;
  setEntryMode: Dispatch<
    SetStateAction<"market" | "limit" | "stop" | "stop-limit">
  >;
  setTicketPrice: Dispatch<SetStateAction<string>>;
  setChartOrderSide: Dispatch<SetStateAction<"long" | "short" | null>>;
  calculatePnL: (trade: BacktestTrade, price: number) => number;
  calculatePips: (trade: BacktestTrade, price: number) => number;
  isTradeHistoricallyClosed: (tradeId: string) => boolean;
};

export function useReplayTradeEngine({
  sessionId,
  symbol,
  currentCandle,
  currentTime,
  currentTimeUnix,
  currentPrice,
  pipSize,
  showSLTP,
  defaultSLPips,
  defaultTPPips,
  entryMode,
  ticketPrice,
  ticketSecondaryPrice,
  ticketUnits,
  timeInForce,
  ocoEnabled,
  riskPercent,
  nextTradeNotes,
  nextTradeTags,
  challengeLocked,
  cashBalance,
  tradeSizerLotSize,
  executionEnvironment,
  latestIndicators,
  trades,
  openTrades,
  replayPendingOrders,
  tradeDrafts,
  currentIntrabarTrace,
  tradeMfeRef,
  tradeMaeRef,
  pendingOrderProcessingRef,
  setTrades,
  setPendingOrders,
  setTradeDrafts,
  setNextTradeNotes,
  setNextTradeTags,
  setEntryMode,
  setTicketPrice,
  setChartOrderSide,
  calculatePnL,
  calculatePips,
  isTradeHistoricallyClosed,
}: UseReplayTradeEngineInput) {
  const applyAdverseSlippage = useCallback(
    (price: number, direction: "long" | "short", multiplier = 1) => {
      const slippageDistance =
        executionEnvironment.slippagePips * pipSize * multiplier;
      return direction === "long"
        ? price + slippageDistance
        : price - slippageDistance;
    },
    [executionEnvironment.slippagePips, pipSize]
  );

  const persistTradeLocally = useCallback(
    (tradeId: string, patch: Partial<BacktestTrade>) => {
      setTrades((previous) =>
        previous.map((trade) =>
          trade.id === tradeId ? { ...trade, ...patch } : trade
        )
      );
    },
    [setTrades]
  );

  const finalizeTrade = useCallback(
    async (
      trade: BacktestTrade,
      exitPrice: number,
      exitType: "sl" | "tp" | "manual" | "session_end",
      exitUnix: number
    ) => {
      const accruedSwap =
        (trade.swap || 0) +
        getSwapDays(getEntryUnix(trade), exitUnix) *
          (executionEnvironment.swapPerDayPerLot * trade.volume);
      const pnl = calculatePnL(trade, exitPrice) - (trade.fees || 0) - accruedSwap;
      const pnlPips = calculatePips(trade, exitPrice);
      const expectedExitPrice =
        exitType === "sl"
          ? trade.sl ?? exitPrice
          : exitType === "tp"
            ? trade.tp ?? exitPrice
            : currentPrice || exitPrice;
      const exitSlippagePips = Math.abs(exitPrice - expectedExitPrice) / pipSize;
      const realizedRR =
        typeof trade.slPips === "number" && trade.slPips > 0
          ? pnlPips / trade.slPips
          : undefined;
      const holdTimeSeconds = Math.max(0, exitUnix - getEntryUnix(trade));
      const mfePips =
        Math.max(tradeMfeRef.current[trade.id] || 0, trade.mfePips || 0) ||
        undefined;
      const maePips =
        Math.max(tradeMaeRef.current[trade.id] || 0, trade.maePips || 0) ||
        undefined;

      try {
        await trpcClient.backtest.closeTrade.mutate({
          tradeId: trade.id,
          exitPrice,
          exitTime: new Date(exitUnix * 1000).toISOString(),
          exitTimeUnix: exitUnix,
          exitType,
          pnl,
          pnlPips,
          realizedRR,
          mfePips,
          maePips,
          holdTimeSeconds,
          swap: accruedSwap,
          exitSlippagePips,
        });
      } catch (err) {
        console.error("Failed to close trade:", err);
        toast.error("Failed to close trade");
        throw err;
      }

      persistTradeLocally(trade.id, {
        status:
          exitType === "sl" ? "stopped" : exitType === "tp" ? "target" : "closed",
        exitPrice,
        exitTime: exitUnix as Time,
        exitTimeUnix: exitUnix,
        exitType,
        pnl,
        pnlPips,
        realizedRR,
        mfePips,
        maePips,
        holdTimeSeconds,
        swap: accruedSwap,
        exitSlippagePips,
      });
    },
    [
      calculatePips,
      calculatePnL,
      currentPrice,
      executionEnvironment.swapPerDayPerLot,
      persistTradeLocally,
      pipSize,
      tradeMaeRef,
      tradeMfeRef,
    ]
  );

  const createExecutedTrade = useCallback(
    async ({
      direction,
      entryPrice,
      entryUnix,
      volume,
      sl,
      tp,
      slPips,
      tpPips,
      riskPercent: tradeRiskPercent,
      notes,
      tags,
      entryBalance,
      fees,
      commission,
      swap,
      entrySpreadPips,
      entrySlippagePips,
      slippagePrice,
    }: {
      direction: "long" | "short";
      entryPrice: number;
      entryUnix: number;
      volume: number;
      sl?: number;
      tp?: number;
      slPips?: number;
      tpPips?: number;
      riskPercent?: number;
      notes?: string;
      tags?: string[];
      entryBalance?: number;
      fees?: number;
      commission?: number;
      swap?: number;
      entrySpreadPips?: number;
      entrySlippagePips?: number;
      slippagePrice?: number;
    }) => {
      if (!sessionId) {
        throw new Error("Session unavailable");
      }

      const dbTrade = await trpcClient.backtest.addTrade.mutate({
        sessionId,
        direction,
        entryPrice,
        entryTime: new Date(entryUnix * 1000).toISOString(),
        entryTimeUnix: entryUnix,
        entryBalance,
        sl,
        tp,
        slPips,
        tpPips,
        riskPercent: tradeRiskPercent,
        volume,
        fees,
        commission,
        swap,
        entrySpreadPips,
        entrySlippagePips,
        slippagePrice,
        notes: notes?.trim() || undefined,
        tags: tags?.filter(Boolean) || [],
        entryIndicatorValues: {
          rsi: latestIndicators.rsi,
          macd: latestIndicators.macd,
          macdSignal: latestIndicators.macdSignal,
          atr: latestIndicators.atr,
          sma1: latestIndicators.sma1,
          sma2: latestIndicators.sma2,
          ema1: latestIndicators.ema1,
          bbUpper: latestIndicators.bbUpper,
          bbMiddle: latestIndicators.bbMiddle,
          bbLower: latestIndicators.bbLower,
        },
      });

      setTrades((previous) => [
        ...previous,
        {
          id: dbTrade.id,
          direction,
          entryPrice,
          entryTime: entryUnix as Time,
          entryTimeUnix: entryUnix,
          sl,
          tp,
          slPips,
          tpPips,
          riskPercent: tradeRiskPercent,
          volume,
          status: "open",
          notes: notes?.trim() || undefined,
          tags: tags?.filter(Boolean) || [],
          entryBalance,
          fees,
          commission,
          swap,
          entrySpreadPips,
          entrySlippagePips,
          slippagePrice,
        },
      ]);
      tradeMfeRef.current[dbTrade.id] = 0;
      tradeMaeRef.current[dbTrade.id] = 0;

      return dbTrade.id;
    },
    [latestIndicators, sessionId, setTrades, tradeMaeRef, tradeMfeRef]
  );

  useEffect(() => {
    if (!currentCandle) return;

    const watchlist = trades.filter(
      (trade) => getEntryUnix(trade) <= currentTimeUnix && !getExitUnix(trade)
    );

    if (!watchlist.length) return;

    watchlist.forEach((trade) => {
      const favorablePrice =
        trade.direction === "long" ? currentCandle.high : currentCandle.low;
      const adversePrice =
        trade.direction === "long" ? currentCandle.low : currentCandle.high;

      const favorablePips =
        trade.direction === "long"
          ? (favorablePrice - trade.entryPrice) / pipSize
          : (trade.entryPrice - favorablePrice) / pipSize;
      const adversePips =
        trade.direction === "long"
          ? (trade.entryPrice - adversePrice) / pipSize
          : (adversePrice - trade.entryPrice) / pipSize;

      tradeMfeRef.current[trade.id] = Math.max(
        tradeMfeRef.current[trade.id] || 0,
        favorablePips
      );
      tradeMaeRef.current[trade.id] = Math.max(
        tradeMaeRef.current[trade.id] || 0,
        adversePips
      );

      const hitOrder = resolvePathHitOrder(
        currentIntrabarTrace,
        [
          trade.sl ? { key: "sl", price: trade.sl } : null,
          trade.tp ? { key: "tp", price: trade.tp } : null,
        ].filter((item): item is { key: string; price: number } => Boolean(item))
      );

      const firstHit = hitOrder[0];
      if (!firstHit) return;

      if (firstHit.key === "sl" && trade.sl) {
        void finalizeTrade(
          trade,
          applyAdverseSlippage(trade.sl, trade.direction, 0.6),
          "sl",
          currentTimeUnix
        );
        return;
      }

      if (firstHit.key === "tp" && trade.tp) {
        void finalizeTrade(trade, trade.tp, "tp", currentTimeUnix);
      }
    });
  }, [
    applyAdverseSlippage,
    currentCandle,
    currentIntrabarTrace,
    currentTimeUnix,
    finalizeTrade,
    pipSize,
    tradeMaeRef,
    tradeMfeRef,
    trades,
  ]);

  useEffect(() => {
    if (!currentCandle || !replayPendingOrders.length) return;

    replayPendingOrders.forEach((order) => {
      if (order.expiresAtUnix && currentTimeUnix > order.expiresAtUnix) {
        setPendingOrders((previous) =>
          previous.map((candidate) =>
            candidate.id === order.id && !candidate.cancelledAtUnix
              ? {
                  ...candidate,
                  cancelledAtUnix: order.expiresAtUnix,
                  cancelReason: "expired",
                }
              : candidate
          )
        );
        return;
      }

      if (pendingOrderProcessingRef.current.has(order.id)) return;

      const remainingUnits = Math.max(
        0,
        Math.round(order.remainingUnits ?? order.units)
      );
      if (remainingUnits <= 0) return;

      const isTriggered =
        order.orderType !== "stop-limit" ||
        Boolean(order.activatedAtUnix) ||
        (typeof order.triggerPrice === "number" &&
          resolvePathHitOrder(currentIntrabarTrace, [
            { key: "trigger", price: order.triggerPrice },
          ]).length > 0);

      if (order.orderType === "stop-limit" && !order.activatedAtUnix && isTriggered) {
        setPendingOrders((previous) =>
          previous.map((candidate) =>
            candidate.id === order.id
              ? {
                  ...candidate,
                  activatedAtUnix: currentTimeUnix,
                }
              : candidate
          )
        );
      }

      const workingType =
        order.orderType === "stop-limit" && isTriggered ? "limit" : order.orderType;
      const shouldFill =
        workingType === "limit"
          ? order.direction === "long"
            ? currentCandle.low <= order.entryPrice
            : currentCandle.high >= order.entryPrice
          : order.direction === "long"
            ? currentCandle.high >= order.entryPrice
            : currentCandle.low <= order.entryPrice;

      if (!shouldFill || (order.orderType === "stop-limit" && !isTriggered)) {
        return;
      }

      pendingOrderProcessingRef.current.add(order.id);
      void (async () => {
        try {
          const candleLiquidityUnits = Math.max(
            1000,
            Math.round(
              executionEnvironment.liquidityUnits *
                clamp(((currentCandle.volume || 0) / 40000) + 0.45, 0.35, 1.6)
            )
          );
          const fillUnits = Math.min(remainingUnits, candleLiquidityUnits);
          const fillVolume = Math.max(0.01, round(fillUnits / 100000, 2));
          const fillPrice =
            workingType === "limit"
              ? applyAdverseSlippage(order.entryPrice, order.direction, 0.2)
              : applyAdverseSlippage(order.entryPrice, order.direction, 0.75);
          const fees = executionEnvironment.commissionPerLot * fillVolume;
          const tradeId = await createExecutedTrade({
            direction: order.direction,
            entryPrice: fillPrice,
            entryUnix: currentTimeUnix,
            volume: fillVolume,
            sl: order.sl,
            tp: order.tp,
            slPips: order.slPips,
            tpPips: order.tpPips,
            riskPercent: order.riskPercent,
            notes: order.notes,
            tags: order.tags,
            entryBalance: cashBalance,
            fees,
            commission: fees,
            entrySpreadPips: executionEnvironment.spread / pipSize,
            entrySlippagePips: Math.abs(fillPrice - order.entryPrice) / pipSize,
            slippagePrice: Math.abs(fillPrice - order.entryPrice),
          });

          setPendingOrders((previous) =>
            previous.map((candidate) => {
              if (candidate.id === order.id) {
                const nextRemaining = Math.max(
                  0,
                  Math.round((candidate.remainingUnits ?? candidate.units) - fillUnits)
                );
                return {
                  ...candidate,
                  remainingUnits: nextRemaining,
                  filledAtUnix: nextRemaining === 0 ? currentTimeUnix : undefined,
                  filledTradeId: nextRemaining === 0 ? tradeId : candidate.filledTradeId,
                  fillTradeIds: [...(candidate.fillTradeIds || []), tradeId],
                };
              }
              if (
                order.linkedOcoGroupId &&
                candidate.linkedOcoGroupId === order.linkedOcoGroupId &&
                candidate.id !== order.id &&
                !candidate.cancelledAtUnix &&
                !candidate.filledAtUnix
              ) {
                return {
                  ...candidate,
                  cancelledAtUnix: currentTimeUnix,
                  cancelReason: "manual",
                };
              }
              return candidate;
            })
          );
          toast.success(
            `${order.direction === "long" ? "Buy" : "Sell"} ${order.orderType} ${
              fillUnits < remainingUnits ? "partially filled" : "filled"
            } at ${formatPrice(symbol, fillPrice)}`
          );
        } catch (err) {
          console.error("Failed to fill pending order:", err);
          toast.error("Failed to fill pending order");
        } finally {
          pendingOrderProcessingRef.current.delete(order.id);
        }
      })();
    });
  }, [
    applyAdverseSlippage,
    cashBalance,
    createExecutedTrade,
    currentCandle,
    currentIntrabarTrace,
    currentTimeUnix,
    executionEnvironment.commissionPerLot,
    executionEnvironment.liquidityUnits,
    executionEnvironment.spread,
    pendingOrderProcessingRef,
    pipSize,
    replayPendingOrders,
    setPendingOrders,
    symbol,
  ]);

  const cancelPendingOrder = useCallback(
    (orderId: string) => {
      setPendingOrders((previous) =>
        previous.map((order) =>
          order.id === orderId
            ? {
                ...order,
                cancelledAtUnix: currentTimeUnix,
                cancelReason: "manual",
              }
            : order
        )
      );
      toast.success("Pending order cancelled");
    },
    [currentTimeUnix, setPendingOrders]
  );

  const openTrade = useCallback(
    async (
      direction: "long" | "short",
      overrides?: { price?: number; mode?: "market" | "limit" | "stop" | "stop-limit" }
    ) => {
      if (!sessionId || !currentCandle) return;
      if (challengeLocked) {
        toast.error("Challenge rules are locked. Reset or start a new session.");
        return;
      }
      if (showSLTP && defaultSLPips <= 0) {
        toast.error("Stop loss must be above 0 pips");
        return;
      }

      const currentBidPrice = currentPrice ? Math.max(0, currentPrice - pipSize / 2) : 0;
      const currentAskPrice = currentPrice ? currentPrice + pipSize / 2 : 0;
      const fallbackUnits = Math.max(
        1000,
        Math.round(Math.max(tradeSizerLotSize, 0.01) * 100000)
      );
      const effectiveEntryMode = overrides?.mode ?? entryMode;
      const requestedUnits = parseUnitsInput(ticketUnits);
      const normalizedUnits =
        Number.isFinite(requestedUnits) && requestedUnits > 0
          ? requestedUnits
          : fallbackUnits;
      const volume = Math.max(0.01, round(normalizedUnits / 100000, 2));

      const requestedPrice =
        effectiveEntryMode === "market"
          ? direction === "long"
            ? currentAskPrice
            : currentBidPrice
          : overrides?.price ?? Number(ticketPrice || formatPrice(symbol, currentPrice || 0));
      const secondaryPrice =
        effectiveEntryMode === "stop-limit"
          ? Number(ticketSecondaryPrice || ticketPrice || formatPrice(symbol, currentPrice || 0))
          : requestedPrice;

      if (!Number.isFinite(requestedPrice) || requestedPrice <= 0) {
        toast.error("Order price must be a valid positive number");
        return;
      }
      if (!Number.isFinite(secondaryPrice) || secondaryPrice <= 0) {
        toast.error("Order price must be a valid positive number");
        return;
      }

      if (effectiveEntryMode === "limit") {
        const invalidLimit =
          direction === "long"
            ? requestedPrice > currentAskPrice
            : requestedPrice < currentBidPrice;
        if (invalidLimit) {
          toast.error(
            direction === "long"
              ? "Buy limit must be at or below the current ask"
              : "Sell limit must be at or above the current bid"
          );
          return;
        }
      }

      if (effectiveEntryMode === "stop") {
        const invalidStop =
          direction === "long"
            ? requestedPrice < currentAskPrice
            : requestedPrice > currentBidPrice;
        if (invalidStop) {
          toast.error(
            direction === "long"
              ? "Buy stop must be at or above the current ask"
              : "Sell stop must be at or below the current bid"
          );
          return;
        }
      }

      if (effectiveEntryMode === "stop-limit") {
        const invalidStopLimit =
          direction === "long"
            ? requestedPrice < currentAskPrice || secondaryPrice < currentAskPrice
            : requestedPrice > currentBidPrice || secondaryPrice > currentBidPrice;
        if (invalidStopLimit) {
          toast.error(
            direction === "long"
              ? "Buy stop-limit must stage above the current ask"
              : "Sell stop-limit must stage below the current bid"
          );
          return;
        }
      }

      const baseEntryPrice =
        effectiveEntryMode === "stop-limit" ? secondaryPrice : requestedPrice;
      const sl =
        direction === "long"
          ? baseEntryPrice - defaultSLPips * pipSize
          : baseEntryPrice + defaultSLPips * pipSize;
      const tp =
        direction === "long"
          ? baseEntryPrice + defaultTPPips * pipSize
          : baseEntryPrice - defaultTPPips * pipSize;

      try {
        const tags = parseTags(nextTradeTags);
        if (effectiveEntryMode === "market") {
          const executionPrice = applyAdverseSlippage(requestedPrice, direction, 1);
          const fees = executionEnvironment.commissionPerLot * volume;
          await createExecutedTrade({
            direction,
            entryPrice: executionPrice,
            entryUnix: currentTimeUnix,
            volume,
            sl: showSLTP ? sl : undefined,
            tp: showSLTP ? tp : undefined,
            slPips: showSLTP ? defaultSLPips : undefined,
            tpPips: showSLTP ? defaultTPPips : undefined,
            riskPercent,
            notes: nextTradeNotes,
            tags,
            entryBalance: cashBalance,
            fees,
            commission: fees,
            entrySpreadPips: executionEnvironment.spread / pipSize,
            entrySlippagePips: Math.abs(executionPrice - requestedPrice) / pipSize,
            slippagePrice: Math.abs(executionPrice - requestedPrice),
          });
        } else {
          const ocoGroupId =
            ocoEnabled && replayPendingOrders.length ? crypto.randomUUID() : undefined;
          setPendingOrders((previous) => {
            const activeCandidate = ocoGroupId
              ? [...previous]
                  .reverse()
                  .find((candidate) => !candidate.filledAtUnix && !candidate.cancelledAtUnix)
              : undefined;

            return [
              ...previous.map((candidate) =>
                activeCandidate && candidate.id === activeCandidate.id
                  ? {
                      ...candidate,
                      linkedOcoGroupId: ocoGroupId,
                    }
                  : candidate
              ),
              {
                id: crypto.randomUUID(),
                direction,
                orderType: effectiveEntryMode,
                entryPrice: baseEntryPrice,
                triggerPrice:
                  effectiveEntryMode === "stop-limit" ? requestedPrice : undefined,
                createdAt: currentTime,
                createdAtUnix: currentTimeUnix,
                expiresAtUnix: getTimeInForceExpiryUnix(currentTimeUnix, timeInForce),
                timeInForce,
                sl: showSLTP ? sl : undefined,
                tp: showSLTP ? tp : undefined,
                slPips: showSLTP ? defaultSLPips : undefined,
                tpPips: showSLTP ? defaultTPPips : undefined,
                riskPercent,
                volume,
                units: normalizedUnits,
                remainingUnits: normalizedUnits,
                linkedOcoGroupId: ocoGroupId,
                notes: nextTradeNotes.trim() || undefined,
                tags,
              },
            ];
          });
          toast.success(
            `${direction === "long" ? "Buy" : "Sell"} ${effectiveEntryMode} queued at ${formatPrice(symbol, requestedPrice)}`
          );
        }

        setNextTradeNotes("");
        setNextTradeTags("");
      } catch (err) {
        console.error("Failed to open trade:", err);
        toast.error("Failed to open trade");
      }
    },
    [
      applyAdverseSlippage,
      cashBalance,
      challengeLocked,
      createExecutedTrade,
      currentCandle,
      currentPrice,
      currentTime,
      currentTimeUnix,
      defaultSLPips,
      defaultTPPips,
      entryMode,
      executionEnvironment.commissionPerLot,
      executionEnvironment.spread,
      nextTradeNotes,
      nextTradeTags,
      ocoEnabled,
      pipSize,
      replayPendingOrders.length,
      riskPercent,
      sessionId,
      setNextTradeNotes,
      setNextTradeTags,
      setPendingOrders,
      showSLTP,
      symbol,
      ticketPrice,
      ticketSecondaryPrice,
      ticketUnits,
      timeInForce,
      tradeSizerLotSize,
    ]
  );

  const handleChartOrderPlacement = useCallback(
    async ({
      chartOrderSide,
      price,
    }: {
      chartOrderSide: "long" | "short" | null;
      price: number;
    }) => {
      if (!chartOrderSide) return;
      const currentBidPrice = currentPrice
        ? Math.max(0, currentPrice - executionEnvironment.spread / 2)
        : 0;
      const currentAskPrice = currentPrice
        ? currentPrice + executionEnvironment.spread / 2
        : 0;

      const inferredMode =
        entryMode === "market"
          ? chartOrderSide === "long"
            ? price >= currentAskPrice
              ? "stop"
              : "limit"
            : price <= currentBidPrice
              ? "stop"
              : "limit"
          : entryMode;

      setTicketPrice(formatPrice(symbol, price));
      if (entryMode === "market") {
        setEntryMode(inferredMode);
      }

      await openTrade(chartOrderSide, {
        price,
        mode: inferredMode,
      });
      setChartOrderSide(null);
    },
    [
      currentPrice,
      entryMode,
      executionEnvironment.spread,
      openTrade,
      setChartOrderSide,
      setEntryMode,
      setTicketPrice,
      symbol,
    ]
  );

  const closeTradeAtMarket = useCallback(
    async (tradeId: string, exitType: "manual" | "session_end" = "manual") => {
      const trade = trades.find((candidate) => candidate.id === tradeId);
      if (!trade || !currentCandle) return;
      if (getExitUnix(trade)) {
        toast.error("Completed trades are locked during review");
        return;
      }
      await finalizeTrade(trade, currentPrice, exitType, currentTimeUnix);
    },
    [currentCandle, currentPrice, currentTimeUnix, finalizeTrade, trades]
  );

  const persistTradeLevels = useCallback(
    async (tradeId: string, nextSlRaw: string, nextTpRaw: string) => {
      const trade = trades.find((candidate) => candidate.id === tradeId);
      if (!trade) return;
      if (getExitUnix(trade)) {
        toast.error("Completed trades are locked during review");
        return;
      }
      const sl = nextSlRaw.trim() === "" ? null : Number(nextSlRaw);
      const tp = nextTpRaw.trim() === "" ? null : Number(nextTpRaw);

      if ((sl !== null && Number.isNaN(sl)) || (tp !== null && Number.isNaN(tp))) {
        toast.error("SL/TP must be valid numbers");
        return;
      }

      const nextSlPips =
        typeof sl === "number" ? Math.abs((sl - trade.entryPrice) / pipSize) : null;
      const nextTpPips =
        typeof tp === "number" ? Math.abs((tp - trade.entryPrice) / pipSize) : null;

      try {
        await trpcClient.backtest.updateTrade.mutate({
          tradeId,
          sl,
          tp,
          slPips: nextSlPips,
          tpPips: nextTpPips,
        });
        persistTradeLocally(tradeId, {
          sl: sl ?? undefined,
          tp: tp ?? undefined,
          slPips: nextSlPips ?? undefined,
          tpPips: nextTpPips ?? undefined,
        });
        setTradeDrafts((previous) => ({
          ...previous,
          [tradeId]: {
            sl: nextSlRaw,
            tp: nextTpRaw,
          },
        }));
        toast.success("Trade levels updated");
      } catch (err) {
        console.error("Failed to update trade:", err);
        toast.error("Failed to update trade levels");
      }
    },
    [persistTradeLocally, pipSize, setTradeDrafts, trades]
  );

  const saveTradeLevels = useCallback(
    async (tradeId: string) => {
      const draft = tradeDrafts[tradeId];
      if (!draft) return;
      await persistTradeLevels(tradeId, draft.sl, draft.tp);
    },
    [persistTradeLevels, tradeDrafts]
  );

  const moveTradeToBreakEven = useCallback(
    async (tradeId: string) => {
      const trade = trades.find((candidate) => candidate.id === tradeId);
      if (!trade) return;
      const nextSl = trade.entryPrice.toString();
      const nextTp = tradeDrafts[tradeId]?.tp ?? trade.tp?.toString() ?? "";
      await persistTradeLevels(tradeId, nextSl, nextTp);
    },
    [persistTradeLevels, tradeDrafts, trades]
  );

  useEffect(() => {
    setTradeDrafts((previous) => {
      const nextDrafts = { ...previous };
      openTrades.forEach((trade) => {
        if (!nextDrafts[trade.id]) {
          nextDrafts[trade.id] = {
            sl: trade.sl?.toString() || "",
            tp: trade.tp?.toString() || "",
          };
        }
      });

      Object.keys(nextDrafts).forEach((tradeId) => {
        if (!openTrades.some((trade) => trade.id === tradeId)) {
          delete nextDrafts[tradeId];
        }
      });
      return nextDrafts;
    });
  }, [openTrades, setTradeDrafts]);

  const closeLatestEditableTrade = useCallback(async () => {
    const latestEditableTrade = [...openTrades]
      .reverse()
      .find((trade) => !isTradeHistoricallyClosed(trade.id));
    if (latestEditableTrade) {
      await closeTradeAtMarket(latestEditableTrade.id);
    }
  }, [closeTradeAtMarket, isTradeHistoricallyClosed, openTrades]);

  return {
    applyAdverseSlippage,
    persistTradeLocally,
    openTrade,
    handleChartOrderPlacement,
    closeTradeAtMarket,
    persistTradeLevels,
    saveTradeLevels,
    moveTradeToBreakEven,
    cancelPendingOrder,
    closeLatestEditableTrade,
  };
}
