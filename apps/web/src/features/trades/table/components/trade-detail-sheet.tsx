"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { TagMultiSelect } from "@/components/tags/tag-multi-select";
import {
  parseDateTimeInputValue,
  TradeDateTimeField,
  toDateTimeInputValue,
} from "@/components/trades/trade-date-time-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmotionTagger } from "@/components/dashboard/emotion-tagger";
import { TradeNotesEditor } from "@/components/trades/trade-notes-editor";
import {
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
  TRADE_SURFACE_CARD_CLASS,
  getTradeDirectionTone,
  getTradeIdentifierColorStyle,
  getTradeProtocolTone,
} from "@/components/trades/trade-identifier-pill";
import { cn } from "@/lib/utils";
import { formatCurrencyValue, formatNumberValue } from "@/lib/trade-formatting";
import {
  formatTradePipValue,
  getTradeCommissionTone,
  getTradeComplianceTone,
  getTradeEfficiencyTone,
  getTradeExitEfficiencyTone,
  getTradeMaxRRTone,
  getTradeProfitTone,
  getTradeRealisedRRTone,
  getTradeSwapTone,
} from "@/features/trades/table/lib/trade-table-formatting";
import type { TradeRow } from "@/features/trades/table/lib/trade-table-types";
import { queryClient, trpcClient, trpcOptions } from "@/utils/trpc";

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

type TradeEditState = {
  symbol: string;
  tradeType: "long" | "short";
  volume: string;
  openPrice: string;
  closePrice: string;
  openTime: string;
  closeTime: string;
  sl: string;
  tp: string;
  profit: string;
  commissions: string;
  swap: string;
  sessionTag: string;
  modelTag: string;
  customTags: string[];
};

function createTradeEditState(trade: TradeRow): TradeEditState {
  return {
    symbol: trade.rawSymbol ?? trade.symbol ?? "",
    tradeType: trade.tradeDirection,
    volume:
      trade.volume != null && Number.isFinite(Number(trade.volume))
        ? String(trade.volume)
        : "",
    openPrice:
      trade.openPrice != null && Number.isFinite(Number(trade.openPrice))
        ? String(trade.openPrice)
        : "",
    closePrice:
      trade.closePrice != null && Number.isFinite(Number(trade.closePrice))
        ? String(trade.closePrice)
        : "",
    openTime: toDateTimeInputValue(new Date(trade.open)),
    closeTime: toDateTimeInputValue(new Date(trade.close)),
    sl:
      trade.sl != null && Number.isFinite(Number(trade.sl))
        ? String(trade.sl)
        : "",
    tp:
      trade.tp != null && Number.isFinite(Number(trade.tp))
        ? String(trade.tp)
        : "",
    profit:
      trade.profit != null && Number.isFinite(Number(trade.profit))
        ? String(trade.profit)
        : "",
    commissions:
      trade.commissions != null && Number.isFinite(Number(trade.commissions))
        ? String(trade.commissions)
        : "",
    swap:
      trade.swap != null && Number.isFinite(Number(trade.swap))
        ? String(trade.swap)
        : "",
    sessionTag: trade.sessionTag ?? "",
    modelTag: trade.modelTag ?? "",
    customTags: Array.isArray(trade.customTags) ? trade.customTags : [],
  };
}

function parseRequiredPositiveNumber(value: string) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseRequiredNumber(value: string) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
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
  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState<TradeEditState | null>(null);
  const effectiveScopeAccountId =
    selectedTrade?.accountId ?? accountId ?? undefined;
  const { data: customTagSuggestions } = useQuery({
    ...trpcOptions.trades.listCustomTags.queryOptions({
      accountId: effectiveScopeAccountId || "",
    }),
    enabled: open && Boolean(effectiveScopeAccountId),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!selectedTrade) {
      setEditState(null);
      setIsEditing(false);
      return;
    }

    setIsEditing(false);
    setEditState(createTradeEditState(selectedTrade));
  }, [selectedTrade]);

  useEffect(() => {
    if (!selectedTrade) {
      setEditState(null);
      return;
    }

    if (isEditing) {
      return;
    }

    setEditState(createTradeEditState(selectedTrade));
  }, [isEditing, selectedTrade]);

  const updateTradeMutation = useMutation({
    mutationFn: async (input: TradeEditState) => {
      if (!selectedTrade) {
        throw new Error("Trade not found");
      }

      const symbol = input.symbol.trim().toUpperCase();
      const volume = parseRequiredPositiveNumber(input.volume);
      const openPrice = parseRequiredPositiveNumber(input.openPrice);
      const closePrice = parseRequiredPositiveNumber(input.closePrice);
      const profit = parseRequiredNumber(input.profit);
      const commissions = parseRequiredNumber(input.commissions || "0");
      const swap = parseRequiredNumber(input.swap || "0");
      const openTime = parseDateTimeInputValue(input.openTime);
      const closeTime = parseDateTimeInputValue(input.closeTime);

      if (!symbol) {
        throw new Error("Enter a symbol");
      }

      if (!volume || !openPrice || !closePrice) {
        throw new Error("Enter valid size and price values");
      }

      if (profit === null || commissions === null || swap === null) {
        throw new Error("Enter valid P&L and cost values");
      }

      if (!openTime || !closeTime || closeTime <= openTime) {
        throw new Error("Close time must be after open time");
      }

      return trpcClient.trades.update.mutate({
        tradeId: selectedTrade.id,
        symbol,
        tradeType: input.tradeType,
        volume,
        openPrice,
        closePrice,
        openTime: openTime.toISOString(),
        closeTime: closeTime.toISOString(),
        sl: parseOptionalNumber(input.sl),
        tp: parseOptionalNumber(input.tp),
        profit,
        commissions,
        swap,
        sessionTag: input.sessionTag.trim() || null,
        modelTag: input.modelTag.trim() || null,
        customTags: input.customTags,
      });
    },
    onSuccess: async () => {
      const actualAccountId = selectedTrade?.accountId ?? null;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [["trades"]] }),
        queryClient.refetchQueries({ queryKey: [["trades"]], type: "active" }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-chart-trades"] }),
        queryClient.refetchQueries({
          queryKey: ["dashboard-chart-trades"],
          type: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: trpcOptions.accounts.aggregatedStats.queryOptions({})
            .queryKey,
        }),
        ...(accountId
          ? [
              queryClient.invalidateQueries({
                queryKey: trpcOptions.accounts.stats.queryOptions({ accountId })
                  .queryKey,
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

      setIsEditing(false);
      toast.success("Trade updated");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to update trade");
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto rounded-md p-0 sm:max-w-2xl"
      >
        <div className="px-6 py-5 pb-0">
          <SheetHeader className="p-0">
            {selectedTrade ? (
              <div className="flex w-full items-end justify-between gap-4">
                <div className="flex flex-col items-start gap-2">
                  <SheetTitle className="text-base font-semibold text-white">
                    {selectedTrade.symbol}
                  </SheetTitle>

                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 rounded-sm ring-white/8! px-3 text-[11px] text-white/70 hover:bg-sidebar-accent"
                          onClick={() => {
                            setEditState(createTradeEditState(selectedTrade));
                            setIsEditing(false);
                          }}
                          disabled={updateTradeMutation.isPending}
                        >
                          Cancel
                        </Button>

                        <Button
                          type="button"
                          className="h-8 rounded-sm px-3 text-[11px]"
                          onClick={() =>
                            editState && updateTradeMutation.mutate(editState)
                          }
                          disabled={!editState || updateTradeMutation.isPending}
                        >
                          {updateTradeMutation.isPending
                            ? "Saving..."
                            : "Save changes"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 rounded-sm ring-white/8! bg-transparent! px-3 text-[11px] text-white/70 hover:bg-sidebar-accent"
                        onClick={() => setIsEditing(true)}
                      >
                        Edit trade
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 text-xs">
                  <div className="flex items-center gap-2 font-medium text-white/40">
                    {isSameCalendarDate(
                      selectedTrade.open,
                      selectedTrade.close
                    ) ? (
                      <span>{formatSheetDate(selectedTrade.open)}</span>
                    ) : (
                      <>
                        <span>{formatSheetDate(selectedTrade.open)}</span>
                        <span>-</span>
                        <span>{formatSheetDate(selectedTrade.close)}</span>
                      </>
                    )}
                  </div>
                  <span className="font-medium tracking-wide">
                    {(() => {
                      const seconds = Number(selectedTrade.holdSeconds || 0);
                      const hours = Math.floor(seconds / 3600);
                      const minutes = Math.floor((seconds % 3600) / 60);
                      return `Hold time - ${
                        hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
                      }`;
                    })()}
                  </span>
                </div>
              </div>
            ) : null}
          </SheetHeader>
        </div>

        {selectedTrade ? (
          <div className="flex flex-col">
            <Separator />
            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-8">
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

            <Separator />
            {selectedTrade && editState && isEditing ? (
              <>
                <div className="px-6 py-3">
                  <h3 className="text-xs font-semibold tracking-wide text-white/70">
                    Edit trade
                  </h3>
                </div>
                <Separator />
                <div className="space-y-4 px-6 py-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-white/50">Symbol</Label>
                      <Input
                        value={editState.symbol}
                        onChange={(event) =>
                          setEditState((current) =>
                            current
                              ? {
                                  ...current,
                                  symbol: event.target.value.toUpperCase(),
                                }
                              : current
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-white/50">Direction</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          className={cn(
                            TRADE_SURFACE_CARD_CLASS,
                            "flex cursor-pointer items-center justify-center gap-2 px-4 py-2 text-sm font-semibold capitalize transition-colors",
                            editState.tradeType === "long"
                              ? TRADE_IDENTIFIER_TONES.positive
                              : "text-white/40 opacity-50"
                          )}
                          onClick={() =>
                            setEditState((current) =>
                              current
                                ? { ...current, tradeType: "long" }
                                : current
                            )
                          }
                        >
                          Long
                          <ArrowUpRight className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          className={cn(
                            TRADE_SURFACE_CARD_CLASS,
                            "flex cursor-pointer items-center justify-center gap-2 px-4 py-2 text-sm font-semibold capitalize transition-colors",
                            editState.tradeType === "short"
                              ? TRADE_IDENTIFIER_TONES.negative
                              : "text-white/40 opacity-50"
                          )}
                          onClick={() =>
                            setEditState((current) =>
                              current
                                ? { ...current, tradeType: "short" }
                                : current
                            )
                          }
                        >
                          Short
                          <ArrowDownRight className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-white/50">Volume</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={editState.volume}
                        onChange={(event) =>
                          setEditState((current) =>
                            current
                              ? { ...current, volume: event.target.value }
                              : current
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-white/50">
                        Open price
                      </Label>
                      <Input
                        type="number"
                        step="0.00001"
                        value={editState.openPrice}
                        onChange={(event) =>
                          setEditState((current) =>
                            current
                              ? { ...current, openPrice: event.target.value }
                              : current
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-white/50">
                        Close price
                      </Label>
                      <Input
                        type="number"
                        step="0.00001"
                        value={editState.closePrice}
                        onChange={(event) =>
                          setEditState((current) =>
                            current
                              ? { ...current, closePrice: event.target.value }
                              : current
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <TradeDateTimeField
                      label="Opened"
                      value={
                        parseDateTimeInputValue(editState.openTime) ??
                        new Date(selectedTrade.open)
                      }
                      onChange={(nextValue) =>
                        setEditState((current) =>
                          current
                            ? {
                                ...current,
                                openTime: toDateTimeInputValue(nextValue),
                              }
                            : current
                        )
                      }
                      triggerClassName={cn(
                        TRADE_SURFACE_CARD_CLASS,
                        "h-9 w-full justify-start px-3 text-left text-white/85"
                      )}
                    />

                    <TradeDateTimeField
                      label="Closed"
                      value={
                        parseDateTimeInputValue(editState.closeTime) ??
                        new Date(selectedTrade.close)
                      }
                      onChange={(nextValue) =>
                        setEditState((current) =>
                          current
                            ? {
                                ...current,
                                closeTime: toDateTimeInputValue(nextValue),
                              }
                            : current
                        )
                      }
                      triggerClassName={cn(
                        TRADE_SURFACE_CARD_CLASS,
                        "h-9 w-full justify-start px-3 text-left text-white/85"
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-white/50">Stop loss</Label>
                      <Input
                        type="number"
                        step="0.00001"
                        placeholder="Leave blank to clear"
                        value={editState.sl}
                        onChange={(event) =>
                          setEditState((current) =>
                            current
                              ? { ...current, sl: event.target.value }
                              : current
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-white/50">
                        Take profit
                      </Label>
                      <Input
                        type="number"
                        step="0.00001"
                        placeholder="Leave blank to clear"
                        value={editState.tp}
                        onChange={(event) =>
                          setEditState((current) =>
                            current
                              ? { ...current, tp: event.target.value }
                              : current
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-white/50">P&amp;L</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editState.profit}
                        onChange={(event) =>
                          setEditState((current) =>
                            current
                              ? { ...current, profit: event.target.value }
                              : current
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-white/50">
                        Commissions
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editState.commissions}
                        onChange={(event) =>
                          setEditState((current) =>
                            current
                              ? {
                                  ...current,
                                  commissions: event.target.value,
                                }
                              : current
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-white/50">Swap</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editState.swap}
                        onChange={(event) =>
                          setEditState((current) =>
                            current
                              ? { ...current, swap: event.target.value }
                              : current
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-white/50">
                        Session tag
                      </Label>
                      <Input
                        value={editState.sessionTag}
                        onChange={(event) =>
                          setEditState((current) =>
                            current
                              ? { ...current, sessionTag: event.target.value }
                              : current
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-white/50">Model tag</Label>
                      <Input
                        value={editState.modelTag}
                        onChange={(event) =>
                          setEditState((current) =>
                            current
                              ? { ...current, modelTag: event.target.value }
                              : current
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-white/50">Trade tags</Label>
                    <TagMultiSelect
                      value={editState.customTags}
                      suggestions={
                        (customTagSuggestions as string[] | undefined) ?? []
                      }
                      placeholder="Add one or more trade tags"
                      onChange={(nextTags) =>
                        setEditState((current) =>
                          current
                            ? { ...current, customTags: nextTags }
                            : current
                        )
                      }
                    />
                  </div>
                </div>
                <Separator />
              </>
            ) : null}

            <div className="px-6 py-3">
              <h3 className="text-xs font-semibold tracking-wide text-white/70">
                Trade details
              </h3>
            </div>
            <Separator />
            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-white/50">Entry price</span>
                  <span className="font-medium">
                    {selectedTrade.openPrice?.toFixed(5) || "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/50">Exit price</span>
                  <span className="font-medium">
                    {selectedTrade.closePrice?.toFixed(5) || "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/50">Stop loss</span>
                  <span className="font-medium">
                    {selectedTrade.sl?.toFixed(5) || "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/50">Take profit</span>
                  <span className="font-medium">
                    {selectedTrade.tp?.toFixed(5) || "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/50">Volume</span>
                  <span className="font-medium">
                    {formatNumberValue(selectedTrade.volume, {
                      maximumFractionDigits: 2,
                    })}{" "}
                    lots
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/50">Pips</span>
                  <span className="font-medium">
                    {selectedTrade.pips?.toFixed(1) || "—"}
                  </span>
                </div>
              </div>
            </div>

            <Separator />
            <div className="px-6 py-3">
              <h3 className="text-xs font-semibold tracking-wide text-white/70">
                Performance
              </h3>
            </div>
            <Separator />
            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {selectedTrade.realisedRR != null ? (
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Realised RR</span>
                    <span
                      className={cn(
                        TRADE_IDENTIFIER_PILL_CLASS,
                        getTradeRealisedRRTone(Number(selectedTrade.realisedRR))
                      )}
                    >
                      {Number(selectedTrade.realisedRR) > 0 ? "+" : ""}
                      {Number(selectedTrade.realisedRR).toFixed(2)}R
                    </span>
                  </div>
                ) : null}
                {selectedTrade.maxRR != null ? (
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Max RR</span>
                    <span
                      className={cn(
                        TRADE_IDENTIFIER_PILL_CLASS,
                        getTradeMaxRRTone(Number(selectedTrade.maxRR))
                      )}
                    >
                      {Number(selectedTrade.maxRR).toFixed(2)}R
                    </span>
                  </div>
                ) : null}
                {selectedTrade.rrCaptureEfficiency != null ? (
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">RR efficiency</span>
                    <span
                      className={cn(
                        TRADE_IDENTIFIER_PILL_CLASS,
                        getTradeEfficiencyTone(
                          Number(selectedTrade.rrCaptureEfficiency),
                          75,
                          50,
                          25
                        )
                      )}
                    >
                      {Number(selectedTrade.rrCaptureEfficiency).toFixed(1)}%
                    </span>
                  </div>
                ) : null}
                {selectedTrade.exitEfficiency != null ? (
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Exit efficiency</span>
                    <span
                      className={cn(
                        TRADE_IDENTIFIER_PILL_CLASS,
                        getTradeExitEfficiencyTone(
                          Number(selectedTrade.exitEfficiency)
                        )
                      )}
                    >
                      {Number(selectedTrade.exitEfficiency).toFixed(1)}%
                    </span>
                  </div>
                ) : null}
                {selectedTrade.mfePips != null ? (
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">MFE</span>
                    <span
                      className={cn(
                        TRADE_IDENTIFIER_PILL_CLASS,
                        TRADE_IDENTIFIER_TONES.positive
                      )}
                    >
                      {formatTradePipValue(
                        selectedTrade.mfePips,
                        selectedTrade
                      )}
                    </span>
                  </div>
                ) : null}
                {selectedTrade.maePips != null ? (
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">MAE</span>
                    <span
                      className={cn(
                        TRADE_IDENTIFIER_PILL_CLASS,
                        TRADE_IDENTIFIER_TONES.negative
                      )}
                    >
                      {formatTradePipValue(
                        selectedTrade.maePips,
                        selectedTrade
                      )}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <Separator />
            <div className="px-6 py-3">
              <h3 className="text-xs font-semibold tracking-wide text-white/70">
                Costs
              </h3>
            </div>
            <Separator />
            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-white/50">Commissions</span>
                  <span
                    className={cn(
                      TRADE_IDENTIFIER_PILL_CLASS,
                      getTradeCommissionTone(
                        Number(selectedTrade.commissions || 0)
                      )
                    )}
                  >
                    {formatCurrencyValue(
                      Math.abs(Number(selectedTrade.commissions || 0)),
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/50">Swap</span>
                  <span
                    className={cn(
                      TRADE_IDENTIFIER_PILL_CLASS,
                      getTradeSwapTone(Number(selectedTrade.swap || 0))
                    )}
                  >
                    {formatCurrencyValue(Number(selectedTrade.swap || 0), {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {selectedTrade.entrySpreadPips != null ? (
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Entry spread</span>
                    <span className="font-medium">
                      {formatTradePipValue(
                        selectedTrade.entrySpreadPips,
                        selectedTrade
                      )}
                    </span>
                  </div>
                ) : null}
                {selectedTrade.exitSpreadPips != null ? (
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Exit spread</span>
                    <span className="font-medium">
                      {formatTradePipValue(
                        selectedTrade.exitSpreadPips,
                        selectedTrade
                      )}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {selectedTrade.rrCaptureEfficiency != null ||
            selectedTrade.exitEfficiency != null ||
            selectedTrade.manipRREfficiency != null ? (
              <>
                <Separator />
                <div className="px-6 py-3">
                  <h3 className="text-xs font-semibold tracking-wide text-white/70">
                    Execution score
                  </h3>
                </div>
                <Separator />
                <div className="space-y-3 px-6 py-5">
                  <div className="flex gap-2">
                    {[
                      {
                        label: "RR capture",
                        value: selectedTrade.rrCaptureEfficiency,
                      },
                      {
                        label: "Exit timing",
                        value: selectedTrade.exitEfficiency,
                      },
                      {
                        label: "Manip capture",
                        value: selectedTrade.manipRREfficiency,
                      },
                    ]
                      .filter((metric) => metric.value != null)
                      .map((metric) => {
                        const value = Number(metric.value);
                        const color =
                          value >= 80
                            ? "ring-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : value >= 50
                            ? "ring-amber-500/20 bg-amber-500/10 text-amber-400"
                            : "ring-red-500/20 bg-red-500/10 text-red-400";
                        return (
                          <div
                            key={metric.label}
                            className={cn(
                              TRADE_SURFACE_CARD_CLASS,
                              "flex-1 p-2 text-center",
                              color
                            )}
                          >
                            <div className="text-lg font-bold tabular-nums">
                              {value.toFixed(0)}%
                            </div>
                            <div className="text-[11px] opacity-70">
                              {metric.label}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </>
            ) : null}

            {(() => {
              const commission = Math.abs(
                Number(selectedTrade.commissions || 0)
              );
              const swap = Math.abs(
                Math.min(0, Number(selectedTrade.swap || 0))
              );
              const grossPnl =
                Number(selectedTrade.profit || 0) + commission + swap;
              const totalCost = commission + swap;
              const costPct =
                grossPnl !== 0 ? (totalCost / Math.abs(grossPnl)) * 100 : 0;
              const commissionPct =
                totalCost > 0 ? (commission / totalCost) * 100 : 0;
              const swapPct = Math.max(0, 100 - commissionPct);

              if (totalCost <= 0) return null;

              return (
                <>
                  <Separator />
                  <div className="px-6 py-3">
                    <h3 className="text-xs font-semibold tracking-wide text-white/70">
                      Cost analysis
                    </h3>
                  </div>
                  <Separator />
                  <div className="px-6 py-5">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/50">Gross P&amp;L</span>
                        <span
                          className={cn(
                            "font-medium",
                            grossPnl >= 0 ? "text-teal-400" : "text-rose-400"
                          )}
                        >
                          {formatCurrencyValue(grossPnl, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/50">Total costs</span>
                        <span className="font-medium text-rose-400">
                          {formatCurrencyValue(-totalCost, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="h-3.5 overflow-hidden bg-white/5">
                          <div
                            className="flex h-full"
                            style={{ width: `${Math.min(costPct, 100)}%` }}
                          >
                            {commission > 0 ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className="h-full"
                                    style={{
                                      width: `${commissionPct}%`,
                                      backgroundColor: "#A1A1AA",
                                    }}
                                  />
                                </TooltipTrigger>
                                <TooltipContent sideOffset={6}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-white/60">
                                      Commissions
                                    </span>
                                    <span className="text-xs font-medium text-white/80">
                                      {formatCurrencyValue(commission, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </span>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ) : null}

                            {swap > 0 ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className="h-full"
                                    style={{
                                      width: `${swapPct}%`,
                                      backgroundColor: "#6B7280",
                                    }}
                                  />
                                </TooltipTrigger>
                                <TooltipContent sideOffset={6}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-white/60">
                                      Swap
                                    </span>
                                    <span className="text-xs font-medium text-white/80">
                                      {formatCurrencyValue(swap, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </span>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ) : null}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {commission > 0 ? (
                            <div className="flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2">
                                <span
                                  className="size-2 rounded-sm"
                                  style={{ backgroundColor: "#A1A1AA" }}
                                />
                                <span className="text-white/55">
                                  Commissions
                                </span>
                              </div>
                              <span className="font-medium text-white/80">
                                {formatCurrencyValue(commission, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                          ) : null}

                          {swap > 0 ? (
                            <div className="flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2">
                                <span
                                  className="size-2 rounded-sm"
                                  style={{ backgroundColor: "#6B7280" }}
                                />
                                <span className="text-white/55">Swap</span>
                              </div>
                              <span className="font-medium text-white/80">
                                {formatCurrencyValue(swap, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="text-right text-[10px] text-white/30">
                        Costs = {costPct.toFixed(1)}% of gross P&amp;L
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}

            {selectedTrade.complianceStatus &&
            selectedTrade.complianceStatus !== "unknown" ? (
              <>
                <Separator />
                <div className="px-6 py-3">
                  <h3 className="text-xs font-semibold tracking-wide text-white/70">
                    Rule compliance
                  </h3>
                </div>
                <Separator />
                <div className="space-y-3 px-6 py-5">
                  <div
                    className={cn(
                      TRADE_SURFACE_CARD_CLASS,
                      getTradeComplianceTone(selectedTrade.complianceStatus),
                      "flex items-center gap-2 px-3 py-2 text-sm font-medium"
                    )}
                  >
                    {selectedTrade.complianceStatus === "pass"
                      ? "✓ All rules passed"
                      : "✗ Rule violations detected"}
                  </div>
                  {selectedTrade.complianceFlags?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTrade.complianceFlags.map((flag) => (
                        <span
                          key={flag}
                          className={cn(
                            TRADE_IDENTIFIER_PILL_CLASS,
                            TRADE_IDENTIFIER_TONES.negative,
                            "min-h-6 px-2 py-0.5 text-[10px]"
                          )}
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {selectedTrade.sessionTag ||
            selectedTrade.modelTag ||
            (selectedTrade.customTags?.length ?? 0) > 0 ||
            selectedTrade.protocolAlignment ? (
              <>
                <Separator />
                <div className="px-6 py-3">
                  <h3 className="text-xs font-semibold tracking-wide text-white/70">
                    Tags
                  </h3>
                </div>
                <Separator />
                <div className="space-y-3 px-6 py-5">
                  <div className="flex flex-wrap gap-2">
                    {selectedTrade.sessionTag ? (
                      <span
                        style={
                          selectedTrade.sessionTagColor
                            ? getTradeIdentifierColorStyle(
                                selectedTrade.sessionTagColor
                              )
                            : undefined
                        }
                        className={cn(
                          TRADE_IDENTIFIER_PILL_CLASS,
                          !selectedTrade.sessionTagColor &&
                            TRADE_IDENTIFIER_TONES.neutral
                        )}
                      >
                        Session: {selectedTrade.sessionTag}
                      </span>
                    ) : null}
                    {selectedTrade.modelTag ? (
                      <span
                        style={
                          selectedTrade.modelTagColor
                            ? getTradeIdentifierColorStyle(
                                selectedTrade.modelTagColor
                              )
                            : undefined
                        }
                        className={cn(
                          TRADE_IDENTIFIER_PILL_CLASS,
                          !selectedTrade.modelTagColor &&
                            TRADE_IDENTIFIER_TONES.neutral
                        )}
                      >
                        Model: {selectedTrade.modelTag}
                      </span>
                    ) : null}
                    {selectedTrade.customTags?.map((tag) => (
                      <span
                        key={tag}
                        className={cn(
                          TRADE_IDENTIFIER_PILL_CLASS,
                          TRADE_IDENTIFIER_TONES.neutral
                        )}
                      >
                        Tag: {tag}
                      </span>
                    ))}
                    {selectedTrade.protocolAlignment ? (
                      <span
                        className={cn(
                          TRADE_IDENTIFIER_PILL_CLASS,
                          getTradeProtocolTone(selectedTrade.protocolAlignment)
                        )}
                      >
                        {selectedTrade.protocolAlignment === "aligned"
                          ? "✓ Aligned"
                          : selectedTrade.protocolAlignment === "against"
                          ? "✗ Against"
                          : "◆ Discretionary"}
                      </span>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}

            {selectedTrade.openText || selectedTrade.closeText ? (
              <>
                <Separator />
                <div className="px-6 py-3">
                  <h3 className="text-xs font-semibold tracking-wide text-white/70">
                    Entry and exit comments
                  </h3>
                </div>
                <Separator />
                <div className="space-y-3 px-6 py-5">
                  {selectedTrade.openText ? (
                    <div className="text-sm">
                      <span className="text-white/50">Entry: </span>
                      <span className="text-white/80">
                        {selectedTrade.openText}
                      </span>
                    </div>
                  ) : null}
                  {selectedTrade.closeText ? (
                    <div className="text-sm">
                      <span className="text-white/50">Exit: </span>
                      <span className="text-white/80">
                        {selectedTrade.closeText}
                      </span>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            <Separator />
            <div className="px-6 py-5">
              <TradeNotesEditor tradeId={selectedTrade.id} />
            </div>

            <Separator />
            <div className="px-6 py-5">
              <EmotionTagger tradeId={selectedTrade.id} accountId={accountId} />
            </div>

            <Separator />
            <div className="px-6 py-3">
              <h3 className="text-xs font-semibold tracking-wide text-white/70">
                Timestamps
              </h3>
            </div>
            <Separator />
            <div className="px-6 py-5">
              <div className="grid grid-cols-1 gap-4 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-white/50">Opened</span>
                  <span className="font-medium">
                    {new Date(selectedTrade.open).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/50">Closed</span>
                  <span className="font-medium">
                    {new Date(selectedTrade.close).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/50">Created</span>
                  <span className="font-medium">
                    {new Date(selectedTrade.createdAtISO).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
