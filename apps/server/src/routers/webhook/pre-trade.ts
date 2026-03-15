import { and, count, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db";
import { openTrade, trade, tradingRuleSet } from "../../db/schema/trading";
import { publicProcedure } from "../../lib/trpc";
import { findWebhookAccountIdByNumber, verifyApiKey } from "./shared";

export const preTradeWebhookProcedures = {
  evaluatePreTrade: publicProcedure
    .input(
      z.object({
        apiKey: z.string(),
        accountNumber: z.string(),
        symbol: z.string(),
        direction: z.enum(["buy", "sell"]),
        volume: z.number(),
        sl: z.number().optional(),
        tp: z.number().optional(),
        spread: z.number().optional(),
        entryPrice: z.number().optional(),
        accountBalance: z.number().optional(),
        accountEquity: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const userId = await verifyApiKey(input.apiKey);
      const accountId = await findWebhookAccountIdByNumber(
        userId,
        input.accountNumber
      );

      if (!accountId) {
        return { decision: "allow" as const, violations: [], warnings: [] };
      }

      const ruleSets = await db
        .select()
        .from(tradingRuleSet)
        .where(
          and(
            eq(tradingRuleSet.userId, userId),
            eq(tradingRuleSet.isActive, true)
          )
        );

      const applicableRules = ruleSets.filter(
        (ruleSet) => !ruleSet.accountId || ruleSet.accountId === accountId
      );

      if (!applicableRules.length) {
        return { decision: "allow" as const, violations: [], warnings: [] };
      }

      const violations: { rule: string; ruleSet: string; message: string }[] =
        [];
      const warnings: { rule: string; ruleSet: string; message: string }[] = [];

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [dailyTradeCount] = await db
        .select({ count: count() })
        .from(trade)
        .where(
          and(eq(trade.accountId, accountId), gte(trade.openTime, todayStart))
        );

      const [openTradeCount] = await db
        .select({ count: count() })
        .from(openTrade)
        .where(eq(openTrade.accountId, accountId));

      const currentDay = new Date().getDay();

      for (const ruleSet of applicableRules) {
        const rules = ruleSet.rules as Record<string, unknown>;
        const ruleSetName = ruleSet.name;

        if (rules.requireSL && !input.sl) {
          violations.push({
            rule: "requireSL",
            ruleSet: ruleSetName,
            message: "Stop loss is required",
          });
        }

        if (rules.requireTP && !input.tp) {
          violations.push({
            rule: "requireTP",
            ruleSet: ruleSetName,
            message: "Take profit is required",
          });
        }

        if (rules.maxEntrySpreadPips && input.spread) {
          if (input.spread > (rules.maxEntrySpreadPips as number)) {
            violations.push({
              rule: "maxEntrySpreadPips",
              ruleSet: ruleSetName,
              message: `Spread ${input.spread.toFixed(1)} exceeds max ${
                rules.maxEntrySpreadPips
              } pips`,
            });
          }
        }

        if (
          rules.allowedSymbols &&
          (rules.allowedSymbols as string[]).length > 0
        ) {
          const allowed = (rules.allowedSymbols as string[]).map((value) =>
            value.toUpperCase()
          );
          if (!allowed.includes(input.symbol.toUpperCase())) {
            violations.push({
              rule: "allowedSymbols",
              ruleSet: ruleSetName,
              message: `${input.symbol} is not in allowed symbols list`,
            });
          }
        }

        if (
          rules.blockedSymbols &&
          (rules.blockedSymbols as string[]).length > 0
        ) {
          const blocked = (rules.blockedSymbols as string[]).map((value) =>
            value.toUpperCase()
          );
          if (blocked.includes(input.symbol.toUpperCase())) {
            violations.push({
              rule: "blockedSymbols",
              ruleSet: ruleSetName,
              message: `${input.symbol} is blocked`,
            });
          }
        }

        if (rules.allowedDays && (rules.allowedDays as number[]).length > 0) {
          if (!(rules.allowedDays as number[]).includes(currentDay)) {
            violations.push({
              rule: "allowedDays",
              ruleSet: ruleSetName,
              message: "Trading not allowed on this day",
            });
          }
        }

        if (rules.maxDailyTrades) {
          if (
            (dailyTradeCount?.count ?? 0) >= (rules.maxDailyTrades as number)
          ) {
            violations.push({
              rule: "maxDailyTrades",
              ruleSet: ruleSetName,
              message: `Daily trade limit reached (${dailyTradeCount?.count}/${rules.maxDailyTrades})`,
            });
          }
        }

        if (rules.maxConcurrentTrades) {
          if (
            (openTradeCount?.count ?? 0) >=
            (rules.maxConcurrentTrades as number)
          ) {
            violations.push({
              rule: "maxConcurrentTrades",
              ruleSet: ruleSetName,
              message: `Max concurrent trades reached (${openTradeCount?.count}/${rules.maxConcurrentTrades})`,
            });
          }
        }

        if (rules.minPlannedRR && input.sl && input.tp && input.entryPrice) {
          const riskPips = Math.abs(input.entryPrice - input.sl);
          const rewardPips = Math.abs(input.tp - input.entryPrice);
          const plannedRR = riskPips > 0 ? rewardPips / riskPips : 0;
          if (plannedRR < (rules.minPlannedRR as number)) {
            violations.push({
              rule: "minPlannedRR",
              ruleSet: ruleSetName,
              message: `Planned RR ${plannedRR.toFixed(2)} below minimum ${
                rules.minPlannedRR
              }`,
            });
          }
        }

        if (
          rules.maxPositionSizePercent &&
          input.accountBalance &&
          input.entryPrice &&
          input.sl
        ) {
          const riskPerUnit = Math.abs(input.entryPrice - input.sl);
          const totalRisk = riskPerUnit * input.volume * 100000;
          const riskPercent = (totalRisk / input.accountBalance) * 100;
          if (riskPercent > (rules.maxPositionSizePercent as number)) {
            warnings.push({
              rule: "maxPositionSizePercent",
              ruleSet: ruleSetName,
              message: `Position risk ~${riskPercent.toFixed(1)}% exceeds max ${
                rules.maxPositionSizePercent
              }%`,
            });
          }
        }

        if (rules.maxDailyLossPercent && input.accountBalance) {
          const [dailyPnl] = await db
            .select({
              total: sql<number>`COALESCE(SUM(CAST(${trade.profit} AS DECIMAL)), 0)`,
            })
            .from(trade)
            .where(
              and(
                eq(trade.accountId, accountId),
                gte(trade.openTime, todayStart)
              )
            );
          const dailyLossPct =
            (Math.abs(Math.min(0, Number(dailyPnl?.total ?? 0))) /
              input.accountBalance) *
            100;
          if (dailyLossPct >= (rules.maxDailyLossPercent as number) * 0.8) {
            if (dailyLossPct >= (rules.maxDailyLossPercent as number)) {
              violations.push({
                rule: "maxDailyLossPercent",
                ruleSet: ruleSetName,
                message: `Daily loss limit reached (${dailyLossPct.toFixed(
                  1
                )}%/${rules.maxDailyLossPercent}%)`,
              });
            } else {
              warnings.push({
                rule: "maxDailyLossPercent",
                ruleSet: ruleSetName,
                message: `Approaching daily loss limit (${dailyLossPct.toFixed(
                  1
                )}%/${rules.maxDailyLossPercent}%)`,
              });
            }
          }
        }
      }

      const decision =
        violations.length > 0
          ? "block"
          : warnings.length > 0
          ? "warn"
          : "allow";

      return { decision, violations, warnings };
    }),
};
