import { z } from "zod";

import { journalEntryTypeSchema, psychologySchema } from "../routers/journal/shared";

export const tradePhaseSchema = z.enum(["pre-trade", "during-trade", "post-trade"]);
export const partialPsychologySchema = psychologySchema.partial();

export type JournalEntryType = z.infer<typeof journalEntryTypeSchema>;
export type TradePhase = z.infer<typeof tradePhaseSchema>;
export type PsychologyPatch = z.infer<typeof partialPsychologySchema>;
type NumericPsychologyKey =
  | "mood"
  | "confidence"
  | "energy"
  | "focus"
  | "fear"
  | "greed";

const COMMON_TRADE_SYMBOLS = new Set([
  "NQ",
  "MNQ",
  "ES",
  "MES",
  "YM",
  "MYM",
  "RTY",
  "M2K",
  "CL",
  "MCL",
  "GC",
  "MGC",
  "SI",
  "SIL",
  "NG",
  "BTC",
  "ETH",
  "XAUUSD",
  "NAS100",
  "US30",
  "SPX",
]);

const SYMBOL_PAIR_COMPONENTS = new Set([
  "AUD",
  "BTC",
  "CAD",
  "CHF",
  "ETH",
  "EUR",
  "GBP",
  "JPY",
  "NZD",
  "USD",
  "XAG",
  "XAU",
]);

const PLATFORM_TAG_PATTERNS: Array<{
  tag: string;
  patterns: RegExp[];
}> = [
  { tag: "tradovate", patterns: [/\btradovate\b/i] },
  { tag: "tradingview", patterns: [/\btradingview\b/i] },
  { tag: "mt5", patterns: [/\bmt5\b|\bmetatrader\s*5\b/i] },
  { tag: "mt4", patterns: [/\bmt4\b|\bmetatrader\s*4\b/i] },
  { tag: "ctrader", patterns: [/\bc-?trader\b|\bctrader\b/i] },
  { tag: "nt8", patterns: [/\bnt8\b|\bninja ?trader\b/i] },
  { tag: "rithmic", patterns: [/\brithmic\b/i] },
];

const TITLE_ACRONYMS = new Set([
  "ny",
  "nq",
  "mnq",
  "es",
  "mes",
  "ym",
  "mym",
  "rty",
  "m2k",
  "cl",
  "mcl",
  "gc",
  "mgc",
  "si",
  "sil",
  "ng",
  "btc",
  "eth",
  "rr",
  "tp",
  "sl",
]);

const TITLE_SPECIAL_CASES = new Map<string, string>([
  ["tradovate", "Tradovate"],
  ["tradingview", "TradingView"],
  ["ctrader", "cTrader"],
  ["rithmic", "Rithmic"],
  ["mt4", "MT4"],
  ["mt5", "MT5"],
  ["nt8", "NT8"],
]);

const SYMBOL_ALIAS_GROUPS = [
  ["NQ", "MNQ", "NAS100", "US100", "USTEC"],
  ["ES", "MES", "SPX", "SPX500", "US500"],
  ["YM", "MYM", "US30", "DJ30"],
  ["RTY", "M2K", "US2000"],
  ["GC", "MGC", "XAUUSD", "GOLD"],
  ["CL", "MCL", "USOIL", "WTI"],
] as const;

const TITLE_WEAK_OPENERS = new Set([
  "had",
  "have",
  "i",
  "im",
  "i'm",
  "today",
  "felt",
  "feeling",
  "went",
  "was",
]);

const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const EMOTIONAL_STATE_KEYWORDS: Array<{
  value: PsychologyPatch["emotionalState"];
  keywords: string[];
}> = [
  { value: "angry", keywords: ["angry", "pissed off", "furious", "mad"] },
  { value: "confused", keywords: ["confused", "unclear", "lost", "mixed up"] },
  { value: "discouraged", keywords: ["discouraged", "down", "deflated", "demoralized"] },
  { value: "overwhelmed", keywords: ["overwhelmed", "frazzled", "all over the place"] },
  { value: "regretful", keywords: ["regretful", "regret", "wish i had", "shouldn't have"] },
  { value: "impatient", keywords: ["impatient", "rushed", "couldn't wait", "could not wait"] },
  { value: "stressed", keywords: ["stressed", "stress", "under pressure"] },
  { value: "frustrated", keywords: ["frustrated", "frustration", "tilted", "tilt"] },
  { value: "anxious", keywords: ["anxious", "anxiety", "nervous", "uneasy"] },
  { value: "confident", keywords: ["confident", "confidence high", "locked in"] },
  { value: "excited", keywords: ["excited", "amped", "hyped"] },
  { value: "calm", keywords: ["calm", "patient", "composed"] },
  { value: "neutral", keywords: ["neutral", "fine", "steady"] },
];

const IMPLIED_TAG_PATTERNS: Array<{
  tag: string;
  patterns: RegExp[];
}> = [
  {
    tag: "fomo",
    patterns: [
      /\bfomo\b/i,
      /\bchased\b/i,
      /\bjumped in late\b/i,
      /\blate entry\b/i,
      /\bdid(?:n't| not) want to miss\b/i,
    ],
  },
  {
    tag: "revenge",
    patterns: [
      /\brevenge\b/i,
      /\bmake it back\b/i,
      /\bget it back\b/i,
      /\bwin it back\b/i,
    ],
  },
  {
    tag: "overtrading",
    patterns: [
      /\bovertrad(?:e|ing)\b/i,
      /\bkept trading\b/i,
      /\btoo many trades\b/i,
      /\bcould(?:n't| not) stop trading\b/i,
    ],
  },
  {
    tag: "impulsive",
    patterns: [
      /\bimpuls(?:ive|ively)\b/i,
      /\bfor no reason\b/i,
      /\bjumped in\b/i,
      /\bforced (?:a |the )?trade\b/i,
    ],
  },
  {
    tag: "no-setup",
    patterns: [
      /\bno setup\b/i,
      /\bnot my setup\b/i,
      /\bfor no reason\b/i,
      /\bnothing there\b/i,
    ],
  },
  {
    tag: "rule-break",
    patterns: [
      /\bbroke (?:my |the )?rules\b/i,
      /\bignored (?:my |the )?plan\b/i,
      /\bshould(?:n't| not) have taken\b/i,
      /\bfor no reason\b/i,
    ],
  },
  {
    tag: "hesitation",
    patterns: [
      /\bhesitat(?:ed|ing|ion)\b/i,
      /\bfroze\b/i,
      /\bdid(?:n't| not) pull the trigger\b/i,
      /\bshaky\b/i,
    ],
  },
  {
    tag: "missed-entry",
    patterns: [
      /\bmiss(?:ed|ing)\s+(?:the\s+)?(?:clean\s+)?entry\b/i,
      /\bdid(?:n't| not) get in\b/i,
    ],
  },
  {
    tag: "missed-exit",
    patterns: [
      /\bmiss(?:ed|ing)\s+(?:the\s+)?exit\b/i,
      /\bheld too long\b/i,
      /\bgave (?:it|profits?) back\b/i,
      /\bdid(?:n't| not) take profit\b/i,
    ],
  },
  {
    tag: "discipline",
    patterns: [
      /\bstuck to the plan\b/i,
      /\bfollowed the plan\b/i,
      /\bdisciplined\b/i,
    ],
  },
  {
    tag: "patience",
    patterns: [/\bpatient\b/i, /\bwaited\b/i, /\blet it come to me\b/i],
  },
  {
    tag: "oversized",
    patterns: [/\boversized\b/i, /\bsized too (?:big|large)\b/i, /\btoo big\b/i],
  },
  {
    tag: "moved-stop",
    patterns: [/\bmoved (?:my )?stop\b/i, /\bdragged (?:my )?stop\b/i],
  },
  {
    tag: "back-to-back-losses",
    patterns: [
      /\bback[-\s]?to[-\s]?back losses?\b/i,
      /\b(?:two|2)\s+losses?\s+in\s+a\s+row\b/i,
      /\bconsecutive losses?\b/i,
    ],
  },
  {
    tag: "testing",
    patterns: [/\btesting\b/i, /\bdemo\b/i, /\bsim(?:ulation)?\b/i, /\bpaper trading\b/i],
  },
];

const SESSION_TAG_PATTERNS: Array<{
  tag: string;
  pattern: RegExp;
}> = [
  { tag: "ny-open", pattern: /\b(?:new york|ny)\s+open\b/i },
  { tag: "ny-session", pattern: /\b(?:new york|ny)\s+session\b/i },
  { tag: "london-open", pattern: /\blondon\s+open\b/i },
  { tag: "london-session", pattern: /\blondon\s+session\b/i },
  { tag: "asia-session", pattern: /\b(?:asia|asian|tokyo)\s+(?:session|open)\b/i },
];

const IMPLIED_PSYCHOLOGY_PATTERNS: Array<{
  key: NumericPsychologyKey;
  value: number;
  patterns: RegExp[];
}> = [
  {
    key: "confidence",
    value: 3,
    patterns: [/\bshaky\b/i, /\bhesitant\b/i, /\bunsure\b/i, /\bdoubt(?:ing|ful)\b/i],
  },
  {
    key: "confidence",
    value: 2,
    patterns: [/\bconfused\b/i, /\blost\b/i, /\bno idea\b/i, /\bunclear\b/i],
  },
  {
    key: "confidence",
    value: 8,
    patterns: [/\blocked in\b/i, /\bdialed in\b/i, /\bclear-headed\b/i],
  },
  {
    key: "focus",
    value: 3,
    patterns: [/\bdistracted\b/i, /\bscattered\b/i, /\bsloppy\b/i, /\brushed\b/i],
  },
  {
    key: "focus",
    value: 2,
    patterns: [/\bconfused\b/i, /\ball over the place\b/i, /\boverwhelmed\b/i],
  },
  {
    key: "focus",
    value: 8,
    patterns: [/\bfocused\b/i, /\bin the zone\b/i, /\bdialed in\b/i],
  },
  {
    key: "energy",
    value: 3,
    patterns: [/\btired\b/i, /\bexhausted\b/i, /\blow energy\b/i, /\bfatigued\b/i],
  },
  {
    key: "energy",
    value: 2,
    patterns: [/\bdrained\b/i, /\bdepleted\b/i, /\bburned out\b/i],
  },
  {
    key: "energy",
    value: 8,
    patterns: [/\benergized\b/i, /\benergetic\b/i, /\bamped\b/i],
  },
  {
    key: "fear",
    value: 7,
    patterns: [/\bafraid\b/i, /\bscared\b/i, /\bnervous\b/i, /\banxious\b/i, /\bshaky\b/i],
  },
  {
    key: "greed",
    value: 7,
    patterns: [/\bgreedy\b/i, /\bwanted more\b/i, /\bheld for more\b/i],
  },
  {
    key: "greed",
    value: 8,
    patterns: [/\bchased\b/i, /\bforced it\b/i, /\bimpuls(?:ive|ively)\b/i, /\bimpatient\b/i],
  },
  {
    key: "mood",
    value: 3,
    patterns: [/\brough\b/i, /\bfrustrated\b/i, /\bangry\b/i, /\bannoyed\b/i],
  },
  {
    key: "mood",
    value: 2,
    patterns: [/\bpissed off\b/i, /\bdown\b/i, /\bdiscouraged\b/i, /\bdeflated\b/i],
  },
  {
    key: "mood",
    value: 8,
    patterns: [/\bcalm\b/i, /\bpositive\b/i, /\bgood mood\b/i],
  },
];

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clampScale(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value)));
}

function mergePsychologyScale(
  key: NumericPsychologyKey,
  currentValue: number | undefined,
  nextValue: number
): number {
  if (currentValue == null) {
    return nextValue;
  }

  if (key === "fear" || key === "greed") {
    return Math.max(currentValue, nextValue);
  }

  if (currentValue <= 5 && nextValue <= 5) {
    return Math.min(currentValue, nextValue);
  }

  if (currentValue >= 6 && nextValue >= 6) {
    return Math.max(currentValue, nextValue);
  }

  return Math.abs(nextValue - 5) > Math.abs(currentValue - 5)
    ? nextValue
    : currentValue;
}

function stripWrappingQuotes(value: string): string {
  return value.replace(/^["']+|["']+$/g, "").trim();
}

function normalizeTag(tag: string): string | null {
  const normalized = stripWrappingQuotes(tag)
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");

  return normalized ? normalized.slice(0, 40) : null;
}

export function uniqueTags(tags: string[]): string[] {
  return Array.from(
    new Set(tags.map(normalizeTag).filter((tag): tag is string => Boolean(tag)))
  );
}

export function normalizeComparableSymbol(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function expandSymbolAliases(symbol: string): string[] {
  const normalized = normalizeComparableSymbol(symbol);
  if (!normalized) return [];

  const aliasGroup = SYMBOL_ALIAS_GROUPS.find((group) =>
    group.some((entry) => normalizeComparableSymbol(entry) === normalized)
  );

  return aliasGroup
    ? aliasGroup.map((entry) => normalizeComparableSymbol(entry))
    : [normalized];
}

function formatTitleSentenceCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word, index) => {
      const clean = word.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");
      if (!clean) return word;

      const lower = clean.toLowerCase();
      let replacement = lower;

      if (TITLE_SPECIAL_CASES.has(lower)) {
        replacement = TITLE_SPECIAL_CASES.get(lower) || clean;
      } else if (
        TITLE_ACRONYMS.has(lower) ||
        COMMON_TRADE_SYMBOLS.has(clean.toUpperCase())
      ) {
        replacement = clean.toUpperCase();
      } else if (clean.length >= 5 && /^[a-z]+$/i.test(clean) && /usd$/.test(lower)) {
        replacement = clean.toUpperCase();
      } else if (index === 0) {
        replacement = lower.charAt(0).toUpperCase() + lower.slice(1);
      }

      return word.replace(clean, replacement);
    })
    .join(" ");
}

function truncateTitle(title: string): string {
  return normalizeWhitespace(title).slice(0, 160);
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function normalizeLooseText(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function extractDate(text: string): string | null {
  const lower = text.toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (/\b(today|tonight|this morning|this afternoon|this evening)\b/i.test(lower)) {
    return formatDateOnly(today);
  }

  if (/\byesterday\b/i.test(lower)) {
    return formatDateOnly(addDays(today, -1));
  }

  if (/\btomorrow\b/i.test(lower)) {
    return formatDateOnly(addDays(today, 1));
  }

  const isoMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch?.[1]) {
    return isoMatch[1];
  }

  const slashMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (slashMatch) {
    const [, first, second, year] = slashMatch;
    const firstNumber = Number(first);
    const secondNumber = Number(second);
    const month = firstNumber > 12 && secondNumber <= 12 ? second : first;
    const day =
      secondNumber > 12 && firstNumber <= 12
        ? second
        : firstNumber > 12
          ? first
          : second;

    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const dayFirstMonthMatch = text.match(
    /\b(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*)(?:,\s*(20\d{2}))?\b/i
  );
  if (dayFirstMonthMatch) {
    const [, dayText, monthText, yearText] = dayFirstMonthMatch;
    const monthIndex = MONTH_NAME_TO_NUMBER[monthText.toLowerCase()];
    const day = Number(dayText);
    if (monthIndex != null && day >= 1 && day <= 31) {
      const year = yearText ? Number(yearText) : today.getFullYear();
      return formatDateOnly(new Date(year, monthIndex, day));
    }
  }

  const monthNameMatch = text.match(
    /\b(?:on\s+)?((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}(?:,\s*20\d{2})?)/i
  );
  if (monthNameMatch?.[1]) {
    const parsed = new Date(monthNameMatch[1]);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateOnly(parsed);
    }
  }

  return null;
}

export function extractExplicitTags(text: string): string[] {
  const tags: string[] = [];
  for (const match of text.matchAll(/#([a-z0-9][a-z0-9_-]*)/gi)) {
    tags.push(match[1]);
  }

  const explicitTagMatch = text.match(
    /\btags?\b[:\s]+([^.;\n]+?)(?=(?:\b(?:today|yesterday|tomorrow|pre-trade|during-trade|post-trade|confidence|mood|energy|focus|fear|greed)\b|$))/i
  );
  if (explicitTagMatch?.[1]) {
    explicitTagMatch[1]
      .split(/,|\band\b/gi)
      .map((part) => normalizeWhitespace(part))
      .filter(Boolean)
      .forEach((tag) => tags.push(tag));
  }

  return tags;
}

function extractPlatformTags(text: string): string[] {
  return PLATFORM_TAG_PATTERNS.flatMap((entry) =>
    matchesAny(text, entry.patterns) ? [entry.tag] : []
  );
}

export function extractSymbolTags(text: string): string[] {
  const tags: string[] = [];
  const isLikelyPairSymbol = (candidate: string) => {
    const normalized = candidate.replace("/", "").toUpperCase();
    if (normalized.length !== 6) return false;

    const base = normalized.slice(0, 3);
    const quote = normalized.slice(3);
    return (
      SYMBOL_PAIR_COMPONENTS.has(base) &&
      SYMBOL_PAIR_COMPONENTS.has(quote) &&
      base !== quote
    );
  };

  for (const match of text.matchAll(/\b([a-z]{6}|[a-z]{3}\/[a-z]{3})\b/gi)) {
    if (isLikelyPairSymbol(match[1])) {
      tags.push(match[1].replace("/", "").toUpperCase());
    }
  }

  for (const match of text.matchAll(/\b([a-z0-9]{2,10})\b/gi)) {
    const symbol = match[1].toUpperCase();
    if (COMMON_TRADE_SYMBOLS.has(symbol)) {
      tags.push(symbol);
    }
  }

  for (const match of text.matchAll(
    /\b(?:long|short|bought|sold|traded?|scalp(?:ed|ing)?|chased|faded)\s+([a-z0-9/]{2,10})\b/gi
  )) {
    const candidate = match[1].replace("/", "").toUpperCase();
    if (COMMON_TRADE_SYMBOLS.has(candidate) || isLikelyPairSymbol(candidate)) {
      tags.push(candidate);
    }
  }

  return tags;
}

export function extractInferredTags(text: string): string[] {
  const tags: string[] = [];

  for (const entry of IMPLIED_TAG_PATTERNS) {
    if (matchesAny(text, entry.patterns)) {
      tags.push(entry.tag);
    }
  }

  for (const entry of SESSION_TAG_PATTERNS) {
    if (entry.pattern.test(text)) {
      tags.push(entry.tag);
    }
  }

  tags.push(...extractPlatformTags(text));

  if (
    /\blong\b/i.test(text) &&
    /\bshort\b/i.test(text) &&
    /\b(?:then|after|later)\b/i.test(text)
  ) {
    tags.push("direction-flip");
  }

  if (/\btesting\b/i.test(text) && extractPlatformTags(text).length > 0) {
    tags.push(...extractPlatformTags(text).map((tag) => `${tag}-testing`));
  }

  return tags;
}

export function inferEntryType(text: string): JournalEntryType | null {
  const lower = text.toLowerCase();
  const hasSymbol = extractSymbolTags(text).length > 0;
  const hasTradeSignals =
    /\b(trade|setup|entry|exit|stop(?:ped|out)?|take profit|tp|sl|scalp|position|risk|rr)\b/i.test(text) ||
    /\b(session|open)\b/i.test(text);
  const hasOutcomeSignals =
    /\b(loss|lost|win|won|breakeven|scratched|gave it back|got stopped|stopped out|took profit|closed|good trade|great trade|clean trade)\b/i.test(text) ||
    /\b\d+(?:\.\d+)?\s*r(?:r)?\b/i.test(text);

  if (/\bbacktest|backtesting\b/.test(lower)) return "backtest";
  if (/\bcompare|comparison|versus|vs\b/.test(lower)) return "comparison";
  if (/\bstrategy|playbook|setup rules\b/.test(lower)) return "strategy";
  if (/\bmonthly\b/.test(lower)) return "monthly";
  if (/\bweekly\b/.test(lower)) return "weekly";

  if (
    /\btrade review|review|recap|debrief|postmortem\b/.test(lower) ||
    hasSymbol ||
    (hasTradeSignals && hasOutcomeSignals)
  ) {
    return "trade_review";
  }

  if (
    /\bdaily\b/.test(lower) ||
    (/\b(today|this morning|this afternoon|this evening)\b/.test(lower) &&
      /\b(session|day|journal|reflection)\b/.test(lower))
  ) {
    return "daily";
  }

  return null;
}

export function inferTradePhase(text: string): TradePhase | null {
  const lower = text.toLowerCase();

  if (/\bpost[-\s]?trade|after the trade|after trade\b/.test(lower)) {
    return "post-trade";
  }

  if (
    /\b(review|recap|debrief|reflection)\b/.test(lower) ||
    /\b(just closed|closed the trade|got stopped|stopped out|took profit|after getting stopped)\b/.test(lower)
  ) {
    return "post-trade";
  }

  if (
    /\b(took|had|ended with)\s+(?:back[-\s]?to[-\s]?back\s+)?(?:losses?|wins?)\b/.test(lower) ||
    /\b(lost|won|gave it back|took profit)\b/.test(lower)
  ) {
    return "post-trade";
  }

  if (
    /\b(took|had|closed)\b.*\btrade\b/.test(lower) &&
    (/\b(good|great|clean|solid|pretty good)\b/.test(lower) ||
      /\b\d+(?:\.\d+)?\s*r(?:r)?\b/.test(lower) ||
      /\bstuck to (?:my|the) plan\b/.test(lower))
  ) {
    return "post-trade";
  }

  if (/\bduring[-\s]?trade|mid[-\s]?trade|in the trade\b/.test(lower)) {
    return "during-trade";
  }

  if (
    /\b(still in|currently in|managing|holding)\b/.test(lower) &&
    /\b(trade|position)\b/.test(lower)
  ) {
    return "during-trade";
  }

  if (/\bpre[-\s]?trade|before the trade|planning\b/.test(lower)) {
    return "pre-trade";
  }

  if (/\b(watching|looking for|waiting for|game plan|want to see)\b/.test(lower)) {
    return "pre-trade";
  }

  return null;
}

export function inferPsychology(text: string): PsychologyPatch | null {
  const lower = text.toLowerCase();
  const patch: PsychologyPatch = {};
  const numericPatterns = [
    "mood",
    "confidence",
    "energy",
    "focus",
    "fear",
    "greed",
  ] as const satisfies readonly NumericPsychologyKey[];

  for (const key of numericPatterns) {
    const match = text.match(
      new RegExp(`\\b${key}\\b\\s*(?:is|at|around|=)?\\s*(\\d{1,2})(?:\\s*\\/\\s*10)?`, "i")
    );
    if (match?.[1]) {
      patch[key] = clampScale(Number(match[1]));
      continue;
    }

    const lowMatch = new RegExp(`\\b(?:low|lower)\\s+${key}\\b|\\b${key}\\s+low\\b`, "i");
    const highMatch = new RegExp(`\\b(?:high|higher)\\s+${key}\\b|\\b${key}\\s+high\\b`, "i");

    if (lowMatch.test(text)) {
      patch[key] = key === "fear" || key === "greed" ? 7 : 3;
    } else if (highMatch.test(text)) {
      patch[key] = 8;
    }
  }

  for (const entry of IMPLIED_PSYCHOLOGY_PATTERNS) {
    if (matchesAny(text, entry.patterns)) {
      patch[entry.key] = mergePsychologyScale(entry.key, patch[entry.key], entry.value);
    }
  }

  for (const entry of EMOTIONAL_STATE_KEYWORDS) {
    if (entry.keywords.some((keyword) => lower.includes(keyword))) {
      patch.emotionalState = entry.value;
      break;
    }
  }

  const feelingMatch =
    text.match(/\b(?:feeling|felt|emotionally|mentally)\s+([^.!?\n]+)/i) ||
    text.match(/\b(?:left me|ended up)\s+([^.!?\n]+)/i);

  if (feelingMatch?.[1]) {
    patch.notes = normalizeWhitespace(feelingMatch[1]).slice(0, 180);
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

function stripMetadataHints(text: string): string {
  return normalizeWhitespace(
    text
      .replace(/#([a-z0-9][a-z0-9_-]*)/gi, " ")
      .replace(/\btags?\b[:\s]+[^.;\n]+/gi, " ")
      .replace(/\b(today|tonight|this morning|this afternoon|this evening|yesterday|tomorrow)\b/gi, " ")
      .replace(/\b(pre[-\s]?trade|during[-\s]?trade|post[-\s]?trade)\b/gi, " ")
      .replace(/\b(mood|confidence|energy|focus|fear|greed)\b\s*(?:is|at|around|=)?\s*\d{1,2}(?:\s*\/\s*10)?/gi, " ")
      .replace(/\b(mood|confidence|energy|focus|fear|greed)\s+(?:low|high)\b/gi, " ")
      .replace(/\b(?:low|high)\s+(mood|confidence|energy|focus|fear|greed)\b/gi, " ")
  );
}

export function inferTitle(text: string): string {
  const explicitTitleMatch = text.match(/\btitle\b\s*:\s*([^.\n]+)/i);
  if (explicitTitleMatch?.[1]) {
    return truncateTitle(
      formatTitleSentenceCase(normalizeWhitespace(explicitTitleMatch[1]))
    );
  }

  const sessionTitle = (() => {
    if (/\b(?:new york|ny)\s+open\b/i.test(text)) return "NY Open";
    if (/\b(?:new york|ny)\s+session\b/i.test(text)) return "NY Session";
    if (/\blondon\s+open\b/i.test(text)) return "London Open";
    if (/\blondon\s+session\b/i.test(text)) return "London Session";
    if (/\b(?:asia|asian|tokyo)\s+(?:session|open)\b/i.test(text)) return "Asia Session";
    return null;
  })();

  const primarySymbol =
    Array.from(new Set(extractSymbolTags(text).map((symbol) => symbol.toUpperCase())))[0] ||
    null;
  const primaryPlatform = extractPlatformTags(text)[0] || null;
  const platformLabel =
    {
      tradovate: "Tradovate",
      tradingview: "TradingView",
      mt5: "MT5",
      mt4: "MT4",
      ctrader: "cTrader",
      nt8: "NT8",
      rithmic: "Rithmic",
    }[primaryPlatform || ""] ||
    (primaryPlatform ? formatTitleSentenceCase(primaryPlatform) : null);
  const entryType = inferEntryType(text);
  const tradePhase = inferTradePhase(text);
  const isTesting = /\btesting\b|\bdemo\b|\bsim(?:ulation)?\b|\bpaper trading\b/i.test(text);

  const tone = (() => {
    if (/\brough\b|\bugly\b|\bmessy\b|\bbad\b/i.test(text)) return "Rough";
    if (/\bclean\b|\bdisciplined\b|\bpatient\b/i.test(text)) return "Clean";
    if (/\bstrong\b|\bsolid\b|\bgreat\b/i.test(text)) return "Strong";
    if (/\bfrustrating\b/i.test(text)) return "Frustrating";
    return null;
  })();

  const outcomeLabel = (() => {
    if (/\bback[-\s]?to[-\s]?back losses?\b|\b(?:two|2)\s+losses?\s+in\s+a\s+row\b/i.test(text)) {
      return "Back-to-Back Losses";
    }
    if (/\b(loss|lost|stopped out|got stopped)\b/i.test(text)) return "Loss Review";
    if (/\b(win|won|took profit)\b/i.test(text)) return "Win Review";
    if (/\b(breakeven|scratched)\b/i.test(text)) return "Breakeven Review";
    if (/\bno setup\b|\bfor no reason\b|\bnot my setup\b/i.test(text)) return "Rule-Break Review";
    if (/\bchased\b/i.test(text)) return "Chasing Review";
    return null;
  })();

  const structuredTitle = (() => {
    if (tradePhase === "pre-trade") {
      if (sessionTitle && primarySymbol) return `${sessionTitle} Plan for ${primarySymbol}`;
      if (sessionTitle) return `${sessionTitle} Plan`;
      if (primarySymbol) return `${primarySymbol} Trade Plan`;
      return "Trade Plan";
    }

    if (tradePhase === "during-trade") {
      if (sessionTitle && primarySymbol) {
        return `${sessionTitle} Trade Management on ${primarySymbol}`;
      }
      if (primarySymbol) return `${primarySymbol} Position Management`;
      return "Trade Management";
    }

    if (
      entryType === "trade_review" ||
      tradePhase === "post-trade" ||
      sessionTitle ||
      primarySymbol
    ) {
      let title = sessionTitle
        ? `${tone ? `${tone} ` : ""}${sessionTitle}${primarySymbol ? ` on ${primarySymbol}` : ""}`
        : primarySymbol
          ? `${tone ? `${tone} ` : ""}${primarySymbol} Review`
          : outcomeLabel || `${tone ? `${tone} ` : ""}Trade Review`;

      if (isTesting && platformLabel) {
        title += ` While Testing ${platformLabel}`;
      } else if (!sessionTitle && outcomeLabel && !title.includes(outcomeLabel)) {
        title = `${title} ${outcomeLabel}`;
      }

      return title;
    }

    if (entryType === "daily") {
      return tone ? `${tone} Trading Day Reflection` : "Daily Trading Reflection";
    }

    return null;
  })();

  if (structuredTitle) {
    return truncateTitle(formatTitleSentenceCase(structuredTitle));
  }

  const firstClause = text.split(/[\n.]/)[0]?.split(",").slice(0, 2).join(",") ?? text;
  const cleaned = stripMetadataHints(firstClause)
    .replace(/^(?:i|we)\s+/i, "")
    .replace(/^(?:had|have|having|felt|feeling|went|was|were)\s+/i, "")
    .replace(/^(?:a|an|the)\s+/i, "");

  if (cleaned) {
    return truncateTitle(formatTitleSentenceCase(cleaned));
  }

  return truncateTitle(formatTitleSentenceCase(normalizeWhitespace(text))) || "Untitled";
}

function scoreTitleCandidate(title: string, sourceText: string): number {
  const normalized = normalizeWhitespace(title);
  if (!normalized) return Number.NEGATIVE_INFINITY;

  const words = normalized.split(/\s+/);
  const firstWord = words[0]?.toLowerCase() || "";
  let score = 0;

  if (words.length >= 3 && words.length <= 10) {
    score += 4;
  } else if (words.length <= 14) {
    score += 2;
  } else {
    score -= 3;
  }

  if (/^[A-Z0-9]/.test(normalized)) score += 1;
  if (TITLE_WEAK_OPENERS.has(firstWord)) score -= 5;
  if (/\b(i|me|my|we|our)\b/i.test(normalized)) score -= 3;
  if (/\b(Session|Open|Plan|Review|Reflection|Loss|Win|Trade|Testing)\b/.test(normalized)) {
    score += 2;
  }
  if (/\b[A-Z0-9]{2,10}\b/.test(normalized)) score += 2;
  if (/[,.]/.test(normalized)) score -= 1;

  const rawPrefix = normalizeWhitespace(
    sourceText.split(/[\n.]/)[0]?.slice(0, normalized.length + 12) || ""
  ).toLowerCase();
  if (rawPrefix.startsWith(normalized.toLowerCase())) score -= 2;
  if (normalized === normalized.toLowerCase()) score -= 2;

  return score;
}

export function choosePreferredTitle(
  parsedTitle: string | null | undefined,
  fallbackTitle: string,
  sourceText: string
): string {
  const normalizedParsed = parsedTitle
    ? truncateTitle(formatTitleSentenceCase(normalizeWhitespace(parsedTitle)))
    : "";
  const normalizedFallback = truncateTitle(
    formatTitleSentenceCase(normalizeWhitespace(fallbackTitle))
  );

  if (!normalizedParsed) {
    return normalizedFallback || "Untitled";
  }

  const parsedScore = scoreTitleCandidate(normalizedParsed, sourceText);
  const fallbackScore = scoreTitleCandidate(normalizedFallback, sourceText);

  return parsedScore >= fallbackScore ? normalizedParsed : normalizedFallback;
}
