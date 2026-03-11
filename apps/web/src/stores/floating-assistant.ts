import { create } from "zustand";

interface FloatingAssistantState {
  isOpen: boolean;
  initialQuery: string | null;
  open: (initialQuery?: string) => void;
  close: () => void;
  toggle: () => void;
  setInitialQuery: (query: string | null) => void;
}

export const useFloatingAssistant = create<FloatingAssistantState>((set) => ({
  isOpen: false,
  initialQuery: null,
  open: (initialQuery) => set({ isOpen: true, initialQuery: initialQuery ?? null }),
  close: () => set({ isOpen: false, initialQuery: null }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen, initialQuery: null })),
  setInitialQuery: (query) => set({ initialQuery: query }),
}));
