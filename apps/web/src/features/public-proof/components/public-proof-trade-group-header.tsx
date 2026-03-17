"use client";

import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/features/public-proof/lib/public-proof-formatters";
import {
  summarizePublicProofGroup,
  type PublicProofTradeRow,
} from "@/features/public-proof/lib/public-proof-trades-table";

export function PublicProofTradeGroupHeader({
  groupKey,
  rows,
  isCollapsed,
  onToggleCollapsed,
}: {
  groupKey: string;
  rows: PublicProofTradeRow[];
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const summary = summarizePublicProofGroup(rows);

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
        {formatCurrency(summary.totalProfit)}
      </span>
      <span>{summary.winRate}% win rate</span>
      {isCollapsed ? (
        <span className="animate-in fade-in-0 rounded-sm bg-white/[0.03] px-2 py-1 text-[10px] text-white/45 duration-200">
          Collapsed
        </span>
      ) : null}
    </div>
  );
}
