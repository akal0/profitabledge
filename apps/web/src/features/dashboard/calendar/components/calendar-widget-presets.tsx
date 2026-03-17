"use client";

import { Check, LayoutGrid } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  toolbarFilterMenuContentClass,
  toolbarFilterMenuItemClass,
  toolbarFilterMenuMainSeparatorClass,
  toolbarFilterMenuSectionTitleClass,
} from "@/components/ui/filter-menu-styles";
import { cn } from "@/lib/utils";

import type { CalendarWidgetType } from "../lib/calendar-types";

export type CalendarWidgetPreset = {
  id: string;
  name: string;
  description: string;
  widgets: CalendarWidgetType[];
  spans: Partial<Record<CalendarWidgetType, number>>;
};

const builtInPresets: CalendarWidgetPreset[] = [
  {
    id: "overview",
    name: "Overview",
    description: "Balanced month summary across performance, risk, and trade quality.",
    widgets: [
      "net-pl",
      "win-rate",
      "largest-trade",
      "largest-loss",
      "hold-time",
      "avg-trade",
    ],
    spans: {},
  },
  {
    id: "weekly-review",
    name: "Weekly review",
    description: "Fills the sidebar with separate Week 1, Week 2, and later week P/L cards plus the month total.",
    widgets: ["weekly-breakdown", "net-pl"],
    spans: {},
  },
  {
    id: "trading-rhythm",
    name: "Trading rhythm",
    description: "Focuses on how often you traded, what an active day looked like, and your pacing.",
    widgets: [
      "active-days",
      "avg-active-day",
      "hold-time",
      "avg-trade",
      "best-day",
      "worst-day",
    ],
    spans: {},
  },
  {
    id: "highlights",
    name: "Highlights",
    description: "Surfaces standout days and trades for a quicker end-of-month scan.",
    widgets: [
      "net-pl",
      "best-day",
      "worst-day",
      "largest-trade",
      "largest-loss",
      "win-rate",
    ],
    spans: {},
  },
];

function normalizeSpan(
  spans: Partial<Record<CalendarWidgetType, number>>,
  widget: CalendarWidgetType
) {
  const raw = Number(spans[widget] ?? 1);
  return Math.max(1, Math.min(2, Math.round(Number.isFinite(raw) ? raw : 1)));
}

function matchesPreset(
  currentWidgets: CalendarWidgetType[],
  currentSpans: Partial<Record<CalendarWidgetType, number>>,
  preset: CalendarWidgetPreset
) {
  if (currentWidgets.length !== preset.widgets.length) {
    return false;
  }

  return preset.widgets.every((widget, index) => {
    return (
      currentWidgets[index] === widget &&
      normalizeSpan(currentSpans, widget) === normalizeSpan(preset.spans, widget)
    );
  });
}

export function CalendarWidgetPresets({
  currentWidgets,
  currentSpans,
  onApplyPreset,
  className,
}: {
  currentWidgets: CalendarWidgetType[];
  currentSpans: Partial<Record<CalendarWidgetType, number>>;
  onApplyPreset: (
    widgets: CalendarWidgetType[],
    spans: Partial<Record<CalendarWidgetType, number>>
  ) => void | Promise<void>;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild data-widget-share-ignore="true">
        <Button
          className={cn(
            "flex h-[38px] w-max items-center justify-center gap-2 rounded-md ring ring-white/5 bg-sidebar px-3 py-2 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110",
            className
          )}
          data-widget-share-ignore="true"
        >
          <LayoutGrid className="size-3.5" />
          <span>Customize widgets</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(toolbarFilterMenuContentClass, "w-80")}
      >
        <div className={toolbarFilterMenuSectionTitleClass}>
          Built-in widget presets
        </div>
        <DropdownMenuSeparator className={toolbarFilterMenuMainSeparatorClass} />
        {builtInPresets.map((preset, index) => {
          const active = matchesPreset(currentWidgets, currentSpans, preset);
          return (
            <div key={preset.id}>
              <DropdownMenuItem
                className={cn(
                  toolbarFilterMenuItemClass,
                  "flex cursor-pointer flex-col items-start gap-1.5 rounded-sm py-3"
                )}
                onClick={() => onApplyPreset(preset.widgets, preset.spans)}
              >
                <div className="flex w-full items-center gap-2">
                  <span className="text-sm text-white/85">{preset.name}</span>
                  {active ? (
                    <Check className="ml-auto size-4 text-teal-400" />
                  ) : null}
                </div>
                <span className="text-[11px] leading-relaxed text-white/45">
                  {preset.description}
                </span>
              </DropdownMenuItem>
              {index < builtInPresets.length - 1 ? (
                <DropdownMenuSeparator
                  className={toolbarFilterMenuMainSeparatorClass}
                />
              ) : null}
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
