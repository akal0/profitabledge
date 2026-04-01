"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TradeTableRouteSkeletonProps = {
  className?: string;
  timeoutMs?: number;
};

export function TradeTableRouteSkeleton({
  className,
  timeoutMs = 30_000,
}: TradeTableRouteSkeletonProps) {
  const router = useRouter();
  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => setTimedOut(true), timeoutMs);
    return () => window.clearTimeout(timeoutId);
  }, [timeoutMs]);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="bg-sidebar border border-white/5 rounded-md p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-9 w-28 rounded-sm bg-sidebar-accent" />
          <Skeleton className="h-9 w-[26rem] rounded-sm bg-sidebar-accent" />
          <Skeleton className="h-9 w-24 rounded-sm bg-sidebar-accent" />
          <Skeleton className="ml-auto h-9 w-32 rounded-sm bg-sidebar-accent" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-7 w-24 rounded-sm bg-sidebar-accent"
            />
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-white/5 bg-sidebar">
        <div className="h-1 w-full overflow-hidden bg-white/5">
          <div className="h-full w-1/3 animate-pulse bg-teal-400/70" />
        </div>
        <div className="border-b border-white/5 px-4 py-3">
          <div className="grid grid-cols-8 gap-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-3 w-full rounded-sm bg-sidebar-accent"
              />
            ))}
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {Array.from({ length: 10 }).map((_, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-8 gap-3 px-4 py-3">
              {Array.from({ length: 8 }).map((_, colIndex) => (
                <Skeleton
                  key={`${rowIndex}-${colIndex}`}
                  className={cn(
                    "h-5 rounded-sm bg-sidebar-accent",
                    colIndex === 0 ? "w-10" : colIndex === 1 ? "w-20" : "w-full"
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-sidebar border border-white/5 rounded-md p-4">
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="min-w-28 space-y-2 border-r border-white/5 pr-4 last:border-r-0"
            >
              <Skeleton className="h-3 w-16 rounded-sm bg-sidebar-accent" />
              <Skeleton className="h-5 w-20 rounded-sm bg-sidebar-accent" />
            </div>
          ))}
        </div>
      </div>

      {timedOut ? (
        <div className="bg-sidebar border border-white/5 rounded-md p-4 text-sm text-white/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>Taking too long? Retry the trades view.</p>
            <Button
              type="button"
              variant="outline"
              className="h-8 rounded-sm bg-transparent px-3 text-xs text-white/80 hover:bg-sidebar-accent"
              onClick={() => router.refresh()}
            >
              Retry now
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
