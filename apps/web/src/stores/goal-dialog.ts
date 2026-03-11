import { create } from "zustand";

interface GoalDialogStore {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useGoalDialog = create<GoalDialogStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
