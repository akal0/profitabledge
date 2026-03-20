"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { prefetchDashboardWorkspace } from "@/features/dashboard/home/lib/dashboard-workspace-preload";
import { queryClient, trpcClient } from "@/utils/trpc";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";

const CHECKOUT_PLAN_SYNC_RETRY_DELAYS_MS = [0, 1500, 3000, 5000, 8000] as const;
const DASHBOARD_TOUR_ENTRY_PATH = "/dashboard";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function AuthContinuePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasStartedRedirectRef = useRef(false);
  const hasStartedCheckoutFinalizeRef = useRef(false);
  const isMountedRef = useRef(true);
  const [checkoutSyncFailed, setCheckoutSyncFailed] = useState(false);
  const [billingTimedOut, setBillingTimedOut] = useState(false);
  const requestedReturnTo = useMemo(
    () => resolvePostAuthPath(searchParams?.get("returnTo")),
    [searchParams]
  );
  const checkoutPlanKey = useMemo(() => {
    if (searchParams?.get("checkout") !== "success") {
      return null;
    }

    const plan = searchParams?.get("plan");
    return plan === "professional" || plan === "institutional" ? plan : null;
  }, [searchParams]);
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
  const billingQuery = useQuery({
    ...trpcOptions.billing.getState.queryOptions(),
    enabled: !isSessionPending && hasConfirmedSession,
  });
  const billingState = billingQuery.data;
  const billingStateQueryKey = trpcOptions.billing.getState.queryOptions().queryKey;

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Safety net: if billing never resolves after session is confirmed, unblock the redirect.
  useEffect(() => {
    if (!hasConfirmedSession || isSessionPending || checkoutPlanKey || billingState) return;
    const timer = setTimeout(() => setBillingTimedOut(true), 5000);
    return () => clearTimeout(timer);
  }, [hasConfirmedSession, isSessionPending, checkoutPlanKey, billingState]);
  const redirectTarget = useMemo(() => {
    if (checkoutPlanKey) {
      return null;
    }

    // If billing failed or timed out, unblock the redirect with a safe fallback.
    if (!billingState) {
      if (billingQuery.isError || billingTimedOut) {
        // Non-dashboard paths (e.g. journal share links) go directly.
        if (!returnToAfterOnboarding.startsWith("/dashboard")) {
          return returnToAfterOnboarding;
        }
        // Dashboard paths fall back to onboarding — safest for new sign-ups.
        // Existing users who completed onboarding will be redirected through.
        return buildOnboardingPath(returnToAfterOnboarding);
      }
      return null;
    }

    return billingState.onboarding.isComplete
      ? returnToAfterOnboarding
      : requestedReturnTo.startsWith("/onboarding")
      ? requestedReturnTo
      : buildOnboardingPath(returnToAfterOnboarding);
  }, [
    billingQuery.isError,
    billingState,
    billingTimedOut,
    checkoutPlanKey,
    requestedReturnTo,
    returnToAfterOnboarding,
  ]);

  useEffect(() => {
    if (
      !checkoutPlanKey ||
      isSessionPending ||
      isRecoveringSession ||
      !hasConfirmedSession ||
      !billingState ||
      hasStartedCheckoutFinalizeRef.current
    ) {
      return;
    }

    hasStartedCheckoutFinalizeRef.current = true;
    setCheckoutSyncFailed(false);

    const redirectToDashboard = async () => {
      router.prefetch(DASHBOARD_TOUR_ENTRY_PATH);
      void prefetchDashboardWorkspace(DASHBOARD_TOUR_ENTRY_PATH).catch(
        () => undefined
      );

      if (isMountedRef.current) {
        router.replace(DASHBOARD_TOUR_ENTRY_PATH);
      }
    };

    const finalizeCheckout = async (onboardingIsComplete: boolean) => {
      if (!onboardingIsComplete) {
        const completed = await trpcClient.billing.markOnboardingComplete.mutate();
        onboardingIsComplete = completed.onboarding.isComplete;
        queryClient.setQueryData(
          billingStateQueryKey,
          (previous: typeof billingState | undefined) =>
            previous
              ? {
                  ...previous,
                  onboarding: completed.onboarding,
                }
              : previous
        );
      }

      if (!isMountedRef.current) {
        return;
      }

      await redirectToDashboard();
    };

    void (async () => {
      let activePlanKey: typeof billingState.billing.activePlanKey | null =
        billingState.billing.activePlanKey;
      let onboardingIsComplete = billingState.onboarding.isComplete;

      for (const delay of CHECKOUT_PLAN_SYNC_RETRY_DELAYS_MS) {
        if (activePlanKey === checkoutPlanKey) {
          try {
            await finalizeCheckout(onboardingIsComplete);
            return;
          } catch {
            if (!isMountedRef.current) {
              return;
            }

            continue;
          }
        }

        if (delay > 0) {
          await sleep(delay);
        }

        if (!isMountedRef.current) {
          return;
        }

        try {
          await trpcClient.billing.syncFromPolar.mutate();
        } catch {
          // Webhook reconciliation can lag behind checkout completion.
        }

        const refetched = await trpcClient.billing.getState.query();
        queryClient.setQueryData(billingStateQueryKey, refetched);
        activePlanKey = refetched.billing.activePlanKey ?? null;
        onboardingIsComplete = refetched.onboarding.isComplete;
      }

      if (isMountedRef.current) {
        setCheckoutSyncFailed(true);
      }
    })();
  }, [
    billingState,
    checkoutPlanKey,
    hasConfirmedSession,
    isRecoveringSession,
    isSessionPending,
    router,
    billingStateQueryKey,
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

    void prefetchDashboardWorkspace(redirectTarget).catch(() => undefined);

    if (!cancelled) {
      router.replace(redirectTarget);
    }

    return () => {
      cancelled = true;
    };
  }, [
    redirectTarget,
    router,
  ]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background dark:bg-sidebar w-screen">
      {checkoutSyncFailed && checkoutPlanKey ? (
        <div className="flex max-w-md flex-col items-center gap-3 px-6 text-center">
          <p className="text-sm font-medium text-foreground">
            We couldn't confirm your plan yet.
          </p>
          <p className="text-sm text-muted-foreground">
            Your checkout may still be syncing from Polar. Refresh this page in a
            moment, or open billing to verify your subscription.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Refresh
            </Button>
            <Button
              onClick={() => router.replace("/dashboard/settings/billing")}
            >
              Open Billing
            </Button>
          </div>
        </div>
      ) : (
        <RouteLoadingFallback
          route={checkoutPlanKey ? "settingsBilling" : "login"}
          message={
            isRecoveringSession
              ? "Finalizing your sign-in..."
              : checkoutPlanKey
              ? "Confirming your plan..."
              : "Preparing your workspace..."
          }
          className="min-h-screen w-screen bg-background dark:bg-sidebar"
        />
      )}
    </main>
  );
}
