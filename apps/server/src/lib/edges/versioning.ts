import { asc, desc, eq } from "drizzle-orm";

import { db } from "../../db";
import {
  edge,
  edgeRule,
  edgeSection,
  edgeVersion,
  type EdgeVersionDiffSummary,
  type EdgeVersionSnapshot,
} from "../../db/schema/trading";

const SNAPSHOT_EDGE_FIELDS = [
  "name",
  "description",
  "color",
  "status",
  "publicationMode",
  "publicStatsVisible",
  "sourceEdgeId",
  "coverImageUrl",
  "coverImagePosition",
  "contentBlocks",
  "contentHtml",
  "examplesBlocks",
  "examplesHtml",
] as const;

type EdgeSnapshotField = (typeof SNAPSHOT_EDGE_FIELDS)[number];

function stableStringify(value: unknown) {
  return JSON.stringify(value);
}

function buildSnapshotChangeFields(
  previousSnapshot: EdgeVersionSnapshot | null,
  nextSnapshot: EdgeVersionSnapshot
) {
  if (!previousSnapshot) {
    return [...SNAPSHOT_EDGE_FIELDS, "sections", "rules"];
  }

  const changedFields: string[] = [];
  for (const field of SNAPSHOT_EDGE_FIELDS) {
    if (
      stableStringify(previousSnapshot.edge[field]) !==
      stableStringify(nextSnapshot.edge[field])
    ) {
      changedFields.push(field);
    }
  }

  if (
    stableStringify(previousSnapshot.sections) !==
    stableStringify(nextSnapshot.sections)
  ) {
    changedFields.push("sections");
  }

  if (
    stableStringify(previousSnapshot.rules) !== stableStringify(nextSnapshot.rules)
  ) {
    changedFields.push("rules");
  }

  return changedFields;
}

function buildDiffSummary(args: {
  previousSnapshot: EdgeVersionSnapshot | null;
  nextSnapshot: EdgeVersionSnapshot;
  changedFields: string[];
}): EdgeVersionDiffSummary {
  const { previousSnapshot, nextSnapshot, changedFields } = args;
  const previousSections = previousSnapshot?.sections ?? [];
  const previousRules = previousSnapshot?.rules ?? [];

  return {
    changedFields,
    previousSectionCount: previousSections.length,
    nextSectionCount: nextSnapshot.sections.length,
    previousRuleCount: previousRules.length,
    nextRuleCount: nextSnapshot.rules.length,
    structuralChange:
      !previousSnapshot ||
      stableStringify(previousSections) !== stableStringify(nextSnapshot.sections) ||
      stableStringify(previousRules) !== stableStringify(nextSnapshot.rules),
  };
}

function buildChangeSummary(args: {
  changeType: string;
  changedFields: string[];
  explicitSummary?: string | null;
}) {
  if (args.explicitSummary) {
    return args.explicitSummary;
  }

  if (args.changedFields.length === 0) {
    return `${args.changeType} (no structural diff)`;
  }

  const [firstField, secondField, thirdField] = args.changedFields;
  const remaining = args.changedFields.length - 3;
  const preview = [firstField, secondField, thirdField]
    .filter((value): value is string => Boolean(value))
    .join(", ");

  return remaining > 0 ? `${preview} +${remaining} more` : preview;
}

export async function loadEdgeVersionSnapshot(
  edgeId: string
): Promise<EdgeVersionSnapshot | null> {
  const [edgeRow] = await db
    .select({
      id: edge.id,
      name: edge.name,
      description: edge.description,
      color: edge.color,
      status: edge.status,
      publicationMode: edge.publicationMode,
      publicStatsVisible: edge.publicStatsVisible,
      sourceEdgeId: edge.sourceEdgeId,
      coverImageUrl: edge.coverImageUrl,
      coverImagePosition: edge.coverImagePosition,
      contentBlocks: edge.contentBlocks,
      contentHtml: edge.contentHtml,
      examplesBlocks: edge.examplesBlocks,
      examplesHtml: edge.examplesHtml,
    })
    .from(edge)
    .where(eq(edge.id, edgeId))
    .limit(1);

  if (!edgeRow) {
    return null;
  }

  const [sectionRows, ruleRows] = await Promise.all([
    db
      .select({
        id: edgeSection.id,
        title: edgeSection.title,
        description: edgeSection.description,
        sortOrder: edgeSection.sortOrder,
      })
      .from(edgeSection)
      .where(eq(edgeSection.edgeId, edgeId))
      .orderBy(asc(edgeSection.sortOrder), asc(edgeSection.title), asc(edgeSection.id)),
    db
      .select({
        id: edgeRule.id,
        sectionId: edgeRule.sectionId,
        title: edgeRule.title,
        description: edgeRule.description,
        sortOrder: edgeRule.sortOrder,
        isActive: edgeRule.isActive,
        appliesOutcomes: edgeRule.appliesOutcomes,
      })
      .from(edgeRule)
      .where(eq(edgeRule.edgeId, edgeId))
      .orderBy(asc(edgeRule.sortOrder), asc(edgeRule.title), asc(edgeRule.id)),
  ]);

  return {
    edge: {
      id: edgeRow.id,
      name: edgeRow.name,
      description: edgeRow.description,
      color: edgeRow.color,
      status: edgeRow.status,
      publicationMode: edgeRow.publicationMode,
      publicStatsVisible: edgeRow.publicStatsVisible,
      sourceEdgeId: edgeRow.sourceEdgeId,
      coverImageUrl: edgeRow.coverImageUrl,
      coverImagePosition: edgeRow.coverImagePosition,
      contentBlocks:
        (edgeRow.contentBlocks as Record<string, unknown>[] | null) ?? [],
      contentHtml: edgeRow.contentHtml,
      examplesBlocks:
        (edgeRow.examplesBlocks as Record<string, unknown>[] | null) ?? [],
      examplesHtml: edgeRow.examplesHtml,
    },
    sections: sectionRows,
    rules: ruleRows.map((row) => ({
      ...row,
      appliesOutcomes: (row.appliesOutcomes as string[] | null | undefined) ?? [
        "all",
      ],
    })),
  };
}

async function getLatestEdgeVersion(edgeId: string) {
  const rows = await db
    .select({
      id: edgeVersion.id,
      edgeId: edgeVersion.edgeId,
      versionNumber: edgeVersion.versionNumber,
      snapshot: edgeVersion.snapshot,
      createdAt: edgeVersion.createdAt,
    })
    .from(edgeVersion)
    .where(eq(edgeVersion.edgeId, edgeId))
    .orderBy(desc(edgeVersion.versionNumber))
    .limit(1);

  return rows[0] ?? null;
}

export async function ensureEdgeVersionBaseline(input: {
  edgeId: string;
  userId?: string | null;
  changeType?: string;
  changeSummary?: string | null;
}) {
  const existingVersion = await getLatestEdgeVersion(input.edgeId);
  if (existingVersion) {
    return existingVersion;
  }

  const snapshot = await loadEdgeVersionSnapshot(input.edgeId);
  if (!snapshot) {
    return null;
  }

  const changedFields = buildSnapshotChangeFields(null, snapshot);
  const diffSummary = buildDiffSummary({
    previousSnapshot: null,
    nextSnapshot: snapshot,
    changedFields,
  });

  const [createdVersion] = await db
    .insert(edgeVersion)
    .values({
      edgeId: input.edgeId,
      versionNumber: 1,
      createdByUserId: input.userId ?? null,
      changeType: input.changeType ?? "create",
      changeSummary: buildChangeSummary({
        changeType: input.changeType ?? "create",
        changedFields,
        explicitSummary: input.changeSummary,
      }),
      changedFields,
      diffSummary,
      snapshot,
    })
    .returning();

  return createdVersion ?? null;
}

export async function recordEdgeVersion(input: {
  edgeId: string;
  userId?: string | null;
  changeType: string;
  changeSummary?: string | null;
  changedFields?: string[];
}) {
  const latestVersion = await getLatestEdgeVersion(input.edgeId);
  if (!latestVersion) {
    return ensureEdgeVersionBaseline({
      edgeId: input.edgeId,
      userId: input.userId,
      changeType: input.changeType,
      changeSummary: input.changeSummary,
    });
  }

  const snapshot = await loadEdgeVersionSnapshot(input.edgeId);
  if (!snapshot) {
    return null;
  }

  const previousSnapshot =
    (latestVersion.snapshot as EdgeVersionSnapshot | null | undefined) ?? null;
  const inferredChangedFields = buildSnapshotChangeFields(previousSnapshot, snapshot);
  const changedFields = Array.from(
    new Set([...(input.changedFields ?? []), ...inferredChangedFields])
  );

  if (
    changedFields.length === 0 &&
    stableStringify(previousSnapshot) === stableStringify(snapshot)
  ) {
    return latestVersion;
  }

  const diffSummary = buildDiffSummary({
    previousSnapshot,
    nextSnapshot: snapshot,
    changedFields,
  });

  const [createdVersion] = await db
    .insert(edgeVersion)
    .values({
      edgeId: input.edgeId,
      versionNumber: latestVersion.versionNumber + 1,
      createdByUserId: input.userId ?? null,
      changeType: input.changeType,
      changeSummary: buildChangeSummary({
        changeType: input.changeType,
        changedFields,
        explicitSummary: input.changeSummary,
      }),
      changedFields,
      diffSummary,
      snapshot,
    })
    .returning();

  return createdVersion ?? latestVersion;
}
