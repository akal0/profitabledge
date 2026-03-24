"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  queryClient,
  trpc,
  trpcOptions,
  trpcReactClient,
} from "@/utils/trpc";
import { ThemeProvider } from "./theme-provider";
import { TooltipProvider } from "./ui/tooltip";
import { Toaster } from "./ui/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { authClient } from "@/lib/auth-client";
import { useAccountStore } from "@/stores/account";
import { TabAttentionController } from "@/components/tab-attention-controller";
import {
  GROWTH_TOUCH_COOKIE,
  GROWTH_VISITOR_COOKIE,
  readCookie,
  readGrowthTouchFromSearchParams,
} from "@/features/growth/lib/growth-attribution";
import { getBillingV2Client } from "@/features/growth/lib/billing-v2";

function SessionQueryBoundary({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const previousUserIdRef = useRef<string | null | undefined>(undefined);
  const captureKeyRef = useRef<string | null>(null);
  const claimKeyRef = useRef<string | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

  useEffect(() => {
    const touch = readGrowthTouchFromSearchParams(
      searchParams ?? new URLSearchParams(),
      pathname
    );

    if (!touch) {
      return;
    }

    const requestKey = [
      touch.type,
      touch.code,
      touch.offerCode ?? "",
      touch.channel ?? "",
      touch.trackingLinkSlug ?? "",
      "",
      pathname ?? "",
      searchParams?.toString() ?? "",
    ].join(":");

    if (captureKeyRef.current === requestKey) {
      return;
    }

    captureKeyRef.current = requestKey;

    const billingClient = getBillingV2Client();
    void billingClient.captureGrowthTouch
      ?.mutate?.({
        ...touch,
        visitorToken: readCookie(GROWTH_VISITOR_COOKIE) ?? undefined,
        touchCookie: readCookie(GROWTH_TOUCH_COOKIE) ?? undefined,
      })
      .catch(() => {
        captureKeyRef.current = null;
      });
  }, [pathname, searchParams]);

  useEffect(() => {
    if (isPending || !session?.user?.id) {
      return;
    }

    const claimKey = `${session.user.id}:${readCookie(GROWTH_VISITOR_COOKIE) ?? ""}`;
    if (claimKeyRef.current === claimKey) {
      return;
    }

    claimKeyRef.current = claimKey;

    const billingClient = getBillingV2Client();
    void billingClient.claimPendingGrowthAttribution
      ?.mutate?.()
      .then(() =>
        Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpcOptions.billing.getState.queryOptions().queryKey,
          }),
          queryClient.invalidateQueries({
            queryKey: trpcOptions.billing.getAffiliateDashboard.queryOptions().queryKey,
          }),
          queryClient.invalidateQueries({
            queryKey: trpcOptions.billing.getAffiliatePayoutSettings.queryOptions().queryKey,
          }),
        ])
      )
      .catch(() => {
        // Keep this silent so auth flows are not interrupted by best-effort attribution.
      });
  }, [isPending, session?.user?.id]);

  return <>{children}</>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <trpc.Provider client={trpcReactClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <Suspense>
            <SessionQueryBoundary>
              <ThemeProvider
                attribute="class"
                defaultTheme="dark"
                forcedTheme="dark"
                disableTransitionOnChange
              >
                <TabAttentionController />
                <TooltipProvider>{children}</TooltipProvider>
                <Toaster richColors />
              </ThemeProvider>
            </SessionQueryBoundary>
          </Suspense>
        </QueryClientProvider>
      </trpc.Provider>
    </NuqsAdapter>
  );
}
