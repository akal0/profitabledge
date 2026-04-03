import type { ReactNode } from "react";

import { Check, Lock } from "lucide-react";

import { TierBadge } from "@/features/shop/components/tier-badge";
import { cn } from "@/lib/utils";

type EffectCardProps = {
  title: string;
  collection?: string;
  tier?: "free" | "basic" | "premium" | "legendary";
  accent?: string;
  selected?: boolean;
  equipped?: boolean;
  locked?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: ReactNode;
};

export function EffectCard({
  title,
  collection,
  tier,
  accent,
  selected = false,
  equipped = false,
  locked = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
  children,
}: EffectCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      disabled={locked}
      className={cn(
        "group relative flex h-full w-full cursor-pointer flex-col rounded-lg border border-white/5 bg-sidebar p-1 text-left transition-all duration-250",
        "hover:border-white/12 hover:scale-[1.01]",
        selected && "border-teal-500/40",
        locked && "cursor-not-allowed opacity-60 hover:scale-100"
      )}
      style={
        accent
          ? {
              boxShadow: selected
                ? `0 18px 36px color-mix(in srgb, ${accent} 18%, transparent)`
                : undefined,
            }
          : undefined
      }
    >
      <div
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-sm ring ring-white/5 transition-all duration-250",
          "bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120",
          selected && "ring-teal-500/35"
        )}
      >
        <div className="overflow-hidden bg-black/20">{children}</div>
        <div className="flex flex-1 flex-col gap-2 border-t border-white/5 px-3.5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{title}</p>
              {collection ? (
                <p className="mt-0.5 text-[11px] text-white/42">{collection}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-start gap-2">
              {tier ? <TierBadge tier={tier} /> : null}
              {locked ? (
                <Lock className="mt-0.5 size-3.5 shrink-0 text-white/35" />
              ) : equipped ? (
                <Check className="mt-0.5 size-3.5 shrink-0 text-teal-400" />
              ) : null}
            </div>
          </div>

          <div className="mt-auto flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-sm border px-2 py-1 text-[11px] font-medium",
                equipped
                  ? "border-teal-500/25 bg-teal-500/10 text-teal-300"
                  : locked
                  ? "border-white/8 bg-white/[0.03] text-white/40"
                  : "border-white/8 bg-white/[0.03] text-white/48"
              )}
            >
              {equipped ? "Equipped" : locked ? "Locked" : "Available"}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
