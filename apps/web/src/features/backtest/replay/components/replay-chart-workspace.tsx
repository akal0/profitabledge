"use client";

import type React from "react";
import { Loader2 } from "lucide-react";

import { ReplayContextPaneCard } from "@/features/backtest/replay/components/replay-context-pane-card";
import {
  type BacktestTimeframe,
  type ContextDockSlot,
  type ContextPaneSeriesItem,
} from "@/features/backtest/replay/lib/replay-domain";
import { cn } from "@/lib/utils";

type ReplayChartWorkspaceProps = {
  isLoadingCandles: boolean;
  chartWorkspaceRef: React.RefObject<HTMLDivElement | null>;
  showSplitContextPanes: boolean;
  mainChartPane: React.ReactNode;
  dockedTopPane: ContextPaneSeriesItem | undefined;
  dockedLeftTopPane: ContextPaneSeriesItem | undefined;
  dockedLeftBottomPane: ContextPaneSeriesItem | undefined;
  dockedBottomPane: ContextPaneSeriesItem | undefined;
  dockedRightTopPane: ContextPaneSeriesItem | undefined;
  dockedRightBottomPane: ContextPaneSeriesItem | undefined;
  dockTrayPanes: ContextPaneSeriesItem[];
  draggingDockContextTimeframe: BacktestTimeframe | null;
  onContextDockDragStart: (
    timeframe: BacktestTimeframe,
    event: React.PointerEvent<HTMLDivElement>
  ) => void;
  onCycleContextPaneMode: (timeframe: BacktestTimeframe) => void;
  onCloseContextTimeframe: (timeframe: BacktestTimeframe) => void;
  showContextDockTargets: boolean;
  activeContextDockTarget: ContextDockSlot | null;
  dockTargetRefs: React.MutableRefObject<
    Partial<Record<ContextDockSlot, HTMLDivElement | null>>
  >;
};

export function ReplayChartWorkspace({
  isLoadingCandles,
  chartWorkspaceRef,
  showSplitContextPanes,
  mainChartPane,
  dockedTopPane,
  dockedLeftTopPane,
  dockedLeftBottomPane,
  dockedBottomPane,
  dockedRightTopPane,
  dockedRightBottomPane,
  dockTrayPanes,
  draggingDockContextTimeframe,
  onContextDockDragStart,
  onCycleContextPaneMode,
  onCloseContextTimeframe,
  showContextDockTargets,
  activeContextDockTarget,
  dockTargetRefs,
}: ReplayChartWorkspaceProps) {
  const renderDockPane = (
    pane: ContextPaneSeriesItem,
    options?: {
      className?: string;
      chartContainerClassName?: string;
      chartClassName?: string;
      chartHeight?: number;
    }
  ) => (
    <ReplayContextPaneCard
      pane={pane}
      draggable
      isDragging={draggingDockContextTimeframe === pane.timeframe}
      onDragStart={(event) => onContextDockDragStart(pane.timeframe, event)}
      onCycleMode={onCycleContextPaneMode}
      onClose={onCloseContextTimeframe}
      className={options?.className}
      chartContainerClassName={options?.chartContainerClassName}
      chartClassName={options?.chartClassName}
      chartHeight={options?.chartHeight}
    />
  );

  const dockTargetClass = (slot: ContextDockSlot) =>
    cn(
      "rounded-[22px] border border-dashed border-white/10 bg-sidebar/25 backdrop-blur-sm transition",
      activeContextDockTarget === slot && "border-teal-300 bg-teal-400/18"
    );

  return isLoadingCandles ? (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <Loader2 className="size-8 animate-spin text-white/35" />
      <p className="text-sm text-white/45">Loading historical data from Dukascopy...</p>
    </div>
  ) : (
    <div
      ref={chartWorkspaceRef}
      className={cn("relative h-full min-h-0", showSplitContextPanes && "p-2")}
    >
      {showSplitContextPanes ? (
        <>
          <div className="flex h-full min-h-0 flex-col gap-2">
            {dockedTopPane ? (
              <div className="h-[22%] min-h-[150px] shrink-0">
                {renderDockPane(dockedTopPane, {
                  className: "h-full",
                  chartContainerClassName: "min-h-0 flex-1",
                  chartClassName: "h-full w-full",
                  chartHeight: 0,
                })}
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1 gap-2">
              {dockedLeftTopPane || dockedLeftBottomPane ? (
                <div className="flex min-h-0 w-[24%] min-w-[240px] shrink-0 flex-col gap-2">
                  {dockedLeftTopPane ? (
                    <div className="min-h-0 flex-1">
                      {renderDockPane(dockedLeftTopPane, {
                        className: "h-full",
                        chartContainerClassName: "min-h-0 flex-1",
                        chartClassName: "h-full w-full",
                        chartHeight: 0,
                      })}
                    </div>
                  ) : null}
                  {dockedLeftBottomPane ? (
                    <div className="min-h-0 flex-1">
                      {renderDockPane(dockedLeftBottomPane, {
                        className: "h-full",
                        chartContainerClassName: "min-h-0 flex-1",
                        chartClassName: "h-full w-full",
                        chartHeight: 0,
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {mainChartPane}

              {dockedRightTopPane || dockedRightBottomPane ? (
                <div className="flex min-h-0 w-[28%] min-w-[250px] shrink-0 flex-col gap-2">
                  {dockedRightTopPane ? (
                    <div className="min-h-0 flex-1">
                      {renderDockPane(dockedRightTopPane, {
                        className: "h-full",
                        chartContainerClassName: "min-h-0 flex-1",
                        chartClassName: "h-full w-full",
                        chartHeight: 0,
                      })}
                    </div>
                  ) : null}
                  {dockedRightBottomPane ? (
                    <div className="min-h-0 flex-1">
                      {renderDockPane(dockedRightBottomPane, {
                        className: "h-full",
                        chartContainerClassName: "min-h-0 flex-1",
                        chartClassName: "h-full w-full",
                        chartHeight: 0,
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {dockedBottomPane ? (
              <div className="h-[22%] min-h-[150px] shrink-0">
                {renderDockPane(dockedBottomPane, {
                  className: "h-full",
                  chartContainerClassName: "min-h-0 flex-1",
                  chartClassName: "h-full w-full",
                  chartHeight: 0,
                })}
              </div>
            ) : null}
          </div>

          {dockTrayPanes.length ? (
            <div className="pointer-events-none absolute bottom-4 right-4 z-30 flex max-h-[50%] w-[260px] flex-col gap-2 overflow-y-auto">
              {dockTrayPanes.map((pane) => (
                <div key={pane.timeframe} className="pointer-events-auto">
                  {renderDockPane(pane, { className: "w-full" })}
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex h-full min-h-0">{mainChartPane}</div>
      )}

      {showContextDockTargets ? (
        <div className="pointer-events-none absolute inset-2 z-40 flex flex-col gap-2">
          <div
            ref={(node) => {
              dockTargetRefs.current.top = node;
            }}
            className={cn("h-[22%] min-h-[150px]", dockTargetClass("top"))}
          >
            <div className="flex h-full items-center justify-center text-sm text-white/55">
              Full top
            </div>
          </div>
          <div className="flex min-h-0 flex-1 gap-2">
            <div className="flex min-h-0 w-[24%] min-w-[240px] shrink-0 flex-col gap-2">
              <div
                ref={(node) => {
                  dockTargetRefs.current["left-top"] = node;
                }}
                className={cn("min-h-0 flex-1", dockTargetClass("left-top"))}
              >
                <div className="flex h-full items-center justify-center text-sm text-white/55">
                  Top left
                </div>
              </div>
              <div
                ref={(node) => {
                  dockTargetRefs.current["left-bottom"] = node;
                }}
                className={cn("min-h-0 flex-1", dockTargetClass("left-bottom"))}
              >
                <div className="flex h-full items-center justify-center text-sm text-white/55">
                  Bottom left
                </div>
              </div>
            </div>
            <div className="min-w-0 flex-1" />
            <div className="flex min-h-0 w-[28%] min-w-[250px] shrink-0 flex-col gap-2">
              <div
                ref={(node) => {
                  dockTargetRefs.current["right-top"] = node;
                }}
                className={cn("min-h-0 flex-1", dockTargetClass("right-top"))}
              >
                <div className="flex h-full items-center justify-center text-sm text-white/55">
                  Top right
                </div>
              </div>
              <div
                ref={(node) => {
                  dockTargetRefs.current["right-bottom"] = node;
                }}
                className={cn("min-h-0 flex-1", dockTargetClass("right-bottom"))}
              >
                <div className="flex h-full items-center justify-center text-sm text-white/55">
                  Bottom right
                </div>
              </div>
            </div>
          </div>
          <div
            ref={(node) => {
              dockTargetRefs.current.bottom = node;
            }}
            className={cn("h-[22%] min-h-[150px]", dockTargetClass("bottom"))}
          >
            <div className="flex h-full items-center justify-center text-sm text-white/55">
              Full bottom
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
