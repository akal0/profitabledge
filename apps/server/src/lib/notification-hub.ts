import { nanoid } from "nanoid";
import { db } from "../db";
import { notification } from "../db/schema/notifications";
import { user as userTable } from "../db/schema/auth";
import { and, eq, inArray, isNull, desc, or } from "drizzle-orm";
import { eventBus, publish } from "./event-bus";
import { sendWebPushSignalToUser } from "./push-web";

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
  | "edge_invite"
  | "journal_share_request"
  | "journal_share_invite"
  | "journal_share_accepted"
  | "journal_share_declined"
  | "leaderboard_update"
  | "system_maintenance"
  | "system_update";

export type NotificationCategory =
  | "trades"
  | "goals"
  | "alerts"
  | "news"
  | "system"
  | "social";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export type NotificationPreferences = {
  inApp: boolean;
  push: boolean;
  email: boolean;
  webhook: boolean;
  tradeClosed: boolean;
  tradeOpened: boolean;
  postExit: boolean;
  webhookSync: boolean;
  news: boolean;
  system: boolean;
  goals: boolean;
  alerts: boolean;
  social: boolean;
};

export type NotificationInput = {
  userId: string;
  accountId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  metadata?: Record<string, unknown> | null;
  dedupeKey?: string | null;
  priority?: NotificationPriority;
  expiresAt?: Date | null;
};

export type NotificationResult = {
  skipped: boolean;
  notificationId?: string;
  reason?: string;
};

export const defaultNotificationPreferences: NotificationPreferences = {
  inApp: true,
  push: false,
  email: false,
  webhook: false,
  tradeClosed: true,
  tradeOpened: false,
  postExit: true,
  webhookSync: true,
  news: true,
  system: true,
  goals: true,
  alerts: true,
  social: false,
};

export function mergeNotificationPreferences(
  prefs?: Partial<NotificationPreferences> | null
): NotificationPreferences {
  return { ...defaultNotificationPreferences, ...(prefs || {}) };
}

export function getNotificationCategory(
  type: NotificationType
): NotificationCategory {
  switch (type) {
    case "trade_closed":
    case "trade_opened":
    case "trade_imported":
    case "post_exit_ready":
      return "trades";
    case "goal_achieved":
    case "goal_progress":
    case "achievement_earned":
      return "goals";
    case "alert_triggered":
    case "prop_violation":
    case "prop_journey":
    case "prop_phase_advanced":
      return "alerts";
    case "news_upcoming":
      return "news";
    case "leaderboard_update":
      return "social";
    case "edge_invite":
    case "journal_share_request":
    case "journal_share_invite":
    case "journal_share_accepted":
    case "journal_share_declined":
      return "system";
    default:
      return "system";
  }
}

export function getNotificationPriority(
  type: NotificationType
): NotificationPriority {
  switch (type) {
    case "alert_triggered":
    case "prop_violation":
      return "urgent";
    case "prop_journey":
      return "normal";
    case "trade_closed":
    case "goal_achieved":
    case "achievement_earned":
    case "prop_phase_advanced":
      return "high";
    case "trade_opened":
    case "post_exit_ready":
    case "goal_progress":
    case "journal_share_request":
    case "journal_share_invite":
    case "journal_share_accepted":
    case "journal_share_declined":
      return "normal";
    default:
      return "low";
  }
}

function isTypeEnabled(
  prefs: NotificationPreferences,
  type: NotificationType
): boolean {
  switch (type) {
    case "trade_closed":
      return prefs.tradeClosed;
    case "trade_opened":
      return prefs.tradeOpened;
    case "post_exit_ready":
      return prefs.postExit;
    case "webhook_sync":
      return prefs.webhookSync;
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
      return prefs.social;
    case "edge_invite":
    case "journal_share_request":
    case "journal_share_invite":
    case "journal_share_accepted":
    case "journal_share_declined":
      return prefs.system;
    default:
      return prefs.system;
  }
}

class NotificationHub {
  private pendingNotifications: Map<string, NotificationInput[]> = new Map();
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startFlushInterval();
  }

  async create(input: NotificationInput): Promise<NotificationResult> {
    const {
      userId,
      accountId,
      type,
      title,
      body,
      metadata,
      dedupeKey,
      priority,
      expiresAt,
    } = input;

    const rows = await db
      .select({ notificationPreferences: userTable.notificationPreferences })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    const prefs = mergeNotificationPreferences(
      (rows[0]?.notificationPreferences as Partial<NotificationPreferences>) ||
        null
    );

    if (!isTypeEnabled(prefs, type)) {
      return { skipped: true, reason: "disabled" };
    }

    if (!prefs.inApp && !prefs.push) {
      return { skipped: true, reason: "channels_disabled" };
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
        return { skipped: true, reason: "duplicate" };
      }
    }

    const notificationId = nanoid();
    const notificationPriority = priority ?? getNotificationPriority(type);

    await db.insert(notification).values({
      id: notificationId,
      userId,
      accountId: accountId || null,
      type,
      title,
      body: body || null,
      metadata: metadata || null,
      dedupeKey: dedupeKey || null,
      createdAt: new Date(),
    });

    await publish("notification:created", {
      notificationId,
      userId,
      type,
      title,
    });

    if (prefs.push) {
      void sendWebPushSignalToUser(userId).catch((error) => {
        console.error("[NotificationHub] Web push delivery failed:", error);
      });
    }

    return { skipped: false, notificationId };
  }

  async createBatch(
    inputs: NotificationInput[]
  ): Promise<NotificationResult[]> {
    return Promise.all(inputs.map((input) => this.create(input)));
  }

  queue(input: NotificationInput): void {
    const key = input.userId;
    const pending = this.pendingNotifications.get(key) || [];
    pending.push(input);
    this.pendingNotifications.set(key, pending);
  }

  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flushAll();
    }, 5000);
  }

  private async flushAll(): Promise<void> {
    const allPending = new Map(this.pendingNotifications);
    this.pendingNotifications.clear();

    for (const [userId, inputs] of allPending) {
      try {
        await this.createBatch(inputs);
      } catch (error) {
        console.error(
          `[NotificationHub] Failed to flush notifications for user ${userId}:`,
          error
        );
        for (const input of inputs) {
          this.queue(input);
        }
      }
    }
  }

  async list(
    userId: string,
    options?: {
      limit?: number;
      unreadOnly?: boolean;
      categories?: NotificationCategory[];
      types?: NotificationType[];
    }
  ): Promise<(typeof notification.$inferSelect)[]> {
    const { limit = 25, unreadOnly, categories, types } = options || {};

    const conditions = [eq(notification.userId, userId)];

    if (unreadOnly) {
      conditions.push(isNull(notification.readAt));
    }

    if (types && types.length > 0) {
      conditions.push(inArray(notification.type, types));
    }

    return db
      .select()
      .from(notification)
      .where(and(...conditions))
      .orderBy(desc(notification.createdAt))
      .limit(limit);
  }

  async markRead(userId: string, notificationIds: string[]): Promise<void> {
    await db
      .update(notification)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notification.userId, userId),
          inArray(notification.id, notificationIds)
        )
      );
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await db
      .update(notification)
      .set({ readAt: new Date() })
      .where(and(eq(notification.userId, userId), isNull(notification.readAt)))
      .returning({ id: notification.id });

    return result.length;
  }

  async getUnreadCount(userId: string): Promise<number> {
    const result = await db
      .select({ id: notification.id })
      .from(notification)
      .where(and(eq(notification.userId, userId), isNull(notification.readAt)));

    return result.length;
  }

  async getUnreadCountByCategory(
    userId: string
  ): Promise<Record<NotificationCategory, number>> {
    const result = await db
      .select({ type: notification.type })
      .from(notification)
      .where(and(eq(notification.userId, userId), isNull(notification.readAt)));

    const counts: Record<NotificationCategory, number> = {
      trades: 0,
      goals: 0,
      alerts: 0,
      news: 0,
      system: 0,
      social: 0,
    };

    for (const row of result) {
      const category = getNotificationCategory(row.type as NotificationType);
      counts[category]++;
    }

    return counts;
  }

  async delete(userId: string, notificationIds: string[]): Promise<void> {
    await db
      .delete(notification)
      .where(
        and(
          eq(notification.userId, userId),
          inArray(notification.id, notificationIds)
        )
      );
  }

  async deleteAll(userId: string): Promise<number> {
    const result = await db
      .delete(notification)
      .where(eq(notification.userId, userId))
      .returning({ id: notification.id });

    return result.length;
  }

  async deleteOlderThan(userId: string, days: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const result = await db
      .delete(notification)
      .where(
        and(
          eq(notification.userId, userId),
          or(isNull(notification.readAt), eq(notification.readAt, null as any))
        )
      )
      .returning({ id: notification.id });

    return result.length;
  }

  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }
}

export const notificationHub = new NotificationHub();

export async function createNotification(
  input: NotificationInput
): Promise<NotificationResult> {
  return notificationHub.create(input);
}

export async function createNotificationBatch(
  inputs: NotificationInput[]
): Promise<NotificationResult[]> {
  return notificationHub.createBatch(inputs);
}

export function queueNotification(input: NotificationInput): void {
  notificationHub.queue(input);
}

export default notificationHub;
