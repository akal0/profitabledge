"use client";

import { cn } from "@/lib/utils";
import { tradesToolbarStyles } from "@/features/trades/table-toolbar/lib/trades-toolbar-styles";

const sharedSurfaceClass = cn(
  tradesToolbarStyles.filterMenuSurfaceClass,
  "border-white/6 bg-sidebar/95 text-white/80 shadow-[0_18px_40px_rgba(0,0,0,0.42)] backdrop-blur-xl"
);

export const bulkActionsStyles = {
  floatingBarClass: cn(
    sharedSurfaceClass,
    "rounded-sm px-2 py-1.5 shadow-2xl shadow-black/50"
  ),
  floatingBarCountPillClass:
    "flex items-center overflow-hidden rounded-sm border border-blue-500/25 bg-blue-500/10",
  buttonClass: cn(
    tradesToolbarStyles.badgeBaseClass,
    "h-[32px] gap-1.5 border-white/8 bg-white/[0.03] px-3 py-2 text-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-sidebar-accent/80"
  ),
  mutedButtonClass: cn(
    tradesToolbarStyles.badgeBaseClass,
    "h-[32px] gap-1.5 border-white/8 bg-white/[0.03] px-3 py-2 text-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-sidebar-accent/80 hover:text-white"
  ),
  menuPanelClass: cn(tradesToolbarStyles.filterMenuSurfaceClass, "p-0"),
  submenuPanelClass: cn(tradesToolbarStyles.filterMenuSubContentClass, "p-0"),
  menuLabelClass: tradesToolbarStyles.filterMenuSectionTitleClass,
  menuTriggerClass: tradesToolbarStyles.filterMenuTriggerClass,
  menuMainSeparatorClass: tradesToolbarStyles.filterMenuMainSeparatorClass,
  menuSubSeparatorClass: tradesToolbarStyles.filterMenuSubSeparatorClass,
  menuItemClass: cn(
    tradesToolbarStyles.selectMenuItemClass,
    "gap-2 rounded-sm text-white/78"
  ),
  destructiveMenuItemClass: cn(
    tradesToolbarStyles.selectMenuItemClass,
    "gap-2 rounded-sm text-red-300 data-[highlighted]:bg-red-500/12 data-[highlighted]:text-red-100"
  ),
  menuSectionClass: "space-y-3 px-4 py-4",
  panelClass: "rounded-sm border border-white/8 bg-white/[0.03]",
  inputClass:
    "rounded-sm border-white/8 bg-white/[0.03] text-white/85 placeholder:text-white/30 hover:bg-white/[0.05]",
  tagChipClass:
    "flex items-center gap-2 rounded-sm border border-white/8 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/72 transition-colors hover:bg-sidebar-accent/70 hover:text-white",
  tagChipActiveClass: "border-white/12 bg-sidebar-accent/80 text-white",
  colorSwatchClass: "h-2.5 w-2.5 rounded-sm border border-white/20",
  colorButtonBaseClass:
    "h-8 w-8 cursor-pointer rounded-sm border-2 transition-all duration-200",
  colorButtonActiveClass: "scale-105 border-white/80",
  colorButtonInactiveClass: "border-white/8 hover:border-white/20",
  colorCustomButtonClass:
    "flex h-8 w-8 items-center justify-center rounded-sm border border-white/8 bg-white/[0.03] text-white/70 transition-colors hover:bg-sidebar-accent/70 hover:text-white",
  primaryActionButtonClass:
    "gap-2 rounded-sm border border-white/8 bg-sidebar-accent text-xs text-white hover:bg-sidebar-accent/80",
  secondaryActionButtonClass:
    "border-white/8 bg-white/[0.03] text-white/72 hover:bg-white/[0.06] hover:text-white",
  destructiveButtonClass:
    "border border-red-500/20 bg-red-500/12 text-red-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:bg-red-500/18",
  dialogContentClass: cn(
    sharedSurfaceClass,
    "gap-5 border-white/6 text-white backdrop-blur-xl"
  ),
  dialogSectionClass: "rounded-sm border border-white/8 bg-white/[0.03] p-4",
  checkboxRowClass:
    "flex items-center gap-3 rounded-sm border border-white/8 bg-white/[0.03] px-3 py-2.5",
  statCardClass:
    "rounded-sm border border-white/8 bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  statLabelClass:
    "text-[11px] font-medium uppercase tracking-[0.14em] text-white/45",
} as const;
