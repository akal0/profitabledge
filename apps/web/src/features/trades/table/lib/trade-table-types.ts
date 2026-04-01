"use client";

import type { TradeDrawdownMap } from "@/features/trades/table/lib/trade-drawdown";
import type { NamedColorTag } from "@/features/trades/table/lib/trade-table-view-state";

export type TradePnlDisplayMode = "usd" | "rr";

export type InlineTradeUpdateInput = {
  tradeId: string;
  symbol?: string;
  tradeType?: "long" | "short";
  volume?: number;
  openPrice?: number;
  closePrice?: number;
  openTime?: string;
  closeTime?: string;
  sl?: number | null;
  tp?: number | null;
  profit?: number;
  commissions?: number;
  swap?: number;
  sessionTag?: string | null;
  protocolAlignment?: "aligned" | "against" | "discretionary" | null;
  modelTag?: string | null;
  customTags?: string[];
};

export type InlineTradeUpdateField = Exclude<
  keyof InlineTradeUpdateInput,
  "tradeId"
>;

export type TradeStreakMeta = {
  count: number;
  type: "win" | "loss";
};

export type TradeTableMeta = {
  totalTradesCount?: number;
  disableSampleGating?: boolean;
  pnlMode?: TradePnlDisplayMode;
  baselineInitialBalance?: number | string | null;
  streakByTradeId?: Record<string, TradeStreakMeta>;
  sessionTags?: NamedColorTag[];
  modelTags?: NamedColorTag[];
  customTags?: string[];
  drawdownByTradeId?: TradeDrawdownMap;
  drawdownLoading?: boolean;
  isCellSaving?: (tradeId: string, field: InlineTradeUpdateField) => boolean;
  updateTrade?: (input: InlineTradeUpdateInput) => Promise<void>;
};

export type TradeRow = {
  id: string;
  accountId?: string;
  ticket?: string | null;
  tp?: number | null;
  sl?: number | null;
  open: string;
  close: string;
  openText?: string | null;
  closeText?: string | null;
  symbol: string;
  rawSymbol?: string | null;
  symbolGroup?: string | null;
  tradeDirection: "long" | "short";
  volume: number;
  profit: number;
  commissions?: number | null;
  swap?: number | null;
  createdAtISO: string;
  holdSeconds: number;
  openPrice?: number | null;
  closePrice?: number | null;
  pips?: number | null;
  killzone?: string | null;
  killzoneColor?: string | null;
  sessionTag?: string | null;
  sessionTagColor?: string | null;
  edgeId?: string | null;
  edgeName?: string | null;
  edgeColor?: string | null;
  modelTag?: string | null;
  modelTagColor?: string | null;
  edgeRuleReview?: {
    reviewedCount: number;
    followedCount: number;
    brokenCount: number;
  };
  customTags?: string[];
  protocolAlignment?: "aligned" | "against" | "discretionary" | null;
  outcome?: "Win" | "Loss" | "BE" | "PW";
  maxRR?: number | null;
  drawdown?: number | null;
  plannedRR?: number | null;
  plannedRiskPips?: number | null;
  plannedTargetPips?: number | null;
  manipulationPips?: number | null;
  mfePips?: number | null;
  maePips?: number | null;
  entrySpreadPips?: number | null;
  exitSpreadPips?: number | null;
  entrySlippagePips?: number | null;
  exitSlippagePips?: number | null;
  slModCount?: number | null;
  tpModCount?: number | null;
  partialCloseCount?: number | null;
  exitDealCount?: number | null;
  exitVolume?: number | null;
  entryBalance?: number | null;
  entryEquity?: number | null;
  entryMargin?: number | null;
  entryFreeMargin?: number | null;
  entryMarginLevel?: number | null;
  entryDealCount?: number | null;
  entryVolume?: number | null;
  scaleInCount?: number | null;
  scaleOutCount?: number | null;
  trailingStopDetected?: boolean | null;
  entryPeakDurationSeconds?: number | null;
  postExitPeakDurationSeconds?: number | null;
  mpeManipLegR?: number | null;
  mpeManipPE_R?: number | null;
  rawSTDV?: number | null;
  rawSTDV_PE?: number | null;
  stdvBucket?: string | null;
  estimatedWeightedMPE_R?: number | null;
  realisedRR?: number | null;
  rrCaptureEfficiency?: number | null;
  manipRREfficiency?: number | null;
  exitEfficiency?: number | null;
  isLive?: boolean;
  complianceStatus?: "pass" | "fail" | "unknown";
  complianceFlags?: string[];
  brokerMeta?: Record<string, unknown> | null;
  closeReason?: string | null;
  entrySource?: string | null;
  exitSource?: string | null;
  executionMode?: string | null;
  magicNumber?: number | null;
};
