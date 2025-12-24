import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type AccountState = {
  selectedAccountId?: string;
  setSelectedAccountId: (id?: string) => void;
};

export const useAccountStore = create<AccountState>()(
  persist(
    (set) => ({
      selectedAccountId: undefined,
      setSelectedAccountId: (id?: string) => {
        set({ selectedAccountId: id });
      },
    }),
    {
      name: "profitabledge-account-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
