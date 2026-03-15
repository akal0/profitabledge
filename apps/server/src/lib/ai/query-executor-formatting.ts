import type { TradeQueryPlan, Filter } from "./query-plan";
import { FIELD_MAP, type TradeField } from "./trade-fields";

export function formatWindowLabel(start: number, end: number): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const startLabel = startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endLabel = endDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${startLabel} - ${endLabel}`;
}

export function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/\s+/g, "_")
    .toLowerCase();
}

export function formatValue(
  value: any,
  field: TradeField | null | undefined
): string {
  if (value === null || value === undefined) return "N/A";

  const num = Number(value);
  if (Number.isNaN(num)) return String(value);

  if (!field || !field.unit) {
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  switch (field.unit) {
    case "$":
      return `${num < 0 ? "-$" : "$"}${Math.abs(num).toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}`;
    case "%":
      return `${num.toLocaleString(undefined, {
        minimumFractionDigits: num % 1 === 0 ? 0 : 1,
        maximumFractionDigits: 1,
      })}%`;
    case "pips":
      return `${num.toLocaleString(undefined, {
        maximumFractionDigits: 1,
      })} pips`;
    case "R":
      return `${num.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}R`;
    case "seconds":
      return formatSeconds(num);
    case "lots":
      return `${num.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })} lots`;
    default:
      return `${num.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })} ${field.unit}`;
  }
}

export function formatSeconds(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return `${hours}h ${minutes}m ${remainder}s`;
}

export function normalizeSymbolValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim().toUpperCase();
}

export function formatFilters(filters: Filter[]): string[] {
  return filters.map((filter) => {
    const field = FIELD_MAP.get(filter.field);
    const label = field?.label || filter.field;

    if (filter.op === "between" && "from" in filter.value) {
      return `${label} between ${filter.value.from} and ${filter.value.to}`;
    }

    return `${label} ${filter.op} ${filter.value}`;
  });
}

export function formatTimeframe(
  timeframe?: TradeQueryPlan["timeframe"]
): string | undefined {
  if (!timeframe) return undefined;

  if (timeframe.lastNDays) {
    return `Last ${timeframe.lastNDays} days`;
  }

  if (timeframe.from && timeframe.to) {
    return `${timeframe.from} to ${timeframe.to}`;
  }

  if (timeframe.from) {
    return `From ${timeframe.from}`;
  }

  if (timeframe.to) {
    return `Until ${timeframe.to}`;
  }

  return undefined;
}

export function generateCaveats(count: number, label?: string): string[] {
  const caveats: string[] = [];
  const prefix = label ? `${label}: ` : "";

  if (count === 0) {
    caveats.push(`${prefix}No trades found`);
  } else if (count < 10) {
    caveats.push(
      `${prefix}Small sample size (n=${count}) - results may not be reliable`
    );
  } else if (count < 30) {
    caveats.push(
      `${prefix}Limited sample size (n=${count}) - interpret with caution`
    );
  }

  return caveats;
}
