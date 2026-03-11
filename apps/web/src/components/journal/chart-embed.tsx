"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import type { ChartEmbedType, ChartEmbedConfig } from "./types";
import { EquityCurveChart } from "@/components/dashboard/charts/equity-curve";
import { DrawdownChart } from "@/components/dashboard/charts/drawdown-chart";
import { DailyNetBarChart } from "@/components/dashboard/charts/daily-net";
import { PerformanceWeekdayChart } from "@/components/dashboard/charts/performance-weekday";
import { PerformingAssetsBarChart } from "@/components/dashboard/charts/performing-assets";
import { PerformanceHeatmap } from "@/components/dashboard/charts/performance-heatmap";
import { StreakDistributionChart } from "@/components/dashboard/charts/streak-distribution";
import { RMultipleDistributionChart } from "@/components/dashboard/charts/r-multiple-distribution";
import { MAEMFEScatterChart } from "@/components/dashboard/charts/mae-mfe-scatter";
import { EntryExitTimeChart } from "@/components/dashboard/charts/entry-exit-time";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Trash2, Settings, Move, Maximize2 } from "lucide-react";

// Chart type metadata for display
const chartTypeInfo: Record<ChartEmbedType, { label: string; description: string }> = {
  "equity-curve": { label: "Equity Curve", description: "Account equity over time" },
  "drawdown": { label: "Drawdown", description: "Drawdown from peak equity" },
  "daily-net": { label: "Daily P&L", description: "Net profit/loss by day" },
  "performance-weekday": { label: "Performance by Day", description: "Breakdown by weekday" },
  "performing-assets": { label: "Asset Performance", description: "P&L by trading asset" },
  "performance-heatmap": { label: "Performance Heatmap", description: "Hour x Day grid" },
  "streak-distribution": { label: "Win/Loss Streaks", description: "Streak distribution" },
  "r-multiple-distribution": { label: "R-Multiple", description: "R-multiple distribution" },
  "mae-mfe-scatter": { label: "MAE/MFE Scatter", description: "Excursion analysis" },
  "entry-exit-time": { label: "Entry/Exit Time", description: "Timing analysis" },
};

interface ChartEmbedProps {
  chartType: ChartEmbedType;
  config?: ChartEmbedConfig;
  isEditing?: boolean;
  onDelete?: () => void;
  onConfigure?: () => void;
  className?: string;
}

export function ChartEmbed({
  chartType,
  config,
  isEditing = false,
  onDelete,
  onConfigure,
  className,
}: ChartEmbedProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { label } = chartTypeInfo[chartType] || { label: chartType };

  const accountId = config?.accountId;
  const height = config?.height || 300;

  const renderChart = () => {
    switch (chartType) {
      case "equity-curve":
        return <EquityCurveChart accountId={accountId} />;
      case "drawdown":
        return <DrawdownChart accountId={accountId} />;
      case "daily-net":
        return (
          <DailyNetBarChart
            accountId={accountId}
            ownerId={`journal-${chartType}`}
            comparisonMode={config?.showComparison ? undefined : "none"}
          />
        );
      case "performance-weekday":
        return (
          <PerformanceWeekdayChart
            accountId={accountId}
            ownerId={`journal-${chartType}`}
            comparisonMode={config?.showComparison ? undefined : "none"}
          />
        );
      case "performing-assets":
        return (
          <PerformingAssetsBarChart
            accountId={accountId}
            ownerId={`journal-${chartType}`}
          />
        );
      case "performance-heatmap":
        return <PerformanceHeatmap accountId={accountId} />;
      case "streak-distribution":
        return <StreakDistributionChart accountId={accountId} />;
      case "r-multiple-distribution":
        return <RMultipleDistributionChart accountId={accountId} />;
      case "mae-mfe-scatter":
        return <MAEMFEScatterChart accountId={accountId} />;
      case "entry-exit-time":
        return <EntryExitTimeChart accountId={accountId} />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-white/40">
            Unknown chart type: {chartType}
          </div>
        );
    }
  };

  return (
    <div
      className={cn(
        "relative my-4 bg-sidebar border border-white/5 p-1 group",
        isEditing && "ring-1 ring-teal-400/30",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 pb-0">
        {!config?.hideTitle && (
          <h3 className="text-sm font-medium text-white/50">
            {config?.title || label}
          </h3>
        )}
        
        {/* Edit controls */}
        {isEditing && isHovered && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-white/40 hover:text-white hover:bg-white/10"
              onClick={onConfigure}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-white/40 hover:text-white hover:bg-white/10"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-sidebar border-white/10">
                <DropdownMenuItem className="text-white/80 focus:text-white focus:bg-white/10">
                  <Maximize2 className="h-4 w-4 mr-2" />
                  Expand
                </DropdownMenuItem>
                <DropdownMenuItem className="text-white/80 focus:text-white focus:bg-white/10">
                  <Move className="h-4 w-4 mr-2" />
                  Move
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem
                  className="text-red-400 focus:text-red-400 focus:bg-red-400/10"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Chart container */}
      <div
        className="p-3"
        style={{ height }}
      >
        {renderChart()}
      </div>
    </div>
  );
}

// ============================================================================
// Chart Selector Dialog
// ============================================================================

interface ChartSelectorProps {
  onSelect: (chartType: ChartEmbedType) => void;
  className?: string;
}

export function ChartSelector({ onSelect, className }: ChartSelectorProps) {
  const chartTypes = Object.entries(chartTypeInfo) as [ChartEmbedType, typeof chartTypeInfo[ChartEmbedType]][];

  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      {chartTypes.map(([type, info]) => (
        <button
          key={type}
          onClick={() => onSelect(type)}
          className="flex flex-col items-start p-3 bg-sidebar-accent hover:bg-white/10 border border-white/5 transition-colors text-left"
        >
          <span className="text-sm font-medium text-white">{info.label}</span>
          <span className="text-xs text-white/40">{info.description}</span>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Inline Chart Picker for Slash Commands
// ============================================================================

interface ChartPickerMenuProps {
  isOpen: boolean;
  position: { top: number; left: number };
  onSelect: (chartType: ChartEmbedType) => void;
  onClose: () => void;
}

export function ChartPickerMenu({
  isOpen,
  position,
  onSelect,
  onClose,
}: ChartPickerMenuProps) {
  if (!isOpen) return null;

  const chartTypes = Object.entries(chartTypeInfo) as [ChartEmbedType, typeof chartTypeInfo[ChartEmbedType]][];

  return (
    <div
      className="fixed z-50 w-64 max-h-80 overflow-y-auto bg-sidebar border border-white/10 shadow-xl"
      style={{ top: position.top, left: position.left }}
    >
      <div className="p-2 border-b border-white/10">
        <span className="text-xs font-medium text-white/40 uppercase">Select Chart</span>
      </div>
      <div className="p-1">
        {chartTypes.map(([type, info]) => (
          <button
            key={type}
            onClick={() => {
              onSelect(type);
              onClose();
            }}
            className="w-full flex flex-col items-start p-2 hover:bg-white/5 transition-colors text-left"
          >
            <span className="text-sm font-medium text-white">{info.label}</span>
            <span className="text-xs text-white/40">{info.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
