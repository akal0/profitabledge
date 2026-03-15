import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createNotification } from "../lib/notifications";
import { protectedProcedure, router } from "../lib/trpc";
import {
  AI_PROVIDER_KEYS,
  deleteAIProviderKey,
  getAIProviderDisplayName,
  listUserAIProviderKeys,
  upsertAIProviderKey,
  validateAIProviderKey,
} from "../lib/ai/provider-keys";
import { buildAIUsageSummary } from "../lib/ai/provider-usage";

const providerSchema = z.enum(AI_PROVIDER_KEYS);

export const aiKeysRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return listUserAIProviderKeys(ctx.session.user.id);
  }),

  usage: protectedProcedure
    .input(
      z
        .object({
          days: z.number().int().min(7).max(90).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return buildAIUsageSummary(ctx.session.user.id, input?.days ?? 30);
    }),

  upsert: protectedProcedure
    .input(
      z.object({
        provider: providerSchema,
        apiKey: z.string().trim().min(10).max(512),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await validateAIProviderKey(input.provider, input.apiKey);
      } catch (error) {
        const providerLabel = getAIProviderDisplayName(input.provider);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            `Unable to validate that ${providerLabel} API key. Confirm it is active and has access to supported ${providerLabel} models.`,
        });
      }

      const result = await upsertAIProviderKey({
        userId: ctx.session.user.id,
        provider: input.provider,
        apiKey: input.apiKey,
      });

      await createNotification({
        userId: ctx.session.user.id,
        type: "settings_updated",
        title: "AI key connected",
        body: `${result.displayName} (${result.keyPrefix}) connected for supported AI usage.`,
        metadata: {
          provider: input.provider,
          keyPrefix: result.keyPrefix,
          url: "/dashboard/settings/ai",
        },
      });

      return result;
    }),

  delete: protectedProcedure
    .input(
      z.object({
        provider: providerSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await deleteAIProviderKey(ctx.session.user.id, input.provider);

      await createNotification({
        userId: ctx.session.user.id,
        type: "settings_updated",
        title: "AI key removed",
        body: "Personal AI key removed. Supported AI usage will fall back to your plan-funded Edge credits when the platform key path is used.",
        metadata: {
          provider: input.provider,
          url: "/dashboard/settings/ai",
        },
      });

      return { success: true };
    }),
});
