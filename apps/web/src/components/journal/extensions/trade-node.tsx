"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Trash2, ExternalLink, GripVertical, ArrowUpRight, ArrowDownRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/utils/trpc";

// Trade data passed via attrs (serialized)
interface TradeNodeAttrs {
  tradeId: string;
  symbol: string;
  tradeDirection: "long" | "short";
  profit: number;
  pips: number;
  closeTime: string | null;
  outcome: string | null;
  display: "card" | "inline" | "detailed";
}

// Node View Component
function TradeNodeView({ node, updateAttributes, deleteNode, selected }: any) {
  const [isHovered, setIsHovered] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const attrs = node.attrs as TradeNodeAttrs;
  const { tradeId, symbol, tradeDirection, profit, pips, closeTime, outcome, display } = attrs;

  const isPlaceholder = !tradeId || tradeId === "placeholder";
  const isLong = tradeDirection === "long";
  const isWin = profit > 0;
  const isBE = Math.abs(profit) < 1;

  // Handle trade selection from dialog
  const handleSelectTrade = (trade: any) => {
    updateAttributes({
      tradeId: trade.id,
      symbol: trade.symbol || "Unknown",
      tradeDirection: trade.tradeDirection === "short" ? "short" : "long",
      profit: Number(trade.profit) || 0,
      pips: Number(trade.pips) || 0,
      closeTime: trade.close || null,
      outcome: trade.outcome || null,
    });
    setShowSelector(false);
  };

  // Inline display
  if (display === "inline" && !isPlaceholder) {
    return (
      <NodeViewWrapper as="span" className="inline">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-sidebar-accent text-sm mx-1",
            isWin ? "text-teal-400" : isBE ? "text-yellow-400" : "text-red-400"
          )}
          contentEditable={false}
        >
          {isLong ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          <span className="font-medium">{symbol}</span>
          <span>
            {isWin ? "+" : ""}${profit.toFixed(2)}
          </span>
          <button
            onClick={() => deleteNode()}
            className="ml-1 text-white/40 hover:text-red-400"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </span>
      </NodeViewWrapper>
    );
  }

  // Placeholder state - show "Select Trade" card
  if (isPlaceholder) {
    return (
      <NodeViewWrapper className="my-4">
        <div
          className={cn(
            "relative bg-sidebar border border-dashed border-white/20 rounded-lg overflow-hidden group cursor-pointer hover:border-teal-500/50 transition-colors",
            selected && "ring-2 ring-teal-400/50"
          )}
          onClick={() => setShowSelector(true)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          contentEditable={false}
        >
          <div className="flex items-center justify-center gap-3 p-8">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-white/5">
              <Search className="h-6 w-6 text-white/40" />
            </div>
            <div className="text-left">
              <div className="text-white font-medium">Select a Trade</div>
              <div className="text-sm text-white/40">Click to choose a trade to embed</div>
            </div>
          </div>

          {/* Delete button */}
          {isHovered && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-7 w-7 p-0 text-red-400 hover:text-red-400 hover:bg-red-400/10"
              onClick={(e) => {
                e.stopPropagation();
                deleteNode();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Trade Selector Dialog */}
        <TradeSelectDialog
          isOpen={showSelector}
          onClose={() => setShowSelector(false)}
          onSelect={handleSelectTrade}
        />
      </NodeViewWrapper>
    );
  }

  // Card/Detailed display - show trade info
  return (
    <NodeViewWrapper className="my-4">
      <div
        className={cn(
          "relative bg-sidebar border border-white/10 rounded-lg overflow-hidden group",
          selected && "ring-2 ring-teal-400/50"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        contentEditable={false}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div
              className="cursor-grab active:cursor-grabbing text-white/30 hover:text-white/50"
              data-drag-handle
            >
              <GripVertical className="h-4 w-4" />
            </div>
            <div
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-lg",
                isLong ? "bg-teal-500/10" : "bg-red-500/10"
              )}
            >
              {isLong ? (
                <ArrowUpRight className="h-5 w-5 text-teal-400" />
              ) : (
                <ArrowDownRight className="h-5 w-5 text-red-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{symbol}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs border-white/10",
                    isLong ? "text-teal-400" : "text-red-400"
                  )}
                >
                  {isLong ? "LONG" : "SHORT"}
                </Badge>
                {outcome && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs border-white/10",
                      outcome === "Win"
                        ? "text-teal-400"
                        : outcome === "Loss"
                        ? "text-red-400"
                        : "text-yellow-400"
                    )}
                  >
                    {outcome}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-white/40 mt-0.5">
                {closeTime ? format(new Date(closeTime), "MMM d, yyyy 'at' h:mm a") : "Open"}
              </div>
            </div>
          </div>

          {/* Controls */}
          {isHovered && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-white/40 hover:text-white hover:bg-white/10"
                onClick={() => setShowSelector(true)}
                title="Change trade"
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-red-400 hover:text-red-400 hover:bg-red-400/10"
                onClick={() => deleteNode()}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 divide-x divide-white/5">
          <div className="p-3 text-center">
            <div className="text-xs text-white/40 mb-0.5">P&L</div>
            <div
              className={cn(
                "text-sm font-medium",
                isWin ? "text-teal-400" : isBE ? "text-yellow-400" : "text-red-400"
              )}
            >
              {isWin ? "+" : ""}${profit.toFixed(2)}
            </div>
          </div>
          <div className="p-3 text-center">
            <div className="text-xs text-white/40 mb-0.5">Pips</div>
            <div
              className={cn(
                "text-sm font-medium",
                pips > 0 ? "text-teal-400" : pips === 0 ? "text-yellow-400" : "text-red-400"
              )}
            >
              {pips > 0 ? "+" : ""}{pips.toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      {/* Trade Selector Dialog */}
      <TradeSelectDialog
        isOpen={showSelector}
        onClose={() => setShowSelector(false)}
        onSelect={handleSelectTrade}
      />
    </NodeViewWrapper>
  );
}

// ============================================================================
// Trade Select Dialog (embedded in node)
// ============================================================================

interface TradeSelectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (trade: any) => void;
}

function TradeSelectDialog({ isOpen, onClose, onSelect }: TradeSelectDialogProps) {
  const [search, setSearch] = useState("");

  // Fetch accounts first
  const { data: accounts } = trpc.accounts.list.useQuery(undefined, { enabled: isOpen });
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Auto-select first account
  React.useEffect(() => {
    if (accounts && accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  // Fetch trades for selected account
  const { data: tradesData, isLoading } = trpc.trades.listInfinite.useQuery(
    {
      accountId: selectedAccountId || "",
      limit: 50,
      q: search || undefined,
    },
    { enabled: !!selectedAccountId && isOpen }
  );

  const trades = tradesData?.items || [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-sidebar border-white/10 max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Trade</DialogTitle>
          <DialogDescription className="text-white/40">
            Choose a trade to embed in your journal entry
          </DialogDescription>
        </DialogHeader>

        {/* Account selector */}
        {accounts && accounts.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {accounts.map((account) => (
              <Button
                key={account.id}
                variant={selectedAccountId === account.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedAccountId(account.id)}
                className={cn(
                  selectedAccountId === account.id
                    ? "bg-teal-500 hover:bg-teal-600"
                    : "border-white/10 text-white/60 hover:text-white"
                )}
              >
                {account.name}
              </Button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search trades by symbol..."
            className="pl-9 bg-sidebar-accent border-white/10 text-white placeholder:text-white/30"
          />
        </div>

        {/* Trade list */}
        <ScrollArea className="flex-1 -mx-6 px-6 min-h-[300px]">
          <div className="space-y-1 py-2">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 bg-sidebar-accent rounded-lg" />
              ))
            ) : !selectedAccountId ? (
              <div className="text-center py-8 text-white/40">
                No account available
              </div>
            ) : trades.length === 0 ? (
              <div className="text-center py-8 text-white/40">
                {search ? "No trades match your search" : "No trades found"}
              </div>
            ) : (
              trades.map((trade) => {
                const isLong = trade.tradeDirection === "long";
                const profit = Number(trade.profit || 0);
                const isWin = profit > 0;
                const pips = Number((trade as any).pips || 0);

                return (
                  <button
                    key={trade.id}
                    onClick={() => onSelect(trade)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent border border-transparent hover:border-white/10 transition-colors text-left"
                  >
                    {/* Direction icon */}
                    <div
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-lg",
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
                        {pips !== 0 && <>• {pips > 0 ? "+" : ""}{pips.toFixed(1)} pips</>}
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
              })
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t border-white/5 pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// TipTap Extension
export const TradeNode = Node.create({
  name: "tradeEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      tradeId: { default: null },
      symbol: { default: "Unknown" },
      tradeDirection: { default: "long" },
      profit: { default: 0 },
      pips: { default: 0 },
      closeTime: { default: null },
      outcome: { default: null },
      display: { default: "card" },
    };
  },

  parseHTML() {
    return [{
      tag: 'div[data-trade-embed]',
      getAttrs: (dom) => {
        if (typeof dom === 'string') return {};
        const element = dom as HTMLElement;
        return {
          tradeId: element.getAttribute('data-trade-id'),
          symbol: element.getAttribute('data-symbol') || 'Unknown',
          tradeDirection: element.getAttribute('data-direction') || 'long',
          profit: parseFloat(element.getAttribute('data-profit') || '0'),
          pips: parseFloat(element.getAttribute('data-pips') || '0'),
          closeTime: element.getAttribute('data-close-time') || null,
          outcome: element.getAttribute('data-outcome') || null,
          display: element.getAttribute('data-display') || 'card',
        };
      },
    }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 
      'data-trade-embed': '',
      'data-trade-id': node.attrs.tradeId || '',
      'data-symbol': node.attrs.symbol || '',
      'data-direction': node.attrs.tradeDirection || 'long',
      'data-profit': String(node.attrs.profit || 0),
      'data-pips': String(node.attrs.pips || 0),
      'data-close-time': node.attrs.closeTime || '',
      'data-outcome': node.attrs.outcome || '',
      'data-display': node.attrs.display || 'card',
    })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TradeNodeView);
  },

  addCommands() {
    return {
      insertTrade:
        (attrs: Partial<TradeNodeAttrs>) =>
        ({ chain }: { chain: any }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs,
            })
            .run();
        },
    } as any;
  },
});

// Inline Trade Node for inline mentions
export const InlineTradeNode = Node.create({
  name: "inlineTradeEmbed",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      tradeId: { default: null },
      symbol: { default: "Unknown" },
      tradeDirection: { default: "long" },
      profit: { default: 0 },
    };
  },

  parseHTML() {
    return [{
      tag: 'span[data-inline-trade]',
      getAttrs: (dom) => {
        if (typeof dom === 'string') return {};
        const element = dom as HTMLElement;
        return {
          tradeId: element.getAttribute('data-trade-id'),
          symbol: element.getAttribute('data-symbol') || 'Unknown',
          tradeDirection: element.getAttribute('data-direction') || 'long',
          profit: parseFloat(element.getAttribute('data-profit') || '0'),
        };
      },
    }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 
      'data-inline-trade': '',
      'data-trade-id': node.attrs.tradeId || '',
      'data-symbol': node.attrs.symbol || '',
      'data-direction': node.attrs.tradeDirection || 'long',
      'data-profit': String(node.attrs.profit || 0),
    })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(({ node, deleteNode }: any) => {
      const { symbol, tradeDirection, profit } = node.attrs;
      const isLong = tradeDirection === "long";
      const isWin = profit > 0;

      return (
        <NodeViewWrapper as="span" className="inline">
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 bg-sidebar-accent text-xs mx-0.5 rounded",
              isWin ? "text-teal-400" : "text-red-400"
            )}
            contentEditable={false}
          >
            {isLong ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            <span className="font-medium">{symbol}</span>
            <span>{isWin ? "+" : ""}${Number(profit).toFixed(0)}</span>
          </span>
        </NodeViewWrapper>
      );
    });
  },
});
