import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db";
import { openTrade, trade, tradingAccount } from "../../db/schema/trading";
import { ALL_ACCOUNTS_ID } from "../../lib/account-scope";
import { enhancedCache } from "../../lib/enhanced-cache";

const ASSUMED_TZ_MINUTES = 0;

export const nullableHexColorSchema = z.union([
  z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  z.null(),
]);

export function parseNaiveAsTz(raw: string | null): Date | null {
  if (!raw) return null;
  const original = String(raw);

  if (/[zZ]|[+\-]\d{2}:?\d{2}$/.test(original)) {
    const date = new Date(original);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const cleaned = original
    .replace(/[^0-9\-: T]/g, "")
    .replace("T", " ")
    .trim();
  const match = cleaned.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6] || "0");
    const ms =
      Date.UTC(year, month, day, hour, minute, second) -
      ASSUMED_TZ_MINUTES * 60 * 1000;
    return new Date(ms);
  }

  const date = new Date(cleaned);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseNaiveAsUTC(raw: string | null): Date | null {
  if (!raw) return null;
  const original = String(raw);
  const cleaned = original
    .replace(/[^0-9\-: T]/g, "")
    .replace("T", " ")
    .trim();
  const match = cleaned.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] || "0");
  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

export function getMt5BrokerMeta(
  brokerMeta: unknown
): Record<string, unknown> | null {
  if (
    !brokerMeta ||
    typeof brokerMeta !== "object" ||
    Array.isArray(brokerMeta)
  ) {
    return null;
  }

  return brokerMeta as Record<string, unknown>;
}

export function getMt5BrokerString(
  brokerMeta: unknown,
  key: string
): string | null {
  const meta = getMt5BrokerMeta(brokerMeta);
  const value = meta?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function getMt5BrokerNumber(
  brokerMeta: unknown,
  key: string
): number | null {
  const meta = getMt5BrokerMeta(brokerMeta);
  const value = meta?.[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export async function invalidateTradeScopeCaches(accountIds: string[]) {
  const cacheTags = new Set<string>([`account:${ALL_ACCOUNTS_ID}`]);

  for (const accountId of accountIds) {
    if (accountId) {
      cacheTags.add(`account:${accountId}`);
    }
  }

  await enhancedCache.invalidateByTags([...cacheTags]);
}

export async function ensureAccountOwnership(
  userId: string,
  accountId: string
) {
  const accountRows = await db
    .select()
    .from(tradingAccount)
    .where(
      and(eq(tradingAccount.id, accountId), eq(tradingAccount.userId, userId))
    )
    .limit(1);

  if (!accountRows[0]) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Account not found" });
  }

  return accountRows[0];
}

export async function ensureTradeOwnership(userId: string, tradeId: string) {
  const tradeRows = await db
    .select({
      id: trade.id,
      accountId: trade.accountId,
    })
    .from(trade)
    .where(eq(trade.id, tradeId))
    .limit(1);

  if (!tradeRows[0]) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Trade not found" });
  }

  const accountRows = await db
    .select({ userId: tradingAccount.userId })
    .from(tradingAccount)
    .where(eq(tradingAccount.id, tradeRows[0].accountId))
    .limit(1);

  if (!accountRows[0] || accountRows[0].userId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
  }

  return tradeRows[0];
}

export async function ensureOpenTradeOwnership(
  userId: string,
  openTradeId: string
) {
  const openTradeRows = await db
    .select({
      id: openTrade.id,
      accountId: openTrade.accountId,
    })
    .from(openTrade)
    .where(eq(openTrade.id, openTradeId))
    .limit(1);

  if (!openTradeRows[0]) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Open trade not found" });
  }

  const accountRows = await db
    .select({ userId: tradingAccount.userId })
    .from(tradingAccount)
    .where(eq(tradingAccount.id, openTradeRows[0].accountId))
    .limit(1);

  if (!accountRows[0] || accountRows[0].userId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
  }

  return openTradeRows[0];
}

export async function ensureTradeBatchOwnership(
  userId: string,
  tradeIds: string[]
) {
  const trades = await db
    .select({
      id: trade.id,
      accountId: trade.accountId,
    })
    .from(trade)
    .where(inArray(trade.id, tradeIds));

  if (trades.length === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No trades found" });
  }

  const accountIds = [...new Set(trades.map((row) => row.accountId))];
  const accounts = await db
    .select({ id: tradingAccount.id, userId: tradingAccount.userId })
    .from(tradingAccount)
    .where(inArray(tradingAccount.id, accountIds));

  const isMissingAccount = accounts.length !== accountIds.length;
  const hasUnauthorizedAccount = accounts.some(
    (account) => account.userId !== userId
  );

  if (isMissingAccount || hasUnauthorizedAccount) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Unauthorized" });
  }

  return { trades, accountIds };
}

export function addTradeDateWindowClauses(
  whereClauses: SQL[],
  startISO?: string,
  endISO?: string
) {
  const parsedStart = startISO ? new Date(startISO) : null;
  const parsedEnd = endISO ? new Date(endISO) : null;
  const start =
    parsedStart && !Number.isNaN(parsedStart.getTime())
      ? new Date(parsedStart)
      : null;
  const end =
    parsedEnd && !Number.isNaN(parsedEnd.getTime())
      ? new Date(parsedEnd)
      : null;

  if (start) start.setUTCHours(0, 0, 0, 0);
  if (end) end.setUTCHours(23, 59, 59, 999);

  const openInWindow =
    start && end
      ? sql`${trade.openTime} IS NOT NULL AND ${trade.openTime} >= ${start} AND ${trade.openTime} <= ${end}`
      : start
      ? sql`${trade.openTime} IS NOT NULL AND ${trade.openTime} >= ${start}`
      : end
      ? sql`${trade.openTime} IS NOT NULL AND ${trade.openTime} <= ${end}`
      : null;

  const closeInWindow =
    start && end
      ? sql`${trade.closeTime} IS NOT NULL AND ${trade.closeTime} >= ${start} AND ${trade.closeTime} <= ${end}`
      : start
      ? sql`${trade.closeTime} IS NOT NULL AND ${trade.closeTime} >= ${start}`
      : end
      ? sql`${trade.closeTime} IS NOT NULL AND ${trade.closeTime} <= ${end}`
      : null;

  const fallbackInWindow =
    start && end
      ? sql`${trade.openTime} IS NULL AND ${trade.closeTime} IS NULL AND ${trade.createdAt} >= ${start} AND ${trade.createdAt} <= ${end}`
      : start
      ? sql`${trade.openTime} IS NULL AND ${trade.closeTime} IS NULL AND ${trade.createdAt} >= ${start}`
      : end
      ? sql`${trade.openTime} IS NULL AND ${trade.closeTime} IS NULL AND ${trade.createdAt} <= ${end}`
      : null;

  if (openInWindow || closeInWindow || fallbackInWindow) {
    const predicates = [openInWindow, closeInWindow, fallbackInWindow].filter(
      Boolean
    ) as SQL[];
    whereClauses.push(sql`(${sql.join(predicates, sql` OR `)})`);
  }
}

export function addNumericRangeClause(
  whereClauses: SQL[],
  expr: SQL,
  min?: number,
  max?: number
) {
  if (min == null && max == null) return;

  if (min != null && max != null) {
    whereClauses.push(
      sql`${expr} IS NOT NULL AND ${expr} >= ${min} AND ${expr} <= ${max}`
    );
    return;
  }

  if (min != null) {
    whereClauses.push(sql`${expr} IS NOT NULL AND ${expr} >= ${min}`);
    return;
  }

  whereClauses.push(sql`${expr} IS NOT NULL AND ${expr} <= ${max}`);
}
