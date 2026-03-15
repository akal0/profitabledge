"use client";

import type React from "react";
import { format } from "date-fns";
import type { Time } from "lightweight-charts";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  GripVertical,
  MessageSquare,
  Minus,
  MousePointer2,
  MoveRight,
  Pause,
  Play,
  Ruler,
  SkipBack,
  SkipForward,
  Slash,
  Square,
  Target,
  Trash2,
} from "lucide-react";

import {
  TradingViewChart,
  type AnnotationTool,
  type CandleData,
  type ChartAnnotation,
  type ExecutionOverlay,
  type ExecutionOverlayLevelKey,
  type IndicatorLine,
  type PriceLine,
  type TradeMarker,
} from "@/components/charts/trading-view-chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CandleScrubber } from "@/features/backtest/replay/components/candle-scrubber";
import { ReplayContextPaneCard } from "@/features/backtest/replay/components/replay-context-pane-card";
import {
  DrawingToolButton,
  PlaybackButton,
} from "@/features/backtest/replay/components/replay-primitives";
import {
  DEFAULT_FAVORITE_TOOLS_BAR_OFFSET,
  PLAYBACK_SPEEDS,
  type BacktestTimeframe,
  type BacktestTrade,
  type ContextPanePosition,
  type ContextPaneSeriesItem,
  type FavoriteToolsBarOffset,
} from "@/features/backtest/replay/lib/replay-domain";
import {
  formatPrice,
  formatSignedPrice,
  getDefaultContextPanePosition,
} from "@/features/backtest/replay/lib/replay-utils";
import { cn } from "@/lib/utils";

type ReplayMainChartPaneProps = {
  symbol: string;
  symbolDisplayName: string;
  timeframeCompactLabel: string;
  showSplitContextPanes: boolean;
  currentCandle: CandleData | null;
  currentTimeUnix: number;
  currentCandleDelta: number;
  currentCandleDeltaPct: number;
  priceDecimals: number;
  chartOrderSide: "long" | "short" | null;
  entryMode: "market" | "limit" | "stop" | "stop-limit";
  showDrawingRail: boolean;
  annotationTool: AnnotationTool;
  onAnnotationToolChange: (tool: AnnotationTool) => void;
  onClearAnnotations: () => void;
  annotationCount: number;
  showFavoriteToolsBar: boolean;
  favoriteToolsBarOffset: FavoriteToolsBarOffset;
  favoriteToolsBarRef: React.RefObject<HTMLDivElement | null>;
  onFavoriteToolsBarDragStart: (event: React.PointerEvent<HTMLDivElement>) => void;
  isDraggingFavoriteToolsBar: boolean;
  drawingToolLabel: string;
  annotationColor: string;
  onAnnotationColorChange: (value: string) => void;
  annotationLabel: string;
  onAnnotationLabelChange: (value: string) => void;
  showFloatingContextPanes: boolean;
  contextPaneSeries: ContextPaneSeriesItem[];
  contextPanePositions: Partial<Record<BacktestTimeframe, ContextPanePosition>>;
  draggingContextPane: BacktestTimeframe | null;
  onContextPanePointerDown: (
    timeframe: BacktestTimeframe,
    index: number,
    event: React.PointerEvent<HTMLDivElement>
  ) => void;
  onCycleContextPaneMode: (timeframe: BacktestTimeframe) => void;
  onCloseContextTimeframe: (timeframe: BacktestTimeframe) => void;
  visibleCandles: CandleData[];
  markers: TradeMarker[];
  priceLines: PriceLine[];
  indicatorLines: IndicatorLine[];
  executionOverlays: ExecutionOverlay[];
  annotations: ChartAnnotation[];
  selectedAnnotationId: string | null;
  selectedExecutionOverlayId: string | null;
  onSelectedAnnotationChange: (id: string | null) => void;
  onSelectedExecutionOverlayChange: (id: string | null) => void;
  onAnnotationsChange: (annotations: ChartAnnotation[]) => void;
  onExecutionOverlayChange: (
    overlayId: string,
    levelKey: ExecutionOverlayLevelKey,
    price: number
  ) => void;
  onExecutionOverlayCommit: (
    overlayId: string,
    levelKey: ExecutionOverlayLevelKey,
    price: number
  ) => void;
  onChartClick: (point: { time: Time; price: number }) => void;
  allCandles: CandleData[];
  trades: BacktestTrade[];
  currentIndex: number;
  onSeekReplay: (index: number) => void;
  isPlaying: boolean;
  onStepReplay: (step: number) => void;
  onPlayPause: () => void;
  onRestart: () => void;
  playbackSpeed: number;
  onPlaybackSpeedChange: (value: number) => void;
};

export function ReplayMainChartPane({
  symbol,
  symbolDisplayName,
  timeframeCompactLabel,
  showSplitContextPanes,
  currentCandle,
  currentTimeUnix,
  currentCandleDelta,
  currentCandleDeltaPct,
  priceDecimals,
  chartOrderSide,
  entryMode,
  showDrawingRail,
  annotationTool,
  onAnnotationToolChange,
  onClearAnnotations,
  annotationCount,
  showFavoriteToolsBar,
  favoriteToolsBarOffset,
  favoriteToolsBarRef,
  onFavoriteToolsBarDragStart,
  isDraggingFavoriteToolsBar,
  drawingToolLabel,
  annotationColor,
  onAnnotationColorChange,
  annotationLabel,
  onAnnotationLabelChange,
  showFloatingContextPanes,
  contextPaneSeries,
  contextPanePositions,
  draggingContextPane,
  onContextPanePointerDown,
  onCycleContextPaneMode,
  onCloseContextTimeframe,
  visibleCandles,
  markers,
  priceLines,
  indicatorLines,
  executionOverlays,
  annotations,
  selectedAnnotationId,
  selectedExecutionOverlayId,
  onSelectedAnnotationChange,
  onSelectedExecutionOverlayChange,
  onAnnotationsChange,
  onExecutionOverlayChange,
  onExecutionOverlayCommit,
  onChartClick,
  allCandles,
  trades,
  currentIndex,
  onSeekReplay,
  isPlaying,
  onStepReplay,
  onPlayPause,
  onRestart,
  playbackSpeed,
  onPlaybackSpeedChange,
}: ReplayMainChartPaneProps) {
  return (
    <div
      className={cn(
        "relative min-h-0 min-w-0 flex-1 overflow-hidden",
        showSplitContextPanes && "rounded-[24px] border border-white/5 bg-background"
      )}
    >
      <div className="pointer-events-none absolute left-16 top-3 z-20 max-w-[min(820px,calc(100%-18rem))] text-sm text-white/55">
        <div className="rounded-2xl border border-white/5 bg-sidebar/95 px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-white">{symbolDisplayName}</span>
            <span>·</span>
            <span>{timeframeCompactLabel}</span>
            <span>·</span>
            <span className="text-white/35">Replay feed</span>
            <span
              className={cn(
                "font-medium",
                currentCandleDelta >= 0 ? "text-teal-300" : "text-rose-300"
              )}
            >
              {formatSignedPrice(currentCandleDelta, priceDecimals)} (
              {currentCandleDeltaPct >= 0 ? "+" : ""}
              {currentCandleDeltaPct.toFixed(2)}%)
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span>O {currentCandle ? formatPrice(symbol, currentCandle.open) : "0.00000"}</span>
            <span>H {currentCandle ? formatPrice(symbol, currentCandle.high) : "0.00000"}</span>
            <span>L {currentCandle ? formatPrice(symbol, currentCandle.low) : "0.00000"}</span>
            <span>C {currentCandle ? formatPrice(symbol, currentCandle.close) : "0.00000"}</span>
          </div>
        </div>
      </div>

      {chartOrderSide ? (
        <div className="pointer-events-none absolute right-5 top-4 z-20">
          <div className="rounded-2xl border border-white/5 bg-sidebar/95 px-3 py-2 text-xs text-white/70 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur">
            Chart {chartOrderSide === "long" ? "buy" : "sell"} armed. Click a price level to place a{" "}
            {entryMode === "market" ? "pending" : entryMode} order.
          </div>
        </div>
      ) : null}

      {showDrawingRail ? (
        <div className="pointer-events-none absolute left-2 top-1/2 z-30 flex max-h-[calc(100%-2rem)] w-11 -translate-y-1/2 items-center rounded-full border border-white/5 bg-sidebar/95 p-1 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur">
          <div className="pointer-events-auto flex max-h-[calc(100vh-14rem)] w-full flex-col items-center overflow-y-auto">
            <DrawingToolButton
              icon={MousePointer2}
              label="Select"
              active={annotationTool === "none"}
              onClick={() => onAnnotationToolChange("none")}
            />
            <DrawingToolButton
              icon={Slash}
              label="Trend line"
              active={annotationTool === "trendline"}
              onClick={() => onAnnotationToolChange("trendline")}
            />
            <DrawingToolButton
              icon={Slash}
              label="Extended line"
              active={annotationTool === "extended"}
              onClick={() => onAnnotationToolChange("extended")}
            />
            <DrawingToolButton
              icon={ArrowUpRight}
              label="Ray"
              active={annotationTool === "ray"}
              onClick={() => onAnnotationToolChange("ray")}
            />
            <DrawingToolButton
              icon={MoveRight}
              label="Arrow"
              active={annotationTool === "arrow"}
              onClick={() => onAnnotationToolChange("arrow")}
            />
            <DrawingToolButton
              icon={Target}
              label="Fib"
              active={annotationTool === "fib"}
              onClick={() => onAnnotationToolChange("fib")}
            />
            <DrawingToolButton
              icon={Target}
              label="Anchored VWAP"
              active={annotationTool === "anchored-vwap"}
              onClick={() => onAnnotationToolChange("anchored-vwap")}
            />
            <DrawingToolButton
              icon={Square}
              label="Zone"
              active={annotationTool === "rectangle"}
              onClick={() => onAnnotationToolChange("rectangle")}
            />
            <DrawingToolButton
              icon={Ruler}
              label="Measure"
              active={annotationTool === "measure"}
              onClick={() => onAnnotationToolChange("measure")}
            />
            <DrawingToolButton
              icon={Minus}
              label="Horizontal"
              active={annotationTool === "horizontal"}
              onClick={() => onAnnotationToolChange("horizontal")}
            />
            <DrawingToolButton
              icon={Clock3}
              label="Vertical"
              active={annotationTool === "vertical"}
              onClick={() => onAnnotationToolChange("vertical")}
            />
            <DrawingToolButton
              icon={MessageSquare}
              label="Note"
              active={annotationTool === "note"}
              onClick={() => onAnnotationToolChange("note")}
            />
            <div className="mt-1 flex w-full justify-center border-t border-white/5 pt-1">
              <DrawingToolButton
                icon={Trash2}
                label="Clear markup"
                active={false}
                onClick={onClearAnnotations}
                disabled={annotationCount === 0}
              />
            </div>
          </div>
        </div>
      ) : null}

      {showFavoriteToolsBar ? (
        <div
          className="pointer-events-none absolute left-1/2 top-3 z-30"
          style={{
            transform: `translate(calc(-50% + ${favoriteToolsBarOffset.x}px), ${favoriteToolsBarOffset.y}px)`,
          }}
        >
          <div
            ref={favoriteToolsBarRef}
            onPointerDown={onFavoriteToolsBarDragStart}
            className={cn(
              "pointer-events-auto flex max-w-[min(1100px,calc(100vw-10rem))] items-center gap-1 overflow-x-auto rounded-full border border-white/5 bg-sidebar/95 p-1 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur touch-none",
              isDraggingFavoriteToolsBar ? "cursor-grabbing" : "cursor-grab"
            )}
          >
            <div
              className="flex h-9 shrink-0 items-center justify-center rounded-full border border-white/5 bg-sidebar-accent px-2 text-white/45"
              aria-label="Drag favorite tools bar"
              title="Drag favorite tools bar"
            >
              <GripVertical className="size-3.5" />
            </div>
            <DrawingToolButton
              icon={Slash}
              label="Trend line"
              active={annotationTool === "trendline"}
              onClick={() => onAnnotationToolChange("trendline")}
            />
            <DrawingToolButton
              icon={Slash}
              label="Extended line"
              active={annotationTool === "extended"}
              onClick={() => onAnnotationToolChange("extended")}
            />
            <DrawingToolButton
              icon={ArrowUpRight}
              label="Ray"
              active={annotationTool === "ray"}
              onClick={() => onAnnotationToolChange("ray")}
            />
            <DrawingToolButton
              icon={MoveRight}
              label="Arrow"
              active={annotationTool === "arrow"}
              onClick={() => onAnnotationToolChange("arrow")}
            />
            <DrawingToolButton
              icon={Target}
              label="Fib"
              active={annotationTool === "fib"}
              onClick={() => onAnnotationToolChange("fib")}
            />
            <DrawingToolButton
              icon={Target}
              label="Anchored VWAP"
              active={annotationTool === "anchored-vwap"}
              onClick={() => onAnnotationToolChange("anchored-vwap")}
            />
            <DrawingToolButton
              icon={Square}
              label="Zone"
              active={annotationTool === "rectangle"}
              onClick={() => onAnnotationToolChange("rectangle")}
            />
            <DrawingToolButton
              icon={Ruler}
              label="Measure"
              active={annotationTool === "measure"}
              onClick={() => onAnnotationToolChange("measure")}
            />
            <DrawingToolButton
              icon={Minus}
              label="Horizontal"
              active={annotationTool === "horizontal"}
              onClick={() => onAnnotationToolChange("horizontal")}
            />
            <DrawingToolButton
              icon={Clock3}
              label="Vertical"
              active={annotationTool === "vertical"}
              onClick={() => onAnnotationToolChange("vertical")}
            />
            <DrawingToolButton
              icon={MessageSquare}
              label="Note"
              active={annotationTool === "note"}
              onClick={() => onAnnotationToolChange("note")}
            />
            <div className="ml-1 flex items-center gap-2 rounded-xl border border-white/5 bg-sidebar-accent px-2 py-1.5 text-[11px] text-white/55">
              <span>{drawingToolLabel}</span>
              <label className="flex h-5 w-5 cursor-pointer overflow-hidden rounded-md border border-white/5">
                <input
                  type="color"
                  value={annotationColor}
                  onChange={(event) => onAnnotationColorChange(event.target.value)}
                  className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
                />
              </label>
            </div>
            <Input
              value={annotationLabel}
              onChange={(event) => onAnnotationLabelChange(event.target.value)}
              placeholder="Label"
              className="h-8 w-[120px] border-white/5 bg-sidebar-accent text-xs text-white"
            />
          </div>
        </div>
      ) : null}

      {showFloatingContextPanes ? (
        <div className="pointer-events-none absolute bottom-36 right-4 z-20 h-0 w-0">
          {contextPaneSeries.map((pane, index) => {
            const position =
              contextPanePositions[pane.timeframe] ??
              getDefaultContextPanePosition(index) ??
              DEFAULT_FAVORITE_TOOLS_BAR_OFFSET;
            const isDraggingPane = draggingContextPane === pane.timeframe;

            return (
              <div
                key={pane.timeframe}
                className="pointer-events-auto absolute bottom-0 right-0 w-[240px]"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px)`,
                  zIndex: isDraggingPane ? 40 : Math.max(1, contextPaneSeries.length - index),
                }}
              >
                <ReplayContextPaneCard
                  pane={pane}
                  draggable
                  isDragging={isDraggingPane}
                  onDragStart={(event) => onContextPanePointerDown(pane.timeframe, index, event)}
                  onCycleMode={onCycleContextPaneMode}
                  onClose={onCloseContextTimeframe}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      <TradingViewChart
        data={visibleCandles}
        markers={markers}
        priceLines={priceLines}
        indicatorLines={indicatorLines}
        executionOverlays={executionOverlays}
        annotations={annotations}
        activeAnnotationTool={annotationTool}
        annotationColor={annotationColor}
        annotationLabel={annotationLabel}
        pricePrecision={priceDecimals}
        selectedAnnotationId={selectedAnnotationId}
        selectedExecutionOverlayId={selectedExecutionOverlayId}
        onSelectedAnnotationChange={onSelectedAnnotationChange}
        onSelectedExecutionOverlayChange={onSelectedExecutionOverlayChange}
        onAnnotationsChange={onAnnotationsChange}
        onExecutionOverlayChange={onExecutionOverlayChange}
        onExecutionOverlayCommit={onExecutionOverlayCommit}
        onChartClick={onChartClick}
        theme="dark"
        showVolume={false}
        autosize
        height={0}
        fitContent
        className="h-full w-full"
      />

      <div className="pointer-events-none absolute inset-x-4 bottom-20 z-30 flex justify-center">
        <div className="pointer-events-auto h-max w-max max-w-[calc(100vw-8rem)] rounded-[22px] border border-white/5 bg-sidebar/55 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <div className="grid h-max w-max max-w-full grid-cols-[auto_auto_auto] items-center gap-2 text-sm">
            <div className="select-none whitespace-nowrap text-xs text-transparent">
              {currentCandle ? format(new Date(currentTimeUnix * 1000), "EEE dd MMM ''yy") : ""}
            </div>
            <div className="flex items-center justify-self-center gap-2">
              <div className="flex items-center gap-1 rounded-xl border border-white/5 bg-sidebar-accent/60 p-1 backdrop-blur-xl">
                <PlaybackButton icon={ChevronsLeft} label="-20" onClick={() => onStepReplay(-20)} />
                <PlaybackButton icon={SkipBack} label="-5" onClick={() => onStepReplay(-5)} />
                <PlaybackButton
                  icon={isPlaying ? Pause : Play}
                  label={isPlaying ? "Pause" : "Play"}
                  onClick={onPlayPause}
                  active={isPlaying}
                />
                <PlaybackButton icon={SkipForward} label="+5" onClick={() => onStepReplay(5)} />
                <PlaybackButton icon={ChevronsRight} label="+20" onClick={() => onStepReplay(20)} />
                <PlaybackButton icon={ChevronLeft} label="Reset" onClick={onRestart} />
              </div>

              <Select value={String(playbackSpeed)} onValueChange={(value) => onPlaybackSpeedChange(Number(value))}>
                <SelectTrigger className="h-9 w-[84px] rounded-sm border-white/5 bg-sidebar-accent/60 text-xs text-white/75 shadow-md ring ring-white/5 backdrop-blur-xl hover:bg-sidebar-accent/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAYBACK_SPEEDS.map((speed) => (
                    <SelectItem key={speed} value={String(speed)}>
                      {speed}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="justify-self-end whitespace-nowrap text-xs text-white/45">
              {currentCandle ? format(new Date(currentTimeUnix * 1000), "EEE dd MMM ''yy") : ""}
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-4 bottom-5 z-30">
        <div className="pointer-events-auto rounded-[22px] border border-white/5 bg-sidebar/55 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <CandleScrubber
            candles={allCandles}
            trades={trades}
            currentIndex={currentIndex}
            onSeek={onSeekReplay}
          />
        </div>
      </div>
    </div>
  );
}
