"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DashboardWidgetFrame,
  WIDGET_CONTENT_SEPARATOR_CLASS,
  formatCurrencyValue,
  formatSignedCurrencyValue,
  formatRMultiple,
  getRiskUnitForR,
  toNumber,
  toRValue,
  useAccountStats,
  type WidgetCardProps,
  type WidgetValueCardProps,
} from "../lib/widget-shared";
import {
  buildSessionPerformanceFromTrades,
  buildTradeStreakCalendarFromTrades,
  useDashboardTradeFilters,
} from "@/features/dashboard/filters/dashboard-trade-filters";
import { cn } from "@/lib/utils";
import { trpcOptions } from "@/utils/trpc";
import {
  getTradeDirectionTone,
  TRADE_IDENTIFIER_PILL_CLASS,
} from "@/components/trades/trade-identifier-pill";

type ExecutionGrade = "A" | "B" | "C" | "D" | "F" | "N/A";

export function ExecutionScorecardCard({
  accountId,
  isEditing = false,
  className,
}: WidgetCardProps) {
  const { data, isLoading } = useQuery({
    ...trpcOptions.accounts.executionStats.queryOptions({
      accountId: accountId || "",
    }),
    enabled: !!accountId,
    staleTime: 60000,
  });

  const avgEntrySpread = toNumber(data?.avgEntrySpread);
  const avgExitSpread = toNumber(data?.avgExitSpread);
  const avgEntrySlippage = toNumber(data?.avgEntrySlippage);
  const avgExitSlippage = toNumber(data?.avgExitSlippage);
  const totalSlMods = toNumber(data?.totalSlModifications);
  const totalTpMods = toNumber(data?.totalTpModifications);
  const tradesWithExecData = toNumber(data?.tradesWithExecutionData);
  const hasExecutionMetrics =
    data?.avgEntrySpread != null ||
    data?.avgExitSpread != null ||
    data?.avgEntrySlippage != null ||
    data?.avgExitSlippage != null ||
    data?.avgRrCaptureEfficiency != null ||
    data?.avgExitEfficiency != null;
  const grade = (data?.grade ?? "N/A") as ExecutionGrade;

  const gradeColor = useMemo(() => {
    switch (grade) {
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
  }, [grade]);

  return (
    <DashboardWidgetFrame
      title="Execution scorecard"
      icon={
        <Activity className="size-4 stroke-white/50 transition-all duration-250 group-hover:stroke-white" />
      }
      isEditing={isEditing}
      className={className}
      contentClassName="flex h-full min-h-0 w-full flex-col"
      shareHeaderRightInExport
      headerRight={
        data ? (
          <span className={`text-2xl font-bold ${gradeColor}`}>{grade}</span>
        ) : null
      }
    >
      {isLoading ? (
        <div className="flex flex-col gap-2 p-3.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-4 w-full rounded-sm bg-sidebar"
            />
          ))}
        </div>
      ) : !data || tradesWithExecData === 0 || !hasExecutionMetrics ? (
        <div className="flex h-full items-center justify-center text-center text-xs text-white/40">
          No execution data available.
          <br />
          Grade: {grade}
          <br />
          Connect an EA for detailed metrics.
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col overflow-y-auto text-xs">
          {[
            {
              label: "Average entry spread",
              value:
                data.avgEntrySpread != null
                  ? `${avgEntrySpread.toFixed(2)} pips`
                  : "—",
              valueClassName: "text-white font-medium",
            },
            {
              label: "Average exit spread",
              value:
                data.avgExitSpread != null
                  ? `${avgExitSpread.toFixed(2)} pips`
                  : "—",
              valueClassName: "text-white font-medium",
            },
            {
              label: "Average entry slippage",
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
              label: "Average exit slippage",
              value:
                data.avgExitSlippage != null
                  ? `${avgExitSlippage.toFixed(2)} pips`
                  : "—",
              valueClassName:
                avgExitSlippage > 0.5
                  ? "font-medium text-rose-400"
                  : "font-medium text-teal-400",
            },
            {
              label: "Stop loss modifications",
              value: `${totalSlMods}`,
              valueClassName: "font-medium text-white",
            },
            {
              label: "Take profit modifications",
              value: `${totalTpMods}`,
              valueClassName: "font-medium text-white",
            },
          ].map((row, index) => (
            <Fragment key={row.label}>
              {index > 0 && <Separator />}
              <div className="flex flex-1 items-center justify-between gap-3 px-3.5">
                <span className="text-white/50">{row.label}</span>
                <span className={row.valueClassName}>{row.value}</span>
              </div>
            </Fragment>
          ))}
        </div>
      )}
    </DashboardWidgetFrame>
  );
}

export function MoneyLeftOnTableCard({
  accountId,
  isEditing = false,
  className,
  currencyCode,
}: WidgetCardProps) {
  const { data, isLoading } = useQuery({
    ...trpcOptions.accounts.moneyLeftOnTable.queryOptions({
      accountId: accountId || "",
    }),
    enabled: !!accountId,
    staleTime: 60000,
  });

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
        <TrendingDown className="size-4 stroke-white/50 transition-all duration-250 group-hover:stroke-white" />
      }
      isEditing={isEditing}
      className={className}
      contentClassName="flex h-full min-h-0 w-full flex-col"
    >
      {isLoading ? (
        <div className="flex flex-col gap-2 p-3.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-4 w-full rounded-sm bg-sidebar"
            />
          ))}
        </div>
      ) : !data || tradesWithPeakData === 0 ? (
        <div className="flex h-full items-center justify-center text-center text-xs text-white/40">
          No peak price data available.
          <br />
          Connect an EA with manipulation tracking.
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col overflow-y-auto text-xs">
          {[
            {
              label: "Total missed",
              value: formatSignedCurrencyValue(totalMissed, currencyCode, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }),
              valueClassName: "text-lg font-bold text-rose-400",
            },
            {
              label: "During trade",
              value: formatSignedCurrencyValue(
                totalMissedDuringTrade,
                currencyCode,
                { minimumFractionDigits: 0, maximumFractionDigits: 0 }
              ),
              valueClassName: "font-medium text-rose-400",
            },
            {
              label: "After exit",
              value: formatSignedCurrencyValue(
                totalMissedAfterExit,
                currencyCode,
                { minimumFractionDigits: 0, maximumFractionDigits: 0 }
              ),
              valueClassName: "font-medium text-rose-400",
            },
            {
              label: "Actual profit",
              value: formatSignedCurrencyValue(actualProfit, currencyCode, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }),
              valueClassName: cn(
                "font-medium",
                actualProfit >= 0 ? "text-teal-400" : "text-rose-400"
              ),
            },
            {
              label: "Capture ratio",
              value: `${captureRatio.toFixed(1)}%`,
              valueClassName: cn(
                "font-bold",
                captureRatio >= 70
                  ? "text-teal-400"
                  : captureRatio >= 50
                  ? "text-yellow-400"
                  : "text-rose-400"
              ),
            },
          ].map((row, index) => (
            <Fragment key={row.label}>
              {index > 0 && <Separator />}
              <div className="flex flex-1 items-center justify-between gap-3 px-3.5">
                <span className="text-white/50">{row.label}</span>
                <span className={row.valueClassName}>{row.value}</span>
              </div>
            </Fragment>
          ))}
        </div>
      )}
    </DashboardWidgetFrame>
  );
}

export function SessionPerformanceCard({
  accountId,
  isEditing = false,
  className,
  currencyCode,
}: WidgetCardProps) {
  const dashboardTradeFilters = useDashboardTradeFilters();
  const { data, isLoading } = useQuery({
    ...trpcOptions.trades.listInfinite.queryOptions({
      accountId: accountId || "",
      limit: 200,
    }),
    enabled: !!accountId,
    staleTime: 60000,
  });

  const sessionStats = useMemo(() => {
    if (
      dashboardTradeFilters?.hasActiveFilters &&
      dashboardTradeFilters.accountId === accountId
    ) {
      return buildSessionPerformanceFromTrades(
        dashboardTradeFilters.filteredTrades
      );
    }

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
      const session =
        hour >= 0 && hour < 8
          ? "Asian"
          : hour >= 8 && hour < 16
          ? "London"
          : "New York";

      const profit = toNumber(trade.profit);
      sessions[session].trades += 1;
      sessions[session].profit += profit;
      if (profit > 0) sessions[session].wins += 1;
    });

    return Object.entries(sessions).map(([name, stats]) => ({
      name,
      trades: stats.trades,
      profit: stats.profit,
      winRate: stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0,
    }));
  }, [accountId, dashboardTradeFilters, data]);

  const maxTrades = Math.max(
    ...(sessionStats?.map((session) => session.trades) || [1]),
    1
  );

  return (
    <DashboardWidgetFrame
      title="Session performance"
      icon={
        <Activity className="size-4 stroke-white/50 transition-all duration-250 group-hover:stroke-white" />
      }
      isEditing={isEditing}
      className={className}
      contentClassName="flex h-full w-full flex-col p-3.5"
    >
      {isLoading && !dashboardTradeFilters?.hasActiveFilters ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-10 w-full rounded-sm bg-sidebar"
            />
          ))}
        </div>
      ) : !sessionStats ? (
        <div className="flex h-full items-center justify-center text-center text-xs text-white/40">
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
                        session.profit >= 0 ? "text-teal-400" : "text-rose-400"
                      )}
                    >
                      {formatSignedCurrencyValue(session.profit, currencyCode, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
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
                  <TooltipContent
                    side="top"
                    sideOffset={8}
                    className="px-0 py-2"
                  >
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
                          {formatSignedCurrencyValue(
                            session.profit,
                            currencyCode,
                            {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            }
                          )}
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
                      session.winRate >= 50 ? "text-teal-400" : "text-rose-400"
                    )}
                  >
                    {session.winRate.toFixed(0)}%
                  </div>
                  <div className="text-[9px] text-white/40">{session.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </DashboardWidgetFrame>
  );
}

export function TradeStreakCalendarCard({
  accountId,
  isEditing = false,
  className,
  currencyCode,
}: WidgetCardProps) {
  const dashboardTradeFilters = useDashboardTradeFilters();
  const { data, isLoading } = useQuery({
    ...trpcOptions.trades.listInfinite.queryOptions({
      accountId: accountId || "",
      limit: 200,
    }),
    enabled: !!accountId,
    staleTime: 60000,
  });

  const streakData = useMemo(() => {
    if (
      dashboardTradeFilters?.hasActiveFilters &&
      dashboardTradeFilters.accountId === accountId
    ) {
      return buildTradeStreakCalendarFromTrades(
        dashboardTradeFilters.filteredTrades
      );
    }

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
      tradesByDate[date].count += 1;
    });

    const sortedDates = Object.keys(tradesByDate).sort();
    let maxWinStreak = 0;
    let maxLoseStreak = 0;
    let tempWinStreak = 0;
    let tempLoseStreak = 0;

    sortedDates.forEach((date) => {
      const dayProfit = tradesByDate[date].profit;
      if (dayProfit >= 0) {
        tempWinStreak += 1;
        tempLoseStreak = 0;
        maxWinStreak = Math.max(maxWinStreak, tempWinStreak);
      } else {
        tempLoseStreak += 1;
        tempWinStreak = 0;
        maxLoseStreak = Math.max(maxLoseStreak, tempLoseStreak);
      }
    });

    const last30Days: { date: string; profit: number; count: number }[] = [];
    const today = new Date();
    for (let index = 29; index >= 0; index -= 1) {
      const date = new Date(today);
      date.setDate(date.getDate() - index);
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
      totalGreenDays: last30Days.filter((day) => day.profit > 0).length,
      totalRedDays: last30Days.filter((day) => day.profit < 0).length,
    };
  }, [accountId, dashboardTradeFilters, data]);

  return (
    <DashboardWidgetFrame
      title="Daily streak calendar"
      icon={
        <Activity className="size-4 stroke-white/50 transition-all duration-250 group-hover:stroke-white" />
      }
      isEditing={isEditing}
      className={className}
      contentClassName="flex h-full w-full flex-col p-3.5"
    >
      {isLoading && !dashboardTradeFilters?.hasActiveFilters ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full rounded-sm bg-sidebar" />
          <Skeleton className="h-8 w-full rounded-sm bg-sidebar" />
        </div>
      ) : !streakData ? (
        <div className="flex h-full items-center justify-center text-center text-xs text-white/40">
          No trade data available.
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="mb-2 grid grid-cols-10 gap-[3px]">
            {streakData.calendar.map((day, index) => {
              const cell = (
                <div
                  key={index}
                  className={cn(
                    "h-9 rounded-[2px]",
                    day.count === 0 && "bg-white/5",
                    day.profit > 0 && "bg-teal-500/60",
                    day.profit < 0 && "bg-rose-500/60",
                    day.profit === 0 && day.count > 0 && "bg-white/20"
                  )}
                />
              );

              if (day.count === 0) return cell;

              return (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>{cell}</TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={6}
                    className="px-0 py-2"
                  >
                    <div className="flex min-w-[130px] flex-col gap-1.5 px-3">
                      <span className="text-[10px] text-white/50">
                        {new Date(day.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[11px] text-white/60">P&L</span>
                        <span
                          className={cn(
                            "text-[11px] font-medium",
                            day.profit > 0
                              ? "text-teal-400"
                              : day.profit < 0
                              ? "text-rose-400"
                              : "text-white/60"
                          )}
                        >
                          {formatSignedCurrencyValue(day.profit, currencyCode, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[11px] text-white/60">
                          Trades
                        </span>
                        <span className="text-[11px] font-medium text-white/80">
                          {day.count}
                        </span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          <div className="mb-2 grid grid-cols-4 gap-1 text-center">
            <div>
              <div className="text-sm font-bold text-teal-400">
                {streakData.maxWinStreak}
              </div>
              <div className="text-[9px] leading-tight text-white/40">
                Win streak
              </div>
            </div>
            <div>
              <div className="text-sm font-bold text-rose-400">
                {streakData.maxLoseStreak}
              </div>
              <div className="text-[9px] leading-tight text-white/40">
                Lose streak
              </div>
            </div>
            <div>
              <div className="text-sm font-bold text-teal-400">
                {streakData.totalGreenDays}
              </div>
              <div className="text-[9px] leading-tight text-white/40">
                Green days
              </div>
            </div>
            <div>
              <div className="text-sm font-bold text-rose-400">
                {streakData.totalRedDays}
              </div>
              <div className="text-[9px] leading-tight text-white/40">
                Red days
              </div>
            </div>
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-center gap-3 text-[10px] text-white/40">
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-[2px] bg-teal-500/60" />
              <span>Profitable</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-[2px] bg-rose-500/60" />
              <span>Loss</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-[2px] bg-white/5" />
              <span>No trades</span>
            </div>
          </div>
        </div>
      )}
    </DashboardWidgetFrame>
  );
}

export function OpenTradesWidget({
  accountId,
  isEditing = false,
  valueMode = "usd",
  currencyCode,
  className,
}: WidgetValueCardProps) {
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
  const { data: statsData } = useAccountStats(accountId);
  const riskUnit = getRiskUnitForR(statsData);

  const { data: liveMetrics } = useQuery({
    ...trpcOptions.accounts.liveMetrics.queryOptions({
      accountId: accountId || "",
    }),
    enabled: !!accountId,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    staleTime: 4000,
  });

  useEffect(() => {
    if (!(liveMetrics as any)?.openTrades) return;

    setTrades((liveMetrics as any).openTrades);
    setInitialBalance(toNumber((liveMetrics as any).initialBalance || 0));
    setIsLive(true);
    setLoading(false);
    const timeoutId = window.setTimeout(() => setIsLive(false), 300);
    return () => window.clearTimeout(timeoutId);
  }, [liveMetrics]);

  useEffect(() => setPage(0), [trades]);

  const pageCount = Math.max(1, Math.ceil(trades.length / pageSize));
  const pageItems = useMemo(
    () => trades.slice(page * pageSize, page * pageSize + pageSize),
    [page, trades]
  );
  const pageSlots = useMemo(
    () =>
      Array.from(
        { length: pageSize },
        (_, index) => pageItems[index - (pageSize - pageItems.length)] ?? null
      ),
    [pageItems]
  );

  const formatPrice = (price: number) => price.toFixed(5);
  const formatProfit = (profit: number) => {
    if (valueMode === "percent") {
      if (initialBalance <= 0) return "—";
      const pct = (profit / initialBalance) * 100;
      const sign = pct >= 0 ? "+" : "";
      return `${sign}${Math.abs(pct).toFixed(2)}%`;
    }

    if (valueMode === "rr") {
      const rr = toRValue(profit, riskUnit);
      return rr == null ? "—" : formatRMultiple(rr);
    }

    const formatted = formatCurrencyValue(Math.abs(profit), currencyCode, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${profit >= 0 ? "+" : "-"}${formatted}`;
  };

  const formatSwapValue = (swap: number) =>
    formatSignedCurrencyValue(swap, currencyCode, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      showPositiveSign: true,
    });

  const renderDirectionPill = (direction: OpenTrade["tradeType"]) => (
    <span
      className={cn(
        TRADE_IDENTIFIER_PILL_CLASS,
        "pointer-events-none h-5.5 min-h-5.5 gap-1 px-2 pr-1.5 text-[10px]",
        getTradeDirectionTone(direction)
      )}
    >
      {direction === "long" ? "Long" : "Short"}
      {direction === "long" ? (
        <ArrowUpRight className="size-2.5 stroke-[2]" />
      ) : (
        <ArrowDownRight className="size-2.5 stroke-[2]" />
      )}
    </span>
  );

  return (
    <DashboardWidgetFrame
      title="Open trades"
      icon={<Activity className="size-3.5 text-white/40" />}
      isEditing={isEditing}
      className={className}
      contentClassName="flex h-full w-full flex-col min-h-0"
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
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex flex-1 flex-col">
            {Array.from({ length: pageSize }).map((_, index) => (
              <Fragment key={`ot-skel-${index}`}>
                <Separator />
                <div className="flex flex-1 items-center justify-between gap-3 px-4">
                  <Skeleton className="h-4 w-28 rounded-sm bg-sidebar" />
                  <Skeleton className="h-4 w-16 rounded-sm bg-sidebar" />
                </div>
              </Fragment>
            ))}
          </div>
        ) : pageItems.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-4 text-xs text-white/40">
            No open trades
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            {pageSlots.map((trade, index) => {
              const netProfit = trade ? trade.profit + trade.swap : 0;
              const isProfit = trade ? netProfit >= 0 : false;
              const hasVisibleTradeBefore = pageSlots
                .slice(0, index)
                .some((slot) => slot != null);
              const isFirstVisibleTrade = !!trade && !hasVisibleTradeBefore;
              const showSeparator =
                !!trade &&
                (hasVisibleTradeBefore ||
                  (isFirstVisibleTrade && pageItems.length < pageSize));
              return (
                <Fragment key={trade?.id ?? `open-trade-empty-${index}`}>
                  {showSeparator ? <Separator /> : null}
                  <div
                    aria-hidden={trade ? undefined : true}
                    className="flex flex-1 items-center justify-between gap-3 px-4"
                  >
                    {trade ? (
                      <>
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="truncate text-xs font-medium text-white/85">
                            {trade.symbol}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span
                            className={cn(
                              "text-xs font-semibold",
                              isProfit ? "text-teal-300" : "text-rose-300"
                            )}
                          >
                            {formatProfit(netProfit)}
                          </span>
                          {Math.abs(trade.swap) > 0.000001 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="flex h-5 min-h-5 items-center justify-center rounded-sm ring ring-white/5 bg-white/[0.03] px-1.5 text-[10px] font-medium text-white/45 transition-colors hover:bg-white/[0.05] hover:text-white/70"
                                  aria-label={`Swap ${formatSwapValue(trade.swap)}`}
                                >
                                  Sw
                                </button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                sideOffset={8}
                                className="px-0 py-2"
                              >
                                <div className="flex min-w-[148px] flex-col gap-1.5 px-3">
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-[11px] text-white/60">
                                      Open P&amp;L
                                    </span>
                                    <span
                                      className={cn(
                                        "text-[11px] font-medium",
                                        trade.profit >= 0
                                          ? "text-teal-400"
                                          : "text-rose-400"
                                      )}
                                    >
                                      {formatProfit(trade.profit)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-[11px] text-white/60">
                                      Swap
                                    </span>
                                    <span
                                      className={cn(
                                        "text-[11px] font-medium",
                                        trade.swap >= 0
                                          ? "text-teal-400"
                                          : "text-[#FCA070]"
                                      )}
                                    >
                                      {formatSwapValue(trade.swap)}
                                    </span>
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : null}
                        </div>
                        {renderDirectionPill(trade.tradeType)}
                      </>
                    ) : null}
                  </div>
                </Fragment>
              );
            })}
          </div>
        )}
      </div>

      {!isEditing && trades.length > pageSize && (
        <>
          <Separator />
          <div className="flex shrink-0 items-center justify-between px-3 py-1.5">
            <Button
              className="h-7 rounded-sm bg-transparent px-2 text-xs text-white/50 hover:bg-sidebar-accent hover:text-white disabled:opacity-40"
              disabled={page === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="text-[10px] text-white/40">
              {page + 1} / {pageCount}
            </span>
            <Button
              className="h-7 rounded-sm bg-transparent px-2 text-xs text-white/50 hover:bg-sidebar-accent hover:text-white disabled:opacity-40"
              disabled={page >= pageCount - 1}
              onClick={() =>
                setPage((value) => Math.min(pageCount - 1, value + 1))
              }
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </>
      )}
    </DashboardWidgetFrame>
  );
}
