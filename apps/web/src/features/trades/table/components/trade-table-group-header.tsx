"use client";

import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatTradePnlDisplayValue } from "@/features/trades/table/lib/trade-table-pnl-display";
import { summarizeTradeGroup } from "@/features/trades/table/lib/trade-table-grouping";
import type {
  TradePnlDisplayMode,
  TradeRow,
} from "@/features/trades/table/lib/trade-table-types";

export function TradeTableGroupHeader({
  groupKey,
  rows,
  pnlMode = "usd",
  baselineInitialBalance,
  isCollapsed,
  onToggleCollapsed,
}: {
  groupKey: string;
  rows: TradeRow[];
  pnlMode?: TradePnlDisplayMode;
  baselineInitialBalance?: number | string | null;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const summary = summarizeTradeGroup(rows);

  return (
    <div className="flex items-center gap-3 bg-sidebar/90 px-6 py-3 text-[11px] text-white/55">
      <Button
        type="button"
        onClick={onToggleCollapsed}
        className="group flex h-7 w-7 items-center justify-center rounded-sm border border-white/6 bg-sidebar-accent/60 px-0 text-white/55 transition-all duration-200 hover:bg-sidebar-accent hover:text-white"
        aria-label={isCollapsed ? `Expand ${groupKey}` : `Collapse ${groupKey}`}
      >
        <ChevronDown
          className={cn(
            "size-4 transition-transform duration-200 ease-out",
            isCollapsed ? "-rotate-90" : "rotate-0"
          )}
        />
      </Button>
      <span className="font-medium uppercase tracking-[0.18em] text-white/35">
        Group
      </span>
      <span className="rounded-sm bg-sidebar-accent px-2.5 py-1 text-xs font-medium text-white/80">
        {groupKey}
      </span>
      <span>{summary.trades} trades</span>
      <span
        className={cn(
          "font-medium",
          summary.totalProfit >= 0 ? "text-teal-400" : "text-rose-400"
        )}
      >
        {formatTradePnlDisplayValue(summary.totalProfit, {
          mode: pnlMode,
          initialBalance: baselineInitialBalance,
          showPlus: true,
          currencyOptions: {
            maximumFractionDigits: 0,
          },
          rrMaximumFractionDigits: 1,
        })}
      </span>
      <span>{summary.winRate}% win rate</span>
      {isCollapsed ? (
        <span className="rounded-sm bg-white/[0.03] px-2 py-1 text-[10px] text-white/45 animate-in fade-in-0 duration-200">
          Collapsed
        </span>
      ) : null}
    </div>
  );
}
