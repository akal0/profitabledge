"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Target, BarChart3 } from "lucide-react";
import { formatCurrencyValue, formatNumberValue } from "@/lib/trade-formatting";

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
  className,
}: PerformanceSummaryBarProps) {
  return (
    <div
      className={cn(
        "sticky bottom-0 left-0 right-0 z-10 border-t border-white/10 bg-sidebar/95 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex items-center justify-between gap-6 px-6 py-3">
        {/* Left side - Trade counts */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-white/40">
              Total Trades
            </span>
            <span className="text-lg font-semibold text-white">
              {totalTrades.toLocaleString()}
            </span>
          </div>

          <div className="h-10 w-px bg-white/10" />

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-teal-400" />
              <span className="text-white/60">
                {wins}W
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-rose-400" />
              <span className="text-white/60">
                {losses}L
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-gray-400" />
              <span className="text-white/60">
                {breakeven}BE
              </span>
            </div>
          </div>
        </div>

        {/* Center - P&L metrics */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-white/40">
              Gross P&L
            </span>
            <div className="flex items-center gap-1.5">
              {totalPnL >= 0 ? (
                <TrendingUp className="size-4 text-teal-400" />
              ) : (
                <TrendingDown className="size-4 text-rose-400" />
              )}
              <span
                className={cn(
                  "text-lg font-semibold",
                  totalPnL >= 0 ? "text-teal-400" : "text-rose-400"
                )}
              >
                {formatCurrencyValue(totalPnL, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          <div className="h-10 w-px bg-white/10" />

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-white/40">
              Net P&L
            </span>
            <div className="flex items-center gap-1.5">
              {netPnL >= 0 ? (
                <TrendingUp className="size-4 text-teal-400" />
              ) : (
                <TrendingDown className="size-4 text-rose-400" />
              )}
              <span
                className={cn(
                  "text-lg font-semibold",
                  netPnL >= 0 ? "text-teal-400" : "text-rose-400"
                )}
              >
                {formatCurrencyValue(netPnL, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Right side - Performance metrics */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-white/40">
              Win Rate
            </span>
            <div className="flex items-center gap-1.5">
              <Target className="size-4 text-white/60" />
              <span className="text-lg font-semibold text-white">
                {winRate.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="h-10 w-px bg-white/10" />

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-white/40">
              Avg RR
            </span>
            <span className="text-lg font-semibold text-white">
              {avgRR.toFixed(2)}R
            </span>
          </div>

          <div className="h-10 w-px bg-white/10" />

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-white/40">
              Total Volume
            </span>
            <div className="flex items-center gap-1.5">
              <BarChart3 className="size-4 text-white/60" />
              <span className="text-lg font-semibold text-white">
                {formatNumberValue(totalVolume, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
