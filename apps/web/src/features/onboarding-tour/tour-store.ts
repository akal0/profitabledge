import { create } from "zustand";
import { ADD_ACCOUNT_SHEET_CLOSE_DURATION_MS } from "./tour-steps";

interface TourStore {
  demoCreated: boolean;
  setDemoCreated: (v: boolean) => void;
  addAccountSheetCompleted: boolean;
  setAddAccountSheetCompleted: (v: boolean) => void;
  disablePointerTransition: boolean;
  setDisablePointerTransition: (v: boolean) => void;
  isStartingDashboardTour: boolean;
  setIsStartingDashboardTour: (v: boolean) => void;
  requestedAddAccountSheetOpen: boolean;
  setRequestedAddAccountSheetOpen: (v: boolean) => void;
  guidedSheetTransitionActive: boolean;
  setGuidedSheetTransitionActive: (v: boolean) => void;
  lockGuidedSheetTransition: (durationMs?: number) => void;
}

let guidedSheetTransitionTimer: number | null = null;

export const useTourStore = create<TourStore>((set) => ({
  demoCreated: false,
  setDemoCreated: (v) => set({ demoCreated: v }),
  addAccountSheetCompleted: false,
  setAddAccountSheetCompleted: (v) => set({ addAccountSheetCompleted: v }),
  disablePointerTransition: false,
  setDisablePointerTransition: (v) => set({ disablePointerTransition: v }),
  isStartingDashboardTour: false,
  setIsStartingDashboardTour: (v) => set({ isStartingDashboardTour: v }),
  requestedAddAccountSheetOpen: false,
  setRequestedAddAccountSheetOpen: (v) =>
    set({ requestedAddAccountSheetOpen: v }),
  guidedSheetTransitionActive: false,
  setGuidedSheetTransitionActive: (v) =>
    set({ guidedSheetTransitionActive: v }),
  lockGuidedSheetTransition: (durationMs = ADD_ACCOUNT_SHEET_CLOSE_DURATION_MS) => {
    if (guidedSheetTransitionTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(guidedSheetTransitionTimer);
    }

    set({ guidedSheetTransitionActive: true });

    if (typeof window === "undefined") {
      return;
    }

    guidedSheetTransitionTimer = window.setTimeout(() => {
      guidedSheetTransitionTimer = null;
      set({ guidedSheetTransitionActive: false });
    }, durationMs);
  },
}));
