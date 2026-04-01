"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrencyValue } from "@/lib/trade-formatting";
import { cn } from "@/lib/utils";
import {
  formatTradePipValue,
  getTradeCommissionTone,
  getTradeEfficiencyTone,
  getTradeExitEfficiencyTone,
  getTradeMaxRRTone,
  getTradeProfitTone,
  getTradeRealisedRRTone,
  getTradeSwapTone,
} from "@/features/trades/table/lib/trade-table-formatting";
import type { TradeRow } from "@/features/trades/table/lib/trade-table-types";
import {
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
} from "@/components/trades/trade-identifier-pill";

import {
  TRADE_DETAIL_METRIC_FIELDS,
  type TradeDetailField,
  type TradeDetailFormValues,
  hasTradeDetailSectionChanges,
  hasTradeDetailSectionErrors,
} from "./trade-detail-schema";
import {
  TradeDetailFieldError,
  TradeDetailSection,
  TradeDetailSectionActions,
  TradeDetailStaticRow,
} from "./trade-detail-shared";

type TradeDetailMetricsProps = {
  draft: TradeDetailFormValues;
  errors: Partial<Record<TradeDetailField, string>>;
  isSaving: boolean;
  onChange: <TField extends TradeDetailField>(
    field: TField,
    value: TradeDetailFormValues[TField]
  ) => void;
  onReset: (fields: readonly TradeDetailField[]) => void;
  onSave: (fields: readonly TradeDetailField[]) => Promise<boolean>;
  savedValues: TradeDetailFormValues;
  trade: TradeRow;
};

export function TradeDetailMetrics({
  draft,
  errors,
  isSaving,
  onChange,
  onReset,
  onSave,
  savedValues,
  trade,
}: TradeDetailMetricsProps) {
  const [isEditing, setIsEditing] = React.useState(false);

  React.useEffect(() => {
    setIsEditing(false);
  }, [trade.id]);

  const canSave =
    hasTradeDetailSectionChanges(draft, savedValues, TRADE_DETAIL_METRIC_FIELDS) &&
    !hasTradeDetailSectionErrors(errors, TRADE_DETAIL_METRIC_FIELDS);

  return (
    <TradeDetailSection
      title="Performance"
      actions={
        <TradeDetailSectionActions
          canSave={canSave}
          isEditing={isEditing}
          isSaving={isSaving}
          onCancel={() => {
            onReset(TRADE_DETAIL_METRIC_FIELDS);
            setIsEditing(false);
          }}
          onEdit={() => setIsEditing(true)}
          onSave={async () => {
            const didSave = await onSave(TRADE_DETAIL_METRIC_FIELDS);
            if (didSave) {
              setIsEditing(false);
            }
          }}
        />
      }
    >
      {isEditing ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { field: "profit", label: "Profit", step: "0.01" },
            { field: "commissions", label: "Commissions", step: "0.01" },
            { field: "swap", label: "Swap", step: "0.01" },
          ].map((item) => (
            <div key={item.field} className="space-y-2">
              <Label className="text-xs text-white/50">{item.label}</Label>
              <Input
                type="number"
                step={item.step}
                value={draft[item.field as keyof TradeDetailFormValues] as string}
                onChange={(event) =>
                  onChange(
                    item.field as TradeDetailField,
                    event.target.value as never
                  )
                }
              />
              <TradeDetailFieldError
                message={errors[item.field as TradeDetailField]}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <TradeDetailStaticRow
            label="Realised RR"
            value={
              trade.realisedRR != null ? (
                <span
                  className={cn(
                    TRADE_IDENTIFIER_PILL_CLASS,
                    getTradeRealisedRRTone(Number(trade.realisedRR))
                  )}
                >
                  {Number(trade.realisedRR) > 0 ? "+" : ""}
                  {Number(trade.realisedRR).toFixed(2)}R
                </span>
              ) : (
                "—"
              )
            }
          />
          <TradeDetailStaticRow
            label="Max RR"
            value={
              trade.maxRR != null ? (
                <span
                  className={cn(
                    TRADE_IDENTIFIER_PILL_CLASS,
                    getTradeMaxRRTone(Number(trade.maxRR))
                  )}
                >
                  {Number(trade.maxRR).toFixed(2)}R
                </span>
              ) : (
                "—"
              )
            }
          />
          <TradeDetailStaticRow
            label="RR efficiency"
            value={
              trade.rrCaptureEfficiency != null ? (
                <span
                  className={cn(
                    TRADE_IDENTIFIER_PILL_CLASS,
                    getTradeEfficiencyTone(
                      Number(trade.rrCaptureEfficiency),
                      75,
                      50,
                      25
                    )
                  )}
                >
                  {Number(trade.rrCaptureEfficiency).toFixed(1)}%
                </span>
              ) : (
                "—"
              )
            }
          />
          <TradeDetailStaticRow
            label="Exit efficiency"
            value={
              trade.exitEfficiency != null ? (
                <span
                  className={cn(
                    TRADE_IDENTIFIER_PILL_CLASS,
                    getTradeExitEfficiencyTone(Number(trade.exitEfficiency))
                  )}
                >
                  {Number(trade.exitEfficiency).toFixed(1)}%
                </span>
              ) : (
                "—"
              )
            }
          />
          <TradeDetailStaticRow
            label="MFE"
            value={
              trade.mfePips != null ? (
                <span
                  className={cn(
                    TRADE_IDENTIFIER_PILL_CLASS,
                    TRADE_IDENTIFIER_TONES.positive
                  )}
                >
                  {formatTradePipValue(trade.mfePips, trade)}
                </span>
              ) : (
                "—"
              )
            }
          />
          <TradeDetailStaticRow
            label="MAE"
            value={
              trade.maePips != null ? (
                <span
                  className={cn(
                    TRADE_IDENTIFIER_PILL_CLASS,
                    TRADE_IDENTIFIER_TONES.negative
                  )}
                >
                  {formatTradePipValue(trade.maePips, trade)}
                </span>
              ) : (
                "—"
              )
            }
          />
          <TradeDetailStaticRow
            label="Commissions"
            value={
              <span
                className={cn(
                  TRADE_IDENTIFIER_PILL_CLASS,
                  getTradeCommissionTone(Number(trade.commissions || 0))
                )}
              >
                {formatCurrencyValue(Math.abs(Number(trade.commissions || 0)), {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            }
          />
          <TradeDetailStaticRow
            label="Swap"
            value={
              <span
                className={cn(
                  TRADE_IDENTIFIER_PILL_CLASS,
                  getTradeSwapTone(Number(trade.swap || 0))
                )}
              >
                {formatCurrencyValue(Number(trade.swap || 0), {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            }
          />
          <TradeDetailStaticRow
            label="Profit"
            value={
              <span
                className={cn(
                  TRADE_IDENTIFIER_PILL_CLASS,
                  getTradeProfitTone(Number(trade.profit || 0))
                )}
              >
                {formatCurrencyValue(Number(trade.profit || 0), {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            }
          />
        </div>
      )}
    </TradeDetailSection>
  );
}
