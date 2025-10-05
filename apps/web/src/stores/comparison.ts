import { create } from "zustand";

export type WidgetComparisonMode =
  | "none"
  | "previous"
  | "thisWeek"
  | "lastWeek";

type ComparisonState = {
  comparisons: Record<string, WidgetComparisonMode>;
  setComparison: (owner: string, mode: WidgetComparisonMode) => void;
  hydrate: (initial: Record<string, WidgetComparisonMode>) => void;
  reset: () => void;
};

export const useComparisonStore = create<ComparisonState>((set) => ({
  comparisons: {},
  setComparison: (owner, mode) =>
    set((prev) => ({ comparisons: { ...prev.comparisons, [owner]: mode } })),
  hydrate: (initial) => set({ comparisons: { ...initial } }),
  reset: () => set({ comparisons: {} }),
}));
