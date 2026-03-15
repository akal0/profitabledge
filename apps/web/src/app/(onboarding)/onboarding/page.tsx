"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";

import ChevronRight from "@/public/icons/chevron-right.svg";
import Plans from "./components/plans";
import Personal from "./components/personal";
import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Shield,
  Target,
  CheckCircle2,
  TrendingUp,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { trpcClient, trpcOptions } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  clearStoredGrowthIntent,
  getStoredGrowthIntent,
} from "@/features/growth/lib/access-intent";

type OnboardingStep = 1 | 2 | 3 | 4;
type BillingPlanKey = "student" | "professional" | "institutional";
const ONBOARDING_STEP_STORAGE_KEY = "profitabledge-onboarding-step";
const CHECKOUT_SYNC_RETRY_DELAYS_MS = [0, 1500, 3000, 5000] as const;

function getStoredOnboardingStep(): OnboardingStep | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(ONBOARDING_STEP_STORAGE_KEY);
  return raw === "1" || raw === "2" || raw === "3" || raw === "4"
    ? (Number(raw) as OnboardingStep)
    : null;
}

function storeOnboardingStep(step: OnboardingStep) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(ONBOARDING_STEP_STORAGE_KEY, String(step));
}

function clearStoredOnboardingStep() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(ONBOARDING_STEP_STORAGE_KEY);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPlanTitle(planKey: BillingPlanKey) {
  switch (planKey) {
    case "professional":
      return "Professional";
    case "institutional":
      return "Institutional";
    default:
      return "Student";
  }
}

function OnboardingPageContent() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [selectedPlanKey, setSelectedPlanKey] =
    useState<BillingPlanKey>("student");
  const [activationCode, setActivationCode] = useState("");
  const [activationMessage, setActivationMessage] = useState<string | null>(
    null
  );
  const [pendingPlanKey, setPendingPlanKey] = useState<BillingPlanKey | null>(
    null
  );
  const router = useRouter();
  const searchParams = useSearchParams();
  const bootstrappedGrowthState = useRef(false);
  const bootstrappedStepState = useRef(false);
  const handledCheckoutState = useRef<string | null>(null);
  const billingConfigQuery = useQuery(
    trpcOptions.billing.getPublicConfig.queryOptions()
  );
  const billingStateQuery = useQuery(
    trpcOptions.billing.getState.queryOptions()
  );
  const completeGrowthAccess = useMutation(
    trpcOptions.billing.completeGrowthAccess.mutationOptions()
  );
  const createCheckout = useMutation(
    trpcOptions.billing.createCheckout.mutationOptions()
  );
  const syncFromPolar = useMutation(
    trpcOptions.billing.syncFromPolar.mutationOptions()
  );

  const activePlanKey =
    (billingStateQuery.data?.billing.activePlanKey as BillingPlanKey | undefined) ??
    "student";
  const accessLocked = Boolean(
    billingStateQuery.data?.access.privateBetaRequired &&
      !billingStateQuery.data.access.hasPrivateBetaAccess
  );
  const shouldSkipOnboarding = Boolean(
    billingStateQuery.data?.onboarding.isComplete && !accessLocked
  );

  useEffect(() => {
    setSelectedPlanKey(activePlanKey);
  }, [activePlanKey]);

  useEffect(() => {
    if (!bootstrappedStepState.current) {
      return;
    }

    storeOnboardingStep(currentStep);
  }, [currentStep]);

  useEffect(() => {
    if (!billingStateQuery.data || bootstrappedStepState.current) {
      return;
    }

    bootstrappedStepState.current = true;

    const checkoutStatus = searchParams.get("checkout");
    const planParam = searchParams.get("plan");
    const storedStep = getStoredOnboardingStep();

    if (
      checkoutStatus === "success" &&
      (planParam === "professional" || planParam === "institutional")
    ) {
      setCurrentStep(3);
      return;
    }

    if (accessLocked) {
      setCurrentStep(2);
      return;
    }

    if (activePlanKey !== "student") {
      setCurrentStep(storedStep && storedStep > 3 ? storedStep : 3);
      return;
    }

    if (storedStep) {
      setCurrentStep(storedStep);
    }
  }, [accessLocked, activePlanKey, billingStateQuery.data, searchParams]);

  useEffect(() => {
    if (billingStateQuery.data?.onboarding.isComplete && accessLocked) {
      setCurrentStep(2);
    }
  }, [accessLocked, billingStateQuery.data?.onboarding.isComplete]);

  useEffect(() => {
    const redeemedCode = billingStateQuery.data?.access.redemption?.code;
    if (redeemedCode) {
      setActivationCode(redeemedCode);
      setActivationMessage(
        billingStateQuery.data?.access.redemption?.label
          ? `${billingStateQuery.data.access.redemption.label} access unlocked`
          : "Private beta access unlocked"
      );
    }
  }, [
    billingStateQuery.data?.access.redemption?.code,
    billingStateQuery.data?.access.redemption?.label,
  ]);

  useEffect(() => {
    if (!billingStateQuery.data || bootstrappedGrowthState.current) {
      return;
    }

    bootstrappedGrowthState.current = true;

    const storedIntent = getStoredGrowthIntent();
    const storedBetaCode = storedIntent.betaCode;
    const storedReferralCode = storedIntent.referralCode;
    const storedAffiliateCode = storedIntent.affiliateCode;
    const storedAffiliateGroupSlug = storedIntent.affiliateGroupSlug;

    if (!storedBetaCode && !storedReferralCode && !storedAffiliateCode) {
      return;
    }

    void completeGrowthAccess
      .mutateAsync({
        betaCode: storedBetaCode ?? undefined,
        referralCode: storedReferralCode ?? undefined,
        affiliateCode: storedAffiliateCode ?? undefined,
        affiliateGroupSlug: storedAffiliateGroupSlug ?? undefined,
        source: "onboarding",
      })
      .then((result) => {
        clearStoredGrowthIntent();

        if (storedBetaCode) {
          setActivationCode(storedBetaCode);
          setActivationMessage("Private beta access unlocked");
        }

        if (result.growth.message) {
          toast.error(result.growth.message);
        }

        void billingStateQuery.refetch();
      })
      .catch((error: Error) => {
        if (storedBetaCode) {
          setActivationCode(storedBetaCode);
        }

        setActivationMessage(error.message || "Unable to activate access");
      });
  }, [billingStateQuery.data, completeGrowthAccess, billingStateQuery]);

  useEffect(() => {
    const checkoutStatus = searchParams.get("checkout");
    const planParam = searchParams.get("plan");
    const checkoutId = searchParams.get("checkout_id");

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
    setCurrentStep(3);

    if (activePlanKey === planParam) {
      toast.success(`${getPlanTitle(planParam)} plan activated`);
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
          const synced = await syncFromPolar.mutateAsync();
          const refetched = await billingStateQuery.refetch();
          const nextPlanKey =
            (refetched.data?.billing.activePlanKey as BillingPlanKey | undefined) ??
            (synced.activePlanKey as BillingPlanKey);

          if (nextPlanKey === planParam) {
            toast.success(`${getPlanTitle(planParam)} plan activated`);
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
                : "Unable to sync your plan from Polar"
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
  }, [activePlanKey, billingStateQuery, searchParams, syncFromPolar]);

  useEffect(() => {
    if (shouldSkipOnboarding) {
      clearStoredOnboardingStep();
      router.replace("/dashboard");
    }
  }, [router, shouldSkipOnboarding]);

  const steps = [
    {
      id: 1,
      name: "Profile",
      status:
        currentStep === 1
          ? "current"
          : currentStep > 1
          ? "completed"
          : "upcoming",
    },
    {
      id: 2,
      name: "Select a plan",
      status:
        currentStep === 2
          ? "current"
          : currentStep > 2
          ? "completed"
          : "upcoming",
    },
    {
      id: 3,
      name: "Add an account",
      status:
        currentStep === 3
          ? "current"
          : currentStep > 3
          ? "completed"
          : "upcoming",
    },
    {
      id: 4,
      name: "Trading rules",
      status:
        currentStep === 4
          ? "current"
          : currentStep > 4
          ? "completed"
          : "upcoming",
    },
  ];

  const handleLogout = async () => {
    clearStoredOnboardingStep();
    await authClient.signOut();
    router.push("/login");
  };

  const handleRedeemAccess = async () => {
    const normalizedCode = activationCode.trim().toUpperCase();
    if (!normalizedCode) {
      setActivationMessage("Enter your private beta code to continue");
      return;
    }

    try {
      const storedIntent = getStoredGrowthIntent();
      const result = await completeGrowthAccess.mutateAsync({
        betaCode: normalizedCode,
        referralCode: storedIntent.referralCode,
        affiliateCode: storedIntent.affiliateCode,
        affiliateGroupSlug: storedIntent.affiliateGroupSlug,
        source: "onboarding",
      });

      clearStoredGrowthIntent();
      setActivationCode(normalizedCode);
      setActivationMessage(
        result.access.redemption?.label
          ? `${result.access.redemption.label} access unlocked`
          : "Private beta access unlocked"
      );

      if (result.growth.message) {
        toast.error(result.growth.message);
      } else {
        toast.success("Private beta access unlocked");
      }

      await billingStateQuery.refetch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to activate access";
      setActivationMessage(message);
      toast.error(message);
    }
  };

  const handlePlanSelection = async (planKey: BillingPlanKey) => {
    setSelectedPlanKey(planKey);

    if (planKey === "student") {
      return;
    }

    try {
      setPendingPlanKey(planKey);
      const result = await createCheckout.mutateAsync({
        planKey,
        returnPath: "/onboarding",
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

  if (shouldSkipOnboarding) {
    return null;
  }

  return (
    <div className="flex flex-col w-screen h-screen bg-sidebar">
      <div className="flex flex-col">
        <div className="w-full h-20 flex justify-between items-center px-25 text-xs">
          <p className="font-bold">profitabledge</p>

          <div className="flex items-center gap-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-2">
                <h1
                  className={`${
                    step.status === "current"
                      ? "text-white"
                      : step.status === "completed"
                      ? "text-emerald-500"
                      : "text-secondary"
                  }`}
                >
                  {step.name}
                </h1>
                {index < steps.length - 1 && (
                  <ChevronRight
                    className={`${
                      step.status === "current"
                        ? "stroke-white"
                        : step.status === "completed"
                        ? "stroke-emerald-500"
                        : "stroke-secondary"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <Button
            onClick={handleLogout}
            className="shadow-sidebar-button border-[0.5px] border-white/5 rounded-[6px] gap-2.5 h-max transition-all active:scale-95 bg-sidebar dark:hover:bg-sidebar text-white w-max text-xs hover:!brightness-110 duration-250 flex py-2 items-center justify-center cursor-pointer"
          >
            Log out
          </Button>
        </div>

        <Separator />
      </div>

      <div className="px-25 h-full max-w-7xl mx-auto flex flex-col items-center justify-center gap-8">
        <div className="flex flex-col items-center justify-center w-full max-w-2xl min-w-2xl gap-12">
          {/* <h1 className="font-bold tracking-wide uppercase"> Profitabledge </h1> */}

          <div className="flex gap-4 w-full">
            {steps.map((step) => (
              <div
                key={step.id}
                className="flex flex-col gap-4 flex-1 items-center"
              >
                <p
                  className={`text-xs font-medium ${
                    step.status === "current"
                      ? "text-white"
                      : step.status === "completed"
                      ? "text-emerald-500"
                      : "text-white/25"
                  }`}
                >
                  {step.name}
                </p>

                <div className="relative h-2.5 bg-sidebar-accent rounded-full w-full shadow-sidebar-button overflow-hidden">
                  <div
                    className={`absolute inset-1 transition-all duration-1000 ease-out rounded-full shadow-sidebar-button ${
                      step.status === "completed"
                        ? "bg-emerald-500"
                        : step.status === "current"
                        ? "bg-amber-500"
                        : "bg-sidebar"
                    }`}
                    style={{
                      transformOrigin: "left",
                      width:
                        step.status === "completed" || step.status === "current"
                          ? "calc(100% - 8px)"
                          : "calc(100% - 8px)",
                      animation:
                        step.status === "current"
                          ? "slideInLeftConstrained 0.8s ease-in-out forwards"
                          : undefined,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        {currentStep === 1 && (
          // <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
          //   <h2 className="text-2xl font-bold text-white">
          //     Tell us about yourself
          //   </h2>
          //   <div className="w-full space-y-4">
          //     <div>
          //       <label className="block text-sm font-medium text-white mb-2">
          //         Full Name
          //       </label>
          //       <input
          //         type="text"
          //         className="w-full px-4 py-3 bg-sidebar border border-white/10 rounded-lg text-white placeholder:text-white/40"
          //         placeholder="Enter your full name"
          //       />
          //     </div>
          //     <div>
          //       <label className="block text-sm font-medium text-white mb-2">
          //         Email
          //       </label>
          //       <input
          //         type="email"
          //         className="w-full px-4 py-3 bg-sidebar border border-white/10 rounded-lg text-white placeholder:text-white/40"
          //         placeholder="Enter your email"
          //       />
          //     </div>
          //     <div>
          //       <label className="block text-sm font-medium text-white mb-2">
          //         Trading Experience
          //       </label>
          //       <select className="w-full px-4 py-3 bg-sidebar border border-white/10 rounded-lg text-white">
          //         <option value="">Select your experience level</option>
          //         <option value="beginner">Beginner (0-1 years)</option>
          //         <option value="intermediate">Intermediate (1-3 years)</option>
          //         <option value="advanced">Advanced (3+ years)</option>
          //       </select>
          //     </div>
          //   </div>
          //   <Button
          //     onClick={() => setCurrentStep(2)}
          //     className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
          //   >
          //     Continue to Plan Selection
          //   </Button>
          // </div>

          <Personal onNext={() => setCurrentStep(2)} />
        )}

        {currentStep === 2 && (
          <div className="flex flex-col items-center gap-8 w-full">
            {billingConfigQuery.data && !accessLocked ? (
              <>
                <Plans
                  plans={billingConfigQuery.data.plans}
                  activePlanKey={activePlanKey}
                  selectedPlanKey={selectedPlanKey}
                  pendingPlanKey={pendingPlanKey}
                  onSelectPlan={handlePlanSelection}
                />

                <div className="w-full max-w-7xl px-2">
                  <div className="bg-sidebar border border-white/10 rounded-lg p-4 shadow-sidebar-button">
                    <div className="flex flex-col gap-1">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/35">
                        Current selection
                      </p>
                      <h2 className="text-sm font-semibold text-white">
                        {getPlanTitle(selectedPlanKey)}
                      </h2>
                      <p className="text-xs text-white/45">
                        {selectedPlanKey === activePlanKey
                          ? "Your account is already on this plan."
                          : selectedPlanKey === "student"
                          ? "Continue with the free plan and upgrade whenever you need more sync capacity or premium tooling."
                          : "Complete checkout to unlock this plan, then continue onboarding while Polar confirms the subscription."}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : accessLocked ? (
              <div className="w-full max-w-2xl">
                <div className="bg-sidebar border border-white/10 rounded-lg p-6 shadow-sidebar-button flex flex-col gap-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-10 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-300">
                      <AlertTriangle className="size-4" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold text-white">
                        Private beta access required
                      </h2>
                      <p className="text-sm text-white/55 leading-relaxed">
                        Redeem your invite code to unlock plan selection and the
                        rest of onboarding.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      value={activationCode}
                      onChange={(event) => {
                        setActivationCode(event.target.value.toUpperCase());
                        setActivationMessage(null);
                      }}
                      placeholder="Enter your beta code"
                      className="flex-1"
                    />

                    <Button
                      onClick={handleRedeemAccess}
                      disabled={completeGrowthAccess.isPending}
                      className="shadow-sidebar-button rounded-[6px] gap-2.5 h-max transition-all active:scale-95 bg-amber-600 hover:bg-amber-600 cursor-pointer text-white text-xs hover:!brightness-105 duration-250 flex py-2 items-center justify-center sm:min-w-40"
                    >
                      {completeGrowthAccess.isPending
                        ? "Activating..."
                        : "Redeem access"}
                    </Button>
                  </div>

                  <p
                    className={`text-xs ${
                      billingStateQuery.data?.access.redemption
                        ? "text-emerald-400"
                        : activationMessage
                        ? "text-amber-200"
                        : "text-white/40"
                    }`}
                  >
                    {activationMessage ??
                      "Beta access is enforced for this environment."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-2xl bg-sidebar border border-white/10 rounded-lg p-6 shadow-sidebar-button text-center text-sm text-white/45">
                Loading plan details...
              </div>
            )}

            <div className="flex gap-4 max-w-7xl w-full">
              <Button
                onClick={() => setCurrentStep(1)}
                className="shadow-sidebar-button rounded-[6px] gap-2.5 h-max transition-all active:scale-95 bg-sidebar-accent hover:bg-sidebar-accent cursor-pointer text-white flex-1 text-xs hover:!brightness-120 duration-250 flex py-2 items-center justify-center"
              >
                Back
              </Button>

              <Button
                onClick={() => setCurrentStep(3)}
                disabled={
                  accessLocked ||
                  billingConfigQuery.isLoading ||
                  billingStateQuery.isLoading
                }
                className="shadow-sidebar-button rounded-[6px] gap-2.5 h-max transition-all active:scale-95 bg-emerald-600 hover:bg-emerald-600 cursor-pointer text-white flex-1 text-xs hover:!brightness-105 duration-250 flex py-2 items-center justify-center"
              >
                {accessLocked
                  ? "Redeem access to continue"
                  : "Continue to Account Setup"}
              </Button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
            <h2 className="text-2xl font-bold text-white">
              Add your trading account
            </h2>
            <div className="w-full space-y-6">
              <div className="bg-sidebar border border-white/10 rounded-lg p-6 shadow-sidebar-button">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Import via CSV
                </h3>
                <p className="text-white/60 text-sm mb-4">
                  Upload your trading history from your broker to get started
                  quickly.
                </p>
                <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center bg-sidebar/40">
                  <p className="text-white/40">
                    Drag and drop your CSV file here, or click to browse
                  </p>
                </div>
              </div>
              <div className="bg-sidebar border border-white/10 rounded-lg p-6 shadow-sidebar-button flex flex-col gap-5">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    MT5 EA Sync (Recommended)
                  </h3>
                  <p className="text-white/60 text-sm">
                    Real-time broker sync using the ProfitabEdge EA. Your
                    account will auto-register the first time the EA connects.
                  </p>
                </div>
                <Button
                  asChild
                  className="shadow-sidebar-button rounded-[6px] w-full h-max transition-all active:scale-95 bg-sidebar-accent hover:bg-sidebar-accent cursor-pointer text-white text-xs hover:!brightness-120 duration-250 flex py-2 items-center justify-center"
                >
                  <Link href="/dashboard/settings/ea-setup">Go to EA setup</Link>
                </Button>
              </div>
            </div>
            <div className="flex gap-4 w-full">
              <Button
                onClick={() => setCurrentStep(2)}
                className="shadow-sidebar-button rounded-[6px] gap-2.5 h-max transition-all active:scale-95 bg-sidebar-accent hover:bg-sidebar-accent cursor-pointer text-white flex-1 text-xs hover:!brightness-120 duration-250 flex py-2 items-center justify-center"
              >
                Back
              </Button>
              <Button
                onClick={() => setCurrentStep(4)}
                className="shadow-sidebar-button rounded-[6px] gap-2.5 h-max transition-all active:scale-95 bg-emerald-600 hover:bg-emerald-600 cursor-pointer text-white flex-1 text-xs hover:!brightness-105 duration-250 flex py-2 items-center justify-center"
              >
                Continue to Trading Rules
              </Button>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <TradingRulesStep onBack={() => setCurrentStep(3)} />
        )}
      </div>
    </div>
  );
}

function TradingRulesStep({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const presets = [
    {
      id: "conservative",
      name: "Conservative",
      icon: Shield,
      description: "Strict risk management, max 2% per trade, SL required",
      rules: {
        requireSL: true,
        requireTP: true,
        maxDailyTrades: 3,
        maxDailyLossPercent: 3,
        maxPositionSizePercent: 2,
        minPlannedRR: 1.5,
      },
    },
    {
      id: "balanced",
      name: "Balanced",
      icon: Target,
      description: "Moderate rules, max 5 daily trades, 5% daily loss limit",
      rules: {
        requireSL: true,
        maxDailyTrades: 5,
        maxDailyLossPercent: 5,
        maxPositionSizePercent: 3,
        minPlannedRR: 1,
      },
    },
    {
      id: "prop-firm",
      name: "Prop Firm Ready",
      icon: TrendingUp,
      description: "Rules aligned with typical prop firm challenges",
      rules: {
        requireSL: true,
        requireTP: true,
        maxDailyTrades: 5,
        maxDailyLossPercent: 4,
        maxPositionSizePercent: 1,
        minPlannedRR: 1.5,
        maxConcurrentTrades: 3,
      },
    },
    {
      id: "scalper",
      name: "Scalper",
      icon: Clock,
      description: "Higher trade count, tight risk per trade, fast execution",
      rules: {
        requireSL: true,
        maxDailyTrades: 15,
        maxDailyLossPercent: 3,
        maxPositionSizePercent: 1,
        maxEntrySpreadPips: 2,
        maxHoldSeconds: 1800,
      },
    },
  ];

  const handleComplete = async () => {
    setIsSubmitting(true);

    if (selectedPreset) {
      try {
        const preset = presets.find((p) => p.id === selectedPreset);
        if (preset) {
          await trpcClient.rules.createRuleSet.mutate({
            name: `${preset.name} Rules`,
            description: `Auto-created during onboarding: ${preset.description}`,
            rules: preset.rules,
          });
          toast.success("Trading rules created!");
        }
      } catch {
        // Non-blocking - user can still proceed
      }
    }

    try {
      try {
        await trpcClient.billing.syncFromPolar.mutate();
      } catch {
        // Best-effort reconciliation for local dev and webhook lag.
      }

      await trpcClient.billing.markOnboardingComplete.mutate();
    } catch {
      setIsSubmitting(false);
      toast.error("Unable to finish onboarding right now");
      return;
    }

    clearStoredOnboardingStep();
    setIsSubmitting(false);
    router.push("/dashboard");
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Set your trading rules</h2>
        <p className="text-white/50 text-sm mt-2">
          Choose a rule preset to get started. You can customize these later.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full">
        {presets.map((preset) => {
          const Icon = preset.icon;
          const isSelected = selectedPreset === preset.id;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => setSelectedPreset(isSelected ? null : preset.id)}
              className={`bg-sidebar border rounded-lg p-5 text-left transition-all hover:brightness-110 cursor-pointer ${
                isSelected
                  ? "border-emerald-500/50 ring-1 ring-emerald-500/20"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`flex items-center justify-center size-9 rounded-lg ${
                    isSelected
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-white/5 text-white/50"
                  }`}
                >
                  <Icon className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-white">
                    {preset.name}
                  </h3>
                </div>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">
                {preset.description}
              </p>
              {isSelected && (
                <div className="mt-3 pt-3 border-t border-white/5 space-y-1">
                  {Object.entries(preset.rules).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center gap-1.5 text-[10px] text-white/40"
                    >
                      <CheckCircle2 className="size-3 text-emerald-500/60" />
                      <span>
                        {key
                          .replace(/([A-Z])/g, " $1")
                          .replace(/^./, (s) => s.toUpperCase())}
                        : {String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 w-full">
        <Button
          onClick={onBack}
          className="shadow-sidebar-button rounded-[6px] gap-2.5 h-max transition-all active:scale-95 bg-sidebar-accent hover:bg-sidebar-accent cursor-pointer text-white flex-1 text-xs hover:!brightness-120 duration-250 flex py-2 items-center justify-center"
        >
          Back
        </Button>
        <Button
          onClick={handleComplete}
          disabled={isSubmitting}
          className="shadow-sidebar-button rounded-[6px] gap-2.5 h-max transition-all active:scale-95 bg-emerald-600 hover:bg-emerald-600 cursor-pointer text-white flex-1 text-xs hover:!brightness-105 duration-250 flex py-2 items-center justify-center"
        >
          {isSubmitting
            ? "Setting up..."
            : selectedPreset
            ? "Create Rules & Go to Dashboard"
            : "Skip & Go to Dashboard"}
        </Button>
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
