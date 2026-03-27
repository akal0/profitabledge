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
  align?: "start" | "center";
};

export function SummaryCard({
  title,
  value,
  subtext,
  accentClass,
  loading,
  children,
  align = "start",
}: SummaryCardProps) {
  const isCentered = align === "center";

  return (
    <div className="group flex h-full w-full flex-col rounded-lg border border-white/5 bg-sidebar p-1">
      <div
        className={cn(
          "flex h-full flex-col items-center gap-1.5 rounded-sm bg-sidebar-accent px-5 py-4 ring ring-white/5 transition-all duration-250 group-hover:brightness-110",
          isCentered && "text-center"
        )}
      >
        {children ? (
          <>
            <span
              className={cn(
                "self-start text-[11px] text-white/45",
                isCentered && "self-center text-center"
              )}
            >
              {title}
            </span>
            <div
              className={cn(
                "flex w-full flex-1 flex-col",
                isCentered && "items-center text-center"
              )}
            >
              {children}
            </div>
          </>
        ) : (
          <div
            className={cn(
              "flex flex-col gap-1.5",
              isCentered && "items-center text-center"
            )}
          >
            <span
              className={cn(
                "text-[11px] text-white/45",
                isCentered && "text-center"
              )}
            >
              {title}
            </span>
            {loading ? (
              <Skeleton className="h-8 w-28 rounded-sm bg-sidebar" />
            ) : (
              <span
                className={cn(
                  "text-lg font-semibold tracking-tight text-white",
                  accentClass,
                  isCentered && "text-center"
                )}
              >
                {value}
              </span>
            )}
            <span
              className={cn(
                "text-[11px] text-white/42",
                isCentered && "text-center"
              )}
            >
              {subtext || "—"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
