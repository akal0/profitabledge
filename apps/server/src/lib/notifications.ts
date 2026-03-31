import { nanoid } from "nanoid";
import { db } from "../db";
import { notification } from "../db/schema/notifications";
import { user as userTable } from "../db/schema/auth";
import { and, eq } from "drizzle-orm";
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

export type DesktopNotificationCategory =
  | "trades"
  | "goals"
  | "alerts"
  | "news"
  | "system"
  | "social";

export type DesktopNotificationPriority = "normal" | "high";

export type DesktopQuietHours = {
  enabled: boolean;
  startHour: number;
  endHour: number;
  timezone: string;
};

export type DesktopNotificationPreferences = {
  enabled: boolean;
  closeToTray: boolean;
  launchOnLogin: boolean;
  highPriorityOnly: boolean;
  quietHours: DesktopQuietHours;
  trades: boolean;
  goals: boolean;
  alerts: boolean;
  news: boolean;
  system: boolean;
  social: boolean;
};

type DeepPartial<T> = T extends Date
  ? T
  : T extends Array<unknown>
    ? T
    : T extends object
      ? {
          [K in keyof T]?: DeepPartial<T[K]>;
        }
      : T;

export type DesktopQuietHoursInput = DeepPartial<DesktopQuietHours>;

export type DesktopNotificationPreferencesInput = DeepPartial<DesktopNotificationPreferences>;

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
  desktop: DesktopNotificationPreferences;
};

export type NotificationPreferencesInput = DeepPartial<NotificationPreferences>;

export const defaultDesktopQuietHours: DesktopQuietHours = {
  enabled: false,
  startHour: 22,
  endHour: 7,
  timezone: "UTC",
};

export const defaultDesktopNotificationPreferences: DesktopNotificationPreferences =
  {
    enabled: true,
    closeToTray: true,
    launchOnLogin: false,
    highPriorityOnly: false,
    quietHours: defaultDesktopQuietHours,
    trades: true,
    goals: true,
    alerts: true,
    news: true,
    system: true,
    social: false,
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
  desktop: defaultDesktopNotificationPreferences,
};

export function mergeDesktopNotificationPreferences(
  prefs?: DesktopNotificationPreferencesInput | null
) {
  return {
    ...defaultDesktopNotificationPreferences,
    ...(prefs || {}),
    quietHours: {
      ...defaultDesktopQuietHours,
      ...(prefs?.quietHours || {}),
    },
  };
}

export function mergeNotificationPreferences(
  prefs?: NotificationPreferencesInput | null
) {
  return {
    ...defaultNotificationPreferences,
    ...(prefs || {}),
    desktop: mergeDesktopNotificationPreferences(prefs?.desktop || null),
  };
}

export function getNotificationDesktopCategory(
  type: NotificationType
): DesktopNotificationCategory {
  switch (type) {
    case "trade_closed":
    case "trade_opened":
    case "post_exit_ready":
    case "trade_imported":
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
    case "webhook_sync":
    case "api_key":
    case "settings_updated":
    case "system_maintenance":
    case "system_update":
    case "edge_invite":
    case "journal_share_request":
    case "journal_share_invite":
    case "journal_share_accepted":
    case "journal_share_declined":
    default:
      return "system";
  }
}

export function getNotificationDesktopPriority(
  type: NotificationType
): DesktopNotificationPriority {
  switch (type) {
    case "alert_triggered":
    case "prop_violation":
    case "prop_journey":
    case "prop_phase_advanced":
    case "webhook_sync":
    case "system_maintenance":
    case "system_update":
      return "high";
    default:
      return "normal";
  }
}

export function isDesktopQuietHoursActive(
  desktopPrefs: DesktopNotificationPreferences,
  now = new Date()
) {
  if (!desktopPrefs.quietHours.enabled) {
    return false;
  }

  try {
    const hourFormatter = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: desktopPrefs.quietHours.timezone || "UTC",
    });
    const currentHour = Number(hourFormatter.format(now));
    const { startHour, endHour } = desktopPrefs.quietHours;

    if (startHour === endHour) {
      return true;
    }

    if (startHour < endHour) {
      return currentHour >= startHour && currentHour < endHour;
    }

    return currentHour >= startHour || currentHour < endHour;
  } catch {
    return false;
  }
}

export function isDesktopNotificationEnabled(
  prefs: NotificationPreferences,
  type: NotificationType
) {
  if (isDesktopQuietHoursActive(prefs.desktop)) {
    return false;
  }

  if (!prefs.desktop.enabled) {
    return false;
  }

  if (
    prefs.desktop.highPriorityOnly &&
    getNotificationDesktopPriority(type) !== "high"
  ) {
    return false;
  }

  const category = getNotificationDesktopCategory(type);
  return prefs.desktop[category];
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
      return prefs.social;
    case "edge_invite":
    case "journal_share_request":
    case "journal_share_invite":
    case "journal_share_accepted":
    case "journal_share_declined":
      return prefs.system;
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

  if (prefs.push) {
    void sendWebPushSignalToUser(userId).catch((error) => {
      console.error("[Notifications] Web push delivery failed:", error);
    });
  }

  return { skipped: false } as const;
}
