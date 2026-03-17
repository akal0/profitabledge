"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronRight,
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
import { cn } from "@/lib/utils";
import {
  getConnectionBadgeClassName,
  getOriginBadgeClassName,
} from "@/features/public-proof/lib/public-proof-badges";
import {
  formatCurrency,
  formatR,
} from "@/features/public-proof/lib/public-proof-formatters";
import { PublicProofEquityCurveCard } from "@/features/public-proof/components/public-proof-equity-curve-card";
import {
  PublicProofTradesTable,
  type PublicProofTradeRow,
} from "@/features/public-proof/components/public-proof-trades-table";
import { trpcOptions } from "@/utils/trpc";

import { getPropAssignActionButtonClassName } from "@/features/accounts/lib/prop-assign-action-button";

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
  const valueClassName =
    tone === "positive"
      ? "text-teal-300"
      : tone === "warning"
      ? "text-amber-200"
      : tone === "info"
      ? "text-sky-300"
      : "text-white";
  const iconClassName =
    tone === "positive"
      ? "text-teal-300"
      : tone === "warning"
      ? "text-amber-300"
      : tone === "info"
      ? "text-sky-300"
      : "text-white/50";
  const railClassName =
    tone === "positive"
      ? "bg-teal-400"
      : tone === "warning"
      ? "bg-amber-400"
      : tone === "info"
      ? "bg-sky-400"
      : "bg-white/25";

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

function TrustMetricCard({
  label,
  description,
  icon: Icon,
  children,
}: {
  label: string;
  description: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <GoalSurface className="w-full">
      <div className="p-3.5 pb-8">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-white/60" />
          <span className="text-xs text-white/50">{label}</span>
        </div>
        <GoalContentSeparator className="mb-3.5 mt-3.5" />
        <div className="space-y-3 h-full place-content-end">
          {children}
          <p className="min-h-[40px] text-xs leading-4 text-white/40">
            {description}
          </p>
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

  const page = pageQuery.data;
  const trustStartedAt = new Date(
    page.proof.auditCoverageStartsAt
  ).toLocaleDateString();
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

        <div className="grid w-full gap-4 md:grid-cols-2 xl:grid-cols-5">
          <ProofMetricCard
            label="Total trades"
            value={page.summary.totalTrades.toLocaleString()}
            detail="All imported, synced, and manual rows included in this public ledger."
            icon={Activity}
          />
          <ProofMetricCard
            label="Win rate"
            value={`${page.summary.winRate.toFixed(1)}%`}
            detail="Closed winning outcomes relative to closed losing and breakeven history."
            icon={ShieldCheck}
            tone="positive"
          />
          <ProofMetricCard
            label="Average R"
            value={formatR(page.summary.averageRR)}
            detail="Average realized or planned R across the closed trade history."
            icon={BarChart3}
            tone="info"
          />
          <ProofMetricCard
            label="Total P&L"
            value={formatCurrency(page.summary.totalPnl)}
            detail="Current public account P&L across the trade ledger shown on this page."
            icon={TrendingUp}
            tone={page.summary.totalPnl >= 0 ? "positive" : "warning"}
          />
          <ProofMetricCard
            label="Max drawdown"
            value={formatCurrency(page.summary.maxDrawdown)}
            detail="Worst peak-to-trough drawdown from the closed-equity curve."
            icon={AlertTriangle}
            tone="warning"
          />
        </div>

        <div className="w-full">
          <PublicProofEquityCurveCard points={page.summary.curve} />
        </div>

        <div className="w-full space-y-3 bg-sidebar">
          <div className="grid w-full gap-4 md:grid-cols-2 xl:grid-cols-4">
            <TrustMetricCard
              label="Source mix"
              description="Viewers can immediately see how much of the account is broker synced, CSV imported, or self-entered."
              icon={Activity}
            >
              <div className="flex flex-wrap gap-2">
                {sourceSegments.map((segment) => (
                  <Badge
                    key={segment.key}
                    className={cn(
                      "rounded-sm ring-1 text-[10px]",
                      getOriginBadgeClassName(segment.key)
                    )}
                  >
                    {segment.label} {segment.count}
                  </Badge>
                ))}
              </div>
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
            </TrustMetricCard>

            <TrustMetricCard
              label="Verification"
              description="Account-level trust mode and verification state for this public proof link."
              icon={ShieldCheck}
            >
              <div className="space-y-2">
                <p className="text-xl font-semibold text-white">
                  {page.proof.connectionLabel}
                </p>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                <div className="h-full w-full bg-sky-400" />
              </div>
            </TrustMetricCard>

            <TrustMetricCard
              label="Edited trades"
              description="Rows changed after import or sync so viewers can spot manual adjustments quickly."
              icon={BarChart3}
            >
              <p className="text-2xl font-semibold text-white">
                {page.trust.editedTradesCount}
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full bg-amber-400"
                  style={{
                    width: `${Math.max(
                      8,
                      Math.min(
                        100,
                        (page.trust.editedTradesCount /
                          Math.max(page.summary.totalTrades, 1)) *
                          100
                      )
                    )}%`,
                  }}
                />
              </div>
            </TrustMetricCard>

            <TrustMetricCard
              label="Audit coverage"
              description={`Edits and removed imported or synced trades are tracked from ${trustStartedAt}.`}
              icon={AlertTriangle}
            >
              <p className="text-xl font-semibold text-white">
                {page.proof.legacyAuditGap ? "Legacy gap" : "Full coverage"}
              </p>

              <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                <div
                  className={cn(
                    "h-full w-full",
                    page.proof.legacyAuditGap ? "bg-amber-400" : "bg-teal-400"
                  )}
                />
              </div>
            </TrustMetricCard>
          </div>
        </div>

        <div className="w-full space-y-3 bg-sidebar!">
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
        </div>
      </div>
    </div>
  );
}
