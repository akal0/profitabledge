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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SYNC_INTERVALS } from "@/features/settings/connections/lib/connection-catalog";
import { isTerminalProvider, STATUS_STYLES } from "@/features/settings/connections/lib/connection-status";
import type { ConnectionRow } from "@/features/settings/connections/lib/connection-types";
import { cn } from "@/lib/utils";

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
}) {
  return (
    <>
      <div className="px-6 py-5 sm:px-8">
        <h2 className="text-sm font-semibold text-white">Active Connections</h2>
        <p className="mt-0.5 text-xs text-white/40">
          {scheduledSyncEnabled
            ? "Manage your linked trading platforms."
            : "Manage your linked trading platforms. Background sync is disabled for this beta, so connected accounts sync on demand only."}
        </p>
      </div>

      <Separator />

      {connections && connections.length > 0 ? (
        connections.map((conn, idx) => {
          const statusInfo = STATUS_STYLES[conn.status] ?? STATUS_STYLES.pending;

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
                    <span className="text-[10px] text-white/30">{conn.provider}</span>
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
                        Last sync: {new Date(conn.lastSyncSuccessAt).toLocaleString()}
                      </span>
                    ) : null}
                    {conn.lastSyncedTradeCount != null && conn.lastSyncedTradeCount > 0 ? (
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

                  <div className="flex items-center gap-1.5">
                    <Select
                      value={String(conn.syncIntervalMinutes ?? 60)}
                      onValueChange={(value) => onIntervalChange(conn.id, value)}
                      disabled={!scheduledSyncEnabled}
                    >
                      <SelectTrigger className="!h-7 w-fit max-w-[140px] rounded-sm border border-white/5 bg-transparent !px-2 text-[11px] text-white/60">
                        <Clock className="mr-1 size-3 shrink-0 text-white/30" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-sm border border-white/5 bg-sidebar-accent">
                        {SYNC_INTERVALS.map((option) => (
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
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-white/40 hover:text-white"
                      onClick={() => onTogglePause(conn.id, conn.isPaused)}
                      disabled={!scheduledSyncEnabled}
                    >
                      {conn.isPaused ? <Play className="size-3" /> : <Pause className="size-3" />}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-white/40 hover:text-white"
                      onClick={() => onSync(conn.id)}
                      disabled={
                        isSyncing ||
                        (isTerminalProvider(conn.provider) && !mt5IngestionEnabled)
                      }
                    >
                      <RefreshCw className={cn("size-3", isSyncing && "animate-spin")} />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-white/30 hover:text-red-400"
                      onClick={() => onDelete(conn.id)}
                    >
                      <Trash2 className="size-3" />
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
