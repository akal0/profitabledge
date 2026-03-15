"use client";

import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Cpu,
  Loader2,
  Radio,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatStatusTimestamp, formatUptime } from "@/features/settings/connections/lib/connection-status";
import type { TerminalSupervisorStatus } from "@/features/settings/connections/lib/connection-types";
import { cn } from "@/lib/utils";

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
  if (connectionCount === 0) return null;

  return (
    <>
      <Separator />

      <div className="px-6 py-5 sm:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Terminal Worker Status
            </h2>
            <p className="mt-0.5 text-xs text-white/40">
              Live status from the MT5 supervisor for your credential-sync connections.
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
                <div className="grid grid-cols-3 divide-x divide-white/5">
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
                      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/35">
                        Supervisor
                      </span>
                    </div>
                    <p className="text-lg font-semibold leading-tight text-white tabular-nums">
                      {supervisor.summary.ok ? "Healthy" : "Degraded"}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="text-[10px] text-white/30">
                        {supervisor.summary.mode}
                      </span>
                      <span className="text-white/10">·</span>
                      <span className="text-[10px] text-white/30 tabular-nums">
                        {supervisor.summary.hostCount} host
                        {supervisor.summary.hostCount === 1 ? "" : "s"}
                      </span>
                      <span className="text-white/10">·</span>
                      <span className="text-[10px] text-white/30 tabular-nums">
                        {formatUptime(supervisor.summary.uptimeSeconds)} uptime
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5">
                    <div className="mb-2 flex items-center gap-2">
                      <Cpu className="size-3 text-white/30" />
                      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/35">
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
                      {supervisor.summary.runningChildren} running
                    </p>
                  </div>

                  <div className="p-3.5">
                    <div className="mb-2 flex items-center gap-2">
                      <Radio className="size-3 text-white/30" />
                      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/35">
                        Sessions
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
                    {supervisor.summary.historyGapConnections > 0 ||
                    supervisor.summary.closeOrdersWithoutExitDeals > 0 ||
                    supervisor.summary.openPositionsMissingEntryDeals > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {supervisor.summary.historyGapConnections > 0 ? (
                          <span className="rounded-full border border-yellow-500/20 bg-yellow-500/8 px-1.5 py-0 text-[9px] text-yellow-200/70">
                            {supervisor.summary.historyGapConnections} gap
                            {supervisor.summary.historyGapConnections === 1 ? "" : "s"}
                          </span>
                        ) : null}
                        {supervisor.summary.closeOrdersWithoutExitDeals > 0 ? (
                          <span className="rounded-full border border-yellow-500/20 bg-yellow-500/8 px-1.5 py-0 text-[9px] text-yellow-200/70">
                            {supervisor.summary.closeOrdersWithoutExitDeals} close
                          </span>
                        ) : null}
                        {supervisor.summary.openPositionsMissingEntryDeals > 0 ? (
                          <span className="rounded-full border border-yellow-500/20 bg-yellow-500/8 px-1.5 py-0 text-[9px] text-yellow-200/70">
                            {supervisor.summary.openPositionsMissingEntryDeals} entry
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-1 text-[10px] text-teal-400/50">All healthy</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {supervisor.workers.map((worker) => (
              <div
                key={worker.workerId}
                className="rounded-sm border border-white/5 bg-sidebar p-1"
              >
                <div className="flex items-center gap-2 px-3 py-2.5">
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
                    <Badge className="h-4 border-white/10 bg-white/5 py-0 text-[9px] text-white/40">
                      Stale
                    </Badge>
                  ) : null}
                  {worker.hostEnvironment ? (
                    <Badge className="h-4 border-white/10 bg-white/5 py-0 text-[9px] text-white/40">
                      {worker.hostEnvironment}
                    </Badge>
                  ) : null}
                  <div className="ml-auto flex items-center gap-1.5">
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
                  </div>
                </div>

                <div className="rounded-sm bg-sidebar-accent">
                  {worker.activeConnections.length > 0 ? (
                    <div className="divide-y divide-white/5">
                      {worker.activeConnections.map((session) => (
                        <div key={session.connectionId} className="px-3.5 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-white/75">
                                {session.displayName}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <span className="inline-flex items-center gap-1 text-[10px] text-white/35">
                                <CheckCircle2 className="size-2.5 text-teal-500/50" />
                                <span className="tabular-nums">
                                  {formatStatusTimestamp(session.lastSyncedAt)}
                                </span>
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] text-white/35">
                                <Activity className="size-2.5 text-white/20" />
                                <span className="tabular-nums">
                                  {formatStatusTimestamp(session.lastHeartbeatAt)}
                                </span>
                              </span>
                            </div>
                          </div>

                          <div className="mt-2 flex items-center gap-1.5 text-[10px]">
                            {session.completeness?.historyGapDetected ? (
                              <>
                                {session.completeness.closeOrdersWithoutExitDeals > 0 ? (
                                  <span className="rounded-full border border-yellow-500/20 bg-yellow-500/8 px-1.5 py-0 text-yellow-200/70">
                                    {session.completeness.closeOrdersWithoutExitDeals} close gap
                                    {session.completeness.closeOrdersWithoutExitDeals === 1 ? "" : "s"}
                                  </span>
                                ) : null}
                                {session.completeness.openPositionsMissingEntryDeals > 0 ? (
                                  <span className="rounded-full border border-yellow-500/20 bg-yellow-500/8 px-1.5 py-0 text-yellow-200/70">
                                    {session.completeness.openPositionsMissingEntryDeals} entry gap
                                    {session.completeness.openPositionsMissingEntryDeals === 1 ? "" : "s"}
                                  </span>
                                ) : null}
                              </>
                            ) : (
                              <span className="rounded-full border border-teal-500/15 bg-teal-500/8 px-1.5 py-0 text-teal-300/70">
                                Complete
                              </span>
                            )}
                            <span className="tabular-nums text-white/20">
                              Reconcile {formatStatusTimestamp(session.completeness.lastFullReconcileAt)}
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
            ))}

            {supervisor.pendingConnections.length > 0 ? (
              <div className="rounded-sm border border-yellow-500/15 bg-sidebar p-1">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <Clock className="size-3 text-yellow-400/50" />
                  <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-yellow-400/50">
                    Pending
                  </span>
                  <Badge className="ml-auto h-4 border-yellow-500/20 bg-yellow-500/10 py-0 text-[9px] text-yellow-400/80">
                    {supervisor.pendingConnections.length} awaiting
                  </Badge>
                </div>
                <div className="divide-y divide-yellow-500/10 rounded-sm bg-yellow-500/[0.03]">
                  {supervisor.pendingConnections.map((connection) => (
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
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="inline-flex items-center rounded-sm bg-yellow-500/8 px-1.5 py-0.5 text-[9px] text-yellow-200/50">
                          {connection.isPaused ? "Paused" : "Queued"}
                        </span>
                        {connection.completeness?.historyGapDetected ? (
                          <span className="inline-flex items-center rounded-sm bg-yellow-500/8 px-1.5 py-0.5 text-[9px] text-yellow-200/50">
                            Gaps detected
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
