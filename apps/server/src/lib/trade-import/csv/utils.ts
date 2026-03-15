import type { CsvRowRecord } from "./types";

export function stripOuterQuotes(value: string): string {
  if (!value) return value;
  const first = value[0];
  const last = value[value.length - 1];

  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }

  return value;
}

export function normalizeKey(value: string): string {
  return stripOuterQuotes(String(value || ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isBlank(value: string | null | undefined): boolean {
  return value == null || stripOuterQuotes(String(value)).trim() === "";
}

export function pickValue(
  record: CsvRowRecord,
  candidates: string[]
): string | null {
  for (const candidate of candidates) {
    if (!isBlank(record[candidate])) {
      return record[candidate];
    }
  }

  const normalizedMap = new Map<string, string>();
  for (const [key, value] of Object.entries(record)) {
    normalizedMap.set(normalizeKey(key), value);
  }

  for (const candidate of candidates) {
    const value = normalizedMap.get(normalizeKey(candidate));
    if (!isBlank(value)) {
      return value ?? null;
    }
  }

  return null;
}

export function parseNumber(value: string | null | undefined): number | null {
  if (isBlank(value)) return null;

  let text = stripOuterQuotes(String(value)).trim();
  let negative = false;

  if (text.includes("(") && text.includes(")")) {
    negative = true;
    text = text.replace(/[()]/g, "");
  }

  text = text.replace(/[%$£€]/g, "").replace(/\s+/g, "").replace(/,/g, "");

  if (!text) return null;

  const number = Number(text);
  if (!Number.isFinite(number)) {
    return null;
  }

  return negative ? -number : number;
}

export function pickNumber(
  record: CsvRowRecord,
  candidates: string[]
): number | null {
  return parseNumber(pickValue(record, candidates));
}

export function parseDateTime(value: string | null | undefined): Date | null {
  if (isBlank(value)) return null;

  const raw = stripOuterQuotes(String(value)).trim();
  if (!raw) return null;

  const usDateTimeMatch = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i
  );
  if (usDateTimeMatch) {
    const [, monthRaw, dayRaw, yearRaw, hourRaw, minuteRaw, secondRaw, meridiem] =
      usDateTimeMatch;
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    const year = Number(yearRaw);
    let hour = hourRaw ? Number(hourRaw) : 0;
    const minute = minuteRaw ? Number(minuteRaw) : 0;
    const second = secondRaw ? Number(secondRaw) : 0;

    if (meridiem) {
      const normalizedMeridiem = meridiem.toUpperCase();
      if (normalizedMeridiem === "PM" && hour < 12) hour += 12;
      if (normalizedMeridiem === "AM" && hour === 12) hour = 0;
    }

    const parsed = new Date(year, month - 1, day, hour, minute, second);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const dotted = raw.replace(/^(\d{4})\.(\d{2})\.(\d{2})/, "$1-$2-$3");
  const normalized = new Date(dotted);
  if (!Number.isNaN(normalized.getTime())) {
    return normalized;
  }

  return null;
}

export function combineDateAndTime(
  dateValue: string | null | undefined,
  timeValue: string | null | undefined
): Date | null {
  if (isBlank(dateValue) || isBlank(timeValue)) {
    return null;
  }

  return parseDateTime(`${dateValue} ${timeValue}`);
}

export function pickDate(
  record: CsvRowRecord,
  candidates: string[],
  pairs: Array<[string, string]> = []
): Date | null {
  for (const candidate of candidates) {
    const parsed = parseDateTime(pickValue(record, [candidate]));
    if (parsed) return parsed;
  }

  for (const [dateCandidate, timeCandidate] of pairs) {
    const combined = combineDateAndTime(
      pickValue(record, [dateCandidate]),
      pickValue(record, [timeCandidate])
    );
    if (combined) return combined;
  }

  return null;
}

export function parseTradeDirection(
  value: string | null | undefined
): "long" | "short" | null {
  if (isBlank(value)) return null;

  const normalized = normalizeKey(String(value));
  if (
    normalized === "buy" ||
    normalized === "long" ||
    normalized === "b" ||
    normalized === "bot"
  ) {
    return "long";
  }

  if (
    normalized === "sell" ||
    normalized === "short" ||
    normalized === "s" ||
    normalized === "sld"
  ) {
    return "short";
  }

  return null;
}

export function inferTradeDirectionFromMove(input: {
  openPrice: number | null;
  closePrice: number | null;
  profit: number | null;
}): "long" | "short" | null {
  const { openPrice, closePrice, profit } = input;
  if (openPrice == null || closePrice == null || profit == null) {
    return null;
  }

  if (closePrice > openPrice) {
    return profit >= 0 ? "long" : "short";
  }

  if (closePrice < openPrice) {
    return profit >= 0 ? "short" : "long";
  }

  return null;
}

export function coalesce<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value != null) return value;
  }
  return null;
}
