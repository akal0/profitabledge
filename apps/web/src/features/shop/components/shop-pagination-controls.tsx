import { ChevronLeft, ChevronRight } from "lucide-react";

type ShopPaginationControlsProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

export function ShopPaginationControls({
  page,
  pageCount,
  onPageChange,
}: ShopPaginationControlsProps) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <div className="mt-4 grid grid-cols-3 items-center gap-2">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 0}
        className="flex h-8 w-8 items-center justify-center justify-self-start rounded-sm border border-white/10 bg-white/[0.03] text-white/60 transition-colors hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
      >
        <ChevronLeft className="size-3.5" />
      </button>
      <span className="text-center text-[10px] text-white/32">
        Page {page + 1} / {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount - 1}
        className="flex h-8 w-8 items-center justify-center justify-self-end rounded-sm border border-white/10 bg-white/[0.03] text-white/60 transition-colors hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
      >
        <ChevronRight className="size-3.5" />
      </button>
    </div>
  );
}
