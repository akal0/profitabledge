"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useTRPC } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Copy,
  MoreVertical,
  Pause,
  Play,
  Plus,
  Settings2,
  Shield,
  Trash2,
  Unplug,
  XCircle,
} from "lucide-react";
import { AddSlaveDialog } from "./add-slave-dialog";
import { SlaveSettingsSheet } from "./slave-settings-sheet";
import type { CopierDashboardGroup, CopierDashboardSlave } from "./types";

const shellClass = "rounded-sm border border-white/5 bg-sidebar";
const innerPanelClass =
  "rounded-sm border border-white/5 bg-sidebar-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";
const softPanelClass = "rounded-sm border border-white/5 bg-sidebar-accent";
const actionButtonClass =
  "size-8 rounded-sm border border-white/5 bg-sidebar-accent text-white/60 transition-all hover:bg-sidebar hover:text-white";

interface CopyGroupProps {
  group: CopierDashboardGroup;
  onUpdate: () => void;
}

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
  if (ms <= 0) return "No fills";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatTimeAgo(value: Date | string | null | undefined): string {
  if (!value) return "No sync";
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

function formatLotMode(slave: CopierDashboardSlave): string {
  switch (slave.lotMode) {
    case "fixed":
      return `${parseNumber(slave.fixedLot).toFixed(2)} fixed lots`;
    case "multiplier":
      return `${parseNumber(slave.lotMultiplier).toFixed(2)}x multiplier`;
    case "balance_ratio":
      return "Balance-ratio scaling";
    case "risk_percent":
      return `${parseNumber(slave.riskPercent).toFixed(1)}% risk sizing`;
    default:
      return "Multiplier sizing";
  }
}

function getHealthAppearance(status: CopierDashboardGroup["health"]["status"]) {
  switch (status) {
    case "healthy":
      return {
        label: "Healthy",
        className: "border-teal-400/20 bg-teal-400/12 text-teal-200",
      };
    case "watch":
      return {
        label: "Watch",
        className: "border-yellow-500/20 bg-yellow-500/12 text-yellow-200",
      };
    case "critical":
      return {
        label: "Critical",
        className: "border-rose-500/30 bg-rose-500/10 text-rose-300",
      };
    case "armed":
      return {
        label: "Armed",
        className: "border-blue-400/20 bg-blue-400/12 text-blue-200",
      };
    case "paused":
      return {
        label: "Paused",
        className: "border-white/5 bg-sidebar-accent text-white/45",
      };
    default:
      return {
        label: "Unknown",
        className: "border-white/5 bg-sidebar-accent text-white/45",
      };
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

export function CopyGroupCard({ group, onUpdate }: CopyGroupProps) {
  const trpc = useTRPC() as any;
  const utils = trpc.useUtils() as any;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addSlaveOpen, setAddSlaveOpen] = useState(false);
  const [selectedSlave, setSelectedSlave] = useState<CopierDashboardSlave | null>(null);

  const updateGroup = trpc.copier.updateGroup.useMutation({
    onSuccess: () => {
      utils.copier.getDashboard.invalidate();
      utils.copier.listGroups.invalidate();
      onUpdate();
    },
  });

  const deleteGroup = trpc.copier.deleteGroup.useMutation({
    onSuccess: () => {
      utils.copier.getDashboard.invalidate();
      utils.copier.listGroups.invalidate();
      onUpdate();
    },
  });

  const updateSlave = trpc.copier.updateSlave.useMutation({
    onSuccess: () => {
      utils.copier.getDashboard.invalidate();
      utils.copier.listGroups.invalidate();
    },
  });

  const removeSlave = trpc.copier.removeSlave.useMutation({
    onSuccess: () => {
      utils.copier.getDashboard.invalidate();
      utils.copier.listGroups.invalidate();
    },
  });

  const activeGroup = group.isActive !== false;
  const healthAppearance = getHealthAppearance(group.health.status);
  const totalQueue = group.stats.pendingSignals + group.stats.sentSignals;
  const totalExceptions = group.stats.failedSignals + group.stats.rejectedSignals;

  return (
    <>
      <Card className={cn(shellClass, "overflow-hidden py-0 shadow-none")}>
        <CardHeader className="border-b border-white/5 px-6 py-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-xl text-white">{group.name}</CardTitle>
                <Badge className={cn("border px-2 py-1 text-[10px]", healthAppearance.className)}>
                  {healthAppearance.label}
                </Badge>
                <Badge className="border border-white/5 bg-sidebar-accent px-2 py-1 text-[10px] text-white/45">
                  {group.stats.activeSlaveCount}/{group.stats.slaveCount} active slaves
                </Badge>
                {group.health.staleMaster ? (
                  <Badge className="border border-rose-500/25 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-300">
                    Master offline
                  </Badge>
                ) : (
                  <Badge className="border border-teal-400/20 bg-teal-400/12 px-2 py-1 text-[10px] text-teal-200">
                    Master live
                  </Badge>
                )}
              </div>

              <p className="max-w-3xl text-sm text-white/60">
                {group.masterAccount.name} routes into {group.stats.activeSlaveCount} active destination
                {group.stats.activeSlaveCount === 1 ? "" : "s"} with a {group.stats.executionRate.toFixed(1)}%
                {" "}recent execution rate and {formatLatency(group.health.avgLatencyMs)} average latency.
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs text-white/45">
                <span>Created {formatTimeAgo(group.createdAt)}</span>
                <span>Last signal {formatTimeAgo(group.health.lastSignalAt)}</span>
                <span>
                  30d drift {formatMoney(group.stats.copyDelta30d)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="h-[38px] rounded-sm border border-white/5 bg-sidebar-accent px-4 text-xs text-white/60 hover:bg-sidebar hover:text-white"
                onClick={() => setAddSlaveOpen(true)}
              >
                <Plus className="size-4" />
                Add slave
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-sm border border-white/5 bg-sidebar-accent text-white/60 hover:bg-sidebar hover:text-white"
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      updateGroup.mutate({
                        groupId: group.id,
                        isActive: !activeGroup,
                      })
                    }
                  >
                    {activeGroup ? (
                      <>
                        <Pause className="mr-2 size-4" />
                        Pause routing
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 size-4" />
                        Resume routing
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-rose-300 focus:text-rose-300"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Delete group
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-5 px-6 py-6 xl:grid-cols-[1.2fr_0.9fr]">
          <div className="space-y-4">
            <div className={cn(innerPanelClass, "p-4")}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-sm border border-teal-400/20 bg-teal-400/12 p-2 text-teal-200">
                      <Copy className="size-4" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                        Master route
                      </p>
                      <p className="text-base font-semibold text-white">
                        {group.masterAccount.name}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-white/55">
                    {group.masterAccount.broker}
                    {group.masterAccount.accountNumber
                      ? ` • ${group.masterAccount.accountNumber}`
                      : ""}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={cn(
                      "border px-2 py-1 text-[10px]",
                      group.masterAccount.isConnected
                        ? "border-teal-400/20 bg-teal-400/12 text-teal-200"
                        : "border-rose-500/25 bg-rose-500/10 text-rose-300"
                    )}
                  >
                    {group.masterAccount.isConnected ? (
                      <>
                        <CheckCircle2 className="size-3" />
                        Connected
                      </>
                    ) : (
                      <>
                        <Unplug className="size-3" />
                        Stale feed
                      </>
                    )}
                  </Badge>
                  <Badge className="border border-white/5 bg-sidebar px-2 py-1 text-[10px] text-white/45">
                    Balance {formatMoney(parseNumber(group.masterAccount.liveBalance))}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className={cn(softPanelClass, "p-3")}>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                    Last heartbeat
                  </p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {formatTimeAgo(group.masterAccount.lastSyncedAt)}
                  </p>
                </div>
                <div className={cn(softPanelClass, "p-3")}>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                    Equity
                  </p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {formatMoney(parseNumber(group.masterAccount.liveEquity))}
                  </p>
                </div>
                <div className={cn(softPanelClass, "p-3")}>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                    Queue
                  </p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {totalQueue} open
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {group.slaves.map((slave) => {
                const slaveActive = slave.isActive !== false;
                const riskNotes = [
                  slave.maxDailyLoss ? `Daily loss ${formatMoney(parseNumber(slave.maxDailyLoss))}` : null,
                  slave.maxTradesPerDay ? `${slave.maxTradesPerDay} trades/day` : null,
                  slave.maxDrawdownPercent
                    ? `${parseNumber(slave.maxDrawdownPercent).toFixed(1)}% DD cap`
                    : null,
                ].filter(Boolean);

                const behaviorNotes = [
                  slave.reverseTrades ? "Reverse" : null,
                  slave.copyPendingOrders ? "Copy pending" : null,
                  slave.sessionFilter?.length ? `${slave.sessionFilter.length} session filter${slave.sessionFilter.length > 1 ? "s" : ""}` : null,
                  slave.symbolWhitelist?.length ? `${slave.symbolWhitelist.length} symbols whitelisted` : null,
                ].filter(Boolean);

                return (
                  <div
                    key={slave.id}
                    className={cn(softPanelClass, "p-4")}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white">
                            {slave.account.name}
                          </p>
                          <Badge
                            className={cn(
                              "border px-2 py-1 text-[10px]",
                              slaveActive
                                ? "border-blue-400/20 bg-blue-400/12 text-blue-200"
                                : "border-white/5 bg-sidebar-accent text-white/45"
                            )}
                          >
                            {slaveActive ? "Routing" : "Paused"}
                          </Badge>
                          <Badge
                            className={cn(
                              "border px-2 py-1 text-[10px]",
                              slave.account.isConnected
                                ? "border-teal-400/20 bg-teal-400/12 text-teal-200"
                                : "border-rose-500/25 bg-rose-500/10 text-rose-300"
                            )}
                          >
                            {slave.account.isConnected ? "Live" : "Stale"}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs text-white/60">
                          <span>{slave.account.broker}</span>
                          {slave.account.accountNumber ? (
                            <span>{slave.account.accountNumber}</span>
                          ) : null}
                          <span>{formatLotMode(slave)}</span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {riskNotes.map((note) => (
                            <Badge
                              key={note}
                              className="border border-white/5 bg-sidebar-accent px-2 py-1 text-[10px] text-white/45"
                            >
                              <Shield className="size-3" />
                              {note}
                            </Badge>
                          ))}
                          {behaviorNotes.map((note) => (
                            <Badge
                              key={note}
                              className="border border-white/5 bg-sidebar-accent px-2 py-1 text-[10px] text-white/45"
                            >
                              {note}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-start gap-2 lg:items-center">
                        <div className={cn(innerPanelClass, "px-3 py-2 text-right")}>
                          <p
                            className={cn(
                              "text-sm font-semibold",
                              parseNumber(slave.totalProfit) >= 0
                                ? "text-teal-200"
                                : "text-rose-300"
                            )}
                          >
                            {formatMoney(parseNumber(slave.totalProfit))}
                          </p>
                          <p className="mt-1 text-[11px] text-white/45">
                            {slave.totalCopiedTrades ?? 0} copied trades
                          </p>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className={actionButtonClass}
                          onClick={() =>
                            updateSlave.mutate({
                              slaveId: slave.id,
                              isActive: !slaveActive,
                            })
                          }
                        >
                          {slaveActive ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={actionButtonClass}
                          onClick={() => setSelectedSlave(slave)}
                        >
                          <Settings2 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-sm border border-white/5 bg-sidebar-accent text-white/50 hover:bg-rose-500/10 hover:text-rose-300"
                          onClick={() => removeSlave.mutate({ slaveId: slave.id })}
                        >
                          <XCircle className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className={cn(innerPanelClass, "p-3")}>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                          Last sync
                        </p>
                        <p className="mt-2 text-sm text-white">
                          {formatTimeAgo(slave.account.lastSyncedAt)}
                        </p>
                      </div>
                      <div className={cn(innerPanelClass, "p-3")}>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                          Balance
                        </p>
                        <p className="mt-2 text-sm text-white">
                          {formatMoney(parseNumber(slave.account.liveBalance))}
                        </p>
                      </div>
                      <div className={cn(innerPanelClass, "p-3")}>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                          Equity
                        </p>
                        <p className="mt-2 text-sm text-white">
                          {formatMoney(parseNumber(slave.account.liveEquity))}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {!group.slaves.length ? (
                <div className="rounded-sm border border-dashed border-white/5 bg-sidebar-accent p-6 text-center">
                  <p className="text-sm font-medium text-white">No destination accounts attached</p>
                  <p className="mt-2 text-sm text-white/55">
                    Attach at least one slave to route trades from this master.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4 h-[38px] rounded-sm border border-white/5 bg-sidebar px-4 text-xs text-white/60 hover:bg-sidebar-accent hover:text-white"
                    onClick={() => setAddSlaveOpen(true)}
                  >
                    <Plus className="size-4" />
                    Add first slave
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className={cn(softPanelClass, "p-4")}>
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                  Execution quality
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {group.stats.executionRate.toFixed(1)}%
                </p>
                <p className="mt-1 text-sm text-white/55">
                  {formatLatency(group.health.avgLatencyMs)} avg latency
                </p>
              </div>

              <div className={cn(softPanelClass, "p-4")}>
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                  30d copy delta
                </p>
                <p
                  className={cn(
                    "mt-3 text-2xl font-semibold",
                    group.stats.copyDelta30d >= 0 ? "text-teal-200" : "text-rose-300"
                  )}
                >
                  {formatMoney(group.stats.copyDelta30d)}
                </p>
                <p className="mt-1 text-sm text-white/55">
                  Copy {formatMoney(group.stats.copiedProfit30d)} vs master{" "}
                  {formatMoney(group.stats.masterProfit30d)}
                </p>
              </div>

              <div className={cn(softPanelClass, "p-4")}>
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                  Signal queue
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">{totalQueue}</p>
                <p className="mt-1 text-sm text-white/55">
                  {totalExceptions} exceptions waiting on review
                </p>
              </div>

              <div className={cn(softPanelClass, "p-4")}>
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                  Captured P/L
                </p>
                <p
                  className={cn(
                    "mt-3 text-2xl font-semibold",
                    group.stats.totalProfit >= 0 ? "text-teal-200" : "text-rose-300"
                  )}
                >
                  {formatMoney(group.stats.totalProfit)}
                </p>
                <p className="mt-1 text-sm text-white/55">
                  {group.stats.totalTrades} copied trades tracked
                </p>
              </div>
            </div>

            <div className={cn(softPanelClass, "p-4")}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                    Health score
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {group.health.score}/100
                  </p>
                </div>
                <Badge className={cn("border px-2 py-1 text-[10px]", healthAppearance.className)}>
                  {healthAppearance.label}
                </Badge>
              </div>

              <Progress
                value={group.health.score}
                className="mt-4 h-1.5 rounded-sm bg-sidebar [&>div]:bg-teal-400/70"
              />

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className={cn(innerPanelClass, "p-3")}>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                    Slippage
                  </p>
                  <p className="mt-2 text-sm text-white">
                    {group.health.avgSlippage.toFixed(2)} pips avg
                  </p>
                </div>
                <div className={cn(innerPanelClass, "p-3")}>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                    Max slippage
                  </p>
                  <p className="mt-2 text-sm text-white">
                    {group.health.maxSlippage.toFixed(2)} pips
                  </p>
                </div>
                <div className={cn(innerPanelClass, "p-3")}>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                    Active coverage
                  </p>
                  <p className="mt-2 text-sm text-white">
                    {group.stats.activeSlaveCount - group.health.staleSlaveCount}/
                    {group.stats.activeSlaveCount} live
                  </p>
                </div>
              </div>

              {group.health.topFailureReasons.length ? (
                <div className="mt-4 space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                    Leading failure reasons
                  </p>
                  {group.health.topFailureReasons.map((reason) => (
                    <div
                      key={reason.reason}
                      className="flex items-center justify-between rounded-sm border border-yellow-500/15 bg-yellow-500/[0.06] px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2 text-yellow-100/80">
                        <AlertTriangle className="size-3.5 text-yellow-300" />
                        <span>{reason.reason}</span>
                      </div>
                      <span className="text-xs text-yellow-200/60">{reason.count}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className={cn(softPanelClass, "p-4")}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                    Recent signal flow
                  </p>
                  <p className="mt-1 text-sm text-white/55">
                    Pending, executed, rejected, and failed signals for this route.
                  </p>
                </div>
                <div className="rounded-sm border border-white/5 bg-sidebar-accent px-2.5 py-1 text-[10px] text-white/45">
                  {group.recentSignals.length} recent events
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {group.recentSignals.length ? (
                  group.recentSignals.map((signal) => {
                    const copyDelta = signal.copyDelta ?? 0;
                    return (
                      <div
                        key={signal.id}
                        className={cn(innerPanelClass, "p-3")}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={cn("border px-2 py-1 text-[10px]", getSignalAppearance(signal.status))}>
                                {signal.status ?? "unknown"}
                              </Badge>
                              <span className="text-sm font-medium text-white">
                                {signal.symbol}
                              </span>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-xs",
                                  signal.tradeType === "buy"
                                    ? "text-teal-200"
                                    : "text-rose-300"
                                )}
                              >
                                {signal.tradeType === "buy" ? (
                                  <ArrowUpRight className="size-3.5" />
                                ) : (
                                  <ArrowDownRight className="size-3.5" />
                                )}
                                {signal.tradeType}
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs text-white/45">
                                <ArrowRightLeft className="size-3.5" />
                                {signal.signalType}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-3 text-xs text-white/55">
                              <span>{signal.slaveAccountName}</span>
                              <span>{formatTimeAgo(signal.executedAt ?? signal.createdAt)}</span>
                              {signal.latencyMs ? (
                                <span className="inline-flex items-center gap-1">
                                  <Clock3 className="size-3" />
                                  {formatLatency(signal.latencyMs)}
                                </span>
                              ) : null}
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
                                  signal.copiedProfit >= 0
                                    ? "text-teal-200"
                                    : "text-rose-300"
                                )}
                              >
                                {formatMoney(signal.copiedProfit)}
                              </p>
                            ) : null}
                            {signal.masterProfit != null ? (
                              <p className="mt-1 text-xs text-white/45">
                                vs master {formatMoney(signal.masterProfit)}
                              </p>
                            ) : null}
                            {signal.copyDelta != null ? (
                              <p
                                className={cn(
                                  "mt-1 text-xs",
                                  copyDelta >= 0 ? "text-teal-200" : "text-rose-300"
                                )}
                              >
                                Drift {formatMoney(copyDelta)}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-sm border border-dashed border-white/5 bg-sidebar-accent p-6 text-center">
                    <p className="text-sm font-medium text-white">No recent signals</p>
                    <p className="mt-2 text-sm text-white/55">
                      Once the master starts sending trades, this route will show dispatch and execution
                      events here.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-sidebar border border-white/5 rounded-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete copy group</AlertDialogTitle>
            <AlertDialogDescription className="text-white/45">
              This removes the master-to-slave route, all stored copier stats, and its signal history.
              The action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer flex items-center justify-center gap-2 py-2 h-[38px] transition-all active:scale-95 text-white/60 hover:text-white text-xs duration-250 border border-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-5">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer flex items-center justify-center gap-2 py-2 h-[38px] transition-all active:scale-95 text-xs duration-250 rounded-sm px-5 border border-rose-500/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200"
              onClick={() => {
                deleteGroup.mutate({ groupId: group.id });
                setDeleteDialogOpen(false);
              }}
            >
              Delete group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddSlaveDialog
        open={addSlaveOpen}
        onOpenChange={setAddSlaveOpen}
        groupId={group.id}
        onAdded={() => {
          utils.copier.getDashboard.invalidate();
          utils.copier.listGroups.invalidate();
          setAddSlaveOpen(false);
        }}
      />

      {selectedSlave ? (
        <SlaveSettingsSheet
          open={!!selectedSlave}
          onOpenChange={(open) => {
            if (!open) setSelectedSlave(null);
          }}
          slave={selectedSlave}
          onUpdated={() => {
            utils.copier.getDashboard.invalidate();
            utils.copier.listGroups.invalidate();
            setSelectedSlave(null);
          }}
        />
      ) : null}
    </>
  );
}
