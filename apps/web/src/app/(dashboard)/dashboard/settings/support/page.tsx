"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ExternalLink,
  LifeBuoy,
  RefreshCw,
  Server,
} from "lucide-react";

import { AlphaFeatureLocked } from "@/features/platform/alpha/components/alpha-feature-locked";
import { RequestFeatureDialog } from "@/features/navigation/components/request-feature-dialog";
import { isPublicAlphaFeatureEnabled } from "@/lib/alpha-flags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { trpcOptions } from "@/utils/trpc";

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function StatusBadge({
  value,
}: {
  value: boolean;
}) {
  return value ? (
    <Badge className="border-emerald-400/20 bg-emerald-500/10 text-emerald-200">
      Configured
    </Badge>
  ) : (
    <Badge className="border-amber-400/20 bg-amber-500/10 text-amber-200">
      Missing
    </Badge>
  );
}

export default function SupportSettingsPage() {
  const supportEnabled = isPublicAlphaFeatureEnabled("supportDiagnostics");
  const feedbackEnabled = isPublicAlphaFeatureEnabled("feedback");
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);

  const { data: snapshot, refetch, isFetching } = useQuery({
    ...trpcOptions.operations.getSupportSnapshot.queryOptions(),
    enabled: supportEnabled,
  });

  if (!supportEnabled) {
    return (
      <AlphaFeatureLocked
        feature="supportDiagnostics"
        title="Support diagnostics are held back in this alpha"
      />
    );
  }

  const connectionSummary = snapshot?.diagnostics.connectionSummary;
  const accountSummary = snapshot?.diagnostics.accountSummary;
  const recentErrors = snapshot?.recentErrors ?? [];
  const recentSyncLogs = snapshot?.diagnostics.recentSyncLogs ?? [];
  const runtime = snapshot?.runtime;

  return (
    <>
      <div className="flex w-full flex-col">
        <div className="grid grid-cols-1 gap-3 px-6 py-5 sm:grid-cols-[200px_1fr] sm:gap-6 sm:px-8">
          <div>
            <Label className="text-sm font-medium text-white/80">Support</Label>
            <p className="mt-0.5 text-xs text-white/40">
              Runtime diagnostics, connection health, and private feedback.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              <RefreshCw
                className={`size-3.5 ${isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            {feedbackEnabled ? (
              <Button
                type="button"
                onClick={() => setFeatureDialogOpen(true)}
                className="bg-blue-900/30 text-blue-200 hover:bg-blue-900/40"
              >
                <LifeBuoy className="size-3.5" />
                Request feature
              </Button>
            ) : null}
            <a
              href={`mailto:${snapshot?.supportEmail ?? "support@profitabledge.com"}`}
              className="flex h-[38px] items-center gap-2 rounded-md bg-white px-4 py-2 text-xs text-black transition hover:bg-white/90"
            >
              Email support
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>

        <Separator />

        <div className="px-6 py-5 sm:px-8">
          <div className="mb-3 flex items-center gap-2">
            <Server className="size-4 text-teal-300" />
            <h2 className="text-sm font-semibold text-white">Runtime snapshot</h2>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-md border border-white/5 bg-sidebar-accent p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">Server</span>
                <Badge className="border-emerald-400/20 bg-emerald-500/10 text-emerald-200">
                  {runtime?.status ?? "loading"}
                </Badge>
              </div>
              <div className="mt-3 space-y-2 text-xs text-white/60">
                <div className="flex items-center justify-between">
                  <span>Environment</span>
                  <span className="text-white">
                    {runtime?.runtime.nodeEnv ?? "Unknown"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Uptime</span>
                  <span className="text-white">
                    {runtime ? `${runtime.uptimeSeconds}s` : "Unknown"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last snapshot</span>
                  <span className="text-white">
                    {formatDate(runtime?.timestamp)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-white/5 bg-sidebar-accent p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">Connections</span>
                <Badge className="border-white/10 bg-white/5 text-white/60">
                  {connectionSummary?.total ?? 0}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/60">
                <div className="rounded-md border border-white/5 bg-black/10 p-3">
                  <div className="text-white">{connectionSummary?.active ?? 0}</div>
                  <div>Active</div>
                </div>
                <div className="rounded-md border border-white/5 bg-black/10 p-3">
                  <div className="text-white">{connectionSummary?.error ?? 0}</div>
                  <div>Error</div>
                </div>
                <div className="rounded-md border border-white/5 bg-black/10 p-3">
                  <div className="text-white">{connectionSummary?.paused ?? 0}</div>
                  <div>Paused</div>
                </div>
                <div className="rounded-md border border-white/5 bg-black/10 p-3">
                  <div className="text-white">
                    {connectionSummary?.terminal ?? 0}
                  </div>
                  <div>Terminal</div>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-white/5 bg-sidebar-accent p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">Accounts</span>
                <Badge className="border-white/10 bg-white/5 text-white/60">
                  {accountSummary?.total ?? 0}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/60">
                <div className="rounded-md border border-white/5 bg-black/10 p-3">
                  <div className="text-white">{accountSummary?.fresh ?? 0}</div>
                  <div>Fresh</div>
                </div>
                <div className="rounded-md border border-white/5 bg-black/10 p-3">
                  <div className="text-white">{accountSummary?.stale ?? 0}</div>
                  <div>Stale</div>
                </div>
                <div className="rounded-md border border-white/5 bg-black/10 p-3">
                  <div className="text-white">{accountSummary?.offline ?? 0}</div>
                  <div>Offline</div>
                </div>
                <div className="rounded-md border border-white/5 bg-black/10 p-3">
                  <div className="text-white">
                    {accountSummary?.neverSynced ?? 0}
                  </div>
                  <div>Never synced</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="px-6 py-5 sm:px-8">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="size-4 text-blue-300" />
            <h2 className="text-sm font-semibold text-white">Server config</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="flex items-center justify-between rounded-md border border-white/5 bg-sidebar-accent p-4 text-sm text-white/70">
              <span>Database</span>
              <StatusBadge value={Boolean(runtime?.config.databaseConfigured)} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-white/5 bg-sidebar-accent p-4 text-sm text-white/70">
              <span>Auth</span>
              <StatusBadge value={Boolean(runtime?.config.authConfigured)} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-white/5 bg-sidebar-accent p-4 text-sm text-white/70">
              <span>Credential encryption</span>
              <StatusBadge
                value={Boolean(runtime?.config.credentialEncryptionConfigured)}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-white/5 bg-sidebar-accent p-4 text-sm text-white/70">
              <span>Worker secret</span>
              <StatusBadge
                value={Boolean(runtime?.config.workerSecretConfigured)}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-white/5 bg-sidebar-accent p-4 text-sm text-white/70">
              <span>UploadThing</span>
              <StatusBadge value={Boolean(runtime?.config.uploadthingConfigured)} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-white/5 bg-sidebar-accent p-4 text-sm text-white/70">
              <span>AI provider path</span>
              <StatusBadge value={Boolean(runtime?.config.aiConfigured)} />
            </div>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 gap-6 px-6 py-5 lg:grid-cols-2 sm:px-8">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-300" />
              <h2 className="text-sm font-semibold text-white">
                Recent visible errors
              </h2>
            </div>
            <div className="space-y-3">
              {recentErrors.length === 0 ? (
                <div className="rounded-md border border-white/5 bg-sidebar-accent p-4 text-sm text-white/50">
                  No recent visible errors for this member.
                </div>
              ) : (
                recentErrors.slice(0, 5).map((error) => (
                  <div
                    key={error.id}
                    className="rounded-md border border-white/5 bg-sidebar-accent p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-white">
                          {error.summary || error.name}
                        </div>
                        <div className="mt-1 text-xs text-white/45">
                          {error.category} • {error.source}
                        </div>
                      </div>
                      <Badge className="border-white/10 bg-white/5 text-white/60">
                        {error.level}
                      </Badge>
                    </div>
                    <div className="mt-3 text-xs text-white/40">
                      {formatDate(error.createdAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <RefreshCw className="size-4 text-sky-300" />
              <h2 className="text-sm font-semibold text-white">
                Recent sync logs
              </h2>
            </div>
            <div className="space-y-3">
              {recentSyncLogs.length === 0 ? (
                <div className="rounded-md border border-white/5 bg-sidebar-accent p-4 text-sm text-white/50">
                  No recent sync attempts recorded yet.
                </div>
              ) : (
                recentSyncLogs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="rounded-md border border-white/5 bg-sidebar-accent p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-white">
                          {log.status}
                        </div>
                        <div className="mt-1 text-xs text-white/45">
                          Found {log.tradesFound ?? 0} • Inserted{" "}
                          {log.tradesInserted ?? 0} • Duplicated{" "}
                          {log.tradesDuplicated ?? 0}
                        </div>
                        {log.errorMessage ? (
                          <div className="mt-2 text-xs text-amber-200/80">
                            {log.errorMessage}
                          </div>
                        ) : null}
                      </div>
                      <Badge className="border-white/10 bg-white/5 text-white/60">
                        {log.durationMs ? `${log.durationMs}ms` : "n/a"}
                      </Badge>
                    </div>
                    <div className="mt-3 text-xs text-white/40">
                      {formatDate(log.createdAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <RequestFeatureDialog
        open={featureDialogOpen}
        onOpenChange={setFeatureDialogOpen}
        pagePath="/dashboard/settings/support"
      />
    </>
  );
}
