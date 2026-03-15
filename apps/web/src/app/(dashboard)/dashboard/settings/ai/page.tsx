"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AlphaFeatureLocked } from "@/features/platform/alpha/components/alpha-feature-locked";
import { AIProviderKeyDialog } from "@/features/settings/ai-keys/components/ai-provider-key-dialog";
import { ActiveAIProvidersSection } from "@/features/settings/ai-keys/components/active-ai-providers-section";
import { AvailableAIProvidersSection } from "@/features/settings/ai-keys/components/available-ai-providers-section";
import { AIUsageSection } from "@/features/settings/ai-keys/components/ai-usage-section";
import { ACTIVE_AI_PROVIDER_CATALOG } from "@/features/settings/ai-keys/lib/ai-provider-catalog";
import type {
  AIKeyProvider,
  AIKeyRow,
  AIUsageResponse,
} from "@/features/settings/ai-keys/lib/ai-key-types";
import { isPublicAlphaFeatureEnabled } from "@/lib/alpha-flags";
import { trpcClient, trpcOptions } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import { CreditCard, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function AISettingsPage() {
  const aiEnabled = isPublicAlphaFeatureEnabled("aiAssistant");
  const [dialogProvider, setDialogProvider] = useState<AIKeyProvider | null>(null);
  const [deletingProvider, setDeletingProvider] = useState<AIKeyProvider | null>(
    null
  );

  const aiKeysQuery = useQuery(trpcOptions.aiKeys.list.queryOptions()) as {
    data: AIKeyRow[] | undefined;
    isLoading: boolean;
    refetch: () => Promise<unknown>;
  };
  const aiUsageQuery = useQuery(
    trpcOptions.aiKeys.usage.queryOptions({ days: 30 })
  ) as {
    data: AIUsageResponse | undefined;
    isLoading: boolean;
  };
  const upsertKey = useMutation({
    mutationFn: (input: { provider: AIKeyProvider; apiKey: string }) =>
      trpcClient.aiKeys.upsert.mutate(input),
  });
  const deleteKey = useMutation({
    mutationFn: (input: { provider: AIKeyProvider }) =>
      trpcClient.aiKeys.delete.mutate(input),
  });

  const connectedProviders = useMemo(
    () => new Set((aiKeysQuery.data ?? []).map((row) => row.provider)),
    [aiKeysQuery.data]
  );

  const activeDialogRow =
    dialogProvider == null
      ? null
      : (aiKeysQuery.data ?? []).find((row) => row.provider === dialogProvider) ?? null;

  const handleSaveKey = async (apiKey: string) => {
    if (!dialogProvider) return;

    try {
      await upsertKey.mutateAsync({
        provider: dialogProvider,
        apiKey,
      });
      toast.success("AI key connected");
      setDialogProvider(null);
      void aiKeysQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to connect AI key"
      );
    }
  };

  const handleDeleteKey = async (provider: AIKeyProvider) => {
    setDeletingProvider(provider);
    try {
      await deleteKey.mutateAsync({ provider });
      toast.success("AI key removed");
      void aiKeysQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to remove AI key"
      );
    } finally {
      setDeletingProvider(null);
    }
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
      <div className="px-6 py-6 sm:px-8">
        <div className="max-w-2xl space-y-3">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-[-0.04em]">
              AI
            </h1>
            <p className="text-base font-medium tracking-[-0.04em] text-white/40 sm:text-sm">
              Connect your own model API keys for supported AI features
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge className="border border-blue-500/20 bg-blue-500/10 text-blue-300">
              <Sparkles className="mr-1 size-3" />
              Gemini runtime live
            </Badge>
            <Badge className="border border-white/10 bg-white/5 text-white/70">
              <CreditCard className="mr-1 size-3" />
              OpenAI + Anthropic connectors ready
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            {ACTIVE_AI_PROVIDER_CATALOG.map((provider) => (
              <Button
                key={provider.id}
                onClick={() => setDialogProvider(provider.id)}
                className={cn(
                  "h-[32px] cursor-pointer px-4 text-xs transition-all duration-250 active:scale-95",
                  provider.id === "gemini"
                    ? "border border-white/5 bg-teal-600/25 text-teal-300 hover:bg-teal-600/35"
                    : provider.id === "openai"
                    ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                    : "border border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                )}
              >
                {connectedProviders.has(provider.id)
                  ? `Update ${provider.name}`
                  : `Connect ${provider.name}`}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <Separator />

      <div className="px-6 py-5 sm:px-8">
        <div className="space-y-1.5 text-xs text-white/45">
          <p>Saved keys are encrypted server-side before they are stored.</p>
          <p>Gemini-backed calls prefer your personal Gemini key automatically.</p>
          <p>OpenAI and Anthropic connectors are validated and stored now so they are ready for runtime expansion.</p>
          <p>When no personal key path is used, Profitabledge falls back to plan-funded Edge credits.</p>
        </div>
      </div>

      <Separator />

      {aiKeysQuery.isLoading ? (
        <div className="space-y-3 px-6 py-5 sm:px-8">
          <div className="h-24 animate-pulse rounded-sm bg-sidebar-accent/70" />
          <div className="h-24 animate-pulse rounded-sm bg-sidebar-accent/50" />
        </div>
      ) : (
        <>
          <ActiveAIProvidersSection
            keys={aiKeysQuery.data}
            deletingProvider={deletingProvider}
            onReplace={setDialogProvider}
            onDelete={(provider) => {
              void handleDeleteKey(provider);
            }}
          />
          <AvailableAIProvidersSection
            connectedProviders={connectedProviders}
            onConnect={setDialogProvider}
          />
          <AIUsageSection
            usage={aiUsageQuery.data}
            isLoading={aiUsageQuery.isLoading}
          />
        </>
      )}

      <Separator />

      <div className="px-6 py-5 sm:px-8">
        <div className="rounded-sm border border-blue-500/20 bg-blue-500/10 p-4">
          <p className="text-sm font-medium text-blue-300">Current behavior</p>
          <p className="mt-1 text-xs text-white/50">
            Assistant, journal AI, and other Gemini-backed features automatically use your personal Gemini key first. OpenAI and Anthropic keys can now be connected and validated in settings, but the in-product runtime still routes through Gemini today.
          </p>
        </div>
      </div>

      <AIProviderKeyDialog
        provider={dialogProvider}
        open={dialogProvider !== null}
        isPending={upsertKey.isPending}
        existingKeyPrefix={activeDialogRow?.keyPrefix ?? null}
        onOpenChange={(open) => {
          if (!open) {
            setDialogProvider(null);
          }
        }}
        onSubmit={(apiKey) => {
          void handleSaveKey(apiKey);
        }}
      />
    </div>
  );
}
