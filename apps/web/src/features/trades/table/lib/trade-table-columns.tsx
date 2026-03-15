"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { tradeTableAnalyticsColumns } from "@/features/trades/table/lib/trade-table-columns-analytics";
import { tradeTableCoreColumns } from "@/features/trades/table/lib/trade-table-columns-core";
import type { TradeRow } from "@/features/trades/table/lib/trade-table-types";

export const tradeTableColumns: ColumnDef<TradeRow>[] = [
  ...tradeTableCoreColumns,
  ...tradeTableAnalyticsColumns,
];
