export type ManualTradeDirection = "long" | "short" | null;

export type ManualTradeCaptureSourceKind =
  | "free-text"
  | "delimited"
  | "headered-delimited";

export type ManualTradeCaptureFieldSource =
  | "regex"
  | "header"
  | "positional"
  | "derived";

export interface ManualTradeCaptureField<T> {
  value: T;
  source: ManualTradeCaptureFieldSource;
  confidence: number;
  raw?: string | null;
}

export interface ManualTradeCaptureFields {
  symbol: ManualTradeCaptureField<string | null>;
  direction: ManualTradeCaptureField<ManualTradeDirection>;
  volume: ManualTradeCaptureField<number | null>;
  openPrice: ManualTradeCaptureField<number | null>;
  closePrice: ManualTradeCaptureField<number | null>;
  stopLoss: ManualTradeCaptureField<number | null>;
  takeProfit: ManualTradeCaptureField<number | null>;
  profit: ManualTradeCaptureField<number | null>;
  commission: ManualTradeCaptureField<number | null>;
  swap: ManualTradeCaptureField<number | null>;
  openTime: ManualTradeCaptureField<Date | null>;
  closeTime: ManualTradeCaptureField<Date | null>;
  notes: ManualTradeCaptureField<string | null>;
}

export interface ManualTradeCaptureDerivedFields {
  isOpenTrade: ManualTradeCaptureField<boolean>;
  holdSeconds: ManualTradeCaptureField<number | null>;
  estimatedPips: ManualTradeCaptureField<number | null>;
  estimatedProfit: ManualTradeCaptureField<number | null>;
  netPnl: ManualTradeCaptureField<number | null>;
  riskPips: ManualTradeCaptureField<number | null>;
  targetPips: ManualTradeCaptureField<number | null>;
  plannedRR: ManualTradeCaptureField<number | null>;
}

export interface ManualTradeCaptureParseOptions {
  referenceDate?: Date;
  resolvePipSize?: (symbol: string) => number | null;
  resolveContractSize?: (symbol: string) => number | null;
}

export interface ManualTradeCaptureResult {
  kind: "single";
  rawText: string;
  sourceKind: ManualTradeCaptureSourceKind;
  delimiter: string | null;
  hasHeader: boolean;
  fields: ManualTradeCaptureFields;
  derived: ManualTradeCaptureDerivedFields;
  confidence: number;
  warnings: string[];
  residualText: string[];
}

export interface ManualTradeCaptureBulkResult {
  kind: "bulk";
  rawText: string;
  delimiter: string | null;
  hasHeader: boolean;
  header: string[];
  rows: ManualTradeCaptureResult[];
  warnings: string[];
}

export type ManualTradeCaptureParseResult =
  | ManualTradeCaptureResult
  | ManualTradeCaptureBulkResult;
