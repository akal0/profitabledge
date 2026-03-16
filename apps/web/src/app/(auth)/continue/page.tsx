"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import {
  buildLoginPath,
  buildOnboardingPath,
  resolvePostAuthPath,
  resolvePostOnboardingPath,
} from "@/lib/post-auth-paths";
import { trpcOptions } from "@/utils/trpc";
import { CHECKOUT_SESSION_CONFIRM_RETRY_DELAYS_MS } from "@/lib/session-confirmation";
import { useConfirmedSession } from "@/lib/use-confirmed-session";

export default function AuthContinuePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedReturnTo = useMemo(
    () => resolvePostAuthPath(searchParams?.get("returnTo")),
    [searchParams]
  );
  const returnToAfterOnboarding = useMemo(
    () => resolvePostOnboardingPath(requestedReturnTo),
    [requestedReturnTo]
  );
  const {
    session,
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

    if (!billingStateQuery.data) {
      return;
    }

    router.replace(
      billingStateQuery.data.onboarding.isComplete
        ? returnToAfterOnboarding
        : requestedReturnTo.startsWith("/onboarding")
        ? requestedReturnTo
        : buildOnboardingPath(returnToAfterOnboarding)
    );
  }, [
    billingStateQuery.data,
    hasAttemptedSessionRecovery,
    hasConfirmedSession,
    isRecoveringSession,
    isSessionPending,
    requestedReturnTo,
    returnToAfterOnboarding,
    router,
  ]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background dark:bg-sidebar">
      <div className="text-sm text-muted-foreground">
        {isRecoveringSession
          ? "Finalizing your sign-in..."
          : "Preparing your workspace..."}
      </div>
    </main>
  );
}
