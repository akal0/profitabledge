import type { WidgetComparisonMode } from "@/stores/comparison";

export type DateRange = {
  start: Date;
  end: Date;
};

export function normalizeLocalStart(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function normalizeLocalEnd(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function countRangeDays(range: DateRange) {
  const start = normalizeLocalStart(range.start);
  const end = normalizeLocalStart(range.end);
  return Math.max(1, Math.floor((+end - +start) / 86400000) + 1);
}

export function shiftRangeByDays(range: DateRange, days: number): DateRange {
  const start = new Date(range.start);
  const end = new Date(range.end);
  start.setDate(start.getDate() + days);
  end.setDate(end.getDate() + days);
  return { start, end };
}

export function getMostRecentWeekRange(
  maxDate: Date,
  minDate?: Date | null
): DateRange | null {
  const end = normalizeLocalEnd(maxDate);
  const start = normalizeLocalStart(maxDate);
  start.setDate(start.getDate() - 6);
  if (minDate && normalizeLocalStart(minDate).getTime() > start.getTime()) {
    return null;
  }
  return { start, end };
}

export function hasSufficientHistory(
  range: DateRange,
  minDate?: Date | null,
  shiftDays?: number
) {
  if (!minDate) return true;
  const start = normalizeLocalStart(range.start);
  const shifted = new Date(start);
  shifted.setDate(start.getDate() + (shiftDays ?? -countRangeDays(range)));
  return shifted.getTime() >= normalizeLocalStart(minDate).getTime();
}

export function getComparisonRange(
  mode: WidgetComparisonMode,
  range: DateRange,
  options?: {
    minDate?: Date | null;
    maxDate?: Date | null;
  }
): DateRange | null {
  if (mode === "none") return null;
  if (mode === "thisWeek") {
    if (!options?.maxDate) return null;
    return getMostRecentWeekRange(options.maxDate, options.minDate);
  }

  const days = mode === "lastWeek" ? 7 : countRangeDays(range);
  if (!hasSufficientHistory(range, options?.minDate, -days)) {
    return null;
  }
  return shiftRangeByDays(range, -days);
}

export function formatRangeLabel(range: DateRange) {
  const start = new Date(range.start);
  const end = new Date(range.end);
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endLabel = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${startLabel}-${endLabel}`;
}
