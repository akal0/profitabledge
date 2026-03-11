"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrencyValue, formatNumberValue } from "@/lib/trade-formatting";
import {
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
  getTradeDirectionTone,
  getTradeOutcomeTone,
  getTradeProtocolTone,
} from "@/components/trades/trade-identifier-pill";

type TradeForComparison = {
  id: string;
  symbol: string;
  tradeDirection: "long" | "short";
  open: string;
  close: string;
  openPrice?: number | null;
  closePrice?: number | null;
  sl?: number | null;
  tp?: number | null;
  volume: number;
  pips?: number | null;
  profit: number;
  commissions?: number | null;
  swap?: number | null;
  holdSeconds: number;
  realisedRR?: number | null;
  maxRR?: number | null;
  rrCaptureEfficiency?: number | null;
  exitEfficiency?: number | null;
  mfePips?: number | null;
  maePips?: number | null;
  entrySpreadPips?: number | null;
  exitSpreadPips?: number | null;
  sessionTag?: string | null;
  modelTag?: string | null;
  protocolAlignment?: string | null;
  outcome?: string | null;
  openText?: string | null;
  closeText?: string | null;
};

interface TradeComparisonSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trades: TradeForComparison[];
}

export function TradeComparisonSheet({
  open,
  onOpenChange,
  trades,
}: TradeComparisonSheetProps) {
  const formatFixedNumber = (value: number, decimals: number) =>
    formatNumberValue(value, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  const gridColumnsStyle = React.useMemo(
    () => ({
      gridTemplateColumns: `repeat(${Math.max(trades.length, 1)}, minmax(0, 1fr))`,
    }),
    [trades.length]
  );

  const formatHoldTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getProfitTone = (value: number) =>
    value < 0
      ? TRADE_IDENTIFIER_TONES.negative
      : value > 0
      ? TRADE_IDENTIFIER_TONES.positive
      : TRADE_IDENTIFIER_TONES.neutral;

  const ComparisonMetric = ({
    label,
    values,
    formatter = (v) => String(v),
    comparator,
    highlightBest = false,
    renderValue,
  }: {
    label: string;
    values: (number | string | null | undefined)[];
    formatter?: (v: any) => string;
    comparator?: "higher" | "lower";
    highlightBest?: boolean;
    renderValue?: (
      value: number | string | null | undefined,
      idx: number,
      isBest: boolean
    ) => React.ReactNode;
  }) => {
    const numericValues = values.map((v) =>
      typeof v === "number" ? v : null
    );
    const bestIdx =
      highlightBest && comparator && numericValues.some((v) => v !== null)
        ? numericValues.indexOf(
            comparator === "higher"
              ? Math.max(...numericValues.filter((v) => v !== null) as number[])
              : Math.min(...numericValues.filter((v) => v !== null) as number[])
          )
        : -1;

    return (
      <div className="grid grid-cols-[200px_1fr] gap-4 items-center py-2">
        <span className="text-xs text-white/50">{label}</span>
        <div className="grid gap-4" style={gridColumnsStyle}>
          {values.map((value, idx) => {
            const isBest = highlightBest && idx === bestIdx;

            if (renderValue) {
              return (
                <div key={idx} className="flex justify-center">
                  {renderValue(value, idx, isBest)}
                </div>
              );
            }

            return (
              <span
                key={idx}
                className={cn(
                  "text-sm font-medium text-center",
                  isBest && "text-teal-400"
                )}
              >
                {value != null ? formatter(value) : "—"}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  if (trades.length === 0) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader className="px-6 pb-4">
          <SheetTitle className="font-semibold text-lg tracking-wide">
            Trade Comparison ({trades.length} trades)
          </SheetTitle>
        </SheetHeader>

        <div className="px-6 space-y-6">
          {/* Header row with symbols */}
          <div className="grid grid-cols-[200px_1fr] gap-4">
            <span className="text-xs text-white/50">Symbol</span>
            <div className="grid gap-4" style={gridColumnsStyle}>
              {trades.map((trade) => (
                <div key={trade.id} className="text-center">
                  <div className="font-semibold text-base">{trade.symbol}</div>
                  <div className="text-xs text-white/40 mt-1">
                    {formatDate(trade.open)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator className="bg-white/10" />

          {/* P&L & Direction */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide">
              Performance
            </h3>

            <ComparisonMetric
              label="P&L"
              values={trades.map((t) => t.profit)}
              comparator="higher"
              highlightBest
              renderValue={(value, _idx, isBest) => {
                const amount = Number(value || 0);
                return (
                  <span
                  className={cn(
                      TRADE_IDENTIFIER_PILL_CLASS,
                      getProfitTone(amount),
                      isBest && "ring-1 ring-white/10"
                    )}
                  >
                    {formatCurrencyValue(amount, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                );
              }}
            />

            <ComparisonMetric
              label="Direction"
              values={trades.map((t) => t.tradeDirection)}
              renderValue={(value) => {
                const direction = String(value || "short");
                return (
                  <span
                    className={cn(
                      TRADE_IDENTIFIER_PILL_CLASS,
                      getTradeDirectionTone(direction),
                      "capitalize"
                    )}
                  >
                    {direction}
                    {direction === "long" ? (
                      <ArrowUpRight className="size-3" />
                    ) : (
                      <ArrowDownRight className="size-3" />
                    )}
                  </span>
                );
              }}
            />

            <ComparisonMetric
              label="Outcome"
              values={trades.map((t) => t.outcome)}
              renderValue={(value) => {
                const outcome = value ? String(value) : "—";
                const label =
                  outcome === "BE"
                    ? "Breakeven"
                    : outcome === "PW"
                    ? "Partial win"
                    : outcome;
                return (
                  <span
                    className={cn(
                      TRADE_IDENTIFIER_PILL_CLASS,
                      getTradeOutcomeTone(outcome)
                    )}
                  >
                    {label}
                  </span>
                );
              }}
            />

            <ComparisonMetric
              label="Win Rate Impact"
              values={trades.map((t) => (t.profit >= 0 ? "Win" : "Loss"))}
              renderValue={(value) => (
                <span
                  className={cn(
                    TRADE_IDENTIFIER_PILL_CLASS,
                    getTradeOutcomeTone(String(value || "Loss"))
                  )}
                >
                  {String(value || "Loss")}
                </span>
              )}
            />
          </div>

          <Separator className="bg-white/10" />

          {/* Trade Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide">
              Trade Details
            </h3>

            <ComparisonMetric
              label="Entry Price"
              values={trades.map((t) => t.openPrice)}
              formatter={(v) => v?.toFixed(5)}
            />

            <ComparisonMetric
              label="Exit Price"
              values={trades.map((t) => t.closePrice)}
              formatter={(v) => v?.toFixed(5)}
            />

            <ComparisonMetric
              label="Stop Loss"
              values={trades.map((t) => t.sl)}
              formatter={(v) => v?.toFixed(5)}
            />

            <ComparisonMetric
              label="Take Profit"
              values={trades.map((t) => t.tp)}
              formatter={(v) => v?.toFixed(5)}
            />

            <ComparisonMetric
              label="Volume"
              values={trades.map((t) => t.volume)}
              formatter={(v) =>
                `${formatNumberValue(Number(v), {
                  maximumFractionDigits: 2,
                })} lots`
              }
            />

            <ComparisonMetric
              label="Pips"
              values={trades.map((t) => t.pips)}
              formatter={(v) => formatFixedNumber(Number(v), 1)}
            />

            <ComparisonMetric
              label="Hold Time"
              values={trades.map((t) => t.holdSeconds)}
              formatter={(v) => formatHoldTime(v)}
            />
          </div>

          <Separator className="bg-white/10" />

          {/* Performance Metrics */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide">
              Risk & Reward
            </h3>

            <ComparisonMetric
              label="Realised RR"
              values={trades.map((t) => t.realisedRR)}
              formatter={(v) => `${formatFixedNumber(Number(v), 2)}R`}
              comparator="higher"
              highlightBest
            />

            <ComparisonMetric
              label="Max RR"
              values={trades.map((t) => t.maxRR)}
              formatter={(v) => `${formatFixedNumber(Number(v), 2)}R`}
            />

            <ComparisonMetric
              label="RR Efficiency"
              values={trades.map((t) => t.rrCaptureEfficiency)}
              formatter={(v) => `${formatFixedNumber(Number(v), 1)}%`}
              comparator="higher"
              highlightBest
            />

            <ComparisonMetric
              label="Exit Efficiency"
              values={trades.map((t) => t.exitEfficiency)}
              formatter={(v) => `${formatFixedNumber(Number(v), 1)}%`}
              comparator="higher"
              highlightBest
            />

            <ComparisonMetric
              label="MFE (pips)"
              values={trades.map((t) => t.mfePips)}
              formatter={(v) => formatFixedNumber(Number(v), 1)}
            />

            <ComparisonMetric
              label="MAE (pips)"
              values={trades.map((t) => t.maePips)}
              formatter={(v) => formatFixedNumber(Number(v), 1)}
            />
          </div>

          <Separator className="bg-white/10" />

          {/* Costs */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide">
              Costs
            </h3>

            <ComparisonMetric
              label="Commissions"
              values={trades.map((t) => Math.abs(Number(t.commissions || 0)))}
              formatter={(v) =>
                formatCurrencyValue(Number(v), {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              }
              comparator="lower"
              highlightBest
            />

            <ComparisonMetric
              label="Swap"
              values={trades.map((t) => t.swap)}
              formatter={(v) =>
                formatCurrencyValue(Number(v), {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              }
            />

            <ComparisonMetric
              label="Entry Spread"
              values={trades.map((t) => t.entrySpreadPips)}
              formatter={(v) => `${formatFixedNumber(Number(v), 1)} pips`}
            />

            <ComparisonMetric
              label="Exit Spread"
              values={trades.map((t) => t.exitSpreadPips)}
              formatter={(v) => `${formatFixedNumber(Number(v), 1)} pips`}
            />
          </div>

          <Separator className="bg-white/10" />

          {/* Tags */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide">
              Classification
            </h3>

            <ComparisonMetric
              label="Session"
              values={trades.map((t) => t.sessionTag || "—")}
              renderValue={(value) => (
                <span
                  className={cn(
                    TRADE_IDENTIFIER_PILL_CLASS,
                    value === "—"
                      ? TRADE_IDENTIFIER_TONES.subdued
                      : TRADE_IDENTIFIER_TONES.neutral
                  )}
                >
                  {String(value)}
                </span>
              )}
            />

            <ComparisonMetric
              label="Model"
              values={trades.map((t) => t.modelTag || "—")}
              renderValue={(value) => (
                <span
                  className={cn(
                    TRADE_IDENTIFIER_PILL_CLASS,
                    value === "—"
                      ? TRADE_IDENTIFIER_TONES.subdued
                      : TRADE_IDENTIFIER_TONES.neutral
                  )}
                >
                  {String(value)}
                </span>
              )}
            />

            <ComparisonMetric
              label="Protocol"
              values={trades.map((t) => t.protocolAlignment || "—")}
              renderValue={(value) => {
                const alignment = value ? String(value) : "—";
                const label =
                  alignment === "aligned"
                    ? "Aligned"
                    : alignment === "against"
                    ? "Against"
                    : alignment === "discretionary"
                    ? "Discretionary"
                    : alignment;
                return (
                  <span
                    className={cn(
                      TRADE_IDENTIFIER_PILL_CLASS,
                      getTradeProtocolTone(alignment)
                    )}
                  >
                    {label}
                  </span>
                );
              }}
            />
          </div>

          {/* Notes - if any trade has notes */}
          {trades.some((t) => t.openText || t.closeText) && (
            <>
              <Separator className="bg-white/10" />
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide">
                  Notes
                </h3>
                <div className="grid gap-4" style={gridColumnsStyle}>
                  {trades.map((trade) => (
                    <div key={trade.id} className="space-y-2 text-xs">
                      {trade.openText && (
                        <div>
                          <span className="text-white/50">Entry: </span>
                          <span className="text-white/80">{trade.openText}</span>
                        </div>
                      )}
                      {trade.closeText && (
                        <div>
                          <span className="text-white/50">Exit: </span>
                          <span className="text-white/80">{trade.closeText}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
