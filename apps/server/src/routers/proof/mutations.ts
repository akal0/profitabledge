import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db";
import { publicAccountShare } from "../../db/schema/trading";
import { buildPublicProofPath } from "../../lib/public-proof/share-slug";
import { protectedProcedure } from "../../lib/trpc";
import {
  ensureOwnedProofAccount,
  generateUniquePublicAccountSlug,
  getLatestOwnedPublicShare,
  getProofOwnerIdentity,
} from "./shared";

export const proofMutationProcedures = {
  createOrRotate: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const owner = await getProofOwnerIdentity(ctx.session.user.id);
      if (!owner.username) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Set a username in Settings before creating a public proof link.",
        });
      }

      const account = await ensureOwnedProofAccount(
        ctx.session.user.id,
        input.accountId
      );

      const existingShare = await getLatestOwnedPublicShare(input.accountId);
      if (existingShare?.isActive) {
        await db
          .update(publicAccountShare)
          .set({
            isActive: false,
            revokedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(publicAccountShare.id, existingShare.id));
      }

      const publicAccountSlug = await generateUniquePublicAccountSlug(
        account.name
      );

      const [createdShare] = await db
        .insert(publicAccountShare)
        .values({
          userId: ctx.session.user.id,
          accountId: input.accountId,
          publicAccountSlug,
          isActive: true,
        })
        .returning({
          id: publicAccountShare.id,
          publicAccountSlug: publicAccountShare.publicAccountSlug,
          createdAt: publicAccountShare.createdAt,
        });

      return {
        ...createdShare,
        path: buildPublicProofPath(owner.username, publicAccountSlug),
      };
    }),

  revoke: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ensureOwnedProofAccount(ctx.session.user.id, input.accountId);

      const [activeShare] = await db
        .select({ id: publicAccountShare.id })
        .from(publicAccountShare)
        .where(
          and(
            eq(publicAccountShare.accountId, input.accountId),
            eq(publicAccountShare.userId, ctx.session.user.id),
            eq(publicAccountShare.isActive, true)
          )
        )
        .limit(1);

      if (!activeShare) {
        return { success: true, revoked: false };
      }

      await db
        .update(publicAccountShare)
        .set({
          isActive: false,
          revokedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(publicAccountShare.id, activeShare.id));

      return { success: true, revoked: true };
    }),
};
