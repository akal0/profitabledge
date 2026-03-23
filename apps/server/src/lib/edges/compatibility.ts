import { TRPCError } from "@trpc/server";
import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "../../db";
import {
  edge,
  edgeRule,
  edgeSection,
  edgeShareMember,
  tradeEdgeAssignment,
  tradeEdgeRuleEvaluation,
  trade,
  tradingAccount,
} from "../../db/schema/trading";

export const DEFAULT_EDGE_COLOR = "#3B82F6";
export const DEFAULT_EDGE_SECTION_TITLES = [
  "Entry rules",
  "In position rules",
  "Exit rules",
] as const;

export const EDGE_RULE_REVIEW_STATUS_VALUES = [
  "followed",
  "broken",
  "not_reviewed",
  "not_applicable",
] as const;

export type EdgeRuleReviewStatus =
  (typeof EDGE_RULE_REVIEW_STATUS_VALUES)[number];

export type EdgeRuleOutcome =
  | "winner"
  | "partial_win"
  | "loser"
  | "breakeven"
  | "cut_trade"
  | "all";

export function normalizeEdgeName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function sanitizeEdgeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function mapTradeOutcomeToEdgeOutcome(
  outcome: string | null | undefined
): EdgeRuleOutcome | null {
  switch (outcome) {
    case "Win":
      return "winner";
    case "PW":
      return "partial_win";
    case "Loss":
      return "loser";
    case "BE":
      return "breakeven";
    default:
      return null;
  }
}

export function getApplicableRuleOutcomesForTrade(
  outcome: string | null | undefined
) {
  const mapped = mapTradeOutcomeToEdgeOutcome(outcome);
  return mapped ? (["all", mapped] as EdgeRuleOutcome[]) : (["all"] as EdgeRuleOutcome[]);
}

export async function ensureDefaultEdgeSections(edgeId: string) {
  const existing = await db
    .select({ id: edgeSection.id })
    .from(edgeSection)
    .where(eq(edgeSection.edgeId, edgeId))
    .limit(1);

  if (existing[0]) {
    return;
  }

  await db.insert(edgeSection).values(
    DEFAULT_EDGE_SECTION_TITLES.map((title, index) => ({
      edgeId,
      title,
      sortOrder: index,
    }))
  );
}

export async function generateUniqueEdgeName(
  ownerUserId: string,
  desiredName: string
) {
  const baseName = sanitizeEdgeName(desiredName) || "Untitled Edge";
  let candidateName = baseName;
  let suffix = 2;

  for (;;) {
    const normalizedName = normalizeEdgeName(candidateName);
    const existing = await db
      .select({ id: edge.id })
      .from(edge)
      .where(
        and(
          eq(edge.ownerUserId, ownerUserId),
          eq(edge.normalizedName, normalizedName)
        )
      )
      .limit(1);

    if (!existing[0]) {
      return {
        name: candidateName,
        normalizedName,
      };
    }

    candidateName = `${baseName} ${suffix}`;
    suffix += 1;
  }
}

export async function createEdgeRecord(input: {
  ownerUserId: string;
  name: string;
  description?: string | null;
  color?: string | null;
  sourceEdgeId?: string | null;
  publicationMode?: "private" | "library";
  isDemoSeeded?: boolean;
}) {
  const uniqueName = await generateUniqueEdgeName(input.ownerUserId, input.name);
  const [created] = await db
    .insert(edge)
    .values({
      ownerUserId: input.ownerUserId,
      name: uniqueName.name,
      normalizedName: uniqueName.normalizedName,
      description: input.description ?? null,
      color: input.color ?? DEFAULT_EDGE_COLOR,
      sourceEdgeId: input.sourceEdgeId ?? null,
      publicationMode: input.publicationMode ?? "private",
      isDemoSeeded: input.isDemoSeeded ?? false,
    })
    .returning();

  await ensureDefaultEdgeSections(created.id);

  return created;
}

export async function ensureEdgeFromLegacyModelTag(input: {
  userId: string;
  modelTag: string;
  modelTagColor?: string | null;
}) {
  const name = sanitizeEdgeName(input.modelTag);
  const normalizedName = normalizeEdgeName(name);

  if (!normalizedName) {
    return null;
  }

  const existing = await db
    .select()
    .from(edge)
    .where(
      and(
        eq(edge.ownerUserId, input.userId),
        eq(edge.normalizedName, normalizedName)
      )
    )
    .limit(1);

  if (existing[0]) {
    await ensureDefaultEdgeSections(existing[0].id);

    if (!existing[0].color && input.modelTagColor) {
      const [updated] = await db
        .update(edge)
        .set({
          color: input.modelTagColor,
          updatedAt: new Date(),
        })
        .where(eq(edge.id, existing[0].id))
        .returning();
      return updated;
    }

    return existing[0];
  }

  return createEdgeRecord({
    ownerUserId: input.userId,
    name,
    color: input.modelTagColor ?? DEFAULT_EDGE_COLOR,
  });
}

export async function resolveOwnedEdgeIdsForLegacyNames(input: {
  userId: string;
  names: string[];
}) {
  if (input.names.length === 0) {
    return [];
  }

  const normalizedNames = [
    ...new Set(
      input.names
        .map((name) => normalizeEdgeName(sanitizeEdgeName(name)))
        .filter(Boolean)
    ),
  ];

  if (normalizedNames.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      id: edge.id,
      normalizedName: edge.normalizedName,
    })
    .from(edge)
    .where(
      and(
        eq(edge.ownerUserId, input.userId),
        inArray(edge.normalizedName, normalizedNames)
      )
    );

  return rows.map((row) => row.id);
}

export async function backfillUserEdgesFromLegacy(userId: string) {
  const missingTrades = await db
    .select({
      tradeId: trade.id,
      modelTag: trade.modelTag,
      modelTagColor: trade.modelTagColor,
      createdAt: trade.createdAt,
    })
    .from(trade)
    .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
    .leftJoin(
      tradeEdgeAssignment,
      eq(tradeEdgeAssignment.tradeId, trade.id)
    )
    .where(
      and(
        eq(tradingAccount.userId, userId),
        sql`${trade.modelTag} IS NOT NULL`,
        sql`BTRIM(${trade.modelTag}) <> ''`,
        isNull(tradeEdgeAssignment.id)
      )
    )
    .orderBy(desc(trade.createdAt), desc(trade.id));

  if (missingTrades.length === 0) {
    return;
  }

  const existingEdges = await db
    .select()
    .from(edge)
    .where(eq(edge.ownerUserId, userId));

  const edgeByNormalizedName = new Map(
    existingEdges.map((currentEdge) => [currentEdge.normalizedName, currentEdge])
  );

  const grouped = new Map<
    string,
    {
      displayCounts: Map<string, number>;
      mostRecentColor: string | null;
      trades: typeof missingTrades;
    }
  >();

  for (const row of missingTrades) {
    const modelTag = sanitizeEdgeName(row.modelTag ?? "");
    const normalizedName = normalizeEdgeName(modelTag);

    if (!normalizedName) {
      continue;
    }

    const group = grouped.get(normalizedName) ?? {
      displayCounts: new Map<string, number>(),
      mostRecentColor: null,
      trades: [] as typeof missingTrades,
    };

    group.displayCounts.set(modelTag, (group.displayCounts.get(modelTag) ?? 0) + 1);

    if (!group.mostRecentColor && row.modelTagColor) {
      group.mostRecentColor = row.modelTagColor;
    }

    group.trades.push(row);
    grouped.set(normalizedName, group);
  }

  for (const [normalizedName, group] of grouped.entries()) {
    if (edgeByNormalizedName.has(normalizedName)) {
      continue;
    }

    const displayName =
      [...group.displayCounts.entries()].sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }

        return left[0].localeCompare(right[0]);
      })[0]?.[0] ?? normalizedName;

    const created = await createEdgeRecord({
      ownerUserId: userId,
      name: displayName,
      color: group.mostRecentColor ?? DEFAULT_EDGE_COLOR,
    });

    edgeByNormalizedName.set(normalizedName, created);
  }

  const assignmentValues = missingTrades
    .map((row) => {
      const normalizedName = normalizeEdgeName(sanitizeEdgeName(row.modelTag ?? ""));
      const matchingEdge = edgeByNormalizedName.get(normalizedName);

      if (!matchingEdge) {
        return null;
      }

      return {
        tradeId: row.tradeId,
        edgeId: matchingEdge.id,
        userId,
      };
    })
    .filter(
      (
        value
      ): value is {
        tradeId: string;
        edgeId: string;
        userId: string;
      } => Boolean(value)
    );

  if (assignmentValues.length > 0) {
    await db
      .insert(tradeEdgeAssignment)
      .values(assignmentValues)
      .onConflictDoNothing({
        target: tradeEdgeAssignment.tradeId,
      });
  }
}

export async function getAccessibleEdgeForUser(userId: string, edgeId: string) {
  const rows = await db
    .select({
      id: edge.id,
      ownerUserId: edge.ownerUserId,
      name: edge.name,
      normalizedName: edge.normalizedName,
      description: edge.description,
      color: edge.color,
      status: edge.status,
      publicationMode: edge.publicationMode,
      isFeatured: edge.isFeatured,
      sourceEdgeId: edge.sourceEdgeId,
      shareRole: edgeShareMember.role,
    })
    .from(edge)
    .leftJoin(
      edgeShareMember,
      and(
        eq(edgeShareMember.edgeId, edge.id),
        eq(edgeShareMember.userId, userId)
      )
    )
    .where(
      and(
        eq(edge.id, edgeId),
        or(
          eq(edge.ownerUserId, userId),
          eq(edge.publicationMode, "library"),
          eq(edgeShareMember.userId, userId)
        ) as SQL<unknown>
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function ensureEdgeReadable(userId: string, edgeId: string) {
  const accessibleEdge = await getAccessibleEdgeForUser(userId, edgeId);

  if (!accessibleEdge) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Edge not found",
    });
  }

  return accessibleEdge;
}

export async function ensureEdgeWritable(userId: string, edgeId: string) {
  const accessibleEdge = await ensureEdgeReadable(userId, edgeId);

  if (
    accessibleEdge.ownerUserId !== userId &&
    accessibleEdge.shareRole !== "editor"
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to edit this edge",
    });
  }

  return accessibleEdge;
}

export async function replaceTradeEdgeAssignment(input: {
  userId: string;
  tradeId: string;
  edgeId: string | null;
  ruleEvaluations?: Array<{
    ruleId: string;
    status: EdgeRuleReviewStatus;
    notes?: string | null;
  }>;
}) {
  const existingAssignmentRows = await db
    .select({
      id: tradeEdgeAssignment.id,
      edgeId: tradeEdgeAssignment.edgeId,
    })
    .from(tradeEdgeAssignment)
    .where(eq(tradeEdgeAssignment.tradeId, input.tradeId))
    .limit(1);

  if (!input.edgeId) {
    if (existingAssignmentRows[0]) {
      await db
        .delete(tradeEdgeRuleEvaluation)
        .where(eq(tradeEdgeRuleEvaluation.tradeId, input.tradeId));
      await db
        .delete(tradeEdgeAssignment)
        .where(eq(tradeEdgeAssignment.tradeId, input.tradeId));
    }

    await db
      .update(trade)
      .set({
        modelTag: null,
        modelTagColor: null,
      })
      .where(eq(trade.id, input.tradeId));

    return {
      edge: null,
      assignmentId: null,
    };
  }

  const accessibleEdge = await ensureEdgeReadable(input.userId, input.edgeId);

  const assignment =
    existingAssignmentRows[0] && existingAssignmentRows[0].edgeId === input.edgeId
      ? existingAssignmentRows[0]
      : existingAssignmentRows[0]
      ? (
          await db
            .update(tradeEdgeAssignment)
            .set({
              edgeId: input.edgeId,
              userId: input.userId,
              updatedAt: new Date(),
            })
            .where(eq(tradeEdgeAssignment.id, existingAssignmentRows[0].id))
            .returning({
              id: tradeEdgeAssignment.id,
              edgeId: tradeEdgeAssignment.edgeId,
            })
        )[0]
      : (
          await db
            .insert(tradeEdgeAssignment)
            .values({
              tradeId: input.tradeId,
              edgeId: input.edgeId,
              userId: input.userId,
            })
            .returning({
              id: tradeEdgeAssignment.id,
              edgeId: tradeEdgeAssignment.edgeId,
            })
        )[0];

  await db
    .update(trade)
    .set({
      modelTag: accessibleEdge.name,
      modelTagColor: accessibleEdge.color ?? DEFAULT_EDGE_COLOR,
    })
    .where(eq(trade.id, input.tradeId));

  await db
    .delete(tradeEdgeRuleEvaluation)
    .where(eq(tradeEdgeRuleEvaluation.tradeId, input.tradeId));

  if (input.ruleEvaluations && input.ruleEvaluations.length > 0) {
    const allowedRuleIds = await db
      .select({ id: edgeRule.id })
      .from(edgeRule)
      .where(
        and(
          eq(edgeRule.edgeId, input.edgeId),
          inArray(
            edgeRule.id,
            input.ruleEvaluations.map((evaluation) => evaluation.ruleId)
          )
        )
      );
    const allowedSet = new Set(allowedRuleIds.map((row) => row.id));

    const values = input.ruleEvaluations
      .filter((evaluation) => allowedSet.has(evaluation.ruleId))
      .map((evaluation) => ({
        tradeId: input.tradeId,
        edgeId: input.edgeId!,
        ruleId: evaluation.ruleId,
        status: evaluation.status,
      }));

    if (values.length > 0) {
      await db.insert(tradeEdgeRuleEvaluation).values(values);
    }
  }

  return {
    edge: accessibleEdge,
    assignmentId: assignment.id,
  };
}
