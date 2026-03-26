import { cn } from "@/lib/utils";

const PROP_ASSIGN_ACTION_BUTTON_BASE_CLASS =
  "rounded-sm ring-1 px-3 text-xs font-medium shadow-sm transition-all duration-250 active:scale-99 disabled:pointer-events-none disabled:opacity-45 ";
const PROP_ASSIGN_ACTION_BUTTON_SIZE_CLASS = {
  default: "h-9",
  sm: "h-8 px-2.5 text-[11px]",
  xs: "h-7 px-2 text-[10px]",
} as const;
const PROP_ASSIGN_ACTION_BUTTON_TONE_CLASS = {
  ghost:
    "ring-transparent bg-transparent text-white/45 shadow-none hover:bg-white/[0.04] hover:text-white/75",
  neutral:
    "ring-white/10 bg-sidebar-accent brightness-120 text-white/70 hover:bg-sidebar-accent hover:brightness-130 hover:text-white",
  teal: "ring-teal-400/60 bg-teal-400/35 text-teal-200 hover:bg-teal-400/40 hover:text-teal-100",
  amber:
    "ring-orange-400/25 bg-orange-400/10 text-orange-200 hover:bg-orange-400/15 hover:text-orange-100",
  gold: "ring-amber-400/25 bg-amber-400/10 text-amber-200 hover:bg-amber-400/15 hover:text-amber-100",
  danger:
    "ring-rose-400/25! bg-rose-400/10! text-rose-200 hover:bg-rose-400/15 hover:text-rose-100",
} as const;

export type PropAssignActionButtonSize =
  keyof typeof PROP_ASSIGN_ACTION_BUTTON_SIZE_CLASS;
export type PropAssignActionButtonTone =
  keyof typeof PROP_ASSIGN_ACTION_BUTTON_TONE_CLASS;

export function getPropAssignActionButtonClassName({
  tone = "neutral",
  size = "default",
  className,
}: {
  tone?: PropAssignActionButtonTone;
  size?: PropAssignActionButtonSize;
  className?: string;
}) {
  return cn(
    PROP_ASSIGN_ACTION_BUTTON_BASE_CLASS,
    PROP_ASSIGN_ACTION_BUTTON_SIZE_CLASS[size],
    PROP_ASSIGN_ACTION_BUTTON_TONE_CLASS[tone],
    className
  );
}
