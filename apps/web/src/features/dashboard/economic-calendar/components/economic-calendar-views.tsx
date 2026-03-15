"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import {
  IMPACT_BADGE_CLASSES,
  IMPACT_SORT_RANK,
  type EconomicEvent,
  type GroupedEvents,
  type ImpactLevel,
  type ViewMode,
} from "../lib/economic-calendar-types";
import {
  formatDateLabel,
  formatTimeLabel,
  formatWeekdayLabel,
  getCurrencyLabel,
  normalizeImpact,
} from "../lib/economic-calendar-utils";

type EconomicCalendarViewsProps = {
  viewMode: ViewMode;
  range: { start: Date; end: Date } | null;
  filteredEvents: EconomicEvent[];
  groupedEvents: GroupedEvents;
  monthGrid: Date[];
  weekDays: Date[];
  dayEvents: EconomicEvent[];
  listDays: Date[];
};

function RenderMoreBadge({
  items,
  shown,
}: {
  items: EconomicEvent[];
  shown: number;
}) {
  const extra = Math.max(0, items.length - shown);
  if (extra <= 0) return null;

  const counts = new Map<
    string,
    { label: string; count: number; impact: ImpactLevel }
  >();

  items.slice(shown).forEach((event) => {
    const title = event.title || "Untitled event";
    const currency = getCurrencyLabel(event.country);
    const impact = normalizeImpact(event.impact);
    const key = `${currency}-${title}-${impact}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    counts.set(key, {
      label: `${currency} · ${title}`,
      count: 1,
      impact,
    });
  });

  const grouped = Array.from(counts.values()).sort(
    (left, right) =>
      (IMPACT_SORT_RANK[left.impact] ?? 0) - (IMPACT_SORT_RANK[right.impact] ?? 0)
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-block cursor-default rounded-xs bg-neutral-800/25 px-2 py-0.5 text-[10px] font-medium text-white/60">
          +{extra} events
        </span>
      </TooltipTrigger>
      <TooltipContent className="w-max max-w-[360px]">
        <div className="flex max-h-64 flex-col gap-1 overflow-auto pr-1">
          {grouped.map((entry, index) => (
            <div key={`${entry.label}-${index}`} className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-xs border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                  IMPACT_BADGE_CLASSES[entry.impact]
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
}

function EventBadge({ impact }: { impact: ImpactLevel }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xs border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
        IMPACT_BADGE_CLASSES[impact]
      )}
    >
      {impact}
    </span>
  );
}

function EventRow({ event }: { event: EconomicEvent }) {
  const eventDate = event.date ? new Date(event.date) : null;
  const impact = normalizeImpact(event.impact);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-white/5 bg-sidebar/40 p-3">
      <div className="flex flex-col gap-1">
        <div className="text-xs text-secondary/70">
          {eventDate ? formatTimeLabel(eventDate) : "--:--"} ·{" "}
          {getCurrencyLabel(event.country)}
        </div>
        <div className="text-sm text-white/80">{event.title || "Untitled event"}</div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "inline-flex items-center rounded-xs border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
            IMPACT_BADGE_CLASSES[impact]
          )}
        >
          {impact}
        </span>
        <div className="text-xs text-white/60">
          <span className="mr-2">Actual: {event.actual || "—"}</span>
          <span className="mr-2">Forecast: {event.forecast || "—"}</span>
          <span>Prev: {event.previous || "—"}</span>
        </div>
      </div>
    </div>
  );
}

export function EconomicCalendarViews({
  viewMode,
  range,
  filteredEvents,
  groupedEvents,
  monthGrid,
  weekDays,
  dayEvents,
  listDays,
}: EconomicCalendarViewsProps) {
  if (filteredEvents.length === 0) {
    return (
      <div className="border border-white/5 bg-white p-4 text-sm text-secondary dark:bg-sidebar">
        No events match your filters.
      </div>
    );
  }

  if (viewMode === "month") {
    return (
      <div className="border border-white/5 bg-white dark:bg-sidebar">
        <div className="grid grid-cols-7 gap-[1px] bg-sidebar-accent">
          {monthGrid.map((day) => {
            const key = day.toISOString().slice(0, 10);
            const inMonth = range ? day.getMonth() === range.start.getMonth() : true;
            const dayEvents = groupedEvents[key] || [];

            return (
              <div
                key={key}
                className={cn(
                  "flex min-h-[140px] flex-col gap-2 bg-white p-3 dark:bg-sidebar",
                  !inMonth && "opacity-40"
                )}
              >
                <div className="text-xs text-white/60">{day.getDate()}</div>
                {dayEvents.slice(0, 2).map((event, index) => {
                  const eventDate = event.date ? new Date(event.date) : null;
                  const impact = normalizeImpact(event.impact);
                  return (
                    <div
                      key={`${event.title}-${index}`}
                      className="flex items-center gap-2 truncate text-[11px] text-white/70"
                    >
                      <EventBadge impact={impact} />
                      {eventDate ? formatTimeLabel(eventDate) : "--:--"} ·{" "}
                      {getCurrencyLabel(event.country)} · {event.title}
                    </div>
                  );
                })}
                <RenderMoreBadge items={dayEvents} shown={2} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (viewMode === "day") {
    return (
      <div className="border border-white/5 bg-white p-4 dark:bg-sidebar">
        <div className="flex items-center justify-between pb-3">
          <div className="text-sm font-medium text-secondary dark:text-neutral-100">
            {range ? formatDateLabel(range.start) : ""}
          </div>
          <div className="text-xs text-secondary/70">{dayEvents.length} events</div>
        </div>
        <div className="flex flex-col gap-3">
          {dayEvents.map((event, index) => (
            <EventRow key={`${event.title}-${index}`} event={event} />
          ))}
        </div>
      </div>
    );
  }

  if (viewMode === "week") {
    return (
      <div className="flex w-full items-stretch">
        {weekDays.map((day) => {
          const key = day.toISOString().slice(0, 10);
          const dayEvents = groupedEvents[key] || [];
          return (
            <div
              key={key}
              className="first:border last:border-l-0 not-last:border-l-0 not-first:border flex min-h-[220px] w-full flex-col border-black/10 bg-white p-5 dark:border-white/5 dark:bg-sidebar"
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="text-xs font-medium text-secondary">
                  {formatWeekdayLabel(day)}
                </span>
                <span className="inline-block rounded-xs bg-neutral-800/25 px-2 py-0.5 text-[10px] font-medium text-white/60">
                  {dayEvents.length} events
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {dayEvents.length === 0 ? (
                  <span className="text-[11px] text-white/40">No events</span>
                ) : (
                  dayEvents.slice(0, 3).map((event, index) => {
                    const eventDate = event.date ? new Date(event.date) : null;
                    const impact = normalizeImpact(event.impact);
                    return (
                      <div
                        key={`${event.title}-${index}`}
                        className="flex items-center gap-2 truncate text-[11px] text-white/70"
                      >
                        <EventBadge impact={impact} />
                        {eventDate ? formatTimeLabel(eventDate) : "--:--"} ·{" "}
                        {getCurrencyLabel(event.country)} · {event.title}
                      </div>
                    );
                  })
                )}
                <RenderMoreBadge items={dayEvents} shown={3} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {listDays.map((day) => {
        const key = day.toISOString().slice(0, 10);
        const dayEvents = groupedEvents[key] || [];
        if (!dayEvents.length) return null;
        return (
          <div key={key} className="border border-white/5 bg-white p-4 dark:bg-sidebar">
            <div className="flex items-center justify-between pb-3">
              <div className="text-sm font-medium text-secondary dark:text-neutral-100">
                {formatDateLabel(day)}
              </div>
              <div className="text-xs text-secondary/70">{dayEvents.length} events</div>
            </div>
            <div className="flex flex-col gap-3">
              {dayEvents.map((event, index) => (
                <EventRow key={`${event.title}-${index}`} event={event} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
