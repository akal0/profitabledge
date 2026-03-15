"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { normalizeOriginUrl } from "@profitabledge/platform";
import { toast } from "sonner";
import { ActiveConnectionsSection } from "@/features/settings/connections/components/active-connections-section";
import { AvailablePlatformsSection } from "@/features/settings/connections/components/available-platforms-section";
import { ConnectionCredentialDialog } from "@/features/settings/connections/components/connection-credential-dialog";
import { ConnectionLinkAccountDialog } from "@/features/settings/connections/components/connection-link-account-dialog";
import { TerminalWorkerStatusSection } from "@/features/settings/connections/components/terminal-worker-status-section";
import { AlphaFeatureLocked } from "@/features/platform/alpha/components/alpha-feature-locked";
import { PROVIDERS } from "@/features/settings/connections/lib/connection-catalog";
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
    enabled:
      connectionsEnabled && mt5IngestionEnabled && terminalConnections.length > 0,
    refetchInterval:
      connectionsEnabled && mt5IngestionEnabled && terminalConnections.length > 0
        ? 10000
        : false,
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
  };

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
    setShowCredentialDialog(true);
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
        isConnecting={isConnecting}
        onDisplayNameChange={setDisplayName}
        onCredentialChange={(field, value) => {
          setCredentialForm((previous) => ({
            ...previous,
            [field]: value,
          }));
        }}
        onCancel={closeCredentialDialog}
        onSubmit={() => {
          void handleCreateCredential();
        }}
      />

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
