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
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
} from "@/components/dashboard/charts/dashboard-chart-ui";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { AlphaFeatureLocked } from "@/features/platform/alpha/components/alpha-feature-locked";
import { getPropAssignActionButtonClassName } from "@/features/accounts/lib/prop-assign-action-button";
import { isPublicAlphaFeatureEnabled } from "@/lib/alpha-flags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
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
    helper:
      "Primary live provider for the current in-product assistant runtime.",
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
  {
    key: "profitabledge",
    label: "Profitabledge",
    accent: "text-teal-300",
    stroke: "#2dd4bf",
    tone: "teal",
  },
  {
    key: "gemini",
    label: "Gemini",
    accent: "text-sky-300",
    stroke: "#38bdf8",
    tone: "neutral",
  },
  {
    key: "openai",
    label: "OpenAI",
    accent: "text-emerald-300",
    stroke: "#4ade80",
    tone: "gold",
  },
  {
    key: "anthropic",
    label: "Anthropic",
    accent: "text-orange-300",
    stroke: "#fb923c",
    tone: "amber",
  },
] as const;

const USAGE_METRICS = [
  {
    key: "requests",
    label: "Requests",
    description: "Daily request volume across the last 30 days.",
    tone: "teal",
    formatValue: (value: number) => formatNumber(value),
    formatAxisValue: (value: number) => formatCompactNumber(value),
    axisWidth: 44,
  },
  {
    key: "totalTokens",
    label: "Tokens",
    description: "Token consumption over time by provider source.",
    tone: "gold",
    formatValue: (value: number) => formatNumber(value),
    formatAxisValue: (value: number) => formatCompactNumber(value),
    axisWidth: 52,
  },
  {
    key: "chargedCredits",
    label: "Credits",
    description: "Charged Edge credits accumulated per day.",
    tone: "amber",
    formatValue: (value: number) => value.toFixed(2),
    formatAxisValue: (value: number) => formatCompactDecimal(value),
    axisWidth: 52,
  },
  {
    key: "spendUsd",
    label: "Spend",
    description: "Estimated USD-equivalent spend for charged usage.",
    tone: "danger",
    formatValue: (value: number) => formatUsd(value),
    formatAxisValue: (value: number) => formatCompactUsd(value),
    axisWidth: 56,
  },
] as const;

type UsageViewKey = (typeof USAGE_VIEWS)[number]["key"];
type UsageMetricKey = (typeof USAGE_METRICS)[number]["key"];
type UsagePoint = {
  date: string;
  label: string;
  requests: number;
  totalTokens: number;
  chargedCredits: number;
  spendUsd: number;
};
type VisibleUsageViews = Record<UsageViewKey, boolean>;

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

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCompactDecimal(value: number) {
  if (Math.abs(value) >= 100) {
    return formatCompactNumber(value);
  }

  return value.toFixed(value < 10 ? 1 : 0);
}

function formatCompactUsd(value: number) {
  if (Math.abs(value) < 1) {
    return formatUsd(value);
  }

  return `$${formatCompactNumber(value)}`;
}

function getInitialVisibleUsageViews(): VisibleUsageViews {
  return Object.fromEntries(
    USAGE_VIEWS.map((view) => [view.key, true])
  ) as VisibleUsageViews;
}

const USAGE_SEGMENTED_CONTROL_CLASS_NAME =
  "flex h-max w-max items-center gap-1 rounded-md bg-white p-[3px] ring ring-white/5 dark:bg-muted/15";

function getUsageSegmentedButtonClassName(
  active: boolean,
  tone: "teal" | "neutral" | "gold" | "amber" | "danger"
) {
  return cn(
    "cursor-pointer flex h-max w-max items-center justify-center gap-2 rounded-md px-3 py-2 text-xs transition-all duration-250 active:scale-95",
    active
      ? tone === "teal"
        ? "bg-teal-400/20 text-teal-200 ring ring-teal-400/30 hover:bg-teal-400/25 hover:!brightness-110"
        : tone === "gold"
        ? "bg-amber-400/15 text-amber-200 ring ring-amber-400/25 hover:bg-amber-400/20 hover:!brightness-110"
        : tone === "amber"
        ? "bg-orange-400/15 text-orange-200 ring ring-orange-400/25 hover:bg-orange-400/20 hover:!brightness-110"
        : tone === "danger"
        ? "bg-rose-400/15 text-rose-200 ring ring-rose-400/25 hover:bg-rose-400/20 hover:!brightness-110"
        : "bg-sky-400/15 text-sky-200 ring ring-sky-400/25 hover:bg-sky-400/20 hover:!brightness-110"
      : "bg-[#222225]/25 text-white/40 ring-0 hover:bg-[#222225] hover:!brightness-105 hover:text-white/80"
  );
}

export default function AISettingsPage() {
  const aiEnabled = isPublicAlphaFeatureEnabled("aiAssistant");
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(
    null
  );
  const [apiKey, setApiKey] = useState("");
  const [copiedPrefix, setCopiedPrefix] = useState<string | null>(null);
  const [selectedUsageMetric, setSelectedUsageMetric] =
    useState<UsageMetricKey>("requests");
  const [visibleUsageViews, setVisibleUsageViews] = useState<VisibleUsageViews>(
    () => getInitialVisibleUsageViews()
  );

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
    () =>
      new Map((connectedKeys ?? []).map((entry) => [entry.provider, entry])),
    [connectedKeys]
  );
  const activeUsageMetric = useMemo(
    () =>
      USAGE_METRICS.find((metric) => metric.key === selectedUsageMetric) ??
      USAGE_METRICS[0],
    [selectedUsageMetric]
  );
  const usageChartConfig = useMemo(
    () =>
      Object.fromEntries(
        USAGE_VIEWS.map((view) => [
          view.key,
          { label: view.label, color: view.stroke },
        ])
      ) satisfies ChartConfig,
    []
  );
  const usageChartData = useMemo(() => {
    const fallbackData =
      USAGE_VIEWS.map((view) => usage?.views?.[view.key]?.data).find(
        (data): data is UsagePoint[] => Array.isArray(data) && data.length > 0
      ) ?? [];

    return fallbackData.map((point, index) => {
      const row: {
        date: string;
        label: string;
      } & Partial<Record<UsageViewKey, number>> = {
        date: point.date,
        label: point.label,
      };

      for (const view of USAGE_VIEWS) {
        row[view.key] =
          usage?.views?.[view.key]?.data?.[index]?.[selectedUsageMetric] ?? 0;
      }

      return row;
    });
  }, [selectedUsageMetric, usage]);
  const usageHasActivity = useMemo(
    () =>
      usageChartData.some((row) =>
        USAGE_VIEWS.some((view) => (row[view.key] ?? 0) > 0)
      ),
    [usageChartData]
  );
  const usageTotalsByView = useMemo(
    () =>
      Object.fromEntries(
        USAGE_VIEWS.map((view) => {
          const summary = usage?.views?.[view.key];
          const total =
            selectedUsageMetric === "requests"
              ? summary?.totalRequests ?? 0
              : summary?.[selectedUsageMetric] ?? 0;

          return [view.key, total];
        })
      ) as Record<UsageViewKey, number>,
    [selectedUsageMetric, usage]
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
  const toggleUsageView = (viewKey: UsageViewKey) => {
    setVisibleUsageViews((current) => {
      if (
        current[viewKey] &&
        Object.values(current).filter(Boolean).length === 1
      ) {
        return current;
      }

      return {
        ...current,
        [viewKey]: !current[viewKey],
      };
    });
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
      <div className="flex justify-between gap-3 px-6 py-5 sm:gap-6 sm:px-8">
        <div>
          <Label className="text-sm font-medium text-white/80">AI</Label>
          <p className="mt-0.5 text-xs text-white/40">
            Connect personal provider keys and review recent AI usage.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            asChild
            className={getPropAssignActionButtonClassName({
              tone: "teal",
              size: "sm",
            })}
          >
            <Link href="/assistant">
              <Bot className="size-3.5" />
              Open assistant
            </Link>
          </Button>
        </div>
      </div>

      <Separator />

      <div className="px-6 py-5 sm:px-8">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="size-4 text-teal-300" />
          <h2 className="text-sm font-semibold text-white">Usage overview</h2>
        </div>
        <div className="rounded-sm ring ring-white/5 bg-sidebar p-1.5">
          <div className="rounded-sm bg-sidebar-accent p-4 sm:p-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div
                  className={cn(
                    USAGE_SEGMENTED_CONTROL_CLASS_NAME,
                    "flex-wrap"
                  )}
                >
                  {USAGE_VIEWS.map((view) => {
                    const isVisible = visibleUsageViews[view.key];
                    const total = usageTotalsByView[view.key];

                    return (
                      <button
                        key={view.key}
                        type="button"
                        aria-pressed={isVisible}
                        onClick={() => toggleUsageView(view.key)}
                        className={cn(
                          getUsageSegmentedButtonClassName(
                            isVisible,
                            view.tone
                          ),
                          "gap-2"
                        )}
                      >
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: view.stroke }}
                        />
                        <span>{view.label}</span>
                        <span className="ml-2.5 text-[10px] text-current/70">
                          {activeUsageMetric.formatValue(total)}
                        </span>
                      </button>
                    );
                  })}
                  <Badge className="h-8 rounded-md border-white/10 bg-white/5 px-2.5 text-[10px] text-white/55">
                    30d
                  </Badge>
                </div>

                <div className={USAGE_SEGMENTED_CONTROL_CLASS_NAME}>
                  {USAGE_METRICS.map((metric) => (
                    <button
                      key={metric.key}
                      type="button"
                      onClick={() => setSelectedUsageMetric(metric.key)}
                      className={getUsageSegmentedButtonClassName(
                        metric.key === selectedUsageMetric,
                        metric.tone
                      )}
                    >
                      {metric.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative h-[320px] rounded-sm border border-white/5 bg-sidebar/40 p-3">
                <ChartContainer
                  config={usageChartConfig}
                  className="h-full w-full aspect-auto"
                >
                  <LineChart
                    data={usageChartData}
                    margin={{ top: 12, right: 16, bottom: 0, left: 4 }}
                  >
                    <CartesianGrid
                      stroke="rgba(255,255,255,0.08)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      minTickGap={28}
                      tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={activeUsageMetric.axisWidth}
                      tickMargin={8}
                      tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                      tickFormatter={activeUsageMetric.formatAxisValue}
                    />
                    <ChartTooltip
                      cursor={{ stroke: "rgba(255,255,255,0.12)" }}
                      content={({ active, label, payload }) => {
                        if (!active || !payload?.length) return null;

                        const visiblePayload = payload.filter(
                          (item) =>
                            typeof item.dataKey === "string" &&
                            visibleUsageViews[item.dataKey as UsageViewKey]
                        );

                        if (!visiblePayload.length) return null;

                        return (
                          <DashboardChartTooltipFrame title={label}>
                            {visiblePayload.map((item) => {
                              const view = USAGE_VIEWS.find(
                                (entry) => entry.key === item.dataKey
                              );
                              const value = Number(item.value ?? 0);

                              return (
                                <DashboardChartTooltipRow
                                  key={String(item.dataKey)}
                                  label={
                                    view?.label ??
                                    String(item.name ?? item.dataKey)
                                  }
                                  value={activeUsageMetric.formatValue(value)}
                                  indicatorColor={view?.stroke}
                                />
                              );
                            })}
                          </DashboardChartTooltipFrame>
                        );
                      }}
                    />
                    {USAGE_VIEWS.map((view) =>
                      visibleUsageViews[view.key] ? (
                        <Line
                          key={view.key}
                          type="monotone"
                          dataKey={view.key}
                          stroke={view.stroke}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: view.stroke }}
                        />
                      ) : null
                    )}
                  </LineChart>
                </ChartContainer>

                {!usageHasActivity ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="rounded-sm border border-white/5 bg-sidebar/90 px-3 py-2 text-xs text-white/45 backdrop-blur">
                      No AI usage recorded in the last 30 days.
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
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
                          onClick={() =>
                            handleCopyPrefix(connectedKey.keyPrefix)
                          }
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
                          Last validated:{" "}
                          {formatDate(connectedKey.lastValidatedAt)}
                        </span>
                        <span>
                          Last used: {formatDate(connectedKey.lastUsedAt)}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      asChild
                      className={getPropAssignActionButtonClassName({
                        tone: "neutral",
                        size: "sm",
                        className: "flex items-center",
                      })}
                    >
                      <a
                        href={provider.keyLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Get key
                        <ExternalLink className="size-3" />
                      </a>
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setSelectedProvider(provider.id)}
                      className={getPropAssignActionButtonClassName({
                        tone: "teal",
                        size: "sm",
                      })}
                    >
                      {isConnected ? "Update key" : "Connect key"}
                    </Button>
                    {isConnected ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleDeleteKey(provider.id)}
                        disabled={deleteKey.isPending}
                        className={getPropAssignActionButtonClassName({
                          tone: "danger",
                          size: "sm",
                        })}
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
                    ? `Connect ${
                        PROVIDERS.find(
                          (provider) => provider.id === selectedProvider
                        )?.label
                      }`
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
                  className={getPropAssignActionButtonClassName({
                    tone: "neutral",
                  })}
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="button"
                onClick={handleSaveKey}
                disabled={saveKey.isPending}
                className={getPropAssignActionButtonClassName({
                  tone: "teal",
                })}
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
