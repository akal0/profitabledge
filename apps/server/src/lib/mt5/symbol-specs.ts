import { and, desc, eq, or } from "drizzle-orm";
import { db } from "../../db";
import { brokerSymbolSpec } from "../../db/schema/mt5-sync";

const FX_CURRENCIES = new Set([
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "AUD",
  "NZD",
  "CAD",
  "CHF",
  "SGD",
  "HKD",
  "SEK",
  "NOK",
  "DKK",
  "TRY",
  "ZAR",
  "MXN",
]);

export interface MtSymbolSpecLike {
  symbol: string;
  canonicalSymbol?: string | null;
  pipSize?: string | number | null;
  pointSize?: string | number | null;
  tickSize?: string | number | null;
  digits?: number | null;
}

function toFiniteNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function normalizeBrokerSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

export function canonicalizeBrokerSymbol(symbol: string) {
  const normalized = normalizeBrokerSymbol(symbol);
  const alphanumeric = normalized.replace(/[^A-Z0-9]/g, "");
  const fxMatch = alphanumeric.match(/[A-Z]{6}/);
  if (fxMatch) {
    const base = fxMatch[0].slice(0, 3);
    const quote = fxMatch[0].slice(3, 6);
    if (FX_CURRENCIES.has(base) && FX_CURRENCIES.has(quote)) {
      return fxMatch[0];
    }
  }

  return normalized;
}

export function fallbackPipSize(symbol: string) {
  const upper = normalizeBrokerSymbol(symbol);
  if (upper.includes("JPY")) return 0.01;
  if (upper.startsWith("XAU") || upper.startsWith("XAG")) return 0.01;
  return 0.0001;
}

export function resolveBrokerPipSize(
  symbol: string,
  spec?: MtSymbolSpecLike | null
) {
  const directPipSize = toFiniteNumber(spec?.pipSize);
  if (directPipSize != null && directPipSize > 0) {
    return directPipSize;
  }

  const pointSize = toFiniteNumber(spec?.pointSize);
  const tickSize = toFiniteNumber(spec?.tickSize);
  const digits = spec?.digits ?? null;
  const canonical = canonicalizeBrokerSymbol(spec?.canonicalSymbol || symbol);
  const pointLike =
    pointSize != null && pointSize > 0
      ? pointSize
      : tickSize != null && tickSize > 0
        ? tickSize
        : null;

  if (canonical.includes("JPY")) {
    return 0.01;
  }

  if (canonical.startsWith("XAU") || canonical.startsWith("XAG")) {
    return pointLike != null && pointLike >= 0.01 ? pointLike : 0.01;
  }

  if (/^[A-Z]{6}$/.test(canonical)) {
    if (digits === 3 || digits === 5) {
      return pointLike != null ? pointLike * 10 : fallbackPipSize(canonical);
    }

    if (digits === 2 || digits === 4) {
      return pointLike != null ? pointLike : fallbackPipSize(canonical);
    }
  }

  if (pointLike != null && pointLike > 0) {
    return pointLike;
  }

  return fallbackPipSize(canonical);
}

export async function findBrokerSymbolSpec(
  accountId: string,
  symbol: string
): Promise<typeof brokerSymbolSpec.$inferSelect | null> {
  const normalized = normalizeBrokerSymbol(symbol);
  const canonical = canonicalizeBrokerSymbol(symbol);

  const rows = await db.query.brokerSymbolSpec.findMany({
    where: and(
      eq(brokerSymbolSpec.accountId, accountId),
      or(
        eq(brokerSymbolSpec.symbol, normalized),
        eq(brokerSymbolSpec.canonicalSymbol, canonical)
      )
    ),
    orderBy: desc(brokerSymbolSpec.snapshotTime),
    limit: 2,
  });

  return rows.find((row) => row.symbol === normalized) ?? rows[0] ?? null;
}

export async function getBrokerPipSize(
  accountId: string,
  symbol: string
): Promise<number> {
  const spec = await findBrokerSymbolSpec(accountId, symbol);
  return resolveBrokerPipSize(symbol, spec);
}
