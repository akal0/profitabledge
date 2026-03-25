import {
  Button,
  DateRangePicker,
  Dialog,
  Group,
  Popover,
} from "react-aria-components";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { RangeCalendar } from "@/components/ui/calendar-rac";
import { DateInput, dateInputStyle } from "@/components/ui/datefield-rac";

import CalendarIcon from "@/public/icons/calendar.svg";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDate,
  fromDate,
  getLocalTimeZone,
} from "@internationalized/date";

type Props = {
  defaultStart: Date;
  defaultEnd: Date;
  minDate: Date;
  maxDate: Date;
  onRangeChange?: (start: Date, end: Date) => void;
  valueStart?: Date;
  valueEnd?: Date;
  minDays?: number;
  maxDays?: number;
  quickRanges?: Array<{
    label: string;
    getRange: (minDate: Date, maxDate: Date) => { start: Date; end: Date };
  }>;
  fillWidth?: boolean;
  popoverClassName?: string;
  calendarClassName?: string;
  calendarFullWidth?: boolean;
  popoverStyle?: CSSProperties;
};

function toCal(d: Date): CalendarDate {
  const z = getLocalTimeZone();
  const cd = fromDate(d, z);
  return new CalendarDate(cd.year, cd.month, cd.day);
}

function formatLabel(start: Date, end: Date) {
  const fmt = (d: Date) => {
    const mo = d.toLocaleString("en-US", { month: "short" });
    const day = d.getDate();
    const year = String(d.getFullYear()).slice(-2);
    const j = day % 10,
      k = day % 100;
    const suf =
      j === 1 && k !== 11
        ? "st"
        : j === 2 && k !== 12
        ? "nd"
        : j === 3 && k !== 13
        ? "rd"
        : "th";
    return `${mo} ${day}${suf} '${year}`;
  };
  return `${fmt(start)} - ${fmt(end)}`;
}

export default function Component({
  defaultStart,
  defaultEnd,
  minDate,
  maxDate,
  onRangeChange,
  valueStart,
  valueEnd,
  minDays = 3,
  maxDays = 7,
  fillWidth = false,
  popoverClassName,
  calendarClassName,
  calendarFullWidth = false,
  popoverStyle,
  quickRanges = [
    {
      label: "This week",
      getRange: (min, max) => {
        const endJs = new Date(max);
        endJs.setHours(0, 0, 0, 0);
        const startJs = new Date(endJs);
        startJs.setDate(endJs.getDate() - 6);
        return { start: startJs < min ? min : startJs, end: endJs };
      },
    },
    {
      label: "Last week",
      getRange: (min, max) => {
        const endJs = new Date(max);
        endJs.setHours(0, 0, 0, 0);
        const prevEndJs = new Date(endJs);
        prevEndJs.setDate(endJs.getDate() - 7);
        const prevStartJs = new Date(prevEndJs);
        prevStartJs.setDate(prevEndJs.getDate() - 6);
        return {
          start: prevStartJs < min ? min : prevStartJs,
          end: prevEndJs > max ? max : prevEndJs,
        };
      },
    },
    {
      label: "Last 3 days",
      getRange: (min, max) => {
        const endJs = new Date(max);
        endJs.setHours(0, 0, 0, 0);
        const startJs = new Date(endJs);
        startJs.setDate(endJs.getDate() - 2);
        return { start: startJs < min ? min : startJs, end: endJs };
      },
    },
  ],
}: Props) {
  const minValue = useMemo(() => toCal(minDate), [minDate]);
  const maxValue = useMemo(() => toCal(maxDate), [maxDate]);
  const [value, setValue] = useState<{
    start: CalendarDate;
    end: CalendarDate;
  }>(() => ({ start: toCal(defaultStart), end: toCal(defaultEnd) }));

  const tz = getLocalTimeZone();
  const label = useMemo(
    () => formatLabel(value.start.toDate(tz), value.end.toDate(tz)),
    [value, tz]
  );

  useEffect(() => {
    if (!valueStart || !valueEnd) return;
    const nextStart = toCal(valueStart);
    const nextEnd = toCal(valueEnd);
    setValue((current) => {
      if (
        current.start.compare(nextStart) === 0 &&
        current.end.compare(nextEnd) === 0
      ) {
        return current;
      }
      return {
        start: nextStart,
        end: nextEnd,
      };
    });
  }, [valueEnd, valueStart]);

  return (
    <DateRangePicker
      value={value}
      className={cn(
        "transition-all duration-150 cursor-pointer",
        fillWidth ? "w-full" : "inline-flex w-fit shrink-0"
      )}
      onChange={(range) => {
        if (!range) return;
        let { start, end } = range as any;
        if (start && !end) {
          const span = maxDays ? maxDays - 1 : minDays - 1;
          end = start.add({ days: span });
        } else if (!start && end) {
          const span = maxDays ? maxDays - 1 : minDays - 1;
          start = end.subtract({ days: span });
        }
        // Enforce min/max days when both present
        if (start && end) {
          const jsStart = start.toDate(tz);
          const jsEnd = end.toDate(tz);
          const diff =
            Math.floor(
              (+jsEnd.setHours(0, 0, 0, 0) - +jsStart.setHours(0, 0, 0, 0)) /
                86400000
            ) + 1;
          let desired = diff;
          if (maxDays && diff > maxDays) desired = maxDays;
          if (diff < minDays) desired = minDays;
          if (desired !== diff) {
            end = start.add({ days: desired - 1 });
          }
        }
        // Clamp to min/max bounds keeping length
        const lengthDays =
          Math.floor(
            (+end.toDate(tz).setHours(0, 0, 0, 0) -
              +start.toDate(tz).setHours(0, 0, 0, 0)) /
              86400000
          ) + 1;
        if (start.compare(minValue) < 0) {
          start = minValue;
          end = start.add({ days: lengthDays - 1 });
        }
        if (end.compare(maxValue) > 0) {
          end = maxValue;
          start = end.subtract({ days: lengthDays - 1 });
        }
        // Final guard to ensure at least minDays within bounds
        const jsStart2 = start.toDate(tz);
        const jsEnd2 = end.toDate(tz);
        const finalDiff =
          Math.floor(
            (+jsEnd2.setHours(0, 0, 0, 0) - +jsStart2.setHours(0, 0, 0, 0)) /
              86400000
          ) + 1;
        if (finalDiff < minDays) {
          let newEnd = start.add({ days: minDays - 1 });
          if (newEnd.compare(maxValue) > 0) {
            newEnd = maxValue;
            start = newEnd.subtract({ days: minDays - 1 });
            if (start.compare(minValue) < 0) start = minValue;
          }
          end = newEnd;
        }
        setValue({ start, end });
        onRangeChange?.(
          start.toDate(getLocalTimeZone()),
          end.toDate(getLocalTimeZone())
        );
      }}
    >
      <div
        className={cn(
          "relative flex",
          fillWidth ? "w-full" : "w-fit"
        )}
      >
        <Group
          className={cn(
            dateInputStyle,
            "h-[38px] overflow-hidden pe-9 rounded-md border-white/5 bg-sidebar py-2.5 shadow-none !cursor-pointer",
            fillWidth ? "w-full" : "w-fit"
          )}
        >
          {/* Keep inputs for a11y but visually hide; we render a custom label */}
          <DateInput slot="start" unstyled className="sr-only" />
          <span
            aria-hidden="true"
            className="text-muted-foreground/70 px-2 sr-only"
          >
            -
          </span>
          <DateInput slot="end" unstyled className="sr-only" />
          <span className="text-xs font-medium text-white/80 px-1">
            {label}
          </span>
        </Group>

        <Button
          aria-label={`Open date range picker for ${label}`}
          className="absolute inset-0 z-10 flex cursor-pointer items-center justify-end rounded-md px-3 text-white/75 transition-[color,box-shadow,filter] duration-150 outline-none hover:text-white focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <CalendarIcon className="pointer-events-none size-4 fill-current" />
        </Button>
      </div>

      <Popover
        className={cn(
          "bg-sidebar text-popover-foreground data-entering:animate-in data-exiting:animate-out data-[entering]:fade-in-0 data-[exiting]:fade-out-0 data-[entering]:zoom-in-95 data-[exiting]:zoom-out-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2 z-50 border border-white/5 outline-hidden rounded-md",
          popoverClassName
        )}
        style={popoverStyle}
        offset={4}
      >
        <Dialog className="max-h-[inherit] overflow-auto p-2">
          <RangeCalendar
            className={calendarClassName}
            fullWidth={calendarFullWidth}
            minValue={minValue}
            maxValue={maxValue}
            isDateUnavailable={(d) =>
              d.compare(minValue) < 0 || d.compare(maxValue) > 0
            }
            value={value}
            onChange={(range) => {
              // mirror the same enforcement as picker wrapper
              if (!range) return;
              let { start, end } = range as any;
              if (start && !end) {
                const span = maxDays ? maxDays - 1 : minDays - 1;
                end = start.add({ days: span });
              }
              if (end && !start) {
                const span = maxDays ? maxDays - 1 : minDays - 1;
                start = end.subtract({ days: span });
              }
              if (start && end) {
                const jsStart = start.toDate(tz);
                const jsEnd = end.toDate(tz);
                const diff =
                  Math.floor(
                    (+jsEnd.setHours(0, 0, 0, 0) -
                      +jsStart.setHours(0, 0, 0, 0)) /
                      86400000
                  ) + 1;
                let desired = diff;
                if (maxDays && diff > maxDays) desired = maxDays;
                if (diff < minDays) desired = minDays;
                if (desired !== diff) end = start.add({ days: desired - 1 });
              }
              const lengthDays =
                Math.floor(
                  (+end.toDate(tz).setHours(0, 0, 0, 0) -
                    +start.toDate(tz).setHours(0, 0, 0, 0)) /
                    86400000
                ) + 1;
              if (start.compare(minValue) < 0) {
                start = minValue;
                end = start.add({ days: lengthDays - 1 });
              }
              if (end.compare(maxValue) > 0) {
                end = maxValue;
                start = end.subtract({ days: lengthDays - 1 });
              }
              const jsStart2 = start.toDate(tz);
              const jsEnd2 = end.toDate(tz);
              const finalDiff =
                Math.floor(
                  (+jsEnd2.setHours(0, 0, 0, 0) -
                    +jsStart2.setHours(0, 0, 0, 0)) /
                    86400000
                ) + 1;
              if (finalDiff < minDays) {
                let newEnd = start.add({ days: minDays - 1 });
                if (newEnd.compare(maxValue) > 0) {
                  newEnd = maxValue;
                  start = newEnd.subtract({ days: minDays - 1 });
                  if (start.compare(minValue) < 0) start = minValue;
                }
                end = newEnd;
              }
              setValue({ start, end });
              onRangeChange?.(
                start.toDate(getLocalTimeZone()),
                end.toDate(getLocalTimeZone())
              );
            }}
          />

          {quickRanges.length > 0 ? (
            <div
              className="grid gap-1 mt-2"
              style={{
                gridTemplateColumns: `repeat(${quickRanges.length}, 1fr)`,
              }}
            >
              {quickRanges.map((range) => (
                <Button
                  key={range.label}
                  className="cursor-pointer text-xs py-2 rounded-md bg-sidebar border border-white/5 hover:bg-sidebar-accent w-full"
                  onPress={() => {
                    const tzNow = getLocalTimeZone();
                    const { start, end } = range.getRange(minDate, maxDate);
                    let nextStart = toCal(start);
                    let nextEnd = toCal(end);
                    if (maxDays) {
                      const diff =
                        Math.floor(
                          (+nextEnd.toDate(tzNow) - +nextStart.toDate(tzNow)) /
                            86400000
                        ) + 1;
                      if (diff > maxDays) {
                        nextEnd = nextStart.add({ days: maxDays - 1 });
                      }
                    }
                    if (minDays) {
                      const diff =
                        Math.floor(
                          (+nextEnd.toDate(tzNow) - +nextStart.toDate(tzNow)) /
                            86400000
                        ) + 1;
                      if (diff < minDays) {
                        nextEnd = nextStart.add({ days: minDays - 1 });
                      }
                    }
                    setValue({ start: nextStart, end: nextEnd });
                    onRangeChange?.(
                      nextStart.toDate(tzNow),
                      nextEnd.toDate(tzNow)
                    );
                  }}
                >
                  {range.label}
                </Button>
              ))}
            </div>
          ) : null}
        </Dialog>
      </Popover>
    </DateRangePicker>
  );
}
