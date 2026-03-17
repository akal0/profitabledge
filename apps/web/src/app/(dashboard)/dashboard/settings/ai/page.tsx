"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bot,
  Check,
  ExternalLink,
  KeyRound,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AlphaFeatureLocked } from "@/features/platform/alpha/components/alpha-feature-locked";
import { isPublicAlphaFeatureEnabled } from "@/lib/alpha-flags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { trpcOptions } from "@/utils/trpc";

type ProviderId = "gemini" | "openai" | "anthropic";

const PROVIDERS: Array<{
  id: ProviderId;
  label: string;
  helper: string;
  note: string;
  keyLink: string;
}> = [
  {
    id: "gemini",
    label: "Google Gemini",
    helper: "Primary live provider for the current in-product assistant runtime.",
    note: "Recommended today for assistant, analysis, and metered AI flows.",
    keyLink: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "openai",
    label: "OpenAI",
    helper:
      "Validated and stored now so your account is ready when runtime selection expands.",
    note: "Future-ready provider key. Current production routing still uses Gemini first.",
    keyLink: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    helper:
      "Validated and stored now so your account is ready when runtime selection expands.",
    note: "Future-ready provider key. Current production routing still uses Gemini first.",
    keyLink: "https://console.anthropic.com/settings/keys",
  },
];

const USAGE_VIEWS = [
  { key: "profitabledge", label: "Profitabledge", accent: "text-teal-300" },
  { key: "gemini", label: "Gemini", accent: "text-sky-300" },
  { key: "openai", label: "OpenAI", accent: "text-emerald-300" },
  { key: "anthropic", label: "Anthropic", accent: "text-orange-300" },
] as const;

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Never";

  return new Date(value).toLocaleString();
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function AISettingsPage() {
  const aiEnabled = isPublicAlphaFeatureEnabled("aiAssistant");
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(
    null
  );
  const [apiKey, setApiKey] = useState("");
  const [copiedPrefix, setCopiedPrefix] = useState<string | null>(null);

  const { data: connectedKeys, refetch: refetchKeys } = useQuery({
    ...trpcOptions.aiKeys.list.queryOptions(),
    enabled: aiEnabled,
  });
  const { data: usage, refetch: refetchUsage } = useQuery({
    ...trpcOptions.aiKeys.usage.queryOptions({ days: 30 }),
    enabled: aiEnabled,
  });

  const saveKey = useMutation(trpcOptions.aiKeys.upsert.mutationOptions());
  const deleteKey = useMutation(trpcOptions.aiKeys.delete.mutationOptions());

  const keysByProvider = useMemo(
    () => new Map((connectedKeys ?? []).map((entry) => [entry.provider, entry])),
    [connectedKeys]
  );

  const closeDialog = () => {
    setSelectedProvider(null);
    setApiKey("");
  };

  const handleSaveKey = async () => {
    if (!selectedProvider) return;
    if (apiKey.trim().length < 10) {
      toast.error("Enter a valid API key before saving.");
      return;
    }

    try {
      await saveKey.mutateAsync({
        provider: selectedProvider,
        apiKey: apiKey.trim(),
      });
      toast.success("AI key connected and validated.");
      closeDialog();
      await Promise.all([refetchKeys(), refetchUsage()]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to connect AI key"
      );
    }
  };

  const handleDeleteKey = async (provider: ProviderId) => {
    try {
      await deleteKey.mutateAsync({ provider });
      toast.success("AI key removed.");
      await Promise.all([refetchKeys(), refetchUsage()]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove AI key"
      );
    }
  };

  const handleCopyPrefix = async (prefix: string) => {
    await navigator.clipboard.writeText(prefix);
    setCopiedPrefix(prefix);
    toast.success("Key prefix copied.");
    window.setTimeout(() => setCopiedPrefix(null), 1500);
  };

  if (!aiEnabled) {
    return (
      <AlphaFeatureLocked
        feature="aiAssistant"
        title="AI settings are held back in this alpha"
      />
    );
  }

  return (
    <div className="flex w-full flex-col">
      <div className="grid grid-cols-1 gap-3 px-6 py-5 sm:grid-cols-[200px_1fr] sm:gap-6 sm:px-8">
        <div>
          <Label className="text-sm font-medium text-white/80">AI</Label>
          <p className="mt-0.5 text-xs text-white/40">
            Connect personal provider keys and review recent AI usage.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/assistant"
            className="flex h-[38px] items-center gap-2 rounded-md bg-white px-4 py-2 text-xs text-black transition hover:bg-white/90"
          >
            <Bot className="size-3.5" />
            Open assistant
          </Link>
        </div>
      </div>

      <Separator />

      <div className="px-6 py-5 sm:px-8">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="size-4 text-teal-300" />
          <h2 className="text-sm font-semibold text-white">Usage overview</h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-4">
          {USAGE_VIEWS.map((view) => {
            const summary = usage?.views?.[view.key];

            return (
              <div
                key={view.key}
                className="rounded-md border border-white/5 bg-sidebar-accent p-4"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${view.accent}`}>
                    {view.label}
                  </span>
                  <Badge className="border-white/10 bg-white/5 text-white/60">
                    30d
                  </Badge>
                </div>
                <div className="mt-3 space-y-2 text-xs text-white/60">
                  <div className="flex items-center justify-between">
                    <span>Requests</span>
                    <span className="font-medium text-white">
                      {formatNumber(summary?.totalRequests ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tokens</span>
                    <span className="font-medium text-white">
                      {formatNumber(summary?.totalTokens ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Credits</span>
                    <span className="font-medium text-white">
                      {(summary?.chargedCredits ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Spend</span>
                    <span className="font-medium text-white">
                      {formatUsd(summary?.spendUsd ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      <div className="px-6 py-5 sm:px-8">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="size-4 text-blue-300" />
          <h2 className="text-sm font-semibold text-white">Provider keys</h2>
        </div>
        <div className="space-y-3">
          {PROVIDERS.map((provider) => {
            const connectedKey = keysByProvider.get(provider.id);
            const isConnected = Boolean(connectedKey?.isActive);

            return (
              <div
                key={provider.id}
                className="rounded-md border border-white/5 bg-sidebar-accent p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-medium text-white">
                        {provider.label}
                      </h3>
                      {isConnected ? (
                        <Badge className="border-emerald-400/20 bg-emerald-500/10 text-emerald-200">
                          Connected
                        </Badge>
                      ) : (
                        <Badge className="border-white/10 bg-white/5 text-white/60">
                          Not connected
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-white/50">
                      {provider.helper}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-white/35">
                      {provider.note}
                    </p>
                    {connectedKey ? (
                      <div className="mt-3 grid gap-2 text-xs text-white/60 sm:grid-cols-3">
                        <button
                          type="button"
                          onClick={() => handleCopyPrefix(connectedKey.keyPrefix)}
                          className="flex items-center gap-2 text-left text-white/60 transition hover:text-white"
                        >
                          {copiedPrefix === connectedKey.keyPrefix ? (
                            <Check className="size-3.5 text-emerald-300" />
                          ) : (
                            <KeyRound className="size-3.5" />
                          )}
                          <span>{connectedKey.keyPrefix}</span>
                        </button>
                        <span>
                          Last validated: {formatDate(connectedKey.lastValidatedAt)}
                        </span>
                        <span>Last used: {formatDate(connectedKey.lastUsedAt)}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={provider.keyLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-[38px] items-center gap-2 rounded-md border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                      Get key
                      <ExternalLink className="size-3.5" />
                    </a>
                    <Button
                      type="button"
                      onClick={() => setSelectedProvider(provider.id)}
                      className="h-[38px] bg-blue-900/30 text-xs text-blue-200 hover:bg-blue-900/40"
                    >
                      {isConnected ? "Update key" : "Connect key"}
                    </Button>
                    {isConnected ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleDeleteKey(provider.id)}
                        disabled={deleteKey.isPending}
                        className="h-[38px] border-white/10 bg-transparent text-xs text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                      >
                        <Trash2 className="size-3.5" />
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog
        open={selectedProvider !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-md"
        >
          <div className="flex flex-col overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
                <KeyRound className="h-3.5 w-3.5 text-white/60" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white">
                  {selectedProvider
                    ? `Connect ${PROVIDERS.find((provider) => provider.id === selectedProvider)?.label}`
                    : "Connect AI key"}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-white/40">
                  Your key is validated before it is stored. Personal keys are
                  used only for your supported AI usage.
                </p>
              </div>
              <DialogClose asChild>
                <button
                  type="button"
                  className="ml-auto flex size-8 items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent text-white/50 transition-colors hover:brightness-110 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Close</span>
                </button>
              </DialogClose>
            </div>

            <Separator />

            <div className="space-y-4 px-5 py-4">
              <div className="space-y-2">
                <Label className="text-xs text-white/60">API key</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="Paste your provider key"
                  className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/25"
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-end gap-3 px-5 py-4">
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="button"
                onClick={handleSaveKey}
                disabled={saveKey.isPending}
                className="bg-white text-black hover:bg-white/90"
              >
                {saveKey.isPending ? "Validating..." : "Save key"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
