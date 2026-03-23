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
  trade,
  tradeEdgeAssignment,
  tradeEdgeRuleEvaluation,
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
import { getApprovedAffiliateProfile } from "../lib/billing/growth";
import { backfillUserEdgesFromLegacy } from "../lib/edges/compatibility";
import { createNotification } from "../lib/notifications";
import { protectedProcedure, router } from "../lib/trpc";
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

async function getEdgeTradeRows(edgeIds: string[]) {
  if (edgeIds.length === 0) {
    return [] as Array<EdgeTradeMetricRow & { edgeId: string }>;
  }

  const rows = await db
    .select({
      edgeId: tradeEdgeAssignment.edgeId,
      id: trade.id,
      accountId: trade.accountId,
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

async function buildEdgeSummaries(edgeRows: Array<typeof edge.$inferSelect>) {
  const edgeIds = edgeRows.map((currentEdge) => currentEdge.id);
  const ownerUserIds = Array.from(
    new Set(edgeRows.map((currentEdge) => currentEdge.ownerUserId))
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

  return edgeRows.map((currentEdge) => {
    const metrics = calculateEdgeMetrics({
      trades: tradeRows.filter((row) => row.edgeId === currentEdge.id),
      evaluations: evaluationRows.filter((row) => row.edgeId === currentEdge.id),
      missedTrades: missedTradeRows.filter(
        (row) => row.edgeId === currentEdge.id
      ),
      shareCount: shareCounts.get(currentEdge.id) ?? 0,
      copyCount: copyCounts.get(currentEdge.id) ?? 0,
    });

    return {
      ...currentEdge,
      owner: ownerProfiles.get(currentEdge.ownerUserId) ?? null,
      metrics,
      legacy: applyEdgeLegacyProjection(currentEdge),
    };
  });
}

function applyPublicSummaryStatsVisibility<
  TSummary extends {
    publicationMode?: string | null;
    isFeatured?: boolean | null;
    publicStatsVisible?: boolean | null;
    metrics?: unknown;
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

      return buildEdgeSummaries(rows);
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
        library: (await buildEdgeSummaries(libraryRows)).map(
          applyPublicSummaryStatsVisibility
        ),
        sharedWithMe: await buildEdgeSummaries(sharedRows),
        featured: await buildEdgeSummaries(featuredRows),
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

      const summaries = await buildEdgeSummaries([accessibleEdge]);
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
        sectionRows,
        ruleRows,
        tradeRows,
        evaluationRows,
        missedTrades,
        entryRows,
        shareMemberRows,
        approvedAffiliateProfile,
      ] =
        await Promise.all([
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
              symbol: edgeMissedTrade.symbol,
              tradeType: edgeMissedTrade.tradeType,
              sessionTag: edgeMissedTrade.sessionTag,
              setupTime: edgeMissedTrade.setupTime,
              reasonMissed: edgeMissedTrade.reasonMissed,
              notes: edgeMissedTrade.notes,
              estimatedOutcome: edgeMissedTrade.estimatedOutcome,
              estimatedRR: sql<number | null>`CAST(${edgeMissedTrade.estimatedRR} AS NUMERIC)`,
              estimatedPnl: sql<number | null>`CAST(${edgeMissedTrade.estimatedPnl} AS NUMERIC)`,
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

      return {
        edge: {
          ...summary,
          metrics: viewerCanSeeStats ? summary.metrics : null,
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

      return updatedEdge;
    }),

  duplicate: protectedProcedure
    .input(
      z.object({
        edgeId: z.string().min(1),
        name: z.string().trim().min(1).max(120).optional(),
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

      const nextName = input.name?.trim() || `${sourceEdge.name} Copy`;
      const duplicatedEdge = await ensureUserOwnedEdge({
        userId: ctx.session.user.id,
        name: nextName,
        description: sourceEdge.description,
        color: sourceEdge.color,
      });

      await db
        .update(edge)
        .set({
          sourceEdgeId: sourceEdge.id,
          isDemoSeeded: sourceEdge.isDemoSeeded,
          publicStatsVisible: sourceEdge.publicStatsVisible ?? true,
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
      await assertOwnedEdge(ctx.session.user.id, input.edgeId);

      if (input.sectionId) {
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
      await assertOwnedEdge(ctx.session.user.id, input.edgeId);

      await db
        .delete(edgeSection)
        .where(
          and(
            eq(edgeSection.id, input.sectionId),
            eq(edgeSection.edgeId, input.edgeId)
          )
        );

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
      await assertOwnedEdge(ctx.session.user.id, input.edgeId);

      if (input.ruleId) {
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
      await assertOwnedEdge(ctx.session.user.id, input.edgeId);

      await db
        .delete(edgeRule)
        .where(and(eq(edgeRule.id, input.ruleId), eq(edgeRule.edgeId, input.edgeId)));

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
        sessionTag: z.string().trim().max(120).nullable().optional(),
        setupTime: z.string().nullable().optional(),
        reasonMissed: z.string().trim().max(4000).nullable().optional(),
        notes: z.string().trim().max(12000).nullable().optional(),
        estimatedOutcome: z.string().trim().max(50).nullable().optional(),
        estimatedRR: z.number().finite().nullable().optional(),
        estimatedPnl: z.number().finite().nullable().optional(),
        mediaUrls: z.array(z.string().url()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnedEdge(ctx.session.user.id, input.edgeId);

      const [createdMissedTrade] = await db
        .insert(edgeMissedTrade)
        .values({
          edgeId: input.edgeId,
          userId: ctx.session.user.id,
          accountId: input.accountId ?? null,
          symbol: input.symbol.trim().toUpperCase(),
          tradeType: input.tradeType ?? null,
          sessionTag: input.sessionTag ?? null,
          setupTime: input.setupTime ? new Date(input.setupTime) : null,
          reasonMissed: input.reasonMissed ?? null,
          notes: input.notes ?? null,
          estimatedOutcome: input.estimatedOutcome ?? null,
          estimatedRR:
            input.estimatedRR != null ? input.estimatedRR.toString() : null,
          estimatedPnl:
            input.estimatedPnl != null ? input.estimatedPnl.toString() : null,
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
        symbol: z.string().trim().min(1).max(64).optional(),
        tradeType: z.enum(["long", "short"]).nullable().optional(),
        sessionTag: z.string().trim().max(120).nullable().optional(),
        setupTime: z.string().nullable().optional(),
        reasonMissed: z.string().trim().max(4000).nullable().optional(),
        notes: z.string().trim().max(12000).nullable().optional(),
        estimatedOutcome: z.string().trim().max(50).nullable().optional(),
        estimatedRR: z.number().finite().nullable().optional(),
        estimatedPnl: z.number().finite().nullable().optional(),
        mediaUrls: z.array(z.string().url()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnedEdge(ctx.session.user.id, input.edgeId);

      const [updatedMissedTrade] = await db
        .update(edgeMissedTrade)
        .set({
          ...(input.symbol !== undefined
            ? { symbol: input.symbol.trim().toUpperCase() }
            : {}),
          ...(input.tradeType !== undefined ? { tradeType: input.tradeType } : {}),
          ...(input.sessionTag !== undefined
            ? { sessionTag: input.sessionTag }
            : {}),
          ...(input.setupTime !== undefined
            ? { setupTime: input.setupTime ? new Date(input.setupTime) : null }
            : {}),
          ...(input.reasonMissed !== undefined
            ? { reasonMissed: input.reasonMissed }
            : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.estimatedOutcome !== undefined
            ? { estimatedOutcome: input.estimatedOutcome }
            : {}),
          ...(input.estimatedRR !== undefined
            ? {
                estimatedRR:
                  input.estimatedRR != null ? input.estimatedRR.toString() : null,
              }
            : {}),
          ...(input.estimatedPnl !== undefined
            ? {
                estimatedPnl:
                  input.estimatedPnl != null
                    ? input.estimatedPnl.toString()
                    : null,
              }
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
