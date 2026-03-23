"use client";

import type { RefObject } from "react";
import { ChevronDown } from "lucide-react";

import PickerComponent from "@/components/dashboard/calendar/picker";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { WidgetShareButton } from "@/features/dashboard/widgets/components/widget-share-button";

import {
  getCurrencyLabel,
  startOfDay,
  endOfDay,
} from "../lib/economic-calendar-utils";
import {
  type ImpactLevel,
  type ViewMode,
} from "../lib/economic-calendar-types";

type EconomicCalendarControlsProps = {
  bounds: { min: Date; max: Date };
  range: { start: Date; end: Date } | null;
  viewMode: ViewMode;
  currencies: string[];
  currencyFilter: string[];
  impacts: ImpactLevel[];
  impactFilter: ImpactLevel[];
  quickRanges: Array<{
    label: string;
    getRange: () => { start: Date; end: Date };
  }>;
  exportTargetRef?: RefObject<HTMLElement | null>;
  onRangeChange: (range: { start: Date; end: Date }) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onCurrencyFilterChange: (currency: string, checked: boolean) => void;
  onImpactFilterChange: (impact: ImpactLevel, checked: boolean) => void;
};

export function EconomicCalendarControls({
  bounds,
  range,
  viewMode,
  currencies,
  currencyFilter,
  impacts,
  impactFilter,
  quickRanges,
  exportTargetRef,
  onRangeChange,
  onViewModeChange,
  onCurrencyFilterChange,
  onImpactFilterChange,
}: EconomicCalendarControlsProps) {
  const toolbarActionButtonClassName =
    "cursor-pointer flex items-center justify-center gap-2 py-2 h-[38px] transition-all active:scale-95 text-white w-max text-xs hover:brightness-110 duration-250 ring ring-white/5 bg-sidebar rounded-md hover:bg-sidebar-accent px-3";
  const segmentedControlClassName =
    "flex h-max w-max items-center gap-1 rounded-md bg-white p-[3px] dark:bg-muted/15 ring ring-white/5";
  const segmentedButtonClassName = (active: boolean) =>
    cn(
      "cursor-pointer flex h-max w-max items-center justify-center gap-2 rounded-md px-3 py-2 text-xs transition-all duration-250 active:scale-95",
      active
        ? "bg-[#222225] text-white hover:bg-[#222225] hover:!brightness-120 ring ring-white/5"
        : "bg-[#222225]/25 text-white/25 hover:bg-[#222225] hover:!brightness-105 hover:text-white ring-0"
    );

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-secondary dark:text-neutral-100">
          Economic calendar
        </h2>
        <p className="text-xs text-secondary/70 dark:text-neutral-400">
          Macro releases and market-moving events.
        </p>
      </div>

      <div
        className="flex flex-wrap items-center gap-2"
        data-widget-share-ignore="true"
      >
        {range ? (
          <PickerComponent
            defaultStart={range.start}
            defaultEnd={range.end}
            minDate={bounds.min}
            maxDate={bounds.max}
            valueStart={range.start}
            valueEnd={range.end}
            onRangeChange={(start, end) =>
              onRangeChange({ start: startOfDay(start), end: endOfDay(end) })
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
        <div className={segmentedControlClassName}>
          {(["month", "week", "day", "list"] as ViewMode[]).map(
            (mode) => (
              <Button
                key={mode}
                className={segmentedButtonClassName(viewMode === mode)}
                onClick={() => onViewModeChange(mode)}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Button>
            )
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className={cn(toolbarActionButtonClassName, "text-white/70")}
            >
              {currencyFilter.length === 0
                ? "All currencies"
                : `Currencies (${currencyFilter.length})`}
              <ChevronDown className="size-3.5 text-white/60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-64 w-[220px] overflow-auto rounded-none border border-white/5 bg-sidebar p-1">
            {currencies.map((currency) => (
              <DropdownMenuCheckboxItem
                key={currency}
                className="px-4 py-2.5"
                checked={currencyFilter.includes(currency)}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(checked) =>
                  onCurrencyFilterChange(currency, Boolean(checked))
                }
              >
                {getCurrencyLabel(currency)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className={cn(toolbarActionButtonClassName, "text-white/70")}
            >
              {impactFilter.length === 0
                ? "All impact"
                : `Impact (${impactFilter.length})`}
              <ChevronDown className="size-3.5 text-white/60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[200px] rounded-none border border-white/5 bg-sidebar p-1">
            {impacts.map((impact) => (
              <DropdownMenuCheckboxItem
                key={impact}
                className="px-4 py-2.5"
                checked={impactFilter.includes(impact)}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(checked) =>
                  onImpactFilterChange(impact, Boolean(checked))
                }
              >
                {impact}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {exportTargetRef ? (
          <WidgetShareButton
            targetRef={exportTargetRef}
            title="Economic calendar"
            successMessage="Economic calendar PNG downloaded"
            errorMessage="Failed to export economic calendar PNG"
            buttonLabel="Share"
            className={cn(toolbarActionButtonClassName, "text-white/70")}
          />
        ) : null}
      </div>
    </div>
  );
}
