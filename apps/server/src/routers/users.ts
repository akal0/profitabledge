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

    return currentUser;
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
});
