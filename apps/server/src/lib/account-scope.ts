import { and, eq, inArray, sql, type SQL } from "drizzle-orm";

import { db } from "../db";
import { tradingAccount } from "../db/schema/trading";

export const ALL_ACCOUNTS_ID = "__all__";

export function isAllAccountsScope(accountId?: string | null): boolean {
  return accountId === ALL_ACCOUNTS_ID;
}

export async function getUserAccountIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: tradingAccount.id })
    .from(tradingAccount)
    .where(eq(tradingAccount.userId, userId));

  return rows.map((row) => row.id);
}

export async function resolveScopedAccountIds(
  userId: string,
  accountId: string
): Promise<string[]> {
  if (isAllAccountsScope(accountId)) {
    return getUserAccountIds(userId);
  }

  const rows = await db
    .select({ id: tradingAccount.id })
    .from(tradingAccount)
    .where(and(eq(tradingAccount.id, accountId), eq(tradingAccount.userId, userId)))
    .limit(1);

  return rows.map((row) => row.id);
}

export function buildAccountScopeCondition(
  column: any,
  accountIds: string[]
): SQL {
  if (accountIds.length === 0) {
    return sql`1 = 0`;
  }

  if (accountIds.length === 1) {
    return eq(column, accountIds[0]);
  }

  return inArray(column, accountIds);
}
