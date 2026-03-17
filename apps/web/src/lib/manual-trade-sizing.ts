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

  if (root && ["ZN", "ZF", "ZT", "ZB", "UB"].includes(root)) {
    return "rates";
  }

  if (
    root &&
    ["ZC", "XC", "ZW", "KE", "ZS", "XK", "KC", "SB", "CC", "CT", "LE", "HE"].includes(
      root
    )
  ) {
    return "agriculture";
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
      ...(override ?? {}),
      ...((preferences?.[assetClass] as object | undefined) ?? {}),
      quickSizes: override?.quickSizes ?? baseProfile.quickSizes,
    } satisfies ManualTradeSizingProfile,
  };
}

export function getEstimatedPipSize(symbol: string) {
  const normalized = normalizeSymbol(symbol);
  const assetClass = inferManualTradeAssetClass(symbol);

  if (normalized.includes("JPY")) return 0.01;
  if (normalized.startsWith("XAU")) return 0.1;
  if (normalized.startsWith("XAG")) return 0.01;
  if (assetClass === "indices") return 1;
  if (assetClass === "energy") return 0.01;
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
