"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  buildLoginPath,
  buildOnboardingPath,
  resolvePostAuthPath,
  resolvePostOnboardingPath,
} from "@/lib/post-auth-paths";
import { trpcOptions } from "@/utils/trpc";
import { CHECKOUT_SESSION_CONFIRM_RETRY_DELAYS_MS } from "@/lib/session-confirmation";
import { useConfirmedSession } from "@/lib/use-confirmed-session";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { prefetchDashboardWorkspace } from "@/features/dashboard/home/lib/dashboard-workspace-preload";

export default function AuthContinuePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasStartedRedirectRef = useRef(false);
  const requestedReturnTo = useMemo(
    () => resolvePostAuthPath(searchParams?.get("returnTo")),
    [searchParams]
  );
  const returnToAfterOnboarding = useMemo(
    () => resolvePostOnboardingPath(requestedReturnTo),
    [requestedReturnTo]
  );
  const {
    isSessionPending,
    hasConfirmedSession,
    hasAttemptedSessionRecovery,
    isRecoveringSession,
  } = useConfirmedSession({
    retryDelays: CHECKOUT_SESSION_CONFIRM_RETRY_DELAYS_MS,
  });
  const billingStateQuery = useQuery({
    ...trpcOptions.billing.getState.queryOptions(),
    enabled: !isSessionPending && hasConfirmedSession,
  });
  const redirectTarget = useMemo(() => {
    if (!billingStateQuery.data) {
      return null;
    }

    return billingStateQuery.data.onboarding.isComplete
      ? returnToAfterOnboarding
      : requestedReturnTo.startsWith("/onboarding")
      ? requestedReturnTo
      : buildOnboardingPath(returnToAfterOnboarding);
  }, [
    billingStateQuery.data,
    requestedReturnTo,
    returnToAfterOnboarding,
  ]);

  useEffect(() => {
    if (isSessionPending || isRecoveringSession) {
      return;
    }

    if (!hasConfirmedSession) {
      if (hasAttemptedSessionRecovery) {
        router.replace(buildLoginPath(requestedReturnTo));
      }
      return;
    }
  }, [
    hasAttemptedSessionRecovery,
    hasConfirmedSession,
    isRecoveringSession,
    isSessionPending,
    requestedReturnTo,
    router,
  ]);

  useEffect(() => {
    if (!redirectTarget || hasStartedRedirectRef.current) {
      return;
    }

    hasStartedRedirectRef.current = true;

    if (!redirectTarget.startsWith("/dashboard")) {
      router.replace(redirectTarget);
      return;
    }

    let cancelled = false;
    router.prefetch("/dashboard");
    if (redirectTarget !== "/dashboard") {
      router.prefetch(redirectTarget);
    }

    void prefetchDashboardWorkspace(redirectTarget)
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          router.replace(redirectTarget);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    redirectTarget,
    router,
  ]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background dark:bg-sidebar w-screen">
      <TextShimmer
        className="text-sm [--base-color:rgba(255,255,255,0.42)] [--base-gradient-color:rgba(255,255,255,0.95)]"
        duration={1.8}
      >
        {isRecoveringSession
          ? "Finalizing your sign-in..."
          : "Preparing your workspace..."}
      </TextShimmer>
    </main>
  );
}
