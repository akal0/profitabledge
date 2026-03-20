const CURRENCY_SYMBOL_TO_CODE: Record<string, string> = {
  $: "USD",
  "£": "GBP",
  "€": "EUR",
};

// Snapshot rates expressed as USD value per 1 unit of the source currency.
// Used to normalize mixed-currency portfolio widgets onto one selected currency.
const USD_PER_UNIT: Record<string, number> = {
  USD: 1,
  GBP: 1.29,
  EUR: 1.09,
  JPY: 0.0067,
  AUD: 0.66,
  NZD: 0.61,
  CAD: 0.74,
  CHF: 1.13,
  SEK: 0.095,
  NOK: 0.095,
  DKK: 0.146,
  SGD: 0.74,
  HKD: 0.128,
  CNH: 0.138,
  TRY: 0.031,
  ZAR: 0.054,
  MXN: 0.059,
};

export function normalizeCurrencyCode(currencyCode?: string | null) {
  const raw = String(currencyCode ?? "").trim();
  if (!raw) return undefined;

  const symbolCurrency = CURRENCY_SYMBOL_TO_CODE[raw];
  if (symbolCurrency) return symbolCurrency;

  const normalized = raw.toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : undefined;
}

export function getCurrencyConversionRate(
  fromCurrencyCode?: string | null,
  toCurrencyCode?: string | null
) {
  const from = normalizeCurrencyCode(fromCurrencyCode);
  const to = normalizeCurrencyCode(toCurrencyCode);

  if (!from || !to || from === to) {
    return 1;
  }

  const fromUsdPerUnit = USD_PER_UNIT[from];
  const toUsdPerUnit = USD_PER_UNIT[to];

  if (!fromUsdPerUnit || !toUsdPerUnit) {
    return 1;
  }

  const rate = fromUsdPerUnit / toUsdPerUnit;
  return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

export function convertCurrencyAmount(
  amount: number,
  fromCurrencyCode?: string | null,
  toCurrencyCode?: string | null
) {
  if (!Number.isFinite(amount)) {
    return amount;
  }

  const rate = getCurrencyConversionRate(fromCurrencyCode, toCurrencyCode);
  const converted = amount * rate;
  return Number.isFinite(converted) ? converted : amount;
}
