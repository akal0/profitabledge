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
import Test from "@/public/icons/test.svg";
import { DailyNetBarChart } from "./charts/daily-net";
import CompareSwitch from "./compare-switch";
import { PerformanceWeekdayChart } from "./charts/performance-weekday";
import { useDateRangeStore } from "@/stores/date-range";

// Define your chart widget mapping here. Add/remove keys and components freely.
const chartCardComponents = {
  daily: DailyNetCard,
  performance: PerformanceWeekdayCard,
} as const;

// Widget types are derived from the mapping keys so you don't have to update a separate type
export type ChartWidgetType = keyof typeof chartCardComponents;

// Widgets

export function DailyNetCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-sidebar h-full w-full border border-white/5 p-1 flex flex-col group",
        isEditing ? "animate-tilt-subtle hover:animate-none" : ""
      )}
    >
      <div className="flex w-full gap-1.5 items-center justify-between p-3.5">
        <h2 className="text-sm font-medium flex items-center gap-2 text-white/50">
          <span>Daily net cumulative P&L</span>
        </h2>

        {isEditing ? null : <CompareSwitch ownerId="daily-net" />}
      </div>

      <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-150 flex flex-col h-full w-full">
        <div className="flex flex-col p-3.5 h-full ">
          <DailyNetBarChart accountId={accountId} ownerId="daily-net" />
        </div>
      </div>
    </div>
  );
}

export function PerformanceWeekdayCard({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  const { start, end, min, max } = useDateRangeStore();
  const dayMs = 24 * 60 * 60 * 1000;
  const effectiveRange = (() => {
    if (!start || !end) return undefined;
    const s = new Date(start);
    const e = new Date(end);
    s.setHours(0, 0, 0, 0);
    e.setHours(0, 0, 0, 0);
    const selectedDays = Math.floor((+e - +s) / dayMs) + 1;
    if (selectedDays >= 7) return { start: s, end: e };
    const minD = min ? new Date(min) : undefined;
    const maxD = max ? new Date(max) : undefined;
    minD?.setHours(0, 0, 0, 0);
    maxD?.setHours(0, 0, 0, 0);
    let needed = 7 - selectedDays;
    let newStart = new Date(s);
    let newEnd = new Date(e);
    // Prefer extending forward first
    const afterAvail = maxD ? Math.max(0, Math.floor((+maxD - +e) / dayMs)) : 0;
    const extendFwd = Math.min(needed, afterAvail);
    newEnd.setDate(newEnd.getDate() + extendFwd);
    needed -= extendFwd;
    if (needed > 0) {
      const beforeAvail = minD
        ? Math.max(0, Math.floor((+s - +minD) / dayMs))
        : 0;
      const extendBack = Math.min(needed, beforeAvail);
      newStart.setDate(newStart.getDate() - extendBack);
    }
    return { start: newStart, end: newEnd };
  })();
  return (
    <div
      className={cn(
        "bg-sidebar h-full w-full border border-white/5 p-1 flex flex-col group",
        isEditing ? "animate-tilt-subtle hover:animate-none" : ""
      )}
    >
      <div className="flex w-full gap-1.5 items-center justify-between p-3.5">
        <h2 className="text-sm font-medium flex items-center gap-2 text-white/50">
          <span>Performance by day</span>
        </h2>

        {isEditing ? null : (
          <CompareSwitch
            ownerId="performance-weekday"
            hidePreviousDays={true}
            effectiveRange={effectiveRange}
          />
        )}
      </div>

      <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-150 flex flex-col h-full w-full">
        <div className="flex flex-col p-3.5 h-full ">
          <PerformanceWeekdayChart
            accountId={accountId}
            ownerId="performance-weekday"
          />
        </div>
      </div>
    </div>
  );
}

// ========================
// TopWidgets Container Component
// ========================
export interface ChartWidgetsProps {
  enabledWidgets: ChartWidgetType[];
  accountId?: string;
  isEditing?: boolean;
  onToggleWidget?: (type: ChartWidgetType) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onEnterEdit?: () => void;
}

export function ChartWidgets({
  enabledWidgets,
  accountId,
  isEditing = false,
  onToggleWidget,
  onReorder,
  onEnterEdit,
}: ChartWidgetsProps) {
  // Ensure only 4 widgets maximum
  const displayWidgets = enabledWidgets.slice(0, 4);

  // Fill empty slots with placeholder divs
  const emptySlots = 7 - displayWidgets.length;

  // All possible widgets for discovery in edit mode (derived from mapping)
  const allWidgets: ChartWidgetType[] = Object.keys(
    chartCardComponents
  ) as Array<keyof typeof chartCardComponents> as ChartWidgetType[];

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
    const oldIndex = displayWidgets.indexOf(active.id as ChartWidgetType);
    const newIndex = displayWidgets.indexOf(over.id as ChartWidgetType);
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
        <div className="grid auto-rows-min gap-1.5 md:grid-cols-4 2xl:grid-cols-3 ">
          {accountId ? (
            displayWidgets.map((widgetType, index) => {
              const CardComponent = chartCardComponents[widgetType];
              return (
                <SortableWidget
                  key={`${widgetType}-${index}`}
                  id={widgetType}
                  disabled={!isEditing}
                >
                  <div
                    className="h-124 w-full relative cursor-pointer"
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onClick={() => isEditing && onToggleWidget?.(widgetType)}
                  >
                    {/* checkmark when selected in edit mode */}
                    {isEditing ? (
                      <div className="flex items-center absolute right-5 top-5 z-10 gap-2">
                        <div className="size-6 border border-white/5 flex items-center justify-center">
                          <svg
                            viewBox="0 0 24 24"
                            className="size-3 fill-white"
                          >
                            <path d="M20.285 6.708a1 1 0 0 1 0 1.414l-9 9a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L10.5 14.5l8.293-8.293a1 1 0 0 1 1.492.5z" />
                          </svg>
                        </div>

                        <GripVertical className="size-4 text-white/30" />
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
              const CardComponent = chartCardComponents[widgetType];
              return (
                <div
                  key={`available-${widgetType}-${index}`}
                  className="opacity-50 hover:opacity-100 transition-all duration-150 hover:animate-none"
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
                className="bg-sidebar border border-white/5 h-124 w-full p-1 flex flex-col"
                key={`empty-${index}`}
              >
                <div className="flex w-full justify-between items-center p-3.5">
                  <Skeleton className="w-32 rounded-none h-4 bg-sidebar-accent" />

                  <Skeleton className="w-16 h-4 rounded-none bg-sidebar-accent" />
                </div>

                <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-150 flex flex-col justify-between h-full w-full">
                  <div className="flex flex-col gap-4 p-3.5 h-full justify-between">
                    <div className="flex flex-col gap-1">
                      <Skeleton className="w-12 h-4 rounded-none bg-sidebar" />

                      <Skeleton className="w-24 h-4 rounded-none bg-sidebar" />
                    </div>

                    <Skeleton className="w-full h-48 h-full rounded-none bg-sidebar" />
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
