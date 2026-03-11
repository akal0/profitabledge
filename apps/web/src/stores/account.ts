import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const ALL_ACCOUNTS_ID = "__all__";

export function isAllAccountsScope(accountId?: string | null): boolean {
  return accountId === ALL_ACCOUNTS_ID;
}

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
