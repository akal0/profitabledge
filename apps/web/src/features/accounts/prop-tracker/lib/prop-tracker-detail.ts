export type MetricMode = "currency" | "percent";
export type SurvivalState = "critical" | "fragile" | "tight" | "stable";
export type PropFirmLike = {
  id?: string | null;
  displayName?: string | null;
};

export type StatusAppearance = {
  label: string;
  className: string;
};

export type SurvivalTone = {
  label: string;
  badge: string;
};

export type RuleWatchItem = {
  label: string;
  current: string;
  threshold: string;
  hint: string;
  status: "safe" | "warning" | "danger";
  currentClassName?: string;
  completed?: boolean;
};

export const HEADER_BADGE_CLASS =
  "h-7 rounded-sm px-1.5 text-[10px] font-medium";
export const FTMO_PROP_FIRM_ID = "ftmo";
export const FTMO_IMAGE_SRC = "/brokers/FTMO.png";
export const GOALS_SURFACE_OUTER_CLASS =
  "group flex flex-col rounded-sm ring ring-white/5 bg-sidebar p-1.5";
export const GOALS_SURFACE_INNER_CLASS =
  "flex flex-1 flex-col rounded-sm bg-sidebar-accent transition-all duration-250 group-hover:brightness-120";
export const GOALS_PANEL_BODY_CLASS = "px-4 py-4 sm:px-5 sm:py-5";
export const PANEL_ROW_PADDING_CLASS = "px-4 py-2.5 sm:px-5 sm:py-3";
export const CHART_ACTION_GROUP_CLASS =
  "flex items-center overflow-hidden rounded-sm ring ring-white/5 bg-sidebar";
export const CHART_ACTION_GROUP_BUTTON_CLASS =
  "h-[38px] rounded-none ring-0 bg-sidebar px-3 py-2 text-xs text-white transition-colors hover:bg-sidebar-accent disabled:cursor-not-allowed disabled:text-white/25 disabled:hover:bg-sidebar";

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function addMonths(date: Date, value: number) {
  return new Date(date.getFullYear(), date.getMonth() + value, 1);
}

export function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function isSameCalendarMonth(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

export function clampRangeToBounds(
  range: { start: Date; end: Date },
  bounds: { min: Date; max: Date }
) {
  const nextStart = new Date(range.start);
  const nextEnd = new Date(range.end);

  if (nextStart < bounds.min) {
    nextStart.setTime(bounds.min.getTime());
  }

  if (nextEnd > bounds.max) {
    nextEnd.setTime(bounds.max.getTime());
  }

  return { start: nextStart, end: nextEnd };
}

export function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getOverallPropProgress(input: {
  initialBalance: unknown;
  currentBalance?: unknown;
  fallbackBalance?: unknown;
}) {
  const initialBalance = toNumber(input.initialBalance);
  const currentBalance = toNumber(
    input.currentBalance,
    toNumber(input.fallbackBalance, initialBalance)
  );

  if (initialBalance <= 0) {
    return {
      initialBalance,
      currentBalance,
      profit: 0,
      profitPercent: 0,
    };
  }

  const profit = currentBalance - initialBalance;
  const profitPercent = (profit / initialBalance) * 100;

  return {
    initialBalance,
    currentBalance,
    profit,
    profitPercent,
  };
}

export function formatUsd(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

export function formatMetricValue(
  value: number | null | undefined,
  mode: MetricMode,
  fallback = "—"
) {
  if (value == null || Number.isNaN(value)) return fallback;
  return mode === "currency" ? formatUsd(value) : `${value.toFixed(2)}%`;
}

export function formatSignedMetricValue(
  value: number | null | undefined,
  mode: MetricMode,
  fallback = "—"
) {
  if (value == null || Number.isNaN(value)) return fallback;
  if (mode === "currency") {
    const abs = Math.abs(value);
    return `${value >= 0 ? "+" : "-"}${formatUsd(abs)}`;
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function getMetricMode(
  currentPhase:
    | {
        profitTargetType?: string | null;
      }
    | null
    | undefined
): MetricMode {
  return currentPhase?.profitTargetType === "absolute" ? "currency" : "percent";
}

export function getPropStatusAppearance(
  status: string | null | undefined
): StatusAppearance {
  switch (status) {
    case "active":
      return {
        label: "Active",
        className: "ring-blue-500/30 bg-blue-500/15 text-blue-400",
      };
    case "passed":
      return {
        label: "Passed",
        className: "ring-teal-500/30 bg-teal-500/15 text-teal-400",
      };
    case "failed":
      return {
        label: "Failed",
        className: "ring-red-500/30 bg-red-500/15 text-red-400",
      };
    case "paused":
      return {
        label: "Paused",
        className: "ring-white/10 bg-sidebar text-white/50",
      };
    default:
      return {
        label: "Unknown",
        className: "ring-white/10 bg-black/10 text-white/50 dark:bg-sidebar",
      };
  }
}

export function getSurvivalTone(state?: string | null): SurvivalTone {
  switch (state) {
    case "critical":
      return {
        label: "Critical",
        badge: "ring-rose-500/30 bg-rose-500/15 text-rose-300",
      };
    case "fragile":
      return {
        label: "Fragile",
        badge: "ring-amber-500/30 bg-amber-500/15 text-amber-300",
      };
    case "tight":
      return {
        label: "Tight",
        badge: "ring-yellow-500/30 bg-yellow-500/15 text-yellow-300",
      };
    default:
      return {
        label: "Stable",
        badge: "ring-teal-500/30 bg-teal-500/15 text-teal-300",
      };
  }
}

export function isFtmoFirm(firm?: PropFirmLike | null) {
  const id = String(firm?.id || "").toLowerCase();
  const displayName = String(firm?.displayName || "").toLowerCase();
  return id === FTMO_PROP_FIRM_ID || displayName === "ftmo";
}
