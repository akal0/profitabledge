"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Eye,
  Flame,
  Heart,
  Lightbulb,
  Shield,
  Target,
  TrendingUp,
  Waypoints,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { Skeleton } from "@/components/ui/skeleton";
import { APP_RECHARTS_TOOLTIP_CONTENT_STYLE } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAccountStore } from "@/stores/account";
import { trpc } from "@/utils/trpc";

const FACTORS = [
  "mood",
  "confidence",
  "energy",
  "focus",
  "fear",
  "greed",
] as const;
const METRICS = ["winRate", "profit", "rr", "holdTime"] as const;

const factorMeta: Record<
  string,
  { label: string; icon: typeof Brain; color: string }
> = {
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

const TILT_LEVEL_STYLES = {
  green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
  yellow: "border-yellow-500/20 bg-yellow-500/10 text-yellow-200",
  orange: "border-orange-500/20 bg-orange-500/10 text-orange-200",
  red: "border-rose-500/20 bg-rose-500/10 text-rose-200",
} as const;

const TREND_STYLES = {
  improving: "text-emerald-300",
  stable: "text-white/60",
  declining: "text-rose-300",
} as const;

const SECTION_CLASS =
  "rounded-xl border border-white/8 bg-white/[0.03] shadow-[0_0_0_1px_rgba(255,255,255,0.015)]";
const PANEL_CLASS = "rounded-lg border border-white/8 bg-white/[0.03]";

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
  if (sig === "high") {
    return (
      <span className="rounded bg-emerald-500/20 px-1 py-0.5 text-[8px] text-emerald-400">
        HIGH
      </span>
    );
  }
  if (sig === "medium") {
    return (
      <span className="rounded bg-yellow-500/20 px-1 py-0.5 text-[8px] text-yellow-400">
        MED
      </span>
    );
  }
  if (sig === "low") {
    return (
      <span className="rounded bg-white/10 px-1 py-0.5 text-[8px] text-white/30">
        LOW
      </span>
    );
  }
  return null;
}

function formatEmotionLabel(emotion: string | null | undefined) {
  if (!emotion || emotion === "none") return "No dominant state";
  if (emotion.toLowerCase() === "fomo") return "FOMO";
  return emotion
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatCurrency(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}$${value.toFixed(2)}`;
}

export default function PsychologyPage() {
  const accountId = useAccountStore((state) => state.selectedAccountId);
  const [selectedFactor, setSelectedFactor] = useState<string>("mood");
  const [selectedMetric, setSelectedMetric] = useState<string>("winRate");

  const { data: psychologyProfile, isLoading: loadingProfile } =
    trpc.ai.getPsychologyProfile.useQuery(
      { accountId: accountId || "" },
      { enabled: Boolean(accountId) }
    );

  const { data: correlations, isLoading: loadingCorr } =
    trpc.journal.getPsychologyCorrelations.useQuery(
      { accountId: accountId || undefined, periodDays: 30 },
      { enabled: Boolean(accountId) }
    );

  const { data: optimalConditions, isLoading: loadingOptimal } =
    trpc.journal.getOptimalTradingConditions.useQuery(
      { accountId: accountId || undefined },
      { enabled: Boolean(accountId) }
    );

  const { data: ruleViolations, isLoading: loadingViolations } =
    trpc.ai.getRuleViolations.useQuery(
      { accountId: accountId || "", limit: 5 },
      { enabled: Boolean(accountId) }
    );

  const corrMap = useMemo(() => {
    const map: Record<string, any> = {};
    if (!correlations) return map;

    for (const item of correlations) {
      map[`${item.psychologyFactor}-${item.metric}`] = item;
    }

    return map;
  }, [correlations]);

  const selectedCorr = corrMap[`${selectedFactor}-${selectedMetric}`];
  const scatterData = selectedCorr?.insights?.dataPoints || [];

  if (!accountId) {
    return (
      <div className="p-6">
        <div className={cn(SECTION_CLASS, "p-6 text-center")}>
          <p className="text-sm text-white/45">
            Select an account to unlock psychology coaching.
          </p>
        </div>
      </div>
    );
  }

  if (loadingProfile && loadingCorr && loadingOptimal && loadingViolations) {
    return <RouteLoadingFallback route="psychology" className="min-h-full" />;
  }

  const mentalScore = psychologyProfile?.mentalScore ?? null;
  const tiltStatus = psychologyProfile?.tiltStatus ?? null;
  const emotionTrend = psychologyProfile?.emotionTrend ?? null;
  const bestEmotions = psychologyProfile?.bestEmotions ?? [];
  const worstEmotions = psychologyProfile?.worstEmotions ?? [];
  const currentViolations = ruleViolations ?? [];
  const tiltLevel = tiltStatus?.level ?? "green";
  const tiltStyle = TILT_LEVEL_STYLES[tiltLevel];

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-white">
          <Brain className="size-5" />
          Psychology coaching
        </h1>
        <p className="text-xs text-white/40">
          Read your current mental state, process pressure, and the conditions
          where you trade best before diving into correlations.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className={cn(SECTION_CLASS, "p-4")}>
          <div className="flex items-center gap-2 text-white/70">
            <Brain className="size-4 text-teal-300" />
            <span className="text-xs uppercase tracking-[0.18em]">
              Tilt status
            </span>
          </div>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-2xl font-semibold text-white">
              {tiltStatus?.tiltScore ?? 0}
            </span>
            <span className="pb-1 text-xs text-white/35">/100</span>
          </div>
          <div
            className={cn(
              "mt-3 inline-flex rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide",
              tiltStyle
            )}
          >
            {tiltLevel === "green"
              ? "Clear mind"
              : tiltLevel === "yellow"
              ? "Mild tilt"
              : tiltLevel === "orange"
              ? "Tilting"
              : "Full tilt"}
          </div>
          <p className="mt-2 text-xs text-white/40">
            {tiltStatus?.indicators.length ?? 0} active pressure signals.
          </p>
        </div>

        <div className={cn(SECTION_CLASS, "p-4")}>
          <div className="flex items-center gap-2 text-white/70">
            <Waypoints className="size-4 text-violet-300" />
            <span className="text-xs uppercase tracking-[0.18em]">
              Mental score
            </span>
          </div>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-2xl font-semibold text-white">
              {mentalScore?.overall ?? 0}
            </span>
            <span className="pb-1 text-xs text-white/35">/100</span>
          </div>
          <p
            className={cn(
              "mt-2 text-xs capitalize",
              TREND_STYLES[mentalScore?.trend ?? "stable"]
            )}
          >
            {mentalScore?.trend ?? "stable"} over the last{" "}
            {mentalScore?.period.days ?? 14} days
          </p>
          <p className="mt-1 text-xs text-white/40">
            Based on {mentalScore?.period.trades ?? 0} recent trades.
          </p>
        </div>

        <div className={cn(SECTION_CLASS, "p-4")}>
          <div className="flex items-center gap-2 text-white/70">
            <Target className="size-4 text-amber-300" />
            <span className="text-xs uppercase tracking-[0.18em]">
              Self-awareness
            </span>
          </div>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-2xl font-semibold text-white">
              {Math.round(emotionTrend?.taggingRate ?? 0)}%
            </span>
            <span className="pb-1 text-xs text-white/35">tag rate</span>
          </div>
          <p className="mt-2 text-xs text-white/40">
            {emotionTrend?.emotionVariety ?? 0} distinct emotional states
            tagged.
          </p>
          <p className="mt-1 text-xs text-white/55">
            Dominant state: {formatEmotionLabel(emotionTrend?.dominantEmotion)}
          </p>
        </div>

        <div className={cn(SECTION_CLASS, "p-4")}>
          <div className="flex items-center gap-2 text-white/70">
            <AlertTriangle className="size-4 text-rose-300" />
            <span className="text-xs uppercase tracking-[0.18em]">
              Process pressure
            </span>
          </div>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-2xl font-semibold text-white">
              {currentViolations.length}
            </span>
            <span className="pb-1 text-xs text-white/35">recent breaks</span>
          </div>
          <p className="mt-2 text-xs text-white/40">
            Recent rule violations and emotional tilt should be reviewed
            together.
          </p>
          <div className="mt-3 flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/settings/rules">Open rulebook</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/journal">Open journal</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className={cn(SECTION_CLASS, "overflow-hidden")}>
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 text-white">
              <Waypoints className="size-4 text-violet-300" />
              <h2 className="text-sm font-semibold">Mental score breakdown</h2>
            </div>
            <p className="mt-1 text-xs text-white/40">
              Your discipline stack across the last {mentalScore?.period.days ?? 14} days.
            </p>
          </div>

          <div className="px-4 pb-4">
            {mentalScore ? (
              <div className="space-y-3">
                {Object.entries(mentalScore.components).map(([key, component]) => (
                  <div key={key} className={cn(PANEL_CLASS, "p-3")}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium capitalize text-white">
                          {key === "emotionManagement"
                            ? "Emotion management"
                            : key === "selfAwareness"
                            ? "Self awareness"
                            : key}
                        </p>
                        <p className="mt-1 text-[11px] text-white/40">
                          {component.details}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-white">
                          {Math.round(component.score)}
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-white/35">
                          {Math.round(component.weight * 100)}% weight
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-teal-400/80 to-blue-400/80"
                        style={{ width: `${Math.max(6, component.score)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={cn(PANEL_CLASS, "p-4 text-sm text-white/45")}>
                Not enough journal or emotion data yet. Start tagging emotional
                state inside the journal to unlock mental performance scoring.
              </div>
            )}
          </div>
        </section>

        <section className={cn(SECTION_CLASS, "overflow-hidden")}>
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 text-white">
              <AlertTriangle className="size-4 text-rose-300" />
              <h2 className="text-sm font-semibold">Pressure signals</h2>
            </div>
            <p className="mt-1 text-xs text-white/40">
              Active tilt indicators and recent rule breaks that deserve review.
            </p>
          </div>

          <div className="grid gap-4 px-4 pb-4">
            <div className={cn(PANEL_CLASS, "p-4")}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.18em] text-white/35">
                  Tilt indicators
                </p>
                <span
                  className={cn(
                    "rounded-full border px-2 py-1 text-[10px]",
                    tiltStyle
                  )}
                >
                  {tiltStatus?.indicators.length ?? 0} active
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {tiltStatus?.indicators.length ? (
                  tiltStatus.indicators.map((indicator, index) => (
                    <div
                      key={`${indicator.type}-${index}`}
                      className="rounded-lg border border-white/8 bg-black/10 px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-white/85">
                          {indicator.label}
                        </p>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase text-white/55">
                          {indicator.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-white/40">
                        {indicator.message}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/8 px-3 py-3 text-sm text-emerald-100/85">
                    No active tilt signals. Current state looks stable.
                  </div>
                )}
              </div>
            </div>

            <div className={cn(PANEL_CLASS, "p-4")}>
              <p className="text-xs uppercase tracking-[0.18em] text-white/35">
                Recent rule pressure
              </p>
              <div className="mt-3 space-y-2">
                {loadingViolations ? (
                  <>
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </>
                ) : currentViolations.length > 0 ? (
                  currentViolations.map((violation) => (
                    <div
                      key={violation.id}
                      className="rounded-lg border border-white/8 bg-black/10 px-3 py-3"
                    >
                      <p className="text-sm text-white/85">
                        {violation.description}
                      </p>
                      <p className="mt-1 text-[11px] text-white/35">
                        {new Date(violation.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-white/8 bg-black/10 px-3 py-3 text-sm text-white/45">
                    No recent rule violations for this account.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <section className={cn(SECTION_CLASS, "overflow-hidden")}>
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 text-white">
              <Target className="size-4 text-emerald-300" />
              <h2 className="text-sm font-semibold">Optimal trading conditions</h2>
            </div>
            <p className="mt-1 text-xs text-white/40">
              Conditions where your logged psychology tends to perform best.
            </p>
          </div>

          <div className="px-4 pb-4">
            {loadingOptimal ? (
              <Skeleton className="h-48 w-full" />
            ) : optimalConditions &&
              optimalConditions.optimalPsychology &&
              Object.keys(optimalConditions.optimalPsychology).length > 0 ? (
              <div className={cn(PANEL_CLASS, "p-4")}>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(optimalConditions.optimalPsychology).map(
                    ([key, value]) => {
                      const meta = factorMeta[key];
                      if (!meta || value == null) return null;

                      return (
                        <div
                          key={key}
                          className="flex items-center gap-1.5 rounded-md border border-white/8 bg-black/10 px-3 py-2"
                        >
                          <meta.icon
                            className="size-3.5"
                            style={{ color: meta.color }}
                          />
                          <span className="text-[11px] text-white/45">
                            {meta.label}
                          </span>
                          <span className="text-[11px] font-medium text-white">
                            {typeof value === "number" ? `${value}/10` : String(value)}
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  {optimalConditions.recommendations.map(
                    (recommendation: string, index: number) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 text-[11px] text-white/60"
                      >
                        <Lightbulb className="mt-0.5 size-3 shrink-0 text-yellow-400" />
                        <span>{recommendation}</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : (
              <div className={cn(PANEL_CLASS, "p-4 text-sm text-white/45")}>
                Not enough psychology-tracked journal entries yet. Log mood,
                confidence, focus, fear, and greed in the journal to unlock
                optimal-condition coaching.
              </div>
            )}
          </div>
        </section>

        <section className={cn(SECTION_CLASS, "overflow-hidden")}>
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 text-white">
              <Brain className="size-4 text-fuchsia-300" />
              <h2 className="text-sm font-semibold">Best vs worst states</h2>
            </div>
            <p className="mt-1 text-xs text-white/40">
              Which pre-entry emotions tend to help or hurt your execution.
            </p>
          </div>

          <div className="grid gap-4 px-4 pb-4 lg:grid-cols-2">
            <div className={cn(PANEL_CLASS, "p-4")}>
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-300/80">
                Best states
              </p>
              <div className="mt-3 space-y-2">
                {bestEmotions.length > 0 ? (
                  bestEmotions.map((emotion) => (
                    <div
                      key={`best-${emotion.emotion}`}
                      className="rounded-lg border border-emerald-500/15 bg-emerald-500/8 px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-white/85">
                          {formatEmotionLabel(emotion.emotion)}
                        </p>
                        <span className="text-[11px] text-emerald-200">
                          {emotion.winRate.toFixed(0)}% WR
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-white/45">
                        {emotion.trades} trades · {formatCurrency(emotion.avgProfit)} avg profit
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-white/8 bg-black/10 px-3 py-3 text-sm text-white/45">
                    No strong positive state pattern yet.
                  </div>
                )}
              </div>
            </div>

            <div className={cn(PANEL_CLASS, "p-4")}>
              <p className="text-xs uppercase tracking-[0.18em] text-rose-300/80">
                Watch states
              </p>
              <div className="mt-3 space-y-2">
                {worstEmotions.length > 0 ? (
                  worstEmotions.map((emotion) => (
                    <div
                      key={`worst-${emotion.emotion}`}
                      className="rounded-lg border border-rose-500/15 bg-rose-500/8 px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-white/85">
                          {formatEmotionLabel(emotion.emotion)}
                        </p>
                        <span className="text-[11px] text-rose-200">
                          {emotion.winRate.toFixed(0)}% WR
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-white/45">
                        {emotion.trades} trades · {formatCurrency(emotion.avgProfit)} avg profit
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-white/8 bg-black/10 px-3 py-3 text-sm text-white/45">
                    No clear negative state pattern yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className={cn(SECTION_CLASS, "overflow-hidden")}>
        <div className="px-4 py-4">
          <h2 className="text-sm font-semibold text-white">Correlation matrix</h2>
          <p className="mt-1 text-[10px] text-white/30">
            Click any cell to inspect the underlying psychology-to-performance
            relationship. Green means positive correlation, red means negative.
          </p>
        </div>

        <div className="px-4 pb-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="w-24 p-1.5 text-left text-[9px] text-white/30" />
                  {METRICS.map((metric) => (
                    <th
                      key={metric}
                      className="p-1.5 text-center text-[9px] font-medium text-white/40"
                    >
                      {metricMeta[metric].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FACTORS.map((factor) => {
                  const meta = factorMeta[factor];
                  const Icon = meta.icon;

                  return (
                    <tr key={factor}>
                      <td className="p-1.5">
                        <div className="flex items-center gap-1.5">
                          <Icon className="size-3" style={{ color: meta.color }} />
                          <span className="text-[10px] text-white/60">
                            {meta.label}
                          </span>
                        </div>
                      </td>
                      {METRICS.map((metric) => {
                        const corr = corrMap[`${factor}-${metric}`];
                        const coeff = corr
                          ? parseFloat(corr.correlationCoefficient)
                          : 0;
                        const isSelected =
                          selectedFactor === factor && selectedMetric === metric;

                        return (
                          <td key={metric} className="p-1">
                            <button
                              onClick={() => {
                                setSelectedFactor(factor);
                                setSelectedMetric(metric);
                              }}
                              className={cn(
                                "w-full rounded p-2 text-center transition-all",
                                getCorrelationBg(coeff),
                                isSelected && "ring-1 ring-white/20"
                              )}
                            >
                              <div
                                className={cn(
                                  "text-[13px] font-semibold",
                                  getCorrelationColor(coeff)
                                )}
                              >
                                {corr
                                  ? `${coeff > 0 ? "+" : ""}${coeff.toFixed(2)}`
                                  : "—"}
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
      </section>

      <section className={cn(SECTION_CLASS, "overflow-hidden")}>
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">
              {factorMeta[selectedFactor]?.label} vs{" "}
              {metricMeta[selectedMetric]?.label}
            </h2>
            <p className="mt-1 text-[10px] text-white/30">
              Inspect the scatter plot and coaching notes for the currently
              selected psychology factor.
            </p>
          </div>
          {selectedCorr ? (
            <span
              className={cn(
                "text-xs font-medium",
                getCorrelationColor(
                  parseFloat(selectedCorr.correlationCoefficient)
                )
              )}
            >
              r = {parseFloat(selectedCorr.correlationCoefficient).toFixed(3)}{" "}
              {getSignificanceBadge(selectedCorr.significance)}
            </span>
          ) : null}
        </div>

        <div className="px-4 pb-4">
          {scatterData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                  />
                  <XAxis
                    dataKey="x"
                    type="number"
                    domain={[1, 10]}
                    tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
                    tickLine={false}
                    axisLine={false}
                    label={{
                      value: factorMeta[selectedFactor]?.label,
                      position: "insideBottom",
                      offset: -5,
                      fontSize: 9,
                      fill: "rgba(255,255,255,0.3)",
                    }}
                  />
                  <YAxis
                    dataKey="y"
                    tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
                    tickLine={false}
                    axisLine={false}
                    label={{
                      value: metricMeta[selectedMetric]?.label,
                      angle: -90,
                      position: "insideLeft",
                      fontSize: 9,
                      fill: "rgba(255,255,255,0.3)",
                    }}
                  />
                  <RechartsTooltip
                    contentStyle={APP_RECHARTS_TOOLTIP_CONTENT_STYLE}
                    formatter={(value: number, name: string) => [
                      value.toFixed(2),
                      name === "x"
                        ? factorMeta[selectedFactor]?.label
                        : metricMeta[selectedMetric]?.label,
                    ]}
                  />
                  <Scatter
                    data={scatterData}
                    fill={factorMeta[selectedFactor]?.color || "#818cf8"}
                  >
                    {scatterData.map((_: any, index: number) => (
                      <Cell key={index} fillOpacity={0.6} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-center text-sm text-white/25">
              No data points available for this combination yet.
              <br />
              Log psychology data in journal entries to populate this view.
            </div>
          )}

          {selectedCorr?.insights ? (
            <div className="mt-4 grid gap-3 border-t border-white/5 pt-4 md:grid-cols-3">
              <div className={cn(PANEL_CLASS, "p-3")}>
                <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/80">
                  Best
                </p>
                <p className="mt-2 text-[11px] text-white/60">
                  {selectedCorr.insights.bestConditions ||
                    "No standout positive condition yet."}
                </p>
              </div>
              <div className={cn(PANEL_CLASS, "p-3")}>
                <p className="text-[11px] uppercase tracking-[0.18em] text-rose-300/80">
                  Worst
                </p>
                <p className="mt-2 text-[11px] text-white/60">
                  {selectedCorr.insights.worstConditions ||
                    "No standout negative condition yet."}
                </p>
              </div>
              <div className={cn(PANEL_CLASS, "p-3")}>
                <p className="text-[11px] uppercase tracking-[0.18em] text-yellow-300/80">
                  Coaching note
                </p>
                <p className="mt-2 text-[11px] text-white/60">
                  {selectedCorr.insights.recommendation ||
                    "Keep tagging context to unlock more specific coaching."}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
