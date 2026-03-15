import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { db } from "../../db";
import { user as userTable } from "../../db/schema/auth";
import { trade, tradingAccount } from "../../db/schema/trading";

const ARCHIVED_ACCOUNT_IDS_KEY = "archivedAccountIds";

export function parseAccountNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function roundAccountNumber(value: number, precision = 2) {
  return Number(value.toFixed(precision));
}

export async function getOwnedAccount(userId: string, accountId: string) {
  const [account] = await db
    .select({
      id: tradingAccount.id,
      userId: tradingAccount.userId,
      name: tradingAccount.name,
      broker: tradingAccount.broker,
      isPropAccount: tradingAccount.isPropAccount,
      initialBalance: tradingAccount.initialBalance,
      liveBalance: tradingAccount.liveBalance,
      liveEquity: tradingAccount.liveEquity,
      isVerified: tradingAccount.isVerified,
      verificationLevel: tradingAccount.verificationLevel,
      lastSyncedAt: tradingAccount.lastSyncedAt,
    })
    .from(tradingAccount)
    .where(eq(tradingAccount.id, accountId))
    .limit(1);

  if (!account || account.userId !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Account not found",
    });
  }

  return account;
}

export async function getUserWidgetPreferences(userId: string) {
  const [user] = await db
    .select({ widgetPreferences: userTable.widgetPreferences })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  return (user?.widgetPreferences ?? {}) as Record<string, unknown>;
}

export async function updateUserWidgetPreferences(
  userId: string,
  nextPreferences: Record<string, unknown>
) {
  await db
    .update(userTable)
    .set({
      widgetPreferences: nextPreferences,
      updatedAt: new Date(),
    })
    .where(eq(userTable.id, userId));
}

export function getArchivedAccountIds(
  widgetPreferences: Record<string, unknown> | null | undefined
) {
  const rawValue = widgetPreferences?.[ARCHIVED_ACCOUNT_IDS_KEY];
  if (!Array.isArray(rawValue)) return [];
  return rawValue.filter((value): value is string => typeof value === "string");
}

export function setArchivedAccountIds(
  widgetPreferences: Record<string, unknown> | null | undefined,
  archivedAccountIds: string[]
) {
  return {
    ...(widgetPreferences ?? {}),
    [ARCHIVED_ACCOUNT_IDS_KEY]: [...new Set(archivedAccountIds)],
  };
}

export function resolveTradeTimestamp(row: {
  closeTime?: Date | null;
  openTime?: Date | null;
  createdAt: Date;
}) {
  return row.closeTime ?? row.openTime ?? row.createdAt;
}

export async function loadAccountTrades(accountId: string) {
  return db
    .select({
      profit: trade.profit,
      openTime: trade.openTime,
      closeTime: trade.closeTime,
      plannedRR: trade.plannedRR,
      realisedRR: trade.realisedRR,
      createdAt: trade.createdAt,
    })
    .from(trade)
    .where(eq(trade.accountId, accountId));
}
