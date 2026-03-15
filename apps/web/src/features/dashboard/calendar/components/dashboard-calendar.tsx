"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useAccountStore } from "@/stores/account";
import { useDateRangeStore } from "@/stores/date-range";
import { trpcClient } from "@/utils/trpc";
import { Skeleton } from "@/components/ui/skeleton";

import { CalendarControls } from "./calendar-controls";
import { CalendarMonthView } from "./calendar-month-view";
import { CalendarSummarySidebar } from "./calendar-summary-sidebar";
import { CalendarWeekView } from "./calendar-week-view";
import type {
  CalendarGoal,
  CalendarPreviewState,
  CalendarRange,
  CalendarWidgetType,
  DayRow,
  RangeSummary,
  ViewMode,
} from "../lib/calendar-types";
import {
  DEFAULT_CALENDAR_WIDGETS,
  DEFAULT_CALENDAR_WIDGET_SPANS,
} from "../lib/calendar-types";
import {
  addDays,
  buildGoalMap,
  buildMonthGrid,
  buildMonthSummary,
  clampRange,
  endOfDay,
  endOfMonth,
  endOfWeek,
  filterPreviewTradesForDate,
  formatActivePeriodLabel,
  fromDateISO,
  normalizeRecentDayRows,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toYMD,
} from "../lib/calendar-utils";

type DashboardCalendarProps = {
  accountId?: string;
  isEditing?: boolean;
  summaryWidgets?: CalendarWidgetType[];
  summaryWidgetSpans?: Partial<Record<CalendarWidgetType, number>>;
  onToggleSummaryWidget?: (type: CalendarWidgetType) => void;
  onReorderSummaryWidget?: (fromIndex: number, toIndex: number) => void;
  onResizeSummaryWidget?: (type: CalendarWidgetType, span: number) => void;
  onEnterEdit?: () => void;
  onToggleEdit?: () => void;
};

export default function DashboardCalendar({
  accountId,
  isEditing = false,
  summaryWidgets = DEFAULT_CALENDAR_WIDGETS,
  summaryWidgetSpans = DEFAULT_CALENDAR_WIDGET_SPANS,
  onToggleSummaryWidget,
  onReorderSummaryWidget,
  onResizeSummaryWidget,
  onEnterEdit,
  onToggleEdit,
}: DashboardCalendarProps) {
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [days, setDays] = useState<DayRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<CalendarRange | null>(null);
  const [bounds, setBounds] = useState<{ minISO: string; maxISO: string } | null>(
    null
  );
  const [initialBalance, setInitialBalance] = useState<number | null>(null);
  const [hoveredISO, setHoveredISO] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [goalOverlay, setGoalOverlay] = useState(false);
  const [goals, setGoals] = useState<CalendarGoal[]>([]);
  const [rangeSummary, setRangeSummary] = useState<RangeSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [previews, setPreviews] = useState<CalendarPreviewState>({});

  const router = useRouter();
  const setSelectedAccountId = useAccountStore((state) => state.setSelectedAccountId);

  const dayMap = useMemo(() => {
    const map = new Map<string, DayRow>();
    (days || []).forEach((day) => map.set(day.dateISO, day));
    return map;
  }, [days]);

  const visibleDays = useMemo(() => {
    if (!days || !range) return days;

    const startISO = toYMD(startOfDay(range.start));
    const endISO = toYMD(startOfDay(range.end));

    return days.filter(
      (day) => day.dateISO >= startISO && day.dateISO <= endISO
    );
  }, [days, range]);

  const monthGrid = useMemo(() => {
    if (!range) return [];
    if (viewMode === "week") {
      return Array.from({ length: 7 }, (_, index) => addDays(range.start, index));
    }
    return buildMonthGrid(startOfMonth(range.start));
  }, [range, viewMode]);

  const heatmapMaxAbs = useMemo(() => {
    if (!days || days.length === 0) return 1;
    return Math.max(1, ...days.map((day) => Math.abs(day.totalProfit)));
  }, [days]);

  const monthSummary = useMemo(
    () => buildMonthSummary(visibleDays, range),
    [range, visibleDays]
  );

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
      return startOfMonth(range.start).getTime() > startOfMonth(minDate).getTime();
    }
    return startOfWeek(range.start).getTime() > startOfWeek(minDate).getTime();
  }, [bounds, range, viewMode]);

  const canNavigateNext = useMemo(() => {
    if (!range || !bounds) return false;
    const maxDate = new Date(bounds.maxISO);
    if (viewMode === "month") {
      return startOfMonth(range.start).getTime() < startOfMonth(maxDate).getTime();
    }
    return startOfWeek(range.start).getTime() < startOfWeek(maxDate).getTime();
  }, [bounds, range, viewMode]);

  const goalMap = useMemo(() => buildGoalMap(goals, days), [days, goals]);

  const quickRanges = useMemo(() => {
    if (viewMode === "month") {
      return [
        {
          label: "Latest month",
          getRange: (min: Date, max: Date) => {
            let start = startOfMonth(max);
            let end = endOfMonth(max);
            if (start < min) start = min;
            if (end > max) end = max;
            return { start, end };
          },
        },
        {
          label: "Earliest month",
          getRange: (min: Date, max: Date) => {
            let start = startOfMonth(min);
            let end = endOfMonth(min);
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
          const start = addDays(end, -7);
          let nextStart = start;
          let nextEnd = addDays(end, -1);
          if (nextStart < min) nextStart = min;
          if (nextEnd > max) nextEnd = max;
          return { start: nextStart, end: nextEnd };
        },
      },
      {
        label: "Last 3 days",
        getRange: (min: Date, max: Date) => {
          const end = new Date(max);
          const start = addDays(end, -2);
          let nextStart = start;
          let nextEnd = end;
          if (nextStart < min) nextStart = min;
          if (nextEnd > max) nextEnd = max;
          return { start: nextStart, end: nextEnd };
        },
      },
    ];
  }, [viewMode]);

  useEffect(() => {
    let mounted = true;

    if (!accountId || !range || viewMode !== "month") {
      setRangeSummary(null);
      setSummaryLoading(false);
      return;
    }

    setSummaryLoading(true);

    void (async () => {
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
        if (mounted) {
          setRangeSummary(null);
        }
      } finally {
        if (mounted) {
          setSummaryLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [accountId, range, viewMode]);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      if (!accountId) return;

      setLoading(true);
      setPreviews({});
      setHoveredISO(null);

      try {
        const accounts = await trpcClient.accounts.list.query();
        if (mounted) {
          const account = (accounts as Array<Record<string, unknown>>).find(
            (candidate) => candidate.id === accountId
          );
          const balance =
            account?.initialBalance != null ? Number(account.initialBalance) : null;
          setInitialBalance(Number.isFinite(balance) ? Number(balance) : null);
        }

        const nextBounds = await trpcClient.accounts.opensBounds.query({ accountId });
        const minDate = new Date(nextBounds.minISO);
        const maxDate = new Date(nextBounds.maxISO);
        const visibleRange =
          viewMode === "month"
            ? clampRange(startOfMonth(maxDate), endOfMonth(maxDate), minDate, maxDate)
            : clampRange(startOfWeek(maxDate), endOfWeek(maxDate), minDate, maxDate);
        const fetchRange =
          viewMode === "month"
            ? {
                start: startOfMonth(visibleRange.start),
                end: addDays(endOfMonth(visibleRange.start), 14),
              }
            : visibleRange;

        if (mounted) {
          setBounds(nextBounds);
          setRange(visibleRange);
          useDateRangeStore.getState().setRange(
            visibleRange.start,
            visibleRange.end
          );
          useDateRangeStore.getState().setBounds(minDate, maxDate);
        }

        const recentByDay = await trpcClient.accounts.recentByDay.query({
          accountId,
          startISO: fetchRange.start.toISOString(),
          endISO: fetchRange.end.toISOString(),
        });

        if (mounted) {
          setDays(normalizeRecentDayRows(recentByDay as DayRow[]));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [accountId, viewMode]);

  useEffect(() => {
    if (!accountId) {
      setGoals([]);
      return;
    }

    let mounted = true;
    setGoals([]);

    void (async () => {
      try {
        const data = await trpcClient.goals.list.query({
          accountId: accountId || undefined,
        });
        if (mounted) {
          setGoals(data as CalendarGoal[]);
        }
      } catch {
        if (mounted) {
          setGoals([]);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [accountId]);

  const loadPreview = async (dateISO: string) => {
    if (!accountId) return;
    if (previews[dateISO]?.loading) return;
    if (previews[dateISO]?.trades?.length) return;

    setPreviews((current) => ({
      ...current,
      [dateISO]: { loading: true, trades: [] },
    }));

    try {
      const result = await trpcClient.trades.listInfinite.query({
        accountId,
        limit: 200,
        startISO: `${dateISO}T00:00:00.000Z`,
        endISO: `${dateISO}T23:59:59.999Z`,
      } as never);

      const items =
        result && typeof result === "object" && "items" in result
          ? ((result as { items?: Array<Record<string, unknown>> }).items ?? [])
          : [];

      setPreviews((current) => ({
        ...current,
        [dateISO]: {
          loading: false,
          trades: filterPreviewTradesForDate(items, dateISO),
        },
      }));
    } catch {
      setPreviews((current) => ({
        ...current,
        [dateISO]: { loading: false, trades: [] },
      }));
    }
  };

  const handleRangeChange = async (
    start: Date,
    end: Date,
    nextViewMode: ViewMode = viewMode
  ) => {
    if (!accountId) return;

    let nextStart = new Date(start);
    let nextEnd = new Date(end);

    if (bounds) {
      const clampedRange = clampRange(
        nextStart,
        nextEnd,
        new Date(bounds.minISO),
        new Date(bounds.maxISO)
      );
      nextStart = clampedRange.start;
      nextEnd = clampedRange.end;
    }

    let fetchStart = new Date(nextStart);
    let fetchEnd = new Date(nextEnd);

    if (nextViewMode === "month") {
      fetchStart = startOfMonth(nextStart);
      fetchEnd = addDays(endOfMonth(nextStart), 14);
    }

    setRange({ start: nextStart, end: nextEnd });
    useDateRangeStore.getState().setRange(nextStart, nextEnd);
    setLoading(true);

    try {
      const data = await trpcClient.accounts.recentByDay.query({
        accountId,
        startISO: fetchStart.toISOString(),
        endISO: fetchEnd.toISOString(),
      });

      setDays(normalizeRecentDayRows(data as DayRow[]));
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
      const monthRange = clampRange(
        startOfMonth(anchor),
        endOfMonth(anchor),
        minDate,
        maxDate
      );
      nextStart = monthRange.start;
      nextEnd = monthRange.end;
    } else {
      const weekRange = clampRange(
        startOfWeek(anchor),
        endOfWeek(anchor),
        minDate,
        maxDate
      );
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

    router.push(`/dashboard/trades?oStart=${toYMD(range.start)}&oEnd=${toYMD(range.end)}`);
  };

  const handleHoverDay = (dateISO: string, count: number) => {
    if (count <= 0) return;
    setHoveredISO(dateISO);
    void loadPreview(dateISO);
  };

  const handleLeaveDay = (dateISO: string) => {
    setHoveredISO((current) => (current === dateISO ? null : current));
  };

  return (
    <div ref={exportRef} className="flex w-full flex-col gap-3">
      <CalendarControls
        days={days}
        bounds={bounds}
        range={range}
        viewMode={viewMode}
        quickRanges={quickRanges}
        activePeriodLabel={activePeriodLabel}
        canNavigatePrevious={canNavigatePrevious}
        canNavigateNext={canNavigateNext}
        heatmapEnabled={heatmapEnabled}
        goalOverlay={goalOverlay}
        isEditing={isEditing}
        exportTargetRef={exportRef}
        onRangeChange={handleRangeChange}
        onPeriodStep={handlePeriodStep}
        onViewChange={handleViewChange}
        onToggleHeatmap={() => setHeatmapEnabled((value) => !value)}
        onToggleGoalOverlay={() => setGoalOverlay((value) => !value)}
        onToggleEdit={() => {
          if (onToggleEdit) {
            onToggleEdit();
          } else if (!isEditing) {
            onEnterEdit?.();
          }
        }}
        onViewAccountStats={handleViewAccountStats}
      />

      {loading || !days ? (
        <div className="flex w-full">
          {Array.from({ length: 7 }).map((_, index) => (
            <div
              key={index}
              className="first:border last:border-l-0 not-last:border-l-0 not-first:border w-full border-black/10 bg-white p-5 dark:border-white/5 dark:bg-sidebar"
            >
              <div className="mb-12 flex items-center justify-between">
                <Skeleton className="h-3 w-10 rounded-none bg-sidebar-accent" />
                <Skeleton className="h-3 w-16 rounded-none bg-sidebar-accent" />
              </div>
              <div className="flex items-end justify-between">
                <Skeleton className="h-4 w-24 rounded-none bg-sidebar-accent" />
              </div>
              <div className="mt-2 text-xs text-secondary">
                <Skeleton className="h-4 w-16 rounded-none bg-sidebar-accent" />
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === "month" ? (
        <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <CalendarMonthView
            monthGrid={monthGrid}
            activeMonth={range?.start.getMonth() ?? null}
            dayMap={dayMap}
            goalMap={goalMap}
            goalOverlay={goalOverlay}
            heatmapEnabled={heatmapEnabled}
            heatmapMaxAbs={heatmapMaxAbs}
            initialBalance={initialBalance}
            previews={previews}
            onSelectDay={handleDayClick}
            onHoverDay={handleHoverDay}
            onLeaveDay={handleLeaveDay}
          />
          <CalendarSummarySidebar
            isEditing={isEditing}
            summaryWidgets={summaryWidgets}
            summaryWidgetSpans={summaryWidgetSpans}
            monthSummary={monthSummary}
            rangeSummary={rangeSummary}
            summaryLoading={summaryLoading}
            rangeLabel={rangeLabel}
            onToggleSummaryWidget={onToggleSummaryWidget}
            onReorderSummaryWidget={onReorderSummaryWidget}
            onResizeSummaryWidget={onResizeSummaryWidget}
            onEnterEdit={onEnterEdit}
          />
        </div>
      ) : (
        <CalendarWeekView
          days={days}
          goalMap={goalMap}
          goalOverlay={goalOverlay}
          heatmapEnabled={heatmapEnabled}
          heatmapMaxAbs={heatmapMaxAbs}
          initialBalance={initialBalance}
          hoveredISO={hoveredISO}
          previews={previews}
          onSelectDay={handleDayClick}
          onHoverDay={handleHoverDay}
          onLeaveDay={handleLeaveDay}
        />
      )}
    </div>
  );
}
