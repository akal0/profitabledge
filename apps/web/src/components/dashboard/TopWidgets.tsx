"use client";

import { VariantBadge } from "@/components/ui/badges/variant-badge";
import React, { type ComponentType, useEffect, useMemo, useState } from "react";

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

const chartConfig = {
  wins: {
    label: "Wins",
    color: "#1AC889",
  },
  losses: {
    label: "Losses",
    color: "#D32F2F",
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
    <div className="bg-white dark:bg-card dark:hover:brightness-120 transition-all duration-250 dark:border-white/10 aspect-video rounded-lg border-[0.5px] border-black/5 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.03)] h-48 w-full">
      <div className="flex w-full justify-between items-center px-6 py-4">
        <h2 className="shadow-primary-button cursor-default rounded-[6px] py-2 px-4 h-max transition-all active:scale-95 bg-[#222225]/25 text-white w-max text-xs dark:hover:bg-[#222225] hover:!brightness-105 hover:text-[#A0A0A6]/75 duration-250 select-none">
          <span className="px-0">Account balance</span>
        </h2>

        <Button className="shadow-secondary-button cursor-pointer flex transform items-center justify-center rounded-[6px] py-1.5 px-3 h-max transition-all active:scale-95 bg-emerald-700 text-white w-max text-xs hover:bg-emerald-700 hover:!brightness-110 hover:text-white duration-250">
          <div className="flex items-center gap-1.5">
            <span> View trades </span>
          </div>
        </Button>
      </div>

      <CardSeparator />

      <div className="flex flex-col gap-2.5 px-6 pb-5 h-full justify-end">
        <h1 className="font-semibold  text-2xl text-emerald-400">
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

        <div className="flex gap-2 items-center">
          {/* Placeholder delta; compute vs prior period later */}

          <h2 className="shadow-primary-button cursor-default rounded-[6px] py-1.5 px-6 h-max transition-all active:scale-95 bg-emerald-600 text-shadow-2xs font-semibold text-white w-max text-xs dark:hover:bg-[#222225] hover:!brightness-105 hover:text-[#A0A0A6]/75 duration-250 select-none">
            {balance > 0 ? "+" : "-"}
            $
            <AnimatedNumber
              value={balance}
              format={(n) =>
                n.toLocaleString(undefined, { maximumFractionDigits: 0 })
              }
              springOptions={{
                bounce: 0,
                duration: 2000,
              }}
            />
          </h2>

          <p className="text-xs font-medium text-secondary">
            in the lifetime of this account.
          </p>
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
    <div className="bg-white dark:bg-[#27272A] dark:hover:brightness-120 transition-all duration-250 dark:border-white/10 aspect-video rounded-lg border-[0.5px] border-black/5 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.03)] h-48 w-full">
      <div className="flex w-full justify-between items-center px-6 py-4">
        <h2 className="shadow-primary-button cursor-default rounded-[6px] py-2 px-4 h-max transition-all active:scale-95 bg-[#222225]/25 text-white w-max text-xs dark:hover:bg-[#222225] hover:!brightness-105 hover:text-[#A0A0A6]/75 duration-250 select-none">
          <span>Win rate</span>
        </h2>

        <Button className="shadow-secondary-button cursor-pointer flex transform items-center justify-center rounded-[6px] py-1.5 px-3 h-max transition-all active:scale-95 bg-emerald-700 text-white w-max text-xs hover:bg-emerald-700 hover:!brightness-110 hover:text-white duration-250">
          <div className="flex items-center gap-1.5">
            <span> View trades </span>
          </div>
        </Button>
      </div>

      <CardSeparator />

      <div className="flex w-full justify-between px-6 h-full">
        {mounted ? (
          <ChartContainer
            config={chartConfig}
            className="w-[160px] h-full mt-2  "
          >
            <BarChart
              data={chartData}
              margin={{ left: 0, right: 0, top: 8, bottom: 0 }}
              barGap={8}
            >
              <CartesianGrid vertical={false} strokeDasharray="4 4" />
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

        <h1 className="text-xs text-secondary font-medium flex flex-col ml-4 h-full justify-end items-end pb-5">
          <span className="font-semibold text-2xl text-emerald-500">
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
    <div className="bg-white dark:bg-[#27272A] dark:hover:brightness-120 transition-all duration-250 dark:border-white/10 aspect-video rounded-lg border-[0.5px] border-black/5 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.03)] h-48 w-full">
      <div className="flex w-full justify-between items-center px-6 py-4">
        <h2 className="shadow-primary-button cursor-default rounded-[6px] py-2 px-4 h-max transition-all active:scale-95 bg-[#222225]/25 text-white w-max text-xs dark:hover:bg-[#222225] hover:!brightness-105 hover:text-[#A0A0A6]/75 duration-250 select-none">
          <span className="px-0">Win streak</span>
        </h2>

        <Button className="shadow-secondary-button cursor-pointer flex transform items-center justify-center rounded-[6px] py-1.5 px-3 h-max transition-all active:scale-95 bg-emerald-700 text-white w-max text-xs hover:bg-emerald-700 hover:!brightness-110 hover:text-white duration-250">
          <div className="flex items-center gap-1.5">
            <span> View trades </span>
          </div>
        </Button>
      </div>

      <CardSeparator />

      <div className="flex flex-col gap-2 px-6 h-full justify-end pb-5">
        <h1 className="text-2xl font-semibold text-emerald-500">
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
  );
}

export function ProfitFactorCard({ accountId }: { accountId?: string }) {
  const { data } = useAccountStats(accountId);
  let pf = data?.profitFactor ?? null;
  const pfRounded2 = pf !== null ? Number(pf.toFixed(2)) : null;

  return (
    <div className="bg-white dark:bg-[#27272A] dark:hover:brightness-120 transition-all duration-250 dark:border-white/10 aspect-video rounded-lg border-[0.5px] border-black/5 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.03)] h-48 w-full">
      <div className="flex w-full justify-between items-center px-6 py-4">
        <h2 className="shadow-primary-button cursor-default rounded-[6px] py-2 px-4 h-max transition-all active:scale-95 bg-[#222225]/25 text-white w-max text-xs dark:hover:bg-[#222225] hover:!brightness-105 hover:text-[#A0A0A6]/75 duration-250 select-none">
          <span className="px-0">Profit factor</span>
        </h2>

        <Button className="shadow-secondary-button cursor-pointer flex transform items-center justify-center rounded-[6px] py-1.5 px-3 h-max transition-all active:scale-95 bg-emerald-700 text-white w-max text-xs hover:bg-emerald-700 hover:!brightness-110 hover:text-white duration-250">
          <div className="flex items-center gap-1.5">
            <span> View trades </span>
          </div>
        </Button>
      </div>

      <CardSeparator />

      <div className="flex flex-col px-6 h-full justify-end pb-5">
        <h1 className="text-2xl text-emerald-500 font-semibold">
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
            <InfinitySign
              width={40}
              height={40}
              className="fill-transparent stroke-emerald-500 shrink-0 [*]:transition-none"
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
}

export function TopWidgets({ enabledWidgets }: TopWidgetsProps) {
  // Ensure only 4 widgets maximum
  const displayWidgets = enabledWidgets.slice(0, 4);

  // Fill empty slots with placeholder divs
  const emptySlots = 4 - displayWidgets.length;
  const accountId = useAccountStore((s) => s.selectedAccountId);

  return (
    <div className="grid auto-rows-min gap-1 md:grid-cols-4 bg-muted/25 dark:bg-muted/25 p-1 rounded-xl border-[0.5px] border-black/5 dark:border-white/5">
      {displayWidgets.map((widgetType, index) => {
        const CardComponent = cardComponents[widgetType];
        return (
          <CardComponent key={`${widgetType}-${index}`} accountId={accountId} />
        );
      })}

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
