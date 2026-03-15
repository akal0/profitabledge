"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/utils/trpc";

import { EconomicCalendarControls } from "./economic-calendar-controls";
import { EconomicCalendarViews } from "./economic-calendar-views";
import {
  CALENDAR_ENDPOINT,
  IMPACT_ORDER,
  IMPACT_SORT_RANK,
  type EconomicEvent,
  type GroupedEvents,
  type ImpactLevel,
  type ViewMode,
} from "../lib/economic-calendar-types";
import {
  buildMonthGrid,
  endOfDay,
  endOfWeek,
  normalizeImpact,
  startOfDay,
  startOfWeek,
} from "../lib/economic-calendar-utils";

export default function EconomicCalendar() {
  const trpc = useTRPC();
  const searchParams = useSearchParams();
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currencyFilter, setCurrencyFilter] = useState<string[]>(() => {
    const param = searchParams?.get("currency");
    return param ? [param] : [];
  });
  const [impactFilter, setImpactFilter] = useState<ImpactLevel[]>(() => {
    const param = searchParams?.get("impact");
    if (param && (IMPACT_ORDER as readonly string[]).includes(param)) {
      return [param as ImpactLevel];
    }
    return [];
  });
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(() => {
    const startParam = searchParams?.get("start");
    const endParam = searchParams?.get("end");
    if (startParam && endParam) {
      const start = new Date(`${startParam}T00:00:00`);
      const end = new Date(`${endParam}T23:59:59.999`);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        return { start, end };
      }
    }
    return null;
  });
  const [bounds] = useState(() => {
    const min = new Date(2000, 0, 1);
    const max = new Date();
    max.setFullYear(max.getFullYear() + 2);
    return { min, max };
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const startParam = searchParams?.get("start");
    const endParam = searchParams?.get("end");
    if (startParam && endParam && startParam === endParam) return "day";
    return "month";
  });
  const lastNewsIngestRef = useRef<string | null>(null);
  const ingestNews = trpc.notifications.ingestNews.useMutation();

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          range
            ? `${CALENDAR_ENDPOINT}?start=${range.start
                .toISOString()
                .slice(0, 10)}&end=${range.end.toISOString().slice(0, 10)}`
            : CALENDAR_ENDPOINT,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error("calendar_unavailable");
        }

        const data = (await response.json()) as EconomicEvent[];
        if (!mounted) return;

        const cleaned = Array.isArray(data) ? data : [];
        setEvents(cleaned);

        if (!range) {
          const dates = cleaned
            .map((event) => (event.date ? new Date(event.date) : null))
            .filter((date): date is Date => Boolean(date));

          if (dates.length > 0) {
            const maxDate = new Date(Math.max(...dates.map((date) => date.getTime())));
            const weekStart = startOfWeek(maxDate);
            const weekEnd = endOfWeek(maxDate);
            setRange({
              start: startOfDay(weekStart),
              end: endOfDay(weekEnd),
            });
          } else {
            const now = new Date();
            const weekStart = startOfWeek(now);
            const weekEnd = endOfWeek(now);
            setRange({
              start: startOfDay(weekStart),
              end: endOfDay(weekEnd),
            });
          }
        }
      } catch (err) {
        if (!mounted) return;
        if ((err as Error).name === "AbortError") return;
        console.error(err);
        setError("Unable to load economic calendar.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [range]);

  const currencies = useMemo(() => {
    const next = new Set<string>();
    events.forEach((event) => {
      if (event.country) next.add(event.country);
    });
    return Array.from(next).sort();
  }, [events]);

  const impacts = useMemo(() => {
    const next = new Set<ImpactLevel>();
    events.forEach((event) => next.add(normalizeImpact(event.impact)));
    return IMPACT_ORDER.filter((impact) => next.has(impact));
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (!range) return [];

    const start = startOfDay(range.start).getTime();
    const end = endOfDay(range.end).getTime();

    return events
      .filter((event) => {
        if (!event.date) return false;
        const time = new Date(event.date).getTime();
        if (time < start || time > end) return false;
        if (
          currencyFilter.length > 0 &&
          (!event.country || !currencyFilter.includes(event.country))
        ) {
          return false;
        }
        const impact = normalizeImpact(event.impact);
        if (impactFilter.length > 0 && !impactFilter.includes(impact)) {
          return false;
        }
        return true;
      })
      .sort((left, right) => {
        const impactDiff =
          (IMPACT_SORT_RANK[normalizeImpact(left.impact)] ?? 0) -
          (IMPACT_SORT_RANK[normalizeImpact(right.impact)] ?? 0);
        if (impactDiff !== 0) return impactDiff;
        const leftTime = left.date ? new Date(left.date).getTime() : 0;
        const rightTime = right.date ? new Date(right.date).getTime() : 0;
        return leftTime - rightTime;
      });
  }, [currencyFilter, events, impactFilter, range]);

  useEffect(() => {
    if (!range) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    const rangeStart = startOfDay(range.start).toISOString().slice(0, 10);
    const rangeEnd = startOfDay(range.end).toISOString().slice(0, 10);
    if (todayKey < rangeStart || todayKey > rangeEnd) return;
    if (lastNewsIngestRef.current === todayKey) return;

    const todaysEvents = filteredEvents.filter((event) => {
      if (!event.date) return false;
      return new Date(event.date).toISOString().slice(0, 10) === todayKey;
    });

    if (todaysEvents.length === 0) return;

    lastNewsIngestRef.current = todayKey;
    ingestNews.mutate({
      events: todaysEvents.map((event) => ({
        title: event.title || "Untitled event",
        country: event.country || "Global",
        impact: event.impact || "Low",
        date: event.date || new Date().toISOString(),
      })),
    });
  }, [filteredEvents, ingestNews, range]);

  const groupedEvents = useMemo(() => {
    const grouped: GroupedEvents = {};
    filteredEvents.forEach((event) => {
      const dateKey = event.date
        ? new Date(event.date).toISOString().slice(0, 10)
        : "unknown";
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(event);
    });
    return grouped;
  }, [filteredEvents]);

  const monthGrid = useMemo(() => (range ? buildMonthGrid(range.start) : []), [range]);

  useEffect(() => {
    if (!range) return;
    const diff =
      Math.floor(
        (endOfDay(range.end).getTime() - startOfDay(range.start).getTime()) /
          86400000
      ) + 1;
    setViewMode(diff <= 7 ? "week" : "month");
  }, [range]);

  const dayEvents = useMemo(() => {
    if (!range) return [];
    const key = range.start.toISOString().slice(0, 10);
    return groupedEvents[key] || [];
  }, [groupedEvents, range]);

  const weekDays = useMemo(() => {
    if (!range) return [];
    const start = startOfDay(range.start);
    const end = startOfDay(range.end);
    const days: Date[] = [];
    for (let index = 0; index < 7; index += 1) {
      const next = new Date(start);
      next.setDate(start.getDate() + index);
      if (next.getTime() > end.getTime()) break;
      const weekday = next.getDay();
      if (weekday === 0 || weekday === 6) continue;
      days.push(next);
    }
    return days;
  }, [range]);

  const listDays = useMemo(
    () =>
      Object.keys(groupedEvents)
        .filter((key) => key !== "unknown")
        .sort()
        .map((key) => new Date(key)),
    [groupedEvents]
  );

  const quickRanges = useMemo(() => {
    switch (viewMode) {
      case "month":
        return [
          {
            label: "This month",
            getRange: () => {
              const now = new Date();
              const start = new Date(now.getFullYear(), now.getMonth(), 1);
              const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
              return { start, end };
            },
          },
        ];
      case "week":
        return [
          {
            label: "This week",
            getRange: () => {
              const now = new Date();
              return { start: startOfWeek(now), end: endOfWeek(now) };
            },
          },
        ];
      case "day":
        return [
          {
            label: "Today",
            getRange: () => {
              const now = new Date();
              return { start: startOfDay(now), end: endOfDay(now) };
            },
          },
        ];
      case "list":
      default:
        return [];
    }
  }, [viewMode]);

  return (
    <div ref={exportRef} className="flex w-full flex-col gap-4">
      <EconomicCalendarControls
        bounds={bounds}
        range={range}
        viewMode={viewMode}
        currencies={currencies}
        currencyFilter={currencyFilter}
        impacts={impacts}
        impactFilter={impactFilter}
        quickRanges={quickRanges}
        exportTargetRef={exportRef}
        onRangeChange={setRange}
        onViewModeChange={setViewMode}
        onCurrencyFilterChange={(currency, checked) =>
          setCurrencyFilter((current) =>
            checked ? [...current, currency] : current.filter((item) => item !== currency)
          )
        }
        onImpactFilterChange={(impact, checked) =>
          setImpactFilter((current) =>
            checked ? [...current, impact] : current.filter((item) => item !== impact)
          )
        }
      />

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="border border-white/5 bg-white p-4 dark:bg-sidebar"
            >
              <Skeleton className="mb-3 h-4 w-32 rounded-none bg-sidebar-accent" />
              <Skeleton className="h-3 w-full rounded-none bg-sidebar-accent" />
              <Skeleton className="mt-2 h-3 w-2/3 rounded-none bg-sidebar-accent" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="border border-white/5 bg-white p-4 text-sm text-red-300 dark:bg-sidebar">
          {error}
        </div>
      ) : (
        <EconomicCalendarViews
          viewMode={viewMode}
          range={range}
          filteredEvents={filteredEvents}
          groupedEvents={groupedEvents}
          monthGrid={monthGrid}
          weekDays={weekDays}
          dayEvents={dayEvents}
          listDays={listDays}
        />
      )}
    </div>
  );
}
