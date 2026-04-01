"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  TRADE_SURFACE_CARD_CLASS,
  getTradeDirectionTone,
} from "@/components/trades/trade-identifier-pill";
import { cn } from "@/lib/utils";
import { formatCurrencyValue } from "@/lib/trade-formatting";
import { getTradeProfitTone } from "@/features/trades/table/lib/trade-table-formatting";
import type {
  InlineTradeUpdateInput,
  TradeRow,
} from "@/features/trades/table/lib/trade-table-types";
import { queryClient, trpcClient, trpcOptions } from "@/utils/trpc";

import { TradeDetailAdvanced } from "./trade-detail-advanced";
import { TradeDetailCore } from "./trade-detail-core";
import { TradeDetailExecution } from "./trade-detail-execution";
import { TradeDetailMetrics } from "./trade-detail-metrics";
import { TradeDetailNotes } from "./trade-detail-notes";
import {
  buildTradeDetailUpdateInput,
  createTradeDetailFormValues,
  getTradeDetailDraftStorageKey,
  getTradeDetailFieldErrors,
  hasTradeDetailSectionChanges,
  hasTradeDetailSectionErrors,
  type TradeDetailField,
  type TradeDetailFormValues,
} from "./trade-detail-schema";
import { TradeDetailTags } from "./trade-detail-tags";

const ALL_TRADE_DETAIL_FIELDS = [
  "symbol",
  "tradeType",
  "volume",
  "openPrice",
  "closePrice",
  "openTime",
  "closeTime",
  "sl",
  "tp",
  "profit",
  "commissions",
  "swap",
  "sessionTag",
  "modelTag",
  "customTags",
  "protocolAlignment",
] as const satisfies TradeDetailField[];

const formatSheetDate = (iso: string) => {
  const date = new Date(iso);
  const day = date.getDate();
  const month = date.toLocaleString("en-GB", { month: "short" });
  const year = date.getFullYear();
  return `${day} ${month}' ${year}`;
};

const isSameCalendarDate = (leftIso: string, rightIso: string) => {
  const left = new Date(leftIso);
  const right = new Date(rightIso);
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
};

function readDraftFromStorage(tradeId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(
      getTradeDetailDraftStorageKey(tradeId)
    );
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as { values?: TradeDetailFormValues };
    return parsed?.values ?? null;
  } catch {
    return null;
  }
}

function areDraftValuesEqual(
  left: TradeDetailFormValues | null,
  right: TradeDetailFormValues | null
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function TradeDetailSheet({
  accountId,
  open,
  onOpenChange,
  selectedTrade,
}: {
  accountId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTrade: TradeRow | null;
}) {
  const [draftValues, setDraftValues] = React.useState<TradeDetailFormValues | null>(
    null
  );
  const [savedValues, setSavedValues] = React.useState<TradeDetailFormValues | null>(
    null
  );
  const [fieldErrors, setFieldErrors] = React.useState<
    Partial<Record<TradeDetailField, string>>
  >({});
  const [draftRestored, setDraftRestored] = React.useState(false);

  const effectiveScopeAccountId =
    selectedTrade?.accountId ?? accountId ?? undefined;
  const { data: customTagSuggestions } = useQuery({
    ...trpcOptions.trades.listCustomTags.queryOptions({
      accountId: effectiveScopeAccountId || "",
    }),
    enabled: open && Boolean(effectiveScopeAccountId),
    staleTime: 30_000,
  });

  React.useEffect(() => {
    if (!selectedTrade) {
      setDraftValues(null);
      setSavedValues(null);
      setFieldErrors({});
      setDraftRestored(false);
      return;
    }

    const nextSavedValues = createTradeDetailFormValues(selectedTrade);
    const restoredDraft = readDraftFromStorage(selectedTrade.id);
    const nextDraftValues = restoredDraft ?? nextSavedValues;

    setSavedValues(nextSavedValues);
    setDraftValues(nextDraftValues);
    setFieldErrors(getTradeDetailFieldErrors(nextDraftValues));
    setDraftRestored(Boolean(restoredDraft));
  }, [selectedTrade?.id]);

  React.useEffect(() => {
    if (!selectedTrade || !draftValues || !savedValues || typeof window === "undefined") {
      return;
    }

    const storageKey = getTradeDetailDraftStorageKey(selectedTrade.id);
    if (areDraftValuesEqual(draftValues, savedValues)) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ values: draftValues })
    );
  }, [draftValues, savedValues, selectedTrade?.id]);

  const updateTradeMutation = useMutation({
    mutationFn: async (input: InlineTradeUpdateInput) =>
      trpcClient.trades.update.mutate(input),
    onSuccess: async () => {
      const actualAccountId = selectedTrade?.accountId ?? null;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [["trades"]] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-chart-trades"] }),
        queryClient.invalidateQueries({
          queryKey: trpcOptions.accounts.aggregatedStats.queryOptions({}).queryKey,
        }),
        ...(accountId
          ? [
              queryClient.invalidateQueries({
                queryKey: trpcOptions.accounts.stats.queryOptions({ accountId }).queryKey,
              }),
            ]
          : []),
        ...(actualAccountId && actualAccountId !== accountId
          ? [
              queryClient.invalidateQueries({
                queryKey: trpcOptions.accounts.stats.queryOptions({
                  accountId: actualAccountId,
                }).queryKey,
              }),
            ]
          : []),
      ]);
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to update trade");
    },
  });

  const handleDraftFieldChange = React.useCallback(
    <TField extends TradeDetailField>(
      field: TField,
      value: TradeDetailFormValues[TField]
    ) => {
      setDraftValues((current) => {
        if (!current) {
          return current;
        }

        const nextValues = { ...current, [field]: value } as TradeDetailFormValues;
        setFieldErrors(getTradeDetailFieldErrors(nextValues));
        setDraftRestored(false);
        return nextValues;
      });
    },
    []
  );

  const handleResetFields = React.useCallback(
    (fields: readonly TradeDetailField[]) => {
      setDraftValues((current) => {
        if (!current || !savedValues) {
          return current;
        }

        const nextValues = { ...current };
        for (const field of fields) {
          nextValues[field] = savedValues[field] as never;
        }

        setFieldErrors(getTradeDetailFieldErrors(nextValues));
        return nextValues;
      });
    },
    [savedValues]
  );

  const handleResetAllDraft = React.useCallback(() => {
    if (!selectedTrade || !savedValues) {
      return;
    }

    setDraftValues(savedValues);
    setFieldErrors(getTradeDetailFieldErrors(savedValues));
    setDraftRestored(false);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(getTradeDetailDraftStorageKey(selectedTrade.id));
    }
  }, [savedValues, selectedTrade]);

  const handleSaveFields = React.useCallback(
    async (fields: readonly TradeDetailField[]) => {
      if (!selectedTrade || !draftValues || !savedValues) {
        return false;
      }

      const errors = getTradeDetailFieldErrors(draftValues);
      setFieldErrors(errors);

      if (hasTradeDetailSectionErrors(errors, fields)) {
        return false;
      }

      if (!hasTradeDetailSectionChanges(draftValues, savedValues, fields)) {
        return true;
      }

      await updateTradeMutation.mutateAsync(
        buildTradeDetailUpdateInput(selectedTrade.id, draftValues, fields)
      );

      const nextSavedValues = { ...savedValues };
      for (const field of fields) {
        nextSavedValues[field] = draftValues[field] as never;
      }

      setSavedValues(nextSavedValues);
      setFieldErrors(getTradeDetailFieldErrors(draftValues));
      setDraftRestored(false);
      toast.success("Trade updated");
      return true;
    },
    [draftValues, savedValues, selectedTrade, updateTradeMutation]
  );

  const hasUnsavedDraft = Boolean(
    draftValues && savedValues && !areDraftValuesEqual(draftValues, savedValues)
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-full overflow-y-auto rounded-md p-0 sm:max-w-2xl"
      >
        <div className="px-6 py-5 pb-0">
          <SheetHeader className="p-0">
            {selectedTrade ? (
              <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-col items-start gap-2">
                  <SheetTitle className="text-base font-semibold text-white">
                    {selectedTrade.symbol}
                  </SheetTitle>

                  {hasUnsavedDraft ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 rounded-sm ring-white/8! bg-transparent! px-3 text-[11px] text-white/70 hover:bg-sidebar-accent"
                      onClick={handleResetAllDraft}
                    >
                      <RotateCcw className="mr-1.5 size-3" />
                      Reset draft
                    </Button>
                  ) : null}
                </div>

                <div className="flex flex-col items-start gap-2 text-xs sm:items-end">
                  <div className="flex items-center gap-2 font-medium text-white/40">
                    {isSameCalendarDate(selectedTrade.open, selectedTrade.close) ? (
                      <span>{formatSheetDate(selectedTrade.open)}</span>
                    ) : (
                      <>
                        <span>{formatSheetDate(selectedTrade.open)}</span>
                        <span>-</span>
                        <span>{formatSheetDate(selectedTrade.close)}</span>
                      </>
                    )}
                  </div>
                  <span className="font-medium tracking-wide text-white/60">
                    Hold time - {Math.floor(Number(selectedTrade.holdSeconds || 0) / 3600) > 0
                      ? `${Math.floor(Number(selectedTrade.holdSeconds || 0) / 3600)}h ${Math.floor((Number(selectedTrade.holdSeconds || 0) % 3600) / 60)}m`
                      : `${Math.floor((Number(selectedTrade.holdSeconds || 0) % 3600) / 60)}m`}
                  </span>
                </div>
              </div>
            ) : null}
          </SheetHeader>
        </div>

        {selectedTrade && draftValues && savedValues ? (
          <div className="flex flex-col">
            <Separator />
            <div className="px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-8">
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-white/50">P&amp;L</span>
                  <div
                    className={cn(
                      TRADE_SURFACE_CARD_CLASS,
                      getTradeProfitTone(selectedTrade.profit),
                      "px-4 py-2 text-sm font-semibold"
                    )}
                  >
                    {formatCurrencyValue(Number(selectedTrade.profit), {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs text-white/50">Direction</span>
                  <div
                    className={cn(
                      TRADE_SURFACE_CARD_CLASS,
                      getTradeDirectionTone(selectedTrade.tradeDirection),
                      "flex items-center gap-2 px-4 py-2 text-sm font-semibold capitalize"
                    )}
                  >
                    {selectedTrade.tradeDirection}
                    {selectedTrade.tradeDirection === "long" ? (
                      <ArrowUpRight className="size-3.5" />
                    ) : (
                      <ArrowDownRight className="size-3.5" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {draftRestored && hasUnsavedDraft ? (
              <>
                <Separator />
                <div className="px-6 py-3 text-xs text-teal-300/80">
                  Restored your last unsaved draft for this trade.
                </div>
              </>
            ) : null}

            <TradeDetailCore
              draft={draftValues}
              errors={fieldErrors}
              isSaving={updateTradeMutation.isPending}
              onChange={handleDraftFieldChange}
              onReset={handleResetFields}
              onSave={handleSaveFields}
              savedValues={savedValues}
              trade={selectedTrade}
            />
            <TradeDetailMetrics
              draft={draftValues}
              errors={fieldErrors}
              isSaving={updateTradeMutation.isPending}
              onChange={handleDraftFieldChange}
              onReset={handleResetFields}
              onSave={handleSaveFields}
              savedValues={savedValues}
              trade={selectedTrade}
            />
            <TradeDetailAdvanced
              draft={draftValues}
              errors={fieldErrors}
              isSaving={updateTradeMutation.isPending}
              onChange={handleDraftFieldChange}
              onReset={handleResetFields}
              onSave={handleSaveFields}
              savedValues={savedValues}
              trade={selectedTrade}
            />
            <TradeDetailTags
              customTagSuggestions={
                (customTagSuggestions as string[] | undefined) ?? []
              }
              draft={draftValues}
              errors={fieldErrors}
              isSaving={updateTradeMutation.isPending}
              onChange={handleDraftFieldChange}
              onReset={handleResetFields}
              onSave={handleSaveFields}
              savedValues={savedValues}
              trade={selectedTrade}
            />
            <TradeDetailExecution trade={selectedTrade} />
            <TradeDetailNotes accountId={accountId} tradeId={selectedTrade.id} />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
