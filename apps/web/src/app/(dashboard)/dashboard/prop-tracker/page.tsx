"use client";

import { useMemo, type ReactNode } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronRight,
  Plus,
  Shield,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import {
  WidgetLoading,
  WidgetWrapper,
} from "@/components/dashboard/widget-wrapper";
import {
  PropAccountStatusBadges,
  getEffectivePropTrackerStatus,
  isFundedPropTrackerAccount,
} from "@/components/prop-account-status-badges";
import { RemovePropAccountButton } from "@/features/accounts/components/remove-prop-account-button";
import { getPropAssignActionButtonClassName } from "@/features/accounts/lib/prop-assign-action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator, VerticalSeparator } from "@/components/ui/separator";
import { WIDGET_CONTENT_SEPARATOR_CLASS } from "@/features/dashboard/widgets/lib/widget-shared";
import { cn } from "@/lib/utils";
import { trpcClient, trpcOptions } from "@/utils/trpc";

type SurvivalState = "critical" | "fragile" | "tight" | "stable";
type PropFirmLike = {
  id?: string | null;
  displayName?: string | null;
};

const HEADER_BADGE_CLASS = "h-7 rounded-sm px-1.5 text-[10px] font-medium";
const FTMO_PROP_FIRM_ID = "ftmo";
const FTMO_IMAGE_SRC = "/brokers/FTMO.png";
const GOALS_SURFACE_OUTER_CLASS =
  "group flex flex-col rounded-sm ring ring-white/5 bg-sidebar p-1.5";
const GOALS_SURFACE_INNER_CLASS =
  "flex flex-1 flex-col rounded-sm bg-white ring ring-white/5 transition-all duration-250 dark:bg-sidebar-accent dark:group-hover:brightness-120";
const GOALS_PANEL_HEADER_CLASS =
  "widget-header flex w-full items-start gap-1.5 px-3.5 py-3.5";
const GOALS_PANEL_BODY_CLASS = "px-3.5 py-3.5";
const PANEL_ROW_PADDING_CLASS = "px-3.5 py-2.5 sm:px-3.5 sm:py-3";

function formatUsd(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function formatPct(value: number | null | undefined, fallback = "—") {
  if (value == null || Number.isNaN(value)) return fallback;
  return `${value.toFixed(2)}%`;
}

function getAccountBalance(account: any) {
  return parseFloat(account.liveBalance || account.initialBalance || "0");
}

function isFtmoFirm(firm?: PropFirmLike | null) {
  const id = String(firm?.id || "").toLowerCase();
  const displayName = String(firm?.displayName || "").toLowerCase();
  return id === FTMO_PROP_FIRM_ID || displayName === "ftmo";
}

function getSurvivalTone(state?: string | null) {
  switch (state) {
    case "critical":
      return {
        label: "Critical",
        badge: "ring-rose-500/30 bg-rose-500/15 text-rose-300",
      };
    case "fragile":
      return {
        label: "Fragile",
        badge: "ring-amber-500/30 bg-amber-500/15 text-amber-300",
      };
    case "tight":
      return {
        label: "Tight",
        badge: "ring-yellow-500/30 bg-yellow-500/15 text-yellow-300",
      };
    default:
      return {
        label: "Stable",
        badge: "ring-teal-500/30 bg-teal-500/15 text-teal-300",
      };
  }
}

function SectionHeader({
  icon: Icon,
  label,
  count,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <Icon className="size-3.5 text-white/45" />
      <h2 className="text-xs font-medium text-white/45">{label}</h2>
      <Badge
        variant="outline"
        className="h-5 rounded-sm ring-white/10 px-1.5 text-[10px] text-white/55"
      >
        {count}
      </Badge>
    </div>
  );
}

function OverviewStatCard({
  icon: Icon,
  label,
  value,
  hint,
  iconClassName,
  valueClassName,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  iconClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div className={GOALS_SURFACE_OUTER_CLASS}>
      <div className={cn(GOALS_SURFACE_INNER_CLASS, "p-3.5")}>
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4 text-white/60", iconClassName)} />
          <span className="text-xs text-white/50">{label}</span>
        </div>
        <Separator
          className={cn(WIDGET_CONTENT_SEPARATOR_CLASS, "mb-3.5 mt-3.5")}
        />
        <div
          className={cn("text-2xl font-semibold text-white", valueClassName)}
        >
          {value}
        </div>
        <p className="mt-0.5 text-xs text-white/40">{hint}</p>
      </div>
    </div>
  );
}

function OverviewPanel({
  icon: Icon,
  title,
  description,
  badge,
  bodyClassName,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={GOALS_SURFACE_OUTER_CLASS}>
      <div className={cn(GOALS_SURFACE_INNER_CLASS, "h-full")}>
        <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-sm ring ring-white/5 bg-sidebar p-2">
              <Icon className="h-4 w-4 text-white/60" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">{title}</h2>
              <p className="mt-0.5 text-xs text-white/40">{description}</p>
            </div>
          </div>
          {badge ? <div className="ml-auto shrink-0">{badge}</div> : null}
        </div>
        <Separator className={WIDGET_CONTENT_SEPARATOR_CLASS} />
        <div
          className={cn(
            "flex-1 overflow-hidden",
            GOALS_PANEL_BODY_CLASS,
            bodyClassName
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function CommandMetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-2 text-center md:py-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-white/40">{hint}</p>
    </div>
  );
}

function NextActionCard({
  accountName,
  survivalState,
  text,
}: {
  accountName: string;
  survivalState: SurvivalState;
  text: string;
}) {
  const tone = getSurvivalTone(survivalState);

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 transition-colors hover:bg-sidebar",
        PANEL_ROW_PADDING_CLASS
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "size-1.5 rounded-full",
              survivalState === "critical"
                ? "bg-rose-400"
                : survivalState === "fragile"
                ? "bg-amber-300"
                : survivalState === "tight"
                ? "bg-yellow-300"
                : "bg-teal-400"
            )}
          />
          <p className="truncate text-xs font-medium text-white">
            {accountName}
          </p>
        </div>
        <p className="mt-1 pl-4 text-xs leading-relaxed text-white/65">
          {text}
        </p>
      </div>
    </div>
  );
}

function PropFirmAvatar({
  firm,
  className,
}: {
  firm?: PropFirmLike | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-sm ring ring-white/10 bg-white/[0.04]",
        className
      )}
    >
      {isFtmoFirm(firm) ? (
        <Image
          src={FTMO_IMAGE_SRC}
          alt="FTMO"
          fill
          sizes="64px"
          className="object-contain p-2"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Trophy className="size-5 text-white/55" />
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className={GOALS_SURFACE_OUTER_CLASS}>
      <div
        className={cn(
          GOALS_SURFACE_INNER_CLASS,
          "min-h-[280px] items-center justify-center px-8 py-10 text-center"
        )}
      >
        <Trophy className="mb-4 size-10 text-white/20" />
        <h2 className="text-lg font-semibold text-white">No prop accounts</h2>
        <p className="mt-2 max-w-md text-sm text-white/40">
          Add your first prop firm challenge account to start tracking live rule
          status, survival headroom, and next actions.
        </p>
        <Link href="/dashboard/accounts?tab=prop" className="mt-6">
          <Button className="h-9 rounded-sm ring ring-white/5 bg-sidebar px-4 text-xs text-white hover:bg-sidebar-accent hover:brightness-110">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Prop Account
          </Button>
        </Link>
      </div>
    </div>
  );
}

function PropAccountFrame({
  title,
  headerRight,
  children,
}: {
  title: string;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <WidgetWrapper
      icon={Trophy}
      title={title}
      headerRight={headerRight}
      showHeader
      className="h-auto"
      contentClassName="h-auto flex-col justify-between p-6 py-3.5"
    >
      {children}
    </WidgetWrapper>
  );
}

function PropAccountCard({
  account,
  dashboard,
}: {
  account: any;
  dashboard?: any;
}) {
  const balance = getAccountBalance(account);
  const isFunded = isFundedPropTrackerAccount(account, dashboard);
  const propFirm = {
    id: account.propFirmId || dashboard?.propFirm?.id || "",
    displayName:
      dashboard?.propFirm?.displayName || account.broker || "Prop firm",
  };
  const currentProfitPercent =
    dashboard?.ruleCheck?.metrics?.currentProfitPercent ??
    parseFloat(account.propPhaseCurrentProfitPercent || "0");
  const tradingDays =
    dashboard?.ruleCheck?.metrics?.tradingDays ??
    account.propPhaseTradingDays ??
    0;
  const minTradingDays = dashboard?.currentPhase?.minTradingDays || 0;
  const hasPhase =
    account.propCurrentPhase !== null && account.propCurrentPhase !== undefined;
  const phaseLabel =
    account.propCurrentPhase === 0
      ? "Funded"
      : dashboard?.currentPhase?.name ||
        `Phase ${account.propCurrentPhase || 1}`;
  const phaseTarget = dashboard?.currentPhase?.profitTarget || 10;

  return (
    <PropAccountFrame
      title={propFirm.displayName}
      headerRight={
        <div className="flex items-center gap-1.5">
          <PropAccountStatusBadges
            account={account}
            dashboard={dashboard}
            badgeClassName={HEADER_BADGE_CLASS}
          />
          <RemovePropAccountButton
            accountId={account.id}
            accountName={account.name}
          />
        </div>
      }
    >
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <PropFirmAvatar
            firm={propFirm}
            className="size-12 shrink-0 rounded-full!"
          />
          <div>
            <p className="text-sm font-semibold text-white">
              {propFirm.displayName}
            </p>
            <p className="mt-0.5 text-xs font-medium text-white/50">
              {account.name}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-medium tracking-tight text-teal-400">
            {formatUsd(balance)}
          </p>
          <p
            className={cn(
              "text-xs font-medium",
              currentProfitPercent >= 0 ? "text-teal-300" : "text-red-300"
            )}
          >
            {currentProfitPercent >= 0 ? "+" : ""}
            {currentProfitPercent.toFixed(2)}%
          </p>
        </div>
      </div>

      <Separator
        className={cn(WIDGET_CONTENT_SEPARATOR_CLASS, "my-5 -mx-6!")}
      />

      {hasPhase ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="mt-1 text-sm font-semibold text-white">
                {phaseLabel}
              </p>
            </div>
            <div className="text-right">
              <p
                className={cn(
                  "mt-1 text-lg font-semibold",
                  currentProfitPercent >= 0 ? "text-teal-400" : "text-red-400"
                )}
              >
                {currentProfitPercent >= 0 ? "+" : ""}
                {currentProfitPercent.toFixed(2)}%
              </p>
            </div>
          </div>

          <Separator
            className={cn(WIDGET_CONTENT_SEPARATOR_CLASS, "my-5 -mx-6!")}
          />
        </>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-y-4">
        <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
          <p className="text-xs text-white/35">Trading days</p>
          <p className="mt-1 text-sm font-semibold text-white/85">
            {tradingDays}
            {minTradingDays > 0 ? ` / ${minTradingDays}` : ""}
          </p>
        </div>
        <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
          <p className="text-xs text-white/35">Max DD</p>
          <p className="mt-1 text-sm font-semibold text-white/85">
            {dashboard?.ruleCheck
              ? `${dashboard.ruleCheck.metrics.maxDrawdownPercent.toFixed(2)}%`
              : "—"}
          </p>
        </div>
        <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
          <p className="text-xs text-white/35">Daily DD</p>
          <p className="mt-1 text-sm font-semibold text-white/85">
            {dashboard?.ruleCheck
              ? `${dashboard.ruleCheck.metrics.dailyDrawdownPercent.toFixed(
                  2
                )}%`
              : "—"}
          </p>
        </div>
        <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
          <p className="text-xs text-white/35">Target</p>
          <p className="mt-1 text-sm font-semibold text-white/85">
            {phaseTarget}%
          </p>
        </div>
      </div>

      <Link
        href={`/dashboard/prop-tracker/${account.id}`}
        className="mt-5 block"
      >
        <Button
          className={getPropAssignActionButtonClassName({
            tone: "teal",
            size: "sm",
            className: "w-full gap-0.5",
          })}
        >
          View tracker
          <ChevronRight className="size-3" />
        </Button>
      </Link>
    </PropAccountFrame>
  );
}

export default function PropTrackerIndexPage() {
  const { data: accounts = [], isLoading } = useQuery(
    trpcOptions.accounts.list.queryOptions()
  );

  const propAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          account.isPropAccount && account.propIsCurrentChallengeStage !== false
      ),
    [accounts]
  );

  const dashboardQueries = useQueries({
    queries: propAccounts.map((account) => ({
      queryKey: ["propFirms.getTrackerDashboard", { accountId: account.id }],
      queryFn: () =>
        trpcClient.propFirms.getTrackerDashboard.query({
          accountId: account.id,
        }),
      staleTime: 10000,
      refetchInterval: 15000,
      retry: false,
    })),
  });

  const trackedAccounts = useMemo(
    () =>
      propAccounts
        .map((account, index) => ({
          account,
          dashboard: dashboardQueries[index]?.data,
        }))
        .filter((item) => Boolean(item.dashboard)),
    [dashboardQueries, propAccounts]
  );

  const dashboardByAccountId = useMemo(
    () =>
      new Map(
        trackedAccounts.map(
          ({ account, dashboard }) => [account.id, dashboard] as const
        )
      ),
    [trackedAccounts]
  );

  const portfolioCommandCenter = useMemo(() => {
    const challengeAccounts = trackedAccounts.filter(
      ({ account, dashboard }) =>
        !isFundedPropTrackerAccount(account, dashboard)
    );
    const fundedAccounts = trackedAccounts.filter(({ account, dashboard }) =>
      isFundedPropTrackerAccount(account, dashboard)
    );
    const activeAccounts = challengeAccounts.filter(
      ({ account, dashboard }) =>
        getEffectivePropTrackerStatus(account, dashboard) === "active"
    );
    const urgentAccounts = activeAccounts.filter(({ dashboard }) =>
      ["critical", "fragile"].includes(
        dashboard?.commandCenter?.survivalState || ""
      )
    );
    const nearTargetAccounts = activeAccounts.filter(
      ({ dashboard }) =>
        (dashboard?.commandCenter?.targetRemainingPct ?? Infinity) <= 1
    );
    const totalTargetRemaining =
      activeAccounts.length > 0
        ? activeAccounts.reduce(
            (sum, { dashboard }) =>
              sum + (dashboard?.commandCenter?.targetRemainingPct ?? 0),
            0
          )
        : null;
    const closestTargetAccount =
      activeAccounts.length > 0
        ? activeAccounts.reduce<{
            accountName: string;
            targetRemainingPct: number;
          } | null>((closest, { account, dashboard }) => {
            const targetRemainingPct =
              dashboard?.commandCenter?.targetRemainingPct;
            if (
              targetRemainingPct == null ||
              Number.isNaN(targetRemainingPct)
            ) {
              return closest;
            }

            if (
              !closest ||
              targetRemainingPct < closest.targetRemainingPct ||
              (targetRemainingPct === closest.targetRemainingPct &&
                account.name.localeCompare(closest.accountName) < 0)
            ) {
              return {
                accountName: account.name,
                targetRemainingPct,
              };
            }

            return closest;
          }, null)
        : null;
    const avgDailyHeadroom =
      activeAccounts.length > 0
        ? activeAccounts.reduce(
            (sum, { dashboard }) =>
              sum + (dashboard?.commandCenter?.dailyHeadroomPct ?? 0),
            0
          ) / activeAccounts.length
        : null;
    const avgMaxHeadroom =
      activeAccounts.length > 0
        ? activeAccounts.reduce(
            (sum, { dashboard }) =>
              sum + (dashboard?.commandCenter?.maxHeadroomPct ?? 0),
            0
          ) / activeAccounts.length
        : null;

    const nextActions = activeAccounts
      .flatMap(({ account, dashboard }) =>
        (dashboard?.commandCenter?.nextActions || [])
          .slice(0, 1)
          .map((action) => ({
            accountName: account.name,
            survivalState: (dashboard?.commandCenter?.survivalState ||
              "stable") as SurvivalState,
            text: action,
          }))
      )
      .sort((left, right) => {
        const severity = {
          critical: 4,
          fragile: 3,
          tight: 2,
          stable: 1,
        } satisfies Record<SurvivalState, number>;

        return severity[right.survivalState] - severity[left.survivalState];
      })
      .slice(0, 4);

    const status = urgentAccounts.some(
      ({ dashboard }) => dashboard?.commandCenter?.survivalState === "critical"
    )
      ? getSurvivalTone("critical")
      : urgentAccounts.length > 0
      ? getSurvivalTone("fragile")
      : getSurvivalTone("stable");

    return {
      total: challengeAccounts.length,
      active: activeAccounts.length,
      funded: fundedAccounts.length,
      urgent: urgentAccounts.length,
      nearTarget: nearTargetAccounts.length,
      totalTargetRemaining,
      closestTargetAccount,
      avgDailyHeadroom,
      avgMaxHeadroom,
      nextActions,
      status,
    };
  }, [trackedAccounts]);

  if (isLoading) {
    return (
      <main className="space-y-6 p-6 py-4">
        <div className="flex justify-end">
          <div className="h-9 w-36 animate-pulse rounded-sm ring ring-white/5 bg-sidebar" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((key) => (
            <div
              key={key}
              className="rounded-sm ring ring-white/5 bg-sidebar p-1.5"
            >
              <div className="h-28 animate-pulse rounded-sm bg-white ring ring-white/5 dark:bg-sidebar-accent" />
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          {[1, 2].map((key) => (
            <div
              key={key}
              className="rounded-sm ring ring-white/5 bg-sidebar p-1.5"
            >
              <div className="h-56 animate-pulse rounded-sm bg-white ring ring-white/5 dark:bg-sidebar-accent" />
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((key) => (
            <WidgetLoading key={key} className="h-auto min-h-[280px]" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6 p-6 py-4">
      {propAccounts.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <OverviewStatCard
              icon={Trophy}
              label="Active challenges"
              value={
                portfolioCommandCenter.total > 0
                  ? `${portfolioCommandCenter.active}/${portfolioCommandCenter.total}`
                  : "0"
              }
              hint="Accounts still in play"
              iconClassName="text-blue-400"
            />
            <OverviewStatCard
              icon={AlertTriangle}
              label="Urgent attention"
              value={`${portfolioCommandCenter.urgent}`}
              hint="Critical or fragile accounts"
              iconClassName="text-rose-400"
              valueClassName={
                portfolioCommandCenter.urgent > 0
                  ? "text-rose-300"
                  : "text-white"
              }
            />
            <OverviewStatCard
              icon={Target}
              label="Total target left"
              value={formatPct(portfolioCommandCenter.totalTargetRemaining)}
              hint="Combined across active challenges"
              iconClassName="text-amber-300"
            />
            <OverviewStatCard
              icon={Trophy}
              label="Closest account left"
              value={formatPct(
                portfolioCommandCenter.closestTargetAccount?.targetRemainingPct
              )}
              hint={
                portfolioCommandCenter.closestTargetAccount
                  ? `${portfolioCommandCenter.closestTargetAccount.accountName} is closest to target`
                  : "No active challenges"
              }
              iconClassName="text-yellow-300"
            />
            <OverviewStatCard
              icon={Shield}
              label="Near pass"
              value={`${portfolioCommandCenter.nearTarget}`}
              hint="Challenge accounts within 1.00% of target"
              iconClassName="text-teal-400"
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <OverviewPanel
              icon={Shield}
              title="Portfolio command center"
              description="Cross-account survival and pacing readout"
              badge={
                <Badge
                  variant="outline"
                  className={cn(
                    HEADER_BADGE_CLASS,
                    portfolioCommandCenter.status.badge
                  )}
                >
                  {portfolioCommandCenter.status.label}
                </Badge>
              }
            >
              <div className="flex h-full min-h-[168px] flex-col md:flex-row md:items-stretch">
                <CommandMetricCard
                  label="Average Daily Headroom"
                  value={formatPct(portfolioCommandCenter.avgDailyHeadroom)}
                  hint="Room before daily breach"
                />
                <Separator className="my-4 md:hidden" />
                <VerticalSeparator className="mx-5 hidden self-stretch md:block" />
                <CommandMetricCard
                  label="Average Max Headroom"
                  value={formatPct(portfolioCommandCenter.avgMaxHeadroom)}
                  hint="Overall challenge survival room"
                />
                <Separator className="my-4 md:hidden" />
                <VerticalSeparator className="mx-5 hidden self-stretch md:block" />
                <CommandMetricCard
                  label="Accounts Within Reach"
                  value={`${portfolioCommandCenter.nearTarget}`}
                  hint="Could pass with controlled execution"
                />
              </div>
            </OverviewPanel>

            <OverviewPanel
              icon={Target}
              title="Best next move"
              description="Prioritized actions from the live challenge state"
              bodyClassName="px-0 py-0 sm:px-0 sm:py-0"
            >
              <div className="flex flex-col">
                {portfolioCommandCenter.nextActions.length > 0 ? (
                  portfolioCommandCenter.nextActions.map((action, index) => {
                    return (
                      <div key={`${action.accountName}-${index}`}>
                        <NextActionCard
                          accountName={action.accountName}
                          survivalState={action.survivalState}
                          text={action.text}
                        />
                        {index <
                        portfolioCommandCenter.nextActions.length - 1 ? (
                          <Separator />
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-sm text-white/55">
                    No immediate corrective action. Current challenge states are
                    controlled.
                  </div>
                )}
              </div>
            </OverviewPanel>
          </section>

          <section className="space-y-3">
            <SectionHeader
              icon={Trophy}
              label="Prop accounts"
              count={propAccounts.length}
            />

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {propAccounts.map((account) => (
                <PropAccountCard
                  key={account.id}
                  account={account}
                  dashboard={dashboardByAccountId.get(account.id)}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
