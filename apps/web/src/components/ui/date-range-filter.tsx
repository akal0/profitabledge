"use client";

import { Group } from "react-aria-components";
import { RangeCalendar } from "@/components/ui/calendar-rac";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDate,
  fromDate,
  getLocalTimeZone,
} from "@internationalized/date";

type Props = {
  label?: string;
  minDate: Date;
  maxDate: Date;
  defaultStart?: Date;
  defaultEnd?: Date;
  valueStart?: Date;
  valueEnd?: Date;
  onChange?: (start: Date, end: Date) => void;
  className?: string;
};

function toCal(d: Date): CalendarDate {
  const z = getLocalTimeZone();
  const cd = fromDate(d, z);
  return new CalendarDate(cd.year, cd.month, cd.day);
}

function fmtLabel(start: Date, end: Date) {
  const fmt = (d: Date) => {
    const mo = d.toLocaleString("en-US", { month: "short" });
    const day = d.getDate();
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
    const yr = String(d.getFullYear()).slice(-2);
    return `${mo} ${day}${suf} '${yr}`;
  };
  return `${fmt(start)} - ${fmt(end)}`;
}

export default function DateRangeFilter({
  label,
  minDate,
  maxDate,
  defaultStart,
  defaultEnd,
  valueStart,
  valueEnd,
  onChange,
  className,
}: Props) {
  const minValue = useMemo(() => toCal(minDate), [minDate]);
  const maxValue = useMemo(() => toCal(maxDate), [maxDate]);
  const initialStart = defaultStart || minDate;
  const initialEnd = defaultEnd || maxDate;

  const [value, setValue] = useState<{
    start: CalendarDate;
    end: CalendarDate;
  }>(() => ({ start: toCal(initialStart), end: toCal(initialEnd) }));

  const tz = getLocalTimeZone();
  const labelText = useMemo(
    () => fmtLabel(value.start.toDate(tz), value.end.toDate(tz)),
    [value, tz]
  );

  // external sync
  useEffect(() => {
    if (valueStart && valueEnd) {
      const vs = toCal(valueStart);
      const ve = toCal(valueEnd);
      if (value.start.compare(vs) !== 0 || value.end.compare(ve) !== 0) {
        setValue({ start: vs, end: ve });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueStart?.getTime(), valueEnd?.getTime()]);

  const lastSentRef = useRef<{ s: string; e: string } | null>(null);

  return (
    <div
      className={cn(
        "*:not-first:mt-2 flex items-center justify-center",
        className
      )}
    >
      <RangeCalendar
        minValue={minValue}
        maxValue={maxValue}
        className="w-full"
        isDateUnavailable={(d) =>
          d.compare(minValue) < 0 || d.compare(maxValue) > 0
        }
        value={value}
        onChange={(range) => {
          if (!range) return;
          let { start, end } = range as any;
          if (!start || !end) return;
          if (start.compare(minValue) < 0) start = minValue;
          if (end.compare(maxValue) > 0) end = maxValue;
          if (start.compare(end) > 0) {
            const tmp = start;
            start = end;
            end = tmp;
          }
          setValue({ start, end });
          const sJs = start.toDate(getLocalTimeZone());
          const eJs = end.toDate(getLocalTimeZone());
          const toYMD = (d: Date) => d.toISOString().slice(0, 10);
          const next = { s: toYMD(sJs), e: toYMD(eJs) };
          if (
            !lastSentRef.current ||
            lastSentRef.current.s !== next.s ||
            lastSentRef.current.e !== next.e
          ) {
            lastSentRef.current = next;
            onChange?.(sJs, eJs);
          }
        }}
      />
    </div>
  );
}
