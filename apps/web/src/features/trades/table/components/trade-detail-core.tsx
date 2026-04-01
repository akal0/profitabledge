"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import {
  TradeDateTimeField,
  parseDateTimeInputValue,
  toDateTimeInputValue,
} from "@/components/trades/trade-date-time-field";
import {
  TRADE_IDENTIFIER_TONES,
  TRADE_SURFACE_CARD_CLASS,
} from "@/components/trades/trade-identifier-pill";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { TradeRow } from "@/features/trades/table/lib/trade-table-types";

import {
  TRADE_DETAIL_CORE_FIELDS,
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

type TradeDetailCoreProps = {
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

export function TradeDetailCore({
  draft,
  errors,
  isSaving,
  onChange,
  onReset,
  onSave,
  savedValues,
  trade,
}: TradeDetailCoreProps) {
  const [isEditing, setIsEditing] = React.useState(false);

  React.useEffect(() => {
    setIsEditing(false);
  }, [trade.id]);

  const canSave =
    hasTradeDetailSectionChanges(draft, savedValues, TRADE_DETAIL_CORE_FIELDS) &&
    !hasTradeDetailSectionErrors(errors, TRADE_DETAIL_CORE_FIELDS);

  return (
    <TradeDetailSection
      title="Trade details"
      actions={
        <TradeDetailSectionActions
          canSave={canSave}
          isEditing={isEditing}
          isSaving={isSaving}
          onCancel={() => {
            onReset(TRADE_DETAIL_CORE_FIELDS);
            setIsEditing(false);
          }}
          onEdit={() => setIsEditing(true)}
          onSave={async () => {
            const didSave = await onSave(TRADE_DETAIL_CORE_FIELDS);
            if (didSave) {
              setIsEditing(false);
            }
          }}
        />
      }
    >
      {isEditing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs text-white/50">Symbol</Label>
              <Input
                value={draft.symbol}
                onChange={(event) =>
                  onChange("symbol", event.target.value.toUpperCase())
                }
              />
              <TradeDetailFieldError message={errors.symbol} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-white/50">Direction</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className={cn(
                    TRADE_SURFACE_CARD_CLASS,
                    "flex cursor-pointer items-center justify-center gap-2 px-4 py-2 text-sm font-semibold capitalize transition-colors",
                    draft.tradeType === "long"
                      ? TRADE_IDENTIFIER_TONES.positive
                      : "text-white/40 opacity-50"
                  )}
                  onClick={() => onChange("tradeType", "long")}
                >
                  Long
                  <ArrowUpRight className="size-3.5" />
                </button>
                <button
                  type="button"
                  className={cn(
                    TRADE_SURFACE_CARD_CLASS,
                    "flex cursor-pointer items-center justify-center gap-2 px-4 py-2 text-sm font-semibold capitalize transition-colors",
                    draft.tradeType === "short"
                      ? TRADE_IDENTIFIER_TONES.negative
                      : "text-white/40 opacity-50"
                  )}
                  onClick={() => onChange("tradeType", "short")}
                >
                  Short
                  <ArrowDownRight className="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { field: "volume", label: "Volume", min: "0.01", step: "0.01" },
              { field: "openPrice", label: "Open price", step: "0.00001" },
              { field: "closePrice", label: "Close price", step: "0.00001" },
            ].map((item) => (
              <div key={item.field} className="space-y-2">
                <Label className="text-xs text-white/50">{item.label}</Label>
                <Input
                  type="number"
                  min={item.min}
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <TradeDateTimeField
                label="Opened"
                value={
                  parseDateTimeInputValue(draft.openTime) ?? new Date(trade.open)
                }
                onChange={(nextValue) =>
                  onChange("openTime", toDateTimeInputValue(nextValue) as never)
                }
                triggerClassName={cn(
                  TRADE_SURFACE_CARD_CLASS,
                  "h-9 w-full justify-start px-3 text-left text-white/85"
                )}
              />
              <TradeDetailFieldError message={errors.openTime} />
            </div>

            <div className="space-y-2">
              <TradeDateTimeField
                label="Closed"
                value={
                  parseDateTimeInputValue(draft.closeTime) ?? new Date(trade.close)
                }
                onChange={(nextValue) =>
                  onChange("closeTime", toDateTimeInputValue(nextValue) as never)
                }
                triggerClassName={cn(
                  TRADE_SURFACE_CARD_CLASS,
                  "h-9 w-full justify-start px-3 text-left text-white/85"
                )}
              />
              <TradeDetailFieldError message={errors.closeTime} />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <TradeDetailStaticRow
            label="Entry price"
            value={trade.openPrice?.toFixed(5) || "—"}
          />
          <TradeDetailStaticRow
            label="Exit price"
            value={trade.closePrice?.toFixed(5) || "—"}
          />
          <TradeDetailStaticRow label="Volume" value={`${trade.volume} lots`} />
          <TradeDetailStaticRow
            label="Opened"
            value={new Date(trade.open).toLocaleString()}
          />
          <TradeDetailStaticRow
            label="Closed"
            value={new Date(trade.close).toLocaleString()}
          />
          <TradeDetailStaticRow
            label="Pips"
            value={trade.pips?.toFixed(1) || "—"}
          />
        </div>
      )}
    </TradeDetailSection>
  );
}
