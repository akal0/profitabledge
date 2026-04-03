"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { trpcClient, trpcOptions } from "@/utils/trpc";
import { useStatsStore } from "@/stores/stats";
import { ALL_ACCOUNTS_ID } from "@/stores/account";
import { useDashboardTradeFilters } from "@/features/dashboard/filters/dashboard-trade-filters";

import Bank from "@/public/icons/bank.svg";
import CircleInfo from "@/public/icons/circle-info.svg";
import InfinityIcon from "@/public/icons/infinity.svg";
import ProfitFactor from "@/public/icons/profit-factor.svg";
import WinRate from "@/public/icons/winrate.svg";
import WinStreak from "@/public/icons/winstreak.svg";

import {
  chartConfig,
  DashboardWidgetFrame,
  formatCurrencyValue,
  formatRMultiple,
  formatSignedCurrencyValue,
  getNetReturnR,
  getRiskUnitForR,
  toNumber,
  toRValue,
  useAccountStats,
  type WidgetCardProps,
  type WidgetValueCardProps,
} from "../lib/widget-shared";

function useFilteredDateRangeActive(accountId?: string) {
  const dashboardTradeFilters = useDashboardTradeFilters();

  return Boolean(
    accountId &&
      dashboardTradeFilters?.accountId === accountId &&
      (dashboardTradeFilters.filters.startDate ||
        dashboardTradeFilters.filters.endDate)
  );
}

export function AccountBalanceCard({
  accountId,
  isEditing = false,
  valueMode = "usd",
  currencyCode,
  className,
}: WidgetValueCardProps) {
  const hasFilteredDateRange = useFilteredDateRangeActive(accountId);
  const { data } = useAccountStats(accountId);
  const fetchStats = useStatsStore((state) => state.fetchStats);
  const [editingBaseline, setEditingBaseline] = useState(false);
  const [baselineInput, setBaselineInput] = useState("");
  const { data: liveMetrics } = useQuery({
    ...trpcOptions.accounts.liveMetrics.queryOptions({
      accountId: accountId || "",
      currencyCode: accountId === ALL_ACCOUNTS_ID ? currencyCode : undefined,
    }),
    enabled: !!accountId,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    staleTime: 4000,
  });

  const isVerified =
    (liveMetrics as any)?.isVerified ?? data?.isVerified ?? false;
  const liveBalanceRaw =
    (liveMetrics as any)?.liveBalance ?? data?.liveBalance ?? null;
  const brokerType =
    (liveMetrics as any)?.brokerType ?? data?.brokerType ?? null;
  const initialBalance = toNumber(
    (liveMetrics as any)?.initialBalance ?? data?.initialBalance ?? 0
  );
  const totalProfit = toNumber(data?.totalProfit ?? 0);
  const closedBalance =
    !hasFilteredDateRange && data?.accountBalance != null
      ? toNumber(data.accountBalance)
      : initialBalance + totalProfit;
  const balance =
    liveBalanceRaw != null ? toNumber(liveBalanceRaw) : closedBalance;
  const isUsingLiveBalance = isVerified && liveBalanceRaw != null;

  const hasBaseline = initialBalance > 0;
  const returnPct = hasBaseline
    ? ((balance - initialBalance) / initialBalance) * 100
    : 0;
  const netReturnR = getNetReturnR(data);

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
        <Bank className="size-4 fill-sidebar stroke-white/50 transition-all duration-250 group-hover:stroke-white" />
      }
      isEditing={isEditing}
      className={className}
      headerRight={
        !isEditing && editingBaseline ? (
          <>
            <Input
              value={baselineInput}
              onChange={(event) => setBaselineInput(event.target.value)}
              type="number"
              step="0.01"
              min="0"
              className="h-7 w-28 rounded-sm border-white/5 bg-sidebar-accent text-xs text-white"
            />
            <Button
              size="sm"
              className="h-7 rounded-sm bg-sidebar-accent text-xs text-white"
              onClick={handleBaselineSave}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-sm border-white/5 text-xs text-white/70"
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
            className="h-7 rounded-sm ring-white/5! bg-transparent! text-xs text-white/70"
            onClick={() => setEditingBaseline(true)}
          >
            Edit baseline
          </Button>
        ) : null
      }
    >
      <div className="flex h-full flex-col justify-end gap-1 p-3.5">
        {(() => {
          const displayValue =
            valueMode === "percent"
              ? returnPct
              : valueMode === "rr"
              ? netReturnR ?? 0
              : balance;
          const isNeg = hasBaseline && returnPct < 0;
          return (
            <h1
              className={cn(
                "text-2xl font-medium",
                isNeg ? "text-rose-400" : "text-teal-400"
              )}
            >
              <AnimatedNumber
                value={displayValue}
                format={(value) => {
                  if (valueMode === "percent") {
                    if (!hasBaseline) return "—";
                    const sign = value >= 0 ? "+" : "-";
                    return `${sign}${Math.abs(value).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}%`;
                  }
                  if (valueMode === "rr") {
                    return netReturnR == null ? "—" : formatRMultiple(value);
                  }
                  return formatCurrencyValue(value, currencyCode, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  });
                }}
                springOptions={{ bounce: 0, duration: 2000 }}
              />
            </h1>
          );
        })()}

        <p className="text-xs font-medium text-secondary">
          {valueMode === "percent"
            ? hasBaseline
              ? `Baseline: ${formatCurrencyValue(initialBalance, currencyCode, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}`
              : "Return vs initial balance"
            : valueMode === "rr"
            ? "1R = 1% of the baseline balance"
            : isUsingLiveBalance
            ? brokerType === "mt5" || brokerType === "mt4"
              ? `Live balance from ${brokerType.toUpperCase()} terminal`
              : "Live balance from Profitabledge"
            : hasFilteredDateRange
            ? "Baseline plus the closed P&L from your selected days"
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
  currencyCode,
  className,
}: WidgetValueCardProps) {
  const [isLive, setIsLive] = useState(false);
  const { data } = useAccountStats(accountId);

  const { data: liveMetrics } = useQuery({
    ...trpcOptions.accounts.liveMetrics.queryOptions({
      accountId: accountId || "",
      currencyCode: accountId === ALL_ACCOUNTS_ID ? currencyCode : undefined,
    }),
    enabled: !!accountId,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    staleTime: 4000,
  });

  useEffect(() => {
    if (!liveMetrics) return;

    setIsLive(true);
    const timeoutId = window.setTimeout(() => setIsLive(false), 300);
    return () => window.clearTimeout(timeoutId);
  }, [liveMetrics]);

  const isVerified =
    (liveMetrics as any)?.isVerified ?? data?.isVerified ?? false;
  const liveEquityRaw =
    (liveMetrics as any)?.liveEquity ?? data?.liveEquity ?? null;
  const liveBalanceRaw =
    (liveMetrics as any)?.liveBalance ?? data?.liveBalance ?? null;
  const totalFloatingPL = Number((liveMetrics as any)?.totalFloatingPL ?? 0);
  const openTradesCount = (liveMetrics as any)?.openTradesCount ?? 0;
  const initialBalance = toNumber(
    (liveMetrics as any)?.initialBalance ?? data?.initialBalance ?? 0
  );
  const closedBalance =
    data?.accountBalance != null ? toNumber(data.accountBalance) : null;
  const baseBalance =
    liveBalanceRaw != null ? toNumber(liveBalanceRaw) : closedBalance;
  const derivedEquity =
    baseBalance != null ? baseBalance + totalFloatingPL : null;
  const displayedEquity =
    liveEquityRaw != null ? toNumber(liveEquityRaw) : derivedEquity;
  const hasBaseline = initialBalance > 0;
  const equityReturnPct = hasBaseline
    ? displayedEquity != null
      ? ((displayedEquity - initialBalance) / initialBalance) * 100
      : null
    : null;
  const floatingReturnPct = hasBaseline
    ? (Number(totalFloatingPL || 0) / initialBalance) * 100
    : 0;
  const netReturnR = getNetReturnR(data);
  const riskUnit = getRiskUnitForR(data);
  const floatingR = toRValue(Number(totalFloatingPL || 0), riskUnit);
  const equityR =
    netReturnR != null ? netReturnR + (floatingR ?? 0) : floatingR;

  if (!isVerified && !isEditing && (liveMetrics || data)) {
    return null;
  }

  return (
    <DashboardWidgetFrame
      title="Account equity"
      icon={
        <Bank className="size-4 fill-sidebar stroke-white/50 transition-all duration-250 group-hover:stroke-white" />
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
      <div className="flex h-full flex-col justify-end gap-1 p-3.5">
        {(() => {
          const displayValue =
            valueMode === "percent"
              ? equityReturnPct ?? 0
              : valueMode === "rr"
              ? equityR ?? 0
              : displayedEquity ?? 0;
          const isNeg = displayValue < 0;
          return (
            <h1
              className={cn(
                "text-2xl font-medium",
                isNeg ? "text-rose-400" : "text-teal-400"
              )}
            >
              <AnimatedNumber
                value={displayValue}
                format={(value) => {
                  if (valueMode === "percent") {
                    if (!hasBaseline || equityReturnPct == null) return "—";
                    const sign = value >= 0 ? "+" : "-";
                    return `${sign}${Math.abs(value).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}%`;
                  }
                  if (valueMode === "rr") {
                    return equityR == null ? "—" : formatRMultiple(value);
                  }
                  if (displayedEquity == null) return "—";
                  const sign = value < 0 ? "-" : "";
                  return `${sign}${formatCurrencyValue(
                    Math.abs(value),
                    currencyCode,
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}`;
                }}
                springOptions={{ bounce: 0, duration: 2000 }}
              />
            </h1>
          );
        })()}

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
                : valueMode === "rr"
                ? floatingR == null
                  ? "—"
                  : formatRMultiple(floatingR)
                : formatSignedCurrencyValue(totalFloatingPL, currencyCode, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
            </span>
          </div>
          {valueMode === "percent" && hasBaseline ? (
            <span className="text-xs text-white/40">
              Baseline:{" "}
              {formatCurrencyValue(initialBalance, currencyCode, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </span>
          ) : valueMode === "rr" ? (
            <span className="text-xs text-white/40">
              Floating P&amp;L translated using 1R = 1% of baseline
            </span>
          ) : null}
        </div>
      </div>
    </DashboardWidgetFrame>
  );
}

export function WinRateCard({
  accountId,
  isEditing = false,
  className,
}: WidgetCardProps) {
  const hasFilteredDateRange = useFilteredDateRangeActive(accountId);
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
        wins,
        losses,
        breakeven,
      },
    ],
    [breakeven, losses, wins]
  );

  return (
    <DashboardWidgetFrame
      title="Win rate"
      icon={
        <WinRate className="size-4 fill-white/50 transition-all duration-250 group-hover:fill-white" />
      }
      isEditing={isEditing}
      className={className}
    >
      {hasNoTrades ? (
        <div className="flex h-full flex-col justify-end gap-1 p-3.5">
          <h1 className="text-2xl font-medium text-white/40">—</h1>
          <p className="text-xs font-medium text-secondary">
            No closed trades yet
          </p>
        </div>
      ) : (
        <div className="flex h-full w-full justify-between">
          <h1 className="flex h-full flex-col justify-end p-3.5 text-xs font-medium text-secondary">
            <span className="text-2xl font-medium text-teal-400">
              <AnimatedNumber
                value={winrate}
                format={(value) =>
                  value.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })
                }
                springOptions={{ bounce: 0, duration: 2000 }}
              />
              %
            </span>{" "}
            {hasFilteredDateRange ? "Selected days win rate" : "All-time win rate"}
          </h1>

          {mounted ? (
            <ChartContainer
              config={chartConfig}
              className="h-[100%] w-[150px] place-self-end"
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
                <Bar dataKey="wins" fill="var(--color-wins)" barSize={12} />
                <Bar dataKey="losses" fill="var(--color-losses)" barSize={12} />
                <Bar
                  dataKey="breakeven"
                  fill="var(--color-breakeven)"
                  barSize={12}
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="h-[120px] w-[120px]" />
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
  currencyCode,
}: WidgetCardProps) {
  const { data } = useAccountStats(accountId);
  const streak = Math.round(Math.min(5, data?.winStreak ?? 0));
  const rawOutcomes = data?.recentOutcomes ?? [];
  const hasNoTrades = rawOutcomes.length === 0;
  const outcomes: ("W" | "L")[] = [...rawOutcomes].slice(0, 5);
  const recentTrades = (data as any)?.recentTrades ?? [];

  return (
    <DashboardWidgetFrame
      title="Win streak"
      icon={
        <WinStreak className="size-4 fill-white/50 transition-all duration-250 group-hover:fill-white" />
      }
      isEditing={isEditing}
      className={className}
      contentClassName="flex-col justify-end"
    >
      <div className="flex h-full flex-col justify-end gap-1.5 p-3.5">
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
                format={(value) =>
                  value.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })
                }
                springOptions={{ bounce: 0, duration: 2000 }}
              />{" "}
              {streak === 1 ? "win" : "wins"}
            </h1>

            <div className="flex w-max items-center gap-1.5">
              {outcomes.map((outcome, index) => {
                const trade = recentTrades[index];
                const pill = (
                  <div
                    className={cn(
                      "rounded-xs px-2 py-1 cursor-default",
                      outcome === "W" ? "bg-teal-500" : "bg-rose-500"
                    )}
                  >
                    <h1 className="text-xs font-medium text-white">
                      {outcome}
                    </h1>
                  </div>
                );

                if (!trade)
                  return <div key={`${outcome}-${index}`}>{pill}</div>;

                const closedAt = trade.closeTime
                  ? new Date(trade.closeTime)
                  : null;
                const closedLabel = closedAt
                  ? closedAt.toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : null;

                return (
                  <Tooltip key={`${outcome}-${index}`}>
                    <TooltipTrigger asChild>{pill}</TooltipTrigger>
                    <TooltipContent
                      side="top"
                      sideOffset={8}
                      className="px-0 py-2"
                    >
                      <div className="flex min-w-[150px] flex-col">
                        <div className="flex items-center justify-between px-3 text-[11px] text-white/60">
                          <span>{closedLabel ?? "—"}</span>
                          <span
                            className={cn(
                              "font-medium",
                              trade.profit >= 0
                                ? "text-teal-400"
                                : "text-rose-400"
                            )}
                          >
                            {formatSignedCurrencyValue(
                              trade.profit,
                              currencyCode,
                              {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              }
                            )}
                          </span>
                        </div>
                        <Separator className="mt-2 w-full" />
                        <div className="flex items-center justify-between px-3 pt-2 text-[11px]">
                          <span className="text-white/50">
                            {trade.symbol ?? "—"}
                          </span>
                          <span className="capitalize text-white/70">
                            {trade.tradeType ?? ""}
                          </span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
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
}: WidgetCardProps) {
  const hasFilteredDateRange = useFilteredDateRangeActive(accountId);
  const { data } = useAccountStats(accountId);
  const wins = Number(data?.wins ?? 0);
  const losses = Number(data?.losses ?? 0);
  const hasNoTrades = wins + losses === 0;
  const profitFactor = data?.profitFactor ?? null;
  const roundedProfitFactor =
    profitFactor !== null ? Number(profitFactor.toFixed(2)) : null;

  return (
    <DashboardWidgetFrame
      title="Profit factor"
      icon={
        <ProfitFactor className="size-4 fill-white/50 transition-all duration-250 group-hover:fill-white" />
      }
      isEditing={isEditing}
      className={className}
    >
      <div className="flex h-full flex-col justify-end p-3.5">
        {hasNoTrades ? (
          <>
            <h1 className="text-2xl font-medium text-white/40">—</h1>
            <p className="text-xs font-medium text-secondary">
              No closed trades yet
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-medium text-teal-400">
              <AnimatedNumber
                value={roundedProfitFactor ?? 999}
                format={(value) =>
                  value.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })
                }
                springOptions={{ bounce: 0, duration: 2000 }}
              />
            </h1>

            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-secondary">
                {hasFilteredDateRange
                  ? "Selected days profit factor"
                  : "All time profit factor"}
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
  currencyCode,
  className,
}: WidgetValueCardProps) {
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
  const avgLoss = losses > 0 ? grossLoss / losses : 0;
  const winPct = total > 0 ? wins / total : 0;
  const lossPct = total > 0 ? losses / total : 0;
  const expectancy = winPct * avgWin - lossPct * avgLoss;
  const expectancyPct = hasBaseline ? (expectancy / initialBalance) * 100 : 0;
  const riskUnit = getRiskUnitForR(data);
  const expectancyR = toRValue(expectancy, riskUnit);
  const isNegative = expectancy < 0;

  return (
    <DashboardWidgetFrame
      title="Profit expectancy"
      icon={
        <CircleInfo className="size-4 fill-white/50 transition-all duration-250 group-hover:fill-white" />
      }
      isEditing={isEditing}
      className={className}
    >
      <div className="flex h-full flex-col justify-end p-3.5">
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
                value={
                  valueMode === "percent"
                    ? expectancyPct
                    : valueMode === "rr"
                    ? expectancyR ?? 0
                    : expectancy
                }
                format={(value) => {
                  if (valueMode === "percent") {
                    if (!hasBaseline) return "—";
                    const sign = value < 0 ? "-" : "+";
                    return `${sign}${Math.abs(value).toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}%`;
                  }

                  if (valueMode === "rr") {
                    return expectancyR == null ? "—" : formatRMultiple(value);
                  }

                  return formatSignedCurrencyValue(value, currencyCode, {
                    maximumFractionDigits: 2,
                  });
                }}
                springOptions={{ bounce: 0, duration: 1200 }}
              />
            </h1>

            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-secondary">
                {valueMode === "rr"
                  ? "Average realised expectancy per trade with 1R = 1% of baseline"
                  : "The profit expectancy is the - ( Win % × Avg Win ) – ( Loss % × Avg Loss )"}
              </p>
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
}: WidgetCardProps) {
  const hasFilteredDateRange = useFilteredDateRangeActive(accountId);
  const { data } = useAccountStats(accountId);
  const wins = Number(data?.wins ?? 0);
  const losses = Number(data?.losses ?? 0);
  const hasNoTrades = wins + losses === 0;
  const avgSec = Number(data?.averageHoldSeconds ?? 0);

  const formatHMS = (seconds: number) => {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remainingSeconds = Math.floor(total % 60);
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
    parts.push(`${remainingSeconds}s`);
    return parts.join(" ");
  };

  return (
    <DashboardWidgetFrame
      title="Average hold time"
      icon={
        <Bank className="size-4 fill-sidebar stroke-white/50 transition-all duration-250 group-hover:stroke-white" />
      }
      isEditing={isEditing}
      className={className}
    >
      <div className="flex h-full flex-col justify-end p-3.5">
        {hasNoTrades ? (
          <>
            <h1 className="text-2xl font-medium text-white/40">—</h1>
            <p className="text-xs font-medium text-secondary">
              No closed trades yet
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-medium text-teal-400">
              <AnimatedNumber
                value={avgSec}
                format={formatHMS}
                springOptions={{ bounce: 0, duration: 1200 }}
              />
            </h1>

            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-secondary">
                {hasFilteredDateRange
                  ? "This is your average hold time across the selected days"
                  : "This is your average hold time across all trades"}
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
}: WidgetCardProps) {
  const { data } = useAccountStats(accountId);
  const [riskInput, setRiskInput] = useState("1");
  const [initialBalance, setInitialBalance] = useState<number | null>(null);
  const wins = Number(data?.wins ?? 0);
  const losses = Number(data?.losses ?? 0);
  const hasNoTrades = wins + losses === 0;
  const grossProfit = Number(data?.grossProfit ?? 0);

  useEffect(() => {
    (async () => {
      try {
        const accounts = await trpcClient.accounts.list.query();
        const account = (accounts as any[])?.find?.(
          (item) => item.id === accountId
        );
        const startingBalance =
          account?.initialBalance != null
            ? Number(account.initialBalance)
            : null;
        setInitialBalance(
          Number.isFinite(startingBalance) ? Number(startingBalance) : null
        );
      } catch {
        setInitialBalance(null);
      }
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
        <InfinityIcon className="size-4 fill-white/50 transition-all duration-250 group-hover:fill-white" />
      }
      isEditing={isEditing}
      className={className}
      headerRight={
        !isEditing && !hasNoTrades ? (
          <div className="flex w-full items-center justify-end gap-2">
            <span className="text-xs text-white/50">Risk</span>

            <div className="flex items-center border border-white/5 bg-sidebar-accent pr-2">
              <input
                type="number"
                inputMode="decimal"
                className="no-spinner rounded-sm py-1 pl-2 text-xs outline-none"
                style={{
                  width: `${Math.max(3, (riskStr.length || 1) + 0.5)}ch`,
                }}
                value={riskInput}
                onChange={(event) => setRiskInput(event.target.value)}
                onBlur={() =>
                  setRiskInput((value) => {
                    const nextValue = Math.max(
                      0,
                      Number.parseFloat(value || "0") || 0
                    );
                    return String(nextValue);
                  })
                }
              />
              <span className="text-[11px] text-white/50">%</span>
            </div>
          </div>
        ) : null
      }
    >
      <div className="flex h-full flex-col justify-end p-3.5">
        {hasNoTrades ? (
          <>
            <h1 className="text-2xl font-medium text-white/40">—</h1>
            <p className="text-xs font-medium text-secondary">
              No closed trades yet
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-medium text-teal-400">
              <AnimatedNumber
                value={display}
                format={(value) =>
                  value.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })
                }
                springOptions={{ bounce: 0, duration: 1200 }}
              />
              R
            </h1>
            <div className="flex items-center gap-2">
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
