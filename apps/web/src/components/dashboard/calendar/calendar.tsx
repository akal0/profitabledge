"use client";

import EditWidgets from "@/public/icons/edit-widgets.svg";
import { trpcClient } from "@/utils/trpc";
import { useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "../../ui/skeleton";
import { cn } from "@/lib/utils";
import { Button } from "../../ui/button";
import { Separator } from "../../ui/separator";
import PickerComponent from "./picker";
import {
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
} from "@/components/trades/trade-identifier-pill";
import { useDateRangeStore } from "@/stores/date-range";
import { useRouter } from "next/navigation";
import { useAccountStore } from "@/stores/account";
import {
  DndContext,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  GripVertical,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatCurrencyValue,
  formatNumberValue,
} from "@/lib/trade-formatting";

type DayRow = {
  dateISO: string;
  totalProfit: number;
  percent: number;
  count: number;
  dayNumber?: number;
};

type ViewMode = "week" | "month";

export type CalendarWidgetType =
  | "net-pl"
  | "win-rate"
  | "largest-trade"
  | "largest-loss"
  | "hold-time"
  | "avg-trade";

export const defaultCalendarWidgets: CalendarWidgetType[] = [
  "net-pl",
  "win-rate",
  "largest-trade",
  "largest-loss",
  "hold-time",
  "avg-trade",
];

export const defaultCalendarWidgetSpans: Partial<
  Record<CalendarWidgetType, number>
> = {};

type RangeSummary = {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  largestTrade: number | null;
  largestLoss: number | null;
  avgHoldSeconds: number | null;
};

type CalendarGoal = {
  id: string;
  title: string;
  type: string;
  targetType: string;
  targetValue: string;
  currentValue: string;
  status: string;
  startDate: string;
  deadline: string | null;
};

type GoalMarker = {
  title: string;
  type: string;
  status: string;
  isStart: boolean;
  isDeadline: boolean;
  progress: number;
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  next.setDate(next.getDate() - day);
  return next;
}

function endOfWeek(date: Date) {
  const start = startOfWeek(date);
  const next = new Date(start);
  next.setDate(start.getDate() + 6);
  return endOfDay(next);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function buildMonthGrid(date: Date) {
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

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function fromDateISO(dateISO: string) {
  const [year, month, day] = dateISO.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toYMD(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function clampRange(start: Date, end: Date, minDate: Date, maxDate: Date) {
  let nextStart = new Date(start);
  let nextEnd = new Date(end);
  if (nextStart.getTime() < minDate.getTime()) nextStart = new Date(minDate);
  if (nextEnd.getTime() > maxDate.getTime()) nextEnd = new Date(maxDate);
  if (nextStart.getTime() > nextEnd.getTime()) nextStart = new Date(nextEnd);
  return { start: nextStart, end: nextEnd };
}

function formatMoney(value: number) {
  return formatCurrencyValue(value, {
    maximumFractionDigits: 0,
    showPlus: true,
  });
}

function formatTradePillMoney(value: number) {
  const abs = Math.abs(value);
  const hasFraction = !Number.isInteger(abs);
  return formatCurrencyValue(value, {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  });
}

function formatTradeCount(value: number) {
  return formatNumberValue(value, {
    maximumFractionDigits: 0,
  });
}

function getTradePillProfitTone(value: number) {
  return value < 0
    ? TRADE_IDENTIFIER_TONES.negative
    : value > 0
    ? TRADE_IDENTIFIER_TONES.positive
    : TRADE_IDENTIFIER_TONES.neutral;
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatAccessibleDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDuration(seconds: number | null | undefined) {
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

function getGoalMarkerClass(goal: GoalMarker) {
  if (!goal.isDeadline) return "bg-blue-400";
  if (goal.status === "achieved") return "bg-emerald-400";
  if (goal.status === "failed") return "bg-red-400";
  return "bg-amber-400";
}

function getGoalLegendLabel(goal: GoalMarker) {
  return goal.isStart ? "Start" : "Due";
}

function getGoalStatusText(goal: GoalMarker) {
  if (!goal.isDeadline) return null;
  if (goal.status === "achieved") return "Achieved";
  if (goal.status === "failed") return "Failed";
  if (goal.status === "paused") return "Paused";
  return `${Math.round(goal.progress)}%`;
}

function getGoalStatusClass(goal: GoalMarker) {
  if (!goal.isDeadline) return "text-white/40";
  if (goal.status === "achieved") return "text-emerald-400";
  if (goal.status === "failed") return "text-rose-400";
  if (goal.status === "paused") return "text-white/45";
  return "text-amber-300";
}

function getGoalLegendChipClass(goal: GoalMarker) {
  if (!goal.isDeadline) return "bg-blue-400 text-slate-950";
  if (goal.status === "achieved") return "bg-emerald-400 text-slate-950";
  if (goal.status === "failed") return "bg-red-500 text-white";
  return "bg-amber-400 text-slate-950";
}

function formatActivePeriodLabel(
  range: { start: Date; end: Date } | null,
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

const segmentedControlClass =
  "bg-white dark:bg-muted/25 flex h-max w-max items-center gap-1 rounded-sm p-[3px]";

const getSegmentedButtonClass = (active: boolean) =>
  cn(
    "flex h-[38px] w-max items-center justify-center gap-2 rounded-sm px-3 py-2 text-xs transition-all duration-250 active:scale-95",
    active
      ? "bg-[#222225] text-white hover:bg-[#222225] hover:!brightness-120"
      : "bg-[#222225]/25 text-white/25 hover:bg-[#222225] hover:!brightness-105 hover:text-white"
  );

const actionButtonClass =
  "flex h-[38px] w-max items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110";

const actionGroupClass =
  "flex items-center overflow-hidden rounded-sm border border-white/5 bg-sidebar";

const actionGroupButtonClass =
  "h-[38px] rounded-none border-0 bg-sidebar px-3 py-2 text-xs text-white transition-colors hover:bg-sidebar-accent disabled:cursor-not-allowed disabled:text-white/25 disabled:hover:bg-sidebar";

function SummaryCard({
  title,
  value,
  subtext,
  accentClass,
  loading,
}: {
  title: string;
  value: React.ReactNode;
  subtext?: string;
  accentClass?: string;
  loading?: boolean;
}) {
  return (
    <div className="border border-white/5 bg-white dark:bg-sidebar px-5 flex flex-col gap-1 h-full rounded-sm justify-center">
      <span className="text-[10px] uppercase tracking-wide text-white/50">
        {title}
      </span>
      {loading ? (
        <Skeleton className="h-6 w-24 rounded-none bg-sidebar-accent" />
      ) : (
        <span className={cn("text-lg font-semibold text-white", accentClass)}>
          {value}
        </span>
      )}
      <span className="text-[10px] text-white/40">{subtext || "—"}</span>
    </div>
  );
}

function SortableSummaryWidget({
  id,
  disabled,
  style,
  children,
}: {
  id: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });
  const mergedStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
    ...style,
  };
  return (
    <div
      ref={setNodeRef}
      style={mergedStyle}
      className="h-full"
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

export default function Calendar({
  accountId,
  isEditing = false,
  summaryWidgets = defaultCalendarWidgets,
  summaryWidgetSpans = defaultCalendarWidgetSpans,
  onToggleSummaryWidget,
  onReorderSummaryWidget,
  onResizeSummaryWidget,
  onEnterEdit,
  onToggleEdit,
}: {
  accountId?: string;
  isEditing?: boolean;
  summaryWidgets?: CalendarWidgetType[];
  summaryWidgetSpans?: Partial<Record<CalendarWidgetType, number>>;
  onToggleSummaryWidget?: (type: CalendarWidgetType) => void;
  onReorderSummaryWidget?: (fromIndex: number, toIndex: number) => void;
  onResizeSummaryWidget?: (type: CalendarWidgetType, span: number) => void;
  onEnterEdit?: () => void;
  onToggleEdit?: () => void;
}) {
  const [days, setDays] = useState<DayRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [bounds, setBounds] = useState<{
    minISO: string;
    maxISO: string;
  } | null>(null);
  const [initialBalance, setInitialBalance] = useState<number | null>(null);
  const router = useRouter();
  const setSelectedAccountId = useAccountStore((s) => s.setSelectedAccountId);
  const [hoveredISO, setHoveredISO] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [goalOverlay, setGoalOverlay] = useState(false);
  const [goals, setGoals] = useState<CalendarGoal[]>([]);
  const [rangeSummary, setRangeSummary] = useState<RangeSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [previews, setPreviews] = useState<
    Record<
      string,
      {
        loading: boolean;
        trades: Array<{
          id: string;
          symbol: string;
          open: string;
          profit: number;
          holdSeconds: number;
        }>;
      }
    >
  >({});
  const summaryPressTimerRef = useRef<number | null>(null);

  const summaryWidgetList = summaryWidgets.slice(0, 6);
  const availableSummaryWidgets = defaultCalendarWidgets.filter(
    (widget) => !summaryWidgetList.includes(widget)
  );
  const getSummarySpan = (type: CalendarWidgetType) => {
    const raw = Number(summaryWidgetSpans[type] ?? 1);
    return Math.max(1, Math.min(2, Math.round(Number.isFinite(raw) ? raw : 1)));
  };

  const summarySensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleSummaryDragEnd = (event: DragEndEvent) => {
    if (!isEditing) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = summaryWidgetList.indexOf(active.id as CalendarWidgetType);
    const newIndex = summaryWidgetList.indexOf(over.id as CalendarWidgetType);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorderSummaryWidget?.(oldIndex, newIndex);
  };

  const handleSummaryPointerDown = () => {
    if (isEditing) return;
    summaryPressTimerRef.current = window.setTimeout(
      () => onEnterEdit?.(),
      500
    );
  };

  const handleSummaryPointerUp = () => {
    if (summaryPressTimerRef.current) {
      window.clearTimeout(summaryPressTimerRef.current);
      summaryPressTimerRef.current = null;
    }
  };

  const dayMap = useMemo(() => {
    const map = new Map<string, DayRow>();
    (days || []).forEach((d) => map.set(d.dateISO, d));
    return map;
  }, [days]);

  const monthGrid = useMemo(() => {
    if (!range) return [];
    if (viewMode === "week") {
      // Weekly view: show exactly 7 days
      const days: Date[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(range.start);
        d.setDate(d.getDate() + i);
        days.push(d);
      }
      return days;
    }
    // Monthly view: build from start of month (42 days grid)
    const gridStart = startOfMonth(range.start);
    return buildMonthGrid(gridStart);
  }, [range, viewMode]);

  // Heatmap: compute max absolute profit for color scaling
  const heatmapMaxAbs = useMemo(() => {
    if (!days || days.length === 0) return 1;
    return Math.max(1, ...days.map((d) => Math.abs(d.totalProfit)));
  }, [days]);

  const getHeatmapBg = (profit: number, count: number): string => {
    if (count === 0 || profit === 0) return "";
    const intensity = Math.min(1, Math.abs(profit) / heatmapMaxAbs);
    if (profit > 0) {
      // green scale: 10% -> 40% opacity
      const opacity = (0.1 + intensity * 0.3).toFixed(2);
      return `rgba(20, 184, 166, ${opacity})`; // teal-500
    }
    // red scale
    const opacity = (0.1 + intensity * 0.3).toFixed(2);
    return `rgba(244, 63, 94, ${opacity})`; // rose-500
  };

  const monthSummary = useMemo(() => {
    if (!days || !range) return null;
    const totalProfit = days.reduce(
      (acc, d) => acc + Number(d.totalProfit || 0),
      0
    );
    const totalTrades = days.reduce((acc, d) => acc + Number(d.count || 0), 0);
    const winDays = days.filter((d) => d.totalProfit > 0).length;
    const lossDays = days.filter((d) => d.totalProfit < 0).length;
    const flatDays = Math.max(0, days.length - winDays - lossDays);
    const activeDays = days.filter((d) => d.count > 0).length;
    const avgPerTrade = totalTrades > 0 ? totalProfit / totalTrades : 0;
    const avgPerActiveDay = activeDays > 0 ? totalProfit / activeDays : 0;
    const bestDay =
      days.length > 0
        ? days.reduce((best, cur) =>
            cur.totalProfit > best.totalProfit ? cur : best
          )
        : null;
    const worstDay =
      days.length > 0
        ? days.reduce((worst, cur) =>
            cur.totalProfit < worst.totalProfit ? cur : worst
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
  }, [days, range]);

  const rangeLabel = monthSummary
    ? `${monthSummary.startLabel} · ${monthSummary.endLabel}`
    : "—";
  const activePeriodLabel = useMemo(
    () => formatActivePeriodLabel(range, viewMode),
    [range, viewMode]
  );
  const canNavigatePrevious = useMemo(() => {
    if (!range || !bounds) return false;
    const minDate = new Date(bounds.minISO);
    if (viewMode === "month") {
      return (
        startOfMonth(range.start).getTime() > startOfMonth(minDate).getTime()
      );
    }
    return startOfWeek(range.start).getTime() > startOfWeek(minDate).getTime();
  }, [bounds, range, viewMode]);
  const canNavigateNext = useMemo(() => {
    if (!range || !bounds) return false;
    const maxDate = new Date(bounds.maxISO);
    if (viewMode === "month") {
      return (
        startOfMonth(range.start).getTime() < startOfMonth(maxDate).getTime()
      );
    }
    return startOfWeek(range.start).getTime() < startOfWeek(maxDate).getTime();
  }, [bounds, range, viewMode]);

  const renderSummaryWidget = (type: CalendarWidgetType) => {
    switch (type) {
      case "net-pl": {
        const total = monthSummary?.totalProfit ?? 0;
        return (
          <SummaryCard
            title="Net P/L"
            value={monthSummary ? formatMoney(total) : "—"}
            subtext={rangeLabel}
            accentClass={total >= 0 ? "text-teal-400" : "text-rose-400"}
            loading={!monthSummary}
          />
        );
      }
      case "win-rate": {
        return (
          <SummaryCard
            title="Win rate"
            value={rangeSummary ? formatPercent(rangeSummary.winRate) : "—"}
            subtext={
              rangeSummary
                ? `${rangeSummary.wins}W · ${rangeSummary.losses}L`
                : "—"
            }
            loading={summaryLoading || !rangeSummary}
          />
        );
      }
      case "largest-trade": {
        const value =
          rangeSummary?.largestTrade != null
            ? formatMoney(rangeSummary.largestTrade)
            : "—";
        return (
          <SummaryCard
            title="Largest trade"
            value={value}
            subtext={
              rangeSummary?.totalTrades
                ? `${rangeSummary.totalTrades} trades`
                : "—"
            }
            accentClass="text-teal-400"
            loading={summaryLoading || !rangeSummary}
          />
        );
      }
      case "largest-loss": {
        const value =
          rangeSummary?.largestLoss != null
            ? formatMoney(rangeSummary.largestLoss)
            : "—";
        return (
          <SummaryCard
            title="Largest loss"
            value={value}
            subtext={
              rangeSummary?.losses != null
                ? `${rangeSummary.losses} losing trades`
                : "—"
            }
            accentClass="text-rose-400"
            loading={summaryLoading || !rangeSummary}
          />
        );
      }
      case "hold-time": {
        return (
          <SummaryCard
            title="Hold time"
            value={formatDuration(rangeSummary?.avgHoldSeconds)}
            subtext={
              rangeSummary?.totalTrades
                ? `Avg over ${rangeSummary.totalTrades} trades`
                : "—"
            }
            loading={summaryLoading || !rangeSummary}
          />
        );
      }
      case "avg-trade": {
        const hasTrades = (monthSummary?.totalTrades ?? 0) > 0;
        const avgValue = hasTrades
          ? formatMoney(monthSummary?.avgPerTrade ?? 0)
          : "—";
        return (
          <SummaryCard
            title="Avg per trade"
            value={avgValue}
            subtext={
              monthSummary?.totalTrades
                ? `${monthSummary.totalTrades} trades`
                : "—"
            }
            accentClass={
              hasTrades && (monthSummary?.avgPerTrade ?? 0) >= 0
                ? "text-teal-400"
                : "text-rose-400"
            }
            loading={!monthSummary}
          />
        );
      }
      default:
        return null;
    }
  };

  const loadPreview = async (dateISO: string) => {
    if (!accountId) return;
    if (previews[dateISO]?.loading) return;
    if (previews[dateISO]?.trades && previews[dateISO].trades.length > 0)
      return;
    setPreviews((p) => ({ ...p, [dateISO]: { loading: true, trades: [] } }));
    try {
      const res = await trpcClient.trades.listInfinite.query({
        accountId,
        limit: 200,
      } as any);
      const items = res.items as Array<any>;
      const targetDate = new Date(dateISO + "T00:00:00Z");
      const targetYMD = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;
      const filtered = items.filter((t) => {
        const tradeOpen = t.openTime || t.open;
        if (!tradeOpen) return false;
        const tradeDate = new Date(tradeOpen);
        const tradeYMD = `${tradeDate.getFullYear()}-${String(tradeDate.getMonth() + 1).padStart(2, "0")}-${String(tradeDate.getDate()).padStart(2, "0")}`;
        return tradeYMD === targetYMD;
      });
      setPreviews((p) => ({
        ...p,
        [dateISO]: { loading: false, trades: filtered },
      }));
    } catch {
      setPreviews((p) => ({ ...p, [dateISO]: { loading: false, trades: [] } }));
    }
  };

  useEffect(() => {
    let mounted = true;
    if (!accountId || !range || viewMode !== "month") {
      setRangeSummary(null);
      setSummaryLoading(false);
      return;
    }
    setSummaryLoading(true);
    (async () => {
      try {
        const data = await trpcClient.accounts.rangeSummary.query({
          accountId,
          startISO: range.start.toISOString(),
          endISO: range.end.toISOString(),
        });
        if (mounted) {
          setRangeSummary(data as RangeSummary);
        }
      } catch {
        if (mounted) setRangeSummary(null);
      } finally {
        if (mounted) setSummaryLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [accountId, range, viewMode]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!accountId) return;
      setLoading(true);
      try {
        // Fetch account initial balance for % calculations
        const accounts = await trpcClient.accounts.list.query();
        if (mounted) {
          const acc = (accounts as any[])?.find?.((a) => a.id === accountId);
          const ib =
            acc?.initialBalance != null ? Number(acc.initialBalance) : null;
          setInitialBalance(Number.isFinite(ib) ? Number(ib) : null);
        }

        const b = await trpcClient.accounts.opensBounds.query({ accountId });
        const minDate = new Date(b.minISO);
        const maxDate = new Date(b.maxISO);
        // For month view, fetch extra days to show next month's beginning in the grid
        const extraDays = viewMode === "month" ? 14 : 0;
        const monthEnd = endOfMonth(maxDate);
        const fetchEnd = new Date(monthEnd);
        fetchEnd.setDate(fetchEnd.getDate() + extraDays);
        // In month view, don't clamp to maxDate (last trade) - allow fetching future days for grid
        const anchored = viewMode === "month"
          ? { start: startOfMonth(maxDate), end: fetchEnd }
          : clampRange(startOfMonth(maxDate), fetchEnd, minDate, maxDate);
        if (mounted) {
          setBounds(b);
          setRange(anchored);
          useDateRangeStore.getState().setRange(anchored.start, anchored.end);
          useDateRangeStore.getState().setBounds(minDate, maxDate);
        }
        const data = await trpcClient.accounts.recentByDay.query({
          accountId,
          startISO: anchored.start.toISOString(),
          endISO: anchored.end.toISOString(),
        });
        if (mounted) {
          // Deduplicate by dateISO using Map - convert to local date for matching
          const dayMap = new Map<string, DayRow>();
          for (const day of (data as DayRow[])) {
            // Convert UTC date from backend to local date
            const utcDate = new Date(day.dateISO + "T00:00:00Z");
            const localDateKey = `${utcDate.getFullYear()}-${String(utcDate.getMonth() + 1).padStart(2, "0")}-${String(utcDate.getDate()).padStart(2, "0")}`;
            const existing = dayMap.get(localDateKey);
            if (!existing) {
              dayMap.set(localDateKey, {
                dateISO: localDateKey,
                totalProfit: Number(day.totalProfit),
                count: Number(day.count),
                percent: Number(day.percent || 0),
              });
            } else {
              // Merge profits and counts for duplicate dates
              existing.totalProfit = Number(existing.totalProfit) + Number(day.totalProfit);
              existing.count = Number(existing.count) + Number(day.count);
              existing.percent = existing.percent + (day.percent || 0);
            }
          }
          const uniqueDays = Array.from(dayMap.values()).sort((a, b) =>
            a.dateISO.localeCompare(b.dateISO)
          );
          setDays(uniqueDays);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [accountId]);

  // Fetch goals once per account so hover tooltips can always surface them.
  useEffect(() => {
    if (!accountId) {
      setGoals([]);
      return;
    }
    let mounted = true;
    setGoals([]);
    (async () => {
      try {
        const data = await trpcClient.goals.list.query({
          accountId: accountId || undefined,
        });
        if (mounted) setGoals(data as any[]);
      } catch {
        if (mounted) setGoals([]);
      }
    })();
    return () => { mounted = false; };
  }, [accountId]);

  // Build goal lookup: dateISO -> goals on that day
  const goalMap = useMemo(() => {
    const map = new Map<string, GoalMarker[]>();
    for (const g of goals) {
      const target = parseFloat(g.targetValue);
      const current = parseFloat(g.currentValue);
      const progress = target > 0 ? (current / target) * 100 : 0;
      const entry = { title: g.title, type: g.type, status: g.status, progress: Math.min(100, progress) };
      // Mark start date
      if (g.startDate) {
        const startKey = g.startDate.slice(0, 10);
        const arr = map.get(startKey) || [];
        arr.push({ ...entry, isStart: true, isDeadline: false });
        map.set(startKey, arr);
      }
      // Mark deadline
      if (g.deadline) {
        const deadlineKey = g.deadline.slice(0, 10);
        const arr = map.get(deadlineKey) || [];
        arr.push({ ...entry, isStart: false, isDeadline: true });
        map.set(deadlineKey, arr);
      }
    }
    return map;
  }, [goals]);

  const handleRangeChange = async (
    start: Date,
    end: Date,
    nextViewMode: ViewMode = viewMode
  ) => {
    if (!accountId) return;
    // For month view, extend start to beginning of month to fetch all days in grid
    let fetchStart = new Date(start);
    let fetchEnd = new Date(end);
    if (nextViewMode === "month") {
      fetchStart = startOfMonth(start);
    }
    // Keep the user's original selection for the picker display
    setRange({ start, end });
    useDateRangeStore.getState().setRange(start, end);
    setLoading(true);
    try {
      const data = await trpcClient.accounts.recentByDay.query({
        accountId,
        startISO: fetchStart.toISOString(),
        endISO: fetchEnd.toISOString(),
      });
      // Deduplicate by dateISO using Map - convert to local date for matching
      const dayMap = new Map<string, DayRow>();
      for (const day of (data as DayRow[])) {
        // Convert UTC date from backend to local date
        const utcDate = new Date(day.dateISO + "T00:00:00Z");
        const localDateKey = `${utcDate.getFullYear()}-${String(utcDate.getMonth() + 1).padStart(2, "0")}-${String(utcDate.getDate()).padStart(2, "0")}`;
        const existing = dayMap.get(localDateKey);
        if (!existing) {
          dayMap.set(localDateKey, {
            dateISO: localDateKey,
            totalProfit: Number(day.totalProfit),
            count: Number(day.count),
            percent: Number(day.percent || 0),
          });
        } else {
          existing.totalProfit = Number(existing.totalProfit) + Number(day.totalProfit);
          existing.count = Number(existing.count) + Number(day.count);
          existing.percent = existing.percent + (day.percent || 0);
        }
      }
      const uniqueDays = Array.from(dayMap.values()).sort((a, b) =>
        a.dateISO.localeCompare(b.dateISO)
      );
      setDays(uniqueDays);
    } finally {
      setLoading(false);
    }
  };

  const handleViewChange = (mode: ViewMode) => {
    if (mode === viewMode) return;
    setViewMode(mode);
    if (!range || !bounds) return;
    const minDate = new Date(bounds.minISO);
    const maxDate = new Date(bounds.maxISO);
    const anchor = range.end ?? range.start ?? new Date();

    let nextStart: Date;
    let nextEnd: Date;

    if (mode === "month") {
      // Expanding to month view - show full month (start to end of month)
      nextStart = startOfMonth(anchor);
      nextEnd = endOfMonth(anchor);
    } else {
      // Contracting to week view - show max 7 days, clamped to trade bounds
      const weekRange = clampRange(startOfWeek(anchor), endOfWeek(anchor), minDate, maxDate);
      nextStart = weekRange.start;
      nextEnd = weekRange.end;
    }
    void handleRangeChange(nextStart, nextEnd, mode);
  };

  const handleDayClick = (dateISO: string) => {
    const day = fromDateISO(dateISO);
    const start = startOfDay(day);
    const end = endOfDay(day);
    useDateRangeStore.getState().setRange(start, end);
    if (accountId) setSelectedAccountId(accountId);
    router.push(`/dashboard/trades?oStart=${toYMD(start)}&oEnd=${toYMD(end)}`);
  };

  const handleDayKeyDown = (
    event: React.KeyboardEvent<HTMLElement>,
    dateISO: string
  ) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleDayClick(dateISO);
  };

  const handlePeriodStep = (direction: -1 | 1) => {
    if (!range || !bounds) return;
    const minDate = new Date(bounds.minISO);
    const maxDate = new Date(bounds.maxISO);
    if (viewMode === "month") {
      const shiftedMonth = new Date(startOfMonth(range.start));
      shiftedMonth.setMonth(shiftedMonth.getMonth() + direction);
      const nextRange = clampRange(
        startOfMonth(shiftedMonth),
        endOfMonth(shiftedMonth),
        minDate,
        maxDate
      );
      void handleRangeChange(nextRange.start, nextRange.end);
      return;
    }
    const nextRange = clampRange(
      addDays(startOfWeek(range.start), direction * 7),
      addDays(endOfWeek(range.start), direction * 7),
      minDate,
      maxDate
    );
    void handleRangeChange(nextRange.start, nextRange.end);
  };

  const handleViewAccountStats = () => {
    if (accountId) setSelectedAccountId(accountId);
    if (!range) {
      router.push("/dashboard/trades");
      return;
    }
    router.push(
      `/dashboard/trades?oStart=${toYMD(range.start)}&oEnd=${toYMD(range.end)}`
    );
  };

  const quickRanges = useMemo(() => {
    if (viewMode === "month") {
      return [
        {
          label: "This month",
          getRange: (min: Date, max: Date) => {
            const now = new Date();
            let start = startOfMonth(now);
            let end = endOfMonth(now);
            if (start < min) start = min;
            if (end > max) end = max;
            return { start, end };
          },
        },
        {
          label: "Last month",
          getRange: (min: Date, max: Date) => {
            const now = new Date();
            const thisMonthStart = startOfMonth(now);
            const lastMonthEnd = new Date(thisMonthStart);
            lastMonthEnd.setDate(lastMonthEnd.getDate() - 1);
            const lastMonthStart = startOfMonth(lastMonthEnd);
            let start = lastMonthStart;
            let end = lastMonthEnd;
            if (start < min) start = min;
            if (end > max) end = max;
            return { start, end };
          },
        },
      ];
    }
    return [
      {
        label: "This week",
        getRange: (min: Date, max: Date) => {
          let start = startOfWeek(max);
          let end = endOfWeek(max);
          if (start < min) start = min;
          if (end > max) end = max;
          return { start, end };
        },
      },
      {
        label: "Last week",
        getRange: (min: Date, max: Date) => {
          const end = startOfWeek(max);
          const start = new Date(end);
          start.setDate(end.getDate() - 7);
          let nextStart = start;
          let nextEnd = new Date(end);
          nextEnd.setDate(nextEnd.getDate() - 1);
          if (nextStart < min) nextStart = min;
          if (nextEnd > max) nextEnd = max;
          return { start: nextStart, end: nextEnd };
        },
      },
      {
        label: "Last 3 days",
        getRange: (min: Date, max: Date) => {
          const end = new Date(max);
          const start = new Date(end);
          start.setDate(end.getDate() - 2);
          let nextStart = start;
          let nextEnd = end;
          if (nextStart < min) nextStart = min;
          if (nextEnd > max) nextEnd = max;
          return { start: nextStart, end: nextEnd };
        },
      },
    ];
  }, [viewMode]);

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-secondary dark:text-neutral-100">
          <span className="text-secondary font-medium">
            Here's an overview of your
          </span>{" "}
          most recent trades
        </h2>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          {days && days.length > 0 && bounds ? (
            (() => {
              const isMonth = viewMode === "month";
              const pickerMaxDays = isMonth ? 31 : 7;
              const pickerMinDays = isMonth ? 1 : 3;
              return (
                <PickerComponent
                  defaultStart={fromDateISO(days[0].dateISO)}
                  defaultEnd={fromDateISO(days[days.length - 1].dateISO)}
                  minDate={new Date(bounds.minISO)}
                  maxDate={new Date(bounds.maxISO)}
                  valueStart={range?.start}
                  valueEnd={range?.end}
                  minDays={pickerMinDays}
                  maxDays={pickerMaxDays}
                  quickRanges={quickRanges}
                  onRangeChange={handleRangeChange}
                />
              );
            })()
          ) : (
            <div className="h-9 w-48">
              <Skeleton className="h-full w-full rounded-none bg-sidebar-accent" />
            </div>
          )}
          <div className={actionGroupClass}>
            <Button
              aria-label={`Show previous ${viewMode}`}
              className={actionGroupButtonClass}
              disabled={!canNavigatePrevious}
              onClick={() => handlePeriodStep(-1)}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              className="h-[38px] cursor-default rounded-none border-x border-white/5 bg-sidebar px-3 py-2 text-xs text-white/70 hover:bg-sidebar"
              disabled
            >
              {activePeriodLabel}
            </Button>
            <Button
              aria-label={`Show next ${viewMode}`}
              className={actionGroupButtonClass}
              disabled={!canNavigateNext}
              onClick={() => handlePeriodStep(1)}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
          <div className={segmentedControlClass}>
            {(["week", "month"] as ViewMode[]).map((mode) => (
              <Button
                aria-pressed={viewMode === mode}
                key={mode}
                className={getSegmentedButtonClass(viewMode === mode)}
                onClick={() => handleViewChange(mode)}
              >
                {mode[0].toUpperCase() + mode.slice(1)}
              </Button>
            ))}
          </div>
          <div className={segmentedControlClass}>
            <Button
              aria-pressed={heatmapEnabled}
              className={getSegmentedButtonClass(heatmapEnabled)}
              onClick={() => setHeatmapEnabled((v) => !v)}
            >
              Heatmap
            </Button>
            <Button
              aria-pressed={goalOverlay}
              className={getSegmentedButtonClass(goalOverlay)}
              onClick={() => setGoalOverlay((v) => !v)}
            >
              Goals
            </Button>
          </div>
          <Button
            className={actionButtonClass}
            onClick={() => {
              if (onToggleEdit) {
                onToggleEdit();
              } else if (!isEditing) {
                onEnterEdit?.();
              }
            }}
          >
            <EditWidgets className="size-3.5 fill-white/75" />
            <span>{isEditing ? "Save" : "Customize widgets"}</span>
          </Button>
          <Button className={actionButtonClass} onClick={handleViewAccountStats}>
            <ArrowUpRight className="size-3.5" />
            View account stats
          </Button>
        </div>
      </div>

      {loading || !days ? (
        <div className="flex w-full">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="first:border last:border-l-0 not-last:border-l-0 not-first:border border-black/10 dark:border-white/5 bg-white dark:bg-sidebar p-5 w-full"
            >
              <div className="flex items-center justify-between mb-12">
                <Skeleton className="w-10 h-3 rounded-none bg-sidebar-accent" />
                <Skeleton className="w-16 h-3 rounded-none bg-sidebar-accent" />
              </div>
              <div className="flex items-end justify-between">
                <Skeleton className="w-24 h-4 rounded-none bg-sidebar-accent" />
              </div>
              <div className="text-xs text-secondary mt-2">
                <Skeleton className="w-16 h-4 rounded-none bg-sidebar-accent" />
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === "month" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] items-stretch">
          <div className="border border-white/5 bg-white dark:bg-sidebar rounded-sm overflow-hidden">
            <div className="grid grid-cols-7 gap-[1px] bg-sidebar-accent">
              {monthGrid.map((day) => {
                const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
                const inMonth =
                  range && day.getMonth() === range.start.getMonth();
                const data = dayMap.get(key);
                const dayGoals = goalMap.get(key) || [];
                const hasGoals = dayGoals.length > 0;
                const totalProfit = data?.totalProfit || 0;
                const count = data?.count || 0;
                const isGain = totalProfit >= 0;
                const pctValue =
                  initialBalance && initialBalance > 0
                    ? (Number(totalProfit || 0) / initialBalance) * 100
                    : 0;
                const pctLabel = `${pctValue >= 0 ? "+" : ""}${pctValue.toFixed(
                  2
                )}%`;
                const heatBg = heatmapEnabled ? getHeatmapBg(totalProfit, count) : undefined;
                const cell = (
                  <div
                    className={cn(
                      "bg-white dark:bg-sidebar p-3 min-h-[120px] flex flex-col gap-2 cursor-pointer transition-colors duration-250 hover:bg-sidebar-accent",
                      !inMonth && count === 0 && "opacity-40"
                    )}
                    role="button"
                    tabIndex={0}
                    aria-label={`View trades for ${formatAccessibleDate(day)}`}
                    style={heatBg ? { backgroundColor: heatBg } : undefined}
                    onClick={() => handleDayClick(key)}
                    onKeyDown={(event) => handleDayKeyDown(event, key)}
                    onMouseEnter={() => {
                      if (count > 0) {
                        setHoveredISO(key);
                        loadPreview(key);
                      }
                    }}
                    onMouseLeave={() =>
                      setHoveredISO((cur) => (cur === key ? null : cur))
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-secondary font-medium">
                        {day.getDate()}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-medium",
                          isGain ? "text-teal-400" : "text-rose-400",
                          totalProfit === 0 ? "text-white/25" : ""
                        )}
                      >
                        {pctLabel}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 mt-auto">
                      <div
                        className={cn(
                          "text-sm font-medium",
                          isGain ? "text-teal-400" : "text-rose-400",
                          totalProfit === 0 ? "text-white/50" : ""
                        )}
                      >
                        {formatMoney(totalProfit)}
                      </div>
                      <div className="text-[10px] text-white/25 font-medium">
                        {count} {count === 1 ? "trade" : "trades"}
                      </div>
                    </div>
                    {goalOverlay && hasGoals && (
                      <div className="flex flex-col gap-0.5 mt-1">
                        {dayGoals.map((g, gi) => (
                          <div key={gi} className="flex items-center gap-1">
                            <div
                              className={cn(
                                "size-1.5 rounded-full shrink-0",
                                getGoalMarkerClass(g)
                              )}
                            />
                            <span className="text-[8px] text-white/40 truncate leading-tight">
                              {g.isStart ? "Start: " : "Due: "}{g.title}
                            </span>
                            {g.isDeadline && g.status === "active" && (
                              <span className="text-[7px] text-white/25 ml-auto shrink-0">
                                {Math.round(g.progress)}%
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );

                if (count <= 0 && !hasGoals) {
                  return <div key={key}>{cell}</div>;
                }

                const preview = previews[key];
                const previewTrades = preview?.trades || [];
                const previewLoading = count > 0 ? preview?.loading ?? true : false;
                const shown = previewTrades.length;
                const extra = Math.max(0, count - shown);

                return (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>{cell}</TooltipTrigger>
                    <TooltipContent className="px-0 py-3">
                      <div className="flex max-h-72 min-w-[280px] max-w-[360px] flex-col overflow-auto">
                        <div className="flex items-center justify-between px-3 text-[11px] text-white/60">
                          <span>{formatShortDate(day)}</span>
                          <span>
                            {formatTradeCount(count)}{" "}
                            {count === 1 ? "trade" : "trades"}
                          </span>
                        </div>
                        {count > 0 ? <Separator className="mt-2 w-full" /> : null}
                        {count > 0 && previewLoading ? (
                          <div className="flex flex-col gap-2 px-3 pt-2">
                            <Skeleton className="h-3 w-32 rounded-none bg-sidebar-accent" />
                            <Skeleton className="h-3 w-28 rounded-none bg-sidebar-accent" />
                            <Skeleton className="h-3 w-24 rounded-none bg-sidebar-accent" />
                          </div>
                        ) : count > 0 && previewTrades.length > 0 ? (
                          <div className="flex flex-col gap-1 px-3 pt-2">
                            {previewTrades.map((trade) => {
                              const opened = trade.open
                                ? new Date(trade.open).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "--:--";
                              return (
                                <div
                                  key={trade.id}
                                  className="flex w-full items-center gap-3"
                                >
                                  <span className="w-16 shrink-0 text-left text-[11px] tabular-nums text-white/60">
                                    {opened}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-center text-[11px] text-white/70">
                                    {trade.symbol}
                                  </span>
                                  <span
                                    className={cn(
                                      TRADE_IDENTIFIER_PILL_CLASS,
                                      "ml-auto min-h-0 shrink-0 px-1.5 py-0 text-[10px]",
                                      getTradePillProfitTone(Number(trade.profit || 0))
                                    )}
                                  >
                                    {formatTradePillMoney(Number(trade.profit || 0))}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : count > 0 ? (
                          <span className="px-3 pt-2 text-[11px] text-white/40">
                            No trade details available.
                          </span>
                        ) : null}
                        {count > 0 && !previewLoading && extra > 0 ? (
                          <span className="px-3 pt-2 text-[10px] text-white/40">
                            Showing {formatTradeCount(shown)} of{" "}
                            {formatTradeCount(count)} trades.
                          </span>
                        ) : null}
                        {hasGoals ? (
                          <>
                            <Separator className="my-2 w-full" />
                            <div className="flex flex-col gap-1.5 px-3">
                              <span className="text-[10px] uppercase tracking-wide text-white/40">
                                Goals
                              </span>
                              {dayGoals.map((goal, index) => {
                                const statusText = getGoalStatusText(goal);
                                return (
                                  <div
                                    key={`${goal.title}-${index}-${goal.isStart ? "start" : "due"}`}
                                    className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5"
                                  >
                                    <span
                                      className={cn(
                                        "rounded-xs px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide",
                                        getGoalLegendChipClass(goal)
                                      )}
                                    >
                                      {getGoalLegendLabel(goal)}
                                    </span>
                                    <span className="min-w-0 truncate text-[11px] text-white/80">
                                      {goal.title}
                                    </span>
                                    {statusText ? (
                                      <span
                                        className={cn(
                                          "shrink-0 text-[10px] font-medium tabular-nums",
                                          getGoalStatusClass(goal)
                                        )}
                                      >
                                        {statusText}
                                      </span>
                                    ) : (
                                      <span />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        ) : null}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
          <DndContext sensors={summarySensors} onDragEnd={handleSummaryDragEnd}>
            <SortableContext
              items={summaryWidgetList}
              strategy={verticalListSortingStrategy}
            >
              <div className="grid gap-2 grid-cols-1 grid-rows-6 h-full">
                {summaryWidgetList.map((widgetType, index) => {
                  const span = getSummarySpan(widgetType);
                  return (
                    <SortableSummaryWidget
                      key={`${widgetType}-${index}`}
                      id={widgetType}
                      disabled={!isEditing}
                      style={{
                        gridRow: `span ${span} / span ${span}`,
                      }}
                    >
                      <div
                        className={cn(
                          "relative cursor-pointer h-full",
                          isEditing
                            ? "animate-tilt-subtle hover:animate-none"
                            : ""
                        )}
                        onPointerDown={handleSummaryPointerDown}
                        onPointerUp={handleSummaryPointerUp}
                        onPointerCancel={handleSummaryPointerUp}
                        onClick={() =>
                          isEditing && onToggleSummaryWidget?.(widgetType)
                        }
                      >
                        {isEditing ? (
                          <div className="absolute left-2 top-2 z-10 flex items-center gap-2">
                            <div
                              className="flex items-center gap-1 border border-white/5 bg-sidebar/90"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="px-2 py-1 text-[10px] text-white/60 hover:text-white/90 disabled:opacity-40"
                                disabled={span <= 1}
                                onClick={() =>
                                  onResizeSummaryWidget?.(widgetType, span - 1)
                                }
                              >
                                -
                              </button>
                              <span className="text-[10px] text-white/50 px-1">
                                {span}x
                              </span>
                              <button
                                type="button"
                                className="px-2 py-1 text-[10px] text-white/60 hover:text-white/90 disabled:opacity-40"
                                disabled={span >= 2}
                                onClick={() =>
                                  onResizeSummaryWidget?.(widgetType, span + 1)
                                }
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ) : null}
                        {isEditing ? (
                          <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
                            <div className="size-4 border border-white/5 flex items-center justify-center">
                              <svg
                                viewBox="0 0 24 24"
                                className="size-3 fill-white"
                              >
                                <path d="M20.285 6.708a1 1 0 0 1 0 1.414l-9 9a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L10.5 14.5l8.293-8.293a1 1 0 0 1 1.492.5z" />
                              </svg>
                            </div>
                            <GripVertical className="size-3 text-white/40" />
                          </div>
                        ) : null}
                        {renderSummaryWidget(widgetType)}
                        {isEditing ? (
                          <>
                            <div
                              className="absolute left-0 top-0 w-full h-3 cursor-ns-resize"
                              onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div
                              className="absolute left-0 bottom-0 w-full h-3 cursor-ns-resize"
                              onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </>
                        ) : null}
                      </div>
                    </SortableSummaryWidget>
                  );
                })}

                {isEditing &&
                  availableSummaryWidgets.map((widgetType) => (
                    <div
                      key={`available-${widgetType}`}
                      className="opacity-50 hover:opacity-100 transition-all duration-150 h-full"
                      onClick={() => onToggleSummaryWidget?.(widgetType)}
                    >
                      {renderSummaryWidget(widgetType)}
                    </div>
                  ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      ) : (
        <div className="flex w-full">
          {days.map((d) => {
            const dayDate = fromDateISO(d.dateISO);
            const dayGoals = goalMap.get(d.dateISO) || [];
            const hasGoals = dayGoals.length > 0;
            const isGain = d.totalProfit >= 0;
            const pctValue =
              initialBalance && initialBalance > 0
                ? (Number(d.totalProfit || 0) / initialBalance) * 100
                : 0;
            const pctLabel = `${pctValue >= 0 ? "+" : ""}${pctValue.toFixed(
              2
            )}%`;
            return (
              <div
                key={d.dateISO}
                className=" first:border last:border-l-0 not-last:border-l-0 not-first:border border-black/10 dark:border-white/5 bg-white dark:bg-sidebar p-5 w-full cursor-pointer transition-colors duration-250 hover:bg-sidebar-accent first:rounded-l-sm last:rounded-r-sm"
                role="button"
                tabIndex={0}
                aria-label={`View trades for ${formatAccessibleDate(dayDate)}`}
                onClick={() => handleDayClick(d.dateISO)}
                onKeyDown={(event) => handleDayKeyDown(event, d.dateISO)}
                onMouseEnter={() => {
                  setHoveredISO(d.dateISO);
                  loadPreview(d.dateISO);
                }}
                onMouseLeave={() =>
                  setHoveredISO((cur) => (cur === d.dateISO ? null : cur))
                }
              >
                {hoveredISO === d.dateISO ? (
                  <div className="flex flex-col gap-3 h-full">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-secondary font-medium">
                        {dayDate.getDate()}
                      </span>

                      <div className="flex items-center gap-2">
                        {(() => {
                          const total = Number(d.count || 0);
                          const shown =
                            previews[d.dateISO]?.trades?.length || 0;
                          const extra = Math.max(0, total - shown);
                          return extra > 0 ? (
                            <div className="">
                              <span className="inline-block rounded-xs bg-neutral-800/25 text-white/60 text-[10px] px-2 py-0.5 font-medium">
                                +{formatTradeCount(extra)} trades
                              </span>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 place-content-end h-full">
                      {previews[d.dateISO]?.loading ? (
                        <>
                          <Skeleton className="h-4 w-24 rounded-none bg-sidebar-accent" />
                          <Skeleton className="h-4 w-20 rounded-none bg-sidebar-accent" />
                          <Skeleton className="h-4 w-16 rounded-none bg-sidebar-accent" />
                        </>
                      ) : previews[d.dateISO]?.trades?.length > 0 ? (
                        (() => {
                          const rows = previews[d.dateISO].trades;
                          const bySymbol = rows.reduce(
                            (
                              acc: Record<
                                string,
                                {
                                  totalProfit: number;
                                  items: Array<{ id: string; profit: number }>;
                                }
                              >,
                              r
                            ) => {
                              const key = (r.symbol || "(Unknown)").trim();
                              if (!acc[key])
                                acc[key] = { totalProfit: 0, items: [] };
                              acc[key].totalProfit += Number(r.profit || 0);
                              acc[key].items.push({
                                id: r.id,
                                profit: Number(r.profit || 0),
                              });
                              return acc;
                            },
                            {} as Record<
                              string,
                              {
                                totalProfit: number;
                                items: Array<{ id: string; profit: number }>;
                              }
                            >
                          );
                          const groups = Object.entries(bySymbol)
                            .map(([symbol, v]) => ({
                              symbol,
                              totalProfit: v.totalProfit,
                              items: v.items,
                            }))
                            .sort(
                              (a, b) =>
                                Math.abs(b.totalProfit) -
                                Math.abs(a.totalProfit)
                            )
                            .slice(0, 3);
                          return groups.map((g) => (
                            <div
                              key={g.symbol}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="text-xs font-medium text-white">
                                {g.symbol}
                              </span>
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    TRADE_IDENTIFIER_PILL_CLASS,
                                    "min-h-0 px-1.5 py-0 text-[10px]",
                                    getTradePillProfitTone(Number(g.totalProfit || 0))
                                  )}
                                >
                                  {formatTradePillMoney(Number(g.totalProfit || 0))}
                                </span>
                                {g.items.length > 1 ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-xs bg-neutral-800/25 text-white/60 font-medium">
                                        x{formatTradeCount(g.items.length)}
                                      </span>
                                    </TooltipTrigger>

                                    <TooltipContent
                                      sideOffset={6}
                                      className="w-max max-w-none min-w-[15rem] py-3"
                                    >
                                      <div className="flex flex-col gap-2">
                                        {g.items.map((it) => {
                                          const row = rows.find(
                                            (r) => r.id === it.id
                                          ) as any;
                                          const opened = row?.open
                                            ? new Date(
                                                row.open
                                              ).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                              })
                                            : "--:--";
                                          const s = Number(
                                            row?.holdSeconds || 0
                                          );
                                          const hh = Math.floor(s / 3600);
                                          const mm = Math.floor(
                                            (s % 3600) / 60
                                          );
                                          const ss = s % 60;
                                          const hold = [
                                            hh ? `${hh}h` : null,
                                            mm ? `${mm}m` : null,
                                            `${ss}s`,
                                          ]
                                            .filter(Boolean)
                                            .join(" ");
                                          return (
                                            <div
                                              key={it.id}
                                              className="flex w-full items-center gap-3"
                                            >
                                              <span className="w-14 shrink-0 text-[11px] tabular-nums text-white/60">
                                                {opened}
                                              </span>
                                              <span className="min-w-0 flex-1 truncate text-center text-[11px] tabular-nums text-white/40">
                                                {hold}
                                              </span>
                                              <span
                                                className={cn(
                                                  TRADE_IDENTIFIER_PILL_CLASS,
                                                  "ml-auto min-h-0 shrink-0 px-1.5 py-0 text-[10px]",
                                                  getTradePillProfitTone(
                                                    Number(row?.profit || 0)
                                                  )
                                                )}
                                              >
                                                {formatTradePillMoney(
                                                  Number(row?.profit || 0)
                                                )}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : null}
                              </div>
                            </div>
                          ));
                        })()
                      ) : (
                        <span className="text-xs text-white/40">No trades</span>
                      )}
                    </div>
                    {hasGoals ? (
                      <div className="mt-2 flex flex-col gap-1.5">
                        <Separator className="w-full" />
                        <span className="text-[10px] uppercase tracking-wide text-white/40">
                          Goals
                        </span>
                        {dayGoals.map((goal, index) => {
                          const statusText = getGoalStatusText(goal);
                          return (
                            <div
                              key={`${goal.title}-${index}-${goal.isStart ? "start" : "due"}-week`}
                              className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5"
                            >
                              <span
                                className={cn(
                                  "rounded-xs px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide",
                                  getGoalLegendChipClass(goal)
                                )}
                              >
                                {getGoalLegendLabel(goal)}
                              </span>
                              <span className="min-w-0 truncate text-[11px] text-white/80">
                                {goal.title}
                              </span>
                              {statusText ? (
                                <span
                                  className={cn(
                                    "shrink-0 text-[10px] font-medium tabular-nums",
                                    getGoalStatusClass(goal)
                                  )}
                                >
                                  {statusText}
                                </span>
                              ) : (
                                <span />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-8">
                      <span className="text-xs text-secondary font-medium">
                        {dayDate.getDate()}
                      </span>

                      <h1
                        className={cn(
                          "text-xs font-medium",
                          isGain ? "text-teal-400" : "text-rose-400",
                          d.totalProfit === 0 ? "text-white/25" : ""
                        )}
                      >
                        {pctLabel}
                      </h1>
                    </div>
                    <div className="flex items-end justify-between">
                      <div
                        className={cn(
                          "text-xl font-medium",
                          isGain ? "text-teal-400" : "text-rose-400",

                          d.totalProfit === 0 ? "text-white/50" : ""
                        )}
                      >
                        {formatMoney(d.totalProfit)}
                      </div>
                    </div>

                    <div className="text-xs text-white/25 mt-1 font-medium">
                      {formatTradeCount(d.count)}{" "}
                      {d.count === 1 ? "trade" : "trades"}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
