"use client";

import { TrendingDown } from "lucide-react";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ChartConfig } from "@/components/ui/chart";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import React, { useEffect, useMemo, useState } from "react";
import { trpcClient } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const description = "A bar chart";

type LossRow = {
  symbol: string;
  profitLoss: number;
  commissionsLoss: number;
  swapLoss: number;
  totalLoss: number;
};

const chartConfig = {
  profitLoss: { label: "Loss", color: "#F76290" },
  commissionsLoss: { label: "Commissions", color: "#A1A1AA" },
  swapLoss: { label: "Swap", color: "#6B7280" },
} satisfies ChartConfig;

type ActiveProperty = keyof typeof chartConfig | "all";

// Shared tooltip line formatter with $ prefix and non-mono font
const formatLossTooltip = (value: any, name: any, item: any) => {
  const label =
    chartConfig[name as keyof typeof chartConfig]?.label || String(name);
  const color = item?.color || item?.payload?.fill;
  const formatted = `$${Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
  return (
    <div className="flex w-full items-center gap-2">
      <div className="flex flex-1 justify-between items-center leading-none">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium" style={{ color }}>
          {formatted}
        </span>
      </div>
    </div>
  );
};

export function GlowingBarVerticalChart() {
  const [activeProperty, setActiveProperty] =
    React.useState<ActiveProperty>("all");
  const accountId = useAccountStore((s) => s.selectedAccountId);
  const [rows, setRows] = useState<LossRow[]>([]);
  const [loading, setLoading] = useState(false);

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

  const chartData = useMemo(() => rows, [rows]);
  const tooltipFormatter = formatLossTooltip;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-row justify-between">
          <CardTitle>
            Total losses by asset
            <Badge
              variant="outline"
              className="text-red-500 bg-red-500/10 border-none ml-2"
            >
              <TrendingDown className="h-4 w-4" />
              <span>Losses</span>
            </Badge>
          </CardTitle>
          <Select
            value={activeProperty}
            onValueChange={(value: ActiveProperty) => {
              setActiveProperty(value);
            }}
          >
            <SelectTrigger className="text-xs !h-6 !px-1.5">
              <SelectValue placeholder="Select a property" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                <SelectLabel>Properties</SelectLabel>
                <SelectItem className="text-xs" value="all">
                  All
                </SelectItem>
                <SelectItem className="text-xs" value="desktop">
                  Desktop
                </SelectItem>
                <SelectItem className="text-xs" value="mobile">
                  Mobile
                </SelectItem>
                <SelectItem className="text-xs" value="tablet">
                  Tablet
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <CardDescription>All-time aggregated losses</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="w-full aspect-auto h-72 overflow-y-auto"
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            layout="vertical"
            margin={{
              left: -15,
            }}
          >
            <CartesianGrid strokeDasharray="8 8" horizontal={false} />
            <YAxis
              type="category"
              dataKey="symbol"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <XAxis
              type="number"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              hide
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  className="min-w-[14rem] max-w-[22rem] max-h-56 overflow-y-auto"
                  labelClassName="border-b border-white/10 dark:border-white/10 pb-2 mb-2"
                  hideIndicator
                  formatter={formatLossTooltip}
                />
              }
            />
            <Bar
              stackId="a"
              barSize={8}
              className="dark:text-[#1A1A1C] text-[#E4E4E7]"
              dataKey="profitLoss"
              fill="var(--color-profitLoss)"
              radius={0}
              shape={<CustomGradientBar activeProperty={activeProperty} />}
              background={{ fill: "currentColor", radius: 0 }}
              overflow="visible"
            />
            <Bar
              stackId="a"
              barSize={8}
              shape={<CustomGradientBar activeProperty={activeProperty} />}
              dataKey="commissionsLoss"
              fill="var(--color-commissionsLoss)"
              radius={0}
              overflow="visible"
            />
            <Bar
              stackId="a"
              barSize={8}
              shape={<CustomGradientBar activeProperty={activeProperty} />}
              dataKey="swapLoss"
              fill="var(--color-swapLoss)"
              radius={0}
              overflow="visible"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

const CustomGradientBar = (
  props: React.SVGProps<SVGRectElement> & {
    dataKey?: string;
    activeProperty?: ActiveProperty | null;
    glowOpacity?: number;
  }
) => {
  const { fill, x, y, width, height, dataKey, activeProperty, radius } = props;

  const isActive = activeProperty === "all" ? true : activeProperty === dataKey;

  return (
    <>
      <rect
        x={x}
        y={y}
        rx={radius}
        width={width}
        height={height}
        stroke="none"
        fill={fill}
        opacity={isActive ? 1 : 0.1}
        filter={
          isActive && activeProperty !== "all"
            ? `url(#glow-chart-${dataKey})`
            : undefined
        }
      />
      <defs>
        <filter
          id={`glow-chart-${dataKey}`}
          x="-200%"
          y="-200%"
          width="600%"
          height="600%"
        >
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
    </>
  );
};

// Lightweight chart-only component for embedding in widgets
export function TotalLossesChart() {
  const accountId = useAccountStore((s) => s.selectedAccountId);
  const [rows, setRows] = useState<LossRow[]>([]);
  useEffect(() => {
    (async () => {
      if (!accountId) return;
      try {
        const data = await trpcClient.accounts.lossesByAssetRange.query({
          accountId,
        });
        setRows(Array.isArray(data) ? (data as LossRow[]) : []);
      } catch {}
    })();
  }, [accountId]);

  return (
    <ChartContainer
      config={chartConfig}
      className="w-full h-[150px] aspect-auto overflow-y-auto"
    >
      <BarChart
        accessibilityLayer
        data={rows}
        layout="vertical"
        margin={{ left: 8 }}
      >
        <YAxis
          type="category"
          dataKey="symbol"
          tickLine={false}
          tickMargin={8}
          axisLine={false}
        />
        <XAxis
          type="number"
          tickLine={false}
          tickMargin={8}
          axisLine={false}
          hide
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              className="min-w-[14rem] max-w-[22rem] max-h-56 overflow-y-auto"
              labelClassName="border-b border-white/10 dark:border-white/10 pb-2 mb-2"
              formatter={formatLossTooltip}
            />
          }
        />
        <Bar
          stackId="a"
          barSize={8}
          dataKey="profitLoss"
          fill="var(--color-profitLoss)"
          radius={0}
        />
        <Bar
          stackId="a"
          barSize={8}
          dataKey="commissionsLoss"
          fill="var(--color-commissionsLoss)"
          radius={0}
        />
        <Bar
          stackId="a"
          barSize={8}
          dataKey="swapLoss"
          fill="var(--color-swapLoss)"
          radius={0}
        />
      </BarChart>
    </ChartContainer>
  );
}
