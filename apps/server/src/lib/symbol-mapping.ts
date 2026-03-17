import { desc, eq } from "drizzle-orm";

import { db } from "../db";
import { symbolMapping } from "../db/schema/trading";

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

const METAL_CODES = new Set(["XAU", "XAG", "XPT", "XPD"]);
const CRYPTO_STABLE_QUOTES = ["USDT", "USDC", "BUSD", "USDP", "DAI", "TUSD"];
const FUTURES_ROOT_PATTERN = /^([A-Z0-9]{1,5})([FGHJKMNQUVXZ])(\d{1,4})$/;

export type SymbolAssetClass =
  | "forex"
  | "indices"
  | "metals"
  | "energy"
  | "crypto"
  | "rates"
  | "agriculture"
  | "equity"
  | "other";

export type UserSymbolMappingRow = {
  id: string;
  canonicalSymbol: string;
  aliases: string[];
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

type BuiltInSymbolDefinition = {
  canonicalSymbol: string;
  assetClass: SymbolAssetClass;
  aliases: string[];
  futuresRoots?: string[];
};

type LookupEntry = {
  canonicalSymbol: string;
  assetClass: SymbolAssetClass;
  source: "custom" | "base";
};

export type ResolvedSymbol = {
  canonicalSymbol: string;
  assetClass: SymbolAssetClass;
  source: "custom" | "base" | "derived" | "raw";
};

export type SymbolGroupSummary = {
  canonicalSymbol: string;
  assetClass: SymbolAssetClass;
  displaySymbol: string;
  totalCount: number;
};

export const BUILT_IN_SYMBOL_MAPPINGS: BuiltInSymbolDefinition[] = [
  {
    canonicalSymbol: "NAS100",
    assetClass: "indices",
    aliases: [
      "NAS100",
      "NASDAQ100",
      "US100",
      "USTEC",
      "NDX100",
      "NAS100.CASH",
      "US100.CASH",
      "USTEC.CASH",
      "NASDAQ.CASH",
      "NASDAQ100.CASH",
    ],
    futuresRoots: ["NQ", "MNQ"],
  },
  {
    canonicalSymbol: "SPX500",
    assetClass: "indices",
    aliases: [
      "SPX500",
      "SP500",
      "US500",
      "USA500",
      "S&P500",
      "SPX",
      "SPX500.CASH",
      "SP500.CASH",
      "US500.CASH",
      "USA500.CASH",
    ],
    futuresRoots: ["ES", "MES"],
  },
  {
    canonicalSymbol: "US30",
    assetClass: "indices",
    aliases: [
      "US30",
      "DJ30",
      "DJI30",
      "DOW30",
      "WALLSTREET30",
      "US30.CASH",
      "DJ30.CASH",
      "DOW.CASH",
      "WS30",
    ],
    futuresRoots: ["YM", "MYM"],
  },
  {
    canonicalSymbol: "US2000",
    assetClass: "indices",
    aliases: [
      "US2000",
      "RUSSELL2000",
      "RUS2000",
      "RUT2000",
      "US2000.CASH",
      "RUSSELL.CASH",
    ],
    futuresRoots: ["RTY", "M2K"],
  },
  {
    canonicalSymbol: "DE40",
    assetClass: "indices",
    aliases: [
      "DE40",
      "GER40",
      "DAX40",
      "DAX",
      "GERMANY40",
      "DE40.CASH",
      "GER40.CASH",
      "DAX40.CASH",
    ],
    futuresRoots: ["FDAX", "DAX", "FDXM"],
  },
  {
    canonicalSymbol: "EU50",
    assetClass: "indices",
    aliases: [
      "EU50",
      "EUSTX50",
      "EURO50",
      "STOXX50",
      "EU50.CASH",
      "STOXX50.CASH",
    ],
    futuresRoots: ["FESX"],
  },
  {
    canonicalSymbol: "UK100",
    assetClass: "indices",
    aliases: [
      "UK100",
      "FTSE100",
      "FTSE",
      "UK100.CASH",
      "FTSE100.CASH",
    ],
  },
  {
    canonicalSymbol: "JP225",
    assetClass: "indices",
    aliases: [
      "JP225",
      "JPN225",
      "NIKKEI225",
      "JAPAN225",
      "JP225.CASH",
      "JPN225.CASH",
      "N225",
    ],
    futuresRoots: ["NKD", "NIY", "NK"],
  },
  {
    canonicalSymbol: "HK50",
    assetClass: "indices",
    aliases: [
      "HK50",
      "HSI50",
      "HANGSENG",
      "HK50.CASH",
      "HSI.CASH",
    ],
    futuresRoots: ["HSI", "MHI"],
  },
  {
    canonicalSymbol: "AUS200",
    assetClass: "indices",
    aliases: [
      "AUS200",
      "AU200",
      "ASX200",
      "SPI200",
      "AUS200.CASH",
      "AU200.CASH",
    ],
    futuresRoots: ["AP"],
  },
  {
    canonicalSymbol: "CN50",
    assetClass: "indices",
    aliases: [
      "CN50",
      "CHINA50",
      "A50",
      "CN50.CASH",
      "CHINA50.CASH",
    ],
  },
  {
    canonicalSymbol: "FR40",
    assetClass: "indices",
    aliases: [
      "FR40",
      "CAC40",
      "FRANCE40",
      "FR40.CASH",
      "CAC40.CASH",
    ],
    futuresRoots: ["FCE"],
  },
  {
    canonicalSymbol: "IT40",
    assetClass: "indices",
    aliases: [
      "IT40",
      "FTSEMIB",
      "ITALY40",
      "IT40.CASH",
      "MIB40",
    ],
    futuresRoots: ["FIB"],
  },
  {
    canonicalSymbol: "ES35",
    assetClass: "indices",
    aliases: [
      "ES35",
      "IBEX35",
      "SPAIN35",
      "ES35.CASH",
      "IBEX35.CASH",
    ],
  },
  {
    canonicalSymbol: "VIX",
    assetClass: "indices",
    aliases: ["VIX", "VOLX", "VIX.CASH", "VOLATILITY75"],
    futuresRoots: ["VX", "VXM"],
  },
  {
    canonicalSymbol: "DXY",
    assetClass: "indices",
    aliases: ["DXY", "USDX", "DOLLARINDEX", "DXY.CASH"],
    futuresRoots: ["DX"],
  },
  {
    canonicalSymbol: "XAUUSD",
    assetClass: "metals",
    aliases: ["XAUUSD", "GOLD", "GOLDUSD", "XAU/USD", "XAUUSD.CASH"],
    futuresRoots: ["GC", "MGC"],
  },
  {
    canonicalSymbol: "XAGUSD",
    assetClass: "metals",
    aliases: ["XAGUSD", "SILVER", "SILVERUSD", "XAG/USD"],
    futuresRoots: ["SI", "SIL"],
  },
  {
    canonicalSymbol: "XPTUSD",
    assetClass: "metals",
    aliases: ["XPTUSD", "PLATINUM", "PLATINUMUSD", "XPT/USD"],
    futuresRoots: ["PL"],
  },
  {
    canonicalSymbol: "XPDUSD",
    assetClass: "metals",
    aliases: ["XPDUSD", "PALLADIUM", "PALLADIUMUSD", "XPD/USD"],
    futuresRoots: ["PA"],
  },
  {
    canonicalSymbol: "USOIL",
    assetClass: "energy",
    aliases: [
      "USOIL",
      "WTI",
      "WTIUSD",
      "CRUDE",
      "XTIUSD",
      "USOIL.CASH",
      "WTI.CASH",
    ],
    futuresRoots: ["CL", "MCL"],
  },
  {
    canonicalSymbol: "UKOIL",
    assetClass: "energy",
    aliases: [
      "UKOIL",
      "BRENT",
      "BRENTUSD",
      "XBRUSD",
      "UKOIL.CASH",
      "BRENT.CASH",
      "BRN",
    ],
    futuresRoots: ["BRN", "BZ"],
  },
  {
    canonicalSymbol: "NGAS",
    assetClass: "energy",
    aliases: [
      "NGAS",
      "NATGAS",
      "NATURALGAS",
      "XNGUSD",
      "NGAS.CASH",
      "NATGAS.CASH",
    ],
    futuresRoots: ["NG", "QG"],
  },
  {
    canonicalSymbol: "COPPER",
    assetClass: "metals",
    aliases: ["COPPER", "XCUUSD", "COPPERUSD"],
    futuresRoots: ["HG", "MHG"],
  },
  {
    canonicalSymbol: "BTCUSD",
    assetClass: "crypto",
    aliases: [
      "BTCUSD",
      "XBTUSD",
      "BTCUSDT",
      "BTCUSDC",
      "BTC-USD",
      "BTC/USD",
    ],
    futuresRoots: ["BTC", "MBT"],
  },
  {
    canonicalSymbol: "ETHUSD",
    assetClass: "crypto",
    aliases: ["ETHUSD", "ETHUSDT", "ETHUSDC", "ETH-USD", "ETH/USD"],
    futuresRoots: ["ETH", "MET"],
  },
  {
    canonicalSymbol: "SOLUSD",
    assetClass: "crypto",
    aliases: ["SOLUSD", "SOLUSDT", "SOLUSDC", "SOL-USD", "SOL/USD"],
  },
  {
    canonicalSymbol: "XRPUSD",
    assetClass: "crypto",
    aliases: ["XRPUSD", "XRPUSDT", "XRPUSDC", "XRP-USD", "XRP/USD"],
  },
  {
    canonicalSymbol: "ADAUSD",
    assetClass: "crypto",
    aliases: ["ADAUSD", "ADAUSDT", "ADAUSDC", "ADA-USD", "ADA/USD"],
  },
  {
    canonicalSymbol: "DOGEUSD",
    assetClass: "crypto",
    aliases: ["DOGEUSD", "DOGEUSDT", "DOGEUSDC", "DOGE-USD", "DOGE/USD"],
  },
  {
    canonicalSymbol: "EURUSD",
    assetClass: "forex",
    aliases: ["EURUSD"],
    futuresRoots: ["6E", "M6E"],
  },
  {
    canonicalSymbol: "GBPUSD",
    assetClass: "forex",
    aliases: ["GBPUSD"],
    futuresRoots: ["6B", "M6B"],
  },
  {
    canonicalSymbol: "AUDUSD",
    assetClass: "forex",
    aliases: ["AUDUSD"],
    futuresRoots: ["6A", "M6A"],
  },
  {
    canonicalSymbol: "NZDUSD",
    assetClass: "forex",
    aliases: ["NZDUSD"],
    futuresRoots: ["6N", "M6N"],
  },
  {
    canonicalSymbol: "USDCAD",
    assetClass: "forex",
    aliases: ["USDCAD"],
    futuresRoots: ["6C", "M6C"],
  },
  {
    canonicalSymbol: "USDJPY",
    assetClass: "forex",
    aliases: ["USDJPY"],
    futuresRoots: ["6J", "MJY"],
  },
  {
    canonicalSymbol: "USDCHF",
    assetClass: "forex",
    aliases: ["USDCHF"],
    futuresRoots: ["6S", "M6S"],
  },
  {
    canonicalSymbol: "US10Y",
    assetClass: "rates",
    aliases: ["US10Y", "10YYIELD", "TNX"],
    futuresRoots: ["ZN"],
  },
  {
    canonicalSymbol: "US5Y",
    assetClass: "rates",
    aliases: ["US5Y", "5YYIELD"],
    futuresRoots: ["ZF"],
  },
  {
    canonicalSymbol: "US2Y",
    assetClass: "rates",
    aliases: ["US2Y", "2YYIELD"],
    futuresRoots: ["ZT"],
  },
  {
    canonicalSymbol: "US30Y",
    assetClass: "rates",
    aliases: ["US30Y", "30YYIELD"],
    futuresRoots: ["ZB", "UB"],
  },
  {
    canonicalSymbol: "CORN",
    assetClass: "agriculture",
    aliases: ["CORN", "CORNUSD"],
    futuresRoots: ["ZC", "XC"],
  },
  {
    canonicalSymbol: "WHEAT",
    assetClass: "agriculture",
    aliases: ["WHEAT", "WHEATUSD"],
    futuresRoots: ["ZW", "KE"],
  },
  {
    canonicalSymbol: "SOYBEAN",
    assetClass: "agriculture",
    aliases: ["SOYBEAN", "SOYBEANS", "SOYBEANUSD"],
    futuresRoots: ["ZS", "XK"],
  },
  {
    canonicalSymbol: "COFFEE",
    assetClass: "agriculture",
    aliases: ["COFFEE", "COFFEEUSD"],
    futuresRoots: ["KC"],
  },
  {
    canonicalSymbol: "SUGAR",
    assetClass: "agriculture",
    aliases: ["SUGAR", "SUGARUSD"],
    futuresRoots: ["SB"],
  },
  {
    canonicalSymbol: "COCOA",
    assetClass: "agriculture",
    aliases: ["COCOA", "COCOAUSD"],
    futuresRoots: ["CC"],
  },
  {
    canonicalSymbol: "COTTON",
    assetClass: "agriculture",
    aliases: ["COTTON", "COTTONUSD"],
    futuresRoots: ["CT"],
  },
  {
    canonicalSymbol: "LIVECATTLE",
    assetClass: "agriculture",
    aliases: ["LIVECATTLE", "CATTLE"],
    futuresRoots: ["LE"],
  },
  {
    canonicalSymbol: "LEANHOGS",
    assetClass: "agriculture",
    aliases: ["LEANHOGS", "HOGS"],
    futuresRoots: ["HE"],
  },
];

function normalizeSymbolToken(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function toLooseSymbolKey(value: string | null | undefined) {
  return normalizeSymbolToken(value).replace(/[^A-Z0-9]/g, "");
}

function normalizeAliasList(values: string[] | null | undefined) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => normalizeSymbolToken(value))
        .filter((value) => value.length > 0)
    )
  );
}

function addLookupKeys(target: Map<string, LookupEntry>, value: string, entry: LookupEntry) {
  const normalized = normalizeSymbolToken(value);
  if (normalized && !target.has(normalized)) {
    target.set(normalized, entry);
  }

  const loose = toLooseSymbolKey(value);
  if (loose && !target.has(loose)) {
    target.set(loose, entry);
  }
}

function buildBaseLookup() {
  const byKey = new Map<string, LookupEntry>();
  const byRoot = new Map<string, LookupEntry>();

  for (const definition of BUILT_IN_SYMBOL_MAPPINGS) {
    const entry: LookupEntry = {
      canonicalSymbol: definition.canonicalSymbol,
      assetClass: definition.assetClass,
      source: "base",
    };

    addLookupKeys(byKey, definition.canonicalSymbol, entry);
    for (const alias of definition.aliases) {
      addLookupKeys(byKey, alias, entry);
    }

    for (const root of definition.futuresRoots ?? []) {
      const normalizedRoot = normalizeSymbolToken(root);
      if (normalizedRoot && !byRoot.has(normalizedRoot)) {
        byRoot.set(normalizedRoot, entry);
      }
    }
  }

  return { byKey, byRoot };
}

const BASE_LOOKUP = buildBaseLookup();

function buildUserLookup(userMappings: UserSymbolMappingRow[]) {
  const lookup = new Map<string, LookupEntry>();

  for (const mappingRow of userMappings) {
    const canonicalSymbol = normalizeCanonicalSymbol(mappingRow.canonicalSymbol);
    if (!canonicalSymbol) continue;

    const entry: LookupEntry = {
      canonicalSymbol,
      assetClass: inferSymbolAssetClass(canonicalSymbol) ?? "other",
      source: "custom",
    };

    addLookupKeys(lookup, canonicalSymbol, entry);
    for (const alias of normalizeAliasList(mappingRow.aliases)) {
      addLookupKeys(lookup, alias, entry);
    }
  }

  return lookup;
}

function lookupExactSymbol(
  rawSymbol: string,
  lookup: Map<string, LookupEntry>
): LookupEntry | null {
  const normalized = normalizeSymbolToken(rawSymbol);
  if (normalized) {
    const match = lookup.get(normalized);
    if (match) return match;
  }

  const loose = toLooseSymbolKey(rawSymbol);
  if (!loose) return null;
  return lookup.get(loose) ?? null;
}

function deriveForexOrMetalSymbol(rawSymbol: string): ResolvedSymbol | null {
  const loose = toLooseSymbolKey(rawSymbol);
  if (loose.length < 6) return null;

  const base = loose.slice(0, 3);
  const quote = loose.slice(3, 6);

  if (FX_CURRENCIES.has(base) && FX_CURRENCIES.has(quote)) {
    return {
      canonicalSymbol: `${base}${quote}`,
      assetClass: "forex",
      source: "derived",
    };
  }

  if (METAL_CODES.has(base) && FX_CURRENCIES.has(quote)) {
    return {
      canonicalSymbol: `${base}${quote}`,
      assetClass: "metals",
      source: "derived",
    };
  }

  return null;
}

function deriveCryptoSymbol(rawSymbol: string): ResolvedSymbol | null {
  const loose = toLooseSymbolKey(rawSymbol);
  if (!loose) return null;

  const exactBase = lookupExactSymbol(loose, BASE_LOOKUP.byKey);
  if (exactBase && exactBase.assetClass === "crypto") {
    return {
      canonicalSymbol: exactBase.canonicalSymbol,
      assetClass: exactBase.assetClass,
      source: "base",
    };
  }

  for (const stableQuote of CRYPTO_STABLE_QUOTES) {
    if (!loose.endsWith(stableQuote) || loose.length <= stableQuote.length + 1) {
      continue;
    }

    const base = loose.slice(0, -stableQuote.length);
    if (!/^[A-Z0-9]{2,12}$/.test(base)) {
      continue;
    }

    return {
      canonicalSymbol: `${base}USD`,
      assetClass: "crypto",
      source: "derived",
    };
  }

  return null;
}

function deriveFuturesRootSymbol(rawSymbol: string): ResolvedSymbol | null {
  const loose = toLooseSymbolKey(rawSymbol);
  if (!loose) return null;

  const matched = loose.match(FUTURES_ROOT_PATTERN);
  if (!matched) return null;

  const entry = BASE_LOOKUP.byRoot.get(matched[1]);
  if (!entry) return null;

  return {
    canonicalSymbol: entry.canonicalSymbol,
    assetClass: entry.assetClass,
    source: "base",
  };
}

export function normalizeCanonicalSymbol(value: string | null | undefined) {
  return normalizeSymbolToken(value);
}

export function normalizeSymbolAliases(values: string[] | null | undefined) {
  return normalizeAliasList(values);
}

export function inferSymbolAssetClass(value: string | null | undefined) {
  const exact = lookupExactSymbol(String(value || ""), BASE_LOOKUP.byKey);
  if (exact) {
    return exact.assetClass;
  }

  const futures = deriveFuturesRootSymbol(String(value || ""));
  if (futures) {
    return futures.assetClass;
  }

  const fx = deriveForexOrMetalSymbol(String(value || ""));
  if (fx) {
    return fx.assetClass;
  }

  const crypto = deriveCryptoSymbol(String(value || ""));
  if (crypto) {
    return crypto.assetClass;
  }

  return null;
}

export function resolveSymbol(
  rawSymbol: string | null | undefined,
  userMappings: UserSymbolMappingRow[] = []
): ResolvedSymbol {
  return createSymbolResolver(userMappings).resolve(rawSymbol);
}

export function createSymbolResolver(userMappings: UserSymbolMappingRow[] = []) {
  const userLookup = buildUserLookup(userMappings);

  return {
    resolve(rawSymbol: string | null | undefined): ResolvedSymbol {
      const normalized = normalizeSymbolToken(rawSymbol);
      if (!normalized) {
        return {
          canonicalSymbol: "(UNKNOWN)",
          assetClass: "other",
          source: "raw",
        };
      }

      const customMatch = lookupExactSymbol(normalized, userLookup);
      if (customMatch) {
        return {
          canonicalSymbol: customMatch.canonicalSymbol,
          assetClass: customMatch.assetClass,
          source: "custom",
        };
      }

      const fx = deriveForexOrMetalSymbol(normalized);
      if (fx) {
        return fx;
      }

      const exactBase = lookupExactSymbol(normalized, BASE_LOOKUP.byKey);
      if (exactBase) {
        return {
          canonicalSymbol: exactBase.canonicalSymbol,
          assetClass: exactBase.assetClass,
          source: "base",
        };
      }

      const futures = deriveFuturesRootSymbol(normalized);
      if (futures) {
        return futures;
      }

      const crypto = deriveCryptoSymbol(normalized);
      if (crypto) {
        return crypto;
      }

      return {
        canonicalSymbol: normalized,
        assetClass: "other",
        source: "raw",
      };
    },
  };
}

export function expandCanonicalSymbolsToRawSymbols(
  rawSymbols: Iterable<string>,
  selectedCanonicalSymbols: string[],
  userMappings: UserSymbolMappingRow[] = []
) {
  const resolver = createSymbolResolver(userMappings);
  const selectedKeys = new Set<string>();

  for (const value of selectedCanonicalSymbols) {
    const normalized = normalizeCanonicalSymbol(value);
    if (normalized) {
      selectedKeys.add(normalized);
    }

    const loose = toLooseSymbolKey(value);
    if (loose) {
      selectedKeys.add(loose);
    }

    const resolved = resolver.resolve(value);
    const resolvedNormalized = normalizeCanonicalSymbol(
      resolved.canonicalSymbol
    );
    if (resolvedNormalized) {
      selectedKeys.add(resolvedNormalized);
    }

    const resolvedLoose = toLooseSymbolKey(resolved.canonicalSymbol);
    if (resolvedLoose) {
      selectedKeys.add(resolvedLoose);
    }
  }

  const matches = new Set<string>();
  for (const rawSymbol of rawSymbols) {
    const resolved = resolver.resolve(rawSymbol);
    const normalizedCanonical = normalizeCanonicalSymbol(resolved.canonicalSymbol);
    const looseCanonical = toLooseSymbolKey(resolved.canonicalSymbol);

    if (
      (normalizedCanonical && selectedKeys.has(normalizedCanonical)) ||
      (looseCanonical && selectedKeys.has(looseCanonical))
    ) {
      matches.add(rawSymbol);
    }
  }

  return Array.from(matches);
}

export function summarizeSymbolGroups(
  rawSymbols: Iterable<string>,
  userMappings: UserSymbolMappingRow[] = []
) {
  const resolver = createSymbolResolver(userMappings);
  const groups = new Map<
    string,
    {
      canonicalSymbol: string;
      assetClass: SymbolAssetClass;
      totalCount: number;
      aliases: Map<string, number>;
    }
  >();

  for (const rawSymbol of rawSymbols) {
    const trimmedRaw = String(rawSymbol || "").trim();
    const normalizedRaw = normalizeCanonicalSymbol(rawSymbol);
    if (!normalizedRaw) continue;

    const resolved = resolver.resolve(normalizedRaw);
    const existing = groups.get(resolved.canonicalSymbol) ?? {
      canonicalSymbol: resolved.canonicalSymbol,
      assetClass: resolved.assetClass,
      totalCount: 0,
      aliases: new Map<string, number>(),
    };

    existing.totalCount += 1;
    existing.aliases.set(
      trimmedRaw || normalizedRaw,
      (existing.aliases.get(trimmedRaw || normalizedRaw) ?? 0) + 1
    );
    groups.set(resolved.canonicalSymbol, existing);
  }

  return Array.from(groups.values()).map((group) => {
    const displaySymbol =
      Array.from(group.aliases.entries()).sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }
        return left[0].localeCompare(right[0]);
      })[0]?.[0] ?? group.canonicalSymbol;

    return {
      canonicalSymbol: group.canonicalSymbol,
      assetClass: group.assetClass,
      displaySymbol,
      totalCount: group.totalCount,
    } satisfies SymbolGroupSummary;
  });
}

export function listBuiltInSymbolMappings() {
  return BUILT_IN_SYMBOL_MAPPINGS.map((definition) => ({
    canonicalSymbol: definition.canonicalSymbol,
    assetClass: definition.assetClass,
    aliases: [...definition.aliases],
    futuresRoots: [...(definition.futuresRoots ?? [])],
  }));
}

export async function listUserSymbolMappings(userId: string) {
  const rows = await db
    .select({
      id: symbolMapping.id,
      canonicalSymbol: symbolMapping.canonicalSymbol,
      aliases: symbolMapping.aliases,
      createdAt: symbolMapping.createdAt,
      updatedAt: symbolMapping.updatedAt,
    })
    .from(symbolMapping)
    .where(eq(symbolMapping.userId, userId))
    .orderBy(desc(symbolMapping.updatedAt), desc(symbolMapping.createdAt));

  return rows.map((row) => ({
    id: row.id,
    canonicalSymbol: normalizeCanonicalSymbol(row.canonicalSymbol),
    aliases: normalizeAliasList(row.aliases),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })) as UserSymbolMappingRow[];
}
