"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PickerComponent from "@/components/dashboard/calendar/picker";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTRPC } from "@/utils/trpc";

const CALENDAR_ENDPOINT = "/api/economic-calendar";
const impactOrder = ["High", "Medium", "Low", "Holiday"] as const;

type ImpactLevel = (typeof impactOrder)[number];

type EconomicEvent = {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  actual?: string;
  forecast?: string;
  previous?: string;
};

type GroupedEvents = Record<string, EconomicEvent[]>;

type ViewMode = "month" | "week" | "day" | "list";

const currencyFlags: Record<string, string> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  JPY: "🇯🇵",
  AUD: "🇦🇺",
  CAD: "🇨🇦",
  CHF: "🇨🇭",
  NZD: "🇳🇿",
  CNY: "🇨🇳",
  HKD: "🇭🇰",
  SGD: "🇸🇬",
  NOK: "🇳🇴",
  SEK: "🇸🇪",
  DKK: "🇩🇰",
};

const impactBadgeClasses: Record<ImpactLevel, string> = {
  High: "bg-red-500/20 text-red-200 border-red-500/30",
  Medium: "bg-orange-500/20 text-orange-200 border-orange-500/30",
  Low: "bg-yellow-500/20 text-yellow-200 border-yellow-500/30",
  Holiday: "bg-neutral-500/20 text-neutral-200 border-neutral-500/30",
};

const impactSortOrder: ImpactLevel[] = [
  "Holiday",
  "Low",
  "Medium",
  "High",
];

const impactSortRank = impactSortOrder.reduce<Record<string, number>>(
  (acc, impact, index) => {
    acc[impact] = index;
    return acc;
  },
  {}
);

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTimeLabel(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatWeekdayLabel(date: Date) {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const day = date.getDate();
  const j = day % 10;
  const k = day % 100;
  const suffix =
    j === 1 && k !== 11
      ? "st"
      : j === 2 && k !== 12
      ? "nd"
      : j === 3 && k !== 13
      ? "rd"
      : "th";
  return `${weekday} ${day}${suffix}`;
}

function normalizeImpact(impact?: string): ImpactLevel {
  if (!impact) return "Low";
  const trimmed = impact.trim();
  if ((impactOrder as readonly string[]).includes(trimmed)) {
    return trimmed as ImpactLevel;
  }
  if (trimmed.toLowerCase().includes("holiday")) return "Holiday";
  if (trimmed.toLowerCase().includes("high")) return "High";
  if (trimmed.toLowerCase().includes("medium")) return "Medium";
  return "Low";
}

function getCurrencyLabel(code?: string) {
  if (!code) return "Global";
  const trimmed = code.trim().toUpperCase();
  const flag = currencyFlags[trimmed];
  return flag ? `${flag} ${trimmed}` : trimmed;
}

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
  next.setHours(23, 59, 59, 999);
  return next;
}

export default function EconomicCalendar() {
  const trpc = useTRPC();
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currencyFilter, setCurrencyFilter] = useState<string[]>(() => {
    const param = searchParams.get("currency");
    return param ? [param] : [];
  });
  const [impactFilter, setImpactFilter] = useState<ImpactLevel[]>(() => {
    const param = searchParams.get("impact");
    if (param && (impactOrder as readonly string[]).includes(param)) {
      return [param as ImpactLevel];
    }
    return [];
  });
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(() => {
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    if (startParam && endParam) {
      const start = new Date(startParam + "T00:00:00");
      const end = new Date(endParam + "T23:59:59.999");
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        return { start, end };
      }
    }
    return null;
  });
  const [bounds] = useState<{ min: Date; max: Date }>(() => {
    const min = new Date(2000, 0, 1);
    const max = new Date();
    max.setFullYear(max.getFullYear() + 2);
    return { min, max };
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    if (startParam && endParam && startParam === endParam) return "day";
    return "month";
  });
  const lastNewsIngestRef = useRef<string | null>(null);
  const ingestNews = trpc.notifications.ingestNews.useMutation();

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          range
            ? `${CALENDAR_ENDPOINT}?start=${range.start
                .toISOString()
                .slice(0, 10)}&end=${range.end.toISOString().slice(0, 10)}`
            : CALENDAR_ENDPOINT,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("calendar_unavailable");
        const data = (await res.json()) as EconomicEvent[];
        if (!mounted) return;
        const cleaned = Array.isArray(data) ? data : [];
        setEvents(cleaned);
        if (!range) {
          const dates = cleaned
            .map((event) => (event.date ? new Date(event.date) : null))
            .filter((date): date is Date => Boolean(date));
          if (dates.length > 0) {
            const maxDate = new Date(
              Math.max(...dates.map((d) => d.getTime()))
            );
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
    const set = new Set<string>();
    events.forEach((event) => {
      if (event.country) set.add(event.country);
    });
    return Array.from(set).sort();
  }, [events]);

  const impacts = useMemo(() => {
    const set = new Set<ImpactLevel>();
    events.forEach((event) => {
      set.add(normalizeImpact(event.impact));
    });
    return impactOrder.filter((impact) => set.has(impact));
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
      .sort((a, b) => {
        const impactDiff =
          (impactSortRank[normalizeImpact(a.impact)] ?? 0) -
          (impactSortRank[normalizeImpact(b.impact)] ?? 0);
        if (impactDiff !== 0) return impactDiff;
        const aTime = a.date ? new Date(a.date).getTime() : 0;
        const bTime = b.date ? new Date(b.date).getTime() : 0;
        return aTime - bTime;
      });
  }, [events, range, currencyFilter, impactFilter]);

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
  }, [filteredEvents, range, ingestNews]);

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

  const monthGrid = useMemo(() => {
    if (!range) return [];
    return buildMonthGrid(range.start);
  }, [range]);

  useEffect(() => {
    if (!range) return;
    const diff =
      Math.floor(
        (endOfDay(range.end).getTime() - startOfDay(range.start).getTime()) /
          86400000
      ) + 1;
    if (diff <= 7) {
      setViewMode("week");
    } else {
      setViewMode("month");
    }
  }, [range]);

  const dayEvents = useMemo(() => {
    if (!range) return [];
    const key = range.start.toISOString().slice(0, 10);
    return groupedEvents[key] || [];
  }, [range, groupedEvents]);

  const weekDays = useMemo(() => {
    if (!range) return [];
    const start = startOfDay(range.start);
    const end = startOfDay(range.end);
    const days: Date[] = [];
    const maxDays = 7;
    for (let i = 0; i < maxDays; i += 1) {
      const next = new Date(start);
      next.setDate(start.getDate() + i);
      if (next.getTime() > end.getTime()) break;
      const weekday = next.getDay();
      if (weekday === 0 || weekday === 6) continue;
      days.push(next);
    }
    return days;
  }, [range]);

  const listDays = useMemo(() => {
    return Object.keys(groupedEvents)
      .filter((key) => key !== "unknown")
      .sort()
      .map((key) => new Date(key));
  }, [groupedEvents]);

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

  const renderMoreBadge = (items: EconomicEvent[], shown: number) => {
    const extra = Math.max(0, items.length - shown);
    if (extra <= 0) return null;
    const hidden = items.slice(shown);
    const counts = new Map<
      string,
      { label: string; count: number; impact: ImpactLevel }
    >();
    hidden.forEach((event) => {
      const title = event.title || "Untitled event";
      const currency = getCurrencyLabel(event.country);
      const impact = normalizeImpact(event.impact);
      const key = `${currency}-${title}-${impact}`;
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, {
          label: `${currency} · ${title}`,
          count: 1,
          impact,
        });
      }
    });
    const grouped = Array.from(counts.values()).sort(
      (a, b) =>
        (impactSortRank[a.impact] ?? 0) - (impactSortRank[b.impact] ?? 0)
    );
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block rounded-xs bg-neutral-800/25 text-white/60 text-[10px] px-2 py-0.5 font-medium cursor-default">
            +{extra} events
          </span>
        </TooltipTrigger>
        <TooltipContent className="w-max max-w-[360px]">
          <div className="flex flex-col gap-1 max-h-64 overflow-auto pr-1">
            {grouped.map((entry, idx) => (
              <div
                key={`${entry.label}-${idx}`}
                className="flex items-center gap-2"
              >
                <span
                  className={cn(
                    "inline-flex items-center rounded-xs border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                    impactBadgeClasses[entry.impact]
                  )}
                >
                  {entry.impact}
                </span>
                <span className="whitespace-nowrap">
                  {entry.label}
                  {entry.count > 1 ? ` x${entry.count}` : ""}
                </span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-secondary dark:text-neutral-100">
            Economic calendar
          </h2>
          <p className="text-xs text-secondary/70 dark:text-neutral-400">
            Macro releases and market-moving events.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {bounds && range ? (
            <PickerComponent
              defaultStart={range.start}
              defaultEnd={range.end}
              minDate={bounds.min}
              maxDate={bounds.max}
              valueStart={range.start}
              valueEnd={range.end}
              onRangeChange={(start, end) =>
                setRange({ start: startOfDay(start), end: endOfDay(end) })
              }
              minDays={1}
              maxDays={undefined}
              quickRanges={quickRanges}
            />
          ) : (
            <div className="h-9 w-48">
              <Skeleton className="h-full w-full rounded-none bg-sidebar-accent" />
            </div>
          )}
          <div className="flex items-center">
            {(["month", "week", "day", "list"] as ViewMode[]).map((mode) => (
              <Button
                key={mode}
                className={cn(
                  "border border-white/5 px-3 text-xs rounded-none h-9",
                  viewMode === mode
                    ? "bg-sidebar-accent hover:bg-sidebar-accent text-white"
                    : "bg-sidebar text-white/35 hover:text-white hover:bg-sidebar-accent"
                )}
                onClick={() => setViewMode(mode)}
              >
                {mode.toUpperCase()}
              </Button>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="border border-white/5 bg-sidebar hover:bg-sidebar-accent rounded-none text-xs text-white/70 px-4 h-9 gap-2">
                {currencyFilter.length === 0
                  ? "All currencies"
                  : `Currencies (${currencyFilter.length})`}
                <ChevronDown className="size-3.5 text-white/60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="rounded-none bg-sidebar border border-white/5 p-1 w-[220px] max-h-64 overflow-auto">
              {currencies.map((currency) => {
                const checked = currencyFilter.includes(currency);
                return (
                  <DropdownMenuCheckboxItem
                    key={currency}
                    className="px-4 py-2.5"
                    checked={checked}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={(next) => {
                      setCurrencyFilter((current) => {
                        if (next) return [...current, currency];
                        return current.filter((item) => item !== currency);
                      });
                    }}
                  >
                    {getCurrencyLabel(currency)}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="border border-white/5 bg-sidebar hover:bg-sidebar-accent rounded-none text-xs text-white/70 px-4 h-9 gap-2">
                {impactFilter.length === 0
                  ? "All impact"
                  : `Impact (${impactFilter.length})`}
                <ChevronDown className="size-3.5 text-white/60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="rounded-none bg-sidebar border border-white/5 p-1 w-[200px]">
              {impacts.map((impact) => {
                const checked = impactFilter.includes(impact);
                return (
                  <DropdownMenuCheckboxItem
                    key={impact}
                    className="px-4 py-2.5"
                    checked={checked}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={(next) => {
                      setImpactFilter((current) => {
                        if (next) return [...current, impact];
                        return current.filter((item) => item !== impact);
                      });
                    }}
                  >
                    {impact}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="border border-white/5 bg-white dark:bg-sidebar p-4"
            >
              <Skeleton className="h-4 w-32 rounded-none bg-sidebar-accent mb-3" />
              <Skeleton className="h-3 w-full rounded-none bg-sidebar-accent" />
              <Skeleton className="mt-2 h-3 w-2/3 rounded-none bg-sidebar-accent" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="border border-white/5 bg-white dark:bg-sidebar p-4 text-sm text-red-300">
          {error}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredEvents.length === 0 ? (
            <div className="border border-white/5 bg-white dark:bg-sidebar p-4 text-sm text-secondary">
              No events match your filters.
            </div>
          ) : viewMode === "month" ? (
            <div className="border border-white/5 bg-white dark:bg-sidebar">
              <div className="grid grid-cols-7 gap-[1px] bg-sidebar-accent">
                {monthGrid.map((day) => {
                  const key = day.toISOString().slice(0, 10);
                  const inMonth =
                    range && day.getMonth() === range.start.getMonth();
                  const dayEvents = groupedEvents[key] || [];
                  return (
                    <div
                      key={key}
                      className={cn(
                        "bg-white dark:bg-sidebar p-3 min-h-[140px] flex flex-col gap-2",
                        !inMonth && "opacity-40"
                      )}
                    >
                      <div className="text-xs text-white/60">
                        {day.getDate()}
                      </div>
                      {dayEvents.slice(0, 2).map((event, idx) => {
                        const eventDate = event.date
                          ? new Date(event.date)
                          : null;
                        const impact = normalizeImpact(event.impact);
                        return (
                          <div
                            key={`${event.title}-${idx}`}
                            className="text-[11px] text-white/70 truncate flex items-center gap-2"
                          >
                            <span
                              className={cn(
                                "inline-flex items-center rounded-xs border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                                impactBadgeClasses[impact]
                              )}
                            >
                              {impact}
                            </span>
                            {eventDate ? formatTimeLabel(eventDate) : "--:--"} ·{" "}
                            {getCurrencyLabel(event.country)} · {event.title}
                          </div>
                        );
                      })}
                      {renderMoreBadge(dayEvents, 2)}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : viewMode === "day" ? (
            <div className="border border-white/5 bg-white dark:bg-sidebar p-4">
              <div className="flex items-center justify-between pb-3">
                <div className="text-sm font-medium text-secondary dark:text-neutral-100">
                  {range ? formatDateLabel(range.start) : ""}
                </div>
                <div className="text-xs text-secondary/70">
                  {dayEvents.length} events
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {dayEvents.map((event, idx) => {
                  const eventDate = event.date ? new Date(event.date) : null;
                  const impact = normalizeImpact(event.impact);
                  return (
                    <div
                      key={`${event.title}-${idx}`}
                      className="flex flex-wrap items-center justify-between gap-3 border border-white/5 bg-sidebar/40 p-3"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="text-xs text-secondary/70">
                          {eventDate ? formatTimeLabel(eventDate) : "--:--"} ·{" "}
                          {getCurrencyLabel(event.country)}
                        </div>
                        <div className="text-sm text-white/80">
                          {event.title || "Untitled event"}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-xs border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
                            impactBadgeClasses[impact]
                          )}
                        >
                          {impact}
                        </span>
                        <div className="text-xs text-white/60">
                          <span className="mr-2">
                            Actual: {event.actual || "—"}
                          </span>
                          <span className="mr-2">
                            Forecast: {event.forecast || "—"}
                          </span>
                          <span>Prev: {event.previous || "—"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : viewMode === "week" ? (
            <div className="flex w-full items-stretch">
              {weekDays.map((day) => {
                const key = day.toISOString().slice(0, 10);
                const dayEvents = groupedEvents[key] || [];
                return (
                  <div
                    key={key}
                    className="first:border last:border-l-0 not-last:border-l-0 not-first:border border-black/10 dark:border-white/5 bg-white dark:bg-sidebar p-5 w-full flex flex-col min-h-[220px]"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-xs text-secondary font-medium">
                        {formatWeekdayLabel(day)}
                      </span>
                      <span className="inline-block rounded-xs bg-neutral-800/25 text-white/60 text-[10px] px-2 py-0.5 font-medium">
                        {dayEvents.length} events
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                      {dayEvents.length === 0 ? (
                        <span className="text-[11px] text-white/40">
                          No events
                        </span>
                      ) : (
                        dayEvents.slice(0, 3).map((event, idx) => {
                          const eventDate = event.date
                            ? new Date(event.date)
                            : null;
                          const impact = normalizeImpact(event.impact);
                          return (
                            <div
                              key={`${event.title}-${idx}`}
                              className="text-[11px] text-white/70 truncate flex items-center gap-2"
                            >
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-xs border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                                  impactBadgeClasses[impact]
                                )}
                              >
                                {impact}
                              </span>
                              {eventDate
                                ? formatTimeLabel(eventDate)
                                : "--:--"}{" "}
                              · {getCurrencyLabel(event.country)} ·{" "}
                              {event.title}
                            </div>
                          );
                        })
                      )}
                      {renderMoreBadge(dayEvents, 3)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-4">
              {listDays.map((day) => {
                const key = day.toISOString().slice(0, 10);
                const dayEvents = groupedEvents[key] || [];
                if (!dayEvents.length) return null;
                return (
                  <div
                    key={key}
                    className="border border-white/5 bg-white dark:bg-sidebar p-4"
                  >
                    <div className="flex items-center justify-between pb-3">
                      <div className="text-sm font-medium text-secondary dark:text-neutral-100">
                        {formatDateLabel(day)}
                      </div>
                      <div className="text-xs text-secondary/70">
                        {dayEvents.length} events
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      {dayEvents.map((event, idx) => {
                        const eventDate = event.date
                          ? new Date(event.date)
                          : null;
                        const impact = normalizeImpact(event.impact);
                        return (
                          <div
                            key={`${event.title}-${idx}`}
                            className="flex flex-wrap items-center justify-between gap-3 border border-white/5 bg-sidebar/40 p-3"
                          >
                            <div className="flex flex-col gap-1">
                              <div className="text-xs text-secondary/70">
                                {eventDate
                                  ? formatTimeLabel(eventDate)
                                  : "--:--"}{" "}
                                · {getCurrencyLabel(event.country)}
                              </div>
                              <div className="text-sm text-white/80">
                                {event.title || "Untitled event"}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-xs border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
                                  impactBadgeClasses[impact]
                                )}
                              >
                                {impact}
                              </span>
                              <div className="text-xs text-white/60">
                                <span className="mr-2">
                                  Actual: {event.actual || "—"}
                                </span>
                                <span className="mr-2">
                                  Forecast: {event.forecast || "—"}
                                </span>
                                <span>Prev: {event.previous || "—"}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
