"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Trash2,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
} from "lucide-react";
import { format } from "date-fns";

// Trade data type (subset of what we need)
interface TradeData {
  id: string;
  symbol: string | null;
  tradeType: string | null;
  profit: string | null;
  pips: string | null;
  realisedRR: string | null;
  volume: string | null;
  openPrice: string | null;
  closePrice: string | null;
  openTime: Date | null;
  closeTime: Date | null;
  outcome: string | null;
  sessionTag: string | null;
  sessionTagColor: string | null;
  modelTag: string | null;
  modelTagColor: string | null;
}

interface TradeEmbedProps {
  tradeId: string;
  trade?: TradeData; // Can pass trade data directly to avoid refetch
  display?: "card" | "inline" | "detailed";
  isEditing?: boolean;
  onDelete?: () => void;
  onViewTrade?: () => void;
  className?: string;
}

export function TradeEmbed({
  tradeId,
  trade: tradeProp,
  display = "card",
  isEditing = false,
  onDelete,
  onViewTrade,
  className,
}: TradeEmbedProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Use provided trade data or show loading state
  // In production, you'd want to add a getTrade procedure
  const trade = tradeProp;
  const isLoading = !trade;

  if (isLoading) {
    return (
      <div className={cn("my-4 p-4 bg-sidebar border border-white/5", className)}>
        <Skeleton className="h-6 w-32 bg-sidebar-accent" />
        <div className="flex gap-4 mt-2">
          <Skeleton className="h-4 w-20 bg-sidebar-accent" />
          <Skeleton className="h-4 w-20 bg-sidebar-accent" />
          <Skeleton className="h-4 w-24 bg-sidebar-accent" />
        </div>
      </div>
    );
  }

  if (!trade) {
    return (
      <div className={cn("my-4 p-4 bg-sidebar border border-white/5 text-white/40", className)}>
        Trade not found or was deleted
      </div>
    );
  }

  const isWin = Number(trade.profit) > 0;
  const isBE = Math.abs(Number(trade.profit)) < 1;
  const isLong = trade.tradeType === "long";
  const profit = Number(trade.profit);
  const pips = Number(trade.pips);
  const realizedRR = trade.realisedRR ? Number(trade.realisedRR) : null;

  if (display === "inline") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 bg-sidebar-accent text-sm",
          isWin ? "text-teal-400" : isBE ? "text-yellow-400" : "text-red-400",
          className
        )}
      >
        {isLong ? (
          <ArrowUpRight className="h-3 w-3" />
        ) : (
          <ArrowDownRight className="h-3 w-3" />
        )}
        <span className="font-medium">{trade.symbol}</span>
        <span>
          {isWin ? "+" : ""}
          ${profit.toFixed(2)}
        </span>
      </span>
    );
  }

  if (display === "detailed") {
    return (
      <div
        className={cn(
          "my-4 bg-sidebar border border-white/5 overflow-hidden group",
          className
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center justify-center w-10 h-10",
                isLong ? "bg-teal-500/10" : "bg-red-500/10"
              )}
            >
              {isLong ? (
                <ArrowUpRight className={cn("h-5 w-5", isLong ? "text-teal-400" : "text-red-400")} />
              ) : (
                <ArrowDownRight className="h-5 w-5 text-red-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{trade.symbol}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs border-white/10",
                    isLong ? "text-teal-400" : "text-red-400"
                  )}
                >
                  {isLong ? "LONG" : "SHORT"}
                </Badge>
                {trade.outcome && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs border-white/10",
                      trade.outcome === "Win"
                        ? "text-teal-400"
                        : trade.outcome === "Loss"
                        ? "text-red-400"
                        : "text-yellow-400"
                    )}
                  >
                    {trade.outcome}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-white/40 mt-0.5">
                {trade.closeTime
                  ? format(new Date(trade.closeTime), "MMM d, yyyy 'at' h:mm a")
                  : "Open"}
              </div>
            </div>
          </div>

          {/* Controls */}
          {isEditing && isHovered && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-white/40 hover:text-white"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-sidebar border-white/10">
                <DropdownMenuItem
                  className="text-white/80 focus:text-white focus:bg-white/10"
                  onClick={onViewTrade}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Trade
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem
                  className="text-red-400 focus:text-red-400 focus:bg-red-400/10"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 divide-x divide-white/5">
          <StatCell
            label="P&L"
            value={`${isWin ? "+" : ""}$${profit.toFixed(2)}`}
            valueColor={isWin ? "text-teal-400" : isBE ? "text-yellow-400" : "text-red-400"}
          />
          <StatCell
            label="Pips"
            value={`${pips > 0 ? "+" : ""}${pips.toFixed(1)}`}
            valueColor={pips > 0 ? "text-teal-400" : pips === 0 ? "text-yellow-400" : "text-red-400"}
          />
          <StatCell
            label="R:R"
            value={realizedRR ? `${realizedRR.toFixed(2)}R` : "—"}
            valueColor={realizedRR && realizedRR > 0 ? "text-teal-400" : "text-white/60"}
          />
          <StatCell
            label="Volume"
            value={`${Number(trade.volume).toFixed(2)}`}
            valueColor="text-white/80"
          />
        </div>

        {/* Entry/Exit prices */}
        <div className="p-4 border-t border-white/5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-white/40 mb-1">Entry</div>
              <div className="text-sm text-white font-mono">
                @ {Number(trade.openPrice).toFixed(5)}
              </div>
              {trade.openTime && (
                <div className="text-xs text-white/30 mt-0.5">
                  {format(new Date(trade.openTime), "h:mm a")}
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-white/40 mb-1">Exit</div>
              <div className="text-sm text-white font-mono">
                @ {Number(trade.closePrice).toFixed(5)}
              </div>
              {trade.closeTime && (
                <div className="text-xs text-white/30 mt-0.5">
                  {format(new Date(trade.closeTime), "h:mm a")}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tags */}
        {(trade.sessionTag || trade.modelTag) && (
          <div className="px-4 pb-4 flex flex-wrap gap-1.5">
            {trade.sessionTag && (
              <Badge
                variant="outline"
                className="text-xs border-white/10 text-white/60"
                style={{
                  borderColor: trade.sessionTagColor || undefined,
                  color: trade.sessionTagColor || undefined,
                }}
              >
                {trade.sessionTag}
              </Badge>
            )}
            {trade.modelTag && (
              <Badge
                variant="outline"
                className="text-xs border-white/10 text-white/60"
                style={{
                  borderColor: trade.modelTagColor || undefined,
                  color: trade.modelTagColor || undefined,
                }}
              >
                {trade.modelTag}
              </Badge>
            )}
          </div>
        )}
      </div>
    );
  }

  // Default card display
  return (
    <div
      className={cn(
        "my-4 p-4 bg-sidebar border border-white/5 flex items-center justify-between group",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8",
            isLong ? "bg-teal-500/10" : "bg-red-500/10"
          )}
        >
          {isLong ? (
            <ArrowUpRight className="h-4 w-4 text-teal-400" />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-red-400" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">{trade.symbol}</span>
            <span
              className={cn(
                "text-sm font-medium",
                isWin ? "text-teal-400" : isBE ? "text-yellow-400" : "text-red-400"
              )}
            >
              {isWin ? "+" : ""}${profit.toFixed(2)}
            </span>
          </div>
          <div className="text-xs text-white/40">
            {trade.closeTime
              ? format(new Date(trade.closeTime), "MMM d, h:mm a")
              : "Open"}{" "}
            • {pips > 0 ? "+" : ""}{pips.toFixed(1)} pips
          </div>
        </div>
      </div>

      {isEditing && isHovered && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-white/40 hover:text-white"
            onClick={onViewTrade}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-red-400 hover:text-red-400 hover:bg-red-400/10"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Stat Cell Component
// ============================================================================

interface StatCellProps {
  label: string;
  value: string;
  valueColor?: string;
}

function StatCell({ label, value, valueColor = "text-white" }: StatCellProps) {
  return (
    <div className="p-3 text-center">
      <div className="text-xs text-white/40 mb-0.5">{label}</div>
      <div className={cn("text-sm font-medium", valueColor)}>{value}</div>
    </div>
  );
}

// ============================================================================
// Trade Comparison Embed
// ============================================================================

interface TradeComparisonEmbedProps {
  tradeIds: string[];
  trades?: TradeData[]; // Pass trades directly to avoid refetch
  metrics?: string[];
  isEditing?: boolean;
  onDelete?: () => void;
  onConfigure?: () => void;
  className?: string;
}

export function TradeComparisonEmbed({
  tradeIds,
  trades: tradesProp,
  metrics = ["profit", "pips", "realisedRR", "volume"],
  isEditing = false,
  onDelete,
  onConfigure,
  className,
}: TradeComparisonEmbedProps) {
  // Use provided trades or show placeholder
  const trades = tradesProp || [];
  const isLoading = !tradesProp;

  if (isLoading) {
    return (
      <div className={cn("my-4 p-4 bg-sidebar border border-white/5", className)}>
        <div className="flex gap-4">
          {tradeIds.map((id) => (
            <Skeleton key={id} className="h-32 flex-1 bg-sidebar-accent" />
          ))}
        </div>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className={cn("my-4 p-4 bg-sidebar border border-white/5 text-white/40", className)}>
        No trades to compare
      </div>
    );
  }

  const metricLabels: Record<string, string> = {
    profit: "P&L",
    pips: "Pips",
    realisedRR: "R:R",
    volume: "Volume",
    tradeDurationSeconds: "Duration",
    mfePips: "MFE",
    maePips: "MAE",
  };

  return (
    <div
      className={cn(
        "my-4 bg-sidebar border border-white/5 overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <h4 className="text-sm font-medium text-white/60">Trade Comparison</h4>
        {isEditing && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-white/40 hover:text-white"
              onClick={onConfigure}
            >
              Configure
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-red-400 hover:text-red-400 hover:bg-red-400/10"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Comparison table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left p-3 text-xs font-medium text-white/40">
                Metric
              </th>
              {trades.map((trade) => (
                <th
                  key={trade!.id}
                  className="text-center p-3 text-xs font-medium text-white"
                >
                  {trade!.symbol}
                  <span className="block text-white/40 font-normal">
                    {trade!.closeTime
                      ? format(new Date(trade!.closeTime), "MMM d")
                      : "Open"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => (
              <tr key={metric} className="border-b border-white/5 last:border-0">
                <td className="p-3 text-sm text-white/60">
                  {metricLabels[metric] || metric}
                </td>
                {trades.map((trade) => {
                  const value = (trade as any)[metric];
                  const numValue = Number(value);
                  const isPositive = numValue > 0;
                  const display =
                    metric === "profit"
                      ? `${isPositive ? "+" : ""}$${numValue.toFixed(2)}`
                      : metric === "realisedRR"
                      ? value
                        ? `${numValue.toFixed(2)}R`
                        : "—"
                      : metric === "tradeDurationSeconds"
                      ? formatDuration(numValue)
                      : typeof numValue === "number" && !isNaN(numValue)
                      ? numValue.toFixed(2)
                      : "—";

                  return (
                    <td
                      key={trade!.id}
                      className={cn(
                        "p-3 text-sm text-center font-medium",
                        metric === "profit" || metric === "pips" || metric === "realisedRR"
                          ? isPositive
                            ? "text-teal-400"
                            : numValue === 0
                            ? "text-yellow-400"
                            : "text-red-400"
                          : "text-white"
                      )}
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
