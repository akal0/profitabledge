// Minimal symbol translation layer from broker/DB symbols to Dukascopy IDs

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
  if (s.includes("jpy")) return 0.01;
  if (s.includes("xau")) return 0.01;
  if (s.includes("xag")) return 0.01;
  if (
    s.includes("idx") ||
    s.includes("us100") ||
    s.includes("us500") ||
    s.includes("us30") ||
    s.includes("ger30") ||
    s.includes("ger40")
  )
    return 1;
  return 0.0001;
}

// Contract size mapping for pip value calculations
// - Forex (incl. JPY): 100,000
// - Metals: 100
// - Indices: 1
export function getContractSizeForSymbol(
  rawSymbol: string | null | undefined
): number {
  const s = String(rawSymbol || "").toLowerCase();
  if (!s) return 100000;
  if (s.includes("xau") || s.includes("xag")) return 100; // metals
  if (
    s.includes("idx") ||
    s.includes("us100") ||
    s.includes("us500") ||
    s.includes("us30") ||
    s.includes("ger30") ||
    s.includes("ger40")
  )
    return 1; // indices
  return 100000; // default: forex
}
