"use client";

import type { ReactNode } from "react";

import {
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
} from "@/components/trades/trade-identifier-pill";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type GroupedTradeMultiplierChipProps = {
  label: string;
  children: ReactNode;
  onOpenChange?: (open: boolean) => void;
};

export function GroupedTradeMultiplierChip({
  label,
  children,
  onOpenChange,
}: GroupedTradeMultiplierChipProps) {
  return (
    <Tooltip onOpenChange={onOpenChange}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            TRADE_IDENTIFIER_PILL_CLASS,
            TRADE_IDENTIFIER_TONES.neutral,
            "min-h-0 shrink-0 px-1.5 py-0 text-[10px] focus-visible:outline-none"
          )}
        >
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-max max-w-none min-w-[15rem] py-3"
      >
        <div className="flex flex-col gap-2">
          {children}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
