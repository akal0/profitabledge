"use client";

import {
  Fragment,
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  ScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  LineChart,
  ResponsiveContainer,
} from "recharts";
import {
  BarChart3,
  LayoutGrid,
  ListFilter,
  Maximize2,
  Minimize2,
  Move,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { useQueryState } from "nuqs";
import {
  REPORT_CHART_TYPES,
  REPORT_DIMENSION_IDS,
  REPORT_DIMENSION_LABELS,
  REPORT_LENS_CONFIG,
  REPORT_LENS_IDS,
  REPORT_METRIC_LABELS,
  REPORT_PANEL_LABELS,
  type ReportChartType,
  type ReportDimensionId,
  type ReportLensId,
  type ReportMetricId,
  type ReportPanelId,
} from "@profitabledge/contracts/reports";
import type { AppRouter } from "@profitabledge/contracts/trpc";

import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
} from "@/components/dashboard/charts/dashboard-chart-ui";
import { SortableWidget } from "@/features/dashboard/widgets/components/sortable-widget";
import {
  formatCurrencyValue,
  formatSignedCurrencyValue,
} from "@/features/dashboard/widgets/lib/widget-shared";
import {
  DashboardTradeFiltersBar,
  useDashboardTradeFilters,
} from "@/features/dashboard/filters/dashboard-trade-filters";
import {
  getAvailableDashboardCurrencyCodes,
  resolveDashboardCurrencyCode,
} from "@/features/dashboard/home/lib/dashboard-currency";
import { useAccountCatalog } from "@/features/accounts/hooks/use-account-catalog";
import { useDataTable } from "@/hooks/use-data-table";
import { DataTable } from "@/components/data-table";
import { WidgetWrapper } from "@/components/dashboard/widget-wrapper";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsListUnderlined,
  TabsTriggerUnderlined,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { isAllAccountsScope, useAccountStore } from "@/stores/account";
import { trpcClient, trpcOptions } from "@/utils/trpc";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type RouterInputs = inferRouterInputs<AppRouter>;
type LensOverviewData = RouterOutputs["reports"]["getLensOverview"];
type HeroChartData = RouterOutputs["reports"]["getHeroChart"];
type BreakdownTableData = RouterOutputs["reports"]["getBreakdownTable"];
type PanelData = RouterOutputs["reports"]["getPanelData"];
type UpdateReportsPreferencesInput =
  RouterInputs["users"]["updateReportsPreferences"];
type ReportPanelStat = {
  id: string;
  label: string;
  value: number | null;
  format: "currency" | "percent" | "number" | "duration" | "rr";
};

type LensLayoutState = {
  activePanels: ReportPanelId[];
  panelSpans: Partial<Record<ReportPanelId, number>>;
};

type ReportsWorkspaceContextValue = {
  activeLens: ReportLensId;
  activeDimension: ReportDimensionId;
  selectedMetrics: ReportMetricId[];
  chartType: ReportChartType;
  drilldown: { dimension: ReportDimensionId; value: string } | null;
  activePanels: ReportPanelId[];
  panelSpans: Partial<Record<ReportPanelId, number>>;
  isEditingPanels: boolean;
  currencyCode?: string | null;
  filtersInput: {
    accountId: string;
    startDate?: string;
    endDate?: string;
    symbols?: string[];
    sessionTags?: string[];
    modelTags?: string[];
    customTags?: string[];
    accountTags?: string[];
    currencyCode?: string | null;
    timezone?: string | null;
  };
  setActiveLens: (lens: ReportLensId) => void;
  setActiveDimension: (dimension: ReportDimensionId) => void;
  toggleMetric: (metric: ReportMetricId) => void;
  setChartType: (chartType: ReportChartType) => void;
  setDrilldown: (
    drilldown: { dimension: ReportDimensionId; value: string } | null
  ) => void;
  resetLensState: () => void;
  togglePanelsEdit: () => void;
  reorderPanels: (fromIndex: number, toIndex: number) => void;
  togglePanel: (panelId: ReportPanelId) => void;
  resizePanel: (panelId: ReportPanelId, nextSpan: number) => void;
};

const ReportsWorkspaceContext =
  createContext<ReportsWorkspaceContextValue | null>(null);

const HERO_METRIC_COLORS: Record<ReportMetricId, string> = {
  netPnl: "#14b8a6",
  winRate: "#60a5fa",
  tradeCount: "#f59e0b",
  avgRR: "#f97316",
  profitFactor: "#22c55e",
  expectancy: "#38bdf8",
  avgHold: "#a78bfa",
  avgMfe: "#0ea5e9",
  avgMae: "#f43f5e",
  rrCaptureEfficiency: "#facc15",
};

const REPORT_PANEL_DEFAULT_SPANS: Partial<Record<ReportPanelId, number>> = {
  equityCurve: 2,
  drawdown: 2,
  rollingPerformance: 2,
  performanceHeatmap: 2,
  entryExitWindow: 2,
  correlationMatrix: 2,
  radarComparison: 2,
  monteCarlo: 2,
  maeMfeScatter: 2,
  captureEfficiency: 2,
};

const REPORT_PANEL_HEIGHT_CLASSNAMES: Partial<Record<ReportPanelId, string>> = {
  radarComparison: "h-[28rem]",
  monteCarlo: "h-[28rem]",
  maeMfeScatter: "h-[28rem]",
};

const REPORT_QUERY_STALE_TIME = 30_000;
const REPORT_QUERY_GC_TIME = 5 * 60_000;

const LENS_STAT_CARD_METRICS: Record<ReportLensId, ReportMetricId[]> = {
  performance: ["tradeCount", "netPnl", "winRate", "avgRR"],
  time: ["tradeCount", "netPnl", "winRate", "avgHold"],
  setup: ["tradeCount", "netPnl", "avgRR", "rrCaptureEfficiency"],
  risk: ["tradeCount", "netPnl", "profitFactor", "avgMae"],
  execution: ["tradeCount", "winRate", "avgRR", "rrCaptureEfficiency"],
};

function useReportsWorkspace() {
  const context = useContext(ReportsWorkspaceContext);
  if (!context) {
    throw new Error(
      "useReportsWorkspace must be used within ReportsWorkspaceProvider"
    );
  }

  return context;
}

function formatDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

function formatMetricValue(
  metric: ReportMetricId,
  value: number | null | undefined,
  currencyCode?: string | null,
  options?: { compact?: boolean; digits?: number }
) {
  if (value == null || !Number.isFinite(value)) return "—";

  const digits = options?.digits ?? 2;
  switch (metric) {
    case "netPnl":
    case "expectancy":
      return options?.compact
        ? formatCurrencyValue(value, currencyCode, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })
        : formatSignedCurrencyValue(value, currencyCode, {
            minimumFractionDigits: 0,
            maximumFractionDigits: digits,
            showPositiveSign: true,
          });
    case "winRate":
    case "rrCaptureEfficiency":
      return `${value.toFixed(1)}%`;
    case "tradeCount":
      return value.toLocaleString();
    case "avgRR":
      return `${value.toFixed(2)}R`;
    case "profitFactor":
      return value.toFixed(2);
    case "avgHold":
      return formatDuration(value);
    case "avgMfe":
    case "avgMae":
      return value.toFixed(1);
    default:
      return value.toFixed(digits);
  }
}

function getOrdinalSuffix(day: number) {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";

  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function isIsoDateLabel(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatReportDateLabel(value: string) {
  if (!isIsoDateLabel(value)) {
    return value;
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const weekday = date.toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "UTC",
  });
  const month = date.toLocaleDateString("en-GB", {
    month: "short",
    timeZone: "UTC",
  });
  const day = date.getUTCDate();
  const year = String(date.getUTCFullYear()).slice(-2);

  return `${weekday}\u00A0${day}${getOrdinalSuffix(
    day
  )}\u00A0${month}\u00A0'${year}`;
}

function formatReportLabel(value: string | number | null | undefined) {
  if (typeof value !== "string") {
    return value == null ? "—" : String(value);
  }

  return formatReportDateLabel(value);
}

function isReportLensId(
  value: string | null | undefined
): value is ReportLensId {
  return (
    typeof value === "string" && REPORT_LENS_IDS.some((item) => item === value)
  );
}

function isReportChartType(
  value: string | null | undefined
): value is ReportChartType {
  return (
    typeof value === "string" &&
    REPORT_CHART_TYPES.some((item) => item === value)
  );
}

function isReportDimensionId(
  value: string | null | undefined
): value is ReportDimensionId {
  return (
    typeof value === "string" &&
    REPORT_DIMENSION_IDS.some((item) => item === value)
  );
}

function isLensDimensionAllowed(
  lens: ReportLensId,
  value: string | null | undefined
): value is ReportDimensionId {
  return (
    typeof value === "string" &&
    REPORT_LENS_CONFIG[lens].allowedDimensions.some((item) => item === value)
  );
}

function isLensMetricAllowed(
  lens: ReportLensId,
  value: string | null | undefined
): value is ReportMetricId {
  return (
    typeof value === "string" &&
    REPORT_LENS_CONFIG[lens].allowedMetrics.some((item) => item === value)
  );
}

function buildInitialLensLayouts(rawPreferences: unknown) {
  const raw =
    rawPreferences && typeof rawPreferences === "object" ? rawPreferences : {};

  return Object.fromEntries(
    REPORT_LENS_IDS.map((lens) => {
      const current =
        lens in (raw as Record<string, unknown>) &&
        typeof (raw as Record<string, unknown>)[lens] === "object"
          ? ((raw as Record<string, unknown>)[lens] as Record<string, unknown>)
          : {};
      const activePanels = Array.isArray(current.activePanels)
        ? current.activePanels.filter((panelId): panelId is ReportPanelId =>
            REPORT_LENS_CONFIG[lens].optionalPanels.some(
              (optionalPanelId) => optionalPanelId === panelId
            )
          )
        : [];
      const panelSpans =
        current.panelSpans && typeof current.panelSpans === "object"
          ? (current.panelSpans as Partial<Record<ReportPanelId, number>>)
          : {};

      return [
        lens,
        {
          activePanels:
            activePanels.length > 0
              ? activePanels
              : [...REPORT_LENS_CONFIG[lens].defaultPanels],
          panelSpans: {
            ...REPORT_PANEL_DEFAULT_SPANS,
            ...panelSpans,
          },
        } satisfies LensLayoutState,
      ];
    })
  ) as Record<ReportLensId, LensLayoutState>;
}

function parseDrilldown(rawValue: string) {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as {
      dimension?: string;
      value?: string;
    };
    if (
      parsed &&
      typeof parsed.dimension === "string" &&
      typeof parsed.value === "string" &&
      isReportDimensionId(parsed.dimension)
    ) {
      return {
        dimension: parsed.dimension,
        value: parsed.value,
      };
    }
  } catch {}

  return null;
}

function serializeDrilldown(
  drilldown: { dimension: ReportDimensionId; value: string } | null
) {
  return drilldown ? JSON.stringify(drilldown) : "";
}

function buildHeroMetricChartConfig(metrics: ReportMetricId[]) {
  return Object.fromEntries(
    metrics.map((metric) => [
      metric,
      {
        label: REPORT_METRIC_LABELS[metric],
        color: HERO_METRIC_COLORS[metric],
      },
    ])
  ) satisfies ChartConfig;
}

function segmentedButtonClassName(
  isActive: boolean,
  options?: { action?: boolean }
) {
  return cn(
    "cursor-pointer flex transform items-center justify-center gap-1 rounded-md py-2 h-max transition-all active:scale-95 w-max text-xs duration-250",
    isActive
      ? "bg-[#222225] text-white hover:bg-[#222225] hover:!brightness-120 ring ring-white/5"
      : options?.action
      ? "bg-[#222225]/50 text-white/70 hover:bg-[#222225] hover:!brightness-110 hover:text-white ring ring-white/5"
      : "bg-[#222225]/25 text-white/25 hover:bg-[#222225] hover:!brightness-105 hover:text-white ring-0"
  );
}

function StatCard({
  label,
  value,
  tone,
  caption,
  valueFirst,
}: {
  label: string;
  value: ReactNode;
  tone?: "positive" | "negative" | "default";
  caption?: ReactNode;
  valueFirst?: boolean;
}) {
  return (
    <WidgetWrapper
      className="!h-auto w-full rounded-lg p-1"
      contentClassName="flex h-full min-h-[8.5rem] flex-col justify-end rounded-sm px-4 py-4"
    >
      {valueFirst ? null : (
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-white/35">{label}</span>
        </div>
      )}
      <div
        className={cn(
          valueFirst
            ? "text-2xl font-semibold text-white"
            : "mt-3 text-2xl font-semibold text-white",
          tone === "positive" && "text-teal-400",
          tone === "negative" && "text-rose-400"
        )}
      >
        {value}
      </div>
      {valueFirst ? (
        <div className="mt-2 text-xs text-white/35">{label}</div>
      ) : null}
      {caption ? (
        <div className="mt-3 text-xs leading-5 text-white/45">
          {caption}
        </div>
      ) : null}
    </WidgetWrapper>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[14rem] items-center justify-center rounded-sm ring ring-dashed ring-white/10 bg-black/10 px-4 text-center text-xs text-white/40">
      {message}
    </div>
  );
}

function ReportsHeroChart({
  data,
  selectedMetrics,
  chartType,
  currencyCode,
  onSelectRow,
}: {
  data: HeroChartData | undefined;
  selectedMetrics: ReportMetricId[];
  chartType: ReportChartType;
  currencyCode?: string | null;
  onSelectRow: (value: string) => void;
}) {
  const rows = data?.rows ?? [];
  const chartConfig = useMemo(
    () => buildHeroMetricChartConfig(selectedMetrics),
    [selectedMetrics]
  );

  if (rows.length === 0) {
    return <EmptyPanel message="No trades match the current filters." />;
  }

  const primaryMetric = selectedMetrics[0];
  const secondaryMetrics = selectedMetrics.slice(1);

  return (
    <ChartContainer
      config={chartConfig}
      className="h-[26rem] w-full overflow-visible"
    >
      <ComposedChart
        data={rows}
        margin={{ top: 12, right: 30, left: 12, bottom: 0 }}
        onClick={(event) => {
          const key = event?.activePayload?.[0]?.payload?.key;
          if (typeof key === "string") {
            onSelectRow(key);
          }
        }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tickMargin={10}
          minTickGap={16}
          tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }}
          tickFormatter={formatReportLabel}
        />
        <YAxis
          yAxisId="left"
          axisLine={false}
          tickLine={false}
          tickMargin={8}
          tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }}
          tickFormatter={(value: number) =>
            formatMetricValue(primaryMetric, value, currencyCode, { digits: 0 })
          }
        />
        {secondaryMetrics.length > 0 ? (
          <YAxis
            yAxisId="right"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }}
            tickFormatter={(value: number) =>
              formatMetricValue(secondaryMetrics[0], value, currencyCode, {
                digits: 0,
              })
            }
          />
        ) : null}
        <ChartTooltip
          content={({ active, payload, label }) => {
            const row = payload?.[0]?.payload as
              | HeroChartData["rows"][number]
              | undefined;
            if (!active || !row) return null;

            return (
              <DashboardChartTooltipFrame title={formatReportLabel(label)}>
                {selectedMetrics.map((metric) => (
                  <DashboardChartTooltipRow
                    key={metric}
                    label={REPORT_METRIC_LABELS[metric]}
                    value={formatMetricValue(metric, row[metric], currencyCode)}
                    indicatorColor={HERO_METRIC_COLORS[metric]}
                  />
                ))}
              </DashboardChartTooltipFrame>
            );
          }}
        />
        {chartType !== "line" ? (
          <Bar
            yAxisId="left"
            dataKey={primaryMetric}
            radius={[4, 4, 0, 0]}
            fill={`var(--color-${primaryMetric})`}
            fillOpacity={0.75}
          />
        ) : null}
        {(chartType === "line" || chartType === "composed") && (
          <Line
            yAxisId="left"
            dataKey={primaryMetric}
            type="monotone"
            stroke={HERO_METRIC_COLORS[primaryMetric]}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        )}
        {secondaryMetrics.map((metric) => (
          <Line
            key={metric}
            yAxisId="right"
            dataKey={metric}
            type="monotone"
            stroke={HERO_METRIC_COLORS[metric]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
          />
        ))}
      </ComposedChart>
    </ChartContainer>
  );
}

function PanelHeaderActions({
  span,
  isEditing,
  canRemove,
  onRemove,
  onResize,
}: {
  span: number;
  isEditing: boolean;
  canRemove: boolean;
  onRemove: () => void;
  onResize: (nextSpan: number) => void;
}) {
  if (!isEditing) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-white/30">
        <Move className="size-3.5" />
      </span>
      <Button
        type="button"
        className="h-7 rounded-sm ring ring-white/5 bg-sidebar px-2 text-[11px] text-white/70 hover:bg-sidebar-accent"
        onClick={(event) => {
          event.stopPropagation();
          onResize(span === 2 ? 1 : 2);
        }}
      >
        {span === 2 ? (
          <Minimize2 className="size-3.5" />
        ) : (
          <Maximize2 className="size-3.5" />
        )}
      </Button>
      {canRemove ? (
        <Button
          type="button"
          className="h-7 rounded-sm ring ring-white/5 bg-sidebar px-2 text-[11px] text-white/70 hover:bg-sidebar-accent"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

function HeatmapPanel({
  cells,
  metric,
  currencyCode,
}: {
  cells: Array<{ row: string; column: string; value: number }>;
  metric: ReportMetricId;
  currencyCode?: string | null;
}) {
  if (cells.length === 0) {
    return <EmptyPanel message="Not enough data for this view yet." />;
  }

  const rows = Array.from(new Set(cells.map((cell) => cell.row)));
  const columns = Array.from(new Set(cells.map((cell) => cell.column)));
  const maxAbs = Math.max(1, ...cells.map((cell) => Math.abs(cell.value)));

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-3.5">
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `minmax(5rem, auto) repeat(${columns.length}, minmax(4.25rem, 1fr))`,
        }}
      >
        <div />
        {columns.map((column) => (
          <div
            key={column}
            className="text-center text-[11px] font-medium text-white/45"
          >
            {column}
          </div>
        ))}
        {rows.map((row) => (
          <Fragment key={row}>
            <div
              key={`label-${row}`}
              className="flex items-center text-[11px] font-medium text-white/55"
            >
              {row}
            </div>
            {columns.map((column) => {
              const cell =
                cells.find(
                  (current) => current.row === row && current.column === column
                ) ?? null;
              const value = cell?.value ?? 0;
              const intensity = Math.min(Math.abs(value) / maxAbs, 1);

              return (
                <div
                  key={`${row}-${column}`}
                  className="flex h-16 flex-col items-center justify-center rounded-sm ring ring-white/5 text-center"
                  style={{
                    backgroundColor:
                      value === 0
                        ? "rgba(255,255,255,0.04)"
                        : value > 0
                        ? `rgba(20,184,166,${0.12 + intensity * 0.55})`
                        : `rgba(244,63,94,${0.12 + intensity * 0.55})`,
                  }}
                >
                  <span className="text-[10px] text-white/45">{column}</span>
                  <span className="mt-1 text-xs font-semibold text-white">
                    {formatMetricValue(metric, value, currencyCode, {
                      digits: 0,
                    })}
                  </span>
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function RankedPanel({
  rows,
  primaryMetric,
  secondaryMetric,
  currencyCode,
}: {
  rows: Array<{
    label: string;
    primary: number;
    secondary?: number | null;
    tertiary?: number | null;
  }>;
  primaryMetric: ReportMetricId;
  secondaryMetric?: ReportMetricId;
  currencyCode?: string | null;
}) {
  if (rows.length === 0) {
    return <EmptyPanel message="Not enough data for this panel yet." />;
  }

  const config: ChartConfig = {
    primary: {
      label: REPORT_METRIC_LABELS[primaryMetric],
      color: HERO_METRIC_COLORS[primaryMetric],
    },
    secondary: {
      label: secondaryMetric ? REPORT_METRIC_LABELS[secondaryMetric] : "",
      color: secondaryMetric ? HERO_METRIC_COLORS[secondaryMetric] : "#60a5fa",
    },
  };

  return (
    <ChartContainer
      config={config}
      className="h-full w-full overflow-visible px-3.5 pb-3.5"
    >
      <ComposedChart
        data={rows}
        margin={{ top: 16, right: 20, left: 0, bottom: 4 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tickMargin={10}
          minTickGap={12}
          tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }}
          tickFormatter={formatReportLabel}
        />
        <YAxis
          yAxisId="left"
          axisLine={false}
          tickLine={false}
          tickMargin={8}
          tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }}
          tickFormatter={(value: number) =>
            formatMetricValue(primaryMetric, value, currencyCode, { digits: 0 })
          }
        />
        {secondaryMetric ? (
          <YAxis
            yAxisId="right"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }}
            tickFormatter={(value: number) =>
              formatMetricValue(secondaryMetric, value, currencyCode, {
                digits: 0,
              })
            }
          />
        ) : null}
        <ChartTooltip
          content={({ active, payload, label }) => {
            const row = payload?.[0]?.payload as
              | {
                  label: string;
                  primary: number;
                  secondary?: number | null;
                }
              | undefined;
            if (!active || !row) return null;

            return (
              <DashboardChartTooltipFrame title={formatReportLabel(label)}>
                <DashboardChartTooltipRow
                  label={REPORT_METRIC_LABELS[primaryMetric]}
                  value={formatMetricValue(
                    primaryMetric,
                    row.primary,
                    currencyCode
                  )}
                  indicatorColor={HERO_METRIC_COLORS[primaryMetric]}
                />
                {secondaryMetric && row.secondary != null ? (
                  <DashboardChartTooltipRow
                    label={REPORT_METRIC_LABELS[secondaryMetric]}
                    value={formatMetricValue(
                      secondaryMetric,
                      row.secondary,
                      currencyCode
                    )}
                    indicatorColor={HERO_METRIC_COLORS[secondaryMetric]}
                  />
                ) : null}
              </DashboardChartTooltipFrame>
            );
          }}
        />
        <Bar
          yAxisId="left"
          dataKey="primary"
          fill="var(--color-primary)"
          fillOpacity={0.55}
          radius={[4, 4, 0, 0]}
        />
        {secondaryMetric ? (
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="secondary"
            stroke="var(--color-secondary)"
            strokeWidth={2.2}
            dot={false}
            activeDot={{ r: 3 }}
          />
        ) : null}
      </ComposedChart>
    </ChartContainer>
  );
}

function TimeseriesPanel({
  rows,
  primaryMetric,
  secondaryMetric,
  tertiaryMetric,
  primaryColorOverride,
  currencyCode,
}: {
  rows: Array<{
    label: string;
    primary: number;
    secondary?: number | null;
    tertiary?: number | null;
  }>;
  primaryMetric: ReportMetricId;
  secondaryMetric?: ReportMetricId;
  tertiaryMetric?: ReportMetricId;
  primaryColorOverride?: string;
  currencyCode?: string | null;
}) {
  if (rows.length === 0) {
    return <EmptyPanel message="Not enough data for this panel yet." />;
  }

  const config: ChartConfig = {
    primary: {
      label: REPORT_METRIC_LABELS[primaryMetric],
      color: primaryColorOverride ?? HERO_METRIC_COLORS[primaryMetric],
    },
    secondary: {
      label: secondaryMetric ? REPORT_METRIC_LABELS[secondaryMetric] : "",
      color: secondaryMetric ? HERO_METRIC_COLORS[secondaryMetric] : "#60a5fa",
    },
    tertiary: {
      label: tertiaryMetric ? REPORT_METRIC_LABELS[tertiaryMetric] : "",
      color: tertiaryMetric ? HERO_METRIC_COLORS[tertiaryMetric] : "#f59e0b",
    },
  };

  return (
    <ChartContainer
      config={config}
      className="h-full w-full overflow-visible px-3.5 pb-3.5"
    >
      <ComposedChart
        data={rows}
        margin={{ top: 16, right: 20, left: 0, bottom: 4 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tickMargin={10}
          minTickGap={12}
          tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }}
          tickFormatter={formatReportLabel}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tickMargin={8}
          tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }}
          tickFormatter={(value: number) =>
            formatMetricValue(primaryMetric, value, currencyCode, { digits: 0 })
          }
        />
        <ChartTooltip
          content={({ active, payload, label }) => {
            const row = payload?.[0]?.payload as
              | {
                  label: string;
                  primary: number;
                  secondary?: number | null;
                  tertiary?: number | null;
                }
              | undefined;
            if (!active || !row) return null;

            return (
              <DashboardChartTooltipFrame title={formatReportLabel(label)}>
                <DashboardChartTooltipRow
                  label={REPORT_METRIC_LABELS[primaryMetric]}
                  value={formatMetricValue(
                    primaryMetric,
                    row.primary,
                    currencyCode
                  )}
                  indicatorColor={
                    primaryColorOverride ?? HERO_METRIC_COLORS[primaryMetric]
                  }
                />
                {secondaryMetric && row.secondary != null ? (
                  <DashboardChartTooltipRow
                    label={REPORT_METRIC_LABELS[secondaryMetric]}
                    value={formatMetricValue(
                      secondaryMetric,
                      row.secondary,
                      currencyCode
                    )}
                    indicatorColor={HERO_METRIC_COLORS[secondaryMetric]}
                  />
                ) : null}
                {tertiaryMetric && row.tertiary != null ? (
                  <DashboardChartTooltipRow
                    label={REPORT_METRIC_LABELS[tertiaryMetric]}
                    value={formatMetricValue(
                      tertiaryMetric,
                      row.tertiary,
                      currencyCode
                    )}
                    indicatorColor={HERO_METRIC_COLORS[tertiaryMetric]}
                  />
                ) : null}
              </DashboardChartTooltipFrame>
            );
          }}
        />
        <Bar
          dataKey="primary"
          fill="var(--color-primary)"
          fillOpacity={0.35}
          radius={[4, 4, 0, 0]}
        />
        {secondaryMetric ? (
          <Line
            type="monotone"
            dataKey="secondary"
            stroke="var(--color-secondary)"
            strokeWidth={2.2}
            dot={false}
          />
        ) : null}
        {tertiaryMetric ? (
          <Line
            type="monotone"
            dataKey="tertiary"
            stroke="var(--color-tertiary)"
            strokeWidth={2}
            dot={false}
          />
        ) : null}
      </ComposedChart>
    </ChartContainer>
  );
}

function ScatterPanel({
  points,
  xLabel,
  yLabel,
}: {
  points: Array<{
    id: string;
    label: string;
    x: number;
    y: number;
    z?: number | null;
    tone: "positive" | "negative" | "neutral";
  }>;
  xLabel: string;
  yLabel: string;
}) {
  if (points.length === 0) {
    return <EmptyPanel message="Not enough data for this scatter view yet." />;
  }

  return (
    <div className="h-full min-h-[22rem] w-full px-3.5 pb-3.5">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 16, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name={xLabel}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yLabel}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }}
          />
          <ChartTooltip
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as
                | { label: string; x: number; y: number; z?: number | null }
                | undefined;
              if (!active || !point) return null;

              return (
                <DashboardChartTooltipFrame title={point.label}>
                  <DashboardChartTooltipRow
                    label={xLabel}
                    value={point.x.toFixed(1)}
                  />
                  <DashboardChartTooltipRow
                    label={yLabel}
                    value={point.y.toFixed(1)}
                  />
                  {point.z != null ? (
                    <DashboardChartTooltipRow
                      label="RR"
                      value={`${point.z.toFixed(2)}R`}
                    />
                  ) : null}
                </DashboardChartTooltipFrame>
              );
            }}
          />
          <Scatter
            data={points}
            fill="#38bdf8"
            shape={(props: any) => (
              <circle
                cx={props.cx}
                cy={props.cy}
                r={4}
                fill={
                  props.payload.tone === "positive"
                    ? "#14b8a6"
                    : props.payload.tone === "negative"
                    ? "#f43f5e"
                    : "#94a3b8"
                }
                fillOpacity={0.85}
              />
            )}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function RadarPanel({
  rows,
}: {
  rows: Array<{
    label: string;
    winRate: number;
    avgRR: number;
    expectancy: number;
    rrCaptureEfficiency: number;
    tradeCountScore: number;
  }>;
}) {
  if (rows.length === 0) {
    return <EmptyPanel message="Not enough data for this comparison yet." />;
  }

  return (
    <div className="h-full min-h-[22rem] w-full px-3.5 pb-3.5">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart outerRadius="70%" data={rows}>
          <PolarGrid stroke="rgba(255,255,255,0.12)" />
          <PolarAngleAxis
            dataKey="label"
            tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }}
          />
          <PolarRadiusAxis
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
          />
          <Radar
            name="Win rate"
            dataKey="winRate"
            stroke="#14b8a6"
            fill="#14b8a6"
            fillOpacity={0.2}
          />
          <Radar
            name="Capture"
            dataKey="rrCaptureEfficiency"
            stroke="#60a5fa"
            fill="#60a5fa"
            fillOpacity={0.12}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatGridPanel({
  stats,
  currencyCode,
}: {
  stats: ReportPanelStat[];
  currencyCode?: string | null;
}) {
  if (stats.length === 0) {
    return <EmptyPanel message="Not enough data for this summary yet." />;
  }

  const formatStatValue = (stat: ReportPanelStat) => {
    if (stat.format === "currency") {
      return formatSignedCurrencyValue(stat.value ?? 0, currencyCode, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        showPositiveSign: true,
      });
    }

    if (stat.format === "percent") {
      return stat.value != null ? `${stat.value.toFixed(1)}%` : "—";
    }

    if (stat.format === "duration") {
      return formatDuration(stat.value);
    }

    if (stat.format === "rr") {
      return stat.value != null ? `${stat.value.toFixed(2)}R` : "—";
    }

    return stat.value != null ? stat.value.toFixed(2) : "—";
  };

  return (
    <div className="grid h-full gap-3 p-3.5 sm:grid-cols-2">
      {stats.map((stat) => (
        <div
          key={stat.id}
          className="rounded-sm ring ring-white/5 bg-black/10 px-3 py-3"
        >
          <div className="text-xs text-white/35">{stat.label}</div>
          <div className="mt-3 text-xl font-semibold text-white">
            {formatStatValue(stat)}
          </div>
        </div>
      ))}
    </div>
  );
}

function StandaloneStatCardsRow({
  title,
  stats,
  currencyCode,
  isEditing,
  canRemove,
  onRemove,
}: {
  title: string;
  stats: ReportPanelStat[];
  currencyCode?: string | null;
  isEditing: boolean;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const formatStatValue = (stat: ReportPanelStat) => {
    if (stat.format === "currency") {
      return formatSignedCurrencyValue(stat.value ?? 0, currencyCode, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        showPositiveSign: true,
      });
    }

    if (stat.format === "percent") {
      return stat.value != null ? `${stat.value.toFixed(1)}%` : "—";
    }

    if (stat.format === "duration") {
      return formatDuration(stat.value);
    }

    if (stat.format === "rr") {
      return stat.value != null ? `${stat.value.toFixed(2)}R` : "—";
    }

    return stat.value != null ? stat.value.toFixed(2) : "—";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-sm font-medium text-white">{title}</p>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <span className="text-white/30">
              <Move className="size-3.5" />
            </span>
            {canRemove ? (
              <Button
                type="button"
                className="h-7 rounded-sm ring ring-white/5 bg-sidebar px-2 text-[11px] text-white/70 hover:bg-sidebar-accent"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove();
                }}
              >
                <X className="size-3.5" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <WidgetWrapper
            key={stat.id}
            className="!h-auto rounded-lg p-1"
            contentClassName="flex h-auto flex-col rounded-sm px-4 py-4"
          >
            <div className="text-xs text-white/35">{stat.label}</div>
            <div className="mt-3 text-xl font-semibold text-white">
              {formatStatValue(stat)}
            </div>
          </WidgetWrapper>
        ))}
      </div>
    </div>
  );
}

function MonteCarloPanel({
  envelope,
  paths,
  currencyCode,
}: {
  envelope: Array<{ step: number; p10: number; p50: number; p90: number }>;
  paths: Array<{ id: string; points: Array<{ step: number; value: number }> }>;
  currencyCode?: string | null;
}) {
  if (envelope.length === 0) {
    return (
      <EmptyPanel message="Not enough trade history for Monte Carlo yet." />
    );
  }

  const rows = envelope.map((point) => {
    const value: Record<string, number> = {
      step: point.step,
      p10: point.p10,
      p50: point.p50,
      p90: point.p90,
    };
    for (const path of paths) {
      value[path.id] = path.points[point.step - 1]?.value ?? 0;
    }
    return value;
  });

  return (
    <div className="h-full min-h-[22rem] w-full px-3.5 pb-3.5">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={rows}
          margin={{ top: 16, right: 12, left: 0, bottom: 4 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="step"
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }}
            tickFormatter={(value: number) =>
              formatSignedCurrencyValue(value, currencyCode, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })
            }
          />
          <ChartTooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as
                | { p10: number; p50: number; p90: number }
                | undefined;
              if (!row) return null;

              return (
                <DashboardChartTooltipFrame title={`Trade ${label}`}>
                  <DashboardChartTooltipRow
                    label="10th percentile"
                    value={formatSignedCurrencyValue(row.p10, currencyCode)}
                    indicatorColor="#94a3b8"
                  />
                  <DashboardChartTooltipRow
                    label="Median"
                    value={formatSignedCurrencyValue(row.p50, currencyCode)}
                    indicatorColor="#14b8a6"
                  />
                  <DashboardChartTooltipRow
                    label="90th percentile"
                    value={formatSignedCurrencyValue(row.p90, currencyCode)}
                    indicatorColor="#60a5fa"
                  />
                </DashboardChartTooltipFrame>
              );
            }}
          />
          {paths.map((path) => (
            <Line
              key={path.id}
              type="monotone"
              dataKey={path.id}
              stroke="rgba(255,255,255,0.14)"
              strokeWidth={1}
              dot={false}
            />
          ))}
          <Line
            type="monotone"
            dataKey="p10"
            stroke="#94a3b8"
            strokeWidth={1.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="p50"
            stroke="#14b8a6"
            strokeWidth={2.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="p90"
            stroke="#60a5fa"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ReportPanelRenderer({
  panelId,
  data,
  currencyCode,
}: {
  panelId: ReportPanelId;
  data: PanelData | undefined;
  currencyCode?: string | null;
}) {
  if (!data) {
    return <EmptyPanel message="Loading panel..." />;
  }

  switch (data.kind) {
    case "timeseries":
      return (
        <TimeseriesPanel
          rows={data.rows}
          primaryMetric={data.primaryMetric}
          secondaryMetric={
            "secondaryMetric" in data
              ? (data.secondaryMetric as ReportMetricId | undefined)
              : undefined
          }
          tertiaryMetric={
            "tertiaryMetric" in data
              ? (data.tertiaryMetric as ReportMetricId | undefined)
              : undefined
          }
          primaryColorOverride={panelId === "drawdown" ? "#f43f5e" : undefined}
          currencyCode={currencyCode}
        />
      );
    case "ranked":
      return (
        <RankedPanel
          rows={data.rows}
          primaryMetric={data.primaryMetric}
          secondaryMetric={
            "secondaryMetric" in data
              ? (data.secondaryMetric as ReportMetricId | undefined)
              : undefined
          }
          currencyCode={currencyCode}
        />
      );
    case "heatmap":
      return (
        <HeatmapPanel
          cells={data.cells}
          metric={data.metric}
          currencyCode={currencyCode}
        />
      );
    case "scatter":
      return (
        <ScatterPanel
          points={data.points}
          xLabel={data.xLabel}
          yLabel={data.yLabel}
        />
      );
    case "radar":
      return <RadarPanel rows={data.rows} />;
    case "stat-grid":
      return <StatGridPanel stats={data.stats} currencyCode={currencyCode} />;
    case "monte-carlo":
      return (
        <MonteCarloPanel
          envelope={data.envelope}
          paths={data.paths}
          currencyCode={currencyCode}
        />
      );
    default:
      return (
        <EmptyPanel message="No renderer is available for this panel yet." />
      );
  }
}

function ReportsWorkspaceProvider({ children }: { children: ReactNode }) {
  const accountId =
    useAccountStore((state) => state.selectedAccountId) || "__all__";
  const allAccountsPreferredCurrencyCode = useAccountStore(
    (state) => state.allAccountsPreferredCurrencyCode
  );
  const dashboardTradeFilters = useDashboardTradeFilters();
  const { accounts } = useAccountCatalog({
    enabled: Boolean(accountId),
  });
  const { data: me } = useQuery({
    ...trpcOptions.users.me.queryOptions(),
    staleTime: 5 * 60_000,
  });

  const [lensParam, setLensParam] = useQueryState("rlens", {
    defaultValue: "",
  });
  const [dimensionParam, setDimensionParam] = useQueryState("rdim", {
    defaultValue: "",
  });
  const [metricsParam, setMetricsParam] = useQueryState("rmetrics", {
    defaultValue: "",
  });
  const [chartTypeParam, setChartTypeParam] = useQueryState("rchart", {
    defaultValue: "",
  });
  const [drilldownParam, setDrilldownParam] = useQueryState("rdrill", {
    defaultValue: "",
  });

  const rawReportPreferences =
    (me as any)?.widgetPreferences?.reportsV1 ??
    ({} as Record<string, unknown>);
  const userId = (me as any)?.id as string | undefined;
  const activeTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    []
  );
  const initialLayoutsRef = useRef<Record<ReportLensId, LensLayoutState>>(
    buildInitialLensLayouts(rawReportPreferences)
  );
  const hydratedUserIdRef = useRef<string | null>(null);
  const [lensLayouts, setLensLayouts] = useState<
    Record<ReportLensId, LensLayoutState>
  >(initialLayoutsRef.current);
  const [isEditingPanels, setIsEditingPanels] = useState(false);

  useEffect(() => {
    if (!userId || hydratedUserIdRef.current === userId) return;
    hydratedUserIdRef.current = userId;
    const nextLayouts = buildInitialLensLayouts(rawReportPreferences);
    initialLayoutsRef.current = nextLayouts;
    setLensLayouts(nextLayouts);
  }, [rawReportPreferences, userId]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId) ?? null,
    [accountId, accounts]
  );
  const availableCurrencyCodes = useMemo(
    () => getAvailableDashboardCurrencyCodes(accounts),
    [accounts]
  );
  const currencyCode = resolveDashboardCurrencyCode({
    isAllAccounts: isAllAccountsScope(accountId),
    preferredCurrencyCode: allAccountsPreferredCurrencyCode,
    availableCurrencyCodes,
    selectedAccountCurrency: selectedAccount?.initialCurrency,
  });

  const persistedLens = isReportLensId(lensParam) ? lensParam : null;
  const activeLens = persistedLens ?? "performance";
  const lensConfig = REPORT_LENS_CONFIG[activeLens];
  const rawLensPrefs =
    rawReportPreferences &&
    typeof rawReportPreferences === "object" &&
    activeLens in (rawReportPreferences as Record<string, unknown>)
      ? ((rawReportPreferences as Record<string, unknown>)[
          activeLens
        ] as Record<string, unknown>)
      : {};
  const persistedDimension =
    typeof rawLensPrefs?.heroDimension === "string"
      ? (rawLensPrefs.heroDimension as ReportDimensionId)
      : null;
  const activeDimension = isLensDimensionAllowed(activeLens, dimensionParam)
    ? dimensionParam
    : persistedDimension &&
      isLensDimensionAllowed(activeLens, persistedDimension)
    ? persistedDimension
    : lensConfig.defaultDimension;
  const persistedMetrics = Array.isArray(rawLensPrefs?.heroMetrics)
    ? (rawLensPrefs.heroMetrics as ReportMetricId[]).filter((metric) =>
        isLensMetricAllowed(activeLens, metric)
      )
    : [];
  const parsedMetricSelection = metricsParam
    .split(",")
    .filter((metric): metric is ReportMetricId =>
      isLensMetricAllowed(activeLens, metric)
    );
  const selectedMetrics =
    parsedMetricSelection.length > 0
      ? parsedMetricSelection.slice(0, 3)
      : persistedMetrics.length > 0
      ? persistedMetrics.slice(0, 3)
      : [...lensConfig.defaultMetrics];
  const activeChartType = isReportChartType(chartTypeParam)
    ? chartTypeParam
    : isReportChartType(
        rawLensPrefs?.heroChartType as string | null | undefined
      )
    ? (rawLensPrefs.heroChartType as ReportChartType)
    : "composed";
  const drilldown = parseDrilldown(drilldownParam);
  const activeLayout = lensLayouts[activeLens];
  const activePanels = activeLayout?.activePanels ?? [
    ...lensConfig.defaultPanels,
  ];
  const panelSpans = activeLayout?.panelSpans ?? {};

  const filters = dashboardTradeFilters?.filters;
  const filtersInput = useMemo(
    () => ({
      accountId,
      startDate: filters?.startDate || undefined,
      endDate: filters?.endDate || undefined,
      symbols: filters?.symbols ?? [],
      sessionTags: filters?.sessionTags ?? [],
      modelTags: filters?.modelTags ?? [],
      customTags: filters?.customTags ?? [],
      accountTags: filters?.accountTags ?? [],
      currencyCode,
      timezone: activeTimezone,
    }),
    [accountId, activeTimezone, currencyCode, filters]
  );

  const persistLensPreferences = useCallback(
    async (
      lens: ReportLensId,
      patch: Omit<UpdateReportsPreferencesInput, "lens">
    ) => {
      try {
        await trpcClient.users.updateReportsPreferences.mutate({
          lens,
          ...patch,
        } as UpdateReportsPreferencesInput);
      } catch {}
    },
    []
  );

  const setActiveLens = useCallback(
    (lens: ReportLensId) => {
      startTransition(() => {
        void setLensParam(lens);
        void setDrilldownParam("");
      });
    },
    [setDrilldownParam, setLensParam]
  );

  const setActiveDimension = useCallback(
    (dimension: ReportDimensionId) => {
      startTransition(() => {
        void setDimensionParam(dimension);
        void setDrilldownParam("");
      });
      void persistLensPreferences(activeLens, { heroDimension: dimension });
    },
    [activeLens, persistLensPreferences, setDimensionParam, setDrilldownParam]
  );

  const toggleMetric = useCallback(
    (metric: ReportMetricId) => {
      const nextMetrics = selectedMetrics.includes(metric)
        ? selectedMetrics.length > 1
          ? selectedMetrics.filter((current) => current !== metric)
          : selectedMetrics
        : [...selectedMetrics.slice(-2), metric];

      startTransition(() => {
        void setMetricsParam(nextMetrics.join(","));
      });
      void persistLensPreferences(activeLens, { heroMetrics: nextMetrics });
    },
    [activeLens, persistLensPreferences, selectedMetrics, setMetricsParam]
  );

  const setChartType = useCallback(
    (nextChartType: ReportChartType) => {
      startTransition(() => {
        void setChartTypeParam(nextChartType);
      });
      void persistLensPreferences(activeLens, { heroChartType: nextChartType });
    },
    [activeLens, persistLensPreferences, setChartTypeParam]
  );

  const setDrilldown = useCallback(
    (nextDrilldown: { dimension: ReportDimensionId; value: string } | null) => {
      startTransition(() => {
        void setDrilldownParam(serializeDrilldown(nextDrilldown));
      });
    },
    [setDrilldownParam]
  );

  const resetLensState = useCallback(() => {
    const defaults = REPORT_LENS_CONFIG[activeLens];
    startTransition(() => {
      void setDimensionParam("");
      void setMetricsParam("");
      void setChartTypeParam("");
      void setDrilldownParam("");
    });
    void persistLensPreferences(activeLens, {
      heroDimension: defaults.defaultDimension,
      heroMetrics: [...defaults.defaultMetrics],
      heroChartType: "composed",
    });
    setLensLayouts((current) => ({
      ...current,
      [activeLens]: {
        activePanels: [...defaults.defaultPanels],
        panelSpans: {
          ...REPORT_PANEL_DEFAULT_SPANS,
        },
      },
    }));
    void persistLensPreferences(activeLens, {
      activePanels: [...defaults.defaultPanels],
      panelSpans:
        REPORT_PANEL_DEFAULT_SPANS as UpdateReportsPreferencesInput["panelSpans"],
    });
  }, [
    activeLens,
    persistLensPreferences,
    setChartTypeParam,
    setDimensionParam,
    setDrilldownParam,
    setMetricsParam,
  ]);

  const togglePanelsEdit = useCallback(() => {
    setIsEditingPanels((current) => !current);
  }, []);

  const reorderPanels = useCallback(
    (fromIndex: number, toIndex: number) => {
      setLensLayouts((current) => {
        const currentPanels = current[activeLens].activePanels;
        if (
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= currentPanels.length ||
          toIndex >= currentPanels.length
        ) {
          return current;
        }

        const nextPanels = [...currentPanels];
        const [moved] = nextPanels.splice(fromIndex, 1);
        nextPanels.splice(toIndex, 0, moved);
        const next = {
          ...current,
          [activeLens]: {
            ...current[activeLens],
            activePanels: nextPanels,
          },
        };
        void persistLensPreferences(activeLens, { activePanels: nextPanels });
        return next;
      });
    },
    [activeLens, persistLensPreferences]
  );

  const togglePanel = useCallback(
    (panelId: ReportPanelId) => {
      setLensLayouts((current) => {
        const existing = current[activeLens];
        const nextPanels = existing.activePanels.includes(panelId)
          ? existing.activePanels.filter(
              (currentPanelId) => currentPanelId !== panelId
            )
          : [...existing.activePanels, panelId];
        const safePanels =
          nextPanels.length > 0
            ? nextPanels
            : [...REPORT_LENS_CONFIG[activeLens].defaultPanels];
        const next = {
          ...current,
          [activeLens]: {
            ...existing,
            activePanels: safePanels,
          },
        };
        void persistLensPreferences(activeLens, { activePanels: safePanels });
        return next;
      });
    },
    [activeLens, persistLensPreferences]
  );

  const resizePanel = useCallback(
    (panelId: ReportPanelId, nextSpan: number) => {
      setLensLayouts((current) => {
        const nextSpans = {
          ...current[activeLens].panelSpans,
          [panelId]: Math.max(1, Math.min(2, Math.round(nextSpan))),
        };
        const next = {
          ...current,
          [activeLens]: {
            ...current[activeLens],
            panelSpans: nextSpans,
          },
        };
        void persistLensPreferences(activeLens, {
          panelSpans: nextSpans as UpdateReportsPreferencesInput["panelSpans"],
        });
        return next;
      });
    },
    [activeLens, persistLensPreferences]
  );

  const value = useMemo<ReportsWorkspaceContextValue>(
    () => ({
      activeLens,
      activeDimension,
      selectedMetrics,
      chartType: activeChartType,
      drilldown,
      activePanels,
      panelSpans,
      isEditingPanels,
      currencyCode,
      filtersInput,
      setActiveLens,
      setActiveDimension,
      toggleMetric,
      setChartType,
      setDrilldown,
      resetLensState,
      togglePanelsEdit,
      reorderPanels,
      togglePanel,
      resizePanel,
    }),
    [
      activeChartType,
      activeDimension,
      activeLens,
      activePanels,
      currencyCode,
      drilldown,
      filtersInput,
      isEditingPanels,
      panelSpans,
      resetLensState,
      reorderPanels,
      selectedMetrics,
      setActiveDimension,
      setActiveLens,
      setChartType,
      setDrilldown,
      toggleMetric,
      togglePanel,
      togglePanelsEdit,
      resizePanel,
    ]
  );

  return (
    <ReportsWorkspaceContext.Provider value={value}>
      {children}
    </ReportsWorkspaceContext.Provider>
  );
}

function ReportsWorkspaceContent() {
  const {
    activeLens,
    activeDimension,
    selectedMetrics,
    chartType,
    drilldown,
    activePanels,
    panelSpans,
    isEditingPanels,
    currencyCode,
    filtersInput,
    setActiveLens,
    setActiveDimension,
    toggleMetric,
    setChartType,
    setDrilldown,
    resetLensState,
    togglePanelsEdit,
    reorderPanels,
    togglePanel,
    resizePanel,
  } = useReportsWorkspace();
  const lensConfig = REPORT_LENS_CONFIG[activeLens];
  const hiddenPanels = lensConfig.optionalPanels.filter(
    (panelId) =>
      !activePanels.some((activePanelId) => activePanelId === panelId)
  );
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );
  const heroQuery = useQuery({
    ...trpcOptions.reports.getHeroChart.queryOptions({
      ...filtersInput,
      lens: activeLens,
      dimension: activeDimension,
    }),
    staleTime: REPORT_QUERY_STALE_TIME,
    gcTime: REPORT_QUERY_GC_TIME,
    refetchOnWindowFocus: false,
  });
  const overviewQuery = useQuery({
    ...trpcOptions.reports.getLensOverview.queryOptions({
      ...filtersInput,
      lens: activeLens,
      dimension: activeDimension,
      drilldown,
    }),
    staleTime: REPORT_QUERY_STALE_TIME,
    gcTime: REPORT_QUERY_GC_TIME,
    refetchOnWindowFocus: false,
  });
  const breakdownQuery = useQuery({
    ...trpcOptions.reports.getBreakdownTable.queryOptions({
      ...filtersInput,
      lens: activeLens,
      dimension: activeDimension,
    }),
    staleTime: REPORT_QUERY_STALE_TIME,
    gcTime: REPORT_QUERY_GC_TIME,
    refetchOnWindowFocus: false,
  });
  const panelQueries = useQueries({
    queries: activePanels.map((panelId) => ({
      ...trpcOptions.reports.getPanelData.queryOptions({
        ...filtersInput,
        lens: activeLens,
        panelId,
        drilldown,
      }),
      staleTime: REPORT_QUERY_STALE_TIME,
      gcTime: REPORT_QUERY_GC_TIME,
      refetchOnWindowFocus: false,
    })),
  });
  const panelDataById = useMemo(
    () =>
      Object.fromEntries(
        activePanels.map((panelId, index) => [
          panelId,
          panelQueries[index]?.data as PanelData | undefined,
        ])
      ) as Partial<Record<ReportPanelId, PanelData>>,
    [activePanels, panelQueries]
  );
  const breakdownRows = breakdownQuery.data?.rows ?? [];
  const { table, setRowSelection } = useDataTable<
    BreakdownTableData["rows"][number]
  >({
    data: breakdownRows,
    columns: useMemo<ColumnDef<BreakdownTableData["rows"][number]>[]>(
      () => [
        {
          id: "label",
          accessorKey: "label",
          header: () => REPORT_DIMENSION_LABELS[activeDimension],
          cell: ({ row }) => (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white">
                <span className="whitespace-nowrap">
                  {formatReportLabel(row.original.label)}
                </span>
              </span>
              <span className="text-[11px] text-white/40">
                {row.original.tradeCount.toLocaleString()} trades
              </span>
            </div>
          ),
          size: 220,
        },
        ...lensConfig.allowedMetrics.map((metric) => {
          const reportMetric = metric as ReportMetricId;

          return {
            id: reportMetric,
            accessorKey: reportMetric,
            header: () => REPORT_METRIC_LABELS[reportMetric],
            cell: ({ row }) => (
              <span
                className={cn(
                  "font-medium",
                  reportMetric === "netPnl" &&
                    row.original.netPnl > 0 &&
                    "text-teal-400",
                  reportMetric === "netPnl" &&
                    row.original.netPnl < 0 &&
                    "text-rose-400",
                  reportMetric !== "netPnl" && "text-white/75"
                )}
              >
                {formatMetricValue(
                  reportMetric,
                  row.original[reportMetric],
                  currencyCode
                )}
              </span>
            ),
            size: reportMetric === "tradeCount" ? 120 : 160,
          } satisfies ColumnDef<BreakdownTableData["rows"][number]>;
        }),
      ],
      [activeDimension, currencyCode, lensConfig.allowedMetrics]
    ),
    tableId: `reports:${activeLens}:breakdown`,
    getRowId: (row) => row.key,
    initialPageSize: 5,
    enableFilteringRowModel: false,
  });

  useEffect(() => {
    if (!drilldown || drilldown.dimension !== activeDimension) {
      setRowSelection({});
      return;
    }

    setRowSelection({
      [drilldown.value]: true,
    });
  }, [activeDimension, drilldown, setRowSelection]);

  useEffect(() => {
    if (table.getState().pagination.pageIndex !== 0) {
      table.setPageIndex(0);
    }
  }, [activeDimension, activeLens, breakdownQuery.dataUpdatedAt]);

  const paginationState = table.getState().pagination;
  const pageIndex = paginationState.pageIndex;
  const pageSize = paginationState.pageSize;
  const currentPageRows = table.getRowModel().rows.length;
  const totalRows = breakdownRows.length;
  const pageStart = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const pageEnd = totalRows === 0 ? 0 : pageIndex * pageSize + currentPageRows;

  const handleDragEnd = (event: DragEndEvent) => {
    if (!isEditingPanels) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = activePanels.indexOf(active.id as ReportPanelId);
    const newIndex = activePanels.indexOf(over.id as ReportPanelId);
    reorderPanels(oldIndex, newIndex);
  };

  return (
    <Tabs
      value={activeLens}
      onValueChange={(value) => setActiveLens(value as ReportLensId)}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className="shrink-0 bg-background dark:bg-sidebar">
        <div className="overflow-x-auto px-4 sm:px-6 lg:px-8">
          <TabsListUnderlined className="flex h-auto min-w-full items-stretch gap-5 border-b-0">
            {REPORT_LENS_IDS.map((lens) => (
              <TabsTriggerUnderlined
                key={lens}
                value={lens}
                className="h-10 pb-0 pt-0 text-xs font-medium text-secondary dark:text-neutral-400 hover:text-secondary dark:hover:text-neutral-200 data-[state=active]:border-teal-400 data-[state=active]:text-teal-400"
              >
                {REPORT_LENS_CONFIG[lens].label}
              </TabsTriggerUnderlined>
            ))}
          </TabsListUnderlined>
        </div>
        <Separator />
      </div>

      <main className="space-y-4 p-6 py-4">
        <WidgetWrapper
          className="!h-auto rounded-lg p-1"
          contentClassName="flex h-auto flex-col rounded-sm px-4 py-4 md:px-5 md:py-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs text-white/35">Reports</p>
              <h1 className="mt-1 text-2xl font-semibold text-white">
                Advanced reports workspace
              </h1>
              <p className="mt-1 text-sm text-white/45">
                One connected analysis surface. Compare multiple metrics on the
                hero chart, click into a bucket, and let the rest of the lens
                react in-place.
              </p>
            </div>
          </div>
        </WidgetWrapper>

        <div className="">
          <div className="flex min-w-max items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    className="h-9! rounded-sm bg-sidebar px-3 text-xs text-white/70 hover:bg-sidebar-accent"
                  >
                    <ListFilter className=" size-3" />
                    {REPORT_DIMENSION_LABELS[activeDimension]}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-56 rounded-sm bg-sidebar p-1 text-white"
                >
                  {lensConfig.allowedDimensions.map((dimension) => (
                    <DropdownMenuItem
                      key={dimension}
                      className="text-xs text-white/75 focus:bg-sidebar-accent focus:text-white cursor-pointer"
                      onClick={() => setActiveDimension(dimension)}
                    >
                      {REPORT_DIMENSION_LABELS[dimension]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {drilldown ? (
                <Button
                  type="button"
                  className="h-7 whitespace-nowrap rounded-sm ring ring-teal-400/20 bg-teal-400/10 px-2 text-[11px] text-teal-300 hover:bg-teal-400/15"
                  onClick={() => setDrilldown(null)}
                >
                  Focused on {formatReportLabel(drilldown.value)}
                  <X className="ml-2 size-3" />
                </Button>
              ) : null}

              <div className="bg-white dark:bg-muted/15 flex w-max items-center gap-1 rounded-md p-[3px] ring ring-white/5">
                {lensConfig.allowedMetrics.map((metric) => (
                  <Button
                    key={metric}
                    type="button"
                    className={segmentedButtonClassName(
                      selectedMetrics.includes(metric)
                    )}
                    onClick={() => toggleMetric(metric)}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: HERO_METRIC_COLORS[metric] }}
                    />
                    <span className="px-1">{REPORT_METRIC_LABELS[metric]}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-white dark:bg-muted/15 flex h-max w-max items-center gap-1 rounded-md p-[3px] ring ring-white/5">
                {REPORT_CHART_TYPES.map((nextChartType) => (
                  <Button
                    key={nextChartType}
                    type="button"
                    className={segmentedButtonClassName(
                      chartType === nextChartType
                    )}
                    onClick={() => setChartType(nextChartType)}
                  >
                    <span className="px-1">
                      {nextChartType === "bar"
                        ? "Bar"
                        : nextChartType === "line"
                          ? "Line"
                          : "Composed"}
                    </span>
                  </Button>
                ))}
                <Button
                  type="button"
                  className={segmentedButtonClassName(false, { action: true })}
                  onClick={resetLensState}
                >
                  <RefreshCw className="size-3" />
                  <span className="px-1">Reset lens</span>
                </Button>
              </div>

              <DashboardTradeFiltersBar mode="button" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {LENS_STAT_CARD_METRICS[activeLens].map((metric) => (
            <StatCard
              key={metric}
              label={REPORT_METRIC_LABELS[metric]}
              value={formatMetricValue(
                metric,
                overviewQuery.data?.metrics[metric],
                currencyCode
              )}
              valueFirst
              tone={
                metric === "netPnl"
                  ? Number(overviewQuery.data?.metrics.netPnl ?? 0) >= 0
                    ? "positive"
                    : "negative"
                  : "default"
              }
            />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <WidgetWrapper
            showHeader
            icon={BarChart3}
            title={`${REPORT_LENS_CONFIG[activeLens].label} hero chart`}
            className="h-auto rounded-lg p-1"
            contentClassName="flex min-h-0 flex-col rounded-sm px-3.5 pb-3.5 pt-3"
          >
            <ReportsHeroChart
              data={heroQuery.data}
              selectedMetrics={selectedMetrics}
              chartType={chartType}
              currencyCode={currencyCode}
              onSelectRow={(value) =>
                setDrilldown(
                  drilldown?.dimension === activeDimension &&
                    drilldown.value === value
                    ? null
                    : { dimension: activeDimension, value }
                )
              }
            />
          </WidgetWrapper>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            <StatCard
              label="Best bucket"
              value={
                <span className="whitespace-nowrap">
                  {formatReportLabel(overviewQuery.data?.bestRow?.label)}
                </span>
              }
              tone="positive"
              caption={
                overviewQuery.data?.bestRow
                  ? formatSignedCurrencyValue(
                      overviewQuery.data.bestRow.netPnl,
                      currencyCode
                    )
                  : "—"
              }
            />
            <StatCard
              label="Weakest bucket"
              value={
                <span className="whitespace-nowrap">
                  {formatReportLabel(overviewQuery.data?.weakestRow?.label)}
                </span>
              }
              tone="negative"
              caption={
                overviewQuery.data?.weakestRow
                  ? formatSignedCurrencyValue(
                      overviewQuery.data.weakestRow.netPnl,
                      currencyCode
                    )
                  : "—"
              }
            />
            <StatCard
              label="Active dimension"
              value={REPORT_DIMENSION_LABELS[activeDimension]}
              caption={
                drilldown
                  ? `Panels and summary are focused on ${formatReportLabel(
                      drilldown.value
                    )}.`
                  : "Select a chart bar or table row to focus the supporting panels."
              }
            />
          </div>
        </div>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">Breakdown table</p>
              <p className="text-xs text-white/45">
                Standalone, paginated, and linked to the hero chart drilldown.
              </p>
            </div>
            <p className="text-xs text-white/45">
              {totalRows === 0
                ? "Showing 0 of 0"
                : `Showing ${pageStart}-${pageEnd} of ${totalRows}`}
            </p>
          </div>

          <div className="overflow-hidden rounded-lg">
            <DataTable
              table={table}
              className="rounded-b-none ring-b-0"
              usePaginationRows
              onRowClick={(row: BreakdownTableData["rows"][number]) =>
                setDrilldown(
                  drilldown?.dimension === activeDimension &&
                    drilldown.value === row.key
                    ? null
                    : { dimension: activeDimension, value: row.key }
                )
              }
              emptyState={
                <div className="px-6 py-8 text-sm text-white/45">
                  No rows for the current filters.
                </div>
              }
            />
            <div className="flex items-center justify-between gap-3 ring ring-white/5 bg-sidebar/70 px-4 py-3">
              <p className="text-xs text-white/45">
                Page {Math.max(pageIndex + 1, 1)} of{" "}
                {Math.max(table.getPageCount(), 1)}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  className="h-8 rounded-sm ring ring-white/5 bg-sidebar px-3 text-xs text-white/70 hover:bg-sidebar-accent disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => table.previousPage()}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  className="h-8 rounded-sm ring ring-white/5 bg-sidebar px-3 text-xs text-white/70 hover:bg-sidebar-accent disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!table.getCanNextPage()}
                  onClick={() => table.nextPage()}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white">Supporting panels</p>
            <p className="text-xs text-white/45">
              Reorder and resize panels for this lens without turning reports
              into a blank canvas.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="h-8 rounded-sm bg-sidebar px-3 text-xs text-white/70 hover:bg-sidebar-accent"
              onClick={togglePanelsEdit}
            >
              <LayoutGrid className="size-3" />
              {isEditingPanels ? "Done" : "Customize panels"}
            </Button>

            {isEditingPanels && hiddenPanels.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    className="h-8 rounded-sm bg-sidebar px-3 text-xs text-white/70 hover:bg-sidebar-accent"
                  >
                    <Plus className="size-3" />
                    Add panel
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-52 rounded-sm bg-sidebar p-1 text-white"
                >
                  {hiddenPanels.map((panelId) => (
                    <DropdownMenuItem
                      key={panelId}
                      className="text-xs text-white/75 focus:bg-sidebar-accent focus:text-white"
                      onClick={() => togglePanel(panelId)}
                    >
                      {REPORT_PANEL_LABELS[panelId]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={activePanels} strategy={rectSortingStrategy}>
            <div className="grid gap-4 xl:grid-cols-2">
              {activePanels.map((panelId) => {
                const panelData = panelDataById[panelId];
                const span = Math.max(
                  1,
                  Math.min(
                    2,
                    panelSpans[panelId] ??
                      REPORT_PANEL_DEFAULT_SPANS[panelId] ??
                      1
                  )
                );
                const isStandaloneRiskCardRow =
                  (panelId === "riskAdjusted" || panelId === "riskBalance") &&
                  panelData?.kind === "stat-grid";
                return (
                  <SortableWidget
                    key={panelId}
                    id={panelId}
                    disabled={!isEditingPanels}
                    style={{
                      gridColumn: isStandaloneRiskCardRow
                        ? "span 2 / span 2"
                        : `span ${span} / span ${span}`,
                    }}
                  >
                    {isStandaloneRiskCardRow ? (
                      <StandaloneStatCardsRow
                        title={REPORT_PANEL_LABELS[panelId]}
                        stats={panelData.stats}
                        currencyCode={currencyCode}
                        isEditing={isEditingPanels}
                        canRemove={activePanels.length > 1}
                        onRemove={() => togglePanel(panelId)}
                      />
                    ) : (
                      <WidgetWrapper
                        showHeader
                        icon={LayoutGrid}
                        title={REPORT_PANEL_LABELS[panelId]}
                        className={cn(
                          REPORT_PANEL_HEIGHT_CLASSNAMES[panelId] ??
                            "h-[24rem]",
                          "rounded-lg p-1",
                          span === 2 && "xl:col-span-2"
                        )}
                        headerRight={
                          <PanelHeaderActions
                            span={span}
                            isEditing={isEditingPanels}
                            canRemove={activePanels.length > 1}
                            onRemove={() => togglePanel(panelId)}
                            onResize={(nextSpan) =>
                              resizePanel(panelId, nextSpan)
                            }
                          />
                        }
                        contentClassName="flex min-h-0 flex-col rounded-sm"
                      >
                        <ReportPanelRenderer
                          panelId={panelId}
                          data={panelData}
                          currencyCode={currencyCode}
                        />
                      </WidgetWrapper>
                    )}
                  </SortableWidget>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </main>
    </Tabs>
  );
}

export function ReportsWorkspace() {
  return (
    <ReportsWorkspaceProvider>
      <ReportsWorkspaceContent />
    </ReportsWorkspaceProvider>
  );
}
