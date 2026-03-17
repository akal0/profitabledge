"use client";

import {
  TRADE_IDENTIFIER_TONES,
} from "@/components/trades/trade-identifier-pill";
import {
  formatCurrencyValue,
  formatNumberValue,
} from "@/lib/trade-formatting";

import type {
  CalendarGoal,
  CalendarRange,
  DayRow,
  GoalMarker,
  MonthSummary,
  TradePreview,
  ViewMode,
} from "./calendar-types";

export function toYMD(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  next.setDate(next.getDate() - day);
  return next;
}

export function endOfWeek(date: Date) {
  const start = startOfWeek(date);
  const next = new Date(start);
  next.setDate(start.getDate() + 6);
  return endOfDay(next);
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date) {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function buildMonthGrid(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const startWeekday = first.getDay();
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startWeekday);

  const days: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    const current = new Date(gridStart);
    current.setDate(gridStart.getDate() + i);
    days.push(current);
  }
  return days;
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function fromDateISO(dateISO: string) {
  const [year, month, day] = dateISO.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function clampRange(
  start: Date,
  end: Date,
  minDate: Date,
  maxDate: Date
) {
  let nextStart = new Date(start);
  let nextEnd = new Date(end);
  if (nextStart.getTime() < minDate.getTime()) nextStart = new Date(minDate);
  if (nextEnd.getTime() > maxDate.getTime()) nextEnd = new Date(maxDate);
  if (nextStart.getTime() > nextEnd.getTime()) nextStart = new Date(nextEnd);
  return { start: nextStart, end: nextEnd };
}

export function formatMoney(value: number) {
  return formatCurrencyValue(value, {
    maximumFractionDigits: 0,
    showPlus: true,
  });
}

export function formatTradePillMoney(value: number) {
  const abs = Math.abs(value);
  const hasFraction = !Number.isInteger(abs);
  return formatCurrencyValue(value, {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  });
}

export function formatTradeCount(value: number) {
  return formatNumberValue(value, {
    maximumFractionDigits: 0,
  });
}

export function getTradePillProfitTone(value: number) {
  return value < 0
    ? TRADE_IDENTIFIER_TONES.negative
    : value > 0
      ? TRADE_IDENTIFIER_TONES.positive
      : TRADE_IDENTIFIER_TONES.neutral;
}

export function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatAccessibleDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return "—";
  const total = Math.round(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}h ${String(mins).padStart(2, "0")}m`;
  }
  if (mins > 0) {
    return `${mins}m ${String(secs).padStart(2, "0")}s`;
  }
  return `${secs}s`;
}

export function getGoalMarkerClass(goal: GoalMarker) {
  if (!goal.isDeadline) return "bg-blue-400";
  if (goal.status === "achieved") return "bg-emerald-400";
  if (goal.status === "failed") return "bg-red-400";
  return "bg-amber-400";
}

export function getGoalLegendLabel(goal: GoalMarker) {
  return goal.isStart ? "Start" : "Due";
}

export function getGoalStatusText(goal: GoalMarker) {
  if (!goal.isDeadline) return null;
  if (goal.status === "achieved") return "Achieved";
  if (goal.status === "failed") return "Failed";
  if (goal.status === "paused") return "Paused";
  return `${Math.round(goal.progress)}%`;
}

export function getGoalStatusClass(goal: GoalMarker) {
  if (!goal.isDeadline) return "text-white/40";
  if (goal.status === "achieved") return "text-emerald-400";
  if (goal.status === "failed") return "text-rose-400";
  if (goal.status === "paused") return "text-white/45";
  return "text-amber-300";
}

export function getGoalLegendChipClass(goal: GoalMarker) {
  if (!goal.isDeadline) return "bg-blue-400 text-slate-950";
  if (goal.status === "achieved") return "bg-emerald-400 text-slate-950";
  if (goal.status === "failed") return "bg-red-500 text-white";
  return "bg-amber-400 text-slate-950";
}

export function formatActivePeriodLabel(
  range: CalendarRange | null,
  viewMode: ViewMode
) {
  if (!range) return "Select range";
  if (viewMode === "month") {
    return range.start.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }
  return `${formatShortDate(range.start)} - ${formatShortDate(range.end)}`;
}

export function buildMonthSummary(
  days: DayRow[] | null,
  range: CalendarRange | null
): MonthSummary | null {
  if (!days || !range) return null;

  const totalProfit = days.reduce((acc, day) => acc + Number(day.totalProfit || 0), 0);
  const totalTrades = days.reduce((acc, day) => acc + Number(day.count || 0), 0);
  const winDays = days.filter((day) => day.totalProfit > 0).length;
  const lossDays = days.filter((day) => day.totalProfit < 0).length;
  const flatDays = Math.max(0, days.length - winDays - lossDays);
  const activeDays = days.filter((day) => day.count > 0).length;
  const avgPerTrade = totalTrades > 0 ? totalProfit / totalTrades : 0;
  const avgPerActiveDay = activeDays > 0 ? totalProfit / activeDays : 0;
  const bestDay =
    days.length > 0
      ? days.reduce((best, current) =>
          current.totalProfit > best.totalProfit ? current : best
        )
      : null;
  const worstDay =
    days.length > 0
      ? days.reduce((worst, current) =>
          current.totalProfit < worst.totalProfit ? current : worst
        )
      : null;

  return {
    totalProfit,
    totalTrades,
    winDays,
    lossDays,
    flatDays,
    avgPerTrade,
    avgPerActiveDay,
    bestDay,
    worstDay,
    startLabel: formatShortDate(range.start),
    endLabel: formatShortDate(range.end),
  };
}

export function buildGoalMap(goals: CalendarGoal[], days?: DayRow[] | null) {
  const map = new Map<string, GoalMarker[]>();
  const activeDayKeys = new Set(
    (days || [])
      .filter(
        (day) =>
          Number(day.count || 0) > 0 || Number(day.liveTradeCount || 0) > 0
      )
      .map((day) => day.dateISO)
  );

  for (const goal of goals) {
    const title = goal.title?.trim();
    if (!title) continue;

    const target = parseFloat(goal.targetValue);
    const current = parseFloat(goal.currentValue);
    const progress = target > 0 ? (current / target) * 100 : 0;
    const deadlineKey = goal.deadline ? goal.deadline.slice(0, 10) : null;
    const entry = {
      title,
      type: goal.type,
      status: goal.status,
      progress: Math.min(100, progress),
    };

    if (
      goal.startDate &&
      activeDayKeys.has(goal.startDate.slice(0, 10)) &&
      goal.startDate.slice(0, 10) !== deadlineKey
    ) {
      const startKey = goal.startDate.slice(0, 10);
      const markers = map.get(startKey) || [];
      markers.push({ ...entry, isStart: true, isDeadline: false });
      map.set(startKey, markers);
    }

    if (deadlineKey) {
      const markers = map.get(deadlineKey) || [];
      markers.push({ ...entry, isStart: false, isDeadline: true });
      map.set(deadlineKey, markers);
    }
  }

  return map;
}

export function normalizeRecentDayRows(rows: DayRow[]) {
  const dayMap = new Map<string, DayRow>();

  for (const day of rows) {
    const utcDate = new Date(`${day.dateISO}T00:00:00Z`);
    const localDateKey = toYMD(utcDate);
    const existing = dayMap.get(localDateKey);

    if (!existing) {
      dayMap.set(localDateKey, {
        dateISO: localDateKey,
        totalProfit: Number(day.totalProfit),
        count: Number(day.count),
        percent: Number(day.percent || 0),
      });
      continue;
    }

    existing.totalProfit = Number(existing.totalProfit) + Number(day.totalProfit);
    existing.count = Number(existing.count) + Number(day.count);
    existing.percent = existing.percent + (day.percent || 0);
  }

  return Array.from(dayMap.values()).sort((left, right) =>
    left.dateISO.localeCompare(right.dateISO)
  );
}

function toUTCYMD(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function filterPreviewTradesForDate(items: Array<Record<string, unknown>>, dateISO: string) {
  // dateISO is the server's UTC date — compare trade open times in UTC to stay consistent
  return items
    .filter((trade) => {
      const tradeOpen =
        typeof trade.openTime === "string"
          ? trade.openTime
          : typeof trade.open === "string"
            ? trade.open
            : null;

      if (!tradeOpen) return false;
      const d = new Date(tradeOpen);
      if (Number.isNaN(d.getTime())) return false;
      return toUTCYMD(d) === dateISO;
    })
    .map(
      (trade): TradePreview => ({
        id: String(trade.id ?? ""),
        symbol: String(trade.symbol ?? "Unknown"),
        open: String(
          typeof trade.openTime === "string"
            ? trade.openTime
            : typeof trade.open === "string"
              ? trade.open
              : ""
        ),
        profit: Number(trade.profit ?? 0),
        holdSeconds: Number(trade.holdSeconds ?? 0),
        status: "closed",
        accountName:
          typeof trade.accountName === "string" ? trade.accountName : null,
      })
    );
}

export function buildLiveTradePreviewMap(trades: TradePreview[]) {
  const previewMap = new Map<string, TradePreview[]>();

  for (const trade of trades) {
    if (!trade.open) continue;

    const openedAt = new Date(trade.open);
    if (Number.isNaN(openedAt.getTime())) continue;

    const dayKey = toUTCYMD(openedAt);
    const bucket = previewMap.get(dayKey) ?? [];
    bucket.push(trade);
    bucket.sort(
      (left, right) =>
        new Date(left.open).getTime() - new Date(right.open).getTime()
    );
    previewMap.set(dayKey, bucket);
  }

  return previewMap;
}

export function mergeDayRowsWithLiveTrades(
  rows: DayRow[] | null,
  liveTrades: TradePreview[]
) {
  const dayMap = new Map<string, DayRow>();

  for (const row of rows ?? []) {
    dayMap.set(row.dateISO, {
      ...row,
      liveTradeCount: row.liveTradeCount ?? 0,
      liveTradeProfit: row.liveTradeProfit ?? 0,
    });
  }

  for (const trade of liveTrades) {
    if (!trade.open) continue;

    const openedAt = new Date(trade.open);
    if (Number.isNaN(openedAt.getTime())) continue;

    const dayKey = toUTCYMD(openedAt);
    const current = dayMap.get(dayKey) ?? {
      dateISO: dayKey,
      totalProfit: 0,
      percent: 0,
      count: 0,
      liveTradeCount: 0,
      liveTradeProfit: 0,
      dayNumber: Number(dayKey.slice(8, 10)),
    };

    current.liveTradeCount = (current.liveTradeCount ?? 0) + 1;
    current.liveTradeProfit =
      (current.liveTradeProfit ?? 0) + Number(trade.profit || 0);
    dayMap.set(dayKey, current);
  }

  return Array.from(dayMap.values()).sort((left, right) =>
    left.dateISO.localeCompare(right.dateISO)
  );
}

export function extendBoundsWithTradePreviews(
  bounds: { minISO: string; maxISO: string } | null,
  trades: TradePreview[]
) {
  if (!bounds && trades.length === 0) {
    return null;
  }

  let minTs = bounds ? new Date(bounds.minISO).getTime() : Number.POSITIVE_INFINITY;
  let maxTs = bounds ? new Date(bounds.maxISO).getTime() : 0;

  for (const trade of trades) {
    if (!trade.open) continue;

    const openedAt = new Date(trade.open).getTime();
    if (!Number.isFinite(openedAt)) continue;

    if (openedAt < minTs) minTs = openedAt;
    if (openedAt > maxTs) maxTs = openedAt;
  }

  if (!Number.isFinite(minTs) || maxTs <= 0) {
    return bounds;
  }

  return {
    minISO: new Date(minTs).toISOString(),
    maxISO: new Date(maxTs).toISOString(),
  };
}

export function getHeatmapBg(
  profit: number,
  count: number,
  heatmapMaxAbs: number
): string | undefined {
  if (count === 0 || profit === 0) return undefined;
  const intensity = Math.min(1, Math.abs(profit) / heatmapMaxAbs);

  if (profit > 0) {
    const opacity = (0.1 + intensity * 0.3).toFixed(2);
    return `rgba(20, 184, 166, ${opacity})`;
  }

  const opacity = (0.1 + intensity * 0.3).toFixed(2);
  return `rgba(244, 63, 94, ${opacity})`;
}
