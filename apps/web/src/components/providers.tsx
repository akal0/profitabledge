"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "@/utils/trpc";
import { ThemeProvider } from "./theme-provider";
import { Toaster } from "./ui/sonner";
import React, { useEffect } from "react";
import { trpcClient } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";

export default function Providers({ children }: { children: React.ReactNode }) {
  const selectedAccountId = useAccountStore((s) => s.selectedAccountId);
  const setSelectedAccountId = useAccountStore((s) => s.setSelectedAccountId);

  // Initialize selected account to first available
  useEffect(() => {
    (async () => {
      try {
        const accounts = await trpcClient.accounts.list.query();
        if (!accounts?.length) return;
        if (!selectedAccountId) setSelectedAccountId(accounts[0].id);
      } catch {}
    })();
  }, [selectedAccountId, setSelectedAccountId]);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <ReactQueryDevtools />
      </QueryClientProvider>
      <Toaster richColors />
    </ThemeProvider>
  );
}
