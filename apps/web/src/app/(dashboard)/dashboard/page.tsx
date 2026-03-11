"use client";

import { Widgets, type WidgetType } from "@/components/dashboard/widgets";
import DashboardActionButtons from "@/components/dashboard/dashboard-action-buttons";
import { InsightPanel } from "@/components/dashboard/insight-panel";
import { trpcOptions, trpcClient } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAccountStore } from "@/stores/account";
import { ALL_ACCOUNTS_ID } from "@/stores/account";
import { useDashboardAssistantContextStore } from "@/stores/dashboard-assistant-context";
import type { Me } from "@/types/user";
import { Skeleton } from "@/components/ui/skeleton";
import Calendar, {
  type CalendarWidgetType,
  defaultCalendarWidgets,
  defaultCalendarWidgetSpans,
} from "@/components/dashboard/calendar/calendar";
import {
  ChartWidgets,
  type ChartWidgetType,
} from "@/components/dashboard/chart-widgets";
import { AllAccountsOverview } from "@/components/dashboard/all-accounts-overview";

// Default widgets (fallback)
const defaultWidgets: WidgetType[] = [
  "account-balance",
  "win-rate",
  "profit-factor",
];

const defaultWidgetSpans: Partial<Record<WidgetType, number>> = {};

const allWidgetTypes: WidgetType[] = [
  "account-balance",
  "account-equity",
  "win-rate",
  "profit-factor",
  "win-streak",
  "hold-time",
  "average-rr",
  "asset-profitability",
  "trade-counts",
  "profit-expectancy",
  "total-losses",
  "consistency-score",
  "open-trades",
  "execution-scorecard",
  "money-left-on-table",
  "watchlist",
  "session-performance",
  "streak-calendar",
  "tiltmeter",
  "daily-briefing",
  "risk-intelligence",
  "rule-compliance",
  "edge-coach",
  "what-if",
  "benchmark",
];

const defaultChartWidgets: ChartWidgetType[] = [
  "daily-net",
  "performance-weekday",
  "performing-assets",
];

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Having a late session";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Late night";
}

function getActiveTradingSession(): { name: string; color: string } | null {
  const now = new Date();
  const utcH = now.getUTCHours();
  // Sydney: 21:00 - 06:00 UTC
  // Tokyo: 00:00 - 09:00 UTC
  // London: 07:00 - 16:00 UTC
  // New York: 12:00 - 21:00 UTC
  if (utcH >= 12 && utcH < 21)
    return {
      name: "New York",
      color: "bg-blue-500/20 text-blue-400 border-blue-500/20",
    };
  if (utcH >= 7 && utcH < 16)
    return {
      name: "London",
      color: "bg-purple-500/20 text-purple-400 border-purple-500/20",
    };
  if (utcH >= 0 && utcH < 9)
    return {
      name: "Tokyo",
      color: "bg-amber-500/20 text-amber-400 border-amber-500/20",
    };
  return {
    name: "Sydney",
    color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/20",
  };
}

function SessionBadge() {
  const session = getActiveTradingSession();
  if (!session) return null;
  return (
    <span
      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${session.color}`}
    >
      {session.name} session
    </span>
  );
}

export default function Page() {
  const getInfo = async () => {
    const me = await trpcClient.users.me.query();

    return me;
  };

  const [me, setMe] = useState<Me | null>(null);
  const [widgets, setWidgets] = useState<WidgetType[]>(defaultWidgets);
  const [widgetSpans, setWidgetSpans] =
    useState<Partial<Record<WidgetType, number>>>(defaultWidgetSpans);
  const [chartWidgets, setChartWidgets] =
    useState<ChartWidgetType[]>(defaultChartWidgets);
  const [calendarWidgets, setCalendarWidgets] = useState<CalendarWidgetType[]>(
    defaultCalendarWidgets
  );
  const [calendarWidgetSpans, setCalendarWidgetSpans] = useState<
    Partial<Record<CalendarWidgetType, number>>
  >(defaultCalendarWidgetSpans);
  const [isEditing, setIsEditing] = useState(false);
  const [valueMode, setValueMode] = useState<"usd" | "percent">("usd");
  const accountId = useAccountStore((s) => s.selectedAccountId);
  const setVisibleWidgets = useDashboardAssistantContextStore(
    (state) => state.setVisibleWidgets
  );
  const widgetsRef = useRef<WidgetType[]>(defaultWidgets);
  const widgetSpansRef =
    useRef<Partial<Record<WidgetType, number>>>(defaultWidgetSpans);
  const chartWidgetsRef = useRef<ChartWidgetType[]>(defaultChartWidgets);
  const calendarWidgetsRef = useRef<CalendarWidgetType[]>(
    defaultCalendarWidgets
  );
  const calendarWidgetSpansRef = useRef<
    Partial<Record<CalendarWidgetType, number>>
  >(defaultCalendarWidgetSpans);
  const wasEditingRef = useRef(isEditing);

  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  useEffect(() => {
    widgetSpansRef.current = widgetSpans;
  }, [widgetSpans]);

  useEffect(() => {
    chartWidgetsRef.current = chartWidgets;
  }, [chartWidgets]);

  useEffect(() => {
    calendarWidgetsRef.current = calendarWidgets;
  }, [calendarWidgets]);

  useEffect(() => {
    calendarWidgetSpansRef.current = calendarWidgetSpans;
  }, [calendarWidgetSpans]);

  useEffect(() => {
    setVisibleWidgets(widgets, chartWidgets);
  }, [chartWidgets, setVisibleWidgets, widgets]);

  useEffect(() => {
    (async () => {
      const data = await getInfo();
      setMe(data);
      const fromWidgets = (data as any)?.widgetPreferences?.widgets as
        | WidgetType[]
        | undefined;
      if (fromWidgets && Array.isArray(fromWidgets) && fromWidgets.length > 0) {
        const nextWidgets = fromWidgets
          .filter((widget): widget is WidgetType =>
            allWidgetTypes.includes(widget)
          )
          .slice(0, 15);
        if (nextWidgets.length > 0) {
          widgetsRef.current = nextWidgets;
          setWidgets(nextWidgets);
        }
      }
      const fromSpans = (data as any)?.widgetPreferences?.spans;
      if (fromSpans && typeof fromSpans === "object") {
        const nextSpans: Partial<Record<WidgetType, number>> = {
          ...defaultWidgetSpans,
        };
        for (const [key, value] of Object.entries(
          fromSpans as Record<string, unknown>
        )) {
          if (!allWidgetTypes.includes(key as WidgetType)) continue;
          const num = Number(value);
          if (!Number.isFinite(num)) continue;
          nextSpans[key as WidgetType] = Math.max(
            1,
            Math.min(5, Math.round(num))
          );
        }
        widgetSpansRef.current = nextSpans;
        setWidgetSpans(nextSpans);
      }
      const fromChartRaw = (data as any)?.chartWidgetPreferences?.widgets as
        | string[]
        | undefined;
      if (
        fromChartRaw &&
        Array.isArray(fromChartRaw) &&
        fromChartRaw.length > 0
      ) {
        const alias: Record<string, ChartWidgetType> = {
          daily: "daily-net",
          performance: "performance-weekday",
          performingAssets: "performing-assets",
          "performance-assets": "performing-assets",
        };
        const validChartWidgets = [
          "daily-net",
          "performance-weekday",
          "performing-assets",
          "equity-curve",
          "drawdown-chart",
          "performance-heatmap",
          "streak-distribution",
          "r-multiple-distribution",
          "mae-mfe-scatter",
          "entry-exit-time",
          "hold-time-scatter",
          "monte-carlo",
          "rolling-performance",
          "correlation-matrix",
          "radar-comparison",
          "risk-adjusted",
          "bell-curve",
        ];
        const normalized = fromChartRaw
          .map((k) => (alias[k] ?? k) as string)
          .filter((k): k is ChartWidgetType =>
            validChartWidgets.includes(k as any)
          );
        const unique: ChartWidgetType[] = Array.from(new Set(normalized)).slice(
          0,
          25
        ) as any;
        const nextCharts = unique.length > 0 ? unique : chartWidgets;
        chartWidgetsRef.current = nextCharts;
        setChartWidgets(nextCharts);
      }

      const calendarKeys = defaultCalendarWidgets;
      const fromCalendarRaw = (data as any)?.widgetPreferences?.calendar
        ?.widgets as string[] | undefined;
      if (
        fromCalendarRaw &&
        Array.isArray(fromCalendarRaw) &&
        fromCalendarRaw.length > 0
      ) {
        const normalized = fromCalendarRaw.filter(
          (k): k is CalendarWidgetType =>
            calendarKeys.includes(k as CalendarWidgetType)
        );
        const unique = Array.from(new Set(normalized)).slice(0, 6);
        const nextCalendar = unique.length > 0 ? unique : calendarWidgets;
        calendarWidgetsRef.current = nextCalendar;
        setCalendarWidgets(nextCalendar);
      }

      const fromCalendarSpans = (data as any)?.widgetPreferences?.calendar
        ?.spans;
      const nextSpans: Partial<Record<CalendarWidgetType, number>> = {};

      // Only use the loaded widgets, not the spans object
      const loadedWidgets = calendarWidgetsRef.current || calendarWidgets;

      // Set spans ONLY for the active widgets
      for (const widget of loadedWidgets) {
        // Try to get the saved span, or default to 1
        const savedSpan = fromCalendarSpans?.[widget];
        const num = Number(savedSpan);
        nextSpans[widget] = Number.isFinite(num)
          ? Math.max(1, Math.min(2, Math.round(num)))
          : 1;
      }

      calendarWidgetSpansRef.current = nextSpans;
      setCalendarWidgetSpans(nextSpans);
    })();
  }, []);

  // Fetch live metrics for the selected account using tRPC hook
  const { data: accountMetrics } = useQuery({
    ...trpcOptions.accounts.liveMetrics.queryOptions({
      accountId: accountId || "",
    }),
    enabled: !!accountId,
    refetchInterval: 5000, // Poll every 5 seconds
    staleTime: 4000, // Consider data stale after 4 seconds
    retry: false, // Don't retry on error (manual accounts don't have metrics)
  });

  const toggleWidget = (type: WidgetType) => {
    setWidgets((prev) => {
      const exists = prev.includes(type);
      let next: WidgetType[];
      if (exists) {
        next = prev.filter((w) => w !== type);
      } else {
        if (prev.length >= 15) return prev; // cap 15
        next = [...prev, type];
      }
      widgetsRef.current = next;
      return next;
    });
  };

  const resizeWidget = (type: WidgetType, span: number) => {
    setWidgetSpans((prev) => ({
      ...prev,
      [type]: span,
    }));
    widgetSpansRef.current = {
      ...widgetSpansRef.current,
      [type]: span,
    };
  };

  const reorderWidgets = (fromIndex: number, toIndex: number) => {
    setWidgets((prev) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length
      )
        return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      widgetsRef.current = next;
      return next;
    });
  };

  const toggleChartWidget = (type: ChartWidgetType) => {
    setChartWidgets((prev) => {
      const exists = prev.includes(type);
      let next: ChartWidgetType[];
      if (exists) {
        next = prev.filter((w) => w !== type);
      } else {
        if (prev.length >= 15) return prev;
        next = [...prev, type];
      }
      chartWidgetsRef.current = next;
      return next;
    });
  };

  const reorderChartWidgets = (fromIndex: number, toIndex: number) => {
    setChartWidgets((prev) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length
      )
        return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      chartWidgetsRef.current = next;
      return next;
    });
  };

  const calendarWidgetLimit = 6;
  const clampCalendarSpan = (span: number) =>
    Math.max(1, Math.min(2, Math.round(span)));

  const normalizeCalendarSpans = (
    widgets: CalendarWidgetType[],
    spans: Partial<Record<CalendarWidgetType, number>>
  ) => {
    const next: Partial<Record<CalendarWidgetType, number>> = {};
    widgets.forEach((widget) => {
      const raw = spans[widget] ?? 1;
      next[widget] = clampCalendarSpan(raw);
    });
    return next;
  };

  const enforceCalendarLimit = (
    widgets: CalendarWidgetType[],
    spans: Partial<Record<CalendarWidgetType, number>>,
    pinned?: CalendarWidgetType
  ) => {
    const nextWidgets = [...widgets];
    let nextSpans = normalizeCalendarSpans(nextWidgets, spans);
    const totalSlots = () =>
      nextWidgets.reduce((acc, w) => acc + (nextSpans[w] ?? 1), 0);
    while (totalSlots() > calendarWidgetLimit && nextWidgets.length > 0) {
      let removeIndex = nextWidgets.length - 1;
      if (
        pinned &&
        nextWidgets[removeIndex] === pinned &&
        nextWidgets.length > 1
      ) {
        removeIndex = nextWidgets.length - 2;
      }
      const [removed] = nextWidgets.splice(removeIndex, 1);
      if (removed) {
        const { [removed]: _, ...rest } = nextSpans;
        nextSpans = rest;
      }
    }
    return { widgets: nextWidgets, spans: nextSpans };
  };

  const applyCalendarConfig = (
    widgets: CalendarWidgetType[],
    spans: Partial<Record<CalendarWidgetType, number>>,
    pinned?: CalendarWidgetType
  ) => {
    const enforced = enforceCalendarLimit(widgets, spans, pinned);
    calendarWidgetsRef.current = enforced.widgets;
    calendarWidgetSpansRef.current = enforced.spans;
    setCalendarWidgets(enforced.widgets);
    setCalendarWidgetSpans(enforced.spans);
  };

  const toggleCalendarWidget = (type: CalendarWidgetType) => {
    const current = calendarWidgetsRef.current;
    const exists = current.includes(type);
    const nextWidgets = exists
      ? current.filter((w) => w !== type)
      : [...current, type];
    const nextSpans: Partial<Record<CalendarWidgetType, number>> = {
      ...calendarWidgetSpansRef.current,
    };
    if (exists) {
      delete nextSpans[type];
      applyCalendarConfig(nextWidgets, nextSpans, type);
      return;
    }
    const normalizedSpans = normalizeCalendarSpans(nextWidgets, nextSpans);
    const totalSlots = nextWidgets.reduce(
      (acc, w) => acc + (normalizedSpans[w] ?? 1),
      0
    );
    if (totalSlots > calendarWidgetLimit) return;
    applyCalendarConfig(nextWidgets, normalizedSpans, type);
  };

  const resizeCalendarWidget = (type: CalendarWidgetType, span: number) => {
    const nextSpans: Partial<Record<CalendarWidgetType, number>> = {
      ...calendarWidgetSpansRef.current,
      [type]: clampCalendarSpan(span),
    };
    applyCalendarConfig(calendarWidgetsRef.current, nextSpans, type);
  };

  const reorderCalendarWidgets = (fromIndex: number, toIndex: number) => {
    const current = calendarWidgetsRef.current;
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= current.length ||
      toIndex >= current.length
    )
      return;
    const next = [...current];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    applyCalendarConfig(next, calendarWidgetSpansRef.current);
  };

  const saveWidgets = useCallback(async () => {
    // Ensure all calendar widgets have a span before saving
    const calendarSpansToSave: Partial<Record<CalendarWidgetType, number>> = {
      ...calendarWidgetSpansRef.current,
    };
    for (const widget of calendarWidgetsRef.current) {
      if (!(widget in calendarSpansToSave)) {
        calendarSpansToSave[widget] = 1;
      }
    }
    try {
      const cleanedSpans = Object.fromEntries(
        Object.entries(widgetSpansRef.current || {}).filter(([, value]) =>
          Number.isFinite(Number(value))
        )
      );

      await trpcClient.users.updateAllWidgetPreferences.mutate({
        widgets: widgetsRef.current,
        spans: cleanedSpans as any,
        chartWidgets: chartWidgetsRef.current,
        calendarWidgets: calendarWidgetsRef.current,
        calendarSpans: calendarSpansToSave as any,
      });
    } catch (e) {
      console.error("❌ Error saving widgets:", e);
    }
  }, []);

  useEffect(() => {
    if (wasEditingRef.current && !isEditing) {
      void saveWidgets();
    }
    wasEditingRef.current = isEditing;
  }, [isEditing, saveWidgets]);

  const handleToggleEdit = () => {
    setIsEditing((prev) => !prev);
  };

  const handleApplyPreset = async (
    presetWidgets: WidgetType[],
    presetSpans: Partial<Record<WidgetType, number>>
  ) => {
    const nextWidgets = presetWidgets
      .filter((widget): widget is WidgetType =>
        allWidgetTypes.includes(widget)
      )
      .slice(0, 15);
    const safeWidgets = nextWidgets.length > 0 ? nextWidgets : defaultWidgets;
    setWidgets(safeWidgets);
    setWidgetSpans(presetSpans);
    widgetsRef.current = safeWidgets;
    widgetSpansRef.current = presetSpans;
    // Save immediately when preset is applied
    await saveWidgets();
  };

  return (
    <main className="p-6 space-y-4 py-4">
      {/* Welcome message + buttons  */}
      <div className="w-full flex shrink-0 items-center justify-between">
        {/* Welcome message */}
        <div className="flex w-full items-center gap-2 text-xl tracking-tight text-secondary dark:text-neutral-200">
          <h1 className="text-secondary font-medium"> {getTimeGreeting()}, </h1>

          <h1 className="flex items-center gap-1">
            <Avatar className="shadow-sidebar-button size-7">
              <AvatarImage
                src={me?.image ?? ""}
                alt={me?.name ?? ""}
                className="object-cover"
              />
              <AvatarFallback>
                <Skeleton className="size-7 rounded-full" />
              </AvatarFallback>
            </Avatar>

            <span className="font-semibold text-black dark:text-white">
              {" "}
              {me?.username ?? <Skeleton className="w-32 h-7" />}
              {getTimeGreeting() === "Having a late session" ? "?" : ""}
            </span>
          </h1>

          <SessionBadge />
        </div>

        <div className="flex items-center gap-2">
          <InsightPanel />
          <DashboardActionButtons
            user={me ?? null}
            isEditing={isEditing}
            valueMode={valueMode}
            onValueModeChange={setValueMode}
            onToggleEdit={handleToggleEdit}
            widgets={widgets}
            widgetSpans={widgetSpans}
            onApplyPreset={handleApplyPreset}
          />
        </div>
      </div>

      {/* Widgets */}

      <div className="flex flex-1 flex-col gap-8">
        {accountId === ALL_ACCOUNTS_ID ? <AllAccountsOverview /> : null}

        {/* Widgets */}
        <Widgets
          enabledWidgets={widgets}
          accountId={accountId}
          isEditing={isEditing}
          valueMode={valueMode}
          onToggleWidget={toggleWidget}
          onReorder={reorderWidgets}
          onEnterEdit={() => setIsEditing(true)}
          widgetSpans={widgetSpans}
          onResizeWidget={resizeWidget}
          maxWidgets={15}
        />

        {/* Calendar */}

        <Calendar
          accountId={accountId}
          isEditing={isEditing}
          summaryWidgets={calendarWidgets}
          summaryWidgetSpans={calendarWidgetSpans}
          onToggleSummaryWidget={toggleCalendarWidget}
          onReorderSummaryWidget={reorderCalendarWidgets}
          onResizeSummaryWidget={resizeCalendarWidget}
          onEnterEdit={() => setIsEditing(true)}
          onToggleEdit={handleToggleEdit}
        />

        {/* Chart widgets */}

        <ChartWidgets
          accountId={accountId}
          enabledWidgets={chartWidgets}
          isEditing={isEditing}
          onToggleWidget={toggleChartWidget}
          onReorder={reorderChartWidgets}
          onEnterEdit={() => setIsEditing(true)}
        />
      </div>
    </main>
  );
}
