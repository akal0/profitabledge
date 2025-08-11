import { router, protectedProcedure } from "../lib/trpc";
import { db } from "../db";
import { tradingAccount, trade } from "../db/schema/trading";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const accountsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const rows = await db
      .select()
      .from(tradingAccount)
      .where(eq(tradingAccount.userId, userId))
      .orderBy(desc(tradingAccount.createdAt));
    return rows;
  }),
  metrics: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ input }) => {
      const accountId = input.accountId;

      const wins = await db
        .select({ count: sql<number>`count(*)` })
        .from(trade)
        .where(
          and(
            eq(trade.accountId, accountId),
            sql`CAST(${trade.profit} AS NUMERIC) > 0`
          )
        );

      const losses = await db
        .select({ count: sql<number>`count(*)` })
        .from(trade)
        .where(
          and(
            eq(trade.accountId, accountId),
            sql`CAST(${trade.profit} AS NUMERIC) < 0`
          )
        );

      const breakeven = await db
        .select({ count: sql<number>`count(*)` })
        .from(trade)
        .where(
          and(
            eq(trade.accountId, accountId),
            sql`CAST(${trade.profit} AS NUMERIC) = 0`
          )
        );

      const winsCount = wins[0]?.count ?? 0;
      const lossesCount = losses[0]?.count ?? 0;
      const breakevenCount = breakeven[0]?.count ?? 0;
      const total = winsCount + lossesCount + breakevenCount;
      const winrate = total > 0 ? (winsCount / total) * 100 : 0;
      return {
        wins: winsCount,
        losses: lossesCount,
        breakeven: breakevenCount,
        total,
        winrate,
      };
    }),
  stats: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const accountId = input.accountId;

        // Totals
        const totalProfitRes = await db
          .select({
            total: sql<number>`COALESCE(SUM(CAST(${trade.profit} AS NUMERIC)), 0)`,
          })
          .from(trade)
          .where(eq(trade.accountId, accountId));
        const totalProfit = totalProfitRes[0]?.total ?? 0;

        const grossProfitRes = await db
          .select({
            total: sql<number>`COALESCE(SUM(CASE WHEN CAST(${trade.profit} AS NUMERIC) > 0 THEN CAST(${trade.profit} AS NUMERIC) ELSE 0 END), 0)`,
          })
          .from(trade)
          .where(eq(trade.accountId, accountId));
        const grossLossRes = await db
          .select({
            total: sql<number>`COALESCE(SUM(CASE WHEN CAST(${trade.profit} AS NUMERIC) < 0 THEN CAST(${trade.profit} AS NUMERIC) ELSE 0 END), 0)`,
          })
          .from(trade)
          .where(eq(trade.accountId, accountId));

        const grossProfit = grossProfitRes[0]?.total ?? 0;
        const grossLoss = Math.abs(grossLossRes[0]?.total ?? 0);
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;

        // Wins/Losses
        const wins = await db
          .select({ count: sql<number>`count(*)` })
          .from(trade)
          .where(
            and(
              eq(trade.accountId, accountId),
              sql`CAST(${trade.profit} AS NUMERIC) > 0`
            )
          );
        const losses = await db
          .select({ count: sql<number>`count(*)` })
          .from(trade)
          .where(
            and(
              eq(trade.accountId, accountId),
              sql`CAST(${trade.profit} AS NUMERIC) < 0`
            )
          );
        const winsCount = wins[0]?.count ?? 0;
        const lossesCount = losses[0]?.count ?? 0;
        const totalTrades = winsCount + lossesCount;
        const winrate = totalTrades > 0 ? (winsCount / totalTrades) * 100 : 0;

        // Fetch recent trades and sort by parsed close timestamp on the server (JS) side
        const recentRows = await db
          .select({
            profit: sql<number>`CAST(${trade.profit} AS NUMERIC)`,
            closeRaw: sql<string | null>`${trade.close}`,
            createdAt: trade.createdAt,
          })
          .from(trade)
          .where(eq(trade.accountId, accountId))
          .orderBy(desc(trade.createdAt))
          .limit(500);

        const parseClose = (raw: string | null, createdAt: Date): number => {
          if (!raw) return createdAt.getTime();
          // strip quotes and unwanted chars, replace T with space
          const cleaned = raw
            .replace(/[^0-9\-: T]/g, "")
            .replace("T", " ")
            .trim();
          // Try Date parsing directly (Postgres::timestamp equivalent)
          const d = new Date(cleaned);
          if (!isNaN(d.getTime())) return d.getTime();
          return createdAt.getTime();
        };

        const recentSorted = recentRows
          .map((r) => ({ ...r, ts: parseClose(r.closeRaw, r.createdAt) }))
          .sort((a, b) => b.ts - a.ts)
          .slice(0, 100);

        // Debug logging
        console.log("[accounts.stats] accountId=", accountId);
        console.log("[accounts.stats] totals:", {
          totalProfit,
          grossProfit,
          grossLoss,
          profitFactor,
        });
        console.log("[accounts.stats] wl:", {
          winsCount,
          lossesCount,
          totalTrades,
          winrate,
        });
        console.log(
          "[accounts.stats] sample recent (first 3):",
          recentSorted.slice(0, 5)
        );

        const recentOutcomes = recentSorted
          .slice(0, 5)
          .map((r) => (r.profit > 0 ? "W" : ("L" as const)));

        let streak = 0;
        for (const r of recentSorted) {
          if (r.profit > 0) streak += 1;
          else break;
        }
        const winStreak = streak;

        return {
          totalProfit,
          profitFactor,
          wins: winsCount,
          losses: lossesCount,
          winrate,
          winStreak,
          recentOutcomes,
        };
      } catch (e) {
        console.error("[accounts.stats] error:", e);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to compute stats",
        });
      }
    }),
});
