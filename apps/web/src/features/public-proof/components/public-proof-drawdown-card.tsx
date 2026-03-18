"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";

import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
  formatSignedCurrency,
} from "@/components/dashboard/charts/dashboard-chart-ui";
import { WidgetWrapper } from "@/components/dashboard/widget-wrapper";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  formatShortDate,
  formatTimestamp,
} from "@/features/public-proof/lib/public-proof-formatters";

const chartConfig = {
  drawdown: {
    label: "Drawdown",
    color: "#F43F5E",
  },
} satisfies ChartConfig;

type PublicProofCurvePoint = {
  x: string;
  y: number;
};

export function PublicProofDrawdownCard({
  points,
  baseline = 0,
  currencyCode,
}: {
  points: PublicProofCurvePoint[];
  baseline?: number;
  currencyCode?: string | null;
}) {
  const chartData = points.map((point) => ({
    label: formatShortDate(point.x),
    tooltipDate: formatTimestamp(point.x),
    drawdown: point.y,
  }));

  const values = chartData.map((point) => point.drawdown);
  const minValue = values.length > 0 ? Math.min(...values) : baseline;
  // Y-axis top is always the initialBalance (zero-drawdown baseline)
  const peakValue = baseline;
  const valueRange = peakValue - minValue;
  const padding =
    valueRange > 0
      ? valueRange * 0.1
      : Math.max(Math.abs(peakValue) * 0.1, 100);

  return (
    <WidgetWrapper
      className="h-[28rem] w-full"
      header={
        <div className="widget-header flex h-[66px] w-full items-center gap-3 px-3.5 py-3.5">
          <h2 className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium text-white/50 transition-all duration-250 group-hover:text-white">
            <span className="truncate">Drawdown curve</span>
          </h2>
        </div>
      }
      contentClassName="flex h-full min-h-0 w-full rounded-sm"
    >
      {chartData.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-white/40">
          No closed trades yet
        </div>
      ) : (
        <div className="flex h-full w-full min-h-0 flex-col">
          <div className="flex-1 min-h-0 px-3 pb-3 pt-2">
            <ChartContainer
              config={chartConfig}
              className="h-full w-full !aspect-auto"
            >
              <AreaChart
                data={chartData}
                margin={{ top: 12, right: 8, left: 8, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="publicProofDrawdownGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="8 8" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                  tickMargin={10}
                  tick={{ fill: "rgba(255,255,255,0.4)" }}
                />
                <YAxis
                  domain={[minValue - padding, peakValue]}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={64}
                  tick={{ fill: "rgba(255,255,255,0.4)" }}
                  tickFormatter={(value) =>
                    formatSignedCurrency(Number(value), 0, currencyCode)
                  }
                />
                <ChartTooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0]?.payload as
                      | {
                          tooltipDate: string;
                          drawdown: number;
                        }
                      | undefined;

                    if (!point) return null;

                    return (
                      <DashboardChartTooltipFrame title={point.tooltipDate}>
                        <DashboardChartTooltipRow
                          label="Drawdown"
                          value={formatSignedCurrency(
                            Number(point.drawdown),
                            2,
                            currencyCode
                          )}
                          indicatorColor="#F43F5E"
                        />
                      </DashboardChartTooltipFrame>
                    );
                  }}
                />
                <ReferenceLine
                  y={peakValue}
                  stroke="rgba(255,255,255,0.12)"
                  strokeDasharray="4 4"
                />
                <Area
                  type="monotone"
                  dataKey="drawdown"
                  stroke="#F43F5E"
                  strokeWidth={2}
                  fill="url(#publicProofDrawdownGradient)"
                  baseValue={peakValue}
                  dot={false}
                  activeDot={{ r: 4, fill: "#F43F5E" }}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>
      )}
    </WidgetWrapper>
  );
}
