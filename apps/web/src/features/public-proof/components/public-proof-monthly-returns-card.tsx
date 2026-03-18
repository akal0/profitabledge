"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";

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

const chartConfig = {
  pnl: {
    label: "Monthly return",
    color: "#00E0C8",
  },
} satisfies ChartConfig;

type MonthlyReturnRow = {
  label: string;
  pnl: number;
  trades: number;
  winRate: number;
};

export function PublicProofMonthlyReturnsCard({
  rows,
  currencyCode,
}: {
  rows: MonthlyReturnRow[];
  currencyCode?: string | null;
}) {
  return (
    <WidgetWrapper
      className="h-[28rem] w-full"
      header={
        <div className="widget-header flex h-[66px] w-full items-center gap-3 px-3.5 py-3.5">
          <h2 className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium text-white/50 transition-all duration-250 group-hover:text-white">
            <span className="truncate">Monthly returns</span>
          </h2>
        </div>
      }
      contentClassName="flex h-full min-h-0 w-full rounded-sm"
    >
      {rows.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-white/40">
          No monthly history yet
        </div>
      ) : (
        <div className="flex h-full w-full min-h-0 flex-col">
          <div className="flex-1 min-h-0 px-3 pb-3 pt-2">
            <ChartContainer
              config={chartConfig}
              className="h-full w-full !aspect-auto"
            >
              <BarChart
                data={rows}
                margin={{ top: 20, right: 8, left: 8, bottom: 0 }}
              >
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
                      | MonthlyReturnRow
                      | undefined;

                    if (!point) return null;

                    return (
                      <DashboardChartTooltipFrame title={point.label}>
                        <DashboardChartTooltipRow
                          label="P&L"
                          value={formatSignedCurrency(
                            Number(point.pnl),
                            2,
                            currencyCode
                          )}
                          indicatorColor={
                            point.pnl >= 0 ? "#00E0C8" : "#F43F5E"
                          }
                        />
                        <DashboardChartTooltipRow
                          label="Trades"
                          value={String(point.trades)}
                          indicatorColor="#94A3B8"
                        />
                        <DashboardChartTooltipRow
                          label="Win rate"
                          value={`${point.winRate.toFixed(1)}%`}
                          indicatorColor="#38BDF8"
                        />
                      </DashboardChartTooltipFrame>
                    );
                  }}
                />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="pnl"
                    position="top"
                    formatter={(value: number) =>
                      formatSignedCurrency(Number(value), 0, currencyCode)
                    }
                    style={{
                      fill: "rgba(255,255,255,0.5)",
                      fontSize: "12px",
                    }}
                  />
                  {rows.map((row) => (
                    <Cell
                      key={row.label}
                      fill={row.pnl >= 0 ? "#00E0C8" : "#F43F5E"}
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        </div>
      )}
    </WidgetWrapper>
  );
}
