"use client";

import { VariantBadge } from "@/components/ui/badges/variant-badge";
import React, {
  type ComponentType,
  Fragment,
  useEffect,
  useMemo,
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
import { useStatsStore } from "@/stores/stats";

import NumberFlow, { continuous, NumberFlowGroup } from "@number-flow/react";

import InfinitySign from "@/public/icons/infinity.svg";
import { AnimatedNumber } from "../ui/animated-number";
import { Button } from "../ui/button";
import { CardSeparator } from "../ui/separator";

import CircleInfo from "@/public/icons/circle-info.svg";
import { Skeleton } from "../ui/skeleton";

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

// Widget types - used for identifying which card to render
export type WidgetType =
  | "account-balance"
  | "win-streak"
  | "profit-factor"
  | "win-rate";

function useAccountStats(accountId?: string) {
  const fetchStats = useStatsStore((s) => s.fetchStats);
  const getStats = useStatsStore((s) => s.getStats);
  const isLoading = useStatsStore((s) => s.isLoading(accountId));
  useEffect(() => {
    if (accountId) fetchStats(accountId);
  }, [accountId, fetchStats]);
  return { data: getStats(accountId) ?? null, loading: isLoading };
}

export function AccountBalanceCard({ accountId }: { accountId?: string }) {
  const { data } = useAccountStats(accountId);
  const balance = data?.totalProfit ?? 0;

  return (
    <div className="bg-sidebar rounded-sm h-48 w-full p-1 flex flex-col">
      <div className="flex w-full justify-between items-center px-5 py-4">
        <h2 className="text-xs font-semibold">
          <span className="px-0">Account balance</span>
        </h2>

        <CircleInfo className="size-5 stroke-white fill-transparent" />
      </div>

      <div className="bg-white dark:bg-sidebar-accent dark:hover:brightness-120 transition-all duration-150 rounded-b-sm rounded-t-md flex flex-col justify-between h-full w-full">
        <div className="flex flex-col gap-2.5 px-6 pb-5 h-full justify-end">
          <h1 className="font-medium text-2xl text-teal-500">
            $
            <AnimatedNumber
              value={balance}
              format={(n) =>
                n.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              }
              springOptions={{
                bounce: 0,
                duration: 2000,
              }}
            />
          </h1>
        </div>
      </div>
    </div>
  );
}

export function WinRateCard({ accountId }: { accountId?: string }) {
  const { data } = useAccountStats(accountId);
  const wins = Number(data?.wins ?? 0);
  const losses = Number(data?.losses ?? 0);
  const breakeven = 0;
  const total = wins + losses;

  const displayWinrate = (wins / total) * 100;

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
    [wins, losses]
  );

  return (
    <div className="bg-sidebar rounded-sm h-48 w-full p-1 flex flex-col">
      <div className="flex w-full justify-between items-center px-5 py-4">
        <h2 className="text-xs font-semibold">
          <span className="px-0">Win rate</span>
        </h2>

        <CircleInfo className="size-5 stroke-white fill-transparent" />
      </div>

      <div className="bg-white dark:bg-sidebar-accent dark:hover:brightness-120 transition-all duration-150 rounded-b-sm rounded-t-md flex flex-col justify-between h-full w-full">
        <div className="flex w-full justify-between px-6 h-full">
          <h1 className="text-xs text-secondary font-medium flex flex-col h-full justify-end pb-5">
            <span className="font-medium text-2xl text-teal-500">
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
            win rate of all time.
          </h1>

          {mounted ? (
            <ChartContainer
              config={chartConfig}
              className="w-[160px] h-[80%] place-self-end  "
            >
              <BarChart
                data={chartData}
                margin={{ left: 0, right: 0, top: 8, bottom: 0 }}
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
                  radius={[3, 3, 0, 0]}
                  barSize={16}
                />
                <Bar
                  dataKey="losses"
                  fill="var(--color-losses)"
                  radius={[3, 3, 0, 0]}
                  barSize={16}
                />
                <Bar
                  dataKey="breakeven"
                  fill="var(--color-breakeven)"
                  radius={[3, 3, 0, 0]}
                  barSize={16}
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="w-[120px] h-[120px]" />
          )}
        </div>
      </div>
    </div>
  );
}

export function WinStreakCard({ accountId }: { accountId?: string }) {
  const { data } = useAccountStats(accountId);
  const streak = Math.round(Math.min(5, data?.winStreak ?? 0));
  const headingColors =
    streak === 0
      ? { from: "#D32F2F", to: "#C62828" }
      : streak <= 2
      ? { from: "#FF6F00", to: "#E65100" }
      : { from: "#1AC889", to: "#16B377" };

  // Use most recent 5 outcomes from server (W/L), pad to 5 for consistent UI
  const outcomes: ("W" | "L")[] = [...(data?.recentOutcomes ?? [])].slice(0, 5);
  if (outcomes.length < 5) {
    outcomes.push(...Array(5 - outcomes.length).fill("L"));
  }

  return (
    <div className="bg-sidebar rounded-sm h-48 w-full p-1 flex flex-col">
      <div className="flex w-full justify-between items-center px-5 py-4">
        <h2 className="text-xs font-semibold">
          <span className="px-0">Win streak</span>
        </h2>

        <CircleInfo className="size-5 stroke-white fill-transparent" />
      </div>

      <div className="bg-white dark:bg-sidebar-accent dark:hover:brightness-120 transition-all duration-150 rounded-b-sm rounded-t-md flex flex-col justify-between h-full w-full">
        <div className="flex flex-col gap-2 px-6 h-full justify-end pb-5">
          <h1 className="text-2xl font-medium text-teal-500">
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

          <div className="flex gap-2 items-center">
            {outcomes.map((res, i) => (
              <VariantBadge
                key={i}
                gradientFrom={res === "W" ? "#1AC889" : "#D32F2F"}
                gradientTo={res === "W" ? "#16B377" : "#C62828"}
                borderColor={res === "W" ? "#16B377" : "#C62828"}
                size="streak"
              >
                {res}
              </VariantBadge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfitFactorCard({ accountId }: { accountId?: string }) {
  const { data } = useAccountStats(accountId);
  let pf = data?.profitFactor ?? null;
  const pfRounded2 = pf !== null ? Number(pf.toFixed(2)) : null;

  return (
    <div className="bg-sidebar rounded-sm h-48 w-full p-1 flex flex-col">
      <div className="flex w-full justify-between items-center px-5 py-4">
        <h2 className="text-xs font-semibold">
          <span className="px-0">Profit factor</span>
        </h2>

        <CircleInfo className="size-5 stroke-white fill-transparent" />
      </div>

      <div className="bg-white dark:bg-sidebar-accent dark:hover:brightness-120 transition-all duration-150 rounded-b-sm rounded-t-md flex flex-col justify-between h-full w-full">
        <div className="flex flex-col px-6 h-full justify-end pb-5">
          <h1 className="text-2xl text-teal-500 font-medium">
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
              Lifetime profit factor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========================
// Widget Component Mapping
// ========================
const cardComponents: Record<WidgetType, ComponentType<any>> = {
  "account-balance": AccountBalanceCard,
  "win-rate": WinRateCard,
  "win-streak": WinStreakCard,
  "profit-factor": ProfitFactorCard,
} as const;

// ========================
// TopWidgets Container Component
// ========================
interface TopWidgetsProps {
  enabledWidgets: WidgetType[];
  accountId?: string;
}

export function TopWidgets({ enabledWidgets, accountId }: TopWidgetsProps) {
  // Ensure only 4 widgets maximum
  const displayWidgets = enabledWidgets.slice(0, 4);

  // Fill empty slots with placeholder divs
  const emptySlots = 4 - displayWidgets.length;

  return (
    <div className="grid auto-rows-min gap-1 md:grid-cols-4 bg-muted/25 dark:bg-muted/25 p-1 rounded-sm ">
      {accountId ? (
        displayWidgets.map((widgetType, index) => {
          const CardComponent = cardComponents[widgetType];
          return (
            <CardComponent
              key={`${widgetType}-${index}`}
              accountId={accountId}
            />
          );
        })
      ) : (
        <Fragment>
          <div className="bg-sidebar rounded-sm h-48 w-full p-1 flex flex-col">
            <div className="flex w-full justify-between items-center px-5 py-4">
              <Skeleton className="w-24 h-5 rounded-sm bg-sidebar-accent" />

              <Skeleton className="w-16 h-5 rounded-sm bg-sidebar-accent" />
            </div>

            <div className="bg-white dark:bg-sidebar-accent dark:hover:brightness-120 transition-all duration-150 rounded-b-sm rounded-t-md flex flex-col justify-between h-full w-full">
              <div className="flex gap-2.5 px-6 pb-5 h-full items-end justify-between">
                <Skeleton className="w-24 h-5 rounded-sm bg-sidebar" />

                <Skeleton className="w-48 h-24 rounded-sm bg-sidebar" />
              </div>
            </div>
          </div>

          <div className="bg-sidebar rounded-sm h-48 w-full p-1 flex flex-col">
            <div className="flex w-full justify-between items-center px-5 py-4">
              <Skeleton className="w-24 h-5 rounded-sm bg-sidebar-accent" />

              <Skeleton className="w-16 h-5 rounded-sm bg-sidebar-accent" />
            </div>

            <div className="bg-white dark:bg-sidebar-accent dark:hover:brightness-120 transition-all duration-150 rounded-b-sm rounded-t-md flex flex-col justify-between h-full w-full">
              <div className="flex gap-2.5 px-6 pb-5 h-full items-end justify-between">
                <Skeleton className="w-24 h-5 rounded-sm bg-sidebar" />

                <Skeleton className="w-48 h-24 rounded-sm bg-sidebar" />
              </div>
            </div>
          </div>

          <div className="bg-sidebar rounded-sm h-48 w-full p-1 flex flex-col">
            <div className="flex w-full justify-between items-center px-5 py-4">
              <Skeleton className="w-24 h-5 rounded-sm bg-sidebar-accent" />

              <Skeleton className="w-16 h-5 rounded-sm bg-sidebar-accent" />
            </div>

            <div className="bg-white dark:bg-sidebar-accent dark:hover:brightness-120 transition-all duration-150 rounded-b-sm rounded-t-md flex flex-col justify-between h-full w-full">
              <div className="flex gap-2.5 px-6 pb-5 h-full items-end justify-between">
                <Skeleton className="w-24 h-5 rounded-sm bg-sidebar" />

                <Skeleton className="w-48 h-24 rounded-sm bg-sidebar" />
              </div>
            </div>
          </div>

          <div className="bg-sidebar rounded-sm h-48 w-full p-1 flex flex-col">
            <div className="flex w-full justify-between items-center px-5 py-4">
              <Skeleton className="w-24 h-5 rounded-sm bg-sidebar-accent" />

              <Skeleton className="w-16 h-5 rounded-sm bg-sidebar-accent" />
            </div>

            <div className="bg-white dark:bg-sidebar-accent dark:hover:brightness-120 transition-all duration-150 rounded-b-sm rounded-t-md flex flex-col justify-between h-full w-full">
              <div className="flex gap-2.5 px-6 pb-5 h-full items-end justify-between">
                <Skeleton className="w-24 h-5 rounded-sm bg-sidebar" />

                <Skeleton className="w-48 h-24 rounded-sm bg-sidebar" />
              </div>
            </div>
          </div>
        </Fragment>
      )}

      {/* Empty placeholder slots */}
      {Array.from({ length: emptySlots }).map((_, index) => (
        <div
          key={`empty-${index}`}
          className="bg-muted/50 aspect-video rounded-xl"
        />
      ))}
    </div>
  );
}
