import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "../db";
import { symbolMapping, trade, tradingAccount } from "../db/schema/trading";
import { getUserAccountIds } from "../lib/account-scope";
import {
  createSymbolResolver,
  inferSymbolAssetClass,
  listBuiltInSymbolMappings,
  listUserSymbolMappings,
  normalizeCanonicalSymbol,
  normalizeSymbolAliases,
} from "../lib/symbol-mapping";
import { protectedProcedure, router } from "../lib/trpc";
import { invalidateTradeScopeCaches } from "./trades/shared";

function toConflictKeys(value: string) {
  const normalized = normalizeCanonicalSymbol(value);
  const keys = new Set<string>();

  if (normalized) {
    keys.add(normalized);
    const loose = normalized.replace(/[^A-Z0-9]/g, "");
    if (loose) {
      keys.add(loose);
    }
  }

  return keys;
}

function assertNoMappingConflicts(
  existingRows: Awaited<ReturnType<typeof listUserSymbolMappings>>,
  nextCanonicalSymbol: string,
  nextAliases: string[],
  excludedId?: string
) {
  const nextKeys = new Set<string>();
  for (const value of [nextCanonicalSymbol, ...nextAliases]) {
    for (const key of toConflictKeys(value)) {
      nextKeys.add(key);
    }
  }

  for (const row of existingRows) {
    if (excludedId && row.id === excludedId) {
      continue;
    }

    for (const value of [row.canonicalSymbol, ...row.aliases]) {
      for (const key of toConflictKeys(value)) {
        if (nextKeys.has(key)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Mapping conflict with ${row.canonicalSymbol}`,
          });
        }
      }
    }
  }
}

export const symbolMappingsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await listUserSymbolMappings(ctx.session.user.id);

    return rows.map((row) => ({
      ...row,
      assetClass: inferSymbolAssetClass(row.canonicalSymbol) ?? "other",
    }));
  }),

  listBaseMappings: protectedProcedure.query(async () => {
    return listBuiltInSymbolMappings();
  }),

  listDetectedSymbols: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        rawSymbol: trade.symbol,
        tradeCount: sql<number>`COUNT(*)::int`,
      })
      .from(trade)
      .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
      .where(eq(tradingAccount.userId, ctx.session.user.id))
      .groupBy(trade.symbol)
      .orderBy(desc(sql`COUNT(*)`), trade.symbol);

    const userMappings = await listUserSymbolMappings(ctx.session.user.id);
    const resolver = createSymbolResolver(userMappings);

    return rows
      .map((row) => {
        const rawSymbol = normalizeCanonicalSymbol(row.rawSymbol);
        if (!rawSymbol) {
          return null;
        }

        const resolved = resolver.resolve(rawSymbol);
        return {
          rawSymbol,
          canonicalSymbol: resolved.canonicalSymbol,
          assetClass: resolved.assetClass,
          source: resolved.source,
          tradeCount: Number(row.tradeCount ?? 0),
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null);
  }),

  upsert: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1).optional(),
        canonicalSymbol: z.string().trim().min(1).max(64),
        aliases: z.array(z.string().trim().min(1).max(64)).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const canonicalSymbol = normalizeCanonicalSymbol(input.canonicalSymbol);
      const aliases = normalizeSymbolAliases(input.aliases).filter(
        (alias) => alias !== canonicalSymbol
      );

      if (!canonicalSymbol) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Enter a canonical symbol",
        });
      }

      if (aliases.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Add at least one alias",
        });
      }

      const existingRows = await listUserSymbolMappings(userId);
      const explicitTarget = input.id
        ? existingRows.find((row) => row.id === input.id)
        : undefined;

      if (input.id && !explicitTarget) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Symbol mapping not found",
        });
      }

      const targetRow =
        explicitTarget ??
        existingRows.find((row) => row.canonicalSymbol === canonicalSymbol);

      assertNoMappingConflicts(
        existingRows,
        canonicalSymbol,
        aliases,
        targetRow?.id
      );

      const now = new Date();
      const [savedRow] = targetRow
        ? await db
            .update(symbolMapping)
            .set({
              canonicalSymbol,
              aliases,
              updatedAt: now,
            })
            .where(
              and(
                eq(symbolMapping.id, targetRow.id),
                eq(symbolMapping.userId, userId)
              )
            )
            .returning({
              id: symbolMapping.id,
              canonicalSymbol: symbolMapping.canonicalSymbol,
              aliases: symbolMapping.aliases,
              createdAt: symbolMapping.createdAt,
              updatedAt: symbolMapping.updatedAt,
            })
        : await db
            .insert(symbolMapping)
            .values({
              id: crypto.randomUUID(),
              userId,
              canonicalSymbol,
              aliases,
              createdAt: now,
              updatedAt: now,
            })
            .returning({
              id: symbolMapping.id,
              canonicalSymbol: symbolMapping.canonicalSymbol,
              aliases: symbolMapping.aliases,
              createdAt: symbolMapping.createdAt,
              updatedAt: symbolMapping.updatedAt,
            });

      const accountIds = await getUserAccountIds(userId);
      await invalidateTradeScopeCaches(accountIds);

      return {
        id: savedRow.id,
        canonicalSymbol: normalizeCanonicalSymbol(savedRow.canonicalSymbol),
        aliases: normalizeSymbolAliases(savedRow.aliases),
        createdAt: savedRow.createdAt,
        updatedAt: savedRow.updatedAt,
        assetClass: inferSymbolAssetClass(savedRow.canonicalSymbol) ?? "other",
      };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [deletedRow] = await db
        .delete(symbolMapping)
        .where(
          and(
            eq(symbolMapping.id, input.id),
            eq(symbolMapping.userId, ctx.session.user.id)
          )
        )
        .returning({ id: symbolMapping.id });

      if (!deletedRow) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Symbol mapping not found",
        });
      }

      const accountIds = await getUserAccountIds(ctx.session.user.id);
      await invalidateTradeScopeCaches(accountIds);

      return { success: true } as const;
    }),
});
