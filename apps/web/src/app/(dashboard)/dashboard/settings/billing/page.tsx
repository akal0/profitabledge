"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, Shield, Sparkles } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { InvoiceHistoryTable } from "@/features/settings/billing/components/invoice-history-table";
import {
  formatLiveSyncSlots,
  getPlanFeatureLines,
} from "@/features/settings/billing/lib/plan-copy";
import { trpcClient, trpcOptions } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import CircleCheck from "@/public/icons/circle-check.svg";

type BillingPlanKey = "student" | "professional" | "institutional";

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
  includesBacktest: boolean;
  includesCopier: boolean;
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
    {
      label: "Backtest",
      value: plan.includesBacktest ? "Included" : "Not included",
      tone: plan.includesBacktest ? ("positive" as const) : ("muted" as const),
    },
    {
      label: "Copier",
      value: plan.includesCopier ? "Included" : "Not included",
      tone: plan.includesCopier ? ("positive" as const) : ("muted" as const),
    },
  ];
}

function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx = ((prev.x + curr.x) / 2).toFixed(1);
    d += ` C ${cpx},${prev.y.toFixed(1)} ${cpx},${curr.y.toFixed(
      1
    )} ${curr.x.toFixed(1)},${curr.y.toFixed(1)}`;
  }
  return d;
}

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  return Array.from({ length: max }, (_, i) => arr[Math.round(i * step)]);
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
  walletChartPaths,
}: {
  planTitle: string;
  priceLabel: string;
  remainingEdgeCredits: number;
  allowanceEdgeCredits: number;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: string | Date | null;
  walletChartPaths: { line: string; area: string } | null;
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
    <div className="relative h-[164px] min-h-[164px] w-full overflow-hidden rounded-[30px] bg-[#0a0a0a] shadow-[0_24px_32px_rgba(0,0,0,0.3)] sm:h-[182px] sm:min-h-[182px] lg:h-[196px] lg:min-h-[196px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.15),transparent_26%),linear-gradient(160deg,#262626_0%,#171717_35%,#111111_68%,#050505_100%)]" />

      <div className="absolute inset-[6px] rounded-[24px] ring ring-white/6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-18px_26px_rgba(0,0,0,0.18)]" />

      <div className="absolute inset-[12px] rounded-[21px] ring ring-white/[0.045]" />

      <div className="absolute inset-x-[20px] top-[18px] h-[43%] overflow-hidden rounded-t-[16px] bg-[linear-gradient(180deg,#141414_0%,#060606_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_40%)]" />
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 -14 378 109"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="wallet-chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(251,191,36,0.18)" />
              <stop offset="100%" stopColor="rgba(251,191,36,0)" />
            </linearGradient>
          </defs>
          {walletChartPaths ? (
            <>
              <path d={walletChartPaths.area} fill="url(#wallet-chart-fill)" />
              <path
                d={walletChartPaths.line}
                fill="none"
                stroke="rgba(251,191,36,0.45)"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          ) : (
            <>
              <path
                d="M0,78 C38,74 54,66 88,61 C118,56 130,64 166,50 C192,40 202,45 232,33 C256,23 270,22 302,16 C330,10 342,12 378,10 L378,95 L0,95 Z"
                fill="url(#wallet-chart-fill)"
              />
              <path
                d="M0,78 C38,74 54,66 88,61 C118,56 130,64 166,50 C192,40 202,45 232,33 C256,23 270,22 302,16 C330,10 342,12 378,10"
                fill="none"
                stroke="rgba(251,191,36,0.4)"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}
        </svg>

        <span className="pointer-events-none absolute right-3 top-0 select-none text-[72px] font-black tracking-[-0.08em] text-white/[0.035]">
          PE
        </span>
      </div>

      <div className="absolute inset-x-[8px] bottom-[7px] top-[38%] overflow-hidden rounded-[26px]">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 540 250"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="wallet-pocket-fill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#212121" />
              <stop offset="52%" stopColor="#121212" />
              <stop offset="100%" stopColor="#070707" />
            </linearGradient>
          </defs>
          <path
            d="M0,46 C88,42 141,68 228,62 C314,56 370,31 540,45 L540,250 L0,250 Z"
            fill="url(#wallet-pocket-fill)"
          />
        </svg>

        <svg
          className="pointer-events-none absolute inset-0 z-10 h-full w-full"
          viewBox="0 0 540 250"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0,46 C88,42 141,68 228,62 C314,56 370,31 540,45"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5,52 L5,200 Q5,234 38,234 L502,234 Q535,234 535,200 L535,52"
            fill="none"
            stroke="rgba(255,255,255,0.075)"
            strokeWidth="1.15"
            strokeDasharray="5 5.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="absolute inset-x-0 bottom-0 z-20 grid grid-cols-3 items-end gap-3 px-4 pb-5">
          <div className="min-w-0 text-left">
            <div className="space-y-0">
              <p className="text-base font-medium tracking-[-0.04em] text-white/28 sm:text-xs">
                {statusLabel}
              </p>

              <p className="truncate text-base font-medium tracking-[-0.04em] text-white/56 sm:text-sm">
                {planTitle}
              </p>
            </div>
          </div>

          <div className="text-center">
            <p className="text-[10px] text-white/20">Edge credits</p>
            <p className="text-sm font-medium tracking-[-0.04em] text-white/56 sm:text-sm">
              {edgeCreditsLabel}
            </p>
          </div>

          <div className="text-right">
            <p className="text-[10px] text-white/20">Renews</p>
            <p className="text-base font-medium tracking-[-0.04em] text-white/56 sm:text-sm">
              {renewalLabel}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BillingSettingsPage() {
  const [hoveredCard, setHoveredCard] = useState<BillingPlanKey | null>(null);
  const selectedAccountId = useAccountStore((s) => s.selectedAccountId);

  const billingStateQuery = useQuery(
    trpcOptions.billing.getState.queryOptions()
  );
  const billingConfigQuery = useQuery(
    trpcOptions.billing.getPublicConfig.queryOptions()
  );

  const walletTradesQuery = useQuery({
    queryKey: ["wallet-equity-trades", selectedAccountId ?? null],
    enabled: Boolean(selectedAccountId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!selectedAccountId) return [];
      const trades: { profit: number | null; closeTime: string | null }[] = [];
      let cursor: { createdAtISO: string; id: string } | undefined;
      let pages = 0;
      do {
        const page = await trpcClient.trades.listInfinite.query({
          accountId: selectedAccountId,
          limit: 200,
          cursor,
        });
        for (const t of page.items as any[])
          trades.push({
            profit: t.profit ?? 0,
            closeTime: t.closeTime ?? t.close ?? null,
          });
        cursor =
          "nextCursor" in page ? page.nextCursor ?? undefined : undefined;
        pages++;
      } while (cursor && pages < 10);
      return trades;
    },
  });

  const walletChartPaths = useMemo(() => {
    const trades = walletTradesQuery.data;
    if (!trades?.length) return null;
    const W = 378,
      H = 95,
      PAD = 6;
    const sorted = [...trades]
      .filter((t) => t.closeTime && t.profit != null)
      .sort(
        (a, b) =>
          new Date(a.closeTime!).getTime() - new Date(b.closeTime!).getTime()
      );
    if (sorted.length < 2) return null;
    let running = 0;
    const raw = [
      0,
      ...sorted.map((t) => {
        running += Number(t.profit);
        return running;
      }),
    ];
    const sampled = downsample(raw, 60);
    const minY = Math.min(...sampled);
    const maxY = Math.max(...sampled);
    const range = maxY - minY || 1;
    const pts = sampled.map((v, i) => ({
      x: (i / (sampled.length - 1)) * W,
      y: H - PAD - ((v - minY) / range) * (H - PAD * 2),
    }));
    const line = buildSmoothPath(pts);
    const area = `${line} L ${W},${H} L 0,${H} Z`;
    return { line, area };
  }, [walletTradesQuery.data]);

  const syncFromPolar = useMutation({
    ...trpcOptions.billing.syncFromPolar.mutationOptions(),
    onSuccess: () => {
      void billingStateQuery.refetch();
      toast.success("Billing synced");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    },
  });
  const createCheckout = useMutation(
    trpcOptions.billing.createCheckout.mutationOptions()
  );
  const createCustomerPortalSession = useMutation(
    trpcOptions.billing.createCustomerPortalSession.mutationOptions()
  );
  const plans = billingConfigQuery.data?.plans ?? [];
  const activePlanKey =
    (billingStateQuery.data?.billing.activePlanKey as
      | BillingPlanKey
      | undefined) ?? "student";
  const activePlan =
    plans.find((p) => p.key === activePlanKey) ?? plans[0] ?? null;
  const access = billingStateQuery.data?.access;
  const subscription = billingStateQuery.data?.billing.subscription;
  const creditState = billingStateQuery.data?.billing.credits;
  const canManageSubscription = Boolean(
    billingStateQuery.data?.billing.customer || subscription
  );

  const handleCheckout = async (
    planKey: Extract<BillingPlanKey, "professional" | "institutional">
  ) => {
    try {
      const result = await createCheckout.mutateAsync({
        planKey,
        returnPath: "/dashboard/settings/billing",
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

  if (billingStateQuery.isLoading || billingConfigQuery.isLoading) {
    return (
      <div className="space-y-4 p-6 sm:p-8">
        <div className="h-[160px] animate-pulse rounded-sm ring ring-white/5 bg-sidebar" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-sm ring ring-white/5 bg-sidebar"
            />
          ))}
        </div>
      </div>
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
              onClick={() => syncFromPolar.mutate()}
              disabled={syncFromPolar.isPending}
              className="h-8 cursor-pointer gap-2 rounded-sm ring ring-white/5 bg-sidebar px-3 text-xs text-white transition-all duration-250 active:scale-95 hover:brightness-120 hover:bg-sidebar-accent"
            >
              <RefreshCw
                className={cn(
                  "size-3",
                  syncFromPolar.isPending && "animate-spin"
                )}
              />
              {syncFromPolar.isPending ? "Syncing..." : "Sync from Polar"}
            </Button>
            {canManageSubscription ? (
              <Button
                onClick={handleManageSubscription}
                disabled={createCustomerPortalSession.isPending}
                className="h-8 cursor-pointer gap-2 rounded-sm ring ring-white/5 bg-sidebar px-3 text-xs text-white transition-all duration-250 active:scale-95 hover:brightness-120 hover:bg-sidebar-accent"
              >
                <ExternalLink className="size-3.5" />
                {createCustomerPortalSession.isPending
                  ? "Opening..."
                  : "Manage subscription"}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="w-full max-w-[560px] min-w-0 lg:justify-self-end">
          <WalletHero
            planTitle={activePlan?.title ?? getPlanTitle(activePlanKey)}
            priceLabel={activePlan?.priceLabel ?? "Free"}
            remainingEdgeCredits={creditState?.remainingCredits ?? 0}
            allowanceEdgeCredits={
              creditState?.allowanceCredits ??
              activePlan?.includedAiCredits ??
              0
            }
            subscriptionStatus={subscription?.status ?? null}
            currentPeriodEnd={subscription?.currentPeriodEnd ?? null}
            walletChartPaths={walletChartPaths}
          />
        </div>
      </div>

      <Separator />

      {/* ── Plans ── */}
      <div className="px-6 py-5 sm:px-8">
        <div className="mb-4 flex items-center justify-between">
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

        <div className="grid gap-3 sm:grid-cols-3">
          {plans.map((plan) => {
            const isActive = plan.key === activePlanKey;
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
                      {isActive ? (
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
      </div>
    </div>
  );
}
