"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ExternalLink,
  Key,
  Link2,
  Trash2,
  X,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ACTIVE_BROKER_CATALOG,
  ACTIVE_PROP_FIRM_CATALOG,
} from "@profitabledge/contracts/trading-catalog";
import {
  GoalContentSeparator,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { BrokerOptionSelector } from "@/features/accounts/components/broker-option-selector";
import { SELECTABLE_BROKER_OPTIONS } from "@/features/accounts/lib/account-metadata";
import { getPropAssignActionButtonClassName } from "@/features/accounts/lib/prop-assign-action-button";
import { ConnectionLinkAccountDialog } from "@/features/settings/connections/components/connection-link-account-dialog";
import { PROVIDERS } from "@/features/settings/connections/lib/connection-catalog";
import type {
  AccountRow,
  ConnectionProviderDefinition,
  ConnectionRow,
  CreateCredentialInput,
  CreateCredentialOutput,
  DeleteConnectionInput,
  LinkAccountInput,
} from "@/features/settings/connections/lib/connection-types";
import { STATUS_STYLES } from "@/features/settings/connections/lib/connection-status";
import { trpcOptions } from "@/utils/trpc";
import { toast } from "sonner";

type TradingEntitySelection =
  | (typeof ACTIVE_PROP_FIRM_CATALOG)[number]
  | (typeof ACTIVE_BROKER_CATALOG)[number]
  | null;

type ProviderConnectionRow = ConnectionRow & {
  meta?: Record<string, unknown> | null;
};

function getTradingEntityPlatforms(entity: TradingEntitySelection) {
  if (!entity) {
    return [] as string[];
  }

  return entity.type === "prop-firm" ? entity.supportedPlatforms : entity.platforms;
}

function formatCredentialFieldLabel(field: string) {
  if (field === "apiKey") return "API key";

  const normalized = field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();

  if (!normalized) return field;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getCredentialPlaceholder(field: string) {
  if (field === "username") return "your_username";
  if (field === "apiKey") return "Paste your API key";
  return "";
}

export default function APISettingsPage() {
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [showProviderDialog, setShowProviderDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState<string | null>(null);
  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);
  const [selectedTradingEntityId, setSelectedTradingEntityId] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [providerConnectionName, setProviderConnectionName] = useState("");
  const [providerCredentialForm, setProviderCredentialForm] = useState<
    Record<string, string>
  >({});

  const { data: apiKeys, refetch: refetchKeys } = useQuery(
    trpcOptions.apiKeys.list.queryOptions()
  );
  const { data: accounts } = useQuery({
    ...trpcOptions.accounts.list.queryOptions(),
  }) as {
    data: AccountRow[] | undefined;
  };
  const { data: connections, refetch: refetchConnections } = useQuery({
    ...trpcOptions.connections.list.queryOptions(),
  }) as {
    data: ProviderConnectionRow[] | undefined;
    refetch: () => Promise<unknown>;
  };

  const generateKey = useMutation(
    trpcOptions.apiKeys.generate.mutationOptions()
  );
  const revokeKey = useMutation(trpcOptions.apiKeys.revoke.mutationOptions());
  const deleteKey = useMutation(trpcOptions.apiKeys.delete.mutationOptions());
  const createCredential = useMutation(
    trpcOptions.connections.createCredential.mutationOptions()
  ) as {
    mutateAsync: (input: CreateCredentialInput) => Promise<CreateCredentialOutput>;
    isPending: boolean;
  };
  const deleteConnection = useMutation(
    trpcOptions.connections.delete.mutationOptions()
  ) as {
    mutateAsync: (input: DeleteConnectionInput) => Promise<{ success: boolean }>;
    isPending: boolean;
  };
  const linkAccount = useMutation(
    trpcOptions.connections.linkAccount.mutationOptions()
  ) as {
    mutateAsync: (input: LinkAccountInput) => Promise<{ success: boolean }>;
  };

  const apiKeyProviders = useMemo(
    () => PROVIDERS.filter((provider) => provider.authType === "api_key"),
    []
  );
  const providerInfoById = useMemo(
    () => new Map(PROVIDERS.map((provider) => [provider.id, provider])),
    []
  );
  const brokerApiKeyConnections = useMemo(
    () =>
      (connections ?? []).filter((connection) =>
        apiKeyProviders.some((provider) => provider.id === connection.provider)
      ),
    [apiKeyProviders, connections]
  );
  const accountNameById = useMemo(
    () =>
      new Map((accounts ?? []).map((account) => [account.id, account.name] as const)),
    [accounts]
  );

  const selectedTradingEntity: TradingEntitySelection = useMemo(() => {
    if (!selectedTradingEntityId) {
      return null;
    }

    return (
      ACTIVE_PROP_FIRM_CATALOG.find((firm) => firm.id === selectedTradingEntityId) ??
      ACTIVE_BROKER_CATALOG.find((broker) => broker.id === selectedTradingEntityId) ??
      null
    );
  }, [selectedTradingEntityId]);

  const availableApiKeyProviders = useMemo(() => {
    if (!selectedTradingEntity) {
      return apiKeyProviders;
    }

    const supported = new Set(getTradingEntityPlatforms(selectedTradingEntity));
    return apiKeyProviders.filter((provider) => supported.has(provider.id));
  }, [apiKeyProviders, selectedTradingEntity]);

  const filteredTradingEntityOptions = useMemo(() => {
    if (!selectedProviderId) {
      return SELECTABLE_BROKER_OPTIONS;
    }

    const matchingIds = new Set<string>([
      ...ACTIVE_PROP_FIRM_CATALOG.filter((firm) =>
        firm.supportedPlatforms.includes(selectedProviderId)
      ).map((firm) => firm.id),
      ...ACTIVE_BROKER_CATALOG.filter((broker) =>
        broker.platforms.includes(selectedProviderId)
      ).map((broker) => broker.id),
    ]);

    return SELECTABLE_BROKER_OPTIONS.filter((option) =>
      matchingIds.has(option.value)
    );
  }, [selectedProviderId]);

  const selectedProviderInfo =
    availableApiKeyProviders.find((provider) => provider.id === selectedProviderId) ??
    availableApiKeyProviders.find((provider) => provider.status === "active") ??
    availableApiKeyProviders[0] ??
    null;

  useEffect(() => {
    if (
      selectedProviderId &&
      !availableApiKeyProviders.some((provider) => provider.id === selectedProviderId)
    ) {
      setSelectedProviderId(availableApiKeyProviders[0]?.id ?? "");
      setProviderCredentialForm({});
    }
  }, [availableApiKeyProviders, selectedProviderId]);

  useEffect(() => {
    if (
      selectedTradingEntityId &&
      !filteredTradingEntityOptions.some(
        (option) => option.value === selectedTradingEntityId
      )
    ) {
      setSelectedTradingEntityId("");
    }
  }, [filteredTradingEntityOptions, selectedTradingEntityId]);

  const suggestedProviderConnectionName =
    selectedTradingEntity && selectedProviderInfo
      ? `${selectedTradingEntity.displayName} ${selectedProviderInfo.name}`
      : selectedProviderInfo
        ? `My ${selectedProviderInfo.name}`
        : "";

  const handleGenerateKey = async () => {
    if (!newApiKeyName.trim()) {
      toast.error("Please enter a name for your API key");
      return;
    }

    try {
      const result = await generateKey.mutateAsync({
        name: newApiKeyName,
      });

      setGeneratedKey(result.key);
      setShowGenerateDialog(false);
      setShowKeyDialog(true);
      setNewApiKeyName("");
      await refetchKeys();
    } catch (error: any) {
      toast.error(error.message || "Failed to generate API key");
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(generatedKey);
    setCopiedKey(true);
    toast.success("API key copied to clipboard!");
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleRevokeKey = async (keyId: string) => {
    try {
      await revokeKey.mutateAsync({ keyId });
      toast.success("API key revoked");
      await refetchKeys();
    } catch (error: any) {
      toast.error(error.message || "Failed to revoke API key");
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    try {
      await deleteKey.mutateAsync({ keyId });
      toast.success("API key deleted");
      await refetchKeys();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete API key");
    }
  };

  const resetProviderDialog = () => {
    setShowProviderDialog(false);
    setSelectedTradingEntityId("");
    setSelectedProviderId("");
    setProviderConnectionName("");
    setProviderCredentialForm({});
  };

  const handleTradingEntityChange = (value: string) => {
    setSelectedTradingEntityId(value);
    setProviderCredentialForm({});

    const entity =
      ACTIVE_PROP_FIRM_CATALOG.find((firm) => firm.id === value) ??
      ACTIVE_BROKER_CATALOG.find((broker) => broker.id === value) ??
      null;

    if (!entity) {
      return;
    }

    if (!selectedProviderId) {
      const supported = PROVIDERS.filter(
        (provider) =>
          provider.authType === "api_key" &&
          getTradingEntityPlatforms(entity).includes(provider.id)
      );
      const preferred =
        supported.find((provider) => provider.status === "active") ??
        supported[0] ??
        null;
      setSelectedProviderId(preferred?.id ?? "");
    }
  };

  const handleProviderCredentialChange = (field: string, value: string) => {
    setProviderCredentialForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleCreateProviderKey = async () => {
    if (!selectedTradingEntity || !selectedProviderInfo) {
      toast.error("Choose a prop firm or broker first");
      return;
    }

    const missingField = selectedProviderInfo.fields.find(
      (field) => !(providerCredentialForm[field] ?? "").trim()
    );
    if (missingField) {
      toast.error(`Enter ${formatCredentialFieldLabel(missingField)}`);
      return;
    }

    try {
      const result = await createCredential.mutateAsync({
        provider: selectedProviderInfo.id,
        displayName:
          providerConnectionName.trim() || suggestedProviderConnectionName,
        credentials: selectedProviderInfo.fields.reduce<Record<string, string>>(
          (acc, field) => {
            acc[field] = providerCredentialForm[field] ?? "";
            return acc;
          },
          {}
        ),
        meta: {
          tradingEntityId: selectedTradingEntity.id,
          tradingEntityLabel: selectedTradingEntity.displayName,
          tradingEntityType: selectedTradingEntity.type,
          source: "settings-api",
        },
      });

      resetProviderDialog();
      await refetchConnections();
      if (selectedProviderInfo.status === "active") {
        toast.success("API key saved. Link a trading account next.");
        setShowLinkDialog(result.connectionId);
      } else {
        toast.success(
          `${selectedProviderInfo.name} API key saved. Live sync will unlock when this provider is enabled.`
        );
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to add broker API key");
    }
  };

  const handleDeleteProviderConnection = async (connectionId: string) => {
    try {
      await deleteConnection.mutateAsync({ connectionId });
      toast.success("Broker API key deleted");
      await refetchConnections();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete broker API key");
    }
  };

  const handleLinkAccount = async (connectionId: string, accountId: string) => {
    try {
      await linkAccount.mutateAsync({ connectionId, accountId });
      toast.success("Trading account linked");
      setShowLinkDialog(null);
      await refetchConnections();
    } catch (error: any) {
      toast.error(error.message || "Failed to link trading account");
    }
  };

  return (
    <div className="flex w-full flex-col">
      <div className="grid grid-cols-1 items-start gap-2 px-6 py-5 sm:grid-cols-[200px_1fr] sm:gap-6 sm:px-8">
        <div>
          <Label className="text-sm font-medium text-white/80">API Keys</Label>
          <p className="mt-0.5 text-xs text-white/40">
            Generate EA keys and save broker API credentials.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => setShowGenerateDialog(true)}
            className="ring ring-teal-500/25 bg-teal-600/25 hover:bg-teal-600/35 px-4 py-2 h-[38px] w-max text-xs text-teal-300 cursor-pointer justify-start gap-2 transition-all active:scale-95 duration-250"
          >
            <Key className="size-3.5" />
            Generate key
          </Button>
          <Button
            onClick={() => setShowProviderDialog(true)}
            className="ring ring-sky-500/25 bg-sky-600/20 hover:bg-sky-600/30 px-4 py-2 h-[38px] w-max text-xs text-sky-200 cursor-pointer justify-start gap-2 transition-all active:scale-95 duration-250"
          >
            <Link2 className="size-3.5" />
            Add API key
          </Button>
          <Link
            href="/dashboard/settings/ea-setup"
            className="flex items-center gap-2 px-4 py-2 h-[38px] bg-blue-900/20 ring ring-blue-500/30 rounded-md text-blue-300 text-xs hover:bg-blue-900/30 transition"
          >
            <span>Setup EA</span>
            <ExternalLink className="size-3" />
          </Link>
        </div>
      </div>

      <Separator />

      <div className="px-6 py-5 sm:px-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">EA Keys</h2>
            <p className="mt-0.5 text-xs text-white/40">
              Use these keys for MetaTrader EA integration.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {apiKeys?.length === 0 ? (
            <GoalSurface className="lg:col-span-2 2xl:col-span-3">
              <div className="py-12 text-center text-white/40">
                <Key className="mx-auto mb-2 size-8 opacity-50" />
                <p className="text-sm">No EA API keys yet</p>
                <p className="mt-1 text-xs">
                  Generate one to connect your MetaTrader EA
                </p>
              </div>
            </GoalSurface>
          ) : (
            apiKeys?.map((key) => (
              <GoalSurface key={key.id} className="h-full">
                <div className="p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">
                        {key.name}
                      </span>
                      <code className="mt-1 block font-mono text-xs text-white/60">
                        {key.keyPrefix}...
                      </code>
                    </div>

                    {key.isActive ? (
                      <Badge className="bg-teal-900/30 text-teal-400 ring-teal-500/30">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Revoked</Badge>
                    )}
                  </div>

                  <GoalContentSeparator className="mb-3.5 mt-3.5" />

                  <div className="space-y-2 text-xs text-white/40">
                    <div className="flex items-center justify-between gap-3">
                      <span>Prefix</span>
                      <code className="font-mono text-white/65">
                        {key.keyPrefix}...
                      </code>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Status</span>
                      <span className="text-white/65">
                        {key.isActive ? "Active" : "Revoked"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Last used</span>
                      <span className="text-right text-white/65">
                        {key.lastUsedAt
                          ? new Date(key.lastUsedAt).toLocaleString()
                          : "Never"}
                      </span>
                    </div>
                  </div>

                  <GoalContentSeparator className="mb-3.5 mt-3.5" />

                  <div className="flex flex-wrap items-center gap-2">
                    {key.isActive ? (
                      <Button
                        type="button"
                        onClick={() => handleRevokeKey(key.id)}
                        disabled={revokeKey.isPending}
                        className={getPropAssignActionButtonClassName({
                          tone: "neutral",
                          size: "sm",
                        })}
                      >
                        Revoke
                      </Button>
                    ) : null}

                    <Button
                      type="button"
                      onClick={() => handleDeleteKey(key.id)}
                      disabled={deleteKey.isPending}
                      className={getPropAssignActionButtonClassName({
                        tone: "danger",
                        size: "sm",
                      })}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              </GoalSurface>
            ))
          )}
        </div>
      </div>

      <Separator />

      <div className="px-6 py-5 sm:px-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Broker API Keys</h2>
            <p className="mt-0.5 text-xs text-white/40">
              Store broker or prop-firm API credentials for connection-based sync.
            </p>
          </div>
          <Button
            onClick={() => setShowProviderDialog(true)}
            className="ring ring-sky-500/25 bg-sky-600/20 hover:bg-sky-600/30 px-4 py-2 h-[34px] w-max text-xs text-sky-200 cursor-pointer justify-start gap-2 transition-all active:scale-95 duration-250"
          >
            <Link2 className="size-3.5" />
            Add API key
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {brokerApiKeyConnections.length === 0 ? (
            <GoalSurface className="lg:col-span-2 2xl:col-span-3">
              <div className="py-12 text-center text-white/40">
                <Link2 className="mx-auto mb-2 size-8 opacity-50" />
                <p className="text-sm">No broker API keys yet</p>
                <p className="mt-1 text-xs">
                  Add a platform API key like TopstepX to start account linking.
                </p>
              </div>
            </GoalSurface>
          ) : (
            brokerApiKeyConnections.map((connection) => {
              const provider = providerInfoById.get(connection.provider);
              const statusInfo =
                STATUS_STYLES[connection.status] ?? STATUS_STYLES.pending;
              const isSavedCredentialConnection =
                connection.meta &&
                typeof connection.meta === "object" &&
                connection.meta.connectionMode === "saved-credential";
              const tradingEntityLabel =
                (connection.meta?.tradingEntityLabel as string | undefined) ??
                provider?.name ??
                connection.displayName;
              const linkedAccountName = connection.accountId
                ? accountNameById.get(connection.accountId) ?? null
                : null;

              return (
                <GoalSurface key={connection.id} className="h-full">
                  <div className="p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">
                          {connection.displayName}
                        </span>
                        <p className="mt-1 text-xs text-white/55">
                          {provider?.name ?? connection.provider} - {tradingEntityLabel}
                        </p>
                      </div>
                      <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                    </div>

                    <GoalContentSeparator className="mb-3.5 mt-3.5" />

                    <div className="space-y-2 text-xs text-white/40">
                      <div className="flex items-center justify-between gap-3">
                        <span>Provider</span>
                        <span className="text-right text-white/65">
                          {provider?.name ?? connection.provider}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Firm / broker</span>
                        <span className="text-right text-white/65">
                          {tradingEntityLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Linked account</span>
                        <span className="text-right text-white/65">
                          {isSavedCredentialConnection
                            ? "Not needed yet"
                            : linkedAccountName ?? "Not linked"}
                        </span>
                      </div>
                    </div>

                    {isSavedCredentialConnection ? (
                      <p className="mt-3 text-[11px] text-amber-200/80">
                        Saved for later. Live sync and account linking will become available once this provider is enabled.
                      </p>
                    ) : null}

                    <GoalContentSeparator className="mb-3.5 mt-3.5" />

                    <div className="flex flex-wrap items-center gap-2">
                      {!connection.accountId && !isSavedCredentialConnection ? (
                        <Button
                          type="button"
                          onClick={() => setShowLinkDialog(connection.id)}
                          className={getPropAssignActionButtonClassName({
                            tone: "teal",
                            size: "sm",
                          })}
                        >
                          <Link2 className="size-3.5" />
                          Link account
                        </Button>
                      ) : null}

                      <Link
                        href="/dashboard/settings/connections"
                        className="inline-flex h-8 items-center justify-center gap-2 rounded-sm border border-white/10 bg-white/5 px-3 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
                      >
                        Open connections
                      </Link>

                      <Button
                        type="button"
                        onClick={() => handleDeleteProviderConnection(connection.id)}
                        disabled={deleteConnection.isPending}
                        className={getPropAssignActionButtonClassName({
                          tone: "danger",
                          size: "sm",
                        })}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </GoalSurface>
              );
            })
          )}
        </div>
      </div>

      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent
          showCloseButton={false}
          className="flex flex-col gap-0 overflow-hidden rounded-md ring ring-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-md"
        >
          <div className="flex flex-col gap-0 overflow-hidden rounded-sm ring ring-white/5 bg-sidebar-accent/80">
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ring ring-white/5 bg-sidebar-accent">
                <Key className="h-3.5 w-3.5 text-white/60" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white">Generate API Key</div>
                <p className="mt-1 text-xs leading-relaxed text-white/40">
                  Create a new API key for your MetaTrader Expert Advisor
                </p>
              </div>
              <DialogClose asChild>
                <button
                  type="button"
                  className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm ring ring-white/5 bg-sidebar-accent text-white/50 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Close</span>
                </button>
              </DialogClose>
            </div>
            <Separator />

            <div className="space-y-4 px-5 py-4">
              <div className="flex flex-col gap-2">
                <Label className="text-white/80">Key Name</Label>
                <Input
                  placeholder="e.g., My FTMO Account EA"
                  value={newApiKeyName}
                  onChange={(event) => setNewApiKeyName(event.target.value)}
                  className="bg-sidebar-accent ring-white/5 text-white"
                />
                <p className="text-xs text-white/40">
                  Choose a descriptive name to identify this key
                </p>
              </div>
            </div>

            <Separator />
            <div className="flex items-center justify-end gap-2 px-5 py-3">
              <Button
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm ring ring-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
                onClick={() => setShowGenerateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleGenerateKey}
                disabled={generateKey.isPending || !newApiKeyName.trim()}
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm ring ring-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
              >
                {generateKey.isPending ? "Generating..." : "Generate"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showProviderDialog}
        onOpenChange={(open) => {
          if (open) {
            setShowProviderDialog(true);
            return;
          }

          resetProviderDialog();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="flex flex-col gap-0 overflow-hidden rounded-md ring ring-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-xl"
        >
          <div className="flex flex-col gap-0 overflow-hidden rounded-sm ring ring-white/5 bg-sidebar-accent/80">
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ring ring-white/5 bg-sidebar-accent">
                <Link2 className="h-3.5 w-3.5 text-white/60" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white">Add API Key</div>
                <p className="mt-1 text-xs leading-relaxed text-white/40">
                  Choose the prop firm or broker, then save the API credentials Profitabledge needs.
                </p>
              </div>
              <DialogClose asChild>
                <button
                  type="button"
                  className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm ring ring-white/5 bg-sidebar-accent text-white/50 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white"
                  onClick={resetProviderDialog}
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Close</span>
                </button>
              </DialogClose>
            </div>
            <Separator />

            <div className="space-y-4 px-5 py-4">
              <div className="space-y-2">
                <Label className="text-xs text-white/50">Platform</Label>
                <Select
                  value={selectedProviderId}
                  onValueChange={(value) => {
                    setSelectedProviderId(value);
                    setProviderCredentialForm({});
                  }}
                >
                  <SelectTrigger className="h-9 w-full border-white/10 bg-white/[0.03] text-white">
                    <SelectValue placeholder="Select a platform" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-sidebar text-white">
                    {(selectedTradingEntity ? availableApiKeyProviders : apiKeyProviders).map(
                      (provider) => (
                      <SelectItem
                        key={provider.id}
                        value={provider.id}
                      >
                        {provider.name}
                        {provider.status !== "active" ? " (coming soon)" : ""}
                      </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                {selectedTradingEntity && availableApiKeyProviders.length === 0 ? (
                  <p className="text-[11px] text-amber-200/80">
                    No API-key connection is available yet for {selectedTradingEntity.displayName}.
                  </p>
                ) : null}
                {selectedProviderInfo?.betaNote ? (
                  <p className="text-[11px] text-sky-200/80">
                    {selectedProviderInfo.betaNote}
                  </p>
                ) : null}
                {selectedProviderInfo?.status === "coming_soon" ? (
                  <p className="text-[11px] text-amber-200/80">
                    Profitabledge can save this credential now and keep it ready until live sync support is enabled.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-white/50">Prop firm or broker</Label>
                <BrokerOptionSelector
                  value={selectedTradingEntityId}
                  onValueChange={handleTradingEntityChange}
                  placeholder={
                    selectedProviderId
                      ? "Select a compatible prop firm or broker"
                      : "Select a prop firm or broker"
                  }
                  options={filteredTradingEntityOptions}
                />
                {selectedProviderId ? (
                  <p className="text-[11px] text-white/40">
                    Showing only firms and brokers that support {selectedProviderInfo?.name ?? selectedProviderId}.
                  </p>
                ) : null}
              </div>

              {selectedProviderInfo ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs text-white/50">Connection name</Label>
                    <Input
                      placeholder={suggestedProviderConnectionName}
                      value={providerConnectionName}
                      onChange={(event) =>
                        setProviderConnectionName(event.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-4">
                    {selectedProviderInfo.fields.map((field) => (
                      <div key={field} className="space-y-2">
                        <Label className="text-xs text-white/50">
                          {formatCredentialFieldLabel(field)}
                        </Label>
                        <Input
                          type={field.toLowerCase().includes("key") ? "password" : "text"}
                          placeholder={getCredentialPlaceholder(field)}
                          value={providerCredentialForm[field] ?? ""}
                          onChange={(event) =>
                            handleProviderCredentialChange(field, event.target.value)
                          }
                        />
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            <Separator />
            <div className="flex items-center justify-end gap-2 px-5 py-3">
              <Button
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm ring ring-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
                onClick={resetProviderDialog}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateProviderKey}
                disabled={
                  createCredential.isPending ||
                  !selectedTradingEntity ||
                  !selectedProviderInfo
                }
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm ring ring-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
              >
                {createCredential.isPending
                  ? "Saving..."
                  : selectedProviderInfo?.status === "coming_soon"
                    ? "Save for later"
                    : "Add API key"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent
          showCloseButton={false}
          className="flex flex-col gap-0 overflow-hidden rounded-md ring ring-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg max-w-2xl"
        >
          <div className="flex flex-col gap-0 overflow-hidden rounded-sm ring ring-white/5 bg-sidebar-accent/80">
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ring ring-white/5 bg-sidebar-accent">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white">
                  Your API key has been generated
                </div>
                <p className="mt-1 text-xs leading-relaxed text-rose-400">
                  Copy this key now - you won't be able to see it again!
                </p>
              </div>
              <DialogClose asChild>
                <button
                  type="button"
                  className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm ring ring-white/5 bg-sidebar-accent text-white/50 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Close</span>
                </button>
              </DialogClose>
            </div>
            <Separator />

            <div className="space-y-4 px-5 py-4">
              <div className="flex items-center gap-2 p-4 bg-sidebar-accent ring ring-white/10 rounded-md">
                <code className="flex-1 text-white font-mono text-sm break-all">
                  {generatedKey}
                </code>
                <Button
                  size="sm"
                  onClick={handleCopyKey}
                  className="ring ring-teal-600/50 bg-teal-600/25 hover:bg-teal-600/35 text-teal-300"
                >
                  {copiedKey ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>

              <div className="bg-yellow-900/20 ring ring-yellow-500/30 p-4 rounded-md">
                <p className="text-yellow-300 text-sm font-medium mb-2">Important:</p>
                <ul className="text-yellow-200 text-xs space-y-1 list-disc list-inside">
                  <li>Save this key in a secure location</li>
                  <li>You'll need it to configure your MetaTrader EA</li>
                  <li>This key won't be shown again</li>
                  <li>If lost, generate a new key and update your EA</li>
                </ul>
              </div>

              <Link
                href="/dashboard/settings/ea-setup"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-900/20 ring ring-blue-500/30 rounded-md text-blue-300 text-sm hover:bg-blue-900/30 transition"
              >
                <Download className="size-3.5" />
                <span>Download &amp; setup expert advisor (EA)</span>
                <ExternalLink className="size-3" />
              </Link>
            </div>

            <Separator />
            <div className="flex items-center justify-end gap-2 px-5 py-3">
              <Button
                onClick={() => {
                  setShowKeyDialog(false);
                  setGeneratedKey("");
                }}
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm ring ring-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none w-full"
              >
                I've saved my key
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
