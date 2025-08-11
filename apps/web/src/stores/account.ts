import { create } from "zustand";
import type { StateCreator } from "zustand";

type AccountState = {
  selectedAccountId?: string;
  setSelectedAccountId: (id?: string) => void;
};

const createAccountSlice: StateCreator<AccountState, [], [], AccountState> = (
  set
) => ({
  selectedAccountId: undefined,
  setSelectedAccountId: (id?: string) => set({ selectedAccountId: id }),
});

export const useAccountStore = create<AccountState>()(createAccountSlice);
