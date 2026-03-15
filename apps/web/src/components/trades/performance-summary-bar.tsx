"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatNumberValue } from "@/lib/trade-formatting";
import { formatTradePnlDisplayValue } from "@/features/trades/table/lib/trade-table-pnl-display";
import type { TradePnlDisplayMode } from "@/features/trades/table/lib/trade-table-types";

interface PerformanceSummaryBarProps {
  totalTrades: number;
  totalPnL: number;
  netPnL: number;
  winRate: number;
  avgRR: number;
  totalVolume: number;
  wins: number;
  losses: number;
  breakeven: number;
  pnlMode?: TradePnlDisplayMode;
  baselineInitialBalance?: number | string | null;
  className?: string;
}

export function PerformanceSummaryBar({
  totalTrades,
  totalPnL,
  netPnL,
  winRate,
  avgRR,
  totalVolume,
  wins,
  losses,
  breakeven,
  pnlMode = "usd",
  baselineInitialBalance,
  className,
}: PerformanceSummaryBarProps) {
  const grossPnlLabel = pnlMode === "rr" ? "Gross P&L (R)" : "Gross P&L";
  const netPnlLabel = pnlMode === "rr" ? "Net P&L (R)" : "Net P&L";

  return (
    <div
      className={cn(
        "sticky bottom-0 left-0 right-0 z-10 border-t border-white/5 bg-sidebar-accent rounded-b-sm overflow-hidden",
        className
      )}
    >
      <div className="flex items-stretch justify-end text-xs overflow-x-auto">
        <div className="flex flex-col gap-0.5 px-6 py-3 border-r border-white/5 shrink-0">
          <span className="text-[10px] text-white/40">Trades</span>
          <span className="font-medium text-white">{totalTrades.toLocaleString()}</span>
        </div>

        <div className="flex flex-col gap-0.5 px-6 py-3 border-r border-white/5 shrink-0">
          <span className="text-[10px] text-white/40">Outcome</span>
          <span className="font-medium text-white/70">
            <span className="text-teal-400">{wins}W</span>
            <span className="text-white/30 mx-1">·</span>
            <span className="text-rose-400">{losses}L</span>
            <span className="text-white/30 mx-1">·</span>
            <span className="text-white/50">{breakeven}BE</span>
          </span>
        </div>

        <div className="flex flex-col gap-0.5 px-6 py-3 border-r border-white/5 shrink-0">
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
        </div>

        <div className="flex flex-col gap-0.5 px-6 py-3 border-r border-white/5 shrink-0">
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
        </div>

        <div className="flex flex-col gap-0.5 px-6 py-3 border-r border-white/5 shrink-0">
          <span className="text-[10px] text-white/40">Win Rate</span>
          <span className="font-medium text-white">{winRate.toFixed(1)}%</span>
        </div>

        <div className="flex flex-col gap-0.5 px-6 py-3 border-r border-white/5 shrink-0">
          <span className="text-[10px] text-white/40">Avg RR</span>
          <span className="font-medium text-white">{avgRR.toFixed(2)}R</span>
        </div>

        <div className="flex flex-col gap-0.5 px-6 py-3 shrink-0">
          <span className="text-[10px] text-white/40">Volume</span>
          <span className="font-medium text-white">
            {formatNumberValue(totalVolume, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}
