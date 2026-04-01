"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatNumberValue } from "@/lib/trade-formatting";
import { formatTradePnlDisplayValue } from "@/features/trades/table/lib/trade-table-pnl-display";
import type { TradeSummaryMetricId } from "@/features/trades/table/hooks/use-trades-route-preferences";
import type { TradePnlDisplayMode } from "@/features/trades/table/lib/trade-table-types";

interface PerformanceSummaryBarProps {
  availableTrades?: number;
  totalTrades: number;
  totalPnL: number;
  netPnL: number;
  winRate: number;
  avgRR: number;
  totalVolume: number;
  wins: number;
  losses: number;
  breakeven: number;
  bestTrade?: number;
  currentStreakCount?: number;
  currentStreakType?: "win" | "loss" | null;
  expectancyPerTrade?: number;
  pnlMode?: TradePnlDisplayMode;
  profitFactor?: number;
  baselineInitialBalance?: number | string | null;
  className?: string;
  visibleTrades?: number;
  visibleMetricIds?: TradeSummaryMetricId[];
  worstTrade?: number;
}

export function PerformanceSummaryBar({
  availableTrades,
  totalTrades,
  totalPnL,
  netPnL,
  winRate,
  avgRR,
  totalVolume,
  wins,
  losses,
  breakeven,
  bestTrade = 0,
  currentStreakCount = 0,
  currentStreakType = null,
  expectancyPerTrade = 0,
  pnlMode = "usd",
  profitFactor = 0,
  baselineInitialBalance,
  className,
  visibleTrades,
  visibleMetricIds,
  worstTrade = 0,
}: PerformanceSummaryBarProps) {
  const grossPnlLabel = pnlMode === "rr" ? "Gross P&L (R)" : "Gross P&L";
  const netPnlLabel = pnlMode === "rr" ? "Net P&L (R)" : "Net P&L";
  const scopeLabel =
    visibleTrades != null && availableTrades != null
      ? `Showing ${visibleTrades} of ${availableTrades}`
      : null;
  const renderedProfitFactor = Number.isFinite(profitFactor)
    ? profitFactor.toFixed(2)
    : "Infinite";
  const streakTone =
    currentStreakType === "win"
      ? "text-teal-400"
      : currentStreakType === "loss"
      ? "text-rose-400"
      : "text-white/50";
  const streakLabel =
    currentStreakCount > 0 && currentStreakType
      ? `${currentStreakCount}${currentStreakType === "win" ? "W" : "L"}`
      : "—";
  const visibleMetricSet = new Set(visibleMetricIds ?? []);
  const shouldShowMetric = (metricId: TradeSummaryMetricId) =>
    visibleMetricSet.size === 0 || visibleMetricSet.has(metricId);

  return (
    <div
      className={cn(
        "sticky bottom-0 left-0 right-0 z-10 border-t border-white/5 bg-sidebar-accent rounded-b-sm overflow-hidden",
        className
      )}
    >
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-sidebar-accent to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-sidebar-accent to-transparent" />
        <div className="flex items-stretch justify-end overflow-x-auto text-xs">
          {scopeLabel && shouldShowMetric("scope") ? (
            <div className="flex flex-col gap-0.5 border-r border-white/5 px-6 py-3 shrink-0">
              <span className="text-[10px] text-white/40">Scope</span>
              <span className="font-medium text-white/80">{scopeLabel}</span>
            </div>
          ) : null}
        {shouldShowMetric("trades") ? <div className="flex flex-col gap-0.5 px-6 py-3 border-r border-white/5 shrink-0">
          <span className="text-[10px] text-white/40">Trades</span>
          <span className="font-medium text-white">{totalTrades.toLocaleString()}</span>
        </div> : null}

        {shouldShowMetric("outcome") ? <div className="flex flex-col gap-0.5 px-6 py-3 border-r border-white/5 shrink-0">
          <span className="text-[10px] text-white/40">Outcome</span>
          <span className="font-medium text-white/70">
            <span className="text-teal-400">{wins}W</span>
            <span className="text-white/30 mx-1">·</span>
            <span className="text-rose-400">{losses}L</span>
            <span className="text-white/30 mx-1">·</span>
            <span className="text-white/50">{breakeven}BE</span>
          </span>
        </div> : null}

        {shouldShowMetric("grossPnl") ? <div className="flex flex-col gap-0.5 px-6 py-3 border-r border-white/5 shrink-0">
          <span className="text-[10px] text-white/40">{grossPnlLabel}</span>
          <span className={cn("font-medium", totalPnL >= 0 ? "text-teal-400" : "text-rose-400")}>
            {formatTradePnlDisplayValue(totalPnL, {
              mode: pnlMode,
              initialBalance: baselineInitialBalance,
              currencyOptions: {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              },
              rrMinimumFractionDigits: 2,
              rrMaximumFractionDigits: 2,
            })}
          </span>
        </div> : null}

        {shouldShowMetric("netPnl") ? <div className="flex flex-col gap-0.5 px-6 py-3 border-r border-white/5 shrink-0">
          <span className="text-[10px] text-white/40">{netPnlLabel}</span>
          <span className={cn("font-medium", netPnL >= 0 ? "text-teal-400" : "text-rose-400")}>
            {formatTradePnlDisplayValue(netPnL, {
              mode: pnlMode,
              initialBalance: baselineInitialBalance,
              currencyOptions: {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              },
              rrMinimumFractionDigits: 2,
              rrMaximumFractionDigits: 2,
            })}
          </span>
        </div> : null}

        {shouldShowMetric("winRate") ? <div className="flex flex-col gap-0.5 px-6 py-3 border-r border-white/5 shrink-0">
          <span className="text-[10px] text-white/40">Win Rate</span>
          <span className="font-medium text-white">{winRate.toFixed(1)}%</span>
        </div> : null}

        {shouldShowMetric("avgRR") ? <div className="flex flex-col gap-0.5 px-6 py-3 border-r border-white/5 shrink-0">
          <span className="text-[10px] text-white/40">Avg RR</span>
          <span className="font-medium text-white">{avgRR.toFixed(2)}R</span>
        </div> : null}

        {shouldShowMetric("profitFactor") ? <div className="flex flex-col gap-0.5 px-6 py-3 border-r border-white/5 shrink-0">
          <span className="text-[10px] text-white/40">Profit factor</span>
          <span className="font-medium text-white">{renderedProfitFactor}</span>
        </div> : null}

        {shouldShowMetric("expectancy") ? <div className="flex flex-col gap-0.5 px-6 py-3 border-r border-white/5 shrink-0">
          <span className="text-[10px] text-white/40">Expectancy</span>
          <span className={cn("font-medium", expectancyPerTrade >= 0 ? "text-teal-400" : "text-rose-400")}>
            {formatTradePnlDisplayValue(expectancyPerTrade, {
              mode: pnlMode,
              initialBalance: baselineInitialBalance,
              currencyOptions: {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              },
              rrMinimumFractionDigits: 2,
              rrMaximumFractionDigits: 2,
            })}
          </span>
        </div> : null}

        {shouldShowMetric("bestTrade") ? <div className="flex flex-col gap-0.5 px-6 py-3 border-r border-white/5 shrink-0">
          <span className="text-[10px] text-white/40">Best trade</span>
          <span className="font-medium text-teal-400">
            {formatTradePnlDisplayValue(bestTrade, {
              mode: pnlMode,
              initialBalance: baselineInitialBalance,
              currencyOptions: {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              },
              rrMinimumFractionDigits: 2,
              rrMaximumFractionDigits: 2,
            })}
          </span>
        </div> : null}

        {shouldShowMetric("worstTrade") ? <div className="flex flex-col gap-0.5 px-6 py-3 border-r border-white/5 shrink-0">
          <span className="text-[10px] text-white/40">Worst trade</span>
          <span className="font-medium text-rose-400">
            {formatTradePnlDisplayValue(worstTrade, {
              mode: pnlMode,
              initialBalance: baselineInitialBalance,
              currencyOptions: {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              },
              rrMinimumFractionDigits: 2,
              rrMaximumFractionDigits: 2,
            })}
          </span>
        </div> : null}

        {shouldShowMetric("streak") ? <div className="flex flex-col gap-0.5 px-6 py-3 border-r border-white/5 shrink-0">
          <span className="text-[10px] text-white/40">Current streak</span>
          <span className={cn("font-medium", streakTone)}>{streakLabel}</span>
        </div> : null}

        {shouldShowMetric("volume") ? <div className="flex flex-col gap-0.5 px-6 py-3 shrink-0">
          <span className="text-[10px] text-white/40">Volume</span>
          <span className="font-medium text-white">
            {formatNumberValue(totalVolume, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div> : null}
        </div>
      </div>
    </div>
  );
}
