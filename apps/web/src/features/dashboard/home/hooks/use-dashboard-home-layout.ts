"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ChartWidgetType } from "@/components/dashboard/chart-widgets";
import {
  CHART_WIDGET_KEY_ALIASES,
  ALL_CHART_WIDGET_TYPES,
  DEFAULT_CHART_WIDGETS,
} from "@/components/dashboard/chart-widgets";
import type { WidgetType } from "@/components/dashboard/widgets";
import {
  ALL_WIDGET_TYPES,
  DEFAULT_WIDGETS,
  DEFAULT_WIDGET_SPANS,
  MAX_DASHBOARD_WIDGETS,
} from "@/components/dashboard/widgets";
import type { CalendarWidgetType } from "@/features/dashboard/calendar/lib/calendar-types";
import {
  DEFAULT_CALENDAR_WIDGETS,
  DEFAULT_CALENDAR_WIDGET_SPANS,
} from "@/features/dashboard/calendar/lib/calendar-types";
import type { WidgetValueMode } from "@/features/dashboard/widgets/lib/widget-shared";
import { useDashboardAssistantContextStore } from "@/stores/dashboard-assistant-context";
import type { Me } from "@/types/user";
import { trpcClient } from "@/utils/trpc";

const MAX_CALENDAR_WIDGETS = 6;
type EditingSection = "widgets" | "calendar" | "charts" | null;

function clampCalendarSpan(span: number) {
  return Math.max(1, Math.min(2, Math.round(span)));
}

function normalizeWidgetSpans(
  rawSpans: unknown
): Partial<Record<WidgetType, number>> {
  if (!rawSpans || typeof rawSpans !== "object") {
    return { ...DEFAULT_WIDGET_SPANS };
  }

  const nextSpans: Partial<Record<WidgetType, number>> = {
    ...DEFAULT_WIDGET_SPANS,
  };

  for (const [key, value] of Object.entries(rawSpans as Record<string, unknown>)) {
    if (!ALL_WIDGET_TYPES.includes(key as WidgetType)) continue;
    const nextValue = Number(value);
    if (!Number.isFinite(nextValue)) continue;
    nextSpans[key as WidgetType] = Math.max(1, Math.min(5, Math.round(nextValue)));
  }

  return nextSpans;
}

function normalizeChartWidgets(rawWidgets: unknown): ChartWidgetType[] {
  if (!Array.isArray(rawWidgets) || rawWidgets.length === 0) {
    return DEFAULT_CHART_WIDGETS;
  }

  const normalized = rawWidgets
    .map((key) => CHART_WIDGET_KEY_ALIASES[String(key)] ?? String(key))
    .filter((key): key is ChartWidgetType =>
      ALL_CHART_WIDGET_TYPES.includes(key as ChartWidgetType)
    );

  const unique = Array.from(new Set(normalized));
  return unique.length > 0 ? unique : DEFAULT_CHART_WIDGETS;
}

function normalizeCalendarWidgets(rawWidgets: unknown): CalendarWidgetType[] {
  if (!Array.isArray(rawWidgets) || rawWidgets.length === 0) {
    return DEFAULT_CALENDAR_WIDGETS;
  }

  const normalized = rawWidgets.filter((widget): widget is CalendarWidgetType =>
    DEFAULT_CALENDAR_WIDGETS.includes(widget as CalendarWidgetType)
  );
  const unique = Array.from(new Set(normalized)).slice(0, MAX_CALENDAR_WIDGETS);
  return unique.length > 0 ? unique : DEFAULT_CALENDAR_WIDGETS;
}

function normalizeCalendarSpans(
  widgets: CalendarWidgetType[],
  spans: Partial<Record<CalendarWidgetType, number>>
) {
  const next: Partial<Record<CalendarWidgetType, number>> = {};
  widgets.forEach((widget) => {
    next[widget] = clampCalendarSpan(spans[widget] ?? 1);
  });
  return next;
}

function enforceCalendarLimit(
  widgets: CalendarWidgetType[],
  spans: Partial<Record<CalendarWidgetType, number>>,
  pinned?: CalendarWidgetType
) {
  const nextWidgets = [...widgets];
  let nextSpans = normalizeCalendarSpans(nextWidgets, spans);
  const totalSlots = () =>
    nextWidgets.reduce((sum, widget) => sum + (nextSpans[widget] ?? 1), 0);

  while (totalSlots() > MAX_CALENDAR_WIDGETS && nextWidgets.length > 0) {
    let removeIndex = nextWidgets.length - 1;
    if (pinned && nextWidgets[removeIndex] === pinned && nextWidgets.length > 1) {
      removeIndex = nextWidgets.length - 2;
    }
    const [removed] = nextWidgets.splice(removeIndex, 1);
    if (removed) {
      const { [removed]: _removed, ...rest } = nextSpans;
      nextSpans = rest;
    }
  }

  return {
    widgets: nextWidgets,
    spans: nextSpans,
  };
}

export function useDashboardHomeLayout(user: Me | null | undefined) {
  const setVisibleWidgets = useDashboardAssistantContextStore(
    (state) => state.setVisibleWidgets
  );
  const hydratedUserIdRef = useRef<string | null>(null);
  const editingSectionRef = useRef<EditingSection>(null);
  const previousEditingSectionRef = useRef<EditingSection>(null);
  const widgetsRef = useRef<WidgetType[]>(DEFAULT_WIDGETS);
  const widgetSpansRef = useRef<Partial<Record<WidgetType, number>>>(
    DEFAULT_WIDGET_SPANS
  );
  const chartWidgetsRef = useRef<ChartWidgetType[]>(DEFAULT_CHART_WIDGETS);
  const calendarWidgetsRef = useRef<CalendarWidgetType[]>(DEFAULT_CALENDAR_WIDGETS);
  const calendarWidgetSpansRef = useRef<
    Partial<Record<CalendarWidgetType, number>>
  >(DEFAULT_CALENDAR_WIDGET_SPANS);

  const [widgets, setWidgets] = useState<WidgetType[]>(DEFAULT_WIDGETS);
  const [widgetSpans, setWidgetSpans] = useState<
    Partial<Record<WidgetType, number>>
  >(DEFAULT_WIDGET_SPANS);
  const [chartWidgets, setChartWidgets] =
    useState<ChartWidgetType[]>(DEFAULT_CHART_WIDGETS);
  const [calendarWidgets, setCalendarWidgets] =
    useState<CalendarWidgetType[]>(DEFAULT_CALENDAR_WIDGETS);
  const [calendarWidgetSpans, setCalendarWidgetSpans] = useState<
    Partial<Record<CalendarWidgetType, number>>
  >(DEFAULT_CALENDAR_WIDGET_SPANS);
  const [editingSection, setEditingSection] = useState<EditingSection>(null);
  const [valueMode, setValueMode] = useState<WidgetValueMode>("usd");

  useEffect(() => {
    editingSectionRef.current = editingSection;
  }, [editingSection]);

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
    if (!user?.id || hydratedUserIdRef.current === user.id) return;
    hydratedUserIdRef.current = user.id;

    const rawWidgetPrefs = (user as any)?.widgetPreferences ?? {};
    const rawChartPrefs = (user as any)?.chartWidgetPreferences ?? {};
    const rawCalendarPrefs = rawWidgetPrefs?.calendar ?? {};

    const nextWidgets = Array.isArray(rawWidgetPrefs.widgets)
      ? rawWidgetPrefs.widgets
          .filter((widget: unknown): widget is WidgetType =>
            ALL_WIDGET_TYPES.includes(widget as WidgetType)
          )
          .slice(0, MAX_DASHBOARD_WIDGETS)
      : [];
    const safeWidgets = nextWidgets.length > 0 ? nextWidgets : DEFAULT_WIDGETS;

    const nextWidgetSpans = normalizeWidgetSpans(rawWidgetPrefs.spans);
    const nextChartWidgets = normalizeChartWidgets(rawChartPrefs.widgets);
    const nextCalendarWidgets = normalizeCalendarWidgets(rawCalendarPrefs.widgets);
    const nextCalendarSpans = normalizeCalendarSpans(
      nextCalendarWidgets,
      Object.fromEntries(
        nextCalendarWidgets.map((widget) => [
          widget,
          clampCalendarSpan(Number(rawCalendarPrefs?.spans?.[widget] ?? 1)),
        ])
      ) as Partial<Record<CalendarWidgetType, number>>
    );

    widgetsRef.current = safeWidgets;
    widgetSpansRef.current = nextWidgetSpans;
    chartWidgetsRef.current = nextChartWidgets;
    calendarWidgetsRef.current = nextCalendarWidgets;
    calendarWidgetSpansRef.current = nextCalendarSpans;

    setWidgets(safeWidgets);
    setWidgetSpans(nextWidgetSpans);
    setChartWidgets(nextChartWidgets);
    setCalendarWidgets(nextCalendarWidgets);
    setCalendarWidgetSpans(nextCalendarSpans);
  }, [user]);

  const saveWidgets = useCallback(async () => {
    const calendarSpansToSave: Partial<Record<CalendarWidgetType, number>> = {
      ...calendarWidgetSpansRef.current,
    };

    for (const widget of calendarWidgetsRef.current) {
      if (!(widget in calendarSpansToSave)) {
        calendarSpansToSave[widget] = 1;
      }
    }

    const cleanedSpans = Object.fromEntries(
      Object.entries(widgetSpansRef.current || {}).filter(([, value]) =>
        Number.isFinite(Number(value))
      )
    );

    await trpcClient.users.updateAllWidgetPreferences.mutate({
      widgets: widgetsRef.current,
      spans: cleanedSpans as any,
      chartWidgets: chartWidgetsRef.current as any,
      calendarWidgets: calendarWidgetsRef.current as any,
      calendarSpans: calendarSpansToSave as any,
    });
  }, []);

  useEffect(() => {
    const previous = previousEditingSectionRef.current;
    if (previous && previous !== editingSection) {
      void saveWidgets();
    }
    previousEditingSectionRef.current = editingSection;
  }, [editingSection, saveWidgets]);

  useEffect(() => {
    return () => {
      if (editingSectionRef.current) {
        void saveWidgets();
      }
    };
  }, [saveWidgets]);

  const toggleWidget = useCallback((type: WidgetType) => {
    setWidgets((previous) => {
      const exists = previous.includes(type);
      let next: WidgetType[];
      if (exists) {
        next = previous.filter((widget) => widget !== type);
      } else {
        if (previous.length >= MAX_DASHBOARD_WIDGETS) {
          return previous;
        }
        next = [...previous, type];
      }
      widgetsRef.current = next;
      return next;
    });
  }, []);

  const resizeWidget = useCallback((type: WidgetType, span: number) => {
    setWidgetSpans((previous) => ({
      ...previous,
      [type]: span,
    }));
    widgetSpansRef.current = {
      ...widgetSpansRef.current,
      [type]: span,
    };
  }, []);

  const reorderWidgets = useCallback((fromIndex: number, toIndex: number) => {
    setWidgets((previous) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= previous.length ||
        toIndex >= previous.length
      ) {
        return previous;
      }

      const next = [...previous];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      widgetsRef.current = next;
      return next;
    });
  }, []);

  const toggleChartWidget = useCallback((type: ChartWidgetType) => {
    setChartWidgets((previous) => {
      const exists = previous.includes(type);
      let next: ChartWidgetType[];
      if (exists) {
        next = previous.filter((widget) => widget !== type);
      } else {
        next = [...previous, type];
      }
      chartWidgetsRef.current = next;
      return next;
    });
  }, []);

  const reorderChartWidgets = useCallback((fromIndex: number, toIndex: number) => {
    setChartWidgets((previous) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= previous.length ||
        toIndex >= previous.length
      ) {
        return previous;
      }

      const next = [...previous];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      chartWidgetsRef.current = next;
      return next;
    });
  }, []);

  const applyCalendarConfig = useCallback(
    (
      nextWidgets: CalendarWidgetType[],
      nextSpans: Partial<Record<CalendarWidgetType, number>>,
      pinned?: CalendarWidgetType
    ) => {
      const enforced = enforceCalendarLimit(nextWidgets, nextSpans, pinned);
      calendarWidgetsRef.current = enforced.widgets;
      calendarWidgetSpansRef.current = enforced.spans;
      setCalendarWidgets(enforced.widgets);
      setCalendarWidgetSpans(enforced.spans);
    },
    []
  );

  const toggleCalendarWidget = useCallback(
    (type: CalendarWidgetType) => {
      const current = calendarWidgetsRef.current;
      const exists = current.includes(type);
      const nextWidgets = exists
        ? current.filter((widget) => widget !== type)
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
        (sum, widget) => sum + (normalizedSpans[widget] ?? 1),
        0
      );
      if (totalSlots > MAX_CALENDAR_WIDGETS) {
        return;
      }

      applyCalendarConfig(nextWidgets, normalizedSpans, type);
    },
    [applyCalendarConfig]
  );

  const resizeCalendarWidget = useCallback(
    (type: CalendarWidgetType, span: number) => {
      const nextSpans: Partial<Record<CalendarWidgetType, number>> = {
        ...calendarWidgetSpansRef.current,
        [type]: clampCalendarSpan(span),
      };
      applyCalendarConfig(calendarWidgetsRef.current, nextSpans, type);
    },
    [applyCalendarConfig]
  );

  const reorderCalendarWidgets = useCallback(
    (fromIndex: number, toIndex: number) => {
      const current = calendarWidgetsRef.current;
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= current.length ||
        toIndex >= current.length
      ) {
        return;
      }

      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      applyCalendarConfig(next, calendarWidgetSpansRef.current);
    },
    [applyCalendarConfig]
  );

  const toggleWidgetsEdit = useCallback(() => {
    setEditingSection((previous) =>
      previous === "widgets" ? null : "widgets"
    );
  }, []);

  const enterWidgetsEdit = useCallback(() => {
    setEditingSection("widgets");
  }, []);

  const toggleCalendarEdit = useCallback(() => {
    setEditingSection((previous) =>
      previous === "calendar" ? null : "calendar"
    );
  }, []);

  const enterCalendarEdit = useCallback(() => {
    setEditingSection("calendar");
  }, []);

  const toggleChartWidgetsEdit = useCallback(() => {
    setEditingSection((previous) =>
      previous === "charts" ? null : "charts"
    );
  }, []);

  const enterChartWidgetsEdit = useCallback(() => {
    setEditingSection("charts");
  }, []);

  const applyPreset = useCallback(
    async (
      presetWidgets: WidgetType[],
      presetSpans: Partial<Record<WidgetType, number>>
    ) => {
      const nextWidgets = presetWidgets
        .filter((widget): widget is WidgetType =>
          ALL_WIDGET_TYPES.includes(widget)
        )
        .slice(0, MAX_DASHBOARD_WIDGETS);
      const safeWidgets = nextWidgets.length > 0 ? nextWidgets : DEFAULT_WIDGETS;

      setWidgets(safeWidgets);
      setWidgetSpans(presetSpans);
      widgetsRef.current = safeWidgets;
      widgetSpansRef.current = presetSpans;

      await saveWidgets();
    },
    [saveWidgets]
  );

  const applyChartPreset = useCallback(
    async (presetWidgets: ChartWidgetType[]) => {
      const nextWidgets = Array.from(
        new Set(
          presetWidgets.filter((widget): widget is ChartWidgetType =>
            ALL_CHART_WIDGET_TYPES.includes(widget)
          )
        )
      );
      const safeWidgets =
        nextWidgets.length > 0 ? nextWidgets : DEFAULT_CHART_WIDGETS;

      setChartWidgets(safeWidgets);
      chartWidgetsRef.current = safeWidgets;

      await saveWidgets();
    },
    [saveWidgets]
  );

  return {
    widgets,
    widgetSpans,
    chartWidgets,
    calendarWidgets,
    calendarWidgetSpans,
    isWidgetsEditing: editingSection === "widgets",
    isCalendarEditing: editingSection === "calendar",
    isChartWidgetsEditing: editingSection === "charts",
    valueMode,
    setValueMode,
    toggleWidget,
    resizeWidget,
    reorderWidgets,
    toggleChartWidget,
    reorderChartWidgets,
    toggleCalendarWidget,
    resizeCalendarWidget,
    reorderCalendarWidgets,
    enterWidgetsEdit,
    toggleWidgetsEdit,
    enterCalendarEdit,
    toggleCalendarEdit,
    enterChartWidgetsEdit,
    toggleChartWidgetsEdit,
    applyPreset,
    applyChartPreset,
  };
}
