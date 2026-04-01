"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatDisplayCurrency } from "@/lib/format-display";

export interface ComparisonSide {
  label: string;
  value: number;
  count?: number;
}

export interface BaseComparisonCardProps {
  a: ComparisonSide;
  b: ComparisonSide;
  delta: number;
  deltaPercent?: string;
  formatValue?: (v: number) => string;
  betterWhen?: "higher" | "lower";
}

const defaultFormat = (v: number) => {
  return formatDisplayCurrency(v);
};

export function BaseComparisonCard({
  a,
  b,
  delta,
  deltaPercent,
  formatValue: fmt = defaultFormat,
  betterWhen = "higher",
}: BaseComparisonCardProps) {
  const isABetter =
    betterWhen === "lower" ? a.value < b.value : a.value > b.value;
  const deltaTone =
    delta === 0
      ? "text-white/70"
      : betterWhen === "lower"
      ? delta < 0
        ? "text-teal-400"
        : "text-rose-400"
      : delta > 0
      ? "text-teal-400"
      : "text-rose-400";

  return (
    <div className="flex h-max w-full flex-col justify-center space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div
          className={cn(
            "p-4 rounded-lg border",
            isABetter
              ? "bg-teal-500/10 border-teal-500/30"
              : "bg-white/5 border-white/10"
          )}
        >
          <p className="text-xs text-white/50 mb-1">{a.label}</p>
          <p
            className={cn(
              "text-2xl font-bold",
              isABetter ? "text-teal-400" : "text-white"
            )}
          >
            {fmt(a.value)}
          </p>
          {a.count && (
            <p className="text-[10px] text-white/30 mt-1">n={a.count}</p>
          )}
        </div>

        <div
          className={cn(
            "p-4 rounded-lg border",
            !isABetter
              ? "bg-teal-500/10 border-teal-500/30"
              : "bg-white/5 border-white/10"
          )}
        >
          <p className="text-xs text-white/50 mb-1">{b.label}</p>
          <p
            className={cn(
              "text-2xl font-bold",
              !isABetter ? "text-teal-400" : "text-white"
            )}
          >
            {fmt(b.value)}
          </p>
          {b.count && (
            <p className="text-[10px] text-white/30 mt-1">n={b.count}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 py-2 bg-white/5 rounded-lg">
        <span className="text-white/50 text-sm">Difference:</span>
        <span
          className={cn(
            "font-semibold",
            deltaTone
          )}
        >
          {delta >= 0 ? "+" : ""}
          {fmt(delta)}
        </span>
        {deltaPercent && (
          <Badge variant="outline" className="text-xs">
            {deltaPercent}
          </Badge>
        )}
      </div>
    </div>
  );
}
