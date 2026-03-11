"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Trade {
  id: string;
  symbol: string;
  type: "BUY" | "SELL";
  openTime: string;
  closeTime: string;
  profit: number;
  pips: number;
  volume: number;
}

interface InlineReportProps {
  title?: string;
  description?: string;
  trades?: Trade[];
  summary?: {
    totalTrades?: number;
    winRate?: number;
    totalProfit?: number;
    avgProfit?: number;
  };
  className?: string;
  children?: React.ReactNode;
}

export function InlineReport({
  title = "Trade Report",
  description,
  trades = [],
  summary,
  className,
  children,
}: InlineReportProps) {
  return (
    <div className={cn(
      "w-full rounded-sm bg-sidebar/30 border-white/5 p-6 space-y-4 my-4",
      "border-none", // Following project style
      className
    )}>
      {/* Header */}
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {description && (
          <p className="text-sm text-white/70">{description}</p>
        )}
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {summary.totalTrades !== undefined && (
            <div className="space-y-1">
              <p className="text-xs text-white/50">Total Trades</p>
              <p className="text-lg font-semibold text-white">{summary.totalTrades}</p>
            </div>
          )}
          {summary.winRate !== undefined && (
            <div className="space-y-1">
              <p className="text-xs text-white/50">Win Rate</p>
              <p className="text-lg font-semibold text-white">
                {summary.winRate.toFixed(1)}%
              </p>
            </div>
          )}
          {summary.totalProfit !== undefined && (
            <div className="space-y-1">
              <p className="text-xs text-white/50">Total Profit</p>
              <div className="flex items-center gap-1">
                {summary.totalProfit >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-400" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                )}
                <p className={cn(
                  "text-lg font-semibold",
                  summary.totalProfit >= 0 ? "text-green-400" : "text-red-400"
                )}>
                  ${Math.abs(summary.totalProfit).toFixed(2)}
                </p>
              </div>
            </div>
          )}
          {summary.avgProfit !== undefined && (
            <div className="space-y-1">
              <p className="text-xs text-white/50">Avg Profit</p>
              <p className={cn(
                "text-lg font-semibold",
                summary.avgProfit >= 0 ? "text-green-400" : "text-red-400"
              )}>
                ${Math.abs(summary.avgProfit).toFixed(2)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Trades List */}
      {trades.length > 0 && (
        <div className="rounded-sm overflow-hidden border border-white/5">
          <div className="divide-y divide-white/5">
            {/* Header */}
            <div className="grid grid-cols-6 gap-4 px-4 py-3 bg-sidebar/50 text-xs text-white/70 font-medium">
              <div>Symbol</div>
              <div>Type</div>
              <div>Open Time</div>
              <div>Close Time</div>
              <div className="text-right">Profit</div>
              <div className="text-right">Pips</div>
            </div>
            {/* Rows */}
            {trades.map((trade) => (
              <div 
                key={trade.id} 
                className="grid grid-cols-6 gap-4 px-4 py-3 hover:bg-sidebar/30 transition-colors text-xs"
              >
                <div className="font-medium text-white">{trade.symbol}</div>
                <div>
                  <Badge 
                    variant={trade.type === "BUY" ? "default" : "destructive"}
                    className="text-xs border-none"
                  >
                    {trade.type}
                  </Badge>
                </div>
                <div className="text-white/70">
                  {new Date(trade.openTime).toLocaleString()}
                </div>
                <div className="text-white/70">
                  {new Date(trade.closeTime).toLocaleString()}
                </div>
                <div className={cn(
                  "text-right font-medium",
                  trade.profit >= 0 ? "text-green-400" : "text-red-400"
                )}>
                  ${trade.profit.toFixed(2)}
                </div>
                <div className="text-right text-white/70">
                  {trade.pips.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom content */}
      {children}
    </div>
  );
}
