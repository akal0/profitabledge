"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BadgePercent,
  Check,
  ExternalLink,
  RefreshCw,
  Shield,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CancelFlow } from "@/components/cancel-flow";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { Separator } from "@/components/ui/separator";
import { UsageMeter } from "@/components/usage-meter";
import { InvoiceHistoryTable } from "@/features/settings/billing/components/invoice-history-table";
import {
  formatLiveSyncSlots,
  getPlanFeatureLines,
} from "@/features/settings/billing/lib/plan-copy";
import { trpcClient, trpcOptions } from "@/utils/trpc";
import CircleCheck from "@/public/icons/circle-check.svg";

type BillingPlanKey = "student" | "professional" | "institutional";
type BillingInterval = "monthly" | "annual";
type BillingPageState = {
  activePlanKey: BillingPlanKey;
  customer?: {
    stripeCustomerId?: string | null;
  } | null;
  subscription?: {
    provider?: string | null;
    status?: string | null;
    recurringInterval?: string | null;
    stripeSubscriptionId?: string | null;
    pauseStatus?: string | null;
    pauseResumesAt?: string | Date | null;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: string | Date | null;
  } | null;
  override?: unknown;
  credits?: {
    remainingCredits: number;
    allowanceCredits: number;
    spentCredits: number;
    lowCreditWarningThreshold?: number;
  } | null;
};

type StaffAccessOverrideRow = {
  id: string;
  planKey: BillingPlanKey;
  metadata?: {
    presetKey?: string | null;
    reason?: string | null;
    grantedByEmail?: string | null;
  } | null;
  startsAt: string | Date;
  endsAt: string | Date;
  userId: string;
  email: string;
  username: string | null;
  name: string;
  role: string | null;
};

type StaffAccessCandidate = {
  id: string;
  email: string;
  username: string | null;
  name: string;
  displayName: string | null;
  role: string | null;
};

const STAFF_ACCESS_PRESETS = [
  { key: "ambassador", label: "Ambassador year", durationDays: 365 },
  { key: "partner", label: "Partner year", durationDays: 365 },
  { key: "launch", label: "Launch month", durationDays: 30 },
  { key: "lifetime", label: "Lifetime", durationDays: 3650 },
  { key: "manual", label: "Custom days", durationDays: null },
] as const;

type ResolvedAffiliateProfile = {
  name: string;
  username: string | null;
  image: string | null;
  defaultOfferCode?: string | null;
};

const AFFILIATE_CODE_TOAST_ID = "billing-affiliate-code-status";
const STAFF_ACCESS_SEARCH_DEBOUNCE_MS = 200;

const PLAN_CARD_META: Record<
  BillingPlanKey,
  { imageSrc: string; badgeClassName: string }
> = {
  student: {
    imageSrc: "/plans/explorer.png",
    badgeClassName: "bg-sidebar text-sidebar",
  },
  professional: {
    imageSrc: "/plans/trader.png",
    badgeClassName: "ring ring-blue-500/20 bg-blue-500/10 text-blue-300",
  },
  institutional: {
    imageSrc: "/plans/institutional.png",
    badgeClassName: "ring ring-emerald-500/20 bg-emerald-500/10 text-white",
  },
};

const BILLING_PLAN_TIER: Record<BillingPlanKey, number> = {
  student: 0,
  professional: 1,
  institutional: 2,
};

function splitPriceLabel(priceLabel: string) {
  if (priceLabel.toLowerCase() === "free")
    return { amount: "Free", interval: null };
  const [amount, interval] = priceLabel.split(" / ");
  return { amount, interval: interval ? `/ ${interval}` : null };
}

function segmentedBillingToggleButtonClassName(active: boolean) {
  return cn(
    "min-w-[96px] cursor-pointer rounded-full px-4 py-2 text-sm transition-colors",
    active
      ? "bg-white text-black"
      : "text-white/60 hover:text-white"
  );
}

function getDisplayedPricing(plan: any, billingInterval: BillingInterval) {
  if (plan?.isFree) {
    return {
      amount: "Free",
      interval: null,
      detail: null,
      savings: null,
    };
  }

  const annualPricing = plan?.pricing?.annual;
  if (billingInterval === "annual" && annualPricing?.isConfigured) {
    return {
      amount: `£${(annualPricing.priceCents / 100).toFixed(0)}`,
      interval: "/ year",
      detail:
        annualPricing.monthlyEquivalentCents != null
          ? `£${(annualPricing.monthlyEquivalentCents / 100).toFixed(
              0
            )}/mo billed annually`
          : null,
      savings:
        typeof annualPricing.discountPercent === "number"
          ? `Save ${annualPricing.discountPercent}%`
          : null,
    };
  }

  const fallback = splitPriceLabel(plan?.priceLabel ?? "Free");
  return {
    amount: fallback.amount,
    interval: fallback.interval,
    detail: null,
    savings: null,
  };
}

function formatDate(value?: string | Date | null) {
  if (!value) return "N/A";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatEdgeCredits(credits: number) {
  return `${new Intl.NumberFormat("en-US").format(credits)} / mo`;
}

function formatEdgeCreditBalance(
  remainingCredits: number,
  allowanceCredits: number
) {
  return `${new Intl.NumberFormat("en-US").format(
    remainingCredits
  )} / ${new Intl.NumberFormat("en-US").format(allowanceCredits)}`;
}

function getStaffAccessCandidateIdentifier(candidate: StaffAccessCandidate) {
  return candidate.username ? `@${candidate.username}` : candidate.email;
}

function getStaffAccessCandidateLabel(candidate: StaffAccessCandidate) {
  const displayName = candidate.displayName?.trim();
  return displayName || candidate.name || candidate.email;
}

function getPlanComparisonRows(plan: {
  accountAllowanceLabel: string;
  includedAiCredits: number;
  includedLiveSyncSlots: number;
  includesPropTracker: boolean;
}) {
  return [
    {
      label: "Accounts",
      value: plan.accountAllowanceLabel,
      tone: "default" as const,
    },
    {
      label: "Edge credits",
      value: formatEdgeCredits(plan.includedAiCredits),
      tone: "default" as const,
    },
    {
      label: "Live sync",
      value: formatLiveSyncSlots(plan.includedLiveSyncSlots),
      tone: "default" as const,
    },
    {
      label: "Prop tracker",
      value: plan.includesPropTracker ? "Included" : "Not included",
      tone: plan.includesPropTracker
        ? ("positive" as const)
        : ("muted" as const),
    },
  ];
}

// prop-tracker card shell
function CardShell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group flex flex-col rounded-sm ring ring-white/5 bg-sidebar p-1.5",
        className
      )}
    >
      <div className="flex flex-1 flex-col rounded-sm bg-sidebar-accent transition-all duration-250">
        {children}
      </div>

      <Separator />
      <InvoiceHistoryTable />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-medium tracking-[-0.04em] text-white/35">
      {children}
    </p>
  );
}

function WalletHero({
  planTitle,
  priceLabel,
  remainingEdgeCredits,
  allowanceEdgeCredits,
  subscriptionStatus,
  currentPeriodEnd,
}: {
  planTitle: string;
  priceLabel: string;
  remainingEdgeCredits: number;
  allowanceEdgeCredits: number;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: string | Date | null;
}) {
  const renewalLabel = currentPeriodEnd
    ? formatDate(currentPeriodEnd)
    : priceLabel;
  const edgeCreditsLabel = formatEdgeCreditBalance(
    remainingEdgeCredits,
    allowanceEdgeCredits
  );
  const statusLabel = subscriptionStatus
    ? subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1)
    : "Plan ready";

  return (
    <div className="relative w-full overflow-hidden rounded-[30px] bg-[#050505] ring ring-white/5 shadow-[0_24px_32px_rgba(0,0,0,0.15)]">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-no-repeat opacity-45"
        style={{
          backgroundImage: "url('/landing/hero-background.svg')",
          backgroundPosition: "86% 4%",
        }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,5,0.18),rgba(5,5,5,0.52)_42%,rgba(5,5,5,0.82)_100%)]" />
      <div className="absolute inset-[10px] rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] ring ring-white/8" />

      <div className="relative z-10 flex flex-col p-6 sm:p-7">
        <Badge className="h-7 w-fit rounded-sm bg-white/8 px-2.5 text-[11px] text-white/72 ring ring-white/10">
          {statusLabel}
        </Badge>

        <div className="mt-auto flex items-center justify-between gap-3 pt-8 px-0.5">
          <div>
            <p className="text-[10px] text-white/30">Edge credits</p>
            <p className="mt-1 text-sm font-semibold tracking-[-0.03em] text-white/78">
              {edgeCreditsLabel}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-white/30">Renews</p>
            <p className="mt-1 text-sm font-semibold tracking-[-0.03em] text-white/78">
              {renewalLabel}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-white/30">Current plan</p>
            <p className="mt-1 text-sm font-semibold tracking-[-0.03em] text-white/78">
              {planTitle}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BillingSettingsPage() {
  const searchParams = useSearchParams();
  const hasTriggeredStripeReturnSyncRef = useRef(false);
  const [hoveredCard, setHoveredCard] = useState<BillingPlanKey | null>(null);
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("annual");
  const [cancelFlowOpen, setCancelFlowOpen] = useState(false);

  const billingStateQuery = useQuery(
    trpcOptions.billing.getState.queryOptions()
  );
  const billingConfigQuery = useQuery(
    trpcOptions.billing.getPublicConfig.queryOptions()
  );

  const syncBillingState = useMutation({
    ...trpcOptions.billing.syncBillingState.mutationOptions(),
    onSuccess: () => {
      void billingStateQuery.refetch();
      toast.success("Billing synced");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    },
  });
  const createCheckout = useMutation<any, unknown, any>({
    mutationFn: (input) =>
      (trpcClient.billing as any).createCheckout.mutate(input),
  });
  const createCustomerPortalSession = useMutation(
    trpcOptions.billing.createCustomerPortalSession.mutationOptions()
  );
  const [affiliateOfferCode, setAffiliateOfferCode] = useState("");
  const [affiliateDialogOpen, setAffiliateDialogOpen] = useState(false);
  const [affiliateCodeInput, setAffiliateCodeInput] = useState("");
  const [affiliateCodeResolved, setAffiliateCodeResolved] = useState(false);
  const [resolvedAffiliate, setResolvedAffiliate] =
    useState<ResolvedAffiliateProfile | null>(null);
  const [appliedAffiliate, setAppliedAffiliate] =
    useState<ResolvedAffiliateProfile | null>(null);
  const [staffAccessIdentifier, setStaffAccessIdentifier] = useState("");
  const [staffAccessSearchTerm, setStaffAccessSearchTerm] = useState("");
  const [staffAccessPlanKey, setStaffAccessPlanKey] =
    useState<Extract<BillingPlanKey, "professional" | "institutional">>(
      "professional"
    );
  const [staffAccessPresetKey, setStaffAccessPresetKey] =
    useState<(typeof STAFF_ACCESS_PRESETS)[number]["key"]>("ambassador");
  const [staffAccessDurationDays, setStaffAccessDurationDays] = useState("365");
  const [staffAccessReason, setStaffAccessReason] = useState("");
  const resolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staffAccessSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const latestAffiliateCodeRequestRef = useRef<string | null>(null);
  const plans = billingConfigQuery.data?.plans ?? [];
  const billingData = billingStateQuery.data?.billing as
    | BillingPageState
    | undefined;
  const activePlanKey = billingData?.activePlanKey ?? "student";
  const activePlan =
    plans.find((plan) => plan.key === activePlanKey) ?? plans[0] ?? null;
  const access = billingStateQuery.data?.access;
  const isAdmin = Boolean(billingStateQuery.data?.admin?.isAdmin);
  const subscription = billingData?.subscription;
  const creditState = billingData?.credits;
  const staffOverridesQuery = useQuery({
    ...trpcOptions.billing.listStaffAccessOverrides.queryOptions(),
    enabled: isAdmin,
  });
  const staffAccessCandidatesQuery = useQuery({
    queryKey: ["billing", "staff-access-candidates", staffAccessSearchTerm],
    queryFn: async () => {
      const results = await (trpcClient.billing as any).searchStaffAccessCandidates.query(
        {
          query: staffAccessSearchTerm,
        }
      );

      return (results ?? []) as StaffAccessCandidate[];
    },
    enabled: isAdmin && staffAccessSearchTerm.length > 0,
    staleTime: 30_000,
  });
  const canManageSubscription = Boolean(
    billingData?.customer?.stripeCustomerId &&
      billingData?.subscription?.provider === "stripe"
  );
  const currentBillingInterval: BillingInterval =
    subscription?.recurringInterval === "year" ? "annual" : "monthly";
  const cancellationScheduled = Boolean(subscription?.cancelAtPeriodEnd);
  const canMoveToFreeTier =
    activePlanKey !== "student" &&
    canManageSubscription &&
    !cancellationScheduled;
  const returnedFromStripeCheckout =
    searchParams?.get("checkout") === "success";
  const normalizedStaffAccessIdentifier = staffAccessIdentifier.trim().toLowerCase();
  const staffAccessCandidates = staffAccessCandidatesQuery.data ?? [];
  const hasExactStaffAccessCandidateMatch = staffAccessCandidates.some(
    (candidate) => {
      const candidateIdentifier = getStaffAccessCandidateIdentifier(candidate);
      return candidateIdentifier.toLowerCase() === normalizedStaffAccessIdentifier;
    }
  );
  const shouldShowStaffAccessSuggestions =
    staffAccessIdentifier.trim().length > 0 && !hasExactStaffAccessCandidateMatch;

  useEffect(() => {
    const configuredDefaultInterval = billingConfigQuery.data
      ?.defaultBillingInterval as BillingInterval | undefined;
    if (configuredDefaultInterval) {
      setBillingInterval(configuredDefaultInterval);
    }
  }, [billingConfigQuery.data?.defaultBillingInterval]);

  useEffect(() => {
    if (staffAccessSearchTimerRef.current) {
      clearTimeout(staffAccessSearchTimerRef.current);
    }

    const trimmed = staffAccessIdentifier.trim();
    if (!trimmed) {
      setStaffAccessSearchTerm("");
      return;
    }

    staffAccessSearchTimerRef.current = setTimeout(() => {
      setStaffAccessSearchTerm(trimmed);
    }, STAFF_ACCESS_SEARCH_DEBOUNCE_MS);

    return () => {
      if (staffAccessSearchTimerRef.current) {
        clearTimeout(staffAccessSearchTimerRef.current);
      }
    };
  }, [staffAccessIdentifier]);

  const refreshAdminAccessState = async () => {
    await Promise.all([
      billingStateQuery.refetch(),
      isAdmin ? staffOverridesQuery.refetch() : Promise.resolve(),
    ]);
  };
  const grantStaffAccess = useMutation<any, unknown, any>({
    mutationFn: (input) =>
      (trpcClient.billing as any).grantStaffAccessOverride.mutate(input),
    onSuccess: async (result) => {
      await refreshAdminAccessState();
      setStaffAccessIdentifier("");
      setStaffAccessReason("");
      toast.success(
        `Granted ${result.user.name} ${staffAccessPlanKey} access.`
      );
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to grant access"
      );
    },
  });
  const revokeStaffAccess = useMutation<any, unknown, any>({
    mutationFn: (input) =>
      (trpcClient.billing as any).revokeStaffAccessOverride.mutate(input),
    onSuccess: async (result) => {
      await refreshAdminAccessState();
      toast.success(
        result.deletedCount > 0
          ? `Removed manual access for ${result.user.name}.`
          : `No manual access override was active for ${result.user.name}.`
      );
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to revoke access"
      );
    },
  });
  const resolveAffiliateCode = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) {
      latestAffiliateCodeRequestRef.current = null;
      setResolvedAffiliate(null);
      setAffiliateCodeResolved(false);
      toast.dismiss(AFFILIATE_CODE_TOAST_ID);
      return;
    }

    latestAffiliateCodeRequestRef.current = trimmed;

    try {
      const profile = (await trpcClient.billing.getAffiliatePublicProfile.query(
        {
          code: trimmed,
        }
      )) as ResolvedAffiliateProfile | null;

      if (latestAffiliateCodeRequestRef.current !== trimmed) {
        return;
      }

      if (profile?.defaultOfferCode) {
        setResolvedAffiliate(profile);
        setAffiliateCodeResolved(true);
        toast.success("Affiliate code ready for checkout.", {
          id: AFFILIATE_CODE_TOAST_ID,
        });
        return;
      }

      setResolvedAffiliate(null);
      setAffiliateCodeResolved(false);
      toast.error("Affiliate code doesn't exist.", {
        id: AFFILIATE_CODE_TOAST_ID,
      });
    } catch {
      if (latestAffiliateCodeRequestRef.current !== trimmed) {
        return;
      }

      setResolvedAffiliate(null);
      setAffiliateCodeResolved(false);
      toast.error("Affiliate code doesn't exist.", {
        id: AFFILIATE_CODE_TOAST_ID,
      });
    }
  };

  const handleAffiliateCodeChange = (value: string) => {
    setAffiliateCodeInput(value);
    setAffiliateCodeResolved(false);

    if (resolveTimerRef.current) {
      clearTimeout(resolveTimerRef.current);
    }

    const trimmed = value.trim();
    if (!trimmed) {
      latestAffiliateCodeRequestRef.current = null;
      setResolvedAffiliate(null);
      toast.dismiss(AFFILIATE_CODE_TOAST_ID);
      return;
    }

    resolveTimerRef.current = setTimeout(() => {
      void resolveAffiliateCode(trimmed);
    }, 500);
  };

  const handleApplyAffiliateCode = () => {
    if (!resolvedAffiliate?.defaultOfferCode) {
      toast.error("Enter a valid affiliate code first.");
      return;
    }

    setAffiliateOfferCode(resolvedAffiliate.defaultOfferCode);
    setAppliedAffiliate(resolvedAffiliate);
    setAffiliateDialogOpen(false);
    toast.success("Affiliate code will be applied at checkout.", {
      id: AFFILIATE_CODE_TOAST_ID,
    });
  };

  const handleClearAffiliateCode = () => {
    if (resolveTimerRef.current) {
      clearTimeout(resolveTimerRef.current);
    }

    latestAffiliateCodeRequestRef.current = null;
    setAffiliateOfferCode("");
    setAffiliateCodeInput("");
    setAffiliateCodeResolved(false);
    setResolvedAffiliate(null);
    setAppliedAffiliate(null);
    toast.dismiss(AFFILIATE_CODE_TOAST_ID);
  };

  const handleCheckout = async (
    planKey: Extract<BillingPlanKey, "professional" | "institutional">
  ) => {
    try {
      const result = await createCheckout.mutateAsync({
        planKey,
        billingInterval,
        returnPath: "/dashboard/settings/billing",
        affiliateOfferCode: affiliateOfferCode.trim() || undefined,
      });
      window.location.assign(result.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to start checkout");
    }
  };

  const handleManageSubscription = async () => {
    try {
      const result = await createCustomerPortalSession.mutateAsync({
        returnPath: "/dashboard/settings/billing",
        flow: "manage",
      });
      window.location.assign(result.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to open portal");
    }
  };

  const handleChangeSubscriptionPlan = async (
    planKey: Extract<BillingPlanKey, "professional" | "institutional">
  ) => {
    try {
      const result = await createCustomerPortalSession.mutateAsync({
        returnPath: "/dashboard/settings/billing",
        flow: "update",
        planKey,
        billingInterval,
      });
      window.location.assign(result.url);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Unable to open plan change flow"
      );
    }
  };

  const handleMoveToFreeTier = async () => {
    setCancelFlowOpen(true);
  };

  const handleGrantStaffAccess = async () => {
    const normalizedIdentifier = staffAccessIdentifier.trim();
    const selectedPreset = STAFF_ACCESS_PRESETS.find(
      (preset) => preset.key === staffAccessPresetKey
    );
    const durationDays =
      selectedPreset?.durationDays ??
      Number.parseInt(staffAccessDurationDays, 10);

    if (!normalizedIdentifier) {
      toast.error("Enter an email or @username first");
      return;
    }

    if (
      !Number.isInteger(durationDays) ||
      durationDays < 1 ||
      durationDays > 3650
    ) {
      toast.error("Duration must be between 1 and 3650 days");
      return;
    }

    try {
      await grantStaffAccess.mutateAsync({
        userIdentifier: normalizedIdentifier,
        planKey: staffAccessPlanKey,
        presetKey: staffAccessPresetKey,
        durationDays,
        reason: staffAccessReason.trim() || undefined,
      });
    } catch {
      return;
    }
  };

  const handleRevokeStaffAccess = async (
    userIdentifier: string,
    reason?: string | null
  ) => {
    try {
      await revokeStaffAccess.mutateAsync({
        userIdentifier,
        reason: reason ?? "Manual revocation",
      });
    } catch {
      return;
    }
  };

  const handleSelectStaffAccessCandidate = (candidate: StaffAccessCandidate) => {
    setStaffAccessIdentifier(getStaffAccessCandidateIdentifier(candidate));
  };

  useEffect(() => {
    if (
      !returnedFromStripeCheckout ||
      hasTriggeredStripeReturnSyncRef.current
    ) {
      return;
    }

    hasTriggeredStripeReturnSyncRef.current = true;
    syncBillingState.mutate();
  }, [returnedFromStripeCheckout, syncBillingState]);

  useEffect(() => {
    return () => {
      if (resolveTimerRef.current) {
        clearTimeout(resolveTimerRef.current);
      }

      if (staffAccessSearchTimerRef.current) {
        clearTimeout(staffAccessSearchTimerRef.current);
      }
    };
  }, []);

  if (billingStateQuery.isLoading || billingConfigQuery.isLoading) {
    return (
      <RouteLoadingFallback route="settingsBilling" className="min-h-full" />
    );
  }

  return (
    <div className="flex w-full flex-col">
      {/* ── Header ── */}
      <div className="grid gap-8 px-6 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(420px,560px)] lg:items-center">
        <div className="max-w-xl space-y-3">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-[-0.04em]">
              Billing
            </h1>
            <p className="text-base font-medium tracking-[-0.04em] text-white/40 sm:text-sm">
              Manage your Profitabledge plan and subscription.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => syncBillingState.mutate()}
              disabled={syncBillingState.isPending}
              className="h-8 cursor-pointer gap-1.5 rounded-sm ring ring-white/5 bg-sidebar px-3 text-xs text-white transition-all duration-250 active:scale-95 hover:brightness-120 hover:bg-sidebar-accent"
            >
              <RefreshCw
                className={cn(
                  "size-3",
                  syncBillingState.isPending && "animate-spin"
                )}
              />
              {syncBillingState.isPending ? "Syncing..." : "Refresh billing"}
            </Button>
            {canManageSubscription ? (
              <Button
                onClick={handleManageSubscription}
                disabled={createCustomerPortalSession.isPending}
                className="h-8 cursor-pointer gap-1.5 rounded-sm ring ring-white/5 bg-sidebar px-3 text-xs text-white transition-all duration-250 active:scale-95 hover:brightness-120 hover:bg-sidebar-accent"
              >
                <ExternalLink className="size-3" />
                {createCustomerPortalSession.isPending
                  ? "Opening..."
                  : "Manage subscription"}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="w-full max-w-[560px] min-w-0 lg:justify-self-end">
          <WalletHero
            planTitle={activePlan?.title ?? "Explorer"}
            priceLabel={activePlan?.priceLabel ?? "Free"}
            remainingEdgeCredits={creditState?.remainingCredits ?? 0}
            allowanceEdgeCredits={
              creditState?.allowanceCredits ??
              activePlan?.includedAiCredits ??
              0
            }
            subscriptionStatus={subscription?.status ?? null}
            currentPeriodEnd={subscription?.currentPeriodEnd ?? null}
          />
        </div>
      </div>

      <Separator />

      {/* ── Plans ── */}
      <div className="px-6 py-5 sm:px-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center justify-between">
            <SectionLabel>Plans</SectionLabel>
          </div>
          <div className="flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] p-1">
            {(["monthly", "annual"] as const).map((interval) => (
              <button
                key={interval}
                type="button"
                onClick={() => setBillingInterval(interval)}
                className={segmentedBillingToggleButtonClassName(
                  billingInterval === interval
                )}
              >
                {interval === "monthly" ? "Monthly" : "Annual"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {plans.map((plan) => {
            const isActivePlan = plan.key === activePlanKey;
            const planKey = plan.key as BillingPlanKey;
            const activePlanTier = BILLING_PLAN_TIER[activePlanKey] ?? 0;
            const planTier = BILLING_PLAN_TIER[planKey] ?? 0;
            const isHigherTierThanActive = planTier > activePlanTier;
            const isLowerPaidTierThanActive =
              !plan.isFree && planTier < activePlanTier;
            const hasSelectedIntervalConfigured = plan.isFree
              ? true
              : billingInterval === "annual"
                ? Boolean(plan.pricing?.annual?.isConfigured)
                : Boolean(plan.pricing?.monthly?.isConfigured);
            const isCurrentPlanSelection =
              isActivePlan &&
              (plan.isFree ||
                !canManageSubscription ||
                currentBillingInterval === billingInterval);
            const canChangeExistingSubscription =
              canManageSubscription &&
              !plan.isFree &&
              hasSelectedIntervalConfigured &&
              !isCurrentPlanSelection;
            const isProfessional = plan.key === "professional";
            const isInstitutional = plan.key === "institutional";
            const canCheckout =
              !plan.isFree &&
              hasSelectedIntervalConfigured &&
              !canChangeExistingSubscription &&
              isHigherTierThanActive &&
              !canManageSubscription;
            const showsMoveToFreeTier =
              plan.isFree &&
              activePlanKey !== "student" &&
              canManageSubscription;
            const meta = PLAN_CARD_META[planKey] ?? PLAN_CARD_META.student;
            const price = getDisplayedPricing(plan, billingInterval);
            const featureLines = getPlanFeatureLines(plan);

            const outerCn = isProfessional
              ? "bg-blue-500/10 ring-blue-500/25"
              : isInstitutional
              ? "bg-emerald-500/10 ring-emerald-500/25"
              : "bg-sidebar ring-white/10";

            const innerCn = isProfessional
              ? "bg-blue-500/5"
              : isInstitutional
              ? "bg-emerald-500/5"
              : "bg-sidebar-accent";

            const titleCn = isProfessional
              ? "text-blue-200"
              : isInstitutional
              ? "text-emerald-200"
              : "text-white";
            const accentTextCn = isProfessional
              ? "text-blue-300"
              : isInstitutional
              ? "text-emerald-300"
              : "text-white";

            const currentBadgeCn = isProfessional
              ? "ring ring-blue-500/20 bg-blue-900/30 text-blue-300"
              : isInstitutional
              ? "ring ring-white/10 bg-white/5 text-white"
              : "ring ring-white/10 bg-white/5 text-white/60";

            const ctaButtonCn = isProfessional
              ? "!ring !ring-blue-400/40 !bg-blue-400/32 !text-blue-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_28px_rgba(37,99,235,0.075)] hover:!bg-blue-500/40 hover:!text-white"
              : "!ring !ring-emerald-400/40 !bg-emerald-400/32 !text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_28px_rgba(0,0,0,0.075)] hover:!bg-emerald-400/40 hover:!text-white";

            const currentPlanCn = isProfessional
              ? "ring ring-blue-400/10 bg-blue-500/8 text-blue-100/55"
              : isInstitutional
              ? "ring ring-white/10 bg-white/[0.04] text-white/45"
              : "ring ring-white/5 bg-white/[0.02] text-white/25";

            const freePlanCn =
              "ring ring-white/5 bg-white/[0.02] text-white/25";

            const checkCn = isProfessional
              ? "fill-blue-400"
              : isInstitutional
              ? "fill-emerald-400"
              : "fill-white/40";

            return (
              <div
                key={plan.key}
                className={cn(
                  "group flex flex-col rounded-sm p-1.5 ring-1 shadow-sidebar-button overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[103%]",
                  outerCn
                )}
                style={{
                  opacity: hoveredCard && hoveredCard !== plan.key ? 0.2 : 1,
                  filter:
                    hoveredCard && hoveredCard !== plan.key
                      ? "blur(2.5px)"
                      : "none",
                }}
                onMouseEnter={() => setHoveredCard(plan.key as BillingPlanKey)}
                onMouseLeave={() => setHoveredCard(null)}
                onClick={undefined}
                onKeyDown={undefined}
                role={undefined}
                tabIndex={undefined}
                aria-label={undefined}
              >
                <div
                  className={cn(
                    "flex flex-1 flex-col rounded-sm overflow-hidden transition-all duration-250 group-hover:brightness-110",
                    innerCn
                  )}
                >
                  {/* Image header */}
                  <div className="relative w-full h-32 overflow-hidden rounded-t-sm">
                    <Image
                      src={meta.imageSrc}
                      alt={plan.title}
                      fill
                      className="object-cover opacity-75 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition duration-500"
                    />
                  </div>

                  <Separator className="opacity-25" />

                  <div className="flex flex-1 flex-col gap-4 p-5">
                    {/* Title + current badge + description */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            "text-xs font-bold tracking-[-0.04em] text-white/40 sm:text-base",
                            titleCn
                          )}
                        >
                          {plan.title}
                        </p>
                        {isCurrentPlanSelection && (
                          <Badge className={cn("text-[11px]", currentBadgeCn)}>
                            Current
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs font-medium tracking-[-0.04em] text-white/50 sm:text-xs">
                        {plan.summary}
                      </p>
                    </div>

                    <Separator className="-mx-5 w-auto opacity-15" />

                    {/* Price + highlight badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xl font-bold text-white">
                          {price.amount}
                          {price.interval && (
                            <span className="ml-1 text-sm font-normal text-white/35">
                              {price.interval}
                            </span>
                          )}
                        </p>
                        {price.detail ? (
                          <p className="text-xs text-white/35">{price.detail}</p>
                        ) : null}
                      </div>
                      {price.savings ? (
                        <span className="rounded px-3 py-1 text-[10px] font-semibold ring ring-teal-400/20 bg-teal-500/10 text-teal-300">
                          {price.savings}
                        </span>
                      ) : plan.highlight ? (
                        <span
                          className={cn(
                            "rounded px-3 py-1 text-[10px] font-semibold",
                            meta.badgeClassName
                          )}
                        >
                          {plan.highlight}
                        </span>
                      ) : null}
                    </div>

                    <Separator className="-mx-5 w-auto opacity-15" />

                    {/* Entitlements */}
                    <ul className="flex flex-1 flex-col gap-2.5">
                      {featureLines.map((line) => (
                        <li
                          key={line.key}
                          className={cn(
                            "flex items-start gap-2 text-[13px] font-medium",
                            line.tone === "positive"
                              ? "text-white"
                              : line.tone === "muted"
                              ? "text-white/28"
                              : "text-white"
                          )}
                        >
                          <CircleCheck
                            className={cn(
                              "mt-px size-4.5 shrink-0",
                              line.tone === "muted" ? "fill-white/18" : checkCn
                            )}
                          />
                          <span>
                            {line.prefix}
                            {line.accent ? (
                              <span
                                className={
                                  line.accentTone === "card"
                                    ? accentTextCn
                                    : undefined
                                }
                              >
                                {line.accent}
                              </span>
                            ) : null}
                            {line.suffix}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <div className="mt-auto pt-1">
                      {isCurrentPlanSelection ? (
                        <div
                          className={cn(
                            "flex h-9 w-full items-center justify-center rounded-sm text-xs",
                            currentPlanCn
                          )}
                        >
                          Current plan
                        </div>
                      ) : canChangeExistingSubscription ? (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            handleChangeSubscriptionPlan(
                              plan.key as Extract<
                                BillingPlanKey,
                                "professional" | "institutional"
                              >
                            )
                          }
                          disabled={createCustomerPortalSession.isPending}
                          className={cn(
                            "h-9 w-full cursor-pointer rounded-sm text-xs font-medium shadow-sidebar-button transition-all duration-250 active:scale-95",
                            ctaButtonCn
                          )}
                        >
                          <ExternalLink className="size-3" />
                          {createCustomerPortalSession.isPending
                            ? "Opening..."
                            : isLowerPaidTierThanActive
                              ? `Downgrade to ${plan.title} ${billingInterval}`
                              : isActivePlan
                                ? `Switch to ${billingInterval}`
                                : `Change to ${plan.title} ${billingInterval}`}
                        </Button>
                      ) : canCheckout ? (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            handleCheckout(
                              plan.key as Extract<
                                BillingPlanKey,
                                "professional" | "institutional"
                              >
                            )
                          }
                          disabled={createCheckout.isPending}
                          className={cn(
                            "h-9 w-full cursor-pointer rounded-sm text-xs font-medium shadow-sidebar-button transition-all duration-250 active:scale-95",
                            ctaButtonCn
                          )}
                        >
                          <Sparkles className="size-3" />
                          {createCheckout.isPending
                            ? "Redirecting..."
                            : billingInterval === "annual"
                            ? `Switch to ${plan.title} annual`
                            : `Upgrade to ${plan.title}`}
                        </Button>
                      ) : showsMoveToFreeTier ? (
                        <Button
                          variant="ghost"
                          onClick={handleMoveToFreeTier}
                          disabled={!canMoveToFreeTier}
                          className="h-9 w-full cursor-pointer rounded-sm text-xs font-medium shadow-sidebar-button ring ring-white/10 bg-white/5 text-white transition-all duration-250 active:scale-95 hover:bg-white/10 hover:text-white disabled:cursor-default disabled:opacity-70"
                        >
                          <ExternalLink className="size-3" />
                          {cancellationScheduled
                            ? "Cancellation scheduled"
                            : "Pause or cancel"}
                        </Button>
                      ) : (
                        <div
                          className={cn(
                            "flex h-9 w-full items-center justify-center rounded-sm text-xs",
                            freePlanCn
                          )}
                        >
                          {plan.isFree
                            ? "Free forever"
                            : !hasSelectedIntervalConfigured
                              ? `${billingInterval} not configured`
                            : isLowerPaidTierThanActive
                              ? "You don't need this!"
                              : "Unavailable"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col items-start gap-2">
          <button
            type="button"
            onClick={() => setAffiliateDialogOpen(true)}
            className="flex cursor-pointer items-center gap-1.5 text-xs text-white/38 transition-colors hover:text-white/62"
          >
            <BadgePercent className="size-3.5" />
            Have an affiliate code?
          </button>

          {appliedAffiliate ? (
            <div className="flex items-center gap-3 text-xs text-white/42">
              <p>
                Applied for{" "}
                <span className="text-white/65">
                  {appliedAffiliate.username || appliedAffiliate.name}
                </span>
              </p>
              <button
                type="button"
                onClick={handleClearAffiliateCode}
                className="cursor-pointer text-white/32 transition-colors hover:text-white/58"
              >
                Remove code
              </button>
            </div>
          ) : (
            <p className="text-xs text-white/30">
              We&apos;ll resolve it before sending you to Stripe.
            </p>
          )}
        </div>
      </div>

      <Dialog open={affiliateDialogOpen} onOpenChange={setAffiliateDialogOpen}>
        <DialogContent className="border-white/10 bg-sidebar text-white shadow-2xl sm:max-w-md">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-base font-medium text-white">
              Have an affiliate code?
            </DialogTitle>
            <DialogDescription className="text-sm text-white/45">
              Enter the affiliate username or code you were given and we&apos;ll
              apply it to checkout.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Input
                value={affiliateCodeInput}
                onChange={(event) =>
                  handleAffiliateCodeChange(event.target.value)
                }
                placeholder="Enter username or code"
                className="h-11 border-white/10 bg-sidebar-accent text-sm text-white placeholder:text-white/28"
              />
              {affiliateCodeResolved ? (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Check className="size-4 text-emerald-400" />
                </div>
              ) : null}
            </div>

            {affiliateCodeResolved && resolvedAffiliate ? (
              <p className="text-xs text-white/45">
                Affiliate found:{" "}
                <span className="text-white/70">
                  {resolvedAffiliate.username || resolvedAffiliate.name}
                </span>
              </p>
            ) : (
              <p className="text-xs text-white/32">
                The code is checked before checkout, so discounts and
                attribution stay aligned.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            {affiliateOfferCode ? (
              <Button
                type="button"
                variant="ghost"
                onClick={handleClearAffiliateCode}
                className="h-9 rounded-sm border border-white/10 bg-transparent text-xs text-white/60 hover:bg-white/5 hover:text-white"
              >
                Remove code
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={handleApplyAffiliateCode}
              disabled={
                !affiliateCodeResolved || !resolvedAffiliate?.defaultOfferCode
              }
              className="h-9 rounded-sm bg-white text-xs font-medium text-black hover:bg-white/90"
            >
              Use code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activePlanKey !== "student" ? (
        <CancelFlow
          open={cancelFlowOpen}
          onOpenChange={setCancelFlowOpen}
          activePlanKey={
            activePlanKey as Extract<
              BillingPlanKey,
              "professional" | "institutional"
            >
          }
          annualMonthlyPriceCents={activePlan?.annualMonthlyPriceCents ?? null}
          annualDiscountPercent={activePlan?.annualDiscountPercent ?? null}
        />
      ) : null}

      {isAdmin ? (
        <>
          <Separator />

          <div className="px-6 py-5 sm:px-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-sm bg-emerald-500/10 text-emerald-300 ring ring-emerald-500/20">
                <Shield className="size-4" />
              </div>
              <div>
                <SectionLabel>Admin access overrides</SectionLabel>
                <p className="mt-1 text-xs text-white/35">
                  Grant full app access without Stripe checkout for staff,
                  ambassadors, and partners.
                </p>
              </div>
            </div>

            <div className="rounded-sm bg-sidebar p-1.5 ring ring-white/5">
              <div className="rounded-sm bg-sidebar-accent p-4 sm:p-5">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_180px_180px_140px_auto] lg:items-end">
                  <div className="space-y-2">
                    <SectionLabel>User</SectionLabel>
                    <Input
                      value={staffAccessIdentifier}
                      onChange={(event) =>
                        setStaffAccessIdentifier(event.target.value)
                      }
                      autoComplete="off"
                      placeholder="name@profitabledge.com or @username"
                      className="h-11 border-white/10 bg-sidebar text-sm text-white placeholder:text-white/28"
                    />
                    {shouldShowStaffAccessSuggestions ? (
                      <div className="overflow-hidden rounded-sm border border-white/10 bg-sidebar/70">
                        {staffAccessCandidatesQuery.isFetching ? (
                          <div className="px-3 py-2 text-xs text-white/35">
                            Searching usernames...
                          </div>
                        ) : staffAccessCandidates.length ? (
                          <div className="max-h-56 overflow-y-auto p-1">
                            {staffAccessCandidates.map((candidate) => {
                              const candidateIdentifier =
                                getStaffAccessCandidateIdentifier(candidate);
                              const candidateLabel =
                                getStaffAccessCandidateLabel(candidate);

                              return (
                                <button
                                  key={candidate.id}
                                  type="button"
                                  onClick={() =>
                                    handleSelectStaffAccessCandidate(candidate)
                                  }
                                  className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left transition-colors hover:bg-white/5"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-white">
                                      {candidateLabel}
                                    </p>
                                    <p className="truncate text-xs text-white/38">
                                      {candidateIdentifier}
                                      {candidate.email !== candidateIdentifier
                                        ? ` • ${candidate.email}`
                                        : ""}
                                    </p>
                                  </div>
                                  <span className="ml-3 shrink-0 text-[11px] uppercase tracking-[0.14em] text-white/28">
                                    Select
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="px-3 py-2 text-xs text-white/35">
                            No matching users found.
                          </div>
                        )}
                      </div>
                    ) : null}
                    <p className="text-[11px] text-white/30">
                      Start typing a username or email to pick a user.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <SectionLabel>Preset</SectionLabel>
                    <select
                      value={staffAccessPresetKey}
                      onChange={(event) => {
                        const preset = STAFF_ACCESS_PRESETS.find(
                          (entry) => entry.key === event.target.value
                        );
                        setStaffAccessPresetKey(
                          event.target
                            .value as (typeof STAFF_ACCESS_PRESETS)[number]["key"]
                        );
                        if (preset?.durationDays) {
                          setStaffAccessDurationDays(
                            String(preset.durationDays)
                          );
                        }
                      }}
                      className="flex h-11 w-full rounded-sm border border-white/10 bg-sidebar px-3 text-sm text-white outline-none transition-colors focus:border-white/20"
                    >
                      {STAFF_ACCESS_PRESETS.map((preset) => (
                        <option key={preset.key} value={preset.key}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <SectionLabel>Plan</SectionLabel>
                    <select
                      value={staffAccessPlanKey}
                      onChange={(event) =>
                        setStaffAccessPlanKey(
                          event.target.value as Extract<
                            BillingPlanKey,
                            "professional" | "institutional"
                          >
                        )
                      }
                      className="flex h-11 w-full rounded-sm border border-white/10 bg-sidebar px-3 text-sm text-white outline-none transition-colors focus:border-white/20"
                    >
                      <option value="professional">Trader</option>
                      <option value="institutional">Elite</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <SectionLabel>Days</SectionLabel>
                    <Input
                      type="number"
                      min={1}
                      max={3650}
                      value={staffAccessDurationDays}
                      onChange={(event) =>
                        setStaffAccessDurationDays(event.target.value)
                      }
                      className="h-11 border-white/10 bg-sidebar text-sm text-white placeholder:text-white/28"
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={handleGrantStaffAccess}
                    disabled={
                      grantStaffAccess.isPending ||
                      staffAccessIdentifier.trim().length === 0
                    }
                    className="h-11 rounded-sm bg-white text-sm font-medium text-black hover:bg-white/90"
                  >
                    {grantStaffAccess.isPending
                      ? "Granting..."
                      : "Grant access"}
                  </Button>
                </div>

                <div className="mt-3 space-y-2">
                  <SectionLabel>Reason</SectionLabel>
                  <Input
                    value={staffAccessReason}
                    onChange={(event) =>
                      setStaffAccessReason(event.target.value)
                    }
                    placeholder="Admin comp, ambassador access, partner onboarding..."
                    className="h-11 border-white/10 bg-sidebar text-sm text-white placeholder:text-white/28"
                  />
                </div>

                <p className="mt-3 text-xs text-white/30">
                  This creates an app-level entitlement override. Use it for
                  internal comps and ambassador access without charging the
                  user.
                </p>

                <Separator className="my-4 opacity-15" />

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <SectionLabel>Active manual access</SectionLabel>
                    {staffOverridesQuery.isFetching ? (
                      <span className="text-xs text-white/30">
                        Refreshing...
                      </span>
                    ) : null}
                  </div>

                  {staffOverridesQuery.data?.length ? (
                    <div className="space-y-2">
                      {(
                        staffOverridesQuery.data as StaffAccessOverrideRow[]
                      ).map((override) => (
                        <div
                          key={override.id}
                          className="flex flex-col gap-3 rounded-sm border border-white/8 bg-sidebar px-3 py-3 text-sm text-white/72 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-medium text-white">
                              {override.name}
                              <span className="ml-2 text-white/35">
                                {override.username
                                  ? `@${override.username}`
                                  : override.email}
                              </span>
                            </p>
                            <p className="mt-1 text-xs text-white/38">
                              {override.planKey === "institutional"
                                ? "Elite"
                                : "Trader"}{" "}
                              access until {formatDate(override.endsAt)}
                            </p>
                            <p className="mt-1 text-[11px] text-white/30">
                              {override.metadata?.presetKey
                                ? `Preset: ${override.metadata.presetKey}`
                                : "Manual duration"}
                              {override.metadata?.reason
                                ? ` • ${override.metadata.reason}`
                                : ""}
                              {override.metadata?.grantedByEmail
                                ? ` • granted by ${override.metadata.grantedByEmail}`
                                : ""}
                            </p>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              handleRevokeStaffAccess(
                                override.username || override.email,
                                override.metadata?.reason
                              )
                            }
                            disabled={revokeStaffAccess.isPending}
                            className="h-9 rounded-sm border border-white/10 bg-white/5 text-xs text-white hover:bg-white/10"
                          >
                            Revoke
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-sm border border-dashed border-white/10 bg-sidebar px-3 py-4 text-sm text-white/35">
                      No active manual overrides.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
