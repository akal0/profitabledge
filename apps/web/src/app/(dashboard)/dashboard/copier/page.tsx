"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useTRPC } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyGroupCard } from "@/components/copier/copy-group-card";
import { CreateGroupDialog } from "@/components/copier/create-group-dialog";
import type { CopierDashboardData } from "@/components/copier/types";
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Clock3,
  Copy,
  Plus,
  RefreshCcw,
  Shield,
  Unplug,
  Workflow,
} from "lucide-react";

const shellClass = "rounded-sm border border-white/5 bg-sidebar";
const innerPanelClass =
  "rounded-sm border border-white/5 bg-sidebar-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";
const softPanelClass = "rounded-sm border border-white/5 bg-sidebar-accent";
const secondaryButtonClass =
  "cursor-pointer flex items-center justify-center gap-2 py-2 h-[38px] transition-all active:scale-95 text-white/60 hover:text-white text-xs duration-250 border border-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-5";
const primaryButtonClass =
  "cursor-pointer flex items-center justify-center gap-2 py-2 h-[38px] transition-all active:scale-95 text-xs duration-250 rounded-sm px-5 border border-teal-400/20 bg-teal-400/12 text-teal-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-teal-400/20 hover:brightness-110";

function parseNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatLatency(ms: number): string {
  if (ms <= 0) return "No fills yet";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatTimeAgo(value: Date | string | null | undefined): string {
  if (!value) return "No activity";
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

function getIssueAppearance(tone: string) {
  switch (tone) {
    case "critical":
      return {
        badge: "border-rose-500/25 bg-rose-500/10 text-rose-300",
        panel: "border-rose-500/15 bg-rose-500/[0.06]",
      };
    case "warning":
      return {
        badge: "border-yellow-500/20 bg-yellow-500/12 text-yellow-200",
        panel: "border-yellow-500/15 bg-yellow-500/[0.06]",
      };
    default:
      return {
        badge: "border-blue-400/20 bg-blue-400/12 text-blue-200",
        panel: "border-blue-400/15 bg-blue-400/[0.06]",
      };
  }
}

function getRoleAppearance(role: string) {
  switch (role) {
    case "master":
      return "border-teal-500/25 bg-teal-500/10 text-teal-300";
    case "slave":
      return "border-blue-400/20 bg-blue-400/12 text-blue-200";
    case "both":
      return "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-300";
    default:
      return "border-white/5 bg-sidebar-accent text-white/45";
  }
}

function getSignalAppearance(status: string | null) {
  switch (status) {
    case "executed":
      return "border-teal-400/20 bg-teal-400/12 text-teal-200";
    case "failed":
      return "border-rose-500/25 bg-rose-500/10 text-rose-300";
    case "rejected":
      return "border-yellow-500/20 bg-yellow-500/12 text-yellow-200";
    case "sent":
      return "border-blue-400/20 bg-blue-400/12 text-blue-200";
    case "pending":
      return "border-white/5 bg-sidebar-accent text-white/45";
    default:
      return "border-white/5 bg-sidebar-accent text-white/45";
  }
}

export default function TradeCopierPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const trpc = useTRPC() as any;
  const { data, isLoading, refetch, isFetching } =
    trpc.copier.getDashboard.useQuery() as {
      data: CopierDashboardData | undefined;
      isLoading: boolean;
      refetch: () => Promise<unknown>;
      isFetching: boolean;
    };

  const readinessPercent = data
    ? Math.round(
        (data.overview.connectedAccountCount /
          Math.max(1, data.overview.verifiedAccountCount || data.setup.accounts.length)) *
          100
      )
    : 0;
  const totalQueue = (data?.overview.pendingSignals ?? 0) + (data?.overview.sentSignals ?? 0);

  return (
    <main className="flex-1 space-y-6 p-6 py-4">
      <section className={cn(shellClass, "p-1")}>
        <div className={cn(innerPanelClass, "p-6 md:p-8")}>
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl space-y-3">
              <Badge className="border border-white/5 bg-sidebar px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-white/45">
                Trade Copier
              </Badge>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  Route master signals into live accounts with execution visibility.
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-white/55">
                  Monitor routing readiness, queue health, slippage, and copy drift across every
                  master-to-slave path from one dashboard.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button className={primaryButtonClass} onClick={() => setCreateDialogOpen(true)}>
                <Plus className="size-4" />
                Create copy group
              </Button>
              <Button className={secondaryButtonClass} onClick={() => refetch()}>
                <RefreshCcw className={cn("size-4", isFetching ? "animate-spin" : "")} />
                Refresh routing
              </Button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-1 sm:grid-cols-2 xl:grid-cols-4">
            <div className={cn(softPanelClass, "p-4")}>
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">Routes armed</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {data ? `${data.overview.activeGroupCount}/${data.overview.groupCount}` : "--"}
              </p>
              <p className="mt-1 text-xs text-white/45">Groups currently dispatching</p>
            </div>
            <div className={cn(softPanelClass, "p-4")}>
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">Signal queue</p>
              <p className="mt-2 text-xl font-semibold text-white">{data ? totalQueue : "--"}</p>
              <p className="mt-1 text-xs text-white/45">
                {data
                  ? `${data.overview.failedSignals + data.overview.rejectedSignals} exceptions`
                  : "Waiting on activity"}
              </p>
            </div>
            <div className={cn(softPanelClass, "p-4")}>
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                Execution quality
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                {data ? `${data.overview.executionRate.toFixed(1)}%` : "--"}
              </p>
              <p className="mt-1 text-xs text-white/45">
                {data ? formatLatency(data.overview.avgLatencyMs) : "No latency yet"}
              </p>
            </div>
            <div className={cn(softPanelClass, "p-4")}>
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">30d copy delta</p>
              <p
                className={cn(
                  "mt-2 text-xl font-semibold",
                  (data?.overview.copyDelta30d ?? 0) >= 0 ? "text-teal-300" : "text-rose-300"
                )}
              >
                {data ? formatMoney(data.overview.copyDelta30d) : "--"}
              </p>
              <p className="mt-1 text-xs text-white/45">Copy vs master performance</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-[1fr_auto] xl:items-center">
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">Readiness</p>
              <Progress
                value={readinessPercent}
                className="mt-2 h-1.5 rounded-sm bg-sidebar [&>div]:bg-teal-400/70"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="border border-white/5 bg-sidebar px-2 py-1 text-[10px] text-white/45">
                {data?.overview.connectedAccountCount ?? 0} connected
              </Badge>
              <Badge className="border border-white/5 bg-sidebar px-2 py-1 text-[10px] text-white/45">
                {data?.overview.verifiedAccountCount ?? 0} verified
              </Badge>
              <Badge className="border border-white/5 bg-sidebar px-2 py-1 text-[10px] text-white/45">
                Avg slippage {data?.overview.avgSlippage.toFixed(2) ?? "0.00"} pips
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            {[0, 1].map((index) => (
              <Card key={index} className={cn(shellClass, "py-0 shadow-none")}>
                <CardHeader className="px-6 py-5">
                  <Skeleton className="h-6 w-40 rounded-sm bg-sidebar-accent" />
                </CardHeader>
                <CardContent className="space-y-3 px-6 pb-6">
                  <Skeleton className="h-20 w-full rounded-sm bg-sidebar-accent" />
                  <Skeleton className="h-20 w-full rounded-sm bg-sidebar-accent" />
                  <Skeleton className="h-20 w-full rounded-sm bg-sidebar-accent" />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className={cn(shellClass, "py-0 shadow-none")}>
            <CardHeader className="px-6 py-5">
              <Skeleton className="h-6 w-56 rounded-sm bg-sidebar-accent" />
            </CardHeader>
            <CardContent className="space-y-4 px-6 pb-6">
              <Skeleton className="h-48 w-full rounded-sm bg-sidebar-accent" />
              <Skeleton className="h-48 w-full rounded-sm bg-sidebar-accent" />
            </CardContent>
          </Card>
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className={cn(shellClass, "py-0 shadow-none")}>
              <CardHeader className="border-b border-white/5 px-6 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg text-white">Routing readiness</CardTitle>
                    <p className="mt-1 text-sm text-white/55">
                      Verified connectivity, master/slave coverage, and setup blockers.
                    </p>
                  </div>
                  <div className="rounded-sm border border-white/5 bg-sidebar-accent px-2.5 py-1 text-[10px] text-white/45">
                    {readinessPercent}% live
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 px-6 py-6">
                <div className={cn(innerPanelClass, "p-4")}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                        Coverage
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {data.overview.connectedAccountCount} live / {data.setup.accounts.length} accounts
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="border border-teal-400/20 bg-teal-400/12 text-teal-200">
                        {data.overview.verifiedAccountCount} verified
                      </Badge>
                      <Badge className="border border-yellow-500/20 bg-yellow-500/12 text-yellow-200">
                        {data.overview.staleAccountCount} stale
                      </Badge>
                    </div>
                  </div>
                  <Progress
                    value={readinessPercent}
                    className="mt-4 h-1.5 rounded-sm bg-sidebar [&>div]:bg-teal-400/70"
                  />
                </div>

                <div className="space-y-3">
                  {data.setup.issues.map((issue) => {
                    const appearance = getIssueAppearance(issue.tone);
                    return (
                      <div
                        key={`${issue.tone}-${issue.title}`}
                        className={cn("rounded-sm border p-4", appearance.panel)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={cn("border px-2 py-1 text-[10px]", appearance.badge)}>
                            {issue.tone}
                          </Badge>
                          <p className="text-sm font-medium text-white">{issue.title}</p>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-white/60">{issue.description}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className={cn(shellClass, "py-0 shadow-none")}>
              <CardHeader className="border-b border-white/5 px-6 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg text-white">Account routing matrix</CardTitle>
                    <p className="mt-1 text-sm text-white/55">
                      Which accounts are acting as masters, destinations, or still unassigned.
                    </p>
                  </div>
                  <Badge className="border border-white/5 bg-sidebar-accent px-2 py-1 text-[10px] text-white/45">
                    {data.setup.accounts.length} accounts
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="px-6 py-6">
                <ScrollArea className="h-[360px] pr-4">
                  <div className="space-y-3">
                    {data.setup.accounts.map((account) => (
                      <div
                        key={account.id}
                        className={cn(softPanelClass, "p-4")}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-white">{account.name}</p>
                              <Badge className={cn("border px-2 py-1 text-[10px]", getRoleAppearance(account.role))}>
                                {account.role}
                              </Badge>
                              <Badge
                                className={cn(
                                  "border px-2 py-1 text-[10px]",
                                  account.isConnected
                                    ? "border-teal-400/20 bg-teal-400/12 text-teal-200"
                                    : account.isVerified
                                      ? "border-rose-500/25 bg-rose-500/10 text-rose-300"
                                      : "border-white/5 bg-sidebar-accent text-white/45"
                                )}
                              >
                                {account.isConnected ? (
                                  <>
                                    <CheckCircle2 className="size-3" />
                                    Live
                                  </>
                                ) : account.isVerified ? (
                                  <>
                                    <Unplug className="size-3" />
                                    Stale
                                  </>
                                ) : (
                                  <>
                                    <AlertTriangle className="size-3" />
                                    Unverified
                                  </>
                                )}
                              </Badge>
                            </div>
                            <p className="text-sm text-white/55">
                              {account.broker}
                              {account.accountNumber ? ` • ${account.accountNumber}` : ""}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {account.groupNames.map((groupName) => (
                                <Badge
                                  key={`${account.id}-${groupName}`}
                                  className="border border-white/5 bg-sidebar-accent px-2 py-1 text-[10px] text-white/45"
                                >
                                  {groupName}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-semibold text-white">
                              {formatMoney(parseNumber(account.liveBalance ?? account.initialBalance))}
                            </p>
                            <p className="mt-1 text-xs text-white/45">
                              Last sync {formatTimeAgo(account.lastSyncedAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <Card className={cn(shellClass, "py-0 shadow-none")}>
            <CardHeader className="border-b border-white/5 px-6 py-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-lg text-white">Live signal stream</CardTitle>
                  <p className="mt-1 text-sm text-white/55">
                    The latest signals moving through your queue, including drift, latency, and rejection reasons.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="border border-white/5 bg-sidebar-accent px-2 py-1 text-[10px] text-white/45">
                    {data.overview.pendingSignals} pending
                  </Badge>
                  <Badge className="border border-blue-400/20 bg-blue-400/12 px-2 py-1 text-[10px] text-blue-200">
                    {data.overview.sentSignals} sent
                  </Badge>
                  <Badge className="border border-teal-400/20 bg-teal-400/12 px-2 py-1 text-[10px] text-teal-200">
                    {data.overview.executedSignals} executed
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="px-6 py-6">
              {data.recentSignals.length ? (
                <div className="grid gap-3">
                  {data.recentSignals.map((signal) => (
                    <div
                      key={signal.id}
                      className={cn(softPanelClass, "p-4")}
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={cn("border px-2 py-1 text-[10px]", getSignalAppearance(signal.status))}>
                              {signal.status ?? "unknown"}
                            </Badge>
                            <p className="text-sm font-semibold text-white">
                              {signal.symbol} {signal.signalType}
                            </p>
                            <Badge className="border border-white/5 bg-sidebar-accent px-2 py-1 text-[10px] text-white/45">
                              {signal.groupName}
                            </Badge>
                            <Badge className="border border-white/5 bg-sidebar-accent px-2 py-1 text-[10px] text-white/45">
                              {signal.slaveAccountName}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap gap-3 text-xs text-white/50">
                            <span className="inline-flex items-center gap-1">
                              <Activity className="size-3.5" />
                              {signal.masterAccountName}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <ArrowRightLeft className="size-3.5" />
                              {signal.tradeType}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="size-3.5" />
                              {formatTimeAgo(signal.executedAt ?? signal.createdAt)}
                            </span>
                            {signal.latencyMs ? <span>{formatLatency(signal.latencyMs)}</span> : null}
                            {signal.slippagePips != null ? (
                              <span>{signal.slippagePips.toFixed(2)} pips</span>
                            ) : null}
                          </div>

                          {signal.errorMessage || signal.rejectionReason ? (
                            <p className="text-sm text-yellow-200/80">
                              {signal.errorMessage || signal.rejectionReason}
                            </p>
                          ) : null}
                        </div>

                        <div className="text-right">
                          {signal.copiedProfit != null ? (
                            <p
                              className={cn(
                                "text-sm font-semibold",
                                signal.copiedProfit >= 0 ? "text-teal-200" : "text-rose-300"
                              )}
                            >
                              {formatMoney(signal.copiedProfit)}
                            </p>
                          ) : (
                            <p className="text-sm text-white/40">Awaiting close</p>
                          )}
                          {signal.masterProfit != null ? (
                            <p className="mt-1 text-xs text-white/45">
                              vs master {formatMoney(signal.masterProfit)}
                            </p>
                          ) : null}
                          {signal.copyDelta != null ? (
                            <p
                              className={cn(
                                "mt-1 text-xs",
                                signal.copyDelta >= 0 ? "text-teal-200" : "text-rose-300"
                              )}
                            >
                              Drift {formatMoney(signal.copyDelta)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-sm border border-dashed border-white/5 bg-sidebar-accent p-10 text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-sm border border-white/5 bg-sidebar text-white/35">
                    <Workflow className="size-5" />
                  </div>
                  <p className="mt-4 text-lg font-medium text-white">No signal activity yet</p>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/55">
                    Once your master account starts pushing trades, signal dispatch, execution, and
                    rejection states will appear here in real time.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <section className="space-y-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Routing workspaces</h2>
                <p className="mt-1 text-sm text-white/55">
                  Each workspace combines master state, slave configuration, recent signal flow,
                  and execution health in one place.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-white/45">
                <span className="inline-flex items-center gap-1">
                  <Shield className="size-3.5" />
                  Risk controls surfaced per slave
                </span>
                <span className="inline-flex items-center gap-1">
                  <Copy className="size-3.5" />
                  Drift and queue health per route
                </span>
              </div>
            </div>

            {data.groups.length ? (
              data.groups.map((group) => (
                <CopyGroupCard key={group.id} group={group} onUpdate={() => refetch()} />
              ))
            ) : (
              <Card className={cn(shellClass, "py-0 shadow-none")}>
                <CardContent className="px-6 py-12">
                  <div className="mx-auto max-w-2xl text-center">
                    <div className="mx-auto flex size-14 items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent text-white/35">
                      <Copy className="size-6" />
                    </div>
                    <h3 className="mt-5 text-2xl font-semibold text-white">
                      Build your first copy route
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-white/55">
                      Start with one verified master and one verified destination account. Once the group
                      exists, you can tune sizing, risk caps, symbol filters, sessions, reverse mode,
                      and modification handling from the workspace.
                    </p>
                    <Button
                      className={cn(primaryButtonClass, "mt-6")}
                      onClick={() => setCreateDialogOpen(true)}
                    >
                      <Plus className="size-4" />
                      Create first group
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </section>
        </>
      ) : null}

      <CreateGroupDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={() => {
          refetch();
          setCreateDialogOpen(false);
        }}
      />
    </main>
  );
}
