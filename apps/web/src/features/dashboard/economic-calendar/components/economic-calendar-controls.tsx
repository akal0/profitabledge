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

import { getCurrencyLabel, startOfDay, endOfDay } from "../lib/economic-calendar-utils";
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
  quickRanges: Array<{ label: string; getRange: () => { start: Date; end: Date } }>;
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
        <div className="flex items-center">
          {(["month", "week", "day", "list"] as ViewMode[]).map((mode) => (
            <Button
              key={mode}
              className={cn(
                "h-9 rounded-none border border-white/5 px-3 text-xs",
                viewMode === mode
                  ? "bg-sidebar-accent text-white hover:bg-sidebar-accent"
                  : "bg-sidebar text-white/35 hover:bg-sidebar-accent hover:text-white"
              )}
              onClick={() => onViewModeChange(mode)}
            >
              {mode.toUpperCase()}
            </Button>
          ))}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-9 gap-2 rounded-none border border-white/5 bg-sidebar px-4 text-xs text-white/70 hover:bg-sidebar-accent">
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
                onCheckedChange={(checked) => onCurrencyFilterChange(currency, Boolean(checked))}
              >
                {getCurrencyLabel(currency)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-9 gap-2 rounded-none border border-white/5 bg-sidebar px-4 text-xs text-white/70 hover:bg-sidebar-accent">
              {impactFilter.length === 0 ? "All impact" : `Impact (${impactFilter.length})`}
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
                onCheckedChange={(checked) => onImpactFilterChange(impact, Boolean(checked))}
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
            buttonLabel="Download PNG"
            className="h-9 w-max gap-2 rounded-none border border-white/5 bg-sidebar px-4 text-xs text-white/70 hover:bg-sidebar-accent hover:text-white"
          />
        ) : null}
      </div>
    </div>
  );
}
