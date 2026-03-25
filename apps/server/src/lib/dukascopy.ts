import { getHistoricalRates } from "dukascopy-node";
import { resolveSymbol } from "./symbol-mapping";

// Minimal symbol translation layer from broker/DB symbols to Dukascopy IDs

const FUTURES_ROOT_PATTERN = /^([A-Z0-9]{1,5})([FGHJKMNQUVXZ])(\d{1,4})$/;
const CONTRACT_SIZE_BY_FUTURES_ROOT: Record<string, number> = {
  NQ: 20,
  MNQ: 2,
  ES: 50,
  MES: 5,
  YM: 5,
  MYM: 0.5,
  RTY: 50,
  M2K: 5,
  GC: 100,
  MGC: 10,
  SI: 5_000,
  SIL: 1_000,
  PL: 50,
  PA: 100,
  HG: 25_000,
  MHG: 10_000,
  CL: 1_000,
  MCL: 100,
  BRN: 1_000,
  BZ: 1_000,
  NG: 10_000,
  QG: 10_000,
  "6E": 125_000,
  M6E: 12_500,
  "6B": 62_500,
  M6B: 6_250,
  "6A": 100_000,
  M6A: 10_000,
  "6N": 100_000,
  M6N: 10_000,
  "6C": 100_000,
  M6C: 10_000,
  "6J": 12_500_000,
  MJY: 1_250_000,
  "6S": 125_000,
  M6S: 12_500,
  ZN: 1_000,
  ZF: 1_000,
  ZT: 2_000,
  ZB: 1_000,
  UB: 1_000,
  ZC: 5_000,
  XC: 1_000,
  ZW: 5_000,
  KE: 5_000,
  ZS: 5_000,
  XK: 1_000,
  KC: 37_500,
  SB: 112_000,
  CC: 10,
  CT: 50_000,
  LE: 40_000,
  HE: 40_000,
  BTC: 5,
  MBT: 0.1,
  ETH: 50,
  MET: 0.1,
};
const CONTRACT_SIZE_BY_CANONICAL_SYMBOL: Record<string, number> = {
  XAUUSD: 100,
  XAGUSD: 5_000,
  XPTUSD: 50,
  XPDUSD: 100,
  USOIL: 1_000,
  UKOIL: 1_000,
  NGAS: 10_000,
};

function extractFuturesRoot(rawSymbol: string | null | undefined) {
  const loose = String(rawSymbol || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const matched = loose.match(FUTURES_ROOT_PATTERN);
  return matched?.[1] ?? null;
}

export function mapToDukascopyInstrument(
  rawSymbol: string | null | undefined
): { instrument: string | null; note?: string } {
  const s = String(rawSymbol || "").trim();
  if (!s) return { instrument: null, note: "empty" };
  const lower = s.toLowerCase();

  // Strip common suffixes/prefixes
  let base = lower
    .replace(/\.(cash|pro|mini|micro)$/g, "")
    .replace(/[-_\s]/g, "")
    .replace(/^fx:/, "")
    .replace(/^cfds?:/, "");

  // Common aliases → Dukascopy IDs (best-effort)
  const aliases: Record<string, string> = {
    // Forex majors
    eurusd: "eurusd",
    gbpusd: "gbpusd",
    usdchf: "usdchf",
    usdjpy: "usdjpy",
    eurjpy: "eurjpy",
    gbpjpy: "gbpjpy",
    audusd: "audusd",
    nzdusd: "nzdusd",
    // Metals
    xauusd: "xauusd",
    xagusd: "xagusd",
    gold: "xauusd",
    silver: "xagusd",
    // Index-like aliases (map to common shorthand if available in your setup)
    us100: "usatechidxusd",
    nas100: "usatechidxusd",
    nasdaq100: "usatechidxusd",
    us500: "us500",
    sp500: "usa500idxusd",
    spx500: "us500",
    us30: "us30",
    dow: "us30",
    dj30: "us30",
    ger30: "ger30",
    de30: "ger30",
    ger40: "ger30",
    de40: "ger30",
  };

  // Special cases
  if (base === "us100cash") base = "us100";
  if (base === "us500cash") base = "us500";
  if (base === "us30cash") base = "us30";

  const mapped = aliases[base] || base;
  return { instrument: mapped };
}

export function getPipSizeForSymbol(
  rawSymbol: string | null | undefined
): number {
  const s = String(rawSymbol || "").toLowerCase();
  if (!s) return 0.0001;

  const resolved = resolveSymbol(rawSymbol);
  const canonical = resolved.canonicalSymbol.toUpperCase();

  switch (resolved.assetClass) {
    case "forex":
      return canonical.includes("JPY") ? 0.01 : 0.0001;
    case "metals":
      return 0.01;
    case "indices":
      return 1;
    case "crypto":
      return 1;
    case "energy":
      return canonical === "NGAS" ? 0.001 : 0.01;
    case "rates":
      return 0.01;
    case "agriculture":
      return 0.01;
    default:
      break;
  }

  if (s.includes("jpy")) return 0.01;
  if (s.includes("xau")) return 0.01;
  if (s.includes("xag")) return 0.01;
  if (
    s.includes("idx") ||
    s.includes("us100") ||
    s.includes("nas100") ||
    s.includes("ustec") ||
    s.includes("us500") ||
    s.includes("spx500") ||
    s.includes("sp500") ||
    s.includes("us30") ||
    s.includes("ger30") ||
    s.includes("ger40")
  ) {
    return 1;
  }
  if (
    s.includes("btc") ||
    s.includes("eth") ||
    s.includes("sol") ||
    s.includes("xrp") ||
    s.includes("ada") ||
    s.includes("doge")
  ) {
    return 1;
  }
  return 0.0001;
}

// Contract size mapping for pip value calculations
// - Forex (incl. JPY): 100,000
// - Metals: 100
// - Indices: 1
export function getContractSizeForSymbol(
  rawSymbol: string | null | undefined
): number {
  const raw = String(rawSymbol || "").trim();
  if (!raw) return 100000;

  const futuresRoot = extractFuturesRoot(raw);
  if (futuresRoot && CONTRACT_SIZE_BY_FUTURES_ROOT[futuresRoot] != null) {
    return CONTRACT_SIZE_BY_FUTURES_ROOT[futuresRoot];
  }

  const resolved = resolveSymbol(rawSymbol);
  const canonical = resolved.canonicalSymbol.toUpperCase();
  if (CONTRACT_SIZE_BY_CANONICAL_SYMBOL[canonical] != null) {
    return CONTRACT_SIZE_BY_CANONICAL_SYMBOL[canonical];
  }

  switch (resolved.assetClass) {
    case "indices":
      return 1;
    case "metals":
      return 100;
    case "energy":
      return 1_000;
    case "crypto":
      return 1;
    case "rates":
    case "agriculture":
      return 1;
    default:
      return 100_000;
  }
}

/**
 * Get normalization factor for displaying pip values
 * Indices use points (1.0 pip size) but for display/comparison we normalize:
 * - US100/US500: Divide by 10 (100 points -> 10 "normalized pips")
 * - US30/GER30: Divide by 100 (100 points -> 1 "normalized pip")
 * - Metals/Forex: No change (already in pips)
 */
export function getPipNormalizationFactor(
  rawSymbol: string | null | undefined
): number {
  const s = String(rawSymbol || "").toLowerCase();
  if (!s) return 1;

  // US100 (Nasdaq) and US500 (S&P): 10 points = 1 normalized pip
  if (s.includes("us100") || s.includes("nas100") || s.includes("nasdaq")) return 10;
  if (s.includes("us500") || s.includes("spx") || s.includes("sp500")) return 10;

  // US30 (Dow), GER30/40 (DAX): 100 points = 1 normalized pip
  if (s.includes("us30") || s.includes("dow") || s.includes("dj30")) return 100;
  if (s.includes("ger30") || s.includes("ger40") || s.includes("de30") || s.includes("de40")) return 100;

  // Default: no normalization (forex, metals, etc.)
  return 1;
}

/**
 * Normalize pip value for display purposes
 * Converts raw pip values to normalized pips for better cross-instrument comparison
 */
export function normalizePipValue(
  pipValue: number,
  rawSymbol: string | null | undefined
): number {
  const factor = getPipNormalizationFactor(rawSymbol);
  return pipValue / factor;
}

export function calculateNormalizedPipsFromPriceDelta(
  priceDelta: number,
  rawSymbol: string | null | undefined
): number {
  if (!Number.isFinite(priceDelta)) {
    return 0;
  }

  const pipSize = getPipSizeForSymbol(rawSymbol);
  if (!(pipSize > 0)) {
    return 0;
  }

  return normalizePipValue(priceDelta / pipSize, rawSymbol);
}

// Dukascopy timeframe mapping
const dukascopyTimeframeMap: Record<string, string> = {
  m1: "m1",
  m5: "m5",
  m15: "m15",
  m30: "m30",
  h1: "h1",
  h4: "h4",
  d1: "d1",
  mn1: "mn1",
};

export interface DukascopyCandle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Fetch historical OHLCV candles from Dukascopy.
 * Returns candles sorted oldest-first with unix timestamps in seconds.
 */
export async function fetchDukascopyCandles(
  symbol: string,
  timeframe: string,
  from: Date,
  to: Date
): Promise<DukascopyCandle[]> {
  const { instrument } = mapToDukascopyInstrument(symbol);
  if (!instrument) {
    throw new Error(`Unknown symbol: ${symbol}`);
  }

  const tf = dukascopyTimeframeMap[timeframe] || "m5";

  const raw = (await getHistoricalRates({
    instrument,
    dates: { from, to },
    timeframe: tf as any,
    priceType: "bid",
    gmtOffset: 0,
    volumes: true,
    format: "json",
    batchSize: 10,
    pauseBetweenBatchesMs: 500,
  } as any)) as any[];

  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }

  return raw
    .map((r: any) => {
      // Handle both array format [ts, o, h, l, c, v] and object format {timestamp, open, ...}
      if (Array.isArray(r)) {
        const ts = typeof r[0] === "number" ? Math.floor(r[0] / 1000) : 0;
        return { time: ts, open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] ?? 0 };
      }
      const ts = typeof r.timestamp === "number"
        ? Math.floor(r.timestamp / 1000)
        : Math.floor(new Date(r.timestamp).getTime() / 1000);
      if (isNaN(ts)) return null;
      return { time: ts, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume ?? 0 };
    })
    .filter((c): c is DukascopyCandle => c !== null && c.time > 0);
}
