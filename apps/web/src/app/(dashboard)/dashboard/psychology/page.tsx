"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Cell,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { APP_RECHARTS_TOOLTIP_CONTENT_STYLE } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Brain,
  Zap,
  Eye,
  Flame,
  Heart,
  Shield,
  TrendingUp,
  Lightbulb,
  Target,
} from "lucide-react";

const FACTORS = ["mood", "confidence", "energy", "focus", "fear", "greed"] as const;
const METRICS = ["winRate", "profit", "rr", "holdTime"] as const;

const factorMeta: Record<string, { label: string; icon: typeof Brain; color: string }> = {
  mood: { label: "Mood", icon: Heart, color: "#f472b6" },
  confidence: { label: "Confidence", icon: Shield, color: "#818cf8" },
  energy: { label: "Energy", icon: Zap, color: "#fbbf24" },
  focus: { label: "Focus", icon: Eye, color: "#38bdf8" },
  fear: { label: "Fear", icon: Flame, color: "#ef4444" },
  greed: { label: "Greed", icon: TrendingUp, color: "#fb923c" },
};

const metricMeta: Record<string, { label: string; suffix: string }> = {
  winRate: { label: "Win Rate", suffix: "%" },
  profit: { label: "Profit", suffix: "$" },
  rr: { label: "R:R", suffix: "" },
  holdTime: { label: "Hold Time", suffix: "m" },
};

function getCorrelationColor(coeff: number): string {
  if (coeff > 0.5) return "text-emerald-400";
  if (coeff > 0.2) return "text-emerald-400/60";
  if (coeff > -0.2) return "text-white/30";
  if (coeff > -0.5) return "text-red-400/60";
  return "text-red-400";
}

function getCorrelationBg(coeff: number): string {
  if (coeff > 0.5) return "bg-emerald-500/15";
  if (coeff > 0.2) return "bg-emerald-500/5";
  if (coeff > -0.2) return "bg-white/[0.02]";
  if (coeff > -0.5) return "bg-red-500/5";
  return "bg-red-500/15";
}

function getSignificanceBadge(sig: string | null | undefined) {
  if (sig === "high") return <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded">HIGH</span>;
  if (sig === "medium") return <span className="text-[8px] bg-yellow-500/20 text-yellow-400 px-1 py-0.5 rounded">MED</span>;
  if (sig === "low") return <span className="text-[8px] bg-white/10 text-white/30 px-1 py-0.5 rounded">LOW</span>;
  return null;
}

export default function PsychologyPage() {
  const accountId = useAccountStore((s) => s.selectedAccountId);
  const [selectedFactor, setSelectedFactor] = useState<string>("mood");
  const [selectedMetric, setSelectedMetric] = useState<string>("winRate");

  const { data: correlations, isLoading: loadingCorr } =
    trpc.journal.getPsychologyCorrelations.useQuery(
      { accountId: accountId || undefined, periodDays: 30 },
      { enabled: true }
    );

  const { data: optimalConditions, isLoading: loadingOptimal } =
    trpc.journal.getOptimalTradingConditions.useQuery(
      { accountId: accountId || undefined },
      { enabled: true }
    );

  // Build correlation lookup
  const corrMap = useMemo(() => {
    const map: Record<string, any> = {};
    if (!correlations) return map;
    for (const c of correlations) {
      map[`${c.psychologyFactor}-${c.metric}`] = c;
    }
    return map;
  }, [correlations]);

  // Get selected correlation for scatter chart
  const selectedCorr = corrMap[`${selectedFactor}-${selectedMetric}`];
  const scatterData = selectedCorr?.insights?.dataPoints || [];

  if (loadingCorr && loadingOptimal) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <Brain className="size-5" />
          Psychology Analytics
        </h1>
        <p className="text-xs text-white/40 mt-1">
          Understand how your mental state affects trading performance
        </p>
      </div>

      {/* Optimal Conditions */}
      {optimalConditions && (
        <div className="bg-sidebar border border-white/5 rounded-md p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="size-4 text-emerald-400" />
            <h2 className="text-sm font-medium text-white">Optimal Trading Conditions</h2>
          </div>

          {optimalConditions.optimalPsychology && Object.keys(optimalConditions.optimalPsychology).length > 0 && (
            <div className="flex gap-3 mb-3 flex-wrap">
              {Object.entries(optimalConditions.optimalPsychology).map(([key, val]) => {
                const meta = factorMeta[key];
                if (!meta || val == null) return null;
                return (
                  <div key={key} className="flex items-center gap-1.5 bg-white/5 rounded px-2 py-1">
                    <meta.icon className="size-3" style={{ color: meta.color }} />
                    <span className="text-[10px] text-white/50">{meta.label}:</span>
                    <span className="text-[10px] text-white font-medium">{typeof val === "number" ? `${val}/10` : String(val)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {optimalConditions.recommendations.length > 0 && (
            <div className="space-y-1.5">
              {optimalConditions.recommendations.map((rec: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-[11px] text-white/60">
                  <Lightbulb className="size-3 text-yellow-400 mt-0.5 shrink-0" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}

          {optimalConditions.recommendations.length === 0 && Object.keys(optimalConditions.optimalPsychology || {}).length === 0 && (
            <p className="text-[11px] text-white/30">
              Not enough journal entries with psychology data yet. Log your mood, confidence, and energy in journal entries to unlock insights.
            </p>
          )}
        </div>
      )}

      {/* Correlation Matrix */}
      <div className="bg-sidebar border border-white/5 rounded-md p-4">
        <h2 className="text-sm font-medium text-white mb-3">Correlation Matrix</h2>
        <p className="text-[10px] text-white/30 mb-4">
          Click any cell to see the scatter plot below. Green = positive correlation, Red = negative.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-[9px] text-white/30 text-left p-1.5 w-24" />
                {METRICS.map((m) => (
                  <th key={m} className="text-[9px] text-white/40 font-medium text-center p-1.5">
                    {metricMeta[m].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FACTORS.map((f) => {
                const meta = factorMeta[f];
                const Icon = meta.icon;
                return (
                  <tr key={f}>
                    <td className="p-1.5">
                      <div className="flex items-center gap-1.5">
                        <Icon className="size-3" style={{ color: meta.color }} />
                        <span className="text-[10px] text-white/60">{meta.label}</span>
                      </div>
                    </td>
                    {METRICS.map((m) => {
                      const corr = corrMap[`${f}-${m}`];
                      const coeff = corr ? parseFloat(corr.correlationCoefficient) : 0;
                      const isSelected = selectedFactor === f && selectedMetric === m;

                      return (
                        <td key={m} className="p-1">
                          <button
                            onClick={() => { setSelectedFactor(f); setSelectedMetric(m); }}
                            className={cn(
                              "w-full rounded p-2 text-center transition-all cursor-pointer",
                              getCorrelationBg(coeff),
                              isSelected && "ring-1 ring-white/20"
                            )}
                          >
                            <div className={cn("text-[13px] font-semibold", getCorrelationColor(coeff))}>
                              {corr ? (coeff > 0 ? "+" : "") + coeff.toFixed(2) : "—"}
                            </div>
                            <div className="mt-0.5">
                              {corr && getSignificanceBadge(corr.significance)}
                            </div>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scatter Plot */}
      <div className="bg-sidebar border border-white/5 rounded-md p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-white">
            {factorMeta[selectedFactor]?.label} vs {metricMeta[selectedMetric]?.label}
          </h2>
          {selectedCorr && (
            <span className={cn("text-xs font-medium", getCorrelationColor(parseFloat(selectedCorr.correlationCoefficient)))}>
              r = {parseFloat(selectedCorr.correlationCoefficient).toFixed(3)}
              {" "}{getSignificanceBadge(selectedCorr.significance)}
            </span>
          )}
        </div>

        {scatterData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={[1, 10]}
                  tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: factorMeta[selectedFactor]?.label, position: "insideBottom", offset: -5, fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
                />
                <YAxis
                  dataKey="y"
                  tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: metricMeta[selectedMetric]?.label, angle: -90, position: "insideLeft", fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
                />
                <RechartsTooltip
                  contentStyle={APP_RECHARTS_TOOLTIP_CONTENT_STYLE}
                  formatter={(val: number, name: string) => [
                    val.toFixed(2),
                    name === "x" ? factorMeta[selectedFactor]?.label : metricMeta[selectedMetric]?.label,
                  ]}
                />
                <Scatter data={scatterData} fill={factorMeta[selectedFactor]?.color || "#818cf8"}>
                  {scatterData.map((_: any, i: number) => (
                    <Cell key={i} fillOpacity={0.6} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-white/20 text-sm">
            No data points available for this combination.
            <br />
            Log psychology data in journal entries to see correlations.
          </div>
        )}

        {/* Insights */}
        {selectedCorr?.insights && (
          <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
            {selectedCorr.insights.bestConditions && (
              <div className="text-[11px]">
                <span className="text-emerald-400 font-medium">Best: </span>
                <span className="text-white/50">{selectedCorr.insights.bestConditions}</span>
              </div>
            )}
            {selectedCorr.insights.worstConditions && (
              <div className="text-[11px]">
                <span className="text-red-400 font-medium">Worst: </span>
                <span className="text-white/50">{selectedCorr.insights.worstConditions}</span>
              </div>
            )}
            {selectedCorr.insights.recommendation && (
              <div className="text-[11px] flex items-start gap-1.5">
                <Lightbulb className="size-3 text-yellow-400 mt-0.5 shrink-0" />
                <span className="text-white/60">{selectedCorr.insights.recommendation}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
