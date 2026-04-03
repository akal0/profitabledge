import { cn } from "@/lib/utils";

type TierBadgeProps = {
  tier: "free" | "basic" | "premium" | "legendary";
};

export function TierBadge({ tier }: TierBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-1 text-[10px] font-medium",
        tier === "free" && "border-white/8 bg-white/[0.03] text-white/42",
        tier === "basic" && "border-sky-500/20 bg-sky-500/10 text-sky-200",
        tier === "premium" && "border-violet-500/20 bg-violet-500/10 text-violet-200",
        tier === "legendary" && "border-amber-500/25 bg-amber-500/10 text-amber-200"
      )}
    >
      {tier === "free"
        ? "Free"
        : tier === "basic"
        ? "Basic"
        : tier === "premium"
        ? "Premium"
        : "Legendary"}
    </span>
  );
}
