"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";

import MultipleSelector, { type Option } from "@/components/ui/multiselect";
import { cn } from "@/lib/utils";

type TagMultiSelectProps = {
  value: string[];
  suggestions?: string[];
  placeholder?: string;
  disabled?: boolean;
  maxSelected?: number;
  emptyIndicator?: ReactNode;
  selectedLayout?: "wrap" | "grid";
  className?: string;
  onChange: (nextValue: string[]) => void;
};

function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))
  );
}

function toOptions(tags: string[]): Option[] {
  return tags.map((tag) => ({
    value: tag,
    label: tag,
  }));
}

export function TagMultiSelect({
  value,
  suggestions = [],
  placeholder = "Add tags",
  disabled = false,
  maxSelected = 25,
  emptyIndicator,
  selectedLayout = "wrap",
  className,
  onChange,
}: TagMultiSelectProps) {
  const normalizedValue = useMemo(() => normalizeTags(value), [value]);
  const options = useMemo(
    () => toOptions(normalizeTags([...suggestions, ...normalizedValue])),
    [normalizedValue, suggestions]
  );
  const selected = useMemo(() => toOptions(normalizedValue), [normalizedValue]);

  return (
    <MultipleSelector
      value={selected}
      options={options}
      onChange={(nextOptions) =>
        onChange(normalizeTags(nextOptions.map((option) => option.value)))
      }
      placeholder={placeholder}
      emptyIndicator={
        emptyIndicator ?? (
          <div className="px-3 py-2 text-xs text-white/45">
            Start typing to create a tag.
          </div>
        )
      }
      creatable
      hidePlaceholderWhenSelected
      disabled={disabled}
      maxSelected={maxSelected}
      className={cn(
        "rounded-sm border border-white/10 bg-sidebar px-2 py-2 text-sm",
        className
      )}
      badgeClassName={cn(
        "rounded-sm border-white/10 bg-sidebar-accent text-white",
        selectedLayout === "grid" && "max-w-full min-w-0"
      )}
      selectedContainerClassName={
        selectedLayout === "grid" ? "items-center gap-2" : undefined
      }
      inputInSelectedFlow={selectedLayout === "grid"}
      commandProps={{
        className: "bg-[#1D1D20] text-white",
      }}
      inputProps={{
        className: cn(
          "text-xs text-white placeholder:text-white/35",
          selectedLayout === "grid" && "min-w-[8rem]"
        ),
      }}
    />
  );
}
