import type { TradeQueryPlan } from "./query-plan";

type QueryAlias = {
  from: string;
  to: string;
  pattern: RegExp;
};

export const QUERY_ALIASES: QueryAlias[] = [
  { from: "p&l", to: "profit", pattern: /\bp&l\b/gi },
  { from: "p/l", to: "profit", pattern: /\bp\/l\b/gi },
  { from: "pnl", to: "profit", pattern: /\bpnl\b/gi },
  { from: "swap fees", to: "swap", pattern: /\bswap fees?\b/gi },
  { from: "commission fees", to: "commissions", pattern: /\bcommission fees?\b/gi },
  { from: "fees", to: "commissions", pattern: /\bfees?\b/gi },
  { from: "trading costs", to: "commissions swap", pattern: /\btrading costs?\b/gi },
  { from: "r multiple", to: "realised rr", pattern: /\br\s*multiple(s)?\b/gi },
  { from: "risk reward", to: "rr", pattern: /\brisk reward\b/gi },
  { from: "risk/reward", to: "rr", pattern: /\brisk\/reward\b/gi },
];

export function normalizeUserMessage(message: string): string {
  let normalized = message;
  for (const alias of QUERY_ALIASES) {
    normalized = normalized.replace(alias.pattern, alias.to);
  }
  return normalized.replace(/\s+/g, " ").trim();
}

export function buildAliasCatalog(): string {
  return QUERY_ALIASES.map((alias) => `- "${alias.from}" → "${alias.to}"`).join(
    "\n"
  );
}

const META_REPHRASE_PATTERNS = [
  /\b(could(?:n't| not)\s+understand|did(?:n't| not)\s+understand)\b.*\b(request|query|prompt)\b/i,
  /\brequest was not understood\b/i,
  /\bcould you please rephrase\b/i,
  /\bplease rephrase\b/i,
  /\brephrase it\b/i,
];

const QUERY_VERB_RE =
  /\b(what|which|how|show|compare|give|tell|find|calculate|breakdown|summarize|analyse|analyze|review)\b/i;

const ANALYTICS_SIGNAL_RE =
  /\b(profit|loss|p&l|pnl|win|rate|session|setup|model|strategy|asset|symbol|pair|trade|journal|edge|leak|profile|overview|performance|rr|drawdown|mae|mfe|hold|entry|exit|volume|balance|equity|margin|slippage|spread|compliance|trailing|partial|goal|psychology|focus|confidence|expectancy|factor)\b/i;

const ANALYSIS_DIMENSION_HINTS: Array<{ field: string; pattern: RegExp }> = [
  {
    field: "symbol",
    pattern:
      /\b(symbol|symbols|pair|pairs|asset|assets|instrument|instruments|ticker|tickers|gold|forex|eurusd|gbpusd|usdjpy|xauusd|xagusd|btcusd|ethusd|jpy pairs?)\b/i,
  },
  {
    field: "sessionTag",
    pattern: /\b(session|sessions|london|new york|ny\b|asia|asian|sydney)\b/i,
  },
  {
    field: "tradeType",
    pattern: /\b(direction|directions|long|longs|short|shorts|buy|sell)\b/i,
  },
  {
    field: "edgeName",
    pattern: /\b(edge|edges|playbook|playbooks)\b/i,
  },
  {
    field: "modelTag",
    pattern:
      /\b(setup|setups|strategy|strategies|model|models|pattern|patterns|condition|conditions|combo|combos|combination|combinations|intersection|intersections)\b/i,
  },
  {
    field: "protocolAlignment",
    pattern:
      /\b(protocol|aligned|against protocol|non aligned|non-aligned|discretionary)\b/i,
  },
  {
    field: "weekday",
    pattern:
      /\b(day of week|weekday|weekdays|monday|tuesday|wednesday|thursday|friday)\b/i,
  },
  {
    field: "timeOfDay",
    pattern:
      /\b(time of day|morning|afternoon|evening|night|market open|market close)\b/i,
  },
];

const PROFILE_SCOPE_DIMENSIONS = new Set([
  "symbol",
  "sessionTag",
  "tradeType",
  "protocolAlignment",
  "weekday",
  "timeOfDay",
]);

const PROFILE_SUMMARY_PATTERNS = [
  /what('?s| is) my edge/i,
  /what('?s| are) my (edges?|leaks?|patterns?)/i,
  /\b(which|what)\b.*\b(conditions?|patterns?)\b.*\b(improve|improves|strengthen|strengthens|weaken|weakens|hurt|hurts)\b.*\b(edge|edges)\b/i,
  /\b(improve|improves|strengthen|strengthens|weaken|weakens|hurt|hurts)\b.*\b(edge|edges)\b/i,
  /show (me )?my (profile|edge|leak)/i,
  /my trading (profile|summary|overview)/i,
  /where (do i|am i) (losing|leaking)/i,
  /what (am i|do i) do(ing)? (well|wrong|right)/i,
  /strengths? and weaknesses?/i,
  /how am i doing/i,
  /leav(e|ing).*(table|money|profit)/i,
  /money.*(table|leaving|left)/i,
  /exit(ing)? too (early|soon|late)/i,
  /opportunity cost/i,
  /how much.*(miss|left|leave|table)/i,
];

const PROFILE_SCOPE_HINT_RE =
  /\b(by|per|vs|versus|compare|compared|against|combo|combos|combination|combinations|intersection|intersections|breakdown|split|rank|ranking|best|worst|most|least|top|bottom)\b/i;

const CONDITION_QUERY_RE =
  /\b(condition|conditions|combo|combos|combination|combinations|pattern|patterns|intersection|intersections|mix|stack|stacked)\b/i;

export function detectAnalysisDimensions(message: string): string[] {
  return ANALYSIS_DIMENSION_HINTS.filter((entry) => entry.pattern.test(message))
    .map((entry) => entry.field)
    .filter((field, index, all) => all.indexOf(field) === index);
}

export function isBroadProfileSummaryQuery(message: string): boolean {
  return PROFILE_SUMMARY_PATTERNS.some((pattern) => pattern.test(message.trim()));
}

export function isConditionAnalysisQuery(message: string): boolean {
  return CONDITION_QUERY_RE.test(message);
}

export function hasProfileAnalysisQualifier(message: string): boolean {
  if (inferTimeframeFromMessage(message)) {
    return true;
  }

  if (
    detectAnalysisDimensions(message).some((field) =>
      PROFILE_SCOPE_DIMENSIONS.has(field)
    )
  ) {
    return true;
  }

  return PROFILE_SCOPE_HINT_RE.test(message);
}

export function shouldUseProfileSummaryShortcut(message: string): boolean {
  if (isMetaRephraseRequest(message)) {
    return false;
  }

  return (
    isBroadProfileSummaryQuery(message) && !hasProfileAnalysisQualifier(message)
  );
}

export function isMetaRephraseRequest(message: string): boolean {
  const trimmed = message.trim();
  return META_REPHRASE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function isLowSignalAssistantQuery(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;
  if (isMetaRephraseRequest(trimmed)) return false;
  if (isBroadProfileSummaryQuery(trimmed)) return false;
  if (inferTimeframeFromMessage(trimmed)) return false;

  const dimensions = detectAnalysisDimensions(trimmed);
  const words = trimmed.match(/[a-z0-9$%/&.+-]+/gi) ?? [];
  const hasQueryVerb = QUERY_VERB_RE.test(trimmed);
  const hasAnalyticsSignal = ANALYTICS_SIGNAL_RE.test(trimmed);
  const hasDimensionHint = dimensions.length > 0;

  if (!hasAnalyticsSignal && !hasDimensionHint) {
    return true;
  }

  const signalCount =
    (hasQueryVerb ? 1 : 0) +
    (hasAnalyticsSignal ? 1 : 0) +
    (hasDimensionHint ? 1 : 0);

  if (words.length <= 1) {
    return signalCount < 2;
  }

  if (signalCount === 0) {
    return true;
  }

  if (signalCount === 1 && words.length <= 3) {
    return true;
  }

  return false;
}

export function inferTimeframeFromMessage(
  message: string
): TradeQueryPlan["timeframe"] | null {
  const lower = message.toLowerCase();
  const now = new Date();
  const today = toYmd(now);
  const yesterday = shiftUtcDays(now, -1);

  const sinceDate = parseSinceDate(message);
  if (sinceDate) {
    return { from: sinceDate, to: today };
  }

  if (/\btoday\b/i.test(lower)) {
    return { from: today, to: today };
  }

  if (/\byesterday\b/i.test(lower)) {
    const day = toYmd(yesterday);
    return { from: day, to: day };
  }

  if (lower.includes("week to date") || lower.includes("wtd")) {
    const start = startOfWeekUtc(now);
    return { from: toYmd(start), to: today };
  }

  if (lower.includes("month to date") || lower.includes("mtd")) {
    const start = startOfMonthUtc(now);
    return { from: toYmd(start), to: today };
  }

  if (
    lower.includes("year to date") ||
    lower.includes("ytd") ||
    lower.includes("year-to-date")
  ) {
    const start = startOfYearUtc(now);
    return { from: toYmd(start), to: today };
  }

  if (
    lower.includes("quarter to date") ||
    lower.includes("qtd") ||
    lower.includes("quarter-to-date")
  ) {
    const start = startOfQuarterUtc(now);
    return { from: toYmd(start), to: today };
  }

  if (lower.includes("last quarter") || lower.includes("previous quarter")) {
    const range = lastQuarterRange(now);
    return { from: toYmd(range.start), to: toYmd(range.end) };
  }

  if (message.match(/last\s+(\d+)\s+days/i)) {
    const match = message.match(/last\s+(\d+)\s+days/i);
    const days = match ? Number(match[1]) : 0;
    if (days > 0) return { lastNDays: days };
  }
  if (message.match(/last\s+(\d+)\s+weeks/i)) {
    const match = message.match(/last\s+(\d+)\s+weeks/i);
    const weeks = match ? Number(match[1]) : 0;
    if (weeks > 0) return { lastNDays: weeks * 7 };
  }
  if (message.match(/last\s+(\d+)\s+months/i)) {
    const match = message.match(/last\s+(\d+)\s+months/i);
    const months = match ? Number(match[1]) : 0;
    if (months > 0) return { lastNDays: months * 30 };
  }
  if (lower.includes("this week")) {
    const start = startOfWeekUtc(now);
    return { from: toYmd(start), to: today };
  }
  if (lower.includes("last week")) {
    const range = lastWeekRange(now);
    return { from: toYmd(range.start), to: toYmd(range.end) };
  }
  if (lower.includes("past week")) {
    return { lastNDays: 7 };
  }
  if (lower.includes("this month")) {
    const start = startOfMonthUtc(now);
    return { from: toYmd(start), to: today };
  }
  if (lower.includes("last month")) {
    const range = lastMonthRange(now);
    return { from: toYmd(range.start), to: toYmd(range.end) };
  }
  if (lower.includes("last 30 days") || lower.includes("past month")) {
    return { lastNDays: 30 };
  }
  if (lower.includes("this quarter")) {
    const start = startOfQuarterUtc(now);
    return { from: toYmd(start), to: today };
  }
  if (lower.includes("last 90 days")) {
    return { lastNDays: 90 };
  }
  if (lower.includes("this year")) {
    const start = startOfYearUtc(now);
    return { from: toYmd(start), to: today };
  }
  if (lower.includes("last 12 months") || lower.includes("past year")) {
    return { lastNDays: 365 };
  }
  return null;
}

function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfWeekUtc(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

function startOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function shiftUtcDays(date: Date, days: number): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function startOfYearUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

function startOfQuarterUtc(date: Date): Date {
  const month = date.getUTCMonth();
  const quarterStart = Math.floor(month / 3) * 3;
  return new Date(Date.UTC(date.getUTCFullYear(), quarterStart, 1));
}

function lastWeekRange(date: Date): { start: Date; end: Date } {
  const thisWeekStart = startOfWeekUtc(date);
  const start = shiftUtcDays(thisWeekStart, -7);
  const end = shiftUtcDays(thisWeekStart, -1);
  return { start, end };
}

function lastMonthRange(date: Date): { start: Date; end: Date } {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end };
}

function lastQuarterRange(date: Date): { start: Date; end: Date } {
  const month = date.getUTCMonth();
  let year = date.getUTCFullYear();
  let quarterStart = Math.floor(month / 3) * 3 - 3;

  if (quarterStart < 0) {
    quarterStart = 9;
    year -= 1;
  }

  const start = new Date(Date.UTC(year, quarterStart, 1));
  const end = new Date(Date.UTC(year, quarterStart + 3, 0));
  return { start, end };
}

function parseSinceDate(message: string): string | null {
  const match = message.match(
    /since\s+([a-z0-9,\s\-\/]+?)(?:\s+(?:and|with|where|for|by|from|to|until|in)\b|$)/i
  );
  if (!match) return null;
  const candidate = match[1].trim();
  if (!candidate) return null;
  const parsed = Date.parse(candidate);
  if (Number.isNaN(parsed)) return null;
  return toYmd(new Date(parsed));
}
