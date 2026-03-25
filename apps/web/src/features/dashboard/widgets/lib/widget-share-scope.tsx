"use client";

import {
  createContext,
  useContext,
  type PropsWithChildren,
} from "react";

const WidgetShareScopeContext = createContext<string | undefined>(undefined);

export function WidgetShareScopeProvider({
  accountId,
  children,
}: PropsWithChildren<{ accountId?: string }>) {
  return (
    <WidgetShareScopeContext.Provider value={accountId}>
      {children}
    </WidgetShareScopeContext.Provider>
  );
}

export function useWidgetShareScope(accountId?: string) {
  const scopedAccountId = useContext(WidgetShareScopeContext);
  return accountId ?? scopedAccountId;
}
