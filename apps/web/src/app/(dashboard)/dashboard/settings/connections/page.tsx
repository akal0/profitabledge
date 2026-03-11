"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpcOptions } from "@/utils/trpc";
import { useState } from "react";
import {
  RefreshCw,
  Trash2,
  Link2,
  Pause,
  Play,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plug,
  Globe,
  Shield,
  Cpu,
  Radio,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const PROVIDERS = [
  {
    id: "mt5-terminal",
    name: "MetaTrader 5",
    category: "forex",
    description:
      "Connect with your broker login, password, and server name. Profitabledge runs the terminal worker and syncs history plus live positions without an EA.",
    authType: "credentials" as const,
    fields: ["login", "password", "server"],
    status: "active" as const,
    firms: ["Any MT5 Broker", "FTMO", "FundedNext"],
    color: "#2563EB",
  },
  {
    id: "mt4-terminal",
    name: "MetaTrader 4",
    category: "forex",
    description:
      "Connect with your broker login, password, and server name. MT4 terminal-farm support follows the same model as MT5.",
    authType: "credentials" as const,
    fields: ["login", "password", "server"],
    status: "coming_soon" as const,
    firms: ["Any MT4 Broker", "FundingPips", "Alpha Capital"],
    color: "#1D4ED8",
  },
  {
    id: "ctrader",
    name: "cTrader",
    category: "forex",
    description:
      "OAuth2 connection. Used by FTMO, FundedNext, E8 Markets, FundingPips, Alpha Capital, Maven Trading.",
    authType: "oauth" as const,
    fields: [] as string[],
    status: "active" as const,
    firms: ["FTMO", "FundedNext", "E8", "FundingPips", "Alpha Capital"],
    color: "#00B4D8",
  },
  {
    id: "match-trader",
    name: "Match-Trader",
    category: "forex",
    description:
      "Login with your broker credentials. Used by FTMO, FundedNext, E8 Markets, Maven Trading.",
    authType: "credentials" as const,
    fields: ["serverUrl", "login", "password"],
    status: "active" as const,
    firms: ["FTMO", "FundedNext", "E8", "Maven"],
    color: "#6366F1",
  },
  {
    id: "tradelocker",
    name: "TradeLocker",
    category: "forex",
    description:
      "Login with email & password. Used by FTMO, E8 Markets, Alpha Capital, DNA Funded, BrightFunded.",
    authType: "credentials" as const,
    fields: ["email", "password", "server"],
    status: "active" as const,
    firms: ["FTMO", "E8", "Alpha Capital", "DNA Funded"],
    color: "#10B981",
  },
  {
    id: "dxtrade",
    name: "DXTrade",
    category: "forex",
    description:
      "Used by FundingPips, Alpha Capital, BrightFunded, FundedNext.",
    authType: "credentials" as const,
    fields: ["serverUrl", "login", "password"],
    status: "coming_soon" as const,
    firms: ["FundingPips", "Alpha Capital", "BrightFunded"],
    color: "#F59E0B",
  },
  {
    id: "tradovate",
    name: "Tradovate",
    category: "futures",
    description:
      "Futures platform with REST + WebSocket. Used by Apex Trader Funding, Topstep (legacy).",
    authType: "oauth" as const,
    fields: [] as string[],
    status: "coming_soon" as const,
    firms: ["Apex", "Topstep"],
    color: "#EF4444",
  },
  {
    id: "topstepx",
    name: "TopstepX",
    category: "futures",
    description: "Futures trading platform. Used exclusively by Topstep.",
    authType: "credentials" as const,
    fields: ["apiKey"],
    status: "coming_soon" as const,
    firms: ["Topstep"],
    color: "#8B5CF6",
  },
];

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  active: {
    label: "Connected",
    className: "bg-teal-900/30 text-teal-400 border-teal-500/30",
  },
  syncing: {
    label: "Syncing",
    className: "bg-teal-900/30 text-teal-400 border-teal-500/30",
  },
  pending: {
    label: "Pending",
    className: "bg-yellow-900/30 text-yellow-400 border-yellow-500/30",
  },
  bootstrapping: {
    label: "Bootstrapping",
    className: "bg-yellow-900/30 text-yellow-400 border-yellow-500/30",
  },
  degraded: {
    label: "Degraded",
    className: "bg-orange-900/30 text-orange-300 border-orange-500/30",
  },
  error: {
    label: "Error",
    className: "bg-rose-900/30 text-rose-400 border-rose-500/30",
  },
  expired: {
    label: "Expired",
    className: "bg-rose-900/30 text-rose-400 border-rose-500/30",
  },
  disconnected: {
    label: "Disconnected",
    className: "bg-white/5 text-white/50 border-white/10",
  },
};

const SYNC_INTERVALS = [
  { value: "0", label: "Manual only" },
  { value: "15", label: "Every 15 min" },
  { value: "30", label: "Every 30 min" },
  { value: "60", label: "Every hour" },
  { value: "360", label: "Every 6 hours" },
  { value: "1440", label: "Daily" },
];

function isTerminalProvider(provider: string) {
  return provider === "mt5-terminal" || provider === "mt4-terminal";
}

function formatStatusTimestamp(value: string | Date | null | undefined) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function formatUptime(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return "0s";

  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

type ConnectionRow = {
  id: string;
  accountId: string | null;
  provider: string;
  displayName: string;
  status: string;
  lastSyncSuccessAt: string | Date | null;
  lastSyncedTradeCount: number | null;
  lastError: string | null;
  syncIntervalMinutes: number | null;
  isPaused: boolean;
};

type TerminalWorkerConnection = {
  connectionId: string;
  displayName: string;
  provider: string;
  sessionKey: string | null;
  lastHeartbeatAt: string | null;
  lastSyncedAt: string | null;
  sessionMeta: Record<string, unknown>;
  completeness: {
    openPositionsMissingEntryDeals: number;
    closeOrdersWithoutExitDeals: number;
    lastFullReconcileAt: string | null;
    lastDealTime: string | null;
    lastOrderTime: string | null;
    historyGapDetected: boolean;
  };
};

type TerminalWorkerRow = {
  slot: number;
  workerId: string;
  hostId: string;
  hostLabel: string;
  hostEnvironment: string | null;
  hostProvider: string | null;
  hostRegion: string | null;
  pid: number | null;
  alive: boolean;
  healthy: boolean;
  startedAt: string | null;
  restartCount: number;
  lastExitCode: number | null;
  lastExitAt: string | null;
  lastStartError: string | null;
  nextRestartAt: string | null;
  statusFresh: boolean;
  phase: string | null;
  state: string | null;
  updatedAt: string | null;
  lastError: string | null;
  activeConnections: TerminalWorkerConnection[];
};

type TerminalSessionRow = {
  connectionId: string;
  displayName: string;
  provider: string;
  workerId: string;
  slot: number | null;
  alive: boolean;
  sessionKey: string | null;
  lastHeartbeatAt: string | null;
  lastSyncedAt: string | null;
  sessionMeta: Record<string, unknown>;
  completeness: {
    openPositionsMissingEntryDeals: number;
    closeOrdersWithoutExitDeals: number;
    lastFullReconcileAt: string | null;
    lastDealTime: string | null;
    lastOrderTime: string | null;
    historyGapDetected: boolean;
  };
};

type PendingTerminalConnection = {
  connectionId: string;
  displayName: string;
  provider: string;
  status: string;
  isPaused: boolean;
  lastError: string | null;
  completeness: {
    openPositionsMissingEntryDeals: number;
    closeOrdersWithoutExitDeals: number;
    lastFullReconcileAt: string | null;
    lastDealTime: string | null;
    lastOrderTime: string | null;
    historyGapDetected: boolean;
  } | null;
};

type TerminalHostRow = {
  workerHostId: string;
  label: string;
  machineName: string;
  environment: string | null;
  provider: string | null;
  region: string | null;
  status: string;
  ok: boolean;
  mode: string;
  desiredChildren: number;
  runningChildren: number;
  healthyChildren: number;
  updatedAt: string | null;
};

type TerminalSupervisorStatus = {
  available: boolean;
  error: string | null;
  summary: {
    ok: boolean;
    status: string;
    mode: string;
    hostCount: number;
    desiredChildren: number;
    runningChildren: number;
    healthyChildren: number;
    startedAt: string | null;
    updatedAt: string | null;
    uptimeSeconds: number;
    adminHost: string | null;
    adminPort: number | null;
    historyGapConnections: number;
    closeOrdersWithoutExitDeals: number;
    openPositionsMissingEntryDeals: number;
  } | null;
  hosts: TerminalHostRow[];
  workers: TerminalWorkerRow[];
  sessions: TerminalSessionRow[];
  pendingConnections: PendingTerminalConnection[];
};

type AccountRow = {
  id: string;
  name: string;
  broker: string | null;
};

type SyncNowInput = {
  connectionId: string;
};

type SyncNowOutput = {
  status: "success" | "partial" | "error" | "skipped";
  tradesInserted: number;
  errorMessage: string | null;
};

type DeleteConnectionInput = {
  connectionId: string;
};

type UpdateSettingsInput = {
  connectionId: string;
  syncIntervalMinutes?: number;
  isPaused?: boolean;
  displayName?: string;
};

type CreateCredentialInput = {
  provider: string;
  displayName: string;
  credentials: Record<string, string>;
  meta: Record<string, unknown>;
};

type CreateCredentialOutput = {
  connectionId: string;
  accountInfo: unknown | null;
  mode?: "terminal-farm";
};

type LinkAccountInput = {
  connectionId: string;
  accountId: string;
};

export default function ConnectionsSettingsPage() {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showCredentialDialog, setShowCredentialDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState<string | null>(null);
  const [credentialForm, setCredentialForm] = useState<Record<string, string>>(
    {}
  );
  const [displayName, setDisplayName] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: connections, refetch: refetchConnections } = useQuery(
    trpcOptions.connections.list.queryOptions()
  ) as {
    data: ConnectionRow[] | undefined;
    refetch: () => Promise<unknown>;
  };
  const terminalConnections = (connections ?? []).filter((connection) =>
    isTerminalProvider(connection.provider)
  );
  const { data: accounts } = useQuery(
    trpcOptions.accounts.list.queryOptions()
  ) as {
    data: AccountRow[] | undefined;
  };
  const {
    data: terminalSupervisor,
    refetch: refetchTerminalSupervisor,
    isFetching: isFetchingTerminalSupervisor,
  } = useQuery({
    ...trpcOptions.connections.getMtSupervisorStatus.queryOptions(),
    enabled: terminalConnections.length > 0,
    refetchInterval: terminalConnections.length > 0 ? 10000 : false,
    refetchIntervalInBackground: true,
  }) as {
    data: TerminalSupervisorStatus | undefined;
    refetch: () => Promise<unknown>;
    isFetching: boolean;
  };

  const syncNow = useMutation(
    trpcOptions.connections.syncNow.mutationOptions()
  ) as {
    mutateAsync: (input: SyncNowInput) => Promise<SyncNowOutput>;
    isPending: boolean;
  };
  const deleteConn = useMutation(
    trpcOptions.connections.delete.mutationOptions()
  ) as {
    mutateAsync: (
      input: DeleteConnectionInput
    ) => Promise<{ success: boolean }>;
  };
  const updateSettings = useMutation(
    trpcOptions.connections.updateSettings.mutationOptions()
  ) as {
    mutateAsync: (input: UpdateSettingsInput) => Promise<{ success: boolean }>;
  };
  const createCredential = useMutation(
    trpcOptions.connections.createCredential.mutationOptions()
  ) as {
    mutateAsync: (
      input: CreateCredentialInput
    ) => Promise<CreateCredentialOutput>;
  };
  const linkAccount = useMutation(
    trpcOptions.connections.linkAccount.mutationOptions()
  ) as {
    mutateAsync: (input: LinkAccountInput) => Promise<{ success: boolean }>;
  };

  const refetchConnectionViews = async () => {
    await Promise.all([refetchConnections(), refetchTerminalSupervisor()]);
  };

  const handleSync = async (connectionId: string) => {
    try {
      const result = await syncNow.mutateAsync({ connectionId });
      if (result.status === "success") {
        toast.success(
          `Synced ${result.tradesInserted} new trade${
            result.tradesInserted !== 1 ? "s" : ""
          }`
        );
      } else if (result.status === "skipped") {
        toast.info("Sync is paused");
      } else {
        toast.error(result.errorMessage || "Sync failed");
      }
      await refetchConnectionViews();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      toast.error(msg);
    }
  };

  const handleDelete = async (connectionId: string) => {
    try {
      await deleteConn.mutateAsync({ connectionId });
      toast.success("Connection deleted");
      await refetchConnectionViews();
    } catch {
      toast.error("Failed to delete connection");
    }
  };

  const handleTogglePause = async (connectionId: string, isPaused: boolean) => {
    try {
      await updateSettings.mutateAsync({ connectionId, isPaused: !isPaused });
      toast.success(isPaused ? "Sync resumed" : "Sync paused");
      await refetchConnectionViews();
    } catch {
      toast.error("Failed to update settings");
    }
  };

  const handleIntervalChange = async (connectionId: string, value: string) => {
    try {
      await updateSettings.mutateAsync({
        connectionId,
        syncIntervalMinutes: parseInt(value),
      });
      await refetchConnectionViews();
    } catch {
      toast.error("Failed to update interval");
    }
  };

  const handleProviderClick = (provider: (typeof PROVIDERS)[number]) => {
    if (provider.status === "coming_soon") {
      toast.info(`${provider.name} is coming soon!`);
      return;
    }
    if (provider.authType === "oauth") {
      handleOAuthConnect(provider.id);
      return;
    }
    setSelectedProvider(provider.id);
    setShowCredentialDialog(true);
  };

  const handleOAuthConnect = async (provider: string) => {
    try {
      const res = await fetch(
        `${
          process.env.NEXT_PUBLIC_SERVER_URL
        }/trpc/connections.getOAuthUrl?input=${encodeURIComponent(
          JSON.stringify({ provider })
        )}`,
        { credentials: "include" }
      );
      const data = await res.json();
      const url = data.result?.data?.url;
      if (url) window.open(url, "_blank");
    } catch {
      toast.error("Failed to get OAuth URL");
    }
  };

  const handleCreateCredential = async () => {
    if (!selectedProvider || !displayName.trim()) return;
    setIsConnecting(true);

    try {
      const meta: Record<string, unknown> = {};
      if (credentialForm.serverUrl) meta.serverUrl = credentialForm.serverUrl;

      const result = await createCredential.mutateAsync({
        provider: selectedProvider,
        displayName: displayName.trim(),
        credentials: credentialForm,
        meta,
      });

      const isTerminalConnection = isTerminalProvider(selectedProvider);

      toast.success(
        isTerminalConnection
          ? "Connection queued. The MT terminal worker will attach and create the trading account on first sync."
          : "Connected! Now link a trading account."
      );
      setShowCredentialDialog(false);
      setSelectedProvider(null);
      setCredentialForm({});
      setDisplayName("");
      if (!isTerminalConnection) {
        setShowLinkDialog(result.connectionId);
      }
      await refetchConnectionViews();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      toast.error(msg);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLinkAccount = async (connectionId: string, accountId: string) => {
    try {
      await linkAccount.mutateAsync({ connectionId, accountId });
      toast.success("Account linked! You can now sync trades.");
      setShowLinkDialog(null);
      await refetchConnectionViews();
    } catch {
      toast.error("Failed to link account");
    }
  };

  const selectedProviderInfo = PROVIDERS.find((p) => p.id === selectedProvider);

  return (
    <div className="flex flex-col w-full">
      {/* Active Connections heading */}
      <div className="px-6 sm:px-8 py-5">
        <h2 className="text-sm font-semibold text-white">Active Connections</h2>
        <p className="text-xs text-white/40 mt-0.5">
          Manage your linked trading platforms.
        </p>
      </div>

      <Separator />

      {/* Active connections list */}
      {connections && connections.length > 0 ? (
        connections.map((conn: ConnectionRow, idx: number) => {
          const statusInfo =
            STATUS_STYLES[conn.status] ?? STATUS_STYLES.pending;

          return (
            <div key={conn.id}>
              <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
                <div>
                  <Label className="text-sm text-white/80 font-medium">
                    {conn.displayName}
                  </Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={cn("text-[10px]", statusInfo.className)}>
                      {statusInfo.label}
                    </Badge>
                    <span className="text-[10px] text-white/30">
                      {conn.provider}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  {/* Sync info */}
                  <div className="flex items-center gap-4 text-xs text-white/50">
                    {conn.lastSyncSuccessAt && (
                      <span className="flex items-center gap-1">
                        {conn.lastError ? (
                          <AlertCircle className="size-3 text-rose-400" />
                        ) : (
                          <CheckCircle2 className="size-3 text-teal-500" />
                        )}
                        Last sync:{" "}
                        {new Date(conn.lastSyncSuccessAt).toLocaleString()}
                      </span>
                    )}
                    {conn.lastSyncedTradeCount != null &&
                      conn.lastSyncedTradeCount > 0 && (
                        <span>{conn.lastSyncedTradeCount} trades</span>
                      )}
                  </div>

                  {/* Link account prompt */}
                  {!conn.accountId &&
                    (isTerminalProvider(conn.provider) ? (
                      <div className="text-xs text-white/45 flex items-center gap-1">
                        <Loader2 className="size-3" />
                        Trading account will be created automatically after the
                        first worker sync
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowLinkDialog(conn.id)}
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        <Link2 className="size-3" />
                        Link to a trading account
                      </button>
                    ))}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <Select
                      value={String(conn.syncIntervalMinutes ?? 60)}
                      onValueChange={(v) => handleIntervalChange(conn.id, v)}
                    >
                      <SelectTrigger className="w-fit max-w-[140px] !h-7 !px-2 text-[11px] border border-white/5 rounded-sm bg-transparent text-white/60">
                        <Clock className="size-3 mr-1 shrink-0 text-white/30" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-sidebar-accent border border-white/5 rounded-sm">
                        {SYNC_INTERVALS.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            className="text-[11px]"
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-white/40 hover:text-white"
                      onClick={() => handleTogglePause(conn.id, conn.isPaused)}
                    >
                      {conn.isPaused ? (
                        <Play className="size-3" />
                      ) : (
                        <Pause className="size-3" />
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-white/40 hover:text-white"
                      onClick={() => handleSync(conn.id)}
                      disabled={syncNow.isPending}
                    >
                      <RefreshCw
                        className={cn(
                          "size-3",
                          syncNow.isPending && "animate-spin"
                        )}
                      />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-white/30 hover:text-red-400"
                      onClick={() => handleDelete(conn.id)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              </div>
              {idx < connections.length - 1 && <Separator />}
            </div>
          );
        })
      ) : (
        <div className="px-6 sm:px-8 py-8">
          <div className="flex flex-col items-center text-center">
            <Plug className="size-8 text-white/20 mb-2" />
            <p className="text-sm text-white/40">No active connections</p>
            <p className="text-xs text-white/25 mt-1">
              Connect a trading platform below to start auto-syncing.
            </p>
          </div>
        </div>
      )}

      {terminalConnections.length > 0 && (
        <>
          <Separator />

          <div className="px-6 sm:px-8 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Terminal Worker Status
                </h2>
                <p className="text-xs text-white/40 mt-0.5">
                  Live status from the MT5 supervisor for your credential-sync
                  connections.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs text-white/60 hover:text-white"
                onClick={() => {
                  void refetchTerminalSupervisor();
                }}
                disabled={isFetchingTerminalSupervisor}
              >
                <RefreshCw
                  className={cn(
                    "size-3 mr-1.5",
                    isFetchingTerminalSupervisor && "animate-spin"
                  )}
                />
                Refresh
              </Button>
            </div>
          </div>

          <div className="px-6 sm:px-8 pb-5 space-y-3">
            {terminalSupervisor?.available && terminalSupervisor.summary ? (
              <>
                {/* Summary row - compact inline metrics */}
                <div className="bg-sidebar border border-white/5 p-1 rounded-sm">
                  <div className="bg-sidebar-accent rounded-sm">
                    <div className="grid grid-cols-3 divide-x divide-white/5">
                      {/* Supervisor */}
                      <div className="p-3.5 group/cell">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="relative flex items-center justify-center">
                            <span
                              className={cn(
                                "size-2 rounded-full",
                                terminalSupervisor.summary.ok
                                  ? "bg-teal-400"
                                  : "bg-orange-400"
                              )}
                            />
                            <span
                              className={cn(
                                "absolute size-2 rounded-full animate-ping",
                                terminalSupervisor.summary.ok
                                  ? "bg-teal-400/40"
                                  : "bg-orange-400/40"
                              )}
                            />
                          </div>
                          <span className="text-[10px] uppercase tracking-[0.12em] text-white/35 font-medium">
                            Supervisor
                          </span>
                        </div>
                        <p className="text-lg font-semibold text-white tabular-nums leading-tight">
                          {terminalSupervisor.summary.ok
                            ? "Healthy"
                            : "Degraded"}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] text-white/30">
                            {terminalSupervisor.summary.mode}
                          </span>
                          <span className="text-white/10">·</span>
                          <span className="text-[10px] text-white/30 tabular-nums">
                            {terminalSupervisor.summary.hostCount} host
                            {terminalSupervisor.summary.hostCount === 1
                              ? ""
                              : "s"}
                          </span>
                          <span className="text-white/10">·</span>
                          <span className="text-[10px] text-white/30 tabular-nums">
                            {formatUptime(
                              terminalSupervisor.summary.uptimeSeconds
                            )}{" "}
                            uptime
                          </span>
                        </div>
                      </div>

                      {/* Workers */}
                      <div className="p-3.5 group/cell">
                        <div className="flex items-center gap-2 mb-2">
                          <Cpu className="size-3 text-white/30" />
                          <span className="text-[10px] uppercase tracking-[0.12em] text-white/35 font-medium">
                            Workers
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <p className="text-lg font-semibold text-white tabular-nums leading-tight">
                            {terminalSupervisor.summary.healthyChildren}
                          </p>
                          <span className="text-sm text-white/25 tabular-nums">
                            / {terminalSupervisor.summary.desiredChildren}
                          </span>
                        </div>
                        {/* Worker health bar */}
                        <div className="mt-2 h-1.5 bg-sidebar rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-400/70 rounded-full transition-all duration-500"
                            style={{
                              width: `${
                                terminalSupervisor.summary.desiredChildren > 0
                                  ? (terminalSupervisor.summary
                                      .healthyChildren /
                                      terminalSupervisor.summary
                                        .desiredChildren) *
                                    100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-white/30 mt-1 tabular-nums">
                          {terminalSupervisor.summary.runningChildren} running
                        </p>
                      </div>

                      {/* Sessions */}
                      <div className="p-3.5 group/cell">
                        <div className="flex items-center gap-2 mb-2">
                          <Radio className="size-3 text-white/30" />
                          <span className="text-[10px] uppercase tracking-[0.12em] text-white/35 font-medium">
                            Sessions
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <p className="text-lg font-semibold text-white tabular-nums leading-tight">
                            {terminalSupervisor.sessions.length}
                          </p>
                          <span className="text-sm text-white/25 tabular-nums">
                            / {terminalConnections.length}
                          </span>
                        </div>
                        {/* Session assignment bar */}
                        <div className="mt-2 h-1.5 bg-sidebar rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-400/70 rounded-full transition-all duration-500"
                            style={{
                              width: `${
                                terminalConnections.length > 0
                                  ? (terminalSupervisor.sessions.length /
                                      terminalConnections.length) *
                                    100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        {terminalSupervisor.summary.historyGapConnections > 0 ||
                        terminalSupervisor.summary.closeOrdersWithoutExitDeals >
                          0 ||
                        terminalSupervisor.summary
                          .openPositionsMissingEntryDeals > 0 ? (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {terminalSupervisor.summary.historyGapConnections >
                              0 && (
                              <span className="rounded-full border border-yellow-500/20 bg-yellow-500/8 px-1.5 py-0 text-[9px] text-yellow-200/70">
                                {
                                  terminalSupervisor.summary
                                    .historyGapConnections
                                }{" "}
                                gap
                                {terminalSupervisor.summary
                                  .historyGapConnections === 1
                                  ? ""
                                  : "s"}
                              </span>
                            )}
                            {terminalSupervisor.summary
                              .closeOrdersWithoutExitDeals > 0 && (
                              <span className="rounded-full border border-yellow-500/20 bg-yellow-500/8 px-1.5 py-0 text-[9px] text-yellow-200/70">
                                {
                                  terminalSupervisor.summary
                                    .closeOrdersWithoutExitDeals
                                }{" "}
                                close
                              </span>
                            )}
                            {terminalSupervisor.summary
                              .openPositionsMissingEntryDeals > 0 && (
                              <span className="rounded-full border border-yellow-500/20 bg-yellow-500/8 px-1.5 py-0 text-[9px] text-yellow-200/70">
                                {
                                  terminalSupervisor.summary
                                    .openPositionsMissingEntryDeals
                                }{" "}
                                entry
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-[10px] text-teal-400/50 mt-1">
                            All healthy
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Worker slots */}
                {terminalSupervisor.workers.map((worker) => (
                  <div
                    key={worker.workerId}
                    className="bg-sidebar border border-white/5 p-1 rounded-sm"
                  >
                    {/* Worker header row */}
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <span
                        className={cn(
                          "size-1.5 rounded-full shrink-0",
                          worker.healthy ? "bg-teal-400" : "bg-orange-400"
                        )}
                      />
                      <span className="text-xs font-medium text-white/70">
                        Slot {worker.slot}
                      </span>
                      <span className="text-[10px] text-white/35 truncate">
                        {worker.hostLabel}
                        {(worker.hostProvider || worker.hostRegion) && (
                          <>
                            {" · "}
                            {[worker.hostProvider, worker.hostRegion]
                              .filter(Boolean)
                              .join(" / ")}
                          </>
                        )}
                      </span>
                      <Badge
                        className={cn(
                          "text-[9px] py-0.5 h-max",
                          worker.healthy
                            ? "bg-teal-500/10 text-teal-400/80 border-teal-500/20"
                            : "bg-orange-500/10 text-orange-300/80 border-orange-500/20"
                        )}
                      >
                        {worker.healthy ? "Healthy" : "Degraded"}
                      </Badge>
                      {!worker.statusFresh && (
                        <Badge className="text-[9px] py-0 h-4 bg-white/5 text-white/40 border-white/10">
                          Stale
                        </Badge>
                      )}
                      {worker.hostEnvironment && (
                        <Badge className="text-[9px] py-0 h-4 bg-white/5 text-white/40 border-white/10">
                          {worker.hostEnvironment}
                        </Badge>
                      )}
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

                    {/* Worker sessions */}
                    <div className="bg-sidebar-accent rounded-sm">
                      {worker.activeConnections.length > 0 ? (
                        <div className="divide-y divide-white/5">
                          {worker.activeConnections.map((session) => (
                            <div
                              key={session.connectionId}
                              className="px-3.5 py-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-white/75 truncate">
                                    {session.displayName}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="inline-flex items-center gap-1 text-[10px] text-white/35">
                                    <CheckCircle2 className="size-2.5 text-teal-500/50" />
                                    <span className="tabular-nums">
                                      {formatStatusTimestamp(
                                        session.lastSyncedAt
                                      )}
                                    </span>
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[10px] text-white/35">
                                    <Activity className="size-2.5 text-white/20" />
                                    <span className="tabular-nums">
                                      {formatStatusTimestamp(
                                        session.lastHeartbeatAt
                                      )}
                                    </span>
                                  </span>
                                </div>
                              </div>
                              {session.completeness && (
                                <div className="mt-2 flex items-center gap-1.5 text-[10px]">
                                  {session.completeness.historyGapDetected ? (
                                    <>
                                      {session.completeness
                                        .closeOrdersWithoutExitDeals > 0 && (
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
                                      )}
                                      {session.completeness
                                        .openPositionsMissingEntryDeals > 0 && (
                                        <span className="rounded-full border border-yellow-500/20 bg-yellow-500/8 px-1.5 py-0 text-yellow-200/70">
                                          {
                                            session.completeness
                                              .openPositionsMissingEntryDeals
                                          }{" "}
                                          entry gap
                                          {session.completeness
                                            .openPositionsMissingEntryDeals ===
                                          1
                                            ? ""
                                            : "s"}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="rounded-full border border-teal-500/15 bg-teal-500/8 px-1.5 py-0 text-teal-300/70">
                                      Complete
                                    </span>
                                  )}
                                  <span className="text-white/20 tabular-nums">
                                    Reconcile{" "}
                                    {formatStatusTimestamp(
                                      session.completeness.lastFullReconcileAt
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : !(worker.lastError || worker.lastStartError) ? (
                        <div className="flex items-center justify-center py-5 text-[11px] text-white/25">
                          No sessions assigned
                        </div>
                      ) : null}

                      {(worker.lastError || worker.lastStartError) && (
                        <div className="flex items-start gap-2 bg-rose-500/5 px-3.5 py-2.5 text-[11px] text-rose-300/80">
                          <AlertCircle className="mt-0.5 size-3 shrink-0 text-rose-400/60" />
                          <span>
                            {worker.lastError || worker.lastStartError}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Pending connections */}
                {terminalSupervisor.pendingConnections.length > 0 && (
                  <div className="bg-sidebar border border-yellow-500/15 p-1 rounded-sm">
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <Clock className="size-3 text-yellow-400/50" />
                      <span className="text-[10px] uppercase tracking-[0.12em] text-yellow-400/50 font-medium">
                        Pending
                      </span>
                      <Badge className="text-[9px] py-0 h-4 bg-yellow-500/10 text-yellow-400/80 border-yellow-500/20 ml-auto">
                        {terminalSupervisor.pendingConnections.length} awaiting
                      </Badge>
                    </div>
                    <div className="bg-yellow-500/[0.03] rounded-sm divide-y divide-yellow-500/10">
                      {terminalSupervisor.pendingConnections.map(
                        (connection) => (
                          <div
                            key={connection.connectionId}
                            className="flex items-center justify-between gap-2 px-3.5 py-2.5"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-yellow-100/70 truncate">
                                {connection.displayName}
                              </p>
                              <p className="text-[10px] text-yellow-100/30 mt-0.5">
                                {connection.provider}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="inline-flex items-center rounded-sm bg-yellow-500/8 px-1.5 py-0.5 text-[9px] text-yellow-200/50">
                                {connection.isPaused ? "Paused" : "Queued"}
                              </span>
                              {connection.completeness?.historyGapDetected && (
                                <span className="inline-flex items-center rounded-sm bg-yellow-500/8 px-1.5 py-0.5 text-[9px] text-yellow-200/50">
                                  Gaps detected
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : terminalSupervisor?.error ? (
              <div className="bg-sidebar border border-rose-500/15 p-1 rounded-sm">
                <div className="bg-rose-500/[0.03] rounded-sm p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="size-3.5 text-rose-400/60" />
                    <span className="text-xs font-medium text-rose-200/80">
                      Supervisor unavailable
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-100/40 leading-relaxed">
                    {terminalSupervisor.error}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-sidebar border border-white/5 p-1 rounded-sm">
                <div className="bg-sidebar-accent rounded-sm p-5 flex items-center justify-center gap-2 text-xs text-white/35">
                  <Loader2 className="size-3.5 animate-spin text-white/25" />
                  Loading worker status…
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <Separator />

      {/* Available Platforms heading */}
      <div className="px-6 sm:px-8 py-5">
        <h2 className="text-sm font-semibold text-white">
          Available Platforms
        </h2>
        <p className="text-xs text-white/40 mt-0.5">
          Connect a new trading platform.
        </p>
      </div>

      <Separator />

      {/* Platform rows */}
      {PROVIDERS.map((provider, idx) => (
        <div key={provider.id}>
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
            <div className="flex items-center gap-3">
              <div
                className="size-8 rounded-md flex items-center justify-center shrink-0"
                style={{ backgroundColor: provider.color + "20" }}
              >
                <Globe className="size-4" style={{ color: provider.color }} />
              </div>
              <div>
                <Label className="text-sm text-white/80 font-medium">
                  {provider.name}
                </Label>
                {provider.status === "coming_soon" && (
                  <Badge
                    variant="secondary"
                    className="text-[9px] px-1.5 py-0 ml-2"
                  >
                    Soon
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <p className="text-xs text-white/50">{provider.description}</p>
                <div className="flex flex-wrap gap-1">
                  {provider.firms.map((firm) => (
                    <span
                      key={firm}
                      className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40"
                    >
                      {firm}
                    </span>
                  ))}
                </div>
              </div>
              <Button
                onClick={() => handleProviderClick(provider)}
                disabled={provider.status === "coming_soon"}
                className={cn(
                  "shrink-0 h-[32px] px-4 text-xs cursor-pointer transition-all active:scale-95 duration-250",
                  provider.status === "coming_soon"
                    ? "border border-white/5 bg-sidebar text-white/30"
                    : "border border-white/5 bg-teal-600/25 hover:bg-teal-600/35 text-teal-300"
                )}
              >
                {provider.authType === "oauth" && (
                  <ExternalLink className="size-3 mr-1.5" />
                )}
                {provider.status === "coming_soon" ? "Coming Soon" : "Connect"}
              </Button>
            </div>
          </div>
          {idx < PROVIDERS.length - 1 && <Separator />}
        </div>
      ))}

      <Separator />

      {/* EA info note */}
      <div className="px-6 sm:px-8 py-5">
        <div className="flex gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-md">
          <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-300 mb-1">
              EA Bridge Recommended
            </p>
            <p className="text-xs text-white/50">
              For MT5/MT4, use the EA bridge (Settings &rarr; EA Setup) for 70+
              advanced metrics that API sync cannot capture.
            </p>
          </div>
        </div>
      </div>

      {/* Credential Dialog */}
      <Dialog
        open={showCredentialDialog}
        onOpenChange={setShowCredentialDialog}
      >
        <DialogContent showCloseButton={false} className="bg-sidebar border border-white/5 rounded-md p-0 gap-0">
          <div className="px-6 py-5">
            <DialogHeader className="p-0 space-y-1.5">
              <DialogTitle className="text-base font-semibold text-white">
                Connect to {selectedProviderInfo?.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-white/40">
                Enter your credentials to connect. They will be encrypted and
                stored securely.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex flex-col">
            <Separator />

            <div className="px-6 py-3">
              <h3 className="text-xs font-semibold text-white/70 tracking-wide">Connection</h3>
            </div>
            <Separator />
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-white/50">Connection name</Label>
                <Input
                  placeholder={`My ${selectedProviderInfo?.name ?? ""} Account`}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            </div>

            <Separator />

            <div className="px-6 py-3">
              <h3 className="text-xs font-semibold text-white/70 tracking-wide">Credentials</h3>
            </div>
            <Separator />
            <div className="px-6 py-5 space-y-4">
              {selectedProviderInfo?.fields.map((field) => (
                <div key={field} className="space-y-2">
                  <Label className="text-xs text-white/50">
                    {field === "serverUrl"
                      ? "Server URL"
                      : field.charAt(0).toUpperCase() + field.slice(1)}
                  </Label>
                  <Input
                    type={field === "password" ? "password" : "text"}
                    placeholder={
                      field === "serverUrl"
                        ? "https://broker.match-trader.com"
                        : field === "email"
                        ? "your@email.com"
                        : ""
                    }
                    value={credentialForm[field] ?? ""}
                    onChange={(e) =>
                      setCredentialForm((prev) => ({
                        ...prev,
                        [field]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>

            <Separator />

            <div className="px-6 py-5">
              <div className="flex justify-end gap-3">
                <Button
                  onClick={() => {
                    setShowCredentialDialog(false);
                    setSelectedProvider(null);
                    setCredentialForm({});
                    setDisplayName("");
                  }}
                  className="cursor-pointer flex items-center justify-center py-2 h-[38px] transition-all active:scale-95 text-white/60 hover:text-white w-max text-xs duration-250 border border-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-5"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateCredential}
                  disabled={isConnecting || !displayName.trim()}
                  className="cursor-pointer flex items-center justify-center gap-2 py-2 h-[38px] transition-all active:scale-95 w-max text-xs duration-250 rounded-sm px-5 border border-teal-400/20 bg-teal-400/12 text-teal-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-teal-400/20 hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Connect"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link Account Dialog */}
      <Dialog
        open={!!showLinkDialog}
        onOpenChange={() => setShowLinkDialog(null)}
      >
        <DialogContent showCloseButton={false} className="bg-sidebar border border-white/5 rounded-md p-0 gap-0">
          <div className="px-6 py-5">
            <DialogHeader className="p-0 space-y-1.5">
              <DialogTitle className="text-base font-semibold text-white">
                Link Trading Account
              </DialogTitle>
              <DialogDescription className="text-xs text-white/40">
                Choose which trading account to sync trades into.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex flex-col">
            <Separator />

            <div className="px-6 py-3">
              <h3 className="text-xs font-semibold text-white/70 tracking-wide">Accounts</h3>
            </div>
            <Separator />
            <div className="px-6 py-5 space-y-2">
              {accounts?.map((acct: AccountRow) => (
                <button
                  key={acct.id}
                  onClick={() =>
                    showLinkDialog && handleLinkAccount(showLinkDialog, acct.id)
                  }
                  className="w-full p-3 rounded-sm border border-white/5 hover:border-white/15 bg-sidebar-accent hover:bg-sidebar-accent/80 transition-all text-left flex items-center justify-between"
                >
                  <div>
                    <span className="text-sm font-medium text-white">
                      {acct.name}
                    </span>
                    <span className="ml-2 text-xs text-white/40">
                      {acct.broker}
                    </span>
                  </div>
                  <Link2 className="size-4 text-white/30" />
                </button>
              ))}

              {(!accounts || accounts.length === 0) && (
                <p className="text-sm text-white/40 text-center py-4">
                  No trading accounts found. Create one first.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
