"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BarChart3,
  Clock3,
  Tags,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import {
  DashboardTradeFiltersBar,
  DashboardTradeFiltersProvider,
  useDashboardTradeFilters,
} from "@/features/dashboard/filters/dashboard-trade-filters";
import {
  getAvailableDashboardCurrencyCodes,
  resolveDashboardCurrencyCode,
} from "@/features/dashboard/home/lib/dashboard-currency";
import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
} from "@/components/dashboard/charts/dashboard-chart-ui";
import { DailyNetBarChart } from "@/components/dashboard/charts/daily-net";
import { PerformingAssetsBarChart } from "@/components/dashboard/charts/performing-assets";
import { WidgetWrapper } from "@/components/dashboard/widget-wrapper";
import { ChartWidgetFrame } from "@/features/dashboard/charts/components/chart-card-shell";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { useAccountCatalog } from "@/features/accounts/hooks/use-account-catalog";
import {
  GoalContentSeparator,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { formatSignedCurrencyValue } from "@/features/dashboard/widgets/lib/widget-shared";
import {
  createSymbolGroupDisplayMap,
  getSymbolGroupKey,
} from "@/lib/symbol-grouping";
import { isAllAccountsScope, useAccountStore } from "@/stores/account";
import { cn } from "@/lib/utils";

type TradeLike = {
  id: string;
  symbol?: string | null;
  rawSymbol?: string | null;
  symbolGroup?: string | null;
  profit?: number | null;
  realisedRR?: number | null;
  open?: string | null;
  sessionTag?: string | null;
  modelTag?: string | null;
  customTags?: string[];
};

type MetricRow = {
  label: string;
  trades: number;
  pnl: number;
  winRate: number;
  avgRR?: number | null;
};

type DistributionRow = MetricRow & {
  share: number;
  fill: string;
};

type RechartsTooltipProps = React.ComponentProps<typeof ChartTooltip>;

const POSITIVE_COLOR = "#14b8a6";
const NEGATIVE_COLOR = "#f43f5e";
const ACCENT_COLOR = "#f59e0b";
const SECONDARY_COLOR = "#60a5fa";
const PIE_COLORS = [
  "#14b8a6",
  "#60a5fa",
  "#f59e0b",
  "#f43f5e",
  "#a78bfa",
  "#22c55e",
];

function formatHourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatPercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`;
}

function formatRR(value: number | null | undefined) {
  return value != null && Number.isFinite(value) ? `${value.toFixed(2)}R` : "—";
}

function getValueTone(value: number) {
  if (value > 0) return "positive" as const;
  if (value < 0) return "negative" as const;
  return "default" as const;
}

function hasMetricData(rows: MetricRow[]) {
  return rows.some((row) => row.trades > 0);
}

function getTooltipRow(
  payload: RechartsTooltipProps["payload"]
): MetricRow | DistributionRow | null {
  const row = payload?.[0]?.payload;
  return row && typeof row === "object"
    ? (row as MetricRow | DistributionRow)
    : null;
}

function getDistributionTooltipRow(
  payload: RechartsTooltipProps["payload"]
): DistributionRow | null {
  const row = getTooltipRow(payload);
  return row && "share" in row && "fill" in row
    ? (row as DistributionRow)
    : null;
}

function buildDistributionRows(
  rows: MetricRow[],
  limit = 5
): DistributionRow[] {
  const filtered = rows
    .filter((row) => row.trades > 0)
    .sort((left, right) => right.trades - left.trades);

  if (filtered.length === 0) {
    return [];
  }

  const visible = filtered.slice(0, limit);
  const overflow = filtered.slice(limit);

  if (overflow.length > 0) {
    const overflowTrades = overflow.reduce((sum, row) => sum + row.trades, 0);
    const overflowWins = overflow.reduce(
      (sum, row) => sum + row.trades * (row.winRate / 100),
      0
    );

    visible.push({
      label: "Other",
      trades: overflowTrades,
      pnl: overflow.reduce((sum, row) => sum + row.pnl, 0),
      winRate: overflowTrades > 0 ? (overflowWins / overflowTrades) * 100 : 0,
      avgRR: null,
    });
  }

  const totalTrades = visible.reduce((sum, row) => sum + row.trades, 0);

  return visible.map((row, index) => ({
    ...row,
    share: totalTrades > 0 ? (row.trades / totalTrades) * 100 : 0,
    fill: PIE_COLORS[index % PIE_COLORS.length],
  }));
}

function groupByHour(trades: TradeLike[]) {
  return Array.from({ length: 24 }, (_, hour) => {
    const matchingTrades = trades.filter((trade) => {
      if (!trade.open) return false;
      return new Date(trade.open).getHours() === hour;
    });
    const profits = matchingTrades.map((trade) => Number(trade.profit ?? 0));
    const rrValues = matchingTrades
      .map((trade) => Number(trade.realisedRR))
      .filter((value) => Number.isFinite(value));

    return {
      label: formatHourLabel(hour),
      trades: matchingTrades.length,
      pnl: profits.reduce((sum, value) => sum + value, 0),
      winRate:
        matchingTrades.length > 0
          ? (profits.filter((profit) => profit > 0).length /
              matchingTrades.length) *
            100
          : 0,
      avgRR:
        rrValues.length > 0
          ? rrValues.reduce((sum, value) => sum + value, 0) / rrValues.length
          : null,
    };
  });
}

function groupByWeekday(trades: TradeLike[]) {
  const weekdays = [
    { label: "Mon", dayIndex: 1 },
    { label: "Tue", dayIndex: 2 },
    { label: "Wed", dayIndex: 3 },
    { label: "Thu", dayIndex: 4 },
    { label: "Fri", dayIndex: 5 },
    { label: "Sat", dayIndex: 6 },
    { label: "Sun", dayIndex: 0 },
  ];

  return weekdays.map(({ label, dayIndex }) => {
    const matchingTrades = trades.filter((trade) => {
      if (!trade.open) return false;
      return new Date(trade.open).getDay() === dayIndex;
    });
    const profits = matchingTrades.map((trade) => Number(trade.profit ?? 0));

    return {
      label,
      trades: matchingTrades.length,
      pnl: profits.reduce((sum, value) => sum + value, 0),
      winRate:
        matchingTrades.length > 0
          ? (profits.filter((profit) => profit > 0).length /
              matchingTrades.length) *
            100
          : 0,
      avgRR: null,
    };
  });
}

function groupByLabel(
  trades: TradeLike[],
  getLabel: (trade: TradeLike) => string[]
) {
  const map = new Map<string, { trades: number; wins: number; pnl: number }>();

  for (const trade of trades) {
    const labels = getLabel(trade);
    for (const label of labels) {
      const current = map.get(label) ?? { trades: 0, wins: 0, pnl: 0 };
      const profit = Number(trade.profit ?? 0);
      current.trades += 1;
      current.pnl += profit;
      if (profit > 0) {
        current.wins += 1;
      }
      map.set(label, current);
    }
  }

  return Array.from(map.entries())
    .map(([label, value]) => ({
      label,
      trades: value.trades,
      pnl: value.pnl,
      winRate: value.trades > 0 ? (value.wins / value.trades) * 100 : 0,
      avgRR: null,
    }))
    .sort((left, right) => right.trades - left.trades)
    .slice(0, 12);
}

function groupBySymbol(trades: TradeLike[]) {
  const displayMap = createSymbolGroupDisplayMap(trades);
  const grouped = new Map<
    string,
    { label: string; trades: number; wins: number; pnl: number }
  >();

  for (const trade of trades) {
    const groupKey = getSymbolGroupKey(trade);
    const label = displayMap.get(groupKey) ?? groupKey;
    const current = grouped.get(groupKey) ?? {
      label,
      trades: 0,
      wins: 0,
      pnl: 0,
    };
    const profit = Number(trade.profit ?? 0);

    current.trades += 1;
    current.pnl += profit;
    if (profit > 0) {
      current.wins += 1;
    }

    grouped.set(groupKey, current);
  }

  return Array.from(grouped.values())
    .map((value) => ({
      label: value.label,
      trades: value.trades,
      pnl: value.pnl,
      winRate: value.trades > 0 ? (value.wins / value.trades) * 100 : 0,
      avgRR: null,
    }))
    .sort((left, right) => Math.abs(right.pnl) - Math.abs(left.pnl))
    .slice(0, 10);
}

function ReportCard({
  title,
  icon: Icon,
  children,
  className,
  contentClassName,
}: {
  title: string;
  icon: typeof BarChart3;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <WidgetWrapper
      showHeader
      icon={Icon}
      title={title}
      className={cn("h-[26rem] rounded-lg p-1", className)}
      contentClassName="flex min-h-0 flex-col overflow-visible rounded-sm"
    >
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col px-4 pb-4 pt-2",
          contentClassName
        )}
      >
        {children}
      </div>
    </WidgetWrapper>
  );
}

function ReportsStatCard({
  icon: Icon,
  label,
  value,
  iconClassName,
  valueClassName,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  iconClassName?: string;
  valueClassName?: string;
}) {
  return (
    <GoalSurface>
      <div className="p-3.5">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4 text-white/50", iconClassName)} />
          <span className="text-xs text-white/50">{label}</span>
        </div>
        <GoalContentSeparator className="mb-3.5 mt-3.5" />
        <div
          className={cn("text-2xl font-semibold text-white", valueClassName)}
        >
          {value}
        </div>
      </div>
    </GoalSurface>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[16rem] items-center justify-center rounded-sm border border-dashed border-white/8 bg-black/10">
      <p className="text-xs text-white/40">{message}</p>
    </div>
  );
}

function TrendChart({
  rows,
  metricLabel,
  metricKey,
  metricColor,
  metricFormatter,
  currencyCode,
}: {
  rows: MetricRow[];
  metricLabel: string;
  metricKey: "winRate" | "avgRR";
  metricColor: string;
  metricFormatter: (value: number | null | undefined) => string;
  currencyCode?: string | null;
}) {
  const config: ChartConfig = {
    trades: {
      label: "Trades",
      color: SECONDARY_COLOR,
    },
    metric: {
      label: metricLabel,
      color: metricColor,
    },
  };

  if (!hasMetricData(rows)) {
    return <EmptyChartState message="No trades in the current filter." />;
  }

  const data = rows.map((row) => ({
    ...row,
    metric:
      metricKey === "avgRR"
        ? row.avgRR != null && Number.isFinite(row.avgRR)
          ? Number(row.avgRR.toFixed(2))
          : null
        : Number(row.winRate.toFixed(2)),
  }));

  return (
    <div className="flex h-full min-h-0 items-center">
      <ChartContainer
        config={config}
        className="h-full w-full overflow-visible"
      >
        <ComposedChart
          data={data}
          margin={{ top: 12, right: 28, left: 36, bottom: 2 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            interval={1}
            tickMargin={10}
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }}
          />
          <YAxis
            yAxisId="metric"
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            width={28}
            domain={metricKey === "winRate" ? [0, 100] : ["auto", "auto"]}
            tickFormatter={(value: number) =>
              metricKey === "winRate" ? `${Math.round(value)}%` : `${value}R`
            }
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }}
          />
          <YAxis
            yAxisId="trades"
            orientation="right"
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            tickMargin={8}
            width={22}
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }}
          />
          <ChartTooltip
            cursor={{ stroke: "rgba(255,255,255,0.12)" }}
            content={({ active, payload, label }: RechartsTooltipProps) => {
              const row = getTooltipRow(payload);
              if (!row) return null;
              if (!active) return null;

              return (
                <DashboardChartTooltipFrame
                  title={
                    typeof label === "string" || typeof label === "number"
                      ? label
                      : row.label
                  }
                >
                  <DashboardChartTooltipRow
                    label="Trades"
                    value={row.trades}
                    indicatorColor={SECONDARY_COLOR}
                  />
                  <DashboardChartTooltipRow
                    label={metricLabel}
                    value={metricFormatter(
                      metricKey === "winRate" ? row.winRate : row.avgRR
                    )}
                    indicatorColor={metricColor}
                  />
                  <DashboardChartTooltipRow
                    label="Net P&L"
                    value={formatSignedCurrencyValue(row.pnl, currencyCode)}
                    tone={getValueTone(row.pnl)}
                  />
                </DashboardChartTooltipFrame>
              );
            }}
          />
          <Bar
            yAxisId="trades"
            dataKey="trades"
            fill="color-mix(in srgb, var(--color-trades) 36%, transparent)"
            radius={[3, 3, 0, 0]}
            maxBarSize={14}
          />
          <Line
            yAxisId="metric"
            dataKey="metric"
            type="monotone"
            stroke="var(--color-metric)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: metricColor }}
            connectNulls={metricKey === "winRate"}
          />
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}

function DistributionDonutChart({
  rows,
  emptyMessage,
  currencyCode,
  className,
}: {
  rows: MetricRow[];
  emptyMessage: string;
  currencyCode?: string | null;
  className?: string;
}) {
  const data = buildDistributionRows(rows);
  const totalTrades = data.reduce((sum, row) => sum + row.trades, 0);
  const config: ChartConfig = {
    share: {
      label: "Trade share",
      color: POSITIVE_COLOR,
    },
  };

  if (data.length === 0) {
    return <EmptyChartState message={emptyMessage} />;
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-4", className)}>
      <ChartContainer
        config={config}
        className="mx-auto h-56 w-full max-w-[22rem] overflow-visible"
      >
        <PieChart margin={{ top: 0, right: 12, bottom: 0, left: 12 }}>
          <Pie
            data={data}
            dataKey="trades"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={76}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((row) => (
              <Cell key={row.label} fill={row.fill} />
            ))}
          </Pie>
          <ChartTooltip
            content={({ active, payload }: RechartsTooltipProps) => {
              const row = getDistributionTooltipRow(payload);
              if (!row) return null;
              if (!active) return null;

              return (
                <DashboardChartTooltipFrame title={row.label}>
                  <DashboardChartTooltipRow
                    label="Trades"
                    value={row.trades}
                    indicatorColor={row.fill}
                  />
                  <DashboardChartTooltipRow
                    label="Share"
                    value={formatPercent(row.share, 1)}
                  />
                  <DashboardChartTooltipRow
                    label="Net P&L"
                    value={formatSignedCurrencyValue(row.pnl, currencyCode)}
                    tone={getValueTone(row.pnl)}
                  />
                  <DashboardChartTooltipRow
                    label="Win rate"
                    value={formatPercent(row.winRate)}
                  />
                </DashboardChartTooltipFrame>
              );
            }}
          />
        </PieChart>
      </ChartContainer>

      <div className="mt-auto flex min-h-0 flex-col gap-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {data.map((row) => (
            <div
              key={row.label}
              className="rounded-sm border border-white/5 bg-black/10 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: row.fill }}
                  />
                  <span className="truncate text-xs text-white/75">
                    {row.label}
                  </span>
                </div>
                <span className="text-xs font-medium text-white">
                  {formatPercent(row.share, 1)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-white/40">
                <span>{row.trades} trades</span>
                <span>{formatSignedCurrencyValue(row.pnl, currencyCode)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-sm border border-white/5 bg-black/10 px-3 py-2 text-center">
          <p className="text-[11px] text-white/35">Total trades</p>
          <p className="mt-1 text-lg font-semibold text-white">{totalTrades}</p>
        </div>
      </div>
    </div>
  );
}

function ReportsContent() {
  const dashboardTradeFilters = useDashboardTradeFilters();
  const accountId = useAccountStore((state) => state.selectedAccountId);
  const allAccountsPreferredCurrencyCode = useAccountStore(
    (state) => state.allAccountsPreferredCurrencyCode
  );
  const { accounts } = useAccountCatalog({
    enabled: Boolean(accountId),
  });

  const filteredTrades = dashboardTradeFilters?.filteredTrades;
  const trades = useMemo(() => filteredTrades ?? [], [filteredTrades]);
  const stats = dashboardTradeFilters?.filteredStats;
  const availableCurrencyCodes = useMemo(
    () => getAvailableDashboardCurrencyCodes(accounts),
    [accounts]
  );
  const {
    selectedAccount,
    hourlyRows,
    weekdayRows,
    symbolRows,
    sessionRows,
    modelRows,
    customTagRows,
    weekdayPnlRows,
    symbolPnlRows,
    weekdayNet,
  } = useMemo(() => {
    const selectedAccount =
      accounts.find((account) => account.id === accountId) ?? null;
    const hourlyRows = groupByHour(trades);
    const weekdayRows = groupByWeekday(trades);
    const symbolRows = groupBySymbol(trades);
    const sessionRows = groupByLabel(trades, (trade) => [
      trade.sessionTag || "Unassigned",
    ]);
    const modelRows = groupByLabel(trades, (trade) => [
      trade.modelTag || "Unassigned",
    ]);
    const customTagRows = groupByLabel(trades, (trade) =>
      trade.customTags?.length ? trade.customTags : ["Unassigned"]
    );
    const weekdayPnlRows = weekdayRows.map((row) => ({
      label: row.label,
      value: row.pnl,
    }));
    const symbolPnlRows = symbolRows.map((row) => ({
      label: row.label,
      value: row.pnl,
    }));
    const weekdayNet = weekdayRows.reduce((sum, row) => sum + row.pnl, 0);

    return {
      selectedAccount,
      hourlyRows,
      weekdayRows,
      symbolRows,
      sessionRows,
      modelRows,
      customTagRows,
      weekdayPnlRows,
      symbolPnlRows,
      weekdayNet,
    };
  }, [accountId, accounts, trades]);
  const currencyCode = resolveDashboardCurrencyCode({
    isAllAccounts: isAllAccountsScope(accountId),
    preferredCurrencyCode: allAccountsPreferredCurrencyCode,
    availableCurrencyCodes,
    selectedAccountCurrency: selectedAccount?.initialCurrency,
  });

  return (
    <main className="space-y-4 p-6 py-4">
      <WidgetWrapper
        className="!h-auto rounded-lg p-1"
        contentClassName="flex h-auto flex-col rounded-sm px-4 py-4 md:px-5 md:py-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
              Reports
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              Detailed trade breakdowns
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-white/45">
              Review how performance changes by hour, weekday, symbol, and tag.
              The same filters here can be used to inspect grouped account
              portfolios or a narrow slice of setups.
            </p>
          </div>

          <div className="flex items-center">
            <DashboardTradeFiltersBar mode="button" />
          </div>
        </div>
      </WidgetWrapper>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportsStatCard
          icon={BarChart3}
          label="Trades"
          value={trades.length}
          iconClassName="text-white/55"
        />
        <ReportsStatCard
          icon={TrendingUp}
          label="Net P&L"
          value={formatSignedCurrencyValue(
            Number(stats?.totalProfit ?? 0),
            currencyCode
          )}
          iconClassName={
            Number(stats?.totalProfit ?? 0) >= 0
              ? "text-teal-400"
              : "text-rose-400"
          }
          valueClassName={
            Number(stats?.totalProfit ?? 0) >= 0
              ? "text-teal-400"
              : "text-rose-400"
          }
        />
        <ReportsStatCard
          icon={Target}
          label="Win rate"
          value={`${Number(stats?.winrate ?? 0).toFixed(1)}%`}
          iconClassName="text-white/55"
        />
        <ReportsStatCard
          icon={Activity}
          label="Average RR"
          value={
            stats?.averageRMultiple != null
              ? `${Number(stats.averageRMultiple).toFixed(2)}R`
              : "—"
          }
          iconClassName="text-white/55"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ReportCard title="Win rate by hour" icon={Clock3}>
          <TrendChart
            rows={hourlyRows}
            metricLabel="Win rate"
            metricKey="winRate"
            metricColor={POSITIVE_COLOR}
            metricFormatter={(value) => formatPercent(Number(value ?? 0))}
            currencyCode={currencyCode}
          />
        </ReportCard>

        <ReportCard title="Average R multiple by hour" icon={Target}>
          <TrendChart
            rows={hourlyRows}
            metricLabel="Average R multiple"
            metricKey="avgRR"
            metricColor={ACCENT_COLOR}
            metricFormatter={(value) => formatRR(value)}
            currencyCode={currencyCode}
          />
        </ReportCard>

        <ChartWidgetFrame
          title="Profit and loss by weekday"
          className="h-[30rem]"
          showShareButton={false}
        >
          <div className="flex h-full min-h-0 flex-col p-0 px-3.5">
            <DailyNetBarChart
              rows={weekdayPnlRows}
              currencyCode={currencyCode}
              primarySeriesLabel="Weekday net P&L"
              xAxisTickFormatter={(value) => value}
              chartMargin={{ left: 24 }}
              headline={
                <p className="text-sm font-normal tracking-wide text-white/40">
                  Across the selected filter, cumulative weekday net P&amp;L is{" "}
                  <span
                    className={cn(
                      "font-medium tracking-normal",
                      weekdayNet >= 0 ? "text-teal-400" : "text-rose-400"
                    )}
                  >
                    {formatSignedCurrencyValue(weekdayNet, currencyCode, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </span>
                  .
                </p>
              }
            />
          </div>
        </ChartWidgetFrame>

        <ChartWidgetFrame
          title="Symbol breakdown"
          className="h-[30rem]"
          showShareButton={false}
        >
          <div className="flex h-full min-h-0 flex-col p-0 px-3.5">
            <PerformingAssetsBarChart
              rows={symbolPnlRows}
              currencyCode={currencyCode}
              chartMargin={{ left: 28, top: 20 }}
              contentClassName=""
              titleClassName="mt-2!"
            />
          </div>
        </ChartWidgetFrame>

        <ReportCard
          title="Session breakdown"
          icon={Clock3}
          className="h-[30rem] xl:col-span-2"
        >
          <DistributionDonutChart
            rows={sessionRows}
            emptyMessage="No session-tagged trades in the current filter."
            currencyCode={currencyCode}
          />
        </ReportCard>

        <ReportCard
          title="Model and trade tags"
          icon={Tags}
          className="!h-auto min-h-[38rem] xl:col-span-2"
        >
          <div className="grid h-full min-h-0 gap-4 lg:grid-cols-2">
            <div className="flex h-full min-h-0 flex-col gap-3">
              <h3 className="text-sm font-medium text-white/75">Model tags</h3>
              <DistributionDonutChart
                rows={modelRows}
                emptyMessage="No model-tagged trades in the current filter."
                currencyCode={currencyCode}
                className="flex-1"
              />
            </div>
            <div className="flex h-full min-h-0 flex-col gap-3">
              <h3 className="text-sm font-medium text-white/75">Trade tags</h3>
              <DistributionDonutChart
                rows={customTagRows}
                emptyMessage="No custom-tagged trades in the current filter."
                currencyCode={currencyCode}
                className="flex-1"
              />
            </div>
          </div>
        </ReportCard>
      </div>
    </main>
  );
}

export default function ReportsPage() {
  const accountId = useAccountStore((state) => state.selectedAccountId);

  return (
    <DashboardTradeFiltersProvider accountId={accountId} fetchMode="always">
      <ReportsContent />
    </DashboardTradeFiltersProvider>
  );
}
