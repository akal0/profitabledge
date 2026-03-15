import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db";
import { user as userTable } from "../../db/schema/auth";
import { tradingAccount } from "../../db/schema/trading";
import { protectedProcedure, publicProcedure } from "../../lib/trpc";

import {
  getOwnedAccount,
  loadAccountTrades,
  parseAccountNumber,
  resolveTradeTimestamp,
  roundAccountNumber,
} from "./shared";
import {
  buildTrackRecordShareId,
  buildTrackRecordVerificationHash,
  readTrackRecordAccountId,
} from "./track-record-links";

function computeTrackRecordStats(
  trades: Array<{
    profit: unknown;
    openTime?: Date | null;
    closeTime?: Date | null;
    plannedRR?: unknown;
    realisedRR?: unknown;
    createdAt: Date;
  }>,
  verificationLevel: string | null | undefined
) {
  const sortedTrades = [...trades].sort(
    (left, right) =>
      resolveTradeTimestamp(left).getTime() - resolveTradeTimestamp(right).getTime()
  );

  const pnls = sortedTrades.map((tradeRow) => parseAccountNumber(tradeRow.profit));
  const totalTrades = pnls.length;
  const totalPnl = pnls.reduce((sum, value) => sum + value, 0);
  const wins = pnls.filter((value) => value > 0).length;
  const grossProfit = pnls
    .filter((value) => value > 0)
    .reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(
    pnls.filter((value) => value < 0).reduce((sum, value) => sum + value, 0)
  );

  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const pnl of pnls) {
    equity += pnl;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }

  const rrValues = sortedTrades
    .map((tradeRow) =>
      parseAccountNumber(
        tradeRow.realisedRR != null && tradeRow.realisedRR !== ""
          ? tradeRow.realisedRR
          : tradeRow.plannedRR
      )
    )
    .filter((value) => Number.isFinite(value) && value > 0);

  const startDate = sortedTrades[0]
    ? resolveTradeTimestamp(sortedTrades[0]).toISOString().slice(0, 10)
    : null;
  const endDate = sortedTrades.at(-1)
    ? resolveTradeTimestamp(sortedTrades.at(-1)!).toISOString().slice(0, 10)
    : null;

  return {
    totalTrades,
    winRate:
      totalTrades > 0 ? roundAccountNumber((wins / totalTrades) * 100, 1) : 0,
    profitFactor:
      grossLoss > 0 ? roundAccountNumber(grossProfit / grossLoss, 2) : grossProfit > 0 ? 999 : 0,
    avgRR:
      rrValues.length > 0
        ? roundAccountNumber(
            rrValues.reduce((sum, value) => sum + value, 0) / rrValues.length,
            2
          )
        : 0,
    totalPnl: roundAccountNumber(totalPnl),
    maxDrawdown: roundAccountNumber(maxDrawdown),
    startDate,
    endDate,
    verificationLevel:
      verificationLevel && verificationLevel !== "unverified"
        ? verificationLevel
        : "manual",
  };
}

export const generateTrackRecordProcedure = protectedProcedure
  .input(
    z.object({
      accountId: z.string().min(1),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const account = await getOwnedAccount(ctx.session.user.id, input.accountId);
    const trades = await loadAccountTrades(account.id);
    const stats = computeTrackRecordStats(trades, account.verificationLevel);

    return {
      shareId: buildTrackRecordShareId(account.id),
      verificationHash: buildTrackRecordVerificationHash({
        accountId: account.id,
        totalTrades: stats.totalTrades,
        totalPnl: stats.totalPnl,
      }),
    };
  });

export const getTrackRecordProcedure = publicProcedure
  .input(
    z.object({
      shareId: z.string().min(1),
    })
  )
  .query(async ({ input }) => {
    const accountId = readTrackRecordAccountId(input.shareId);

    if (!accountId) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Track record not found",
      });
    }

    const [account] = await db
      .select({
        id: tradingAccount.id,
        userId: tradingAccount.userId,
        name: tradingAccount.name,
        broker: tradingAccount.broker,
        verificationLevel: tradingAccount.verificationLevel,
      })
      .from(tradingAccount)
      .where(eq(tradingAccount.id, accountId))
      .limit(1);

    if (!account) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Track record not found",
      });
    }

    const [trader] = await db
      .select({
        name: userTable.name,
        username: userTable.username,
        image: userTable.image,
      })
      .from(userTable)
      .where(eq(userTable.id, account.userId))
      .limit(1);

    const trades = await loadAccountTrades(account.id);
    const stats = computeTrackRecordStats(trades, account.verificationLevel);

    return {
      accountName: account.name,
      broker: account.broker,
      generatedAt: new Date().toISOString(),
      verificationHash: buildTrackRecordVerificationHash({
        accountId: account.id,
        totalTrades: stats.totalTrades,
        totalPnl: stats.totalPnl,
      }),
      trader: trader ?? null,
      stats,
    };
  });
