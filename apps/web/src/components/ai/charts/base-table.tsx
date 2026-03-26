"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDisplayCurrency, formatDisplayNumber } from "@/lib/format-display";

export interface TableColumn {
  key: string;
  label: string;
  type?: "string" | "currency" | "percent" | "number" | "date";
}

export interface BaseTableProps {
  rows: any[];
  columns?: TableColumn[];
  maxRows?: number;
  tradeIds?: string[];
  onViewTrades?: (tradeIds: string[]) => void;
}

function sentenceCase(value: string): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function formatCellValue(value: any, type?: string): string {
  if (value === null || value === undefined) return "-";
  switch (type) {
    case "currency": {
      return formatDisplayCurrency(Number(value));
    }
    case "percent":
      return `${Number(value).toFixed(1)}%`;
    case "number":
      return formatDisplayNumber(Number(value));
    case "date":
      return new Date(value).toLocaleDateString();
    default:
      return String(value);
  }
}

export function BaseTable({
  rows,
  columns,
  maxRows = 10,
  tradeIds,
  onViewTrades,
}: BaseTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-white/50 text-center py-4">
        No data available
      </p>
    );
  }

  const displayColumns =
    columns && columns.length > 0
      ? columns
      : Object.keys(rows[0])
          .slice(0, 5)
          .map((key) => ({
            key,
            label: key
              .replace(/([A-Z])/g, " $1")
              .replace(/^./, (s) => s.toUpperCase()),
            type: "string" as const,
          }));

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10">
              {displayColumns.map((col) => (
                <th
                  key={col.key}
                  className="text-left py-2 px-3.5 text-white/50 font-medium"
                >
                  {sentenceCase(col.label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, maxRows).map((row: any, i: number) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                {displayColumns.map((col) => (
                  <td key={col.key} className="py-2 px-3.5 text-white/70">
                    {formatCellValue(row[col.key], col.type)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > maxRows && (
        <p className="text-[10px] text-white/40 text-center">
          Showing {maxRows} of {rows.length} rows
        </p>
      )}

      {tradeIds && tradeIds.length > 0 && onViewTrades && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => onViewTrades(tradeIds)}
        >
          View all {tradeIds.length} trades{" "}
          <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      )}
    </div>
  );
}
