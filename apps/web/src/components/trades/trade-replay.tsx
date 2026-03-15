"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { trpcOptions } from "@/utils/trpc";
import {
  TradingViewChart,
  generateSampleCandles,
  dateToChartTime,
  type CandleData,
  type TradeMarker,
  type PriceLine,
} from "@/components/charts/trading-view-chart";
import type { Time } from "lightweight-charts";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrencyValue } from "@/lib/trade-formatting";

interface TradeReplayProps {
  tradeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TradeReplay({ tradeId, open, onOpenChange }: TradeReplayProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Fetch trade details
  const { data: trade, isLoading: loadingTrade } = useQuery({
    ...trpcOptions.trades.getById.queryOptions({ tradeId }),
    enabled: open && !!tradeId,
  });

  // Generate candles based on trade data
  const allCandles = useMemo(() => {
    if (!trade?.openTime || !trade?.closeTime || !trade?.openPrice || !trade?.closePrice) {
      return [];
    }

    const openPrice = parseFloat(String(trade.openPrice));
    const closePrice = parseFloat(String(trade.closePrice));
    const mfePips = trade.mfePips ? parseFloat(String(trade.mfePips)) : undefined;
    const maePips = trade.maePips ? parseFloat(String(trade.maePips)) : undefined;
    const pipSize = trade.symbol?.includes("JPY") ? 0.01 : 0.0001;

    // Calculate volatility based on price movement
    const priceRange = Math.abs(closePrice - openPrice);
    const volatility = Math.max(0.0005, priceRange / openPrice * 0.3);

    return generateSampleCandles(
      new Date(trade.openTime),
      new Date(trade.closeTime),
      openPrice,
      closePrice,
      {
        volatility,
        intervalMinutes: 5,
        mfePips,
        maePips,
        pipSize,
      }
    );
  }, [trade]);

  // Visible candles up to current index
  const visibleCandles = useMemo(() => {
    return allCandles.slice(0, currentIndex + 1);
  }, [allCandles, currentIndex]);

  // Current price (close of last visible candle)
  const currentPrice = visibleCandles.length > 0 
    ? visibleCandles[visibleCandles.length - 1].close 
    : trade?.openPrice ? parseFloat(String(trade.openPrice)) : 0;

  // Calculate current P&L
  const currentPnL = useMemo(() => {
    if (!trade?.openPrice || !trade?.volume) return 0;
    const openPrice = parseFloat(String(trade.openPrice));
    const volume = parseFloat(String(trade.volume));
    const isLong = trade.tradeType === "long" || trade.tradeType === "buy";
    const diff = isLong ? currentPrice - openPrice : openPrice - currentPrice;
    const contractSize = trade.symbol?.includes("XAU") ? 100 : 100000;
    return diff * volume * contractSize;
  }, [trade, currentPrice]);

  // Chart markers
  const markers = useMemo<TradeMarker[]>(() => {
    if (!allCandles.length || !trade) return [];

    const isLong = trade.tradeType === "long" || trade.tradeType === "buy";
    const entryMarker: TradeMarker = {
      time: allCandles[0].time,
      position: isLong ? "belowBar" : "aboveBar",
      color: isLong ? "#00E0C8" : "#F76290",
      shape: isLong ? "arrowUp" : "arrowDown",
      text: "Entry",
      size: 2,
    };

    // Only show exit marker if we've reached the end
    if (currentIndex >= allCandles.length - 1) {
      const exitMarker: TradeMarker = {
        time: allCandles[allCandles.length - 1].time,
        position: isLong ? "aboveBar" : "belowBar",
        color: isLong ? "#F76290" : "#00E0C8",
        shape: isLong ? "arrowDown" : "arrowUp",
        text: "Exit",
        size: 2,
      };
      return [entryMarker, exitMarker];
    }

    return [entryMarker];
  }, [allCandles, currentIndex, trade]);

  // Price lines for SL/TP/Entry
  const priceLines = useMemo<PriceLine[]>(() => {
    if (!trade) return [];
    
    const lines: PriceLine[] = [];
    const openPrice = trade.openPrice ? parseFloat(String(trade.openPrice)) : null;
    const sl = trade.sl ? parseFloat(String(trade.sl)) : null;
    const tp = trade.tp ? parseFloat(String(trade.tp)) : null;

    if (openPrice) {
      lines.push({
        price: openPrice,
        color: "rgba(255, 255, 255, 0.5)",
        lineWidth: 1,
        lineStyle: "dashed",
        title: "Entry",
        axisLabelVisible: true,
      });
    }

    if (sl) {
      lines.push({
        price: sl,
        color: "#F76290",
        lineWidth: 1,
        lineStyle: "dashed",
        title: "SL",
        axisLabelVisible: true,
      });
    }

    if (tp) {
      lines.push({
        price: tp,
        color: "#00E0C8",
        lineWidth: 1,
        lineStyle: "dashed",
        title: "TP",
        axisLabelVisible: true,
      });
    }

    return lines;
  }, [trade]);

  // Playback controls
  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleStepBack = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
    setIsPlaying(false);
  }, []);

  const handleStepForward = useCallback(() => {
    setCurrentIndex((prev) => Math.min(allCandles.length - 1, prev + 1));
    setIsPlaying(false);
  }, [allCandles.length]);

  const handleRestart = useCallback(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
  }, []);

  const handleEnd = useCallback(() => {
    setCurrentIndex(allCandles.length - 1);
    setIsPlaying(false);
  }, [allCandles.length]);

  // Auto-play effect
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= allCandles.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 500 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, allCandles.length]);

  // Reset when trade changes
  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [tradeId]);

  if (loadingTrade || !trade) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg max-w-4xl"
        >
          <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
            <div className="flex items-center justify-center h-96">
              <div className="text-white/40">Loading trade data...</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isLong = trade.tradeType === "long" || trade.tradeType === "buy";
  const openPrice = trade.openPrice ? parseFloat(String(trade.openPrice)) : 0;
  const sl = trade.sl ? parseFloat(String(trade.sl)) : null;
  const tp = trade.tp ? parseFloat(String(trade.tp)) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg max-w-5xl"
      >
        <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80 max-h-[90vh]">
          {/* Header */}
          <div className="flex items-start gap-3 px-5 py-4 shrink-0">
            <div className={cn(
              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent"
            )}>
              {isLong ? (
                <TrendingUp className="h-3.5 w-3.5 text-teal-400" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
              )}
            </div>
            <div className="min-w-0 flex items-center gap-2">
              <div>
                <div className="text-sm font-medium text-white">Trade Replay: {trade.symbol}</div>
                <p className="mt-1 text-xs leading-relaxed text-white/40">
                  Step through the trade to analyze price action and decision points
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-4 text-white/40 cursor-help shrink-0" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    This replay uses simulated price data based on your trade's entry, exit, MFE, and MAE.
                    For actual historical data, connect an EA that stores candle snapshots.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <DialogClose asChild>
              <button type="button" className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent text-white/50 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white">
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Close</span>
              </button>
            </DialogClose>
          </div>
          <Separator />

          {/* Content */}
          <div className="flex flex-col flex-1 overflow-y-auto p-5 gap-4">

        {/* Trade Info Header */}
        <div className="grid grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <div className="text-xs text-muted-foreground">Direction</div>
            <div className={cn("font-medium", isLong ? "text-teal-400" : "text-rose-400")}>
              {isLong ? "Long" : "Short"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Entry Price</div>
            <div className="font-medium">{openPrice.toFixed(5)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Current Price</div>
            <div className="font-medium">{currentPrice.toFixed(5)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Current P&L</div>
            <div className={cn(
              "font-medium",
              currentPnL >= 0 ? "text-teal-400" : "text-rose-400"
            )}>
              {formatCurrencyValue(currentPnL, {
                showPlus: true,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
        </div>

        {/* Chart Area - Using TradingView Lightweight Charts */}
        <div className="flex-1 min-h-[350px] relative bg-black/20 rounded-lg overflow-hidden">
          {visibleCandles.length > 0 ? (
            <TradingViewChart
              data={visibleCandles}
              markers={markers}
              priceLines={priceLines}
              height={350}
              theme="dark"
              autosize
              fitContent={false}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No candle data available
            </div>
          )}

          {/* Legend */}
          <div className="absolute top-2 right-2 text-xs space-y-1 bg-black/50 p-2 rounded">
            {sl && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-3 text-rose-400" />
                <span className="text-rose-400">SL: {sl.toFixed(5)}</span>
              </div>
            )}
            {tp && (
              <div className="flex items-center gap-2">
                <Target className="size-3 text-teal-400" />
                <span className="text-teal-400">TP: {tp.toFixed(5)}</span>
              </div>
            )}
          </div>

          {/* Time indicator */}
          <div className="absolute bottom-2 left-2 text-xs text-muted-foreground bg-black/50 px-2 py-1 rounded">
            {visibleCandles.length > 0 && (
              new Date((visibleCandles[visibleCandles.length - 1].time as number) * 1000).toLocaleString()
            )}
          </div>
        </div>

        {/* Timeline Slider */}
        <div className="px-4">
          <Slider
            value={[currentIndex]}
            max={allCandles.length - 1}
            step={1}
            onValueChange={([value]) => {
              setCurrentIndex(value);
              setIsPlaying(false);
            }}
            className="py-4"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {trade.openTime && new Date(trade.openTime).toLocaleString()}
            </span>
            <span>
              Candle {currentIndex + 1} of {allCandles.length}
            </span>
            <span>
              {trade.closeTime && new Date(trade.closeTime).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-2 pt-4 border-t">
          <Button variant="outline" size="icon" onClick={handleRestart}>
            <SkipBack className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleStepBack}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button 
            variant={isPlaying ? "default" : "outline"}
            size="icon"
            onClick={handlePlayPause}
            className="w-12"
          >
            {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={handleStepForward}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleEnd}>
            <SkipForward className="size-4" />
          </Button>
          
          <div className="ml-4 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Speed:</span>
            {[0.5, 1, 2, 4].map((speed) => (
              <Button
                key={speed}
                variant={playbackSpeed === speed ? "default" : "outline"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setPlaybackSpeed(speed)}
              >
                {speed}x
              </Button>
            ))}
          </div>
        </div>

        {/* Final Outcome */}
        {currentIndex === allCandles.length - 1 && (
          <div className={cn(
            "text-center py-3 rounded-lg",
            trade.outcome === "Win" || trade.outcome === "PW" 
              ? "bg-teal-500/10 text-teal-400" 
              : trade.outcome === "Loss"
              ? "bg-rose-500/10 text-rose-400"
              : "bg-white/5 text-white/70"
          )}>
            Trade Closed: {trade.outcome} —{" "}
            {formatCurrencyValue(
              trade.profit ? parseFloat(String(trade.profit)) : 0,
              {
                showPlus: true,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}
            {trade.pips && ` (${parseFloat(String(trade.pips)).toFixed(1)} pips)`}
          </div>
        )}

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
