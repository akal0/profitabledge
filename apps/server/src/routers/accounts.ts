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

  recentByDay: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        days: z.number().min(1).max(31).optional(),
        startISO: z.string().optional(),
        endISO: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const accountId = input.accountId;
      const maxWindowDays = 7; // enforce max 7-day window

      const rows = await db
        .select({
          profit: sql<number>`CAST(${trade.profit} AS NUMERIC)`,
          openRaw: sql<string | null>`${trade.open}`,
          createdAt: trade.createdAt,
        })
        .from(trade)
        .where(eq(trade.accountId, accountId))
        .orderBy(desc(trade.createdAt))
        .limit(1000);

      const parseOpen = (raw: string | null, createdAt: Date): number => {
        if (!raw) return createdAt.getTime();
        const cleaned = raw
          .replace(/[^0-9\-: T]/g, "")
          .replace("T", " ")
          .trim();
        const d = new Date(cleaned);
        if (!isNaN(d.getTime())) return d.getTime();
        return createdAt.getTime();
      };

      // Compute min/max open across account
      const opens = rows.map((r) => parseOpen(r.openRaw, r.createdAt));
      const minOpenTs = opens.reduce(
        (min, ts) => (min === 0 || ts < min ? ts : min),
        0
      );
      const maxOpenTs = opens.reduce((max, ts) => (ts > max ? ts : max), 0);
      const minOpen = minOpenTs ? new Date(minOpenTs) : new Date();
      const maxOpen = maxOpenTs ? new Date(maxOpenTs) : new Date();

      // Determine range
      let startDate: Date;
      let endDate: Date;
      if (input.startISO && input.endISO) {
        startDate = new Date(input.startISO);
        endDate = new Date(input.endISO);
      } else {
        // Default: last 7 days ending at most recent open
        endDate = new Date(maxOpen);
        startDate = new Date(endDate);
        startDate.setDate(
          endDate.getDate() -
            (Math.min(input.days ?? maxWindowDays, maxWindowDays) - 1)
        );
      }

      // Clamp to opens bounds
      if (startDate < minOpen) startDate = new Date(minOpen);
      if (endDate > maxOpen) endDate = new Date(maxOpen);

      // Enforce max 7 days window
      const msPerDay = 24 * 60 * 60 * 1000;
      const diffDays =
        Math.floor(
          (endDate.setHours(0, 0, 0, 0) as unknown as number) / msPerDay
        ) -
        Math.floor(
          (startDate.setHours(0, 0, 0, 0) as unknown as number) / msPerDay
        ) +
        1;
      if (diffDays > maxWindowDays) {
        // Shrink window keeping the most recently selected end
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - (maxWindowDays - 1));
        if (startDate < minOpen) {
          startDate = new Date(minOpen);
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + (maxWindowDays - 1));
          if (endDate > maxOpen) endDate = new Date(maxOpen);
        }
      }

      // Build buckets from startDate..endDate inclusive
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      const buckets: { dateISO: string; tsStart: number; tsEnd: number }[] = [];
      let cursor = new Date(startDate);
      while (cursor.getTime() <= endDate.getTime()) {
        const d = new Date(cursor);
        const start = new Date(d);
        start.setHours(0, 0, 0, 0);
        const end = new Date(d);
        end.setHours(23, 59, 59, 999);
        buckets.push({
          dateISO: d.toISOString().slice(0, 10),
          tsStart: start.getTime(),
          tsEnd: end.getTime(),
        });
        cursor.setDate(cursor.getDate() + 1);
      }

      const trades = rows.map((r) => ({
        profit: r.profit,
        ts: parseOpen(r.openRaw, r.createdAt),
      }));
      const byDay = buckets.map((b) => {
        const tradesForDay = trades.filter(
          (t) => t.ts >= b.tsStart && t.ts <= b.tsEnd
        );
        const totalProfit = tradesForDay.reduce(
          (acc, t) => acc + Number(t.profit || 0),
          0
        );
        const count = tradesForDay.length;
        return { dateISO: b.dateISO, totalProfit, count };
      });

      const totalAbs = byDay.reduce(
        (acc, d) => acc + Math.abs(d.totalProfit),
        0
      );
      const withPct = byDay.map((d) => ({
        ...d,
        percent: totalAbs > 0 ? (d.totalProfit / totalAbs) * 100 : 0,
        dayNumber: Number(d.dateISO.slice(8, 10)),
      }));

      return withPct;
    }),

  opensBounds: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ input }) => {
      const accountId = input.accountId;
      const rows = await db
        .select({
          openRaw: sql<string | null>`${trade.open}`,
          createdAt: trade.createdAt,
        })
        .from(trade)
        .where(eq(trade.accountId, accountId));
      const parseOpen = (raw: string | null, createdAt: Date): number => {
        if (!raw) return createdAt.getTime();
        const cleaned = raw
          .replace(/[^0-9\-: T]/g, "")
          .replace("T", " ")
          .trim();
        const d = new Date(cleaned);
        if (!isNaN(d.getTime())) return d.getTime();
        return createdAt.getTime();
      };
      const opens = rows.map((r) => parseOpen(r.openRaw, r.createdAt));
      const minTs = opens.reduce(
        (min, ts) => (min === 0 || ts < min ? ts : min),
        0
      );
      const maxTs = opens.reduce((max, ts) => (ts > max ? ts : max), 0);
      return {
        minISO: new Date(minTs || Date.now()).toISOString(),
        maxISO: new Date(maxTs || Date.now()).toISOString(),
      } as const;
    }),
});
