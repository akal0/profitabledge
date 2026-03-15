"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogClose,
  DialogContent,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  X,
} from "lucide-react";
import { format } from "date-fns";

// Trade data type - minimal required fields
// The actual API returns more fields, but we only need these for display
interface TradeItem {
  id: string;
  symbol: string | null;
  tradeDirection?: "long" | "short";
  profit: number | null;
  pips?: number | null;
  close?: string | null; // Close time as string
  outcome?: string | null;
}

// ============================================================================
// Trade Selector Dialog
// ============================================================================

interface TradeSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (trades: TradeItem[]) => void;
  accountId?: string;
  multiple?: boolean;
  title?: string;
  description?: string;
}

export function TradeSelectorDialog({
  isOpen,
  onClose,
  onSelect,
  accountId,
  multiple = false,
  title = "Select Trade",
  description = "Choose a trade to embed in your journal entry",
}: TradeSelectorDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const { data: accounts } = trpc.accounts.list.useQuery(undefined, { enabled: isOpen });
  const { selectedAccountId: storeAccountId } = useAccountStore();
  
  const effectiveAccountId = accountId || storeAccountId;
  const [localAccountId, setLocalAccountId] = useState<string | null>(null);
  
  const activeAccountId = localAccountId || effectiveAccountId;

  // Fetch trades
  const { data: tradesData, isLoading } = trpc.trades.listInfinite.useQuery(
    {
      accountId: activeAccountId || "",
      limit: 50,
      q: search || undefined,
    },
    { enabled: !!activeAccountId && isOpen }
  );

  const trades = tradesData?.items || [];

  // Handle trade selection
  const handleToggleTrade = (tradeId: string) => {
    if (multiple) {
      const newSelected = new Set(selectedIds);
      if (newSelected.has(tradeId)) {
        newSelected.delete(tradeId);
      } else {
        newSelected.add(tradeId);
      }
      setSelectedIds(newSelected);
    } else {
      setSelectedIds(new Set([tradeId]));
    }
  };

  // Handle confirm
  const handleConfirm = () => {
    const selectedTrades = trades.filter((t) => selectedIds.has(t.id));
    onSelect(selectedTrades);
    setSelectedIds(new Set());
    setSearch("");
    onClose();
  };

  // Handle close
  const handleClose = () => {
    setSelectedIds(new Set());
    setSearch("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-lg"
      >
        <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80 max-h-[80vh]">
          {/* Header */}
          <div className="flex items-start gap-3 px-5 py-4 shrink-0">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
              <Search className="h-3.5 w-3.5 text-white/60" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">{title}</div>
              <p className="mt-1 text-xs leading-relaxed text-white/40">
                {multiple ? "Select one or more trades to compare" : description}
              </p>
            </div>
            <DialogClose asChild>
              <button type="button" className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent text-white/50 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white">
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Close</span>
              </button>
            </DialogClose>
          </div>
          <Separator />

          {/* Body */}
          <div className="flex flex-col flex-1 overflow-hidden px-5 py-4 gap-3">
            {/* Account selector if multiple accounts */}
            {accounts && accounts.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {accounts.map((account) => (
                  <Button
                    key={account.id}
                    variant={activeAccountId === account.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLocalAccountId(account.id)}
                    className={cn(
                      activeAccountId === account.id
                        ? "bg-teal-500 hover:bg-teal-600"
                        : "border-white/10 text-white/60 hover:text-white"
                    )}
                  >
                    {account.name}
                  </Button>
                ))}
              </div>
            )}

            {/* No account state */}
            {!activeAccountId && accounts?.length === 0 && (
              <div className="text-center py-8 text-white/40">
                No trading accounts found. Add an account first.
              </div>
            )}

            {/* Search */}
            {activeAccountId && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search trades by symbol..."
                  className="pl-9 bg-sidebar-accent border-white/10 text-white placeholder:text-white/30"
                />
              </div>
            )}

            {/* Trade list */}
            {activeAccountId && (
              <ScrollArea className="flex-1">
                <div className="space-y-1 py-2">
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 bg-sidebar-accent" />
                    ))
                  ) : trades.length === 0 ? (
                    <div className="text-center py-8 text-white/40">
                      {search ? "No trades match your search" : "No trades found"}
                    </div>
                  ) : (
                    trades.map((trade) => (
                      <TradeSelectItem
                        key={trade.id}
                        trade={trade}
                        isSelected={selectedIds.has(trade.id)}
                        onToggle={() => handleToggleTrade(trade.id)}
                        showCheckbox={multiple}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            )}
          </div>

          <Separator />
          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 shrink-0">
            <div className="text-sm text-white/40">
              {selectedIds.size > 0 && (
                <>
                  {selectedIds.size} {selectedIds.size === 1 ? "trade" : "trades"} selected
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={selectedIds.size === 0}
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
              >
                {multiple ? "Add Trades" : "Add Trade"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Trade Select Item
// ============================================================================

interface TradeSelectItemProps {
  trade: TradeItem;
  isSelected: boolean;
  onToggle: () => void;
  showCheckbox?: boolean;
}

function TradeSelectItem({
  trade,
  isSelected,
  onToggle,
  showCheckbox = false,
}: TradeSelectItemProps) {
  const isLong = trade.tradeDirection === "long";
  const profit = Number(trade.profit || 0);
  const isWin = profit > 0;
  const pips = Number(trade.pips || 0);

  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-full flex items-center gap-3 p-3 transition-colors text-left",
        isSelected
          ? "bg-teal-500/10 border border-teal-500/30"
          : "bg-sidebar-accent border border-transparent hover:border-white/10"
      )}
    >
      {showCheckbox && (
        <Checkbox
          checked={isSelected}
          className="border-white/20 data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500"
        />
      )}

      {/* Direction icon */}
      <div
        className={cn(
          "flex items-center justify-center w-8 h-8",
          isLong ? "bg-teal-500/10" : "bg-red-500/10"
        )}
      >
        {isLong ? (
          <ArrowUpRight className="h-4 w-4 text-teal-400" />
        ) : (
          <ArrowDownRight className="h-4 w-4 text-red-400" />
        )}
      </div>

      {/* Trade info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">{trade.symbol || "Unknown"}</span>
          {trade.outcome && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs border-white/10",
                trade.outcome === "Win"
                  ? "text-teal-400"
                  : trade.outcome === "Loss"
                  ? "text-red-400"
                  : "text-yellow-400"
              )}
            >
              {trade.outcome}
            </Badge>
          )}
        </div>
        <div className="text-xs text-white/40 mt-0.5">
          {trade.close
            ? format(new Date(trade.close), "MMM d, h:mm a")
            : "Open"}{" "}
          • {pips > 0 ? "+" : ""}{pips.toFixed(1)} pips
        </div>
      </div>

      {/* P&L */}
      <div
        className={cn(
          "text-sm font-medium",
          isWin ? "text-teal-400" : "text-red-400"
        )}
      >
        {isWin ? "+" : ""}${profit.toFixed(2)}
      </div>
    </button>
  );
}

// ============================================================================
// Quick Trade Picker (inline version)
// ============================================================================

interface QuickTradePickerProps {
  isOpen: boolean;
  position: { top: number; left: number };
  onSelect: (trade: TradeItem) => void;
  onClose: () => void;
  accountId?: string;
}

export function QuickTradePicker({
  isOpen,
  position,
  onSelect,
  onClose,
  accountId,
}: QuickTradePickerProps) {
  const [search, setSearch] = useState("");
  
  const { data: accounts } = trpc.accounts.list.useQuery(undefined, { enabled: isOpen && !accountId });
  const { selectedAccountId: storeAccountId } = useAccountStore();
  
  const effectiveAccountId = accountId || storeAccountId;

  const { data: tradesData, isLoading } = trpc.trades.listInfinite.useQuery(
    {
      accountId: effectiveAccountId || "",
      limit: 10,
      q: search || undefined,
    },
    { enabled: !!effectiveAccountId && isOpen }
  );

  const trades = tradesData?.items || [];

  if (!isOpen) return null;

  return (
    <div
      className="fixed z-50 w-80 bg-sidebar border border-white/10 shadow-xl"
      style={{ top: position.top, left: position.left }}
    >
      {/* Account selector if needed */}
      {!effectiveAccountId && accounts && accounts.length > 0 && (
        <div className="p-2 border-b border-white/10 flex gap-1 flex-wrap">
          {accounts.slice(0, 3).map((account) => (
            <button
              key={account.id}
              onClick={() => {}}
              className="px-2 py-1 text-xs bg-teal-500/20 text-teal-400 rounded hover:bg-teal-500/30"
            >
              {account.name}
            </button>
          ))}
        </div>
      )}

      {/* Search header */}
      <div className="p-2 border-b border-white/10">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search trades..."
            className="w-full pl-7 pr-2 py-1.5 bg-sidebar-accent border-none text-sm text-white placeholder:text-white/30 focus:outline-none"
            autoFocus
          />
        </div>
      </div>

      {/* Trade list */}
      <div className="max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-white/40 text-sm">Loading...</div>
        ) : !effectiveAccountId ? (
          <div className="p-4 text-center text-white/40 text-sm">
            Select an account from the sidebar first
          </div>
        ) : trades.length === 0 ? (
          <div className="p-4 text-center text-white/40 text-sm">
            No trades found
          </div>
        ) : (
          trades.map((trade) => {
            const isLong = trade.tradeDirection === "long";
            const profit = Number(trade.profit || 0);
            const isWin = profit > 0;

            return (
              <button
                key={trade.id}
                onClick={() => {
                  onSelect(trade as any);
                  onClose();
                }}
                className="w-full flex items-center gap-2 p-2 hover:bg-white/5 transition-colors text-left"
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-6 h-6",
                    isLong ? "bg-teal-500/10" : "bg-red-500/10"
                  )}
                >
                  {isLong ? (
                    <ArrowUpRight className="h-3 w-3 text-teal-400" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white">{trade.symbol}</span>
                  <span className="text-xs text-white/40 ml-2">
                    {trade.close
                      ? format(new Date(trade.close), "MMM d")
                      : "Open"}
                  </span>
                </div>
                <span
                  className={cn(
                    "text-xs font-medium",
                    isWin ? "text-teal-400" : "text-red-400"
                  )}
                >
                  {isWin ? "+" : ""}${profit.toFixed(2)}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 p-1 text-white/40 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
