"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TradeTableEmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  details?: React.ReactNode;
};

export function TradeTableEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  className,
  details,
}: TradeTableEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[320px] flex-col items-center justify-center gap-4 px-6 py-14 text-center",
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
        <Search className="size-5 text-white/45" />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold tracking-wide text-white">{title}</h3>
        <p className="max-w-md text-sm leading-6 text-white/55">{description}</p>
        {details ? <div className="pt-1">{details}</div> : null}
      </div>

      {actionLabel && onAction ? (
        <Button
          type="button"
          variant="outline"
          onClick={onAction}
          className="rounded-sm border-white/10 bg-sidebar text-white/80 hover:bg-sidebar-accent"
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
