"use client";

import * as React from "react";
import { Check, ChevronRight, CircleAlert, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatCurrencyValue, formatNumberValue } from "@/lib/trade-formatting";
import type {
  ManualTradeCaptureBulkResult,
  ManualTradeCaptureParseResult,
  ManualTradeCaptureResult,
} from "@/lib/manual-workspace/manual-trade-capture-types";

type ManualTradeCapturePreviewProps = {
  result: ManualTradeCaptureParseResult | null;
  className?: string;
  maxRows?: number;
};

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function PreviewField({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/8 bg-black/20 p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">
        {label}
      </p>
      <div
        className={cn(
          "mt-1 text-sm",
          accent ? "font-semibold text-white" : "text-white/75"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function renderSingleFieldValue(
  result: ManualTradeCaptureResult,
  key: keyof ManualTradeCaptureResult["fields"]
): React.ReactNode {
  switch (key) {
    case "openTime":
      return formatDateTime(result.fields.openTime.value);
    case "closeTime":
      return formatDateTime(result.fields.closeTime.value);
    case "profit":
      return result.fields.profit.value == null
        ? "—"
        : formatCurrencyValue(result.fields.profit.value, { showPlus: true });
    case "commission":
      return result.fields.commission.value == null
        ? "—"
        : formatCurrencyValue(result.fields.commission.value, {
            showPlus: true,
          });
    case "swap":
      return result.fields.swap.value == null
        ? "—"
        : formatCurrencyValue(result.fields.swap.value, { showPlus: true });
    case "volume":
      return result.fields.volume.value == null
        ? "—"
        : formatNumberValue(result.fields.volume.value);
    case "direction":
      return result.fields.direction.value ?? "—";
    case "symbol":
      return result.fields.symbol.value ?? "—";
    case "notes":
      return result.fields.notes.value ?? "—";
    case "openPrice":
      return result.fields.openPrice.value == null
        ? "—"
        : formatNumberValue(result.fields.openPrice.value, {
            showPlus: false,
            maximumFractionDigits: 5,
          });
    case "closePrice":
      return result.fields.closePrice.value == null
        ? "—"
        : formatNumberValue(result.fields.closePrice.value, {
            showPlus: false,
            maximumFractionDigits: 5,
          });
    case "stopLoss":
      return result.fields.stopLoss.value == null
        ? "—"
        : formatNumberValue(result.fields.stopLoss.value, {
            showPlus: false,
            maximumFractionDigits: 5,
          });
    case "takeProfit":
      return result.fields.takeProfit.value == null
        ? "—"
        : formatNumberValue(result.fields.takeProfit.value, {
            showPlus: false,
            maximumFractionDigits: 5,
          });
    default:
      return "—";
  }
}

function renderDerivedValue(
  result: ManualTradeCaptureResult,
  key: keyof ManualTradeCaptureResult["derived"]
): React.ReactNode {
  switch (key) {
    case "isOpenTrade":
      return result.derived.isOpenTrade.value ? "Open trade" : "Closed trade";
    case "holdSeconds":
      return result.derived.holdSeconds.value == null
        ? "—"
        : `${Math.floor(result.derived.holdSeconds.value / 3600)}h ${Math.floor(
            (result.derived.holdSeconds.value % 3600) / 60
          )}m`;
    case "estimatedProfit":
      return result.derived.estimatedProfit.value == null
        ? "—"
        : formatCurrencyValue(result.derived.estimatedProfit.value, {
            showPlus: true,
          });
    case "netPnl":
      return result.derived.netPnl.value == null
        ? "—"
        : formatCurrencyValue(result.derived.netPnl.value, { showPlus: true });
    case "estimatedPips":
      return result.derived.estimatedPips.value == null
        ? "—"
        : `${formatNumberValue(result.derived.estimatedPips.value, {
            showPlus: true,
            maximumFractionDigits: 2,
            minimumFractionDigits: 2,
          })} pips`;
    case "riskPips":
      return result.derived.riskPips.value == null
        ? "—"
        : `${formatNumberValue(result.derived.riskPips.value, {
            showPlus: true,
            maximumFractionDigits: 2,
            minimumFractionDigits: 2,
          })} pips`;
    case "targetPips":
      return result.derived.targetPips.value == null
        ? "—"
        : `${formatNumberValue(result.derived.targetPips.value, {
            showPlus: true,
            maximumFractionDigits: 2,
            minimumFractionDigits: 2,
          })} pips`;
    case "plannedRR":
      return result.derived.plannedRR.value == null
        ? "—"
        : `${formatNumberValue(result.derived.plannedRR.value, {
            showPlus: false,
            maximumFractionDigits: 2,
            minimumFractionDigits: 2,
          })}R`;
    default:
      return "—";
  }
}

function SingleCapturePreview({
  result,
}: {
  result: ManualTradeCaptureResult;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="border-white/10 bg-white/[0.03] text-white/70"
        >
          {result.sourceKind}
        </Badge>
        <Badge
          variant="outline"
          className={cn(
            "border-white/10",
            result.confidence >= 75
              ? "bg-teal-500/15 text-teal-200"
              : result.confidence >= 45
              ? "bg-amber-500/15 text-amber-200"
              : "bg-rose-500/15 text-rose-200"
          )}
        >
          {result.confidence}% confidence
        </Badge>
        {result.warnings.length === 0 ? (
          <Badge
            variant="outline"
            className="border-white/10 bg-emerald-500/15 text-emerald-200"
          >
            <Check className="size-3" />
            Parsed cleanly
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-white/10 bg-rose-500/15 text-rose-200"
          >
            <CircleAlert className="size-3" />
            {result.warnings.length} warning
            {result.warnings.length === 1 ? "" : "s"}
          </Badge>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PreviewField
          label="Symbol"
          value={renderSingleFieldValue(result, "symbol")}
          accent
        />
        <PreviewField
          label="Direction"
          value={renderSingleFieldValue(result, "direction")}
        />
        <PreviewField
          label="Volume"
          value={renderSingleFieldValue(result, "volume")}
        />
        <PreviewField
          label="Entry price"
          value={renderSingleFieldValue(result, "openPrice")}
        />
        <PreviewField
          label="Exit price"
          value={renderSingleFieldValue(result, "closePrice")}
        />
        <PreviewField
          label="Stop loss"
          value={renderSingleFieldValue(result, "stopLoss")}
        />
        <PreviewField
          label="Take profit"
          value={renderSingleFieldValue(result, "takeProfit")}
        />
        <PreviewField
          label="Profit"
          value={renderSingleFieldValue(result, "profit")}
        />
        <PreviewField
          label="Commission"
          value={renderSingleFieldValue(result, "commission")}
        />
        <PreviewField
          label="Swap"
          value={renderSingleFieldValue(result, "swap")}
        />
        <PreviewField
          label="Open time"
          value={renderSingleFieldValue(result, "openTime")}
        />
        <PreviewField
          label="Close time"
          value={renderSingleFieldValue(result, "closeTime")}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PreviewField
          label="Trade state"
          value={renderDerivedValue(result, "isOpenTrade")}
        />
        <PreviewField
          label="Hold"
          value={renderDerivedValue(result, "holdSeconds")}
        />
        <PreviewField
          label="Estimated P&L"
          value={renderDerivedValue(result, "estimatedProfit")}
        />
        <PreviewField
          label="Net P&L"
          value={renderDerivedValue(result, "netPnl")}
        />
        <PreviewField
          label="Estimated pips"
          value={renderDerivedValue(result, "estimatedPips")}
        />
        <PreviewField
          label="Risk pips"
          value={renderDerivedValue(result, "riskPips")}
        />
        <PreviewField
          label="Target pips"
          value={renderDerivedValue(result, "targetPips")}
        />
        <PreviewField
          label="Planned RR"
          value={renderDerivedValue(result, "plannedRR")}
        />
      </div>

      {result.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/80">
            Needs review
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-100/80">
            {result.warnings.map((warning) => (
              <li key={warning} className="flex items-start gap-2">
                <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-amber-300" />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.residualText.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-black/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            Notes captured
          </p>
          <p className="mt-2 text-sm leading-6 text-white/70">
            {result.residualText.join(" ")}
          </p>
        </div>
      )}
    </div>
  );
}

function BulkCapturePreview({
  result,
  maxRows = 8,
}: {
  result: ManualTradeCaptureBulkResult;
  maxRows?: number;
}) {
  const visibleRows = result.rows.slice(0, maxRows);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="border-white/10 bg-white/[0.03] text-white/70"
        >
          Bulk capture
        </Badge>
        <Badge
          variant="outline"
          className="border-white/10 bg-white/[0.03] text-white/70"
        >
          {result.rows.length} row{result.rows.length === 1 ? "" : "s"}
        </Badge>
        <Badge
          variant="outline"
          className="border-white/10 bg-white/[0.03] text-white/70"
        >
          {result.hasHeader ? "Header detected" : "No header"}
        </Badge>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/8 bg-black/20">
        <ScrollArea className="max-h-[32rem]">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-12 gap-0 border-b border-white/8 bg-white/[0.03] text-[10px] uppercase tracking-[0.18em] text-white/40">
              <div className="col-span-2 px-4 py-3">Symbol</div>
              <div className="col-span-1 px-4 py-3">Dir</div>
              <div className="col-span-1 px-4 py-3">Size</div>
              <div className="col-span-1 px-4 py-3">Entry</div>
              <div className="col-span-1 px-4 py-3">Exit</div>
              <div className="col-span-1 px-4 py-3">SL</div>
              <div className="col-span-1 px-4 py-3">TP</div>
              <div className="col-span-1 px-4 py-3">P&L</div>
              <div className="col-span-1 px-4 py-3">Open</div>
              <div className="col-span-1 px-4 py-3">Close</div>
              <div className="col-span-1 px-4 py-3">RR</div>
            </div>

            {visibleRows.map((row, index) => (
              <div
                key={`${row.rawText}-${index}`}
                className="grid grid-cols-12 border-b border-white/5 text-sm text-white/75 last:border-b-0"
              >
                <div className="col-span-2 px-4 py-3 font-medium text-white">
                  {row.fields.symbol.value ?? "—"}
                </div>
                <div className="col-span-1 px-4 py-3">
                  {row.fields.direction.value ?? "—"}
                </div>
                <div className="col-span-1 px-4 py-3">
                  {row.fields.volume.value == null
                    ? "—"
                    : formatNumberValue(row.fields.volume.value, {
                        maximumFractionDigits: 2,
                      })}
                </div>
                <div className="col-span-1 px-4 py-3">
                  {row.fields.openPrice.value == null
                    ? "—"
                    : formatNumberValue(row.fields.openPrice.value, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 5,
                      })}
                </div>
                <div className="col-span-1 px-4 py-3">
                  {row.fields.closePrice.value == null
                    ? "—"
                    : formatNumberValue(row.fields.closePrice.value, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 5,
                      })}
                </div>
                <div className="col-span-1 px-4 py-3">
                  {row.fields.stopLoss.value == null
                    ? "—"
                    : formatNumberValue(row.fields.stopLoss.value, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 5,
                      })}
                </div>
                <div className="col-span-1 px-4 py-3">
                  {row.fields.takeProfit.value == null
                    ? "—"
                    : formatNumberValue(row.fields.takeProfit.value, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 5,
                      })}
                </div>
                <div className="col-span-1 px-4 py-3">
                  {row.derived.netPnl.value == null
                    ? row.fields.profit.value == null
                      ? "—"
                      : formatCurrencyValue(row.fields.profit.value, {
                          showPlus: true,
                        })
                    : formatCurrencyValue(row.derived.netPnl.value, {
                        showPlus: true,
                      })}
                </div>
                <div className="col-span-1 px-4 py-3">
                  {row.fields.openTime.value
                    ? formatDateTime(row.fields.openTime.value)
                    : "—"}
                </div>
                <div className="col-span-1 px-4 py-3">
                  {row.fields.closeTime.value
                    ? formatDateTime(row.fields.closeTime.value)
                    : "—"}
                </div>
                <div className="col-span-1 px-4 py-3">
                  {row.derived.plannedRR.value == null
                    ? "—"
                    : `${formatNumberValue(row.derived.plannedRR.value, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}R`}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

export function ManualTradeCapturePreview({
  result,
  className,
  maxRows,
}: ManualTradeCapturePreviewProps) {
  if (!result) return null;

  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden border-white/10 bg-[#171718]",
        className
      )}
    >
      <CardHeader className="border-b border-white/8 px-5 py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
          <Sparkles className="size-4 text-teal-300" />
          Manual capture preview
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {result.kind === "bulk" ? (
          <BulkCapturePreview result={result} maxRows={maxRows} />
        ) : (
          <SingleCapturePreview result={result} />
        )}
      </CardContent>
    </Card>
  );
}
