"use client";

import { VariantBadge } from "@/components/ui/badges/variant-badge";
import { CardHeading } from "@/components/ui/card-heading";
import React, { type ComponentType, useEffect, useMemo, useState } from "react";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { VariantButton } from "../ui/buttons/variant-button";
import { Button, buttonVariants } from "../ui/button";
import { Icon } from "../icons/Icon";
import Link from "next/link";

import ArrowUpRight from "../../../public/icons/arrow-up-right.svg";

import { GradientLink } from "../ui/gradient-button";
import { useAccountStore } from "@/stores/account";
import { useStatsStore } from "@/stores/stats";

import NumberFlow, { continuous, NumberFlowGroup } from "@number-flow/react";

import InfinitySign from "../../../public/icons/infinity.svg";

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
  const formattedBalance = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(balance));

  return (
    <div className="bg-white aspect-video rounded-lg border border-black/5 p-6 pt-7 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.03)] h-48 w-full">
      <div className="flex w-full justify-between items-center">
        <h2 className="text-sm font-medium text-secondary tracking-tight">
          Account balance
        </h2>

        <GradientLink
          size="sm"
          icon={<ArrowUpRight className="size-3" />}
          variant="emerald"
          href="/"
        />
      </div>

      <NumberFlowGroup>
        <div className="flex flex-col gap-2">
          <h1 className="font-semibold text-2xl text-emerald-500">
            <NumberFlow
              trend={1}
              plugins={[continuous]}
              value={balance}
              format={{
                style: "currency",
                currency: "usd",
              }}
              transformTiming={{
                easing: `linear(0, 0.0033 0.8%, 0.0263 2.39%, 0.0896 4.77%, 0.4676 15.12%, 0.5688, 0.6553, 0.7274, 0.7862, 0.8336 31.04%, 0.8793, 0.9132 38.99%, 0.9421 43.77%, 0.9642 49.34%, 0.9796 55.71%, 0.9893 62.87%, 0.9952 71.62%, 0.9983 82.76%, 0.9996 99.47%)`,
                duration: 2000,
              }}
            />
          </h1>

          <div className="flex gap-2 items-center">
            {/* Placeholder delta; compute vs prior period later */}
            <VariantBadge
              gradientFrom="#1AC889"
              gradientTo="#16B377"
              borderColor="#16B377"
              size="md"
            >
              <NumberFlow
                trend={1}
                plugins={[continuous]}
                value={balance}
                format={{
                  maximumFractionDigits: 2,
                  signDisplay: "always",
                }}
                locales="en-US"
                transformTiming={{
                  easing: `linear(0, 0.0033 0.8%, 0.0263 2.39%, 0.0896 4.77%, 0.4676 15.12%, 0.5688, 0.6553, 0.7274, 0.7862, 0.8336 31.04%, 0.8793, 0.9132 38.99%, 0.9421 43.77%, 0.9642 49.34%, 0.9796 55.71%, 0.9893 62.87%, 0.9952 71.62%, 0.9983 82.76%, 0.9996 99.47%)`,
                  duration: 2000,
                }}
              />
            </VariantBadge>
            <p className="text-xs font-medium text-secondary">
              in the lifetime of this account.
            </p>
          </div>
        </div>
      </NumberFlowGroup>
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

  const winrate = Number(
    displayWinrate % 1 === 0
      ? displayWinrate.toFixed(0)
      : displayWinrate.toFixed(1)
  );

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
    <div className="bg-white aspect-video rounded-lg border border-black/5 p-6 pt-7 flex flex-col shadow-[0_1px_8px_rgba(0,0,0,0.03)] h-48 w-full gap-6">
      <div className="flex w-full justify-between items-center">
        <h2 className="text-sm font-medium text-secondary tracking-tight">
          Win rate
        </h2>

        <GradientLink
          size="sm"
          icon={<ArrowUpRight className="size-3" />}
          variant="emerald"
          href="/"
        />
      </div>

      <div className="flex w-full justify-between items-center">
        {mounted ? (
          <ChartContainer config={chartConfig} className="w-[160px] h-[120px]">
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

        <h1 className="text-xs text-secondary font-medium flex flex-col ml-4 h-full justify-center items-end">
          <span className="font-semibold text-2xl text-emerald-500">
            <NumberFlow
              trend={1}
              plugins={[continuous]}
              value={winrate}
              suffix="%"
              transformTiming={{
                easing: `linear(0, 0.0033 0.8%, 0.0263 2.39%, 0.0896 4.77%, 0.4676 15.12%, 0.5688, 0.6553, 0.7274, 0.7862, 0.8336 31.04%, 0.8793, 0.9132 38.99%, 0.9421 43.77%, 0.9642 49.34%, 0.9796 55.71%, 0.9893 62.87%, 0.9952 71.62%, 0.9983 82.76%, 0.9996 99.47%)`,
                duration: 2000,
              }}
            />
          </span>{" "}
          win rate of all time.
        </h1>
      </div>
    </div>
  );
}

export function WinStreakCard({ accountId }: { accountId?: string }) {
  const { data } = useAccountStats(accountId);
  const streak = Math.min(5, data?.winStreak ?? 0);
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
    <div className="bg-white aspect-video rounded-lg border border-black/5 p-6 pt-7 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.03)] h-48 w-full">
      <div className="flex w-full justify-between items-center">
        <h2 className="text-sm font-medium text-secondary tracking-tight">
          Win streak
        </h2>

        <GradientLink
          size="sm"
          icon={<ArrowUpRight className="size-3" />}
          variant="emerald"
          href="/"
        />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-emerald-500">
          <NumberFlow
            trend={1}
            plugins={[continuous]}
            value={streak}
            suffix=" wins"
            format={{
              maximumFractionDigits: 2,
            }}
            transformTiming={{
              easing: `linear(0, 0.0033 0.8%, 0.0263 2.39%, 0.0896 4.77%, 0.4676 15.12%, 0.5688, 0.6553, 0.7274, 0.7862, 0.8336 31.04%, 0.8793, 0.9132 38.99%, 0.9421 43.77%, 0.9642 49.34%, 0.9796 55.71%, 0.9893 62.87%, 0.9952 71.62%, 0.9983 82.76%, 0.9996 99.47%)`,
              duration: 2000,
            }}
            isolate
          />
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
  const pf = data?.profitFactor ?? null;

  return (
    <div className="bg-white aspect-video rounded-lg border border-black/5 p-6 pt-7 flex flex-col justify-between shadow-[0_1x_8px_rgba(0,0,0,0.03)] h-48 w-full">
      <div className="flex w-full justify-between items-center">
        <h2 className="text-sm font-medium text-secondary tracking-tight">
          Profit factor
        </h2>

        <GradientLink
          size="sm"
          icon={<ArrowUpRight className="size-3" />}
          variant="emerald"
          href="/"
        />
      </div>

      <div className="flex flex-col">
        <h1 className="text-2xl text-emerald-500 font-semibold">
          {pf ? (
            <NumberFlow
              trend={1}
              plugins={[continuous]}
              value={pf}
              format={{
                maximumFractionDigits: 2,
              }}
              transformTiming={{
                easing: `linear(0, 0.0033 0.8%, 0.0263 2.39%, 0.0896 4.77%, 0.4676 15.12%, 0.5688, 0.6553, 0.7274, 0.7862, 0.8336 31.04%, 0.8793, 0.9132 38.99%, 0.9421 43.77%, 0.9642 49.34%, 0.9796 55.71%, 0.9893 62.87%, 0.9952 71.62%, 0.9983 82.76%, 0.9996 99.47%)`,
                duration: 2000,
              }}
              isolate
            />
          ) : (
            <InfinitySign
              width={40}
              height={40}
              className="text-emerald-500 shrink-0"
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
    <div className="grid auto-rows-min gap-1 md:grid-cols-4 bg-muted/25 p-1 rounded-xl border border-black/5">
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
