import {
  Button,
  DateRangePicker,
  Dialog,
  Group,
  Label,
  Popover,
} from "react-aria-components";

import { cn } from "@/lib/utils";
import { RangeCalendar } from "@/components/ui/calendar-rac";
import { DateInput, dateInputStyle } from "@/components/ui/datefield-rac";

import CalendarIcon from "@/public/icons/calendar.svg";
import { useMemo, useState } from "react";
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

  // sync externally corrected range back into picker
  if (valueStart && valueEnd) {
    const vs = toCal(valueStart);
    const ve = toCal(valueEnd);
    if (value.start.compare(vs) !== 0 || value.end.compare(ve) !== 0) {
      setValue({ start: vs, end: ve });
    }
  }

  return (
    <DateRangePicker
      value={value}
      onChange={(range) => {
        if (!range) return;
        const minDays = 3;
        const maxDays = 7;
        let { start, end } = range as any;
        if (start && !end) {
          end = start.add({ days: maxDays - 1 });
        } else if (!start && end) {
          start = end.subtract({ days: maxDays - 1 });
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
          if (diff > maxDays) desired = maxDays;
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
      className="*:not-first:mt-2 group hover:brightness-120 transition-all duration-150"
      // onPointerDown={() => {
      //   const y = window.scrollY;
      //   requestAnimationFrame(() => window.scrollTo(0, y));
      // }}
    >
      <div className="flex cursor-pointer">
        <Group
          className={cn(
            dateInputStyle,
            "pe-12 rounded-none bg-sidebar border-white/5 py-2.5"
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

        <Button className="text-muted-foreground/80 hover:text-foreground z-10 -ms-11 flex w-9 items-center justify-center rounded-none transition-[color,box-shadow] outline-none cursor-pointer">
          <CalendarIcon className="size-4 fill-white/75" />
        </Button>
      </div>

      <Popover
        className="bg-sidebar text-popover-foreground data-entering:animate-in data-exiting:animate-out data-[entering]:fade-in-0 data-[exiting]:fade-out-0 data-[entering]:zoom-in-95 data-[exiting]:zoom-out-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2 z-50 rounded-none border border-white/5 outline-hidden"
        offset={4}
      >
        <Dialog className="max-h-[inherit] overflow-auto p-2">
          <RangeCalendar
            minValue={minValue}
            maxValue={maxValue}
            isDateUnavailable={(d) =>
              d.compare(minValue) < 0 || d.compare(maxValue) > 0
            }
            value={value}
            onChange={(range) => {
              // mirror the same enforcement as picker wrapper
              if (!range) return;
              const minDays = 3;
              const maxDays = 7;
              let { start, end } = range as any;
              if (start && !end) end = start.add({ days: maxDays - 1 });
              if (end && !start) start = end.subtract({ days: maxDays - 1 });
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
                if (diff > maxDays) desired = maxDays;
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

          {/* Quick ranges */}
          <div className="grid grid-cols-3 gap-1 mt-2">
            <Button
              className="cursor-pointer text-xs py-2 rounded-none bg-sidebar border border-white/5 hover:bg-sidebar-accent"
              onPress={() => {
                // Most recent 7-day window ending at maxDate
                const endJs = new Date(maxDate);
                endJs.setHours(0, 0, 0, 0);
                const startJs = new Date(endJs);
                startJs.setDate(endJs.getDate() - 6);
                // Clamp to bounds
                const clampedStartJs =
                  startJs < minDate ? new Date(minDate) : startJs;
                const clampedEndJs =
                  endJs > maxDate ? new Date(maxDate) : endJs;
                // Enforce 3-7 days inclusive
                const tzNow = getLocalTimeZone();
                let start = toCal(clampedStartJs);
                let end = toCal(clampedEndJs);
                let diff =
                  Math.floor(
                    (+end.toDate(tzNow) - +start.toDate(tzNow)) / 86400000
                  ) + 1;
                if (diff < 3) end = start.add({ days: 2 });
                if (diff > 7) end = start.add({ days: 6 });
                setValue({ start, end });
                onRangeChange?.(start.toDate(tzNow), end.toDate(tzNow));
              }}
            >
              This week
            </Button>

            <Button
              className="cursor-pointer text-xs py-2 rounded-none bg-sidebar border border-white/5 hover:bg-sidebar-accent"
              onPress={() => {
                // Previous 7-day window before the most recent 7 days
                const endJs = new Date(maxDate);
                endJs.setHours(0, 0, 0, 0);
                // Last 7 days end at maxDate; previous week ends the day before that start
                const prevEndJs = new Date(endJs);
                prevEndJs.setDate(endJs.getDate() - 7);
                const prevStartJs = new Date(prevEndJs);
                prevStartJs.setDate(prevEndJs.getDate() - 6);
                // Clamp to bounds
                const clampedStartJs =
                  prevStartJs < minDate ? new Date(minDate) : prevStartJs;
                const clampedEndJs =
                  prevEndJs > maxDate ? new Date(maxDate) : prevEndJs;
                const tzNow = getLocalTimeZone();
                let start = toCal(clampedStartJs);
                let end = toCal(clampedEndJs);
                let diff =
                  Math.floor(
                    (+end.toDate(tzNow) - +start.toDate(tzNow)) / 86400000
                  ) + 1;
                if (diff < 3) end = start.add({ days: 2 });
                if (diff > 7) end = start.add({ days: 6 });
                setValue({ start, end });
                onRangeChange?.(start.toDate(tzNow), end.toDate(tzNow));
              }}
            >
              Last week
            </Button>

            <Button
              className="cursor-pointer text-xs py-2 rounded-none bg-sidebar border border-white/5 hover:bg-sidebar-accent"
              onPress={() => {
                // Most recent 3-day window ending at maxDate
                const endJs = new Date(maxDate);
                endJs.setHours(0, 0, 0, 0);
                const startJs = new Date(endJs);
                startJs.setDate(endJs.getDate() - 2);
                const clampedStartJs =
                  startJs < minDate ? new Date(minDate) : startJs;
                const clampedEndJs =
                  endJs > maxDate ? new Date(maxDate) : endJs;
                const tzNow = getLocalTimeZone();
                let start = toCal(clampedStartJs);
                let end = toCal(clampedEndJs);
                // Ensure at least 3 days
                let diff =
                  Math.floor(
                    (+end.toDate(tzNow) - +start.toDate(tzNow)) / 86400000
                  ) + 1;
                if (diff < 3) end = start.add({ days: 2 });
                // Cap at 7 days (not expected here but keep consistent)
                if (diff > 7) end = start.add({ days: 6 });
                setValue({ start, end });
                onRangeChange?.(start.toDate(tzNow), end.toDate(tzNow));
              }}
            >
              Last 3 days
            </Button>
          </div>
        </Dialog>
      </Popover>
    </DateRangePicker>
  );
}
