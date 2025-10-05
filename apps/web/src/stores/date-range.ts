import { create } from "zustand";
import { useComparisonStore } from "@/stores/comparison";

export type ComparisonMode = "none" | "previous";

type DateRangeState = {
  start: Date | null;
  end: Date | null;
  min: Date | null;
  max: Date | null;
  comparison: ComparisonMode;
  comparisonOwner: string | null;
  setRange: (start: Date, end: Date) => void;
  setComparison: (mode: ComparisonMode, owner?: string | null) => void;
  setBounds: (min: Date, max: Date) => void;
};

export const useDateRangeStore = create<DateRangeState>((set) => ({
  start: null,
  end: null,
  min: null,
  max: null,
  comparison: "none",
  comparisonOwner: null,
  setRange: (start, end) => {
    // Reset per-widget comparisons when the global date range changes
    try {
      useComparisonStore.getState().reset();
    } catch {}
    set({ start, end, comparison: "none", comparisonOwner: null });
  },
  setComparison: (mode, owner) =>
    set((prev) => ({
      comparison: mode,
      comparisonOwner: mode === "none" ? null : owner ?? prev.comparisonOwner,
    })),
  setBounds: (min, max) => set({ min, max }),
}));
