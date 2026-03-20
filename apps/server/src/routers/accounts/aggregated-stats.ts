import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

import {
  convertCurrencyAmount,
  normalizeCurrencyCode,
} from "@profitabledge/contracts/currency";

import { db } from "../../db";
import { tradingAccount, trade } from "../../db/schema/trading";
import { protectedProcedure } from "../../lib/trpc";

import { parseAccountNumber, roundAccountNumber } from "./shared";

export const aggregatedStatsProcedure = protectedProcedure
  .input(
    z
      .object({
        currencyCode: z.string().trim().min(1).optional(),
      })
      .optional()
  )
  .query(async ({ ctx, input }) => {
    const targetCurrencyCode = normalizeCurrencyCode(input?.currencyCode);
    const accounts = await db
      .select({
        id: tradingAccount.id,
        name: tradingAccount.name,
        isPropAccount: tradingAccount.isPropAccount,
        initialBalance: tradingAccount.initialBalance,
        liveBalance: tradingAccount.liveBalance,
        initialCurrency: tradingAccount.initialCurrency,
      })
      .from(tradingAccount)
      .where(eq(tradingAccount.userId, ctx.session.user.id));

    if (accounts.length === 0) {
      return {
        accounts: [],
        totals: {
          totalBalance: 0,
          totalProfit: 0,
          overallWinRate: 0,
          overallExpectancy: 0,
        },
        currencyCode: targetCurrencyCode ?? null,
      };
    }

    const accountIds = accounts.map((account) => account.id);
    const accountCurrencyById = new Map(
      accounts.map((account) => [
        account.id,
        normalizeCurrencyCode(account.initialCurrency),
      ])
    );
    const trades = await db
      .select({
        accountId: trade.accountId,
        profit: trade.profit,
      })
      .from(trade)
      .where(inArray(trade.accountId, accountIds));

    const statsByAccount = new Map<
      string,
      { totalTrades: number; wins: number; totalProfit: number }
    >();

    for (const row of trades) {
      const accountStats = statsByAccount.get(row.accountId) ?? {
        totalTrades: 0,
        wins: 0,
        totalProfit: 0,
      };
      const profit = convertCurrencyAmount(
        parseAccountNumber(row.profit),
        accountCurrencyById.get(row.accountId),
        targetCurrencyCode
      );
      accountStats.totalTrades += 1;
      accountStats.totalProfit += profit;
      if (profit > 0) {
        accountStats.wins += 1;
      }
      statsByAccount.set(row.accountId, accountStats);
    }

    const totalBalance = accounts.reduce((sum, account) => {
      return (
        sum +
        convertCurrencyAmount(
          parseAccountNumber(
            account.liveBalance ?? account.initialBalance ?? 0
          ),
          account.initialCurrency,
          targetCurrencyCode
        )
      );
    }, 0);
    const totalProfit = [...statsByAccount.values()].reduce(
      (sum, accountStats) => sum + accountStats.totalProfit,
      0
    );
    const totalTrades = [...statsByAccount.values()].reduce(
      (sum, accountStats) => sum + accountStats.totalTrades,
      0
    );
    const totalWins = [...statsByAccount.values()].reduce(
      (sum, accountStats) => sum + accountStats.wins,
      0
    );

    const contributionDenominator =
      Math.abs(totalProfit) > 0
        ? Math.abs(totalProfit)
        : Math.max(
            1,
            [...statsByAccount.values()].reduce(
              (sum, accountStats) => sum + Math.abs(accountStats.totalProfit),
              0
            )
          );

    return {
      accounts: accounts.map((account) => {
        const stats = statsByAccount.get(account.id) ?? {
          totalTrades: 0,
          wins: 0,
          totalProfit: 0,
        };

        return {
          id: account.id,
          name: account.name,
          isPropAccount: account.isPropAccount ?? false,
          totalTrades: stats.totalTrades,
          winRate:
            stats.totalTrades > 0 ? (stats.wins / stats.totalTrades) * 100 : 0,
          totalProfit: roundAccountNumber(stats.totalProfit),
          contribution: roundAccountNumber(
            (stats.totalProfit / contributionDenominator) * 100,
            1
          ),
        };
      }),
      totals: {
        totalBalance: roundAccountNumber(totalBalance),
        totalProfit: roundAccountNumber(totalProfit),
        overallWinRate:
          totalTrades > 0
            ? roundAccountNumber((totalWins / totalTrades) * 100, 1)
            : 0,
        overallExpectancy:
          totalTrades > 0 ? roundAccountNumber(totalProfit / totalTrades) : 0,
      },
      currencyCode: targetCurrencyCode ?? null,
    };
  });
