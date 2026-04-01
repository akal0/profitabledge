"use client";

import * as React from "react";

import { TagMultiSelect } from "@/components/tags/tag-multi-select";
import {
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
  getTradeIdentifierColorStyle,
  getTradeProtocolTone,
} from "@/components/trades/trade-identifier-pill";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { TradeRow } from "@/features/trades/table/lib/trade-table-types";

import {
  TRADE_DETAIL_TAG_FIELDS,
  type TradeDetailField,
  type TradeDetailFormValues,
  hasTradeDetailSectionChanges,
  hasTradeDetailSectionErrors,
} from "./trade-detail-schema";
import {
  TradeDetailFieldError,
  TradeDetailSection,
  TradeDetailSectionActions,
} from "./trade-detail-shared";

type TradeDetailTagsProps = {
  customTagSuggestions: string[];
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

const PROTOCOL_OPTIONS = [
  { label: "Aligned", value: "aligned" },
  { label: "Against", value: "against" },
  { label: "Discretionary", value: "discretionary" },
] as const;

export function TradeDetailTags({
  customTagSuggestions,
  draft,
  errors,
  isSaving,
  onChange,
  onReset,
  onSave,
  savedValues,
  trade,
}: TradeDetailTagsProps) {
  const [isEditing, setIsEditing] = React.useState(false);

  React.useEffect(() => {
    setIsEditing(false);
  }, [trade.id]);

  const canSave =
    hasTradeDetailSectionChanges(draft, savedValues, TRADE_DETAIL_TAG_FIELDS) &&
    !hasTradeDetailSectionErrors(errors, TRADE_DETAIL_TAG_FIELDS);

  return (
    <TradeDetailSection
      title="Tags"
      actions={
        <TradeDetailSectionActions
          canSave={canSave}
          isEditing={isEditing}
          isSaving={isSaving}
          onCancel={() => {
            onReset(TRADE_DETAIL_TAG_FIELDS);
            setIsEditing(false);
          }}
          onEdit={() => setIsEditing(true)}
          onSave={async () => {
            const didSave = await onSave(TRADE_DETAIL_TAG_FIELDS);
            if (didSave) {
              setIsEditing(false);
            }
          }}
        />
      }
      bodyClassName="space-y-4"
    >
      {isEditing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs text-white/50">Session tag</Label>
              <Input
                value={draft.sessionTag}
                onChange={(event) => onChange("sessionTag", event.target.value)}
              />
              <TradeDetailFieldError message={errors.sessionTag} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-white/50">Edge</Label>
              <Input
                value={draft.modelTag}
                onChange={(event) => onChange("modelTag", event.target.value)}
              />
              <TradeDetailFieldError message={errors.modelTag} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-white/50">Trade tags</Label>
            <TagMultiSelect
              value={draft.customTags}
              suggestions={customTagSuggestions}
              placeholder="Add one or more trade tags"
              onChange={(nextTags) => onChange("customTags", nextTags)}
            />
            <TradeDetailFieldError message={errors.customTags} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-white/50">Protocol</Label>
            <div className="flex flex-wrap gap-2">
              {PROTOCOL_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    TRADE_IDENTIFIER_PILL_CLASS,
                    draft.protocolAlignment === option.value
                      ? getTradeProtocolTone(option.value)
                      : TRADE_IDENTIFIER_TONES.neutral
                  )}
                  onClick={() => onChange("protocolAlignment", option.value)}
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                className={cn(TRADE_IDENTIFIER_PILL_CLASS, TRADE_IDENTIFIER_TONES.neutral)}
                onClick={() => onChange("protocolAlignment", null)}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {trade.sessionTag ? (
            <span
              style={
                trade.sessionTagColor
                  ? getTradeIdentifierColorStyle(trade.sessionTagColor)
                  : undefined
              }
              className={cn(
                TRADE_IDENTIFIER_PILL_CLASS,
                !trade.sessionTagColor && TRADE_IDENTIFIER_TONES.neutral
              )}
            >
              Session: {trade.sessionTag}
            </span>
          ) : null}
          {trade.modelTag ? (
            <span
              style={
                trade.modelTagColor
                  ? getTradeIdentifierColorStyle(trade.modelTagColor)
                  : undefined
              }
              className={cn(
                TRADE_IDENTIFIER_PILL_CLASS,
                !trade.modelTagColor && TRADE_IDENTIFIER_TONES.neutral
              )}
            >
              Edge: {trade.modelTag}
            </span>
          ) : null}
          {trade.customTags?.map((tag) => (
            <span
              key={tag}
              className={cn(TRADE_IDENTIFIER_PILL_CLASS, TRADE_IDENTIFIER_TONES.neutral)}
            >
              Tag: {tag}
            </span>
          ))}
          {trade.protocolAlignment ? (
            <span
              className={cn(
                TRADE_IDENTIFIER_PILL_CLASS,
                getTradeProtocolTone(trade.protocolAlignment)
              )}
            >
              {trade.protocolAlignment === "aligned"
                ? "Aligned"
                : trade.protocolAlignment === "against"
                ? "Against"
                : "Discretionary"}
            </span>
          ) : null}
          {!trade.sessionTag &&
          !trade.modelTag &&
          !(trade.customTags?.length ?? 0) &&
          !trade.protocolAlignment ? (
            <span className="text-sm text-white/40">No tags assigned.</span>
          ) : null}
        </div>
      )}
    </TradeDetailSection>
  );
}
