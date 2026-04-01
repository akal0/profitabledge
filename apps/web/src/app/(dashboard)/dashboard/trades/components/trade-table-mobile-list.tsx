"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
} from "@/components/trades/trade-identifier-pill";
import { TradeTableEmptyState } from "@/features/trades/table/components/trade-table-empty-state";
import { formatCurrencyValue } from "@/lib/trade-formatting";
import { cn } from "@/lib/utils";
import type { TradeRow } from "@/features/trades/table/lib/trade-table-types";

type TradeTableMobileListProps = {
  emptyState?: React.ReactNode;
  focusedTradeId?: string | null;
  onOpenTrade: (trade: TradeRow) => void;
  onRowClick: (trade: TradeRow) => void;
  onRowPointerDown: (event: React.PointerEvent, rowId: string) => void;
  onRowPointerEnter: (rowId: string) => void;
  rows: TradeRow[];
  selectedTradeIds: Set<string>;
  suppressNextClick: () => boolean;
  toggleTradeSelection: (tradeId: string) => void;
};

export function TradeTableMobileList({
  emptyState,
  focusedTradeId,
  onOpenTrade,
  onRowClick,
  onRowPointerDown,
  onRowPointerEnter,
  rows,
  selectedTradeIds,
  suppressNextClick,
  toggleTradeSelection,
}: TradeTableMobileListProps) {
  if (rows.length === 0) {
    return emptyState ?? <TradeTableEmptyState title="No trades" description="No trades to show." />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
      {rows.map((trade) => {
        const isSelected = selectedTradeIds.has(trade.id);
        const isFocused = focusedTradeId === trade.id;
        const outcomeTone =
          trade.outcome === "Win" || trade.outcome === "PW"
            ? TRADE_IDENTIFIER_TONES.positive
            : trade.outcome === "Loss"
            ? TRADE_IDENTIFIER_TONES.negative
            : TRADE_IDENTIFIER_TONES.neutral;

        return (
          <div
            key={trade.id}
            className={cn(
              "bg-sidebar border border-white/5 rounded-md p-4 space-y-3 transition-colors",
              isSelected && "bg-sidebar-accent/80",
              isFocused && "ring-1 ring-teal-400/40"
            )}
            onClick={() => {
              if (suppressNextClick()) {
                return;
              }
              onRowClick(trade);
              onOpenTrade(trade);
            }}
            onPointerDown={(event) => onRowPointerDown(event, trade.id)}
            onPointerEnter={() => onRowPointerEnter(trade.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tracking-wide text-white">
                    {trade.symbol}
                  </span>
                  <span
                    className={cn(
                      TRADE_IDENTIFIER_PILL_CLASS,
                      trade.tradeDirection === "long"
                        ? TRADE_IDENTIFIER_TONES.positive
                        : TRADE_IDENTIFIER_TONES.negative
                    )}
                  >
                    {trade.tradeDirection === "long" ? (
                      <ArrowUpRight className="size-3" />
                    ) : (
                      <ArrowDownRight className="size-3" />
                    )}
                    {trade.tradeDirection}
                  </span>
                </div>
                <div className="text-xs text-white/45">
                  {new Date(trade.open).toLocaleDateString()} • {trade.holdSeconds}s
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={isSelected}
                  aria-label={`Select ${trade.symbol}`}
                  className="rounded-none border-white/10"
                  onCheckedChange={() => toggleTradeSelection(trade.id)}
                  onClick={(event) => event.stopPropagation()}
                />
                {isSelected ? (
                  <span className="flex size-6 items-center justify-center rounded-sm border border-teal-400/20 bg-teal-400/10 text-teal-300">
                    <Check className="size-3.5" />
                  </span>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-white/35">
                  Profit
                </p>
                <p className={cn("font-medium", trade.profit >= 0 ? "text-teal-400" : "text-rose-400")}>
                  {formatCurrencyValue(Number(trade.profit || 0), {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-white/35">
                  Outcome
                </p>
                <span className={cn(TRADE_IDENTIFIER_PILL_CLASS, outcomeTone)}>
                  {trade.isLive ? "Live" : trade.outcome || "—"}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-8 w-full rounded-sm border-white/10 bg-transparent text-xs text-white/75 hover:bg-sidebar-accent"
              onClick={(event) => {
                event.stopPropagation();
                onRowClick(trade);
                onOpenTrade(trade);
              }}
            >
              View trade
            </Button>
          </div>
        );
      })}
    </div>
  );
}
