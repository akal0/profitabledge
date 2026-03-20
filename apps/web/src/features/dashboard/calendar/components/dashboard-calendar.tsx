"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useAccountStore } from "@/stores/account";
import { useAccountTransitionStore } from "@/stores/account-transition";
import { useDateRangeStore } from "@/stores/date-range";
import { queryClient, trpcOptions } from "@/utils/trpc";
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
  TradePreview,
  ViewMode,
} from "../lib/calendar-types";
import {
  DEFAULT_CALENDAR_WIDGETS,
  DEFAULT_CALENDAR_WIDGET_SPANS,
} from "../lib/calendar-types";
import {
  addDays,
  buildLiveTradePreviewMap,
  buildGoalMap,
  buildMonthGrid,
  buildMonthSummary,
  clampRange,
  endOfDay,
  extendBoundsWithTradePreviews,
  endOfMonth,
  endOfWeek,
  filterPreviewTradesForDate,
  formatActivePeriodLabel,
  fromDateISO,
  mergeDayRowsWithLiveTrades,
  normalizeRecentDayRows,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toYMD,
} from "../lib/calendar-utils";

type LiveMetricsOpenTrade = {
  id?: string | null;
  ticket?: string | null;
  symbol?: string | null;
  openTime?: string | null;
  profit?: number | null;
  swap?: number | null;
  accountName?: string | null;
};

function mapLiveTradePreviews(
  input:
    | {
        openTrades?: LiveMetricsOpenTrade[];
      }
    | null
    | undefined
): TradePreview[] {
  return (input?.openTrades ?? [])
    .map((trade) => {
      const open = trade.openTime ? String(trade.openTime) : "";
      const openedAt = open ? new Date(open) : null;
      const holdSeconds =
        openedAt && !Number.isNaN(openedAt.getTime())
          ? Math.max(0, Math.floor((Date.now() - openedAt.getTime()) / 1000))
          : 0;

      return {
        id: String(trade.id ?? trade.ticket ?? ""),
        symbol: String(trade.symbol ?? "Unknown"),
        open,
        profit: Number(trade.profit ?? 0) + Number(trade.swap ?? 0),
        holdSeconds,
        status: "live" as const,
        accountName:
          typeof trade.accountName === "string" ? trade.accountName : null,
      };
    })
    .filter((trade) => Boolean(trade.id && trade.open));
}

async function loadLiveTrades(accountId: string) {
  const liveMetrics = await queryClient.fetchQuery({
    ...trpcOptions.accounts.liveMetrics.queryOptions({
      accountId,
    }),
    staleTime: 4_000,
  });

  return mapLiveTradePreviews(
    liveMetrics as { openTrades?: LiveMetricsOpenTrade[] } | null | undefined
  );
}

type DashboardCalendarProps = {
  accountId?: string;
  summaryWidgets?: CalendarWidgetType[];
  summaryWidgetSpans?: Partial<Record<CalendarWidgetType, number>>;
  onApplyPreset?: (
    widgets: CalendarWidgetType[],
    spans: Partial<Record<CalendarWidgetType, number>>
  ) => void | Promise<void>;
};

export default function DashboardCalendar({
  accountId,
  summaryWidgets = DEFAULT_CALENDAR_WIDGETS,
  summaryWidgetSpans = DEFAULT_CALENDAR_WIDGET_SPANS,
  onApplyPreset,
}: DashboardCalendarProps) {
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [days, setDays] = useState<DayRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<CalendarRange | null>(null);
  const [bounds, setBounds] = useState<{
    minISO: string;
    maxISO: string;
  } | null>(null);
  const [initialBalance, setInitialBalance] = useState<number | null>(null);
  const [hoveredISO, setHoveredISO] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [goalOverlay, setGoalOverlay] = useState(false);
  const [goals, setGoals] = useState<CalendarGoal[]>([]);
  const [rangeSummary, setRangeSummary] = useState<RangeSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [previews, setPreviews] = useState<CalendarPreviewState>({});
  const [liveTrades, setLiveTrades] = useState<TradePreview[]>([]);
  const router = useRouter();
  const setSelectedAccountId = useAccountStore(
    (state) => state.setSelectedAccountId
  );
  const beginAccountTransition = useAccountTransitionStore(
    (state) => state.beginAccountTransition
  );

  const calendarDays = useMemo(
    () => mergeDayRowsWithLiveTrades(days, liveTrades),
    [days, liveTrades]
  );

  const livePreviewMap = useMemo(
    () => buildLiveTradePreviewMap(liveTrades),
    [liveTrades]
  );

  const effectiveBounds = useMemo(
    () => extendBoundsWithTradePreviews(bounds, liveTrades),
    [bounds, liveTrades]
  );

  const dayMap = useMemo(() => {
    const map = new Map<string, DayRow>();
    calendarDays.forEach((day) => map.set(day.dateISO, day));
    return map;
  }, [calendarDays]);

  const visibleClosedDays = useMemo(() => {
    if (!range) return days ?? [];

    const startISO = toYMD(startOfDay(range.start));
    const endISO = toYMD(startOfDay(range.end));

    return (days ?? []).filter(
      (day) => day.dateISO >= startISO && day.dateISO <= endISO
    );
  }, [days, range]);

  const monthGrid = useMemo(() => {
    if (!range) return [];
    if (viewMode === "week") {
      return Array.from({ length: 7 }, (_, index) =>
        addDays(range.start, index)
      );
    }
    return buildMonthGrid(startOfMonth(range.start));
  }, [range, viewMode]);

  const heatmapMaxAbs = useMemo(() => {
    if (calendarDays.length === 0) return 1;
    return Math.max(
      1,
      ...calendarDays.map((day) =>
        Math.abs(
          day.count > 0 ? day.totalProfit : Number(day.liveTradeProfit || 0)
        )
      )
    );
  }, [calendarDays]);

  const monthSummary = useMemo(
    () => buildMonthSummary(visibleClosedDays, range),
    [range, visibleClosedDays]
  );

  const rangeLabel = monthSummary
    ? `${monthSummary.startLabel} · ${monthSummary.endLabel}`
    : "—";

  const activePeriodLabel = useMemo(
    () => formatActivePeriodLabel(range, viewMode),
    [range, viewMode]
  );

  const canNavigatePrevious = useMemo(() => {
    if (!range || !effectiveBounds) return false;
    const minDate = new Date(effectiveBounds.minISO);
    if (viewMode === "month") {
      return (
        startOfMonth(range.start).getTime() > startOfMonth(minDate).getTime()
      );
    }
    return startOfWeek(range.start).getTime() > startOfWeek(minDate).getTime();
  }, [effectiveBounds, range, viewMode]);

  const canNavigateNext = useMemo(() => {
    if (!range || !effectiveBounds) return false;
    const maxDate = new Date(effectiveBounds.maxISO);
    if (viewMode === "month") {
      return (
        startOfMonth(range.start).getTime() < startOfMonth(maxDate).getTime()
      );
    }
    return startOfWeek(range.start).getTime() < startOfWeek(maxDate).getTime();
  }, [effectiveBounds, range, viewMode]);

  const goalMap = useMemo(
    () => buildGoalMap(goals, calendarDays),
    [calendarDays, goals]
  );

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
        const data = await queryClient.fetchQuery({
          ...trpcOptions.accounts.rangeSummary.queryOptions({
            accountId,
            startISO: range.start.toISOString(),
            endISO: range.end.toISOString(),
          }),
          staleTime: 30_000,
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
      if (!accountId) {
        setLiveTrades([]);
        return;
      }

      setLoading(true);
      setPreviews({});
      setHoveredISO(null);

      try {
        const [accounts, nextBounds, nextLiveTrades] = await Promise.all([
          queryClient.fetchQuery({
            ...trpcOptions.accounts.list.queryOptions(),
            staleTime: 30_000,
          }),
          queryClient.fetchQuery({
            ...trpcOptions.accounts.opensBounds.queryOptions({ accountId }),
            staleTime: 30_000,
          }),
          loadLiveTrades(accountId).catch(() => []),
        ]);

        if (mounted) {
          const account = (accounts as Array<Record<string, unknown>>).find(
            (candidate) => candidate.id === accountId
          );
          const balance =
            account?.initialBalance != null
              ? Number(account.initialBalance)
              : null;
          setInitialBalance(Number.isFinite(balance) ? Number(balance) : null);
          setLiveTrades(nextLiveTrades);
        }

        const nextEffectiveBounds =
          extendBoundsWithTradePreviews(nextBounds, nextLiveTrades) ??
          nextBounds;
        const minDate = new Date(nextEffectiveBounds.minISO);
        const maxDate = new Date(nextEffectiveBounds.maxISO);
        const visibleRange =
          viewMode === "month"
            ? clampRange(
                startOfMonth(maxDate),
                endOfMonth(maxDate),
                minDate,
                maxDate
              )
            : clampRange(
                startOfWeek(maxDate),
                endOfWeek(maxDate),
                minDate,
                maxDate
              );
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
          useDateRangeStore
            .getState()
            .setRange(visibleRange.start, visibleRange.end);
          useDateRangeStore.getState().setBounds(minDate, maxDate);
        }

        const recentByDay = await queryClient.fetchQuery({
          ...trpcOptions.accounts.recentByDay.queryOptions({
            accountId,
            startISO: fetchRange.start.toISOString(),
            endISO: fetchRange.end.toISOString(),
          }),
          staleTime: 30_000,
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
      setLiveTrades([]);
      return;
    }

    let mounted = true;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;

      void loadLiveTrades(accountId)
        .then((nextLiveTrades) => {
          if (mounted) {
            setLiveTrades(nextLiveTrades);
          }
        })
        .catch(() => undefined);
    }, 5000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [accountId]);

  useEffect(() => {
    if (!accountId) {
      setGoals([]);
      return;
    }

    let mounted = true;
    setGoals([]);

    void (async () => {
      try {
        const data = await queryClient.fetchQuery({
          ...trpcOptions.goals.list.queryOptions({
            accountId: accountId || undefined,
          }),
          staleTime: 60_000,
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
      const result = await queryClient.fetchQuery({
        ...trpcOptions.trades.listInfinite.queryOptions({
          accountId,
          limit: 200,
          startISO: `${dateISO}T00:00:00.000Z`,
          endISO: `${dateISO}T23:59:59.999Z`,
        } as never),
        staleTime: 60_000,
      });

      const items =
        result && typeof result === "object" && "items" in result
          ? (result as { items?: Array<Record<string, unknown>> }).items ?? []
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

    if (effectiveBounds) {
      const clampedRange = clampRange(
        nextStart,
        nextEnd,
        new Date(effectiveBounds.minISO),
        new Date(effectiveBounds.maxISO)
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
      const data = await queryClient.fetchQuery({
        ...trpcOptions.accounts.recentByDay.queryOptions({
          accountId,
          startISO: fetchStart.toISOString(),
          endISO: fetchEnd.toISOString(),
        }),
        staleTime: 30_000,
      });

      setDays(normalizeRecentDayRows(data as DayRow[]));
    } finally {
      setLoading(false);
    }
  };

  const handleViewChange = (mode: ViewMode) => {
    if (mode === viewMode) return;

    setViewMode(mode);
    if (!range || !effectiveBounds) return;

    const minDate = new Date(effectiveBounds.minISO);
    const maxDate = new Date(effectiveBounds.maxISO);
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
    if (accountId) {
      beginAccountTransition(accountId);
      setSelectedAccountId(accountId);
    }
    router.push(`/dashboard/trades?oStart=${toYMD(start)}&oEnd=${toYMD(end)}`);
  };

  const handlePeriodStep = (direction: -1 | 1) => {
    if (!range || !effectiveBounds) return;

    const minDate = new Date(effectiveBounds.minISO);
    const maxDate = new Date(effectiveBounds.maxISO);

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

  const handleHoverDay = (
    dateISO: string,
    closedCount: number,
    totalCount: number
  ) => {
    if (totalCount <= 0) return;
    setHoveredISO(dateISO);
    if (closedCount > 0) {
      void loadPreview(dateISO);
    }
  };

  const handleLeaveDay = (dateISO: string) => {
    setHoveredISO((current) => (current === dateISO ? null : current));
  };

  return (
    <div ref={exportRef} className="flex w-full flex-col gap-3">
      <CalendarControls
        days={calendarDays}
        bounds={effectiveBounds}
        range={range}
        viewMode={viewMode}
        quickRanges={quickRanges}
        activePeriodLabel={activePeriodLabel}
        canNavigatePrevious={canNavigatePrevious}
        canNavigateNext={canNavigateNext}
        heatmapEnabled={heatmapEnabled}
        goalOverlay={goalOverlay}
        exportTargetRef={exportRef}
        summaryWidgets={summaryWidgets}
        summaryWidgetSpans={summaryWidgetSpans}
        onRangeChange={handleRangeChange}
        onPeriodStep={handlePeriodStep}
        onViewChange={handleViewChange}
        onToggleHeatmap={() => setHeatmapEnabled((value) => !value)}
        onToggleGoalOverlay={() => setGoalOverlay((value) => !value)}
        onApplyPreset={onApplyPreset || (() => undefined)}
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
            livePreviewMap={livePreviewMap}
            previews={previews}
            onSelectDay={handleDayClick}
            onHoverDay={handleHoverDay}
            onLeaveDay={handleLeaveDay}
          />
          <CalendarSummarySidebar
            summaryWidgets={summaryWidgets}
            summaryWidgetSpans={summaryWidgetSpans}
            monthSummary={monthSummary}
            rangeSummary={rangeSummary}
            summaryLoading={summaryLoading}
            rangeLabel={rangeLabel}
          />
        </div>
      ) : (
        <CalendarWeekView
          days={calendarDays}
          goalMap={goalMap}
          goalOverlay={goalOverlay}
          heatmapEnabled={heatmapEnabled}
          heatmapMaxAbs={heatmapMaxAbs}
          initialBalance={initialBalance}
          hoveredISO={hoveredISO}
          livePreviewMap={livePreviewMap}
          previews={previews}
          onSelectDay={handleDayClick}
          onHoverDay={handleHoverDay}
          onLeaveDay={handleLeaveDay}
        />
      )}
    </div>
  );
}
