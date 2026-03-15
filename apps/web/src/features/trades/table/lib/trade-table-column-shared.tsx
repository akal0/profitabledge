"use client";

import { Info } from "lucide-react";

import {
  formatTradePipValue,
  formatTradeTableCount,
  formatTradeTableCurrency,
  formatTradeTableDuration,
  formatTradeTableNumber,
  formatTradeTablePercent,
  formatTradeTablePrice,
  withTradeTableHeaderTooltip,
} from "@/features/trades/table/lib/trade-table-formatting";
import type { TradeRow } from "@/features/trades/table/lib/trade-table-types";

export const EMPTY_TRADE_CELL = <span className="text-white/40">—</span>;

export function renderTradeTableInfoHeader(id: string, label: string) {
  return withTradeTableHeaderTooltip(
    id,
    <div className="flex items-center gap-1">
      {label}
      <Info className="mr-1 size-3 text-white/40" />
    </div>
  );
}

export function renderNullableTradeValue<T>(
  value: T | null | undefined,
  formatter: (value: T) => string
) {
  if (value == null) return EMPTY_TRADE_CELL;
  return <span className="text-white/70">{formatter(value)}</span>;
}

export function renderNullableTradePips(
  value: number | null | undefined,
  trade: TradeRow
) {
  return renderNullableTradeValue(value, (next) => formatTradePipValue(next, trade));
}

export function renderNullableTradeCount(value: number | null | undefined) {
  return renderNullableTradeValue(value, formatTradeTableCount);
}

export function renderNullableTradeNumber(
  value: number | null | undefined,
  digits = 2
) {
  return renderNullableTradeValue(value, (next) => formatTradeTableNumber(next, digits));
}

export function renderNullableTradeCurrency(
  value: number | null | undefined,
  digits = 2
) {
  return renderNullableTradeValue(value, (next) => formatTradeTableCurrency(next, digits));
}

export function renderNullableTradePercent(
  value: number | null | undefined,
  digits = 2
) {
  return renderNullableTradeValue(value, (next) => formatTradeTablePercent(next, digits));
}

export function renderNullableTradeDuration(value: number | null | undefined) {
  return renderNullableTradeValue(value, formatTradeTableDuration);
}

export function renderNullableTradePrice(value: number | null | undefined) {
  return renderNullableTradeValue(value, formatTradeTablePrice);
}

export function formatTradeTimestamp(raw: string) {
  const date = new Date(raw);
  const day = date.getDate();
  const j = day % 10;
  const k = day % 100;
  const suffix =
    j === 1 && k !== 11
      ? "st"
      : j === 2 && k !== 12
        ? "nd"
        : j === 3 && k !== 13
          ? "rd"
          : "th";
  const month = date.toLocaleString("en-GB", { month: "short" });
  const year = date.getFullYear();
  const timePart = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return `${day}${suffix} ${month}' ${year} - ${timePart}`;
}
