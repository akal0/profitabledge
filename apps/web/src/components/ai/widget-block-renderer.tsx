"use client";

/**
 * Widget Block Renderer for AI Assistant
 *
 * Renders visualizations in the AI analysis panel using either:
 * 1. Existing dashboard components (with data passed as props)
 * 2. Lightweight embedded versions for the analysis panel
 *
 * Maps VizSpec from the AI to appropriate visual components.
 */

import React from "react";
import { cn } from "@/lib/utils";
import type { VizSpec, VizDataConfig } from "@/types/assistant-stream";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar,
  BarChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Calendar, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DailyNetCard,
  PerformanceWeekdayCard,
} from "@/components/dashboard/chart-widgets";
import {
  BaseBarChart,
  BaseAreaChart,
  BaseKpiSingle,
  BaseKpiGrid,
  BaseComparisonCard,
  BaseTable,
} from "./charts";

interface WidgetBlockRendererProps {
  viz: VizSpec;
  className?: string;
  onViewTrades?: (tradeIds: string[]) => void;
  accountId?: string;
}

export function WidgetBlockRenderer({
  viz,
  className,
  onViewTrades,
  accountId,
}: WidgetBlockRendererProps) {
  const { type, data, title, subtitle, style, mode } = viz;
  const cardTitle = formatCardTitle(title);

  if (type === "weekday_performance") {
    return (
      <PerformanceWeekdayCard
        accountId={accountId}
        className="bg-transparent border-none p-0"
        hideComparison={true}
      />
    );
  }

  if (type === "daily_pnl") {
    return <DailyNetCard accountId={accountId} hideComparison={true} />;
  }

  return (
    <AnalysisWidgetShell
      title={cardTitle}
      subtitle={subtitle}
      mode={mode}
      className={className}
    >
      {renderVisualization(type, data, style, mode, title, onViewTrades)}
    </AnalysisWidgetShell>
  );
}

function renderVisualization(
  type: VizSpec["type"],
  data: VizDataConfig,
  style: VizSpec["style"],
  mode: VizSpec["mode"],
  title?: string,
  onViewTrades?: (tradeIds: string[]) => void
) {
  switch (type) {
    case "kpi_single":
      return <KPISingleViz data={data} style={style} />;
    case "kpi_grid":
      return <KPIGridViz data={data} />;
    case "bar_chart":
      return <BarChartViz data={data} style={style} mode={mode} />;
    case "asset_profitability":
      return <AssetProfitabilityViz data={data} title={title} />;
    case "horizontal_bar":
    case "losses_breakdown":
      return <HorizontalBarViz data={data} style={style} />;
    case "area_chart":
    case "weekday_performance":
      return <AreaChartViz data={data} style={style} variant="default" />;
    case "daily_pnl":
      return <AreaChartViz data={data} style={style} variant="daily_pnl" />;
    case "comparison_bar":
      return <ComparisonViz data={data} />;
    case "trade_table":
    case "breakdown_table":
      return <TableViz data={data} onViewTrades={onViewTrades} />;
    case "calendar":
      return <CalendarPreviewViz data={data} onViewTrades={onViewTrades} />;
    case "win_rate_card":
      return <WinRateViz data={data} />;
    case "trade_counts":
      return <TradeCountsViz data={data} />;
    case "text_answer":
    default:
      return null;
  }
}

// ===== VISUALIZATION COMPONENTS =====

function KPISingleViz({
  data,
}: {
  data: VizDataConfig;
  style?: VizSpec["style"];
}) {
  return (
    <BaseKpiSingle
      value={data.value ?? 0}
      label={data.label}
      change={data.change}
      changeLabel={data.changeLabel}
      tradeCount={data.summary?.count}
    />
  );
}

function KPIGridViz({ data }: { data: VizDataConfig }) {
  return <BaseKpiGrid items={data.rows || []} />;
}

function BarChartViz({
  data,
  mode,
}: {
  data: VizDataConfig;
  style?: VizSpec["style"];
  mode: VizSpec["mode"];
}) {
  const rows = data.rows || [];
  const chartData = rows.map((r: any) => ({
    name: r.label || r.name || r[data.xAxis || "label"],
    value: r.value || r[data.yAxis || "value"] || 0,
  }));

  return (
    <BaseBarChart
      data={chartData}
      mode={mode}
      summary={data.summary}
    />
  );
}

function AssetProfitabilityViz({
  data,
  title,
}: {
  data: VizDataConfig;
  title?: string;
}) {
  const rows = data.rows || [];
  const rawData = rows.map((r: any) => ({
    asset: r.label || r.name || r[data.xAxis || "label"],
    profit: r.value || r[data.yAxis || "value"] || 0,
  }));

  const chartData = React.useMemo(() => {
    if (rawData.length <= 1) return rawData;

    const titleLower = (title || "").toLowerCase();
    const wantsLeast =
      titleLower.includes("least") ||
      titleLower.includes("worst") ||
      titleLower.includes("lowest");
    const wantsMost =
      titleLower.includes("most") ||
      titleLower.includes("best") ||
      titleLower.includes("top");

    const values = rawData.map((d) => Number(d.profit) || 0);
    const isAsc = values.every((v, i, arr) => i === 0 || arr[i - 1] <= v);
    const isDesc = values.every((v, i, arr) => i === 0 || arr[i - 1] >= v);

    if (isAsc || isDesc) return rawData;

    if (wantsLeast && !wantsMost) {
      return [...rawData].sort((a, b) => Number(a.profit) - Number(b.profit));
    }

    return [...rawData].sort((a, b) => Number(b.profit) - Number(a.profit));
  }, [rawData, title]);

  const [activeIndex, setActiveIndex] = React.useState<number | undefined>(
    undefined
  );

  const bestWorst = React.useMemo(() => {
    if (!chartData.length) return null;
    let best = chartData[0];
    let worst = chartData[0];
    for (const row of chartData) {
      if (row.profit > best.profit) best = row;
      if (row.profit < worst.profit) worst = row;
    }
    return { best, worst };
  }, [chartData]);

  const highlightIndex =
    activeIndex ?? (bestWorst ? chartData.indexOf(bestWorst.best) : 0);

  const niceScale = React.useMemo(() => {
    const values = chartData.map((d) => Number(d.profit) || 0);
    let maxAbs = values.length
      ? Math.max(...values.map((v) => Math.abs(v)))
      : 0;

    if (!Number.isFinite(maxAbs) || maxAbs === 0) {
      maxAbs = 100;
    }

    const niceStep = (x: number) => {
      const exp = Math.floor(Math.log10(x));
      const f = x / Math.pow(10, exp);
      let nf = 1;
      if (f <= 1) nf = 1;
      else if (f <= 2) nf = 2;
      else if (f <= 5) nf = 5;
      else nf = 10;
      return nf * Math.pow(10, exp);
    };

    const step = niceStep(maxAbs / 3);
    const max = step * 3;
    const min = -max;
    const ticks = Array.from({ length: 7 }, (_, i) => min + i * step);
    return { min, max, ticks };
  }, [chartData]);

  const currencyTick = (v: number) => {
    const abs = Math.abs(Math.round(v));
    const prefix = v < 0 ? "-$" : "$";
    return `${prefix}${abs.toLocaleString()}`;
  };

  return (
    <div className="space-y-3">
      {bestWorst && chartData.length > 1 && (
        <p className="text-xs text-white/50">
          Most profitable asset:{" "}
          <span className="text-teal-400 font-medium">
            {bestWorst.best.asset} ({bestWorst.best.profit < 0 ? "-$" : "$"}
            {Math.abs(bestWorst.best.profit).toLocaleString()})
          </span>{" "}
          · Least profitable asset:{" "}
          <span className="text-rose-400 font-medium">
            {bestWorst.worst.asset} ({bestWorst.worst.profit < 0 ? "-$" : "$"}
            {Math.abs(bestWorst.worst.profit).toLocaleString()})
          </span>
        </p>
      )}
      {chartData.length === 1 && chartData[0] && (
        <p className="text-xs text-white/50">
          {formatCardTitle(title)}:{" "}
          <span
            className={cn(
              "font-medium",
              Number(chartData[0].profit) < 0
                ? "text-rose-400"
                : "text-teal-400"
            )}
          >
            {chartData[0].asset} (
            {formatCurrency(Number(chartData[0].profit) || 0)})
          </span>
        </p>
      )}

      <div className="h-56 md:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 12, right: 0, left: 20, bottom: -4 }}
            onMouseLeave={() => setActiveIndex(undefined)}
          >
            <CartesianGrid
              vertical={false}
              strokeDasharray="8 8"
              stroke="rgba(255,255,255,0.1)"
            />
            <YAxis
              domain={[niceScale.min, niceScale.max]}
              ticks={niceScale.ticks}
              tickLine={false}
              axisLine={false}
              width={28}
              tickMargin={8}
              tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
              tickFormatter={currencyTick}
            />
            <XAxis
              dataKey="asset"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
              tickFormatter={(value) => String(value).slice(0, 12)}
            />
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const entry = payload[0];
                const v = Number(entry.value ?? 0);
                const sign = v < 0 ? "-$" : "$";
                const asset = entry.payload?.asset ?? "Asset";
                return (
                  <div className="bg-dashboard-background border border-white/10 grid min-w-[16rem] gap-2 border-[0.5px] p-3 px-0 text-xs shadow-xl">
                    <div className="text-[11px] font-medium text-white px-3">
                      Profit
                    </div>
                    <div className="h-px bg-white/10" />
                    <div className="flex w-full justify-between px-3 font-semibold">
                      <span className="text-white/80">{asset}</span>
                      <span
                        className={cn(
                          v < 0 ? "text-rose-400" : "text-teal-400"
                        )}
                      >
                        {sign}
                        {Math.abs(Math.round(v)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="profit" barSize={32} radius={[0, 0, 0, 0]}>
              {chartData.map((entry: any, index: number) => {
                const isActive = index === highlightIndex;
                const hoverFill = entry.profit >= 0 ? "#2dd4bf" : "#fb7185";
                return (
                  <Cell
                    key={index}
                    className="duration-200"
                    opacity={isActive ? 1 : 0.45}
                    onMouseEnter={() => setActiveIndex(index)}
                    fill={isActive ? hoverFill : "#6b7280"}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function HorizontalBarViz({
  data,
  style,
}: {
  data: VizDataConfig;
  style?: VizSpec["style"];
}) {
  const rows = data.rows || [];
  const maxValue = Math.max(
    ...rows.map((r: any) => Math.abs(Number(r?.value ?? 0))),
    1
  );

  return (
    <div className="space-y-4">
      {rows.map((row: any, i: number) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-white/70">{sentenceCase(row.label)}</span>
            <span className="text-rose-400 font-medium">
              -${Math.abs(Number(row?.value ?? 0)).toLocaleString()}
            </span>
          </div>
          <div className="h-2 bg-white/5 overflow-hidden">
            <div
              className="h-full bg-rose-400 transition-all duration-500"
              style={{
                width: `${
                  (Math.abs(Number(row?.value ?? 0)) / maxValue) * 100
                }%`,
              }}
            />
          </div>
        </div>
      ))}

      {data.summary?.total !== undefined && (
        <div className="pt-2 border-t border-white/5 flex justify-between text-xs">
          <span className="text-white/50">Total</span>
          <span className="text-rose-400 font-semibold">
            -${Math.abs(Number(data.summary.total)).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}

function AreaChartViz({
  data,
  variant,
}: {
  data: VizDataConfig;
  style?: VizSpec["style"];
  variant: "default" | "daily_pnl";
}) {
  const rows = data.rows || [];
  const chartData = rows.map((r: any) => ({
    name: r.x || r.date || r.day || r.label,
    value: Number(r.y ?? r.profit ?? r.value ?? 0) || 0,
  }));

  return <BaseAreaChart data={chartData} variant={variant} />;
}

function ComparisonViz({ data }: { data: VizDataConfig }) {
  const comparison = data.comparison;
  if (!comparison) return null;

  const { a, b, delta, deltaPercent } = comparison;
  return (
    <BaseComparisonCard
      a={{
        label: a.label,
        value: typeof a.value === "number" ? a.value : parseFloat(String(a.value)),
        count: a.count,
      }}
      b={{
        label: b.label,
        value: typeof b.value === "number" ? b.value : parseFloat(String(b.value)),
        count: b.count,
      }}
      delta={typeof delta === "number" ? delta : parseFloat(String(delta || "0"))}
      deltaPercent={deltaPercent}
    />
  );
}

function TableViz({
  data,
  onViewTrades,
}: {
  data: VizDataConfig;
  onViewTrades?: (tradeIds: string[]) => void;
}) {
  return (
    <BaseTable
      rows={data.rows || []}
      columns={data.columns}
      tradeIds={data.tradeIds}
      onViewTrades={onViewTrades}
    />
  );
}

function CalendarPreviewViz({
  data,
  onViewTrades,
}: {
  data: VizDataConfig;
  onViewTrades?: (tradeIds: string[]) => void;
}) {
  const rows = data.rows || [];
  const dateRange = data.dateRange;
  const tradeIds = data.tradeIds || [];

  // Group by date for calendar-like display
  const days = rows.slice(0, 14); // Show max 2 weeks

  return (
    <div className="space-y-3">
      {dateRange && (
        <div className="flex items-center gap-2 text-xs text-white/50">
          <Calendar className="w-3 h-3" />
          <span>
            {dateRange.from} to {dateRange.to}
          </span>
        </div>
      )}

      <div className="grid grid-cols-7 gap-1">
        {days.map((day: any, i: number) => {
          const profit = day.profit || 0;
          const isProfit = profit >= 0;
          return (
            <div
              key={i}
              className={cn(
                "aspect-square rounded flex flex-col items-center justify-center text-[10px]",
                isProfit ? "bg-teal-500/20" : "bg-rose-500/20"
              )}
              title={`${day.date}: ${formatCurrency(profit)} (${
                day.count
              } trades)`}
            >
              <span className="text-white/50">
                {new Date(day.date).getDate()}
              </span>
              <span
                className={cn(
                  "font-medium",
                  isProfit ? "text-teal-400" : "text-rose-400"
                )}
              >
                {day.count}
              </span>
            </div>
          );
        })}
      </div>

      {data.summary?.total !== undefined && (
        <div className="flex justify-between text-xs border-t border-white/5 pt-2">
          <span className="text-white/50">{data.summary.count} trades</span>
          <span
            className={cn(
              "font-semibold",
              (data.summary.total || 0) >= 0 ? "text-teal-400" : "text-rose-400"
            )}
          >
            {formatCurrency(data.summary.total || 0)}
          </span>
        </div>
      )}

      {tradeIds.length > 0 && onViewTrades && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => onViewTrades(tradeIds)}
        >
          View trades <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      )}
    </div>
  );
}

function WinRateViz({ data }: { data: VizDataConfig }) {
  const value =
    typeof data.value === "number"
      ? data.value
      : parseFloat(String(data.value || "0"));

  return (
    <div className="flex flex-col items-center py-4">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="42"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="48"
            cy="48"
            r="42"
            stroke="#2dd4bf"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${value * 2.64} 264`}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-white">
            {value.toFixed(0)}%
          </span>
        </div>
      </div>
      <p className="text-sm text-white/50 mt-2">{sentenceCase("Win Rate")}</p>
      {data.summary?.count && (
        <p className="text-[10px] text-white/30">{data.summary.count} trades</p>
      )}
    </div>
  );
}

function TradeCountsViz({ data }: { data: VizDataConfig }) {
  const rows = data.rows || [];

  return (
    <div className="space-y-2">
      {rows.map((row: any, i: number) => (
        <div key={i} className="flex items-center justify-between py-1">
          <span className="text-xs text-white/50">{row.period}</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500/50 rounded-full"
                style={{ width: `${Math.min((row.count / 10) * 100, 100)}%` }}
              />
            </div>
            <span className="text-xs font-medium text-white w-8 text-right">
              {row.count}
            </span>
          </div>
        </div>
      ))}

      {data.summary?.total && (
        <div className="pt-2 border-t border-white/5 text-xs text-white/50 text-center">
          Total: {data.summary.total} trades
        </div>
      )}
    </div>
  );
}

// ===== HELPERS =====

function formatCurrency(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-$" : "$";
  return `${sign}${absValue.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function formatCardTitle(title?: string): string {
  if (!title) return "";
  const trimmed = title.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function sentenceCase(value: string): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function AnalysisWidgetShell({
  title,
  subtitle,
  mode,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  mode?: VizSpec["mode"];
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-sidebar h-full w-full border border-white/5 p-1 flex flex-col group rounded-sm",
        className
      )}
    >
      <div className="flex w-full items-start justify-between gap-3 p-3.5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium text-white/50">
            <span className="normal-case">{title}</span>
          </h2>
          {subtitle && <p className="text-xs text-white/40">{subtitle}</p>}
        </div>
        {mode === "singular" && (
          <Badge
            variant="outline"
            className="text-[10px] font-normal rounded-none px-3 py-1.5"
          >
            Top result
          </Badge>
        )}
      </div>

      <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-150 flex flex-col h-full w-full rounded-sm">
        <div className="flex flex-col p-3.5 h-full">{children}</div>
      </div>
    </div>
  );
}

// ===== LOADING SKELETON =====

export function WidgetBlockSkeleton() {
  return (
    <div className="bg-sidebar h-full w-full border border-white/5 p-1 flex flex-col group rounded-sm">
      <div className="flex w-full items-start justify-between gap-3 p-3.5">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="bg-white dark:bg-sidebar-accent flex flex-col h-full w-full rounded-sm">
        <div className="flex flex-col p-3.5 h-full">
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}
