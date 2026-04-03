import { cn } from "@/lib/utils";

export type FilterChipGroup = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
};

type FilterChipsProps = {
  groups: FilterChipGroup[];
  onClear?: () => void;
  activeCount?: number;
};

export function FilterChips({
  groups,
  onClear,
  activeCount = 0,
}: FilterChipsProps) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.label} className="space-y-2">
          <p className="text-[11px] font-medium text-white/38">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.options.map((option) => {
              const selected = group.value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => group.onChange(option.value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition-all duration-200",
                    selected
                      ? "border-teal-500/35 bg-teal-500/15 text-teal-200"
                      : "border-white/8 bg-white/[0.03] text-white/55 hover:border-white/14 hover:bg-white/[0.05] hover:text-white/72"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {activeCount > 0 && onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium text-teal-300 transition-colors hover:text-teal-200"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
