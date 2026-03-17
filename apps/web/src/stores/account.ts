import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const ALL_ACCOUNTS_ID = "__all__";

export function isAllAccountsScope(accountId?: string | null): boolean {
  return accountId === ALL_ACCOUNTS_ID;
}

type AccountState = {
  selectedAccountId?: string;
  allAccountsPreferredCurrencyCode?: string;
  setSelectedAccountId: (id?: string) => void;
  setAllAccountsPreferredCurrencyCode: (currencyCode?: string) => void;
};

export const useAccountStore = create<AccountState>()(
  persist(
    (set) => ({
      selectedAccountId: undefined,
      allAccountsPreferredCurrencyCode: undefined,
      setSelectedAccountId: (id?: string) => {
        set({ selectedAccountId: id });
      },
      setAllAccountsPreferredCurrencyCode: (currencyCode?: string) => {
        set({ allAccountsPreferredCurrencyCode: currencyCode });
      },
    }),
    {
      name: "profitabledge-account-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
