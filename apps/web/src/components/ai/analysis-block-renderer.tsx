/**
 * Analysis Block Renderer
 *
 * Renders structured analysis blocks in the right panel.
 */

"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  Sparkles,
  Brain,
  Activity,
  Flame,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalysisBlock, VizSpec } from "@/types/assistant-stream";
import {
  getConfidenceLevel,
  getConfidenceLabel,
  getConfidenceColor,
} from "@/types/assistant-stream";
import { WidgetBlockRenderer } from "./widget-block-renderer";
import {
  Sources,
  SourcesContent,
  SourcesTrigger,
  Source,
} from "@/components/ui/shadcn-io/ai/source";

interface AnalysisBlockRendererProps {
  block: AnalysisBlock;
  index: number;
  onViewTrades?: (tradeIds: string[]) => void;
}

export function AnalysisBlockRenderer({
  block,
  index,
  onViewTrades,
}: AnalysisBlockRendererProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
    >
      {block.type === "querySummary" && (
        <QuerySummaryBlock block={block} />
      )}
      {block.type === "insights" && <InsightListBlock block={block} />}
      {block.type === "recommendations" && (
        <InsightListBlock block={block} />
      )}
      {block.type === "sources" && <SourcesBlock block={block} />}
      {block.type === "coverage" && <CoverageBlock block={block} />}
      {block.type === "stats" && <StatsBlock block={block} />}
      {block.type === "breakdownTable" && <BreakdownTableBlock block={block} />}
      {block.type === "tradePreview" && <TradePreviewBlock block={block} />}
      {block.type === "callout" && <CalloutBlock block={block} />}
      {block.type === "visualization" && (
        <VisualizationBlock viz={block.viz} onViewTrades={onViewTrades} />
      )}
      {block.type === "profileSummary" && (
        <ProfileSummaryBlock profile={block.profile} />
      )}
      {block.type === "edgeConditions" && (
        <EdgeConditionsBlock
          title={block.title}
          edges={block.edges}
          leaks={block.leaks}
        />
      )}
      {block.type === "insightCard" && (
        <InsightCardBlock
          title={block.title}
          severity={block.severity}
          message={block.message}
          recommendation={block.recommendation}
        />
      )}
      {block.type === "tiltStatus" && (
        <TiltStatusBlock
          tiltScore={block.tiltScore}
          level={block.level}
          indicators={block.indicators}
          mentalScore={block.mentalScore}
        />
      )}
      {block.type === "sessionCoaching" && (
        <SessionCoachingBlock
          isActive={block.isActive}
          tradeCount={block.tradeCount}
          wins={block.wins}
          losses={block.losses}
          runningPnL={block.runningPnL}
          nudges={block.nudges}
        />
      )}
    </motion.div>
  );
}

function VisualizationBlock({
  viz,
  onViewTrades,
}: {
  viz: VizSpec;
  onViewTrades?: (tradeIds: string[]) => void;
}) {
  return <WidgetBlockRenderer viz={viz} onViewTrades={onViewTrades} />;
}

function QuerySummaryBlock({
  block,
}: {
  block: Extract<AnalysisBlock, { type: "querySummary" }>;
}) {
  return (
    <AnalysisShellBlockShell title={sentenceCase(block.title)}>
      <div className="space-y-2 text-sm text-white/60">
        {block.bullets.map((bullet, idx) => (
          <p key={idx}>{sentenceCase(bullet)}</p>
        ))}
      </div>
    </AnalysisShellBlockShell>
  );
}

function InsightListBlock({
  block,
}: {
  block: Extract<AnalysisBlock, { type: "insights" | "recommendations" }>;
}) {
  return (
    <AnalysisShellBlockShell title={sentenceCase(block.title)}>
      <div className="space-y-2 text-sm text-white/70">
        {block.items.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <div className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-white/40" />
            <p className="leading-relaxed">{item}</p>
          </div>
        ))}
      </div>
    </AnalysisShellBlockShell>
  );
}

function SourcesBlock({
  block,
}: {
  block: Extract<AnalysisBlock, { type: "sources" }>;
}) {
  if (block.items.length === 0 && !block.tradesUrl) {
    return null;
  }
  return (
    <AnalysisShellBlockShell title={sentenceCase(block.title)}>
      <Sources>
        <SourcesTrigger count={block.items.length} />
        <SourcesContent>
          {block.items.map((item, idx) => (
            <div key={idx} className="space-y-1 text-xs text-white/70">
              <div className="text-white/40">{sentenceCase(item.label)}</div>
              <div className="space-y-1">
                {item.detail.split(" · ").map((line, lineIdx) => (
                  <div key={lineIdx}>{line}</div>
                ))}
              </div>
            </div>
          ))}
          {block.tradesUrl && (
            <Source href={block.tradesUrl} title="Show trades" />
          )}
        </SourcesContent>
      </Sources>
    </AnalysisShellBlockShell>
  );
}

function CoverageBlock({
  block,
}: {
  block: Extract<AnalysisBlock, { type: "coverage" }>;
}) {
  const confidence = block.confidence || getConfidenceLevel(block.n);
  const confidenceLabel = getConfidenceLabel(confidence);
  const confidenceColor = getConfidenceColor(confidence);
  const isLimited = confidence === "exploratory";

  return (
    <div className="bg-sidebar h-full w-full border border-white/5 p-1 flex flex-col group rounded-sm">
      <div className="flex w-full items-start justify-between gap-3 p-3.5">
        <h2 className="text-sm font-medium text-white/50">
          <span className="normal-case">{sentenceCase(block.title)}</span>
        </h2>
      </div>
      <div className={cn(
        "transition-all duration-150 flex flex-col h-full w-full rounded-sm",
        isLimited
          ? "bg-yellow-500/5"
          : "bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120"
      )}>
        <div className="flex flex-col p-3.5 h-full">
          <div className="space-y-3">
            <div className="flex items-baseline gap-1">
              <span className={cn("text-3xl font-semibold", isLimited ? "text-yellow-400" : "text-white")}>{block.n}</span>
              <span className="text-sm text-white/50">trades</span>
            </div>
            {(block.from || block.to) && (
              <p className="text-xs text-white/40">
                {block.from && block.to
                  ? `${block.from} to ${block.to}`
                  : block.from
                  ? `From ${block.from}`
                  : `Until ${block.to}`}
              </p>
            )}
            <div
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium",
                confidenceColor,
                isLimited ? "bg-yellow-500/10" : "bg-white/5"
              )}
            >
              <div className="h-1.5 w-1.5 rounded-full bg-current" />
              {confidenceLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsBlock({
  block,
}: {
  block: Extract<AnalysisBlock, { type: "stats" }>;
}) {
  return (
    <AnalysisShellBlockShell title={sentenceCase(block.title)}>
      <div className="space-y-2.5">
        {block.rows.map((row, i) => (
          <div key={i} className="flex justify-between items-start gap-4">
            <span className="text-sm text-white/60">
              {sentenceCase(row.label)}
            </span>
            <div className="text-right">
              <span className="text-sm font-medium text-white">
                {row.value}
              </span>
              {row.note && (
                <p className="text-xs text-white/40 mt-0.5">{row.note}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </AnalysisShellBlockShell>
  );
}

function BreakdownTableBlock({
  block,
}: {
  block: Extract<AnalysisBlock, { type: "breakdownTable" }>;
}) {
  const currencyColumns = new Set(
    block.columns
      .map((col) => col.toLowerCase().replace(/[\s_]/g, ""))
      .filter((col) =>
        [
          "profit",
          "loss",
          "pnl",
          "balance",
          "commission",
          "commissions",
          "swap",
        ].some((key) => col.includes(key))
      )
  );

  return (
    <AnalysisShellBlockShell title={sentenceCase(block.title)}>
      <div className="-mx-3.5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              {block.columns.map((col, i) => (
                <th
                  key={i}
                  className="text-left py-2 px-3.5 text-xs font-medium text-white/50 tracking-wider"
                >
                  {sentenceCase(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i} className="border-b border-white/5 last:border-0">
                {row.map((cell, j) => (
                  <td key={j} className="py-2 px-3.5 text-white/70">
                    {cell !== null
                      ? formatBreakdownValue(cell, block.columns[j], currencyColumns)
                      : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AnalysisShellBlockShell>
  );
}

function formatBreakdownValue(
  value: string | number | null,
  column: string,
  currencyColumns: Set<string>
): string | number {
  if (value === null) return "—";
  const columnLower = column.toLowerCase().replace(/[\s_]/g, "");

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (isDateColumn(columnLower)) {
      const date = new Date(trimmed);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
      }
    }

    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      value = Number(trimmed);
    } else {
      return value;
    }
  }

  const isCurrency =
    currencyColumns.has(columnLower) ||
    [
      "profit",
      "loss",
      "pnl",
      "balance",
      "commission",
      "commissions",
      "swap",
    ].some((key) => columnLower.includes(key));

  if (isCurrency) {
    const sign = value < 0 ? "-$" : "$";
    return `${sign}${Math.abs(value).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    })}`;
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function isDateColumn(columnLower: string): boolean {
  return (
    columnLower.includes("open") ||
    columnLower.includes("close") ||
    columnLower.includes("date") ||
    columnLower.includes("time")
  );
}

function TradePreviewBlock({
  block,
}: {
  block: Extract<AnalysisBlock, { type: "tradePreview" }>;
}) {
  const handleShowAll = () => {
    // TODO: Navigate to trades table with filtered IDs
    const ids = block.tradeIds.join(",");
    window.location.href = `/dashboard/trades?ids=${ids}`;
  };

  return (
    <AnalysisShellBlockShell
      title={sentenceCase(block.title)}
      actions={
        <button
          onClick={handleShowAll}
          className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
        >
          Show all →
        </button>
      }
    >
      <div className="-mx-3.5 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/5">
          {block.columns.map((col, i) => (
            <th
              key={i}
                  className="text-left py-2 px-3.5 text-xs font-medium text-white/40 tracking-wider"
            >
              {sentenceCase(col)}
            </th>
          ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.slice(0, 5).map((row, i) => (
              <tr key={i} className="border-b border-white/5 last:border-0">
                {Object.values(row).map((cell: any, j) => (
                  <td key={j} className="py-2 px-3.5 text-white/60">
                    {cell !== null && cell !== undefined ? String(cell) : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {block.rows.length > 5 && (
          <p className="text-xs text-white/40 mt-2 text-center">
            + {block.rows.length - 5} more trades
          </p>
        )}
      </div>
    </AnalysisShellBlockShell>
  );
}

function CalloutBlock({
  block,
}: {
  block: Extract<AnalysisBlock, { type: "callout" }>;
}) {
  const icons = {
    info: Info,
    warning: AlertCircle,
    success: CheckCircle2,
  };

  const contentBg = {
    info: "bg-blue-500/5",
    warning: "bg-yellow-500/5",
    success: "bg-green-500/5",
  };

  const borderColor = {
    info: "border-blue-500/20",
    warning: "border-yellow-500/20",
    success: "border-green-500/20",
  };

  const textColor = {
    info: "text-blue-400",
    warning: "text-yellow-400",
    success: "text-green-400",
  };

  const Icon = icons[block.tone];

  return (
    <div className="bg-sidebar h-full w-full border border-white/5 p-1 flex flex-col group rounded-sm">
      <div className="flex w-full items-start justify-between gap-3 p-3.5">
        <h2 className="text-sm font-medium text-white/50">
          <span className="normal-case">{sentenceCase(block.title)}</span>
        </h2>
      </div>
      <div className={cn(
        "transition-all duration-150 flex flex-col h-full w-full rounded-sm",
        contentBg[block.tone],
        borderColor[block.tone]
      )}>
        <div className="flex flex-col p-3.5 h-full">
          <div className={cn("flex gap-3", textColor[block.tone])}>
            <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm opacity-80">{block.body}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalysisShellBlockShell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-sidebar h-full w-full border border-white/5 p-1 flex flex-col group rounded-sm">
      <div className="flex w-full items-start justify-between gap-3 p-3.5">
        <h2 className="text-sm font-medium text-white/50">
          <span className="normal-case">{sentenceCase(title)}</span>
        </h2>
        {actions}
      </div>
      <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-150 flex flex-col h-full w-full rounded-sm">
        <div className="flex flex-col p-3.5 h-full">{children}</div>
      </div>
    </div>
  );
}

function sentenceCase(value: string): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

// ─── Profile Summary Block ─────────────────────────────────────

function ProfileSummaryBlock({
  profile,
}: {
  profile: import("@/types/assistant-stream").CondensedProfile;
}) {
  return (
    <AnalysisShellBlockShell title="Your Trading Profile">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <StatPill label="Win Rate" value={`${profile.winRate.toFixed(1)}%`} />
          <StatPill label="Profit Factor" value={profile.profitFactor.toFixed(2)} />
          <StatPill label="Expectancy" value={`$${profile.expectancy.toFixed(2)}`} />
          <StatPill label="Total Trades" value={String(profile.totalTrades)} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatPill label="R:R Sweet Spot" value={profile.rrSweetSpot} />
          <StatPill label="Hold Sweet Spot" value={profile.holdTimeSweetSpot} />
        </div>

        {profile.bestSessions.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-white/30 font-medium">
              Best Sessions
            </p>
            {profile.bestSessions.map((s, i) => (
              <p key={i} className="text-xs text-emerald-400/80 flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3" /> {s}
              </p>
            ))}
          </div>
        )}

        {profile.worstSessions.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-white/30 font-medium">
              Weakest Sessions
            </p>
            {profile.worstSessions.map((s, i) => (
              <p key={i} className="text-xs text-red-400/80 flex items-center gap-1.5">
                <TrendingDown className="h-3 w-3" /> {s}
              </p>
            ))}
          </div>
        )}

        <p className="text-xs text-white/50 flex items-center gap-1.5">
          <Target className="h-3 w-3" /> {profile.currentStreak}
        </p>
      </div>
    </AnalysisShellBlockShell>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/5 rounded px-2.5 py-1.5">
      <p className="text-[10px] text-white/40 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-white/90">{value}</p>
    </div>
  );
}

// ─── Edge/Leak Conditions Block ─────────────────────────────────

function EdgeConditionsBlock({
  title,
  edges,
  leaks,
}: {
  title: string;
  edges: Array<{ label: string; winRate: number; trades: number; confidence: string }>;
  leaks: Array<{ label: string; winRate: number; trades: number; confidence: string }>;
}) {
  return (
    <AnalysisShellBlockShell title={title}>
      <div className="space-y-4">
        {edges.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-emerald-400/60 font-medium mb-2 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Edges (Winning Patterns)
            </p>
            {edges.map((e, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                <span className="text-xs text-white/80">{e.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-emerald-400">{e.winRate.toFixed(0)}%</span>
                  <span className="text-[10px] text-white/30">{e.trades} trades</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {leaks.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-red-400/60 font-medium mb-2 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Leaks (Losing Patterns)
            </p>
            {leaks.map((l, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                <span className="text-xs text-white/80">{l.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-red-400">{l.winRate.toFixed(0)}%</span>
                  <span className="text-[10px] text-white/30">{l.trades} trades</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AnalysisShellBlockShell>
  );
}

// ─── Insight Card Block ─────────────────────────────────────────

function InsightCardBlock({
  title,
  severity,
  message,
  recommendation,
}: {
  title: string;
  severity: string;
  message: string;
  recommendation: string;
}) {
  const config = {
    critical: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" },
    warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10" },
    info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10" },
    positive: { icon: Sparkles, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  }[severity] || { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10" };

  const Icon = config.icon;

  return (
    <AnalysisShellBlockShell title={title}>
      <div className={cn("rounded-lg p-3", config.bg)}>
        <div className="flex gap-2">
          <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", config.color)} />
          <div className="space-y-1.5">
            <p className="text-xs text-white/80">{message}</p>
            {recommendation && (
              <p className="text-xs text-teal-400/70 italic">{recommendation}</p>
            )}
          </div>
        </div>
      </div>
    </AnalysisShellBlockShell>
  );
}

// ─── Tilt Status Block ─────────────────────────────────────────

function TiltStatusBlock({
  tiltScore,
  level,
  indicators,
  mentalScore,
}: {
  tiltScore: number;
  level: string;
  indicators: Array<{ label: string; severity: string }>;
  mentalScore?: number;
}) {
  const tiltConfig = {
    green: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: "Clear Mind" },
    yellow: { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", label: "Mild Tilt" },
    orange: { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", label: "Tilting" },
    red: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", label: "Full Tilt" },
  }[level] || { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", label: "Unknown" };

  return (
    <AnalysisShellBlockShell title="Mental State">
      <div className={cn("rounded-lg border p-3", tiltConfig.bg, tiltConfig.border)}>
        <div className="flex items-center gap-3 mb-2">
          <Brain className={cn("h-5 w-5", tiltConfig.color)} />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className={cn("text-sm font-semibold", tiltConfig.color)}>
                {tiltConfig.label}
              </span>
              <span className={cn("text-lg font-bold", tiltConfig.color)}>
                {tiltScore}/100
              </span>
            </div>
            {/* Tilt bar */}
            <div className="h-1.5 w-full bg-white/10 rounded-full mt-1.5">
              <div
                className={cn("h-full rounded-full transition-all", {
                  "bg-emerald-400": level === "green",
                  "bg-yellow-400": level === "yellow",
                  "bg-orange-400": level === "orange",
                  "bg-red-400": level === "red",
                })}
                style={{ width: `${Math.min(100, tiltScore)}%` }}
              />
            </div>
          </div>
        </div>

        {mentalScore != null && mentalScore > 0 && (
          <div className="flex items-center gap-1.5 mb-2 text-[10px] text-white/50">
            <Shield className="h-3 w-3" />
            Mental Performance Score: {mentalScore}/100
          </div>
        )}

        {indicators.length > 0 && (
          <div className="space-y-1 mt-2 pt-2 border-t border-white/5">
            {indicators.map((ind, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px]">
                <Flame className={cn("h-2.5 w-2.5 shrink-0", tiltConfig.color)} />
                <span className="text-white/60">
                  {ind.label ?? (ind as any).message ?? "Tilt signal"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AnalysisShellBlockShell>
  );
}

// ─── Session Coaching Block ────────────────────────────────────

function SessionCoachingBlock({
  isActive,
  tradeCount,
  wins,
  losses,
  runningPnL,
  nudges,
}: {
  isActive: boolean;
  tradeCount: number;
  wins: number;
  losses: number;
  runningPnL: number;
  nudges: Array<{ type: string; title: string; message: string; severity: string }>;
}) {
  if (!isActive) return null;

  const nudgeConfig: Record<string, { color: string; bg: string }> = {
    warning: { color: "text-amber-400", bg: "bg-amber-500/10" },
    critical: { color: "text-red-400", bg: "bg-red-500/10" },
    positive: { color: "text-emerald-400", bg: "bg-emerald-500/10" },
    info: { color: "text-blue-400", bg: "bg-blue-500/10" },
  };

  return (
    <AnalysisShellBlockShell title="Live Session">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-400 font-medium">Active session</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/5 rounded px-2.5 py-1.5 text-center">
            <p className="text-[10px] text-white/40">Trades</p>
            <p className="text-sm font-medium">{tradeCount}</p>
          </div>
          <div className="bg-white/5 rounded px-2.5 py-1.5 text-center">
            <p className="text-[10px] text-white/40">Score</p>
            <p className="text-sm font-medium">{wins}W/{losses}L</p>
          </div>
          <div className="bg-white/5 rounded px-2.5 py-1.5 text-center">
            <p className="text-[10px] text-white/40">P&L</p>
            <p className={cn("text-sm font-medium", runningPnL >= 0 ? "text-teal-400" : "text-rose-400")}>
              ${Math.abs(runningPnL).toFixed(0)}
            </p>
          </div>
        </div>

        {nudges.length > 0 && (
          <div className="space-y-1.5">
            {nudges.map((nudge, i) => {
              const nc = nudgeConfig[nudge.severity] ?? nudgeConfig.info;
              return (
                <div key={i} className={cn("flex items-start gap-1.5 text-[10px] rounded-sm p-2 border border-white/5", nc.bg)}>
                  <Activity className={cn("h-3 w-3 shrink-0 mt-0.5", nc.color)} />
                  <div>
                    <p className={cn("font-medium", nc.color)}>{nudge.title}</p>
                    <p className="text-white/50">{nudge.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AnalysisShellBlockShell>
  );
}
