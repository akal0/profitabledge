import { trade as tradeTable } from "../../../db/schema/trading";

type ClosedTrade = typeof tradeTable.$inferSelect;

export type ConditionFilters = Record<string, string | number>;

const WEEKDAY_NAMES: Record<string, string> = {
  Sun: "Sunday",
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};

const CONDITION_DIMENSION_ORDER: Record<string, number> = {
  protocol: 10,
  model: 20,
  session: 30,
  symbol: 40,
  direction: 50,
  weekday: 60,
  hourBucket: 70,
  rrBucket: 80,
  holdBucket: 90,
};

export const CONDITION_COMBINATIONS: ReadonlyArray<readonly string[]> = [
  ["symbol"],
  ["session"],
  ["model"],
  ["protocol"],
  ["direction"],
  ["rrBucket"],
  ["holdBucket"],
  ["hourBucket"],
  ["weekday"],
  ["symbol", "direction"],
  ["symbol", "session"],
  ["session", "direction"],
  ["session", "model"],
  ["session", "rrBucket"],
  ["session", "holdBucket"],
  ["model", "protocol"],
  ["model", "direction"],
  ["model", "rrBucket"],
  ["model", "holdBucket"],
  ["protocol", "rrBucket"],
  ["protocol", "holdBucket"],
  ["direction", "rrBucket"],
  ["direction", "holdBucket"],
  ["weekday", "hourBucket"],
];

function toNum(val: string | number | null | undefined): number {
  if (val == null) return 0;
  const n = typeof val === "string" ? parseFloat(val) : val;
  return Number.isNaN(n) ? 0 : n;
}

function holdSeconds(t: ClosedTrade): number {
  if (t.tradeDurationSeconds) return toNum(t.tradeDurationSeconds);
  if (t.openTime && t.closeTime) {
    return (
      (new Date(t.closeTime).getTime() - new Date(t.openTime).getTime()) / 1000
    );
  }
  return 0;
}

function formatUtcHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

function formatRRBucketLabel(value: string): string {
  if (value === "RR<1.5") return "< 1.5 RR";
  if (value === "RR 1.5-2.5") return "1.5 - 2.5 RR";
  if (value === "RR 2.5-3.5") return "2.5 - 3.5 RR";
  if (value === "RR>3.5") return "> 3.5 RR";
  return value.replace(/^RR\s*/, "").trim();
}

function formatRRBucketClause(value: string): string {
  if (value === "RR<1.5") return "targeted less than 1.5 RR";
  if (value === "RR 1.5-2.5") return "targeted 1.5 - 2.5 RR";
  if (value === "RR 2.5-3.5") return "targeted 2.5 - 3.5 RR";
  if (value === "RR>3.5") return "targeted more than 3.5 RR";
  return `targeted ${formatRRBucketLabel(value)}`;
}

function formatHoldBucketLabel(value: string): string {
  if (value === "Hold<5m") return "Held < 5m";
  if (value === "Hold 5-15m") return "Held 5 - 15m";
  if (value === "Hold 15-45m") return "Held 15 - 45m";
  if (value === "Hold 45m-2h") return "Held 45m - 2h";
  if (value === "Hold>2h") return "Held > 2h";
  return value.replace(/^Hold\s*/, "Held ");
}

function formatHoldBucketClause(value: string): string {
  if (value === "Hold<5m") return "were held for less than 5 minutes";
  if (value === "Hold 5-15m") return "were held for 5 to 15 minutes";
  if (value === "Hold 15-45m") return "were held for 15 to 45 minutes";
  if (value === "Hold 45m-2h") return "were held for 45 minutes to 2 hours";
  if (value === "Hold>2h") return "were held for more than 2 hours";
  return `were held for ${value.replace(/^Hold\s*/, "")}`;
}

function formatProtocolLabel(value: string): string {
  if (value === "aligned") return "Protocol aligned";
  if (value === "against") return "Against protocol";
  if (value === "discretionary") return "Discretionary";
  return value;
}

function formatProtocolClause(value: string): string {
  if (value === "aligned") return "followed your protocol";
  if (value === "against") return "went against your protocol";
  if (value === "discretionary") return "were discretionary";
  return `had protocol status ${value}`;
}

function formatDirectionLabel(value: string): string {
  if (value === "long") return "Long";
  if (value === "short") return "Short";
  return value;
}

function formatDirectionClause(value: string): string {
  if (value === "long") return "were long";
  if (value === "short") return "were short";
  return `had direction ${value}`;
}

function formatHourBucketLabel(value: string): string {
  const match = value.match(/^(\d{1,2})-(\d{1,2})h UTC$/);
  if (!match) return value;
  return `${formatUtcHour(Number(match[1]))} - ${formatUtcHour(Number(match[2]))} UTC`;
}

function formatHourBucketClause(value: string): string {
  const match = value.match(/^(\d{1,2})-(\d{1,2})h UTC$/);
  if (!match) return `were opened during ${value}`;
  return `were opened between ${formatUtcHour(Number(match[1]))} and ${formatUtcHour(Number(match[2]))} UTC`;
}

function formatWeekdayLabel(value: string): string {
  return WEEKDAY_NAMES[value] ?? value;
}

function getConditionShortLabel(dim: string, value: string): string {
  if (dim === "symbol") return value;
  if (dim === "session") return `${value} session`;
  if (dim === "model") return `${value} model`;
  if (dim === "protocol") return formatProtocolLabel(value);
  if (dim === "direction") return formatDirectionLabel(value);
  if (dim === "rrBucket") return formatRRBucketLabel(value);
  if (dim === "holdBucket") return formatHoldBucketLabel(value);
  if (dim === "hourBucket") return formatHourBucketLabel(value);
  if (dim === "weekday") return formatWeekdayLabel(value);
  return value;
}

function getConditionClause(dim: string, value: string): string {
  if (dim === "symbol") return `were on ${value}`;
  if (dim === "session") return `were taken during the ${value} session`;
  if (dim === "model") return `used the ${value} model`;
  if (dim === "protocol") return formatProtocolClause(value);
  if (dim === "direction") return formatDirectionClause(value);
  if (dim === "rrBucket") return formatRRBucketClause(value);
  if (dim === "holdBucket") return formatHoldBucketClause(value);
  if (dim === "hourBucket") return formatHourBucketClause(value);
  if (dim === "weekday") return `were opened on ${formatWeekdayLabel(value)}`;
  return `${dim} was ${value}`;
}

function getOrderedFilterEntries(filters: ConditionFilters) {
  return Object.entries(filters).sort(
    ([left], [right]) =>
      (CONDITION_DIMENSION_ORDER[left] ?? 999) -
      (CONDITION_DIMENSION_ORDER[right] ?? 999)
  );
}

function joinClauses(clauses: string[]): string {
  if (clauses.length === 0) return "";
  if (clauses.length === 1) return clauses[0];
  if (clauses.length === 2) return `${clauses[0]} and ${clauses[1]}`;
  return `${clauses.slice(0, -1).join(", ")}, and ${clauses.at(-1)}`;
}

export function getConditionValue(
  trade: ClosedTrade,
  dim: string
): string | null {
  if (dim === "symbol") return trade.symbol || null;
  if (dim === "session") return trade.sessionTag || null;
  if (dim === "model") return trade.modelTag || null;
  if (dim === "protocol") return trade.protocolAlignment || null;
  if (dim === "direction") return trade.tradeType || null;

  if (dim === "rrBucket") {
    const rr = toNum(trade.plannedRR);
    if (rr <= 0) return null;
    if (rr < 1.5) return "RR<1.5";
    if (rr < 2.5) return "RR 1.5-2.5";
    if (rr < 3.5) return "RR 2.5-3.5";
    return "RR>3.5";
  }

  if (dim === "holdBucket") {
    const secs = holdSeconds(trade);
    if (secs <= 0) return null;
    if (secs < 300) return "Hold<5m";
    if (secs < 900) return "Hold 5-15m";
    if (secs < 2700) return "Hold 15-45m";
    if (secs < 7200) return "Hold 45m-2h";
    return "Hold>2h";
  }

  if (dim === "hourBucket") {
    const time = trade.openTime || (trade.open ? new Date(trade.open) : null);
    if (!time) return null;
    const hour = new Date(time).getUTCHours();
    const bucket = Math.floor(hour / 3) * 3;
    return `${bucket}-${bucket + 3}h UTC`;
  }

  if (dim === "weekday") {
    const time = trade.openTime || (trade.open ? new Date(trade.open) : null);
    if (!time) return null;
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
      new Date(time).getDay()
    ];
  }

  return null;
}

export function matchesConditionFilters(
  trade: ClosedTrade,
  filters: ConditionFilters
): boolean {
  return getOrderedFilterEntries(filters).every(
    ([dim, value]) => getConditionValue(trade, dim) === String(value)
  );
}

export function summarizeConditionFilters(filters: ConditionFilters): string {
  const labels = getOrderedFilterEntries(filters).map(([dim, value]) =>
    getConditionShortLabel(dim, String(value))
  );
  return labels.join(" • ");
}

export function describeConditionPredicate(filters: ConditionFilters): string {
  const clauses = getOrderedFilterEntries(filters).map(([dim, value]) =>
    getConditionClause(dim, String(value))
  );
  return joinClauses(clauses);
}

export function describeConditionTrades(filters: ConditionFilters): string {
  return `trades that ${describeConditionPredicate(filters)}`;
}
