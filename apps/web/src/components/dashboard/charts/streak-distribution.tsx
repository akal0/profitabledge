"use client";

import React from "react";
import { AnimatePresence } from "motion/react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import {
  countRangeDays,
  formatRangeLabel,
  getComparisonRange,
} from "@/components/dashboard/chart-comparison-utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import {
  useComparisonStore,
  type WidgetComparisonMode,
} from "@/stores/comparison";

import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
} from "./dashboard-chart-ui";
import { useChartDateRange } from "./use-chart-date-range";
import { type ChartTrade, useChartTrades } from "./use-chart-trades";

interface StreakDistributionProps {
  accountId?: string;
  currencyCode?: string | null;
  ownerId?: string;
  comparisonMode?: WidgetComparisonMode;
}

const chartConfig = {
  wins: {
    label: "Selected win streaks",
    color: "#10b981",
  },
  losses: {
    label: "Selected loss streaks",
    color: "#ef4444",
  },
  compareWins: {
    label: "Comparison win streaks",
    color: "rgba(16, 185, 129, 0.4)",
  },
  compareLosses: {
    label: "Comparison loss streaks",
    color: "rgba(239, 68, 68, 0.4)",
  },
} satisfies ChartConfig;

type DistributionCounts = {
  wins: number;
  losses: number;
};

type StreakDistributionResult = {
  distribution: Record<number, DistributionCounts>;
  longestWin: number;
  longestLoss: number;
};

function buildStreakDistribution(trades: ChartTrade[]): StreakDistributionResult {
  if (!trades.length) {
    return {
      distribution: {},
      longestWin: 0,
      longestLoss: 0,
    };
  }

  const streaks: Array<{ winStreak: number; lossStreak: number }> = [];
  let currentWinStreak = 0;
  let currentLossStreak = 0;

  const sortedTrades = [...trades].sort((a, b) => {
    const aTime = a.closeTime ?? a.close ?? a.openTime ?? a.open;
    const bTime = b.closeTime ?? b.close ?? b.openTime ?? b.open;
    return new Date(aTime ?? 0).getTime() - new Date(bTime ?? 0).getTime();
  });

  sortedTrades.forEach((trade) => {
    const profit = Number(trade.profit ?? 0);

    if (profit > 0) {
      currentWinStreak += 1;
      if (currentLossStreak > 0) {
        streaks.push({ winStreak: 0, lossStreak: currentLossStreak });
        currentLossStreak = 0;
      }
      return;
    }

    if (profit < 0) {
      currentLossStreak += 1;
      if (currentWinStreak > 0) {
        streaks.push({ winStreak: currentWinStreak, lossStreak: 0 });
        currentWinStreak = 0;
      }
    }
  });

  if (currentWinStreak > 0) {
    streaks.push({ winStreak: currentWinStreak, lossStreak: 0 });
  }
  if (currentLossStreak > 0) {
    streaks.push({ winStreak: 0, lossStreak: currentLossStreak });
  }

  const distribution: Record<number, DistributionCounts> = {};
  let longestWin = 0;
  let longestLoss = 0;

  streaks.forEach((streak) => {
    if (streak.winStreak > 0) {
      distribution[streak.winStreak] ??= { wins: 0, losses: 0 };
      distribution[streak.winStreak].wins += 1;
      longestWin = Math.max(longestWin, streak.winStreak);
    }

    if (streak.lossStreak > 0) {
      distribution[streak.lossStreak] ??= { wins: 0, losses: 0 };
      distribution[streak.lossStreak].losses += 1;
      longestLoss = Math.max(longestLoss, streak.lossStreak);
    }
  });

  return {
    distribution,
    longestWin,
    longestLoss,
  };
}

function getComparisonLabel(
  mode: WidgetComparisonMode,
  daysSelected: number | null,
  enabled: boolean
) {
  if (!enabled) return undefined;
  if (mode === "thisWeek") return "This week";
  if (mode === "lastWeek") return "Last week";
  if (!daysSelected) return "Previous range";
  if (daysSelected === 1) return "Previous day";
  return `Previous ${daysSelected} days`;
}

export function StreakDistributionChart({
  accountId,
  currencyCode: _currencyCode,
  ownerId = "streak-distribution",
  comparisonMode,
}: StreakDistributionProps) {
  const { start, end, min, max } = useChartDateRange();
  const comparisons = useComparisonStore((state) => state.comparisons);
  const myMode = comparisonMode ?? comparisons[ownerId] ?? "none";

  const resolvedRange = React.useMemo(() => {
    const minDate = min ? new Date(min) : undefined;
    const maxDate = max ? new Date(max) : undefined;
    minDate?.setHours(0, 0, 0, 0);
    maxDate?.setHours(23, 59, 59, 999);

    if (start && end) {
      return { start: new Date(start), end: new Date(end) };
    }

    const fallbackEnd = maxDate ?? new Date();
    const endDate = new Date(fallbackEnd);
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(endDate);
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - 29);
    if (minDate && startDate < minDate) {
      return { start: minDate, end: endDate };
    }
    return { start: startDate, end: endDate };
  }, [end, max, min, start]);

  const rangeOverride = React.useMemo(
    () =>
      resolvedRange
        ? {
            startISO: resolvedRange.start.toISOString(),
            endISO: resolvedRange.end.toISOString(),
          }
        : undefined,
    [resolvedRange]
  );

  const comparisonRange = React.useMemo(() => {
    if (!resolvedRange) return null;
    return getComparisonRange(myMode, resolvedRange, {
      minDate: min,
      maxDate: max,
    });
  }, [max, min, myMode, resolvedRange]);

  const comparisonRangeOverride = React.useMemo(
    () =>
      comparisonRange
        ? {
            startISO: comparisonRange.start.toISOString(),
            endISO: comparisonRange.end.toISOString(),
          }
        : undefined,
    [comparisonRange]
  );

  const { trades, isLoading } = useChartTrades(accountId, rangeOverride);
  const {
    trades: comparisonTrades,
    isLoading: comparisonLoading,
  } = useChartTrades(accountId, comparisonRangeOverride, {
    enabled: Boolean(comparisonRange),
  });

  const [activeIndex, setActiveIndex] = React.useState<number | undefined>(
    undefined
  );
  const [activeDataset, setActiveDataset] = React.useState<
    "wins" | "losses" | "compareWins" | "compareLosses" | undefined
  >(undefined);

  const primaryStats = React.useMemo(
    () => buildStreakDistribution(trades),
    [trades]
  );
  const comparisonStats = React.useMemo(
    () => buildStreakDistribution(comparisonTrades),
    [comparisonTrades]
  );

  const streakLengths = React.useMemo(() => {
    const keys = new Set<number>([
      ...Object.keys(primaryStats.distribution).map(Number),
      ...Object.keys(comparisonStats.distribution).map(Number),
    ]);
    return Array.from(keys).sort((a, b) => a - b);
  }, [comparisonStats.distribution, primaryStats.distribution]);

  const chartData = React.useMemo(
    () =>
      streakLengths.map((streak) => ({
        streak,
        wins: primaryStats.distribution[streak]?.wins ?? 0,
        losses: primaryStats.distribution[streak]?.losses ?? 0,
        compareWins: comparisonStats.distribution[streak]?.wins ?? 0,
        compareLosses: comparisonStats.distribution[streak]?.losses ?? 0,
      })),
    [comparisonStats.distribution, primaryStats.distribution, streakLengths]
  );

  const maxFrequency = React.useMemo(() => {
    if (chartData.length === 0) return 10;
    return Math.max(
      ...chartData.map((item) =>
        Math.max(
          item.wins,
          item.losses,
          item.compareWins,
          item.compareLosses
        )
      )
    );
  }, [chartData]);

  if (isLoading || comparisonLoading) {
    return (
      <Card className="h-full w-full rounded-none border-none bg-transparent shadow-none">
        <CardContent className="flex h-52 items-center justify-center p-0">
          <p className="text-xs text-white/30">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="h-full w-full rounded-none border-none bg-transparent shadow-none">
        <CardContent className="flex h-52 items-center justify-center p-0">
          <p className="text-xs text-white/30">No streak data available</p>
        </CardContent>
      </Card>
    );
  }

  const daysSelected = resolvedRange ? countRangeDays(resolvedRange) : null;
  const primaryRangeLabel = resolvedRange
    ? formatRangeLabel(resolvedRange)
    : "Selected range";
  const comparisonLabel = getComparisonLabel(
    myMode,
    daysSelected,
    Boolean(comparisonRange) && comparisonTrades.length > 0
  );
  const comparisonRangeLabel = comparisonRange
    ? formatRangeLabel(comparisonRange)
    : undefined;
  const comparisonEnabled = Boolean(comparisonLabel && comparisonRangeLabel);
  const primaryWinsLabel = `Win streaks (${primaryRangeLabel})`;
  const primaryLossesLabel = `Loss streaks (${primaryRangeLabel})`;
  const comparisonWinsLabel = comparisonEnabled
    ? `${comparisonLabel} win streaks (${comparisonRangeLabel})`
    : "Comparison win streaks";
  const comparisonLossesLabel = comparisonEnabled
    ? `${comparisonLabel} loss streaks (${comparisonRangeLabel})`
    : "Comparison loss streaks";
  const barSize = comparisonEnabled ? 12 : 24;

  return (
    <Card className="h-full w-full rounded-none border-none bg-transparent shadow-none">
      <CardHeader className="p-0">
        <CardTitle className="flex items-center -mt-3">
          <p className="text-sm font-normal tracking-wide text-white/40">
            Longest win streak:{" "}
            <span className="font-medium text-teal-400">
              {primaryStats.longestWin} trades
            </span>
            {comparisonEnabled ? (
              <>
                {" "}vs{" "}
                <span className="font-medium text-teal-300/70">
                  {comparisonStats.longestWin} trades
                </span>
              </>
            ) : null}
            {" "}· Longest loss streak:{" "}
            <span className="font-medium text-rose-400">
              {primaryStats.longestLoss} trades
            </span>
            {comparisonEnabled ? (
              <>
                {" "}vs{" "}
                <span className="font-medium text-rose-300/70">
                  {comparisonStats.longestLoss} trades
                </span>
              </>
            ) : null}
          </p>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0 overflow-visible">
        <AnimatePresence mode="wait">
          <ChartContainer config={chartConfig} className="h-52 w-full md:h-74">
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: 16,
                right: 0,
                top: 12,
                bottom: -4,
              }}
            >
              <YAxis
                domain={[0, maxFrequency + 2]}
                tickLine={false}
                axisLine={false}
                width={20}
                tickMargin={6}
              />
              <XAxis
                dataKey="streak"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                label={{ value: "", position: "insideBottom" }}
              />
              <Bar
                dataKey="wins"
                fill="var(--color-wins)"
                radius={[0, 0, 0, 0]}
                barSize={barSize}
                name="Win streaks"
              >
                {chartData.map((item, index) => {
                  const isActive =
                    index === activeIndex &&
                    (!activeDataset || activeDataset === "wins");
                  return (
                    <Cell
                      key={`win-${item.streak}`}
                      className="duration-200"
                      opacity={activeIndex == null || isActive ? 1 : 0.2}
                      fill={isActive ? "#2dd4bf" : "var(--color-wins)"}
                      onMouseEnter={() => {
                        setActiveIndex(index);
                        setActiveDataset("wins");
                      }}
                      onMouseLeave={() => {
                        setActiveIndex(undefined);
                        setActiveDataset(undefined);
                      }}
                    />
                  );
                })}
              </Bar>
              <Bar
                dataKey="losses"
                fill="var(--color-losses)"
                radius={[0, 0, 0, 0]}
                barSize={barSize}
                name="Loss streaks"
              >
                {chartData.map((item, index) => {
                  const isActive =
                    index === activeIndex &&
                    (!activeDataset || activeDataset === "losses");
                  return (
                    <Cell
                      key={`loss-${item.streak}`}
                      className="duration-200"
                      opacity={activeIndex == null || isActive ? 1 : 0.2}
                      fill={isActive ? "#fb7185" : "var(--color-losses)"}
                      onMouseEnter={() => {
                        setActiveIndex(index);
                        setActiveDataset("losses");
                      }}
                      onMouseLeave={() => {
                        setActiveIndex(undefined);
                        setActiveDataset(undefined);
                      }}
                    />
                  );
                })}
              </Bar>
              {comparisonEnabled ? (
                <Bar
                  dataKey="compareWins"
                  fill="rgba(16, 185, 129, 0.4)"
                  radius={[0, 0, 0, 0]}
                  barSize={barSize}
                  name="Comparison win streaks"
                >
                  {chartData.map((item, index) => {
                    const isActive =
                      index === activeIndex && activeDataset === "compareWins";
                    return (
                      <Cell
                        key={`compare-win-${item.streak}`}
                        className="duration-200"
                        opacity={activeIndex == null || isActive ? 1 : 0.2}
                        fill={
                          isActive
                            ? "rgba(45, 212, 191, 0.8)"
                            : "rgba(16, 185, 129, 0.38)"
                        }
                        onMouseEnter={() => {
                          setActiveIndex(index);
                          setActiveDataset("compareWins");
                        }}
                        onMouseLeave={() => {
                          setActiveIndex(undefined);
                          setActiveDataset(undefined);
                        }}
                      />
                    );
                  })}
                </Bar>
              ) : null}
              {comparisonEnabled ? (
                <Bar
                  dataKey="compareLosses"
                  fill="rgba(239, 68, 68, 0.4)"
                  radius={[0, 0, 0, 0]}
                  barSize={barSize}
                  name="Comparison loss streaks"
                >
                  {chartData.map((item, index) => {
                    const isActive =
                      index === activeIndex && activeDataset === "compareLosses";
                    return (
                      <Cell
                        key={`compare-loss-${item.streak}`}
                        className="duration-200"
                        opacity={activeIndex == null || isActive ? 1 : 0.2}
                        fill={
                          isActive
                            ? "rgba(251, 113, 133, 0.8)"
                            : "rgba(239, 68, 68, 0.38)"
                        }
                        onMouseEnter={() => {
                          setActiveIndex(index);
                          setActiveDataset("compareLosses");
                        }}
                        onMouseLeave={() => {
                          setActiveIndex(undefined);
                          setActiveDataset(undefined);
                        }}
                      />
                    );
                  })}
                </Bar>
              ) : null}
              <CartesianGrid vertical={false} strokeDasharray="8 8" />
              <ChartTooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <DashboardChartTooltipFrame
                      title={`Streak Length: ${payload[0]?.payload?.streak}`}
                      className="min-w-[12rem]"
                    >
                      {payload.map((item) => {
                        const key = item.dataKey as
                          | "wins"
                          | "losses"
                          | "compareWins"
                          | "compareLosses";
                        const isRowActive = activeDataset
                          ? key === activeDataset
                          : true;
                        const label =
                          key === "wins"
                            ? primaryWinsLabel
                            : key === "losses"
                              ? primaryLossesLabel
                              : key === "compareWins"
                                ? comparisonWinsLabel
                                : comparisonLossesLabel;
                        const tone =
                          key === "wins" || key === "compareWins"
                            ? "positive"
                            : "negative";
                        const value = Number(item.value ?? 0);
                        return (
                          <DashboardChartTooltipRow
                            key={key}
                            label={label}
                            value={`${value} ${
                              value === 1 ? "occurrence" : "occurrences"
                            }`}
                            tone={tone}
                            dimmed={!isRowActive}
                            indicatorColor={
                              key === "wins"
                                ? "#10b981"
                                : key === "losses"
                                  ? "#ef4444"
                                  : key === "compareWins"
                                    ? "rgba(16, 185, 129, 0.4)"
                                    : "rgba(239, 68, 68, 0.4)"
                            }
                          />
                        );
                      })}
                    </DashboardChartTooltipFrame>
                  );
                }}
              />
            </BarChart>
          </ChartContainer>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
