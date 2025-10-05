import { router, protectedProcedure } from "../lib/trpc";
import { db } from "../db";
import { user as userTable } from "../db/schema/auth";
import { and, eq, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const usersRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const rows = await db
      .select({
        id: userTable.id,
        name: userTable.name,
        username: userTable.username,
        email: userTable.email,
        emailVerified: userTable.emailVerified,
        image: userTable.image,
        widgetPreferences: userTable.widgetPreferences,
        chartWidgetPreferences: userTable.chartWidgetPreferences,
        createdAt: userTable.createdAt,
        updatedAt: userTable.updatedAt,
      })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    const currentUser = rows[0];
    if (!currentUser) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    // Initialize default widgets on first read if missing
    const defaultWidgets = [
      "account-balance",
      "win-rate",
      "win-streak",
      "profit-factor",
    ] as const;
    const widgetsFromDb = (currentUser as any)?.widgetPreferences?.widgets as
      | string[]
      | undefined;
    if (!Array.isArray(widgetsFromDb) || widgetsFromDb.length === 0) {
      await db
        .update(userTable)
        .set({
          widgetPreferences: { widgets: defaultWidgets },
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, userId));
      return { ...currentUser, widgetPreferences: { widgets: defaultWidgets } };
    }

    // Initialize default chart widgets if missing (same defaults for now)
    const chartFromDb = (currentUser as any)?.chartWidgetPreferences
      ?.widgets as string[] | undefined;
    if (!Array.isArray(chartFromDb) || chartFromDb.length === 0) {
      await db
        .update(userTable)
        .set({
          chartWidgetPreferences: { widgets: defaultWidgets },
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, userId));
      return {
        ...currentUser,
        chartWidgetPreferences: { widgets: defaultWidgets },
      };
    }

    return currentUser;
  }),

  updateWidgetPreferences: protectedProcedure
    .input(
      z.object({
        widgets: z
          .array(
            z.enum([
              "account-balance",
              "win-rate",
              "profit-factor",
              "win-streak",
              "hold-time",
              "test",
            ])
          )
          .max(12)
          .default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await db
        .update(userTable)
        .set({
          widgetPreferences: { widgets: input.widgets },
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, userId));
      return { ok: true } as const;
    }),

  updateChartWidgetPreferences: protectedProcedure
    .input(
      z.object({
        widgets: z
          .array(
            z.enum([
              "account-balance",
              "win-rate",
              "profit-factor",
              "win-streak",
              "hold-time",
            ])
          )
          .max(12)
          .default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await db
        .update(userTable)
        .set({
          chartWidgetPreferences: { widgets: input.widgets },
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, userId));
      return { ok: true } as const;
    }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        fullName: z.string().min(2),
        username: z.string().min(2),
        email: z.email().optional(),
        image: z.url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Ensure username uniqueness (if provided)
      if (input.username) {
        const existing = await db
          .select({ id: userTable.id })
          .from(userTable)
          .where(
            and(
              eq(userTable.username, input.username),
              ne(userTable.id, userId)
            )
          )
          .limit(1);
        if (existing[0]) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Username is taken",
          });
        }
      }

      // Ensure email uniqueness (if updating email)
      if (input.email) {
        const existingEmail = await db
          .select({ id: userTable.id })
          .from(userTable)
          .where(
            and(eq(userTable.email, input.email), ne(userTable.id, userId))
          )
          .limit(1);
        if (existingEmail[0]) {
          throw new TRPCError({ code: "CONFLICT", message: "Email is taken" });
        }
      }

      const updates: Partial<{
        name: string;
        username: string | null;
        email: string;
        image: string | null;
        updatedAt: Date;
      }> = {
        name: input.fullName,
        username: input.username,
        updatedAt: new Date(),
      };

      if (input.email) updates.email = input.email;
      if (input.image) updates.image = input.image;

      await db.update(userTable).set(updates).where(eq(userTable.id, userId));

      return { ok: true } as const;
    }),

  clearImage: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    await db
      .update(userTable)
      .set({ image: "", updatedAt: new Date() })
      .where(eq(userTable.id, userId));
    return { ok: true } as const;
  }),
});
