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

        // Expectancy = (Win% x Avg Win) – (Loss% x Avg Loss)
        const avgWin = winsCount > 0 ? grossProfit / winsCount : 0;
        const avgLoss = lossesCount > 0 ? grossLoss / lossesCount : 0; // grossLoss is absolute
        const winPct = totalTrades > 0 ? winsCount / totalTrades : 0;
        const lossPct = totalTrades > 0 ? lossesCount / totalTrades : 0;
        const expectancy = winPct * avgWin - lossPct * avgLoss;

        // Average hold time in seconds from trade_duration_seconds
        const holdAgg = await db
          .select({
            sumSec: sql<number>`COALESCE(SUM(CAST(NULLIF(${trade.tradeDurationSeconds}, '') AS NUMERIC)), 0)`,
            countSec: sql<number>`COALESCE(COUNT(NULLIF(${trade.tradeDurationSeconds}, '')), 0)`,
          })
          .from(trade)
          .where(eq(trade.accountId, accountId));
        const sumSec = holdAgg[0]?.sumSec ?? 0;
        const countSec = holdAgg[0]?.countSec ?? 0;
        const averageHoldSeconds = countSec > 0 ? sumSec / countSec : 0;

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

        const recentOutcomes = recentSorted
          .slice(0, 5)
          .map((r) => (r.profit > 0 ? "W" : ("L" as const)));

        let streak = 0;
        for (const r of recentSorted) {
          if (r.profit > 0) streak += 1;
          else break;
        }
        const winStreak = streak;

        // Approximate average R multiple when risk per trade unavailable:
        // R ≈ expectancy per trade / average loss magnitude
        let averageRMultiple: number | null = null;
        if (lossesCount > 0) {
          const avgLossRes = await db
            .select({
              avgLoss: sql<number>`COALESCE(AVG(ABS(CASE WHEN CAST(${trade.profit} AS NUMERIC) < 0 THEN CAST(${trade.profit} AS NUMERIC) END)), 0)`,
            })
            .from(trade)
            .where(eq(trade.accountId, accountId));
          const avgLoss = Math.max(1e-9, Number(avgLossRes[0]?.avgLoss || 0));
          const totalTradesAll = winsCount + lossesCount; // ignoring breakeven for proxy
          const expectancy =
            totalTradesAll > 0 ? totalProfit / totalTradesAll : 0;
          averageRMultiple = expectancy / avgLoss;
        }

        // Load initial balance for account balance computation
        const acctRows = await db
          .select({
            initialBalance: sql<
              string | null
            >`${tradingAccount.initialBalance}`,
          })
          .from(tradingAccount)
          .where(eq(tradingAccount.id, accountId))
          .limit(1);
        const initialBalanceNum =
          acctRows[0]?.initialBalance != null
            ? Number(acctRows[0].initialBalance)
            : 0;
        const accountBalance = initialBalanceNum + totalProfit;

        return {
          totalProfit,
          profitFactor,
          grossProfit,
          grossLoss,
          wins: winsCount,
          losses: lossesCount,
          winrate,
          winStreak,
          recentOutcomes,
          averageRMultiple,
          averageHoldSeconds,
          initialBalance: initialBalanceNum,
          accountBalance,
          expectancy,
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
        .limit(2000);

      const extractYmd = (raw: string | null, createdAt: Date): string => {
        if (raw) {
          const m = String(raw).match(/(\d{4})[-\/](\d{2})[-\/](\d{2})/);
          if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        }
        return new Date(createdAt.getTime()).toISOString().slice(0, 10);
      };

      // Derive day keys (Y-M-D) directly from raw open timestamps to avoid timezone drift
      const tradeDays = rows.map((r) => ({
        ymd: extractYmd(r.openRaw, r.createdAt),
        profit: Number(r.profit || 0),
      }));

      if (tradeDays.length === 0) return [] as const;

      // Determine range (Y-M-D inclusive)
      const ymdCompare = (a: string, b: string) => a.localeCompare(b);
      let minYmd = tradeDays.reduce(
        (m, r) => (ymdCompare(r.ymd, m) < 0 ? r.ymd : m),
        tradeDays[0].ymd
      );
      let maxYmd = tradeDays.reduce(
        (m, r) => (ymdCompare(r.ymd, m) > 0 ? r.ymd : m),
        tradeDays[0].ymd
      );
      let startYmd: string;
      let endYmd: string;
      if (input.startISO && input.endISO) {
        startYmd = String(input.startISO).slice(0, 10);
        endYmd = String(input.endISO).slice(0, 10);
      } else {
        endYmd = maxYmd;
        // compute start as last N-1 days before end
        const endD = new Date(`${endYmd}T00:00:00Z`);
        const startD = new Date(endD.getTime());
        const window = Math.min(input.days ?? maxWindowDays, maxWindowDays);
        startD.setUTCDate(endD.getUTCDate() - (window - 1));
        startYmd = startD.toISOString().slice(0, 10);
      }
      // Clamp to data bounds
      if (ymdCompare(startYmd, minYmd) < 0) startYmd = minYmd;
      if (ymdCompare(endYmd, maxYmd) > 0) endYmd = maxYmd;

      // Build continuous day keys from start..end
      const buckets: string[] = [];
      {
        const startD = new Date(`${startYmd}T00:00:00Z`);
        const endD = new Date(`${endYmd}T00:00:00Z`);
        for (
          let d = new Date(startD.getTime());
          d.getTime() <= endD.getTime();
          d.setUTCDate(d.getUTCDate() + 1)
        ) {
          buckets.push(d.toISOString().slice(0, 10));
        }
      }

      // Aggregate by day key
      const dayMap = new Map<string, { totalProfit: number; count: number }>();
      for (const t of tradeDays) {
        if (ymdCompare(t.ymd, startYmd) < 0 || ymdCompare(t.ymd, endYmd) > 0)
          continue;
        const prev = dayMap.get(t.ymd) || { totalProfit: 0, count: 0 };
        dayMap.set(t.ymd, {
          totalProfit: prev.totalProfit + t.profit,
          count: prev.count + 1,
        });
      }

      const byDay = buckets.map((ymd) => ({
        dateISO: ymd,
        totalProfit: dayMap.get(ymd)?.totalProfit || 0,
        count: dayMap.get(ymd)?.count || 0,
      }));

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

  // Aggregate profit by asset (symbol) within a selected date range
  profitByAssetRange: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        startISO: z.string().optional(),
        endISO: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const accountId = input.accountId;
      const rows = await db
        .select({
          profit: sql<number>`CAST(${trade.profit} AS NUMERIC)`,
          symbol: trade.symbol,
          openRaw: sql<string | null>`${trade.open}`,
          createdAt: trade.createdAt,
        })
        .from(trade)
        .where(eq(trade.accountId, accountId))
        .orderBy(desc(trade.createdAt));

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

      let startDate: Date | undefined;
      let endDate: Date | undefined;
      if (input.startISO && input.endISO) {
        startDate = new Date(input.startISO);
        endDate = new Date(input.endISO);
      }

      // Normalize to inclusive day bounds if provided
      if (startDate) startDate.setHours(0, 0, 0, 0);
      if (endDate) endDate.setHours(23, 59, 59, 999);

      const bySymbol = new Map<string, number>();
      for (const r of rows) {
        const ts = parseOpen(r.openRaw, r.createdAt);
        if (startDate && endDate) {
          if (ts < startDate.getTime() || ts > endDate.getTime()) continue;
        }
        const key = (r.symbol || "(Unknown)").trim();
        bySymbol.set(key, (bySymbol.get(key) ?? 0) + Number(r.profit || 0));
      }

      const result = Array.from(bySymbol.entries()).map(([symbol, total]) => ({
        symbol,
        totalProfit: total,
      }));

      // Sort by absolute profit desc for clearer ranking
      result.sort((a, b) => Math.abs(b.totalProfit) - Math.abs(a.totalProfit));
      return result;
    }),

  // Aggregate losses by asset (profit losses, commissions, swaps) within an optional date range
  lossesByAssetRange: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        startISO: z.string().optional(),
        endISO: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const accountId = input.accountId;
      const rows = await db
        .select({
          profit: sql<number>`CAST(${trade.profit} AS NUMERIC)`,
          commissions: sql<number>`CAST(${trade.commissions} AS NUMERIC)`,
          swap: sql<number>`CAST(${trade.swap} AS NUMERIC)`,
          symbol: trade.symbol,
          openRaw: sql<string | null>`${trade.open}`,
          createdAt: trade.createdAt,
        })
        .from(trade)
        .where(eq(trade.accountId, accountId))
        .orderBy(desc(trade.createdAt));

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

      let startDate: Date | undefined;
      let endDate: Date | undefined;
      if (input.startISO && input.endISO) {
        startDate = new Date(input.startISO);
        endDate = new Date(input.endISO);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      }

      const bySymbol = new Map<
        string,
        { profitLoss: number; commissionsLoss: number; swapLoss: number }
      >();
      for (const r of rows) {
        const ts = parseOpen(r.openRaw, r.createdAt);
        if (startDate && endDate) {
          if (ts < startDate.getTime() || ts > endDate.getTime()) continue;
        }
        const key = (r.symbol || "(Unknown)").trim();
        const profitLoss =
          Number(r.profit || 0) < 0 ? Math.abs(Number(r.profit || 0)) : 0;
        const commissionsLoss =
          Number(r.commissions || 0) < 0
            ? Math.abs(Number(r.commissions || 0))
            : 0;
        const swapLoss =
          Number(r.swap || 0) < 0 ? Math.abs(Number(r.swap || 0)) : 0;
        if (!bySymbol.has(key))
          bySymbol.set(key, { profitLoss: 0, commissionsLoss: 0, swapLoss: 0 });
        const agg = bySymbol.get(key)!;
        agg.profitLoss += profitLoss;
        agg.commissionsLoss += commissionsLoss;
        agg.swapLoss += swapLoss;
      }

      const result = Array.from(bySymbol.entries())
        .map(([symbol, v]) => ({
          symbol,
          profitLoss: v.profitLoss,
          commissionsLoss: v.commissionsLoss,
          swapLoss: v.swapLoss,
          totalLoss: v.profitLoss + v.commissionsLoss + v.swapLoss,
        }))
        .filter((r) => r.totalLoss > 0)
        .sort((a, b) => b.totalLoss - a.totalLoss);

      return result;
    }),

  // Daily profit over the entire account history (or a provided range)
  profitByDayOverall: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        startISO: z.string().optional(),
        endISO: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const accountId = input.accountId;
      const rows = await db
        .select({
          profit: sql<number>`CAST(${trade.profit} AS NUMERIC)`,
          openRaw: sql<string | null>`${trade.open}`,
          createdAt: trade.createdAt,
        })
        .from(trade)
        .where(eq(trade.accountId, accountId));

      const parseOpen = (raw: string | null, createdAt: Date): Date => {
        if (!raw) return createdAt;
        const cleaned = raw
          .replace(/[^0-9\-: T]/g, "")
          .replace("T", " ")
          .trim();
        const d = new Date(cleaned);
        return isNaN(d.getTime()) ? createdAt : d;
      };

      if (!rows.length)
        return {
          byDay: [] as {
            dateISO: string;
            totalProfit: number;
            count: number;
          }[],
        } as const;

      const dates = rows.map((r) => parseOpen(r.openRaw, r.createdAt));
      let minDate = dates.reduce(
        (m, d) => (d.getTime() < m.getTime() ? d : m),
        dates[0]
      );
      let maxDate = dates.reduce(
        (m, d) => (d.getTime() > m.getTime() ? d : m),
        dates[0]
      );

      // Clamp to provided range if given
      if (input.startISO) {
        const s = new Date(input.startISO);
        if (!isNaN(s.getTime())) minDate = s;
      }
      if (input.endISO) {
        const e = new Date(input.endISO);
        if (!isNaN(e.getTime())) maxDate = e;
      }
      minDate.setHours(0, 0, 0, 0);
      maxDate.setHours(0, 0, 0, 0);

      const toISODate = (d: Date) =>
        new Date(d.getTime()).toISOString().slice(0, 10);
      const startOfDay = (d: Date) => {
        const x = new Date(d);
        x.setHours(0, 0, 0, 0);
        return x;
      };

      // Seed continuous day buckets
      const sumMap = new Map<string, number>();
      const countMap = new Map<string, number>();
      {
        const cursor = new Date(minDate);
        while (cursor.getTime() <= maxDate.getTime()) {
          const key = toISODate(cursor);
          sumMap.set(key, 0);
          countMap.set(key, 0);
          cursor.setDate(cursor.getDate() + 1);
        }
      }

      for (let i = 0; i < rows.length; i++) {
        const d = parseOpen(rows[i].openRaw, rows[i].createdAt);
        if (d.getTime() < minDate.getTime() || d.getTime() > maxDate.getTime())
          continue;
        const key = toISODate(startOfDay(d));
        sumMap.set(key, (sumMap.get(key) ?? 0) + Number(rows[i].profit || 0));
        countMap.set(key, (countMap.get(key) ?? 0) + 1);
      }

      const byDay = Array.from(sumMap.entries()).map(
        ([dateISO, totalProfit]) => ({
          dateISO,
          totalProfit,
          count: countMap.get(dateISO) ?? 0,
        })
      );
      byDay.sort((a, b) => a.dateISO.localeCompare(b.dateISO));

      return { byDay } as const;
    }),

  // Trade counts by day/week/month within a selected range
  tradeCountsRange: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        startISO: z.string().min(1),
        endISO: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const accountId = input.accountId;
      const startDate = new Date(input.startISO);
      const endDate = new Date(input.endISO);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      const rows = await db
        .select({
          openRaw: sql<string | null>`${trade.open}`,
          createdAt: trade.createdAt,
        })
        .from(trade)
        .where(eq(trade.accountId, accountId))
        .orderBy(desc(trade.createdAt));

      const parseOpen = (raw: string | null, createdAt: Date): Date => {
        if (!raw) return createdAt;
        const cleaned = raw
          .replace(/[^0-9\-: T]/g, "")
          .replace("T", " ")
          .trim();
        const d = new Date(cleaned);
        return isNaN(d.getTime()) ? createdAt : d;
      };

      // Helpers
      const toISODate = (d: Date) =>
        new Date(d.getTime()).toISOString().slice(0, 10);
      const startOfDay = (d: Date) => {
        const x = new Date(d);
        x.setHours(0, 0, 0, 0);
        return x;
      };
      const startOfWeekMon = (d: Date) => {
        const x = startOfDay(d);
        const day = x.getDay(); // 0 Sun .. 6 Sat
        const diff = day === 0 ? -6 : 1 - day; // move to Monday
        x.setDate(x.getDate() + diff);
        return x;
      };
      const startOfMonth = (d: Date) => {
        const x = startOfDay(d);
        x.setDate(1);
        return x;
      };

      const dayMap = new Map<string, number>();
      const weekMap = new Map<string, number>();
      const monthMap = new Map<string, number>();

      for (const r of rows) {
        const d = parseOpen(r.openRaw, r.createdAt);
        if (
          d.getTime() < startDate.getTime() ||
          d.getTime() > endDate.getTime()
        )
          continue;
        const dayKey = toISODate(d);
        const weekKey = toISODate(startOfWeekMon(d));
        const monthKey = toISODate(startOfMonth(d)).slice(0, 7); // YYYY-MM
        dayMap.set(dayKey, (dayMap.get(dayKey) ?? 0) + 1);
        weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + 1);
        monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + 1);
      }

      const byDay = Array.from(dayMap.entries())
        .map(([dateISO, count]) => ({ dateISO, count }))
        .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
      const byWeek = Array.from(weekMap.entries())
        .map(([startISO, count]) => ({ startISO, count }))
        .sort((a, b) => a.startISO.localeCompare(b.startISO));
      const byMonth = Array.from(monthMap.entries())
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month));

      return { byDay, byWeek, byMonth } as const;
    }),

  // Trade counts over the entire account history (overall), with continuous buckets
  tradeCountsOverall: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ input }) => {
      const accountId = input.accountId;
      const rows = await db
        .select({
          openRaw: sql<string | null>`${trade.open}`,
          createdAt: trade.createdAt,
        })
        .from(trade)
        .where(eq(trade.accountId, accountId))
        .orderBy(desc(trade.createdAt));

      const parseOpen = (raw: string | null, createdAt: Date): Date => {
        if (!raw) return createdAt;
        const cleaned = raw
          .replace(/[^0-9\-: T]/g, "")
          .replace("T", " ")
          .trim();
        const d = new Date(cleaned);
        return isNaN(d.getTime()) ? createdAt : d;
      };

      if (!rows.length) return { byDay: [], byWeek: [], byMonth: [] } as const;

      const dates = rows.map((r) => parseOpen(r.openRaw, r.createdAt));
      let minDate = dates.reduce(
        (m, d) => (d.getTime() < m.getTime() ? d : m),
        dates[0]
      );
      let maxDate = dates.reduce(
        (m, d) => (d.getTime() > m.getTime() ? d : m),
        dates[0]
      );
      minDate.setHours(0, 0, 0, 0);
      maxDate.setHours(0, 0, 0, 0);

      const toISODate = (d: Date) =>
        new Date(d.getTime()).toISOString().slice(0, 10);
      const startOfDay = (d: Date) => {
        const x = new Date(d);
        x.setHours(0, 0, 0, 0);
        return x;
      };
      const startOfWeekMon = (d: Date) => {
        const x = startOfDay(d);
        const day = x.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        x.setDate(x.getDate() + diff);
        return x;
      };
      const startOfMonth = (d: Date) => {
        const x = startOfDay(d);
        x.setDate(1);
        return x;
      };

      // Seed continuous day buckets
      const byDayMap = new Map<string, number>();
      {
        const cursor = new Date(minDate);
        while (cursor.getTime() <= maxDate.getTime()) {
          byDayMap.set(toISODate(cursor), 0);
          cursor.setDate(cursor.getDate() + 1);
        }
      }

      // Count trades per day
      for (const d of dates) {
        const key = toISODate(d);
        byDayMap.set(key, (byDayMap.get(key) ?? 0) + 1);
      }

      // Build continuous week buckets (Monday-start) from min..max
      const byWeekMap = new Map<string, number>();
      {
        const firstWeekStart = startOfWeekMon(minDate);
        const lastWeekStart = startOfWeekMon(maxDate);
        const cursor = new Date(firstWeekStart);
        while (cursor.getTime() <= lastWeekStart.getTime()) {
          byWeekMap.set(toISODate(cursor), 0);
          cursor.setDate(cursor.getDate() + 7);
        }
        // Tally days into weeks
        for (const [dayISO, cnt] of byDayMap.entries()) {
          const d = new Date(dayISO);
          const wk = toISODate(startOfWeekMon(d));
          byWeekMap.set(wk, (byWeekMap.get(wk) ?? 0) + (cnt || 0));
        }
      }

      // Build continuous month buckets from min..max
      const byMonthMap = new Map<string, number>();
      {
        const firstMonth = startOfMonth(minDate);
        const lastMonth = startOfMonth(maxDate);
        const cursor = new Date(firstMonth);
        while (cursor.getTime() <= lastMonth.getTime()) {
          const key = toISODate(cursor).slice(0, 7);
          byMonthMap.set(key, 0);
          cursor.setMonth(cursor.getMonth() + 1);
        }
        for (const [dayISO, cnt] of byDayMap.entries()) {
          const d = new Date(dayISO);
          const key = toISODate(startOfMonth(d)).slice(0, 7);
          byMonthMap.set(key, (byMonthMap.get(key) ?? 0) + (cnt || 0));
        }
      }

      const byDay = Array.from(byDayMap.entries()).map(([dateISO, count]) => ({
        dateISO,
        count,
      }));
      const byWeek = Array.from(byWeekMap.entries()).map(
        ([startISO, count]) => ({ startISO, count })
      );
      const byMonth = Array.from(byMonthMap.entries()).map(
        ([month, count]) => ({ month, count })
      );

      return { byDay, byWeek, byMonth } as const;
    }),

  opensBounds: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ input }) => {
      const accountId = input.accountId;
      const rows = await db
        .select({
          openRaw: sql<string | null>`${trade.open}`,
          closeRaw: sql<string | null>`${trade.close}`,
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
      const parseClose = (raw: string | null, createdAt: Date): number => {
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
      const closes = rows.map((r) => parseClose(r.closeRaw, r.createdAt));
      const minTs = opens.reduce(
        (min, ts) => (min === 0 || ts < min ? ts : min),
        0
      );
      const maxTs = closes.reduce((max, ts) => (ts > max ? ts : max), 0);
      return {
        minISO: new Date(minTs || Date.now()).toISOString(),
        maxISO: new Date(maxTs || Date.now()).toISOString(),
      } as const;
    }),
});
