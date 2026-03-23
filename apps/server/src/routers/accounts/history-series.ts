import { desc, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db";
import { trade } from "../../db/schema/trading";
import {
  buildAccountScopeCondition,
  resolveScopedAccountIds,
} from "../../lib/account-scope";
import {
  createSymbolResolver,
  listUserSymbolMappings,
  summarizeSymbolGroups,
} from "../../lib/symbol-mapping";
import { protectedProcedure } from "../../lib/trpc";
import { TRPCError } from "@trpc/server";

type TradeOpenRow = {
  openTime: Date | null;
  openRaw: string | null;
  createdAt: Date;
};

type TradeCloseRow = {
  closeTime: Date | null;
  closeRaw: string | null;
  createdAt: Date;
};

function parseTradeTimestamp(raw: string | null): Date | null {
  if (!raw) return null;

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const cleaned = String(raw)
    .trim()
    .replace(/[./]/g, "-")
    .replace(/[^0-9\-: T]/g, "")
    .replace("T", " ")
    .trim();
  const normalized = new Date(cleaned);
  if (!Number.isNaN(normalized.getTime())) {
    return normalized;
  }

  const matched = String(raw).match(/(\d{4})[-/.](\d{2})[-/.](\d{2})/);
  if (!matched) {
    return null;
  }

  return new Date(`${matched[1]}-${matched[2]}-${matched[3]}T00:00:00Z`);
}

function extractTradeYmd(row: TradeOpenRow): string {
  if (row.openTime) {
    return row.openTime.toISOString().slice(0, 10);
  }

  if (row.openRaw) {
    const matched = String(row.openRaw).match(/(\d{4})[-/.](\d{2})[-/.](\d{2})/);
    if (matched) {
      return `${matched[1]}-${matched[2]}-${matched[3]}`;
    }
  }

  return new Date(row.createdAt.getTime()).toISOString().slice(0, 10);
}

function getTradeOpenTime(row: TradeOpenRow): Date {
  return row.openTime || parseTradeTimestamp(row.openRaw) || row.createdAt;
}

function getTradeCloseTime(row: TradeCloseRow): Date | null {
  return row.closeTime || parseTradeTimestamp(row.closeRaw) || null;
}

function getTradeOpenTimeMs(row: TradeOpenRow) {
  return getTradeOpenTime(row).getTime();
}

function getTradeCloseTimeMs(row: TradeCloseRow) {
  return (getTradeCloseTime(row) || row.createdAt).getTime();
}

function toIsoDate(value: Date) {
  return new Date(value.getTime()).toISOString().slice(0, 10);
}

function startOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeekMonday(value: Date) {
  const next = startOfDay(value);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function startOfMonth(value: Date) {
  const next = startOfDay(value);
  next.setDate(1);
  return next;
}

async function resolveAccountTradeScope(userId: string, accountId: string) {
  const accountIds = await resolveScopedAccountIds(userId, accountId);

  if (accountIds.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Account not found",
    });
  }

  return buildAccountScopeCondition(trade.accountId, accountIds);
}

export const recentByDayProcedure = protectedProcedure
  .input(
    z.object({
      accountId: z.string().min(1),
      days: z.number().min(1).max(31).optional(),
      startISO: z.string().optional(),
      endISO: z.string().optional(),
    })
  )
  .query(async ({ input, ctx }) => {
    const tradeScope = await resolveAccountTradeScope(
      ctx.session.user.id,
      input.accountId
    );
    const maxWindowDays = input.days ?? 42;

    const rows = await db
      .select({
        profit: sql<number>`CAST(${trade.profit} AS NUMERIC)`,
        commissions: sql<number | null>`CAST(${trade.commissions} AS NUMERIC)`,
        swap: sql<number | null>`CAST(${trade.swap} AS NUMERIC)`,
        openRaw: sql<string | null>`${trade.open}`,
        openTime: trade.openTime,
        createdAt: trade.createdAt,
      })
      .from(trade)
      .where(tradeScope)
      .orderBy(desc(trade.createdAt))
      .limit(2000);

    const tradeDays = rows.map((row) => ({
      ymd: extractTradeYmd(row),
      profit:
        Number(row.profit || 0) +
        Number(row.commissions || 0) +
        Number(row.swap || 0),
    }));

    if (tradeDays.length === 0) {
      return [] as const;
    }

    const ymdCompare = (left: string, right: string) =>
      left.localeCompare(right);
    const minYmd = tradeDays.reduce(
      (min, row) => (ymdCompare(row.ymd, min) < 0 ? row.ymd : min),
      tradeDays[0].ymd
    );
    const maxYmd = tradeDays.reduce(
      (max, row) => (ymdCompare(row.ymd, max) > 0 ? row.ymd : max),
      tradeDays[0].ymd
    );

    let startYmd: string;
    let endYmd: string;
    if (input.startISO && input.endISO) {
      startYmd = String(input.startISO).slice(0, 10);
      endYmd = String(input.endISO).slice(0, 10);
    } else {
      endYmd = maxYmd;
      const endDate = new Date(`${endYmd}T00:00:00Z`);
      const startDate = new Date(endDate.getTime());
      const window = Math.min(input.days ?? maxWindowDays, maxWindowDays);
      startDate.setUTCDate(endDate.getUTCDate() - (window - 1));
      startYmd = startDate.toISOString().slice(0, 10);
    }

    if (ymdCompare(startYmd, minYmd) < 0) startYmd = minYmd;
    if (ymdCompare(endYmd, maxYmd) > 0) endYmd = maxYmd;

    const buckets: string[] = [];
    {
      const startDate = new Date(`${startYmd}T00:00:00Z`);
      const endDate = new Date(`${endYmd}T00:00:00Z`);
      for (
        let date = new Date(startDate.getTime());
        date.getTime() <= endDate.getTime();
        date.setUTCDate(date.getUTCDate() + 1)
      ) {
        buckets.push(date.toISOString().slice(0, 10));
      }
    }

    const dayMap = new Map<string, { totalProfit: number; count: number }>();
    for (const tradeDay of tradeDays) {
      if (
        ymdCompare(tradeDay.ymd, startYmd) < 0 ||
        ymdCompare(tradeDay.ymd, endYmd) > 0
      ) {
        continue;
      }

      const previous = dayMap.get(tradeDay.ymd) ?? {
        totalProfit: 0,
        count: 0,
      };
      dayMap.set(tradeDay.ymd, {
        totalProfit: previous.totalProfit + tradeDay.profit,
        count: previous.count + 1,
      });
    }

    const byDay = buckets.map((ymd) => ({
      dateISO: ymd,
      totalProfit: dayMap.get(ymd)?.totalProfit || 0,
      count: dayMap.get(ymd)?.count || 0,
    }));

    const totalAbs = byDay.reduce(
      (sum, item) => sum + Math.abs(item.totalProfit),
      0
    );
    return byDay.map((item) => ({
      ...item,
      percent: totalAbs > 0 ? (item.totalProfit / totalAbs) * 100 : 0,
      dayNumber: Number(item.dateISO.slice(8, 10)),
    }));
  });

export const rangeSummaryProcedure = protectedProcedure
  .input(
    z.object({
      accountId: z.string().min(1),
      startISO: z.string().min(1),
      endISO: z.string().min(1),
    })
  )
  .query(async ({ input, ctx }) => {
    const tradeScope = await resolveAccountTradeScope(
      ctx.session.user.id,
      input.accountId
    );
    const startYmd = String(input.startISO).slice(0, 10);
    const endYmd = String(input.endISO).slice(0, 10);

    const rows = await db
      .select({
        profit: sql<number>`CAST(${trade.profit} AS NUMERIC)`,
        openRaw: sql<string | null>`${trade.open}`,
        closeRaw: sql<string | null>`${trade.close}`,
        openTime: trade.openTime,
        closeTime: trade.closeTime,
        tradeDurationSeconds: trade.tradeDurationSeconds,
        createdAt: trade.createdAt,
      })
      .from(trade)
      .where(tradeScope)
      .orderBy(desc(trade.createdAt))
      .limit(5000);

    if (rows.length === 0) {
      return {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        largestTrade: null,
        largestLoss: null,
      } as const;
    }

    let totalTrades = 0;
    let wins = 0;
    let losses = 0;
    let largestTrade: number | null = null;
    let largestLoss: number | null = null;
    let holdSumSeconds = 0;
    let holdCount = 0;

    for (const row of rows) {
      const ymd = extractTradeYmd(row);
      if (ymd < startYmd || ymd > endYmd) continue;

      const profit = Number(row.profit || 0);
      totalTrades += 1;
      if (profit > 0) wins += 1;
      if (profit < 0) losses += 1;
      if (profit > 0 && (largestTrade == null || profit > largestTrade)) {
        largestTrade = profit;
      }
      if (profit < 0 && (largestLoss == null || profit < largestLoss)) {
        largestLoss = profit;
      }

      const durationRaw = row.tradeDurationSeconds;
      let holdSeconds = durationRaw ? Number(durationRaw) : Number.NaN;
      const hasDuration = Number.isFinite(holdSeconds) && holdSeconds > 0;
      if (!hasDuration) {
        const close = getTradeCloseTime(row);
        if (!close) continue;
        const open = getTradeOpenTime(row);
        const diff = Math.floor((close.getTime() - open.getTime()) / 1000);
        holdSeconds = diff > 0 ? diff : Number.NaN;
      }

      if (Number.isFinite(holdSeconds) && holdSeconds > 0) {
        holdSumSeconds += holdSeconds;
        holdCount += 1;
      }
    }

    return {
      totalTrades,
      wins,
      losses,
      winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
      largestTrade,
      largestLoss,
      avgHoldSeconds: holdCount > 0 ? holdSumSeconds / holdCount : null,
    } as const;
  });

export const profitByAssetRangeProcedure = protectedProcedure
  .input(
    z.object({
      accountId: z.string().min(1),
      startISO: z.string().optional(),
      endISO: z.string().optional(),
    })
  )
  .query(async ({ input, ctx }) => {
    const tradeScope = await resolveAccountTradeScope(
      ctx.session.user.id,
      input.accountId
    );
    const userMappings = await listUserSymbolMappings(ctx.session.user.id);
    const symbolResolver = createSymbolResolver(userMappings);

    const rows = await db
      .select({
        profit: sql<number>`CAST(${trade.profit} AS NUMERIC)`,
        commissions: sql<number | null>`CAST(${trade.commissions} AS NUMERIC)`,
        swap: sql<number | null>`CAST(${trade.swap} AS NUMERIC)`,
        symbol: trade.symbol,
        openRaw: sql<string | null>`${trade.open}`,
        openTime: trade.openTime,
        createdAt: trade.createdAt,
      })
      .from(trade)
      .where(tradeScope)
      .orderBy(desc(trade.createdAt));

    let startDate: Date | undefined;
    let endDate: Date | undefined;
    if (input.startISO && input.endISO) {
      startDate = new Date(input.startISO);
      endDate = new Date(input.endISO);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    }

    const bySymbol = new Map<string, { totalProfit: number; displaySymbol: string }>();
    const groupDisplay = new Map(
      summarizeSymbolGroups(
        rows.map((row) => row.symbol).filter((value): value is string => Boolean(value)),
        userMappings
      ).map((group) => [group.canonicalSymbol, group.displaySymbol])
    );
    for (const row of rows) {
      const openTimeMs = getTradeOpenTimeMs(row);
      if (startDate && endDate) {
        if (
          openTimeMs < startDate.getTime() ||
          openTimeMs > endDate.getTime()
        ) {
          continue;
        }
      }

      const key = row.symbol
        ? symbolResolver.resolve(row.symbol).canonicalSymbol
        : "(UNKNOWN)";
      const existing = bySymbol.get(key) ?? {
        totalProfit: 0,
        displaySymbol: groupDisplay.get(key) ?? row.symbol ?? "(UNKNOWN)",
      };
      existing.totalProfit +=
        Number(row.profit || 0) +
        Number(row.commissions || 0) +
        Number(row.swap || 0);
      bySymbol.set(key, existing);
    }

    const result = Array.from(bySymbol.values()).map((value) => ({
      symbol: value.displaySymbol,
      totalProfit: value.totalProfit,
    }));
    result.sort((left, right) => Math.abs(right.totalProfit) - Math.abs(left.totalProfit));
    return result;
  });

export const lossesByAssetRangeProcedure = protectedProcedure
  .input(
    z.object({
      accountId: z.string().min(1),
      startISO: z.string().optional(),
      endISO: z.string().optional(),
    })
  )
  .query(async ({ input, ctx }) => {
    const tradeScope = await resolveAccountTradeScope(
      ctx.session.user.id,
      input.accountId
    );
    const userMappings = await listUserSymbolMappings(ctx.session.user.id);
    const symbolResolver = createSymbolResolver(userMappings);

    const rows = await db
      .select({
        profit: sql<number>`CAST(${trade.profit} AS NUMERIC)`,
        commissions: sql<number>`CAST(${trade.commissions} AS NUMERIC)`,
        swap: sql<number>`CAST(${trade.swap} AS NUMERIC)`,
        symbol: trade.symbol,
        openRaw: sql<string | null>`${trade.open}`,
        openTime: trade.openTime,
        createdAt: trade.createdAt,
      })
      .from(trade)
      .where(tradeScope)
      .orderBy(desc(trade.createdAt));

    let startDate: Date | undefined;
    let endDate: Date | undefined;
    if (input.startISO && input.endISO) {
      startDate = new Date(input.startISO);
      endDate = new Date(input.endISO);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    }

    const groupDisplay = new Map(
      summarizeSymbolGroups(
        rows.map((row) => row.symbol).filter((value): value is string => Boolean(value)),
        userMappings
      ).map((group) => [group.canonicalSymbol, group.displaySymbol])
    );
    const bySymbol = new Map<
      string,
      {
        displaySymbol: string;
        profitLoss: number;
        commissionsLoss: number;
        swapLoss: number;
      }
    >();
    for (const row of rows) {
      const openTimeMs = getTradeOpenTimeMs(row);
      if (startDate && endDate) {
        if (
          openTimeMs < startDate.getTime() ||
          openTimeMs > endDate.getTime()
        ) {
          continue;
        }
      }

      const key = row.symbol
        ? symbolResolver.resolve(row.symbol).canonicalSymbol
        : "(UNKNOWN)";
      const entry = bySymbol.get(key) ?? {
        displaySymbol: groupDisplay.get(key) ?? row.symbol ?? "(UNKNOWN)",
        profitLoss: 0,
        commissionsLoss: 0,
        swapLoss: 0,
      };
      entry.profitLoss += Number(row.profit || 0) < 0 ? Math.abs(Number(row.profit || 0)) : 0;
      entry.commissionsLoss +=
        Number(row.commissions || 0) < 0 ? Math.abs(Number(row.commissions || 0)) : 0;
      entry.swapLoss += Number(row.swap || 0) < 0 ? Math.abs(Number(row.swap || 0)) : 0;
      bySymbol.set(key, entry);
    }

    return Array.from(bySymbol.entries())
      .map(([, value]) => ({
        symbol: value.displaySymbol,
        profitLoss: value.profitLoss,
        commissionsLoss: value.commissionsLoss,
        swapLoss: value.swapLoss,
        totalLoss: value.profitLoss + value.commissionsLoss + value.swapLoss,
      }))
      .filter((item) => item.totalLoss > 0)
      .sort((left, right) => right.totalLoss - left.totalLoss);
  });

export const profitByDayOverallProcedure = protectedProcedure
  .input(
    z.object({
      accountId: z.string().min(1),
      startISO: z.string().optional(),
      endISO: z.string().optional(),
    })
  )
  .query(async ({ input, ctx }) => {
    const tradeScope = await resolveAccountTradeScope(
      ctx.session.user.id,
      input.accountId
    );

    const rows = await db
      .select({
        profit: sql<number>`CAST(${trade.profit} AS NUMERIC)`,
        openRaw: sql<string | null>`${trade.open}`,
        openTime: trade.openTime,
        createdAt: trade.createdAt,
      })
      .from(trade)
      .where(tradeScope);

    if (rows.length === 0) {
      return {
        byDay: [] as {
          dateISO: string;
          totalProfit: number;
          count: number;
        }[],
      } as const;
    }

    const dates = rows.map((row) => getTradeOpenTime(row));
    let minDate = dates.reduce(
      (min, date) => (date.getTime() < min.getTime() ? date : min),
      dates[0]
    );
    let maxDate = dates.reduce(
      (max, date) => (date.getTime() > max.getTime() ? date : max),
      dates[0]
    );

    if (input.startISO) {
      const startDate = new Date(input.startISO);
      if (!Number.isNaN(startDate.getTime())) minDate = startDate;
    }
    if (input.endISO) {
      const endDate = new Date(input.endISO);
      if (!Number.isNaN(endDate.getTime())) maxDate = endDate;
    }
    minDate = startOfDay(minDate);
    maxDate = startOfDay(maxDate);

    const sumMap = new Map<string, number>();
    const countMap = new Map<string, number>();
    {
      const cursor = new Date(minDate);
      while (cursor.getTime() <= maxDate.getTime()) {
        const key = toIsoDate(cursor);
        sumMap.set(key, 0);
        countMap.set(key, 0);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    for (const row of rows) {
      const openTime = getTradeOpenTime(row);
      if (
        openTime.getTime() < minDate.getTime() ||
        openTime.getTime() > maxDate.getTime()
      ) {
        continue;
      }

      const key = toIsoDate(startOfDay(openTime));
      sumMap.set(key, (sumMap.get(key) ?? 0) + Number(row.profit || 0));
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }

    const byDay = Array.from(sumMap.entries()).map(([dateISO, totalProfit]) => ({
      dateISO,
      totalProfit,
      count: countMap.get(dateISO) ?? 0,
    }));
    byDay.sort((left, right) => left.dateISO.localeCompare(right.dateISO));

    return { byDay } as const;
  });

export const tradeCountsRangeProcedure = protectedProcedure
  .input(
    z.object({
      accountId: z.string().min(1),
      startISO: z.string().min(1),
      endISO: z.string().min(1),
    })
  )
  .query(async ({ input, ctx }) => {
    const tradeScope = await resolveAccountTradeScope(
      ctx.session.user.id,
      input.accountId
    );
    const startDate = new Date(input.startISO);
    const endDate = new Date(input.endISO);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const rows = await db
      .select({
        openRaw: sql<string | null>`${trade.open}`,
        openTime: trade.openTime,
        createdAt: trade.createdAt,
      })
      .from(trade)
      .where(tradeScope)
      .orderBy(desc(trade.createdAt));

    const dayMap = new Map<string, number>();
    const weekMap = new Map<string, number>();
    const monthMap = new Map<string, number>();

    for (const row of rows) {
      const openTime = getTradeOpenTime(row);
      if (
        openTime.getTime() < startDate.getTime() ||
        openTime.getTime() > endDate.getTime()
      ) {
        continue;
      }

      const dayKey = toIsoDate(openTime);
      const weekKey = toIsoDate(startOfWeekMonday(openTime));
      const monthKey = toIsoDate(startOfMonth(openTime)).slice(0, 7);
      dayMap.set(dayKey, (dayMap.get(dayKey) ?? 0) + 1);
      weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + 1);
      monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + 1);
    }

    return {
      byDay: Array.from(dayMap.entries())
        .map(([dateISO, count]) => ({ dateISO, count }))
        .sort((left, right) => left.dateISO.localeCompare(right.dateISO)),
      byWeek: Array.from(weekMap.entries())
        .map(([startISO, count]) => ({ startISO, count }))
        .sort((left, right) => left.startISO.localeCompare(right.startISO)),
      byMonth: Array.from(monthMap.entries())
        .map(([month, count]) => ({ month, count }))
        .sort((left, right) => left.month.localeCompare(right.month)),
    } as const;
  });

export const tradeCountsOverallProcedure = protectedProcedure
  .input(z.object({ accountId: z.string().min(1) }))
  .query(async ({ input, ctx }) => {
    const tradeScope = await resolveAccountTradeScope(
      ctx.session.user.id,
      input.accountId
    );

    const rows = await db
      .select({
        openRaw: sql<string | null>`${trade.open}`,
        openTime: trade.openTime,
        createdAt: trade.createdAt,
      })
      .from(trade)
      .where(tradeScope)
      .orderBy(desc(trade.createdAt));

    if (rows.length === 0) {
      return { byDay: [], byWeek: [], byMonth: [] } as const;
    }

    const dates = rows.map((row) => getTradeOpenTime(row));
    let minDate = dates.reduce(
      (min, date) => (date.getTime() < min.getTime() ? date : min),
      dates[0]
    );
    let maxDate = dates.reduce(
      (max, date) => (date.getTime() > max.getTime() ? date : max),
      dates[0]
    );
    minDate = startOfDay(minDate);
    maxDate = startOfDay(maxDate);

    const byDayMap = new Map<string, number>();
    {
      const cursor = new Date(minDate);
      while (cursor.getTime() <= maxDate.getTime()) {
        byDayMap.set(toIsoDate(cursor), 0);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    for (const date of dates) {
      const key = toIsoDate(date);
      byDayMap.set(key, (byDayMap.get(key) ?? 0) + 1);
    }

    const byWeekMap = new Map<string, number>();
    {
      const firstWeekStart = startOfWeekMonday(minDate);
      const lastWeekStart = startOfWeekMonday(maxDate);
      const cursor = new Date(firstWeekStart);
      while (cursor.getTime() <= lastWeekStart.getTime()) {
        byWeekMap.set(toIsoDate(cursor), 0);
        cursor.setDate(cursor.getDate() + 7);
      }

      for (const [dayISO, count] of byDayMap.entries()) {
        const weekKey = toIsoDate(startOfWeekMonday(new Date(dayISO)));
        byWeekMap.set(weekKey, (byWeekMap.get(weekKey) ?? 0) + count);
      }
    }

    const byMonthMap = new Map<string, number>();
    {
      const firstMonth = startOfMonth(minDate);
      const lastMonth = startOfMonth(maxDate);
      const cursor = new Date(firstMonth);
      while (cursor.getTime() <= lastMonth.getTime()) {
        const key = toIsoDate(cursor).slice(0, 7);
        byMonthMap.set(key, 0);
        cursor.setMonth(cursor.getMonth() + 1);
      }

      for (const [dayISO, count] of byDayMap.entries()) {
        const monthKey = toIsoDate(startOfMonth(new Date(dayISO))).slice(0, 7);
        byMonthMap.set(monthKey, (byMonthMap.get(monthKey) ?? 0) + count);
      }
    }

    return {
      byDay: Array.from(byDayMap.entries()).map(([dateISO, count]) => ({
        dateISO,
        count,
      })),
      byWeek: Array.from(byWeekMap.entries()).map(([startISO, count]) => ({
        startISO,
        count,
      })),
      byMonth: Array.from(byMonthMap.entries()).map(([month, count]) => ({
        month,
        count,
      })),
    } as const;
  });

export const opensBoundsProcedure = protectedProcedure
  .input(z.object({ accountId: z.string().min(1) }))
  .query(async ({ input, ctx }) => {
    const tradeScope = await resolveAccountTradeScope(
      ctx.session.user.id,
      input.accountId
    );

    const rows = await db
      .select({
        openRaw: sql<string | null>`${trade.open}`,
        closeRaw: sql<string | null>`${trade.close}`,
        openTime: trade.openTime,
        closeTime: trade.closeTime,
        createdAt: trade.createdAt,
      })
      .from(trade)
      .where(tradeScope);

    if (rows.length === 0) {
      const now = new Date().toISOString();
      return { minISO: now, maxISO: now } as const;
    }

    const opens = rows.map((row) => getTradeOpenTimeMs(row));
    const closes = rows.map((row) => getTradeCloseTimeMs(row));
    const minTs = opens.reduce(
      (min, time) => (min === 0 || time < min ? time : min),
      0
    );
    const maxTs = closes.reduce((max, time) => (time > max ? time : max), 0);
    return {
      minISO: new Date(minTs || Date.now()).toISOString(),
      maxISO: new Date(maxTs || Date.now()).toISOString(),
    } as const;
  });
