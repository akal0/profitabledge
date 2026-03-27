"use client";

import React from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfToday,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SummaryCard } from "@/features/dashboard/calendar/components/summary-card";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  journalCompactActionButtonClassName,
  journalActionButtonMutedClassName,
} from "./action-button-styles";

interface JournalCalendarTabProps {
  accountId?: string;
  onSelectEntry: (entryId: string) => void;
  className?: string;
}

type CalendarEntry = {
  id: string;
  title: string;
  emoji?: string | null;
  entryType: string | null;
  journalDate?: Date | string | null;
  createdAt: Date | string;
};

const calendarActionGroupClass =
  "flex items-center overflow-hidden rounded-sm border border-white/5 bg-sidebar";
const calendarActionGroupButtonClass =
  "h-[38px] rounded-none border-0 bg-sidebar px-3 py-2 text-xs text-white transition-colors hover:bg-sidebar-accent";

function getEntryDate(entry: CalendarEntry) {
  return new Date(entry.journalDate ?? entry.createdAt);
}

function getEntryDayKey(entry: CalendarEntry) {
  return format(getEntryDate(entry), "yyyy-MM-dd");
}

function toSentenceCase(value: string) {
  if (!value) {
    return "";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getEntryTypeLabel(entryType: string | null | undefined) {
  return toSentenceCase((entryType ?? "general").replace(/_/g, " "));
}

export function JournalCalendarTab({
  accountId,
  onSelectEntry,
  className,
}: JournalCalendarTabProps) {
  const [visibleMonth, setVisibleMonth] = React.useState(() =>
    startOfMonth(new Date())
  );
  const [selectedDate, setSelectedDate] = React.useState(() => startOfToday());

  const gridStart = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const calendarRowCount = Math.max(1, Math.ceil(calendarDays.length / 7));

  const { data: calendarEntries = [], isLoading } =
    trpc.journal.calendarEntries.useQuery({
      startDate: startOfDay(gridStart).toISOString(),
      endDate: endOfDay(gridEnd).toISOString(),
      accountId,
    });

  const entriesByDay = React.useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();

    for (const entry of calendarEntries as CalendarEntry[]) {
      const dayKey = getEntryDayKey(entry);
      const current = map.get(dayKey) ?? [];
      current.push(entry);
      map.set(dayKey, current);
    }

    for (const entries of map.values()) {
      entries.sort(
        (left, right) =>
          getEntryDate(right).getTime() - getEntryDate(left).getTime()
      );
    }

    return map;
  }, [calendarEntries]);

  const visibleMonthEntries = React.useMemo(
    () =>
      [...(calendarEntries as CalendarEntry[])].filter((entry) =>
        isSameMonth(getEntryDate(entry), visibleMonth)
      ),
    [calendarEntries, visibleMonth]
  );

  const visibleMonthEntriesSorted = React.useMemo(
    () =>
      [...visibleMonthEntries].sort(
        (left, right) =>
          getEntryDate(right).getTime() - getEntryDate(left).getTime()
      ),
    [visibleMonthEntries]
  );

  const defaultSelectedDate = React.useMemo(() => {
    if (visibleMonthEntriesSorted.length > 0) {
      return startOfDay(getEntryDate(visibleMonthEntriesSorted[0]));
    }

    if (isSameMonth(visibleMonth, new Date())) {
      return startOfToday();
    }

    return startOfMonth(visibleMonth);
  }, [visibleMonth, visibleMonthEntriesSorted]);

  React.useEffect(() => {
    const isSelectedVisible = calendarDays.some((day) => isSameDay(day, selectedDate));

    if (!isSelectedVisible || !isSameMonth(selectedDate, visibleMonth)) {
      setSelectedDate(defaultSelectedDate);
    }
  }, [calendarDays, defaultSelectedDate, selectedDate, visibleMonth]);

  const selectedEntries =
    entriesByDay.get(format(selectedDate, "yyyy-MM-dd")) ?? [];
  const selectedLatestEntry = selectedEntries[0] ?? null;

  const monthSummary = React.useMemo(() => {
    const visibleMonthDayMap = new Map<string, CalendarEntry[]>();
    const entryTypeCounts = new Map<string, number>();

    for (const entry of visibleMonthEntriesSorted) {
      const dayKey = getEntryDayKey(entry);
      const currentDayEntries = visibleMonthDayMap.get(dayKey) ?? [];
      currentDayEntries.push(entry);
      visibleMonthDayMap.set(dayKey, currentDayEntries);

      const entryTypeKey = entry.entryType ?? "general";
      entryTypeCounts.set(entryTypeKey, (entryTypeCounts.get(entryTypeKey) ?? 0) + 1);
    }

    let busiestDayKey: string | null = null;
    let busiestDayCount = 0;
    let multiEntryDays = 0;

    for (const [dayKey, dayEntries] of visibleMonthDayMap.entries()) {
      if (dayEntries.length > busiestDayCount) {
        busiestDayKey = dayKey;
        busiestDayCount = dayEntries.length;
      }

      if (dayEntries.length > 1) {
        multiEntryDays += 1;
      }
    }

    let topEntryType: { label: string; count: number } | null = null;

    for (const [entryTypeKey, count] of entryTypeCounts.entries()) {
      if (!topEntryType || count > topEntryType.count) {
        topEntryType = {
          label: getEntryTypeLabel(entryTypeKey),
          count,
        };
      }
    }

    return {
      totalEntries: visibleMonthEntriesSorted.length,
      activeDays: visibleMonthDayMap.size,
      multiEntryDays,
      busiestDayCount,
      busiestDayDate:
        busiestDayKey != null ? new Date(`${busiestDayKey}T00:00:00`) : null,
      latestEntry: visibleMonthEntriesSorted[0] ?? null,
      topEntryType,
    };
  }, [visibleMonthEntriesSorted]);

  const visibleMonthDayCount = endOfMonth(visibleMonth).getDate();

  return (
    <div className={cn("flex h-full min-h-0 flex-1 flex-col gap-4", className)}>
      <div className="shrink-0 flex flex-wrap items-center gap-2 xl:justify-end">
        <Button
          size="sm"
          onClick={() => {
            const today = startOfMonth(new Date());
            setVisibleMonth(today);
            setSelectedDate(startOfToday());
          }}
          className={journalActionButtonMutedClassName}
        >
          Today
        </Button>

        <div className={calendarActionGroupClass}>
          <Button
            size="sm"
            onClick={() => setVisibleMonth(subMonths(visibleMonth, 1))}
            className={cn(calendarActionGroupButtonClass, "rounded-none")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            disabled
            className="h-[38px] cursor-default rounded-none border-x border-white/5 bg-sidebar px-3 py-2 text-xs text-white/70 hover:bg-sidebar"
          >
            {format(visibleMonth, "MMMM yyyy")}
          </Button>
          <Button
            size="sm"
            onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
            className={cn(calendarActionGroupButtonClass, "rounded-none")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid h-full min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-stretch">
        <div className="h-full min-h-0 overflow-hidden rounded-sm border border-white/5 bg-white dark:bg-sidebar">
          <div
            className="grid h-full min-h-full grid-cols-7 gap-[1px] bg-sidebar-accent"
            style={{
              gridTemplateRows: `repeat(${calendarRowCount}, minmax(0, 1fr))`,
            }}
          >
            {isLoading
              ? Array.from({ length: calendarDays.length }).map((_, index) => (
                  <div
                    key={index}
                    className="h-full min-h-0 bg-white p-3 dark:bg-sidebar"
                  >
                    <div className="flex h-full flex-col justify-between gap-4">
                      <Skeleton className="h-4 w-10 rounded-none bg-sidebar-accent" />
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-24 rounded-none bg-sidebar-accent" />
                        <Skeleton className="h-3 w-16 rounded-none bg-sidebar-accent" />
                      </div>
                    </div>
                  </div>
                ))
              : calendarDays.map((day) => {
                  const dayKey = format(day, "yyyy-MM-dd");
                  const dayEntries = entriesByDay.get(dayKey) ?? [];
                  const isSelected = isSameDay(day, selectedDate);
                  const isToday = isSameDay(day, new Date());
                  const inMonth = isSameMonth(day, visibleMonth);
                  const latestEntry = dayEntries[0];
                  const extraEntries = Math.max(0, dayEntries.length - 1);

                  return (
                    <button
                      key={dayKey}
                      type="button"
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "h-full min-h-0 bg-white p-3 dark:bg-sidebar flex flex-col gap-2 text-left transition-colors duration-250 hover:bg-sidebar-accent",
                        !inMonth && dayEntries.length === 0 && "opacity-40",
                        isSelected && "bg-sidebar-accent ring-1 ring-inset ring-teal-400/35",
                        !isSelected && isToday && "ring-1 ring-inset ring-white/10"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-secondary dark:text-white/70">
                          {format(day, "d")}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-medium",
                            dayEntries.length > 0 ? "text-teal-400" : "text-white/25"
                          )}
                        >
                          {dayEntries.length} {dayEntries.length === 1 ? "entry" : "entries"}
                        </span>
                      </div>

                      <div className="mt-auto flex flex-col gap-1">
                        <div
                          className={cn(
                            "text-sm font-medium",
                            dayEntries.length > 0 ? "text-white" : "text-white/50"
                          )}
                        >
                          {latestEntry ? `${latestEntry.emoji ? `${latestEntry.emoji} ` : ""}${latestEntry.title}` : "No entries"}
                        </div>
                        <div className="text-[10px] font-medium text-white/25">
                          {latestEntry
                            ? extraEntries > 0
                              ? `+${extraEntries} more on this day`
                              : getEntryTypeLabel(latestEntry.entryType)
                            : isToday
                              ? "Today"
                              : "Use the summary cards to inspect the month"}
                        </div>
                      </div>
                    </button>
                  );
                })}
          </div>
        </div>

        <div className="grid h-full min-h-0 grid-cols-1 gap-2 overflow-auto sm:grid-cols-2 xl:grid-cols-1 xl:grid-rows-[auto_auto_auto_auto_1fr_1fr]">
          <SummaryCard
            title="Entries this month"
            value={monthSummary.totalEntries}
            subtext={
              monthSummary.totalEntries > 0
                ? `${monthSummary.activeDays} active day${monthSummary.activeDays === 1 ? "" : "s"}`
                : `No entries in ${format(visibleMonth, "MMMM")}`
            }
            accentClass={
              monthSummary.totalEntries > 0 ? "text-teal-400" : undefined
            }
            loading={isLoading}
          />

          <SummaryCard
            title="Active days"
            value={monthSummary.activeDays}
            subtext={
              monthSummary.activeDays > 0
                ? `${monthSummary.multiEntryDays} day${monthSummary.multiEntryDays === 1 ? "" : "s"} with multiple entries`
                : `${visibleMonthDayCount} day month`
            }
            loading={isLoading}
          />

          <SummaryCard
            title="Busiest day"
            value={
              monthSummary.busiestDayCount > 0
                ? `${monthSummary.busiestDayCount} ${monthSummary.busiestDayCount === 1 ? "entry" : "entries"}`
                : "—"
            }
            subtext={
              monthSummary.busiestDayDate
                ? format(monthSummary.busiestDayDate, "EEE d MMM")
                : `No activity in ${format(visibleMonth, "MMMM")}`
            }
            accentClass={
              monthSummary.busiestDayCount > 0 ? "text-teal-400" : undefined
            }
            loading={isLoading}
          />

          <SummaryCard
            title="Focus type"
            value={monthSummary.topEntryType?.label ?? "—"}
            subtext={
              monthSummary.topEntryType
                ? `${monthSummary.topEntryType.count} entr${monthSummary.topEntryType.count === 1 ? "y" : "ies"}`
                : "No dominant entry type yet"
            }
            loading={isLoading}
          />

          {isLoading ? (
            <SummaryCard title="Latest entry" loading />
          ) : (
            <SummaryCard title="Latest entry">
              <div className="flex h-full w-full flex-col justify-center gap-3 text-left">
                {monthSummary.latestEntry ? (
                  <>
                    <div className="space-y-1.5">
                      <p className="line-clamp-2 text-sm font-semibold tracking-tight text-white">
                        {monthSummary.latestEntry.emoji
                          ? `${monthSummary.latestEntry.emoji} `
                          : ""}
                        {monthSummary.latestEntry.title}
                      </p>
                      <p className="text-[11px] text-white/42">
                        {format(getEntryDate(monthSummary.latestEntry), "EEE d MMM")}
                        {" · "}
                        {getEntryTypeLabel(monthSummary.latestEntry.entryType)}
                      </p>
                    </div>
                    <p className="text-[11px] text-white/42">
                      Most recent note in {format(visibleMonth, "MMMM")}
                    </p>
                  </>
                ) : (
                  <div className="flex h-full w-full flex-col justify-center gap-3 text-left">
                    <p className="text-sm font-medium text-white/70">
                      Nothing logged yet
                    </p>
                    <p className="text-[11px] text-white/42">
                      Entries added this month will show up here.
                    </p>
                  </div>
                )}
              </div>
            </SummaryCard>
          )}

          {isLoading ? (
            <SummaryCard title="Selected day" loading />
          ) : (
            <SummaryCard title="Selected day">
              <div className="flex h-full w-full flex-col justify-center gap-3 text-left">
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold tracking-tight text-white">
                    {format(selectedDate, "EEEE d MMMM")}
                  </p>
                  <p className="text-[11px] text-white/42">
                    {selectedEntries.length > 0
                      ? `${selectedEntries.length} entr${selectedEntries.length === 1 ? "y" : "ies"} logged`
                      : "No entries on this day"}
                  </p>
                  {selectedLatestEntry ? (
                    <div className="rounded-sm border border-white/5 bg-sidebar px-3 py-2 text-left">
                      <p className="line-clamp-2 text-xs font-medium text-white">
                        {selectedLatestEntry.emoji
                          ? `${selectedLatestEntry.emoji} `
                          : ""}
                        {selectedLatestEntry.title}
                      </p>
                      <p className="mt-1 text-[11px] text-white/42">
                        {getEntryTypeLabel(selectedLatestEntry.entryType)}
                      </p>
                    </div>
                  ) : null}
                </div>

                {selectedLatestEntry ? (
                  <Button
                    size="sm"
                    onClick={() => onSelectEntry(selectedLatestEntry.id)}
                    className={cn(
                      journalCompactActionButtonClassName,
                      "w-full justify-center text-white"
                    )}
                  >
                    Open latest entry
                  </Button>
                ) : null}
              </div>
            </SummaryCard>
          )}
        </div>
      </div>
    </div>
  );
}
