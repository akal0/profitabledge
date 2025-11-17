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
  ChevronLeft,
  ChevronRight,
  GripVertical,
  TrendingDown,
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
import { trpcClient } from "@/utils/trpc";
import { Switch } from "../ui/switch";
// import removed: AssetProfitabilityCard now ignores global date range
import { TotalLossesChart } from "@/components/dashboard/charts/total-losses";
import { Select } from "../ui/select";

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
  | "win-rate"
  | "hold-time"
  | "average-rr"
  | "asset-profitability"
  | "trade-counts"
  | "profit-expectancy"
  | "total-losses"
  | "consistency-score";

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
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  const { data } = useAccountStats(accountId);
  const [initialBalance, setInitialBalance] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setInitialBalance(data?.initialBalance ?? null);
      } catch {}
    })();
  }, [data]);

  const balance =
    data && initialBalance ? initialBalance + Number(data?.totalProfit) : 0;

  return (
    <div
      className={`bg-sidebar h-60 w-full border border-white/5 p-1 flex flex-col group ${
        isEditing ? "animate-tilt-subtle hover:animate-none" : ""
      } ${className ?? ""}`}
    >
      <div className="flex w-full gap-1.5 items-center p-3.5">
        <Bank className="size-4 stroke-white/50 group-hover:stroke-white fill-sidebar transition-all duration-250" />
        <h2 className="text-xs font-medium flex items-center gap-2 text-white/50 group-hover:text-white transition-all duration-250">
          <span>Account balance</span>
        </h2>
      </div>

      <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-250 flex flex-col justify-between h-full w-full">
        <div className="flex flex-col gap-1 p-3.5 h-full justify-end">
          <h1 className="font-medium text-2xl text-teal-400">
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

          <p className="text-xs font-medium text-secondary">
            Sum of your all-time profit and initial account balance
          </p>
        </div>
      </div>
    </div>
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
    <div
      className={`bg-sidebar border border-white/5 h-60 w-full p-1 flex flex-col group ${
        isEditing ? "animate-tilt-subtle hover:animate-none" : ""
      } ${className ?? ""}`}
    >
      <div className="flex w-full items-center p-3.5 gap-1.5">
        <WinRate className="size-4 fill-white/50 group-hover:fill-white transition-all duration-250" />
        <h2 className="text-xs font-medium flex items-center gap-2 text-white/50 group-hover:text-white transition-all duration-250">
          <span>Win rate</span>
        </h2>
      </div>

      <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-250 flex flex-col justify-between h-full w-full">
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
      </div>
    </div>
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

  // Use most recent 5 outcomes from server (W/L), pad to 5 for consistent UI
  const outcomes: ("W" | "L")[] = [...(data?.recentOutcomes ?? [])].slice(0, 5);
  if (outcomes.length < 5) {
    outcomes.push(...Array(5 - outcomes.length).fill("L"));
  }

  return (
    <div
      className={`bg-sidebar border border-white/5 h-60 w-full p-1 flex flex-col group ${
        isEditing ? "animate-tilt-subtle hover:animate-none" : ""
      } ${className ?? ""}`}
    >
      <div className="flex w-full items-center p-3.5 gap-1.5">
        <WinStreak className="size-4 fill-white/50 group-hover:fill-white transition-all duration-250" />
        <h2 className="text-xs font-medium flex items-center gap-2 text-white/50 group-hover:text-white transition-all duration-250">
          <span>Win streak</span>
        </h2>
      </div>

      <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-250 flex flex-col justify-end h-full w-full">
        <div className="flex flex-col gap-1.5 p-3.5 h-full justify-end">
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
                  "px-2 py-1",
                  res === "W" ? "bg-teal-500" : "bg-rose-500"
                )}
              >
                <h1 className="text-xs text-white font-medium"> {res} </h1>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
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
  let pf = data?.profitFactor ?? null;
  const pfRounded2 = pf !== null ? Number(pf.toFixed(2)) : null;

  return (
    <div
      className={`bg-sidebar border border-white/5 h-60 w-full p-1 flex flex-col group ${
        isEditing ? "animate-tilt-subtle hover:animate-none" : ""
      } ${className ?? ""}`}
    >
      <div className="flex w-full items-center p-3.5 gap-2">
        <ProfitFactor className="size-4 fill-white/50 group-hover:fill-white transition-all duration-250" />
        <h2 className="text-xs font-medium flex items-center gap-2 text-white/50 group-hover:text-white transition-all duration-250">
          <span>Profit factor</span>
        </h2>
      </div>

      <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-250 flex flex-col justify-between h-full w-full">
        <div className="flex flex-col p-3.5 h-full justify-end">
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
        </div>
      </div>
    </div>
  );
}

export function ProfitExpectancyCard({
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
  const total = wins + losses;
  const grossProfit = Number(data?.grossProfit ?? 0);
  const grossLoss = Number((data as any)?.grossLoss ?? 0);

  const avgWin = wins > 0 ? grossProfit / wins : 0;
  const avgLoss = losses > 0 ? grossLoss / losses : 0; // already absolute
  const winPct = total > 0 ? wins / total : 0;
  const lossPct = total > 0 ? losses / total : 0;
  const expectancy = winPct * avgWin - lossPct * avgLoss;
  const isNegative = expectancy < 0;

  return (
    <div
      className={`bg-sidebar border border-white/5 h-60 w-full p-1 flex flex-col group ${
        isEditing ? "animate-tilt-subtle hover:animate-none" : ""
      } ${className ?? ""}`}
    >
      <div className="flex w-full items-center p-3.5 gap-2">
        <CircleInfo className="size-4 fill-white/50 group-hover:fill-white transition-all duration-250" />
        <h2 className="text-xs font-medium flex items-center gap-2 text-white/50 group-hover:text-white transition-all duration-250">
          <span>Profit expectancy</span>
        </h2>
      </div>

      <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-150 flex flex-col justify-between h-full w-full">
        <div className="flex flex-col p-3.5 h-full justify-end">
          <h1
            className={cn(
              "text-2xl font-medium",
              isNegative ? "text-rose-400" : "text-teal-400"
            )}
          >
            <AnimatedNumber
              value={expectancy}
              format={(n) => {
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
        </div>
      </div>
    </div>
  );
}

export function TotalLossesCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
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

  const fmt = (n: number) => `-$${Math.abs(Math.round(n)).toLocaleString()}`;

  return (
    <div
      className={`bg-sidebar border border-white/5 h-60 w-full p-1 flex flex-col group ${
        isEditing ? "animate-tilt-subtle hover:animate-none" : ""
      } ${className ?? ""}`}
    >
      <div
        className={cn(
          "flex w-full items-center p-3.5 gap-2 justify-between",
          !isEditing ? "py-2.5" : ""
        )}
      >
        <div className="flex items-center gap-2">
          <TrendingDown className="size-3 text-white/40 stroke-4" />
          <h2 className="text-xs font-medium flex items-center gap-2 text-white/50 group-hover:text-white transition-all duration-250">
            <span>Total losses</span>
          </h2>
        </div>
        {!isEditing && rows.length > pageSize && (
          <div className="flex items-center gap-2 border border-white/5">
            <Button
              className="text-xs text-white/50 hover:text-white disabled:opacity-40 border-r border-white/5 rounded-none px-2 py-1 bg-transparent hover:bg-sidebar-accent hover:brightness-120"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="size-3.5" />
            </Button>

            <span className="text-[10px] text-white/40 px-1">
              {page + 1}/{pageCount}
            </span>

            <Button
              className="text-xs text-white/50 hover:text-white disabled:opacity-40 border-l border-white/5 rounded-none py-1 bg-transparent hover:bg-sidebar-accent hover:brightness-120"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-150 flex flex-col h-full w-full">
        <div className="flex flex-col gap-3.5 p-3.5 h-full justify-end overflow-y-auto">
          {loading ? (
            Array.from({ length: pageSize }).map((_, i) => (
              <div
                key={`tl-skel-${i}`}
                className="flex items-center gap-8 w-full"
              >
                <Skeleton className="w-20 h-4 rounded-none bg-sidebar" />
                <div className="w-full flex-1 flex items-center gap-2">
                  <Skeleton className="h-3.5 w-full rounded-none bg-sidebar" />
                  <Skeleton className="w-12 h-4 rounded-none bg-sidebar" />
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

                  <div className="flex-1 h-3.5 bg-sidebar rounded-none">
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
                          <TooltipContent
                            sideOffset={6}
                            className="bg-sidebar text-white border border-white/5 rounded-none"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-white/60">
                                Loss
                              </span>
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
                          <TooltipContent
                            sideOffset={6}
                            className="bg-sidebar text-white border border-white/5 rounded-none"
                          >
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
                          <TooltipContent
                            sideOffset={6}
                            className="bg-sidebar text-white border border-white/5 rounded-none"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-white/60">
                                Swap
                              </span>
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
      </div>
    </div>
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

  return (
    <div
      className={`bg-sidebar border border-white/5 h-60 w-full p-1 flex flex-col group ${
        isEditing ? "animate-tilt-subtle hover:animate-none" : ""
      } ${className ?? ""}`}
    >
      <div
        className={cn(
          "flex w-full items-center p-3.5 gap-2 justify-between",
          !isEditing ? "py-2.5" : ""
        )}
      >
        <div className="flex items-center gap-2">
          <InfinityIcon className="size-4 fill-white/50 group-hover:fill-white transition-all duration-250" />
          <h2 className="text-xs font-medium flex items-center gap-2 text-white/50 group-hover:text-white transition-all duration-250">
            <span>Consistency score</span>
          </h2>
        </div>
        {!isEditing && (
          <div
            className="flex items-center gap-2"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <ShSelect value={range} onValueChange={(v) => setRange(v)}>
              <ShSelectTrigger className="text-[11px] !h-max px-3 py-1 border border-white/5 rounded-none bg-transparent text-white/60">
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
        )}
      </div>

      <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-150 flex flex-col justify-between h-full w-full">
        <div className="flex flex-col p-3.5 h-full justify-end">
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
        </div>
      </div>
    </div>
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
    <div
      className={`bg-sidebar border border-white/5 h-60 w-full p-1 flex flex-col group ${
        isEditing ? "animate-tilt-subtle hover:animate-none" : ""
      } ${className ?? ""}`}
    >
      <div className="flex w-full items-center p-3.5 gap-2">
        <Bank className="size-4 stroke-white/50 fill-sidebar group-hover:stroke-white transition-all duration-250" />
        <h2 className="text-xs font-medium flex items-center gap-2 text-white/50 group-hover:text-white transition-all duration-250">
          <span>Average hold time</span>
        </h2>
      </div>

      <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-150 flex flex-col justify-between h-full w-full">
        <div className="flex flex-col p-3.5 h-full justify-end">
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
        </div>
      </div>
    </div>
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
    <div
      className={`bg-sidebar border border-white/5 h-60 w-full p-1 flex flex-col group ${
        isEditing ? "animate-tilt-subtle hover:animate-none" : ""
      } ${className ?? ""}`}
    >
      <div
        className={cn(
          "flex w-full items-center p-3.5 gap-2 justify-between",
          !isEditing ? "py-2.5" : ""
        )}
      >
        <div className="flex items-center gap-2 w-full h-4">
          <InfinityIcon className="size-4 fill-white/50 group-hover:fill-white transition-all duration-250" />
          <h2 className="text-xs font-medium flex items-center gap-2 text-white/50 group-hover:text-white transition-all duration-250">
            <span>Average RR multiple</span>
          </h2>
        </div>

        {!isEditing && (
          <div className="flex items-center gap-2 w-full justify-end">
            <span className="text-xs text-white/50">Risk</span>

            <div className="flex items-center border border-white/5 bg-sidebar-accent pr-2">
              <input
                type="number"
                inputMode="decimal"
                className="text-xs pl-2 py-1 rounded-none outline-none no-spinner"
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
        )}
      </div>

      <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-250 flex flex-col justify-between h-full w-full">
        <div className="flex flex-col p-3.5 h-full justify-end">
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
        </div>
      </div>
    </div>
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
    <div
      className={`bg-sidebar border border-white/5 h-60 w-full p-1 flex flex-col group ${
        isEditing ? "animate-tilt-subtle hover:animate-none" : ""
      } ${className ?? ""}`}
    >
      <div
        className={cn(
          "flex w-full items-center p-3.5 gap-2 justify-between",
          !isEditing ? "py-2.5" : ""
        )}
      >
        <h2 className="text-xs font-medium flex items-center gap-2 text-white/50 group-hover:text-white transition-all duration-250">
          <span>Asset profitability</span>
        </h2>
        {!isEditing && (
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 justify-end">
              <Switch checked={showWorst} onCheckedChange={setShowWorst} />
              <span className="text-xs text-white/50">
                {showWorst ? "Worst performing" : "Best performing"}
              </span>
            </div>

            {!isEditing && rows.length > pageSize && (
              <div className="flex items-center gap-2 border border-white/5">
                <Button
                  className="text-xs text-white/50 hover:text-white disabled:opacity-40 border-r border-white/5 rounded-none px-2 py-1 bg-transparent hover:bg-sidebar-accent hover:brightness-120"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="size-3.5" />
                </Button>

                <span className="text-[10px] text-white/40 px-1">
                  {page + 1}/{pageCount}
                </span>

                <Button
                  className="text-xs text-white/50 hover:text-white disabled:opacity-40 border-l border-white/5 rounded-none py-1 bg-transparent hover:bg-sidebar-accent hover:brightness-120"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-150 flex flex-col h-full w-full overflow-hidden">
        <div className="flex-1 min-h-0 flex flex-col gap-3.5 p-3.5 pb-3 justify-end">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`asset-skel-${i}`}
                className="flex items-center gap-8 w-full"
              >
                <Skeleton className="w-24 h-4 rounded-none bg-sidebar" />

                <div className="w-full flex-1 flex items-center gap-2">
                  <Skeleton className="h-4 w-full rounded-none bg-sidebar" />
                  <Skeleton className="w-12 h-4 w-24 rounded-none bg-sidebar" />
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
              const pct = Math.min(
                100,
                Math.round((Math.abs(v) / maxAbs) * 100)
              );
              const isGain = v >= 0;
              return (
                <div key={r.symbol} className="flex items-center gap-3 w-full">
                  <div className="w-20 truncate text-xs text-white/40">
                    {r.symbol}
                  </div>

                  <div className="flex-1 h-3.5 bg-sidebar rounded-none">
                    <div
                      className={cn(
                        "h-full",
                        isGain ? "bg-teal-400" : "bg-rose-400"
                      )}
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
      </div>
    </div>
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
    // Average per day across entire history (ignore zero days by spec)
    const nonZeroDays =
      byDay.filter((d) => Number(d.count || 0) > 0).length || 1;
    const perDay = totalTrades / nonZeroDays;
    // Average per week across entire history
    const weekTotals = byWeek.map((w) => Number(w.count || 0));
    const sumWeeks = weekTotals.reduce((acc, c) => acc + c, 0);
    const nonZeroWeeks = weekTotals.filter((c) => c > 0).length;
    const perWeek = nonZeroWeeks <= 1 ? sumWeeks : sumWeeks / nonZeroWeeks;
    // Average per month across entire history
    const nonZeroMonths =
      byMonth.filter((m) => Number(m.count || 0) > 0).length || 1;
    const perMonth = totalTrades / nonZeroMonths;
    return [
      { label: "Per day", value: perDay },
      { label: "Per week", value: perWeek },
      { label: "Per month", value: perMonth },
    ];
  }, [byDay, byWeek, byMonth]);

  const maxVal = useMemo(
    () => Math.max(1, ...rows.map((r) => Number(r.value || 0))),
    [rows]
  );

  return (
    <div
      className={`bg-sidebar border border-white/5 h-60 w-full p-1 flex flex-col group ${
        isEditing ? "animate-tilt-subtle hover:animate-none" : ""
      } ${className ?? ""}`}
    >
      <div className="flex w-full items-center p-3.5 gap-2 justify-between">
        <h2 className="text-xs font-medium flex items-center gap-2 text-white/50 group-hover:text-white transition-all duration-250">
          <span>Average trade counts</span>
        </h2>
      </div>

      <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-150 flex flex-col h-full w-full">
        <div className="flex flex-col gap-3.5 p-3.5 h-full overflow-y-auto justify-end">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={`tc-skel-${i}`}
                  className="flex items-center gap-8 w-full"
                >
                  <Skeleton className="w-24 h-4 rounded-none bg-sidebar" />
                  <div className="w-full flex-1 flex items-center gap-2">
                    <Skeleton className="h-4 w-full rounded-none bg-sidebar" />
                    <Skeleton className="w-12 h-4 rounded-none bg-sidebar" />
                  </div>
                </div>
              ))
            : rows.map((r) => {
                const v = Number(r.value || 0);
                const pct = Math.min(
                  100,
                  Math.round((Math.abs(v) / maxVal) * 100)
                );
                return (
                  <div key={r.label} className="flex items-center w-full">
                    <div className="w-20 truncate text-xs text-white/40">
                      {r.label}
                    </div>
                    <div className="w-full flex-1 flex items-center gap-3">
                      <div className="flex-1 h-3.5 bg-sidebar rounded-none">
                        <div
                          className="h-full bg-white/75"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="w-12 text-xs truncate font-semibold text-white/70">
                        {v.toFixed(0)}
                      </div>
                    </div>
                  </div>
                );
              })}
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
  "hold-time": HoldTimeCard,
  "average-rr": AverageRRCard,
  "asset-profitability": AssetProfitabilityCard,
  "trade-counts": TradeCountsCard,
  "profit-expectancy": ProfitExpectancyCard,
  "total-losses": TotalLossesCard,
  "consistency-score": ConsistencyScoreCard,
} as const;

// ========================
// TopWidgets Container Component
// ========================
export interface TopWidgetsProps {
  enabledWidgets: WidgetType[];
  accountId?: string;
  isEditing?: boolean;
  onToggleWidget?: (type: WidgetType) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onEnterEdit?: () => void;
}

export function Widgets({
  enabledWidgets,
  accountId,
  isEditing = false,
  onToggleWidget,
  onReorder,
  onEnterEdit,
}: TopWidgetsProps) {
  // Ensure only 4 widgets maximum
  const displayWidgets = enabledWidgets.slice(0, 12);

  // Fill empty slots with placeholder divs
  const emptySlots = 0 - displayWidgets.length;

  // All possible widgets for discovery in edit mode
  const allWidgets: WidgetType[] = [
    "account-balance",
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
  ];

  const availableWidgets = allWidgets.filter(
    (w) => !displayWidgets.includes(w)
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

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
        <div className="grid auto-rows-min gap-1.5 md:grid-cols-4 2xl:grid-cols-5 ">
          {accountId ? (
            displayWidgets.map((widgetType, index) => {
              const CardComponent = cardComponents[widgetType];
              return (
                <SortableWidget
                  key={`${widgetType}-${index}`}
                  id={widgetType}
                  disabled={!isEditing}
                >
                  <div
                    className="h-60 w-full relative cursor-pointer"
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onClick={() => isEditing && onToggleWidget?.(widgetType)}
                  >
                    {/* checkmark when selected in edit mode */}
                    {isEditing ? (
                      <div className="flex items-center absolute right-5 top-5 z-10 gap-2">
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
                    ) : null}
                    <CardComponent
                      accountId={accountId}
                      isEditing={isEditing}
                      className="w-full h-full"
                    />
                  </div>
                </SortableWidget>
              );
            })
          ) : (
            <Fragment>
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  className="bg-sidebar border border-white/5 h-60 w-full p-1 flex flex-col"
                  key={`loading-${index}`}
                >
                  <div className="flex w-full justify-between items-center p-3.5">
                    <Skeleton className="w-32 rounded-none h-4 bg-sidebar-accent" />

                    <Skeleton className="w-16 h-4 rounded-none bg-sidebar-accent" />
                  </div>

                  <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-150 flex flex-col justify-between h-full w-full">
                    <div className="flex gap-8 p-3.5 h-full items-end justify-between">
                      <div className="flex flex-col gap-1">
                        <Skeleton className="w-12 h-4 rounded-none bg-sidebar" />

                        <Skeleton className="w-24 h-4 rounded-none bg-sidebar" />
                      </div>

                      <Skeleton className="w-full h-full rounded-none bg-sidebar" />
                    </div>
                  </div>
                </div>
              ))}
            </Fragment>
          )}

          {/* In edit mode, show available widgets with 50% opacity */}
          {isEditing &&
            availableWidgets.map((widgetType, index) => {
              const CardComponent = cardComponents[widgetType];
              return (
                <div
                  key={`available-${widgetType}-${index}`}
                  className="opacity-50 hover:opacity-100 transition-all duration-150 hover:animate-none cursor-pointer"
                  onClick={() => onToggleWidget?.(widgetType)}
                >
                  {/* checkmark hidden since not selected yet */}
                  <CardComponent accountId={accountId} isEditing={true} />
                </div>
              );
            })}

          {/* Empty placeholder slots */}
          {isEditing &&
            Array.from({ length: emptySlots }).map((_, index) => (
              <div
                className="bg-sidebar border border-white/5 h-60 w-full p-1 flex flex-col"
                key={`empty-${index}`}
              >
                <div className="flex w-full justify-between items-center p-3.5">
                  <Skeleton className="w-32 rounded-none h-4 bg-sidebar-accent" />

                  <Skeleton className="w-16 h-4 rounded-none bg-sidebar-accent" />
                </div>

                <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-150 flex flex-col justify-between h-full w-full">
                  <div className="flex gap-8 p-3.5 h-full items-end justify-between">
                    <div className="flex flex-col gap-1">
                      <Skeleton className="w-12 h-4 rounded-none bg-sidebar" />

                      <Skeleton className="w-24 h-4 rounded-none bg-sidebar" />
                    </div>

                    <Skeleton className="w-48 h-full rounded-none bg-sidebar" />
                  </div>
                </div>
              </div>
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
}: {
  id: string;
  disabled?: boolean;
  children: React.ReactNode;
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
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}
