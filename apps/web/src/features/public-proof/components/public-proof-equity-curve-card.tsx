"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
  equity: {
    label: "Equity",
    color: "#00E0C8",
  },
} satisfies ChartConfig;

type PublicProofCurvePoint = {
  x: string;
  y: number;
};

export function PublicProofEquityCurveCard({
  points,
  currencyCode,
}: {
  points: PublicProofCurvePoint[];
  currencyCode?: string | null;
}) {
  const chartData = points.map((point) => ({
    label: formatShortDate(point.x),
    tooltipDate: formatTimestamp(point.x),
    equity: point.y,
  }));

  const values = chartData.map((point) => point.equity);
  const minEquity = values.length > 0 ? Math.min(...values) : 0;
  const maxEquity = values.length > 0 ? Math.max(...values) : 0;
  const equityRange = maxEquity - minEquity;
  const padding =
    equityRange > 0
      ? equityRange * 0.1
      : Math.max(Math.abs(maxEquity) * 0.1, 100);
  const yMin = minEquity - padding;
  const yMax = maxEquity + padding;

  return (
    <WidgetWrapper
      className="h-[28rem] w-full"
      header={
        <div className="widget-header flex h-[66px] w-full items-center gap-3 px-3.5 py-3.5">
          <h2 className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium text-white/50 transition-all duration-250 group-hover:text-white">
            <span className="truncate">Equity curve</span>
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
                    id="publicProofEquityGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#00E0C8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00E0C8" stopOpacity={0} />
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
                  domain={[yMin, yMax]}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={56}
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
                          equity: number;
                        }
                      | undefined;

                    if (!point) return null;

                    return (
                      <DashboardChartTooltipFrame title={point.tooltipDate}>
                        <DashboardChartTooltipRow
                          label="Equity"
                          value={formatSignedCurrency(Number(point.equity), 2, currencyCode)}
                          indicatorColor="#00E0C8"
                        />
                      </DashboardChartTooltipFrame>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="equity"
                  stroke="#00E0C8"
                  strokeWidth={2}
                  fill="url(#publicProofEquityGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#00E0C8" }}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>
      )}
    </WidgetWrapper>
  );
}
