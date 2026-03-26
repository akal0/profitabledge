"use client";

import * as React from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Cpu,
  Loader2,
  Radio,
  RefreshCw,
  Server,
} from "lucide-react";
import {
  journalSegmentedActionButtonActiveClassName,
  journalSegmentedActionButtonClassName,
  journalSegmentedActionContainerClassName,
} from "@/components/journal/action-button-styles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  formatStatusTimestamp,
  formatUptime,
} from "@/features/settings/connections/lib/connection-status";
import type { TerminalSupervisorStatus } from "@/features/settings/connections/lib/connection-types";
import { cn } from "@/lib/utils";

type WorkerFilter =
  | "all"
  | "needs_attention"
  | "unhealthy"
  | "stale"
  | "gaps";

type TerminalHostRow = TerminalSupervisorStatus["hosts"][number];
type TerminalWorkerRow = TerminalSupervisorStatus["workers"][number];
type TerminalSessionRow = TerminalSupervisorStatus["sessions"][number];
type PendingTerminalConnection =
  TerminalSupervisorStatus["pendingConnections"][number];

const WORKER_FILTER_OPTIONS: Array<{
  value: WorkerFilter;
  label: string;
}> = [
  { value: "needs_attention", label: "Needs attention" },
  { value: "all", label: "All workers" },
  { value: "unhealthy", label: "Unhealthy" },
  { value: "stale", label: "Stale" },
  { value: "gaps", label: "With gaps" },
];

const STATUS_REFRESH_INTERVAL_MS = 30_000;

function getTimestampMs(value: string | Date | null | undefined) {
  if (!value) return null;

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatRelativeTimestamp(
  value: string | Date | null | undefined,
  now: number
) {
  const timestamp = getTimestampMs(value);
  if (timestamp === null) return "Never";

  const deltaMs = Math.max(0, now - timestamp);

  if (deltaMs < 15_000) return "Just now";
  if (deltaMs < 60_000) return `${Math.floor(deltaMs / 1000)}s ago`;

  const deltaMinutes = Math.floor(deltaMs / 60_000);
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) {
    const remainingMinutes = deltaMinutes % 60;
    return remainingMinutes > 0
      ? `${deltaHours}h ${remainingMinutes}m ago`
      : `${deltaHours}h ago`;
  }

  const deltaDays = Math.floor(deltaHours / 24);
  const remainingHours = deltaHours % 24;
  return remainingHours > 0
    ? `${deltaDays}d ${remainingHours}h ago`
    : `${deltaDays}d ago`;
}

function getRelativeTimestampTone(
  value: string | Date | null | undefined,
  now: number
) {
  const timestamp = getTimestampMs(value);
  if (timestamp === null) return "text-white/25";

  const deltaMs = Math.max(0, now - timestamp);
  if (deltaMs <= 5 * 60_000) return "text-teal-300/70";
  if (deltaMs <= 15 * 60_000) return "text-yellow-200/75";
  return "text-rose-300/75";
}

function hasCompletenessGap(
  completeness:
    | TerminalSessionRow["completeness"]
    | PendingTerminalConnection["completeness"]
    | null
    | undefined
) {
  return Boolean(
    completeness?.historyGapDetected ||
      (completeness?.closeOrdersWithoutExitDeals ?? 0) > 0 ||
      (completeness?.openPositionsMissingEntryDeals ?? 0) > 0
  );
}

function hasWorkerGap(worker: TerminalWorkerRow) {
  return worker.activeConnections.some((session) =>
    hasCompletenessGap(session.completeness)
  );
}

function hasWorkerAttention(worker: TerminalWorkerRow) {
  return Boolean(
    !worker.healthy ||
      !worker.statusFresh ||
      worker.lastError ||
      worker.lastStartError ||
      hasWorkerGap(worker)
  );
}

function hasHostAttention(host: TerminalHostRow) {
  return !host.ok || host.healthyChildren < host.desiredChildren;
}

function getWorkerPriority(worker: TerminalWorkerRow) {
  let score = 0;

  if (!worker.healthy) score += 10;
  if (!worker.statusFresh) score += 8;
  if (worker.lastError || worker.lastStartError) score += 7;
  if (hasWorkerGap(worker)) score += 5;
  if (worker.activeConnections.length === 0) score += 1;

  return score;
}

function getHostPriority(host: TerminalHostRow) {
  let score = 0;

  if (!host.ok) score += 10;
  score += Math.max(host.desiredChildren - host.healthyChildren, 0) * 2;
  score += Math.max(host.desiredChildren - host.runningChildren, 0);

  return score;
}

function getPendingPriority(connection: PendingTerminalConnection) {
  let score = 0;

  if (!connection.isPaused) score += 3;
  if (connection.lastError) score += 4;
  if (hasCompletenessGap(connection.completeness)) score += 2;

  return score;
}

function matchesWorkerFilter(worker: TerminalWorkerRow, filter: WorkerFilter) {
  switch (filter) {
    case "needs_attention":
      return hasWorkerAttention(worker);
    case "unhealthy":
      return !worker.healthy || Boolean(worker.lastError || worker.lastStartError);
    case "stale":
      return !worker.statusFresh;
    case "gaps":
      return hasWorkerGap(worker);
    case "all":
    default:
      return true;
  }
}

export function TerminalWorkerStatusSection({
  connectionCount,
  supervisor,
  isFetching,
  onRefresh,
}: {
  connectionCount: number;
  supervisor: TerminalSupervisorStatus | undefined;
  isFetching: boolean;
  onRefresh: () => void;
}) {
  const [workerFilter, setWorkerFilter] =
    React.useState<WorkerFilter>("needs_attention");
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, STATUS_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  if (connectionCount === 0) return null;

  const hosts = [...(supervisor?.hosts ?? [])].sort((left, right) => {
    const priorityDelta = getHostPriority(right) - getHostPriority(left);
    if (priorityDelta !== 0) return priorityDelta;
    return left.label.localeCompare(right.label);
  });

  const workers = [...(supervisor?.workers ?? [])].sort((left, right) => {
    const priorityDelta = getWorkerPriority(right) - getWorkerPriority(left);
    if (priorityDelta !== 0) return priorityDelta;
    return left.slot - right.slot;
  });

  const visibleWorkers = workers.filter((worker) =>
    matchesWorkerFilter(worker, workerFilter)
  );

  const pendingConnections = [...(supervisor?.pendingConnections ?? [])].sort(
    (left, right) => {
      const priorityDelta = getPendingPriority(right) - getPendingPriority(left);
      if (priorityDelta !== 0) return priorityDelta;
      return left.displayName.localeCompare(right.displayName);
    }
  );

  const unhealthyHostCount = hosts.filter((host) => !host.ok).length;
  const constrainedHostCount = hosts.filter(
    (host) => host.healthyChildren < host.desiredChildren
  ).length;
  const unhealthyWorkerCount = workers.filter(
    (worker) => !worker.healthy || Boolean(worker.lastError || worker.lastStartError)
  ).length;
  const staleWorkerCount = workers.filter((worker) => !worker.statusFresh).length;
  const gapSessionCount = (supervisor?.sessions ?? []).filter((session) =>
    hasCompletenessGap(session.completeness)
  ).length;
  const attentionWorkerCount = workers.filter((worker) =>
    hasWorkerAttention(worker)
  ).length;
  const queuedConnectionCount = pendingConnections.filter(
    (connection) => !connection.isPaused
  ).length;
  const pausedPendingCount = pendingConnections.filter(
    (connection) => connection.isPaused
  ).length;

  return (
    <>
      <Separator />

      <div className="px-6 py-5 sm:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Terminal worker status
            </h2>
            <p className="mt-0.5 text-xs text-white/40">
              Live status from the MT5 supervisor for your credential-sync
              connections.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-xs text-white/60 hover:text-white"
            onClick={onRefresh}
            disabled={isFetching}
          >
            <RefreshCw
              className={cn("mr-1.5 size-3", isFetching && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      </div>

      <div className="space-y-3 px-6 pb-5 sm:px-8">
        {supervisor?.available && supervisor.summary ? (
          <>
            <div className="rounded-sm border border-white/5 bg-sidebar p-1">
              <div className="rounded-sm bg-sidebar-accent">
                <div className="grid grid-cols-1 divide-y divide-white/5 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
                  <div className="p-3.5">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="relative flex items-center justify-center">
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            supervisor.summary.ok ? "bg-teal-400" : "bg-orange-400"
                          )}
                        />
                        <span
                          className={cn(
                            "absolute size-2 animate-ping rounded-full",
                            supervisor.summary.ok
                              ? "bg-teal-400/40"
                              : "bg-orange-400/40"
                          )}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-white/35">
                        Supervisor
                      </span>
                    </div>
                    <p className="text-lg font-semibold leading-tight text-white tabular-nums">
                      {supervisor.summary.ok ? "Healthy" : "Degraded"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-white/30">
                      <span>{supervisor.summary.mode}</span>
                      <span className="text-white/10">·</span>
                      <span className="tabular-nums">
                        {formatUptime(supervisor.summary.uptimeSeconds)} uptime
                      </span>
                      <span className="text-white/10">·</span>
                      <span
                        className={cn(
                          "tabular-nums",
                          getRelativeTimestampTone(supervisor.summary.updatedAt, now)
                        )}
                        title={formatStatusTimestamp(supervisor.summary.updatedAt)}
                      >
                        {formatRelativeTimestamp(supervisor.summary.updatedAt, now)}
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5">
                    <div className="mb-2 flex items-center gap-2">
                      <Server className="size-3 text-white/30" />
                      <span className="text-[10px] font-medium text-white/35">
                        Hosts
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <p className="text-lg font-semibold leading-tight text-white tabular-nums">
                        {supervisor.summary.hostCount}
                      </p>
                      <span className="text-sm text-white/25 tabular-nums">
                        total
                      </span>
                    </div>
                    <p className="mt-2 text-[10px] text-white/30">
                      {unhealthyHostCount} unhealthy · {constrainedHostCount} constrained
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="rounded-full border border-teal-500/15 bg-teal-500/8 px-1.5 py-0 text-[9px] text-teal-300/70">
                        {hosts.filter((host) => host.ok).length} healthy
                      </span>
                      {unhealthyHostCount > 0 ? (
                        <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-1.5 py-0 text-[9px] text-orange-200/80">
                          {unhealthyHostCount} needs review
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="p-3.5">
                    <div className="mb-2 flex items-center gap-2">
                      <Cpu className="size-3 text-white/30" />
                      <span className="text-[10px] font-medium text-white/35">
                        Workers
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <p className="text-lg font-semibold leading-tight text-white tabular-nums">
                        {supervisor.summary.healthyChildren}
                      </p>
                      <span className="text-sm text-white/25 tabular-nums">
                        / {supervisor.summary.desiredChildren}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sidebar">
                      <div
                        className="h-full rounded-full bg-teal-400/70 transition-all duration-500"
                        style={{
                          width: `${
                            supervisor.summary.desiredChildren > 0
                              ? (supervisor.summary.healthyChildren /
                                  supervisor.summary.desiredChildren) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-white/30 tabular-nums">
                      {unhealthyWorkerCount} unhealthy · {staleWorkerCount} stale
                    </p>
                  </div>

                  <div className="p-3.5">
                    <div className="mb-2 flex items-center gap-2">
                      <Radio className="size-3 text-white/30" />
                      <span className="text-[10px] font-medium text-white/35">
                        Coverage
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <p className="text-lg font-semibold leading-tight text-white tabular-nums">
                        {supervisor.sessions.length}
                      </p>
                      <span className="text-sm text-white/25 tabular-nums">
                        / {connectionCount}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sidebar">
                      <div
                        className="h-full rounded-full bg-indigo-400/70 transition-all duration-500"
                        style={{
                          width: `${
                            connectionCount > 0
                              ? (supervisor.sessions.length / connectionCount) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-white/30">
                      {gapSessionCount} with gaps · {queuedConnectionCount} pending
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-sm border border-white/5 bg-sidebar p-1">
              <div className="rounded-sm bg-sidebar-accent px-3.5 py-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="size-3 text-orange-300/70" />
                      <span className="text-xs font-medium text-white/75">
                        Needs attention
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[10px] text-orange-200/80">
                        {attentionWorkerCount} workers with issues
                      </span>
                      <span className="rounded-full border border-yellow-500/20 bg-yellow-500/8 px-2 py-0.5 text-[10px] text-yellow-200/80">
                        {gapSessionCount} sessions with gaps
                      </span>
                      <span className="rounded-full border border-rose-500/20 bg-rose-500/8 px-2 py-0.5 text-[10px] text-rose-200/80">
                        {staleWorkerCount} stale workers
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/45">
                        {queuedConnectionCount} queued
                        {pausedPendingCount > 0 ? ` · ${pausedPendingCount} paused` : ""}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className={journalSegmentedActionContainerClassName}>
                      {WORKER_FILTER_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={cn(
                            journalSegmentedActionButtonClassName,
                            workerFilter === option.value &&
                              journalSegmentedActionButtonActiveClassName
                          )}
                          onClick={() => setWorkerFilter(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-right text-[10px] text-white/30">
                      Showing {visibleWorkers.length} of {workers.length} workers
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {hosts.length > 0 ? (
              <div className="rounded-sm border border-white/5 bg-sidebar p-1">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <Server className="size-3 text-white/35" />
                  <span className="text-xs font-medium text-white/75">
                    Host fleet
                  </span>
                  <Badge className="ml-auto h-4 border-white/10 bg-white/5 py-0 text-[9px] text-white/45">
                    {hosts.length} host{hosts.length === 1 ? "" : "s"}
                  </Badge>
                </div>

                <div className="grid gap-px overflow-hidden rounded-sm bg-white/5 xl:grid-cols-2">
                  {hosts.map((host) => (
                    <div key={host.workerHostId} className="bg-sidebar-accent p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "size-1.5 shrink-0 rounded-full",
                                host.ok ? "bg-teal-400" : "bg-orange-400"
                              )}
                            />
                            <p className="truncate text-xs font-medium text-white/75">
                              {host.label}
                            </p>
                          </div>
                          <p className="mt-1 text-[10px] text-white/35">
                            {[host.provider, host.region, host.environment]
                              .filter(Boolean)
                              .join(" / ") || host.machineName}
                          </p>
                        </div>
                        <Badge
                          className={cn(
                            "h-4 py-0 text-[9px]",
                            hasHostAttention(host)
                              ? "border-orange-500/20 bg-orange-500/10 text-orange-200/80"
                              : "border-teal-500/15 bg-teal-500/8 text-teal-300/70"
                          )}
                        >
                          {host.ok ? "Healthy" : "Degraded"}
                        </Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {[
                          { label: "Desired", value: host.desiredChildren },
                          { label: "Running", value: host.runningChildren },
                          { label: "Healthy", value: host.healthyChildren },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="rounded-sm bg-sidebar px-2 py-2"
                          >
                            <p className="text-[9px] text-white/25">{item.label}</p>
                            <p className="mt-1 text-sm font-semibold text-white tabular-nums">
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 text-[10px]">
                        <span className="text-white/25">{host.mode}</span>
                        <span
                          className={cn(
                            "tabular-nums",
                            getRelativeTimestampTone(host.updatedAt, now)
                          )}
                          title={formatStatusTimestamp(host.updatedAt)}
                        >
                          Updated {formatRelativeTimestamp(host.updatedAt, now)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {visibleWorkers.length > 0 ? (
              visibleWorkers.map((worker) => (
                <div
                  key={worker.workerId}
                  className="rounded-sm border border-white/5 bg-sidebar p-1"
                >
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        worker.healthy ? "bg-teal-400" : "bg-orange-400"
                      )}
                    />
                    <span className="text-xs font-medium text-white/70">
                      Slot {worker.slot}
                    </span>
                    <span className="truncate text-[10px] text-white/35">
                      {worker.hostLabel}
                      {worker.hostProvider || worker.hostRegion ? (
                        <>
                          {" · "}
                          {[worker.hostProvider, worker.hostRegion]
                            .filter(Boolean)
                            .join(" / ")}
                        </>
                      ) : null}
                    </span>
                    <Badge
                      className={cn(
                        "h-max py-0.5 text-[9px]",
                        worker.healthy
                          ? "border-teal-500/20 bg-teal-500/10 text-teal-400/80"
                          : "border-orange-500/20 bg-orange-500/10 text-orange-300/80"
                      )}
                    >
                      {worker.healthy ? "Healthy" : "Degraded"}
                    </Badge>
                    {!worker.statusFresh ? (
                      <Badge className="h-4 border-yellow-500/20 bg-yellow-500/8 py-0 text-[9px] text-yellow-200/75">
                        Stale
                      </Badge>
                    ) : null}
                    {hasWorkerGap(worker) ? (
                      <Badge className="h-4 border-yellow-500/20 bg-yellow-500/8 py-0 text-[9px] text-yellow-200/75">
                        Gaps detected
                      </Badge>
                    ) : null}
                    {worker.hostEnvironment ? (
                      <Badge className="h-4 border-white/10 bg-white/5 py-0 text-[9px] text-white/40">
                        {worker.hostEnvironment}
                      </Badge>
                    ) : null}
                    <div className="ml-auto flex flex-wrap items-center gap-1.5">
                      {[
                        { label: "PID", value: worker.pid ?? "—" },
                        { label: "Phase", value: worker.phase ?? "—" },
                        { label: "Restarts", value: worker.restartCount },
                      ].map((item) => (
                        <span
                          key={item.label}
                          className="inline-flex items-center gap-1 rounded-sm bg-sidebar-accent px-1.5 py-0.5 text-[9px] text-white/35"
                        >
                          <span className="text-white/20">{item.label}</span>
                          <span className="tabular-nums">{item.value}</span>
                        </span>
                      ))}
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-sm bg-sidebar-accent px-1.5 py-0.5 text-[9px] tabular-nums",
                          getRelativeTimestampTone(worker.updatedAt, now)
                        )}
                        title={formatStatusTimestamp(worker.updatedAt)}
                      >
                        Updated {formatRelativeTimestamp(worker.updatedAt, now)}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-sm bg-sidebar-accent">
                    {worker.activeConnections.length > 0 ? (
                      <div className="divide-y divide-white/5">
                        {[...worker.activeConnections]
                          .sort((left, right) => {
                            const leftGap = hasCompletenessGap(left.completeness)
                              ? 1
                              : 0;
                            const rightGap = hasCompletenessGap(right.completeness)
                              ? 1
                              : 0;
                            if (rightGap !== leftGap) return rightGap - leftGap;

                            const leftTime = getTimestampMs(left.lastHeartbeatAt) ?? 0;
                            const rightTime =
                              getTimestampMs(right.lastHeartbeatAt) ?? 0;
                            return leftTime - rightTime;
                          })
                          .map((session) => (
                            <div key={session.connectionId} className="px-3.5 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-medium text-white/75">
                                    {session.displayName}
                                  </p>
                                  <p className="mt-0.5 text-[10px] text-white/30">
                                    {session.provider}
                                  </p>
                                </div>
                                <div className="flex shrink-0 flex-wrap items-center gap-3">
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px]"
                                    title={formatStatusTimestamp(session.lastSyncedAt)}
                                  >
                                    <CheckCircle2 className="size-2.5 text-teal-500/50" />
                                    <span
                                      className={cn(
                                        "tabular-nums",
                                        getRelativeTimestampTone(
                                          session.lastSyncedAt,
                                          now
                                        )
                                      )}
                                    >
                                      {formatRelativeTimestamp(
                                        session.lastSyncedAt,
                                        now
                                      )}
                                    </span>
                                  </span>
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px]"
                                    title={formatStatusTimestamp(
                                      session.lastHeartbeatAt
                                    )}
                                  >
                                    <Activity className="size-2.5 text-white/20" />
                                    <span
                                      className={cn(
                                        "tabular-nums",
                                        getRelativeTimestampTone(
                                          session.lastHeartbeatAt,
                                          now
                                        )
                                      )}
                                    >
                                      {formatRelativeTimestamp(
                                        session.lastHeartbeatAt,
                                        now
                                      )}
                                    </span>
                                  </span>
                                </div>
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                                {hasCompletenessGap(session.completeness) ? (
                                  <>
                                    {session.completeness.closeOrdersWithoutExitDeals >
                                    0 ? (
                                      <span className="rounded-full border border-yellow-500/20 bg-yellow-500/8 px-1.5 py-0 text-yellow-200/70">
                                        {
                                          session.completeness
                                            .closeOrdersWithoutExitDeals
                                        }{" "}
                                        close gap
                                        {session.completeness
                                          .closeOrdersWithoutExitDeals === 1
                                          ? ""
                                          : "s"}
                                      </span>
                                    ) : null}
                                    {session.completeness
                                      .openPositionsMissingEntryDeals > 0 ? (
                                      <span className="rounded-full border border-yellow-500/20 bg-yellow-500/8 px-1.5 py-0 text-yellow-200/70">
                                        {
                                          session.completeness
                                            .openPositionsMissingEntryDeals
                                        }{" "}
                                        entry gap
                                        {session.completeness
                                          .openPositionsMissingEntryDeals === 1
                                          ? ""
                                          : "s"}
                                      </span>
                                    ) : null}
                                  </>
                                ) : (
                                  <span className="rounded-full border border-teal-500/15 bg-teal-500/8 px-1.5 py-0 text-teal-300/70">
                                    Complete
                                  </span>
                                )}
                                <span
                                  className={cn(
                                    "tabular-nums text-white/25",
                                    getRelativeTimestampTone(
                                      session.completeness.lastFullReconcileAt,
                                      now
                                    )
                                  )}
                                  title={formatStatusTimestamp(
                                    session.completeness.lastFullReconcileAt
                                  )}
                                >
                                  Reconcile{" "}
                                  {formatRelativeTimestamp(
                                    session.completeness.lastFullReconcileAt,
                                    now
                                  )}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : !(worker.lastError || worker.lastStartError) ? (
                      <div className="flex items-center justify-center py-5 text-[11px] text-white/25">
                        No sessions assigned
                      </div>
                    ) : null}

                    {worker.lastError || worker.lastStartError ? (
                      <div className="flex items-start gap-2 bg-rose-500/5 px-3.5 py-2.5 text-[11px] text-rose-300/80">
                        <AlertCircle className="mt-0.5 size-3 shrink-0 text-rose-400/60" />
                        <span>{worker.lastError || worker.lastStartError}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-sm border border-white/5 bg-sidebar p-1">
                <div className="flex items-center justify-center rounded-sm bg-sidebar-accent px-4 py-5 text-xs text-white/35">
                  No workers match the current filter.
                </div>
              </div>
            )}

            {pendingConnections.length > 0 ? (
              <div className="rounded-sm border border-yellow-500/15 bg-sidebar p-1">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <Clock className="size-3 text-yellow-400/50" />
                  <span className="text-xs font-medium text-yellow-100/70">
                    Pending connections
                  </span>
                  <Badge className="ml-auto h-4 border-yellow-500/20 bg-yellow-500/10 py-0 text-[9px] text-yellow-400/80">
                    {pendingConnections.length} awaiting
                  </Badge>
                </div>
                <div className="divide-y divide-yellow-500/10 rounded-sm bg-yellow-500/[0.03]">
                  {pendingConnections.map((connection) => (
                    <div
                      key={connection.connectionId}
                      className="flex items-center justify-between gap-2 px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-yellow-100/70">
                          {connection.displayName}
                        </p>
                        <p className="mt-0.5 text-[10px] text-yellow-100/30">
                          {connection.provider}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center rounded-sm bg-yellow-500/8 px-1.5 py-0.5 text-[9px] text-yellow-200/50">
                          {connection.isPaused ? "Paused" : "Queued"}
                        </span>
                        {hasCompletenessGap(connection.completeness) ? (
                          <span className="inline-flex items-center rounded-sm bg-yellow-500/8 px-1.5 py-0.5 text-[9px] text-yellow-200/50">
                            Gaps detected
                          </span>
                        ) : null}
                        {connection.lastError ? (
                          <span className="inline-flex items-center rounded-sm bg-rose-500/10 px-1.5 py-0.5 text-[9px] text-rose-200/70">
                            Error reported
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : supervisor?.error ? (
          <div className="rounded-sm border border-rose-500/15 bg-sidebar p-1">
            <div className="rounded-sm bg-rose-500/[0.03] p-4">
              <div className="mb-2 flex items-center gap-2">
                <AlertCircle className="size-3.5 text-rose-400/60" />
                <span className="text-xs font-medium text-rose-200/80">
                  Supervisor unavailable
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-rose-100/40">
                {supervisor.error}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-sm border border-white/5 bg-sidebar p-1">
            <div className="flex items-center justify-center gap-2 rounded-sm bg-sidebar-accent p-5 text-xs text-white/35">
              <Loader2 className="size-3.5 animate-spin text-white/25" />
              Loading worker status…
            </div>
          </div>
        )}
      </div>
    </>
  );
}
