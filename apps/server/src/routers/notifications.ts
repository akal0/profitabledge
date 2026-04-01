import { z } from "zod";
import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../lib/trpc";
import { db } from "../db";
import { notification, pushSubscription } from "../db/schema/notifications";
import { user as userTable } from "../db/schema/auth";
import {
  mergeNotificationPreferences,
  defaultNotificationPreferences,
  createNotification,
  isDesktopNotificationEnabled,
} from "../lib/notifications";
import type { NotificationType } from "../lib/notifications";

const desktopPreferenceSchema = z.object({
  enabled: z.boolean().optional(),
  closeToTray: z.boolean().optional(),
  launchOnLogin: z.boolean().optional(),
  highPriorityOnly: z.boolean().optional(),
  quietHours: z
    .object({
      enabled: z.boolean().optional(),
      startHour: z.number().int().min(0).max(23).optional(),
      endHour: z.number().int().min(0).max(23).optional(),
      timezone: z.string().min(1).optional(),
    })
    .optional(),
  trades: z.boolean().optional(),
  goals: z.boolean().optional(),
  alerts: z.boolean().optional(),
  news: z.boolean().optional(),
  system: z.boolean().optional(),
  social: z.boolean().optional(),
});

const preferenceSchema = z.object({
  inApp: z.boolean().optional(),
  push: z.boolean().optional(),
  tradeClosed: z.boolean().optional(),
  tradeOpened: z.boolean().optional(),
  postExit: z.boolean().optional(),
  webhook: z.boolean().optional(),
  news: z.boolean().optional(),
  system: z.boolean().optional(),
  goals: z.boolean().optional(),
  alerts: z.boolean().optional(),
  social: z.boolean().optional(),
  desktop: desktopPreferenceSchema.optional(),
});

export const notificationsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).optional(),
        unreadOnly: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const limit = input.limit ?? 25;
      const where = input.unreadOnly
        ? and(eq(notification.userId, userId), isNull(notification.readAt))
        : eq(notification.userId, userId);
      return db
        .select()
        .from(notification)
        .where(where)
        .orderBy(desc(notification.createdAt))
        .limit(limit);
    }),

  unreadSummary: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(notification)
      .where(and(eq(notification.userId, userId), isNull(notification.readAt)));

    return {
      unreadCount: Number(row?.count ?? 0),
    };
  }),

  desktopFeed: protectedProcedure
    .input(
      z
        .object({
          after: z.string().datetime().optional(),
          limit: z.number().int().min(1).max(50).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const rows = await db
        .select({ notificationPreferences: userTable.notificationPreferences })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1);
      const preferences = mergeNotificationPreferences(
        (rows[0]?.notificationPreferences as any) || null
      );

      const conditions = [eq(notification.userId, userId)];
      if (input?.after) {
        const after = new Date(input.after);
        if (!Number.isNaN(after.getTime())) {
          conditions.push(gt(notification.createdAt, after));
        }
      }

      const limit = input?.limit ?? 10;
      const [items, unreadCountRows] = await Promise.all([
        db
          .select()
          .from(notification)
          .where(and(...conditions))
          .orderBy(desc(notification.createdAt))
          .limit(limit),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(notification)
          .where(
            and(eq(notification.userId, userId), isNull(notification.readAt))
          ),
      ]);

      return {
        unreadCount: Number(unreadCountRows[0]?.count ?? 0),
        items: items
          .filter((item) =>
            isDesktopNotificationEnabled(
              preferences,
              item.type as NotificationType
            )
          )
          .map((item) => ({
            id: item.id,
            accountId: item.accountId,
            type: item.type,
            title: item.title,
            body: item.body,
            metadata: item.metadata,
            createdAt: item.createdAt,
            readAt: item.readAt,
          })),
      };
    }),

  markRead: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.string().min(1)).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await db
        .update(notification)
        .set({ readAt: new Date() })
        .where(and(eq(notification.userId, userId), inArray(notification.id, input.ids)));
      return { ok: true } as const;
    }),

  markTypeRead: protectedProcedure
    .input(z.object({ type: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await db
        .update(notification)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notification.userId, userId),
            eq(notification.type, input.type),
            isNull(notification.readAt)
          )
        );
      return { ok: true } as const;
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    await db
      .update(notification)
      .set({ readAt: new Date() })
      .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
    return { ok: true } as const;
  }),

  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const rows = await db
      .select({ notificationPreferences: userTable.notificationPreferences })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    const merged = mergeNotificationPreferences(
      (rows[0]?.notificationPreferences as any) || null
    );
    return merged;
  }),

  getDeliveryHealth: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const subscriptions = await db
      .select({
        id: pushSubscription.id,
        createdAt: pushSubscription.createdAt,
        updatedAt: pushSubscription.updatedAt,
        lastSuccessAt: pushSubscription.lastSuccessAt,
        lastFailureAt: pushSubscription.lastFailureAt,
        failureReason: pushSubscription.failureReason,
      })
      .from(pushSubscription)
      .where(eq(pushSubscription.userId, userId))
      .orderBy(desc(pushSubscription.updatedAt));

    const lastSuccessAt = subscriptions.reduce<Date | null>(
      (latest, subscription) => {
        if (!subscription.lastSuccessAt) return latest;
        if (!latest || subscription.lastSuccessAt > latest) {
          return subscription.lastSuccessAt;
        }
        return latest;
      },
      null
    );
    const lastFailureAt = subscriptions.reduce<Date | null>(
      (latest, subscription) => {
        if (!subscription.lastFailureAt) return latest;
        if (!latest || subscription.lastFailureAt > latest) {
          return subscription.lastFailureAt;
        }
        return latest;
      },
      null
    );
    const activeFailureReasons = Array.from(
      new Set(
        subscriptions
          .map((subscription) => subscription.failureReason?.trim())
          .filter((reason): reason is string => Boolean(reason))
      )
    );

    return {
      subscriptionCount: subscriptions.length,
      healthyCount: subscriptions.filter(
        (subscription) => subscription.lastSuccessAt && !subscription.failureReason
      ).length,
      failingCount: subscriptions.filter((subscription) =>
        Boolean(subscription.failureReason)
      ).length,
      lastSuccessAt,
      lastFailureAt,
      failureReasons: activeFailureReasons.slice(0, 3),
    };
  }),

  updatePreferences: protectedProcedure
    .input(preferenceSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const rows = await db
        .select({ notificationPreferences: userTable.notificationPreferences })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1);
      const current = mergeNotificationPreferences(
        (rows[0]?.notificationPreferences as any) || null
      );
      const next = mergeNotificationPreferences({
        ...current,
        ...input,
        desktop: input.desktop
          ? {
              ...current.desktop,
              ...input.desktop,
              quietHours: input.desktop.quietHours
                ? {
                    ...current.desktop.quietHours,
                    ...input.desktop.quietHours,
                  }
                : current.desktop.quietHours,
            }
          : current.desktop,
      });
      await db
        .update(userTable)
        .set({ notificationPreferences: next, updatedAt: new Date() })
        .where(eq(userTable.id, userId));
      return next;
    }),
  ingestNews: protectedProcedure
    .input(
      z.object({
        events: z.array(
          z.object({
            title: z.string().min(1),
            country: z.string().optional(),
            impact: z.string().optional(),
            date: z.string().min(1),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const todayKey = new Date().toISOString().slice(0, 10);
      const filtered = input.events.filter((event) =>
        event.date.startsWith(todayKey)
      );
      if (!filtered.length) return { ok: true, created: 0 } as const;

      // Group events by (country, impact)
      const groups = new Map<
        string,
        { country: string; impact: string; events: typeof filtered }
      >();
      for (const event of filtered) {
        const country = event.country || "Global";
        const impact = event.impact || "Low";
        const key = `${country}:${impact}`;
        const group = groups.get(key);
        if (group) {
          group.events.push(event);
        } else {
          groups.set(key, { country, impact, events: [event] });
        }
      }

      let created = 0;
      for (const [, group] of groups) {
        const { country, impact, events: groupEvents } = group;
        const count = groupEvents.length;
        const titles = groupEvents.map((e) => e.title);
        const dedupeKey = `news:${todayKey}:${country}:${impact}`;
        const title = `${country} (${impact})`;
        const body =
          count === 1
            ? titles[0]
            : `${count} events: ${titles.slice(0, 3).join(", ")}${count > 3 ? ` +${count - 3} more` : ""}`;
        const res = await createNotification({
          userId,
          type: "news_upcoming" as NotificationType,
          title,
          body,
          metadata: {
            source: "economic-calendar",
            impact,
            country,
            date: todayKey,
            eventCount: count,
            eventTitles: titles,
          },
          dedupeKey,
        });
        if (!res.skipped) created += 1;
      }
      return { ok: true, created } as const;
    }),
});
