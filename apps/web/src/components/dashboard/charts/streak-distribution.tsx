"use client";

import { Bar, BarChart, Cell, XAxis, YAxis, CartesianGrid } from "recharts";
import React from "react";
import { AnimatePresence } from "motion/react";
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
import { cn } from "@/lib/utils";
import { useChartTrades } from "./use-chart-trades";
import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
} from "./dashboard-chart-ui";

interface StreakDistributionProps {
  accountId?: string;
}

const chartConfig = {
  wins: {
    label: "Win Streaks",
    color: "#10b981",
  },
  losses: {
    label: "Loss Streaks",
    color: "#ef4444",
  },
} satisfies ChartConfig;

export function StreakDistributionChart({ accountId }: StreakDistributionProps) {
  const { trades, isLoading } = useChartTrades(accountId);

  const [activeIndex, setActiveIndex] = React.useState<number | undefined>(
    undefined
  );
  const [activeDataset, setActiveDataset] = React.useState<
    "wins" | "losses" | undefined
  >(undefined);

  const chartData = React.useMemo(() => {
    if (!trades || trades.length === 0) return [];

    // Calculate streaks
    const streaks: { winStreak: number; lossStreak: number }[] = [];
    let currentWinStreak = 0;
    let currentLossStreak = 0;

    const sortedTrades = [...trades].sort((a, b) => {
      const aTime = a.close ?? a.open;
      const bTime = b.close ?? b.open;
      return new Date(aTime ?? 0).getTime() - new Date(bTime ?? 0).getTime();
    });

    sortedTrades.forEach((trade) => {
      const profit = trade.profit ?? 0;

      if (profit > 0) {
        currentWinStreak++;
        if (currentLossStreak > 0) {
          streaks.push({ winStreak: 0, lossStreak: currentLossStreak });
          currentLossStreak = 0;
        }
      } else if (profit < 0) {
        currentLossStreak++;
        if (currentWinStreak > 0) {
          streaks.push({ winStreak: currentWinStreak, lossStreak: 0 });
          currentWinStreak = 0;
        }
      }
    });

    // Add final streak
    if (currentWinStreak > 0) {
      streaks.push({ winStreak: currentWinStreak, lossStreak: 0 });
    }
    if (currentLossStreak > 0) {
      streaks.push({ winStreak: 0, lossStreak: currentLossStreak });
    }

    // Create distribution data
    const distribution: Record<number, { wins: number; losses: number }> = {};
    const maxStreak = Math.max(
      ...streaks.map((s) => Math.max(s.winStreak, s.lossStreak))
    );

    for (let i = 1; i <= maxStreak; i++) {
      distribution[i] = { wins: 0, losses: 0 };
    }

    streaks.forEach((streak) => {
      if (streak.winStreak > 0) {
        distribution[streak.winStreak].wins++;
      }
      if (streak.lossStreak > 0) {
        distribution[streak.lossStreak].losses++;
      }
    });

    return Object.entries(distribution).map(([streak, counts]) => ({
      streak: parseInt(streak),
      wins: counts.wins,
      losses: counts.losses,
    }));
  }, [trades]);

  const maxFrequency = React.useMemo(() => {
    if (chartData.length === 0) return 10;
    return Math.max(...chartData.map((d) => Math.max(d.wins, d.losses)));
  }, [chartData]);

  const bestWorst = React.useMemo(() => {
    if (chartData.length === 0) return { longest: null, mostFrequent: null };
    const longestWin = Math.max(
      ...chartData.filter((d) => d.wins > 0).map((d) => d.streak),
      0
    );
    const longestLoss = Math.max(
      ...chartData.filter((d) => d.losses > 0).map((d) => d.streak),
      0
    );
    const maxWinFreq = Math.max(...chartData.map((d) => d.wins));
    const maxLossFreq = Math.max(...chartData.map((d) => d.losses));
    const mostFrequentStreak = chartData.find(
      (d) => d.wins === maxWinFreq || d.losses === maxLossFreq
    );

    return {
      longest: { win: longestWin, loss: longestLoss },
      mostFrequent: mostFrequentStreak,
    };
  }, [chartData]);

  if (isLoading) {
    return (
      <Card className="w-full h-full rounded-none bg-transparent border-none shadow-none">
        <CardContent className="p-0 flex items-center justify-center h-52">
          <p className="text-xs text-white/30">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="w-full h-full rounded-none bg-transparent border-none shadow-none">
        <CardContent className="p-0 flex items-center justify-center h-52">
          <p className="text-xs text-white/30">No streak data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full rounded-none bg-transparent border-none shadow-none">
      <CardHeader className="p-0">
        <CardTitle className="flex items-center -mt-3">
          {bestWorst.longest ? (
            <p className="font-normal text-white/40 text-sm tracking-wide">
              Longest win streak:{" "}
              <span className="text-teal-400 font-medium">
                {bestWorst.longest.win} trades
              </span>{" "}
              · Longest loss streak:{" "}
              <span className="text-rose-400 font-medium">
                {bestWorst.longest.loss} trades
              </span>
            </p>
          ) : (
            <p className="font-normal text-white/40 text-sm tracking-wide">
              Streak distribution
            </p>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0 overflow-visible">
        <AnimatePresence mode="wait">
          <ChartContainer config={chartConfig} className="w-full h-52 md:h-74">
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
                barSize={24}
                name="Win Streaks"
              >
                {chartData.map((d, index) => {
                  const isActive =
                    index === activeIndex && activeDataset === "wins";
                  const hoverFill = "#2dd4bf"; // teal-400
                  return (
                    <Cell
                      className="duration-200"
                      opacity={isActive ? 1 : 0.2}
                      key={`win-${index}`}
                      onMouseEnter={() => {
                        setActiveIndex(index);
                        setActiveDataset("wins");
                      }}
                      fill={isActive ? hoverFill : "var(--color-wins)"}
                    />
                  );
                })}
              </Bar>

              <Bar
                dataKey="losses"
                fill="var(--color-losses)"
                radius={[0, 0, 0, 0]}
                barSize={24}
                name="Loss Streaks"
              >
                {chartData.map((d, index) => {
                  const isActive =
                    index === activeIndex && activeDataset === "losses";
                  const hoverFill = "#fb7185"; // rose-400
                  return (
                    <Cell
                      className="duration-200"
                      opacity={isActive ? 1 : 0.2}
                      key={`loss-${index}`}
                      onMouseEnter={() => {
                        setActiveIndex(index);
                        setActiveDataset("losses");
                      }}
                      fill={isActive ? hoverFill : "var(--color-losses)"}
                    />
                  );
                })}
              </Bar>

              <CartesianGrid vertical={false} strokeDasharray="8 8" />

              <ChartTooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  return (
                    <DashboardChartTooltipFrame
                      title={`Streak Length: ${payload[0]?.payload?.streak}`}
                      className="min-w-[12rem]"
                    >
                      {payload.map((item: any) => {
                        const key = item.dataKey as "wins" | "losses";
                        const isRowActive = activeDataset
                          ? key === activeDataset
                          : true;
                        const v = Number(item.value ?? 0);
                        return (
                          <DashboardChartTooltipRow
                            key={key}
                            label={item.name}
                            value={`${v} ${
                              v === 1 ? "occurrence" : "occurrences"
                            }`}
                            tone={key === "losses" ? "negative" : "positive"}
                            dimmed={!isRowActive}
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
