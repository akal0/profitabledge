"use client";

import { useState } from "react";
import { Coins, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import {
  GoalContentSeparator,
  GoalSurface,
} from "@/components/goals/goal-surface";
import {
  formatDisplayCurrency,
  formatDisplayNumber,
  type CurrencySymbol,
} from "@/lib/format-display";
import { cn } from "@/lib/utils";
import type {
  AnalysisBlock,
  CondensedProfile,
  VizSpec,
} from "@/types/assistant-stream";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
} from "@/components/dashboard/charts/dashboard-chart-ui";

type EdgeConditionItem = {
  label: string;
  winRate: number;
  trades: number;
  confidence: string;
};

type ParsedSessionStat = {
  label: string;
  winRate: number | null;
  trades: number | null;
};

type ParsedSymbolStat = {
  label: string;
  profit: number | null;
  winRate: number | null;
  currencySymbol: CurrencySymbol;
};

type InsightBarRow = {
  label: string;
  value: number;
  note: string;
  noteSegments?: Array<{
    label: string;
    tone?: "positive" | "negative" | "neutral";
  }>;
  tone?: "positive" | "negative";
};

type AssistantStatRow = {
  label: string;
  value: string;
  note?: string;
};

function getGridColumnClasses(_smColumns: 2 = 2, _xlColumns: 2 | 3 | 4 = 4) {
  return "grid grid-cols-1 gap-3 sm:grid-cols-12 xl:grid-cols-12";
}

function getRowSize(index: number, total: number, columns: 2 | 3 | 4) {
  const rowStartIndex = Math.floor(index / columns) * columns;
  return Math.min(columns, total - rowStartIndex);
}

function getSpanForRowSize(rowSize: number): 3 | 4 | 6 | 12 {
  switch (rowSize) {
    case 4:
      return 3;
    case 3:
      return 4;
    case 2:
      return 6;
    case 1:
    default:
      return 12;
  }
}

function getResponsiveSpanClass(
  prefix: "sm" | "xl",
  span: 3 | 4 | 6 | 12
) {
  if (prefix === "sm") {
    switch (span) {
      case 12:
        return "sm:col-span-12";
      case 6:
        return "sm:col-span-6";
      case 4:
        return "sm:col-span-4";
      case 3:
      default:
        return "sm:col-span-3";
    }
  }

  switch (span) {
    case 12:
      return "xl:col-span-12";
    case 6:
      return "xl:col-span-6";
    case 4:
      return "xl:col-span-4";
    case 3:
    default:
      return "xl:col-span-3";
  }
}

function getGridItemSpanClass({
  index,
  total,
  smColumns = 2,
  xlColumns = 4,
}: {
  index: number;
  total: number;
  smColumns?: 2;
  xlColumns?: 2 | 3 | 4;
}) {
  const smRowSize = getRowSize(index, total, smColumns);
  const xlRowSize = getRowSize(index, total, xlColumns);
  const smSpan = getSpanForRowSize(smRowSize);
  const xlSpan = getSpanForRowSize(xlRowSize);

  return cn(
    "w-full",
    getResponsiveSpanClass("sm", smSpan),
    getResponsiveSpanClass("xl", xlSpan)
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-medium text-white/70">{children}</h3>;
}

function SurfaceCard({
  title,
  headerRight,
  children,
  className,
}: {
  title: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <GoalSurface className={cn("h-full w-full overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-3 px-3.5 py-2">
        <h3 className="text-sm font-medium text-white/60">{title}</h3>
        {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
      </div>
      <GoalContentSeparator />
      <div className="overflow-hidden px-3.5 py-3.5">{children}</div>
    </GoalSurface>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <GoalSurface className="h-full w-full overflow-hidden">
      <div className="flex h-full min-h-[6.25rem] px-3.5 py-3.5">
        <div className="flex w-full flex-col items-start justify-center gap-1.5 text-left">
          <p className="text-xs font-medium text-white/45">{label}</p>
          <p className="text-xl font-semibold text-white">{value}</p>
          {note ? <p className="text-xs text-white/35">{note}</p> : null}
        </div>
      </div>
    </GoalSurface>
  );
}

function SummaryCard({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: string;
  note?: React.ReactNode;
  tone?: "positive" | "negative" | "neutral";
}) {
  const accent =
    tone === "positive"
      ? "text-emerald-300"
      : tone === "negative"
      ? "text-rose-300"
      : "text-white";

  return (
    <GoalSurface className="w-full overflow-hidden">
      <div className="flex min-h-[6.25rem] px-3.5 py-3.5">
        <div className="flex w-full flex-col items-start justify-center gap-1.5 text-left">
          <p className="text-xs font-medium text-white/45">{label}</p>
          <p className={cn("line-clamp-2 text-base font-semibold", accent)}>
            {value}
          </p>
          {note ? (
            <div className="line-clamp-2 text-xs text-white/35">{note}</div>
          ) : null}
        </div>
      </div>
    </GoalSurface>
  );
}

function inferDisplayTone(value: string): "positive" | "negative" | "neutral" {
  const normalized = value.trim();
  if (!normalized) return "neutral";
  if (/^-([$£€]|\d)/.test(normalized)) return "negative";
  if (/^\+([$£€]|\d)/.test(normalized)) return "positive";
  return "neutral";
}

export function AssistantStatCardGrid({
  rows,
  xlColumns = 4,
}: {
  rows: AssistantStatRow[];
  xlColumns?: 2 | 3 | 4;
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className={getGridColumnClasses(2, xlColumns)}>
      {rows.map((row, index) => (
        <div
          key={`${row.label}-${index}`}
          className={getGridItemSpanClass({
            index,
            total: rows.length,
            smColumns: 2,
            xlColumns,
          })}
        >
          <SummaryCard
            label={row.label}
            value={row.value}
            note={row.note}
            tone={inferDisplayTone(row.value)}
          />
        </div>
      ))}
    </div>
  );
}

function formatSummaryMetric(
  value: number | string,
  format: "currency" | "percent" | "ratio" | "number"
) {
  if (typeof value === "string") {
    return value;
  }

  switch (format) {
    case "currency":
      return formatDisplayCurrency(value);
    case "percent":
      return `${formatDisplayNumber(value, { maximumFractionDigits: 1 })}%`;
    case "ratio":
      return formatDisplayNumber(value, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    case "number":
    default:
      return formatDisplayNumber(value, { maximumFractionDigits: 2 });
  }
}

function inferVizMetricFormat(
  viz?: VizSpec
): "currency" | "percent" | "ratio" | "number" {
  if (viz?.data.valueFormat) {
    return viz.data.valueFormat;
  }

  const explicit = viz?.data.comparison?.format;
  if (explicit) {
    return explicit;
  }

  const hint = [viz?.title, viz?.subtitle, viz?.data.yAxis, viz?.data.label]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    [
      "profit",
      "loss",
      "pnl",
      "expectancy",
      "drawdown",
      "commission",
      "swap",
      "balance",
      "equity",
    ].some((token) => hint.includes(token))
  ) {
    return "currency";
  }

  if (["rate", "percent", "efficiency"].some((token) => hint.includes(token))) {
    return "percent";
  }

  if (["rr", "factor"].some((token) => hint.includes(token))) {
    return "ratio";
  }

  return "number";
}

function buildSummaryRowsFromVisualization(viz?: VizSpec): AssistantStatRow[] {
  if (!viz) {
    return [];
  }

  const rows: AssistantStatRow[] = [];
  const format = inferVizMetricFormat(viz);
  const summary = viz.data.summary;
  const comparison = viz.data.comparison;

  if (comparison) {
    rows.push(
      {
        label: comparison.a.label,
        value: formatSummaryMetric(
          comparison.a.value,
          comparison.format || format
        ),
        note: comparison.a.count ? `${comparison.a.count} trades` : undefined,
      },
      {
        label: comparison.b.label,
        value: formatSummaryMetric(
          comparison.b.value,
          comparison.format || format
        ),
        note: comparison.b.count ? `${comparison.b.count} trades` : undefined,
      }
    );

    if (comparison.delta !== undefined) {
      rows.push({
        label: "Difference",
        value: formatSummaryMetric(
          comparison.delta,
          comparison.format || format
        ),
        note: comparison.deltaPercent
          ? `${comparison.deltaPercent} vs baseline`
          : undefined,
      });
    }
  }

  if (summary?.best) {
    rows.push({
      label: "Highest result",
      value: String(summary.best.label),
      note: formatSummaryMetric(summary.best.value, format),
    });
  }

  if (summary?.worst) {
    rows.push({
      label: "Lowest result",
      value: String(summary.worst.label),
      note: formatSummaryMetric(summary.worst.value, format),
    });
  }

  if (summary?.total !== undefined) {
    rows.push({
      label: "Total",
      value: formatSummaryMetric(summary.total, format),
      note: summary.count ? `${summary.count} trades` : undefined,
    });
  }

  if (summary?.average !== undefined) {
    rows.push({
      label: "Average",
      value: formatSummaryMetric(summary.average, format),
    });
  }

  if (
    rows.length === 0 &&
    viz.type === "kpi_single" &&
    viz.data.value !== undefined
  ) {
    rows.push({
      label: viz.data.label || "Result",
      value: formatSummaryMetric(viz.data.value as number | string, format),
      note: viz.data.summary?.count
        ? `${viz.data.summary.count} trades`
        : undefined,
    });
  }

  if (
    rows.length === 0 &&
    viz.type === "kpi_grid" &&
    Array.isArray(viz.data.rows)
  ) {
    for (const row of viz.data.rows.slice(0, 4)) {
      rows.push({
        label: String(row.label || "Metric"),
        value: String(row.value ?? "—"),
      });
    }
  }

  return rows.slice(0, 4);
}

export function AssistantGenericSummaryWidgets({
  analysisBlocks,
  visualization,
}: {
  analysisBlocks?: AnalysisBlock[];
  visualization?: VizSpec;
}) {
  const embeddedVisualization = analysisBlocks?.find(
    (block): block is Extract<AnalysisBlock, { type: "visualization" }> =>
      block.type === "visualization"
  )?.viz;
  const effectiveVisualization = visualization ?? embeddedVisualization;
  const statsBlock = analysisBlocks?.find(
    (block): block is Extract<AnalysisBlock, { type: "stats" }> =>
      block.type === "stats" && block.rows.length > 0
  );
  const coverageBlock = analysisBlocks?.find(
    (block): block is Extract<AnalysisBlock, { type: "coverage" }> =>
      block.type === "coverage"
  );
  const calloutBlock = analysisBlocks?.find(
    (block): block is Extract<AnalysisBlock, { type: "callout" }> =>
      block.type === "callout"
  );

  const rows: AssistantStatRow[] = [
    ...(statsBlock?.rows?.slice(0, 4).map((row) => ({
      label: row.label,
      value: row.value,
      note: row.note,
    })) ?? []),
  ];

  if (rows.length === 0) {
    rows.push(...buildSummaryRowsFromVisualization(effectiveVisualization));
  }

  if (rows.length === 0 && coverageBlock) {
    rows.push({
      label: "Sample size",
      value: formatDisplayNumber(coverageBlock.n),
      note: coverageBlock.confidence
        ? `${coverageBlock.confidence} confidence`
        : undefined,
    });
  }

  if (rows.length === 0 && calloutBlock) {
    rows.push({
      label: calloutBlock.title,
      value:
        calloutBlock.tone === "success"
          ? "High confidence"
          : calloutBlock.tone === "warning"
          ? "Caution"
          : "Info",
      note: calloutBlock.body,
    });
  }

  if (rows.length === 0) {
    return null;
  }

  return <AssistantStatCardGrid rows={rows} xlColumns={3} />;
}

function parseSessionStat(input: string): ParsedSessionStat {
  const label = input.split("(")[0]?.trim() || input.trim();
  const winRateMatch = input.match(/(-?\d+(?:\.\d+)?)%\s*WR/i);
  const tradesMatch = input.match(/(\d+)\s*trades?/i);

  return {
    label,
    winRate: winRateMatch ? Number(winRateMatch[1]) : null,
    trades: tradesMatch ? Number(tradesMatch[1]) : null,
  };
}

function normalizeCurrencySymbol(value?: string | null): CurrencySymbol {
  if (value === "£" || value === "€") {
    return value;
  }

  return "$";
}

function parseCurrencyValue(input: string): {
  value: number | null;
  currencySymbol: CurrencySymbol;
} {
  const prefixedMatch = input.match(/(-)?\s*([$£€])\s*(\d[\d,]*(?:\.\d+)?)/);
  const suffixedMatch = input.match(/([$£€])\s*(-?\d[\d,]*(?:\.\d+)?)/);
  const match = prefixedMatch ?? suffixedMatch;

  if (!match) {
    return { value: null, currencySymbol: "$" };
  }

  const currencySymbol = normalizeCurrencySymbol(match[2] ?? match[1]);
  const rawNumber = (match[3] ?? match[2] ?? "").replace(/,/g, "");
  const parsed = Number(rawNumber);

  if (!Number.isFinite(parsed)) {
    return { value: null, currencySymbol };
  }

  const isNegative =
    match[0].includes("-") ||
    input.includes("-$") ||
    input.includes("-£") ||
    input.includes("-€");

  return {
    value: isNegative ? -Math.abs(parsed) : parsed,
    currencySymbol,
  };
}

function parseSymbolStat(input: string): ParsedSymbolStat {
  const label = input.split("(")[0]?.trim() || input.trim();
  const winRateMatch = input.match(/(-?\d+(?:\.\d+)?)%\s*WR/i);
  const { value, currencySymbol } = parseCurrencyValue(input);

  return {
    label,
    profit: value,
    winRate: winRateMatch ? Number(winRateMatch[1]) : null,
    currencySymbol,
  };
}

function formatSessionNote(item: ParsedSessionStat) {
  const parts = [];

  if (item.winRate !== null) {
    parts.push(
      `${formatDisplayNumber(item.winRate, {
        maximumFractionDigits: 0,
      })}% win rate`
    );
  }

  if (item.trades !== null) {
    parts.push(`${item.trades} trades`);
  }

  return parts.join(" • ");
}

function formatSymbolNote(item: ParsedSymbolStat) {
  const parts = [];

  if (item.profit !== null) {
    parts.push(formatDisplayCurrency(item.profit, item.currencySymbol));
  }

  if (item.winRate !== null) {
    parts.push(
      `${formatDisplayNumber(item.winRate, {
        maximumFractionDigits: 0,
      })}% win rate`
    );
  }

  return parts.join(" • ");
}

function getSymbolNoteSegments(item: ParsedSymbolStat): Array<{
  label: string;
  tone?: "positive" | "negative" | "neutral";
}> {
  const segments: Array<{
    label: string;
    tone?: "positive" | "negative" | "neutral";
  }> = [];

  if (item.profit !== null) {
    segments.push({
      label: formatDisplayCurrency(item.profit, item.currencySymbol),
      tone: item.profit < 0 ? "negative" : "positive",
    });
  }

  if (item.winRate !== null) {
    segments.push({
      label: `${formatDisplayNumber(item.winRate, {
        maximumFractionDigits: 0,
      })}% win rate`,
      tone: "neutral",
    });
  }

  return segments;
}

function InsightBarChartCard({
  title,
  headerRight,
  className,
  rows,
  valueFormatter,
  tooltipTitle,
  forcedTone,
}: {
  title: string;
  headerRight?: React.ReactNode;
  className?: string;
  rows: InsightBarRow[];
  valueFormatter: (value: number) => string;
  tooltipTitle: string;
  forcedTone?: "positive" | "negative";
}) {
  if (rows.length === 0) {
    return (
      <SurfaceCard
        title={title}
        headerRight={headerRight}
        className={className}
      >
        <p className="text-sm text-white/40">Not enough data yet.</p>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard title={title} headerRight={headerRight} className={className}>
      <div className="flex flex-col">
        <ChartContainer
          config={{ value: { label: tooltipTitle, color: "#2dd4bf" } }}
          className="h-60 w-full md:h-72"
        >
          <BarChart
            data={rows}
            margin={{ top: 12, right: 8, left: 8, bottom: 4 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.1)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => String(value).slice(0, 14)}
            />
            <YAxis
              tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={60}
              tickMargin={8}
              tickFormatter={valueFormatter}
            />
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const datum = payload[0]?.payload;
                const tone =
                  forcedTone ??
                  (Number(datum?.value ?? 0) < 0 ? "negative" : "positive");

                return (
                  <DashboardChartTooltipFrame title={tooltipTitle}>
                    <DashboardChartTooltipRow
                      label={datum?.label ?? "Value"}
                      value={valueFormatter(Number(datum?.value ?? 0))}
                      tone={tone}
                      indicatorColor={
                        tone === "negative" ? "#fb7185" : "#2dd4bf"
                      }
                    />
                    <DashboardChartTooltipRow
                      label="Details"
                      value={datum?.note ?? "n/a"}
                      dimmed
                    />
                  </DashboardChartTooltipFrame>
                );
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {rows.map((row, index) => {
                const tone =
                  forcedTone ??
                  row.tone ??
                  (row.value < 0 ? "negative" : "positive");
                return (
                  <Cell
                    key={`${title}-${row.label}-${index}`}
                    fill={tone === "negative" ? "#fb7185" : "#2dd4bf"}
                    opacity={0.8}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
    </SurfaceCard>
  );
}

function ChartModeSwitch({
  value,
  onChange,
}: {
  value: "best" | "worst";
  onChange: (next: "best" | "worst") => void;
}) {
  return (
    <div className="inline-flex rounded-sm ring ring-white/8 bg-white/5 p-0.5">
      {(
        [
          ["best", "Best"],
          ["worst", "Worst"],
        ] as const
      ).map(([nextValue, label]) => (
        <button
          key={nextValue}
          type="button"
          onClick={() => onChange(nextValue)}
          className={cn(
            "rounded-[3px] px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
            value === nextValue
              ? "bg-white/10 text-white"
              : "text-white/45 hover:text-white/70"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SessionChartCard({
  title,
  headerRight,
  className,
  items,
  tone,
}: {
  title: string;
  headerRight?: React.ReactNode;
  className?: string;
  items: string[];
  tone: "positive" | "negative";
}) {
  const rows: InsightBarRow[] = items
    .map(parseSessionStat)
    .filter((item) => item.label && item.winRate !== null)
    .map((item) => ({
      label: item.label,
      value: item.winRate ?? 0,
      note: formatSessionNote(item),
      noteSegments: [
        {
          label: formatSessionNote(item),
          tone: "neutral",
        },
      ],
      tone,
    }));

  return (
    <InsightBarChartCard
      title={title}
      headerRight={headerRight}
      className={className}
      rows={rows}
      valueFormatter={(value) =>
        `${formatDisplayNumber(value, { maximumFractionDigits: 0 })}%`
      }
      tooltipTitle="Win rate"
      forcedTone={tone}
    />
  );
}

function SymbolChartCard({
  title,
  headerRight,
  className,
  items,
  tone,
}: {
  title: string;
  headerRight?: React.ReactNode;
  className?: string;
  items: string[];
  tone: "positive" | "negative";
}) {
  const parsed = items.map(parseSymbolStat).filter((item) => item.label);
  const currencySymbol =
    parsed.find((item) => item.currencySymbol)?.currencySymbol ?? "$";
  const rows: InsightBarRow[] = parsed
    .filter((item) => item.profit !== null)
    .map((item) => ({
      label: item.label,
      value: item.profit ?? 0,
      note: formatSymbolNote(item),
      noteSegments: getSymbolNoteSegments(item),
      tone: (item.profit ?? 0) < 0 ? "negative" : "positive",
    }));

  return (
    <InsightBarChartCard
      title={title}
      headerRight={headerRight}
      className={className}
      rows={rows}
      valueFormatter={(value) => formatDisplayCurrency(value, currencySymbol)}
      tooltipTitle="P&L"
    />
  );
}

function ConditionChartCard({
  title,
  headerRight,
  className,
  items,
  tone,
}: {
  title: string;
  headerRight?: React.ReactNode;
  className?: string;
  items: EdgeConditionItem[];
  tone: "positive" | "negative";
}) {
  const rows: InsightBarRow[] = items.map((item) => ({
    label: item.label,
    value: item.winRate,
    note: `${item.trades} trades • ${item.confidence} confidence`,
    tone,
  }));

  return (
    <InsightBarChartCard
      title={title}
      headerRight={headerRight}
      className={className}
      rows={rows}
      valueFormatter={(value) =>
        `${formatDisplayNumber(value, { maximumFractionDigits: 0 })}%`
      }
      tooltipTitle="Win rate"
      forcedTone={tone}
    />
  );
}

function SessionsWidget({
  bestItems,
  worstItems,
}: {
  bestItems: string[];
  worstItems: string[];
}) {
  const [mode, setMode] = useState<"best" | "worst">("best");

  return (
    <SessionChartCard
      items={mode === "best" ? bestItems : worstItems}
      tone={mode === "best" ? "positive" : "negative"}
      title="Sessions"
      className="xl:col-span-2"
      headerRight={<ChartModeSwitch value={mode} onChange={setMode} />}
    />
  );
}

function SymbolsWidget({
  bestItems,
  worstItems,
}: {
  bestItems: string[];
  worstItems: string[];
}) {
  const [mode, setMode] = useState<"best" | "worst">("best");

  return (
    <SymbolChartCard
      items={mode === "best" ? bestItems : worstItems}
      tone={mode === "best" ? "positive" : "negative"}
      title="Symbols"
      className="xl:col-span-2"
      headerRight={<ChartModeSwitch value={mode} onChange={setMode} />}
    />
  );
}

function EdgeLeakWidget({
  edges,
  leaks,
}: {
  edges: EdgeConditionItem[];
  leaks: EdgeConditionItem[];
}) {
  const [mode, setMode] = useState<"edges" | "leaks">("edges");

  return (
    <ConditionChartCard
      items={mode === "edges" ? edges : leaks}
      tone={mode === "edges" ? "positive" : "negative"}
      title="Patterns"
      className="xl:col-span-2"
      headerRight={
        <div className="inline-flex rounded-sm ring ring-white/8 bg-white/5 p-0.5">
          {(
            [
              ["edges", "Edges"],
              ["leaks", "Leaks"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                "rounded-[3px] px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
                mode === value
                  ? "bg-white/10 text-white"
                  : "text-white/45 hover:text-white/70"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      }
    />
  );
}

function OpportunityCard({ profile }: { profile: CondensedProfile }) {
  if (!profile.leavingProfitOnTable) {
    return null;
  }

  const details = [
    profile.pctExitingTooEarly > 0
      ? `${formatDisplayNumber(profile.pctExitingTooEarly, {
          maximumFractionDigits: 0,
        })}% kept running after exit`
      : null,
    profile.avgPostExitMove > 0
      ? `${formatDisplayNumber(profile.avgPostExitMove, {
          maximumFractionDigits: 1,
        })} points average post-exit move`
      : null,
    profile.avgProfitLeftPips > 0
      ? `${formatDisplayNumber(profile.avgProfitLeftPips, {
          maximumFractionDigits: 1,
        })} points missed from peak excursion`
      : null,
  ].filter(Boolean) as string[];

  return (
    <SurfaceCard title="Money left on the table" className="xl:col-span-2">
      <div className="space-y-3">
        <div className="flex items-start gap-2 text-white/80">
          <Coins className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-sm leading-6">
            Your exits are still leaving room on the table. Trailing stops or
            partials would likely capture more of the move.
          </p>
        </div>
        {details.length > 0 ? (
          <div className="grid gap-2 md:grid-cols-3">
            {details.map((detail, index) => (
              <div
                key={index}
                className="rounded-sm ring-amber-50 ring-amber-50-white/5 bg-white/5 px-3 py-2 text-sm text-white/75"
              >
                {detail}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </SurfaceCard>
  );
}

export function AssistantProfileSummaryWidgets({
  profile,
}: {
  profile: CondensedProfile;
}) {
  return (
    <div className="space-y-3">
      <SectionHeading>Your trading profile</SectionHeading>
      <div className={getGridColumnClasses(2, 4)}>
        {[
          {
            label: "Win rate",
            value: `${formatDisplayNumber(profile.winRate, {
              maximumFractionDigits: 1,
            })}%`,
          },
          {
            label: "Profit factor",
            value: formatDisplayNumber(profile.profitFactor, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
          },
          {
            label: "Expectancy",
            value: formatDisplayCurrency(profile.expectancy),
          },
          { label: "Total trades", value: String(profile.totalTrades) },
        ].map((item, index, items) => (
          <div
            key={item.label}
            className={getGridItemSpanClass({
              index,
              total: items.length,
              smColumns: 2,
              xlColumns: 4,
            })}
          >
            <MetricCard label={item.label} value={item.value} />
          </div>
        ))}
      </div>
      <div className={getGridColumnClasses(2, 3)}>
        {[
          {
            label: "R:R sweet spot",
            value: profile.rrSweetSpot,
          },
          {
            label: "Hold sweet spot",
            value: profile.holdTimeSweetSpot,
          },
          {
            label: "Current streak",
            value: profile.currentStreak,
          },
        ].map((item, index, items) => (
          <div
            key={item.label}
            className={getGridItemSpanClass({
              index,
              total: items.length,
              smColumns: 2,
              xlColumns: 3,
            })}
          >
            <MetricCard label={item.label} value={item.value} />
          </div>
        ))}
      </div>
      <SessionsWidget
        bestItems={profile.bestSessions}
        worstItems={profile.worstSessions}
      />
      {(profile.bestSymbols.length > 0 || profile.worstSymbols.length > 0) && (
        <SymbolsWidget
          bestItems={profile.bestSymbols}
          worstItems={profile.worstSymbols}
        />
      )}
      <OpportunityCard profile={profile} />
    </div>
  );
}

export function AssistantEdgeConditionWidgets({
  edges,
  leaks,
}: {
  edges: EdgeConditionItem[];
  leaks: EdgeConditionItem[];
}) {
  return (
    <div className="space-y-3">
      <SectionHeading>Your edge conditions</SectionHeading>
      <EdgeLeakWidget edges={edges} leaks={leaks} />
    </div>
  );
}

export function AssistantQuickSummaryWidgets({
  profile,
  edgeConditions,
}: {
  profile?: CondensedProfile | null;
  edgeConditions?: {
    edges: EdgeConditionItem[];
    leaks: EdgeConditionItem[];
  } | null;
}) {
  type QuickSummaryCard = {
    label: string;
    value: string;
    note?: React.ReactNode;
    tone: "positive" | "negative" | "neutral";
  };

  const bestSession = profile?.bestSessions[0];
  const weakestSession = profile?.worstSessions[0];
  const bestSymbol = profile?.bestSymbols[0];
  const weakestSymbol = profile?.worstSymbols[0];
  const topEdge = edgeConditions?.edges[0] || null;
  const topLeak = edgeConditions?.leaks[0] || null;

  const cardCandidates: Array<QuickSummaryCard | null> = [
    bestSession
      ? {
          label: "Best session",
          value: parseSessionStat(bestSession).label,
          note: formatSessionNote(parseSessionStat(bestSession)),
          tone: "positive" as const,
        }
      : null,
    weakestSession
      ? {
          label: "Weakest session",
          value: parseSessionStat(weakestSession).label,
          note: formatSessionNote(parseSessionStat(weakestSession)),
          tone: "negative" as const,
        }
      : null,
    bestSymbol
      ? (() => {
          const parsed = parseSymbolStat(bestSymbol);
          return {
            label: "Best symbol",
            value: parsed.label,
            note: (
              <>
                {getSymbolNoteSegments(parsed).map((segment, index) => (
                  <span
                    key={`best-symbol-${index}`}
                    className={cn(
                      segment.tone === "negative"
                        ? "text-rose-300"
                        : segment.tone === "positive"
                        ? "text-emerald-300"
                        : "text-white/35"
                    )}
                  >
                    {index > 0 ? " • " : ""}
                    {segment.label}
                  </span>
                ))}
              </>
            ),
            tone: "positive" as const,
          };
        })()
      : null,
    weakestSymbol
      ? (() => {
          const parsed = parseSymbolStat(weakestSymbol);
          return {
            label: "Weakest symbol",
            value: parsed.label,
            note: (
              <>
                {getSymbolNoteSegments(parsed).map((segment, index) => (
                  <span
                    key={`weakest-symbol-${index}`}
                    className={cn(
                      segment.tone === "negative"
                        ? "text-rose-300"
                        : segment.tone === "positive"
                        ? "text-emerald-300"
                        : "text-white/35"
                    )}
                  >
                    {index > 0 ? " • " : ""}
                    {segment.label}
                  </span>
                ))}
              </>
            ),
            tone: "negative" as const,
          };
        })()
      : null,
    topEdge
      ? {
          label: "Your edge",
          value: topEdge.label,
          note: `${formatDisplayNumber(topEdge.winRate, {
            maximumFractionDigits: 0,
          })}% win rate • ${topEdge.trades} trades`,
          tone: "positive" as const,
        }
      : profile?.topEdges[0]
      ? {
          label: "Your edge",
          value: profile.topEdges[0],
          note: "Best repeating pattern",
          tone: "positive" as const,
        }
      : null,
    topLeak
      ? {
          label: "Your leak",
          value: topLeak.label,
          note: `${formatDisplayNumber(topLeak.winRate, {
            maximumFractionDigits: 0,
          })}% win rate • ${topLeak.trades} trades`,
          tone: "negative" as const,
        }
      : profile?.topLeaks[0]
      ? {
          label: "Your leak",
          value: profile.topLeaks[0],
          note: "Main drag on performance",
          tone: "negative" as const,
        }
      : null,
  ];

  const cards = cardCandidates.filter(
    (card): card is QuickSummaryCard => card !== null
  );

  if (cards.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <div className={cn("w-full", getGridColumnClasses(2, 3))}>
        {cards.map((card, index) => (
          <div
            key={`${card.label}-${card.value}`}
            className={getGridItemSpanClass({
              index,
              total: cards.length,
              smColumns: 2,
              xlColumns: 3,
            })}
          >
            <SummaryCard
              label={card.label}
              value={card.value}
              note={card.note}
              tone={card.tone}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
