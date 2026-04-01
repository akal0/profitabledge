"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrencyValue } from "@/lib/trade-formatting";
import { cn } from "@/lib/utils";
import type { TradeRow } from "@/features/trades/table/lib/trade-table-types";

import {
  TRADE_DETAIL_ADVANCED_FIELDS,
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

type TradeDetailAdvancedProps = {
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

export function TradeDetailAdvanced({
  draft,
  errors,
  isSaving,
  onChange,
  onReset,
  onSave,
  savedValues,
  trade,
}: TradeDetailAdvancedProps) {
  const [isEditing, setIsEditing] = React.useState(false);

  React.useEffect(() => {
    setIsEditing(false);
  }, [trade.id]);

  const canSave =
    hasTradeDetailSectionChanges(
      draft,
      savedValues,
      TRADE_DETAIL_ADVANCED_FIELDS
    ) && !hasTradeDetailSectionErrors(errors, TRADE_DETAIL_ADVANCED_FIELDS);

  const commission = Math.abs(Number(trade.commissions || 0));
  const swap = Math.abs(Math.min(0, Number(trade.swap || 0)));
  const grossPnl = Number(trade.profit || 0) + commission + swap;
  const totalCost = commission + swap;
  const costPct = grossPnl !== 0 ? (totalCost / Math.abs(grossPnl)) * 100 : 0;
  const commissionPct = totalCost > 0 ? (commission / totalCost) * 100 : 0;
  const swapPct = Math.max(0, 100 - commissionPct);

  return (
    <TradeDetailSection
      title="Advanced"
      actions={
        <TradeDetailSectionActions
          canSave={canSave}
          isEditing={isEditing}
          isSaving={isSaving}
          onCancel={() => {
            onReset(TRADE_DETAIL_ADVANCED_FIELDS);
            setIsEditing(false);
          }}
          onEdit={() => setIsEditing(true)}
          onSave={async () => {
            const didSave = await onSave(TRADE_DETAIL_ADVANCED_FIELDS);
            if (didSave) {
              setIsEditing(false);
            }
          }}
        />
      }
      bodyClassName="space-y-5"
    >
      {isEditing ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs text-white/50">Stop loss</Label>
            <Input
              type="number"
              step="0.00001"
              placeholder="Leave blank to clear"
              value={draft.sl}
              onChange={(event) => onChange("sl", event.target.value)}
            />
            <TradeDetailFieldError message={errors.sl} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-white/50">Take profit</Label>
            <Input
              type="number"
              step="0.00001"
              placeholder="Leave blank to clear"
              value={draft.tp}
              onChange={(event) => onChange("tp", event.target.value)}
            />
            <TradeDetailFieldError message={errors.tp} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <TradeDetailStaticRow label="Stop loss" value={trade.sl?.toFixed(5) || "—"} />
          <TradeDetailStaticRow label="Take profit" value={trade.tp?.toFixed(5) || "—"} />
          <TradeDetailStaticRow label="Drawdown" value={trade.drawdown?.toFixed(2) || "—"} />
          <TradeDetailStaticRow
            label="Manipulation pips"
            value={trade.manipulationPips?.toFixed(1) || "—"}
          />
          <TradeDetailStaticRow
            label="Time to peak"
            value={trade.entryPeakDurationSeconds != null ? `${trade.entryPeakDurationSeconds}s` : "—"}
          />
          <TradeDetailStaticRow
            label="Time to PE"
            value={trade.postExitPeakDurationSeconds != null ? `${trade.postExitPeakDurationSeconds}s` : "—"}
          />
        </div>
      )}

      {totalCost > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Gross P&amp;L</span>
            <span className={cn("font-medium", grossPnl >= 0 ? "text-teal-400" : "text-rose-400")}>
              {formatCurrencyValue(grossPnl, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>

          <div className="space-y-2">
            <div className="h-3.5 overflow-hidden bg-white/5">
              <div className="flex h-full" style={{ width: `${Math.min(costPct, 100)}%` }}>
                {commission > 0 ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="h-full" style={{ width: `${commissionPct}%`, backgroundColor: "#A1A1AA" }} />
                    </TooltipTrigger>
                    <TooltipContent sideOffset={6}>Commissions</TooltipContent>
                  </Tooltip>
                ) : null}
                {swap > 0 ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="h-full" style={{ width: `${swapPct}%`, backgroundColor: "#6B7280" }} />
                    </TooltipTrigger>
                    <TooltipContent sideOffset={6}>Swap</TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
            </div>
            <p className="text-right text-[10px] text-white/30">
              Costs = {costPct.toFixed(1)}% of gross P&amp;L
            </p>
          </div>
        </div>
      ) : null}

      {trade.complianceStatus && trade.complianceStatus !== "unknown" ? (
        <div className="space-y-2 text-sm">
          <div className="text-xs font-semibold tracking-wide text-white/50">
            Rule compliance
          </div>
          <div
            className={cn(
              "rounded-sm border px-3 py-2 text-sm font-medium",
              trade.complianceStatus === "pass"
                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                : "border-rose-400/20 bg-rose-400/10 text-rose-300"
            )}
          >
            {trade.complianceStatus === "pass"
              ? "All rules passed"
              : "Rule violations detected"}
          </div>
          {trade.complianceFlags?.length ? (
            <div className="flex flex-wrap gap-2">
              {trade.complianceFlags.map((flag) => (
                <span
                  key={flag}
                  className="rounded-sm border border-rose-400/20 bg-rose-400/10 px-2 py-1 text-[11px] text-rose-200"
                >
                  {flag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </TradeDetailSection>
  );
}
