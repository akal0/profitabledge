import { createHash } from "crypto";

import { edge } from "../../db/schema/trading";
import {
  CacheTTL,
  cacheNamespaces,
  enhancedCache,
} from "../enhanced-cache";

export type EdgeTradeMetricRow = {
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

export type EdgeRuleEvaluationRow = {
  ruleId: string;
  status: string;
  tradeId: string;
  profit: number | null;
  outcome: string | null;
};

export function isPositiveTradeOutcome(outcome: string | null | undefined) {
  return outcome === "Win" || outcome === "PW";
}

export function coerceNumeric(value: unknown) {
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

export function collectTopLabels(
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

export function calculateReviewMetrics(evaluations: EdgeRuleEvaluationRow[]) {
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

export function calculateEdgeMetrics(args: {
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
    (currentTrade) => coerceNumeric(currentTrade.realisedRR) != null
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

export function describeEdgePublication(edgeRow: typeof edge.$inferSelect) {
  if (edgeRow.isFeatured) {
    return "Featured edge";
  }

  if (edgeRow.publicationMode === "library") {
    return "Library edge";
  }

  return "Private edge";
}

export function buildEdgePassport(args: {
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

export function buildEdgeReadiness(args: {
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
      ? clamp((Math.min(metrics.expectancy, 2) / 2) * 15)
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

export function buildEdgeSummaryPassport(args: {
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

export function buildEdgeAccountFit(args: {
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

type EdgeSourceSummary = {
  id: string;
  name: string;
  ownerName: string | null;
  ownerUsername: string | null;
} | null;

type EdgeSnapshotAccounts = Parameters<typeof buildEdgeAccountFit>[0]["accounts"];
type EdgeSnapshotMissedTrades = Parameters<typeof calculateEdgeMetrics>[0]["missedTrades"];

type EdgeDerivedSnapshotArgs = {
  edgeRow: typeof edge.$inferSelect;
  trades: EdgeTradeMetricRow[];
  evaluations: EdgeRuleEvaluationRow[];
  missedTrades: EdgeSnapshotMissedTrades;
  shareCount: number;
  copyCount: number;
  versionCount: number;
  source: EdgeSourceSummary;
  accounts?: EdgeSnapshotAccounts;
};

type EdgeDerivedSnapshot = {
  metrics: ReturnType<typeof calculateEdgeMetrics>;
  readiness: ReturnType<typeof buildEdgeReadiness>;
  summaryPassport: ReturnType<typeof buildEdgeSummaryPassport>;
  passport: ReturnType<typeof buildEdgePassport>;
  accountFit: ReturnType<typeof buildEdgeAccountFit>;
};

function buildEdgeDerivedSnapshotFingerprint(args: EdgeDerivedSnapshotArgs) {
  const payload = {
    edge: {
      id: args.edgeRow.id,
      updatedAt: args.edgeRow.updatedAt?.toISOString() ?? null,
      description: args.edgeRow.description ?? null,
      publicationMode: args.edgeRow.publicationMode,
      isFeatured: args.edgeRow.isFeatured,
      sourceEdgeId: args.edgeRow.sourceEdgeId,
      contentHtml: args.edgeRow.contentHtml ?? null,
      examplesHtml: args.edgeRow.examplesHtml ?? null,
      status: args.edgeRow.status,
    },
    trades: args.trades.map((tradeRow) => [
      tradeRow.id,
      tradeRow.accountId,
      tradeRow.broker,
      tradeRow.verificationLevel,
      tradeRow.isPropAccount,
      tradeRow.symbol,
      tradeRow.tradeType,
      tradeRow.profit,
      tradeRow.outcome,
      tradeRow.sessionTag,
      tradeRow.openTime?.toISOString() ?? null,
      tradeRow.closeTime?.toISOString() ?? null,
      tradeRow.realisedRR,
    ]),
    evaluations: args.evaluations.map((evaluation) => [
      evaluation.ruleId,
      evaluation.status,
      evaluation.tradeId,
      evaluation.profit,
      evaluation.outcome,
    ]),
    missedTrades: args.missedTrades.map((tradeRow) => [tradeRow.estimatedPnl]),
    shareCount: args.shareCount,
    copyCount: args.copyCount,
    versionCount: args.versionCount,
    source: args.source
      ? [
          args.source.id,
          args.source.name,
          args.source.ownerName,
          args.source.ownerUsername,
        ]
      : null,
    accounts:
      args.accounts?.map((account) => [
        account.id,
        account.name,
        account.broker,
        account.isPropAccount,
        account.verificationLevel,
        account.lastSyncedAt?.toISOString() ?? null,
        account.createdAt.toISOString(),
      ]) ?? null,
  };

  return createHash("sha1").update(JSON.stringify(payload)).digest("hex");
}

export async function getCachedEdgeDerivedSnapshot(
  args: EdgeDerivedSnapshotArgs
): Promise<EdgeDerivedSnapshot> {
  const fingerprint = buildEdgeDerivedSnapshotFingerprint(args);
  const cacheKey = `${cacheNamespaces.ANALYTICS}:edge:snapshot:${args.edgeRow.id}:${fingerprint}`;

  return enhancedCache.getOrLoad(
    cacheKey,
    async () => {
      const metrics = calculateEdgeMetrics({
        trades: args.trades,
        evaluations: args.evaluations,
        missedTrades: args.missedTrades,
        shareCount: args.shareCount,
        copyCount: args.copyCount,
      });
      const readiness = buildEdgeReadiness({
        edgeRow: args.edgeRow,
        metrics,
        trades: args.trades,
        versionCount: args.versionCount,
      });
      const passport = buildEdgePassport({
        edgeRow: args.edgeRow,
        metrics,
        trades: args.trades,
        source: args.source,
      });

      return {
        metrics,
        readiness,
        summaryPassport: buildEdgeSummaryPassport({
          edgeRow: args.edgeRow,
          metrics,
          readiness,
        }),
        passport,
        accountFit: args.accounts
          ? buildEdgeAccountFit({
              accounts: args.accounts,
              trades: args.trades,
            })
          : null,
      };
    },
    {
      ttl: CacheTTL.SHORT,
      namespace: cacheNamespaces.ANALYTICS,
      tags: [
        `edge:${args.edgeRow.id}`,
        cacheNamespaces.TRADES,
        ...(args.accounts ?? []).map((account) => `account:${account.id}`),
      ],
    }
  );
}
