"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type TradeTablePaginationProps = {
  displayRowsCount: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  loadedPageCount: number;
  onNextPage: () => void | Promise<void>;
  onPreviousPage: () => void;
  pageEnd: number;
  pageIndex: number;
  pageStart: number;
  totalRowsCount: number;
};

export function TradeTablePagination({
  displayRowsCount,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
  loadedPageCount,
  onNextPage,
  onPreviousPage,
  pageEnd,
  pageIndex,
  pageStart,
  totalRowsCount,
}: TradeTablePaginationProps) {
  if (isLoading || (displayRowsCount === 0 && !hasNextPage)) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3 border border-t-0 border-white/5 bg-sidebar/70 px-4 py-3">
      <p className="text-xs text-white/40">
        {displayRowsCount === 0
          ? "Showing 0 of 0"
          : `Showing ${pageStart}-${pageEnd} of ${totalRowsCount}`}
      </p>
      <div className="flex items-center gap-4">
        <Button
          type="button"
          className="h-8 rounded-sm bg-sidebar px-2! text-xs text-white/70 hover:bg-sidebar-accent disabled:cursor-not-allowed disabled:opacity-40"
          disabled={pageIndex === 0}
          onClick={onPreviousPage}
        >
          <ChevronLeft className="size-3" />
        </Button>

        <div className="text-xs text-white/48">
          Page {Math.max(pageIndex + 1, 1)} of {Math.max(loadedPageCount + (hasNextPage ? 1 : 0), 1)}
        </div>

        <Button
          type="button"
          className="h-8 rounded-sm bg-sidebar px-2! text-xs text-white/70 hover:bg-sidebar-accent disabled:cursor-not-allowed disabled:opacity-40"
          disabled={
            displayRowsCount === 0 ||
            isFetchingNextPage ||
            (!hasNextPage && pageIndex >= loadedPageCount - 1)
          }
          onClick={() => void onNextPage()}
        >
          {isFetchingNextPage ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <ChevronRight className="size-3" />
          )}
        </Button>
      </div>
    </div>
  );
}
