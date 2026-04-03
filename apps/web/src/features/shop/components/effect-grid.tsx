import type { ReactNode } from "react";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  FilterChips,
  type FilterChipGroup,
} from "@/features/shop/components/filter-chips";

export const SHOP_CARD_GRID_CLASS =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";

type EffectGridSection = {
  key: string;
  label: string;
  description?: string;
  count?: number;
  content: ReactNode;
};

type EffectGridProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  filterGroups?: FilterChipGroup[];
  activeFilterCount?: number;
  onClearFilters?: () => void;
  sections: EffectGridSection[];
  emptyTitle: string;
  emptyCopy: string;
};

export function EffectGrid({
  search,
  onSearchChange,
  searchPlaceholder,
  filterGroups = [],
  activeFilterCount = 0,
  onClearFilters,
  sections,
  emptyTitle,
  emptyCopy,
}: EffectGridProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-md border border-white/5 bg-sidebar p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/32" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 border-white/8 bg-white/[0.03] pl-9 text-white placeholder:text-white/28"
          />
        </div>
        <FilterChips
          groups={filterGroups}
          activeCount={activeFilterCount}
          onClear={onClearFilters}
        />
      </div>

      {sections.length === 0 ? (
        <div className="rounded-md border border-dashed border-white/10 bg-sidebar px-5 py-10 text-center">
          <p className="text-sm font-medium text-white">{emptyTitle}</p>
          <p className="mt-2 text-sm text-white/42">{emptyCopy}</p>
        </div>
      ) : (
        sections.map((section) => (
          <div key={section.key} className="space-y-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="h-px w-8 bg-gradient-to-r from-teal-400/70 to-transparent" />
                  <p className="text-sm font-medium text-white">{section.label}</p>
                </div>
                {section.description ? (
                  <p className="text-sm text-white/40">{section.description}</p>
                ) : null}
              </div>
              {section.count != null ? (
                <p className="inline-flex items-center rounded-sm border border-white/8 bg-white/[0.03] px-2 py-1 text-xs text-white/32">
                  {section.count} items
                </p>
              ) : null}
            </div>
            {section.content}
          </div>
        ))
      )}
    </div>
  );
}
