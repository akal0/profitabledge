"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type SummaryCardProps = {
  title: string;
  value?: ReactNode;
  subtext?: string;
  accentClass?: string;
  loading?: boolean;
  children?: ReactNode;
};

export function SummaryCard({
  title,
  value,
  subtext,
  accentClass,
  loading,
  children,
}: SummaryCardProps) {
  return (
    <div className="group flex h-full w-full flex-col rounded-lg border border-white/5 bg-sidebar p-1">
      <div className="flex h-full flex-col justify-center gap-1.5 rounded-sm bg-sidebar-accent px-5 py-4 ring ring-white/5 transition-all duration-250 group-hover:brightness-110">
        <div className="flex flex-1 flex-col justify-center gap-1.5">
          <span className="text-[11px] text-white/45">{title}</span>
          {children ? (
            <div className="flex flex-1 flex-col">{children}</div>
          ) : loading ? (
            <Skeleton className="h-8 w-28 rounded-sm bg-sidebar" />
          ) : (
            <span
              className={cn(
                "text-lg font-semibold tracking-tight text-white",
                accentClass
              )}
            >
              {value}
            </span>
          )}
        </div>
        {!children ? (
          <span className="text-[11px] text-white/42">{subtext || "—"}</span>
        ) : null}
      </div>
    </div>
  );
}
