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
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  journalActionButtonClassName,
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

  const { data: calendarEntries = [], isLoading } =
    trpc.journal.calendarEntries.useQuery({
      startDate: startOfDay(gridStart).toISOString(),
      endDate: endOfDay(gridEnd).toISOString(),
      accountId,
    });

  const entriesByDay = React.useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();

    for (const entry of calendarEntries as CalendarEntry[]) {
      const sourceDate = entry.journalDate ?? entry.createdAt;
      const dayKey = format(new Date(sourceDate), "yyyy-MM-dd");
      const current = map.get(dayKey) ?? [];
      current.push(entry);
      map.set(dayKey, current);
    }

    return map;
  }, [calendarEntries]);

  const defaultSelectedDate = React.useMemo(() => {
    const visibleMonthEntries = (calendarEntries as CalendarEntry[]).filter((entry) =>
      isSameMonth(new Date(entry.journalDate ?? entry.createdAt), visibleMonth)
    );

    if (visibleMonthEntries.length > 0) {
      return startOfDay(
        new Date(visibleMonthEntries[0].journalDate ?? visibleMonthEntries[0].createdAt)
      );
    }

    if (isSameMonth(visibleMonth, new Date())) {
      return startOfToday();
    }

    return startOfMonth(visibleMonth);
  }, [calendarEntries, visibleMonth]);

  React.useEffect(() => {
    const isSelectedVisible = calendarDays.some((day) => isSameDay(day, selectedDate));

    if (!isSelectedVisible || !isSameMonth(selectedDate, visibleMonth)) {
      setSelectedDate(defaultSelectedDate);
    }
  }, [calendarDays, defaultSelectedDate, selectedDate, visibleMonth]);

  const selectedEntries =
    entriesByDay.get(format(selectedDate, "yyyy-MM-dd")) ?? [];

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-4", className)}>
      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
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

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="max-h-[760px] overflow-auto rounded-sm border border-white/5 bg-white dark:bg-sidebar">
          <div className="grid grid-cols-7 gap-[1px] bg-sidebar-accent">
            {isLoading
              ? Array.from({ length: calendarDays.length }).map((_, index) => (
                  <div
                    key={index}
                    className="min-h-[120px] bg-white p-3 dark:bg-sidebar"
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
                        "bg-white dark:bg-sidebar p-3 min-h-[120px] flex flex-col gap-2 text-left transition-colors duration-250 hover:bg-sidebar-accent",
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
                              : (latestEntry.entryType?.replace("_", " ") ?? "general")
                            : isToday
                              ? "Today"
                              : "Open the day to inspect details"}
                        </div>
                      </div>
                    </button>
                  );
                })}
          </div>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-sm border border-white/5 bg-white dark:bg-sidebar">
          <div className="border-b border-white/5 px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <CalendarDays className="h-4 w-4 text-teal-300" />
              <span>{format(selectedDate, "EEEE, d MMMM yyyy")}</span>
            </div>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-white/40">
              {selectedEntries.length > 0
                ? `${selectedEntries.length} entr${selectedEntries.length === 1 ? "y" : "ies"} on this day`
                : "No entries on this day yet"}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {selectedEntries.length > 0 ? (
              <div className="space-y-3">
                {selectedEntries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onSelectEntry(entry.id)}
                    className="w-full rounded-sm border border-white/5 bg-white/[0.02] p-3 text-left transition-colors hover:bg-sidebar-accent"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {entry.emoji ? `${entry.emoji} ` : ""}
                          {entry.title}
                        </p>
                        <p className="mt-1 text-xs text-white/45">
                          {entry.entryType?.replace("_", " ") || "general"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-white/30">
                        <Clock3 className="h-3 w-3" />
                        {format(
                          new Date(entry.journalDate ?? entry.createdAt),
                          "HH:mm"
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-sm border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
                <FileText className="mb-3 h-10 w-10 text-white/20" />
                <p className="text-sm font-medium text-white">Nothing logged here</p>
                <p className="mt-1 text-xs text-white/45">
                  Use the entries tab to add a note, review, or setup to this date.
                </p>
                <Button
                  size="sm"
                  onClick={() => setVisibleMonth(startOfMonth(selectedDate))}
                  className={cn(journalActionButtonClassName, "mt-4")}
                >
                  Jump to month
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
