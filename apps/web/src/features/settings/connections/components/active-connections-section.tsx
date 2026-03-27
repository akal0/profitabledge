"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Link2,
  Loader2,
  Pause,
  Play,
  Plug,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPropAssignActionButtonClassName } from "@/features/accounts/lib/prop-assign-action-button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SYNC_INTERVALS } from "@/features/settings/connections/lib/connection-catalog";
import {
  isTerminalProvider,
  STATUS_STYLES,
} from "@/features/settings/connections/lib/connection-status";
import type { ConnectionRow } from "@/features/settings/connections/lib/connection-types";
import { cn } from "@/lib/utils";

function formatSyncIntervalLabel(minutes: number) {
  if (minutes <= 0) return "Manual only";
  if (minutes === 60) return "Every hour";
  if (minutes < 60) return `Every ${minutes} min`;
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? "Daily" : `Every ${days} days`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `Every ${hours} hours`;
  }

  return `Every ${minutes} min`;
}

function getResolvedSyncIntervalOption(syncIntervalMinutes: number | null) {
  const fallbackMinutes = 0;
  const normalizedMinutes =
    typeof syncIntervalMinutes === "number" &&
    Number.isFinite(syncIntervalMinutes)
      ? syncIntervalMinutes
      : fallbackMinutes;

  const normalizedValue = String(normalizedMinutes);
  const existingOption = SYNC_INTERVALS.find(
    (option) => option.value === normalizedValue
  );

  if (existingOption) {
    return {
      selectedValue: existingOption.value,
      options: SYNC_INTERVALS,
    };
  }

  return {
    selectedValue: normalizedValue,
    options: [
      ...SYNC_INTERVALS,
      {
        value: normalizedValue,
        label: formatSyncIntervalLabel(normalizedMinutes),
      },
    ],
  };
}

export function ActiveConnectionsSection({
  connections,
  isSyncing,
  onSync,
  onDelete,
  onTogglePause,
  onIntervalChange,
  onShowLinkDialog,
  scheduledSyncEnabled,
  mt5IngestionEnabled,
  activePlanTitle,
  liveSyncSlotsIncluded,
  liveSyncSlotsUsed,
  liveSyncSlotsRemaining,
}: {
  connections: ConnectionRow[] | undefined;
  isSyncing: boolean;
  onSync: (connectionId: string) => void;
  onDelete: (connectionId: string) => void;
  onTogglePause: (connectionId: string, isPaused: boolean) => void;
  onIntervalChange: (connectionId: string, value: string) => void;
  onShowLinkDialog: (connectionId: string) => void;
  scheduledSyncEnabled: boolean;
  mt5IngestionEnabled: boolean;
  activePlanTitle: string;
  liveSyncSlotsIncluded: number;
  liveSyncSlotsUsed: number;
  liveSyncSlotsRemaining: number;
}) {
  const liveSyncSummaryLabel =
    liveSyncSlotsIncluded > 0
      ? `${liveSyncSlotsRemaining} left of ${liveSyncSlotsIncluded}`
      : "No live sync slots";

  const liveSyncSummaryToneClassName =
    liveSyncSlotsIncluded === 0
      ? "ring-white/10 bg-white/5 text-white/55"
      : liveSyncSlotsRemaining > 0
      ? "ring-teal-400/20 bg-teal-500/10 text-teal-300"
      : "ring-amber-400/20 bg-amber-500/10 text-amber-200";

  return (
    <>
      <div className="px-6 py-5 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Active connections
            </h2>
            <p className="mt-0.5 text-xs text-white/40">
              {scheduledSyncEnabled
                ? "Manage your linked trading platforms."
                : "Manage your linked trading platforms. Background sync is disabled for this beta, so connected accounts sync on demand only."}
            </p>
          </div>

          <Badge
            className={cn(
              "rounded-sm px-2.5 py-1 text-[10px] font-medium",
              liveSyncSummaryToneClassName
            )}
          >
            {activePlanTitle}: {liveSyncSummaryLabel}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-white/40">
          {liveSyncSlotsIncluded > 0
            ? `${liveSyncSlotsUsed} connection${liveSyncSlotsUsed === 1 ? "" : "s"} linked. ${liveSyncSlotsRemaining} live sync slot${liveSyncSlotsRemaining === 1 ? "" : "s"} remaining on ${activePlanTitle}.`
            : `${activePlanTitle} does not include live sync slots.`}
        </p>
      </div>

      <Separator />

      {connections && connections.length > 0 ? (
        connections.map((conn, idx) => {
          const statusInfo =
            STATUS_STYLES[conn.status] ?? STATUS_STYLES.pending;
          const syncInterval = getResolvedSyncIntervalOption(
            conn.syncIntervalMinutes
          );

          return (
            <div key={conn.id}>
              <div className="grid grid-cols-1 items-start gap-2 px-6 py-5 sm:grid-cols-[200px_1fr] sm:gap-6 sm:px-8">
                <div>
                  <Label className="text-sm font-medium text-white/80">
                    {conn.displayName}
                  </Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge className={cn("text-[10px]", statusInfo.className)}>
                      {statusInfo.label}
                    </Badge>
                    <span className="text-[10px] text-white/30">
                      {conn.provider}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-4 text-xs text-white/50">
                    {conn.lastSyncSuccessAt ? (
                      <span className="flex items-center gap-1">
                        {conn.lastError ? (
                          <AlertCircle className="size-3 text-rose-400" />
                        ) : (
                          <CheckCircle2 className="size-3 text-teal-500" />
                        )}
                        Last sync:{" "}
                        {new Date(conn.lastSyncSuccessAt).toLocaleString()}
                      </span>
                    ) : null}
                    {conn.lastSyncedTradeCount != null &&
                    conn.lastSyncedTradeCount > 0 ? (
                      <span>{conn.lastSyncedTradeCount} trades</span>
                    ) : null}
                  </div>

                  {!conn.accountId ? (
                    isTerminalProvider(conn.provider) ? (
                      <div className="flex items-center gap-1 text-xs text-white/45">
                        <Loader2 className="size-3" />
                        {mt5IngestionEnabled
                          ? "Trading account will be created automatically after the first worker sync"
                          : "Terminal-worker account creation is unavailable in this beta"}
                      </div>
                    ) : (
                      <button
                        onClick={() => onShowLinkDialog(conn.id)}
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                      >
                        <Link2 className="size-3" />
                        Link to a trading account
                      </button>
                    )
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={syncInterval.selectedValue}
                      onValueChange={(value) =>
                        onIntervalChange(conn.id, value)
                      }
                      disabled={!scheduledSyncEnabled}
                    >
                      <SelectTrigger
                        size="sm"
                        className="w-fit max-w-[140px] rounded-sm ring-white/10 bg-sidebar-accent px-2.5 text-[11px] text-white/70 shadow-sm"
                      >
                        <Clock className="size-3 shrink-0 text-white/30" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-sm ring ring-white/5 bg-sidebar-accent">
                        {syncInterval.options.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            className="text-[11px]"
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      className={getPropAssignActionButtonClassName({
                        tone: "neutral",
                        size: "sm",
                      })}
                      onClick={() => onTogglePause(conn.id, conn.isPaused)}
                      disabled={!scheduledSyncEnabled}
                    >
                      {conn.isPaused ? (
                        <Play className="size-3" />
                      ) : (
                        <Pause className="size-3" />
                      )}
                      {conn.isPaused ? "Resume connection" : "Pause connection"}
                    </Button>

                    <Button
                      className={getPropAssignActionButtonClassName({
                        tone: "teal",
                        size: "sm",
                      })}
                      onClick={() => onSync(conn.id)}
                      disabled={
                        isSyncing ||
                        (isTerminalProvider(conn.provider) &&
                          !mt5IngestionEnabled)
                      }
                    >
                      <RefreshCw
                        className={cn("size-3", isSyncing && "animate-spin")}
                      />
                      Sync connection
                    </Button>

                    <Button
                      className={getPropAssignActionButtonClassName({
                        tone: "danger",
                        size: "sm",
                      })}
                      onClick={() => onDelete(conn.id)}
                    >
                      <Trash2 className="size-3" />
                      Delete connection
                    </Button>
                  </div>
                </div>
              </div>

              {idx < connections.length - 1 ? <Separator /> : null}
            </div>
          );
        })
      ) : (
        <div className="px-6 py-8 sm:px-8">
          <div className="flex flex-col items-center text-center">
            <Plug className="mb-2 size-8 text-white/20" />
            <p className="text-sm text-white/40">No active connections</p>
            <p className="mt-1 text-xs text-white/25">
              {scheduledSyncEnabled
                ? "Connect a trading platform below to start auto-syncing."
                : "Connect a trading platform below to enable manual sync during the beta."}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
