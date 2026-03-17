import { randomUUID } from "node:crypto";

import type { ParsedImportTrade } from "./csv/bundle";
import { calculateTradeOutcome } from "../trades/trade-outcome";

function normalizeValue(value: unknown) {
  return value == null ? "" : String(value).trim().toLowerCase();
}

function numberToStoredString(value: number | null) {
  return value == null ? null : value.toString();
}

export function buildImportedTradeIdentityFingerprint(
  trade: ParsedImportTrade
) {
  return [
    normalizeValue(trade.ticket),
    normalizeValue(trade.symbol),
    normalizeValue(trade.openTime?.toISOString()),
    normalizeValue(trade.closeTime?.toISOString()),
    normalizeValue(trade.volume),
    normalizeValue(trade.profit),
  ].join("|");
}

export function buildImportedTradeCoreIdentityFingerprint(
  trade: ParsedImportTrade
) {
  return [
    normalizeValue(trade.symbol),
    normalizeValue(trade.openTime?.toISOString()),
    normalizeValue(trade.closeTime?.toISOString()),
    normalizeValue(trade.volume),
  ].join("|");
}

export function buildStoredImportedTradeIdentityFingerprint(trade: {
  ticket?: string | null;
  symbol?: string | null;
  openTime?: Date | null;
  closeTime?: Date | null;
  volume?: string | null;
  profit?: string | null;
}) {
  return [
    normalizeValue(trade.ticket),
    normalizeValue(trade.symbol),
    normalizeValue(trade.openTime?.toISOString()),
    normalizeValue(trade.closeTime?.toISOString()),
    normalizeValue(trade.volume),
    normalizeValue(trade.profit),
  ].join("|");
}

export function buildStoredImportedTradeCoreIdentityFingerprint(trade: {
  symbol?: string | null;
  openTime?: Date | null;
  closeTime?: Date | null;
  volume?: string | null;
}) {
  return [
    normalizeValue(trade.symbol),
    normalizeValue(trade.openTime?.toISOString()),
    normalizeValue(trade.closeTime?.toISOString()),
    normalizeValue(trade.volume),
  ].join("|");
}

export function mapStoredTradeToImportedTrade(trade: {
  ticket?: string | null;
  open?: string | null;
  tradeType?: string | null;
  volume?: string | null;
  symbol?: string | null;
  openPrice?: string | null;
  sl?: string | null;
  tp?: string | null;
  close?: string | null;
  closePrice?: string | null;
  swap?: string | null;
  commissions?: string | null;
  profit?: string | null;
  pips?: string | null;
  tradeDurationSeconds?: string | null;
  openTime?: Date | null;
  closeTime?: Date | null;
  sessionTag?: string | null;
  sessionTagColor?: string | null;
}) {
  const parseNumber = (value: string | null | undefined) => {
    if (value == null || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    ticket: trade.ticket ?? null,
    open: trade.open ?? null,
    tradeType:
      trade.tradeType === "long" || trade.tradeType === "short"
        ? trade.tradeType
        : null,
    volume: parseNumber(trade.volume),
    symbol: trade.symbol ?? null,
    openPrice: parseNumber(trade.openPrice),
    sl: parseNumber(trade.sl),
    tp: parseNumber(trade.tp),
    close: trade.close ?? null,
    closePrice: parseNumber(trade.closePrice),
    swap: parseNumber(trade.swap),
    commissions: parseNumber(trade.commissions),
    profit: parseNumber(trade.profit),
    pips: parseNumber(trade.pips),
    tradeDurationSeconds: trade.tradeDurationSeconds ?? null,
    openTime: trade.openTime ?? null,
    closeTime: trade.closeTime ?? null,
    sessionTag: trade.sessionTag ?? null,
    sessionTagColor: trade.sessionTagColor ?? null,
  } satisfies ParsedImportTrade;
}

export function buildImportedTradeInsertRecord(input: {
  accountId: string;
  trade: ParsedImportTrade;
  index: number;
  importMeta: { parserId: string; reportType: string };
  breakevenThresholdPips?: number | null;
}) {
  const outcome =
    input.trade.symbol && input.trade.profit != null
      ? calculateTradeOutcome({
          symbol: input.trade.symbol,
          profit: input.trade.profit,
          commissions: input.trade.commissions,
          swap: input.trade.swap,
          tp: input.trade.tp,
          closePrice: input.trade.closePrice,
          entryPrice: input.trade.openPrice,
          tradeDirection: input.trade.tradeType,
          beThresholdPips: input.breakevenThresholdPips,
        })
      : null;

  return {
    id: randomUUID(),
    accountId: input.accountId,
    ticket: input.trade.ticket ?? `import-${input.index + 1}`,
    open: input.trade.open ?? input.trade.openTime?.toISOString() ?? null,
    tradeType: input.trade.tradeType,
    volume: numberToStoredString(input.trade.volume),
    symbol: input.trade.symbol,
    openPrice: numberToStoredString(input.trade.openPrice),
    sl: numberToStoredString(input.trade.sl),
    tp: numberToStoredString(input.trade.tp),
    close: input.trade.close ?? input.trade.closeTime?.toISOString() ?? null,
    closePrice: numberToStoredString(input.trade.closePrice),
    swap: numberToStoredString(input.trade.swap),
    commissions: numberToStoredString(input.trade.commissions),
    profit: numberToStoredString(input.trade.profit),
    pips: numberToStoredString(input.trade.pips),
    beThresholdPips: numberToStoredString(input.breakevenThresholdPips ?? null),
    outcome,
    originType: "csv_import",
    originLabel: "CSV import",
    originCapturedAt: new Date(),
    tradeDurationSeconds: input.trade.tradeDurationSeconds,
    openTime: input.trade.openTime,
    closeTime: input.trade.closeTime,
    sessionTag: input.trade.sessionTag,
    sessionTagColor: input.trade.sessionTagColor,
    brokerMeta: {
      importParserId: input.importMeta.parserId,
      importReportType: input.importMeta.reportType,
    },
    createdAt: new Date(),
  };
}

export function buildImportedTradeUpdateRecord(input: {
  existingTrade: {
    brokerMeta?: Record<string, unknown> | null;
    originType?: string | null;
    originLabel?: string | null;
    originCapturedAt?: Date | null;
  };
  trade: ParsedImportTrade;
  importMeta: { parserId: string; reportType: string };
  breakevenThresholdPips?: number | null;
}) {
  const outcome =
    input.trade.symbol && input.trade.profit != null
      ? calculateTradeOutcome({
          symbol: input.trade.symbol,
          profit: input.trade.profit,
          commissions: input.trade.commissions,
          swap: input.trade.swap,
          tp: input.trade.tp,
          closePrice: input.trade.closePrice,
          entryPrice: input.trade.openPrice,
          tradeDirection: input.trade.tradeType,
          beThresholdPips: input.breakevenThresholdPips,
        })
      : null;

  return {
    open: input.trade.open ?? input.trade.openTime?.toISOString() ?? null,
    tradeType: input.trade.tradeType,
    volume: numberToStoredString(input.trade.volume),
    symbol: input.trade.symbol,
    openPrice: numberToStoredString(input.trade.openPrice),
    sl: numberToStoredString(input.trade.sl),
    tp: numberToStoredString(input.trade.tp),
    close: input.trade.close ?? input.trade.closeTime?.toISOString() ?? null,
    closePrice: numberToStoredString(input.trade.closePrice),
    swap: numberToStoredString(input.trade.swap),
    commissions: numberToStoredString(input.trade.commissions),
    profit: numberToStoredString(input.trade.profit),
    pips: numberToStoredString(input.trade.pips),
    beThresholdPips: numberToStoredString(input.breakevenThresholdPips ?? null),
    outcome,
    originType: input.existingTrade.originType ?? "csv_import",
    originLabel: input.existingTrade.originLabel ?? "CSV import",
    originCapturedAt: input.existingTrade.originCapturedAt ?? new Date(),
    tradeDurationSeconds: input.trade.tradeDurationSeconds,
    openTime: input.trade.openTime,
    closeTime: input.trade.closeTime,
    sessionTag: input.trade.sessionTag,
    sessionTagColor: input.trade.sessionTagColor,
    brokerMeta: {
      ...(input.existingTrade.brokerMeta ?? {}),
      importParserId: input.importMeta.parserId,
      importReportType: input.importMeta.reportType,
    },
  };
}

export function hasImportedTradeChanges(input: {
  existingTrade: {
    ticket?: string | null;
    symbol?: string | null;
    openTime?: Date | null;
    closeTime?: Date | null;
    volume?: string | null;
    profit?: string | null;
  };
  trade: ParsedImportTrade;
  importMeta: { parserId: string; reportType: string };
}) {
  return (
    buildStoredImportedTradeIdentityFingerprint(input.existingTrade) !==
    buildImportedTradeIdentityFingerprint(input.trade)
  );
}
