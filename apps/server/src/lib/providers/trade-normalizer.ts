/**
 * Maps a NormalizedTrade to the shape required for the `trade` table insert.
 * Fields that the provider cannot supply are set to null.
 */
import type { NormalizedTrade } from "./types";

export function normalizeToTradeInsert(
  normalized: NormalizedTrade,
  accountId: string
) {
  const durationSeconds =
    normalized.openTime && normalized.closeTime
      ? Math.round(
          (normalized.closeTime.getTime() - normalized.openTime.getTime()) /
            1000
        ).toString()
      : null;

  return {
    id: crypto.randomUUID(),
    accountId,
    ticket: normalized.ticket,
    tradeType: normalized.tradeType,
    symbol: normalized.symbol,
    volume: normalized.volume?.toString() ?? null,
    openPrice: normalized.openPrice?.toString() ?? null,
    closePrice: normalized.closePrice?.toString() ?? null,
    sl: normalized.sl?.toString() ?? null,
    tp: normalized.tp?.toString() ?? null,
    profit: normalized.profit?.toString() ?? null,
    swap: normalized.swap?.toString() ?? null,
    commissions: normalized.commissions?.toString() ?? null,
    pips: normalized.pips?.toString() ?? null,
    openTime: normalized.openTime,
    closeTime: normalized.closeTime,
    open: normalized.openTime?.toISOString() ?? null,
    close: normalized.closeTime?.toISOString() ?? null,
    tradeDurationSeconds: durationSeconds,
    comment: normalized.comment ?? null,
    originType: "broker_sync",
    originLabel: "Broker sync",
    originCapturedAt: new Date(),

    // EA-only fields — not available from API providers
    manipulationHigh: null,
    manipulationLow: null,
    manipulationPips: null,
    entryPeakPrice: null,
    entryPeakTimestamp: null,
    postExitPeakPrice: null,
    postExitPeakTimestamp: null,
    postExitSamplingDuration: null,
    entrySpreadPips: null,
    exitSpreadPips: null,
    entrySlippagePips: null,
    exitSlippagePips: null,
    slModCount: null,
    tpModCount: null,
    partialCloseCount: null,
    exitDealCount: null,
    exitVolume: null,
    entryDealCount: null,
    entryVolume: null,
    scaleInCount: null,
    scaleOutCount: null,
    trailingStopDetected: null,
    entryPeakDurationSeconds: null,
    postExitPeakDurationSeconds: null,
    entryBalance: null,
    entryEquity: null,
    entryMargin: null,
    entryFreeMargin: null,
    entryMarginLevel: null,

    useBrokerData: 0,
    outcome: null,
    createdAt: new Date(),
  };
}
