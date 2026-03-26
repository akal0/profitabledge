import { z } from "zod";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { router, protectedProcedure } from "../lib/trpc";
import { db } from "../db";
import { notification } from "../db/schema/notifications";
import { user as userTable } from "../db/schema/auth";
import {
  mergeNotificationPreferences,
  defaultNotificationPreferences,
  createNotification,
} from "../lib/notifications";
import type { NotificationType } from "../lib/notifications";

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
      const next = { ...current, ...input };
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
