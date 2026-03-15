import type { NumericRange } from "./trade-table-view-state";
import type { TradeRow } from "./trade-table-types";

import { endOfUtcDay, parseDateParam, startOfUtcDay } from "./trade-table-view-state";

const LEGACY_INTEGER_UPPER_BOUND_EPSILON = 0.999999;
const RANGE_QUERY_PRECISION = 4;

export const sortRangeBounds = (lo: number, hi: number): NumericRange =>
  lo <= hi ? [lo, hi] : [hi, lo];

export const parseRangeParam = (param: string): NumericRange | undefined => {
  if (!param) return undefined;

  if (param.includes(":")) {
    const [loRaw = "", hiRaw = ""] = param.split(":", 2);
    const hasLo = loRaw.trim().length > 0;
    const hasHi = hiRaw.trim().length > 0;
    if (!hasLo && !hasHi) return undefined;

    const lo = hasLo ? Number(loRaw) : Number.NEGATIVE_INFINITY;
    const hi = hasHi ? Number(hiRaw) : Number.POSITIVE_INFINITY;
    if ((hasLo && !Number.isFinite(lo)) || (hasHi && !Number.isFinite(hi))) {
      return undefined;
    }
    return sortRangeBounds(lo, hi);
  }

  const match = param.match(/^(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/);
  if (!match) return undefined;

  const lo = Number(match[1]);
  const hi = Number(match[2]);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return undefined;
  return sortRangeBounds(lo, hi);
};

export const normalizeLegacyIntegerUpperBoundRange = (
  param: string,
  range?: NumericRange
): NumericRange | undefined => {
  if (!param || !range) return range;
  if (!/^(-?\d+)-(-?\d+)$/.test(param)) return range;

  const [min, max] = range;
  if (!Number.isFinite(max)) return range;
  return [min, max + LEGACY_INTEGER_UPPER_BOUND_EPSILON];
};

export const formatRangeQueryValue = (
  value: number,
  precision = RANGE_QUERY_PRECISION
) => {
  if (!Number.isFinite(value)) return "";
  const rounded = Number(value.toFixed(precision));
  if (!Number.isFinite(rounded)) return "";
  if (Object.is(rounded, -0)) return "0";
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString();
};

export const serializeIntegerRange = (lo: number, hi: number) => {
  const [min, max] = sortRangeBounds(lo, hi);
  return `${Math.floor(min)}-${Math.ceil(max)}`;
};

export const serializeDecimalRange = (
  lo: number,
  hi: number,
  precision = RANGE_QUERY_PRECISION
) => {
  const [min, max] = sortRangeBounds(lo, hi);
  return `${formatRangeQueryValue(min, precision)}-${formatRangeQueryValue(
    max,
    precision
  )}`;
};

export const mergeDateRange = (
  manualStart?: Date,
  manualEnd?: Date,
  fromView?: { start?: string; end?: string }
) => {
  const viewStart = parseDateParam(fromView?.start);
  const viewEnd = parseDateParam(fromView?.end);

  const mergedStart = new Date(
    Math.max(
      manualStart
        ? startOfUtcDay(manualStart).getTime()
        : Number.NEGATIVE_INFINITY,
      viewStart ? startOfUtcDay(viewStart).getTime() : Number.NEGATIVE_INFINITY
    )
  );
  const mergedEnd = new Date(
    Math.min(
      manualEnd ? endOfUtcDay(manualEnd).getTime() : Number.POSITIVE_INFINITY,
      viewEnd ? endOfUtcDay(viewEnd).getTime() : Number.POSITIVE_INFINITY
    )
  );

  const hasStart =
    (manualStart ? 1 : 0) + (viewStart ? 1 : 0) > 0 &&
    Number.isFinite(mergedStart.getTime());
  const hasEnd =
    (manualEnd ? 1 : 0) + (viewEnd ? 1 : 0) > 0 &&
    Number.isFinite(mergedEnd.getTime());

  if (hasStart && hasEnd && mergedStart.getTime() > mergedEnd.getTime()) {
    return { start: undefined, end: undefined, conflict: true };
  }

  return {
    start: hasStart ? mergedStart : undefined,
    end: hasEnd ? mergedEnd : undefined,
    conflict: false,
  };
};

export const isTradeWithinDateRange = (
  row: TradeRow,
  start?: Date,
  end?: Date
) => {
  if (!start && !end) return true;
  const startMs = start
    ? startOfUtcDay(start).getTime()
    : Number.NEGATIVE_INFINITY;
  const endMs = end ? endOfUtcDay(end).getTime() : Number.POSITIVE_INFINITY;
  const openMs = Date.parse(row.open);
  const closeMs = Date.parse(row.close);

  const openInRange =
    Number.isFinite(openMs) && openMs >= startMs && openMs <= endMs;
  const closeInRange =
    Number.isFinite(closeMs) && closeMs >= startMs && closeMs <= endMs;

  return openInRange || closeInRange;
};

export const isValueInRange = (
  value: number | null | undefined,
  range?: NumericRange
) => {
  if (!range) return true;
  if (value == null || Number.isNaN(Number(value))) return false;

  const [min, max] = range;
  if (Number.isFinite(min) && Number(value) < min) return false;
  if (Number.isFinite(max) && Number(value) > max) return false;
  return true;
};
