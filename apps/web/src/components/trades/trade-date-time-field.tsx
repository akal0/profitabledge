"use client";

import { format } from "date-fns";
import {
  CalendarDate,
  Time,
  fromDate,
  getLocalTimeZone,
} from "@internationalized/date";
import {
  Button as AriaButton,
  DatePicker,
  Dialog,
  Group,
  Popover as AriaPopover,
} from "react-aria-components";

import { Calendar } from "@/components/ui/calendar-rac";
import {
  DateInput,
  TimeField,
  dateInputStyle,
} from "@/components/ui/datefield-rac";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import CalendarIcon from "@/public/icons/calendar.svg";

type TradeDateTimeFieldProps = {
  label: string;
  value: Date;
  onChange: (nextValue: Date) => void;
  triggerClassName?: string;
};

function toCalendarDate(value: Date) {
  const localDate = fromDate(value, getLocalTimeZone());
  return new CalendarDate(localDate.year, localDate.month, localDate.day);
}

function replaceCalendarDate(current: Date, next: CalendarDate) {
  const selected = next.toDate(getLocalTimeZone());
  const value = new Date(current);
  value.setFullYear(
    selected.getFullYear(),
    selected.getMonth(),
    selected.getDate()
  );
  value.setSeconds(0, 0);
  return value;
}

function toTimeValue(value: Date) {
  return new Time(value.getHours(), value.getMinutes());
}

function replaceTimeValue(current: Date, nextValue: Time | null) {
  if (!nextValue) {
    return current;
  }

  const value = new Date(current);
  value.setHours(nextValue.hour, nextValue.minute, 0, 0);
  return value;
}

function formatDateButtonLabel(value: Date) {
  return format(value, "EEE, MMM d, yyyy");
}

export function toDateTimeInputValue(value: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");

  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(
    value.getDate()
  )}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function parseDateTimeInputValue(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function TradeDateTimeField({
  label,
  value,
  onChange,
  triggerClassName,
}: TradeDateTimeFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-white/50">{label}</Label>
      <div className="grid grid-cols-[1fr_6.75rem] gap-2">
        <DatePicker
          aria-label={`${label} date`}
          value={toCalendarDate(value)}
          onChange={(nextValue) =>
            onChange(replaceCalendarDate(value, nextValue as CalendarDate))
          }
          className="w-full"
        >
          <div className="relative flex w-full">
            <Group
              className={cn(
                dateInputStyle,
                "h-9 w-full rounded-sm ring-white/5 bg-sidebar px-3 pe-9 text-white/85 shadow-none !cursor-pointer",
                triggerClassName
              )}
            >
              <DateInput unstyled className="sr-only" />
              <span className="truncate text-sm text-white/85">
                {formatDateButtonLabel(value)}
              </span>
            </Group>

            <AriaButton
              aria-label={`Open ${label} date picker`}
              className="absolute inset-0 z-10 flex cursor-pointer items-center justify-end rounded-sm px-3 text-white/75 outline-none transition-[color,box-shadow,filter] duration-150 hover:text-white focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <CalendarIcon className="pointer-events-none size-4 fill-current" />
            </AriaButton>
          </div>

          <AriaPopover
            className="bg-sidebar text-popover-foreground data-entering:animate-in data-exiting:animate-out data-[entering]:fade-in-0 data-[exiting]:fade-out-0 data-[entering]:zoom-in-95 data-[exiting]:zoom-out-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2 z-50 w-fit ring ring-white/5 outline-hidden rounded-sm"
            offset={4}
          >
            <Dialog className="max-h-[inherit] overflow-auto p-2">
              <Calendar className="w-fit" />
            </Dialog>
          </AriaPopover>
        </DatePicker>

        <TimeField
          aria-label={`${label} time`}
          granularity="minute"
          hourCycle={24}
          value={toTimeValue(value)}
          onChange={(nextValue) => onChange(replaceTimeValue(value, nextValue))}
          className="w-max"
        >
          <DateInput className="h-9 rounded-sm ring-white/5! bg-sidebar px-3 text-white/85 shadow-none t" />
        </TimeField>
      </div>
    </div>
  );
}
