"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface JournalWidgetShellProps {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}

export function JournalWidgetShell({
  children,
  className,
  innerClassName,
}: JournalWidgetShellProps) {
  return (
    <div
      className={cn(
        "group flex min-h-0 flex-col rounded-sm border border-white/5 bg-sidebar p-1.5",
        className
      )}
    >
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm bg-white transition-all duration-250 dark:bg-sidebar-accent dark:group-hover:brightness-120",
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

interface JournalWidgetFrameProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  header?: ReactNode;
  icon?: LucideIcon;
  title?: string;
  headerRight?: ReactNode;
}

export function JournalWidgetFrame({
  children,
  className,
  contentClassName,
  header,
  icon: Icon,
  title,
  headerRight,
}: JournalWidgetFrameProps) {
  return (
    <div
      className={cn(
        "group flex min-h-0 flex-col rounded-sm border border-white/5 bg-sidebar p-1.5",
        className
      )}
    >
      {header ? (
        header
      ) : title || Icon || headerRight ? (
        <div className="widget-header flex w-full items-center gap-1.5 p-3.5">
          <div className="flex min-w-0 items-center gap-1.5">
            {Icon ? <Icon className="size-4 text-white/45" /> : null}
            {title ? <h2 className="text-xs font-medium text-white/55">{title}</h2> : null}
          </div>
          {headerRight ? (
            <div className="ml-auto flex items-center gap-2">{headerRight}</div>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm bg-white transition-all duration-250 dark:bg-sidebar-accent dark:group-hover:brightness-120",
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
