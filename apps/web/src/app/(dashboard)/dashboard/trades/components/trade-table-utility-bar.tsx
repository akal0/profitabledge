"use client";

import * as React from "react";
import {
  BookOpenText,
  LayoutGrid,
  List,
  Save,
  SlidersHorizontal,
  Star,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type {
  TradeFilterPreset,
  TradeSummaryMetricId,
} from "@/features/trades/table/hooks/use-trades-route-preferences";

const SUMMARY_METRIC_OPTIONS: Array<{
  id: TradeSummaryMetricId;
  label: string;
}> = [
  { id: "scope", label: "Scope" },
  { id: "trades", label: "Trades" },
  { id: "outcome", label: "Outcome" },
  { id: "grossPnl", label: "Gross P&L" },
  { id: "netPnl", label: "Net P&L" },
  { id: "winRate", label: "Win rate" },
  { id: "avgRR", label: "Avg RR" },
  { id: "profitFactor", label: "Profit factor" },
  { id: "expectancy", label: "Expectancy" },
  { id: "bestTrade", label: "Best trade" },
  { id: "worstTrade", label: "Worst trade" },
  { id: "streak", label: "Current streak" },
  { id: "volume", label: "Volume" },
];

const SHORTCUTS = [
  ["Arrow Up / Down", "Move focus between rows"],
  ["Enter", "Open the focused trade"],
  ["Space", "Toggle focused row selection"],
  ["Esc", "Clear selection"],
  ["Cmd/Ctrl + Shift + A", "Select visible rows"],
  ["Cmd/Ctrl + Shift + C", "Compare selected trades"],
  ["Cmd/Ctrl + C", "Copy selected trade IDs"],
  ["Cmd/Ctrl + E", "Export selected rows"],
];

type TradeTableUtilityBarProps = {
  filterPresets: TradeFilterPreset[];
  isMobile?: boolean;
  onApplyPreset: (preset: TradeFilterPreset) => void;
  onDeletePreset: (presetId: string) => void;
  onSavePreset: (name: string) => void;
  onSummaryMetricsChange: (metricIds: TradeSummaryMetricId[]) => void;
  onViewModeChange: (viewMode: "table" | "list") => void;
  summaryMetrics: TradeSummaryMetricId[];
  viewMode: "table" | "list";
};

export function TradeTableUtilityBar({
  filterPresets,
  isMobile,
  onApplyPreset,
  onDeletePreset,
  onSavePreset,
  onSummaryMetricsChange,
  onViewModeChange,
  summaryMetrics,
  viewMode,
}: TradeTableUtilityBarProps) {
  const [presetName, setPresetName] = React.useState("");

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-sm bg-muted/25 p-[3px] ring ring-white/5">
        {[
          { icon: LayoutGrid, label: "Table", value: "table" as const },
          { icon: List, label: "List", value: "list" as const },
        ].map((option) => (
          <Button
            key={option.value}
            type="button"
            className={cn(
              "h-8 rounded-sm px-3 text-xs",
              viewMode === option.value
                ? "bg-[#222225] text-white hover:bg-[#222225] ring ring-white/5"
                : "bg-transparent text-white/45 hover:bg-sidebar-accent hover:text-white"
            )}
            onClick={() => onViewModeChange(option.value)}
          >
            <option.icon className="mr-1.5 size-3.5" />
            {isMobile ? option.label : `${option.label} view`}
          </Button>
        ))}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button className="h-8 rounded-sm bg-sidebar px-3 text-xs text-white/70 hover:bg-sidebar-accent">
            <Star className="mr-1.5 size-3.5" />
            Presets
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[320px] border-white/5 bg-sidebar p-0">
          <div className="space-y-3 p-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-white/70">
                Filter presets
              </p>
              <p className="mt-1 text-xs text-white/45">
                Save and reuse named filter combinations.
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                value={presetName}
                placeholder="Preset name"
                className="h-8"
                onChange={(event) => setPresetName(event.target.value)}
              />
              <Button
                type="button"
                className="h-8 rounded-sm px-3 text-xs"
                disabled={!presetName.trim()}
                onClick={() => {
                  onSavePreset(presetName.trim());
                  setPresetName("");
                }}
              >
                <Save className="mr-1 size-3" />
                Save
              </Button>
            </div>
            <div className="space-y-2">
              {filterPresets.length ? (
                filterPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between gap-2 rounded-sm border border-white/5 bg-sidebar-accent/60 px-3 py-2"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-sm text-white/80"
                      onClick={() => onApplyPreset(preset)}
                    >
                      {preset.name}
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-7 rounded-sm px-2 text-white/45 hover:bg-sidebar hover:text-rose-300"
                      onClick={() => onDeletePreset(preset.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/45">No presets saved yet.</p>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button className="h-8 rounded-sm bg-sidebar px-3 text-xs text-white/70 hover:bg-sidebar-accent">
            <SlidersHorizontal className="mr-1.5 size-3.5" />
            Summary
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[280px] border-white/5 bg-sidebar p-4">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-white/70">
                Summary metrics
              </p>
              <p className="mt-1 text-xs text-white/45">
                Choose which metrics stay pinned in the summary bar.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {SUMMARY_METRIC_OPTIONS.map((metric) => {
                const checked = summaryMetrics.includes(metric.id);
                return (
                  <label
                    key={metric.id}
                    className="flex items-center gap-3 rounded-sm border border-white/5 px-3 py-2 text-sm text-white/75"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(nextChecked) => {
                        const nextMetrics = nextChecked
                          ? [...summaryMetrics, metric.id]
                          : summaryMetrics.filter((item) => item !== metric.id);
                        onSummaryMetricsChange(nextMetrics);
                      }}
                    />
                    {metric.label}
                  </label>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button className="h-8 rounded-sm bg-sidebar px-3 text-xs text-white/70 hover:bg-sidebar-accent">
            <BookOpenText className="mr-1.5 size-3.5" />
            Shortcuts
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[320px] border-white/5 bg-sidebar p-4">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-white/70">
                Keyboard shortcuts
              </p>
              <p className="mt-1 text-xs text-white/45">
                Faster navigation for the trades workspace.
              </p>
            </div>
            <div className="space-y-2">
              {SHORTCUTS.map(([shortcut, description]) => (
                <div
                  key={shortcut}
                  className="flex items-center justify-between gap-3 rounded-sm border border-white/5 px-3 py-2"
                >
                  <span className="text-xs text-white/55">{description}</span>
                  <span className="text-[11px] font-medium text-white/75">
                    {shortcut}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
