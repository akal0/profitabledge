import {
  inferManualTradeAssetClass,
  type ManualTradeAssetClass,
  type ManualTradeSizingProfile,
} from "@/lib/manual-trade-sizing";

export type ManualTradeMarketType =
  | "auto"
  | "forex"
  | "indices"
  | "commodities"
  | "crypto"
  | "futures";

export const COMMON_SYMBOLS = [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "USDCHF",
  "AUDUSD",
  "USDCAD",
  "NZDUSD",
  "XAUUSD",
  "XAGUSD",
  "US30",
  "NAS100",
  "SPX500",
  "BTCUSD",
  "ETHUSD",
];

export const MANUAL_FUTURES_SYMBOL_PATTERN =
  /^([A-Z0-9]{1,5})([FGHJKMNQUVXZ])(\d{1,4})$/;

export const MANUAL_MARKET_OPTIONS: Array<{
  value: ManualTradeMarketType;
  label: string;
}> = [
  { value: "auto", label: "Auto" },
  { value: "forex", label: "Forex" },
  { value: "indices", label: "Indices" },
  { value: "commodities", label: "Commodities" },
  { value: "crypto", label: "Crypto" },
  { value: "futures", label: "Futures" },
];

export function formatMarketTypeLabel(value: ManualTradeMarketType) {
  switch (value) {
    case "auto":
      return "Auto";
    case "forex":
      return "Forex";
    case "indices":
      return "Indices";
    case "commodities":
      return "Commodities";
    case "crypto":
      return "Crypto";
    case "futures":
      return "Futures";
    default:
      return "Auto";
  }
}

export function inferMarketTypeFromSymbol(
  symbol: string
): ManualTradeMarketType {
  const normalized = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!normalized) {
    return "auto";
  }

  if (MANUAL_FUTURES_SYMBOL_PATTERN.test(normalized)) {
    return "futures";
  }

  switch (inferManualTradeAssetClass(symbol)) {
    case "forex":
      return "forex";
    case "crypto":
      return "crypto";
    case "indices":
      return "indices";
    case "metals":
    case "energy":
      return "commodities";
    case "rates":
    case "agriculture":
      return "futures";
    default:
      return "auto";
  }
}

export function buildMarketSizingProfile(
  marketType: ManualTradeMarketType,
  profiles: Record<ManualTradeAssetClass, ManualTradeSizingProfile>
): { assetClass: ManualTradeAssetClass; profile: ManualTradeSizingProfile } {
  switch (marketType) {
    case "forex":
      return { assetClass: "forex", profile: profiles.forex };
    case "indices":
      return { assetClass: "indices", profile: profiles.indices };
    case "commodities":
      return {
        assetClass: "metals",
        profile: {
          ...profiles.metals,
          label: "Commodities",
          unitLabel: "lots",
          quickSizes: profiles.metals.quickSizes,
        },
      };
    case "crypto":
      return { assetClass: "crypto", profile: profiles.crypto };
    case "futures":
      return {
        assetClass: "other",
        profile: {
          label: "Futures",
          unitLabel: "contracts",
          defaultVolume: 1,
          minVolume: 1,
          volumeStep: 1,
          contractSize: 1,
          quickSizes: [1, 2, 3, 5],
        },
      };
    case "auto":
    default:
      return { assetClass: "forex", profile: profiles.forex };
  }
}

export function getSymbolPlaceholder(marketType: ManualTradeMarketType) {
  switch (marketType) {
    case "forex":
      return "Enter symbol (e.g. EURUSD)";
    case "indices":
      return "Enter symbol (e.g. NAS100)";
    case "commodities":
      return "Enter symbol (e.g. XAUUSD)";
    case "crypto":
      return "Enter symbol (e.g. BTCUSD)";
    case "futures":
      return "Enter contract (e.g. NQM26)";
    case "auto":
    default:
      return "Enter symbol (e.g. EURUSD)";
  }
}

export function createRoundedNow() {
  const now = new Date();
  now.setSeconds(0, 0);
  return now;
}

export function createDefaultTradeWindow() {
  const closeTime = createRoundedNow();
  const openTime = new Date(closeTime);
  openTime.setHours(openTime.getHours() - 1);
  return { openTime, closeTime };
}

export function parseNumberInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePositiveNumberInput(value: string) {
  const parsed = parseNumberInput(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

export function formatHoldDuration(openTime: Date, closeTime: Date) {
  const diffMs = Math.max(0, closeTime.getTime() - openTime.getTime());
  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}m`;
}

export function formatVolumeInputValue(value: number) {
  return Number.isFinite(value) ? String(value) : "";
}

export function formatAssetClassLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function numberToInputValue(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "" : String(value);
}
