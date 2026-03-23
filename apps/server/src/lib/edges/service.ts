import {
  and,
  asc,
  eq,
  inArray,
  or,
} from "drizzle-orm";

import { db } from "../../db";
import {
  edge,
  edgeRule,
  edgeShareMember,
  trade,
  tradeEdgeAssignment,
  tradeEdgeRuleEvaluation,
} from "../../db/schema/trading";

export const EDGE_PUBLICATION_MODES = ["private", "library"] as const;
export const EDGE_RULE_OUTCOMES = [
  "winner",
  "partial_win",
  "loser",
  "breakeven",
  "cut_trade",
  "all",
] as const;
export const EDGE_RULE_EVALUATION_STATUSES = [
  "followed",
  "broken",
  "not_reviewed",
  "not_applicable",
] as const;
export const EDGE_SHARE_ROLES = ["viewer", "editor"] as const;
export const EDGE_STATUSES = ["active", "archived"] as const;

export type EdgePublicationMode = (typeof EDGE_PUBLICATION_MODES)[number];
export type EdgeRuleOutcome = (typeof EDGE_RULE_OUTCOMES)[number];
export type EdgeRuleEvaluationStatus =
  (typeof EDGE_RULE_EVALUATION_STATUSES)[number];
export type EdgeShareRole = (typeof EDGE_SHARE_ROLES)[number];
export type EdgeStatus = (typeof EDGE_STATUSES)[number];

export type EdgeRow = typeof edge.$inferSelect;

const DEFAULT_EDGE_COLOR = "#3B82F6";

function collapseWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function formatEdgeName(value: string) {
  return collapseWhitespace(value);
}

export function normalizeEdgeName(value: string) {
  return collapseWhitespace(value).toLowerCase();
}

export function getTradeOutcomeEdgeBucket(
  outcome: string | null | undefined
): EdgeRuleOutcome | null {
  if (!outcome) return null;
  if (outcome === "Win") return "winner";
  if (outcome === "PW") return "partial_win";
  if (outcome === "BE") return "breakeven";
  if (outcome === "Loss") return "loser";
  return null;
}

export function applyEdgeLegacyProjection(edgeRow: EdgeRow | null) {
  return {
    modelTag: edgeRow?.name ?? null,
    modelTagColor: edgeRow?.color ?? null,
  };
}

export function applyBrokerMetaEdgeProjection(
  brokerMeta: Record<string, unknown> | null | undefined,
  edgeRow: Pick<EdgeRow, "id" | "name" | "color"> | null
) {
  const nextMeta = {
    ...((brokerMeta &&
      typeof brokerMeta === "object" &&
      !Array.isArray(brokerMeta)
      ? brokerMeta
      : {}) as Record<string, unknown>),
  };

  const keysToDelete = [
    "edgeId",
    "edgeName",
    "edgeColor",
    "manualEdgeId",
    "manualEdgeName",
    "manualEdgeColor",
    "modelTag",
    "manualModelTag",
  ] as const;

  for (const key of keysToDelete) {
    delete nextMeta[key];
  }

  if (!edgeRow) {
    return nextMeta;
  }

  nextMeta.edgeId = edgeRow.id;
  nextMeta.edgeName = edgeRow.name;
  nextMeta.edgeColor = edgeRow.color;
  nextMeta.manualEdgeId = edgeRow.id;
  nextMeta.manualEdgeName = edgeRow.name;
  nextMeta.manualEdgeColor = edgeRow.color;
  nextMeta.modelTag = edgeRow.name;
  nextMeta.manualModelTag = edgeRow.name;

  return nextMeta;
}

export function readBrokerMetaEdge(
  brokerMeta: Record<string, unknown> | null | undefined
) {
  const safeMeta =
    brokerMeta && typeof brokerMeta === "object" && !Array.isArray(brokerMeta)
      ? brokerMeta
      : null;

  if (!safeMeta) {
    return {
      edgeId: null,
      edgeName: null,
      edgeColor: null,
    };
  }

  return {
    edgeId:
      typeof safeMeta.manualEdgeId === "string"
        ? safeMeta.manualEdgeId
        : typeof safeMeta.edgeId === "string"
        ? safeMeta.edgeId
        : null,
    edgeName:
      typeof safeMeta.manualEdgeName === "string"
        ? safeMeta.manualEdgeName
        : typeof safeMeta.edgeName === "string"
        ? safeMeta.edgeName
        : typeof safeMeta.manualModelTag === "string"
        ? safeMeta.manualModelTag
        : typeof safeMeta.modelTag === "string"
        ? safeMeta.modelTag
        : null,
    edgeColor:
      typeof safeMeta.manualEdgeColor === "string"
        ? safeMeta.manualEdgeColor
        : typeof safeMeta.edgeColor === "string"
        ? safeMeta.edgeColor
        : null,
  };
}

export async function getAssignableEdgesForUser(userId: string) {
  const ownedEdges = await db
    .select({
      id: edge.id,
      name: edge.name,
      color: edge.color,
      status: edge.status,
      publicationMode: edge.publicationMode,
      publicStatsVisible: edge.publicStatsVisible,
      ownerUserId: edge.ownerUserId,
    })
    .from(edge)
    .where(eq(edge.ownerUserId, userId))
    .orderBy(asc(edge.name));

  const sharedEdges = await db
    .select({
      id: edge.id,
      name: edge.name,
      color: edge.color,
      status: edge.status,
      publicationMode: edge.publicationMode,
      publicStatsVisible: edge.publicStatsVisible,
      ownerUserId: edge.ownerUserId,
    })
    .from(edge)
    .innerJoin(edgeShareMember, eq(edgeShareMember.edgeId, edge.id))
    .where(eq(edgeShareMember.userId, userId))
    .orderBy(asc(edge.name));

  const deduped = new Map<string, (typeof ownedEdges)[number]>();
  for (const currentEdge of [...ownedEdges, ...sharedEdges]) {
    deduped.set(currentEdge.id, currentEdge);
  }

  return Array.from(deduped.values()).filter(
    (currentEdge) => currentEdge.status !== "archived"
  );
}

export async function getAccessibleEdgeById(userId: string, edgeId: string) {
  const [ownedEdge] = await db
    .select()
    .from(edge)
    .where(
      and(
        eq(edge.id, edgeId),
        or(
          eq(edge.ownerUserId, userId),
          eq(edge.publicationMode, "library")
        )
      )
    )
    .limit(1);

  if (ownedEdge) {
    return ownedEdge;
  }

  const [sharedEdge] = await db
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
    .from(edge)
    .innerJoin(edgeShareMember, eq(edgeShareMember.edgeId, edge.id))
    .where(
      and(eq(edge.id, edgeId), eq(edgeShareMember.userId, userId))
    )
    .limit(1);

  return sharedEdge ?? null;
}

export async function ensureUserOwnedEdge(input: {
  userId: string;
  name: string;
  color?: string | null;
  description?: string | null;
}) {
  const formattedName = formatEdgeName(input.name);
  const normalizedName = normalizeEdgeName(input.name);

  if (!formattedName) {
    throw new Error("Edge name is required");
  }

  const [existingEdge] = await db
    .select()
    .from(edge)
    .where(
      and(
        eq(edge.ownerUserId, input.userId),
        eq(edge.normalizedName, normalizedName)
      )
    )
    .limit(1);

  if (existingEdge) {
    if (
      (input.color && input.color !== existingEdge.color) ||
      formattedName !== existingEdge.name
    ) {
      const [updatedEdge] = await db
        .update(edge)
        .set({
          name: formattedName,
          color: input.color ?? existingEdge.color ?? DEFAULT_EDGE_COLOR,
          updatedAt: new Date(),
        })
        .where(eq(edge.id, existingEdge.id))
        .returning();

      return updatedEdge ?? existingEdge;
    }

    return existingEdge;
  }

  const [createdEdge] = await db
    .insert(edge)
    .values({
      ownerUserId: input.userId,
      name: formattedName,
      normalizedName,
      description: input.description ?? null,
      color: input.color ?? DEFAULT_EDGE_COLOR,
    })
    .returning();

  return createdEdge;
}

export async function assignEdgeToTrade(input: {
  tradeId: string;
  userId: string;
  edgeId: string | null;
}) {
  if (!input.edgeId) {
    await db
      .delete(tradeEdgeRuleEvaluation)
      .where(eq(tradeEdgeRuleEvaluation.tradeId, input.tradeId));
    await db
      .delete(tradeEdgeAssignment)
      .where(eq(tradeEdgeAssignment.tradeId, input.tradeId));
    await db
      .update(trade)
      .set({
        modelTag: null,
        modelTagColor: null,
      })
      .where(eq(trade.id, input.tradeId));

    return null;
  }

  const accessibleEdge = await getAccessibleEdgeById(input.userId, input.edgeId);
  if (!accessibleEdge) {
    throw new Error("Edge not found");
  }

  await db
    .delete(tradeEdgeRuleEvaluation)
    .where(eq(tradeEdgeRuleEvaluation.tradeId, input.tradeId));

  await db
    .insert(tradeEdgeAssignment)
    .values({
      tradeId: input.tradeId,
      edgeId: accessibleEdge.id,
      userId: input.userId,
    })
    .onConflictDoUpdate({
      target: tradeEdgeAssignment.tradeId,
      set: {
        edgeId: accessibleEdge.id,
        userId: input.userId,
        updatedAt: new Date(),
      },
    });

  await db
    .update(trade)
    .set({
      modelTag: accessibleEdge.name,
      modelTagColor: accessibleEdge.color,
    })
    .where(eq(trade.id, input.tradeId));

  return accessibleEdge;
}

export async function assignLegacyModelTagToTrade(input: {
  tradeId: string;
  userId: string;
  modelTag: string | null;
  modelTagColor?: string | null;
}) {
  if (!input.modelTag || !input.modelTag.trim()) {
    return assignEdgeToTrade({
      tradeId: input.tradeId,
      userId: input.userId,
      edgeId: null,
    });
  }

  const ensuredEdge = await ensureUserOwnedEdge({
    userId: input.userId,
    name: input.modelTag,
    color: input.modelTagColor,
  });

  return assignEdgeToTrade({
    tradeId: input.tradeId,
    userId: input.userId,
    edgeId: ensuredEdge.id,
  });
}

export async function bulkAssignLegacyModelTagToTrades(input: {
  tradeIds: string[];
  userId: string;
  modelTag: string | null;
  modelTagColor?: string | null;
}) {
  if (input.tradeIds.length === 0) {
    return null;
  }

  if (!input.modelTag || !input.modelTag.trim()) {
    await db
      .delete(tradeEdgeRuleEvaluation)
      .where(inArray(tradeEdgeRuleEvaluation.tradeId, input.tradeIds));
    await db
      .delete(tradeEdgeAssignment)
      .where(inArray(tradeEdgeAssignment.tradeId, input.tradeIds));
    await db
      .update(trade)
      .set({
        modelTag: null,
        modelTagColor: null,
      })
      .where(inArray(trade.id, input.tradeIds));

    return null;
  }

  const ensuredEdge = await ensureUserOwnedEdge({
    userId: input.userId,
    name: input.modelTag,
    color: input.modelTagColor,
  });

  await db
    .delete(tradeEdgeRuleEvaluation)
    .where(inArray(tradeEdgeRuleEvaluation.tradeId, input.tradeIds));

  await db
    .insert(tradeEdgeAssignment)
    .values(
      input.tradeIds.map((tradeId) => ({
        tradeId,
        edgeId: ensuredEdge.id,
        userId: input.userId,
      }))
    )
    .onConflictDoUpdate({
      target: tradeEdgeAssignment.tradeId,
      set: {
        edgeId: ensuredEdge.id,
        userId: input.userId,
        updatedAt: new Date(),
      },
    });

  await db
    .update(trade)
    .set({
      modelTag: ensuredEdge.name,
      modelTagColor: ensuredEdge.color,
    })
    .where(inArray(trade.id, input.tradeIds));

  return ensuredEdge;
}

export async function setTradeEdgeRuleEvaluations(input: {
  tradeId: string;
  edgeId: string | null;
  evaluations: Array<{
    ruleId: string;
    status: EdgeRuleEvaluationStatus;
  }>;
}) {
  await db
    .delete(tradeEdgeRuleEvaluation)
    .where(eq(tradeEdgeRuleEvaluation.tradeId, input.tradeId));

  if (!input.edgeId || input.evaluations.length === 0) {
    return [];
  }

  const validRules = await db
    .select({
      id: edgeRule.id,
    })
    .from(edgeRule)
    .where(
      and(
        eq(edgeRule.edgeId, input.edgeId),
        inArray(
          edgeRule.id,
          input.evaluations.map((evaluation) => evaluation.ruleId)
        )
      )
    );

  const validRuleIds = new Set(validRules.map((rule) => rule.id));
  const values = input.evaluations
    .filter((evaluation) => validRuleIds.has(evaluation.ruleId))
    .map((evaluation) => ({
      tradeId: input.tradeId,
      edgeId: input.edgeId!,
      ruleId: evaluation.ruleId,
      status: evaluation.status,
    }));

  if (values.length === 0) {
    return [];
  }

  return db.insert(tradeEdgeRuleEvaluation).values(values).returning();
}
