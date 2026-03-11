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
import { JournalWidgetFrame } from "./journal-widget-shell";

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

  const { data: correlationsData, isLoading, refetch } = trpc.journal.getPsychologyCorrelations.useQuery(
    {
      accountId,
      forceRecalculate,
      periodDays: 30,
    },
    {
      onSettled: () => setForceRecalculate(false),
    }
  );

  const { data: optimalConditionsData } = trpc.journal.getOptimalTradingConditions.useQuery({
    accountId,
  });
  const correlations = (correlationsData ?? []) as PsychologyCorrelation[];
  const optimalConditions = optimalConditionsData as OptimalTradingConditions | undefined;

  const handleRefresh = () => {
    setForceRecalculate(true);
    refetch();
  };

  const widgetHeader = (
    <div className="flex items-center justify-between gap-3 p-3.5">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Brain className="h-4 w-4 text-teal-300" />
        <span>Psychology &amp; Performance</span>
      </div>
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
    </div>
  );

  if (isLoading) {
    return (
      <JournalWidgetFrame className={className} header={widgetHeader}>
        <div className="p-4">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </JournalWidgetFrame>
    );
  }

  if (!correlations || correlations.length === 0) {
    return (
      <JournalWidgetFrame className={className} header={widgetHeader}>
        <div className="p-4">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-10 w-10 text-white/20 mb-3" />
            <p className="text-sm text-white/40 mb-2">
              Not enough data to analyze correlations
            </p>
            <p className="text-xs text-white/30">
              Keep journaling with psychology tracking to see how your mental state affects your trading
            </p>
          </div>
        </div>
      </JournalWidgetFrame>
    );
  }

  const significantCorrelations = correlations.filter(
    (c) => c.significance === "high" || c.significance === "medium"
  );

  return (
    <JournalWidgetFrame className={className} header={widgetHeader}>
      <div className="space-y-6 p-4">
        {optimalConditions?.recommendations && optimalConditions.recommendations.length > 0 && (
          <div className="p-3 bg-teal-500/10 border border-teal-500/20">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-teal-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                {optimalConditions.recommendations.map((rec, i) => (
                  <p key={i} className="text-xs text-teal-300">
                    {rec}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {significantCorrelations.length > 0 ? (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-white/60">Key Findings</h4>
            {significantCorrelations.map((correlation, index) => (
              <CorrelationCard key={index} correlation={correlation} />
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-white/40">
              No significant correlations found yet
            </p>
          </div>
        )}

        {correlations.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-white/60">All Correlations</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {correlations.map((correlation, index) => (
                <CorrelationMiniCard key={index} correlation={correlation} />
              ))}
            </div>
          </div>
        )}
      </div>
    </JournalWidgetFrame>
  );
}

interface CorrelationCardProps {
  correlation: PsychologyCorrelation;
}

function CorrelationCard({ correlation }: CorrelationCardProps) {
  const [showChart, setShowChart] = React.useState(false);
  const isPositive = correlation.correlationCoefficient > 0;
  const absCorrelation = Math.abs(correlation.correlationCoefficient);

  const getSignificanceColor = () => {
    if (correlation.significance === "high") return "text-green-400";
    if (correlation.significance === "medium") return "text-yellow-400";
    return "text-white/40";
  };

  return (
    <div className="p-3 bg-sidebar-accent border border-white/10 space-y-3">
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

      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <CheckCircle className="h-3 w-3 text-green-400 mt-0.5" />
          <p className="text-xs text-white/60">{correlation.insights.bestConditions}</p>
        </div>
        <div className="flex items-start gap-2">
          <AlertCircle className="h-3 w-3 text-red-400 mt-0.5" />
          <p className="text-xs text-white/60">{correlation.insights.worstConditions}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <span className="text-xs text-white/30">
          {correlation.sampleSize} samples • {correlation.significance} significance
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowChart(!showChart)}
          className="h-6 text-xs text-white/40 hover:text-white"
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
  const absCorrelation = Math.abs(correlation.correlationCoefficient);

  const getBgColor = () => {
    if (correlation.significance === "high") {
      return isPositive ? "bg-green-500/20 border-green-500/30" : "bg-red-500/20 border-red-500/30";
    }
    if (correlation.significance === "medium") {
      return isPositive ? "bg-teal-500/10 border-teal-500/20" : "bg-orange-500/10 border-orange-500/20";
    }
    return "bg-sidebar-accent border-white/10";
  };

  return (
    <div className={cn("p-2 border text-center", getBgColor())}>
      <p className="text-xs text-white/60 truncate">
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
