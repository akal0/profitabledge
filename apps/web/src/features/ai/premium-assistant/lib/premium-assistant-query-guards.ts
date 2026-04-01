"use client";

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
  /\b(profit|profits|loss|losses|p&l|pnl|win|wins|rate|rates|session|sessions|setup|setups|model|models|strategy|strategies|asset|assets|symbol|symbols|pair|pairs|trade|trades|journal|journals|edge|edges|leak|leaks|profile|profiles|overview|performance|rr|drawdown|mae|mfe|hold|holding|entry|entries|exit|exits|exiting|volume|volumes|balance|balances|equity|margin|slippage|spread|compliance|trailing|partial|goal|goals|psychology|focus|confidence|expectancy|factor)\b/i;

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
  /\bexit(?:ing)?\b.*\btoo\s+(early|soon|late)\b/i,
  /opportunity cost/i,
  /how much.*(miss|left|leave|table)/i,
];

const ANALYSIS_DIMENSION_HINTS = [
  /\b(symbol|symbols|pair|pairs|asset|assets|instrument|instruments|ticker|tickers|gold|forex|eurusd|gbpusd|usdjpy|xauusd|xagusd|btcusd|ethusd|jpy pairs?)\b/i,
  /\b(session|sessions|london|new york|ny\b|asia|asian|sydney)\b/i,
  /\b(direction|directions|long|longs|short|shorts|buy|sell)\b/i,
  /\b(edge|edges|playbook|playbooks)\b/i,
  /\b(setup|setups|strategy|strategies|model|models|pattern|patterns|condition|conditions|combo|combos|combination|combinations|intersection|intersections)\b/i,
  /\b(protocol|aligned|against protocol|non aligned|non-aligned|discretionary)\b/i,
  /\b(day of week|day of the week|weekday|weekdays|monday|tuesday|wednesday|thursday|friday)\b/i,
  /\b(time of day|morning|afternoon|evening|night|market open|market close)\b/i,
];

function hasTimeframeHint(message: string) {
  return /\b(today|yesterday|this week|last week|this month|last month|this quarter|last quarter|this year|last \d+ (days|weeks|months)|since )\b/i.test(
    message
  );
}

export function isMetaRephraseRequest(message: string): boolean {
  const trimmed = message.trim();
  return META_REPHRASE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function isBroadProfileSummaryQuery(message: string): boolean {
  return PROFILE_SUMMARY_PATTERNS.some((pattern) => pattern.test(message.trim()));
}

export function isLowSignalAssistantQuery(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;
  if (isMetaRephraseRequest(trimmed)) return true;
  if (isBroadProfileSummaryQuery(trimmed)) return false;
  if (hasTimeframeHint(trimmed)) return false;

  const words = trimmed.match(/[a-z0-9$%/&.+-]+/gi) ?? [];
  const hasQueryVerb = QUERY_VERB_RE.test(trimmed);
  const hasAnalyticsSignal = ANALYTICS_SIGNAL_RE.test(trimmed);
  const hasDimensionHint = ANALYSIS_DIMENSION_HINTS.some((pattern) =>
    pattern.test(trimmed)
  );

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
