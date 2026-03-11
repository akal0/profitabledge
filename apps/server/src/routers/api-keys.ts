import { router, protectedProcedure } from "../lib/trpc";
import { z } from "zod";
import { db } from "../db";
import { apiKey } from "../db/schema/auth";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { createNotification } from "../lib/notifications";

/**
 * Hash API key for secure storage
 */
function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Generate a secure API key with prefix
 */
function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `pe_live_${nanoid(32)}`;
  const hash = hashApiKey(key);
  const prefix = key.substring(0, 15); // "pe_live_abc123..."

  return { key, hash, prefix };
}

export const apiKeysRouter = router({
  /**
   * List all API keys for current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const keys = await db
      .select({
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        isActive: apiKey.isActive,
        lastUsedAt: apiKey.lastUsedAt,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      })
      .from(apiKey)
      .where(eq(apiKey.userId, ctx.session.user.id))
      .orderBy(desc(apiKey.createdAt));

    return keys;
  }),

  /**
   * Generate a new API key
   * Returns the full key ONCE - user must save it
   */
  generate: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required").max(100),
        expiresInDays: z.number().min(1).max(365).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { key, hash, prefix } = generateApiKey();

      // Calculate expiration date if specified
      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      await db.insert(apiKey).values({
        id: nanoid(),
        userId: ctx.session.user.id,
        name: input.name,
        keyHash: hash,
        keyPrefix: prefix,
        isActive: true,
        lastUsedAt: null,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await createNotification({
        userId: ctx.session.user.id,
        type: "api_key",
        title: "API key created",
        body: `${input.name} (${prefix}) created.`,
        metadata: {
          name: input.name,
          keyPrefix: prefix,
          expiresAt,
        },
      });

      // Return the full key ONCE
      // Frontend must show a warning to save it
      return {
        key,
        prefix,
        name: input.name,
        expiresAt,
      };
    }),

  /**
   * Revoke an API key (soft delete - set isActive to false)
   */
  revoke: protectedProcedure
    .input(
      z.object({
        keyId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify key belongs to user
      const result = await db
        .select({ userId: apiKey.userId, name: apiKey.name, keyPrefix: apiKey.keyPrefix })
        .from(apiKey)
        .where(eq(apiKey.id, input.keyId))
        .limit(1);

      if (!result.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }

      if (result[0].userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to revoke this key",
        });
      }

      // Revoke the key
      await db
        .update(apiKey)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(apiKey.id, input.keyId));

      await createNotification({
        userId: ctx.session.user.id,
        type: "api_key",
        title: "API key revoked",
        body: `${result[0].name} (${result[0].keyPrefix}) revoked.`,
        metadata: {
          keyId: input.keyId,
          name: result[0].name,
          keyPrefix: result[0].keyPrefix,
        },
      });

      return { success: true };
    }),

  /**
   * Delete an API key permanently
   */
  delete: protectedProcedure
    .input(
      z.object({
        keyId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify key belongs to user
      const result = await db
        .select({ userId: apiKey.userId, name: apiKey.name, keyPrefix: apiKey.keyPrefix })
        .from(apiKey)
        .where(eq(apiKey.id, input.keyId))
        .limit(1);

      if (!result.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }

      if (result[0].userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to delete this key",
        });
      }

      // Delete permanently
      await db.delete(apiKey).where(eq(apiKey.id, input.keyId));

      await createNotification({
        userId: ctx.session.user.id,
        type: "api_key",
        title: "API key deleted",
        body: `${result[0].name} (${result[0].keyPrefix}) deleted.`,
        metadata: {
          keyId: input.keyId,
          name: result[0].name,
          keyPrefix: result[0].keyPrefix,
        },
      });

      return { success: true };
    }),

  /**
   * Update API key name
   */
  updateName: protectedProcedure
    .input(
      z.object({
        keyId: z.string(),
        name: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify key belongs to user
      const result = await db
        .select({ userId: apiKey.userId, name: apiKey.name, keyPrefix: apiKey.keyPrefix })
        .from(apiKey)
        .where(eq(apiKey.id, input.keyId))
        .limit(1);

      if (!result.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }

      if (result[0].userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to update this key",
        });
      }

      await db
        .update(apiKey)
        .set({
          name: input.name,
          updatedAt: new Date(),
        })
        .where(eq(apiKey.id, input.keyId));

      await createNotification({
        userId: ctx.session.user.id,
        type: "api_key",
        title: "API key renamed",
        body: `${result[0].name} renamed to ${input.name}.`,
        metadata: {
          keyId: input.keyId,
          previousName: result[0].name,
          name: input.name,
          keyPrefix: result[0].keyPrefix,
        },
      });

      return { success: true };
    }),
});
