"use client";

import type { inferRouterOutputs } from "@trpc/server";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BadgeCheck, Clock3, Link2 } from "lucide-react";
import type { AppRouter } from "@profitabledge/contracts/trpc";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type RouterOutput = inferRouterOutputs<AppRouter>;
type SupportSnapshot = RouterOutput["operations"]["getSupportSnapshot"];

function SyncHealthBadge({ value }: { value: string }) {
  const className =
    value === "fresh"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : value === "stale"
      ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
      : value === "offline"
      ? "border-red-400/30 bg-red-400/10 text-red-200"
      : "border-white/15 bg-white/5 text-white/60";

  return <Badge className={className}>{value}</Badge>;
}

export function SupportDiagnosticsPanels({
  snapshot,
}: {
  snapshot: SupportSnapshot;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
      <div className="rounded-2xl border border-white/10 bg-sidebar/70 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Connection diagnostics</h2>
            <p className="mt-1 text-xs text-white/45">
              Current sync state for alpha-supported account connections.
            </p>
          </div>
          <Button asChild variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
            <Link href="/dashboard/settings/connections">
              Connections
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
            <div className="text-[11px] uppercase tracking-wide text-white/35">Connections</div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {snapshot.diagnostics.connectionSummary.total}
            </div>
            <div className="mt-2 text-xs text-white/55">
              {snapshot.diagnostics.connectionSummary.active} active,{" "}
              {snapshot.diagnostics.connectionSummary.error} error,{" "}
              {snapshot.diagnostics.connectionSummary.paused} paused
            </div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
            <div className="text-[11px] uppercase tracking-wide text-white/35">Accounts</div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {snapshot.diagnostics.accountSummary.total}
            </div>
            <div className="mt-2 text-xs text-white/55">
              {snapshot.diagnostics.accountSummary.fresh} fresh,{" "}
              {snapshot.diagnostics.accountSummary.stale} stale,{" "}
              {snapshot.diagnostics.accountSummary.offline} offline
            </div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
            <div className="text-[11px] uppercase tracking-wide text-white/35">Milestones</div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {snapshot.milestones.length}
            </div>
            <div className="mt-2 text-xs text-white/55">
              Activation milestones recorded for this user.
            </div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
            <div className="text-[11px] uppercase tracking-wide text-white/35">Feedback</div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {snapshot.feedback.length}
            </div>
            <div className="mt-2 text-xs text-white/55">
              Recent support and bug reports stored in-app.
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {snapshot.diagnostics.connections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
              No platform connections yet. Add one from the Connections page to start sync diagnostics.
            </div>
          ) : (
            snapshot.diagnostics.connections.slice(0, 6).map((connection) => (
              <div
                key={connection.id}
                className="rounded-xl border border-white/8 bg-white/[0.03] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {connection.displayName}
                      </span>
                      <Badge className="border-white/15 bg-white/5 text-white/70">
                        {connection.provider}
                      </Badge>
                      {connection.isPaused ? (
                        <Badge className="border-amber-400/30 bg-amber-400/10 text-amber-200">
                          paused
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-white/45">
                      Status: {connection.status}
                      {connection.syncIntervalMinutes
                        ? ` · every ${connection.syncIntervalMinutes} min`
                        : ""}
                    </div>
                  </div>
                  {connection.account ? (
                    <SyncHealthBadge
                      value={connection.account.lastSyncedAt ? "linked" : "unlinked"}
                    />
                  ) : null}
                </div>
                <div className="mt-3 grid gap-2 text-xs text-white/55 md:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <Link2 className="size-3.5" />
                    {connection.account
                      ? `${connection.account.name} (${connection.account.broker})`
                      : "No account linked"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock3 className="size-3.5" />
                    Last success: {connection.lastSyncSuccessAt ?? "never"}
                  </div>
                </div>
                {connection.lastError ? (
                  <div className="mt-3 rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-xs text-red-100">
                    {connection.lastError}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-sidebar/70 p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-white">Runtime health</h2>
            <p className="mt-1 text-xs text-white/45">
              Current application uptime, config readiness, and alpha runtime status.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-wide text-white/35">Service</div>
              <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-white">
                <BadgeCheck className="size-4 text-emerald-300" />
                {snapshot.runtime.service}
              </div>
              <div className="mt-2 text-xs text-white/55">
                {snapshot.runtime.status} · {snapshot.runtime.runtime.nodeEnv} ·{" "}
                {snapshot.runtime.uptimeSeconds}s uptime
              </div>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-wide text-white/35">Config</div>
              <div className="mt-2 text-sm font-medium text-white">
                {snapshot.runtime.config.authConfigured ? "Auth ready" : "Auth missing"}
              </div>
              <div className="mt-2 text-xs text-white/55">
                DB {snapshot.runtime.config.databaseConfigured ? "ready" : "missing"} ·
                Worker secret{" "}
                {snapshot.runtime.config.workerSecretConfigured ? "ready" : "missing"} ·
                AI {snapshot.runtime.config.aiConfigured ? "ready" : "missing"}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-sidebar/70 p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-white">Account sync health</h2>
            <p className="mt-1 text-xs text-white/45">
              Last-known recency for each tracked account.
            </p>
          </div>
          <div className="space-y-3">
            {snapshot.diagnostics.accounts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
                No trading accounts yet.
              </div>
            ) : (
              snapshot.diagnostics.accounts.slice(0, 6).map((account) => (
                <div
                  key={account.id}
                  className="rounded-xl border border-white/8 bg-white/[0.03] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-white">
                        {account.name}
                      </div>
                      <div className="mt-1 text-xs text-white/45">
                        {account.broker}
                        {account.accountNumber ? ` · ${account.accountNumber}` : ""}
                      </div>
                    </div>
                    <SyncHealthBadge value={account.syncHealth} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/55">
                    <span>Last sync: {account.lastSyncedAt ?? "never"}</span>
                    {account.liveBalance ? <span>Balance: {account.liveBalance}</span> : null}
                    {account.liveEquity ? <span>Equity: {account.liveEquity}</span> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-sidebar/70 p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-white">Recent sync logs</h2>
            <p className="mt-1 text-xs text-white/45">
              Latest manual or scheduled sync results for quick triage.
            </p>
          </div>
          <div className="space-y-3">
            {snapshot.diagnostics.recentSyncLogs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
                No sync logs recorded yet.
              </div>
            ) : (
              snapshot.diagnostics.recentSyncLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-white/8 bg-white/[0.03] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Badge
                      className={
                        log.status === "success"
                          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                          : log.status === "partial"
                          ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                          : "border-red-400/30 bg-red-400/10 text-red-200"
                      }
                    >
                      {log.status}
                    </Badge>
                    <span className="text-[11px] text-white/40">{log.createdAt}</span>
                  </div>
                  <div className="mt-2 text-xs text-white/55">
                    Inserted {log.tradesInserted} / found {log.tradesFound} trades
                    {typeof log.durationMs === "number" ? ` · ${log.durationMs} ms` : ""}
                  </div>
                  {log.errorMessage ? (
                    <div className="mt-3 flex gap-2 rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-xs text-red-100">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      <span>{log.errorMessage}</span>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-sidebar/70 p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-white">Activation progress</h2>
            <p className="mt-1 text-xs text-white/45">
              Alpha funnel milestones recorded for this user.
            </p>
          </div>
          <div className="space-y-3">
            {snapshot.milestones.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
                No milestones recorded yet.
              </div>
            ) : (
              snapshot.milestones.map((milestone) => (
                <div
                  key={milestone.key}
                  className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300">
                      <BadgeCheck className="size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{milestone.key}</div>
                      <div className="text-xs text-white/45">
                        First seen {milestone.firstSeenAt}
                      </div>
                    </div>
                  </div>
                  <Badge className="border-white/15 bg-white/5 text-white/70">
                    {milestone.count}x
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
