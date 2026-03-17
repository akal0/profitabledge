"use client";

import { cn } from "@/lib/utils";
import type { ReactNode, Ref } from "react";
import type { LucideIcon } from "lucide-react";

interface WidgetWrapperProps {
  children: ReactNode;
  isEditing?: boolean;
  className?: string;
  contentClassName?: string;
  /** Fully custom header content */
  header?: ReactNode;
  /** Optional icon for the widget header */
  icon?: LucideIcon;
  /** Optional title for the widget header */
  title?: string;
  /** Optional content on the right side of the header */
  headerRight?: ReactNode;
  /** Whether to show the header - if false, children handle their own header */
  showHeader?: boolean;
  /** Optional click handler for non-edit mode */
  onClick?: () => void;
  /** Optional ref for export/share flows that need the rendered widget node */
  rootRef?: Ref<HTMLDivElement>;
}

/**
 * Unified WidgetWrapper - ensures consistent styling across all dashboard widgets
 *
 * Container: bg-sidebar border border-white/5 p-1.5 rounded-sm h-72
 * Header: widget-header class with consistent padding
 * Content: bg-white dark:bg-sidebar-accent with hover brightness
 */
export function WidgetWrapper({
  children,
  isEditing = false,
  className,
  contentClassName,
  header,
  icon: Icon,
  title,
  headerRight,
  showHeader = false,
  onClick,
  rootRef,
}: WidgetWrapperProps) {
  return (
    <div
      ref={rootRef}
      data-widget-share-surface="frame"
      className={cn(
        "bg-sidebar h-72 w-full border border-white/5 p-1 flex flex-col rounded-lg group",
        isEditing ? "animate-tilt-subtle hover:animate-none" : "",
        !isEditing && onClick ? "cursor-pointer" : "",
        className
      )}
      onClick={!isEditing ? onClick : undefined}
    >
      {header ? (
        header
      ) : showHeader && (Icon || title) ? (
        <div className="flex w-full gap-1.5 items-center p-3.5 widget-header min-w-0">
          {Icon && (
            <Icon className="size-4 shrink-0 stroke-white/50 group-hover:stroke-white fill-sidebar transition-all duration-250" />
          )}
          {title && (
            <h2 className="text-xs font-medium flex items-center gap-2 text-white/50 group-hover:text-white transition-all duration-250 min-w-0">
              <span className="truncate">{title}</span>
            </h2>
          )}
          {headerRight ? (
            <div
              className="ml-auto flex items-center gap-2"
              data-widget-share-ignore="true"
            >
              {headerRight}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        data-widget-share-surface="content"
        className={cn(
          "bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-250 flex h-full w-full rounded-sm ring ring-white/5",
          contentClassName ?? "flex-col justify-end"
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Simplified loading skeleton for widgets
 */
interface WidgetLoadingProps {
  className?: string;
}

export function WidgetLoading({ className }: WidgetLoadingProps) {
  return (
    <WidgetWrapper className={className}>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="animate-pulse bg-white/10 h-full w-full rounded-sm" />
      </div>
    </WidgetWrapper>
  );
}
