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
  Search,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  getConnectionBadgeClassName,
  getOriginBadgeClassName,
} from "@/features/public-proof/lib/public-proof-badges";
import { trpcOptions } from "@/utils/trpc";

function formatCurrency(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatR(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function formatTimestamp(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function Sparkline({ points }: { points: Array<{ x: string; y: number }> }) {
  if (points.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-white/30">
        No closed trades yet
      </div>
    );
  }

  const values = points.map((point) => point.y);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const polylinePoints = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 100;
      const y = 100 - ((point.y - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" className="h-48 w-full overflow-visible">
      <defs>
        <linearGradient id="proofCurve" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(45, 212, 191, 0.35)" />
          <stop offset="100%" stopColor="rgba(45, 212, 191, 0)" />
        </linearGradient>
      </defs>
      <polyline
        points={`0,100 ${polylinePoints} 100,100`}
        fill="url(#proofCurve)"
        stroke="none"
      />
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="rgb(45 212 191)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "positive" | "warning" | "neutral";
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/35">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p
        className={cn(
          "mt-3 text-2xl font-semibold tracking-tight text-white",
          tone === "positive" && "text-teal-300",
          tone === "warning" && "text-amber-200"
        )}
      >
        {value}
      </p>
    </div>
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
        editedOnly: editFilter === "edited",
      },
      {
        getNextPageParam: (last: any) => last?.nextCursor,
      }
    );

  const tradesQuery = useInfiniteQuery({
    ...tradeQueryOptions,
    enabled: pageQuery.status === "success",
  });

  const rows = useMemo(() => {
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
      <div className="min-h-screen bg-[#090c0f] px-4 py-20 text-white">
        <div className="mx-auto max-w-6xl animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-white/5" />
          <div className="h-20 rounded-2xl bg-white/5" />
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 rounded-2xl bg-white/5" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (pageQuery.error || !pageQuery.data) {
    return (
      <div className="min-h-screen bg-[#090c0f] px-4 py-24 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/8 bg-white/[0.03] p-8 text-center">
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
      </div>
    );
  }

  const page = pageQuery.data;
  const trustStartedAt = new Date(
    page.proof.auditCoverageStartsAt
  ).toLocaleDateString();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.18),transparent_30%),linear-gradient(180deg,#090c0f_0%,#0e1217_100%)] px-4 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-[28px] border border-white/8 bg-black/25 p-6 backdrop-blur-xl lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
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
              className="rounded-sm border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
              onClick={copyLink}
            >
              <Copy className="mr-2 h-3.5 w-3.5" />
              Copy link
            </Button>
            <Button
              className="rounded-sm bg-teal-500 text-black hover:bg-teal-400"
              asChild
            >
              <Link href="/sign-up">
                Build your own
                <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            label="Total trades"
            value={page.summary.totalTrades.toLocaleString()}
            icon={Activity}
          />
          <SummaryCard
            label="Win rate"
            value={`${page.summary.winRate.toFixed(1)}%`}
            icon={ShieldCheck}
            tone="positive"
          />
          <SummaryCard
            label="Average R"
            value={formatR(page.summary.averageRR)}
            icon={BarChart3}
          />
          <SummaryCard
            label="Total P&L"
            value={formatCurrency(page.summary.totalPnl)}
            icon={TrendingUp}
            tone={page.summary.totalPnl >= 0 ? "positive" : "warning"}
          />
          <SummaryCard
            label="Max drawdown"
            value={formatCurrency(page.summary.maxDrawdown)}
            icon={AlertTriangle}
            tone="warning"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white/85">
                  Equity curve
                </p>
                <p className="mt-1 text-xs text-white/40">
                  Live public proof snapshot from closed trade history
                </p>
              </div>
              <p className="text-xs text-white/35">
                {page.summary.totalTrades} trades
              </p>
            </div>
            <div className="mt-5">
              <Sparkline points={page.summary.curve} />
            </div>
          </div>

          <div className="space-y-4 rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
            <div>
              <p className="text-sm font-medium text-white/85">Trust summary</p>
              <p className="mt-1 text-xs text-white/40">
                Public-proof signals that help viewers separate synced history
                from imported or manual rows.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-xl border border-white/8 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                  Source mix
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge
                    className={cn(
                      "rounded-sm ring-1 text-[10px]",
                      getOriginBadgeClassName("broker_sync")
                    )}
                  >
                    Broker {page.trust.sourceCounts.brokerSync}
                  </Badge>
                  <Badge
                    className={cn(
                      "rounded-sm ring-1 text-[10px]",
                      getOriginBadgeClassName("csv_import")
                    )}
                  >
                    CSV {page.trust.sourceCounts.csvImport}
                  </Badge>
                  <Badge
                    className={cn(
                      "rounded-sm ring-1 text-[10px]",
                      getOriginBadgeClassName("manual_entry")
                    )}
                  >
                    Manual {page.trust.sourceCounts.manualEntry}
                  </Badge>
                </div>
              </div>

              <div className="rounded-xl border border-white/8 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                  Edits and removals
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-2xl font-semibold text-white">
                      {page.trust.editedTradesCount}
                    </p>
                    <p className="text-[11px] text-white/40">Edited rows</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-white">
                      {page.trust.removedTradesCount}
                    </p>
                    <p className="text-[11px] text-white/40">
                      Removed imported/synced trades
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-[11px] leading-5 text-amber-100/80">
              <p className="font-medium text-amber-100">Audit coverage</p>
              <p className="mt-1">
                Edit and deletion proof is tracked from {trustStartedAt}.
                {page.proof.legacyAuditGap
                  ? " Older trades may predate this audit window."
                  : " This account currently has full coverage for the visible history."}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-white/85">Trade history</p>
              <p className="mt-1 text-xs text-white/40">
                Read-only trade ledger for this public proof link
              </p>
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              <div className="relative min-w-[220px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search symbol, source, outcome"
                  className="border-white/10 bg-black/20 pl-9 text-white placeholder:text-white/25"
                />
              </div>
              <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                <SelectTrigger className="w-[150px] border-white/10 bg-black/20 text-white">
                  <SelectValue placeholder="Outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All outcomes</SelectItem>
                  <SelectItem value="Win">Win</SelectItem>
                  <SelectItem value="Loss">Loss</SelectItem>
                  <SelectItem value="BE">Breakeven</SelectItem>
                  <SelectItem value="PW">Partial win</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[150px] border-white/10 bg-black/20 text-white">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="broker_sync">Broker sync</SelectItem>
                  <SelectItem value="csv_import">CSV import</SelectItem>
                  <SelectItem value="manual_entry">Manual entry</SelectItem>
                </SelectContent>
              </Select>
              <Select value={editFilter} onValueChange={setEditFilter}>
                <SelectTrigger className="w-[150px] border-white/10 bg-black/20 text-white">
                  <SelectValue placeholder="Edit filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All rows</SelectItem>
                  <SelectItem value="edited">Edited only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-white/8">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-white/[0.04] text-[11px] uppercase tracking-[0.18em] text-white/35">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Symbol</th>
                    <th className="px-4 py-3">Side</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Entry</th>
                    <th className="px-4 py-3">Exit</th>
                    <th className="px-4 py-3">P&amp;L</th>
                    <th className="px-4 py-3">R</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-white/6 text-white/78"
                    >
                      <td className="px-4 py-3">
                        <div className="text-xs text-white/70">
                          {formatTimestamp(
                            row.closeTime || row.openTime || row.createdAt
                          )}
                        </div>
                        <div className="mt-1 text-[11px] text-white/35">
                          {formatDuration(row.durationSeconds)}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-white">
                        {row.symbol || "—"}
                      </td>
                      <td className="px-4 py-3 capitalize">
                        {row.tradeType || "—"}
                      </td>
                      <td className="px-4 py-3">{row.volume ?? "—"}</td>
                      <td className="px-4 py-3">
                        {row.openPrice != null
                          ? row.openPrice.toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {row.closePrice != null
                          ? row.closePrice.toLocaleString()
                          : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 font-medium",
                          (row.profit ?? 0) >= 0
                            ? "text-teal-300"
                            : "text-rose-300"
                        )}
                      >
                        {row.profit != null ? formatCurrency(row.profit) : "—"}
                      </td>
                      <td className="px-4 py-3">{formatR(row.rr)}</td>
                      <td className="px-4 py-3">
                        <Badge
                          className={cn(
                            "rounded-sm ring-1 text-[10px]",
                            getOriginBadgeClassName(row.originType)
                          )}
                        >
                          {row.originLabel}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {row.outcome ? (
                            <Badge className="rounded-sm ring-1 ring-white/10 bg-white/5 text-[10px] text-white/70">
                              {row.outcome}
                            </Badge>
                          ) : null}
                          {row.edited ? (
                            <Badge className="rounded-sm ring-1 ring-amber-500/25 bg-amber-500/15 text-[10px] text-amber-200">
                              Edited
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && !tradesQuery.isLoading ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-10 text-center text-sm text-white/40"
                      >
                        No trades match the current proof filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {tradesQuery.hasNextPage ? (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                className="rounded-sm border-white/10 bg-black/20 text-white/75 hover:bg-white/10"
                onClick={() => tradesQuery.fetchNextPage()}
                disabled={tradesQuery.isFetchingNextPage}
              >
                {tradesQuery.isFetchingNextPage
                  ? "Loading more…"
                  : "Load more trades"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
