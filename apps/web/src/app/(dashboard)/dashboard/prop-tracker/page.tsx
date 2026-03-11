"use client";

import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowRight,
  Plus,
  Shield,
  Target,
  Trophy,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpcClient, trpcOptions } from "@/utils/trpc";

type SurvivalState = "critical" | "fragile" | "tight" | "stable";

function getStatusColor(status: string | null) {
  switch (status) {
    case "active":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "passed":
      return "bg-green-100 text-green-700 border-green-200";
    case "failed":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function getSurvivalTone(state?: string | null) {
  switch (state) {
    case "critical":
      return {
        label: "Critical",
        badge: "bg-red-100 text-red-700 border-red-200",
      };
    case "fragile":
      return {
        label: "Fragile",
        badge: "bg-amber-100 text-amber-700 border-amber-200",
      };
    case "tight":
      return {
        label: "Tight",
        badge: "bg-yellow-100 text-yellow-700 border-yellow-200",
      };
    default:
      return {
        label: "Stable",
        badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
      };
  }
}

function formatPct(value: number | null | undefined, fallback = "0.00%") {
  if (value == null || Number.isNaN(value)) return fallback;
  return `${value.toFixed(2)}%`;
}

export default function PropTrackerIndexPage() {
  const { data: accounts = [], isLoading } = useQuery(
    trpcOptions.accounts.list.queryOptions()
  );

  const propAccounts = useMemo(
    () => accounts.filter((acc) => acc.isPropAccount),
    [accounts]
  );

  const dashboardQueries = useQueries({
    queries: propAccounts.map((account) => ({
      queryKey: ["propFirms.getTrackerDashboard", { accountId: account.id }],
      queryFn: () =>
        trpcClient.propFirms.getTrackerDashboard.query({ accountId: account.id }),
      staleTime: 10000,
      refetchInterval: 15000,
      retry: false,
    })),
  });

  const trackedAccounts = useMemo(() => {
    return propAccounts
      .map((account, index) => ({
        account,
        dashboard: dashboardQueries[index]?.data,
      }))
      .filter((item) => Boolean(item.dashboard));
  }, [
    propAccounts,
    dashboardQueries.map((query) => query.dataUpdatedAt).join(","),
  ]);

  const dashboardByAccountId = useMemo(
    () =>
      new Map(
        trackedAccounts.map(({ account, dashboard }) => [account.id, dashboard] as const)
      ),
    [trackedAccounts]
  );

  const portfolioCommandCenter = useMemo(() => {
    const activeAccounts = trackedAccounts.filter(
      ({ account }) => account.propPhaseStatus === "active"
    );
    const urgentAccounts = activeAccounts.filter(({ dashboard }) =>
      ["critical", "fragile"].includes(dashboard?.commandCenter?.survivalState || "")
    );
    const nearTargetAccounts = activeAccounts.filter(
      ({ dashboard }) =>
        (dashboard?.commandCenter?.targetRemainingPct ?? Infinity) <= 1
    );
    const avgTargetRemaining =
      activeAccounts.length > 0
        ? activeAccounts.reduce(
            (sum, { dashboard }) =>
              sum + (dashboard?.commandCenter?.targetRemainingPct ?? 0),
            0
          ) / activeAccounts.length
        : 0;
    const avgDailyHeadroom =
      activeAccounts.length > 0
        ? activeAccounts.reduce(
            (sum, { dashboard }) =>
              sum + (dashboard?.commandCenter?.dailyHeadroomPct ?? 0),
            0
          ) / activeAccounts.length
        : 0;
    const avgMaxHeadroom =
      activeAccounts.length > 0
        ? activeAccounts.reduce(
            (sum, { dashboard }) =>
              sum + (dashboard?.commandCenter?.maxHeadroomPct ?? 0),
            0
          ) / activeAccounts.length
        : 0;

    const nextActions = trackedAccounts
      .flatMap(({ account, dashboard }) =>
        (dashboard?.commandCenter?.nextActions || []).slice(0, 1).map((action) => ({
          accountName: account.name,
          survivalState: (dashboard?.commandCenter?.survivalState ||
            "stable") as SurvivalState,
          text: action,
        }))
      )
      .sort((a, b) => {
        const severity = {
          critical: 4,
          fragile: 3,
          tight: 2,
          stable: 1,
        } satisfies Record<SurvivalState, number>;
        return severity[b.survivalState] - severity[a.survivalState];
      })
      .slice(0, 4);

    const status =
      urgentAccounts.some(
        ({ dashboard }) => dashboard?.commandCenter?.survivalState === "critical"
      )
        ? getSurvivalTone("critical")
        : urgentAccounts.length > 0
          ? getSurvivalTone("fragile")
          : getSurvivalTone("stable");

    return {
      total: propAccounts.length,
      active: activeAccounts.length,
      urgent: urgentAccounts.length,
      nearTarget: nearTargetAccounts.length,
      avgTargetRemaining,
      avgDailyHeadroom,
      avgMaxHeadroom,
      nextActions,
      status,
    };
  }, [propAccounts.length, trackedAccounts]);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-muted-foreground">Loading prop accounts...</div>
      </div>
    );
  }

  return (
    <main className="space-y-4 p-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prop Challenge Tracker</h1>
          <p className="text-muted-foreground">
            Monitor challenge survival, pace, and next actions across every prop account
          </p>
        </div>
        <Link href="/dashboard/accounts?tab=prop">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Prop Account
          </Button>
        </Link>
      </div>

      {propAccounts.length === 0 ? (
        <Card className="p-12 text-center">
          <Trophy className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="mb-2 text-2xl font-semibold">No Prop Accounts Yet</h2>
          <p className="mb-6 text-muted-foreground">
            Get started by adding your first prop firm challenge account
          </p>
          <Link href="/dashboard/accounts?tab=prop">
            <Button size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Prop Account
            </Button>
          </Link>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="rounded-lg border p-6">
              <div className="mb-2 text-lg font-semibold">Real-time Monitoring</div>
              <p className="text-sm text-muted-foreground">
                Track daily loss, max drawdown, and profit targets in real-time
              </p>
            </div>
            <div className="rounded-lg border p-6">
              <div className="mb-2 text-lg font-semibold">Smart Alerts</div>
              <p className="text-sm text-muted-foreground">
                Get notified when approaching risk limits or achieving milestones
              </p>
            </div>
            <div className="rounded-lg border p-6">
              <div className="mb-2 text-lg font-semibold">Pass Probability</div>
              <p className="text-sm text-muted-foreground">
                Monte Carlo simulation to estimate your chances of passing
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Active challenges"
              value={`${portfolioCommandCenter.active}/${portfolioCommandCenter.total}`}
              hint="Accounts still in play"
            />
            <SummaryCard
              label="Urgent attention"
              value={`${portfolioCommandCenter.urgent}`}
              hint="Critical or fragile accounts"
              tone={
                portfolioCommandCenter.urgent > 0 ? "text-red-600" : "text-emerald-600"
              }
            />
            <SummaryCard
              label="Average target left"
              value={formatPct(portfolioCommandCenter.avgTargetRemaining)}
              hint="Across active challenges"
            />
            <SummaryCard
              label="Near pass"
              value={`${portfolioCommandCenter.nearTarget}`}
              hint="Within 1.00% of target"
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <Card className="overflow-hidden">
              <div className="border-b bg-gradient-to-r from-slate-50 to-slate-100 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-slate-600" />
                    <div>
                      <h2 className="font-semibold">Portfolio Command Center</h2>
                      <p className="text-xs text-muted-foreground">
                        Cross-account survival and pacing readout
                      </p>
                    </div>
                  </div>
                  <Badge className={portfolioCommandCenter.status.badge}>
                    {portfolioCommandCenter.status.label}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-4 p-4 md:grid-cols-3">
                <CommandStat
                  label="Average daily headroom"
                  value={formatPct(portfolioCommandCenter.avgDailyHeadroom)}
                  hint="Room before daily loss breach"
                />
                <CommandStat
                  label="Average max-loss headroom"
                  value={formatPct(portfolioCommandCenter.avgMaxHeadroom)}
                  hint="Overall challenge survival room"
                />
                <CommandStat
                  label="Accounts within reach"
                  value={`${portfolioCommandCenter.nearTarget}`}
                  hint="Could pass with controlled execution"
                />
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="border-b bg-gradient-to-r from-slate-50 to-slate-100 p-4">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-slate-600" />
                  <div>
                    <h2 className="font-semibold">Best Next Move</h2>
                    <p className="text-xs text-muted-foreground">
                      Prioritized actions from the live challenge state
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4">
                {portfolioCommandCenter.nextActions.length > 0 ? (
                  portfolioCommandCenter.nextActions.map((action, index) => {
                    const tone = getSurvivalTone(action.survivalState);
                    return (
                      <div
                        key={`${action.accountName}-${index}`}
                        className="rounded-lg border bg-muted/40 p-3"
                      >
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold">{action.accountName}</span>
                          <Badge className={tone.badge}>{tone.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{action.text}</p>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                    No immediate corrective action. Current challenge states are controlled.
                  </div>
                )}
              </div>
            </Card>
          </section>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {propAccounts.map((account) => (
              <PropAccountCard
                key={account.id}
                account={account}
                dashboard={dashboardByAccountId.get(account.id)}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${tone || ""}`}>{value}</div>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </Card>
  );
}

function CommandStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/40 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function PropAccountCard({
  account,
  dashboard,
}: {
  account: any;
  dashboard?: any;
}) {
  const currentProfitPercent = parseFloat(account.propPhaseCurrentProfitPercent || "0");
  const survivalTone = getSurvivalTone(dashboard?.commandCenter?.survivalState);

  return (
    <Link href={`/dashboard/prop-tracker/${account.id}`}>
      <Card className="group cursor-pointer overflow-hidden transition-all hover:shadow-lg">
        <div className="border-b bg-gradient-to-r from-blue-50 to-purple-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                <Trophy className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold">{dashboard?.propFirm?.displayName || "Prop Firm"}</h3>
                <p className="text-xs text-muted-foreground">{account.name}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge className={getStatusColor(account.propPhaseStatus)}>
                {account.propPhaseStatus?.toUpperCase() || "ACTIVE"}
              </Badge>
              <Badge className={survivalTone.badge}>{survivalTone.label}</Badge>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">
                {dashboard?.currentPhase?.name || `Phase ${account.propCurrentPhase || 1}`}
              </span>
              <span className="text-sm text-muted-foreground">
                {dashboard?.currentPhase?.profitTarget}% target
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Progress</span>
              <span
                className={`text-lg font-semibold ${
                  currentProfitPercent >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {currentProfitPercent >= 0 ? "+" : ""}
                {currentProfitPercent.toFixed(2)}%
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-green-500 transition-all"
                style={{
                  width: `${Math.min(
                    Math.max(
                      (currentProfitPercent / (dashboard?.currentPhase?.profitTarget || 10)) *
                        100,
                      0
                    ),
                    100
                  )}%`,
                }}
              />
            </div>
          </div>

          {dashboard?.ruleCheck ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded bg-muted p-2 text-center">
                <div className="text-xs text-muted-foreground">Target left</div>
                <div className="font-semibold">
                  {formatPct(dashboard.commandCenter?.targetRemainingPct)}
                </div>
              </div>
              <div className="rounded bg-muted p-2 text-center">
                <div className="text-xs text-muted-foreground">Required pace</div>
                <div className="font-semibold">
                  {dashboard.commandCenter?.requiredDailyPacePct != null
                    ? `${dashboard.commandCenter.requiredDailyPacePct.toFixed(2)}%/d`
                    : "N/A"}
                </div>
              </div>
              <div className="rounded bg-muted p-2 text-center">
                <div className="text-xs text-muted-foreground">Daily headroom</div>
                <div className="font-semibold">
                  {formatPct(dashboard.commandCenter?.dailyHeadroomPct)}
                </div>
              </div>
              <div className="rounded bg-muted p-2 text-center">
                <div className="text-xs text-muted-foreground">Max headroom</div>
                <div className="font-semibold">
                  {formatPct(dashboard.commandCenter?.maxHeadroomPct)}
                </div>
              </div>
            </div>
          ) : null}

          {dashboard?.commandCenter?.nextActions?.[0] ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                Best next move
              </div>
              <p className="text-sm text-amber-900">
                {dashboard.commandCenter.nextActions[0]}
              </p>
            </div>
          ) : null}

          <div className="flex items-center justify-between text-sm text-muted-foreground group-hover:text-primary">
            <span>View Full Tracker</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </Card>
    </Link>
  );
}
