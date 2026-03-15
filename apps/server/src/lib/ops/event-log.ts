import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "../../db";
import {
  activationMilestone,
  appEvent,
  type ActivationMilestoneRow,
  type AppEventRow,
} from "../../db/schema/operations";

type EventMetadata = Record<string, unknown> | null | undefined;

export async function ensureActivationMilestone(input: {
  userId: string;
  key: string;
  source?: string;
  metadata?: EventMetadata;
}) {
  await db
    .insert(activationMilestone)
    .values({
      userId: input.userId,
      key: input.key,
      source: input.source ?? "app",
      metadata: input.metadata ?? null,
    })
    .onConflictDoUpdate({
      target: [activationMilestone.userId, activationMilestone.key],
      set: {
        source: input.source ?? "app",
        metadata: input.metadata ?? null,
        lastSeenAt: new Date(),
        count: sql`${activationMilestone.count} + 1`,
      },
    });

  return { recorded: true } as const;
}

export async function listActivationMilestones(
  userId: string
): Promise<ActivationMilestoneRow[]> {
  return db
    .select()
    .from(activationMilestone)
    .where(eq(activationMilestone.userId, userId))
    .orderBy(desc(activationMilestone.lastSeenAt));
}

export async function recordAppEvent(input: {
  userId?: string;
  category: string;
  name: string;
  source?: string;
  summary?: string | null;
  pagePath?: string | null;
  level?: "info" | "warning" | "error";
  isUserVisible?: boolean;
  metadata?: EventMetadata;
}) {
  await db.insert(appEvent).values({
    userId: input.userId ?? null,
    category: input.category,
    name: input.name,
    level: input.level ?? "info",
    source: input.source ?? "server",
    summary: input.summary ?? null,
    pagePath: input.pagePath ?? null,
    isUserVisible: input.isUserVisible ?? false,
    metadata: input.metadata ?? null,
  });

  return { recorded: true } as const;
}

export async function listRecentUserEvents(
  userId: string,
  limit = 20
): Promise<AppEventRow[]> {
  return db
    .select()
    .from(appEvent)
    .where(eq(appEvent.userId, userId))
    .orderBy(desc(appEvent.createdAt))
    .limit(limit);
}

export async function listRecentVisibleErrors(
  userId: string,
  limit = 8
): Promise<AppEventRow[]> {
  return db
    .select()
    .from(appEvent)
    .where(
      and(
        eq(appEvent.userId, userId),
        eq(appEvent.level, "error"),
        eq(appEvent.isUserVisible, true)
      )
    )
    .orderBy(desc(appEvent.createdAt))
    .limit(limit);
}

export async function recordOperationalError(input: {
  userId?: string;
  category: string;
  name: string;
  source?: string;
  summary?: string | null;
  pagePath?: string | null;
  isUserVisible?: boolean;
  metadata?: EventMetadata;
}) {
  return recordAppEvent({
    ...input,
    level: "error",
    isUserVisible: input.isUserVisible ?? true,
  });
}
