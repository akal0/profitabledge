"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import ChevronRight from "@/public/icons/chevron-right.svg";
import Plans from "./components/plans";
import Personal from "./components/personal";
import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import { trpcClient, trpcOptions } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  clearStoredGrowthIntent,
  getStoredGrowthIntent,
  isGrowthIntentExpired,
} from "@/features/growth/lib/access-intent";
import {
  clearStoredOnboardingStep,
  getStoredOnboardingStep,
  storeOnboardingStep,
  type OnboardingStep,
} from "@/features/onboarding/lib/onboarding-step-storage";
import {
  buildLoginPath,
  buildPostAuthContinuePath,
  buildOnboardingPath,
  resolvePostOnboardingPath,
} from "@/lib/post-auth-paths";
import { getOnboardingButtonClassName } from "@/features/onboarding/lib/onboarding-button-styles";

type BillingPlanKey = "student" | "professional" | "institutional";
type BillingInterval = "monthly" | "annual";
const CHECKOUT_SYNC_RETRY_DELAYS_MS = [0, 1500, 3000, 5000] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function OnboardingPageContent() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [selectedPlanKey, setSelectedPlanKey] =
    useState<BillingPlanKey>("student");
  const [pendingPlanKey, setPendingPlanKey] = useState<BillingPlanKey | null>(
    null
  );
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("annual");
  const [isCompletingOnboarding, setIsCompletingOnboarding] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const bootstrappedGrowthState = useRef(false);
  const bootstrappedStepState = useRef(false);
  const handledCheckoutState = useRef<string | null>(null);
  const isCompletingOnboardingRef = useRef(false);
  const nextOnboardingStagePath = useMemo(
    () => resolvePostOnboardingPath(searchParams?.get("returnTo")),
    [searchParams]
  );

  const isSessionReady = !isSessionPending && !!session;
  const checkoutContinuePath = useMemo(
    () => buildPostAuthContinuePath(nextOnboardingStagePath),
    [nextOnboardingStagePath]
  );

  const billingConfigQuery = useQuery(
    trpcOptions.billing.getPublicConfig.queryOptions()
  );
  const billingStateQuery = useQuery({
    ...trpcOptions.billing.getState.queryOptions(),
    enabled: isSessionReady,
  });
  const createCheckout = useMutation<any, unknown, any>({
    mutationFn: (input) => (trpcClient.billing as any).createCheckout.mutate(input),
  });
  const syncBillingState = useMutation(
    trpcOptions.billing.syncBillingState.mutationOptions()
  );

  const activePlanKey =
    (billingStateQuery.data?.billing.activePlanKey as
      | BillingPlanKey
      | undefined) ?? "student";
  const refetchBillingState = billingStateQuery.refetch;
  const onboardingStorageUserId = session?.user.id ?? null;
  const shouldSkipOnboarding = Boolean(
    billingStateQuery.data?.onboarding.isComplete
  );
  const completeOnboardingAndRedirect = useCallback(
    async (options?: { syncPlan?: boolean }) => {
      if (!isSessionReady) {
        toast.message("Finalizing your sign-in. Try again in a moment.");
        return false;
      }

      if (isCompletingOnboardingRef.current) {
        return false;
      }

      isCompletingOnboardingRef.current = true;
      setIsCompletingOnboarding(true);

      try {
        if (options?.syncPlan) {
          try {
            await trpcClient.billing.syncBillingState.mutate();
          } catch {
            // Best-effort reconciliation for local dev and webhook lag.
          }
        }

        await trpcClient.billing.markOnboardingComplete.mutate();
        await refetchBillingState();
        clearStoredOnboardingStep(onboardingStorageUserId);
        router.push(nextOnboardingStagePath);
        return true;
      } catch {
        isCompletingOnboardingRef.current = false;
        setIsCompletingOnboarding(false);
        toast.error("Unable to finish onboarding right now");
        return false;
      }
    },
    [
      isSessionReady,
      nextOnboardingStagePath,
      onboardingStorageUserId,
      refetchBillingState,
      router,
    ]
  );

  useEffect(() => {
    setSelectedPlanKey(activePlanKey);
  }, [activePlanKey]);

  useEffect(() => {
    const configuredDefaultInterval = billingConfigQuery.data
      ?.defaultBillingInterval as BillingInterval | undefined;
    if (configuredDefaultInterval) {
      setBillingInterval(configuredDefaultInterval);
    }
  }, [billingConfigQuery.data?.defaultBillingInterval]);

  useEffect(() => {
    if (!bootstrappedStepState.current) {
      return;
    }

    storeOnboardingStep(onboardingStorageUserId, currentStep);
  }, [currentStep, onboardingStorageUserId]);

  useEffect(() => {
    if (
      !billingStateQuery.data ||
      bootstrappedStepState.current ||
      isSessionPending
    ) {
      return;
    }

    bootstrappedStepState.current = true;

    const checkoutStatus = searchParams?.get("checkout");
    const planParam = searchParams?.get("plan");
    const intervalParam = searchParams?.get("interval");
    const storedStep = getStoredOnboardingStep(onboardingStorageUserId);

    if (intervalParam === "monthly" || intervalParam === "annual") {
      setBillingInterval(intervalParam);
    }

    if (planParam === "professional" || planParam === "institutional") {
      setSelectedPlanKey(planParam);
    }

    if (
      checkoutStatus === "success" &&
      (planParam === "professional" || planParam === "institutional")
    ) {
      setCurrentStep(2);
      return;
    }

    if (activePlanKey !== "student") {
      setCurrentStep(2);
      return;
    }

    if (storedStep) {
      setCurrentStep(storedStep);
    }
  }, [
    activePlanKey,
    billingStateQuery.data,
    isSessionPending,
    onboardingStorageUserId,
    searchParams,
  ]);

  useEffect(() => {
    if (isSessionPending || session) {
      return;
    }

    router.replace(buildLoginPath(buildOnboardingPath(searchParams?.get("returnTo"))));
  }, [isSessionPending, router, searchParams, session]);

  useEffect(() => {
    if (!billingStateQuery.data || bootstrappedGrowthState.current) {
      return;
    }

    bootstrappedGrowthState.current = true;

    const storedIntent = getStoredGrowthIntent();
    if (!storedIntent) {
      return;
    }

    if (isGrowthIntentExpired(storedIntent)) {
      clearStoredGrowthIntent();
      return;
    }

    void (async () => {
      try {
        await trpcClient.billing.captureGrowthTouch.mutate({
          type: storedIntent.type,
          code: storedIntent.code || undefined,
          offerCode: storedIntent.offerCode ?? undefined,
          channel: storedIntent.channel ?? undefined,
          trackingLinkSlug: storedIntent.trackingLinkSlug ?? undefined,
          affiliateGroupSlug: storedIntent.affiliateGroupSlug ?? undefined,
          landingPath: "/onboarding",
          visitorToken: storedIntent.visitorToken ?? undefined,
        } as any);

        await trpcClient.billing.claimPendingGrowthAttribution.mutate({
          visitorToken: storedIntent.visitorToken ?? undefined,
        } as any);

        clearStoredGrowthIntent();
        void billingStateQuery.refetch();
      } catch (error) {
        if (error instanceof Error && error.message) {
          toast.error(error.message);
        }
      }
    })();
  }, [billingStateQuery.data, billingStateQuery]);

  useEffect(() => {
    const checkoutStatus = searchParams?.get("checkout");
    const planParam = searchParams?.get("plan");
    const checkoutId = searchParams?.get("checkout_id");

    if (
      checkoutStatus !== "success" ||
      (planParam !== "professional" && planParam !== "institutional")
    ) {
      return;
    }

    const stateKey = `${checkoutId ?? "checkout"}:${planParam}`;
    if (handledCheckoutState.current === stateKey) {
      return;
    }

    handledCheckoutState.current = stateKey;
    setSelectedPlanKey(planParam);
    setCurrentStep(2);

    if (activePlanKey === planParam) {
      void completeOnboardingAndRedirect();
      return;
    }

    let cancelled = false;

    void (async () => {
      for (const delay of CHECKOUT_SYNC_RETRY_DELAYS_MS) {
        if (delay > 0) {
          await sleep(delay);
        }

        if (cancelled) {
          return;
        }

        try {
          const synced = await syncBillingState.mutateAsync();
          const refetched = await billingStateQuery.refetch();
          const nextPlanKey =
            (refetched.data?.billing.activePlanKey as
              | BillingPlanKey
              | undefined) ?? (synced.activePlanKey as BillingPlanKey);

          if (nextPlanKey === planParam) {
            if (cancelled) {
              return;
            }

            await completeOnboardingAndRedirect();
            return;
          }
        } catch (error) {
          if (cancelled) {
            return;
          }

          if (delay === CHECKOUT_SYNC_RETRY_DELAYS_MS.at(-1)) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Unable to sync your plan"
            );
            return;
          }
        }
      }

      if (!cancelled) {
        toast.error(
          "Checkout completed, but plan sync is still pending. Stay on this page for a moment or refresh."
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activePlanKey,
    billingStateQuery,
    completeOnboardingAndRedirect,
    searchParams,
    syncBillingState,
  ]);

  useEffect(() => {
    if (!shouldSkipOnboarding) {
      return;
    }

    clearStoredOnboardingStep(onboardingStorageUserId);
    router.replace(nextOnboardingStagePath);
  }, [
    nextOnboardingStagePath,
    onboardingStorageUserId,
    router,
    shouldSkipOnboarding,
  ]);

  const steps = [
    {
      id: 1,
      name: "Profile",
      status: currentStep === 1 ? "current" : "completed",
    },
    {
      id: 2,
      name: "Select a plan",
      status: currentStep === 2 ? "current" : "upcoming",
    },
  ] as const;

  const handleLogout = async () => {
    clearStoredOnboardingStep(onboardingStorageUserId);
    await authClient.signOut();
    router.push("/login");
  };

  const handlePlanSelection = async (planKey: BillingPlanKey) => {
    setSelectedPlanKey(planKey);

    if (planKey === "student") {
      setPendingPlanKey(planKey);
      const completed = await completeOnboardingAndRedirect();
      if (!completed) {
        setPendingPlanKey(null);
      }

      return;
    }

    try {
      setPendingPlanKey(planKey);
      const result = await createCheckout.mutateAsync({
        planKey,
        billingInterval,
        returnPath: checkoutContinuePath,
      });

      window.location.assign(result.url);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to start checkout";
      toast.error(message);
    } finally {
      setPendingPlanKey(null);
    }
  };

  const handleDashboardContinue = async () => {
    await completeOnboardingAndRedirect({ syncPlan: true });
  };

  if (shouldSkipOnboarding) {
    return null;
  }

  if (isSessionPending || !session) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-sidebar">
        <div className="w-full max-w-md rounded-lg border border-white/10 bg-sidebar p-6 text-center text-sm text-white/55 shadow-sidebar-button">
          Restoring your session and returning to onboarding...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-x-hidden bg-sidebar">
      <div className="flex flex-col">
        <div className="flex w-full flex-col gap-4 px-4 py-4 text-xs sm:px-6 lg:px-10 xl:h-20 xl:flex-row xl:items-center xl:justify-between xl:gap-6 xl:px-25">
          <p className="font-bold">profitabledge</p>

          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 xl:flex-1">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="flex items-center justify-center gap-2"
              >
                <h1
                  className={
                    step.status === "current"
                      ? "text-white"
                      : step.status === "completed"
                      ? "text-emerald-500"
                      : "text-secondary"
                  }
                >
                  {step.name}
                </h1>
                {index < steps.length - 1 ? (
                  <ChevronRight
                    className={
                      step.status === "current"
                        ? "stroke-white"
                        : step.status === "completed"
                        ? "stroke-emerald-500"
                        : "stroke-secondary"
                    }
                  />
                ) : null}
              </div>
            ))}
          </div>

          <Button
            onClick={handleLogout}
            className={getOnboardingButtonClassName({
              className: "w-max self-start xl:self-auto",
            })}
          >
            Log out
          </Button>
        </div>

        <Separator />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div
          className={cn(
            "mx-auto flex min-h-full w-full flex-col items-center justify-center gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 xl:px-25",
            currentStep === 2 ? "max-w-[92rem]" : "max-w-7xl"
          )}
        >
          <div className="flex w-full max-w-2xl min-w-0 flex-col items-center justify-center gap-8 sm:gap-12">
            <div className="grid w-full gap-3 md:grid-cols-2 md:gap-4">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className="flex min-w-0 flex-col items-center gap-3 md:gap-4"
                >
                  <p
                    className={cn(
                      "text-center text-xs font-medium md:text-left",
                      step.status === "current"
                        ? "text-white"
                        : step.status === "completed"
                        ? "text-emerald-500"
                        : "text-white/25"
                    )}
                  >
                    {step.name}
                  </p>

                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-sidebar-accent shadow-sidebar-button">
                    <div
                      className={cn(
                        "absolute inset-1 rounded-full shadow-sidebar-button transition-all duration-1000 ease-out",
                        step.status === "completed"
                          ? "bg-emerald-500"
                          : step.status === "current"
                          ? "bg-amber-500"
                          : "bg-sidebar"
                      )}
                      style={{
                        transformOrigin: "left",
                        width: "calc(100% - 8px)",
                        animation:
                          step.status === "current"
                            ? "slideInLeftConstrained 0.8s ease-in-out forwards"
                            : undefined,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {currentStep === 1 ? (
            <Personal onNext={() => setCurrentStep(2)} />
          ) : null}

          {currentStep === 2 ? (
            <div className="flex w-full flex-col items-center gap-8">
              {billingConfigQuery.data ? (
                <>
                  <Plans
                    plans={billingConfigQuery.data.plans}
                    activePlanKey={activePlanKey}
                    selectedPlanKey={selectedPlanKey}
                    pendingPlanKey={pendingPlanKey}
                    billingInterval={billingInterval}
                    onBillingIntervalChange={setBillingInterval}
                    onSelectPlan={handlePlanSelection}
                  />
                  {activePlanKey !== "student" ? (
                    <div className="w-full max-w-2xl">
                      <Button
                        onClick={handleDashboardContinue}
                        disabled={isCompletingOnboarding}
                        className={getOnboardingButtonClassName({
                          tone: "teal",
                          className: "w-full",
                        })}
                      >
                        {isCompletingOnboarding
                          ? "Opening dashboard..."
                          : "Go to dashboard"}
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="w-full max-w-2xl rounded-lg border border-white/10 bg-sidebar p-6 text-center text-sm text-white/45 shadow-sidebar-button">
                  Loading plan details...
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OnboardingPageContent />
    </Suspense>
  );
}
