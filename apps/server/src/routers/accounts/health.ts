import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db";
import { openTrade, trade, tradingAccount } from "../../db/schema/trading";
import { protectedProcedure } from "../../lib/trpc";

import { getOwnedAccount, parseAccountNumber, roundAccountNumber } from "./shared";

const healthInputSchema = z
  .object({
    accountId: z.string().min(1).optional(),
  })
  .optional();

export const healthScoreProcedure = protectedProcedure
  .input(healthInputSchema)
  .query(async ({ ctx, input }) => {
    const account =
      input?.accountId != null
        ? await getOwnedAccount(ctx.session.user.id, input.accountId)
        : (
            await db
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
              .where(eq(tradingAccount.userId, ctx.session.user.id))
              .limit(1)
          )[0];

    if (!account) {
      return {
        score: 0,
        factors: {
          recency: 0,
          verification: 0,
          activity: 0,
          balanceIntegrity: 0,
        },
      };
    }

    const tradeRows = await db
      .select({ profit: trade.profit })
      .from(trade)
      .where(eq(trade.accountId, account.id));

    const totalTrades = tradeRows.length;
    const wins = tradeRows.filter(
      (row) => parseAccountNumber(row.profit) > 0
    ).length;
    const winRate = totalTrades > 0 ? wins / totalTrades : 0;

    const syncAgeHours = account.lastSyncedAt
      ? (Date.now() - account.lastSyncedAt.getTime()) / (1000 * 60 * 60)
      : Number.POSITIVE_INFINITY;

    const factors = {
      recency:
        syncAgeHours <= 1
          ? 1
          : syncAgeHours <= 24
            ? 0.8
            : syncAgeHours <= 72
              ? 0.5
              : 0.2,
      verification: account.isVerified === 1 ? 1 : 0.45,
      activity: totalTrades >= 50 ? 1 : totalTrades >= 10 ? 0.75 : 0.4,
      balanceIntegrity:
        parseAccountNumber(account.liveBalance ?? account.initialBalance) > 0 &&
        parseAccountNumber(account.liveEquity ?? account.liveBalance ?? 0) >= 0
          ? 1
          : 0.4,
    };

    const score =
      factors.recency * 30 +
      factors.verification * 30 +
      factors.activity * 20 +
      Math.max(factors.balanceIntegrity, winRate) * 20;

    return {
      score: roundAccountNumber(score, 0),
      factors: {
        recency: roundAccountNumber(factors.recency * 100, 0),
        verification: roundAccountNumber(factors.verification * 100, 0),
        activity: roundAccountNumber(factors.activity * 100, 0),
        balanceIntegrity: roundAccountNumber(
          factors.balanceIntegrity * 100,
          0
        ),
      },
    };
  });

export const eaHealthProcedure = protectedProcedure
  .input(healthInputSchema)
  .query(async ({ ctx, input }) => {
    const accounts = await db
      .select({
        id: tradingAccount.id,
        name: tradingAccount.name,
        broker: tradingAccount.broker,
        isVerified: tradingAccount.isVerified,
        lastSyncedAt: tradingAccount.lastSyncedAt,
      })
      .from(tradingAccount)
      .where(eq(tradingAccount.userId, ctx.session.user.id));

    const filteredAccounts = input?.accountId
      ? accounts.filter((account) => account.id === input.accountId)
      : accounts;

    const healthRows = await Promise.all(
      filteredAccounts.map(async (account) => {
        const [openTradeCount] = await db
          .select({ count: openTrade.id })
          .from(openTrade)
          .where(eq(openTrade.accountId, account.id))
          .limit(1);

        const syncAgeMinutes = account.lastSyncedAt
          ? Math.max(
              0,
              Math.round(
                (Date.now() - account.lastSyncedAt.getTime()) / (1000 * 60)
              )
            )
          : null;

        return {
          accountId: account.id,
          accountName: account.name,
          broker: account.broker,
          isVerified: account.isVerified === 1,
          syncAgeMinutes,
          openTradeCount: openTradeCount ? 1 : 0,
          status:
            account.isVerified === 1 &&
            syncAgeMinutes != null &&
            syncAgeMinutes <= 60
              ? "healthy"
              : account.isVerified === 1
                ? "stale"
                : "manual",
        };
      })
    );

    return {
      accounts: healthRows,
      summary: {
        total: healthRows.length,
        healthy: healthRows.filter((row) => row.status === "healthy").length,
        stale: healthRows.filter((row) => row.status === "stale").length,
        manual: healthRows.filter((row) => row.status === "manual").length,
      },
    };
  });
