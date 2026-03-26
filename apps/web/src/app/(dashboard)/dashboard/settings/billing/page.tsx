"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
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
import { AuthHeroArtwork } from "@/components/auth/auth-hero-artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { InvoiceHistoryTable } from "@/features/settings/billing/components/invoice-history-table";
import {
  formatLiveSyncSlots,
  getPlanFeatureLines,
} from "@/features/settings/billing/lib/plan-copy";
import { trpcClient, trpcOptions } from "@/utils/trpc";
import CircleCheck from "@/public/icons/circle-check.svg";

type BillingPlanKey = "student" | "professional" | "institutional";
type LegacyMigrationState = {
  requiresCheckout: boolean;
  targetPlanKey: BillingPlanKey;
  accessEndsAt?: string | Date | null;
  hasTemporaryAccess: boolean;
};

type BillingPageState = {
  activePlanKey: BillingPlanKey;
  customer?: {
    stripeCustomerId?: string | null;
  } | null;
  subscription?: {
    provider?: string | null;
    status?: string | null;
    currentPeriodEnd?: string | Date | null;
  } | null;
  override?: unknown;
  credits?: {
    remainingCredits: number;
    allowanceCredits: number;
  } | null;
  legacyMigration?: LegacyMigrationState | null;
};

type ResolvedAffiliateProfile = {
  name: string;
  username: string | null;
  image: string | null;
  defaultOfferCode?: string | null;
};

const AFFILIATE_CODE_TOAST_ID = "billing-affiliate-code-status";

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

function splitPriceLabel(priceLabel: string) {
  if (priceLabel.toLowerCase() === "free")
    return { amount: "Free", interval: null };
  const [amount, interval] = priceLabel.split(" / ");
  return { amount, interval: interval ? `/ ${interval}` : null };
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

function LegacyMigrationBanner({
  targetPlanTitle,
  accessEndsAt,
  hasTemporaryAccess,
  onContinue,
  isPending,
}: {
  targetPlanTitle: string;
  accessEndsAt?: string | Date | null;
  hasTemporaryAccess: boolean;
  onContinue: () => void;
  isPending: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-[24px] ring ring-emerald-500/18 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_32%),linear-gradient(135deg,rgba(10,18,14,0.98),rgba(7,12,10,0.96))] px-5 py-4 shadow-[0_18px_42px_rgba(0,0,0,0.24)]">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),transparent_32%,rgba(255,255,255,0.02)_68%,transparent)]" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl space-y-2">
          <Badge className="ring ring-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-200">
            Stripe migration required
          </Badge>
          <div className="space-y-1">
            <p className="text-base font-semibold tracking-[-0.04em] text-white">
              Continue in /settings/billing to move this plan to Stripe.
            </p>
            <p className="text-sm font-medium tracking-[-0.04em] text-white/56">
              Your access is temporarily preserved while you finish the move.
              {hasTemporaryAccess && accessEndsAt ? (
                <span className="text-white/72">
                  {" "}
                  Temporary access ends {formatDate(accessEndsAt)}.
                </span>
              ) : null}
              <span className="text-white/72">
                {" "}
                Your current plan is {targetPlanTitle}.
              </span>
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={onContinue}
          disabled={isPending}
          className="h-9 cursor-pointer gap-2 rounded-sm ring ring-emerald-400/35 bg-emerald-400/24 px-4 text-sm font-medium text-white transition-all duration-250 active:scale-95 hover:bg-emerald-400/34 hover:brightness-120"
        >
          <Sparkles className="size-3.5" />
          {isPending ? "Redirecting..." : "Continue on Stripe"}
        </Button>
      </div>
    </div>
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
    <div className="relative h-[164px] min-h-[164px] w-full overflow-hidden rounded-[30px] bg-[#050505] ring ring-white/10 shadow-[0_24px_32px_rgba(0,0,0,0.3)] sm:h-[182px] sm:min-h-[182px] lg:h-[196px] lg:min-h-[196px]">
      <AuthHeroArtwork />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,5,0.18),rgba(5,5,5,0.52)_42%,rgba(5,5,5,0.82)_100%)]" />
      <div className="absolute inset-[10px] rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] ring ring-white/8" />

      <div className="relative z-10 flex h-full flex-col justify-between p-6 sm:p-7">
        <div className="space-y-3">
          <Badge className="h-7 w-fit rounded-sm bg-white/8 px-2.5 text-[11px] text-white/72 ring ring-white/10">
            {statusLabel}
          </Badge>
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/36">
              Current plan
            </p>
            <div className="flex items-end gap-2">
              <h2 className="text-2xl font-semibold tracking-[-0.05em] text-white sm:text-[2rem]">
                {planTitle}
              </h2>
              <p className="pb-0.5 text-sm text-white/45">{priceLabel}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-sm bg-black/28 p-4 ring ring-white/10 backdrop-blur-[2px]">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/30">
              Edge credits
            </p>
            <p className="mt-2 text-sm font-medium tracking-[-0.03em] text-white/78">
              {edgeCreditsLabel}
            </p>
          </div>
          <div className="rounded-sm bg-black/28 p-4 ring ring-white/10 backdrop-blur-[2px]">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/30">
              Renews
            </p>
            <p className="mt-2 text-sm font-medium tracking-[-0.03em] text-white/78">
              {renewalLabel}
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
  const resolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestAffiliateCodeRequestRef = useRef<string | null>(null);
  const plans = billingConfigQuery.data?.plans ?? [];
  const billingData = billingStateQuery.data?.billing as
    | BillingPageState
    | undefined;
  const legacyMigration = billingData?.legacyMigration ?? null;
  const activePlanKey = billingData?.activePlanKey ?? "student";
  const activePlan =
    plans.find((plan) => plan.key === activePlanKey) ?? plans[0] ?? null;
  const access = billingStateQuery.data?.access;
  const subscription = billingData?.subscription;
  const creditState = billingData?.credits;
  const canManageSubscription = Boolean(
    billingData?.customer?.stripeCustomerId &&
      billingData?.subscription?.provider === "stripe"
  );
  const returnedFromStripeCheckout =
    searchParams?.get("checkout") === "success";
  const migrationCheckoutPlan = legacyMigration?.requiresCheckout
    ? plans.find((plan) => plan.key === legacyMigration.targetPlanKey) ?? null
    : null;

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
      const profile = (await trpcClient.billing.getAffiliatePublicProfile.query({
        code: trimmed,
      })) as ResolvedAffiliateProfile | null;

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
      });
      window.location.assign(result.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to open portal");
    }
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
            planTitle={activePlan?.title ?? "Student"}
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

      {legacyMigration?.requiresCheckout && migrationCheckoutPlan ? (
        <div className="px-6 pb-2 sm:px-8">
          <LegacyMigrationBanner
            targetPlanTitle={migrationCheckoutPlan.title}
            accessEndsAt={legacyMigration.accessEndsAt ?? null}
            hasTemporaryAccess={legacyMigration.hasTemporaryAccess}
            onContinue={() =>
              void handleCheckout(
                migrationCheckoutPlan.key as Extract<
                  BillingPlanKey,
                  "professional" | "institutional"
                >
              )
            }
            isPending={createCheckout.isPending}
          />
        </div>
      ) : null}

      <Separator />

      {/* ── Plans ── */}
      <div className="px-6 py-5 sm:px-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center justify-between">
            <SectionLabel>Plans</SectionLabel>
            {access?.privateBetaRequired ? (
              <Badge
                className={cn(
                  "ring text-[10px]",
                  access.hasPrivateBetaAccess
                    ? "ring-emerald-500/20 bg-emerald-900/30 text-emerald-300"
                    : "ring-blue-500/20 bg-blue-900/30 text-blue-300"
                )}
              >
                <Shield className="mr-1 size-2.5" />
                {access.hasPrivateBetaAccess
                  ? "Beta access unlocked"
                  : "Beta access required"}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {plans.map((plan) => {
            const isActive = plan.key === activePlanKey;
            const isMigrationTarget =
              Boolean(legacyMigration?.requiresCheckout) &&
              legacyMigration?.targetPlanKey === plan.key;
            const isProfessional = plan.key === "professional";
            const isInstitutional = plan.key === "institutional";
            const canCheckout =
              !plan.isFree &&
              plan.isConfigured &&
              (plan.key === "professional" || plan.key === "institutional");
            const meta =
              PLAN_CARD_META[plan.key as BillingPlanKey] ??
              PLAN_CARD_META.student;
            const price = splitPriceLabel(plan.priceLabel);
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

            const isCheckoutableCurrentCard = isActive && isMigrationTarget;

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
                onClick={
                  isCheckoutableCurrentCard
                    ? () =>
                        void handleCheckout(
                          plan.key as Extract<
                            BillingPlanKey,
                            "professional" | "institutional"
                          >
                        )
                    : undefined
                }
                onKeyDown={
                  isCheckoutableCurrentCard
                    ? (event: KeyboardEvent<HTMLDivElement>) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          void handleCheckout(
                            plan.key as Extract<
                              BillingPlanKey,
                              "professional" | "institutional"
                            >
                          );
                        }
                      }
                    : undefined
                }
                role={isCheckoutableCurrentCard ? "button" : undefined}
                tabIndex={isCheckoutableCurrentCard ? 0 : undefined}
                aria-label={
                  isCheckoutableCurrentCard
                    ? `Continue ${plan.title} plan on Stripe`
                    : undefined
                }
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
                        {isActive && (
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
                      <p className="text-xl font-bold text-white">
                        {price.amount}
                        {price.interval && (
                          <span className="ml-1 text-sm font-normal text-white/35">
                            {price.interval}
                          </span>
                        )}
                      </p>
                      {plan.highlight ? (
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
                      {isCheckoutableCurrentCard ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleCheckout(
                              plan.key as Extract<
                                BillingPlanKey,
                                "professional" | "institutional"
                              >
                            );
                          }}
                          disabled={createCheckout.isPending}
                          className={cn(
                            "h-9 w-full cursor-pointer rounded-sm text-xs font-medium shadow-sidebar-button transition-all duration-250 active:scale-95",
                            ctaButtonCn
                          )}
                        >
                          <Sparkles className="size-3" />
                          {createCheckout.isPending
                            ? "Redirecting..."
                            : "Continue on Stripe"}
                        </Button>
                      ) : isActive ? (
                        <div
                          className={cn(
                            "flex h-9 w-full items-center justify-center rounded-sm text-xs",
                            currentPlanCn
                          )}
                        >
                          Current plan
                        </div>
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
                            : `Upgrade to ${plan.title}`}
                        </Button>
                      ) : (
                        <div
                          className={cn(
                            "flex h-9 w-full items-center justify-center rounded-sm text-xs",
                            freePlanCn
                          )}
                        >
                          Free forever
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
              Enter the affiliate username or code you were given and
              we&apos;ll apply it to checkout.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Input
                value={affiliateCodeInput}
                onChange={(event) => handleAffiliateCodeChange(event.target.value)}
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
              disabled={!affiliateCodeResolved || !resolvedAffiliate?.defaultOfferCode}
              className="h-9 rounded-sm bg-white text-xs font-medium text-black hover:bg-white/90"
            >
              Use code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
