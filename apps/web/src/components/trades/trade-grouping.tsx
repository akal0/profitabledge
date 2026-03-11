"use client";

import * as React from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrencyValue } from "@/lib/trade-formatting";

export type GroupingMode = "none" | "session" | "day" | "model" | "symbol";

interface TradeGroup<T> {
  key: string;
  label: string;
  count: number;
  totalPnL: number;
  items: T[];
  isExpanded: boolean;
}

interface TradeGroupingProps<T> {
  data: T[];
  groupBy: GroupingMode;
  getGroupKey: (item: T, mode: GroupingMode) => string;
  getGroupLabel: (key: string, mode: GroupingMode, items: T[]) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  renderGroupHeader?: (group: TradeGroup<T>) => React.ReactNode;
}

export function useTradeGrouping<T extends { profit: number }>(
  data: T[],
  groupBy: GroupingMode,
  getGroupKey: (item: T, mode: GroupingMode) => string
) {
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
    new Set()
  );

  const groups = React.useMemo(() => {
    if (groupBy === "none") return null;

    const groupMap = new Map<string, T[]>();

    // Group items
    data.forEach((item) => {
      const key = getGroupKey(item, groupBy);
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(item);
    });

    // Convert to array and calculate stats
    const groupArray = Array.from(groupMap.entries())
      .map(([key, items]) => ({
        key,
        items,
        count: items.length,
        totalPnL: items.reduce((sum, item) => sum + (item.profit || 0), 0),
      }))
      .sort((a, b) => {
        // Sort by key (which might be a date string or tag name)
        if (groupBy === "day") {
          return b.key.localeCompare(a.key); // Most recent first
        }
        return a.key.localeCompare(b.key); // Alphabetical
      });

    return groupArray;
  }, [data, groupBy, getGroupKey]);

  const toggleGroup = React.useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const expandAll = React.useCallback(() => {
    if (groups) {
      setExpandedGroups(new Set(groups.map((g) => g.key)));
    }
  }, [groups]);

  const collapseAll = React.useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

  return {
    groups,
    expandedGroups,
    toggleGroup,
    expandAll,
    collapseAll,
  };
}

export function TradeGroupHeader<T>({
  group,
  isExpanded,
  onToggle,
  className,
}: {
  group: { key: string; label?: string; count: number; totalPnL: number };
  isExpanded: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-3 bg-sidebar-accent border-b border-white/5",
        "hover:bg-white/5 cursor-pointer transition-colors",
        "sticky top-0 z-10",
        className
      )}
      onClick={onToggle}
    >
      <div className="flex items-center gap-3">
        {isExpanded ? (
          <ChevronDown className="size-4 text-white/60" />
        ) : (
          <ChevronRight className="size-4 text-white/60" />
        )}
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white">
            {group.label || group.key}
          </span>
          <span className="text-xs text-white/40">({group.count} trades)</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <span className="text-xs text-white/40 mr-2">Total P&L:</span>
          <span
            className={cn(
              "text-sm font-semibold",
              group.totalPnL >= 0 ? "text-teal-400" : "text-rose-400"
            )}
          >
            {formatCurrencyValue(group.totalPnL, {
              showPlus: true,
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

export function GroupingControls({
  mode,
  onModeChange,
  onExpandAll,
  onCollapseAll,
  hasGroups,
}: {
  mode: GroupingMode;
  onModeChange: (mode: GroupingMode) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  hasGroups: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/50">Group by:</span>
      <div className="flex items-center border border-white/5 rounded-xs overflow-hidden">
        {(["none", "day", "session", "model", "symbol"] as GroupingMode[]).map(
          (groupMode) => (
            <button
              key={groupMode}
              onClick={() => onModeChange(groupMode)}
              className={cn(
                "px-3 py-1.5 text-xs transition-colors capitalize",
                mode === groupMode
                  ? "bg-sidebar-accent text-white"
                  : "bg-sidebar text-white/50 hover:text-white hover:bg-sidebar-accent"
              )}
            >
              {groupMode === "none" ? "None" : groupMode}
            </button>
          )
        )}
      </div>

      {hasGroups && mode !== "none" && (
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={onExpandAll}
            className="px-2 py-1 text-xs text-white/50 hover:text-white hover:bg-white/5 rounded-xs transition-colors"
          >
            Expand all
          </button>
          <span className="text-white/20">|</span>
          <button
            onClick={onCollapseAll}
            className="px-2 py-1 text-xs text-white/50 hover:text-white hover:bg-white/5 rounded-xs transition-colors"
          >
            Collapse all
          </button>
        </div>
      )}
    </div>
  );
}

// Helper function to get group key from trade
export function getTradeGroupKey<T extends {
  open: string;
  sessionTag?: string | null;
  modelTag?: string | null;
  symbol?: string;
}>(
  trade: T,
  mode: GroupingMode
): string {
  switch (mode) {
    case "day":
      return new Date(trade.open).toISOString().split("T")[0];
    case "session":
      return trade.sessionTag || "Untagged";
    case "model":
      return trade.modelTag || "Untagged";
    case "symbol":
      return trade.symbol || "Unknown";
    default:
      return "all";
  }
}

// Helper function to get group label
export function getTradeGroupLabel<T>(
  key: string,
  mode: GroupingMode,
  items: T[]
): string {
  switch (mode) {
    case "day": {
      const date = new Date(key);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const dateStr = date.toISOString().split("T")[0];
      const todayStr = today.toISOString().split("T")[0];
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      if (dateStr === todayStr) return "Today";
      if (dateStr === yesterdayStr) return "Yesterday";

      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    case "session":
    case "model":
    case "symbol":
      return key;
    default:
      return key;
  }
}
