"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type SummaryCardProps = {
  title: string;
  value: ReactNode;
  subtext?: string;
  accentClass?: string;
  loading?: boolean;
};

export function SummaryCard({
  title,
  value,
  subtext,
  accentClass,
  loading,
}: SummaryCardProps) {
  return (
    <div className="flex h-full flex-col justify-center gap-1 rounded-sm border border-white/5 bg-white px-5 dark:bg-sidebar">
      <span className="text-[10px] uppercase tracking-wide text-white/50">
        {title}
      </span>
      {loading ? (
        <Skeleton className="h-6 w-24 rounded-none bg-sidebar-accent" />
      ) : (
        <span className={cn("text-lg font-semibold text-white", accentClass)}>
          {value}
        </span>
      )}
      <span className="text-[10px] text-white/40">{subtext || "—"}</span>
    </div>
  );
}
