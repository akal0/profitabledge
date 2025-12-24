"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "@/utils/trpc";
import { ThemeProvider } from "./theme-provider";
import { Toaster } from "./ui/sonner";
import React, { useEffect } from "react";
import { trpcClient } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export default function Providers({ children }: { children: React.ReactNode }) {
  const hasInitializedRef = React.useRef(false);

  // Initialize selected account to first available ONLY if no persisted value exists
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    (async () => {
      try {
        // Wait a tick to let Zustand hydrate from localStorage
        await new Promise(resolve => setTimeout(resolve, 0));

        const currentValue = useAccountStore.getState().selectedAccountId;

        // Only initialize if there's still no selected account after hydration
        if (!currentValue) {
          const accounts = await trpcClient.accounts.list.query();
          if (!accounts?.length) return;
          useAccountStore.getState().setSelectedAccountId(accounts[0].id);
        }
      } catch (e) {
        console.error('[Providers] Error initializing account:', e);
      }
    })();
  }, []); // Only run once on mount

  return (
    <NuqsAdapter>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
        <Toaster richColors />
      </ThemeProvider>
    </NuqsAdapter>
  );
}
