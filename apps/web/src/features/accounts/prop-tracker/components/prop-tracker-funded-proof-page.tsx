"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@profitabledge/contracts/trpc";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock3,
  ShieldCheck,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import {
  GoalContentSeparator,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsListUnderlined,
  TabsTriggerUnderlined,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getAccountImage } from "@/features/accounts/lib/account-metadata";
import { PublicProofDrawdownCard } from "@/features/public-proof/components/public-proof-drawdown-card";
import { PublicProofEquityCurveCard } from "@/features/public-proof/components/public-proof-equity-curve-card";
import { PublicProofMonthlyReturnsCard } from "@/features/public-proof/components/public-proof-monthly-returns-card";
import { PublicProofTopSymbolsCard } from "@/features/public-proof/components/public-proof-top-symbols-card";
import {
  PublicProofTradesTable,
  type PublicProofTradeRow,
} from "@/features/public-proof/components/public-proof-trades-table";
import {
  formatDuration,
  formatR,
  formatTimestamp,
} from "@/features/public-proof/lib/public-proof-formatters";
import { formatCurrencyValue } from "@/features/dashboard/widgets/lib/widget-shared";
import { cn } from "@/lib/utils";
import { trpc, trpcOptions } from "@/utils/trpc";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type OwnedProofPageData = RouterOutputs["proof"]["getOwnedPage"];

function formatMoney(value: number, currencyCode?: string | null) {
  if (!Number.isFinite(value)) return "—";
  return formatCurrencyValue(value, currencyCode, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatProofDay(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatProofDate(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function getMetricToneClasses(
  tone?: "positive" | "warning" | "neutral" | "info"
) {
  return {
    valueClassName:
      tone === "positive"
        ? "text-teal-300"
        : tone === "warning"
        ? "text-amber-200"
        : tone === "info"
        ? "text-sky-300"
        : "text-white",
    iconClassName:
      tone === "positive"
        ? "text-teal-300"
        : tone === "warning"
        ? "text-amber-300"
        : tone === "info"
        ? "text-sky-300"
        : "text-white/50",
    railClassName:
      tone === "positive"
        ? "bg-teal-400"
        : tone === "warning"
        ? "bg-amber-400"
        : tone === "info"
        ? "bg-sky-400"
        : "bg-white/25",
  };
}

function ProofMetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "positive" | "warning" | "neutral" | "info";
}) {
  const { valueClassName, iconClassName, railClassName } =
    getMetricToneClasses(tone);

  return (
    <GoalSurface className="h-full w-full overflow-hidden">
      <div className="flex h-full min-h-0 flex-col p-3.5">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-3.5 w-3.5", iconClassName)} />
          <span className="text-xs text-white/50">{label}</span>
        </div>
        <GoalContentSeparator className="mb-3.5 mt-3.5" />
        <div className="flex min-h-0 flex-1 flex-col justify-end">
          <p
            className={cn(
              "text-2xl font-semibold tracking-tight",
              valueClassName
            )}
          >
            {value}
          </p>
          <p className="mt-1 text-xs leading-4 text-white/40">{detail}</p>
          <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
            <div className={cn("h-full w-full", railClassName)} />
          </div>
        </div>
      </div>
    </GoalSurface>
  );
}

function OverviewStatusCard({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: string;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="h-full">
          <GoalSurface className="h-full w-full">
            <div className="p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                {label}
              </p>
              <p className="mt-2 text-sm font-medium text-white">{value}</p>
            </div>
          </GoalSurface>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function ProofContentCard({
  label,
  description,
  icon: Icon,
  tone,
  rail,
  children,
}: {
  label: string;
  description: string;
  icon: LucideIcon;
  tone?: "positive" | "warning" | "neutral" | "info";
  rail?: ReactNode | null;
  children: ReactNode;
}) {
  const { iconClassName, railClassName } = getMetricToneClasses(tone);

  return (
    <GoalSurface className="h-full w-full overflow-hidden">
      <div className="flex h-full min-h-0 flex-col p-3.5">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-3.5 w-3.5", iconClassName)} />
          <span className="text-xs text-white/50">{label}</span>
        </div>
        <GoalContentSeparator className="mb-3.5 mt-3.5" />
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-[4.75rem] space-y-1.5">
            {children}
            <p className="text-xs leading-4 text-white/40">{description}</p>
          </div>
          {rail === null ? null : rail === undefined ? (
            <div className="relative mt-auto pt-4">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                <div className={cn("h-full w-full", railClassName)} />
              </div>
            </div>
          ) : (
            <div className="mt-auto pt-4">{rail}</div>
          )}
        </div>
      </div>
    </GoalSurface>
  );
}

export function PropTrackerFundedProofPage({
  accountId,
}: {
  accountId: string;
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [query, setQuery] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editFilter, setEditFilter] = useState("all");

  const pageQuery = trpc.proof.getOwnedPage.useQuery(
    { accountId },
    {
      enabled: Boolean(accountId),
      refetchInterval: 5_000,
      refetchIntervalInBackground: true,
    }
  );

  const tradesQuery = useInfiniteQuery({
    ...trpcOptions.proof.listOwnedTradesInfinite.infiniteQueryOptions(
      {
        accountId,
        limit: 40,
        q: query || undefined,
        outcomes:
          outcomeFilter === "all"
            ? undefined
            : [outcomeFilter as "Win" | "Loss" | "BE" | "PW"],
        originTypes:
          sourceFilter === "all"
            ? undefined
            : [sourceFilter as "broker_sync" | "csv_import" | "manual_entry"],
        statuses:
          statusFilter === "all"
            ? undefined
            : [statusFilter as "live" | "closed"],
        editedOnly: editFilter === "edited",
      },
      {
        getNextPageParam: (last) => last?.nextCursor,
      }
    ),
    enabled: pageQuery.status === "success",
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  });

  const rows = useMemo<PublicProofTradeRow[]>(() => {
    const pages = tradesQuery.data?.pages as
      | Array<{ items: PublicProofTradeRow[] }>
      | undefined;
    return pages?.flatMap((page) => page.items) ?? [];
  }, [tradesQuery.data]);

  if (pageQuery.isLoading) {
    return (
      <RouteLoadingFallback
        route="propTracker"
        className="min-h-[calc(100vh-10rem)]"
      />
    );
  }

  if (!pageQuery.data) {
    return (
      <div className="p-6 py-4">
        <GoalSurface className="w-full">
          <div className="p-6 text-sm text-white/55">
            Unable to load funded proof view for this account.
          </div>
        </GoalSurface>
      </div>
    );
  }

  const page = pageQuery.data as OwnedProofPageData;
  const trustStartedAt = formatProofDate(page.proof.auditCoverageStartsAt);
  const lastUpdatedTitle =
    page.proof.connectionKind === "demo" ? "Source" : "Last updated";
  const lastUpdatedLabel =
    page.proof.connectionKind === "demo"
      ? "Provided by Profitabledge"
      : page.proof.lastSyncedAt
      ? formatTimestamp(page.proof.lastSyncedAt)
      : "No update timestamp";
  const totalSourceTrades =
    page.trust.sourceCounts.brokerSync +
    page.trust.sourceCounts.csvImport +
    page.trust.sourceCounts.manualEntry;
  const sourceSegments = [
    {
      key: "broker_sync",
      count: page.trust.sourceCounts.brokerSync,
      className: "bg-teal-400",
      label: "Broker",
    },
    {
      key: "csv_import",
      count: page.trust.sourceCounts.csvImport,
      className: "bg-amber-400",
      label: "CSV",
    },
    {
      key: "manual_entry",
      count: page.trust.sourceCounts.manualEntry,
      className: "bg-white/35",
      label: "Manual",
    },
  ];
  const topSymbolRows = page.stats.topSymbols.map((symbol) => ({
    label: symbol.symbol,
    value: symbol.totalProfit,
  }));
  const editedTradesPercent =
    page.summary.totalTrades > 0
      ? (page.trust.editedTradesCount / page.summary.totalTrades) * 100
      : 0;
  const activeSourceSegments = sourceSegments.filter(
    (segment) => segment.count > 0
  );
  const sourceMixHeadline =
    activeSourceSegments.length === 1
      ? activeSourceSegments[0]!.key === "broker_sync"
        ? `${activeSourceSegments[0]!.count.toLocaleString()} trades on broker account`
        : activeSourceSegments[0]!.key === "csv_import"
        ? `${activeSourceSegments[0]!.count.toLocaleString()} trades imported from CSV`
        : `${activeSourceSegments[0]!.count.toLocaleString()} trades manually entered`
      : `${page.summary.totalTrades.toLocaleString()} trades across ${
          activeSourceSegments.length
        } sources`;
  const editedTradesHeadline =
    page.trust.editedTradesCount === 1
      ? "1 edited trade"
      : `${page.trust.editedTradesCount.toLocaleString()} edited trades`;
  const editedTradesDescription =
    page.trust.editedTradesCount > 0
      ? `${editedTradesPercent.toFixed(
          1
        )}% of account rows were changed after import or sync.`
      : "No account rows have been changed after import or sync.";

  return (
    <div className="min-h-screen h-full w-full bg-sidebar text-white">
      <div className="relative">
        <div className="relative h-52 md:h-64">
          {page.trader.profileBannerUrl ? (
            <img
              src={page.trader.profileBannerUrl}
              alt="Cover"
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                objectPosition: page.trader.profileBannerPosition ?? "50% 50%",
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,224,200,0.18),transparent_32%),linear-gradient(135deg,rgba(10,14,20,0.98),rgba(12,17,24,0.92))]" />
          )}
        </div>

        <div className="relative px-4 md:px-6 lg:px-8">
          <div className="-mt-12 flex items-center justify-between gap-4 pb-4">
            <Avatar className="size-[72px] rounded-full ring-4 ring-sidebar shadow-lg">
              {page.trader.image ? (
                <AvatarImage
                  src={page.trader.image}
                  alt={page.trader.name ?? page.trader.username}
                  className="object-cover"
                />
              ) : null}
              <AvatarFallback className="bg-sidebar-accent text-foreground text-xl font-semibold">
                {(page.trader.name ?? page.trader.username)
                  ?.charAt(0)
                  ?.toUpperCase() ?? "T"}
              </AvatarFallback>
            </Avatar>

            <Badge className="rounded-sm ring-1 ring-amber-400/25 bg-amber-400/10 text-[10px] uppercase tracking-[0.05em] text-amber-200">
              Funded account
            </Badge>
          </div>

          <div className="flex w-full flex-col gap-5 py-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 space-y-4">
              <div className="space-y-2">
                <p className="text-xs text-teal-300/80">Private funded proof</p>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                    {page.account.name}
                  </h1>
                  <div className="mt-2 flex items-center gap-1.5">
                    <img
                      src={getAccountImage({ broker: page.account.broker })}
                      alt={page.account.broker ?? "Broker"}
                      className="size-4 rounded-sm object-contain"
                    />
                    {page.account.broker ? (
                      <span className="text-sm text-white/55">
                        {page.account.broker}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-sm ring-1 ring-amber-400/25 bg-amber-400/10 text-[10px] uppercase tracking-[0.05em] text-amber-200">
                  Funded
                </Badge>
                <Badge className="rounded-sm ring-1 ring-white/10 bg-white/5 text-[10px] uppercase tracking-[0.05em] text-white/70">
                  {page.proof.connectionLabel}
                </Badge>
                <Badge className="rounded-sm ring-1 ring-white/10 bg-white/5 text-[10px] uppercase tracking-[0.05em] text-white/70">
                  {page.proof.verificationLabel}
                </Badge>
                <Badge
                  className={cn(
                    "rounded-sm ring-1 text-[10px] uppercase tracking-[0.05em]",
                    page.summary.openTradesCount > 0
                      ? "ring-teal-500/25 bg-teal-500/15 text-teal-300"
                      : "ring-white/10 bg-white/5 text-white/60"
                  )}
                >
                  {page.proof.liveStatusLabel}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/45">
                <span>
                  {lastUpdatedTitle}: {lastUpdatedLabel}
                </span>
                <span>Audit coverage: {trustStartedAt}</span>
                <span>
                  Source mix: {page.trust.sourceBadges.length || 1} channel
                  {page.trust.sourceBadges.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div className="px-4 pb-10 pt-10 md:px-6 lg:px-8">
        <div className="w-full space-y-6">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="shrink-0 bg-background dark:bg-sidebar">
              <div className="overflow-x-auto">
                <TabsListUnderlined className="flex h-auto min-w-full items-stretch gap-5 border-b-0">
                  <TabsTriggerUnderlined
                    value="overview"
                    className="h-10 pb-0 pt-0 text-xs font-medium text-secondary dark:text-neutral-400 hover:text-secondary dark:hover:text-neutral-200 data-[state=active]:border-teal-400 data-[state=active]:text-teal-400"
                  >
                    Overview
                  </TabsTriggerUnderlined>
                  <TabsTriggerUnderlined
                    value="trades"
                    className="h-10 pb-0 pt-0 text-xs font-medium text-secondary dark:text-neutral-400 hover:text-secondary dark:hover:text-neutral-200 data-[state=active]:border-teal-400 data-[state=active]:text-teal-400"
                  >
                    Trades
                  </TabsTriggerUnderlined>
                  <TabsTriggerUnderlined
                    value="stats"
                    className="h-10 pb-0 pt-0 text-xs font-medium text-secondary dark:text-neutral-400 hover:text-secondary dark:hover:text-neutral-200 data-[state=active]:border-teal-400 data-[state=active]:text-teal-400"
                  >
                    Stats
                  </TabsTriggerUnderlined>
                  <TabsTriggerUnderlined
                    value="trust"
                    className="h-10 pb-0 pt-0 text-xs font-medium text-secondary dark:text-neutral-400 hover:text-secondary dark:hover:text-neutral-200 data-[state=active]:border-teal-400 data-[state=active]:text-teal-400"
                  >
                    Trust
                  </TabsTriggerUnderlined>
                </TabsListUnderlined>
              </div>
              <Separator />
            </div>

            <TabsContent value="overview" className="mt-6 space-y-6">
              <div className="grid w-full gap-4 md:grid-cols-2 xl:grid-cols-4">
                <OverviewStatusCard
                  label="Connection"
                  value={page.proof.connectionLabel}
                  tooltip="How this funded account’s trades are sourced into the proof view."
                />
                <OverviewStatusCard
                  label="Verification"
                  value={page.proof.verificationLabel}
                  tooltip="The trust tier currently attached to this funded account."
                />
                <OverviewStatusCard
                  label="Live status"
                  value={page.proof.liveStatusLabel}
                  tooltip="Whether the account appears to be updating right now."
                />
                <OverviewStatusCard
                  label="Audit coverage"
                  value={page.proof.legacyAuditGap ? "Legacy gap" : "Full coverage"}
                  tooltip="Whether edit and deletion trust tracking covers the full funded-account history."
                />
              </div>

              <div className="grid w-full gap-4 md:grid-cols-2 xl:grid-cols-6">
                <ProofMetricCard
                  label="Net P&L"
                  value={formatMoney(page.summary.totalPnl, page.account.currency)}
                  detail="Closed-history realized profit and loss."
                  icon={TrendingUp}
                  tone={page.summary.totalPnl >= 0 ? "positive" : "warning"}
                />
                <ProofMetricCard
                  label="Floating P&L"
                  value={formatMoney(
                    page.summary.floatingPnl,
                    page.account.currency
                  )}
                  detail="Live open-position profit and loss right now."
                  icon={Activity}
                  tone={page.summary.floatingPnl >= 0 ? "positive" : "warning"}
                />
                <ProofMetricCard
                  label="Win rate"
                  value={`${page.summary.winRate.toFixed(1)}%`}
                  detail="Closed winning outcomes relative to closed losing history."
                  icon={ShieldCheck}
                  tone="positive"
                />
                <ProofMetricCard
                  label="Profit factor"
                  value={page.summary.profitFactor.toFixed(2)}
                  detail="Gross profit divided by gross loss on closed trades."
                  icon={BarChart3}
                  tone="info"
                />
                <ProofMetricCard
                  label="Average RR"
                  value={formatR(page.summary.averageRR)}
                  detail="Average realized reward to risk across closed trades."
                  icon={TrendingUp}
                  tone="info"
                />
                <ProofMetricCard
                  label="Open trades"
                  value={page.summary.openTradesCount.toLocaleString()}
                  detail="Positions that are live on the connected account now."
                  icon={Clock3}
                  tone={
                    page.summary.openTradesCount > 0 ? "positive" : "neutral"
                  }
                />
              </div>

              <div className="grid w-full gap-4 2xl:grid-cols-3">
                <PublicProofEquityCurveCard
                  points={page.summary.curve}
                  currencyCode={page.account.currency}
                />
                <PublicProofDrawdownCard
                  points={page.summary.drawdownCurve}
                  baseline={page.summary.initialBalance}
                  currencyCode={page.account.currency}
                />
                <PublicProofMonthlyReturnsCard
                  rows={page.stats.monthlyReturns}
                  currencyCode={page.account.currency}
                />
              </div>

              <div className="grid w-full gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <GoalSurface className="h-full w-full overflow-hidden">
                  <div className="p-3.5">
                    <div className="flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5 text-teal-300" />
                      <span className="text-xs text-white/50">Open trades</span>
                    </div>
                    <GoalContentSeparator className="mb-3.5 mt-3.5" />
                    <div className="flex items-end justify-between gap-3">
                      <div className="text-xl font-semibold text-white">
                        {page.summary.openTradesCount > 0
                          ? `${page.summary.openTradesCount} live position${
                              page.summary.openTradesCount === 1 ? "" : "s"
                            }`
                          : "No live exposure"}
                      </div>
                      <span
                        className={cn(
                          "text-[12px]",
                          page.summary.floatingPnl >= 0
                            ? "text-teal-300"
                            : "text-rose-300"
                        )}
                      >
                        {formatMoney(
                          page.summary.floatingPnl,
                          page.account.currency
                        )}{" "}
                        floating
                      </span>
                    </div>
                    <p className="min-h-[20px] text-[11px] leading-4 text-white/40">
                      Live positions currently visible on the connected account.
                    </p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full bg-teal-400"
                        style={{
                          width: `${Math.max(
                            page.summary.openTradesCount > 0 ? 18 : 8,
                            Math.min(page.summary.openTradesCount * 18, 100)
                          )}%`,
                        }}
                      />
                    </div>

                    <div className="mt-4 space-y-3">
                      {page.liveTrades.length > 0 ? (
                        page.liveTrades.map((trade) => (
                          <div
                            key={trade.id}
                            className="flex items-center justify-between gap-4 rounded-sm bg-white/[0.03] px-3 py-3 ring-1 ring-white/6"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white">
                                {trade.symbol || "Unknown"}
                              </p>
                              <p className="mt-1 text-xs text-white/45">
                                {trade.tradeType === "short" ? "Short" : "Long"}{" "}
                                · {trade.volume ?? "—"} lots · Open for{" "}
                                {formatDuration(trade.durationSeconds)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p
                                className={cn(
                                  "text-sm font-semibold",
                                  (trade.profit ?? 0) >= 0
                                    ? "text-teal-300"
                                    : "text-rose-300"
                                )}
                              >
                                {trade.profit != null
                                  ? formatMoney(
                                      trade.profit,
                                      page.account.currency
                                    )
                                  : "—"}
                              </p>
                              <p className="mt-1 text-xs text-white/45">
                                Entry {trade.openPrice ?? "—"} · Current{" "}
                                {trade.closePrice ?? "—"}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-white/45">
                          This funded account will surface live positions here
                          whenever the connected account has open trades.
                        </p>
                      )}
                    </div>
                  </div>
                </GoalSurface>

                <PublicProofTopSymbolsCard
                  rows={topSymbolRows}
                  currencyCode={page.account.currency}
                />
              </div>
            </TabsContent>

            <TabsContent value="trades" className="mt-6 space-y-3 bg-sidebar">
              <PublicProofTradesTable
                rows={rows}
                searchValue={query}
                onSearchChange={setQuery}
                outcomeFilter={outcomeFilter}
                onOutcomeFilterChange={setOutcomeFilter}
                sourceFilter={sourceFilter}
                onSourceFilterChange={setSourceFilter}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                editFilter={editFilter}
                onEditFilterChange={setEditFilter}
                isLoading={tradesQuery.isLoading}
                hasNextPage={tradesQuery.hasNextPage}
                isFetchingNextPage={tradesQuery.isFetchingNextPage}
                onLoadMore={() => tradesQuery.fetchNextPage()}
              />
            </TabsContent>

            <TabsContent value="stats" className="mt-6 space-y-6">
              <div className="grid w-full gap-4 md:grid-cols-2 xl:grid-cols-4">
                <ProofMetricCard
                  label="Expectancy"
                  value={formatMoney(page.stats.expectancy, page.account.currency)}
                  detail="Average expected profit or loss per closed trade."
                  icon={TrendingUp}
                  tone={page.stats.expectancy >= 0 ? "positive" : "warning"}
                />
                <ProofMetricCard
                  label="Average win"
                  value={formatMoney(page.stats.avgWin, page.account.currency)}
                  detail="Average result of closed winning trades."
                  icon={ShieldCheck}
                  tone="positive"
                />
                <ProofMetricCard
                  label="Average loss"
                  value={formatMoney(
                    -Math.abs(page.stats.avgLoss),
                    page.account.currency
                  )}
                  detail="Average magnitude of closed losing trades."
                  icon={AlertTriangle}
                  tone="warning"
                />
                <ProofMetricCard
                  label="Median RR"
                  value={formatR(page.summary.medianRR)}
                  detail="Middle realized reward to risk across closed trades."
                  icon={BarChart3}
                  tone="info"
                />
                <ProofMetricCard
                  label="Best trade"
                  value={formatMoney(page.stats.bestTrade, page.account.currency)}
                  detail="Single best closed trade in this funded record."
                  icon={TrendingUp}
                  tone="positive"
                />
                <ProofMetricCard
                  label="Worst trade"
                  value={formatMoney(page.stats.worstTrade, page.account.currency)}
                  detail="Single worst closed trade in this funded record."
                  icon={AlertTriangle}
                  tone="warning"
                />
                <ProofMetricCard
                  label="Average hold"
                  value={formatDuration(page.stats.avgTradeDurationSeconds)}
                  detail="Average time spent in a closed position."
                  icon={Clock3}
                  tone="neutral"
                />
                <ProofMetricCard
                  label="Longest win streak"
                  value={page.stats.longestWinStreak.toString()}
                  detail="Longest run of closed winning trades."
                  icon={ShieldCheck}
                  tone="positive"
                />
              </div>

              <div className="grid w-full items-stretch gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <PublicProofMonthlyReturnsCard
                  rows={page.stats.monthlyReturns}
                  currencyCode={page.account.currency}
                />

                <div className="grid h-[28rem] grid-rows-2 gap-4">
                  <ProofContentCard
                    label="Best day"
                    description="Strongest net closed-trade day in the funded record."
                    icon={TrendingUp}
                    tone="positive"
                  >
                    <p className="text-2xl font-semibold tracking-tight text-teal-300">
                      {page.stats.bestDay
                        ? formatMoney(page.stats.bestDay.pnl, page.account.currency)
                        : "—"}
                    </p>
                    <p className="text-sm text-white/60">
                      {formatProofDay(page.stats.bestDay?.day)}
                    </p>
                  </ProofContentCard>
                  <ProofContentCard
                    label="Worst day"
                    description="Weakest net closed-trade day in the funded record."
                    icon={AlertTriangle}
                    tone="warning"
                  >
                    <p className="text-2xl font-semibold tracking-tight text-amber-200">
                      {page.stats.worstDay
                        ? formatMoney(
                            page.stats.worstDay.pnl,
                            page.account.currency
                          )
                        : "—"}
                    </p>
                    <p className="text-sm text-white/60">
                      {formatProofDay(page.stats.worstDay?.day)}
                    </p>
                  </ProofContentCard>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="trust" className="mt-6 space-y-6">
              <div className="grid w-full gap-4 md:grid-cols-2 xl:grid-cols-4">
                <ProofContentCard
                  label="Source mix"
                  description="Shows the weighting of broker-synced, CSV-imported, and manually entered trades in this funded ledger."
                  icon={Activity}
                  tone="info"
                  rail={
                    <div className="flex h-1.5 overflow-hidden rounded-full bg-white/8">
                      {sourceSegments.map((segment) => (
                        <div
                          key={segment.key}
                          className={segment.className}
                          style={{
                            width:
                              totalSourceTrades > 0
                                ? `${(segment.count / totalSourceTrades) * 100}%`
                                : 0,
                          }}
                        />
                      ))}
                    </div>
                  }
                >
                  <p className="text-2xl font-semibold tracking-tight text-sky-300">
                    {sourceMixHeadline}
                  </p>
                </ProofContentCard>

                <ProofContentCard
                  label="Verification"
                  description="Account-level connection and verification state for this funded account."
                  icon={ShieldCheck}
                  tone="info"
                >
                  <p className="text-2xl font-semibold tracking-tight text-sky-300">
                    {page.proof.connectionLabel}
                  </p>
                </ProofContentCard>

                <ProofContentCard
                  label="Edited trades"
                  description={editedTradesDescription}
                  icon={BarChart3}
                  tone="warning"
                  rail={
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full bg-amber-400"
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(editedTradesPercent, 100)
                          )}%`,
                        }}
                      />
                    </div>
                  }
                >
                  <p className="text-2xl font-semibold tracking-tight text-amber-200">
                    {editedTradesHeadline}
                  </p>
                </ProofContentCard>

                <ProofContentCard
                  label="Audit coverage"
                  description={`Edits and removed imported or synced trades are tracked from ${trustStartedAt}.`}
                  icon={AlertTriangle}
                  tone={page.proof.legacyAuditGap ? "warning" : "positive"}
                >
                  <p
                    className={cn(
                      "text-2xl font-semibold tracking-tight",
                      page.proof.legacyAuditGap
                        ? "text-amber-200"
                        : "text-teal-300"
                    )}
                  >
                    {page.proof.legacyAuditGap ? "Legacy gap" : "Full coverage"}
                  </p>
                </ProofContentCard>
              </div>

              <GoalSurface className="w-full">
                <div className="p-5">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/40">
                    Trust facts
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    Funded-account integrity summary
                  </p>
                  <GoalContentSeparator className="mb-4 mt-4" />
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-sm bg-white/[0.03] px-4 py-4 ring-1 ring-white/6">
                      <p className="text-xs text-white/40">
                        Removed imported/synced
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {page.trust.removedTradesCount}
                      </p>
                    </div>
                    <div className="rounded-sm bg-white/[0.03] px-4 py-4 ring-1 ring-white/6">
                      <p className="text-xs text-white/40">{lastUpdatedTitle}</p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {lastUpdatedLabel}
                      </p>
                    </div>
                    <div className="rounded-sm bg-white/[0.03] px-4 py-4 ring-1 ring-white/6">
                      <p className="text-xs text-white/40">Open positions</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {page.summary.openTradesCount}
                      </p>
                    </div>
                    <div className="rounded-sm bg-white/[0.03] px-4 py-4 ring-1 ring-white/6">
                      <p className="text-xs text-white/40">Audit start</p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {trustStartedAt}
                      </p>
                    </div>
                  </div>
                </div>
              </GoalSurface>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
