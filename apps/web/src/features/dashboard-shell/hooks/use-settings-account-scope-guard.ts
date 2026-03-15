"use client";

import { useEffect } from "react";
import { ALL_ACCOUNTS_ID } from "@/stores/account";

type UseSettingsAccountScopeGuardOptions = {
  pathname: string;
  accountId?: string;
  firstAccountId?: string;
  setSelectedAccountId: (id?: string) => void;
};

export function useSettingsAccountScopeGuard({
  pathname,
  accountId,
  firstAccountId,
  setSelectedAccountId,
}: UseSettingsAccountScopeGuardOptions) {
  useEffect(() => {
    if (
      pathname.startsWith("/dashboard/settings") &&
      accountId === ALL_ACCOUNTS_ID &&
      firstAccountId
    ) {
      setSelectedAccountId(firstAccountId);
    }
  }, [accountId, firstAccountId, pathname, setSelectedAccountId]);
}
