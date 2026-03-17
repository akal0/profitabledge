import type { TradeRow } from "./trade-table-types";
import {
  formatTradePipValue,
  formatTradeTableCurrency,
  formatTradeTableDuration,
  formatTradeTableNumber,
  formatTradeTablePercent,
  formatTradeTablePrice,
} from "./trade-table-formatting";

const SEARCHABLE_TRADE_ROW_KEYS: Array<keyof TradeRow> = [
  "id",
  "ticket",
  "symbol",
  "tradeDirection",
  "sessionTag",
  "modelTag",
  "customTags",
  "protocolAlignment",
  "outcome",
  "complianceStatus",
  "complianceFlags",
  "open",
  "close",
  "openText",
  "closeText",
  "holdSeconds",
  "volume",
  "profit",
  "commissions",
  "swap",
  "tp",
  "sl",
  "openPrice",
  "closePrice",
  "pips",
  "killzone",
  "manipulationPips",
  "mfePips",
  "maePips",
  "entrySpreadPips",
  "exitSpreadPips",
  "entrySlippagePips",
  "exitSlippagePips",
  "slModCount",
  "tpModCount",
  "partialCloseCount",
  "exitDealCount",
  "exitVolume",
  "entryBalance",
  "entryEquity",
  "entryMargin",
  "entryFreeMargin",
  "entryMarginLevel",
  "entryDealCount",
  "entryVolume",
  "scaleInCount",
  "scaleOutCount",
  "trailingStopDetected",
  "entryPeakDurationSeconds",
  "postExitPeakDurationSeconds",
  "mpeManipLegR",
  "mpeManipPE_R",
  "maxRR",
  "drawdown",
  "realisedRR",
  "rrCaptureEfficiency",
  "manipRREfficiency",
  "rawSTDV",
  "rawSTDV_PE",
  "stdvBucket",
  "estimatedWeightedMPE_R",
  "plannedRR",
  "plannedRiskPips",
  "plannedTargetPips",
  "exitEfficiency",
  "isLive",
  "closeReason",
  "entrySource",
  "exitSource",
  "executionMode",
  "magicNumber",
];

const PIP_SEARCH_KEYS: Array<keyof TradeRow> = [
  "pips",
  "manipulationPips",
  "mfePips",
  "maePips",
  "plannedRiskPips",
  "plannedTargetPips",
  "entrySpreadPips",
  "exitSpreadPips",
  "entrySlippagePips",
  "exitSlippagePips",
];

const PRICE_SEARCH_KEYS: Array<keyof TradeRow> = [
  "tp",
  "sl",
  "openPrice",
  "closePrice",
];

const CURRENCY_SEARCH_KEYS: Array<keyof TradeRow> = [
  "profit",
  "commissions",
  "swap",
  "entryBalance",
  "entryEquity",
  "entryMargin",
  "entryFreeMargin",
];

const PERCENT_SEARCH_FIELDS: Array<{
  key: keyof TradeRow;
  labels: string[];
}> = [
  {
    key: "entryMarginLevel",
    labels: ["entry margin level", "margin level"],
  },
  {
    key: "rrCaptureEfficiency",
    labels: ["rr capture efficiency", "reward risk capture efficiency"],
  },
  {
    key: "manipRREfficiency",
    labels: ["manip rr efficiency", "manipulation reward risk efficiency"],
  },
  {
    key: "exitEfficiency",
    labels: ["exit efficiency", "exit timing"],
  },
];

const RISK_UNIT_SEARCH_FIELDS: Array<{
  key: keyof TradeRow;
  labels: string[];
}> = [
  {
    key: "mpeManipLegR",
    labels: ["mpe manipulation leg", "manipulation leg r"],
  },
  {
    key: "mpeManipPE_R",
    labels: ["mpe manipulation post exit", "manipulation post exit r"],
  },
  {
    key: "maxRR",
    labels: ["max rr", "maximum reward risk"],
  },
  {
    key: "realisedRR",
    labels: ["rr", "realised rr", "realized rr", "reward risk"],
  },
  {
    key: "estimatedWeightedMPE_R",
    labels: ["estimated weighted mpe", "estimated weighted mpe r"],
  },
  {
    key: "plannedRR",
    labels: ["planned rr", "planned reward risk"],
  },
];

const DATE_LOCALE = "en-GB";

const normalizeTradeSearchText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9.+-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const formatCompactTradeSearchNumber = (value: number, precision = 2) => {
  if (!Number.isFinite(value)) return "";
  const rounded = Number(value.toFixed(precision));
  if (!Number.isFinite(rounded)) return "";
  if (Object.is(rounded, -0)) return "0";
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString();
};

const isFiniteTradeNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const addSearchTerm = (terms: Set<string>, value: unknown): void => {
  if (value == null) return;

  if (Array.isArray(value)) {
    value.forEach((entry) => addSearchTerm(terms, entry));
    return;
  }

  if (typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((entry) => {
      addSearchTerm(terms, entry);
    });
    return;
  }

  const text = String(value).trim();
  if (text) {
    terms.add(text);
  }
};

const addLabelTerms = (terms: Set<string>, labels: string[]) => {
  labels.forEach((label) => addSearchTerm(terms, label));
};

const addDateTerms = (terms: Set<string>, value?: string | null) => {
  if (!value) return;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    addSearchTerm(terms, value);
    return;
  }

  addSearchTerm(terms, parsed.toISOString());
  addSearchTerm(terms, parsed.toLocaleDateString(DATE_LOCALE));
  addSearchTerm(
    terms,
    parsed.toLocaleDateString(DATE_LOCALE, {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  );
  addSearchTerm(
    terms,
    parsed.toLocaleDateString(DATE_LOCALE, {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  );
  addSearchTerm(
    terms,
    parsed.toLocaleTimeString(DATE_LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  );
};

const addDurationTerms = (terms: Set<string>, totalSeconds?: number | null) => {
  if (typeof totalSeconds !== "number" || !Number.isFinite(totalSeconds)) {
    return;
  }

  const safe = Math.max(0, Math.floor(totalSeconds));
  addSearchTerm(terms, formatTradeTableDuration(safe));
  addSearchTerm(terms, `${safe} seconds`);

  const minutes = Math.floor(safe / 60);
  const hours = Math.floor(safe / 3600);
  if (minutes > 0) {
    addSearchTerm(terms, `${minutes} minutes`);
  }
  if (hours > 0) {
    addSearchTerm(terms, `${hours} hours`);
  }
};

const addFormattedMetricTerms = (
  terms: Set<string>,
  trade: TradeRow,
  keys: Array<keyof TradeRow>,
  formatter: (value: number, trade: TradeRow) => string
) => {
  keys.forEach((key) => {
    const value = trade[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      addSearchTerm(terms, formatter(value, trade));
    }
  });
};

const addPercentSearchTerms = (
  terms: Set<string>,
  value: number | null | undefined,
  labels: string[]
) => {
  if (!isFiniteTradeNumber(value)) return;

  addLabelTerms(terms, labels);
  addSearchTerm(terms, formatTradeTablePercent(Math.round(value), 0));
  addSearchTerm(terms, `${formatCompactTradeSearchNumber(value)} percent`);
};

const addRiskUnitSearchTerms = (
  terms: Set<string>,
  value: number | null | undefined,
  labels: string[]
) => {
  if (!isFiniteTradeNumber(value)) return;

  const compact = formatCompactTradeSearchNumber(value);
  addLabelTerms(terms, labels);
  addSearchTerm(terms, `${compact}r`);
  addSearchTerm(terms, `${compact} rr`);
};

const getTradeDrawdownPercent = (trade: TradeRow) => {
  if (isFiniteTradeNumber(trade.drawdown)) {
    return trade.drawdown;
  }
  if (
    !isFiniteTradeNumber(trade.maePips) ||
    !isFiniteTradeNumber(trade.plannedRiskPips) ||
    trade.plannedRiskPips === 0
  ) {
    return null;
  }

  return Math.abs(trade.maePips / trade.plannedRiskPips) * 100;
};

export const tokenizeTradeSearchQuery = (query: string) => {
  const normalized = normalizeTradeSearchText(query);
  if (!normalized) return [];

  const tokens = normalized.split(" ").filter(Boolean);
  const expanded = tokens.flatMap((token) => {
    const riskMatch = token.match(/^([+-]?\d+(?:\.\d+)?)(?:r|rr)$/);
    if (!riskMatch) return [token];
    return [token, riskMatch[1]];
  });

  return Array.from(new Set(expanded));
};

export const buildTradeSearchDocument = (trade: TradeRow) => {
  const terms = new Set<string>();

  SEARCHABLE_TRADE_ROW_KEYS.forEach((key) => addSearchTerm(terms, trade[key]));

  addDateTerms(terms, trade.open);
  addDateTerms(terms, trade.close);
  addDurationTerms(terms, trade.holdSeconds);
  addDurationTerms(terms, trade.entryPeakDurationSeconds);
  addDurationTerms(terms, trade.postExitPeakDurationSeconds);

  addFormattedMetricTerms(terms, trade, PIP_SEARCH_KEYS, (value, row) =>
    formatTradePipValue(value, row)
  );
  addFormattedMetricTerms(terms, trade, PRICE_SEARCH_KEYS, (value) =>
    formatTradeTablePrice(value)
  );
  addFormattedMetricTerms(terms, trade, CURRENCY_SEARCH_KEYS, (value) =>
    formatTradeTableCurrency(value, 2)
  );
  addFormattedMetricTerms(
    terms,
    trade,
    PERCENT_SEARCH_FIELDS.map((field) => field.key),
    (value) => formatTradeTablePercent(Math.round(value), 0)
  );
  addFormattedMetricTerms(
    terms,
    trade,
    RISK_UNIT_SEARCH_FIELDS.map((field) => field.key),
    (value) =>
    `${formatTradeTableNumber(value, 2)}R`
  );

  PERCENT_SEARCH_FIELDS.forEach(({ key, labels }) => {
    addPercentSearchTerms(terms, trade[key] as number | null | undefined, labels);
  });

  RISK_UNIT_SEARCH_FIELDS.forEach(({ key, labels }) => {
    addRiskUnitSearchTerms(terms, trade[key] as number | null | undefined, labels);
  });

  const drawdownPercent = getTradeDrawdownPercent(trade);
  if (isFiniteTradeNumber(drawdownPercent)) {
    addLabelTerms(terms, ["drawdown", "max drawdown", "adverse excursion"]);
    addSearchTerm(terms, formatTradeTablePercent(Math.round(drawdownPercent), 0));
    addSearchTerm(
      terms,
      `${formatCompactTradeSearchNumber(drawdownPercent)} percent`
    );
  }

  if (
    trade.stdvBucket ||
    isFiniteTradeNumber(trade.rawSTDV) ||
    isFiniteTradeNumber(trade.rawSTDV_PE)
  ) {
    addLabelTerms(terms, ["volatility", "stdv", "standard deviation"]);
  }

  if (trade.tradeDirection === "long") {
    addSearchTerm(terms, "long buy bullish");
  } else if (trade.tradeDirection === "short") {
    addSearchTerm(terms, "short sell bearish");
  }

  if (trade.isLive) {
    addSearchTerm(terms, "live open");
  }

  if (trade.outcome === "Win") {
    addSearchTerm(terms, "win won");
  } else if (trade.outcome === "Loss") {
    addSearchTerm(terms, "loss lost");
  } else if (trade.outcome === "BE") {
    addSearchTerm(terms, "be breakeven break even");
  } else if (trade.outcome === "PW") {
    addSearchTerm(terms, "pw partial win");
  }

  if (trade.complianceStatus === "pass") {
    addSearchTerm(terms, "pass passed compliant");
  } else if (trade.complianceStatus === "fail") {
    addSearchTerm(terms, "fail failed flagged");
  } else if (trade.complianceStatus === "unknown") {
    addSearchTerm(terms, "unknown");
  }

  if (trade.protocolAlignment === "aligned") {
    addSearchTerm(terms, "aligned");
  } else if (trade.protocolAlignment === "against") {
    addSearchTerm(terms, "against");
  } else if (trade.protocolAlignment === "discretionary") {
    addSearchTerm(terms, "discretionary");
  }

  if (trade.trailingStopDetected === true) {
    addSearchTerm(terms, "yes true");
  } else if (trade.trailingStopDetected === false) {
    addSearchTerm(terms, "no false");
  }

  if (trade.stdvBucket?.includes("-2")) {
    addSearchTerm(terms, "very low volatility");
  } else if (trade.stdvBucket?.includes("-1")) {
    addSearchTerm(terms, "low volatility");
  } else if (trade.stdvBucket?.includes("0")) {
    addSearchTerm(terms, "normal volatility");
  } else if (trade.stdvBucket?.includes("+1")) {
    addSearchTerm(terms, "high volatility");
  } else if (trade.stdvBucket?.includes("+2")) {
    addSearchTerm(terms, "very high volatility");
  }

  return normalizeTradeSearchText([...terms].join(" "));
};

export const matchesTradeSearch = (
  searchDocument: string | undefined,
  queryTokens: string[]
) => {
  if (!queryTokens.length) return true;
  if (!searchDocument) return false;

  return queryTokens.every((token) => searchDocument.includes(token));
};
