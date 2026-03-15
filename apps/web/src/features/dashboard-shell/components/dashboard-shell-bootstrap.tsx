"use client";

import { useEffect, useRef } from "react";
import { useAccountCatalog } from "@/features/accounts/hooks/use-account-catalog";
import { ALL_ACCOUNTS_ID, useAccountStore } from "@/stores/account";

export function DashboardShellBootstrap() {
  const selectedAccountId = useAccountStore((state) => state.selectedAccountId);
  const setSelectedAccountId = useAccountStore(
    (state) => state.setSelectedAccountId
  );
  const hasInitializedSelection = useRef(false);
  const { accounts } = useAccountCatalog();

  useEffect(() => {
    if (hasInitializedSelection.current || accounts.length === 0) return;

    hasInitializedSelection.current = true;

    const syncSelection = async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));

      if (!useAccountStore.getState().selectedAccountId) {
        setSelectedAccountId(accounts[0].id);
      }
    };

    void syncSelection();
  }, [accounts, setSelectedAccountId]);

  useEffect(() => {
    if (!selectedAccountId || selectedAccountId === ALL_ACCOUNTS_ID) return;
    if (accounts.length === 0) return;
    if (accounts.some((account) => account.id === selectedAccountId)) return;

    setSelectedAccountId(accounts[0].id);
  }, [accounts, selectedAccountId, setSelectedAccountId]);

  return null;
}
