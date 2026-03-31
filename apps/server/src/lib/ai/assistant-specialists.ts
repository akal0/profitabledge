import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "../../db";
import { journalEntry } from "../../db/schema/journal";
import {
  propAlert,
  propDailySnapshot,
  tradingAccount,
} from "../../db/schema/trading";
import type { CondensedProfile } from "./engine/types";
import { isAllAccountsScope } from "../account-scope";
import { checkPropRules } from "../prop-rule-monitor";
import { getChallengeRuleById, getPropFirmById } from "../prop-firm-detection";
import {
  hasProfileAnalysisQualifier,
  isBroadProfileSummaryQuery,
} from "./query-normalization";

export type AssistantSurface =
  | "dashboard"
  | "journal"
  | "prop-tracker"
  | "psychology"
  | "trades"
  | "settings"
  | "assistant"
  | "unknown";

export interface AssistantPageContext {
  pathname?: string;
  surface?: AssistantSurface;
  propAccountId?: string | null;
  journalEntryId?: string | null;
  dashboardWidgetIds?: string[];
  dashboardChartWidgetIds?: string[];
  focusedWidgetId?: string | null;
  accountScope?: "single" | "all";
  source?: string;
}

export interface AssistantSpecialistContext {
  userId: string;
  accountId: string;
  pageContext?: AssistantPageContext;
  condensed?: CondensedProfile;
  fullProfile?: any;
  tiltStatus?: any;
  mentalScore?: any;
  sessionState?: any;
  coachingNudges?: any[];
}

export interface AssistantSpecialistResult {
  handled: boolean;
  domain?: string;
  message?: string;
  data?: any;
  analysisBlocks?: any[];
}

type AssistantDomain =
  | "unsupported"
  | "psychology"
  | "session"
  | "prop"
  | "journal"
  | "dashboard";

const SUMMARY_QUERY_RE =
  /\b(summary|summarize|overview|headline|readout|what stands out|what matters|how am i doing|how's it going|where should i focus|what should i focus on|next focus|biggest issue|main thing)\b/i;
const DASHBOARD_EXPLAIN_RE =
  /\b(explain|interpret|read|understand|what does this|what is this|why is this|this widget|this chart|this card|this panel)\b/i;

const DASHBOARD_WIDGET_LABELS: Record<string, string> = {
  "edge-summary": "Edge Summary",
  benchmark: "Benchmark",
  "risk-intelligence": "Risk Intelligence",
  "session-coach": "Session Coach",
  "daily-briefing": "Daily Briefing",
  "rule-compliance": "Rule Compliance",
  "account-balance": "Account Balance",
  "account-equity": "Account Equity",
  "win-rate": "Win Rate",
  "profit-factor": "Profit Factor",
  "daily-net": "Daily Net P&L",
  "performance-weekday": "Weekday Performance",
  "performing-assets": "Performing Assets",
  "equity-curve": "Equity Curve",
  drawdown: "Drawdown",
  "monte-carlo": "Monte Carlo",
};

export function inferAssistantSurface(
  pathname?: string | null
): AssistantSurface {
  if (!pathname) return "unknown";
  if (pathname === "/assistant") return "assistant";
  if (pathname.startsWith("/dashboard/prop-tracker")) return "prop-tracker";
  if (pathname.startsWith("/dashboard/journal")) return "journal";
  if (pathname.startsWith("/dashboard/trades")) return "trades";
  if (pathname.startsWith("/dashboard/settings")) return "settings";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  return "unknown";
}

export function normalizeAssistantPageContext(
  pageContext?: AssistantPageContext | null
): AssistantPageContext {
  if (!pageContext) {
    return { surface: "unknown" };
  }

  return {
    ...pageContext,
    surface:
      pageContext.surface ||
      inferAssistantSurface(pageContext.pathname || undefined),
    dashboardWidgetIds: Array.isArray(pageContext.dashboardWidgetIds)
      ? pageContext.dashboardWidgetIds.filter((value): value is string =>
          Boolean(value)
        )
      : undefined,
    dashboardChartWidgetIds: Array.isArray(pageContext.dashboardChartWidgetIds)
      ? pageContext.dashboardChartWidgetIds.filter((value): value is string =>
          Boolean(value)
        )
      : undefined,
    focusedWidgetId:
      typeof pageContext.focusedWidgetId === "string"
        ? pageContext.focusedWidgetId
        : null,
  };
}

function isBroadSummaryQuery(message: string): boolean {
  return SUMMARY_QUERY_RE.test(message);
}

export function isPsychologyQuery(message: string): boolean {
  return /\b(psychology|psychological|tilt|tilted|revenge|emotional|discipline|disciplined|mindset|mental|fear|greed|mental focus|focus issues?|confidence issues?|confidence problem|low confidence|lost confidence|overconfidence|underconfidence)\b/i.test(
    message
  );
}

function isSessionPerformanceQuery(message: string): boolean {
  const lower = message.toLowerCase();
  const mentionsSession = /\bsessions?\b/.test(lower);

  if (!mentionsSession) {
    return false;
  }

  return (
    /\b(best|worst|most|least|top|bottom|profitable|performing|performance|compare|comparison|breakdown|historical|history|closed trades?|previous trades?)\b/.test(
      lower
    ) || /\b(win rate|expectancy|profit factor|p&l|pnl)\b/.test(lower)
  );
}

export function isSessionQuery(message: string): boolean {
  const lower = message.toLowerCase();
  if (isSessionPerformanceQuery(lower)) {
    return false;
  }

  if (
    /\b(active trades?|active session|should i stop|am i overtrading|how.?s (this|my|the live) session|how am i trading today|current session|live session|this session|today'?s session)\b/i.test(
      lower
    )
  ) {
    return true;
  }

  return (
    /\b(today|right now|currently)\b/i.test(lower) &&
    /\b(how am i doing|how.?s it going|should i stop|overtrading|live session|current session)\b/i.test(
      lower
    )
  );
}

function isPropQuery(
  message: string,
  pageContext: AssistantPageContext
): boolean {
  const lower = message.toLowerCase();
  return (
    /\b(prop(?:\s+firm|\s+challenge|\s+account)?|challenge|pass probability|risk of failure|daily loss limit|max loss|max daily loss|max overall loss|trailing drawdown|static drawdown|ftmo|fundednext|e8)\b/i.test(
      lower
    ) ||
    (/\bphase\b/i.test(lower) &&
      /\b(prop|challenge|ftmo|fundednext|e8)\b/i.test(lower)) ||
    (/\bfunded\b/i.test(lower) &&
      /\b(prop|challenge|ftmo|fundednext|e8|drawdown|loss limit)\b/i.test(
        lower
      )) ||
    (pageContext.surface === "prop-tracker" && isBroadSummaryQuery(message))
  );
}

function isJournalQuery(
  message: string,
  pageContext: AssistantPageContext
): boolean {
  return (
    /\b(journal|journaling|journal entries?|reflection|reflect|review notes|lessons learned|what did i learn|what should i write)\b/i.test(
      message
    ) ||
    (pageContext.surface === "journal" && isBroadSummaryQuery(message))
  );
}

function isDashboardQuery(
  message: string,
  pageContext: AssistantPageContext
): boolean {
  const lower = message.toLowerCase();
  const onDashboardSurface = pageContext.surface === "dashboard";
  const focusedExplain =
    Boolean(pageContext.focusedWidgetId) && DASHBOARD_EXPLAIN_RE.test(message);
  const explicitDashboardRef =
    /\b(dashboard|what matters on this dashboard|focused widget|this widget|this chart|this card|this panel|edge summary|top priority|what matters today)\b/i.test(
      message
    );
  const broadDashboardRef = /\b(overview|headline)\b/i.test(lower);

  if (
    isBroadProfileSummaryQuery(message) &&
    !onDashboardSurface &&
    !focusedExplain
  ) {
    return false;
  }

  if (
    isBroadProfileSummaryQuery(message) &&
    hasProfileAnalysisQualifier(message)
  ) {
    return false;
  }

  if (!onDashboardSurface && hasProfileAnalysisQualifier(message)) {
    return false;
  }

  if (broadDashboardRef && hasProfileAnalysisQualifier(message)) {
    return false;
  }

  return (
    explicitDashboardRef ||
    (onDashboardSurface && broadDashboardRef) ||
    (onDashboardSurface &&
      (isBroadSummaryQuery(message) ||
        focusedExplain))
  );
}

function isUnsupportedAssistantQuery(message: string): boolean {
  return /\b(price right now|current price|live price|market news|news today|economic news|cpi|nfp|fomc|should i buy|should i sell|entry signal|signal right now|prediction)\b/i.test(
    message
  );
}

export function detectAssistantDomain(
  message: string,
  pageContext?: AssistantPageContext | null
): AssistantDomain | null {
  const normalized = normalizeAssistantPageContext(pageContext);

  if (isUnsupportedAssistantQuery(message)) return "unsupported";
  if (
    isPsychologyQuery(message) ||
    (normalized.surface === "psychology" && isBroadSummaryQuery(message))
  ) {
    return "psychology";
  }
  if (isPropQuery(message, normalized)) return "prop";
  if (isJournalQuery(message, normalized)) return "journal";
  if (isDashboardQuery(message, normalized)) return "dashboard";
  if (isSessionQuery(message)) return "session";
  return null;
}

function toNumber(value: unknown): number {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatUsd(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatPct(value: number, digits = 1): string {
  return `${Number.isFinite(value) ? value.toFixed(digits) : "0.0"}%`;
}

function pickTopLabels(
  map: Map<string, number>,
  limit = 3
): Array<{ label: string; count: number }> {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function getDashboardWidgetLabel(widgetId?: string | null): string | null {
  if (!widgetId) return null;
  return (
    DASHBOARD_WIDGET_LABELS[widgetId] ||
    widgetId
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function buildFocusedDashboardInsight(
  widgetId: string | null | undefined,
  context: AssistantSpecialistContext
): string | null {
  if (!widgetId || !context.condensed) return null;

  const topEdge = context.fullProfile?.edges?.[0];
  const topLeak = context.fullProfile?.leaks?.[0];

  switch (widgetId) {
    case "edge-summary":
      return topEdge
        ? `The edge summary is pointing to ${topEdge.label.toLowerCase()} as your best repeatable condition, while ${
            topLeak?.label.toLowerCase() || "your weakest condition"
          } is still the biggest drag.`
        : "The edge summary needs more tagged trades before it can separate repeatable edge from noise.";
    case "benchmark":
      return "The benchmark card is for relative standing, not absolute quality. Use it to see whether your current win rate and expectancy are exceptional or just average for the verified cohort.";
    case "risk-intelligence":
      return `Risk intelligence matters most when expectancy is ${formatUsd(
        context.condensed.expectancy
      )} per trade. Protecting downside matters more than forcing additional frequency.`;
    case "session-coach":
      return context.sessionState?.isActive
        ? `The session coach is grounded in your live streak and current session state. Right now it is reacting to ${context.sessionState.tradeCount} trades in the active session.`
        : "The session coach is idle because there is no active session. It becomes more useful once trades are actively flowing.";
    case "rule-compliance":
      return topLeak
        ? `Rule compliance should be read through the lens of ${topLeak.label.toLowerCase()}. If that leak is recurring, tighten the rule around it before adding more rules.`
        : "Use rule compliance to enforce the behavior you already know produces your best outcomes.";
    case "daily-net":
    case "equity-curve":
    case "drawdown":
      return "This chart is about path quality, not just endpoint profit. Read it to see whether gains are compounding cleanly or being earned through unstable swings.";
    default:
      return null;
  }
}

function summarizeDashboardCoverage(
  pageContext: AssistantPageContext
): string | null {
  const widgets = pageContext.dashboardWidgetIds || [];
  const charts = pageContext.dashboardChartWidgetIds || [];
  const focusedLabel = getDashboardWidgetLabel(pageContext.focusedWidgetId);

  if (widgets.length === 0 && charts.length === 0 && !focusedLabel) {
    return null;
  }

  const parts: string[] = [];
  if (focusedLabel) {
    parts.push(`Focused widget: ${focusedLabel}.`);
  }
  if (widgets.length > 0) {
    parts.push(
      `Primary cards loaded: ${widgets
        .slice(0, 4)
        .map((widgetId) => getDashboardWidgetLabel(widgetId))
        .join(", ")}${widgets.length > 4 ? ", ..." : ""}.`
    );
  }
  if (charts.length > 0) {
    parts.push(
      `Chart context: ${charts
        .slice(0, 3)
        .map((widgetId) => getDashboardWidgetLabel(widgetId))
        .join(", ")}${charts.length > 3 ? ", ..." : ""}.`
    );
  }

  return parts.join(" ");
}

function buildUnsupportedResponse(): AssistantSpecialistResult {
  return {
    handled: true,
    domain: "unsupported",
    message:
      "I can answer from your trading data, journal, psychology, and prop tracking. I can't reliably answer live market-price, news, or trade-signal questions from this engine alone.",
    analysisBlocks: [
      {
        type: "callout",
        tone: "warning",
        title: "Outside current coverage",
        body: "Ask about your edge, leaks, session behavior, journal patterns, psychology, or prop-risk status. For live market/news questions, this assistant needs a separate market-data source.",
      },
    ],
  };
}

export function buildPsychologyMarkdown(
  tiltStatus: any,
  mentalScore: any
): string {
  if (!tiltStatus && !mentalScore) {
    return "Not enough psychology data yet. Tag emotions and complete more reviewed trades first.";
  }

  const indicators = tiltStatus?.indicators?.length
    ? tiltStatus.indicators
        .slice(0, 3)
        .map(
          (indicator: any) =>
            indicator.label ?? indicator.message ?? "Tilt signal"
        )
        .join(", ")
    : "no major tilt markers";
  const mentalTotal = mentalScore?.totalScore ?? mentalScore?.overall;

  const action =
    tiltStatus?.tiltScore >= 40
      ? "Reduce size or stop for the session."
      : tiltStatus?.tiltScore >= 20
      ? "Slow down and trade only A-grade setups."
      : "Psychology is stable. Keep execution strict.";

  return [
    `Tilt status: ${tiltStatus?.level || "stable"} (${Math.round(
      tiltStatus?.tiltScore || 0
    )}/100).`,
    mentalTotal != null
      ? `Mental performance: ${Math.round(mentalTotal)}/100.`
      : null,
    `Main signals: ${indicators}.`,
    action,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildSessionMarkdown(
  sessionState: any,
  coachingNudges: any[]
): string {
  if (!sessionState?.isActive) {
    return "No active trading session detected right now.";
  }

  const topNudge = coachingNudges?.[0];
  const streak = sessionState.currentStreak?.type
    ? `${sessionState.currentStreak.count} ${sessionState.currentStreak.type} streak`
    : "no active streak";

  return [
    `Current session: ${sessionState.tradeCount} trades, ${
      sessionState.wins
    }W/${sessionState.losses}L, P&L ${
      sessionState.runningPnL >= 0 ? "+" : ""
    }$${Number(sessionState.runningPnL || 0).toFixed(2)}.`,
    `State: ${streak}.`,
    topNudge ? `Coach: ${topNudge.title} - ${topNudge.message}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildPsychologyResult(
  tiltStatus: any,
  mentalScore: any
): AssistantSpecialistResult {
  return {
    handled: true,
    domain: "psychology",
    message: buildPsychologyMarkdown(tiltStatus, mentalScore),
    data: { tiltStatus, mentalScore },
    analysisBlocks: tiltStatus
      ? [
          {
            type: "tiltStatus",
            tiltScore: tiltStatus.tiltScore,
            level: tiltStatus.level,
            indicators: tiltStatus.indicators ?? [],
            mentalScore: mentalScore?.totalScore ?? mentalScore?.overall,
          },
        ]
      : [],
  };
}

function buildSessionResult(
  sessionState: any,
  coachingNudges: any[]
): AssistantSpecialistResult {
  return {
    handled: true,
    domain: "session",
    message: buildSessionMarkdown(sessionState, coachingNudges),
    data: { sessionState, coachingNudges },
    analysisBlocks: sessionState
      ? [
          {
            type: "sessionCoaching",
            isActive: Boolean(sessionState.isActive),
            tradeCount: sessionState.tradeCount ?? 0,
            wins: sessionState.wins ?? 0,
            losses: sessionState.losses ?? 0,
            runningPnL: sessionState.runningPnL ?? 0,
            nudges: (coachingNudges || []).slice(0, 3),
          },
        ]
      : [],
  };
}

async function resolvePropAccount(
  userId: string,
  accountId: string,
  pageContext: AssistantPageContext
) {
  if (pageContext.propAccountId) {
    const explicit = await db.query.tradingAccount.findFirst({
      where: and(
        eq(tradingAccount.id, pageContext.propAccountId),
        eq(tradingAccount.userId, userId)
      ),
    });
    if (explicit?.isPropAccount) return explicit;
  }

  if (!isAllAccountsScope(accountId)) {
    const current = await db.query.tradingAccount.findFirst({
      where: and(
        eq(tradingAccount.id, accountId),
        eq(tradingAccount.userId, userId)
      ),
    });
    if (current?.isPropAccount) return current;
  }

  const propAccounts = await db
    .select({
      id: tradingAccount.id,
      name: tradingAccount.name,
      isPropAccount: tradingAccount.isPropAccount,
    })
    .from(tradingAccount)
    .where(
      and(
        eq(tradingAccount.userId, userId),
        eq(tradingAccount.isPropAccount, true)
      )
    );

  if (propAccounts.length === 1) {
    return db.query.tradingAccount.findFirst({
      where: and(
        eq(tradingAccount.id, propAccounts[0].id),
        eq(tradingAccount.userId, userId)
      ),
    });
  }

  return null;
}

function estimatePropPassProbability(
  account: any,
  challengeRule: any,
  snapshots: any[]
): {
  passPercentage: number;
  riskOfFailure: number;
  daysToTarget: number | null;
} | null {
  if (!challengeRule || snapshots.length < 5) return null;

  const phases = Array.isArray(challengeRule.phases)
    ? challengeRule.phases
    : [];
  const currentPhase = phases.find(
    (phase: any) => phase.order === account.propCurrentPhase
  );
  if (!currentPhase || currentPhase.profitTarget == null) return null;

  const dailyReturns = snapshots
    .map((snapshot) => toNumber(snapshot.dailyProfitPercent))
    .filter((value) => Number.isFinite(value));

  if (dailyReturns.length < 5) return null;

  const avgDailyReturn =
    dailyReturns.reduce((sum, value) => sum + value, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce(
      (sum, value) => sum + Math.pow(value - avgDailyReturn, 2),
      0
    ) / dailyReturns.length;
  const stdDev = Math.sqrt(variance);
  const simulations = 500;
  let passCount = 0;
  const daysToTarget: number[] = [];

  for (let i = 0; i < simulations; i++) {
    let profitPct = toNumber(account.propPhaseCurrentProfitPercent);
    let worstDrawdown = 0;
    let completed = false;
    const dayLimit = currentPhase.timeLimitDays || 365;

    for (let day = 0; day < dayLimit; day++) {
      const gaussianish =
        (Math.random() +
          Math.random() +
          Math.random() +
          Math.random() +
          Math.random() +
          Math.random() -
          3) /
        Math.sqrt(3);
      const simulatedReturn = avgDailyReturn + stdDev * gaussianish;

      if (
        currentPhase.dailyLossLimit != null &&
        Math.abs(Math.min(simulatedReturn, 0)) > currentPhase.dailyLossLimit
      ) {
        completed = true;
        break;
      }

      profitPct += simulatedReturn;
      worstDrawdown = Math.max(worstDrawdown, -Math.min(profitPct, 0));

      if (
        currentPhase.maxLoss != null &&
        worstDrawdown > currentPhase.maxLoss
      ) {
        completed = true;
        break;
      }

      if (profitPct >= currentPhase.profitTarget) {
        passCount += 1;
        daysToTarget.push(day + 1);
        completed = true;
        break;
      }
    }

    if (!completed) {
      continue;
    }
  }

  return {
    passPercentage: (passCount / simulations) * 100,
    riskOfFailure: 100 - (passCount / simulations) * 100,
    daysToTarget:
      daysToTarget.length > 0
        ? Math.ceil(
            daysToTarget.reduce((sum, value) => sum + value, 0) /
              daysToTarget.length
          )
        : null,
  };
}

async function handlePropQuery(
  context: AssistantSpecialistContext,
  pageContext: AssistantPageContext
): Promise<AssistantSpecialistResult> {
  const account = await resolvePropAccount(
    context.userId,
    context.accountId,
    pageContext
  );

  if (!account) {
    const propAccounts = await db
      .select({ id: tradingAccount.id, name: tradingAccount.name })
      .from(tradingAccount)
      .where(
        and(
          eq(tradingAccount.userId, context.userId),
          eq(tradingAccount.isPropAccount, true)
        )
      );

    if (propAccounts.length === 0) {
      return {
        handled: true,
        domain: "prop",
        message:
          "I can only answer prop-challenge questions for prop-linked accounts, and you don't have one connected yet.",
        analysisBlocks: [
          {
            type: "callout",
            tone: "warning",
            title: "No prop account linked",
            body: "Connect or mark a trading account as a prop challenge first. Then I can track rule headroom, breach risk, and pass progress.",
          },
        ],
      };
    }

    return {
      handled: true,
      domain: "prop",
      message:
        "I found multiple prop accounts. Ask from a specific prop tracker page or select the exact account so I can answer accurately.",
      analysisBlocks: [
        {
          type: "stats",
          title: "Available prop accounts",
          rows: propAccounts.map((propAccount) => ({
            label: propAccount.name,
            value: propAccount.id,
          })),
        },
      ],
    };
  }

  const [ruleCheck, firmRow, challengeRuleRow, recentAlerts, snapshots] =
    await Promise.all([
      checkPropRules(account.id),
      account.propFirmId
        ? getPropFirmById(account.propFirmId)
        : Promise.resolve(null),
      account.propChallengeRuleId
        ? getChallengeRuleById(account.propChallengeRuleId)
        : Promise.resolve(null),
      db.query.propAlert.findMany({
        where: eq(propAlert.accountId, account.id),
        orderBy: desc(propAlert.createdAt),
        limit: 5,
      }),
      db.query.propDailySnapshot.findMany({
        where: eq(propDailySnapshot.accountId, account.id),
        orderBy: desc(propDailySnapshot.date),
        limit: 15,
      }),
    ]);

  const phases = Array.isArray(challengeRuleRow?.phases)
    ? challengeRuleRow?.phases
    : [];
  const currentPhase = phases.find(
    (phase: any) => phase.order === account.propCurrentPhase
  );
  const probability = estimatePropPassProbability(
    account,
    challengeRuleRow,
    snapshots
  );
  const topAlert = recentAlerts[0] || ruleCheck.alerts[0];
  const targetPct = currentPhase?.profitTarget ?? null;

  const remainingToTarget =
    targetPct != null
      ? Math.max(0, targetPct - ruleCheck.metrics.currentProfitPercent)
      : null;

  const statsRows = [
    { label: "Account", value: account.name },
    {
      label: "Phase",
      value:
        account.propCurrentPhase === 0
          ? "Funded"
          : currentPhase?.name || `Phase ${account.propCurrentPhase || 1}`,
    },
    { label: "Status", value: account.propPhaseStatus || "active" },
    {
      label: "Current profit",
      value: formatPct(ruleCheck.metrics.currentProfitPercent, 2),
      note: formatUsd(ruleCheck.metrics.currentProfit),
    },
    targetPct != null
      ? {
          label: "Target",
          value: formatPct(targetPct, 2),
          note:
            remainingToTarget != null
              ? `${formatPct(remainingToTarget, 2)} remaining`
              : undefined,
        }
      : null,
    {
      label: "Daily drawdown",
      value: formatPct(ruleCheck.metrics.dailyDrawdownPercent, 2),
    },
    {
      label: "Max drawdown",
      value: formatPct(ruleCheck.metrics.maxDrawdownPercent, 2),
    },
    {
      label: "Trading days",
      value: String(ruleCheck.metrics.tradingDays),
      note:
        currentPhase?.minTradingDays != null
          ? `${currentPhase.minTradingDays} required`
          : undefined,
    },
    ruleCheck.metrics.daysRemaining != null
      ? {
          label: "Days remaining",
          value: String(ruleCheck.metrics.daysRemaining),
        }
      : null,
    probability
      ? {
          label: "Pass probability",
          value: formatPct(probability.passPercentage, 0),
          note:
            probability.daysToTarget != null
              ? `~${probability.daysToTarget} days to target`
              : undefined,
        }
      : null,
  ].filter(Boolean);

  const recommendations: string[] = [];
  if (topAlert?.severity === "critical") {
    recommendations.push(
      "Challenge is in breach territory. Stop trading until you reset the risk state."
    );
  } else if (ruleCheck.metrics.dailyDrawdownPercent > 0) {
    recommendations.push("Trade smaller until daily drawdown headroom resets.");
  }
  if (remainingToTarget != null && remainingToTarget > 0) {
    recommendations.push(
      `You still need ${formatPct(
        remainingToTarget,
        2
      )} to hit the target. Protect downside first and avoid forcing size.`
    );
  }
  if (
    currentPhase?.minTradingDays &&
    ruleCheck.metrics.tradingDays < currentPhase.minTradingDays
  ) {
    recommendations.push(
      `You still need ${
        currentPhase.minTradingDays - ruleCheck.metrics.tradingDays
      } trading day(s) to satisfy the minimum-day rule.`
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      "Risk state is stable. The priority is clean execution, not speed."
    );
  }

  const message = [
    `${account.name} ${
      firmRow?.displayName || firmRow?.name || "prop"
    } readout: ${formatPct(
      ruleCheck.metrics.currentProfitPercent,
      2
    )} progress${
      targetPct != null ? ` toward a ${formatPct(targetPct, 2)} target` : ""
    }.`,
    `Daily drawdown is ${formatPct(
      ruleCheck.metrics.dailyDrawdownPercent,
      2
    )} and max drawdown is ${formatPct(
      ruleCheck.metrics.maxDrawdownPercent,
      2
    )}.`,
    ruleCheck.metrics.daysRemaining != null
      ? `${ruleCheck.metrics.daysRemaining} day(s) remain in the current phase.`
      : null,
    probability
      ? `Estimated pass probability is ${formatPct(
          probability.passPercentage,
          0
        )}.`
      : null,
    topAlert ? `Top risk: ${topAlert.message}` : recommendations[0],
  ]
    .filter(Boolean)
    .join(" ");

  return {
    handled: true,
    domain: "prop",
    message,
    data: {
      account,
      ruleCheck,
      probability,
      firm: firmRow,
      challengeRule: challengeRuleRow,
    },
    analysisBlocks: [
      {
        type: "stats",
        title: "Prop command center",
        rows: statsRows,
      },
      topAlert
        ? {
            type: "callout",
            tone: topAlert.severity === "critical" ? "warning" : "info",
            title: "Highest risk",
            body: topAlert.message,
          }
        : null,
      {
        type: "recommendations",
        title: "Next actions",
        items: recommendations,
      },
    ].filter(Boolean),
  };
}

async function handleJournalQuery(
  context: AssistantSpecialistContext
): Promise<AssistantSpecialistResult> {
  const entries = await db
    .select({
      id: journalEntry.id,
      title: journalEntry.title,
      entryType: journalEntry.entryType,
      tags: journalEntry.tags,
      tradePhase: journalEntry.tradePhase,
      aiPatterns: journalEntry.aiPatterns,
      aiTopics: journalEntry.aiTopics,
      aiSummary: journalEntry.aiSummary,
      psychology: journalEntry.psychology,
      linkedTradeIds: journalEntry.linkedTradeIds,
      updatedAt: journalEntry.updatedAt,
      wordCount: journalEntry.wordCount,
    })
    .from(journalEntry)
    .where(
      and(
        eq(journalEntry.userId, context.userId),
        eq(journalEntry.isArchived, false)
      )
    )
    .orderBy(desc(journalEntry.updatedAt))
    .limit(12);

  if (entries.length === 0) {
    return {
      handled: true,
      domain: "journal",
      message:
        "I can answer journal questions once you have entries to analyze. Right now there's no journal data to ground the response.",
      analysisBlocks: [
        {
          type: "callout",
          tone: "warning",
          title: "No journal coverage yet",
          body: "Create a few daily or trade-review entries first. Once they exist, I can summarize recurring strengths, weaknesses, and psychology patterns.",
        },
      ],
    };
  }

  const tagCounts = new Map<string, number>();
  const topicCounts = new Map<string, number>();
  const patternCounts = new Map<string, number>();
  const weaknessPatterns = new Map<string, number>();
  const strengthPatterns = new Map<string, number>();
  const phaseCounts = new Map<string, number>();
  let totalFocus = 0;
  let totalConfidence = 0;
  let totalFear = 0;
  let totalGreed = 0;
  let psychSamples = 0;

  for (const entry of entries) {
    for (const tag of (entry.tags as string[] | null) || []) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
    for (const topic of (entry.aiTopics as string[] | null) || []) {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    }
    for (const pattern of (entry.aiPatterns as any[] | null) || []) {
      if (!pattern?.title) continue;
      patternCounts.set(
        pattern.title,
        (patternCounts.get(pattern.title) || 0) + 1
      );
      if (pattern.type === "weakness" || pattern.type === "recommendation") {
        weaknessPatterns.set(
          pattern.title,
          (weaknessPatterns.get(pattern.title) || 0) + 1
        );
      }
      if (pattern.type === "strength") {
        strengthPatterns.set(
          pattern.title,
          (strengthPatterns.get(pattern.title) || 0) + 1
        );
      }
    }
    if (entry.tradePhase) {
      phaseCounts.set(
        entry.tradePhase,
        (phaseCounts.get(entry.tradePhase) || 0) + 1
      );
    }
    const psychology = entry.psychology as any;
    if (psychology) {
      totalFocus += toNumber(psychology.focus);
      totalConfidence += toNumber(psychology.confidence);
      totalFear += toNumber(psychology.fear);
      totalGreed += toNumber(psychology.greed);
      psychSamples += 1;
    }
  }

  const topTags = pickTopLabels(tagCounts);
  const topTopics = pickTopLabels(topicCounts);
  const topPatterns = pickTopLabels(patternCounts);
  const topWeaknesses = pickTopLabels(weaknessPatterns, 2);
  const topStrengths = pickTopLabels(strengthPatterns, 2);
  const topPhase = pickTopLabels(phaseCounts, 1)[0];

  const avgFocus = psychSamples > 0 ? totalFocus / psychSamples : 0;
  const avgConfidence = psychSamples > 0 ? totalConfidence / psychSamples : 0;
  const avgFear = psychSamples > 0 ? totalFear / psychSamples : 0;
  const avgGreed = psychSamples > 0 ? totalGreed / psychSamples : 0;

  const insights: string[] = [];
  if (topPatterns.length > 0) {
    insights.push(
      `Most repeated pattern: ${topPatterns[0].label} (${topPatterns[0].count} entries).`
    );
  }
  if (topTopics.length > 0) {
    insights.push(
      `Recurring topics: ${topTopics.map((item) => item.label).join(", ")}.`
    );
  }
  if (avgFear > avgConfidence && psychSamples > 0) {
    insights.push(
      `Your journaled fear level is running above confidence (${avgFear.toFixed(
        1
      )} vs ${avgConfidence.toFixed(1)}).`
    );
  }
  if (avgFocus > 0) {
    insights.push(`Average reported focus is ${avgFocus.toFixed(1)}/10.`);
  }

  const recommendations: string[] = [];
  if (topWeaknesses.length > 0) {
    recommendations.push(
      `Work on ${topWeaknesses[0].label.toLowerCase()} first.`
    );
  }
  if (avgFocus > 0 && avgFocus < 7) {
    recommendations.push(
      "Use the journal to note pre-session focus blockers before you trade."
    );
  }
  if (topStrengths.length > 0) {
    recommendations.push(
      `Keep reinforcing ${topStrengths[0].label.toLowerCase()}.`
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      "Keep writing post-trade reviews with explicit lessons and next-session actions."
    );
  }

  const message = [
    `Journal readout: ${entries.length} recent entries reviewed.`,
    topPatterns[0]
      ? `The strongest recurring theme is ${topPatterns[0].label.toLowerCase()}.`
      : null,
    topWeaknesses[0]
      ? `The main issue repeating in the journal is ${topWeaknesses[0].label.toLowerCase()}.`
      : null,
    topStrengths[0]
      ? `Your clearest strength is ${topStrengths[0].label.toLowerCase()}.`
      : null,
    recommendations[0],
  ]
    .filter(Boolean)
    .join(" ");

  return {
    handled: true,
    domain: "journal",
    message,
    data: { entries },
    analysisBlocks: [
      {
        type: "stats",
        title: "Journal signal",
        rows: [
          { label: "Recent entries", value: String(entries.length) },
          { label: "Most common phase", value: topPhase?.label || "mixed" },
          {
            label: "Average focus",
            value: psychSamples > 0 ? `${avgFocus.toFixed(1)}/10` : "n/a",
          },
          {
            label: "Average confidence",
            value: psychSamples > 0 ? `${avgConfidence.toFixed(1)}/10` : "n/a",
          },
          {
            label: "Average fear",
            value: psychSamples > 0 ? `${avgFear.toFixed(1)}/10` : "n/a",
          },
        ],
      },
      insights.length > 0
        ? {
            type: "insights",
            title: "Recurring patterns",
            items: insights,
          }
        : null,
      {
        type: "recommendations",
        title: "Journal focus",
        items: recommendations,
      },
      topTags.length > 0
        ? {
            type: "stats",
            title: "Most used tags",
            rows: topTags.map((tag) => ({
              label: tag.label,
              value: `${tag.count} entries`,
            })),
          }
        : null,
    ].filter(Boolean),
  };
}

function handleDashboardQuery(
  context: AssistantSpecialistContext,
  pageContext: AssistantPageContext
): AssistantSpecialistResult {
  if (!context.condensed || !context.fullProfile?.profile) {
    return { handled: false };
  }

  const profile = context.fullProfile.profile;
  const topEdge = context.fullProfile.edges?.[0];
  const topLeak = context.fullProfile.leaks?.[0];
  const topNudge = context.coachingNudges?.[0];
  const dashboardCoverage = summarizeDashboardCoverage(pageContext);
  const focusedWidgetInsight = buildFocusedDashboardInsight(
    pageContext.focusedWidgetId,
    context
  );

  const recommendations = [
    topLeak
      ? `Prioritize fixing ${topLeak.label.toLowerCase()}.`
      : "Keep reinforcing the setups that already have enough sample size.",
    topEdge
      ? `Lean harder into ${topEdge.label.toLowerCase()} while sample quality stays high.`
      : "Keep tagging trades so the edge profile sharpens.",
    topNudge?.message ||
      "Treat the next session as execution practice, not a P&L target.",
  ];

  const message = [
    `Dashboard readout: ${formatPct(
      context.condensed.winRate
    )} win rate, profit factor ${context.condensed.profitFactor.toFixed(
      2
    )}, expectancy ${formatUsd(context.condensed.expectancy)} per trade.`,
    focusedWidgetInsight,
    topEdge ? `Best edge: ${topEdge.label}.` : null,
    topLeak ? `Main leak: ${topLeak.label}.` : null,
    context.sessionState?.isActive
      ? `Current session is active with ${context.sessionState.tradeCount} trades.`
      : "No active session right now.",
    recommendations[0],
  ]
    .filter(Boolean)
    .join(" ");

  return {
    handled: true,
    domain: "dashboard",
    message,
    data: { profile, condensed: context.condensed },
    analysisBlocks: [
      {
        type: "stats",
        title: "Dashboard priority",
        rows: [
          {
            label: "Scope",
            value:
              pageContext.accountScope === "all"
                ? "All accounts"
                : "Single account",
          },
          { label: "Win rate", value: formatPct(context.condensed.winRate) },
          {
            label: "Profit factor",
            value: context.condensed.profitFactor.toFixed(2),
          },
          {
            label: "Expectancy",
            value: formatUsd(context.condensed.expectancy),
          },
          {
            label: "Total trades",
            value: String(context.condensed.totalTrades),
          },
          pageContext.focusedWidgetId
            ? {
                label: "Focused widget",
                value:
                  getDashboardWidgetLabel(pageContext.focusedWidgetId) ||
                  "Dashboard",
              }
            : null,
        ].filter(Boolean) as Array<{
          label: string;
          value: string;
          note?: string;
        }>,
      },
      dashboardCoverage
        ? {
            type: "callout",
            tone: "info",
            title: "Dashboard context",
            body: dashboardCoverage,
          }
        : null,
      context.fullProfile.edges?.length || context.fullProfile.leaks?.length
        ? {
            type: "edgeConditions",
            title: "Current edge map",
            edges: (context.fullProfile.edges || [])
              .slice(0, 4)
              .map((edge: any) => ({
                label: edge.label,
                winRate: edge.winRate,
                trades: edge.trades,
                confidence: edge.confidence,
              })),
            leaks: (context.fullProfile.leaks || [])
              .slice(0, 4)
              .map((leak: any) => ({
                label: leak.label,
                winRate: leak.winRate,
                trades: leak.trades,
                confidence: leak.confidence,
              })),
          }
        : null,
      {
        type: "recommendations",
        title: "Best focus next",
        items: recommendations,
      },
    ].filter(Boolean),
  };
}

export async function maybeHandleSpecialistQuery(
  userMessage: string,
  context: AssistantSpecialistContext
): Promise<AssistantSpecialistResult> {
  const pageContext = normalizeAssistantPageContext(context.pageContext);
  const domain = detectAssistantDomain(userMessage, pageContext);

  if (!domain) {
    return { handled: false };
  }

  switch (domain) {
    case "unsupported":
      return buildUnsupportedResponse();
    case "psychology":
      return buildPsychologyResult(context.tiltStatus, context.mentalScore);
    case "session":
      return buildSessionResult(
        context.sessionState,
        context.coachingNudges || []
      );
    case "prop":
      return handlePropQuery(context, pageContext);
    case "journal":
      return handleJournalQuery(context);
    case "dashboard":
      return handleDashboardQuery(context, pageContext);
    default:
      return { handled: false };
  }
}
