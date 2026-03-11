"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { TrendingUp, TrendingDown } from "lucide-react";

export interface BaseKpiSingleProps {
  value: string | number;
  label?: string;
  change?: number;
  changeLabel?: string;
  tradeCount?: number;
  formatValue?: (v: number, label?: string) => string;
}

export interface BaseKpiGridProps {
  items: Array<{ label: string; value: string | number }>;
}

const defaultFormatValue = (v: number, label?: string): string => {
  const labelLower = (label || "").toLowerCase();
  if (
    labelLower.includes("percent") ||
    labelLower.includes("rate") ||
    labelLower.includes("efficiency")
  ) {
    return `${v.toFixed(1)}%`;
  }
  if (
    labelLower.includes("profit") ||
    labelLower.includes("loss") ||
    labelLower.includes("balance")
  ) {
    const abs = Math.abs(v);
    const sign = v < 0 ? "-$" : "$";
    return `${sign}${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  if (
    labelLower.includes("hold") ||
    labelLower.includes("duration") ||
    labelLower.includes("seconds")
  ) {
    const total = Math.max(0, Math.round(v));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return v.toFixed(2);
};

function sentenceCase(value: string): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

export function BaseKpiSingle({
  value,
  label,
  change,
  changeLabel,
  tradeCount,
  formatValue: fmt = defaultFormatValue,
}: BaseKpiSingleProps) {
  const isPositive =
    typeof change === "number"
      ? change >= 0
      : typeof value === "number"
      ? value >= 0
      : true;

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <div
        className={cn(
          "text-4xl font-bold tracking-tight",
          isPositive ? "text-teal-400" : "text-rose-400"
        )}
      >
        {typeof value === "number" ? (
          <AnimatedNumber value={value} format={(n) => fmt(n, label)} />
        ) : (
          value
        )}
      </div>
      {label && (
        <p className="text-sm text-white/50 mt-1 normal-case">
          {sentenceCase(label)}
        </p>
      )}
      {change !== undefined && (
        <div
          className={cn(
            "flex items-center gap-1 mt-2 text-xs",
            change >= 0 ? "text-teal-400" : "text-rose-400"
          )}
        >
          {change >= 0 ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          <span>
            {change >= 0 ? "+" : ""}
            {change.toFixed(1)}%
          </span>
          {changeLabel && (
            <span className="text-white/40">vs {changeLabel}</span>
          )}
        </div>
      )}
      {tradeCount !== undefined && (
        <p className="text-[12px] text-white/30 mt-1">
          Based on {tradeCount} trades
        </p>
      )}
    </div>
  );
}

export function BaseKpiGrid({ items }: BaseKpiGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((row, i) => (
        <div key={i} className="bg-white/5 rounded-lg p-3">
          <p className="text-[10px] text-white/50 tracking-wider">
            {sentenceCase(row.label)}
          </p>
          <p className="text-lg font-semibold text-white mt-1">{row.value}</p>
        </div>
      ))}
    </div>
  );
}
