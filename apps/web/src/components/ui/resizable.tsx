"use client";

import * as React from "react";
import {
  PanelGroup,
  type PanelGroupProps,
  Panel,
  type PanelProps,
  PanelResizeHandle,
} from "react-resizable-panels";
import { cn } from "@/lib/utils";

export function ResizablePanelGroup({ className, ...props }: PanelGroupProps) {
  return <PanelGroup className={cn("h-full w-full", className)} {...props} />;
}

export function ResizablePanel({ className, ...props }: PanelProps) {
  return <Panel className={cn("h-full w-full", className)} {...props} />;
}

export function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof PanelResizeHandle> & { withHandle?: boolean }) {
  return (
    <PanelResizeHandle
      className={cn(
        "relative flex items-center justify-center h-full bg-transparent pt-16 transition-colors",
        className
      )}
      {...props}
    >
      {withHandle ? (
        <div className="z-10 rounded-full border bg-border/50 dark:bg-white/10 dark:border-white/10 h-6 w-2 shadow-secondary-button" />
      ) : null}
    </PanelResizeHandle>
  );
}
