"use client";

import { cn } from "@/lib/utils";
import Color from "color";
import {
  toolbarFilterMenuActionButtonClass,
  toolbarFilterMenuSubSeparatorClass,
  toolbarFilterMenuSurfaceClass,
  toolbarSelectTriggerButtonClassName,
} from "@/components/ui/filter-menu-styles";

function getBrighterRingColor(color: string) {
  try {
    return Color(color).mix(Color("#ffffff"), 0.22).hex();
  } catch {
    return "rgba(255,255,255,0.65)";
  }
}

export function getTradeTagColorSwatchStyle(color: string) {
  const ringColor = getBrighterRingColor(color);

  return {
    backgroundColor: color,
    boxShadow: `0 0 0 1px ${ringColor}`,
  };
}

export function getTradeTagColorButtonStyle(
  color: string,
  options?: { active?: boolean }
) {
  const ringColor = getBrighterRingColor(color);
  const active = options?.active ?? false;

  return {
    backgroundColor: color,
    borderColor: active ? ringColor : `${ringColor}66`,
    boxShadow: active
      ? `0 0 0 1px ${ringColor}, 0 0 0 2px ${ringColor}33`
      : `0 0 0 1px ${ringColor}22`,
  };
}

export const tradeTagEditorStyles = {
  addButtonClass: cn(
    toolbarSelectTriggerButtonClassName,
    "h-7 gap-1.5 rounded-sm px-2.5 text-[11px]"
  ),
  popoverContentClass: cn(
    toolbarFilterMenuSurfaceClass,
    "w-80 p-0 text-white/80"
  ),
  sectionClass: "space-y-3 px-4 py-4",
  separatorClass: toolbarFilterMenuSubSeparatorClass,
  labelClass: "text-xs text-white/70",
  inputClass:
    "rounded-sm border-white/8 bg-white/[0.03] text-white/85 placeholder:text-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-white/[0.05]",
  optionChipClass:
    "flex cursor-pointer items-center gap-2 rounded-sm border border-white/8 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/72 transition-colors hover:bg-sidebar-accent/70 hover:text-white",
  optionChipActiveClass: "border-white/12 bg-sidebar-accent/80 text-white",
  colorSwatchClass: "h-2.5 w-2.5 rounded-sm",
  colorButtonClass:
    "h-8 w-8 cursor-pointer rounded-sm border-2 transition-all duration-200",
  colorButtonActiveClass: "scale-105",
  colorButtonInactiveClass: "hover:brightness-110",
  colorCustomButtonClass:
    "flex h-8 w-8 items-center justify-center rounded-sm border border-white/8 bg-white/[0.03] text-white/70 transition-colors hover:bg-sidebar-accent/70 hover:text-white",
  colorPickerPanelClass:
    "rounded-sm border border-white/8 bg-white/[0.03] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  footerClass: "flex gap-2 px-4 py-4",
  footerButtonClass: toolbarFilterMenuActionButtonClass,
  primaryButtonClass:
    "border-white/8 bg-sidebar-accent text-white hover:bg-sidebar-accent/80",
  secondaryButtonClass:
    "border-white/8 bg-white/[0.03] text-white/72 hover:bg-white/[0.06] hover:text-white",
  destructiveButtonClass:
    "border-rose-500/20 bg-rose-500/12 text-rose-200 hover:bg-rose-500/18",
} as const;
