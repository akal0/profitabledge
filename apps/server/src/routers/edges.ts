import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, ilike, inArray, not, or, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "../db";
import { user as userTable } from "../db/schema/auth";
import { journalEntry } from "../db/schema/journal";
import {
  edge,
  edgeMissedTrade,
  edgeRule,
  edgeSection,
  edgeShareMember,
  edgeVersion,
  trade,
  tradeEdgeAssignment,
  tradeEdgeRuleEvaluation,
  tradingAccount,
} from "../db/schema/trading";
import {
  EDGE_PUBLICATION_MODES,
  EDGE_RULE_EVALUATION_STATUSES,
  EDGE_RULE_OUTCOMES,
  EDGE_SHARE_ROLES,
  EDGE_STATUSES,
  applyEdgeLegacyProjection,
  assignEdgeToTrade,
  bulkAssignLegacyModelTagToTrades,
  ensureUserOwnedEdge,
  formatEdgeName,
  getAccessibleEdgeById,
  getAssignableEdgesForUser,
  getTradeOutcomeEdgeBucket,
  normalizeEdgeName,
  setTradeEdgeRuleEvaluations,
} from "../lib/edges/service";
import {
  ensureEdgeVersionBaseline,
  recordEdgeVersion,
} from "../lib/edges/versioning";
import { issuePublicEdgeVerification } from "../lib/verification/share-verification";
import { getApprovedAffiliateProfile } from "../lib/billing/growth";
import { backfillUserEdgesFromLegacy } from "../lib/edges/compatibility";
import { createNotification } from "../lib/notifications";
import {
  deriveClosedTradeClosePrice,
  deriveClosedTradeProfit,
  parseManualTradeDate,
} from "../lib/trades/manual/derive";
import { normalizeTradeTags } from "../lib/trades/tags";
import { protectedProcedure, publicProcedure, router } from "../lib/trpc";
import {
  ensureTradeBatchOwnership,
  ensureTradeOwnership,
  invalidateTradeScopeCaches,
} from "./trades/shared";

const edgePublicationModeSchema = z.enum(EDGE_PUBLICATION_MODES);
const edgeStatusSchema = z.enum(EDGE_STATUSES);
const edgeShareRoleSchema = z.enum(EDGE_SHARE_ROLES);
const edgeRuleOutcomeSchema = z.enum(EDGE_RULE_OUTCOMES);
const edgeRuleEvaluationStatusSchema = z.enum(EDGE_RULE_EVALUATION_STATUSES);

function isPositiveTradeOutcome(outcome: string | null | undefined) {
  return outcome === "Win" || outcome === "PW";
}

type EdgeTradeMetricRow = {
  id: string;
  accountId: string;
  broker: string | null;
  verificationLevel: string | null;
  isPropAccount: boolean | null;
  symbol: string | null;
  tradeType: string | null;
  profit: number | null;
  outcome: string | null;
  sessionTag: string | null;
  openTime: Date | null;
  closeTime: Date | null;
  realisedRR: number | null;
};

type EdgeRuleEvaluationRow = {
  ruleId: string;
  status: string;
  tradeId: string;
  profit: number | null;
  outcome: string | null;
};

type EdgeOwnerProfile = {
  id: string;
  name: string;
  displayName: string | null;
  username: string | null;
  image: string | null;
  bio: string | null;
};

function shouldExposePublicEdgeStats(args: {
  publicationMode: string | null | undefined;
  isFeatured: boolean | null | undefined;
  publicStatsVisible: boolean | null | undefined;
}) {
  if (args.isFeatured) {
    return true;
  }

  if (args.publicationMode !== "library") {
    return true;
  }

  return args.publicStatsVisible !== false;
}

function coerceNumeric(value: unknown) {
  if (value == null) {
    return null;
  }

  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(String(value));

  return Number.isFinite(numericValue) ? numericValue : null;
}

function buildEquityCurve(trades: EdgeTradeMetricRow[]) {
  const ordered = [...trades].sort((left, right) => {
    const leftTs =
      left.closeTime?.getTime() ??
      left.openTime?.getTime() ??
      Number.NEGATIVE_INFINITY;
    const rightTs =
      right.closeTime?.getTime() ??
      right.openTime?.getTime() ??
      Number.NEGATIVE_INFINITY;
    return leftTs - rightTs;
  });

  let runningTotal = 0;
  return ordered.map((currentTrade, index) => {
    runningTotal += coerceNumeric(currentTrade.profit) ?? 0;
    return {
      index: index + 1,
      equity: runningTotal,
      label:
        currentTrade.closeTime?.toISOString() ??
        currentTrade.openTime?.toISOString() ??
        `${index + 1}`,
    };
  });
}

function buildOutcomeBreakdown(trades: EdgeTradeMetricRow[]) {
  const breakdown = new Map<string, number>();
  for (const currentTrade of trades) {
    const label =
      currentTrade.outcome === "Win"
        ? "Winner"
        : currentTrade.outcome === "PW"
        ? "Partial Win"
        : currentTrade.outcome === "BE"
        ? "Breakeven"
        : currentTrade.outcome === "Loss"
        ? "Loser"
        : "Unclassified";
    breakdown.set(label, (breakdown.get(label) ?? 0) + 1);
  }

  return Array.from(breakdown.entries()).map(([label, value]) => ({
    label,
    value,
  }));
}

function buildSessionBreakdown(trades: EdgeTradeMetricRow[]) {
  const breakdown = new Map<string, number>();
  for (const currentTrade of trades) {
    const label = currentTrade.sessionTag?.trim() || "Unassigned";
    breakdown.set(label, (breakdown.get(label) ?? 0) + 1);
  }

  return Array.from(breakdown.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 8);
}

function buildRDistribution(trades: EdgeTradeMetricRow[]) {
  const buckets = new Map<number, number>();

  for (const currentTrade of trades) {
    if (currentTrade.realisedRR == null || !Number.isFinite(currentTrade.realisedRR)) {
      continue;
    }

    const bucketFloor = Math.floor(currentTrade.realisedRR);
    buckets.set(bucketFloor, (buckets.get(bucketFloor) ?? 0) + 1);
  }

  return Array.from(buckets.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([bucketFloor, value]) => ({
      label: `${bucketFloor}R to ${bucketFloor + 1}R`,
      value,
    }));
}

function calculateReviewMetrics(evaluations: EdgeRuleEvaluationRow[]) {
  let followed = 0;
  let broken = 0;
  let notReviewed = 0;

  for (const evaluation of evaluations) {
    if (evaluation.status === "followed") followed += 1;
    if (evaluation.status === "broken") broken += 1;
    if (evaluation.status === "not_reviewed") notReviewed += 1;
  }

  const applicable = followed + broken + notReviewed;
  const reviewed = followed + broken;

  return {
    followed,
    broken,
    notReviewed,
    applicable,
    reviewed,
    followThroughRate:
      followed + broken > 0 ? followed / (followed + broken) : null,
    reviewCoverage: applicable > 0 ? reviewed / applicable : null,
  };
}

function calculateEdgeMetrics(args: {
  trades: EdgeTradeMetricRow[];
  evaluations: EdgeRuleEvaluationRow[];
  missedTrades: Array<{ estimatedPnl: number | null }>;
  shareCount: number;
  copyCount: number;
}) {
  const { trades, evaluations, missedTrades, shareCount, copyCount } = args;
  const tradeCount = trades.length;
  const winningTrades = trades.filter((currentTrade) =>
    isPositiveTradeOutcome(currentTrade.outcome)
  );
  const losses = trades.filter((currentTrade) => currentTrade.outcome === "Loss");
  const netPnl = trades.reduce(
    (total, currentTrade) => total + (coerceNumeric(currentTrade.profit) ?? 0),
    0
  );
  const expectancy =
    tradeCount > 0
      ? trades.reduce(
          (total, currentTrade) =>
            total + (coerceNumeric(currentTrade.realisedRR) ?? 0),
          0
        ) / tradeCount
      : null;
  const grossWins = winningTrades.reduce(
    (total, currentTrade) =>
      total + Math.max(coerceNumeric(currentTrade.profit) ?? 0, 0),
    0
  );
  const grossLosses = losses.reduce(
    (total, currentTrade) =>
      total + Math.abs(Math.min(coerceNumeric(currentTrade.profit) ?? 0, 0)),
    0
  );
  const averageRValues = trades.filter(
    (currentTrade) =>
      coerceNumeric(currentTrade.realisedRR) != null
  );
  const reviewMetrics = calculateReviewMetrics(evaluations);
  const missedTradeCount = missedTrades.length;
  const missedTradeOpportunity = missedTrades.reduce(
    (total, currentTrade) => total + (currentTrade.estimatedPnl ?? 0),
    0
  );

  return {
    tradeCount,
    winRate: tradeCount > 0 ? winningTrades.length / tradeCount : null,
    netPnl,
    expectancy,
    averageR:
      averageRValues.length > 0
        ? averageRValues.reduce(
            (total, currentTrade) =>
              total + (coerceNumeric(currentTrade.realisedRR) ?? 0),
            0
          ) / averageRValues.length
        : null,
    profitFactor: grossLosses > 0 ? grossWins / grossLosses : null,
    missedTradeCount,
    missedTradeOpportunity,
    shareCount,
    copyCount,
    followThroughRate: reviewMetrics.followThroughRate,
    reviewCoverage: reviewMetrics.reviewCoverage,
    reviewCounts: reviewMetrics,
    charts: {
      equityCurve: buildEquityCurve(trades),
      outcomeBreakdown: buildOutcomeBreakdown(trades),
      sessionBreakdown: buildSessionBreakdown(trades),
      rDistribution: buildRDistribution(trades),
    },
  };
}

function formatRatioAsPercent(
  value: number | null | undefined,
  fractionDigits = 0
) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return `${(value * 100).toFixed(fractionDigits)}%`;
}

function collectTopLabels(
  values: Array<string | null | undefined>,
  options?: {
    limit?: number;
    excludeLabels?: string[];
  }
) {
  const counts = new Map<string, number>();
  const excluded = new Set(options?.excludeLabels ?? []);

  for (const value of values) {
    const label = value?.trim();
    if (!label || excluded.has(label)) {
      continue;
    }
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, options?.limit ?? 3)
    .map(([label]) => label);
}

function describeDirectionBias(trades: EdgeTradeMetricRow[]) {
  let longCount = 0;
  let shortCount = 0;

  for (const currentTrade of trades) {
    const tradeType = String(currentTrade.tradeType ?? "").toLowerCase();
    if (tradeType === "short") {
      shortCount += 1;
    } else if (tradeType === "long") {
      longCount += 1;
    }
  }

  const total = longCount + shortCount;
  if (total === 0) {
    return "No directional sample yet";
  }

  const dominantShare = Math.max(longCount, shortCount) / total;
  if (dominantShare < 0.6) {
    return "Balanced long / short sample";
  }

  return longCount >= shortCount
    ? "Long-biased execution sample"
    : "Short-biased execution sample";
}

function describeAccountContext(trades: EdgeTradeMetricRow[]) {
  if (trades.length === 0) {
    return "No account context yet";
  }

  const propTradeCount = trades.filter((tradeRow) => tradeRow.isPropAccount).length;
  if (propTradeCount === 0) {
    return "Mostly personal-account sample";
  }

  const propShare = propTradeCount / trades.length;
  if (propShare >= 0.7) {
    return "Mostly executed on prop accounts";
  }

  if (propShare >= 0.3) {
    return "Mixed prop and personal-account sample";
  }

  return "Mostly personal-account sample";
}

function describeEdgePublication(edgeRow: typeof edge.$inferSelect) {
  if (edgeRow.isFeatured) {
    return "Featured edge";
  }

  if (edgeRow.publicationMode === "library") {
    return "Library edge";
  }

  return "Private edge";
}

function buildEdgePassport(args: {
  edgeRow: typeof edge.$inferSelect;
  metrics: ReturnType<typeof calculateEdgeMetrics>;
  trades: EdgeTradeMetricRow[];
  source:
    | {
        id: string;
        name: string;
        ownerName: string | null;
        ownerUsername: string | null;
      }
    | null;
}) {
  const { edgeRow, metrics, trades, source } = args;
  const verifiedTradeCount = trades.filter((tradeRow) => {
    const verificationLevel = String(tradeRow.verificationLevel ?? "").toLowerCase();
    return verificationLevel.length > 0 && verificationLevel !== "unverified";
  }).length;
  const propTradeCount = trades.filter((tradeRow) => tradeRow.isPropAccount).length;
  const verifiedShare =
    metrics.tradeCount > 0 ? verifiedTradeCount / metrics.tradeCount : null;
  const propShare = metrics.tradeCount > 0 ? propTradeCount / metrics.tradeCount : null;
  const topSessions = collectTopLabels(
    trades.map((tradeRow) => tradeRow.sessionTag),
    { limit: 3, excludeLabels: ["Unassigned"] }
  );
  const topSymbols = collectTopLabels(
    trades.map((tradeRow) => tradeRow.symbol),
    { limit: 3 }
  );

  const sampleCard =
    metrics.tradeCount >= 50
      ? {
          value: "Validated",
          detail: `${metrics.tradeCount} tagged trades`,
          tone: "teal",
        }
      : metrics.tradeCount >= 20
      ? {
          value: "Building",
          detail: `${metrics.tradeCount} tagged trades`,
          tone: "blue",
        }
      : metrics.tradeCount >= 8
      ? {
          value: "Early",
          detail: `${metrics.tradeCount} tagged trades`,
          tone: "amber",
        }
      : metrics.tradeCount > 0
      ? {
          value: "Thin",
          detail: `${metrics.tradeCount} tagged trades`,
          tone: "rose",
        }
      : {
          value: "Empty",
          detail: "No executed trades linked yet",
          tone: "slate",
        };

  const proofCard =
    metrics.tradeCount === 0
      ? {
          value: "No proof yet",
          detail: "No executed trades linked yet",
          tone: "slate",
        }
      : verifiedTradeCount === 0
      ? {
          value: "Self-reported",
          detail: "No synced / verified trades in sample",
          tone: "rose",
        }
      : verifiedShare != null && verifiedShare >= 0.8
      ? {
          value: "Verified sample",
          detail: `${verifiedTradeCount} of ${metrics.tradeCount} trades from synced or verified accounts`,
          tone: "teal",
        }
      : {
          value: "Mixed proof",
          detail: `${verifiedTradeCount} of ${metrics.tradeCount} trades from synced or verified accounts`,
          tone: "blue",
        };

  const processCard =
    metrics.reviewCounts.reviewed === 0
      ? {
          value: "Needs review loop",
          detail: "No rule reviews logged yet",
          tone: "amber",
        }
      : (metrics.followThroughRate ?? 0) >= 0.7 &&
        (metrics.reviewCoverage ?? 0) >= 0.5
      ? {
          value: "Tight process",
          detail: `${formatRatioAsPercent(metrics.followThroughRate)} follow-through across ${metrics.reviewCounts.reviewed} reviewed trades`,
          tone: "teal",
        }
      : (metrics.followThroughRate ?? 0) >= 0.55 ||
        (metrics.reviewCoverage ?? 0) >= 0.3
      ? {
          value: "Mixed process",
          detail: `${formatRatioAsPercent(metrics.followThroughRate)} follow-through across ${metrics.reviewCounts.reviewed} reviewed trades`,
          tone: "amber",
        }
      : {
          value: "Loose process",
          detail: `${formatRatioAsPercent(metrics.followThroughRate)} follow-through across ${metrics.reviewCounts.reviewed} reviewed trades`,
          tone: "rose",
        };

  const propCard =
    metrics.tradeCount === 0
      ? {
          value: "No sample",
          detail: "No account context yet",
          tone: "slate",
        }
      : propTradeCount === 0
      ? {
          value: "No prop usage yet",
          detail: "Sample comes from personal or unclassified accounts",
          tone: "slate",
        }
      : (propShare ?? 0) >= 0.65
      ? {
          value: "Prop-tested",
          detail: `${propTradeCount} of ${metrics.tradeCount} trades came from prop accounts`,
          tone: "teal",
        }
      : {
          value: "Mixed account sample",
          detail: `${propTradeCount} of ${metrics.tradeCount} trades came from prop accounts`,
          tone: "amber",
        };

  return {
    cards: {
      sample: {
        label: "Sample",
        ...sampleCard,
      },
      proof: {
        label: "Proof",
        ...proofCard,
      },
      process: {
        label: "Process",
        ...processCard,
      },
      prop: {
        label: "Prop context",
        ...propCard,
      },
    },
    fitNotes: [
      {
        label: "Most traded sessions",
        value:
          topSessions.length > 0 ? topSessions.join(", ") : "No session tags yet",
      },
      {
        label: "Most tested symbols",
        value:
          topSymbols.length > 0 ? topSymbols.join(", ") : "No symbol sample yet",
      },
      {
        label: "Direction bias",
        value: describeDirectionBias(trades),
      },
      {
        label: "Account context",
        value: describeAccountContext(trades),
      },
    ],
    lineage: {
      publicationLabel: describeEdgePublication(edgeRow),
      forkCount: metrics.copyCount,
      shareCount: metrics.shareCount,
      source,
    },
  };
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function getReadinessLabel(score: number) {
  if (score >= 80) {
    return "Ready";
  }

  if (score >= 55) {
    return "Building";
  }

  if (score >= 30) {
    return "Early";
  }

  return "Draft";
}

function buildEdgeReadiness(args: {
  edgeRow: typeof edge.$inferSelect;
  metrics: ReturnType<typeof calculateEdgeMetrics>;
  trades: EdgeTradeMetricRow[];
  versionCount: number;
}) {
  const { edgeRow, metrics, trades, versionCount } = args;
  const verifiedTradeCount = trades.filter((tradeRow) => {
    const verificationLevel = String(tradeRow.verificationLevel ?? "").toLowerCase();
    return verificationLevel.length > 0 && verificationLevel !== "unverified";
  }).length;
  const verifiedShare =
    metrics.tradeCount > 0 ? verifiedTradeCount / metrics.tradeCount : 0;
  const sampleScore =
    metrics.tradeCount > 0
      ? clamp((Math.min(metrics.tradeCount, 40) / 40) * 30)
      : 0;
  const expectancyScore =
    metrics.expectancy != null && metrics.expectancy > 0
      ? clamp(Math.min(metrics.expectancy, 2) / 2 * 15)
      : 0;
  const processScore = clamp(
    (metrics.followThroughRate ?? 0) * 15 + (metrics.reviewCoverage ?? 0) * 10
  );
  const proofScore = clamp(verifiedShare * 15);
  const documentationScore =
    (edgeRow.contentHtml?.trim() ? 5 : 0) +
    (edgeRow.examplesHtml?.trim() ? 3 : 0) +
    (edgeRow.description?.trim() ? 2 : 0);
  const versionScore = clamp(Math.min(versionCount, 5));
  const score = clamp(
    sampleScore +
      expectancyScore +
      processScore +
      proofScore +
      documentationScore +
      versionScore
  );
  const label = getReadinessLabel(score);

  const blockers: string[] = [];
  const nextActions: string[] = [];

  if (metrics.tradeCount < 20) {
    blockers.push("Sample is still thin for repeatable deployment.");
    nextActions.push("Tag at least 20 executed trades to strengthen the sample.");
  }

  if ((metrics.expectancy ?? 0) <= 0) {
    blockers.push("Expectancy is not positive yet.");
    nextActions.push("Refine the setup rules before allocating more risk to it.");
  }

  if ((metrics.reviewCoverage ?? 0) < 0.35) {
    blockers.push("Rule review coverage is too light to trust the process data.");
    nextActions.push("Review more trades so the process score reflects reality.");
  }

  if ((metrics.followThroughRate ?? 0) < 0.6 && metrics.reviewCounts.reviewed > 0) {
    blockers.push("Execution discipline is below the level expected for scaling.");
    nextActions.push("Use pre-trade guardrails to stop low-conviction executions.");
  }

  if (!edgeRow.contentHtml?.trim()) {
    blockers.push("The edge thesis is not documented yet.");
    nextActions.push("Write the market context and execution framework in the thesis tab.");
  }

  if (!edgeRow.examplesHtml?.trim()) {
    nextActions.push("Add annotated examples so forks inherit cleaner context.");
  }

  if (nextActions.length === 0) {
    nextActions.push("Keep collecting clean samples and maintain the review loop.");
  }

  const summary =
    label === "Ready"
      ? "This Edge has enough evidence, process coverage, and documentation to deploy repeatedly or publish confidently."
      : label === "Building"
      ? "The pattern is promising, but it still needs more proof or tighter process before you scale it."
      : label === "Early"
      ? "A real setup is forming here, but the sample and review loop are still too thin for strong confidence."
      : "This Edge is still a draft. Keep it private while you define the rules and build the sample.";

  return {
    score,
    label,
    summary,
    badges: [
      {
        label: "Sample",
        value:
          metrics.tradeCount >= 40
            ? "Deep"
            : metrics.tradeCount >= 20
            ? "Building"
            : metrics.tradeCount >= 8
            ? "Early"
            : "Thin",
        tone:
          metrics.tradeCount >= 40
            ? "positive"
            : metrics.tradeCount >= 20
            ? "warning"
            : "critical",
      },
      {
        label: "Proof",
        value:
          metrics.tradeCount === 0
            ? "None"
            : verifiedShare >= 0.75
            ? "Verified"
            : verifiedShare >= 0.3
            ? "Mixed"
            : "Self-reported",
        tone:
          verifiedShare >= 0.75
            ? "positive"
            : verifiedShare >= 0.3
            ? "warning"
            : "critical",
      },
      {
        label: "Process",
        value:
          (metrics.followThroughRate ?? 0) >= 0.7
            ? "Tight"
            : (metrics.followThroughRate ?? 0) >= 0.55
            ? "Mixed"
            : "Loose",
        tone:
          (metrics.followThroughRate ?? 0) >= 0.7
            ? "positive"
            : (metrics.followThroughRate ?? 0) >= 0.55
            ? "warning"
            : "critical",
      },
      {
        label: "Docs",
        value:
          edgeRow.contentHtml?.trim() && edgeRow.examplesHtml?.trim()
            ? "Complete"
            : edgeRow.contentHtml?.trim()
            ? "Partial"
            : "Missing",
        tone:
          edgeRow.contentHtml?.trim() && edgeRow.examplesHtml?.trim()
            ? "positive"
            : edgeRow.contentHtml?.trim()
            ? "warning"
            : "critical",
      },
    ],
    blockers,
    nextActions,
  };
}

function buildEdgeAccountFit(args: {
  accounts: Array<{
    id: string;
    name: string;
    broker: string | null;
    isPropAccount: boolean | null;
    verificationLevel: string | null;
    lastSyncedAt: Date | null;
    createdAt: Date;
  }>;
  trades: EdgeTradeMetricRow[];
}) {
  const { accounts, trades } = args;
  if (accounts.length === 0) {
    return null;
  }

  const dominantBroker = collectTopLabels(
    trades.map((tradeRow) => tradeRow.broker),
    { limit: 1 }
  )[0];
  const propTradeCount = trades.filter((tradeRow) => tradeRow.isPropAccount).length;
  const propShare = trades.length > 0 ? propTradeCount / trades.length : 0;
  const tradeUsage = new Map<
    string,
    { count: number; lastUsedAt: Date | null }
  >();

  for (const tradeRow of trades) {
    const existing = tradeUsage.get(tradeRow.accountId) ?? {
      count: 0,
      lastUsedAt: null,
    };
    const tradeTimestamp = tradeRow.closeTime ?? tradeRow.openTime ?? null;
    tradeUsage.set(tradeRow.accountId, {
      count: existing.count + 1,
      lastUsedAt:
        existing.lastUsedAt == null ||
        (tradeTimestamp != null &&
          tradeTimestamp.getTime() > existing.lastUsedAt.getTime())
          ? tradeTimestamp
          : existing.lastUsedAt,
    });
  }

  const recommendations = accounts
    .map((account) => {
      const usage = tradeUsage.get(account.id) ?? { count: 0, lastUsedAt: null };
      const reasons: string[] = [];
      let score = trades.length > 0 ? 35 : 20;

      if (usage.count > 0) {
        score += 30;
        reasons.push(
          `Already used on ${usage.count} ${usage.count === 1 ? "edge trade" : "edge trades"}.`
        );
      } else {
        reasons.push("No direct Edge history on this account yet.");
      }

      if (dominantBroker && account.broker === dominantBroker) {
        score += 20;
        reasons.push(`Broker matches the strongest sample (${dominantBroker}).`);
      }

      if (propShare >= 0.6) {
        if (account.isPropAccount) {
          score += 18;
          reasons.push("Edge sample is prop-heavy and this account matches that pressure.");
        } else {
          score -= 10;
          reasons.push("This edge was mostly executed on prop accounts.");
        }
      } else if (trades.length > 0 && propShare <= 0.25) {
        if (!account.isPropAccount) {
          score += 12;
          reasons.push("Edge sample is mostly personal-account execution.");
        } else {
          reasons.push("Prop rules may add pressure that is not dominant in the sample.");
        }
      }

      const verificationLevel = String(account.verificationLevel ?? "").toLowerCase();
      if (verificationLevel.length > 0 && verificationLevel !== "unverified") {
        score += 8;
        reasons.push("Verified account helps preserve proof quality.");
      }

      const roundedScore = clamp(score);

      return {
        accountId: account.id,
        accountName: account.name,
        label:
          roundedScore >= 80
            ? "Best fit"
            : roundedScore >= 60
            ? "Good fit"
            : roundedScore >= 40
            ? "Usable"
            : "Weak fit",
        score: roundedScore,
        broker: account.broker,
        isProp: account.isPropAccount ?? false,
        reasons,
        lastUsedAt: usage.lastUsedAt ?? account.lastSyncedAt ?? account.createdAt,
      };
    })
    .sort((left, right) => {
      const scoreDelta = (right.score ?? 0) - (left.score ?? 0);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      const leftTs = left.lastUsedAt ? new Date(left.lastUsedAt).getTime() : 0;
      const rightTs = right.lastUsedAt ? new Date(right.lastUsedAt).getTime() : 0;
      return rightTs - leftTs;
    })
    .slice(0, 4);

  const cautions: string[] = [];
  if (trades.length < 8) {
    cautions.push("Account matching is still early because the trade sample is thin.");
  }

  if (propShare >= 0.6 && !accounts.some((account) => account.isPropAccount)) {
    cautions.push("The edge looks prop-oriented, but you do not have a prop account connected here.");
  }

  const topRecommendation = recommendations[0] ?? null;

  return {
    summary: topRecommendation
      ? `${topRecommendation.accountName} is the strongest current fit based on broker overlap, account context, and where this edge already has proof.`
      : "Connect trading accounts to start matching this edge to the right capital lane.",
    recommendations,
    cautions,
  };
}

function formatVersionFieldLabel(field: string) {
  switch (field) {
    case "contentBlocks":
    case "contentHtml":
      return "Content";
    case "examplesBlocks":
    case "examplesHtml":
      return "Examples";
    case "coverImageUrl":
    case "coverImagePosition":
      return "Cover";
    case "publicStatsVisible":
      return "Stats";
    case "publicationMode":
      return "Publication";
    case "sourceEdgeId":
      return "Lineage";
    case "sections":
      return "Sections";
    case "rules":
      return "Rules";
    default:
      return field
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\b\w/g, (character) => character.toUpperCase());
  }
}

async function buildEdgeVersionHistory(edgeId: string) {
  const versionRows = await db
    .select({
      id: edgeVersion.id,
      versionNumber: edgeVersion.versionNumber,
      createdByUserId: edgeVersion.createdByUserId,
      changeType: edgeVersion.changeType,
      changeSummary: edgeVersion.changeSummary,
      changedFields: edgeVersion.changedFields,
      diffSummary: edgeVersion.diffSummary,
      snapshot: edgeVersion.snapshot,
      createdAt: edgeVersion.createdAt,
    })
    .from(edgeVersion)
    .where(eq(edgeVersion.edgeId, edgeId))
    .orderBy(desc(edgeVersion.versionNumber))
    .limit(20);

  if (versionRows.length === 0) {
    return {
      versions: [],
      count: 0,
    };
  }

  const actorIds = Array.from(
    new Set(
      versionRows
        .map((versionRow) => versionRow.createdByUserId)
        .filter((value): value is string => Boolean(value))
    )
  );
  const actorProfiles = await getEdgeOwnerProfiles(actorIds);
  const latestVersionNumber = versionRows[0]?.versionNumber ?? 0;

  return {
    count: versionRows.length,
    versions: versionRows.map((versionRow) => {
      const actor =
        versionRow.createdByUserId != null
          ? actorProfiles.get(versionRow.createdByUserId) ?? null
          : null;
      const snapshot =
        (versionRow.snapshot as
          | { edge?: { publicationMode?: string | null } }
          | null
          | undefined) ?? null;
      const diffSummary =
        (versionRow.diffSummary as
          | {
              previousSectionCount?: number;
              nextSectionCount?: number;
              previousRuleCount?: number;
              nextRuleCount?: number;
              structuralChange?: boolean;
            }
          | null
          | undefined) ?? null;
      const changedFields =
        (versionRow.changedFields as string[] | null | undefined) ?? [];

      const changes = [
        changedFields.length > 0
          ? {
              label: "Changed",
              value: changedFields
                .slice(0, 3)
                .map(formatVersionFieldLabel)
                .join(", "),
            }
          : null,
        diffSummary?.structuralChange
          ? {
              label: "Structure",
              value: `${diffSummary.previousSectionCount ?? 0} -> ${diffSummary.nextSectionCount ?? 0} sections · ${diffSummary.previousRuleCount ?? 0} -> ${diffSummary.nextRuleCount ?? 0} rules`,
            }
          : null,
      ].filter(
        (
          value
        ): value is {
          label: string;
          value: string;
        } => Boolean(value)
      );

      return {
        id: versionRow.id,
        label: `Version ${versionRow.versionNumber}`,
        createdAt: versionRow.createdAt,
        authorName:
          actor?.displayName?.trim() ||
          actor?.name?.trim() ||
          actor?.username?.trim() ||
          null,
        summary:
          versionRow.changeSummary ??
          formatVersionFieldLabel(versionRow.changeType),
        isCurrent: versionRow.versionNumber === latestVersionNumber,
        isPublished: snapshot?.edge?.publicationMode === "library",
        changes,
      };
    }),
  };
}

function buildPublicEdgePath(edgeId: string) {
  return `/edge/${edgeId}`;
}

async function buildEdgeSourceSummary(args: {
  viewerUserId?: string | null;
  edgeRow: Pick<typeof edge.$inferSelect, "sourceEdgeId">;
}) {
  if (!args.edgeRow.sourceEdgeId) {
    return null;
  }

  const rootSourceEdge = await resolveRootSourceEdge(args.edgeRow);
  const preferredSourceId = rootSourceEdge?.id ?? args.edgeRow.sourceEdgeId;
  const sourceEdgeRows =
    args.viewerUserId != null
      ? [
          await getAccessibleEdgeById(args.viewerUserId, preferredSourceId),
          preferredSourceId !== args.edgeRow.sourceEdgeId
            ? await getAccessibleEdgeById(args.viewerUserId, args.edgeRow.sourceEdgeId)
            : null,
        ]
      : await Promise.all([
          db
            .select()
            .from(edge)
            .where(eq(edge.id, preferredSourceId))
            .limit(1)
            .then((rows) => rows[0] ?? null),
          preferredSourceId !== args.edgeRow.sourceEdgeId
            ? db
                .select()
                .from(edge)
                .where(eq(edge.id, args.edgeRow.sourceEdgeId))
                .limit(1)
                .then((rows) => rows[0] ?? null)
            : Promise.resolve(null),
        ]);
  const sourceEdgeRow = sourceEdgeRows.find(Boolean) ?? null;

  if (!sourceEdgeRow) {
    return null;
  }

  const ownerProfiles = await getEdgeOwnerProfiles([sourceEdgeRow.ownerUserId]);
  const sourceOwner = ownerProfiles.get(sourceEdgeRow.ownerUserId) ?? null;
  const isPublicSource =
    sourceEdgeRow.isFeatured || sourceEdgeRow.publicationMode === "library";

  if (args.viewerUserId == null && !isPublicSource) {
    return null;
  }

  return {
    id: sourceEdgeRow.id,
    name: sourceEdgeRow.name,
    ownerName: sourceOwner?.displayName ?? sourceOwner?.name ?? null,
    ownerUsername: sourceOwner?.username ?? null,
    shareId: isPublicSource ? sourceEdgeRow.id : null,
    publicPath: isPublicSource ? buildPublicEdgePath(sourceEdgeRow.id) : null,
  };
}

function buildEdgeSummaryPassport(args: {
  edgeRow: typeof edge.$inferSelect;
  metrics: ReturnType<typeof calculateEdgeMetrics>;
  readiness: ReturnType<typeof buildEdgeReadiness>;
}) {
  return {
    readiness: {
      label: args.readiness.label,
      score: args.readiness.score,
      note: args.readiness.summary,
    },
    lineage: {
      forkCount: args.metrics.copyCount,
      descendantCount: args.metrics.copyCount,
      forkDepth: args.edgeRow.sourceEdgeId ? 1 : 0,
    },
  };
}

async function buildEdgeLineageGraph(args: {
  viewerUserId: string;
  edgeRow: typeof edge.$inferSelect;
  shareCount: number;
}) {
  const { viewerUserId, edgeRow, shareCount } = args;
  const [parent, root, descendantRows] = await Promise.all([
    edgeRow.sourceEdgeId
      ? db
          .select()
          .from(edge)
          .where(eq(edge.id, edgeRow.sourceEdgeId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    edgeRow.sourceEdgeId ? resolveRootSourceEdge(edgeRow) : Promise.resolve(null),
    db
      .select()
      .from(edge)
      .where(eq(edge.sourceEdgeId, edgeRow.id))
      .orderBy(desc(edge.updatedAt), asc(edge.name))
      .limit(12),
  ]);

  const accessibleDescendants = descendantRows.filter(
    (descendant) =>
      descendant.ownerUserId === viewerUserId ||
      descendant.isFeatured ||
      descendant.publicationMode === "library"
  );
  const ownerIds = Array.from(
    new Set([
      edgeRow.ownerUserId,
      ...(parent ? [parent.ownerUserId] : []),
      ...(root ? [root.ownerUserId] : []),
      ...accessibleDescendants.map((descendant) => descendant.ownerUserId),
    ])
  );
  const ownerProfiles = await getEdgeOwnerProfiles(ownerIds);

  const mapNode = (edgeRowValue: typeof edge.$inferSelect) => {
    const owner = ownerProfiles.get(edgeRowValue.ownerUserId) ?? null;
    return {
      id: edgeRowValue.id,
      name: edgeRowValue.name,
      ownerName: owner?.displayName ?? owner?.name ?? null,
      publicationLabel: describeEdgePublication(edgeRowValue),
    };
  };

  return {
    current: mapNode(edgeRow),
    parent: parent ? mapNode(parent) : null,
    root: root ? mapNode(root) : null,
    descendants: accessibleDescendants.map(mapNode),
    forkCount: descendantRows.length,
    shareCount,
  };
}

async function getEdgeTradeRows(edgeIds: string[]) {
  if (edgeIds.length === 0) {
    return [] as Array<EdgeTradeMetricRow & { edgeId: string }>;
  }

  const rows = await db
    .select({
      edgeId: tradeEdgeAssignment.edgeId,
      id: trade.id,
      accountId: trade.accountId,
      broker: tradingAccount.broker,
      verificationLevel: tradingAccount.verificationLevel,
      isPropAccount: tradingAccount.isPropAccount,
      symbol: trade.symbol,
      tradeType: trade.tradeType,
      profit: sql<number | null>`CAST(${trade.profit} AS NUMERIC)`,
      outcome: trade.outcome,
      sessionTag: trade.sessionTag,
      openTime: trade.openTime,
      closeTime: trade.closeTime,
      realisedRR: sql<number | null>`CAST(${trade.realisedRR} AS NUMERIC)`,
    })
    .from(tradeEdgeAssignment)
    .innerJoin(trade, eq(trade.id, tradeEdgeAssignment.tradeId))
    .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
    .where(inArray(tradeEdgeAssignment.edgeId, edgeIds));

  return rows.map((row) => ({
    ...row,
    profit: coerceNumeric(row.profit),
    realisedRR: coerceNumeric(row.realisedRR),
  }));
}

async function getEdgeEvaluationRows(edgeIds: string[]) {
  if (edgeIds.length === 0) {
    return [] as Array<EdgeRuleEvaluationRow & { edgeId: string }>;
  }

  const rows = await db
    .select({
      edgeId: tradeEdgeRuleEvaluation.edgeId,
      ruleId: tradeEdgeRuleEvaluation.ruleId,
      status: tradeEdgeRuleEvaluation.status,
      tradeId: tradeEdgeRuleEvaluation.tradeId,
      profit: sql<number | null>`CAST(${trade.profit} AS NUMERIC)`,
      outcome: trade.outcome,
    })
    .from(tradeEdgeRuleEvaluation)
    .innerJoin(trade, eq(trade.id, tradeEdgeRuleEvaluation.tradeId))
    .where(inArray(tradeEdgeRuleEvaluation.edgeId, edgeIds));

  return rows.map((row) => ({
    ...row,
    profit: coerceNumeric(row.profit),
  }));
}

async function getEdgeMissedTradeRows(edgeIds: string[]) {
  if (edgeIds.length === 0) {
    return [] as Array<{ edgeId: string; estimatedPnl: number | null }>;
  }

  const rows = await db
    .select({
      edgeId: edgeMissedTrade.edgeId,
      estimatedPnl: sql<number | null>`CAST(${edgeMissedTrade.estimatedPnl} AS NUMERIC)`,
    })
    .from(edgeMissedTrade)
    .where(inArray(edgeMissedTrade.edgeId, edgeIds));

  return rows.map((row) => ({
    ...row,
    estimatedPnl: coerceNumeric(row.estimatedPnl),
  }));
}

async function getEdgeShareCounts(edgeIds: string[]) {
  if (edgeIds.length === 0) {
    return new Map<string, number>();
  }

  const rows = await db
    .select({
      edgeId: edgeShareMember.edgeId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(edgeShareMember)
    .where(inArray(edgeShareMember.edgeId, edgeIds))
    .groupBy(edgeShareMember.edgeId);

  return new Map(rows.map((row) => [row.edgeId, row.count]));
}

async function getEdgeCopyCounts(edgeIds: string[]) {
  if (edgeIds.length === 0) {
    return new Map<string, number>();
  }

  const rows = await db
    .select({
      sourceEdgeId: edge.sourceEdgeId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(edge)
    .where(inArray(edge.sourceEdgeId, edgeIds))
    .groupBy(edge.sourceEdgeId);

  return new Map(
    rows
      .filter((row): row is { sourceEdgeId: string; count: number } =>
        Boolean(row.sourceEdgeId)
      )
      .map((row) => [row.sourceEdgeId, row.count])
  );
}

async function getEdgeOwnerProfiles(ownerUserIds: string[]) {
  if (ownerUserIds.length === 0) {
    return new Map<string, EdgeOwnerProfile>();
  }

  const rows = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      displayName: userTable.displayName,
      username: userTable.username,
      image: userTable.image,
      bio: userTable.bio,
    })
    .from(userTable)
    .where(inArray(userTable.id, ownerUserIds));

  return new Map(rows.map((row) => [row.id, row]));
}

async function resolveRootSourceEdge(
  edgeRow: Pick<typeof edge.$inferSelect, "sourceEdgeId">
) {
  let currentSourceId = edgeRow.sourceEdgeId;
  let currentSource: typeof edge.$inferSelect | null = null;
  const visitedSourceIds = new Set<string>();

  while (currentSourceId && !visitedSourceIds.has(currentSourceId)) {
    visitedSourceIds.add(currentSourceId);

    const [nextSource] = await db
      .select()
      .from(edge)
      .where(eq(edge.id, currentSourceId))
      .limit(1);

    if (!nextSource) {
      break;
    }

    currentSource = nextSource;
    currentSourceId = nextSource.sourceEdgeId;
  }

  return currentSource;
}

async function createUserForkedEdge(input: {
  userId: string;
  baseName: string;
  color?: string | null;
  description?: string | null;
}) {
  const formattedBaseName = formatEdgeName(input.baseName);

  if (!formattedBaseName) {
    throw new Error("Edge name is required");
  }

  let nextName = formattedBaseName;
  let suffix = 2;

  while (true) {
    const nextNormalizedName = normalizeEdgeName(nextName);
    const [existingEdge] = await db
      .select({ id: edge.id })
      .from(edge)
      .where(
        and(
          eq(edge.ownerUserId, input.userId),
          eq(edge.normalizedName, nextNormalizedName)
        )
      )
      .limit(1);

    if (!existingEdge) {
      const [createdEdge] = await db
        .insert(edge)
        .values({
          ownerUserId: input.userId,
          name: nextName,
          normalizedName: nextNormalizedName,
          description: input.description ?? null,
          color: input.color ?? "#3B82F6",
        })
        .returning();

      if (!createdEdge) {
        throw new Error("Failed to create forked Edge");
      }

      return createdEdge;
    }

    nextName = `${formattedBaseName} ${suffix}`;
    suffix += 1;
  }
}

async function buildEdgeSummaries(
  edgeRows: Array<typeof edge.$inferSelect>,
  options?: {
    viewerUserId?: string | null;
  }
) {
  if (edgeRows.length === 0) {
    return [];
  }

  const edgeIds = edgeRows.map((currentEdge) => currentEdge.id);
  const ownerUserIds = Array.from(
    new Set(edgeRows.map((currentEdge) => currentEdge.ownerUserId))
  );
  const versionCountRows = await db
    .select({
      edgeId: edgeVersion.edgeId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(edgeVersion)
    .where(inArray(edgeVersion.edgeId, edgeIds))
    .groupBy(edgeVersion.edgeId);
  const versionCountByEdgeId = new Map(
    versionCountRows.map((row) => [row.edgeId, row.count])
  );
  const [
    tradeRows,
    evaluationRows,
    missedTradeRows,
    shareCounts,
    copyCounts,
    ownerProfiles,
  ] =
    await Promise.all([
      getEdgeTradeRows(edgeIds),
      getEdgeEvaluationRows(edgeIds),
      getEdgeMissedTradeRows(edgeIds),
      getEdgeShareCounts(edgeIds),
      getEdgeCopyCounts(edgeIds),
      getEdgeOwnerProfiles(ownerUserIds),
    ]);

  return Promise.all(edgeRows.map(async (currentEdge) => {
    const currentTradeRows = tradeRows.filter((row) => row.edgeId === currentEdge.id);
    const metrics = calculateEdgeMetrics({
      trades: currentTradeRows,
      evaluations: evaluationRows.filter((row) => row.edgeId === currentEdge.id),
      missedTrades: missedTradeRows.filter(
        (row) => row.edgeId === currentEdge.id
      ),
      shareCount: shareCounts.get(currentEdge.id) ?? 0,
      copyCount: copyCounts.get(currentEdge.id) ?? 0,
    });
    const readiness = buildEdgeReadiness({
      edgeRow: currentEdge,
      metrics,
      trades: currentTradeRows,
      versionCount: versionCountByEdgeId.get(currentEdge.id) ?? 0,
    });
    const sourceEdge = await buildEdgeSourceSummary({
      viewerUserId: options?.viewerUserId ?? null,
      edgeRow: currentEdge,
    });

    return {
      ...currentEdge,
      owner: ownerProfiles.get(currentEdge.ownerUserId) ?? null,
      sourceEdge,
      metrics,
      passport: buildEdgeSummaryPassport({
        edgeRow: currentEdge,
        metrics,
        readiness,
      }),
      publicPage:
        currentEdge.isFeatured || currentEdge.publicationMode === "library"
          ? {
              shareId: currentEdge.id,
              path: buildPublicEdgePath(currentEdge.id),
            }
          : null,
      legacy: applyEdgeLegacyProjection(currentEdge),
    };
  }));
}

function applyPublicSummaryStatsVisibility<
  TSummary extends {
    publicationMode?: string | null;
    isFeatured?: boolean | null;
    publicStatsVisible?: boolean | null;
    metrics?: unknown;
    passport?: {
      cards?: unknown;
      fitNotes?: unknown;
      readiness?: unknown;
      lineage?: unknown;
    } | null;
  },
>(summary: TSummary) {
  if (
    shouldExposePublicEdgeStats({
      publicationMode: summary.publicationMode,
      isFeatured: summary.isFeatured,
      publicStatsVisible: summary.publicStatsVisible,
    })
  ) {
    return summary;
  }

  return {
    ...summary,
    metrics: null,
    passport: summary.passport
      ? {
          ...summary.passport,
          cards: null,
          fitNotes: [],
          readiness: null,
        }
      : summary.passport,
  };
}

async function assertOwnedEdge(userId: string, edgeId: string) {
  const [ownedEdge] = await db
    .select()
    .from(edge)
    .where(and(eq(edge.id, edgeId), eq(edge.ownerUserId, userId)))
    .limit(1);

  if (!ownedEdge) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Edge not found",
    });
  }

  return ownedEdge;
}

async function resolveOwnedAccountId(
  userId: string,
  accountId: string | null | undefined
) {
  if (!accountId) {
    return null;
  }

  const [ownedAccount] = await db
    .select({ id: tradingAccount.id })
    .from(tradingAccount)
    .where(
      and(eq(tradingAccount.id, accountId), eq(tradingAccount.userId, userId))
    )
    .limit(1);

  if (!ownedAccount) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Account not found",
    });
  }

  return ownedAccount.id;
}

function parseStoredNullableNumber(
  value: string | number | null | undefined
) {
  if (value == null) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveMissedTradeTimestamp(
  value: string | null | undefined,
  label: string
) {
  if (value === undefined) {
    return undefined;
  }

  if (!value) {
    return null;
  }

  try {
    return parseManualTradeDate(value, label);
  } catch (error: any) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: error?.message || `${label} is invalid`,
    });
  }
}

function deriveMissedTradeMetrics(input: {
  symbol: string;
  tradeType: string | null | undefined;
  volume?: number | null;
  openPrice?: number | null;
  closePrice?: number | null;
  sl?: number | null;
  tp?: number | null;
  estimatedProfit?: number | null;
  estimatedRR?: number | null;
  estimatedPnl?: number | null;
  commissions?: number | null;
  swap?: number | null;
}) {
  const normalizedTradeType =
    input.tradeType === "long" || input.tradeType === "short"
      ? input.tradeType
      : null;
  const volume = parseStoredNullableNumber(input.volume);
  const openPrice = parseStoredNullableNumber(input.openPrice);
  let closePrice = parseStoredNullableNumber(input.closePrice);
  let estimatedProfit = parseStoredNullableNumber(input.estimatedProfit);
  const commissions = parseStoredNullableNumber(input.commissions) ?? 0;
  const swap = parseStoredNullableNumber(input.swap) ?? 0;

  if (
    normalizedTradeType &&
    volume != null &&
    openPrice != null &&
    closePrice == null &&
    estimatedProfit != null
  ) {
    closePrice = deriveClosedTradeClosePrice({
      tradeType: normalizedTradeType,
      openPrice,
      volume,
      symbol: input.symbol,
      profit: estimatedProfit,
    });
  }

  if (
    normalizedTradeType &&
    volume != null &&
    openPrice != null &&
    closePrice != null
  ) {
    estimatedProfit = deriveClosedTradeProfit({
      tradeType: normalizedTradeType,
      openPrice,
      closePrice,
      volume,
      symbol: input.symbol,
    });
  }

  let estimatedRR = parseStoredNullableNumber(input.estimatedRR);
  const sl = parseStoredNullableNumber(input.sl);
  const tp = parseStoredNullableNumber(input.tp);

  if (openPrice != null && sl != null && tp != null) {
    const risk = Math.abs(openPrice - sl);
    const target = Math.abs(tp - openPrice);
    estimatedRR =
      risk > 0 && Number.isFinite(target) ? target / risk : estimatedRR;
  }

  const fallbackEstimatedPnl = parseStoredNullableNumber(input.estimatedPnl);
  const estimatedPnl =
    estimatedProfit != null
      ? estimatedProfit + commissions + swap
      : fallbackEstimatedPnl;

  return {
    closePrice,
    estimatedProfit,
    estimatedRR,
    estimatedPnl,
  };
}

const createEdgeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(4000).optional(),
  color: z.string().trim().regex(/^#([0-9a-fA-F]{6})$/).optional(),
});

export const edgesRouter = router({
  listAssignable: protectedProcedure.query(async ({ ctx }) => {
    await backfillUserEdgesFromLegacy(ctx.session.user.id);
    return getAssignableEdgesForUser(ctx.session.user.id);
  }),

  listMy: protectedProcedure
    .input(
      z
        .object({
          search: z.string().trim().optional(),
          includeArchived: z.boolean().optional().default(false),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      await backfillUserEdgesFromLegacy(ctx.session.user.id);

      const conditions = [eq(edge.ownerUserId, ctx.session.user.id)];

      if (!input?.includeArchived) {
        conditions.push(not(eq(edge.status, "archived")));
      }

      if (input?.search) {
        conditions.push(ilike(edge.name, `%${input.search}%`));
      }

      const rows = await db
        .select()
        .from(edge)
        .where(and(...conditions))
        .orderBy(desc(edge.updatedAt), asc(edge.name));

      return buildEdgeSummaries(rows, {
        viewerUserId: ctx.session.user.id,
      });
    }),

  listShared: protectedProcedure
    .input(
      z
        .object({
          search: z.string().trim().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      await backfillUserEdgesFromLegacy(ctx.session.user.id);

      const searchCondition = input?.search
        ? ilike(edge.name, `%${input.search}%`)
        : null;

      const libraryRows = await db
        .select()
        .from(edge)
        .where(
          and(
            eq(edge.publicationMode, "library"),
            eq(edge.isDemoSeeded, false),
            not(eq(edge.status, "archived")),
            ...(searchCondition ? [searchCondition] : [])
          )
        )
        .orderBy(desc(edge.isFeatured), desc(edge.updatedAt), asc(edge.name));

      const sharedRows = await db
        .select({
          id: edge.id,
          ownerUserId: edge.ownerUserId,
          sourceEdgeId: edge.sourceEdgeId,
          name: edge.name,
          normalizedName: edge.normalizedName,
          description: edge.description,
          contentBlocks: edge.contentBlocks,
          contentHtml: edge.contentHtml,
          examplesBlocks: edge.examplesBlocks,
          examplesHtml: edge.examplesHtml,
          coverImageUrl: edge.coverImageUrl,
          coverImagePosition: edge.coverImagePosition,
          color: edge.color,
          status: edge.status,
          publicationMode: edge.publicationMode,
          publicStatsVisible: edge.publicStatsVisible,
          isDemoSeeded: edge.isDemoSeeded,
          isFeatured: edge.isFeatured,
          featuredAt: edge.featuredAt,
          featuredByUserId: edge.featuredByUserId,
          createdAt: edge.createdAt,
          updatedAt: edge.updatedAt,
        })
        .from(edgeShareMember)
        .innerJoin(edge, eq(edge.id, edgeShareMember.edgeId))
        .where(
          and(
            eq(edgeShareMember.userId, ctx.session.user.id),
            not(eq(edge.ownerUserId, ctx.session.user.id)),
            not(eq(edge.status, "archived")),
            ...(searchCondition ? [searchCondition] : [])
          )
        )
        .orderBy(desc(edge.updatedAt), asc(edge.name));

      const featuredRows = libraryRows.filter((row) => row.isFeatured);

      return {
        library: (await buildEdgeSummaries(libraryRows, {
          viewerUserId: ctx.session.user.id,
        })).map(
          applyPublicSummaryStatsVisibility
        ),
        sharedWithMe: await buildEdgeSummaries(sharedRows, {
          viewerUserId: ctx.session.user.id,
        }),
        featured: await buildEdgeSummaries(featuredRows, {
          viewerUserId: ctx.session.user.id,
        }),
      };
    }),

  getLibraryByOwner: protectedProcedure
    .input(
      z.object({
        ownerUserId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const [owner] = await db
        .select({
          id: userTable.id,
          name: userTable.name,
          displayName: userTable.displayName,
          username: userTable.username,
          image: userTable.image,
          bio: userTable.bio,
        })
        .from(userTable)
        .where(eq(userTable.id, input.ownerUserId))
        .limit(1);

      if (!owner) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Library owner not found",
        });
      }

      const rows = await db
        .select()
        .from(edge)
        .where(
          and(
            eq(edge.ownerUserId, input.ownerUserId),
            eq(edge.publicationMode, "library"),
            eq(edge.isDemoSeeded, false),
            not(eq(edge.status, "archived"))
          )
        )
        .orderBy(desc(edge.isFeatured), desc(edge.updatedAt), asc(edge.name));

      return {
        owner,
        edges: (await buildEdgeSummaries(rows)).map(
          applyPublicSummaryStatsVisibility
        ),
      };
    }),

  getPublicEdgePage: publicProcedure
    .input(
      z.object({
        shareId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const [publicEdge] = await db
        .select()
        .from(edge)
        .where(
          and(
            eq(edge.id, input.shareId),
            not(eq(edge.status, "archived")),
            or(eq(edge.publicationMode, "library"), eq(edge.isFeatured, true))
          )
        )
        .limit(1);

      if (!publicEdge) {
        return null;
      }

      const [summary] = await buildEdgeSummaries([publicEdge]);
      const tradeRows = await getEdgeTradeRows([publicEdge.id]);
      const sourceEdgeSummary = await buildEdgeSourceSummary({
        edgeRow: publicEdge,
      });
      const viewerCanSeeStats = shouldExposePublicEdgeStats({
        publicationMode: publicEdge.publicationMode,
        isFeatured: publicEdge.isFeatured,
        publicStatsVisible: publicEdge.publicStatsVisible,
      });
      const passportBase = summary?.metrics
        ? buildEdgePassport({
            edgeRow: publicEdge,
            metrics: summary.metrics,
            trades: tradeRows,
            source: sourceEdgeSummary,
          })
        : null;
      const passport = passportBase
        ? {
            ...passportBase,
            cards: viewerCanSeeStats ? passportBase.cards : null,
            fitNotes: viewerCanSeeStats ? passportBase.fitNotes : [],
            lineage: {
              ...passportBase.lineage,
              descendantCount: summary?.metrics?.copyCount ?? 0,
              forkDepth: publicEdge.sourceEdgeId ? 1 : 0,
            },
          }
        : null;
      const owner =
        summary?.owner != null
          ? {
              id: summary.owner.id,
              name: summary.owner.name,
              displayName: summary.owner.displayName,
              username: summary.owner.username,
              image: summary.owner.image,
            }
          : null;

      return {
        edge: {
          id: publicEdge.id,
          name: publicEdge.name,
          description: publicEdge.description,
          coverImageUrl: publicEdge.coverImageUrl,
          coverImagePosition: publicEdge.coverImagePosition,
          color: publicEdge.color,
          contentHtml: publicEdge.contentHtml,
          examplesHtml: publicEdge.examplesHtml,
          metrics: viewerCanSeeStats ? summary?.metrics ?? null : null,
          passport,
        },
        owner,
        verification: issuePublicEdgeVerification({
          edgeId: publicEdge.id,
          username: owner?.username ?? null,
          edgeName: publicEdge.name,
          ownerName:
            owner?.displayName ?? owner?.name ?? owner?.username ?? null,
        }),
      };
    }),

  getDetail: protectedProcedure
    .input(
      z.object({
        edgeId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      await backfillUserEdgesFromLegacy(ctx.session.user.id);

      const accessibleEdge = await getAccessibleEdgeById(
        ctx.session.user.id,
        input.edgeId
      );

      if (!accessibleEdge) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Edge not found",
        });
      }

      const summaries = await buildEdgeSummaries([accessibleEdge], {
        viewerUserId: ctx.session.user.id,
      });
      const summary = summaries[0];
      const viewerIsOwner = accessibleEdge.ownerUserId === ctx.session.user.id;
      const viewerHasDirectShare = viewerIsOwner
        ? false
        : (
            await db
              .select({ id: edgeShareMember.id })
              .from(edgeShareMember)
              .where(
                and(
                  eq(edgeShareMember.edgeId, accessibleEdge.id),
                  eq(edgeShareMember.userId, ctx.session.user.id)
                )
              )
              .limit(1)
          ).length > 0;
      const viewerCanSeeStats =
        viewerIsOwner ||
        viewerHasDirectShare ||
        shouldExposePublicEdgeStats({
          publicationMode: accessibleEdge.publicationMode,
          isFeatured: accessibleEdge.isFeatured,
          publicStatsVisible: accessibleEdge.publicStatsVisible,
        });
      const viewerCanSeePrivateActivity = viewerIsOwner || viewerHasDirectShare;

      const [
        sourceEdgeSummary,
        sectionRows,
        ruleRows,
        tradeRows,
        evaluationRows,
        missedTrades,
        entryRows,
        shareMemberRows,
        viewerAccountRows,
        versionHistory,
        lineageGraph,
        approvedAffiliateProfile,
      ] =
        await Promise.all([
          buildEdgeSourceSummary({
            viewerUserId: ctx.session.user.id,
            edgeRow: accessibleEdge,
          }),
          db
            .select()
            .from(edgeSection)
            .where(eq(edgeSection.edgeId, accessibleEdge.id))
            .orderBy(asc(edgeSection.sortOrder), asc(edgeSection.title)),
          db
            .select()
            .from(edgeRule)
            .where(eq(edgeRule.edgeId, accessibleEdge.id))
            .orderBy(asc(edgeRule.sortOrder), asc(edgeRule.title)),
          getEdgeTradeRows([accessibleEdge.id]),
          getEdgeEvaluationRows([accessibleEdge.id]),
          db
            .select({
              id: edgeMissedTrade.id,
              accountId: edgeMissedTrade.accountId,
              symbol: edgeMissedTrade.symbol,
              tradeType: edgeMissedTrade.tradeType,
              volume: sql<number | null>`CAST(${edgeMissedTrade.volume} AS NUMERIC)`,
              openPrice: sql<number | null>`CAST(${edgeMissedTrade.openPrice} AS NUMERIC)`,
              closePrice: sql<number | null>`CAST(${edgeMissedTrade.closePrice} AS NUMERIC)`,
              sessionTag: edgeMissedTrade.sessionTag,
              modelTag: edgeMissedTrade.modelTag,
              customTags: edgeMissedTrade.customTags,
              setupTime: edgeMissedTrade.setupTime,
              closeTime: edgeMissedTrade.closeTime,
              sl: sql<number | null>`CAST(${edgeMissedTrade.sl} AS NUMERIC)`,
              tp: sql<number | null>`CAST(${edgeMissedTrade.tp} AS NUMERIC)`,
              reasonMissed: edgeMissedTrade.reasonMissed,
              notes: edgeMissedTrade.notes,
              estimatedOutcome: edgeMissedTrade.estimatedOutcome,
              estimatedProfit: sql<number | null>`CAST(${edgeMissedTrade.estimatedProfit} AS NUMERIC)`,
              estimatedRR: sql<number | null>`CAST(${edgeMissedTrade.estimatedRR} AS NUMERIC)`,
              estimatedPnl: sql<number | null>`CAST(${edgeMissedTrade.estimatedPnl} AS NUMERIC)`,
              commissions: sql<number | null>`CAST(${edgeMissedTrade.commissions} AS NUMERIC)`,
              swap: sql<number | null>`CAST(${edgeMissedTrade.swap} AS NUMERIC)`,
              mediaUrls: edgeMissedTrade.mediaUrls,
              createdAt: edgeMissedTrade.createdAt,
              updatedAt: edgeMissedTrade.updatedAt,
            })
            .from(edgeMissedTrade)
            .where(eq(edgeMissedTrade.edgeId, accessibleEdge.id))
            .orderBy(desc(edgeMissedTrade.setupTime), desc(edgeMissedTrade.createdAt)),
          db
            .select({
              id: journalEntry.id,
              title: journalEntry.title,
              entryType: journalEntry.entryType,
              journalDate: journalEntry.journalDate,
              updatedAt: journalEntry.updatedAt,
            })
            .from(journalEntry)
            .where(eq(journalEntry.linkedEdgeId, accessibleEdge.id))
            .orderBy(desc(journalEntry.updatedAt))
            .limit(30),
          accessibleEdge.ownerUserId === ctx.session.user.id
            ? db
                .select({
                  id: edgeShareMember.id,
                  userId: userTable.id,
                  name: userTable.name,
                  displayName: userTable.displayName,
                  username: userTable.username,
                  email: userTable.email,
                  image: userTable.image,
                  role: edgeShareMember.role,
                  createdAt: edgeShareMember.createdAt,
                  updatedAt: edgeShareMember.updatedAt,
                })
                .from(edgeShareMember)
                .innerJoin(userTable, eq(userTable.id, edgeShareMember.userId))
                .where(eq(edgeShareMember.edgeId, accessibleEdge.id))
                .orderBy(
                  asc(userTable.displayName),
                  asc(userTable.name),
                  asc(userTable.username)
                )
            : Promise.resolve([]),
          db
            .select({
              id: tradingAccount.id,
              name: tradingAccount.name,
              broker: tradingAccount.broker,
              isPropAccount: tradingAccount.isPropAccount,
              verificationLevel: tradingAccount.verificationLevel,
              lastSyncedAt: tradingAccount.lastSyncedAt,
              createdAt: tradingAccount.createdAt,
            })
            .from(tradingAccount)
            .where(eq(tradingAccount.userId, ctx.session.user.id))
            .orderBy(desc(tradingAccount.lastSyncedAt), asc(tradingAccount.name)),
          buildEdgeVersionHistory(accessibleEdge.id),
          buildEdgeLineageGraph({
            viewerUserId: ctx.session.user.id,
            edgeRow: accessibleEdge,
            shareCount: summary.metrics?.shareCount ?? 0,
          }),
          accessibleEdge.ownerUserId === ctx.session.user.id
            ? getApprovedAffiliateProfile(ctx.session.user.id)
            : Promise.resolve(null),
        ]);

      const ruleMetricsById = new Map<
        string,
        ReturnType<typeof calculateReviewMetrics> & {
          reviewedCount: number;
          sampleSize: number;
          netPnl: number;
          expectancy: number | null;
          winRateWhenFollowed: number | null;
          winRateWhenBroken: number | null;
        }
      >();

      for (const currentRule of ruleRows) {
        const ruleEvaluations = evaluationRows.filter(
          (evaluation) => evaluation.ruleId === currentRule.id
        );
        const reviewMetrics = calculateReviewMetrics(ruleEvaluations);
        const followedEvaluations = ruleEvaluations.filter(
          (evaluation) => evaluation.status === "followed"
        );
        const brokenEvaluations = ruleEvaluations.filter(
          (evaluation) => evaluation.status === "broken"
        );
        const reviewedEvaluations = ruleEvaluations.filter(
          (evaluation) =>
            evaluation.status === "followed" || evaluation.status === "broken"
        );

        ruleMetricsById.set(currentRule.id, {
          ...reviewMetrics,
          reviewedCount: reviewedEvaluations.length,
          sampleSize: reviewedEvaluations.length,
          netPnl: reviewedEvaluations.reduce(
            (total, evaluation) => total + (evaluation.profit ?? 0),
            0
          ),
          expectancy:
            reviewedEvaluations.length > 0
              ? reviewedEvaluations.reduce(
                  (total, evaluation) => total + (evaluation.profit ?? 0),
                  0
                ) / reviewedEvaluations.length
              : null,
          winRateWhenFollowed:
            followedEvaluations.length > 0
              ? followedEvaluations.filter((evaluation) =>
                  isPositiveTradeOutcome(evaluation.outcome)
                ).length / followedEvaluations.length
              : null,
          winRateWhenBroken:
            brokenEvaluations.length > 0
              ? brokenEvaluations.filter((evaluation) =>
                  isPositiveTradeOutcome(evaluation.outcome)
                ).length / brokenEvaluations.length
              : null,
        });
      }

      const sections = sectionRows.map((currentSection) => {
        const sectionRules = ruleRows
          .filter((currentRule) => currentRule.sectionId === currentSection.id)
          .map((currentRule) => ({
            ...currentRule,
            metrics: ruleMetricsById.get(currentRule.id) ?? {
              ...calculateReviewMetrics([]),
              reviewedCount: 0,
              sampleSize: 0,
              netPnl: 0,
              expectancy: null,
              winRateWhenFollowed: null,
              winRateWhenBroken: null,
            },
          }));

        const sectionEvaluations = sectionRules.flatMap((currentRule) =>
          evaluationRows.filter((evaluation) => evaluation.ruleId === currentRule.id)
        );

        return {
          ...currentSection,
          metrics: {
            ...calculateReviewMetrics(sectionEvaluations),
            reviewedCount: sectionEvaluations.filter(
              (evaluation) =>
                evaluation.status === "followed" || evaluation.status === "broken"
            ).length,
            sampleSize: sectionEvaluations.length,
            netPnl: sectionEvaluations.reduce(
              (total, evaluation) => total + (evaluation.profit ?? 0),
              0
            ),
          },
          rules: sectionRules,
        };
      });

      const readiness =
        viewerCanSeeStats && summary.metrics
          ? buildEdgeReadiness({
              edgeRow: accessibleEdge,
              metrics: summary.metrics,
              trades: tradeRows,
              versionCount: versionHistory.count,
            })
          : null;
      const accountFit =
        viewerCanSeeStats
          ? buildEdgeAccountFit({
              accounts: viewerAccountRows,
              trades: tradeRows,
            })
          : null;
      const passportBase = summary.metrics
        ? buildEdgePassport({
            edgeRow: accessibleEdge,
            metrics: summary.metrics,
            trades: tradeRows,
            source: sourceEdgeSummary,
          })
        : null;
      const passport =
        viewerCanSeeStats && passportBase
          ? {
              ...passportBase,
              readiness: readiness
                ? {
                    label: readiness.label,
                    score: readiness.score,
                    note: readiness.summary,
                  }
                : null,
              lineage: {
                ...passportBase.lineage,
                descendantCount: summary.metrics?.copyCount ?? 0,
                forkDepth: accessibleEdge.sourceEdgeId ? 1 : 0,
              },
            }
          : null;
      const publicPage =
        accessibleEdge.isFeatured || accessibleEdge.publicationMode === "library"
          ? {
              shareId: accessibleEdge.id,
              path: buildPublicEdgePath(accessibleEdge.id),
              verification: issuePublicEdgeVerification({
                edgeId: accessibleEdge.id,
                username: summary.owner?.username ?? null,
                edgeName: accessibleEdge.name,
                ownerName:
                  summary.owner?.displayName ??
                  summary.owner?.name ??
                  summary.owner?.username ??
                  null,
              }),
            }
          : null;

      return {
        edge: {
          ...summary,
          metrics: viewerCanSeeStats ? summary.metrics : null,
          passport,
          readiness,
          accountFit,
          lineageGraph,
          versionHistory: {
            versions: versionHistory.versions,
          },
          sourceEdge: sourceEdgeSummary,
          publicPage,
          publicStatsVisible: accessibleEdge.publicStatsVisible ?? true,
          coverImageUrl: accessibleEdge.coverImageUrl ?? null,
          coverImagePosition: accessibleEdge.coverImagePosition ?? 50,
          contentBlocks:
            (accessibleEdge.contentBlocks as Record<string, unknown>[] | null) ?? [],
          contentHtml: accessibleEdge.contentHtml ?? null,
          examplesBlocks:
            (accessibleEdge.examplesBlocks as Record<string, unknown>[] | null) ?? [],
          examplesHtml: accessibleEdge.examplesHtml ?? null,
        },
        canEdit: viewerIsOwner,
        viewerCanSeeStats,
        viewerCanSeePrivateActivity,
        publishCapabilities: {
          canFeature:
            viewerIsOwner &&
            !accessibleEdge.isDemoSeeded &&
            Boolean(approvedAffiliateProfile),
          canPublishLibrary:
            viewerIsOwner &&
            !accessibleEdge.isDemoSeeded,
        },
        sections,
        executedTrades: viewerCanSeePrivateActivity
          ? tradeRows.map((currentTrade) => ({
              ...currentTrade,
              tradeDirection:
                String(currentTrade.tradeType || "").toLowerCase() === "short"
                  ? "short"
                  : "long",
            }))
          : [],
        missedTrades: viewerCanSeePrivateActivity ? missedTrades : [],
        entries: viewerCanSeePrivateActivity ? entryRows : [],
        sharedMembers: shareMemberRows,
      };
    }),

  searchShareCandidates: protectedProcedure
    .input(
      z.object({
        edgeId: z.string().min(1),
        query: z.string().trim().min(1).max(120),
      })
    )
    .query(async ({ ctx, input }) => {
      const ownedEdge = await assertOwnedEdge(ctx.session.user.id, input.edgeId);

      if (ownedEdge.isDemoSeeded) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Demo workspace Edges cannot be shared",
        });
      }

      const shareRows = await db
        .select({
          userId: edgeShareMember.userId,
          role: edgeShareMember.role,
        })
        .from(edgeShareMember)
        .where(eq(edgeShareMember.edgeId, input.edgeId));

      const shareRoleByUserId = new Map(
        shareRows.map((shareRow) => [shareRow.userId, shareRow.role] as const)
      );

      const searchTerm = `%${input.query}%`;
      const candidateRows = await db
        .select({
          id: userTable.id,
          name: userTable.name,
          displayName: userTable.displayName,
          username: userTable.username,
          email: userTable.email,
          image: userTable.image,
        })
        .from(userTable)
        .where(
          and(
            not(eq(userTable.id, ctx.session.user.id)),
            or(
              ilike(userTable.name, searchTerm),
              ilike(userTable.displayName, searchTerm),
              ilike(userTable.username, searchTerm),
              ilike(userTable.email, searchTerm)
            )
          )
        )
        .orderBy(
          asc(userTable.displayName),
          asc(userTable.name),
          asc(userTable.username)
        )
        .limit(12);

      return candidateRows.map((candidateRow) => ({
        ...candidateRow,
        sharedRole: shareRoleByUserId.get(candidateRow.id) ?? null,
      }));
    }),

  create: protectedProcedure
    .input(createEdgeSchema)
    .mutation(async ({ ctx, input }) => {
      const createdEdge = await ensureUserOwnedEdge({
        userId: ctx.session.user.id,
        name: input.name,
        description: input.description ?? null,
        color: input.color,
      });

      const existingSections = await db
        .select({ id: edgeSection.id })
        .from(edgeSection)
        .where(eq(edgeSection.edgeId, createdEdge.id))
        .limit(1);

      if (existingSections.length === 0) {
        await db.insert(edgeSection).values([
          {
            edgeId: createdEdge.id,
            title: "Entry rules",
            sortOrder: 0,
          },
          {
            edgeId: createdEdge.id,
            title: "In position rules",
            sortOrder: 1,
          },
          {
            edgeId: createdEdge.id,
            title: "Exit rules",
            sortOrder: 2,
          },
        ]);
      }

      await ensureEdgeVersionBaseline({
        edgeId: createdEdge.id,
        userId: ctx.session.user.id,
        changeType: "create",
        changeSummary: "Initial edge scaffold",
      });

      return createdEdge;
    }),

  update: protectedProcedure
    .input(
      z.object({
        edgeId: z.string().min(1),
        name: z.string().trim().min(1).max(120).optional(),
        description: z.string().trim().max(4000).nullable().optional(),
        contentBlocks: z.array(z.unknown()).optional(),
        contentHtml: z.string().nullable().optional(),
        examplesBlocks: z.array(z.unknown()).optional(),
        examplesHtml: z.string().nullable().optional(),
        coverImageUrl: z.string().nullable().optional(),
        coverImagePosition: z.number().min(0).max(100).optional(),
        color: z.string().trim().regex(/^#([0-9a-fA-F]{6})$/).nullable().optional(),
        publicStatsVisible: z.boolean().optional(),
        status: edgeStatusSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ownedEdge = await assertOwnedEdge(ctx.session.user.id, input.edgeId);

      if (
        ownedEdge.isDemoSeeded &&
        (input.coverImageUrl !== undefined || input.coverImagePosition !== undefined)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Demo workspace Edges cannot use custom cover banners",
        });
      }

      const nextName = input.name ? formatEdgeName(input.name) : undefined;
      const updates = {
        ...(nextName
          ? {
              name: nextName,
              normalizedName: normalizeEdgeName(nextName),
            }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.contentBlocks !== undefined
          ? { contentBlocks: input.contentBlocks as Record<string, unknown>[] }
          : {}),
        ...(input.contentHtml !== undefined
          ? { contentHtml: input.contentHtml }
          : {}),
        ...(input.examplesBlocks !== undefined
          ? { examplesBlocks: input.examplesBlocks as Record<string, unknown>[] }
          : {}),
        ...(input.examplesHtml !== undefined
          ? { examplesHtml: input.examplesHtml }
          : {}),
        ...(input.coverImageUrl !== undefined
          ? { coverImageUrl: input.coverImageUrl }
          : {}),
        ...(input.coverImagePosition !== undefined
          ? { coverImagePosition: input.coverImagePosition }
          : {}),
        ...(input.color !== undefined ? { color: input.color ?? "#3B82F6" } : {}),
        ...(input.publicStatsVisible !== undefined
          ? { publicStatsVisible: input.publicStatsVisible }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedAt: new Date(),
      };

      const [updatedEdge] = await db
        .update(edge)
        .set(updates)
        .where(eq(edge.id, input.edgeId))
        .returning();

      if (updatedEdge && (input.name !== undefined || input.color !== undefined)) {
        const assignedTradeRows = await db
          .select({
            tradeId: tradeEdgeAssignment.tradeId,
            accountId: trade.accountId,
          })
          .from(tradeEdgeAssignment)
          .innerJoin(trade, eq(trade.id, tradeEdgeAssignment.tradeId))
          .where(eq(tradeEdgeAssignment.edgeId, updatedEdge.id));

        if (assignedTradeRows.length > 0) {
          await db
            .update(trade)
            .set({
              modelTag: updatedEdge.name,
              modelTagColor: updatedEdge.color,
            })
            .where(
              inArray(
                trade.id,
                assignedTradeRows.map((row) => row.tradeId)
              )
            );

          await invalidateTradeScopeCaches(
            [...new Set(assignedTradeRows.map((row) => row.accountId))]
          );
        }
      }

      if (updatedEdge) {
        await recordEdgeVersion({
          edgeId: updatedEdge.id,
          userId: ctx.session.user.id,
          changeType: "update",
        });
      }

      return updatedEdge;
    }),

  duplicate: protectedProcedure
    .input(
      z.object({
        edgeId: z.string().min(1),
        name: z.string().trim().min(1).max(120).optional(),
        publicationMode: edgePublicationModeSchema.optional(),
        publicStatsVisible: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const sourceEdge = await getAccessibleEdgeById(
        ctx.session.user.id,
        input.edgeId
      );

      if (!sourceEdge) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Edge not found",
        });
      }

      const rootSourceEdge = await resolveRootSourceEdge(sourceEdge);
      const canonicalSourceEdge = rootSourceEdge ?? sourceEdge;
      const nextName = input.name?.trim() || `${sourceEdge.name} Copy`;
      const nextPublicationMode = input.publicationMode ?? "private";
      const nextPublicStatsVisible =
        input.publicStatsVisible ?? sourceEdge.publicStatsVisible ?? true;
      const approvedAffiliateProfile =
        nextPublicationMode === "library"
          ? await getApprovedAffiliateProfile(ctx.session.user.id)
          : null;

      if (sourceEdge.isDemoSeeded && nextPublicationMode === "library") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Demo workspace Edges cannot be published to the Library",
        });
      }

      const duplicatedEdge = await createUserForkedEdge({
        userId: ctx.session.user.id,
        baseName: nextName,
        description: sourceEdge.description,
        color: sourceEdge.color,
      });

      if (approvedAffiliateProfile && nextPublicationMode === "library") {
        await db
          .update(edge)
          .set({
            publicationMode: "private",
            isFeatured: false,
            featuredAt: null,
            featuredByUserId: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(edge.ownerUserId, ctx.session.user.id),
              eq(edge.publicationMode, "library"),
              not(eq(edge.id, duplicatedEdge.id))
            )
          );
      }

      await db
        .update(edge)
        .set({
          sourceEdgeId: canonicalSourceEdge.id,
          isDemoSeeded: sourceEdge.isDemoSeeded,
          publicationMode: nextPublicationMode,
          isFeatured: false,
          featuredAt: null,
          featuredByUserId: null,
          publicStatsVisible: nextPublicStatsVisible,
          coverImageUrl: sourceEdge.coverImageUrl ?? null,
          coverImagePosition: sourceEdge.coverImagePosition ?? 50,
          contentBlocks:
            (sourceEdge.contentBlocks as Record<string, unknown>[] | null) ?? [],
          contentHtml: sourceEdge.contentHtml ?? null,
          examplesBlocks:
            (sourceEdge.examplesBlocks as Record<string, unknown>[] | null) ?? [],
          examplesHtml: sourceEdge.examplesHtml ?? null,
          updatedAt: new Date(),
        })
        .where(eq(edge.id, duplicatedEdge.id));

      const sourceSections = await db
        .select()
        .from(edgeSection)
        .where(eq(edgeSection.edgeId, sourceEdge.id))
        .orderBy(asc(edgeSection.sortOrder), asc(edgeSection.title));
      const sourceRules = await db
        .select()
        .from(edgeRule)
        .where(eq(edgeRule.edgeId, sourceEdge.id))
        .orderBy(asc(edgeRule.sortOrder), asc(edgeRule.title));

      const sectionIdMap = new Map<string, string>();
      for (const currentSection of sourceSections) {
        const [createdSection] = await db
          .insert(edgeSection)
          .values({
            edgeId: duplicatedEdge.id,
            title: currentSection.title,
            description: currentSection.description,
            sortOrder: currentSection.sortOrder,
          })
          .returning();

        sectionIdMap.set(currentSection.id, createdSection.id);
      }

      if (sourceRules.length > 0) {
        await db.insert(edgeRule).values(
          sourceRules
            .map((currentRule) => {
              const nextSectionId = sectionIdMap.get(currentRule.sectionId);
              if (!nextSectionId) return null;
              return {
                edgeId: duplicatedEdge.id,
                sectionId: nextSectionId,
                title: currentRule.title,
                description: currentRule.description,
                sortOrder: currentRule.sortOrder,
                isActive: currentRule.isActive,
                appliesOutcomes:
                  (currentRule.appliesOutcomes as string[] | null | undefined) ??
                  ["all"],
              };
            })
            .filter(
              (
                currentRule
              ): currentRule is {
                edgeId: string;
                sectionId: string;
                title: string;
                description: string | null;
                sortOrder: number;
                isActive: boolean;
                appliesOutcomes: string[];
              } => Boolean(currentRule)
            )
        );
      }

      await ensureEdgeVersionBaseline({
        edgeId: duplicatedEdge.id,
        userId: ctx.session.user.id,
        changeType: "fork",
        changeSummary: `Forked from ${canonicalSourceEdge.name}`,
      });

      return duplicatedEdge;
    }),

  publish: protectedProcedure
    .input(
      z.object({
        edgeId: z.string().min(1),
        publicationMode: edgePublicationModeSchema,
        featured: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ownedEdge = await assertOwnedEdge(ctx.session.user.id, input.edgeId);

      const isPublishingToLibrary = input.publicationMode === "library";
      const wantsFeatured = isPublishingToLibrary && input.featured === true;

      if (ownedEdge.isDemoSeeded && isPublishingToLibrary) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Demo workspace Edges cannot be published to the Library",
        });
      }
      const approvedAffiliateProfile = isPublishingToLibrary
        ? await getApprovedAffiliateProfile(ctx.session.user.id)
        : null;
      if (wantsFeatured && !approvedAffiliateProfile) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only approved affiliates can publish Featured Edges",
        });
      }
      const now = new Date();

      // Approved affiliates can keep one public Edge live at a time.
      if (approvedAffiliateProfile && isPublishingToLibrary) {
        await db
          .update(edge)
          .set({
            publicationMode: "private",
            isFeatured: false,
            featuredAt: null,
            featuredByUserId: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(edge.ownerUserId, ctx.session.user.id),
              eq(edge.publicationMode, "library"),
              not(eq(edge.id, input.edgeId))
            )
          );
      }

      const [updatedEdge] = await db
        .update(edge)
        .set({
          publicationMode: input.publicationMode,
          isFeatured: wantsFeatured,
          featuredAt: wantsFeatured ? now : null,
          featuredByUserId:
            wantsFeatured ? ctx.session.user.id : null,
          updatedAt: now,
        })
        .where(eq(edge.id, input.edgeId))
        .returning();

      if (updatedEdge) {
        await recordEdgeVersion({
          edgeId: updatedEdge.id,
          userId: ctx.session.user.id,
          changeType: "publish",
          changeSummary:
            input.publicationMode === "library"
              ? wantsFeatured
                ? "Published as a featured edge"
                : "Published to the Library"
              : "Returned to private",
        });
      }

      return updatedEdge;
    }),

  archive: protectedProcedure
    .input(
      z.object({
        edgeId: z.string().min(1),
        archived: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnedEdge(ctx.session.user.id, input.edgeId);

      const [updatedEdge] = await db
        .update(edge)
        .set({
          status: input.archived ? "archived" : "active",
          updatedAt: new Date(),
        })
        .where(eq(edge.id, input.edgeId))
        .returning();

      return updatedEdge;
    }),

  share: protectedProcedure
    .input(
      z.object({
        edgeId: z.string().min(1),
        userId: z.string().min(1),
        role: edgeShareRoleSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ownedEdge = await assertOwnedEdge(ctx.session.user.id, input.edgeId);

      if (ownedEdge.isDemoSeeded) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Demo workspace Edges cannot be shared",
        });
      }

      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You already own this Edge",
        });
      }

      const [ownerRow, existingShare] = await Promise.all([
        db
          .select({
            name: userTable.name,
            displayName: userTable.displayName,
            username: userTable.username,
          })
          .from(userTable)
          .where(eq(userTable.id, ctx.session.user.id))
          .limit(1)
          .then((rows) => rows[0] ?? null),
        db
          .select({
            role: edgeShareMember.role,
          })
          .from(edgeShareMember)
          .where(
            and(
              eq(edgeShareMember.edgeId, input.edgeId),
              eq(edgeShareMember.userId, input.userId)
            )
          )
          .limit(1)
          .then((rows) => rows[0] ?? null),
      ]);

      const [sharedMember] = await db
        .insert(edgeShareMember)
        .values({
          edgeId: input.edgeId,
          userId: input.userId,
          invitedByUserId: ctx.session.user.id,
          role: input.role,
        })
        .onConflictDoUpdate({
          target: [edgeShareMember.edgeId, edgeShareMember.userId],
          set: {
            role: input.role,
            invitedByUserId: ctx.session.user.id,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (!existingShare || existingShare.role !== input.role) {
        const inviterLabel =
          ownerRow?.displayName?.trim() ||
          ownerRow?.name?.trim() ||
          ownerRow?.username?.trim() ||
          "A trader";
        const roleLabel = input.role === "editor" ? "Editor" : "Viewer";

        await createNotification({
          userId: input.userId,
          type: "edge_invite",
          title: !existingShare
            ? `${inviterLabel} shared an Edge with you`
            : `${inviterLabel} updated your Edge access`,
          body: !existingShare
            ? `You were invited to "${ownedEdge.name}" as a ${roleLabel}.`
            : `Your access to "${ownedEdge.name}" is now ${roleLabel}.`,
          metadata: {
            edgeId: input.edgeId,
            inviterUserId: ctx.session.user.id,
            inviterName: inviterLabel,
            role: input.role,
            url: `/dashboard/edges/${input.edgeId}`,
          },
          dedupeKey: `edge-invite:${input.edgeId}:${input.userId}:${input.role}`,
        });
      }

      return sharedMember;
    }),

  unshare: protectedProcedure
    .input(
      z.object({
        edgeId: z.string().min(1),
        userId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ownedEdge = await assertOwnedEdge(ctx.session.user.id, input.edgeId);

      if (ownedEdge.isDemoSeeded) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Demo workspace Edges cannot be shared",
        });
      }

      await db
        .delete(edgeShareMember)
        .where(
          and(
            eq(edgeShareMember.edgeId, input.edgeId),
            eq(edgeShareMember.userId, input.userId)
          )
        );

      return {
        edgeId: input.edgeId,
        userId: input.userId,
      };
    }),

  upsertSection: protectedProcedure
    .input(
      z.object({
        edgeId: z.string().min(1),
        sectionId: z.string().min(1).optional(),
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().max(4000).nullable().optional(),
        sortOrder: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ownedEdge = await assertOwnedEdge(ctx.session.user.id, input.edgeId);

      if (input.sectionId) {
        const [existingSection] = await db
          .select({
            title: edgeSection.title,
            description: edgeSection.description,
            sortOrder: edgeSection.sortOrder,
          })
          .from(edgeSection)
          .where(
            and(
              eq(edgeSection.id, input.sectionId),
              eq(edgeSection.edgeId, input.edgeId)
            )
          )
          .limit(1);
        const [updatedSection] = await db
          .update(edgeSection)
          .set({
            title: input.title,
            description: input.description ?? null,
            ...(input.sortOrder !== undefined
              ? { sortOrder: input.sortOrder }
              : {}),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(edgeSection.id, input.sectionId),
              eq(edgeSection.edgeId, input.edgeId)
            )
          )
          .returning();

        if (
          updatedSection &&
          (existingSection?.title !== input.title ||
            (existingSection?.description ?? null) !==
              (input.description ?? null) ||
            existingSection?.sortOrder !==
              (input.sortOrder ?? existingSection?.sortOrder))
        ) {
          await recordEdgeVersion({
            edgeId: ownedEdge.id,
            userId: ctx.session.user.id,
            changeType: "section-update",
            changeSummary: `Updated section ${updatedSection.title}`,
          });
        }

        return updatedSection;
      }

      const [createdSection] = await db
        .insert(edgeSection)
        .values({
          edgeId: input.edgeId,
          title: input.title,
          description: input.description ?? null,
          sortOrder: input.sortOrder ?? 0,
        })
        .returning();

      await recordEdgeVersion({
        edgeId: ownedEdge.id,
        userId: ctx.session.user.id,
        changeType: "section-create",
        changeSummary: `Added section ${createdSection.title}`,
      });

      return createdSection;
    }),

  deleteSection: protectedProcedure
    .input(
      z.object({
        edgeId: z.string().min(1),
        sectionId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ownedEdge = await assertOwnedEdge(ctx.session.user.id, input.edgeId);

      const [existingSection] = await db
        .select({
          title: edgeSection.title,
        })
        .from(edgeSection)
        .where(
          and(
            eq(edgeSection.id, input.sectionId),
            eq(edgeSection.edgeId, input.edgeId)
          )
        )
        .limit(1);

      await db
        .delete(edgeSection)
        .where(
          and(
            eq(edgeSection.id, input.sectionId),
            eq(edgeSection.edgeId, input.edgeId)
          )
        );

      await recordEdgeVersion({
        edgeId: ownedEdge.id,
        userId: ctx.session.user.id,
        changeType: "section-delete",
        changeSummary: existingSection?.title
          ? `Removed section ${existingSection.title}`
          : "Removed section",
      });

      return { success: true };
    }),

  upsertRule: protectedProcedure
    .input(
      z.object({
        edgeId: z.string().min(1),
        ruleId: z.string().min(1).optional(),
        sectionId: z.string().min(1),
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().max(4000).nullable().optional(),
        sortOrder: z.number().int().min(0).optional(),
        isActive: z.boolean().optional(),
        appliesOutcomes: z.array(edgeRuleOutcomeSchema).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ownedEdge = await assertOwnedEdge(ctx.session.user.id, input.edgeId);

      if (input.ruleId) {
        const [existingRule] = await db
          .select({
            sectionId: edgeRule.sectionId,
            title: edgeRule.title,
            description: edgeRule.description,
            sortOrder: edgeRule.sortOrder,
            isActive: edgeRule.isActive,
            appliesOutcomes: edgeRule.appliesOutcomes,
          })
          .from(edgeRule)
          .where(and(eq(edgeRule.id, input.ruleId), eq(edgeRule.edgeId, input.edgeId)))
          .limit(1);
        const [updatedRule] = await db
          .update(edgeRule)
          .set({
            sectionId: input.sectionId,
            title: input.title,
            description: input.description ?? null,
            ...(input.sortOrder !== undefined
              ? { sortOrder: input.sortOrder }
              : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            appliesOutcomes: input.appliesOutcomes,
            updatedAt: new Date(),
          })
          .where(
            and(eq(edgeRule.id, input.ruleId), eq(edgeRule.edgeId, input.edgeId))
          )
          .returning();

        const existingAppliesOutcomes =
          (existingRule?.appliesOutcomes as string[] | null | undefined) ?? ["all"];
        const onlySortOrderChanged =
          updatedRule != null &&
          existingRule != null &&
          existingRule.sectionId === input.sectionId &&
          existingRule.title === input.title &&
          (existingRule.description ?? null) === (input.description ?? null) &&
          existingRule.isActive === (input.isActive ?? existingRule.isActive) &&
          JSON.stringify(existingAppliesOutcomes) ===
            JSON.stringify(input.appliesOutcomes) &&
          existingRule.sortOrder !== (input.sortOrder ?? existingRule.sortOrder);

        if (updatedRule && !onlySortOrderChanged) {
          await recordEdgeVersion({
            edgeId: ownedEdge.id,
            userId: ctx.session.user.id,
            changeType: "rule-update",
            changeSummary: `Updated rule ${updatedRule.title}`,
          });
        }

        return updatedRule;
      }

      const [createdRule] = await db
        .insert(edgeRule)
        .values({
          edgeId: input.edgeId,
          sectionId: input.sectionId,
          title: input.title,
          description: input.description ?? null,
          sortOrder: input.sortOrder ?? 0,
          isActive: input.isActive ?? true,
          appliesOutcomes: input.appliesOutcomes,
        })
        .returning();

      await recordEdgeVersion({
        edgeId: ownedEdge.id,
        userId: ctx.session.user.id,
        changeType: "rule-create",
        changeSummary: `Added rule ${createdRule.title}`,
      });

      return createdRule;
    }),

  deleteRule: protectedProcedure
    .input(
      z.object({
        edgeId: z.string().min(1),
        ruleId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ownedEdge = await assertOwnedEdge(ctx.session.user.id, input.edgeId);

      const [existingRule] = await db
        .select({
          title: edgeRule.title,
        })
        .from(edgeRule)
        .where(and(eq(edgeRule.id, input.ruleId), eq(edgeRule.edgeId, input.edgeId)))
        .limit(1);

      await db
        .delete(edgeRule)
        .where(and(eq(edgeRule.id, input.ruleId), eq(edgeRule.edgeId, input.edgeId)));

      await recordEdgeVersion({
        edgeId: ownedEdge.id,
        userId: ctx.session.user.id,
        changeType: "rule-delete",
        changeSummary: existingRule?.title
          ? `Removed rule ${existingRule.title}`
          : "Removed rule",
      });

      return { success: true };
    }),

  applicableRulesForTrade: protectedProcedure
    .input(
      z.object({
        edgeId: z.string().min(1),
        tradeId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      const accessibleEdge = await getAccessibleEdgeById(
        ctx.session.user.id,
        input.edgeId
      );
      if (!accessibleEdge) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Edge not found",
        });
      }

      const ownedTrade = await ensureTradeOwnership(ctx.session.user.id, input.tradeId);
      const [selectedTrade] = await db
        .select({
          id: trade.id,
          outcome: trade.outcome,
          closeTime: trade.closeTime,
        })
        .from(trade)
        .where(eq(trade.id, ownedTrade.id))
        .limit(1);

      if (!selectedTrade) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Trade not found",
        });
      }

      const applicableOutcome = getTradeOutcomeEdgeBucket(selectedTrade.outcome);
      const sections = await db
        .select()
        .from(edgeSection)
        .where(eq(edgeSection.edgeId, input.edgeId))
        .orderBy(asc(edgeSection.sortOrder), asc(edgeSection.title));
      const rules = await db
        .select()
        .from(edgeRule)
        .where(eq(edgeRule.edgeId, input.edgeId))
        .orderBy(asc(edgeRule.sortOrder), asc(edgeRule.title));
      const evaluations = await db
        .select({
          ruleId: tradeEdgeRuleEvaluation.ruleId,
          status: tradeEdgeRuleEvaluation.status,
        })
        .from(tradeEdgeRuleEvaluation)
        .where(eq(tradeEdgeRuleEvaluation.tradeId, input.tradeId));
      const evaluationByRuleId = new Map(
        evaluations.map((evaluation) => [evaluation.ruleId, evaluation.status])
      );

      return sections.map((section) => ({
        ...section,
        rules: rules
          .filter((currentRule) => currentRule.sectionId === section.id)
          .filter((currentRule) => {
            const outcomes =
              (currentRule.appliesOutcomes as string[] | null | undefined) ??
              ["all"];
            if (!selectedTrade.closeTime) {
              return outcomes.includes("all");
            }
            return (
              outcomes.includes("all") ||
              (applicableOutcome ? outcomes.includes(applicableOutcome) : false)
            );
          })
          .map((currentRule) => ({
            ...currentRule,
            currentStatus:
              (evaluationByRuleId.get(currentRule.id) as string | undefined) ??
              "not_reviewed",
          })),
      }));
    }),

  assignTrade: protectedProcedure
    .input(
      z.object({
        tradeId: z.string().min(1),
        edgeId: z.string().nullable(),
        ruleEvaluations: z
          .array(
            z.object({
              ruleId: z.string().min(1),
              status: edgeRuleEvaluationStatusSchema,
            })
          )
          .optional()
          .default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ownedTrade = await ensureTradeOwnership(ctx.session.user.id, input.tradeId);
      const assignedEdge = await assignEdgeToTrade({
        tradeId: input.tradeId,
        userId: ctx.session.user.id,
        edgeId: input.edgeId,
      });

      await setTradeEdgeRuleEvaluations({
        tradeId: input.tradeId,
        edgeId: assignedEdge?.id ?? null,
        evaluations: input.ruleEvaluations,
      });

      await invalidateTradeScopeCaches([ownedTrade.accountId]);

      return {
        edge: assignedEdge,
        legacy: applyEdgeLegacyProjection(assignedEdge),
      };
    }),

  bulkAssignTrades: protectedProcedure
    .input(
      z.object({
        tradeIds: z.array(z.string().min(1)).min(1),
        edgeId: z.string().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { accountIds } = await ensureTradeBatchOwnership(
        ctx.session.user.id,
        input.tradeIds
      );

      if (!input.edgeId) {
        await bulkAssignLegacyModelTagToTrades({
          tradeIds: input.tradeIds,
          userId: ctx.session.user.id,
          modelTag: null,
        });
      } else {
        const accessibleEdge = await getAccessibleEdgeById(
          ctx.session.user.id,
          input.edgeId
        );
        if (!accessibleEdge) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Edge not found",
          });
        }

        await bulkAssignLegacyModelTagToTrades({
          tradeIds: input.tradeIds,
          userId: ctx.session.user.id,
          modelTag: accessibleEdge.name,
          modelTagColor: accessibleEdge.color,
        });
      }

      await invalidateTradeScopeCaches(accountIds);

      return { success: true, updatedCount: input.tradeIds.length };
    }),

  createMissedTrade: protectedProcedure
    .input(
      z.object({
        edgeId: z.string().min(1),
        accountId: z.string().nullable().optional(),
        symbol: z.string().trim().min(1).max(64),
        tradeType: z.enum(["long", "short"]).nullable().optional(),
        volume: z.number().positive().nullable().optional(),
        openPrice: z.number().positive().nullable().optional(),
        closePrice: z.number().positive().nullable().optional(),
        sessionTag: z.string().trim().max(120).nullable().optional(),
        modelTag: z.string().trim().max(80).nullable().optional(),
        customTags: z.array(z.string().trim().min(1)).max(50).optional(),
        setupTime: z.string().nullable().optional(),
        closeTime: z.string().nullable().optional(),
        sl: z.number().positive().nullable().optional(),
        tp: z.number().positive().nullable().optional(),
        reasonMissed: z.string().trim().max(4000).nullable().optional(),
        notes: z.string().trim().max(12000).nullable().optional(),
        estimatedOutcome: z.string().trim().max(50).nullable().optional(),
        estimatedProfit: z.number().finite().nullable().optional(),
        estimatedRR: z.number().finite().nullable().optional(),
        estimatedPnl: z.number().finite().nullable().optional(),
        commissions: z.number().finite().nullable().optional(),
        swap: z.number().finite().nullable().optional(),
        mediaUrls: z.array(z.string().url()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnedEdge(ctx.session.user.id, input.edgeId);
      const ownedAccountId = await resolveOwnedAccountId(
        ctx.session.user.id,
        input.accountId
      );
      const normalizedSymbol = input.symbol.trim().toUpperCase();
      const setupTime = resolveMissedTradeTimestamp(input.setupTime, "Open time");
      const closeTime = resolveMissedTradeTimestamp(
        input.closeTime,
        "Close time"
      );

      if (setupTime && closeTime && closeTime <= setupTime) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Close time must be after open time",
        });
      }

      const derived = deriveMissedTradeMetrics({
        symbol: normalizedSymbol,
        tradeType: input.tradeType ?? null,
        volume: input.volume ?? null,
        openPrice: input.openPrice ?? null,
        closePrice: input.closePrice ?? null,
        sl: input.sl ?? null,
        tp: input.tp ?? null,
        estimatedProfit: input.estimatedProfit ?? null,
        estimatedRR: input.estimatedRR ?? null,
        estimatedPnl: input.estimatedPnl ?? null,
        commissions: input.commissions ?? null,
        swap: input.swap ?? null,
      });

      const [createdMissedTrade] = await db
        .insert(edgeMissedTrade)
        .values({
          edgeId: input.edgeId,
          userId: ctx.session.user.id,
          accountId: ownedAccountId,
          symbol: normalizedSymbol,
          tradeType: input.tradeType ?? null,
          volume: input.volume != null ? input.volume.toString() : null,
          openPrice: input.openPrice != null ? input.openPrice.toString() : null,
          closePrice:
            derived.closePrice != null ? derived.closePrice.toString() : null,
          sessionTag: input.sessionTag ?? null,
          modelTag: input.modelTag ?? null,
          customTags: normalizeTradeTags(input.customTags),
          setupTime: setupTime ?? null,
          closeTime: closeTime ?? null,
          sl: input.sl != null ? input.sl.toString() : null,
          tp: input.tp != null ? input.tp.toString() : null,
          reasonMissed: input.reasonMissed ?? null,
          notes: input.notes ?? null,
          estimatedOutcome: input.estimatedOutcome ?? null,
          estimatedProfit:
            derived.estimatedProfit != null
              ? derived.estimatedProfit.toString()
              : null,
          estimatedRR:
            derived.estimatedRR != null ? derived.estimatedRR.toString() : null,
          estimatedPnl:
            derived.estimatedPnl != null
              ? derived.estimatedPnl.toString()
              : null,
          commissions:
            input.commissions != null ? input.commissions.toString() : null,
          swap: input.swap != null ? input.swap.toString() : null,
          mediaUrls: input.mediaUrls ?? [],
        })
        .returning();

      return createdMissedTrade;
    }),

  updateMissedTrade: protectedProcedure
    .input(
      z.object({
        missedTradeId: z.string().min(1),
        edgeId: z.string().min(1),
        accountId: z.string().nullable().optional(),
        symbol: z.string().trim().min(1).max(64).optional(),
        tradeType: z.enum(["long", "short"]).nullable().optional(),
        volume: z.number().positive().nullable().optional(),
        openPrice: z.number().positive().nullable().optional(),
        closePrice: z.number().positive().nullable().optional(),
        sessionTag: z.string().trim().max(120).nullable().optional(),
        modelTag: z.string().trim().max(80).nullable().optional(),
        customTags: z.array(z.string().trim().min(1)).max(50).optional(),
        setupTime: z.string().nullable().optional(),
        closeTime: z.string().nullable().optional(),
        sl: z.number().positive().nullable().optional(),
        tp: z.number().positive().nullable().optional(),
        reasonMissed: z.string().trim().max(4000).nullable().optional(),
        notes: z.string().trim().max(12000).nullable().optional(),
        estimatedOutcome: z.string().trim().max(50).nullable().optional(),
        estimatedProfit: z.number().finite().nullable().optional(),
        estimatedRR: z.number().finite().nullable().optional(),
        estimatedPnl: z.number().finite().nullable().optional(),
        commissions: z.number().finite().nullable().optional(),
        swap: z.number().finite().nullable().optional(),
        mediaUrls: z.array(z.string().url()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnedEdge(ctx.session.user.id, input.edgeId);
      const ownedAccountId =
        input.accountId !== undefined
          ? await resolveOwnedAccountId(ctx.session.user.id, input.accountId)
          : undefined;
      const [existingMissedTrade] = await db
        .select()
        .from(edgeMissedTrade)
        .where(
          and(
            eq(edgeMissedTrade.id, input.missedTradeId),
            eq(edgeMissedTrade.edgeId, input.edgeId),
            eq(edgeMissedTrade.userId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!existingMissedTrade) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Missed trade not found",
        });
      }

      const nextSymbol =
        input.symbol !== undefined
          ? input.symbol.trim().toUpperCase()
          : existingMissedTrade.symbol;
      const nextSetupTime =
        input.setupTime !== undefined
          ? resolveMissedTradeTimestamp(input.setupTime, "Open time")
          : existingMissedTrade.setupTime;
      const nextCloseTime =
        input.closeTime !== undefined
          ? resolveMissedTradeTimestamp(input.closeTime, "Close time")
          : existingMissedTrade.closeTime;

      if (nextSetupTime && nextCloseTime && nextCloseTime <= nextSetupTime) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Close time must be after open time",
        });
      }

      const derived = deriveMissedTradeMetrics({
        symbol: nextSymbol,
        tradeType:
          input.tradeType !== undefined
            ? input.tradeType
            : existingMissedTrade.tradeType,
        volume:
          input.volume !== undefined
            ? input.volume
            : parseStoredNullableNumber(existingMissedTrade.volume),
        openPrice:
          input.openPrice !== undefined
            ? input.openPrice
            : parseStoredNullableNumber(existingMissedTrade.openPrice),
        closePrice:
          input.closePrice !== undefined
            ? input.closePrice
            : parseStoredNullableNumber(existingMissedTrade.closePrice),
        sl:
          input.sl !== undefined
            ? input.sl
            : parseStoredNullableNumber(existingMissedTrade.sl),
        tp:
          input.tp !== undefined
            ? input.tp
            : parseStoredNullableNumber(existingMissedTrade.tp),
        estimatedProfit:
          input.estimatedProfit !== undefined
            ? input.estimatedProfit
            : parseStoredNullableNumber(existingMissedTrade.estimatedProfit),
        estimatedRR:
          input.estimatedRR !== undefined
            ? input.estimatedRR
            : parseStoredNullableNumber(existingMissedTrade.estimatedRR),
        estimatedPnl:
          input.estimatedPnl !== undefined
            ? input.estimatedPnl
            : parseStoredNullableNumber(existingMissedTrade.estimatedPnl),
        commissions:
          input.commissions !== undefined
            ? input.commissions
            : parseStoredNullableNumber(existingMissedTrade.commissions),
        swap:
          input.swap !== undefined
            ? input.swap
            : parseStoredNullableNumber(existingMissedTrade.swap),
      });

      const [updatedMissedTrade] = await db
        .update(edgeMissedTrade)
        .set({
          ...(ownedAccountId !== undefined ? { accountId: ownedAccountId } : {}),
          ...(input.symbol !== undefined ? { symbol: nextSymbol } : {}),
          ...(input.tradeType !== undefined ? { tradeType: input.tradeType } : {}),
          ...(input.volume !== undefined
            ? { volume: input.volume != null ? input.volume.toString() : null }
            : {}),
          ...(input.openPrice !== undefined
            ? {
                openPrice:
                  input.openPrice != null ? input.openPrice.toString() : null,
              }
            : {}),
          closePrice:
            derived.closePrice != null ? derived.closePrice.toString() : null,
          ...(input.sessionTag !== undefined
            ? { sessionTag: input.sessionTag }
            : {}),
          ...(input.modelTag !== undefined ? { modelTag: input.modelTag } : {}),
          ...(input.customTags !== undefined
            ? { customTags: normalizeTradeTags(input.customTags) }
            : {}),
          ...(input.setupTime !== undefined
            ? { setupTime: nextSetupTime }
            : {}),
          ...(input.closeTime !== undefined ? { closeTime: nextCloseTime } : {}),
          ...(input.sl !== undefined
            ? { sl: input.sl != null ? input.sl.toString() : null }
            : {}),
          ...(input.tp !== undefined
            ? { tp: input.tp != null ? input.tp.toString() : null }
            : {}),
          ...(input.reasonMissed !== undefined
            ? { reasonMissed: input.reasonMissed }
            : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.estimatedOutcome !== undefined
            ? { estimatedOutcome: input.estimatedOutcome }
            : {}),
          estimatedProfit:
            derived.estimatedProfit != null
              ? derived.estimatedProfit.toString()
              : null,
          estimatedRR:
            derived.estimatedRR != null ? derived.estimatedRR.toString() : null,
          estimatedPnl:
            derived.estimatedPnl != null
              ? derived.estimatedPnl.toString()
              : null,
          ...(input.commissions !== undefined
            ? {
                commissions:
                  input.commissions != null
                    ? input.commissions.toString()
                    : null,
              }
            : {}),
          ...(input.swap !== undefined
            ? { swap: input.swap != null ? input.swap.toString() : null }
            : {}),
          ...(input.mediaUrls !== undefined ? { mediaUrls: input.mediaUrls } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(edgeMissedTrade.id, input.missedTradeId),
            eq(edgeMissedTrade.edgeId, input.edgeId),
            eq(edgeMissedTrade.userId, ctx.session.user.id)
          )
        )
        .returning();

      return updatedMissedTrade;
    }),

  deleteMissedTrade: protectedProcedure
    .input(
      z.object({
        edgeId: z.string().min(1),
        missedTradeId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnedEdge(ctx.session.user.id, input.edgeId);

      await db
        .delete(edgeMissedTrade)
        .where(
          and(
            eq(edgeMissedTrade.id, input.missedTradeId),
            eq(edgeMissedTrade.edgeId, input.edgeId),
            eq(edgeMissedTrade.userId, ctx.session.user.id)
          )
        );

      return { success: true };
    }),
});
