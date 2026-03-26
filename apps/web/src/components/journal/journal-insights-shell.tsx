"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export const JOURNAL_INSIGHTS_SURFACE_OUTER_CLASS =
  "group flex flex-col rounded-lg border border-white/5 bg-sidebar p-1";
export const JOURNAL_INSIGHTS_SURFACE_INNER_CLASS =
  "flex flex-1 flex-col rounded-sm bg-white ring ring-white/5 transition-all duration-250 dark:bg-sidebar-accent dark:group-hover:brightness-120";

export function JournalInsightsSectionHeader({
  icon: Icon,
  label,
  count,
  className,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 px-0.5", className)}>
      <Icon className="size-3.5 text-white/45" />
      <h2 className="text-xs font-medium text-white/45">{label}</h2>
      <Badge
        variant="outline"
        className="h-5 rounded-sm border-white/10 bg-sidebar px-1.5 text-[10px] text-white/55"
      >
        {count}
      </Badge>
    </div>
  );
}

export function JournalInsightsPanelShell({
  icon: Icon,
  title,
  description,
  action,
  bodyClassName,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(JOURNAL_INSIGHTS_SURFACE_OUTER_CLASS, className)}>
      <div className={cn(JOURNAL_INSIGHTS_SURFACE_INNER_CLASS, "h-full")}>
        <div className="flex items-start justify-between gap-4 px-3.5 py-3.5">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-sm bg-sidebar ring-1 ring-white/5">
              <Icon className="h-4 w-4 text-white/55 transition-all duration-250 group-hover:text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-medium text-white/55 transition-all duration-250 group-hover:text-white">
                {title}
              </h3>
              <p className="mt-1 text-xs leading-5 text-white/40">
                {description}
              </p>
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        <Separator className="bg-white/5" />
        <div className={cn("flex-1 overflow-hidden px-3.5 py-3.5", bodyClassName)}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function JournalInsightsStatCard({
  icon: Icon,
  label,
  value,
  hint,
  iconClassName,
  valueClassName,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint: string;
  iconClassName?: string;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn(JOURNAL_INSIGHTS_SURFACE_OUTER_CLASS, className)}>
      <div className={cn(JOURNAL_INSIGHTS_SURFACE_INNER_CLASS, "p-3.5")}>
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4 text-white/60", iconClassName)} />
          <span className="text-xs text-white/50">{label}</span>
        </div>
        <Separator className="mb-3.5 mt-3.5 -mx-3.5 bg-white/5" />
        <div
          className={cn(
            "truncate text-2xl font-semibold leading-tight text-white",
            valueClassName
          )}
        >
          {value}
        </div>
        <p className="mt-0.5 text-xs text-white/40">{hint}</p>
      </div>
    </div>
  );
}
