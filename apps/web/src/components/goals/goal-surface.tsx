"use client";

import type { ComponentType, ReactNode } from "react";

import { Separator } from "@/components/ui/separator";
import { WIDGET_CONTENT_SEPARATOR_CLASS } from "@/features/dashboard/widgets/lib/widget-shared";
import { cn } from "@/lib/utils";

export const GOAL_SURFACE_OUTER_CLASS =
  "group flex flex-col rounded-lg border border-white/5 bg-sidebar p-1";
export const GOAL_SURFACE_INNER_CLASS =
  "flex flex-1 flex-col rounded-sm bg-white ring ring-white/5 transition-all duration-250 dark:bg-sidebar-accent dark:group-hover:brightness-120";
export const GOAL_PANEL_HEADER_CLASS =
  "widget-header flex w-full items-start gap-1.5 px-3.5 py-3.5";
export const GOAL_PANEL_BODY_CLASS = "px-3.5 py-3.5";
export const GOAL_PANEL_ICON_CLASS =
  "mt-0.5 h-4 w-4 shrink-0 text-white/50 transition-all duration-250 group-hover:text-white";
export const GOAL_PANEL_TITLE_CLASS =
  "text-xs font-medium text-white/50 transition-all duration-250 group-hover:text-white";

export function GoalSurface({
  children,
  className,
  innerClassName,
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <div className={cn(GOAL_SURFACE_OUTER_CLASS, className)}>
      <div className={cn(GOAL_SURFACE_INNER_CLASS, innerClassName)}>
        {children}
      </div>
    </div>
  );
}

export function GoalContentSeparator({ className }: { className?: string }) {
  return (
    <Separator className={cn(WIDGET_CONTENT_SEPARATOR_CLASS, className)} />
  );
}

export function GoalPanel({
  icon: Icon,
  title,
  description,
  action,
  bodyClassName,
  children,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <GoalSurface innerClassName="h-full overflow-hidden">
      <div className={cn(GOAL_PANEL_HEADER_CLASS, "justify-between")}>
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {Icon ? <Icon className={GOAL_PANEL_ICON_CLASS} /> : null}
          <div className="min-w-0">
            <h2 className={GOAL_PANEL_TITLE_CLASS}>{title}</h2>
            {description ? (
              <p className="mt-1 text-xs leading-5 text-white/40">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {action ? <div className="ml-auto shrink-0">{action}</div> : null}
      </div>
      <GoalContentSeparator />
      <div
        className={cn(
          "flex-1 overflow-hidden",
          GOAL_PANEL_BODY_CLASS,
          bodyClassName
        )}
      >
        {children}
      </div>
    </GoalSurface>
  );
}
