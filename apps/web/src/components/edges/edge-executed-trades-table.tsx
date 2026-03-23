"use client";

import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { useDataTable } from "@/hooks/use-data-table";
import { TradeDetailSheet } from "@/features/trades/table/components/trade-detail-sheet";
import {
  buildTradeTableColumnVisibility,
  buildTradeTableInitialSizing,
} from "@/features/trades/table/lib/trade-table-column-state";
import { tradeTableColumns } from "@/features/trades/table/lib/trade-table-columns";
import type {
  TradeRow,
  TradeTableMeta,
} from "@/features/trades/table/lib/trade-table-types";
import { ALL_ACCOUNTS_ID } from "@/stores/account";
import { trpcOptions } from "@/utils/trpc";

const EDGE_EXECUTED_TRADES_PAGE_SIZE = 25;
const EDGE_EXECUTED_TRADES_FETCH_LIMIT = 100;

export function EdgeExecutedTradesTable({ edgeId }: { edgeId: string }) {
  const [selectedTrade, setSelectedTrade] = useState<TradeRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [advanceAfterFetch, setAdvanceAfterFetch] = useState(false);

  const tradesQuery = useInfiniteQuery({
    ...trpcOptions.trades.listInfinite.infiniteQueryOptions(
      {
        accountId: ALL_ACCOUNTS_ID,
        edgeIds: [edgeId],
        limit: EDGE_EXECUTED_TRADES_FETCH_LIMIT,
      },
      {
        getNextPageParam: (lastPage) =>
          lastPage && "nextCursor" in lastPage ? lastPage.nextCursor : undefined,
      }
    ),
    staleTime: 30_000,
  });

  const modelTagsQuery = useQuery({
    ...trpcOptions.trades.listModelTags.queryOptions({
      accountId: ALL_ACCOUNTS_ID,
    }),
    staleTime: 60_000,
  });
  const sessionTagsQuery = useQuery({
    ...trpcOptions.trades.listSessionTags.queryOptions({
      accountId: ALL_ACCOUNTS_ID,
    }),
    staleTime: 60_000,
  });
  const customTagsQuery = useQuery({
    ...trpcOptions.trades.listCustomTags.queryOptions({
      accountId: ALL_ACCOUNTS_ID,
    }),
    staleTime: 60_000,
  });

  const rows = useMemo<TradeRow[]>(() => {
    const pages = (tradesQuery.data as { pages?: Array<{ items: TradeRow[] }> } | undefined)
      ?.pages;
    return pages?.flatMap((page) => page.items) ?? [];
  }, [tradesQuery.data]);

  const totalTradesCount = useMemo(() => {
    const pages = (tradesQuery.data as {
      pages?: Array<{ totalTradesCount?: number }>;
    } | undefined)?.pages;
    return pages?.[0]?.totalTradesCount ?? 0;
  }, [tradesQuery.data]);

  const tableMeta = useMemo<TradeTableMeta>(
    () => ({
      totalTradesCount,
      pnlMode: "usd",
      baselineInitialBalance: null,
      sessionTags: (sessionTagsQuery.data as TradeTableMeta["sessionTags"]) ?? [],
      modelTags: (modelTagsQuery.data as TradeTableMeta["modelTags"]) ?? [],
      customTags: (customTagsQuery.data as string[] | undefined) ?? [],
    }),
    [
      customTagsQuery.data,
      modelTagsQuery.data,
      sessionTagsQuery.data,
      totalTradesCount,
    ]
  );

  const { table } = useDataTable({
    data: rows,
    columns: tradeTableColumns,
    getRowId: (row) => row.id,
    initialVisibility: buildTradeTableColumnVisibility(),
    initialSizing: buildTradeTableInitialSizing(),
    initialPageSize: EDGE_EXECUTED_TRADES_PAGE_SIZE,
    meta: tableMeta,
    enableFilteringRowModel: false,
  });

  const paginationState = table.getState().pagination;
  const pageIndex = paginationState.pageIndex;
  const pageSize = paginationState.pageSize;
  const currentPageRows = table.getRowModel().rows.length;
  const loadedPageCount = table.getPageCount();
  const pageStart = rows.length === 0 ? 0 : pageIndex * pageSize + 1;
  const pageEnd = rows.length === 0 ? 0 : pageStart + currentPageRows - 1;

  useEffect(() => {
    if (!advanceAfterFetch) {
      return;
    }

    if (table.getPageCount() - 1 > pageIndex) {
      table.nextPage();
      setAdvanceAfterFetch(false);
      return;
    }

    if (!tradesQuery.hasNextPage && !tradesQuery.isFetchingNextPage) {
      setAdvanceAfterFetch(false);
    }
  }, [
    advanceAfterFetch,
    pageIndex,
    rows.length,
    table,
    tradesQuery.hasNextPage,
    tradesQuery.isFetchingNextPage,
  ]);

  if (tradesQuery.isLoading) {
    return <RouteLoadingFallback route="trades" className="min-h-[18rem]" />;
  }

  const handleNextPage = async () => {
    if (pageIndex < loadedPageCount - 1) {
      table.nextPage();
      return;
    }

    if (tradesQuery.hasNextPage && !tradesQuery.isFetchingNextPage) {
      setAdvanceAfterFetch(true);
      await tradesQuery.fetchNextPage();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white/72">Executed trades</p>
          <p className="text-sm text-white/40">
            All trades currently assigned to this Edge, using the same columns and interactions as the main trades table.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/40">
          {rows.length < totalTradesCount ? (
            <span>
              Loaded {rows.length} of {totalTradesCount}
            </span>
          ) : (
            <span>{totalTradesCount} total</span>
          )}
        </div>
      </div>

      <DataTable
        table={table}
        usePaginationRows
        enableMeasuredColumnSizing
        emptyState={
          <div className="px-5 py-10 text-center text-sm text-white/45">
            No executed trades have been assigned to this Edge yet.
          </div>
        }
        onRowClick={(row) => {
          setSelectedTrade(row.original as TradeRow);
          setDetailOpen(true);
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-white/38">
          Showing {pageStart}-{pageEnd} of {totalTradesCount}
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-white/10 bg-white/5 text-xs text-white/72 hover:bg-white/10"
            disabled={pageIndex === 0}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft className="mr-1 size-3.5" />
            Previous
          </Button>
          <div className="text-xs text-white/48">
            Page {Math.max(pageIndex + 1, 1)} of{" "}
            {Math.max(
              loadedPageCount + (tradesQuery.hasNextPage ? 1 : 0),
              1
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-white/10 bg-white/5 text-xs text-white/72 hover:bg-white/10"
            disabled={
              rows.length === 0 ||
              tradesQuery.isFetchingNextPage ||
              (!tradesQuery.hasNextPage && pageIndex >= loadedPageCount - 1)
            }
            onClick={handleNextPage}
          >
            {tradesQuery.isFetchingNextPage ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <ChevronRight className="mr-1 size-3.5" />
            )}
            Next
          </Button>
        </div>
      </div>

      <TradeDetailSheet
        accountId={selectedTrade?.accountId ?? ALL_ACCOUNTS_ID}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        selectedTrade={selectedTrade}
      />
    </div>
  );
}
