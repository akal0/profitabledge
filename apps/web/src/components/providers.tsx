"use client";

import { useEffect, useRef } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, trpc, trpcReactClient } from "@/utils/trpc";
import { ThemeProvider } from "./theme-provider";
import { TooltipProvider } from "./ui/tooltip";
import { Toaster } from "./ui/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { authClient } from "@/lib/auth-client";
import { useAccountStore } from "@/stores/account";

function SessionQueryBoundary({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const previousUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (isPending) {
      return;
    }

    const currentUserId = session?.user?.id ?? null;
    const previousUserId = previousUserIdRef.current;

    if (previousUserId === undefined) {
      previousUserIdRef.current = currentUserId;
      return;
    }

    if (previousUserId !== currentUserId) {
      queryClient.clear();
      useAccountStore.getState().setSelectedAccountId(undefined);
    }

    previousUserIdRef.current = currentUserId;
  }, [isPending, session?.user?.id]);

  return <>{children}</>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <trpc.Provider client={trpcReactClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <SessionQueryBoundary>
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              forcedTheme="dark"
              disableTransitionOnChange
            >
              <TooltipProvider>{children}</TooltipProvider>
              <Toaster richColors />
            </ThemeProvider>
          </SessionQueryBoundary>
        </QueryClientProvider>
      </trpc.Provider>
    </NuqsAdapter>
  );
}
