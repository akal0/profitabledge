"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { normalizeOriginUrl } from "@profitabledge/platform";
import { toast } from "sonner";
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
import { Separator } from "@/components/ui/separator";
import { ActiveConnectionsSection } from "@/features/settings/connections/components/active-connections-section";
import { AvailablePlatformsSection } from "@/features/settings/connections/components/available-platforms-section";
import { ConnectionCredentialDialog } from "@/features/settings/connections/components/connection-credential-dialog";
import { ConnectionLinkAccountDialog } from "@/features/settings/connections/components/connection-link-account-dialog";
import { TerminalWorkerStatusSection } from "@/features/settings/connections/components/terminal-worker-status-section";
import { AlphaFeatureLocked } from "@/features/platform/alpha/components/alpha-feature-locked";
import { PROVIDERS } from "@/features/settings/connections/lib/connection-catalog";
import {
  buildMt5ConnectionMeta,
  buildMt5PlacementWarning,
  getMt5RegionOptions,
  getRegionGroupLabel,
  MT5_REGION_PREFERENCE_AUTO,
  resolveMt5RequestedRegionGroup,
  type Mt5PlacementWarning,
} from "@/features/settings/connections/lib/mt5-hosting";
import { isTerminalProvider } from "@/features/settings/connections/lib/connection-status";
import type {
  AccountRow,
  ConnectionProviderDefinition,
  ConnectionRow,
  CreateCredentialInput,
  CreateCredentialOutput,
  DeleteConnectionInput,
  LinkAccountInput,
  SyncNowInput,
  SyncNowOutput,
  TerminalSupervisorStatus,
  UpdateSettingsInput,
} from "@/features/settings/connections/lib/connection-types";
import { isPublicAlphaFeatureEnabled } from "@/lib/alpha-flags";
import { trpcOptions } from "@/utils/trpc";

export default function ConnectionsSettingsPage() {
  const connectionsEnabled = isPublicAlphaFeatureEnabled("connections");
  const mt5IngestionEnabled = isPublicAlphaFeatureEnabled("mt5Ingestion");
  const scheduledSyncEnabled = isPublicAlphaFeatureEnabled("scheduledSync");

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showCredentialDialog, setShowCredentialDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState<string | null>(null);
  const [credentialForm, setCredentialForm] = useState<Record<string, string>>({});
  const [displayName, setDisplayName] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedMt5Region, setSelectedMt5Region] = useState(
    MT5_REGION_PREFERENCE_AUTO
  );
  const [pendingMt5Warning, setPendingMt5Warning] =
    useState<Mt5PlacementWarning | null>(null);

  const { data: me } = useQuery({
    ...trpcOptions.users.me.queryOptions(),
    enabled: connectionsEnabled,
  }) as {
    data:
      | {
          widgetPreferences?: {
            timezone?: string | null;
          } | null;
        }
      | undefined;
  };

  const { data: connections, refetch: refetchConnections } = useQuery({
    ...trpcOptions.connections.list.queryOptions(),
    enabled: connectionsEnabled,
  }) as {
    data: ConnectionRow[] | undefined;
    refetch: () => Promise<unknown>;
  };

  const terminalConnections = (connections ?? []).filter((connection) =>
    isTerminalProvider(connection.provider)
  );

  const { data: accounts } = useQuery({
    ...trpcOptions.accounts.list.queryOptions(),
    enabled: connectionsEnabled,
  }) as {
    data: AccountRow[] | undefined;
  };

  const {
    data: terminalSupervisor,
    refetch: refetchTerminalSupervisor,
    isFetching: isFetchingTerminalSupervisor,
  } = useQuery({
    ...trpcOptions.connections.getMtSupervisorStatus.queryOptions(),
    enabled: connectionsEnabled && mt5IngestionEnabled,
    refetchInterval: connectionsEnabled && mt5IngestionEnabled ? 30000 : false,
    refetchIntervalInBackground: false,
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
    mutateAsync: (input: DeleteConnectionInput) => Promise<{ success: boolean }>;
  };

  const updateSettings = useMutation(
    trpcOptions.connections.updateSettings.mutationOptions()
  ) as {
    mutateAsync: (input: UpdateSettingsInput) => Promise<{ success: boolean }>;
  };

  const createCredential = useMutation(
    trpcOptions.connections.createCredential.mutationOptions()
  ) as {
    mutateAsync: (input: CreateCredentialInput) => Promise<CreateCredentialOutput>;
  };

  const linkAccount = useMutation(
    trpcOptions.connections.linkAccount.mutationOptions()
  ) as {
    mutateAsync: (input: LinkAccountInput) => Promise<{ success: boolean }>;
  };

  const refetchConnectionViews = async () => {
    await Promise.all([refetchConnections(), refetchTerminalSupervisor()]);
  };

  const closeCredentialDialog = () => {
    setShowCredentialDialog(false);
    setSelectedProvider(null);
    setCredentialForm({});
    setDisplayName("");
    setSelectedMt5Region(MT5_REGION_PREFERENCE_AUTO);
    setPendingMt5Warning(null);
  };

  const savedTimezone =
    typeof me?.widgetPreferences?.timezone === "string" &&
    me.widgetPreferences.timezone.trim()
      ? me.widgetPreferences.timezone.trim()
      : null;
  const browserTimezone =
    typeof window !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || null
      : null;
  const traderTimezone = savedTimezone ?? browserTimezone;
  const mt5RegionOptions = getMt5RegionOptions(terminalSupervisor?.hosts ?? []);
  const requestedMt5RegionGroup = resolveMt5RequestedRegionGroup({
    traderTimezone,
    selectedRegion: selectedMt5Region,
  });
  const selectedMt5RegionOption =
    mt5RegionOptions.find((option) => option.value === selectedMt5Region) ?? null;
  const regionSelectionHint =
    selectedMt5Region === MT5_REGION_PREFERENCE_AUTO
      ? requestedMt5RegionGroup
        ? `Auto currently maps this trader to ${getRegionGroupLabel(requestedMt5RegionGroup)}.${selectedMt5RegionOption?.hint ? ` ${selectedMt5RegionOption.hint}.` : ""}`
        : "Auto will use the trader timezone if one is available."
      : `This connection will prefer ${getRegionGroupLabel(requestedMt5RegionGroup)} hosts.${selectedMt5RegionOption?.hint ? ` ${selectedMt5RegionOption.hint}.` : ""}`;

  const handleSync = async (connectionId: string) => {
    try {
      const result = await syncNow.mutateAsync({ connectionId });
      if (result.status === "success") {
        toast.success(
          `Synced ${result.tradesInserted} new trade${result.tradesInserted !== 1 ? "s" : ""}`
        );
      } else if (result.status === "skipped") {
        toast.info("Sync is paused");
      } else {
        toast.error(result.errorMessage || "Sync failed");
      }
      await refetchConnectionViews();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
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
        syncIntervalMinutes: parseInt(value, 10),
      });
      await refetchConnectionViews();
    } catch {
      toast.error("Failed to update interval");
    }
  };

  const handleOAuthConnect = async (provider: string) => {
    try {
      const serverOrigin = normalizeOriginUrl(process.env.NEXT_PUBLIC_SERVER_URL);
      if (!serverOrigin) {
        toast.error("Server URL is not configured");
        return;
      }

      const response = await fetch(
        `${serverOrigin}/trpc/connections.getOAuthUrl?input=${encodeURIComponent(
          JSON.stringify({ provider })
        )}`,
        { credentials: "include" }
      );
      const data = await response.json();
      const url = data.result?.data?.url;
      if (url) window.open(url, "_blank");
    } catch {
      toast.error("Failed to get OAuth URL");
    }
  };

  const handleProviderClick = (provider: ConnectionProviderDefinition) => {
    if (provider.status === "coming_soon") {
      toast.info(`${provider.name} is coming soon!`);
      return;
    }
    if (provider.authType === "oauth") {
      void handleOAuthConnect(provider.id);
      return;
    }
    setSelectedProvider(provider.id);
    setSelectedMt5Region(MT5_REGION_PREFERENCE_AUTO);
    setShowCredentialDialog(true);
  };

  const createCredentialMeta = (input: {
    allowOutOfRegion: boolean;
    warning?: Mt5PlacementWarning | null;
  }) => {
    const meta: Record<string, unknown> = {};
    if (credentialForm.serverUrl) meta.serverUrl = credentialForm.serverUrl;

    if (!selectedProvider || !isTerminalProvider(selectedProvider)) {
      return meta;
    }

    return buildMt5ConnectionMeta({
      baseMeta: meta,
      traderTimezone,
      selectedRegion: selectedMt5Region,
      allowOutOfRegion: input.allowOutOfRegion,
      warning: input.warning ?? null,
    });
  };

  const submitCredentialConnection = async (meta: Record<string, unknown>) => {
    if (!selectedProvider || !displayName.trim()) return;
    setIsConnecting(true);

    try {
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

      closeCredentialDialog();
      if (!isTerminalConnection) {
        setShowLinkDialog(result.connectionId);
      }
      await refetchConnectionViews();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCreateCredential = async () => {
    if (!selectedProvider || !displayName.trim()) return;

    if (isTerminalProvider(selectedProvider)) {
      const warning = buildMt5PlacementWarning({
        traderTimezone,
        selectedRegion: selectedMt5Region,
        hosts: terminalSupervisor?.hosts ?? [],
      });

      if (warning) {
        setPendingMt5Warning(warning);
        return;
      }
    }

    await submitCredentialConnection(
      createCredentialMeta({ allowOutOfRegion: false })
    );
  };

  const handleConfirmMt5Warning = async () => {
    if (!pendingMt5Warning) return;

    const warning = pendingMt5Warning;
    setPendingMt5Warning(null);
    await submitCredentialConnection(
      createCredentialMeta({
        allowOutOfRegion: warning.allowCrossRegionFallback,
        warning,
      })
    );
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

  const providers = PROVIDERS.map((provider) =>
    isTerminalProvider(provider.id) && !mt5IngestionEnabled
      ? {
          ...provider,
          status: "coming_soon" as const,
          description:
            "Hosted MT5 terminal sync is held back for this beta while the worker stack is offline.",
          betaNote:
            "Use the EA bridge for broker-side enrichment until hosted MT5 sync is enabled",
        }
      : provider
  );

  const selectedProviderInfo = providers.find(
    (provider) => provider.id === selectedProvider
  );

  if (!connectionsEnabled) {
    return (
      <AlphaFeatureLocked
        feature="connections"
        title="Connections are held back in this alpha"
      />
    );
  }

  return (
    <div className="flex w-full flex-col">
      <ActiveConnectionsSection
        connections={connections}
        isSyncing={syncNow.isPending}
        scheduledSyncEnabled={scheduledSyncEnabled}
        mt5IngestionEnabled={mt5IngestionEnabled}
        onSync={(connectionId) => {
          void handleSync(connectionId);
        }}
        onDelete={(connectionId) => {
          void handleDelete(connectionId);
        }}
        onTogglePause={(connectionId, isPaused) => {
          void handleTogglePause(connectionId, isPaused);
        }}
        onIntervalChange={(connectionId, value) => {
          void handleIntervalChange(connectionId, value);
        }}
        onShowLinkDialog={setShowLinkDialog}
      />

      {mt5IngestionEnabled ? (
        <TerminalWorkerStatusSection
          connectionCount={terminalConnections.length}
          supervisor={terminalSupervisor}
          isFetching={isFetchingTerminalSupervisor}
          onRefresh={() => {
            void refetchTerminalSupervisor();
          }}
        />
      ) : null}

      <AvailablePlatformsSection
        providers={providers}
        mt5IngestionEnabled={mt5IngestionEnabled}
        onProviderClick={handleProviderClick}
      />

      <ConnectionCredentialDialog
        open={showCredentialDialog}
        onOpenChange={(open) => {
          if (open) {
            setShowCredentialDialog(true);
          } else {
            closeCredentialDialog();
          }
        }}
        provider={selectedProviderInfo}
        displayName={displayName}
        credentialForm={credentialForm}
        regionSelectionEnabled={Boolean(
          selectedProvider && isTerminalProvider(selectedProvider)
        )}
        regionOptions={mt5RegionOptions}
        selectedRegion={selectedMt5Region}
        regionHint={regionSelectionHint}
        isConnecting={isConnecting}
        onDisplayNameChange={setDisplayName}
        onCredentialChange={(field, value) => {
          setCredentialForm((previous) => ({
            ...previous,
            [field]: value,
          }));
        }}
        onRegionChange={setSelectedMt5Region}
        onCancel={closeCredentialDialog}
        onSubmit={() => {
          void handleCreateCredential();
        }}
      />

      <AlertDialog
        open={pendingMt5Warning !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingMt5Warning(null);
          }
        }}
      >
        <AlertDialogContent className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-md [&>button]:hidden">
          <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
            <AlertDialogHeader className="px-5 py-4 text-left">
              <AlertDialogTitle className="text-sm font-medium text-white">
                {pendingMt5Warning?.title ?? "Connect to a non-local MT5 host?"}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-1 text-xs leading-relaxed text-white/40">
                {pendingMt5Warning?.description ??
                  "This MT5 connection may be placed on an out-of-region host."}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {pendingMt5Warning?.availableHosts.length ? (
              <>
                <Separator />
                <div className="px-5 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/35">
                    Currently available hosts
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {pendingMt5Warning.availableHosts.map((host) => (
                      <div
                        key={host}
                        className="rounded-sm border border-white/5 bg-sidebar px-2.5 py-2 text-[11px] text-white/55"
                      >
                        {host}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            <Separator />

            <AlertDialogFooter className="flex items-center justify-end gap-2 px-5 py-3">
              <AlertDialogCancel className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none">
                Wait for a local host
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void handleConfirmMt5Warning();
                }}
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-amber-500/20 bg-amber-500/12 px-3 py-2 h-9 text-xs text-amber-100 transition-all duration-250 active:scale-95 hover:bg-amber-500/18 shadow-none"
              >
                {pendingMt5Warning?.confirmLabel ?? "Allow out-of-region placement"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <ConnectionLinkAccountDialog
        openConnectionId={showLinkDialog}
        accounts={accounts}
        onClose={() => setShowLinkDialog(null)}
        onLinkAccount={(connectionId, accountId) => {
          void handleLinkAccount(connectionId, accountId);
        }}
      />
    </div>
  );
}
