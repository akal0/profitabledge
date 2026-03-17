type AccountTrustInput = {
  verificationLevel?: string | null;
  isVerified?: number | boolean | null;
  brokerType?: string | null;
  brokerServer?: string | null;
  lastImportedAt?: Date | string | null;
};

type TradeOriginInput = {
  originType?: string | null;
  brokerMeta?: Record<string, unknown> | null;
  ticket?: string | null;
  useBrokerData?: number | null;
  accountVerificationLevel?: string | null;
  accountIsVerified?: number | boolean | null;
};

export const TRADE_ORIGIN_VALUES = [
  "broker_sync",
  "csv_import",
  "manual_entry",
] as const;

export type TradeOriginType = (typeof TRADE_ORIGIN_VALUES)[number];

export const TRADE_TRUST_FIELD_KEYS = [
  "symbol",
  "tradeType",
  "volume",
  "openPrice",
  "closePrice",
  "sl",
  "tp",
  "profit",
  "commissions",
  "swap",
  "openTime",
  "closeTime",
] as const;

export type TradeTrustFieldKey = (typeof TRADE_TRUST_FIELD_KEYS)[number];
export type TradeTrustSnapshot = Record<TradeTrustFieldKey, string | null>;

function hasVerifiedFlag(value?: number | boolean | null) {
  return typeof value === "boolean" ? value : value === 1;
}

function readImportParserId(
  brokerMeta?: Record<string, unknown> | null
): string | null {
  const parserId = brokerMeta?.importParserId;
  return typeof parserId === "string" && parserId.trim().length > 0
    ? parserId
    : null;
}

function normalizeSnapshotValue(value: unknown) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function isTradeOriginType(value: unknown): value is TradeOriginType {
  return TRADE_ORIGIN_VALUES.includes(value as TradeOriginType);
}

export function getTradeOriginLabel(originType: TradeOriginType) {
  switch (originType) {
    case "broker_sync":
      return "Broker sync";
    case "csv_import":
      return "CSV import";
    case "manual_entry":
      return "Manual entry";
  }
}

export function resolveTradeOriginType(
  input: TradeOriginInput
): TradeOriginType {
  if (isTradeOriginType(input.originType)) {
    return input.originType;
  }

  if (
    readImportParserId(input.brokerMeta) ||
    String(input.ticket || "").startsWith("import-")
  ) {
    return "csv_import";
  }

  if ((input.useBrokerData ?? 0) === 1) {
    return "broker_sync";
  }

  if (
    input.accountVerificationLevel === "api_verified" ||
    input.accountVerificationLevel === "ea_synced" ||
    hasVerifiedFlag(input.accountIsVerified)
  ) {
    return "broker_sync";
  }

  return "manual_entry";
}

export function resolveAccountConnectionTrust(input: AccountTrustInput) {
  if (input.verificationLevel === "api_verified") {
    return { kind: "api_synced" as const, label: "API synced" };
  }

  if (
    input.verificationLevel === "ea_synced" ||
    hasVerifiedFlag(input.isVerified)
  ) {
    const brokerType = input.brokerType?.toLowerCase();
    if (brokerType === "mt5" || input.brokerServer) {
      return { kind: "mt5_synced" as const, label: "MT5 synced" };
    }

    if (brokerType === "mt4") {
      return { kind: "mt4_synced" as const, label: "MT4 synced" };
    }

    return { kind: "ea_synced" as const, label: "EA synced" };
  }

  if (input.lastImportedAt) {
    return { kind: "csv_imported" as const, label: "CSV imported" };
  }

  return { kind: "manual" as const, label: "Manual" };
}

export function buildTradeTrustSnapshot(
  row: Partial<Record<TradeTrustFieldKey, unknown>>
): TradeTrustSnapshot {
  return {
    symbol: normalizeSnapshotValue(row.symbol),
    tradeType: normalizeSnapshotValue(row.tradeType),
    volume: normalizeSnapshotValue(row.volume),
    openPrice: normalizeSnapshotValue(row.openPrice),
    closePrice: normalizeSnapshotValue(row.closePrice),
    sl: normalizeSnapshotValue(row.sl),
    tp: normalizeSnapshotValue(row.tp),
    profit: normalizeSnapshotValue(row.profit),
    commissions: normalizeSnapshotValue(row.commissions),
    swap: normalizeSnapshotValue(row.swap),
    openTime: normalizeSnapshotValue(row.openTime),
    closeTime: normalizeSnapshotValue(row.closeTime),
  };
}

export function getChangedTradeTrustFields(
  before: TradeTrustSnapshot,
  after: TradeTrustSnapshot
) {
  return TRADE_TRUST_FIELD_KEYS.filter((key) => before[key] !== after[key]);
}
