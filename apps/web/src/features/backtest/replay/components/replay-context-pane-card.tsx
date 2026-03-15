"use client";

import type React from "react";
import { GripVertical, X } from "lucide-react";

import { TradingViewChart } from "@/components/charts/trading-view-chart";
import {
  type ContextPaneSeriesItem,
} from "@/features/backtest/replay/lib/replay-domain";
import { getContextPaneModeLabel } from "@/features/backtest/replay/lib/replay-utils";
import { cn } from "@/lib/utils";

type ReplayContextPaneCardProps = {
  pane: ContextPaneSeriesItem;
  draggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onCycleMode: (timeframe: ContextPaneSeriesItem["timeframe"]) => void;
  onClose: (timeframe: ContextPaneSeriesItem["timeframe"]) => void;
  className?: string;
  chartContainerClassName?: string;
  chartClassName?: string;
  chartHeight?: number;
};

export function ReplayContextPaneCard({
  pane,
  draggable = false,
  isDragging = false,
  onDragStart,
  onCycleMode,
  onClose,
  className,
  chartContainerClassName,
  chartClassName,
  chartHeight,
}: ReplayContextPaneCardProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/5 bg-sidebar/90 shadow-[0_12px_40px_rgba(0,0,0,0.2)] backdrop-blur",
        className
      )}
    >
      <div
        onPointerDown={onDragStart}
        className={cn(
          "flex items-center justify-between border-b border-white/5 px-3 py-2 text-[11px] text-white/55",
          draggable && "touch-none",
          draggable && (isDragging ? "cursor-grabbing" : "cursor-grab")
        )}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">{pane.label} context</span>
          {draggable ? <GripVertical className="size-3.5 text-white/35" /> : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onCycleMode(pane.timeframe)}
            className="inline-flex h-6 items-center rounded-md border border-white/5 bg-sidebar-accent/60 px-2 text-[10px] font-medium text-white/70 transition hover:bg-sidebar-accent hover:text-white"
          >
            {getContextPaneModeLabel(pane.mode)}
          </button>
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onClose(pane.timeframe)}
            className="inline-flex size-6 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent/60 text-white/60 transition hover:bg-sidebar-accent hover:text-white"
            aria-label={`Close ${pane.label} context`}
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      <div className={cn("min-h-0", chartContainerClassName)}>
        <TradingViewChart
          data={pane.candles}
          theme="dark"
          showVolume={false}
          fitContent
          autosize
          height={chartHeight ?? 130}
          className={chartClassName ?? "h-[130px] w-full"}
        />
      </div>
    </div>
  );
}
