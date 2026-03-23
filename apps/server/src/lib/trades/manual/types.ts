import type { TradeOriginType } from "../../public-proof/trust";

export type ManualTradeDirection = "long" | "short";
export type ManualTradeMode = "open" | "closed";

export type ManualTradeSide = "manual" | "broker" | "csv";

export type ManualTradeNumeric = number | null | undefined;
export type ManualTradeText = string | null | undefined;
export type ManualTradeDate = Date | string | null | undefined;

export type ManualTradeEvidence = {
  note?: string | null;
  noteHtml?: string | null;
  attachmentCount?: number | null;
  screenshotCount?: number | null;
};

export type ManualTradeDraft = {
  accountId: string;
  symbol: string;
  tradeType: ManualTradeDirection;
  volume?: ManualTradeNumeric;
  openPrice?: ManualTradeNumeric;
  closePrice?: ManualTradeNumeric;
  currentPrice?: ManualTradeNumeric;
  openTime?: ManualTradeDate;
  closeTime?: ManualTradeDate;
  sl?: ManualTradeNumeric;
  tp?: ManualTradeNumeric;
  profit?: ManualTradeNumeric;
  commissions?: ManualTradeNumeric;
  swap?: ManualTradeNumeric;
  sessionTag?: ManualTradeText;
  modelTag?: ManualTradeText;
  customTags?: string[] | null;
  ticket?: string | null;
  comment?: ManualTradeText;
  evidence?: ManualTradeEvidence | null;
};

export type ManualTradeValidationIssue = {
  field: string;
  message: string;
};

export type ManualTradeValidationResult = {
  isValid: boolean;
  issues: ManualTradeValidationIssue[];
  openTime: Date | null;
  closeTime: Date | null;
  mode: ManualTradeMode;
  hasLiveWindow: boolean;
};

export type ManualTradeCoreValues = {
  symbol: string;
  tradeType: ManualTradeDirection;
  volume: number | null;
  openPrice: number | null;
  closePrice: number | null;
  currentPrice: number | null;
  openTime: Date | null;
  closeTime: Date | null;
  closeTimeISO: string | null;
  openTimeISO: string | null;
  holdSeconds: number | null;
  pips: number | null;
  profit: number | null;
  commissions: number | null;
  swap: number | null;
  netPnL: number | null;
  plannedRiskPips: number | null;
  plannedTargetPips: number | null;
  plannedRR: number | null;
  realisedRR: number | null;
  outcome: "Win" | "Loss" | "BE" | "PW";
  beThresholdPips: number | null;
  originType: TradeOriginType;
  originLabel: string;
  originCapturedAt: Date;
};

export type ManualTradeReferenceCandidate = {
  id: string;
  source: ManualTradeSide;
  symbol?: string | null;
  tradeType?: string | null;
  volume?: number | string | null;
  openPrice?: number | string | null;
  closePrice?: number | string | null;
  profit?: number | string | null;
  openTime?: Date | string | null;
  closeTime?: Date | string | null;
  ticket?: string | null;
  originType?: TradeOriginType | string | null;
  useBrokerData?: number | boolean | null;
};

export type ManualTradeReconciliationCandidate = {
  candidate: ManualTradeReferenceCandidate;
  score: number;
  reasons: string[];
  deltas: {
    symbol?: number;
    tradeType?: number;
    openTimeSeconds?: number;
    closeTimeSeconds?: number;
    volume?: number;
    openPrice?: number;
    closePrice?: number;
    profit?: number;
    ticket?: number;
  };
};
