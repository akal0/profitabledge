"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

export const APP_TOOLTIP_SURFACE_CLASS =
  "rounded-md border border-white/5 bg-sidebar text-white/80 shadow-[0_18px_40px_rgba(0,0,0,0.35)]";

export const APP_TOOLTIP_CONTENT_CLASS =
  "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) px-3 py-2 text-xs text-balance";

export const APP_RECHARTS_TOOLTIP_CONTENT_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-sidebar)",
  border: "1px solid rgba(255,255,255,0.05)",
  borderRadius: "var(--radius-md)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
  color: "rgba(255,255,255,0.8)",
  fontSize: 11,
  padding: "12px",
};

export const APP_RECHARTS_TOOLTIP_LABEL_STYLE: React.CSSProperties = {
  color: "rgba(255,255,255,0.6)",
  fontSize: 11,
  fontWeight: 500,
  marginBottom: 8,
};

export const APP_RECHARTS_TOOLTIP_ITEM_STYLE: React.CSSProperties = {
  color: "rgba(255,255,255,0.8)",
  fontSize: 11,
  padding: 0,
};

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          APP_TOOLTIP_SURFACE_CLASS,
          APP_TOOLTIP_CONTENT_CLASS,
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="bg-transparent fill-transparent z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
};
