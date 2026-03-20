import { cn } from "@/lib/utils";

export const journalActionButtonClassName =
  "cursor-pointer flex items-center justify-center gap-1 rounded-md ring ring-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none";

export const journalActionButtonMutedClassName = cn(
  journalActionButtonClassName,
  "text-white/70 hover:text-white"
);

export const journalActionIconButtonClassName = cn(
  journalActionButtonClassName,
  "size-9 px-0 text-white/70 hover:text-white border-none! ring-white/8"
);

export const journalCompactActionButtonClassName =
  "cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-sm ring ring-white/5 bg-sidebar px-2.5 py-1.5 h-7 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:text-white shadow-none";

export const journalCompactActionButtonActiveClassName =
  "bg-sidebar-accent text-white hover:bg-sidebar-accent";

export const journalCompactActionIconButtonClassName = cn(
  journalCompactActionButtonClassName,
  "w-7 px-0"
);

export const journalSegmentedActionContainerClassName =
  "flex items-center overflow-hidden rounded-md ring ring-white/5 bg-sidebar";

export const journalSegmentedActionButtonClassName =
  "cursor-pointer flex items-center justify-center gap-2 rounded-none ring-0 bg-sidebar px-3 py-0 h-9 text-xs text-white/55 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:text-white shadow-none";

export const journalSegmentedActionButtonActiveClassName =
  "bg-sidebar-accent text-white hover:bg-sidebar-accent";
