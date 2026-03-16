import { nanoid } from "nanoid";
import { db } from "../db";
import { notification } from "../db/schema/notifications";
import { user as userTable } from "../db/schema/auth";
import { and, eq } from "drizzle-orm";

export type NotificationType =
  | "trade_closed"
  | "trade_opened"
  | "post_exit_ready"
  | "webhook_sync"
  | "news_upcoming"
  | "trade_imported"
  | "api_key"
  | "settings_updated"
  | "goal_achieved"
  | "goal_progress"
  | "achievement_earned"
  | "alert_triggered"
  | "prop_violation"
  | "prop_journey"
  | "prop_phase_advanced"
  | "leaderboard_update"
  | "copier_signal"
  | "system_maintenance"
  | "system_update";

export type NotificationPreferences = {
  inApp: boolean;
  push: boolean;
  tradeClosed: boolean;
  tradeOpened: boolean;
  postExit: boolean;
  webhook: boolean;
  news: boolean;
  system: boolean;
  goals: boolean;
  alerts: boolean;
  social: boolean;
};

export const defaultNotificationPreferences: NotificationPreferences = {
  inApp: true,
  push: false,
  tradeClosed: true,
  tradeOpened: false,
  postExit: true,
  webhook: true,
  news: true,
  system: true,
  goals: true,
  alerts: true,
  social: false,
};

export function mergeNotificationPreferences(
  prefs?: Partial<NotificationPreferences> | null
) {
  return { ...defaultNotificationPreferences, ...(prefs || {}) };
}

function isTypeEnabled(prefs: NotificationPreferences, type: NotificationType) {
  switch (type) {
    case "trade_closed":
      return prefs.tradeClosed;
    case "trade_opened":
      return prefs.tradeOpened;
    case "post_exit_ready":
      return prefs.postExit;
    case "webhook_sync":
      return prefs.webhook;
    case "news_upcoming":
      return prefs.news;
    case "goal_achieved":
    case "goal_progress":
    case "achievement_earned":
      return prefs.goals;
    case "alert_triggered":
    case "prop_violation":
    case "prop_journey":
    case "prop_phase_advanced":
      return prefs.alerts;
    case "leaderboard_update":
    case "copier_signal":
      return prefs.social;
    case "trade_imported":
    case "api_key":
    case "settings_updated":
    case "system_maintenance":
    case "system_update":
      return prefs.system;
    default:
      return true;
  }
}

export async function createNotification(input: {
  userId: string;
  accountId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  metadata?: Record<string, any> | null;
  dedupeKey?: string | null;
}) {
  const { userId, accountId, type, title, body, metadata, dedupeKey } = input;
  const rows = await db
    .select({ notificationPreferences: userTable.notificationPreferences })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  const prefs = mergeNotificationPreferences(
    (rows[0]?.notificationPreferences as Partial<NotificationPreferences>) ||
      null
  );
  if (!isTypeEnabled(prefs, type) || (!prefs.inApp && !prefs.push)) {
    return { skipped: true } as const;
  }

  if (dedupeKey) {
    const existing = await db
      .select({ id: notification.id })
      .from(notification)
      .where(
        and(
          eq(notification.userId, userId),
          eq(notification.dedupeKey, dedupeKey)
        )
      )
      .limit(1);
    if (existing.length) {
      return { skipped: true } as const;
    }
  }

  await db.insert(notification).values({
    id: nanoid(),
    userId,
    accountId: accountId || null,
    type,
    title,
    body: body || null,
    metadata: metadata || null,
    dedupeKey: dedupeKey || null,
    createdAt: new Date(),
  });

  return { skipped: false } as const;
}
