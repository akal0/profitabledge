"use client";

import React, { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { trpcClient } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatCurrencyValue } from "@/lib/trade-formatting";
import {
  TRADE_SURFACE_CARD_CLASS,
  TRADE_IDENTIFIER_TONES,
} from "@/components/trades/trade-identifier-pill";

interface QuickTradeEntryProps {
  accountId: string;
  onTradeCreated?: (trade: {
    id: string;
    symbol: string;
    profit: number;
  }) => void;
  trigger?: React.ReactNode;
}

const COMMON_SYMBOLS = [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "USDCHF",
  "AUDUSD",
  "USDCAD",
  "NZDUSD",
  "XAUUSD",
  "XAGUSD",
  "US30",
  "NAS100",
  "SPX500",
  "BTCUSD",
  "ETHUSD",
];

export function QuickTradeEntry({
  accountId,
  onTradeCreated,
  trigger,
}: QuickTradeEntryProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [symbol, setSymbol] = useState("");
  const [customSymbol, setCustomSymbol] = useState("");
  const [tradeType, setTradeType] = useState<"long" | "short">("long");
  const [volume, setVolume] = useState("0.1");
  const [openPrice, setOpenPrice] = useState("");
  const [closePrice, setClosePrice] = useState("");
  const [openTime, setOpenTime] = useState(() => {
    const now = new Date();
    now.setHours(now.getHours() - 1);
    return now.toISOString().slice(0, 16);
  });
  const [closeTime, setCloseTime] = useState(() => {
    return new Date().toISOString().slice(0, 16);
  });
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [profit, setProfit] = useState("");
  const [commissions, setCommissions] = useState("");
  const [swap, setSwap] = useState("");
  const [sessionTag, setSessionTag] = useState("");
  const [modelTag, setModelTag] = useState("");
  const [autoCalculateProfit, setAutoCalculateProfit] = useState(true);

  const effectiveSymbol = symbol === "custom" ? customSymbol : symbol;

  const canSubmit = useMemo(() => {
    return (
      effectiveSymbol &&
      parseFloat(volume) > 0 &&
      parseFloat(openPrice) > 0 &&
      parseFloat(closePrice) > 0 &&
      openTime &&
      closeTime
    );
  }, [effectiveSymbol, volume, openPrice, closePrice, openTime, closeTime]);

  // Estimated profit calculation
  const estimatedProfit = useMemo(() => {
    if (!autoCalculateProfit || !openPrice || !closePrice || !volume)
      return null;
    const open = parseFloat(openPrice);
    const close = parseFloat(closePrice);
    const vol = parseFloat(volume);
    if (isNaN(open) || isNaN(close) || isNaN(vol)) return null;

    const diff = tradeType === "long" ? close - open : open - close;
    // Simplified: assume forex major with pip = 0.0001, contract = 100000
    const pipSize = effectiveSymbol.includes("JPY") ? 0.01 : 0.0001;
    const contractSize = effectiveSymbol.includes("XAU") ? 100 : 100000;
    return diff * vol * contractSize;
  }, [
    openPrice,
    closePrice,
    volume,
    tradeType,
    effectiveSymbol,
    autoCalculateProfit,
  ]);

  function resetForm() {
    setSymbol("");
    setCustomSymbol("");
    setTradeType("long");
    setVolume("0.1");
    setOpenPrice("");
    setClosePrice("");
    const now = new Date();
    now.setHours(now.getHours() - 1);
    setOpenTime(now.toISOString().slice(0, 16));
    setCloseTime(new Date().toISOString().slice(0, 16));
    setSl("");
    setTp("");
    setProfit("");
    setCommissions("");
    setSwap("");
    setSessionTag("");
    setModelTag("");
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const result = await trpcClient.trades.create.mutate({
        accountId,
        symbol: effectiveSymbol.toUpperCase(),
        tradeType,
        volume: parseFloat(volume),
        openPrice: parseFloat(openPrice),
        closePrice: parseFloat(closePrice),
        openTime: new Date(openTime).toISOString(),
        closeTime: new Date(closeTime).toISOString(),
        sl: sl ? parseFloat(sl) : undefined,
        tp: tp ? parseFloat(tp) : undefined,
        profit: profit ? parseFloat(profit) : undefined,
        commissions: commissions ? parseFloat(commissions) : undefined,
        swap: swap ? parseFloat(swap) : undefined,
        sessionTag: sessionTag || undefined,
        modelTag: modelTag || undefined,
      });

      toast.success(
        `Trade added: ${result.symbol} ${formatCurrencyValue(result.profit, {
          showPlus: true,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      );
      onTradeCreated?.({
        id: result.id,
        symbol: result.symbol || "",
        profit: result.profit,
      });
      resetForm();
      setOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to create trade");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 ring-white/10! borer-none!"
          >
            <Plus className="size-3" />
            Add trade
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto rounded-md p-0">
        <div className="px-6 py-5">
          <SheetHeader className="p-0">
            <SheetTitle className="text-base font-semibold text-white">
              Add manual trade
            </SheetTitle>
            <SheetDescription className="text-xs text-white/40">
              Manually enter a closed trade for tracking and analysis.
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex flex-col">
          <Separator />

          {/* Symbol & direction */}
          <div className="px-6 py-3">
            <h3 className="text-xs font-semibold text-white/70 tracking-wide">
              Symbol & direction
            </h3>
          </div>
          <Separator />
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-white/50">Symbol</Label>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger>
                  <SelectValue placeholder="Select symbol" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_SYMBOLS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom...</SelectItem>
                </SelectContent>
              </Select>
              {symbol === "custom" && (
                <Input
                  placeholder="Enter symbol (e.g., EURUSD)"
                  value={customSymbol}
                  onChange={(e) =>
                    setCustomSymbol(e.target.value.toUpperCase())
                  }
                />
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-white/50">Direction</Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  className={cn(
                    TRADE_SURFACE_CARD_CLASS,
                    "px-4 py-2 text-sm font-semibold capitalize flex items-center gap-2 cursor-pointer transition-colors",
                    tradeType === "long"
                      ? TRADE_IDENTIFIER_TONES.positive
                      : "text-white/40 opacity-50"
                  )}
                  onClick={() => setTradeType("long")}
                >
                  Long
                  <ArrowUpRight className="size-3.5" />
                </button>
                <button
                  type="button"
                  className={cn(
                    TRADE_SURFACE_CARD_CLASS,
                    "px-4 py-2 text-sm font-semibold capitalize flex items-center gap-2 cursor-pointer transition-colors",
                    tradeType === "short"
                      ? TRADE_IDENTIFIER_TONES.negative
                      : "text-white/40 opacity-50"
                  )}
                  onClick={() => setTradeType("short")}
                >
                  Short
                  <ArrowDownRight className="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Trade details */}
          <div className="px-6 py-3">
            <h3 className="text-xs font-semibold text-white/70 tracking-wide">
              Trade details
            </h3>
          </div>
          <Separator />
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-white/50">Volume (lots)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-white/50">Open price</Label>
                <Input
                  type="number"
                  step="0.00001"
                  placeholder="1.08500"
                  value={openPrice}
                  onChange={(e) => setOpenPrice(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-white/50">Close price</Label>
                <Input
                  type="number"
                  step="0.00001"
                  placeholder="1.08750"
                  value={closePrice}
                  onChange={(e) => setClosePrice(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-white/50">Open time</Label>
                <Input
                  type="datetime-local"
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-white/50">Close time</Label>
                <Input
                  type="datetime-local"
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-white/50">
                  Stop loss (optional)
                </Label>
                <Input
                  type="number"
                  step="0.00001"
                  placeholder="1.08200"
                  value={sl}
                  onChange={(e) => setSl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-white/50">
                  Take profit (optional)
                </Label>
                <Input
                  type="number"
                  step="0.00001"
                  placeholder="1.09000"
                  value={tp}
                  onChange={(e) => setTp(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* P&L */}
          <div className="px-6 py-3">
            <h3 className="text-xs font-semibold text-white/70 tracking-wide">
              P&L
            </h3>
          </div>
          <Separator />
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-white/50">Profit/loss ($)</Label>
                <label className="flex items-center gap-2 text-xs text-white/40">
                  <input
                    type="checkbox"
                    checked={autoCalculateProfit}
                    onChange={(e) => setAutoCalculateProfit(e.target.checked)}
                    className="rounded"
                  />
                  Auto-calculate
                </label>
              </div>
              {autoCalculateProfit ? (
                <div
                  className={cn(
                    "px-3 py-2 rounded-sm border text-sm font-medium",
                    estimatedProfit === null
                      ? "text-white/40 border-white/5"
                      : estimatedProfit >= 0
                      ? "text-teal-400 bg-teal-500/10 border-teal-500/20"
                      : "text-rose-400 bg-rose-500/10 border-rose-500/20"
                  )}
                >
                  {estimatedProfit === null
                    ? "Enter prices to calculate"
                    : formatCurrencyValue(estimatedProfit, {
                        showPlus: true,
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                </div>
              ) : (
                <Input
                  type="number"
                  step="0.01"
                  placeholder="125.50"
                  value={profit}
                  onChange={(e) => setProfit(e.target.value)}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-white/50">
                  Commissions (optional)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="-7.00"
                  value={commissions}
                  onChange={(e) => setCommissions(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-white/50">Swap (optional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="-1.50"
                  value={swap}
                  onChange={(e) => setSwap(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Tags */}
          <div className="px-6 py-3">
            <h3 className="text-xs font-semibold text-white/70 tracking-wide">
              Tags
            </h3>
          </div>
          <Separator />
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-white/50">
                  Session tag (optional)
                </Label>
                <Input
                  placeholder="London Open"
                  value={sessionTag}
                  onChange={(e) => setSessionTag(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-white/50">
                  Model tag (optional)
                </Label>
                <Input
                  placeholder="Liquidity Raid"
                  value={modelTag}
                  onChange={(e) => setModelTag(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="px-6 py-5">
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="rounded-sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="gap-2 rounded-sm"
              >
                {submitting ? "Adding..." : "Add trade"}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
