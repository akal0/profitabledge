import { cn } from "@/lib/utils";

type UsageMeterProps = {
  label: string;
  used: number;
  limit: number | "unlimited";
  helperText?: string;
  className?: string;
};

function formatValue(value: number | "unlimited") {
  if (value === "unlimited") {
    return "Unlimited";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

export function UsageMeter({
  label,
  used,
  limit,
  helperText,
  className,
}: UsageMeterProps) {
  const percentage =
    limit === "unlimited" || limit <= 0
      ? 0
      : Math.min(100, Math.max(0, (used / limit) * 100));
  const toneClassName =
    limit === "unlimited"
      ? "bg-teal-400/70"
      : percentage >= 90
      ? "bg-amber-400"
      : percentage >= 70
      ? "bg-blue-400"
      : "bg-teal-400";

  return (
    <div className={cn("rounded-2xl bg-white/[0.03] p-4 ring ring-white/8", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
            {label}
          </p>
          <p className="mt-1 text-sm font-semibold text-white/80">
            {formatValue(used)} / {formatValue(limit)}
          </p>
        </div>
        <p className="text-xs text-white/35">
          {limit === "unlimited"
            ? "No cap"
            : `${Math.max(0, (limit as number) - used)} left`}
        </p>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", toneClassName)}
          style={{ width: `${limit === "unlimited" ? 100 : percentage}%` }}
        />
      </div>

      {helperText ? <p className="mt-2 text-xs text-white/38">{helperText}</p> : null}
    </div>
  );
}
