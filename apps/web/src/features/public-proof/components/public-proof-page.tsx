"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@profitabledge/contracts/trpc";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronRight,
  Clock3,
  Copy,
  ShieldCheck,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  GoalContentSeparator,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Tabs,
  TabsContent,
  TabsListUnderlined,
  TabsTriggerUnderlined,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  getConnectionBadgeClassName,
  getOriginBadgeClassName,
} from "@/features/public-proof/lib/public-proof-badges";
import {
  formatCurrency,
  formatDuration,
  formatR,
  formatTimestamp,
} from "@/features/public-proof/lib/public-proof-formatters";
import { PublicProofDrawdownCard } from "@/features/public-proof/components/public-proof-drawdown-card";
import { PublicProofEquityCurveCard } from "@/features/public-proof/components/public-proof-equity-curve-card";
import { PublicProofMonthlyReturnsCard } from "@/features/public-proof/components/public-proof-monthly-returns-card";
import { PublicProofTopSymbolsCard } from "@/features/public-proof/components/public-proof-top-symbols-card";
import {
  PublicProofTradesTable,
  type PublicProofTradeRow,
} from "@/features/public-proof/components/public-proof-trades-table";
import { trpcOptions } from "@/utils/trpc";

import { getPropAssignActionButtonClassName } from "@/features/accounts/lib/prop-assign-action-button";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type PublicProofPageData = RouterOutputs["proof"]["getPublicPage"];

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

function formatProofDay(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatProofDate(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
    <GoalSurface className="w-full h-full overflow-hidden">
      <div className="p-3.5 pb-12">
        <div className="flex items-center  gap-2">
          <Icon className={cn("h-3.5 w-3.5", iconClassName)} />
          <span className="text-xs text-white/50">{label}</span>
        </div>
        <GoalContentSeparator className="mb-3.5 mt-3.5" />
        <div className="flex flex-col justify-end h-full">
          <p
            className={cn(
              "text-2xl font-semibold tracking-tight",
              valueClassName
            )}
          >
            {value}
          </p>
          <p className="mt-1 text-xs leading-4 text-white/40">{detail}</p>

          <div className="mt-3 mb-4 h-1.5 rounded-full bg-white/8 relative overflow-hidden">
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
    <GoalSurface className="w-full h-full overflow-hidden">
      <div className="p-3.5 pb-12">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-3.5 w-3.5", iconClassName)} />
          <span className="text-xs text-white/50">{label}</span>
        </div>
        <GoalContentSeparator className="mb-3.5 mt-3.5" />
        <div className="flex h-full flex-col justify-end">
          {children}
          <p className="mt-1 text-xs leading-4 text-white/40">{description}</p>
          {rail === null ? null : rail === undefined ? (
            <div className="relative mb-4 mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
              <div className={cn("h-full w-full", railClassName)} />
            </div>
          ) : (
            <div className="mb-4 mt-3">{rail}</div>
          )}
        </div>
      </div>
    </GoalSurface>
  );
}

export function PublicProofPage({
  username,
  publicAccountSlug,
}: {
  username: string;
  publicAccountSlug: string;
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [query, setQuery] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editFilter, setEditFilter] = useState("all");

  const pageQuery = useQuery(
    trpcOptions.proof.getPublicPage.queryOptions({
      username,
      publicAccountSlug,
    })
  );

  const tradeQueryOptions =
    trpcOptions.proof.listPublicTradesInfinite.infiniteQueryOptions(
      {
        username,
        publicAccountSlug,
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
        getNextPageParam: (last: any) => last?.nextCursor,
      }
    );

  const tradesQuery = useInfiniteQuery({
    ...tradeQueryOptions,
    enabled: pageQuery.status === "success",
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  const rows = useMemo<PublicProofTradeRow[]>(() => {
    const pages = tradesQuery.data?.pages as
      | Array<{ items: any[] }>
      | undefined;
    return pages?.flatMap((page) => page.items) ?? [];
  }, [tradesQuery.data]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Proof link copied.");
  };

  if (pageQuery.isLoading) {
    return (
      <div className="min-h-screen w-full bg-sidebar px-4 py-20 text-white md:px-6 lg:px-8">
        <div className="w-full animate-pulse space-y-6">
          <div className="h-8 w-48 rounded-sm bg-white/5" />
          <div className="h-32 w-full rounded-lg bg-sidebar p-1">
            <div className="h-full w-full rounded-sm bg-white/5" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-48 rounded-lg bg-sidebar p-1">
                <div className="h-full w-full rounded-sm bg-white/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (pageQuery.error || !pageQuery.data) {
    return (
      <div className="min-h-screen h-full w-full bg-sidebar px-4 py-24 text-white md:px-6 lg:px-8">
        <div className="w-full">
          <GoalSurface className="mx-auto w-full max-w-3xl">
            <div className="px-8 py-10 text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-white/35">
                Public proof
              </p>
              <h1 className="mt-4 text-3xl font-semibold">
                Proof page unavailable
              </h1>
              <p className="mt-4 text-sm leading-6 text-white/55">
                {pageQuery.error?.message ||
                  "This public proof link is invalid, revoked, or no longer active."}
              </p>
              <Button
                className="mt-6 rounded-sm bg-teal-500 text-black hover:bg-teal-400"
                asChild
              >
                <Link href="/sign-up">Create your own proof page</Link>
              </Button>
            </div>
          </GoalSurface>
        </div>
      </div>
    );
  }

  const page = pageQuery.data as PublicProofPageData;
  const trustStartedAt = formatProofDate(page.proof.auditCoverageStartsAt);
  const lastSyncedLabel = page.proof.lastSyncedAt
    ? formatTimestamp(page.proof.lastSyncedAt)
    : "No sync timestamp";
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
        )}% of public rows were changed after import or sync.`
      : "No public rows have been changed after import or sync.";

  return (
    <div className="min-h-screen h-full w-full bg-sidebar px-4 py-10 text-white md:px-6 lg:px-8">
      <div className="w-full space-y-6 bg-sidebar">
        <GoalSurface className="w-full">
          <div className="flex w-full flex-col gap-5 px-5 py-6 md:px-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 space-y-4">
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.24em] text-teal-300/80">
                  Public proof page
                </p>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                    {page.account.name}
                  </h1>
                  <p className="mt-2 text-sm text-white/55">
                    @{page.trader.username}
                    {page.account.broker ? ` · ${page.account.broker}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={cn(
                    "rounded-sm ring-1 text-[10px] uppercase tracking-[0.14em]",
                    getConnectionBadgeClassName(page.proof.connectionKind)
                  )}
                >
                  {page.proof.connectionLabel}
                </Badge>
                <Badge className="rounded-sm ring-1 ring-white/10 bg-white/5 text-[10px] uppercase tracking-[0.14em] text-white/70">
                  {page.proof.verificationLabel}
                </Badge>
                <Badge
                  className={cn(
                    "rounded-sm ring-1 text-[10px] uppercase tracking-[0.14em]",
                    page.summary.openTradesCount > 0
                      ? "ring-teal-500/25 bg-teal-500/15 text-teal-300"
                      : "ring-white/10 bg-white/5 text-white/60"
                  )}
                >
                  {page.proof.liveStatusLabel}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/45">
                <span>Last synced: {lastSyncedLabel}</span>
                <span>Open trades: {page.summary.openTradesCount}</span>
                <span>Audit coverage: {trustStartedAt}</span>
                <span>
                  Source mix: {page.trust.sourceBadges.length || 1} channel
                  {page.trust.sourceBadges.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="rounded-sm ring-white/8! text-white/75 bg-transparent! h-8! text-xs!"
                onClick={copyLink}
              >
                <Copy className="size-3" />
                Copy link
              </Button>

              <Link
                href="/sign-up"
                className={cn(
                  buttonVariants({}),
                  getPropAssignActionButtonClassName({
                    tone: "teal",
                    size: "sm",
                    className: "w-max! gap-0.5",
                  })
                )}
              >
                Build your own
                <ChevronRight className="size-3" />
              </Link>
            </div>
          </div>
        </GoalSurface>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="shrink-0 bg-background dark:bg-sidebar">
            <div className="overflow-x-auto px-4 sm:px-6 lg:px-8">
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
                tooltip="How this account’s trades are sourced into the proof page, such as API sync, EA sync, CSV import, or manual entry."
              />
              <OverviewStatusCard
                label="Verification"
                value={page.proof.verificationLabel}
                tooltip="The trust tier currently attached to this account based on verification state and broker connectivity."
              />
              <OverviewStatusCard
                label="Live status"
                value={page.proof.liveStatusLabel}
                tooltip="Whether the account appears to be actively syncing right now based on its latest sync activity."
              />
              <OverviewStatusCard
                label="Audit coverage"
                value={
                  page.proof.legacyAuditGap ? "Legacy gap" : "Full coverage"
                }
                tooltip="Whether edit and deletion trust tracking covers the full public history or only trades recorded after proof tracking began."
              />
            </div>

            <div className="grid w-full gap-4 md:grid-cols-2 xl:grid-cols-6">
              <ProofMetricCard
                label="Net P&L"
                value={formatCurrency(page.summary.totalPnl)}
                detail="Closed-history realized profit and loss."
                icon={TrendingUp}
                tone={page.summary.totalPnl >= 0 ? "positive" : "warning"}
              />
              <ProofMetricCard
                label="Floating P&L"
                value={formatCurrency(page.summary.floatingPnl)}
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
                label="Average R"
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
                tone={page.summary.openTradesCount > 0 ? "positive" : "neutral"}
              />
            </div>

            <div className="grid w-full gap-4 2xl:grid-cols-3">
              <PublicProofEquityCurveCard points={page.summary.curve} />
              <PublicProofDrawdownCard points={page.summary.drawdownCurve} />
              <PublicProofMonthlyReturnsCard rows={page.stats.monthlyReturns} />
            </div>

            <div className="grid w-full gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <GoalSurface className="w-full h-full overflow-hidden">
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
                      {formatCurrency(page.summary.floatingPnl)} floating
                    </span>
                  </div>
                  <p className=" min-h-[20px] text-[11px] leading-4 text-white/40">
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
                              {trade.tradeType === "short" ? "Short" : "Long"} ·{" "}
                              {trade.volume ?? "—"} lots · Open for{" "}
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
                                ? formatCurrency(trade.profit)
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
                        This proof page will surface live positions here
                        whenever the connected account has open trades.
                      </p>
                    )}
                  </div>
                </div>
              </GoalSurface>

              <PublicProofTopSymbolsCard rows={topSymbolRows} />
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
                value={formatCurrency(page.stats.expectancy)}
                detail="Average expected profit or loss per closed trade."
                icon={TrendingUp}
                tone={page.stats.expectancy >= 0 ? "positive" : "warning"}
              />
              <ProofMetricCard
                label="Average win"
                value={formatCurrency(page.stats.avgWin)}
                detail="Average result of closed winning trades."
                icon={ShieldCheck}
                tone="positive"
              />
              <ProofMetricCard
                label="Average loss"
                value={formatCurrency(-Math.abs(page.stats.avgLoss))}
                detail="Average magnitude of closed losing trades."
                icon={AlertTriangle}
                tone="warning"
              />
              <ProofMetricCard
                label="Median R"
                value={formatR(page.summary.medianRR)}
                detail="Middle realized reward to risk across closed trades."
                icon={BarChart3}
                tone="info"
              />
              <ProofMetricCard
                label="Best trade"
                value={formatCurrency(page.stats.bestTrade)}
                detail="Single best closed trade in the public record."
                icon={TrendingUp}
                tone="positive"
              />
              <ProofMetricCard
                label="Worst trade"
                value={formatCurrency(page.stats.worstTrade)}
                detail="Single worst closed trade in the public record."
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
              <PublicProofMonthlyReturnsCard rows={page.stats.monthlyReturns} />

              <div className="grid h-[28rem] grid-rows-2 gap-4">
                <ProofContentCard
                  label="Best day"
                  description="Strongest net closed-trade day in the public record."
                  icon={TrendingUp}
                  tone="positive"
                >
                  <p className="text-2xl font-semibold tracking-tight text-teal-300">
                    {page.stats.bestDay
                      ? formatCurrency(page.stats.bestDay.pnl)
                      : "—"}
                  </p>
                  <p className="text-sm text-white/60">
                    {formatProofDay(page.stats.bestDay?.day)}
                  </p>
                </ProofContentCard>
                <ProofContentCard
                  label="Worst day"
                  description="Weakest net closed-trade day in the public record."
                  icon={AlertTriangle}
                  tone="warning"
                >
                  <p className="text-2xl font-semibold tracking-tight text-amber-200">
                    {page.stats.worstDay
                      ? formatCurrency(page.stats.worstDay.pnl)
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
                description="Public viewers can see the weighting of broker-synced, CSV-imported, and manually entered trades in this ledger."
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
                description="Account-level trust mode and verification state for this public proof link."
                icon={ShieldCheck}
                tone="info"
              >
                <p className="text-2xl font-semibold tracking-tight text-sky-300">
                  {page.proof.connectionLabel}
                </p>
                <p className="text-sm text-white/60">
                  {page.proof.verificationLabel} · {page.proof.liveStatusLabel}
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
                  Proof-page integrity summary
                </p>
                <GoalContentSeparator className="mb-4 mt-4" />
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-sm bg-white/[0.03] px-4 py-4 ring-1 ring-white/6">
                    <p className="text-xs text-white/40">
                      Removed synced/imported
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {page.trust.removedTradesCount}
                    </p>
                  </div>
                  <div className="rounded-sm bg-white/[0.03] px-4 py-4 ring-1 ring-white/6">
                    <p className="text-xs text-white/40">Last synced</p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {lastSyncedLabel}
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
  );
}
