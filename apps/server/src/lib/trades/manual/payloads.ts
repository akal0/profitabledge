import { randomUUID } from "node:crypto";

import { getContractSizeForSymbol } from "../../dukascopy";
import type { tradingAccount } from "../../../db/schema/trading";
import { deriveManualTradeCoreValues } from "./derivation";
import type { ManualTradeDraft } from "./types";

type TradingAccountRecord = typeof tradingAccount.$inferSelect;

function numberToStoredString(value: number | null | undefined) {
  return value == null ? null : value.toString();
}

function toNullableNumber(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTradeTags(tags?: string[] | null) {
  if (!Array.isArray(tags)) return [];
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
        .slice(0, 50)
    )
  );
}

function buildTradeDurationSeconds(
  openTime: Date | null,
  closeTime: Date | null
) {
  if (!openTime || !closeTime) return null;
  return Math.max(
    0,
    Math.floor((closeTime.getTime() - openTime.getTime()) / 1000)
  );
}

export function buildManualClosedTradeInsert(input: {
  account: TradingAccountRecord;
  draft: ManualTradeDraft;
}) {
  const core = deriveManualTradeCoreValues({
    draft: input.draft,
    beThresholdPips: toNullableNumber(input.account.breakevenThresholdPips),
  });
  const tradeId = randomUUID();
  const contractSize = getContractSizeForSymbol(core.symbol);
  const tradeDurationSeconds = buildTradeDurationSeconds(
    core.openTime,
    core.closeTime
  );

  return {
    id: tradeId,
    accountId: input.account.id,
    ticket: input.draft.ticket ?? null,
    open: core.openTimeISO,
    tradeType: core.tradeType,
    volume: numberToStoredString(core.volume),
    symbol: core.symbol,
    openPrice: numberToStoredString(core.openPrice),
    sl: numberToStoredString(input.draft.sl ?? null),
    tp: numberToStoredString(input.draft.tp ?? null),
    close: core.closeTimeISO,
    closePrice: numberToStoredString(core.closePrice),
    swap: numberToStoredString(core.swap),
    commissions: numberToStoredString(core.commissions),
    profit: numberToStoredString(core.profit),
    pips: numberToStoredString(core.pips),
    tradeDurationSeconds:
      tradeDurationSeconds != null ? tradeDurationSeconds.toString() : null,
    openTime: core.openTime,
    closeTime: core.closeTime,
    beThresholdPips: numberToStoredString(core.beThresholdPips),
    outcome: core.outcome,
    originType: core.originType,
    originLabel: core.originLabel,
    originCapturedAt: core.originCapturedAt,
    sessionTag: input.draft.sessionTag?.trim() || null,
    modelTag: input.draft.modelTag?.trim() || null,
    customTags: normalizeTradeTags(input.draft.customTags),
    brokerMeta: {
      source: "manual",
      contractSize,
      evidence: input.draft.evidence ?? null,
    },
    createdAt: new Date(),
  };
}

export function buildManualOpenTradeInsert(input: {
  account: TradingAccountRecord;
  draft: ManualTradeDraft;
}) {
  const core = deriveManualTradeCoreValues({
    draft: input.draft,
    beThresholdPips: toNullableNumber(input.account.breakevenThresholdPips),
  });
  const ticket = input.draft.ticket || `manual-${randomUUID()}`;
  const rowId = randomUUID();

  return {
    id: rowId,
    accountId: input.account.id,
    ticket,
    symbol: core.symbol,
    tradeType: core.tradeType,
    volume: numberToStoredString(core.volume) ?? "0",
    openPrice: numberToStoredString(core.openPrice) ?? "0",
    openTime: core.openTime ?? new Date(),
    sl: numberToStoredString(input.draft.sl ?? null),
    tp: numberToStoredString(input.draft.tp ?? null),
    currentPrice: numberToStoredString(core.currentPrice),
    swap: numberToStoredString(core.swap ?? 0) ?? "0",
    commission: numberToStoredString(core.commissions ?? 0) ?? "0",
    profit: numberToStoredString(core.profit ?? 0) ?? "0",
    sessionTag: input.draft.sessionTag?.trim() || null,
    sessionTagColor: null,
    slModCount: null,
    tpModCount: null,
    partialCloseCount: null,
    entryDealCount: null,
    exitDealCount: null,
    entryVolume: numberToStoredString(core.volume),
    exitVolume: null,
    scaleInCount: null,
    scaleOutCount: null,
    trailingStopDetected: null,
    comment: input.draft.comment?.trim() || null,
    magicNumber: null,
    brokerMeta: {
      source: "manual",
      originType: "manual_entry",
      evidence: input.draft.evidence ?? null,
    },
    lastUpdatedAt: new Date(),
    createdAt: new Date(),
  };
}

export function buildManualTradeCloseInsert(input: {
  account: TradingAccountRecord;
  draft: ManualTradeDraft;
}) {
  return buildManualClosedTradeInsert(input);
}

export function buildManualTradeDraftFromInput(input: {
  accountId: string;
  symbol: string;
  tradeType: "long" | "short";
  volume?: number | null;
  openPrice?: number | null;
  closePrice?: number | null;
  currentPrice?: number | null;
  openTime?: Date | string | null;
  closeTime?: Date | string | null;
  sl?: number | null;
  tp?: number | null;
  profit?: number | null;
  commissions?: number | null;
  swap?: number | null;
  sessionTag?: string | null;
  modelTag?: string | null;
  customTags?: string[] | null;
  ticket?: string | null;
  comment?: string | null;
}) {
  return {
    accountId: input.accountId,
    symbol: input.symbol,
    tradeType: input.tradeType,
    volume: input.volume ?? null,
    openPrice: input.openPrice ?? null,
    closePrice: input.closePrice ?? null,
    currentPrice: input.currentPrice ?? null,
    openTime: input.openTime ?? null,
    closeTime: input.closeTime ?? null,
    sl: input.sl ?? null,
    tp: input.tp ?? null,
    profit: input.profit ?? null,
    commissions: input.commissions ?? null,
    swap: input.swap ?? null,
    sessionTag: input.sessionTag ?? null,
    modelTag: input.modelTag ?? null,
    customTags: input.customTags ?? null,
    ticket: input.ticket ?? null,
    comment: input.comment ?? null,
  } satisfies ManualTradeDraft;
}
