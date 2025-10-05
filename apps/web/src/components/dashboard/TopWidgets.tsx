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

import { GripVertical } from "lucide-react";

import Bank from "@/public/icons/bank.svg";
import WinRate from "@/public/icons/winrate.svg";
import WinStreak from "@/public/icons/winstreak.svg";
import ProfitFactor from "@/public/icons/profit-factor.svg";

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
  | "hold-time";

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
  const balance = data?.totalProfit ?? 0;

  return (
    <div
      className={`bg-sidebar h-52 w-full border border-white/5 p-1 flex flex-col group ${
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
        <div className="flex flex-col gap-2.5 p-3.5 h-full justify-end">
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
      className={`bg-sidebar border border-white/5 h-52 w-full p-1 flex flex-col group ${
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
            all-time win rate
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
      className={`bg-sidebar border border-white/5 h-52 w-full p-1 flex flex-col group ${
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
      className={`bg-sidebar border border-white/5 h-52 w-full p-1 flex flex-col group ${
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
              Lifetime profit factor.
            </p>
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
      className={`bg-sidebar border border-white/5 h-52 w-full p-1 flex flex-col group ${
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
              Average hold time
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
  "hold-time": HoldTimeCard,
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
  const emptySlots = 12 - displayWidgets.length;

  // All possible widgets for discovery in edit mode
  const allWidgets: WidgetType[] = [
    "account-balance",
    "win-rate",
    "profit-factor",
    "win-streak",
    "hold-time",
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
                    className="h-52 w-full relative cursor-pointer"
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
              <div className="bg-sidebar border border-white/5 h-full w-full p-1 flex flex-col">
                <div className="flex w-full justify-between items-center p-3.5">
                  <Skeleton className="w-24 h-5 rounded-sm bg-sidebar-accent" />

                  <Skeleton className="w-16 h-5 rounded-sm bg-sidebar-accent" />
                </div>

                <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-150 flex flex-col justify-between h-full w-full">
                  <div className="flex gap-2.5 p-3.5 h-full items-end justify-between">
                    <div className="flex flex-col gap-2">
                      <Skeleton className="w-12 h-4 rounded-sm bg-sidebar" />

                      <Skeleton className="w-24 h-4 rounded-sm bg-sidebar" />
                    </div>

                    <Skeleton className="w-48 h-24 rounded-sm bg-sidebar" />
                  </div>
                </div>
              </div>

              <div className="bg-sidebar border border-white/5 h-full w-full p-1 flex flex-col">
                <div className="flex w-full justify-between items-center p-3.5">
                  <Skeleton className="w-24 h-5 rounded-sm bg-sidebar-accent" />

                  <Skeleton className="w-16 h-5 rounded-sm bg-sidebar-accent" />
                </div>

                <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-150 flex flex-col justify-between h-full w-full">
                  <div className="flex gap-2.5 p-3.5 h-full items-end justify-between">
                    <div className="flex flex-col gap-2">
                      <Skeleton className="w-12 h-4 rounded-sm bg-sidebar" />

                      <Skeleton className="w-24 h-4 rounded-sm bg-sidebar" />
                    </div>

                    <Skeleton className="w-48 h-24 rounded-sm bg-sidebar" />
                  </div>
                </div>
              </div>

              <div className="bg-sidebar border border-white/5 h-full w-full p-1 flex flex-col">
                <div className="flex w-full justify-between items-center p-3.5">
                  <Skeleton className="w-24 h-5 rounded-sm bg-sidebar-accent" />

                  <Skeleton className="w-16 h-5 rounded-sm bg-sidebar-accent" />
                </div>

                <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-150 flex flex-col justify-between h-full w-full">
                  <div className="flex gap-2.5 px-6 py-3 h-full items-end justify-between">
                    <div className="flex flex-col gap-2">
                      <Skeleton className="w-12 h-4 rounded-sm bg-sidebar" />

                      <Skeleton className="w-24 h-4 rounded-sm bg-sidebar" />
                    </div>

                    <Skeleton className="w-48 h-24 rounded-sm bg-sidebar" />
                  </div>
                </div>
              </div>

              <div className="bg-sidebar rounded-sm h-full w-full p-1 flex flex-col">
                <div className="flex w-full justify-between items-center px-6 py-4">
                  <Skeleton className="w-24 h-5 rounded-sm bg-sidebar-accent" />

                  <Skeleton className="w-20 h-5 rounded-sm bg-sidebar-accent" />
                </div>

                <div className="bg-white dark:bg-sidebar-accent dark:hover:brightness-120 transition-all duration-150 rounded-b-sm rounded-t-md flex flex-col justify-between h-full w-full">
                  <div className="flex gap-2.5 px-6 pb-3 h-full items-end justify-between">
                    <div className="flex flex-col gap-2">
                      <Skeleton className="w-12 h-4 rounded-sm bg-sidebar" />

                      <Skeleton className="w-24 h-4 rounded-sm bg-sidebar" />
                    </div>

                    <Skeleton className="w-48 h-24 rounded-sm bg-sidebar" />
                  </div>
                </div>
              </div>
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
                className="bg-sidebar border border-white/5 h-52 w-full p-1 flex flex-col"
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
