"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { GitCompare, Plus, X, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TradeSelectorDialog } from "../trade-selector";
import {
  getTradeDirectionTone,
  getTradeOutcomeTone,
  TRADE_IDENTIFIER_PILL_CLASS,
} from "@/components/trades/trade-identifier-pill";

// ============================================================================
// Types
// ============================================================================

interface TradeData {
  id: string;
  symbol: string | null;
  tradeDirection?: "long" | "short";
  profit: number | null;
  pips?: number | null;
  close?: string | null;
  outcome?: string | null;
}

function normalizeTradeOutcome(outcome: string | null | undefined, profit: number | null) {
  const normalized = (outcome || "").trim().toLowerCase();

  if (normalized === "win") return "Win";
  if (normalized === "loss") return "Loss";
  if (normalized === "breakeven" || normalized === "be") return "BE";
  if (normalized === "pw" || normalized === "partial win") return "PW";

  if (profit == null) {
    return null;
  }

  if (profit > 0) return "Win";
  if (profit < 0) return "Loss";
  return "BE";
}

function normalizeTradeData(
  trade: Partial<TradeData> & { closeTime?: unknown }
): TradeData {
  const tradeRecord = trade as Record<string, unknown>;
  const profit =
    trade.profit == null || Number.isNaN(Number(trade.profit))
      ? null
      : Number(trade.profit);
  const pips =
    trade.pips == null || Number.isNaN(Number(trade.pips))
      ? null
      : Number(trade.pips);
  const close =
    typeof trade.close === "string"
      ? trade.close
      : typeof tradeRecord.closeTime === "string"
        ? tradeRecord.closeTime
        : null;

  return {
    id: String(trade.id || ""),
    symbol: typeof trade.symbol === "string" ? trade.symbol : null,
    tradeDirection: trade.tradeDirection === "short" ? "short" : "long",
    profit,
    pips,
    close,
    outcome: normalizeTradeOutcome(
      typeof trade.outcome === "string" ? trade.outcome : null,
      profit
    ),
  };
}

// ============================================================================
// Trade Comparison Node View Component
// ============================================================================

function TradeComparisonNodeView({ node, updateAttributes, deleteNode, selected }: any) {
  const { trades: savedTrades = [] } = node.attrs;
  const [showSelector, setShowSelector] = useState(false);
  const [selectedTrades, setSelectedTrades] = useState<TradeData[]>(
    Array.isArray(savedTrades) ? savedTrades.map(normalizeTradeData) : []
  );

  // Sync state with node attrs when they change (e.g., loading from DB)
  React.useEffect(() => {
    if (!Array.isArray(savedTrades)) {
      setSelectedTrades([]);
      return;
    }

    setSelectedTrades(savedTrades.map(normalizeTradeData));
  }, [savedTrades]);

  const handleAddTrades = (newTrades: TradeData[]) => {
    // Combine existing with new, up to 4 total
    const combined = [...selectedTrades];
    for (const trade of newTrades) {
      const normalizedTrade = normalizeTradeData(trade);
      if (!combined.find(t => t.id === normalizedTrade.id) && combined.length < 4) {
        combined.push(normalizedTrade);
      }
    }
    setSelectedTrades(combined);
    updateAttributes({ trades: combined });
    setShowSelector(false);
  };

  const handleRemoveTrade = (tradeId: string) => {
    const filtered = selectedTrades.filter((t) => t.id !== tradeId);
    setSelectedTrades(filtered);
    updateAttributes({ trades: filtered });
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getOutcomeLabel = (
    outcome: string | null | undefined,
    profit: number | null
  ) => {
    const normalizedOutcome = normalizeTradeOutcome(outcome, profit);

    switch (normalizedOutcome) {
      case "BE":
        return "Breakeven";
      case "PW":
        return "Partial win";
      case "Win":
        return "Win";
      case "Loss":
        return "Loss";
      default:
        return "N/A";
    }
  };

  // Empty state - show add trades prompt
  if (selectedTrades.length === 0) {
    return (
      <NodeViewWrapper>
        <div
          className={cn(
            "my-4 p-6 rounded-lg border-2 border-dashed bg-sidebar-accent/50 group relative",
            selected ? "border-teal-500" : "border-white/20"
          )}
        >
          <button
            onClick={deleteNode}
            className="absolute top-2 right-2 p-1.5 rounded bg-black/50 text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex flex-col items-center justify-center text-center">
            <GitCompare className="h-10 w-10 text-white/30 mb-3" />
            <h3 className="text-sm font-medium text-white mb-1">Trade comparison</h3>
            <p className="text-xs text-white/40 mb-4 max-w-xs">
              Compare up to 4 trades side by side to analyze patterns and differences
            </p>
            <Button
              onClick={() => setShowSelector(true)}
              className="bg-teal-500 hover:bg-teal-600"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add trades
            </Button>
          </div>

          {/* Trade Selector Dialog */}
          <TradeSelectorDialog
            isOpen={showSelector}
            onClose={() => setShowSelector(false)}
            onSelect={handleAddTrades}
            multiple={true}
            title="Select trades to compare"
            description="Choose up to 4 trades to compare side by side"
          />
        </div>
      </NodeViewWrapper>
    );
  }

  // Show comparison table
  return (
    <NodeViewWrapper>
      <div
        className={cn(
          "my-4 rounded-lg border overflow-hidden group relative",
          selected ? "border-teal-500" : "border-white/10"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-sidebar-accent border-b border-white/10">
          <div className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-teal-400" />
            <span className="text-sm font-medium text-white">
              Trade comparison ({selectedTrades.length} trades)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selectedTrades.length < 4 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSelector(true)}
                className="h-7 text-xs text-white/60 hover:text-white"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            )}
            <button
              onClick={deleteNode}
              className="p-1.5 rounded text-white/40 hover:text-white hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-sidebar-accent/50">
                <th className="text-left p-3 text-white/60 font-medium">Metric</th>
                {selectedTrades.map((trade) => (
                  <th key={trade.id} className="text-left p-3 min-w-[140px]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-xs font-medium",
                          trade.tradeDirection === "long" ? "text-teal-400" : "text-red-400"
                        )}>
                          {trade.symbol || "N/A"}
                        </span>
                        {trade.tradeDirection === "long" ? (
                          <TrendingUp className="h-3 w-3 text-teal-400" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-400" />
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveTrade(trade.id)}
                        className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Direction */}
              <tr className="border-b border-white/5">
                <td className="p-3 text-white/60">Direction</td>
                {selectedTrades.map((trade) => (
                  <td key={trade.id} className="p-3">
                    <span
                      className={cn(
                        TRADE_IDENTIFIER_PILL_CLASS,
                        getTradeDirectionTone(trade.tradeDirection),
                        "capitalize"
                      )}
                    >
                      {trade.tradeDirection || "N/A"}
                      {trade.tradeDirection === "long" ? (
                        <TrendingUp className="size-3" />
                      ) : trade.tradeDirection === "short" ? (
                        <TrendingDown className="size-3" />
                      ) : null}
                    </span>
                  </td>
                ))}
              </tr>

              {/* P&L */}
              <tr className="border-b border-white/5">
                <td className="p-3 text-white/60">Profit/Loss</td>
                {selectedTrades.map((trade) => (
                  <td key={trade.id} className="p-3">
                    <span className={cn(
                      "font-medium",
                      (trade.profit || 0) >= 0 ? "text-teal-400" : "text-red-400"
                    )}>
                      {formatCurrency(trade.profit)}
                    </span>
                  </td>
                ))}
              </tr>

              {/* Pips */}
              <tr className="border-b border-white/5">
                <td className="p-3 text-white/60">Pips</td>
                {selectedTrades.map((trade) => (
                  <td key={trade.id} className="p-3">
                    <span className={cn(
                      "font-medium",
                      (trade.pips ?? 0) >= 0 ? "text-teal-400" : "text-red-400"
                    )}>
                      {trade.pips == null ? "-" : `${trade.pips > 0 ? "+" : ""}${trade.pips.toFixed(1)}`}
                    </span>
                  </td>
                ))}
              </tr>

              {/* Outcome */}
              <tr className="border-b border-white/5">
                <td className="p-3 text-white/60">Outcome</td>
                {selectedTrades.map((trade) => (
                  <td key={trade.id} className="p-3">
                    <span
                      className={cn(
                        TRADE_IDENTIFIER_PILL_CLASS,
                        getTradeOutcomeTone(normalizeTradeOutcome(trade.outcome, trade.profit))
                      )}
                    >
                      {getOutcomeLabel(trade.outcome, trade.profit)}
                    </span>
                  </td>
                ))}
              </tr>

              {/* Close Time */}
              <tr>
                <td className="p-3 text-white/60">Closed</td>
                {selectedTrades.map((trade) => (
                  <td key={trade.id} className="p-3 text-white/80 text-xs">
                    {trade.close 
                      ? new Date(trade.close).toLocaleDateString()
                      : "-"
                    }
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Trade Selector Dialog */}
        <TradeSelectorDialog
          isOpen={showSelector}
          onClose={() => setShowSelector(false)}
          onSelect={handleAddTrades}
          multiple={true}
          title="Add more trades"
          description={`Select trades to add (${4 - selectedTrades.length} remaining)`}
        />
      </div>
    </NodeViewWrapper>
  );
}

// ============================================================================
// TipTap Extension
// ============================================================================

export const TradeComparisonNode = Node.create({
  name: "tradeComparisonNode",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      trades: {
        default: [],
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-trade-comparison]',
        getAttrs: (dom) => {
          if (typeof dom === "string") return {};
          const element = dom as HTMLElement;
          const tradesStr = element.getAttribute("data-trades") || "[]";
          try {
            return { trades: JSON.parse(decodeURIComponent(tradesStr)) };
          } catch {
            try {
              return { trades: JSON.parse(tradesStr) };
            } catch {
              return { trades: [] };
            }
          }
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-trade-comparison": "",
        "data-trades": encodeURIComponent(JSON.stringify(node.attrs.trades || [])),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TradeComparisonNodeView);
  },
});
