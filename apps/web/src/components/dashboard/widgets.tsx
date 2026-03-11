"use client";

import { VariantBadge } from "@/components/ui/badges/variant-badge";
import React, {
  type ComponentType,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import { useAccountStore } from "@/stores/account";
import { useDashboardAssistantContextStore } from "@/stores/dashboard-assistant-context";
import { useStatsStore } from "@/stores/stats";

import InfinitySign from "@/public/icons/infinity.svg";
import { AnimatedNumber } from "../ui/animated-number";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

import CircleInfo from "@/public/icons/circle-info.svg";
import { Skeleton } from "../ui/skeleton";
import { Separator } from "../ui/separator";
import {
  DndContext,
  type DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  TrendingDown,
  TrendingUp,
  Activity,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Select as ShSelect,
  SelectTrigger as ShSelectTrigger,
  SelectContent as ShSelectContent,
  SelectItem as ShSelectItem,
  SelectValue as ShSelectValue,
} from "@/components/ui/select";

import Bank from "@/public/icons/bank.svg";
import WinRate from "@/public/icons/winrate.svg";
import WinStreak from "@/public/icons/winstreak.svg";
import ProfitFactor from "@/public/icons/profit-factor.svg";
import InfinityIcon from "@/public/icons/infinity.svg";
import { trpcOptions, trpcClient } from "@/utils/trpc";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "../ui/switch";
// import removed: AssetProfitabilityCard now ignores global date range
import { TotalLossesChart } from "@/components/dashboard/charts/total-losses";
import { Select } from "../ui/select";
import { WatchlistWidget } from "./watchlist-widget";
import { TiltmeterWidget } from "./tiltmeter-widget";
import { DailyBriefingCard } from "./daily-briefing-card";
import { RiskDashboardWidget } from "./risk-dashboard-widget";
import { RuleComplianceWidget } from "./rule-compliance-widget";
import { CoachingWidget } from "./coaching-widget";
import { WhatIfWidget } from "./what-if-widget";
import { BenchmarkWidget } from "./benchmark-widget";
import { WidgetWrapper } from "./widget-wrapper";
import {
  getTradeDirectionTone,
  TRADE_IDENTIFIER_PILL_CLASS,
} from "@/components/trades/trade-identifier-pill";
import { formatSignedCurrency } from "./charts/dashboard-chart-ui";

const chartConfig = {
  wins: {
    label: "Wins",
    color: "#00E0C8",
  },
  losses: {
    label: "Losses",
    color: "#F76290",
  },
  breakeven: {
    label: "Breakeven",
    color: "#C0C2C9",
  },
} satisfies ChartConfig;

const toNumber = (value: unknown) => {
  if (value == null) return 0;
  const direct = Number(value);
  if (Number.isFinite(direct)) return direct;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const WIDGET_CONTENT_SEPARATOR_CLASS =
  "-mx-3.5 shrink-0 self-stretch";

function DashboardWidgetFrame({
  title,
  icon,
  headerRight,
  isEditing = false,
  className,
  contentClassName,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  headerRight?: React.ReactNode;
  isEditing?: boolean;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <WidgetWrapper
      isEditing={isEditing}
      className={className}
      header={
        <div className="flex w-full items-center gap-1.5 p-3.5 widget-header">
          <div className="flex min-w-0 items-center gap-1.5">
            {icon}
            <h2 className="text-xs font-medium flex items-center gap-2 text-white/50 group-hover:text-white transition-all duration-250">
              <span>{title}</span>
            </h2>
          </div>
          {headerRight ? (
            <div className="ml-auto flex items-center gap-2">{headerRight}</div>
          ) : null}
        </div>
      }
      contentClassName={cn(
        "flex h-full w-full rounded-sm",
        contentClassName ?? "flex-col justify-between"
      )}
    >
      {children}
    </WidgetWrapper>
  );
}

// Widget types - used for identifying which card to render
export type WidgetType =
  | "account-balance"
  | "account-equity"
  | "win-streak"
  | "profit-factor"
  | "win-rate"
  | "hold-time"
  | "average-rr"
  | "asset-profitability"
  | "trade-counts"
  | "profit-expectancy"
  | "total-losses"
  | "consistency-score"
  | "open-trades"
  | "execution-scorecard"
  | "money-left-on-table"
  | "watchlist"
  | "session-performance"
  | "streak-calendar"
  | "tiltmeter"
  | "daily-briefing"
  | "risk-intelligence"
  | "rule-compliance"
  | "edge-coach"
  | "what-if"
  | "benchmark";

function useAccountStats(accountId?: string) {
  const fetchStats = useStatsStore((s) => s.fetchStats);
  const getStats = useStatsStore((s) => s.getStats);
  const isLoading = useStatsStore((s) => s.isLoading(accountId));
  useEffect(() => {
    if (accountId) fetchStats(accountId);
  }, [accountId, fetchStats]);
  return { data: getStats(accountId) ?? null, loading: isLoading };
}

export function AccountBalanceCard({
  accountId,
  isEditing = false,
  valueMode = "usd",
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  valueMode?: "usd" | "percent";
  className?: string;
}) {
  const { data } = useAccountStats(accountId);
  const fetchStats = useStatsStore((s) => s.fetchStats);
  const [editingBaseline, setEditingBaseline] = useState(false);
  const [baselineInput, setBaselineInput] = useState("");

  // Determine balance source:
  // 1. If EA-synced (isVerified) and data is fresh, use liveBalance from EA
  // 2. Otherwise, calculate from historical data (initialBalance + totalProfit)
  const isVerified = data?.isVerified ?? false;
  const isLiveDataFresh = data?.isLiveDataFresh ?? false;
  const liveBalance = data?.liveBalance ?? null;
  const initialBalance = toNumber(data?.initialBalance ?? 0);
  const totalProfit = toNumber(data?.totalProfit ?? 0);

  const balance =
    isVerified && isLiveDataFresh && liveBalance !== null
      ? liveBalance
      : initialBalance + totalProfit;
  const hasBaseline = initialBalance > 0;
  const returnPct = hasBaseline
    ? ((balance - initialBalance) / initialBalance) * 100
    : 0;

  useEffect(() => {
    setBaselineInput(initialBalance ? String(initialBalance) : "");
  }, [initialBalance]);

  const handleBaselineSave = async () => {
    if (!accountId) return;
    const nextValue = Number(baselineInput);
    if (!Number.isFinite(nextValue) || nextValue < 0) {
      toast.error("Enter a valid baseline amount");
      return;
    }
    try {
      await trpcClient.accounts.updateBrokerSettings.mutate({
        accountId,
        initialBalance: nextValue,
      });
      await fetchStats(accountId);
      toast.success("Baseline updated");
      setEditingBaseline(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update baseline");
    }
  };

  return (
    <DashboardWidgetFrame
      title="Account balance"
      icon={
        <Bank className="size-4 stroke-white/50 group-hover:stroke-white fill-sidebar transition-all duration-250" />
      }
      isEditing={isEditing}
      className={className}
      headerRight={
        !isEditing && editingBaseline ? (
          <>
            <Input
              value={baselineInput}
              onChange={(e) => setBaselineInput(e.target.value)}
              type="number"
              step="0.01"
              min="0"
              className="h-7 w-28 rounded-sm bg-sidebar-accent border-white/5 text-white text-xs"
            />
            <Button
              size="sm"
              className="h-7 rounded-sm bg-sidebar-accent text-white text-xs"
              onClick={handleBaselineSave}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-sm border-white/5 text-white/70 text-xs"
              onClick={() => {
                setBaselineInput(initialBalance ? String(initialBalance) : "");
                setEditingBaseline(false);
              }}
            >
              Cancel
            </Button>
          </>
        ) : !isEditing ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 rounded-sm bg-transparent! border-white/5! text-white/70 text-xs"
            onClick={() => setEditingBaseline(true)}
          >
            Edit baseline
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col gap-1 p-3.5 h-full justify-end">
        <h1 className="font-medium text-2xl text-teal-400">
          <AnimatedNumber
            value={valueMode === "percent" ? returnPct : balance}
            format={(n) => {
              if (valueMode === "percent") {
                if (!hasBaseline) return "—";
                const sign = n >= 0 ? "+" : "";
                return (
                  sign +
                  Math.abs(n).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }) +
                  "%"
                );
              }
              return (
                "$" +
                n.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              );
            }}
            springOptions={{
              bounce: 0,
              duration: 2000,
            }}
          />
        </h1>

        <p className="text-xs font-medium text-secondary">
          {valueMode === "percent"
            ? hasBaseline
              ? `Baseline: $${initialBalance.toLocaleString()}`
              : "Return vs initial balance"
            : isVerified && isLiveDataFresh
            ? "Live balance from EA"
            : "Sum of your all-time profit and initial account balance"}
        </p>
      </div>
    </DashboardWidgetFrame>
  );
}

export function AccountEquityCard({
  accountId,
  isEditing = false,
  valueMode = "usd",
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  valueMode?: "usd" | "percent";
  className?: string;
}) {
  const [isLive, setIsLive] = useState(false);

  // Use tRPC hook for automatic deduplication and caching
  const { data: liveMetrics, isLoading: loadingLive } = useQuery({
    ...trpcOptions.accounts.liveMetrics.queryOptions({
      accountId: accountId || "",
    }),
    enabled: !!accountId,
    refetchInterval: 5000, // Poll every 5 seconds (matches server cache TTL)
    refetchIntervalInBackground: false, // Only poll when tab is visible
    staleTime: 4000, // Consider data fresh for 4 seconds
  });

  // Flash live indicator when data updates
  useEffect(() => {
    if (liveMetrics) {
      setIsLive(true);
      setTimeout(() => setIsLive(false), 300);
    }
  }, [liveMetrics]);

  // Type assertions needed until tRPC React Query types are fully propagated
  const isVerified = (liveMetrics as any)?.isVerified ?? false;
  const liveEquity = (liveMetrics as any)?.liveEquity ?? null;
  const totalFloatingPL = (liveMetrics as any)?.totalFloatingPL ?? 0;
  const openTradesCount = (liveMetrics as any)?.openTradesCount ?? 0;
  const initialBalance = toNumber((liveMetrics as any)?.initialBalance ?? 0);
  const hasBaseline = initialBalance > 0;
  const equityReturnPct = hasBaseline
    ? ((Number(liveEquity || 0) - initialBalance) / initialBalance) * 100
    : 0;
  const floatingReturnPct = hasBaseline
    ? (Number(totalFloatingPL || 0) / initialBalance) * 100
    : 0;

  // Only show this widget for EA-synced accounts (unless in edit mode for preview)
  if (!isVerified && !loadingLive && !isEditing) {
    return null;
  }

  return (
    <DashboardWidgetFrame
      title="Account equity"
      icon={
        <Bank className="size-4 stroke-white/50 group-hover:stroke-white fill-sidebar transition-all duration-250" />
      }
      isEditing={isEditing}
      className={className}
      headerRight={
        !isEditing ? (
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                "size-1.5 rounded-full transition-all duration-300",
                isLive
                  ? "bg-teal-400 shadow-[0_0_8px_2px_rgba(45,212,191,0.4)]"
                  : "bg-teal-400/40"
              )}
            />
            <span className="text-[10px] text-white/30">LIVE</span>
          </div>
        ) : null
      }
    >
      <div className="flex flex-col gap-1 p-3.5 h-full justify-end">
        <h1 className="font-medium text-2xl text-teal-400">
          <AnimatedNumber
            value={valueMode === "percent" ? equityReturnPct : liveEquity ?? 0}
            format={(n) => {
              if (valueMode === "percent") {
                if (!hasBaseline) return "—";
                const sign = n >= 0 ? "+" : "";
                return (
                  sign +
                  Math.abs(n).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }) +
                  "%"
                );
              }
              return (
                "$" +
                n.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              );
            }}
            springOptions={{
              bounce: 0,
              duration: 2000,
            }}
          />
        </h1>

        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/40">
              {openTradesCount} open trade{openTradesCount !== 1 ? "s" : ""}
            </span>
            <span
              className={cn(
                "font-semibold",
                totalFloatingPL >= 0 ? "text-teal-400" : "text-rose-400"
              )}
            >
              {valueMode === "percent"
                ? hasBaseline
                  ? `${floatingReturnPct >= 0 ? "+" : ""}${Math.abs(
                      floatingReturnPct
                    ).toFixed(2)}%`
                  : "—"
                : `${totalFloatingPL >= 0 ? "+" : ""}$${totalFloatingPL.toFixed(
                    2
                  )}`}
            </span>
          </div>
          {valueMode === "percent" && hasBaseline && (
            <span className="text-xs text-white/40">
              Baseline: ${initialBalance.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </DashboardWidgetFrame>
  );
}

export function WinRateCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  const { data } = useAccountStats(accountId);
  const wins = Number(data?.wins ?? 0);
  const losses = Number(data?.losses ?? 0);
  const breakeven = Number(data?.breakeven ?? 0);
  const total = wins + losses + breakeven;
  const hasNoTrades = total === 0;
  const displayWinrate = total > 0 ? (wins / total) * 100 : 0;

  const winrate =
    Number(
      displayWinrate % 1 === 0
        ? displayWinrate.toFixed(0)
        : displayWinrate.toFixed(1)
    ) || 0;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const chartData = useMemo(
    () => [
      {
        label: "Trades",
        wins: Number(wins),
        losses: Number(losses),
        breakeven,
      },
    ],
    [wins, losses, breakeven]
  );

  return (
    <DashboardWidgetFrame
      title="Win rate"
      icon={
        <WinRate className="size-4 fill-white/50 group-hover:fill-white transition-all duration-250" />
      }
      isEditing={isEditing}
      className={className}
    >
      {hasNoTrades ? (
        <div className="flex flex-col gap-1 p-3.5 h-full justify-end">
          <h1 className="text-2xl font-medium text-white/40">—</h1>
          <p className="text-xs font-medium text-secondary">
            No closed trades yet
          </p>
        </div>
      ) : (
        <div className="flex w-full justify-between h-full">
          <h1 className="text-xs text-secondary font-medium flex flex-col h-full justify-end p-3.5">
            <span className="font-medium text-2xl text-teal-400">
              <AnimatedNumber
                value={winrate}
                format={(n) =>
                  n.toLocaleString(undefined, { maximumFractionDigits: 0 })
                }
                springOptions={{
                  bounce: 0,
                  duration: 2000,
                }}
              />
              %
            </span>{" "}
            All-time win rate
          </h1>

          {mounted ? (
            <ChartContainer
              config={chartConfig}
              className="w-[150px] h-[100%] place-self-end"
            >
              <BarChart
                data={chartData}
                margin={{ left: 24, right: 24, top: 24, bottom: -8 }}
                barGap={8}
              >
                <CartesianGrid vertical={false} strokeDasharray="8 8" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={false}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Bar
                  dataKey="wins"
                  fill="var(--color-wins)"
                  radius={[0, 0, 0, 0]}
                  barSize={12}
                />
                <Bar
                  dataKey="losses"
                  fill="var(--color-losses)"
                  radius={[0, 0, 0, 0]}
                  barSize={12}
                />
                <Bar
                  dataKey="breakeven"
                  fill="var(--color-breakeven)"
                  radius={[0, 0, 0, 0]}
                  barSize={12}
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="w-[120px] h-[120px]" />
          )}
        </div>
      )}
    </DashboardWidgetFrame>
  );
}

export function WinStreakCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  const { data } = useAccountStats(accountId);
  const streak = Math.round(Math.min(5, data?.winStreak ?? 0));
  const headingColors =
    streak === 0
      ? { from: "#D32F2F", to: "#C62828" }
      : streak <= 2
      ? { from: "#FF6F00", to: "#E65100" }
      : { from: "#1AC889", to: "#16B377" };

  // Use most recent 5 outcomes from server (W/L)
  const rawOutcomes = data?.recentOutcomes ?? [];
  const hasNoTrades = rawOutcomes.length === 0;
  const outcomes: ("W" | "L")[] = [...rawOutcomes].slice(0, 5);

  return (
    <DashboardWidgetFrame
      title="Win streak"
      icon={
        <WinStreak className="size-4 fill-white/50 group-hover:fill-white transition-all duration-250" />
      }
      isEditing={isEditing}
      className={className}
      contentClassName="flex-col justify-end"
    >
      <div className="flex flex-col gap-1.5 p-3.5 h-full justify-end">
        {hasNoTrades ? (
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-medium text-white/40">—</h1>
            <p className="text-xs font-medium text-secondary">
              No closed trades yet
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-medium text-teal-400">
              <AnimatedNumber
                value={streak}
                format={(n) =>
                  n.toLocaleString(undefined, { maximumFractionDigits: 0 })
                }
                springOptions={{
                  bounce: 0,
                  duration: 2000,
                }}
              />{" "}
              {streak === 1 ? "win" : "wins"}
            </h1>

            <div className="flex items-center w-max gap-1.5">
              {outcomes.map((res, i) => (
                <div
                  key={res + i}
                  className={cn(
                    "px-2 py-1 rounded-xs",
                    res === "W" ? "bg-teal-500" : "bg-rose-500"
                  )}
                >
                  <h1 className="text-xs text-white font-medium"> {res} </h1>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardWidgetFrame>
  );
}

export function ProfitFactorCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  const { data } = useAccountStats(accountId);
  const wins = Number(data?.wins ?? 0);
  const losses = Number(data?.losses ?? 0);
  const hasNoTrades = wins + losses === 0;
  let pf = data?.profitFactor ?? null;
  const pfRounded2 = pf !== null ? Number(pf.toFixed(2)) : null;

  return (
    <DashboardWidgetFrame
      title="Profit factor"
      icon={
        <ProfitFactor className="size-4 fill-white/50 group-hover:fill-white transition-all duration-250" />
      }
      isEditing={isEditing}
      className={className}
    >
      <div className="flex flex-col p-3.5 h-full justify-end">
        {hasNoTrades ? (
          <>
            <h1 className="text-2xl font-medium text-white/40">—</h1>
            <p className="text-xs font-medium text-secondary">
              No closed trades yet
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl text-teal-400 font-medium">
              {pfRounded2 !== null ? (
                <AnimatedNumber
                  value={pfRounded2}
                  format={(n) =>
                    n.toLocaleString(undefined, { maximumFractionDigits: 2 })
                  }
                  springOptions={{
                    bounce: 0,
                    duration: 2000,
                  }}
                />
              ) : (
                <AnimatedNumber
                  value={999}
                  format={(n) =>
                    n.toLocaleString(undefined, { maximumFractionDigits: 2 })
                  }
                  springOptions={{
                    bounce: 0,
                    duration: 2000,
                  }}
                />
              )}
            </h1>

            <div className="flex gap-2 items-center">
              <p className="text-xs font-medium text-secondary">
                All time profit factor
              </p>
            </div>
          </>
        )}
      </div>
    </DashboardWidgetFrame>
  );
}

export function ProfitExpectancyCard({
  accountId,
  isEditing = false,
  valueMode = "usd",
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  valueMode?: "usd" | "percent";
  className?: string;
}) {
  const { data } = useAccountStats(accountId);
  const wins = Number(data?.wins ?? 0);
  const losses = Number(data?.losses ?? 0);
  const total = wins + losses;
  const hasNoTrades = total === 0;
  const grossProfit = Number(data?.grossProfit ?? 0);
  const grossLoss = Number((data as any)?.grossLoss ?? 0);
  const initialBalance = Number(data?.initialBalance ?? 0);
  const hasBaseline = initialBalance > 0;

  const avgWin = wins > 0 ? grossProfit / wins : 0;
  const avgLoss = losses > 0 ? grossLoss / losses : 0; // already absolute
  const winPct = total > 0 ? wins / total : 0;
  const lossPct = total > 0 ? losses / total : 0;
  const expectancy = winPct * avgWin - lossPct * avgLoss;
  const isNegative = expectancy < 0;
  const expectancyPct = hasBaseline ? (expectancy / initialBalance) * 100 : 0;

  return (
    <DashboardWidgetFrame
      title="Profit expectancy"
      icon={
        <CircleInfo className="size-4 fill-white/50 group-hover:fill-white transition-all duration-250" />
      }
      isEditing={isEditing}
      className={className}
    >
      <div className="flex flex-col p-3.5 h-full justify-end">
        {hasNoTrades ? (
          <>
            <h1 className="text-2xl font-medium text-white/40">—</h1>
            <p className="text-xs font-medium text-secondary">
              No closed trades yet
            </p>
          </>
        ) : (
          <>
            <h1
              className={cn(
                "text-2xl font-medium",
                isNegative ? "text-rose-400" : "text-teal-400"
              )}
            >
              <AnimatedNumber
                value={valueMode === "percent" ? expectancyPct : expectancy}
                format={(n) => {
                  if (valueMode === "percent") {
                    if (!hasBaseline) return "—";
                    const sign = n < 0 ? "-" : "+";
                    return (
                      sign +
                      Math.abs(n).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      }) +
                      "%"
                    );
                  }
                  const sign = n < 0 ? "-$" : "$";
                  return (
                    sign +
                    Math.abs(n).toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })
                  );
                }}
                springOptions={{ bounce: 0, duration: 1200 }}
              />
            </h1>

            <div className="flex gap-2 items-center">
              <p className="text-xs font-medium text-secondary">
                The profit expectancy is the - ( Win % × Avg Win ) – ( Loss % ×
                Avg Loss )
              </p>
            </div>
          </>
        )}
      </div>
    </DashboardWidgetFrame>
  );
}

export function TotalLossesCard({
  accountId,
  isEditing = false,
  valueMode = "usd",
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  valueMode?: "usd" | "percent";
  className?: string;
}) {
  type LossRow = {
    symbol: string;
    profitLoss: number;
    commissionsLoss: number;
    swapLoss: number;
    totalLoss: number;
  };

  const [rows, setRows] = useState<LossRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 3;
  const { data: statsData } = useAccountStats(accountId);
  const initialBalance = toNumber(statsData?.initialBalance ?? 0);
  const hasBaseline = initialBalance > 0;

  useEffect(() => {
    (async () => {
      if (!accountId) return;
      setLoading(true);
      try {
        const data = await trpcClient.accounts.lossesByAssetRange.query({
          accountId,
        });
        setRows(Array.isArray(data) ? (data as LossRow[]) : []);
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, [accountId]);

  useEffect(() => setPage(0), [rows]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageItems = useMemo(
    () => rows.slice(page * pageSize, page * pageSize + pageSize),
    [rows, page]
  );
  const maxTotal = useMemo(
    () => Math.max(1, ...pageItems.map((r) => Number(r.totalLoss || 0))),
    [pageItems]
  );

  const fmt = (n: number) => {
    if (valueMode === "percent") {
      if (!hasBaseline) return "—";
      const pct = (Math.abs(n) / initialBalance) * 100;
      return `-${pct.toFixed(2)}%`;
    }
    return `-$${Math.abs(Math.round(n)).toLocaleString()}`;
  };

  return (
    <DashboardWidgetFrame
      title="Total losses"
      icon={<TrendingDown className="size-3 text-white/40 stroke-4" />}
      isEditing={isEditing}
      className={className}
      contentClassName="flex-col h-full w-full"
      headerRight={
        !isEditing && rows.length > pageSize ? (
          <div className="flex items-center gap-2 border border-white/5">
            <Button
              className="text-xs text-white/50 hover:text-white disabled:opacity-40 border-r border-white/5 rounded-sm px-2 py-1 bg-transparent hover:bg-sidebar-accent hover:brightness-120"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="size-3.5" />
            </Button>

            <span className="text-[10px] text-white/40 px-1">
              {page + 1}/{pageCount}
            </span>

            <Button
              className="text-xs text-white/50 hover:text-white disabled:opacity-40 border-l border-white/5 rounded-sm py-1 bg-transparent hover:bg-sidebar-accent hover:brightness-120"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        ) : null
      }
    >
      <div className="flex flex-col gap-3.5 p-3.5 h-full justify-end overflow-y-auto">
        {loading ? (
          Array.from({ length: pageSize }).map((_, i) => (
            <div key={`tl-skel-${i}`} className="flex items-center gap-8 w-full">
              <Skeleton className="w-20 h-4 rounded-sm bg-sidebar" />
              <div className="w-full flex-1 flex items-center gap-2">
                <Skeleton className="h-3.5 w-full rounded-sm bg-sidebar" />
                <Skeleton className="w-12 h-4 rounded-sm bg-sidebar" />
              </div>
            </div>
          ))
        ) : pageItems.length === 0 ? (
          <div className="text-xs text-white/40">No losses found.</div>
        ) : (
          pageItems.map((r) => {
            const total = Number(r.totalLoss || 0);
            const pctTotal = Math.min(
              100,
              Math.round((total / maxTotal) * 100)
            );
            const profitPct =
              total > 0 ? Math.round(((r.profitLoss || 0) / total) * 100) : 0;
            const commPct =
              total > 0
                ? Math.round(((r.commissionsLoss || 0) / total) * 100)
                : 0;
            const swapPct = Math.max(0, 100 - profitPct - commPct);
            return (
              <div key={r.symbol} className="flex items-center gap-3 w-full">
                <div className="w-20 truncate text-xs text-white/40">
                  {r.symbol}
                </div>

                <div className="flex-1 h-3.5 bg-sidebar rounded-sm">
                  <div className="h-full" style={{ width: `${pctTotal}%` }}>
                    <div className="h-full flex">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="h-full"
                            style={{
                              width: `${profitPct}%`,
                              backgroundColor: "#F76290",
                            }}
                          />
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white/60">Loss</span>
                            <span className="text-xs font-medium text-rose-400">
                              {fmt(r.profitLoss || 0)}
                            </span>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="h-full"
                            style={{
                              width: `${commPct}%`,
                              backgroundColor: "#A1A1AA",
                            }}
                          />
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white/60">
                              Commissions
                            </span>
                            <span className="text-xs font-medium text-white/80">
                              {fmt(r.commissionsLoss || 0)}
                            </span>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="h-full"
                            style={{
                              width: `${swapPct}%`,
                              backgroundColor: "#6B7280",
                            }}
                          />
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white/60">Swap</span>
                            <span className="text-xs font-medium text-white/80">
                              {fmt(r.swapLoss || 0)}
                            </span>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>

                <div className="w-16 text-xs truncate font-semibold text-rose-400 text-right">
                  {fmt(total)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </DashboardWidgetFrame>
  );
}

export function ConsistencyScoreCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  const [range, setRange] = useState<string>("all");
  const [byDay, setByDay] = useState<
    Array<{ dateISO: string; totalProfit: number }>
  >([]);
  const [loading, setLoading] = useState(false);

  // Build dropdown options from account bounds (min..max) in weeks/months (simple)
  const [options, setOptions] = useState<
    Array<{ key: string; label: string; startISO?: string; endISO?: string }>
  >([{ key: "all", label: "All time" }]);

  useEffect(() => {
    (async () => {
      if (!accountId) return;
      try {
        const bounds = await trpcClient.accounts.opensBounds.query({
          accountId,
        });
        const start = new Date(bounds.minISO);
        const end = new Date(bounds.maxISO);
        // Add recent windows: last 7, 30, 90 days (if they fit within bounds)
        const add = (days: number, label: string) => {
          const e = new Date(end);
          const s = new Date(e);
          s.setDate(e.getDate() - (days - 1));
          if (s.getTime() < start.getTime()) return;
          setOptions((prev) => [
            ...prev,
            {
              key: `${days}d`,
              label,
              startISO: s.toISOString(),
              endISO: e.toISOString(),
            },
          ]);
        };
        setOptions([{ key: "all", label: "All time" }]);
        add(7, "Last 7 days");
        add(30, "Last 30 days");
        add(90, "Last 90 days");
      } catch {}
    })();
  }, [accountId]);

  useEffect(() => {
    (async () => {
      if (!accountId) return;
      setLoading(true);
      try {
        const selected = options.find((o) => o.key === range);
        const data = await trpcClient.accounts.profitByDayOverall.query({
          accountId,
          startISO: selected?.startISO,
          endISO: selected?.endISO,
        });
        setByDay(
          data.byDay.map((d) => ({
            dateISO: d.dateISO,
            totalProfit: Number(d.totalProfit || 0),
          }))
        );
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, [accountId, range, options.map((o) => o.key).join(",")]);

  const totalDays = byDay.length;
  const profitableDays = byDay.filter((d) => d.totalProfit > 0).length;
  const pct = totalDays > 0 ? (profitableDays / totalDays) * 100 : 0;
  const hasNoTrades = totalDays === 0;

  return (
    <DashboardWidgetFrame
      title="Consistency score"
      icon={
        <InfinityIcon className="size-4 fill-white/50 group-hover:fill-white transition-all duration-250" />
      }
      isEditing={isEditing}
      className={className}
      headerRight={
        !isEditing && !hasNoTrades ? (
          <div
            className="flex items-center gap-2"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <ShSelect value={range} onValueChange={(v) => setRange(v)}>
              <ShSelectTrigger className="text-[11px] !h-max px-3 py-1 border border-white/5 rounded-sm bg-transparent text-white/60">
                <ShSelectValue placeholder="All time" />
              </ShSelectTrigger>

              <ShSelectContent align="end">
                {options.map((o) => (
                  <ShSelectItem key={o.key} value={o.key} className="text-xs">
                    {o.label}
                  </ShSelectItem>
                ))}
              </ShSelectContent>
            </ShSelect>
          </div>
        ) : null
      }
    >
      <div className="flex flex-col p-3.5 h-full justify-end">
        {hasNoTrades ? (
          <>
            <h1 className="text-2xl font-medium text-white/40">—</h1>
            <p className="text-xs font-medium text-secondary">
              No closed trades yet
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-medium text-white">
              <AnimatedNumber
                value={pct}
                format={(n) =>
                  n.toLocaleString(undefined, { maximumFractionDigits: 0 })
                }
                springOptions={{ bounce: 0, duration: 1200 }}
              />
              %
            </h1>
            <div className="text-xs text-secondary">
              {profitableDays} profitable days out of {totalDays}
            </div>
          </>
        )}
      </div>
    </DashboardWidgetFrame>
  );
}

export function HoldTimeCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  const { data } = useAccountStats(accountId);
  const wins = Number(data?.wins ?? 0);
  const losses = Number(data?.losses ?? 0);
  const hasNoTrades = wins + losses === 0;
  const avgSec = Number(data?.averageHoldSeconds ?? 0);
  const formatHMS = (s: number) => {
    const total = Math.max(0, Math.floor(Number(s) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = Math.floor(total % 60);
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || h > 0) parts.push(`${m}m`);
    parts.push(`${sec}s`);
    return parts.join(" ");
  };

  return (
    <DashboardWidgetFrame
      title="Average hold time"
      icon={
        <Bank className="size-4 stroke-white/50 fill-sidebar group-hover:stroke-white transition-all duration-250" />
      }
      isEditing={isEditing}
      className={className}
    >
      <div className="flex flex-col p-3.5 h-full justify-end">
        {hasNoTrades ? (
          <>
            <h1 className="text-2xl font-medium text-white/40">—</h1>
            <p className="text-xs font-medium text-secondary">
              No closed trades yet
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl text-teal-400 font-medium">
              <AnimatedNumber
                value={avgSec}
                format={formatHMS}
                springOptions={{ bounce: 0, duration: 1200 }}
              />
            </h1>

            <div className="flex gap-2 items-center">
              <p className="text-xs font-medium text-secondary">
                This is your average hold time across all trades
              </p>
            </div>
          </>
        )}
      </div>
    </DashboardWidgetFrame>
  );
}

export function AverageRRCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  const { data } = useAccountStats(accountId);
  const [riskInput, setRiskInput] = useState<string>("1");
  const wins = Number(data?.wins ?? 0);
  const losses = Number(data?.losses ?? 0);
  const hasNoTrades = wins + losses === 0;
  const grossProfit = Number(data?.grossProfit ?? 0);
  const [initialBalance, setInitialBalance] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const accounts = await trpcClient.accounts.list.query();
        const acc = (accounts as any[])?.find?.((a) => a.id === accountId);
        const ib =
          acc?.initialBalance != null ? Number(acc.initialBalance) : null;
        setInitialBalance(Number.isFinite(ib) ? Number(ib) : null);
      } catch {}
    })();
  }, [accountId]);

  const avgPotentialProfit = wins > 0 ? grossProfit / wins : 0;
  const riskNum = Math.max(0, Number.parseFloat(riskInput || "0") || 0);
  const riskDollar = initialBalance ? (initialBalance * riskNum) / 100 : 0;
  const ratio = riskDollar > 0 ? avgPotentialProfit / riskDollar : 0;
  const display = Number.isFinite(ratio) ? ratio : 0;
  const riskStr = String(riskInput ?? "");

  return (
    <DashboardWidgetFrame
      title="Average RR multiple"
      icon={
        <InfinityIcon className="size-4 fill-white/50 group-hover:fill-white transition-all duration-250" />
      }
      isEditing={isEditing}
      className={className}
      headerRight={
        !isEditing && !hasNoTrades ? (
          <div className="flex items-center gap-2 w-full justify-end">
            <span className="text-xs text-white/50">Risk</span>

            <div className="flex items-center border border-white/5 bg-sidebar-accent pr-2">
              <input
                type="number"
                inputMode="decimal"
                className="text-xs pl-2 py-1 rounded-sm outline-none no-spinner"
                style={{
                  width: `${Math.max(3, (riskStr.length || 1) + 0.5)}ch`,
                }}
                value={riskInput}
                onChange={(e) => setRiskInput(e.target.value)}
                onBlur={() =>
                  setRiskInput((v) => {
                    const n = Math.max(0, Number.parseFloat(v || "0") || 0);
                    return String(n);
                  })
                }
              />
              <span className="text-[11px] text-white/50">%</span>
            </div>
          </div>
        ) : null
      }
    >
      <div className="flex flex-col p-3.5 h-full justify-end">
        {hasNoTrades ? (
          <>
            <h1 className="text-2xl font-medium text-white/40">—</h1>
            <p className="text-xs font-medium text-secondary">
              No closed trades yet
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl text-teal-400 font-medium">
              <AnimatedNumber
                value={display}
                format={(n) =>
                  n.toLocaleString(undefined, { maximumFractionDigits: 2 })
                }
                springOptions={{ bounce: 0, duration: 1200 }}
              />
              R
            </h1>
            <div className="flex gap-2 items-center">
              <p className="text-xs font-medium text-secondary">
                This is your average win ÷ (risk % of initial balance)
              </p>
            </div>
          </>
        )}
      </div>
    </DashboardWidgetFrame>
  );
}

export function AssetProfitabilityCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  const [showWorst, setShowWorst] = useState(false);
  const [rows, setRows] = useState<
    Array<{ symbol: string; totalProfit: number }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    (async () => {
      if (!accountId) return;
      setLoading(true);
      try {
        const data = await trpcClient.accounts.profitByAssetRange.query({
          accountId,
        });
        setRows(Array.isArray(data) ? data : []);
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, [accountId]);

  const list = useMemo(() => {
    const filtered = rows.filter((r) => {
      const v = Number(r.totalProfit || 0);
      return showWorst ? v < 0 : v > 0;
    });
    filtered.sort((a, b) =>
      showWorst ? a.totalProfit - b.totalProfit : b.totalProfit - a.totalProfit
    );
    return filtered;
  }, [rows, showWorst]);

  const pageSize = 3;
  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const pageItems = useMemo(
    () => list.slice(page * pageSize, page * pageSize + pageSize),
    [list, page]
  );
  useEffect(() => {
    setPage(0);
  }, [rows, showWorst]);

  const maxAbs = useMemo(
    () =>
      Math.max(
        1,
        ...pageItems.map((r) => Math.abs(Number(r.totalProfit || 0)))
      ),
    [pageItems]
  );

  return (
    <DashboardWidgetFrame
      title="Asset profitability"
      isEditing={isEditing}
      className={className}
      contentClassName="flex-col h-full w-full"
      headerRight={
        !isEditing ? (
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 justify-end">
              <Switch checked={showWorst} onCheckedChange={setShowWorst} />
              <span className="text-xs text-white/50">
                {showWorst ? "Worst performing" : "Best performing"}
              </span>
            </div>

            {rows.length > pageSize && (
              <div className="flex items-center gap-2 border border-white/5">
                <Button
                  className="text-xs text-white/50 hover:text-white disabled:opacity-40 border-r border-white/5 rounded-sm px-2 py-1 bg-transparent hover:bg-sidebar-accent hover:brightness-120"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="size-3.5" />
                </Button>

                <span className="text-[10px] text-white/40 px-1">
                  {page + 1}/{pageCount}
                </span>

                <Button
                  className="text-xs text-white/50 hover:text-white disabled:opacity-40 border-l border-white/5 rounded-sm py-1 bg-transparent hover:bg-sidebar-accent hover:brightness-120"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        ) : null
      }
    >
      <div className="flex-1 min-h-0 flex flex-col gap-3.5 p-3.5 pb-3 justify-end">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={`asset-skel-${i}`} className="flex items-center gap-8 w-full">
              <Skeleton className="w-24 h-4 rounded-sm bg-sidebar" />

              <div className="w-full flex-1 flex items-center gap-2">
                <Skeleton className="h-4 w-full rounded-sm bg-sidebar" />
                <Skeleton className="w-12 h-4 w-24 rounded-sm bg-sidebar" />
              </div>
            </div>
          ))
        ) : list.length === 0 ? (
          <div className="text-xs text-white/40">
            No assets with non-zero profit in range.
          </div>
        ) : (
          pageItems.map((r) => {
            const v = Number(r.totalProfit || 0);
            const pct = Math.min(100, Math.round((Math.abs(v) / maxAbs) * 100));
            const isGain = v >= 0;
            return (
              <div key={r.symbol} className="flex items-center gap-3 w-full">
                <div className="w-20 truncate text-xs text-white/40">
                  {r.symbol}
                </div>

                <div className="flex-1 h-3.5 bg-sidebar rounded-sm">
                  <div
                    className={cn("h-full", isGain ? "bg-teal-400" : "bg-rose-400")}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div
                  className={cn(
                    "w-12 text-xs truncate font-semibold",
                    isGain ? "text-teal-400" : "text-rose-400"
                  )}
                >
                  {isGain ? "$" : "-$"}
                  {Math.abs(Math.round(v)).toLocaleString()}
                </div>
              </div>
            );
          })
        )}
      </div>
    </DashboardWidgetFrame>
  );
}

export function TradeCountsCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [byDay, setByDay] = useState<Array<{ dateISO: string; count: number }>>(
    []
  );
  const [byWeek, setByWeek] = useState<
    Array<{ startISO: string; count: number }>
  >([]);
  const [byMonth, setByMonth] = useState<
    Array<{ month: string; count: number }>
  >([]);

  useEffect(() => {
    (async () => {
      if (!accountId) return;
      setLoading(true);
      try {
        const data = await trpcClient.accounts.tradeCountsOverall.query({
          accountId,
        });

        setByDay([...data.byDay]);
        setByWeek([...data.byWeek]);
        setByMonth([...data.byMonth]);
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, [accountId]);

  const rows = useMemo(() => {
    const totalTrades = byDay.reduce((acc, x) => acc + (x.count || 0), 0);
    const totalDays = byDay.length || 1;
    const perDay = totalTrades / totalDays;

    const weekTotals = byWeek.map((w) => Number(w.count || 0));
    const sumWeeks = weekTotals.reduce((acc, c) => acc + c, 0);
    const totalWeeks = byWeek.length || 1;
    const perWeek = sumWeeks / totalWeeks;

    const monthTotals = byMonth.map((m) => Number(m.count || 0));
    const sumMonths = monthTotals.reduce((acc, c) => acc + c, 0);
    const totalMonths = byMonth.length || 1;
    const perMonth = sumMonths / totalMonths;

    return [
      { label: "Per day", value: perDay },
      { label: "Per week", value: perWeek },
      { label: "Per month", value: perMonth },
    ];
  }, [byDay, byWeek, byMonth]);

  const formatAverageTradeCount = (value: number) => {
    if (value === 0) return "0";
    if (value < 1) return value.toFixed(2);
    if (value < 10) return value.toFixed(1);
    return value.toFixed(0);
  };

  const maxVal = useMemo(
    () => Math.max(1, ...rows.map((r) => Number(r.value || 0))),
    [rows]
  );

  return (
    <DashboardWidgetFrame
      title="Average trade counts"
      isEditing={isEditing}
      className={className}
      contentClassName="flex-col h-full w-full"
    >
      <div className="flex flex-col gap-3.5 p-3.5 h-full overflow-y-auto justify-end">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={`tc-skel-${i}`} className="flex items-center gap-8 w-full">
                <Skeleton className="w-24 h-4 rounded-sm bg-sidebar" />
                <div className="w-full flex-1 flex items-center gap-2">
                  <Skeleton className="h-4 w-full rounded-sm bg-sidebar" />
                  <Skeleton className="w-12 h-4 rounded-sm bg-sidebar" />
                </div>
              </div>
            ))
          : rows.map((r) => {
              const v = Number(r.value || 0);
              const pct = Math.min(100, Math.round((Math.abs(v) / maxVal) * 100));
              return (
                <div key={r.label} className="flex items-center w-full">
                  <div className="w-20 truncate text-xs text-white/40">
                    {r.label}
                  </div>
                  <div className="w-full flex-1 flex items-center gap-3">
                    <div className="flex-1 h-3.5 bg-sidebar rounded-sm">
                      <div
                        className="h-full bg-white/75"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="w-12 text-xs truncate font-semibold text-white/70">
                      {formatAverageTradeCount(v)}
                    </div>
                  </div>
                </div>
              );
            })}
      </div>
    </DashboardWidgetFrame>
  );
}

// ========================
// Risk Calculator Widget
// ========================
export function RiskCalculatorCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  const [balance, setBalance] = useState<string>("10000");
  const [riskPercent, setRiskPercent] = useState<string>("1");
  const [stopLossPips, setStopLossPips] = useState<string>("20");
  const [pipValue, setPipValue] = useState<string>("10"); // USD per pip per lot

  const riskAmount = useMemo(() => {
    const bal = parseFloat(balance) || 0;
    const risk = parseFloat(riskPercent) || 0;
    return (bal * risk) / 100;
  }, [balance, riskPercent]);

  const lotSize = useMemo(() => {
    const slPips = parseFloat(stopLossPips) || 1;
    const pv = parseFloat(pipValue) || 10;
    if (slPips <= 0 || pv <= 0) return 0;
    return riskAmount / (slPips * pv);
  }, [riskAmount, stopLossPips, pipValue]);

  // Load balance from stats if available
  const { data } = useAccountStats(accountId);
  useEffect(() => {
    if (data?.initialBalance) {
      const total = Number(data.initialBalance) + Number(data.totalProfit || 0);
      setBalance(total.toFixed(2));
    }
  }, [data]);

  return (
    <DashboardWidgetFrame
      title="Risk calculator"
      icon={
        <Activity className="size-4 stroke-white/50 group-hover:stroke-white transition-all duration-250" />
      }
      isEditing={isEditing}
      className={cn("min-h-72 max-h-72", className)}
      contentClassName="flex-col flex-1 min-h-0 w-full p-3.5 gap-1.5"
    >
      <>
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/50 w-16 shrink-0">Balance</label>
          <Input
            type="number"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className="h-6 flex-1 rounded-sm bg-sidebar border-white/5 text-white text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/50 w-16 shrink-0">Risk %</label>
          <Input
            type="number"
            value={riskPercent}
            onChange={(e) => setRiskPercent(e.target.value)}
            step="0.5"
            min="0.1"
            max="10"
            className="h-6 flex-1 rounded-sm bg-sidebar border-white/5 text-white text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/50 w-16 shrink-0">SL Pips</label>
          <Input
            type="number"
            value={stopLossPips}
            onChange={(e) => setStopLossPips(e.target.value)}
            min="1"
            className="h-6 flex-1 rounded-sm bg-sidebar border-white/5 text-white text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/50 w-16 shrink-0">
            $/Pip/Lot
          </label>
          <Input
            type="number"
            value={pipValue}
            onChange={(e) => setPipValue(e.target.value)}
            min="0.01"
            step="0.01"
            className="h-6 flex-1 rounded-sm bg-sidebar border-white/5 text-white text-xs"
          />
        </div>
        <div className="mt-auto pt-1.5 border-t border-white/5">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-white/50">Risk Amount</span>
            <span className="text-xs font-semibold text-rose-400">
              ${riskAmount.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center mt-0.5">
            <span className="text-[10px] text-white/50">Lot Size</span>
            <span className="text-base font-bold text-teal-400">
              {lotSize.toFixed(2)}
            </span>
          </div>
        </div>
      </>
    </DashboardWidgetFrame>
  );
}

// ========================
// Execution Scorecard Widget
// ========================
export function ExecutionScorecardCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  const { data, isLoading } = useQuery({
    ...trpcOptions.accounts.executionStats.queryOptions({
      accountId: accountId || "",
    }),
    enabled: !!accountId,
    staleTime: 60000, // Cache for 1 minute
  });

  // Safely convert values to numbers (SQL aggregations can return strings)
  const avgEntrySpread = toNumber(data?.avgEntrySpread);
  const avgExitSpread = toNumber(data?.avgExitSpread);
  const avgEntrySlippage = toNumber(data?.avgEntrySlippage);
  const avgExitSlippage = toNumber(data?.avgExitSlippage);
  const totalSlMods = toNumber(data?.totalSlModifications);
  const totalTpMods = toNumber(data?.totalTpModifications);
  const tradesWithExecData = toNumber(data?.tradesWithExecutionData);
  const hasData = data?.avgEntrySpread != null || data?.avgExitSpread != null;

  const gradeColor = useMemo(() => {
    if (!data) return "text-white/50";
    switch (data.grade) {
      case "A":
        return "text-teal-400";
      case "B":
        return "text-green-400";
      case "C":
        return "text-yellow-400";
      case "D":
        return "text-orange-400";
      case "F":
        return "text-rose-400";
      default:
        return "text-white/50";
    }
  }, [data?.grade]);

  return (
    <DashboardWidgetFrame
      title="Execution scorecard"
      icon={
        <Activity className="size-4 stroke-white/50 group-hover:stroke-white transition-all duration-250" />
      }
      isEditing={isEditing}
      className={className}
      contentClassName="flex-col h-full min-h-0 w-full p-3.5"
      headerRight={
        data ? (
          <span className={`ml-auto text-2xl font-bold ${gradeColor}`}>
            {data.grade}
          </span>
        ) : null
      }
    >
      <>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full rounded-sm bg-sidebar" />
            ))}
          </div>
        ) : !data || tradesWithExecData === 0 || !hasData ? (
          <div className="flex items-center justify-center h-full text-xs text-white/40">
            No execution data available.
            <br />
            Connect an EA for detailed metrics.
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col overflow-y-auto text-xs">
            {[
              {
                label: "Avg Entry Spread",
                value:
                  data.avgEntrySpread != null
                    ? `${avgEntrySpread.toFixed(2)} pips`
                    : "—",
                valueClassName: "text-white font-medium",
              },
              {
                label: "Avg Exit Spread",
                value:
                  data.avgExitSpread != null
                    ? `${avgExitSpread.toFixed(2)} pips`
                    : "—",
                valueClassName: "text-white font-medium",
              },
              {
                label: "Avg Entry Slippage",
                value:
                  data.avgEntrySlippage != null
                    ? `${avgEntrySlippage.toFixed(2)} pips`
                    : "—",
                valueClassName:
                  avgEntrySlippage > 0.5
                    ? "font-medium text-rose-400"
                    : "font-medium text-teal-400",
              },
              {
                label: "Avg Exit Slippage",
                value:
                  data.avgExitSlippage != null
                    ? `${avgExitSlippage.toFixed(2)} pips`
                    : "—",
                valueClassName:
                  avgExitSlippage > 0.5
                    ? "font-medium text-rose-400"
                    : "font-medium text-teal-400",
              },
            ].map((row, index) => (
              <Fragment key={row.label}>
                {index > 0 ? (
                  <Separator className={WIDGET_CONTENT_SEPARATOR_CLASS} />
                ) : null}
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-white/50">{row.label}</span>
                  <span className={row.valueClassName}>{row.value}</span>
                </div>
              </Fragment>
            ))}

            <div className="mt-auto flex flex-col">
              <Separator className={WIDGET_CONTENT_SEPARATOR_CLASS} />
              {[
                { label: "SL Modifications", value: totalSlMods },
                { label: "TP Modifications", value: totalTpMods },
              ].map((row, index) => (
                <Fragment key={row.label}>
                  {index > 0 ? (
                    <Separator className={WIDGET_CONTENT_SEPARATOR_CLASS} />
                  ) : null}
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-white/50">{row.label}</span>
                    <span className="font-medium text-white">{row.value}</span>
                  </div>
                </Fragment>
              ))}
            </div>
          </div>
        )}
      </>
    </DashboardWidgetFrame>
  );
}

// ========================
// Money Left on Table Widget
// ========================
export function MoneyLeftOnTableCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  const { data, isLoading } = useQuery({
    ...trpcOptions.accounts.moneyLeftOnTable.queryOptions({
      accountId: accountId || "",
    }),
    enabled: !!accountId,
    staleTime: 60000, // Cache for 1 minute
  });

  // Safely convert values to numbers
  const totalMissed = toNumber(data?.totalMissed);
  const totalMissedDuringTrade = toNumber(data?.totalMissedDuringTrade);
  const totalMissedAfterExit = toNumber(data?.totalMissedAfterExit);
  const actualProfit = toNumber(data?.actualProfit);
  const captureRatio = toNumber(data?.captureRatio);
  const tradesWithPeakData = toNumber(data?.tradesWithPeakData);

  return (
    <DashboardWidgetFrame
      title="Money left on table"
      icon={
        <TrendingDown className="size-4 stroke-white/50 group-hover:stroke-white transition-all duration-250" />
      }
      isEditing={isEditing}
      className={className}
      contentClassName="flex-col h-full min-h-0 w-full p-3.5"
    >
      <>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full rounded-sm bg-sidebar" />
            ))}
          </div>
        ) : !data || tradesWithPeakData === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-white/40 text-center">
            No peak price data available.
            <br />
            Connect an EA with manipulation tracking.
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col overflow-y-auto">
            {[
              {
                label: "Total missed profit",
                value: formatSignedCurrency(totalMissed),
                valueClassName: "text-lg font-bold text-rose-400",
              },
              {
                label: "During trade",
                value: formatSignedCurrency(totalMissedDuringTrade),
                valueClassName: "font-medium text-rose-400",
              },
              {
                label: "After exit",
                value: formatSignedCurrency(totalMissedAfterExit),
                valueClassName: "font-medium text-rose-400",
              },
            ].map((row, index) => (
              <Fragment key={row.label}>
                {index > 0 ? (
                  <Separator className={WIDGET_CONTENT_SEPARATOR_CLASS} />
                ) : null}
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-xs text-white/50">{row.label}</span>
                  <span className={row.valueClassName}>{row.value}</span>
                </div>
              </Fragment>
            ))}

            <div className="mt-auto flex flex-col">
              <Separator className={WIDGET_CONTENT_SEPARATOR_CLASS} />
              <div className="flex items-center justify-between gap-3 py-2.5 text-xs">
                <span className="text-white/50">Actual profit</span>
                <span
                  className={cn(
                    "font-medium",
                    actualProfit >= 0 ? "text-teal-400" : "text-rose-400"
                  )}
                >
                  {formatSignedCurrency(actualProfit)}
                </span>
              </div>
              <Separator className={WIDGET_CONTENT_SEPARATOR_CLASS} />
              <div className="flex items-center justify-between gap-3 py-2.5 text-xs">
                <span className="text-white/50">Capture ratio</span>
                <span
                  className={cn(
                    "font-bold",
                    captureRatio >= 70
                      ? "text-teal-400"
                      : captureRatio >= 50
                      ? "text-yellow-400"
                      : "text-rose-400"
                  )}
                >
                  {captureRatio.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </>
    </DashboardWidgetFrame>
  );
}

// ========================
// Session Performance Widget
// ========================
export function SessionPerformanceCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  const { data, isLoading } = useQuery({
    ...trpcOptions.trades.listInfinite.queryOptions({
      accountId: accountId || "",
      limit: 200,
    }),
    enabled: !!accountId,
    staleTime: 60000,
  });

  const sessionStats = useMemo(() => {
    if (!data?.items?.length) return null;

    const sessions: Record<
      string,
      { trades: number; profit: number; wins: number }
    > = {
      Asian: { trades: 0, profit: 0, wins: 0 },
      London: { trades: 0, profit: 0, wins: 0 },
      "New York": { trades: 0, profit: 0, wins: 0 },
    };

    data.items.forEach((trade: any) => {
      const openTime = trade.open ? new Date(trade.open) : null;
      if (!openTime) return;

      const hour = openTime.getUTCHours();
      let session: string;

      if (hour >= 0 && hour < 8) {
        session = "Asian";
      } else if (hour >= 8 && hour < 16) {
        session = "London";
      } else {
        session = "New York";
      }

      const profit = toNumber(trade.profit);
      sessions[session].trades++;
      sessions[session].profit += profit;
      if (profit > 0) sessions[session].wins++;
    });

    return Object.entries(sessions).map(([name, stats]) => ({
      name,
      trades: stats.trades,
      profit: stats.profit,
      winRate: stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0,
    }));
  }, [data]);

  const maxTrades = Math.max(...(sessionStats?.map((s) => s.trades) || [1]), 1);

  return (
    <DashboardWidgetFrame
      title="Session performance"
      icon={
        <Activity className="size-4 stroke-white/50 group-hover:stroke-white transition-all duration-250" />
      }
      isEditing={isEditing}
      className={className}
      contentClassName="flex-col h-full w-full p-3.5"
    >
      <>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-sm bg-sidebar" />
            ))}
          </div>
        ) : !sessionStats ? (
          <div className="flex items-center justify-center h-full text-xs text-white/40 text-center">
            No trade data available.
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="flex flex-col gap-3">
              {sessionStats.map((session) => (
                <div key={session.name} className="flex flex-col gap-2">
                  <div className="grid grid-cols-3 items-center gap-3">
                    <div className="min-w-0 justify-self-start">
                      <span className="text-xs font-medium text-white/70">
                        {session.name}
                      </span>
                    </div>
                    <div className="justify-self-center">
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          session.profit >= 0
                            ? "text-teal-400"
                            : "text-rose-400"
                        )}
                      >
                        {formatSignedCurrency(session.profit)}
                      </span>
                    </div>
                    <div className="w-full max-w-[5.5rem] justify-self-end text-right">
                      <span className="block truncate text-[10px] text-white/40">
                        {session.trades} trades
                      </span>
                    </div>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="w-full text-left"
                        aria-label={`${session.name}: ${session.trades} trades`}
                      >
                        <div className="h-1.5 rounded-[1px] bg-sidebar">
                          <div
                            className={cn(
                              "h-full transition-all",
                              session.profit >= 0 ? "bg-teal-500" : "bg-rose-500"
                            )}
                            style={{
                              width: `${(session.trades / maxTrades) * 100}%`,
                            }}
                          />
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={8} className="px-0 py-2">
                      <div className="flex min-w-[160px] flex-col">
                        <div className="flex items-center justify-between px-3 text-[11px] text-white/60">
                          <span>{session.name}</span>
                          <span>
                            {session.trades}{" "}
                            {session.trades === 1 ? "trade" : "trades"}
                          </span>
                        </div>
                        <Separator className="mt-2 w-full" />
                        <div className="flex items-center justify-between px-3 pt-2 text-[11px]">
                          <span className="text-white/50">Profit</span>
                          <span
                            className={cn(
                              "font-medium",
                              session.profit >= 0
                                ? "text-teal-400"
                                : "text-rose-400"
                            )}
                          >
                            {formatSignedCurrency(session.profit)}
                          </span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                {sessionStats.map((session) => (
                  <div key={session.name}>
                    <div
                      className={cn(
                        "text-xs font-semibold",
                        session.winRate >= 50
                          ? "text-teal-400"
                          : "text-rose-400"
                      )}
                    >
                      {session.winRate.toFixed(0)}%
                    </div>
                    <div className="text-[9px] text-white/40">
                      {session.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </>
    </DashboardWidgetFrame>
  );
}

// ========================
// Trade Streak Calendar Widget
// ========================
export function TradeStreakCalendarCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  const { data, isLoading } = useQuery({
    ...trpcOptions.trades.listInfinite.queryOptions({
      accountId: accountId || "",
      limit: 200,
    }),
    enabled: !!accountId,
    staleTime: 60000,
  });

  const streakData = useMemo(() => {
    if (!data?.items?.length) return null;

    const tradesByDate: Record<string, { profit: number; count: number }> = {};

    data.items.forEach((trade: any) => {
      const date = trade.open
        ? new Date(trade.open).toISOString().split("T")[0]
        : null;
      if (!date) return;

      if (!tradesByDate[date]) {
        tradesByDate[date] = { profit: 0, count: 0 };
      }
      tradesByDate[date].profit += toNumber(trade.profit);
      tradesByDate[date].count++;
    });

    const sortedDates = Object.keys(tradesByDate).sort();
    let currentStreak = 0;
    let maxWinStreak = 0;
    let maxLoseStreak = 0;
    let tempWinStreak = 0;
    let tempLoseStreak = 0;

    sortedDates.forEach((date) => {
      const dayProfit = tradesByDate[date].profit;
      if (dayProfit >= 0) {
        tempWinStreak++;
        tempLoseStreak = 0;
        maxWinStreak = Math.max(maxWinStreak, tempWinStreak);
      } else {
        tempLoseStreak++;
        tempWinStreak = 0;
        maxLoseStreak = Math.max(maxLoseStreak, tempLoseStreak);
      }
    });

    const last30Days: { date: string; profit: number; count: number }[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const dayData = tradesByDate[dateStr] || { profit: 0, count: 0 };
      last30Days.push({
        date: dateStr,
        profit: dayData.profit,
        count: dayData.count,
      });
    }

    return {
      maxWinStreak,
      maxLoseStreak,
      calendar: last30Days,
      totalGreenDays: last30Days.filter((d) => d.profit > 0).length,
      totalRedDays: last30Days.filter((d) => d.profit < 0).length,
    };
  }, [data]);

  return (
    <DashboardWidgetFrame
      title="Trade streak calendar"
      icon={
        <Activity className="size-4 stroke-white/50 group-hover:stroke-white transition-all duration-250" />
      }
      isEditing={isEditing}
      className={className}
      contentClassName="flex-col h-full w-full p-3.5"
    >
      <>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-20 w-full rounded-sm bg-sidebar" />
            <Skeleton className="h-8 w-full rounded-sm bg-sidebar" />
          </div>
        ) : !streakData ? (
          <div className="flex items-center justify-center h-full text-xs text-white/40 text-center">
            No trade data available.
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="mx-auto w-full max-w-[42rem]">
              <div className="mb-3 grid grid-cols-10 gap-0.5">
                {streakData.calendar.map((day, i) => (
                  <div
                    key={i}
                    className={cn(
                      "aspect-square rounded-sm",
                      day.count === 0 && "bg-white/5",
                      day.profit > 0 && "bg-teal-500/60",
                      day.profit < 0 && "bg-rose-500/60",
                      day.profit === 0 && day.count > 0 && "bg-white/20"
                    )}
                    title={`${day.date}: ${formatSignedCurrency(day.profit, 2)}`}
                  />
                ))}
              </div>

              <div className="mb-3 grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-lg font-bold text-teal-400">
                    {streakData.maxWinStreak}
                  </div>
                  <div className="text-[9px] text-white/40">Max Win Streak</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-rose-400">
                    {streakData.maxLoseStreak}
                  </div>
                  <div className="text-[9px] text-white/40">
                    Max Lose Streak
                  </div>
                </div>
                <div>
                  <div className="text-lg font-bold text-teal-400">
                    {streakData.totalGreenDays}
                  </div>
                  <div className="text-[9px] text-white/40">Green Days</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-rose-400">
                    {streakData.totalRedDays}
                  </div>
                  <div className="text-[9px] text-white/40">Red Days</div>
                </div>
              </div>
            </div>

            <div className="mt-auto flex flex-wrap items-center justify-center gap-4 text-[10px] text-white/40">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-sm bg-teal-500/60" />
                <span>Profitable</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-sm bg-rose-500/60" />
                <span>Loss</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-sm bg-white/5" />
                <span>No trades</span>
              </div>
            </div>
          </div>
        )}
      </>
    </DashboardWidgetFrame>
  );
}

// ========================
// Widget Component Mapping
// ========================
const cardComponents: Record<WidgetType, ComponentType<any>> = {
  "account-balance": AccountBalanceCard,
  "account-equity": AccountEquityCard,
  "win-rate": WinRateCard,
  "win-streak": WinStreakCard,
  "profit-factor": ProfitFactorCard,
  "hold-time": HoldTimeCard,
  "average-rr": AverageRRCard,
  "asset-profitability": AssetProfitabilityCard,
  "trade-counts": TradeCountsCard,
  "profit-expectancy": ProfitExpectancyCard,
  "total-losses": TotalLossesCard,
  "consistency-score": ConsistencyScoreCard,
  "open-trades": OpenTradesWidget,
  "execution-scorecard": ExecutionScorecardCard,
  "money-left-on-table": MoneyLeftOnTableCard,
  watchlist: WatchlistWidget,
  "session-performance": SessionPerformanceCard,
  "streak-calendar": TradeStreakCalendarCard,
  tiltmeter: TiltmeterWidget,
  "daily-briefing": DailyBriefingCard,
  "risk-intelligence": RiskDashboardWidget,
  "rule-compliance": RuleComplianceWidget,
  "edge-coach": CoachingWidget,
  "what-if": WhatIfWidget,
  benchmark: BenchmarkWidget,
} as const;

const defaultWidgetSpans: Partial<Record<WidgetType, number>> = {
  "asset-profitability": 2,
};

// ========================
// TopWidgets Container Component
// ========================
export interface TopWidgetsProps {
  enabledWidgets: WidgetType[];
  accountId?: string;
  isEditing?: boolean;
  valueMode?: "usd" | "percent";
  onToggleWidget?: (type: WidgetType) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onEnterEdit?: () => void;
  widgetSpans?: Partial<Record<WidgetType, number>>;
  onResizeWidget?: (type: WidgetType, span: number) => void;
  maxWidgets?: number;
}

export function Widgets({
  enabledWidgets,
  accountId,
  isEditing = false,
  valueMode = "usd",
  onToggleWidget,
  onReorder,
  onEnterEdit,
  widgetSpans,
  onResizeWidget,
  maxWidgets = 15,
}: TopWidgetsProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const setFocusedWidgetId = useDashboardAssistantContextStore(
    (state) => state.setFocusedWidgetId
  );
  // Ensure only max widgets
  const displayWidgets = enabledWidgets.slice(0, maxWidgets);

  // Fill empty slots with placeholder divs
  const emptySlots = 0 - displayWidgets.length;

  // All possible widgets for discovery in edit mode
  const allWidgets: WidgetType[] = [
    "account-balance",
    "account-equity",
    "win-rate",
    "profit-factor",
    "win-streak",
    "hold-time",
    "average-rr",
    "asset-profitability",
    "trade-counts",
    "profit-expectancy",
    "total-losses",
    "consistency-score",
    "open-trades",
    "execution-scorecard",
    "money-left-on-table",
    "watchlist",
    "session-performance",
    "streak-calendar",
    "tiltmeter",
    "daily-briefing",
    "risk-intelligence",
    "rule-compliance",
    "edge-coach",
    "what-if",
    "benchmark",
  ];

  const availableWidgets = allWidgets.filter(
    (w) => !displayWidgets.includes(w)
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
        delay: 100,
        tolerance: 5,
      },
    })
  );

  const [maxCols, setMaxCols] = useState(4);
  const [resizePreview, setResizePreview] = useState<{
    type: WidgetType;
    span: number;
  } | null>(null);
  const isResizingRef = useRef(false);
  const justResizedRef = useRef(false);
  const resizeMetricsRef = useRef<{ colWidth: number; gap: number }>({
    colWidth: 0,
    gap: 0,
  });
  useEffect(() => {
    const getCols = () => {
      if (typeof window === "undefined") return 4;
      const width = window.innerWidth;
      if (width >= 1920) return 5;
      if (width >= 768) return 4;
      return 1;
    };
    const update = () => setMaxCols(getCols());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));
  const snapSpan = (value: number, max: number) =>
    clamp(Math.round(value), 1, max);
  const getRawSpan = (type: WidgetType) => {
    const raw = Number(widgetSpans?.[type] ?? defaultWidgetSpans[type] ?? 1);
    return Number.isFinite(raw) ? raw : 1;
  };
  const getDisplaySpan = (type: WidgetType) =>
    snapSpan(getRawSpan(type), maxCols);
  const getColumnMetrics = () => {
    const grid = gridRef.current;
    if (!grid) return null;
    const styles = window.getComputedStyle(grid);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || "0");
    const width = grid.clientWidth;
    if (!width || maxCols <= 0) return null;
    return { colWidth: (width - gap * (maxCols - 1)) / maxCols, gap };
  };
  const startResize = (type: WidgetType, startX: number) => {
    const metrics = getColumnMetrics();
    if (!metrics || metrics.colWidth <= 0) return;
    resizeMetricsRef.current = metrics;
    const initialSpan = getDisplaySpan(type);
    const startSpan = initialSpan;
    let lastSpan = initialSpan;
    isResizingRef.current = true;
    setResizePreview({ type, span: initialSpan });
    const handleMove = (event: PointerEvent) => {
      const delta = event.clientX - startX;
      const step = metrics.colWidth + metrics.gap;
      const desired = startSpan + delta / (step > 0 ? step : metrics.colWidth);
      const next = snapSpan(desired, maxCols);
      if (next !== lastSpan) {
        lastSpan = next;
        setResizePreview({ type, span: next });
      }
    };
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      setResizePreview(null);
      if (lastSpan !== getRawSpan(type)) {
        onResizeWidget?.(type, lastSpan);
      }
      justResizedRef.current = true;
      window.setTimeout(() => {
        isResizingRef.current = false;
        justResizedRef.current = false;
      }, 150);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!isEditing) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = displayWidgets.indexOf(active.id as WidgetType);
    const newIndex = displayWidgets.indexOf(over.id as WidgetType);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder?.(oldIndex, newIndex);
  };

  // long-press to enter edit mode
  let pressTimer: any = null;
  const handlePointerDown = () => {
    if (isEditing) return;
    pressTimer = setTimeout(() => onEnterEdit?.(), 500);
  };
  const handlePointerUp = () => {
    if (pressTimer) clearTimeout(pressTimer);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={displayWidgets} strategy={rectSortingStrategy}>
        <div
          ref={gridRef}
          className="grid auto-rows-[18rem] gap-1.5 md:grid-cols-4 2xl:grid-cols-4 3xl:grid-cols-5 "
        >
          {accountId ? (
            displayWidgets.map((widgetType, index) => {
              const CardComponent = cardComponents[widgetType];
              const span = getDisplaySpan(widgetType);
              const activeSpan =
                resizePreview?.type === widgetType ? resizePreview.span : span;
              return (
                <SortableWidget
                  key={`${widgetType}-${index}`}
                  id={widgetType}
                  disabled={!isEditing}
                  style={{
                    gridColumn: `span ${activeSpan} / span ${activeSpan}`,
                  }}
                >
                  <div
                    className="relative h-72 w-full cursor-pointer"
                    onPointerEnter={() => setFocusedWidgetId(widgetType)}
                    onFocusCapture={() => setFocusedWidgetId(widgetType)}
                    onPointerDown={(e) => {
                      handlePointerDown();
                    }}
                    onPointerUp={(e) => {
                      handlePointerUp();
                    }}
                    onPointerCancel={handlePointerUp}
                    onClick={(e) => {
                      if (isEditing) {
                        if (isResizingRef.current || justResizedRef.current)
                          return;
                        e.stopPropagation();
                        onToggleWidget?.(widgetType);
                      }
                    }}
                  >
                    {/* checkmark when selected in edit mode */}
                    {isEditing ? (
                      <div className="flex items-center absolute right-5 top-5 z-10 gap-2">
                        <div className="flex items-center gap-2 pointer-events-none">
                          <div className="size-4 border border-white/5 flex items-center justify-center">
                            <svg
                              viewBox="0 0 24 24"
                              className="size-3 fill-white"
                            >
                              <path d="M20.285 6.708a1 1 0 0 1 0 1.414l-9 9a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L10.5 14.5l8.293-8.293a1 1 0 0 1 1.492.5z" />
                            </svg>
                          </div>

                          <GripVertical className="size-3.5 text-white/30" />
                        </div>

                        <div
                          className="flex items-center gap-1 border border-white/5 bg-sidebar/90"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="px-2 py-1 text-[10px] text-white/60 hover:text-white/90 disabled:opacity-40"
                            disabled={getRawSpan(widgetType) <= 1}
                            onClick={() => {
                              const next = snapSpan(
                                getRawSpan(widgetType) - 1,
                                maxCols
                              );
                              onResizeWidget?.(widgetType, next);
                            }}
                          >
                            -
                          </button>
                          <span className="text-[10px] text-white/50 px-1">
                            {activeSpan}x
                          </span>
                          <button
                            type="button"
                            className="px-2 py-1 text-[10px] text-white/60 hover:text-white/90 disabled:opacity-40"
                            disabled={getRawSpan(widgetType) >= maxCols}
                            onClick={() => {
                              const next = snapSpan(
                                getRawSpan(widgetType) + 1,
                                maxCols
                              );
                              onResizeWidget?.(widgetType, next);
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <CardComponent
                      accountId={accountId}
                      isEditing={isEditing}
                      valueMode={valueMode}
                      className="w-full h-full"
                    />
                    {isEditing ? (
                      <>
                        {resizePreview?.type === widgetType ? (
                          <div className="absolute inset-0 border border-white/20 bg-white/5 pointer-events-none" />
                        ) : null}
                        <div
                          className="absolute right-0 top-0 h-full w-3 cursor-ew-resize"
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            startResize(widgetType, e.clientX);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </>
                    ) : null}
                  </div>
                </SortableWidget>
              );
            })
          ) : (
            <Fragment>
              {Array.from({ length: 5 }).map((_, index) => (
                <WidgetWrapper
                  key={`loading-${index}`}
                  className="h-72 w-full"
                  header={
                    <div className="flex w-full justify-between items-center p-3.5 widget-header">
                      <Skeleton className="w-32 rounded-sm h-4 bg-sidebar-accent" />
                      <Skeleton className="w-16 h-4 rounded-sm bg-sidebar-accent" />
                    </div>
                  }
                >
                  <div className="flex gap-8 p-3.5 h-full items-end justify-between">
                    <div className="flex flex-col gap-1">
                      <Skeleton className="w-12 h-4 rounded-sm bg-sidebar" />
                      <Skeleton className="w-24 h-4 rounded-sm bg-sidebar" />
                    </div>

                    <Skeleton className="w-full h-full rounded-sm bg-sidebar" />
                  </div>
                </WidgetWrapper>
              ))}
            </Fragment>
          )}

          {/* In edit mode, show available widgets with 50% opacity */}
          {isEditing &&
            availableWidgets.map((widgetType, index) => {
              const CardComponent = cardComponents[widgetType];
              const isAtMaxLimit = displayWidgets.length >= maxWidgets;
              const span = getDisplaySpan(widgetType);
              return (
                <div
                  key={`available-${widgetType}-${index}`}
                  className={cn(
                    "transition-all duration-150 hover:animate-none relative",
                    isAtMaxLimit
                      ? "opacity-25 cursor-not-allowed"
                      : "opacity-50 hover:opacity-100 cursor-pointer"
                  )}
                  style={{ gridColumn: `span ${span} / span ${span}` }}
                  onClick={() => !isAtMaxLimit && onToggleWidget?.(widgetType)}
                >
                  {/* Max limit indicator overlay */}
                  {isAtMaxLimit && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/40 backdrop-blur-[2px]">
                      <div className="text-xs text-white/80 font-medium px-3 py-1.5 bg-sidebar/90 border border-white/10">
                        Max {maxWidgets} widgets reached
                      </div>
                    </div>
                  )}
                  {/* checkmark hidden since not selected yet */}
                  <CardComponent
                    accountId={accountId}
                    isEditing={true}
                    valueMode={valueMode}
                  />
                </div>
              );
            })}

          {/* Empty placeholder slots */}
          {isEditing &&
            Array.from({ length: emptySlots }).map((_, index) => (
              <WidgetWrapper
                key={`empty-${index}`}
                className="h-72 w-full"
                header={
                  <div className="flex w-full justify-between items-center p-3.5 widget-header">
                    <Skeleton className="w-32 rounded-sm h-4 bg-sidebar-accent" />
                    <Skeleton className="w-16 h-4 rounded-sm bg-sidebar-accent" />
                  </div>
                }
              >
                <div className="flex gap-8 p-3.5 h-full items-end justify-between">
                  <div className="flex flex-col gap-1">
                    <Skeleton className="w-12 h-4 rounded-sm bg-sidebar" />
                    <Skeleton className="w-24 h-4 rounded-sm bg-sidebar" />
                  </div>

                  <Skeleton className="w-48 h-full rounded-sm bg-sidebar" />
                </div>
              </WidgetWrapper>
            ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableWidget({
  id,
  disabled,
  children,
  style: itemStyle,
}: {
  id: string;
  disabled?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={{ ...style, ...itemStyle }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

export function OpenTradesWidget({
  accountId,
  isEditing = false,
  valueMode = "usd",
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  valueMode?: "usd" | "percent";
  className?: string;
}) {
  type OpenTrade = {
    id: string;
    ticket: string;
    symbol: string;
    tradeType: "long" | "short";
    volume: number;
    openPrice: number;
    openTime: string;
    currentPrice: number | null;
    profit: number;
    swap: number;
    commission: number;
  };

  const [trades, setTrades] = useState<OpenTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [initialBalance, setInitialBalance] = useState(0);
  const pageSize = 4;

  // Use tRPC hook for automatic deduplication and caching (same as balance widget)
  const { data: liveMetrics } = useQuery({
    ...trpcOptions.accounts.liveMetrics.queryOptions({
      accountId: accountId || "",
    }),
    enabled: !!accountId,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    staleTime: 4000,
  });

  // Update trades when live metrics change
  // Type assertions needed until tRPC React Query types are fully propagated
  useEffect(() => {
    if ((liveMetrics as any)?.openTrades) {
      setTrades((liveMetrics as any).openTrades);
      setInitialBalance(toNumber((liveMetrics as any).initialBalance || 0));
      setIsLive(true);
      setTimeout(() => setIsLive(false), 300);
      setLoading(false);
    }
  }, [liveMetrics]);

  // Polling is now handled by the tRPC hook above

  // Reset page when trades change
  useEffect(() => setPage(0), [trades]);

  const pageCount = Math.max(1, Math.ceil(trades.length / pageSize));
  const pageItems = useMemo(
    () => trades.slice(page * pageSize, page * pageSize + pageSize),
    [trades, page]
  );
  const formatPrice = (price: number) => price.toFixed(5);
  const formatProfit = (profit: number) => {
    if (valueMode === "percent") {
      if (initialBalance <= 0) return "—";
      const pct = (profit / initialBalance) * 100;
      const sign = pct >= 0 ? "+" : "";
      return `${sign}${Math.abs(pct).toFixed(2)}%`;
    }
    const sign = profit >= 0 ? "+" : "";
    return `${sign}$${profit.toFixed(2)}`;
  };
  const renderDirectionPill = (direction: OpenTrade["tradeType"]) => (
    <span
      className={cn(
        TRADE_IDENTIFIER_PILL_CLASS,
        "pointer-events-none h-6 min-h-6 gap-1.5 px-2 pr-1.5 text-[10px]",
        getTradeDirectionTone(direction)
      )}
    >
      {direction === "long" ? "Long" : "Short"}
      {direction === "long" ? (
        <ArrowUpRight className="size-3 stroke-[2.6]" />
      ) : (
        <ArrowDownRight className="size-3 stroke-[2.6]" />
      )}
    </span>
  );

  return (
    <DashboardWidgetFrame
      title="Open trades"
      icon={<Activity className="size-3.5 text-white/40" />}
      isEditing={isEditing}
      className={className}
      contentClassName="flex-col h-full w-full"
      headerRight={
        <div className="flex items-center gap-2">
          {!isEditing && (
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "size-1.5 rounded-full transition-all duration-300",
                  isLive
                    ? "bg-teal-400 shadow-[0_0_8px_2px_rgba(45,212,191,0.4)]"
                    : "bg-teal-400/40"
                )}
              />
              <span className="text-[10px] text-white/30">LIVE</span>
            </div>
          )}

          {!isEditing && trades.length > pageSize && (
            <div className="flex items-center gap-2 border border-white/5">
              <Button
                className="text-xs text-white/50 hover:text-white disabled:opacity-40 border-r border-white/5 rounded-sm px-2 py-1 bg-transparent hover:bg-sidebar-accent hover:brightness-120"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="size-3.5" />
              </Button>

              <span className="text-[10px] text-white/40 px-1">
                {page + 1}/{pageCount}
              </span>

              <Button
                className="text-xs text-white/50 hover:text-white disabled:opacity-40 border-l border-white/5 rounded-sm py-1 bg-transparent hover:bg-sidebar-accent hover:brightness-120"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      }
    >
      <div className="flex h-full flex-col overflow-y-auto">
        {loading ? (
          <div className="divide-y divide-white/6">
            {Array.from({ length: pageSize }).map((_, i) => (
              <div key={`ot-skel-${i}`} className="space-y-3 px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-28 rounded-sm bg-sidebar" />
                  <Skeleton className="h-4 w-16 rounded-sm bg-sidebar" />
                </div>
                <Skeleton className="h-3 w-full rounded-sm bg-sidebar" />
              </div>
            ))}
          </div>
        ) : pageItems.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-xs text-white/40">
            No open trades
          </div>
        ) : (
          <>
            {pageItems.map((trade, index) => {
              const isProfit = trade.profit >= 0;
              return (
                <React.Fragment key={trade.id}>
                  <div
                    className={cn(
                      "flex flex-col gap-2.5 px-4 py-3.5",
                      index > 0 && "border-t border-white/8"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="truncate text-xs font-medium text-white/85">
                          {trade.symbol}
                        </span>
                        {renderDirectionPill(trade.tradeType)}
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-xs font-semibold",
                          isProfit ? "text-teal-300" : "text-rose-300"
                        )}
                      >
                        {formatProfit(trade.profit)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 text-[10px] text-white/45">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <span>Vol {trade.volume}</span>
                        <span className="text-white/20">•</span>
                        <span>Entry {formatPrice(trade.openPrice)}</span>
                      </div>
                      <span className="shrink-0">
                        Current {formatPrice(trade.currentPrice ?? trade.openPrice)}
                      </span>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </>
        )}
      </div>
    </DashboardWidgetFrame>
  );
}
