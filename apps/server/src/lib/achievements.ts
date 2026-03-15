import { asc, eq } from "drizzle-orm";

import { db } from "../db";
import { trade } from "../db/schema/trading";
import { createNotification } from "./notifications";
import {
  buildAchievementSnapshot,
  resolveEarnedAchievements,
} from "./achievement-rules";

export { buildAchievementSnapshot, resolveEarnedAchievements } from "./achievement-rules";

export async function notifyEarnedAchievements(input: {
  userId: string;
  accountId: string;
  source?: string;
}) {
  const rows = await db
    .select({
      profit: trade.profit,
      openTime: trade.openTime,
      closeTime: trade.closeTime,
      createdAt: trade.createdAt,
    })
    .from(trade)
    .where(eq(trade.accountId, input.accountId))
    .orderBy(asc(trade.createdAt));

  const snapshot = buildAchievementSnapshot(rows);
  const earnedAchievements = resolveEarnedAchievements(snapshot);

  await Promise.all(
    earnedAchievements.map((achievement) =>
      createNotification({
        userId: input.userId,
        accountId: input.accountId,
        type: "achievement_earned",
        title: `${achievement.icon} ${achievement.name}`,
        body: input.source
          ? `${achievement.description} via ${input.source}.`
          : achievement.description,
        metadata: {
          achievementId: achievement.id,
          source: input.source ?? null,
          snapshot,
        },
        dedupeKey: `achievement:${input.userId}:${achievement.id}`,
      })
    )
  );

  return {
    earned: earnedAchievements.map((achievement) => achievement.id),
    snapshot,
  };
}
