"use client";

import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
} from "@/components/dashboard/charts/dashboard-chart-ui";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { ChartWidgetFrame } from "@/features/dashboard/charts/components/chart-card-shell";

type BreakdownItem = {
  label: string;
  value: number;
};

function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "$0";
  const absolute = Math.abs(value);
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(absolute);
  return `${value < 0 ? "-" : ""}$${formatted}`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function EdgeChartEmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center rounded-sm border border-dashed border-white/10 bg-sidebar/35 px-4 py-5 text-xs text-white/42">
      {label}
    </div>
  );
}

function EdgeChartCard({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <ChartWidgetFrame
      title={title}
      showShareButton={false}
      className={cn("h-[22rem]", className)}
    >
      <div className="flex h-full min-h-0 w-full flex-col p-3.5">{children}</div>
    </ChartWidgetFrame>
  );
}

const equityChartConfig = {
  equity: { label: "Equity", color: "#00E0C8" },
} satisfies ChartConfig;

export function EdgeEquityCurveCard({
  points,
  className,
}: {
  points: Array<{ index: number; equity: number; label: string }>;
  className?: string;
}) {
  if (points.length === 0) {
    return (
      <EdgeChartCard title="Performance curve" className={className}>
        <EdgeChartEmptyState label="Performance data will appear once this Edge has assigned trades." />
      </EdgeChartCard>
    );
  }

  const rows = points.map((point) => {
    const timestamp = new Date(point.label);
    return {
      index: point.index,
      equity: point.equity,
      axisLabel: Number.isNaN(timestamp.getTime())
        ? `Trade ${point.index}`
        : new Intl.DateTimeFormat("en-GB", {
            day: "2-digit",
            month: "short",
          }).format(timestamp),
    };
  });

  return (
    <EdgeChartCard title="Performance curve" className={className}>
      <ChartContainer config={equityChartConfig} className="h-full min-h-0 w-full">
        <AreaChart data={rows} margin={{ top: 8, right: 10, left: 2, bottom: 0 }}>
          <defs>
            <linearGradient id="edge-equity-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-equity)" stopOpacity={0.36} />
              <stop offset="95%" stopColor="var(--color-equity)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="index"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
            tickMargin={12}
            tickFormatter={(value) => `#${value}`}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
            tickMargin={8}
            tickFormatter={(value) => formatMoney(Number(value))}
            width={68}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="5 5" />
          <ChartTooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) {
                return null;
              }

              const row = payload[0]?.payload as
                | { axisLabel?: string; equity?: number }
                | undefined;
              const value = Number(payload[0]?.value ?? row?.equity ?? 0);

              return (
                <DashboardChartTooltipFrame title={row?.axisLabel ?? "Trade"}>
                  <DashboardChartTooltipRow
                    label="Equity"
                    value={formatMoney(value)}
                    indicatorColor="#00E0C8"
                    tone={value >= 0 ? "positive" : "negative"}
                  />
                </DashboardChartTooltipFrame>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="var(--color-equity)"
            strokeWidth={2}
            fill="url(#edge-equity-gradient)"
            dot={false}
            activeDot={{ r: 3, fill: "var(--color-equity)" }}
          />
          <Line
            type="monotone"
            dataKey="equity"
            stroke="var(--color-equity)"
            strokeWidth={2}
            dot={false}
            activeDot={false}
          />
        </AreaChart>
      </ChartContainer>
    </EdgeChartCard>
  );
}

const breakdownChartConfig = {
  value: { label: "Trades", color: "#6383ff" },
} satisfies ChartConfig;

export function EdgeBreakdownBarCard({
  title,
  items,
  emptyLabel,
  className,
}: {
  title: string;
  items: BreakdownItem[];
  emptyLabel: string;
  className?: string;
}) {
  if (items.length === 0) {
    return (
      <EdgeChartCard title={title} className={className}>
        <EdgeChartEmptyState label={emptyLabel} />
      </EdgeChartCard>
    );
  }

  return (
    <EdgeChartCard title={title} className={className}>
      <ChartContainer
        config={breakdownChartConfig}
        className="h-full min-h-0 w-full"
      >
        <BarChart data={items} margin={{ top: 8, right: 6, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
            tickMargin={12}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
            tickMargin={8}
            width={26}
          />
          <ChartTooltip
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) {
                return null;
              }

              const row = payload[0]?.payload as BreakdownItem | undefined;
              const value = Number(payload[0]?.value ?? row?.value ?? 0);

              return (
                <DashboardChartTooltipFrame title={row?.label ?? title}>
                  <DashboardChartTooltipRow
                    label="Trades"
                    value={`${value.toLocaleString()} trades`}
                    indicatorColor="#6383ff"
                  />
                </DashboardChartTooltipFrame>
              );
            }}
          />
          <Bar
            dataKey="value"
            fill="var(--color-value)"
            fillOpacity={0.9}
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </EdgeChartCard>
  );
}

const rSpreadChartConfig = {
  count: { label: "Trades", color: "#6383ff" },
  cumulative: { label: "Cumulative", color: "#FCA070" },
} satisfies ChartConfig;

function parseBucketStart(label: string) {
  const match = label.match(/(-?\d+(?:\.\d+)?)R/);
  return match ? Number(match[1]) : 0;
}

export function EdgeRMultipleSpreadCard({
  items,
  className,
}: {
  items: BreakdownItem[];
  className?: string;
}) {
  if (items.length === 0) {
    return (
      <EdgeChartCard title="R-multiple spread" className={className}>
        <EdgeChartEmptyState label="R distribution will appear once realised R values are available." />
      </EdgeChartCard>
    );
  }

  const ordered = [...items]
    .sort(
      (left, right) => parseBucketStart(left.label) - parseBucketStart(right.label)
    )
    .map((item, index, source) => {
      const total = source.reduce((sum, current) => sum + current.value, 0);
      const runningTotal = source
        .slice(0, index + 1)
        .reduce((sum, current) => sum + current.value, 0);

      return {
        ...item,
        cumulative: total > 0 ? (runningTotal / total) * 100 : 0,
      };
    });

  return (
    <EdgeChartCard title="R-multiple spread" className={className}>
      <ChartContainer
        config={rSpreadChartConfig}
        className="h-full min-h-0 w-full"
      >
        <ComposedChart data={ordered} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
            tickMargin={12}
          />
          <YAxis
            yAxisId="left"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
            tickMargin={8}
            width={32}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
            tickMargin={8}
            tickFormatter={(value) => `${Math.round(Number(value))}%`}
            width={46}
          />
          <ReferenceLine yAxisId="right" y={50} stroke="rgba(255,255,255,0.14)" strokeDasharray="5 5" />
          <ChartTooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) {
                return null;
              }

              const row = payload[0]?.payload as
                | (BreakdownItem & { cumulative: number })
                | undefined;

              return (
                <DashboardChartTooltipFrame title={`${row?.label ?? "R"} bucket`}>
                  <DashboardChartTooltipRow
                    label="Trades"
                    value={`${Number(row?.value ?? 0).toLocaleString()} trades`}
                    indicatorColor="#6383ff"
                  />
                  <DashboardChartTooltipRow
                    label="Cumulative"
                    value={formatPercent(Number(row?.cumulative ?? 0))}
                    indicatorColor="#FCA070"
                    tone="accent"
                  />
                </DashboardChartTooltipFrame>
              );
            }}
          />
          <Bar
            yAxisId="left"
            dataKey="value"
            fill="var(--color-count)"
            fillOpacity={0.86}
            radius={[6, 6, 0, 0]}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="cumulative"
            stroke="var(--color-cumulative)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: "var(--color-cumulative)" }}
          />
        </ComposedChart>
      </ChartContainer>
    </EdgeChartCard>
  );
}
