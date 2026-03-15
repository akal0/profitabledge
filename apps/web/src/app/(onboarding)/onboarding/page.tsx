"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import ChevronRight from "@/public/icons/chevron-right.svg";
import Plans from "./components/plans";
import Personal from "./components/personal";
import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ExternalLink, Plug, Cpu, Sparkles } from "lucide-react";
import { trpcClient, trpcOptions } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  clearStoredGrowthIntent,
  getStoredGrowthIntent,
} from "@/features/growth/lib/access-intent";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CsvUpload from "@/components/upload/CsvUpload";
import {
  TRADE_ACTION_BUTTON_CLASS,
  TRADE_ACTION_BUTTON_PRIMARY_CLASS,
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
  TRADE_SURFACE_CARD_CLASS,
} from "@/components/trades/trade-identifier-pill";
import {
  BROKER_OPTIONS,
  brokerSupportsMultiCsvImport,
  getBrokerSupplementalCsvReports,
  getBrokerImage,
  isDemoWorkspaceAccount,
} from "@/features/accounts/lib/account-metadata";
import { getCsvImportFeedbackMessage } from "@/features/accounts/lib/csv-import-feedback";
import { useAccountCatalog } from "@/features/accounts/hooks/use-account-catalog";

type OnboardingStep = 1 | 2 | 3;
type BillingPlanKey = "student" | "professional" | "institutional";
const LEGACY_ONBOARDING_STEP_STORAGE_KEY = "profitabledge-onboarding-step";
const CHECKOUT_SYNC_RETRY_DELAYS_MS = [0, 1500, 3000, 5000] as const;

function getOnboardingStepStorageKey(userId: string) {
  return `${LEGACY_ONBOARDING_STEP_STORAGE_KEY}:${userId}`;
}

function getStoredOnboardingStep(
  userId: string | null | undefined
): OnboardingStep | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!userId) {
    return null;
  }

  const raw = window.sessionStorage.getItem(
    getOnboardingStepStorageKey(userId)
  );
  return raw === "1" || raw === "2" || raw === "3"
    ? (Number(raw) as OnboardingStep)
    : null;
}

function storeOnboardingStep(
  userId: string | null | undefined,
  step: OnboardingStep
) {
  if (typeof window === "undefined") {
    return;
  }

  if (!userId) {
    return;
  }

  window.sessionStorage.setItem(
    getOnboardingStepStorageKey(userId),
    String(step)
  );
}

function clearStoredOnboardingStep(userId?: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(LEGACY_ONBOARDING_STEP_STORAGE_KEY);

  if (!userId) {
    return;
  }

  window.sessionStorage.removeItem(getOnboardingStepStorageKey(userId));
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
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
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
    (billingStateQuery.data?.billing.activePlanKey as
      | BillingPlanKey
      | undefined) ?? "student";
  const onboardingStorageUserId = session?.user.id ?? null;
  const accessLocked = Boolean(
    billingStateQuery.data?.access.privateBetaRequired &&
      !billingStateQuery.data.access.hasPrivateBetaAccess
  );
  const shouldSkipOnboarding = Boolean(
    billingStateQuery.data?.onboarding.isComplete && !accessLocked
  );
  const pendingStoredGrowthIntent = useMemo(() => {
    const storedIntent = getStoredGrowthIntent();
    return Boolean(
      storedIntent.betaCode ||
        storedIntent.referralCode ||
        storedIntent.affiliateCode
    );
  }, []);

  useEffect(() => {
    setSelectedPlanKey(activePlanKey);
  }, [activePlanKey]);

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
    const storedStep = getStoredOnboardingStep(onboardingStorageUserId);

    if (
      checkoutStatus === "success" &&
      (planParam === "professional" || planParam === "institutional")
    ) {
      setCurrentStep(3);
      return;
    }

    if (accessLocked && !pendingStoredGrowthIntent) {
      setCurrentStep(2);
      return;
    }

    if (activePlanKey !== "student") {
      setCurrentStep(3);
      return;
    }

    if (storedStep) {
      setCurrentStep(storedStep);
    }
  }, [
    accessLocked,
    activePlanKey,
    billingStateQuery.data,
    isSessionPending,
    onboardingStorageUserId,
    pendingStoredGrowthIntent,
    searchParams,
  ]);

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
            (refetched.data?.billing.activePlanKey as
              | BillingPlanKey
              | undefined) ?? (synced.activePlanKey as BillingPlanKey);

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
      clearStoredOnboardingStep(onboardingStorageUserId);
      router.replace("/dashboard");
    }
  }, [onboardingStorageUserId, router, shouldSkipOnboarding]);

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
  ];

  const handleLogout = async () => {
    clearStoredOnboardingStep(onboardingStorageUserId);
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
    <div className="flex h-screen w-full flex-col overflow-x-hidden bg-sidebar">
      <div className="flex flex-col">
        <div className="flex w-full flex-col gap-4 px-4 py-4 text-xs sm:px-6 lg:px-10 xl:px-25 xl:h-20 xl:flex-row xl:items-center xl:justify-between xl:gap-6">
          <p className="font-bold">profitabledge</p>

          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 xl:flex-1">
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
            className="ring ring-white/10 rounded-md gap-2.5 h-max transition-all active:scale-95 bg-sidebar dark:hover:bg-sidebar text-white w-max text-xs hover:!brightness-110 duration-250 flex py-2 items-center justify-center cursor-pointer self-start xl:self-auto"
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
            {/* <h1 className="font-bold tracking-wide uppercase"> Profitabledge </h1> */}

            <div className="grid w-full gap-3 md:grid-cols-3 md:gap-4">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className="flex min-w-0 flex-col gap-3 md:gap-4"
                >
                  <p
                    className={`text-center text-xs font-medium md:text-left ${
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
                          step.status === "completed" ||
                          step.status === "current"
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
          {currentStep === 1 && <Personal onNext={() => setCurrentStep(2)} />}

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
                          Redeem your invite code to unlock plan selection and
                          the rest of onboarding.
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
            </div>
          )}

          {currentStep === 3 && <AddAccountStep />}
        </div>
      </div>
    </div>
  );
}

type AddAccountForm = {
  method: "csv" | "broker" | "ea" | null;
  name: string;
  broker: string;
  initialCurrency: "$" | "£" | "€" | "";
  initialBalance: string;
  files: File[];
};

type PendingCsvImportResolution = {
  matchedAccount: {
    id: string;
    name: string;
    broker: string;
    accountNumber: string | null;
  };
  warnings: string[];
};

function AddAccountStep() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountStep, setAccountStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<AddAccountForm>({
    method: null,
    name: "",
    broker: "",
    initialCurrency: "$",
    initialBalance: "",
    files: [],
  });
  const [pendingCsvImportResolution, setPendingCsvImportResolution] =
    useState<PendingCsvImportResolution | null>(null);
  const [hasPreparedDashboardExit, setHasPreparedDashboardExit] = useState(false);
  const onboardingStorageUserId = session?.user.id ?? null;
  const { accounts } = useAccountCatalog();
  const hasAccount = accounts.length > 0;
  const accountsQueryKey = trpcOptions.accounts.list.queryOptions().queryKey;
  const canContinueToDashboard =
    hasAccount ||
    hasPreparedDashboardExit ||
    (accountStep === 2 && (form.method === "broker" || form.method === "ea"));

  const demoAccounts = useMemo(
    () => accounts.filter((account) => isDemoWorkspaceAccount(account)),
    [accounts]
  );

  const canSubmitCsv = useMemo(() => {
    if (form.method === "csv") {
      return Boolean(form.files.length > 0 && form.name && form.broker);
    }
    return false;
  }, [form]);

  const selectedBrokerSupportsMultiCsv = useMemo(
    () => brokerSupportsMultiCsvImport(form.broker),
    [form.broker]
  );
  const canQueueMultipleCsvFiles = useMemo(
    () => !form.broker || selectedBrokerSupportsMultiCsv,
    [form.broker, selectedBrokerSupportsMultiCsv]
  );
  const selectedBrokerSupplementalReports = useMemo(
    () => getBrokerSupplementalCsvReports(form.broker),
    [form.broker]
  );

  useEffect(() => {
    if (pendingCsvImportResolution && form.broker !== "tradovate") {
      setPendingCsvImportResolution(null);
    }
  }, [form.broker, pendingCsvImportResolution]);

  useEffect(() => {
    if (hasAccount) {
      setHasPreparedDashboardExit(true);
    }
  }, [hasAccount]);

  function resetAccountForm() {
    setAccountStep(1);
    setForm({
      method: null,
      name: "",
      broker: "",
      initialCurrency: "$",
      initialBalance: "",
      files: [],
    });
    setPendingCsvImportResolution(null);
  }

  async function fileToBase64(file: File): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1] || "";
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleSubmitCSV(input?: {
    existingAccountAction?: "enrich" | "create_duplicate";
    existingAccountId?: string;
  }) {
    if (!canSubmitCsv || form.files.length === 0) return;
    setIsSubmitting(true);

    try {
      const normalizeBalance = (input: string): number | undefined => {
        const cleaned = String(input || "").replace(/[^0-9.\-]/g, "");
        if (!cleaned) return undefined;
        const n = Number(cleaned);
        return Number.isFinite(n) && n >= 0 ? n : undefined;
      };

      const encodedFiles = await Promise.all(
        form.files.map(async (file) => ({
          fileName: file.name,
          csvBase64: await fileToBase64(file),
        }))
      );

      const res = await trpcClient.upload.importCsv.mutate({
        name: form.name,
        broker: form.broker,
        initialBalance: normalizeBalance(form.initialBalance),
        initialCurrency: (form.initialCurrency || "$") as "$" | "£" | "€",
        csvBase64: encodedFiles[0]?.csvBase64 ?? "",
        fileName: encodedFiles[0]?.fileName,
        files: encodedFiles,
        existingAccountAction: input?.existingAccountAction,
        existingAccountId: input?.existingAccountId,
      });

      if (res.status === "requires_account_resolution") {
        setPendingCsvImportResolution({
          matchedAccount: res.matchedExistingAccount,
          warnings: res.warnings,
        });
        setIsSubmitting(false);
        return;
      }

      setPendingCsvImportResolution(null);

      if (res.status === "enriched_existing") {
        toast.success(
          getCsvImportFeedbackMessage(res, {
            accountName: res.matchedExistingAccount.name,
          })
        );
      } else {
        toast.success("Account created from CSV import");
      }

      setHasPreparedDashboardExit(true);
      await queryClient.invalidateQueries({ queryKey: accountsQueryKey });
      resetAccountForm();
    } catch (e) {
      console.error(e);
      toast.error("Failed to import CSV");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDemoWorkspace() {
    try {
      setIsSubmitting(true);
      const result = (await (demoAccounts.length > 0
        ? trpcClient.accounts.resetDemoWorkspace.mutate()
        : trpcClient.accounts.createSampleAccount.mutate())) as {
        tradeCount: number;
        openTradeCount: number;
        resetCount?: number;
        account?: { id: string; name: string; broker?: string | null };
      };

      toast.success(
        demoAccounts.length > 0
          ? `Demo workspace regenerated with ${result.tradeCount} trades and ${result.openTradeCount} live positions.`
          : `Demo account created with ${result.tradeCount} trades and ${result.openTradeCount} live positions.`
      );

      setHasPreparedDashboardExit(true);
      await queryClient.invalidateQueries({ queryKey: accountsQueryKey });
      setIsSubmitting(false);
    } catch (e: any) {
      toast.error(
        e.message ||
          (demoAccounts.length > 0
            ? "Failed to regenerate demo workspace"
            : "Failed to create demo account")
      );
      setIsSubmitting(false);
    }
  }

  const handleComplete = async () => {
    setIsSubmitting(true);

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

    clearStoredOnboardingStep(onboardingStorageUserId);
    setIsSubmitting(false);
    router.push("/dashboard");
  };

  const sectionTitleClass = "text-xs font-semibold text-white/70 tracking-wide";
  const fieldLabelClass = "text-xs text-white/50";
  const fieldInputClass =
    "rounded-sm ring-1 ring-white/8 bg-white/[0.03] px-4 text-xs text-white/80  placeholder:text-white/25 hover:brightness-100 border-none!";
  const fieldSelectTriggerClass =
    "h-9 w-full px-4 cursor-pointer bg-transparent! hover:bg-sidebar-accent! transition duration-250 text-xs ring-white/8!";
  const fieldSelectContentClass = "mt-11 w-full";
  const fieldSelectItemClass = "whitespace-normal cursor-pointer";

  return (
    <div className="flex h-full w-full max-w-2xl flex-col">
      <div className="rounded-sm overflow-hidden ring-1 ring-white/8 bg-sidebar">
        {/* Header */}
        <div className="px-6 py-5">
          <div className="flex w-full items-end justify-between gap-4">
            <div className="flex flex-col items-start gap-1">
              <h2 className="text-base font-semibold text-white">
                {accountStep === 1
                  ? "Connect your account"
                  : form.method === "csv"
                  ? "Import account with CSV upload"
                  : form.method === "broker"
                  ? "Broker sync"
                  : "EA sync"}
              </h2>
              <p className="max-w-md text-xs leading-relaxed text-white/40">
                {accountStep === 1
                  ? "Choose how you want to add your trading account."
                  : form.method === "csv"
                  ? "Upload your CSV file or broker report bundle and enter the details for this trading account."
                  : form.method === "broker"
                  ? "Use Connections to sync supported broker and platform accounts directly."
                  : "Use the MT5 EA bridge for terminal-based sync and richer trade analytics."}
              </p>
            </div>
            {hasAccount && (
              <span
                className={cn(
                  TRADE_IDENTIFIER_PILL_CLASS,
                  TRADE_IDENTIFIER_TONES.positive,
                  "min-h-6 px-2 py-0.5 text-[10px]"
                )}
              >
                Account added
              </span>
            )}
          </div>
        </div>

        {accountStep === 1 && (
          <>
            <Separator />
            <div className="px-6 py-3">
              <h3 className={sectionTitleClass}>Connection method</h3>
            </div>
            <Separator />
            <div className="px-6 py-5">
              <div className="grid gap-3">
                <Button
                  className={cn(
                    TRADE_SURFACE_CARD_CLASS,
                    "h-auto w-full justify-between rounded-sm px-4 py-4 text-left hover:bg-white/[0.05]"
                  )}
                  onClick={() => {
                    setForm({ ...form, method: "csv" });
                    setAccountStep(2);
                  }}
                >
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-sm font-medium text-white">
                      Import account via CSV
                    </span>
                    <span className="text-xs text-white/45">
                      Upload a statement export and create a new account from
                      it.
                    </span>
                  </div>
                  <span className="text-white/35">&rarr;</span>
                </Button>

                <Button
                  className={cn(
                    TRADE_SURFACE_CARD_CLASS,
                    "h-auto w-full justify-between rounded-sm px-4 py-4 text-left hover:bg-white/[0.05]"
                  )}
                  onClick={() => {
                    setForm({ ...form, method: "broker" });
                    setAccountStep(2);
                  }}
                >
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-sm font-medium text-white">
                      Broker sync
                    </span>
                    <span className="text-xs text-white/45">
                      Connect through the Connections page for direct broker and
                      platform sync.
                    </span>
                  </div>
                  <span
                    className={cn(
                      TRADE_IDENTIFIER_PILL_CLASS,
                      TRADE_IDENTIFIER_TONES.info,
                      "min-h-6 px-2 py-0.5 text-[10px]"
                    )}
                  >
                    Recommended
                  </span>
                </Button>

                <Button
                  className={cn(
                    TRADE_SURFACE_CARD_CLASS,
                    "h-auto w-full justify-between rounded-sm px-4 py-4 text-left hover:bg-white/[0.05]"
                  )}
                  onClick={() => {
                    setForm({ ...form, method: "ea" });
                    setAccountStep(2);
                  }}
                >
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-sm font-medium text-white">
                      EA sync
                    </span>
                    <span className="text-xs text-white/45">
                      Use the MT5 EA bridge for terminal-side sync and advanced
                      intratrade metrics.
                    </span>
                  </div>
                  <span
                    className={cn(
                      TRADE_IDENTIFIER_PILL_CLASS,
                      TRADE_IDENTIFIER_TONES.live,
                      "min-h-6 px-2 py-0.5 text-[10px]"
                    )}
                  >
                    MT5 only
                  </span>
                </Button>
              </div>
            </div>

            <Separator />
            <div className="px-6 py-3">
              <h3 className={sectionTitleClass}>Demo workspace</h3>
            </div>
            <Separator />
            <div className="px-6 py-5">
              <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-4 p-4")}>
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 size-4 text-amber-300" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-white">
                      Explore with demo data
                    </p>
                    <p className="text-xs leading-relaxed text-white/45">
                      {demoAccounts.length > 0
                        ? `Replace ${
                            demoAccounts.length
                          } seeded demo workspace${
                            demoAccounts.length === 1 ? "" : "s"
                          } with a fresh fully-populated trading environment.`
                        : "Create a fully-seeded demo account with historical trades and live positions."}
                    </p>
                  </div>
                </div>
                <Button
                  className={cn(
                    TRADE_ACTION_BUTTON_PRIMARY_CLASS,
                    "h-9 w-full ring-1 ring-amber-400/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15"
                  )}
                  onClick={handleDemoWorkspace}
                  disabled={isSubmitting}
                >
                  <Sparkles className="size-3.5" />
                  {isSubmitting
                    ? demoAccounts.length > 0
                      ? "Regenerating..."
                      : "Creating..."
                    : demoAccounts.length > 0
                    ? "Regenerate demo workspace"
                    : "Try with demo data"}
                </Button>
              </div>
            </div>
          </>
        )}

        {accountStep === 2 && form.method === "csv" && (
          <>
            <Separator />
            <div className="px-6 py-3">
              <h3 className={sectionTitleClass}>Account details</h3>
            </div>
            <Separator />
            <div className="px-6 py-5">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label className={fieldLabelClass}>Account name</Label>
                  <Input
                    placeholder="e.g. FTMO 100k Live"
                    className={fieldInputClass}
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label className={fieldLabelClass}>Broker</Label>
                  <Select
                    value={form.broker}
                    onValueChange={(v) => {
                      setPendingCsvImportResolution(null);
                      setForm((f) => ({
                        ...f,
                        broker: v,
                        files: brokerSupportsMultiCsvImport(v)
                          ? f.files
                          : f.files.slice(0, 1),
                      }));
                    }}
                  >
                    <SelectTrigger className={fieldSelectTriggerClass}>
                      <SelectValue placeholder="Select a broker" />
                    </SelectTrigger>
                    <SelectContent className={fieldSelectContentClass}>
                      {BROKER_OPTIONS.map((b) => (
                        <SelectItem
                          key={b.value}
                          value={b.value}
                          className={fieldSelectItemClass}
                        >
                          <div className="flex items-center gap-2.5">
                            <img
                              src={b.image}
                              alt={b.label}
                              className="h-4 w-4 object-contain"
                            />
                            {b.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.broker === "tradovate" ? (
                    <p className="text-xs leading-relaxed text-white/40">
                      Tradovate CSV import currently supports bundle uploads.
                      Start with{" "}
                      <span className="text-white/65">Performance</span> or{" "}
                      <span className="text-white/65">Position History</span> as
                      the base report, then add{" "}
                      <span className="text-white/65">
                        {selectedBrokerSupplementalReports
                          .filter(
                            (report) =>
                              report !== "Performance" &&
                              report !== "Position History"
                          )
                          .join(", ")}
                      </span>{" "}
                      in the same import for richer metadata.
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label className={fieldLabelClass}>
                    Initial account balance
                  </Label>
                  <div className="flex items-center gap-0">
                    <Select
                      value={form.initialCurrency}
                      onValueChange={(v: "$" | "£" | "€") =>
                        setForm((f) => ({ ...f, initialCurrency: v }))
                      }
                    >
                      <SelectTrigger
                        className={cn(
                          fieldSelectTriggerClass,
                          "w-18 rounded-r-none border-none! ring ring-white/10"
                        )}
                        style={{ borderRightWidth: 0 }}
                      >
                        <SelectValue placeholder="$" />
                      </SelectTrigger>
                      <SelectContent className={fieldSelectContentClass}>
                        {(["$", "£", "€"] as const).map((c) => (
                          <SelectItem
                            key={c}
                            value={c}
                            className={fieldSelectItemClass}
                          >
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="$100,000"
                      className={cn(fieldInputClass, "flex-1 rounded-l-none")}
                      style={{ borderLeftWidth: 0 }}
                      value={form.initialBalance}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          initialBalance: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />
            <div className="px-6 py-3">
              <h3 className={sectionTitleClass}>Upload CSV</h3>
            </div>
            <Separator />
            <div className="px-6 py-5">
              <CsvUpload
                multiple={canQueueMultipleCsvFiles}
                onFilesChange={(files) => {
                  setPendingCsvImportResolution(null);
                  setForm((prev) => ({ ...prev, files }));
                }}
              />
              {!form.broker ? (
                <p className="mt-3 text-xs leading-relaxed text-white/40">
                  You can queue multiple CSVs before choosing a broker. If you
                  later pick a broker that does not support bundle imports, only
                  the first file will be kept.
                </p>
              ) : null}
            </div>

            <Separator />
            <div className="px-6 py-5">
              {pendingCsvImportResolution ? (
                <div className="mb-4 rounded-sm ring-1 ring-amber-400/20 bg-amber-400/5 p-4">
                  <p className="text-sm font-medium text-white">
                    This Tradovate CSV bundle matches an existing imported
                    account.
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-white/55">
                    Matched account:{" "}
                    <span className="text-white/80">
                      {pendingCsvImportResolution.matchedAccount.name}
                    </span>
                    {pendingCsvImportResolution.matchedAccount.accountNumber
                      ? ` (${pendingCsvImportResolution.matchedAccount.accountNumber})`
                      : ""}
                    . Choose whether to enrich that account or create a new
                    duplicate account intentionally.
                  </p>
                  {pendingCsvImportResolution.warnings.length > 0 ? (
                    <p className="mt-2 text-xs leading-relaxed text-white/40">
                      {pendingCsvImportResolution.warnings[0]}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className={cn(
                        TRADE_ACTION_BUTTON_PRIMARY_CLASS,
                        "h-8 px-3"
                      )}
                      disabled={isSubmitting}
                      onClick={() =>
                        handleSubmitCSV({
                          existingAccountAction: "enrich",
                          existingAccountId:
                            pendingCsvImportResolution.matchedAccount.id,
                        })
                      }
                    >
                      Enrich existing account
                    </Button>
                    <Button
                      type="button"
                      className={cn(TRADE_ACTION_BUTTON_CLASS, "h-8 px-3")}
                      disabled={isSubmitting}
                      onClick={() =>
                        handleSubmitCSV({
                          existingAccountAction: "create_duplicate",
                          existingAccountId:
                            pendingCsvImportResolution.matchedAccount.id,
                        })
                      }
                    >
                      Create duplicate account
                    </Button>
                  </div>
                </div>
              ) : null}
              <div className="flex w-full gap-2">
                <Button
                  className={cn(TRADE_ACTION_BUTTON_CLASS, "h-9 flex-1")}
                  onClick={resetAccountForm}
                >
                  Back
                </Button>

                <Button
                  className={cn(
                    TRADE_ACTION_BUTTON_PRIMARY_CLASS,
                    "h-9 flex-1",
                    !canSubmitCsv && "opacity-60"
                  )}
                  disabled={!canSubmitCsv || isSubmitting}
                  onClick={() => handleSubmitCSV()}
                >
                  {isSubmitting ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </div>
          </>
        )}

        {accountStep === 2 && form.method === "broker" && (
          <>
            <Separator />
            <div className="px-6 py-3">
              <h3 className={sectionTitleClass}>Connections</h3>
            </div>
            <Separator />
            <div className="px-6 py-5">
              <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-4 p-4")}>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Plug className="size-4 text-blue-300" />
                      <p className="text-sm font-medium text-white">
                        Direct platform sync
                      </p>
                    </div>
                    <p className="text-xs leading-relaxed text-white/45">
                      Connect MetaTrader 5, cTrader, Match-Trader, or
                      TradeLocker from the Connections page. ProfitEdge handles
                      the sync workflow from there.
                    </p>
                  </div>
                  <span
                    className={cn(
                      TRADE_IDENTIFIER_PILL_CLASS,
                      TRADE_IDENTIFIER_TONES.info,
                      "min-h-6 px-2 py-0.5 text-[10px]"
                    )}
                  >
                    Recommended
                  </span>
                </div>

                <Button
                  asChild
                  className={cn(
                    TRADE_ACTION_BUTTON_PRIMARY_CLASS,
                    "h-9 w-full"
                  )}
                >
                  <Link href="/dashboard/settings/connections">
                    <ExternalLink className="size-3.5" />
                    Go to Connections
                  </Link>
                </Button>
              </div>
            </div>

            <Separator />
            <div className="px-6 py-3">
              <h3 className={sectionTitleClass}>What to expect</h3>
            </div>
            <Separator />
            <div className="px-6 py-5">
              <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-3 p-4")}>
                <ol className="space-y-2 text-sm text-white/70">
                  <li>1. Open Connections.</li>
                  <li>2. Choose the provider you want to link.</li>
                  <li>
                    3. Complete the connection and let sync create or link the
                    account.
                  </li>
                </ol>
                <p className="text-xs leading-relaxed text-white/40">
                  Use this flow for supported direct platform and broker sync.
                  It is the main path for non-EA account connections.
                </p>
              </div>
            </div>

            <Separator />
            <div className="px-6 py-5">
              <Button
                className={cn(TRADE_ACTION_BUTTON_CLASS, "h-9 w-full")}
                onClick={resetAccountForm}
              >
                Back
              </Button>
            </div>
          </>
        )}

        {accountStep === 2 && form.method === "ea" && (
          <>
            <Separator />
            <div className="px-6 py-3">
              <h3 className={sectionTitleClass}>MT5 EA bridge</h3>
            </div>
            <Separator />
            <div className="px-6 py-5">
              <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-4 p-4")}>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Cpu className="size-4 text-teal-300" />
                      <p className="text-sm font-medium text-white">
                        Terminal-side MT5 sync
                      </p>
                    </div>
                    <p className="text-xs leading-relaxed text-white/45">
                      Use the EA bridge when you want MT5 terminal sync plus the
                      advanced intratrade metrics the API path cannot capture.
                    </p>
                  </div>
                  <span
                    className={cn(
                      TRADE_IDENTIFIER_PILL_CLASS,
                      TRADE_IDENTIFIER_TONES.live,
                      "min-h-6 px-2 py-0.5 text-[10px]"
                    )}
                  >
                    MT5 only
                  </span>
                </div>

                <Button
                  asChild
                  className={cn(
                    TRADE_ACTION_BUTTON_PRIMARY_CLASS,
                    "h-9 w-full"
                  )}
                >
                  <Link href="/dashboard/settings/ea-setup">
                    <ExternalLink className="size-3.5" />
                    Go to EA Setup
                  </Link>
                </Button>
              </div>
            </div>

            <Separator />
            <div className="px-6 py-3">
              <h3 className={sectionTitleClass}>What to expect</h3>
            </div>
            <Separator />
            <div className="px-6 py-5">
              <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-3 p-4")}>
                <ol className="space-y-2 text-sm text-white/70">
                  <li>1. Open EA Setup.</li>
                  <li>2. Generate the key and install the EA in MT5.</li>
                  <li>
                    3. Attach the EA and let the first sync register the
                    account.
                  </li>
                </ol>
                <p className="text-xs leading-relaxed text-white/40">
                  Use this flow when you specifically want MT5 terminal-side
                  sync and the richer analytics captured by the EA bridge.
                </p>
              </div>
            </div>

            <Separator />
            <div className="px-6 py-5">
              <Button
                className={cn(TRADE_ACTION_BUTTON_CLASS, "h-9 w-full")}
                onClick={resetAccountForm}
              >
                Back
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Navigation button */}
      <div className="flex w-full mt-6">
        <Button
          onClick={handleComplete}
          disabled={!canContinueToDashboard || isSubmitting}
          className={cn(
            TRADE_ACTION_BUTTON_PRIMARY_CLASS,
            "h-9 w-full",
            canContinueToDashboard
              ? "!ring-emerald-600/90 !bg-emerald-600/72 !text-white hover:!bg-emerald-500/80"
              : "opacity-50"
          )}
        >
          {isSubmitting
            ? "Setting up..."
            : canContinueToDashboard
            ? "Go to dashboard"
            : "Add an account to continue"}
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
