"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { Cpu, CreditCard, Sparkles } from "lucide-react";

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";
import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
} from "@/components/dashboard/charts/dashboard-chart-ui";
import { getAIProviderCatalogItem } from "@/features/settings/ai-keys/lib/ai-provider-catalog";
import type {
  AIUsagePoint,
  AIUsageResponse,
  AIUsageViewKey,
} from "@/features/settings/ai-keys/lib/ai-key-types";
import { cn } from "@/lib/utils";

const AI_USAGE_VIEW_META: Record<
  AIUsageViewKey,
  {
    label: string;
    description: string;
    accentColor: string;
    status: "live" | "connector_only";
  }
> = {
  profitabledge: {
    label: "Profitabledge",
    description: "Platform-funded AI usage that counts against your Edge credits",
    accentColor: "#EAB308",
    status: "live",
  },
  gemini: {
    label: "Gemini",
    description: "All Gemini-backed usage, including personal-key and platform-funded calls",
    accentColor: getAIProviderCatalogItem("gemini")?.accentColor ?? "#0EA5E9",
    status: "live",
  },
  openai: {
    label: "OpenAI",
    description: "OpenAI connector usage once runtime routing is enabled",
    accentColor: getAIProviderCatalogItem("openai")?.accentColor ?? "#10B981",
    status: "connector_only",
  },
  anthropic: {
    label: "Anthropic",
    description: "Anthropic connector usage once runtime routing is enabled",
    accentColor: getAIProviderCatalogItem("anthropic")?.accentColor ?? "#F59E0B",
    status: "connector_only",
  },
};

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function formatCredits(value: number) {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value > 0 && value < 10 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value)} credits`;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function UsageBarChartPanel({
  title,
  description,
  data,
  dataKey,
  accentColor,
  isLoading,
  emptyMessage,
}: {
  title: string;
  description: string;
  data: AIUsagePoint[];
  dataKey: "requests" | "totalTokens";
  accentColor: string;
  isLoading: boolean;
  emptyMessage: string;
}) {
  const chartConfig = useMemo(
    () =>
      ({
        value: {
          label: title,
          color: accentColor,
        },
      }) satisfies ChartConfig,
    [accentColor, title]
  );

  const totalValue = useMemo(
    () => data.reduce((sum, point) => sum + point[dataKey], 0),
    [data, dataKey]
  );

  return (
    <div className="rounded-sm border border-white/5 bg-sidebar-accent/70 p-4">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-white">{title}</h3>
          <p className="mt-1 text-xs text-white/40">{description}</p>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-[0.24em] text-white/25">
            Total
          </div>
          <div className="mt-1 text-xl font-semibold tracking-[-0.05em] text-white">
            {formatCompactNumber(totalValue)}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-[220px] animate-pulse rounded-sm bg-sidebar/70" />
      ) : totalValue > 0 ? (
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
          <BarChart
            data={data}
            margin={{ left: 8, right: 8, top: 12, bottom: 0 }}
            barGap={8}
          >
            <CartesianGrid vertical={false} strokeDasharray="8 8" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={20}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;

                const rawPoint = payload[0]?.payload as AIUsagePoint | undefined;
                const value =
                  typeof rawPoint?.[dataKey] === "number" ? rawPoint[dataKey] : 0;

                return (
                  <DashboardChartTooltipFrame title={rawPoint?.label ?? title}>
                    <DashboardChartTooltipRow
                      label={title}
                      value={formatCompactNumber(value)}
                      indicatorColor={accentColor}
                    />
                    <DashboardChartTooltipRow
                      label="Edge credits"
                      value={formatCredits(rawPoint?.chargedCredits ?? 0)}
                      dimmed
                    />
                    <DashboardChartTooltipRow
                      label="Spend"
                      value={formatUsd(rawPoint?.spendUsd ?? 0)}
                      dimmed
                    />
                  </DashboardChartTooltipFrame>
                );
              }}
            />
            <Bar dataKey={dataKey} radius={[2, 2, 0, 0]} barSize={14}>
              {data.map((point) => (
                <Cell
                  key={`${title}-${point.date}`}
                  fill={accentColor}
                  fillOpacity={point[dataKey] > 0 ? 0.92 : 0.28}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      ) : (
        <div className="flex h-[220px] items-center justify-center rounded-sm border border-dashed border-white/5 bg-sidebar/40 text-center text-sm text-white/30">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

export function AIUsageSection({
  usage,
  isLoading,
}: {
  usage: AIUsageResponse | undefined;
  isLoading: boolean;
}) {
  const [selectedView, setSelectedView] =
    useState<AIUsageViewKey>("profitabledge");

  const currentView = AI_USAGE_VIEW_META[selectedView];
  const summary = usage?.views[selectedView];

  return (
    <>
      <Separator />

      <div className="px-6 py-5 sm:px-8">
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-white">Usage</h2>
            <p className="text-xs text-white/40">
              Track AI activity over the last {usage?.days ?? 30} days across your
              platform-funded usage and connected providers
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              Object.keys(AI_USAGE_VIEW_META) as AIUsageViewKey[]
            ).map((viewKey) => {
              const item = AI_USAGE_VIEW_META[viewKey];
              const isActive = selectedView === viewKey;

              return (
                <button
                  key={viewKey}
                  type="button"
                  onClick={() => setSelectedView(viewKey)}
                  className={cn(
                    "inline-flex h-[32px] cursor-pointer items-center gap-2 rounded-sm border px-3 text-xs transition-all duration-250 active:scale-95",
                    isActive
                      ? "border-white/10 text-white"
                      : "border-white/5 text-white/45 hover:text-white/75",
                    !isActive && "bg-sidebar-accent/70"
                  )}
                  style={
                    isActive
                      ? {
                          backgroundColor: `${item.accentColor}18`,
                          color: item.accentColor,
                          borderColor: `${item.accentColor}33`,
                        }
                      : undefined
                  }
                >
                  {viewKey === "profitabledge" ? (
                    <CreditCard className="size-3.5" />
                  ) : (
                    <Cpu className="size-3.5" />
                  )}
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Separator />

      <div className="px-6 py-5 sm:px-8">
        <div className="rounded-sm border border-white/5 bg-sidebar-accent/70 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white">{currentView.label}</p>
                <span
                  className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    color: currentView.accentColor,
                    borderColor: `${currentView.accentColor}33`,
                    backgroundColor: `${currentView.accentColor}14`,
                  }}
                >
                  {currentView.status === "live" ? "Live" : "Connector ready"}
                </span>
              </div>
              <p className="text-xs text-white/45">{currentView.description}</p>
            </div>

            {currentView.status === "connector_only" ? (
              <div className="flex items-center gap-2 rounded-sm border border-white/5 bg-sidebar/60 px-3 py-2 text-[11px] text-white/45">
                <Sparkles className="size-3.5 text-white/35" />
                Usage stays at zero until runtime routing is enabled
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-sm border border-white/5 bg-sidebar/55 p-3">
              <div className="text-[11px] uppercase tracking-[0.24em] text-white/30">
                Requests
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">
                {formatCompactNumber(summary?.totalRequests ?? 0)}
              </div>
            </div>
            <div className="rounded-sm border border-white/5 bg-sidebar/55 p-3">
              <div className="text-[11px] uppercase tracking-[0.24em] text-white/30">
                Tokens
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">
                {formatCompactNumber(summary?.totalTokens ?? 0)}
              </div>
            </div>
            <div className="rounded-sm border border-white/5 bg-sidebar/55 p-3">
              <div className="text-[11px] uppercase tracking-[0.24em] text-white/30">
                Edge Credits
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">
                {formatCredits(summary?.chargedCredits ?? 0)}
              </div>
            </div>
            <div className="rounded-sm border border-white/5 bg-sidebar/55 p-3">
              <div className="text-[11px] uppercase tracking-[0.24em] text-white/30">
                Spend
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">
                {formatUsd(summary?.spendUsd ?? 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div className="grid gap-4 px-6 py-5 sm:px-8 xl:grid-cols-2">
        <UsageBarChartPanel
          title="Requests"
          description="Daily AI calls for the selected view"
          data={summary?.data ?? []}
          dataKey="requests"
          accentColor={currentView.accentColor}
          isLoading={isLoading}
          emptyMessage="No requests recorded in this window"
        />

        <UsageBarChartPanel
          title="Tokens"
          description="Daily token volume for the selected view"
          data={summary?.data ?? []}
          dataKey="totalTokens"
          accentColor={currentView.accentColor}
          isLoading={isLoading}
          emptyMessage="No token usage recorded in this window"
        />
      </div>
    </>
  );
}
