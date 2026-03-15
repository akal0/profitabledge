import { cn } from "@/lib/utils";
import { APP_TOOLTIP_SURFACE_CLASS } from "@/components/ui/tooltip";

export const toolbarFilterMenuSurfaceClass = cn(
  APP_TOOLTIP_SURFACE_CLASS,
  "ring-white/6 bg-sidebar/95 text-white/80 shadow-[0_18px_40px_rgba(0,0,0,0.42)] backdrop-blur-xl"
);

export const toolbarFilterMenuContentClass = cn(
  toolbarFilterMenuSurfaceClass,
  "p-1.5"
);

export const toolbarFilterMenuSubContentClass = cn(
  toolbarFilterMenuSurfaceClass,
  "ml-4 p-1"
);

export const toolbarFilterMenuSectionTitleClass =
  "px-4 py-2 text-[11px] font-semibold text-white/55";

export const toolbarFilterMenuMainSeparatorClass =
  "-mx-1.5 w-[calc(100%+0.75rem)]";

export const toolbarFilterMenuTriggerClass =
  "px-4 py-2.5 text-xs text-white/75 data-[highlighted]:bg-sidebar-accent/80 data-[state=open]:bg-sidebar-accent/80";

export const toolbarFilterMenuItemClass =
  "px-4 py-2.5 text-xs text-white/75 data-[highlighted]:bg-sidebar-accent/80";

export const toolbarFilterMenuLabelClass =
  "px-4 py-2 text-[11px] font-medium text-white/50";

export const toolbarFilterMenuSubSeparatorClass = "w-full";

export const toolbarFilterMenuOptionRowClass =
  "flex items-center gap-3 rounded-sm px-4 py-2 text-xs text-white/80 transition-colors hover:bg-sidebar-accent/70";

export const toolbarFilterMenuCheckboxClass =
  "cursor-pointer rounded-md ring-white/10 bg-white/[0.02] data-[state=checked]:ring-white/15 data-[state=checked]:bg-white/[0.08] data-[state=checked]:text-white";

export const toolbarFilterMenuActionButtonClass =
  "flex-1 rounded-sm ring ring-white/8 bg-white/[0.03] py-2.5 text-xs text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-white/[0.06]";

export const toolbarFilterMenuScrollableBodyClass =
  "max-h-64 overflow-auto py-2";

export const toolbarFilterMenuFooterClass = "flex gap-2 px-3 py-3";

export const toolbarFilterMenuCheckboxItemClass =
  "rounded-sm py-2.5 pl-8 pr-4 text-xs text-white/80 data-[highlighted]:bg-sidebar-accent/80";

export const toolbarSelectTriggerButtonClassName =
  "flex h-[38px] cursor-pointer items-center justify-center gap-2 rounded-md ring ring-white/5 bg-sidebar px-3 py-2 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:text-white";

export const toolbarSelectTriggerActiveButtonClassName =
  "bg-sidebar-accent text-white hover:bg-sidebar-accent hover:text-white";

export const toolbarSelectIconTriggerButtonClassName = cn(
  toolbarSelectTriggerButtonClassName,
  "w-[38px] px-0"
);

export const appSelectTriggerClassName = cn(
  "ring-white/5 bg-sidebar text-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  "transition-all duration-250 hover:bg-sidebar-accent hover:text-white active:scale-[0.99]",
  "focus-visible:ring-white/10 focus-visible:ring-0"
);

export const appSelectContentClassName = cn(
  toolbarFilterMenuContentClass,
  "overflow-hidden"
);

export const appSelectLabelClassName = toolbarFilterMenuLabelClass;

export const appSelectItemClassName = cn(
  toolbarFilterMenuItemClass,
  "cursor-pointer rounded-sm data-[state=checked]:bg-sidebar-accent/80 data-[state=checked]:text-white"
);

export const appSelectSeparatorClassName = toolbarFilterMenuMainSeparatorClass;

export const appSelectScrollButtonClassName =
  "flex cursor-default items-center justify-center py-1 text-white/45";
