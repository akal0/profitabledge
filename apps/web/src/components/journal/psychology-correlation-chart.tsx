"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  Target,
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { journalActionIconButtonClassName } from "./action-button-styles";
import { JournalInsightsPanelShell } from "./journal-insights-shell";

interface PsychologyCorrelationChartProps {
  accountId?: string;
  className?: string;
}

interface CorrelationPoint {
  x: number;
  y: number;
}

interface PsychologyCorrelation {
  metric: string;
  psychologyFactor: string;
  correlationCoefficient: number;
  sampleSize: number;
  significance: string;
  insights: {
    bestConditions: string;
    worstConditions: string;
    recommendation: string;
    dataPoints: CorrelationPoint[];
  };
}

interface OptimalTradingConditions {
  recommendations?: string[];
}

const PSYCHOLOGY_LABELS: Record<string, string> = {
  mood: "Mood",
  confidence: "Confidence",
  energy: "Energy",
  focus: "Focus",
  fear: "Fear",
  greed: "Greed",
};

const METRIC_LABELS: Record<string, string> = {
  winRate: "Win Rate",
  profit: "Profit ($)",
  rr: "R:R Achieved",
  holdTime: "Hold Time (min)",
};

const chartConfig = {
  positive: {
    label: "Positive",
    color: "hsl(var(--chart-1))",
  },
  negative: {
    label: "Negative",
    color: "hsl(var(--chart-3))",
  },
  neutral: {
    label: "Neutral",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export function PsychologyCorrelationChart({
  accountId,
  className,
}: PsychologyCorrelationChartProps) {
  const [forceRecalculate, setForceRecalculate] = React.useState(false);

  const { data: correlationsData, isLoading, isFetching, refetch } = trpc.journal.getPsychologyCorrelations.useQuery(
    {
      accountId,
      forceRecalculate,
      periodDays: 30,
    }
  );

  React.useEffect(() => {
    if (!isFetching) {
      setForceRecalculate(false);
    }
  }, [isFetching]);

  const hasCorrelationSeedData =
    Array.isArray(correlationsData) && correlationsData.length > 0;
  const { data: optimalConditionsData } =
    trpc.journal.getOptimalTradingConditions.useQuery(
      {
        accountId,
      },
      {
        enabled: hasCorrelationSeedData,
      }
    );
  const correlations = React.useMemo(
    () =>
      [...((correlationsData ?? []) as PsychologyCorrelation[])].sort(
        (a, b) =>
          Math.abs(b.correlationCoefficient) - Math.abs(a.correlationCoefficient)
      ),
    [correlationsData]
  );
  const optimalConditions = optimalConditionsData as OptimalTradingConditions | undefined;

  const handleRefresh = () => {
    setForceRecalculate(true);
    refetch();
  };

  if (isLoading) {
    return (
      <JournalInsightsPanelShell
        icon={Brain}
        title="Psychology & performance"
        description="Connect tracked mental-state signals to actual trading outcomes."
        className={className}
        action={<Skeleton className="h-9 w-9 bg-sidebar" />}
      >
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full bg-sidebar" />
          ))}
        </div>
      </JournalInsightsPanelShell>
    );
  }

  if (!correlations || correlations.length === 0) {
    return (
      <JournalInsightsPanelShell
        icon={Brain}
        title="Psychology & performance"
        description="Connect tracked mental-state signals to actual trading outcomes."
        className={className}
        action={
          <Button
            size="sm"
            onClick={handleRefresh}
            disabled={forceRecalculate}
            className={journalActionIconButtonClassName}
          >
            <RefreshCw
              className={cn("h-4 w-4", forceRecalculate && "animate-spin")}
            />
          </Button>
        }
      >
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-white/20" />
          <p className="mb-2 text-sm text-white/40">
            Not enough data to analyze correlations
          </p>
          <p className="text-xs text-white/30">
            Keep journaling with psychology tracking to see how your mental state affects your trading.
          </p>
        </div>
      </JournalInsightsPanelShell>
    );
  }

  const significantCorrelations = correlations.filter(
    (c) => c.significance === "high" || c.significance === "medium"
  );

  return (
    <JournalInsightsPanelShell
      icon={Brain}
      title="Psychology & performance"
      description="Connect tracked mental-state signals to actual trading outcomes."
      className={className}
      action={
        <Button
          size="sm"
          onClick={handleRefresh}
          disabled={forceRecalculate}
          className={journalActionIconButtonClassName}
        >
          <RefreshCw
            className={cn("h-4 w-4", forceRecalculate && "animate-spin")}
          />
        </Button>
      }
    >
      <div className="space-y-5">
        {optimalConditions?.recommendations && optimalConditions.recommendations.length > 0 ? (
          <div className="rounded-sm border border-teal-500/20 bg-teal-500/10 p-3.5">
            <div className="flex items-start gap-2">
              <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal-300" />
              <div className="space-y-1.5">
                {optimalConditions.recommendations.map((rec, i) => (
                  <p key={i} className="text-xs leading-5 text-teal-200">
                    {rec}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {significantCorrelations.length > 0 ? (
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-white/45">Key findings</h4>
            {significantCorrelations.slice(0, 4).map((correlation, index) => (
              <CorrelationCard key={index} correlation={correlation} />
            ))}
          </div>
        ) : (
          <div className="rounded-sm border border-dashed border-white/10 bg-sidebar/55 py-4 text-center">
            <p className="text-sm text-white/40">
              No significant correlations found yet
            </p>
          </div>
        )}

        <div className="space-y-3">
          <h4 className="text-xs font-medium text-white/45">Correlation map</h4>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
            {correlations.map((correlation, index) => (
              <CorrelationMiniCard key={index} correlation={correlation} />
            ))}
          </div>
        </div>
      </div>
    </JournalInsightsPanelShell>
  );
}

interface CorrelationCardProps {
  correlation: PsychologyCorrelation;
}

function CorrelationCard({ correlation }: CorrelationCardProps) {
  const [showChart, setShowChart] = React.useState(false);
  const isPositive = correlation.correlationCoefficient > 0;

  return (
    <div className="rounded-sm border border-white/5 bg-white/[0.02] p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isPositive ? (
            <TrendingUp className="h-4 w-4 text-green-400" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-400" />
          )}
          <span className="text-sm font-medium text-white">
            {PSYCHOLOGY_LABELS[correlation.psychologyFactor] || correlation.psychologyFactor} → {METRIC_LABELS[correlation.metric] || correlation.metric}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              isPositive ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"
            )}
          >
            {isPositive ? "+" : ""}
            {(correlation.correlationCoefficient * 100).toFixed(0)}%
          </Badge>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-start gap-2">
          <CheckCircle className="h-3 w-3 text-green-400 mt-0.5" />
          <p className="text-xs leading-5 text-white/60">{correlation.insights.bestConditions}</p>
        </div>
        <div className="flex items-start gap-2">
          <AlertCircle className="h-3 w-3 text-red-400 mt-0.5" />
          <p className="text-xs leading-5 text-white/60">{correlation.insights.worstConditions}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2">
        <span className="text-xs text-white/30">
          {correlation.sampleSize} samples • {correlation.significance} significance
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowChart(!showChart)}
          className="h-6 px-0 text-xs text-white/40 hover:bg-transparent hover:text-white"
        >
          {showChart ? "Hide" : "Show"} chart
        </Button>
      </div>

      {showChart && correlation.insights.dataPoints.length > 0 && (
        <div className="h-40 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart
              margin={{ top: 10, right: 10, bottom: 20, left: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                type="number"
                dataKey="x"
                name={PSYCHOLOGY_LABELS[correlation.psychologyFactor]}
                domain={[0, 10]}
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                tickLine={{ stroke: "rgba(255,255,255,0.2)" }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={METRIC_LABELS[correlation.metric]}
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                tickLine={{ stroke: "rgba(255,255,255,0.2)" }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <span className="text-xs">
                        {name}: {typeof value === "number" ? value.toFixed(2) : value}
                      </span>
                    )}
                  />
                }
              />
              <Scatter
                data={correlation.insights.dataPoints}
                fill={isPositive ? "hsl(var(--chart-1))" : "hsl(var(--chart-3))"}
              >
                {correlation.insights.dataPoints.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={isPositive ? "rgba(20, 184, 166, 0.6)" : "rgba(239, 68, 68, 0.6)"}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

interface CorrelationMiniCardProps {
  correlation: Pick<
    PsychologyCorrelation,
    "metric" | "psychologyFactor" | "correlationCoefficient" | "significance"
  >;
}

function CorrelationMiniCard({ correlation }: CorrelationMiniCardProps) {
  const isPositive = correlation.correlationCoefficient > 0;

  const getBgColor = () => {
    if (correlation.significance === "high") {
      return isPositive
        ? "bg-green-500/12 border-green-500/25"
        : "bg-red-500/12 border-red-500/25";
    }
    if (correlation.significance === "medium") {
      return isPositive
        ? "bg-teal-500/10 border-teal-500/20"
        : "bg-orange-500/10 border-orange-500/20";
    }
    return "bg-white/[0.02] border-white/5";
  };

  return (
    <div className={cn("rounded-sm border p-3", getBgColor())}>
      <p className="truncate text-xs text-white/60">
        {PSYCHOLOGY_LABELS[correlation.psychologyFactor]}
      </p>
      <p className={cn(
        "text-sm font-medium",
        isPositive ? "text-green-400" : "text-red-400"
      )}>
        {isPositive ? "+" : ""}
        {(correlation.correlationCoefficient * 100).toFixed(0)}%
      </p>
    </div>
  );
}

export function PsychologyInsightsBanner({ accountId }: { accountId?: string }) {
  const { data } = trpc.journal.getOptimalTradingConditions.useQuery({
    accountId,
  });
  const optimalConditions = data as OptimalTradingConditions | undefined;

  if (!optimalConditions?.recommendations || optimalConditions.recommendations.length === 0) {
    return null;
  }

  return (
    <div className="p-3 bg-gradient-to-r from-teal-500/10 to-blue-500/10 border border-teal-500/20">
      <div className="flex items-center gap-2 mb-2">
        <Target className="h-4 w-4 text-teal-400" />
        <span className="text-sm font-medium text-white">Trading Insights</span>
      </div>
      <div className="space-y-1">
        {optimalConditions.recommendations.slice(0, 2).map((rec, i) => (
          <p key={i} className="text-xs text-white/60">
            {rec}
          </p>
        ))}
      </div>
    </div>
  );
}
