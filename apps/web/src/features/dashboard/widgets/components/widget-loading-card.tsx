"use client";

import { WidgetWrapper } from "@/components/dashboard/widget-wrapper";
import { Skeleton } from "@/components/ui/skeleton";

export function WidgetLoadingCard({ compact = false }: { compact?: boolean }) {
  return (
    <WidgetWrapper
      className="h-72 w-full"
      header={
        <div className="widget-header flex w-full items-center justify-between p-3.5">
          <Skeleton className="h-4 w-32 rounded-sm bg-sidebar-accent" />
          <Skeleton className="h-4 w-16 rounded-sm bg-sidebar-accent" />
        </div>
      }
    >
      <div className="flex h-full items-end justify-between gap-8 p-3.5">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-4 w-12 rounded-sm bg-sidebar" />
          <Skeleton className="h-4 w-24 rounded-sm bg-sidebar" />
        </div>

        <Skeleton
          className={compact ? "h-full w-48 rounded-sm bg-sidebar" : "h-full w-full rounded-sm bg-sidebar"}
        />
      </div>
    </WidgetWrapper>
  );
}
