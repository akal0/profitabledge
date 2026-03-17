"use client";

import * as React from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import {
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
  getTradeDirectionTone,
  getTradeOutcomeTone,
} from "@/components/trades/trade-identifier-pill";
import { Button } from "@/components/ui/button";
import { useDataTable } from "@/hooks/use-data-table";
import {
  formatTradeTimestamp,
  renderNullableTradePrice,
} from "@/features/trades/table/lib/trade-table-column-shared";
import {
  getTradeProfitTone,
  getTradeRealisedRRTone,
  withTradeTableHeaderTooltip,
} from "@/features/trades/table/lib/trade-table-formatting";
import { formatTradePnlDisplayValue } from "@/features/trades/table/lib/trade-table-pnl-display";
import { cn } from "@/lib/utils";
import { getOriginBadgeClassName } from "@/features/public-proof/lib/public-proof-badges";
import {
  formatCurrency,
  formatDuration,
} from "@/features/public-proof/lib/public-proof-formatters";
import { PublicProofTradeGroupHeader } from "@/features/public-proof/components/public-proof-trade-group-header";
import { PublicProofTradesToolbar } from "@/features/public-proof/components/public-proof-trades-toolbar";
import {
  getPublicProofGroupKey,
  type PublicProofGroupBy,
  type PublicProofSortValue,
  type PublicProofTradeRow,
} from "@/features/public-proof/lib/public-proof-trades-table";

const DEFAULT_SORT: PublicProofSortValue = "time:desc";

function toTimestamp(value?: string | Date | null) {
  if (!value) return 0;
  return new Date(value).getTime();
}

function mapSortValueToSorting(sortValue: PublicProofSortValue): SortingState {
  const [field, dir] = sortValue.split(":") as [string, "asc" | "desc"];
  const desc = dir === "desc";

  switch (field) {
    case "time":
      return [{ id: "time", desc }];
    case "profit":
      return [{ id: "profit", desc }];
    case "volume":
      return [{ id: "volume", desc }];
    case "durationSeconds":
      return [{ id: "durationSeconds", desc }];
    case "symbol":
      return [{ id: "symbol", desc }];
    case "tradeType":
      return [{ id: "tradeType", desc }];
    default:
      return [{ id: "time", desc: true }];
  }
}

export function PublicProofTradesTable({
  rows,
  searchValue,
  onSearchChange,
  outcomeFilter,
  onOutcomeFilterChange,
  sourceFilter,
  onSourceFilterChange,
  statusFilter,
  onStatusFilterChange,
  editFilter,
  onEditFilterChange,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  rows: PublicProofTradeRow[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  outcomeFilter: string;
  onOutcomeFilterChange: (value: string) => void;
  sourceFilter: string;
  onSourceFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  editFilter: string;
  onEditFilterChange: (value: string) => void;
  isLoading?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
}) {
  const [sortValue, setSortValue] =
    React.useState<PublicProofSortValue>(DEFAULT_SORT);
  const [groupBy, setGroupBy] = React.useState<PublicProofGroupBy | null>(null);

  const columns = React.useMemo<ColumnDef<PublicProofTradeRow>[]>(
    () => [
      {
        id: "time",
        accessorFn: (row) =>
          toTimestamp(row.closeTime || row.openTime || row.createdAt),
        header: () => withTradeTableHeaderTooltip("open", "Time"),
        enableHiding: false,
        size: 240,
        minSize: 200,
        cell: ({ row }) => {
          const trade = row.original;
          const timestamp =
            trade.closeTime || trade.openTime || trade.createdAt;

          return (
            <div className="flex flex-col">
              <span className="text-xs text-white/70">
                {formatTradeTimestamp(new Date(timestamp).toISOString())}
              </span>
              <span className="mt-1 text-[11px] text-white/35">
                {trade.isLive
                  ? `Open for ${formatDuration(trade.durationSeconds)}`
                  : formatDuration(trade.durationSeconds)}
              </span>
            </div>
          );
        },
      },
      {
        id: "symbol",
        accessorKey: "symbol",
        header: () => withTradeTableHeaderTooltip("symbol", "Symbol"),
        enableHiding: false,
        size: 120,
        minSize: 100,
        cell: ({ row }) => (
          <span className="font-medium tracking-wide text-white">
            {row.original.symbol || "—"}
          </span>
        ),
      },
      {
        id: "tradeType",
        accessorKey: "tradeType",
        header: () =>
          withTradeTableHeaderTooltip("tradeDirection", "Direction"),
        enableHiding: false,
        size: 120,
        minSize: 100,
        cell: ({ row }) => (
          <span
            className={cn(
              TRADE_IDENTIFIER_PILL_CLASS,
              getTradeDirectionTone(row.original.tradeType)
            )}
          >
            {row.original.tradeType === "long"
              ? "Long"
              : row.original.tradeType === "short"
              ? "Short"
              : "—"}
          </span>
        ),
      },
      {
        id: "volume",
        accessorKey: "volume",
        header: () => withTradeTableHeaderTooltip("volume", "Volume"),
        enableHiding: false,
        size: 100,
        minSize: 90,
        cell: ({ row }) => (
          <span className="text-white/70">{row.original.volume ?? "—"}</span>
        ),
      },
      {
        id: "openPrice",
        accessorKey: "openPrice",
        header: () => withTradeTableHeaderTooltip("open", "Entry"),
        enableHiding: false,
        size: 130,
        minSize: 110,
        cell: ({ row }) => renderNullableTradePrice(row.original.openPrice),
      },
      {
        id: "closePrice",
        accessorKey: "closePrice",
        header: () => withTradeTableHeaderTooltip("close", "Exit"),
        enableHiding: false,
        size: 130,
        minSize: 110,
        cell: ({ row }) =>
          row.original.isLive ? (
            <span className="text-white/40">—</span>
          ) : (
            renderNullableTradePrice(row.original.closePrice)
          ),
      },
      {
        id: "profit",
        accessorKey: "profit",
        header: () => withTradeTableHeaderTooltip("profit", "Profit"),
        enableHiding: false,
        size: 140,
        minSize: 120,
        cell: ({ row }) => {
          if (row.original.profit == null) {
            return <span className="text-white/40">—</span>;
          }

          const value = Number(row.original.profit);
          return (
            <span
              className={cn(
                TRADE_IDENTIFIER_PILL_CLASS,
                getTradeProfitTone(value)
              )}
            >
              {formatTradePnlDisplayValue(value, {
                currencyOptions: {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                },
              })}
            </span>
          );
        },
      },
      {
        id: "rr",
        accessorKey: "rr",
        header: () => withTradeTableHeaderTooltip("realisedRR", "R"),
        enableHiding: false,
        size: 110,
        minSize: 90,
        cell: ({ row }) => {
          const value = row.original.rr;
          if (value == null || !Number.isFinite(value)) {
            return <span className="text-white/40">—</span>;
          }

          return (
            <span
              className={cn(
                TRADE_IDENTIFIER_PILL_CLASS,
                getTradeRealisedRRTone(value)
              )}
            >
              {value > 0 ? "+" : ""}
              {value.toFixed(2)}R
            </span>
          );
        },
      },
      {
        id: "originLabel",
        accessorKey: "originLabel",
        header: () => withTradeTableHeaderTooltip("customTags", "Source"),
        enableHiding: false,
        size: 140,
        minSize: 120,
        cell: ({ row }) => (
          <span
            className={cn(
              TRADE_IDENTIFIER_PILL_CLASS,
              getOriginBadgeClassName(row.original.originType)
            )}
          >
            {row.original.originLabel || "Unknown"}
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: (row) =>
          row.isLive
            ? "Live"
            : row.outcome === "PW"
            ? "Partial win"
            : row.outcome || "Closed",
        header: () => withTradeTableHeaderTooltip("outcome", "Outcome"),
        enableHiding: false,
        size: 220,
        minSize: 180,
        cell: ({ row }) => {
          const trade = row.original;

          return (
            <div className="flex flex-wrap gap-1.5">
              {trade.isLive ? (
                <span
                  className={cn(
                    TRADE_IDENTIFIER_PILL_CLASS,
                    TRADE_IDENTIFIER_TONES.live,
                    "gap-2"
                  )}
                >
                  <span className="size-1.5 rounded-full bg-teal-400 shadow-[0_0_8px_2px_rgba(45,212,191,0.4)]" />
                  Live
                </span>
              ) : (
                <span
                  className={cn(
                    TRADE_IDENTIFIER_PILL_CLASS,
                    getTradeOutcomeTone(trade.outcome)
                  )}
                >
                  {trade.outcome === "PW"
                    ? "Partial win"
                    : trade.outcome === "BE"
                    ? "Breakeven"
                    : trade.outcome || "Closed"}
                </span>
              )}
              {trade.edited ? (
                <span
                  className={cn(
                    TRADE_IDENTIFIER_PILL_CLASS,
                    TRADE_IDENTIFIER_TONES.warning
                  )}
                >
                  Edited
                </span>
              ) : null}
            </div>
          );
        },
      },
    ],
    []
  );

  const { table, setSorting } = useDataTable({
    data: rows,
    columns,
    disablePreferences: true,
    getRowId: (row) => row.id,
  });

  React.useEffect(() => {
    setSorting(mapSortValueToSorting(sortValue));
  }, [setSorting, sortValue]);

  const emptyState = (
    <div className="px-6 py-14 text-center text-sm text-white/45">
      {isLoading
        ? "Loading public trades…"
        : "No trades match the current proof filters."}
    </div>
  );

  return (
    <div className="w-full ring ring-white/5 bg-sidebar rounded-lg overflow-hidden">
      <div className="border-b border-white/5 bg-sidebar px-4 py-4 md:px-4">
        <PublicProofTradesToolbar
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          outcomeFilter={outcomeFilter}
          onOutcomeFilterChange={onOutcomeFilterChange}
          sourceFilter={sourceFilter}
          onSourceFilterChange={onSourceFilterChange}
          statusFilter={statusFilter}
          onStatusFilterChange={onStatusFilterChange}
          editFilter={editFilter}
          onEditFilterChange={onEditFilterChange}
          sortValue={sortValue}
          onSortChange={setSortValue}
          onClearSort={() => setSortValue(DEFAULT_SORT)}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
        />
      </div>

      <DataTable
        table={table}
        emptyState={emptyState}
        className="border-none bg-sidebar"
        fitColumnsToContent
        getRowGroupKey={
          groupBy
            ? (row) => getPublicProofGroupKey(groupBy, row.original)
            : undefined
        }
        renderRowGroupHeader={
          groupBy
            ? ({
                groupKey,
                rows: groupRows,
                isCollapsed,
                onToggleCollapsed,
              }) => (
                <PublicProofTradeGroupHeader
                  groupKey={groupKey}
                  rows={groupRows.map((row) => row.original)}
                  isCollapsed={isCollapsed}
                  onToggleCollapsed={onToggleCollapsed}
                />
              )
            : undefined
        }
      >
        {hasNextPage ? (
          <div className="flex justify-center bg-sidebar">
            <Button
              variant="outline"
              className="rounded-sm border-white/10 bg-sidebar text-white/75 hover:bg-sidebar-accent"
              onClick={onLoadMore}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? "Loading more…" : "Load more trades"}
            </Button>
          </div>
        ) : null}
      </DataTable>
    </div>
  );
}

export type { PublicProofTradeRow } from "@/features/public-proof/lib/public-proof-trades-table";
