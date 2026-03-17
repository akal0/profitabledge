import { create } from "zustand";

type AccountTransitionState = {
  pendingAccountId?: string;
  startedAt?: number;
  beginAccountTransition: (accountId?: string) => void;
  completeAccountTransition: () => void;
};

export const useAccountTransitionStore = create<AccountTransitionState>(
  (set) => ({
    pendingAccountId: undefined,
    startedAt: undefined,
    beginAccountTransition: (accountId?: string) => {
      set({
        pendingAccountId: accountId,
        startedAt: accountId ? Date.now() : undefined,
      });
    },
    completeAccountTransition: () => {
      set({
        pendingAccountId: undefined,
        startedAt: undefined,
      });
    },
  })
);
