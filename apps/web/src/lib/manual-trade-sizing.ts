"use client";

export type ManualTradeAssetClass =
  | "forex"
  | "indices"
  | "metals"
  | "energy"
  | "crypto"
  | "rates"
  | "agriculture"
  | "other";

export type ManualTradeSizingProfile = {
  label: string;
  unitLabel: string;
  defaultVolume: number;
  minVolume: number;
  volumeStep: number;
  contractSize: number;
  quickSizes: number[];
};

export type ManualTradeSizingPreferences = Partial<
  Record<
    ManualTradeAssetClass,
    Partial<
      Pick<
        ManualTradeSizingProfile,
        "defaultVolume" | "minVolume" | "volumeStep" | "contractSize"
      >
    >
  >
>;

const FX_CURRENCIES = new Set([
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "AUD",
  "NZD",
  "CAD",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "SGD",
  "HKD",
  "CNH",
  "TRY",
  "ZAR",
  "MXN",
]);

const SPOT_INDEX_ALIASES = [
  "NAS100",
  "US100",
  "USTEC",
  "SPX500",
  "US500",
  "SP500",
  "US30",
  "DJ30",
  "US2000",
  "DE40",
  "GER40",
  "EU50",
  "UK100",
  "JP225",
  "HK50",
  "AUS200",
  "CN50",
  "FR40",
  "IT40",
  "ES35",
  "VIX",
  "DXY",
];

const FUTURES_ROOT_PATTERN = /^([A-Z0-9]{1,5})([FGHJKMNQUVXZ])(\d{1,4})$/;
const INDEX_FUTURES_ROOTS = new Set([
  "NQ",
  "MNQ",
  "ES",
  "MES",
  "YM",
  "MYM",
  "RTY",
  "M2K",
  "FDAX",
  "DAX",
  "FDXM",
  "FESX",
  "NKD",
  "NIY",
  "NK",
  "HSI",
  "MHI",
  "AP",
  "FCE",
  "FIB",
  "VX",
  "VXM",
  "DX",
]);
const METAL_FUTURES_ROOTS = new Set([
  "GC",
  "MGC",
  "SI",
  "SIL",
  "PL",
  "PA",
  "HG",
  "MHG",
]);
const ENERGY_FUTURES_ROOTS = new Set(["CL", "MCL", "BRN", "BZ", "NG", "QG"]);
const CRYPTO_FUTURES_ROOTS = new Set(["BTC", "MBT", "ETH", "MET"]);
const FOREX_FUTURES_ROOTS = new Set([
  "6E",
  "M6E",
  "6B",
  "M6B",
  "6A",
  "M6A",
  "6N",
  "M6N",
  "6C",
  "M6C",
  "6J",
  "MJY",
  "6S",
  "M6S",
]);
const RATE_FUTURES_ROOTS = new Set(["ZN", "ZF", "ZT", "ZB", "UB"]);
const AGRICULTURE_FUTURES_ROOTS = new Set([
  "ZC",
  "XC",
  "ZW",
  "KE",
  "ZS",
  "XK",
  "KC",
  "SB",
  "CC",
  "CT",
  "LE",
  "HE",
]);

const DEFAULT_MANUAL_TRADE_SIZING: Record<
  ManualTradeAssetClass,
  ManualTradeSizingProfile
> = {
  forex: {
    label: "Forex",
    unitLabel: "lots",
    defaultVolume: 0.1,
    minVolume: 0.01,
    volumeStep: 0.01,
    contractSize: 100_000,
    quickSizes: [0.01, 0.1, 0.25, 0.5, 1],
  },
  indices: {
    label: "Indices",
    unitLabel: "contracts",
    defaultVolume: 1,
    minVolume: 0.1,
    volumeStep: 0.1,
    contractSize: 1,
    quickSizes: [0.1, 0.5, 1, 2, 5],
  },
  metals: {
    label: "Metals",
    unitLabel: "lots",
    defaultVolume: 0.1,
    minVolume: 0.01,
    volumeStep: 0.01,
    contractSize: 100,
    quickSizes: [0.01, 0.05, 0.1, 0.25, 0.5],
  },
  energy: {
    label: "Energy",
    unitLabel: "lots",
    defaultVolume: 0.1,
    minVolume: 0.01,
    volumeStep: 0.01,
    contractSize: 1_000,
    quickSizes: [0.01, 0.05, 0.1, 0.25, 0.5],
  },
  crypto: {
    label: "Crypto",
    unitLabel: "coins",
    defaultVolume: 1,
    minVolume: 0.01,
    volumeStep: 0.01,
    contractSize: 1,
    quickSizes: [0.01, 0.1, 0.5, 1, 2],
  },
  rates: {
    label: "Rates",
    unitLabel: "contracts",
    defaultVolume: 1,
    minVolume: 1,
    volumeStep: 1,
    contractSize: 1,
    quickSizes: [1, 2, 5, 10],
  },
  agriculture: {
    label: "Agriculture",
    unitLabel: "contracts",
    defaultVolume: 1,
    minVolume: 1,
    volumeStep: 1,
    contractSize: 1,
    quickSizes: [1, 2, 5, 10],
  },
  other: {
    label: "Other",
    unitLabel: "units",
    defaultVolume: 1,
    minVolume: 0.01,
    volumeStep: 0.01,
    contractSize: 1,
    quickSizes: [0.01, 0.1, 0.5, 1, 2],
  },
};

function normalizeSymbol(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function looseSymbol(value: string | null | undefined) {
  return normalizeSymbol(value).replace(/[^A-Z0-9]/g, "");
}

type SymbolSizingOverride = {
  assetClass: ManualTradeAssetClass;
  unitLabel?: string;
  minVolume?: number;
  volumeStep?: number;
  contractSize?: number;
  quickSizes?: number[];
};

const SYMBOL_SIZING_OVERRIDES: Array<{
  match: (symbol: string, loose: string, root: string | null) => boolean;
  override: SymbolSizingOverride;
}> = [
  {
    match: (symbol) => symbol.startsWith("XAG"),
    override: {
      assetClass: "metals",
      contractSize: 5_000,
    },
  },
  {
    match: (symbol, loose, root) =>
      symbol.includes("NGAS") ||
      symbol.includes("NATGAS") ||
      symbol.includes("NATURALGAS") ||
      root === "NG" ||
      root === "QG",
    override: {
      assetClass: "energy",
      contractSize: 10_000,
    },
  },
  {
    match: (_symbol, _loose, root) => root === "NQ",
    override: {
      assetClass: "indices",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 20,
      quickSizes: [1, 2, 3, 5],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "MNQ",
    override: {
      assetClass: "indices",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 2,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "ES",
    override: {
      assetClass: "indices",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 50,
      quickSizes: [1, 2, 3, 5],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "MES",
    override: {
      assetClass: "indices",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 5,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "YM",
    override: {
      assetClass: "indices",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 5,
      quickSizes: [1, 2, 3, 5],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "MYM",
    override: {
      assetClass: "indices",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 0.5,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "RTY",
    override: {
      assetClass: "indices",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 50,
      quickSizes: [1, 2, 3, 5],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "M2K",
    override: {
      assetClass: "indices",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 5,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "CL",
    override: {
      assetClass: "energy",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 1_000,
      quickSizes: [1, 2, 3, 5],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "MCL",
    override: {
      assetClass: "energy",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 100,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "GC",
    override: {
      assetClass: "metals",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 100,
      quickSizes: [1, 2, 3, 5],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "MGC",
    override: {
      assetClass: "metals",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 10,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "SI",
    override: {
      assetClass: "metals",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 5_000,
      quickSizes: [1, 2, 3, 5],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "SIL",
    override: {
      assetClass: "metals",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 1_000,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "PL",
    override: {
      assetClass: "metals",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 50,
      quickSizes: [1, 2, 3, 5],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "PA",
    override: {
      assetClass: "metals",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 100,
      quickSizes: [1, 2, 3, 5],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "HG",
    override: {
      assetClass: "metals",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 25_000,
      quickSizes: [1, 2, 3, 5],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "MHG",
    override: {
      assetClass: "metals",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 10_000,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "BRN" || root === "BZ",
    override: {
      assetClass: "energy",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 1_000,
      quickSizes: [1, 2, 3, 5],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "6E",
    override: {
      assetClass: "forex",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 125_000,
      quickSizes: [1, 2, 3, 5],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "M6E",
    override: {
      assetClass: "forex",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 12_500,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "6B",
    override: {
      assetClass: "forex",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 62_500,
      quickSizes: [1, 2, 3, 5],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "M6B",
    override: {
      assetClass: "forex",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 6_250,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "6A",
    override: {
      assetClass: "forex",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 100_000,
      quickSizes: [1, 2, 3, 5],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "M6A",
    override: {
      assetClass: "forex",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 10_000,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "6N",
    override: {
      assetClass: "forex",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 100_000,
      quickSizes: [1, 2, 3, 5],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "M6N",
    override: {
      assetClass: "forex",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 10_000,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "6C",
    override: {
      assetClass: "forex",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 100_000,
      quickSizes: [1, 2, 3, 5],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "M6C",
    override: {
      assetClass: "forex",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 10_000,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "6J",
    override: {
      assetClass: "forex",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 12_500_000,
      quickSizes: [1, 2, 3, 5],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "MJY",
    override: {
      assetClass: "forex",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 1_250_000,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "6S",
    override: {
      assetClass: "forex",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 125_000,
      quickSizes: [1, 2, 3, 5],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "M6S",
    override: {
      assetClass: "forex",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 12_500,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "ZN" || root === "ZF",
    override: {
      assetClass: "rates",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 1_000,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "ZT",
    override: {
      assetClass: "rates",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 2_000,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "ZB" || root === "UB",
    override: {
      assetClass: "rates",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 1_000,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "ZC",
    override: {
      assetClass: "agriculture",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 5_000,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "XC",
    override: {
      assetClass: "agriculture",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 1_000,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "ZW" || root === "KE",
    override: {
      assetClass: "agriculture",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 5_000,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "ZS",
    override: {
      assetClass: "agriculture",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 5_000,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "XK",
    override: {
      assetClass: "agriculture",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 1_000,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "KC",
    override: {
      assetClass: "agriculture",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 37_500,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "SB",
    override: {
      assetClass: "agriculture",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 112_000,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "CC",
    override: {
      assetClass: "agriculture",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 10,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "CT",
    override: {
      assetClass: "agriculture",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 50_000,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "LE" || root === "HE",
    override: {
      assetClass: "agriculture",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 40_000,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "BTC",
    override: {
      assetClass: "crypto",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 5,
      quickSizes: [1, 2, 3, 5],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "MBT",
    override: {
      assetClass: "crypto",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 0.1,
      quickSizes: [1, 2, 5, 10],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "ETH",
    override: {
      assetClass: "crypto",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 50,
      quickSizes: [1, 2, 3, 5],
    },
  },
  {
    match: (_symbol, _loose, root) => root === "MET",
    override: {
      assetClass: "crypto",
      unitLabel: "contracts",
      minVolume: 1,
      volumeStep: 1,
      contractSize: 0.1,
      quickSizes: [1, 2, 5, 10],
    },
  },
];

function extractFuturesRoot(symbol: string) {
  const matched = looseSymbol(symbol).match(FUTURES_ROOT_PATTERN);
  return matched?.[1] ?? null;
}

export function inferManualTradeAssetClass(symbol: string): ManualTradeAssetClass {
  const normalized = normalizeSymbol(symbol);
  const loose = looseSymbol(symbol);
  const root = extractFuturesRoot(symbol);

  const override = SYMBOL_SIZING_OVERRIDES.find((entry) =>
    entry.match(normalized, loose, root)
  );
  if (override) {
    return override.override.assetClass;
  }

  if (root && INDEX_FUTURES_ROOTS.has(root)) {
    return "indices";
  }

  if (root && METAL_FUTURES_ROOTS.has(root)) {
    return "metals";
  }

  if (root && ENERGY_FUTURES_ROOTS.has(root)) {
    return "energy";
  }

  if (root && CRYPTO_FUTURES_ROOTS.has(root)) {
    return "crypto";
  }

  if (root && FOREX_FUTURES_ROOTS.has(root)) {
    return "forex";
  }

  if (root && RATE_FUTURES_ROOTS.has(root)) {
    return "rates";
  }

  if (root && AGRICULTURE_FUTURES_ROOTS.has(root)) {
    return "agriculture";
  }

  if (
    SPOT_INDEX_ALIASES.some(
      (alias) => normalized.includes(alias) || loose.includes(alias)
    )
  ) {
    return "indices";
  }

  if (
    normalized.startsWith("XAU") ||
    normalized.startsWith("XAG") ||
    normalized.startsWith("XPT") ||
    normalized.startsWith("XPD") ||
    normalized.includes("GOLD") ||
    normalized.includes("SILVER")
  ) {
    return "metals";
  }

  if (
    normalized.includes("USOIL") ||
    normalized.includes("UKOIL") ||
    normalized.includes("BRENT") ||
    normalized.includes("WTI") ||
    normalized.includes("NGAS") ||
    normalized.includes("NATGAS")
  ) {
    return "energy";
  }

  if (
    normalized.includes("BTC") ||
    normalized.includes("ETH") ||
    normalized.includes("SOL") ||
    normalized.includes("XRP") ||
    normalized.includes("ADA") ||
    normalized.includes("DOGE") ||
    normalized.endsWith("USDT") ||
    normalized.endsWith("USDC")
  ) {
    return "crypto";
  }

  const base = loose.slice(0, 3);
  const quote = loose.slice(3, 6);
  if (FX_CURRENCIES.has(base) && FX_CURRENCIES.has(quote)) {
    return "forex";
  }

  return "other";
}

export function mergeManualTradeSizingPreferences(
  preferences?: ManualTradeSizingPreferences | null
) {
  const resolved = {} as Record<ManualTradeAssetClass, ManualTradeSizingProfile>;

  for (const [assetClass, defaults] of Object.entries(
    DEFAULT_MANUAL_TRADE_SIZING
  ) as Array<[ManualTradeAssetClass, ManualTradeSizingProfile]>) {
    const overrides = preferences?.[assetClass] ?? {};
    resolved[assetClass] = {
      ...defaults,
      ...overrides,
      quickSizes: defaults.quickSizes,
    };
  }

  return resolved;
}

export function resolveManualTradeSizing(
  symbol: string,
  preferences?: ManualTradeSizingPreferences | null
) {
  const normalized = normalizeSymbol(symbol);
  const loose = looseSymbol(symbol);
  const root = extractFuturesRoot(symbol);
  const assetClass = inferManualTradeAssetClass(symbol);
  const mergedProfiles = mergeManualTradeSizingPreferences(preferences);
  const baseProfile = mergedProfiles[assetClass];

  const override = SYMBOL_SIZING_OVERRIDES.find((entry) =>
    entry.match(normalized, loose, root)
  )?.override;

  return {
    assetClass,
    profile: {
      ...baseProfile,
      ...((preferences?.[assetClass] as object | undefined) ?? {}),
      ...(override ?? {}),
      quickSizes: override?.quickSizes ?? baseProfile.quickSizes,
    } satisfies ManualTradeSizingProfile,
  };
}

export function getEstimatedPipSize(symbol: string) {
  const normalized = normalizeSymbol(symbol);
  const root = extractFuturesRoot(symbol);
  const assetClass = inferManualTradeAssetClass(symbol);

  if (normalized.includes("JPY") || root === "6J" || root === "MJY") {
    return 0.01;
  }

  if (
    normalized.startsWith("XAU") ||
    root === "GC" ||
    root === "MGC" ||
    root === "PL" ||
    root === "PA"
  ) {
    return 0.1;
  }

  if (assetClass === "metals") return 0.01;
  if (assetClass === "indices") return 1;
  if (assetClass === "energy") return 0.01;
  if (assetClass === "rates" || assetClass === "agriculture") return 0.01;
  if (assetClass === "crypto") {
    return normalized.includes("BTC") ? 1 : 0.01;
  }

  return 0.0001;
}

export function formatSizingNumber(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: value >= 1 ? 0 : 2,
    maximumFractionDigits: value >= 1 ? 2 : 4,
  });
}
