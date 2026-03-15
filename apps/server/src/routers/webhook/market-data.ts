import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

import { db } from "../../db";
import { tradingAccount, historicalPrices } from "../../db/schema/trading";
import { insertHistoricalPriceSnapshots } from "../../lib/price-ingestion";
import { publicProcedure } from "../../lib/trpc";
import { ENABLE_EA_CANDLE_INGESTION, verifyApiKey } from "./shared";

export const marketDataWebhookProcedures = {
  priceUpdate: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        accountId: z.string().optional(),
        accountNumber: z.string().optional(),
        prices: z.array(
          z.object({
            symbol: z.string(),
            bid: z.number(),
            ask: z.number(),
            timestamp: z.string(),
            bidVolume: z.number().optional(),
            askVolume: z.number().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const userId = await verifyApiKey(input.apiKey);

        if (!input.prices || input.prices.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No price data provided",
          });
        }

        if (input.prices.length > 100) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Too many prices in single request (max 100)",
          });
        }

        const accounts = await db
          .select({ id: tradingAccount.id })
          .from(tradingAccount)
          .where(
            input.accountId
              ? and(
                  eq(tradingAccount.id, input.accountId),
                  eq(tradingAccount.userId, userId)
                )
              : input.accountNumber
              ? and(
                  eq(tradingAccount.userId, userId),
                  eq(tradingAccount.accountNumber, input.accountNumber)
                )
              : eq(tradingAccount.userId, userId)
          )
          .limit(input.accountId || input.accountNumber ? 1 : 2);

        if (
          !accounts.length ||
          (!input.accountId && !input.accountNumber && accounts.length !== 1)
        ) {
          return {
            success: true,
            inserted: 0,
          };
        }

        const accountId = accounts[0]?.id;
        if (!accountId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Account not found",
          });
        }

        const result = await insertHistoricalPriceSnapshots({
          userId,
          accountId,
          snapshots: input.prices,
        });

        return {
          success: true,
          inserted: result.inserted,
        };
      } catch (error) {
        console.error("[priceUpdate] ERROR:", error);
        throw error;
      }
    }),

  candleUpdate: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        accountId: z.string().optional(),
        candles: z.array(
          z.object({
            symbol: z.string(),
            timeframe: z.enum(["m1", "m5", "m15", "m30", "h1", "h4", "d1"]),
            timestamp: z.string(),
            openBid: z.number(),
            highBid: z.number(),
            lowBid: z.number(),
            closeBid: z.number(),
            openAsk: z.number(),
            highAsk: z.number(),
            lowAsk: z.number(),
            closeAsk: z.number(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      if (!ENABLE_EA_CANDLE_INGESTION) {
        return {
          success: true,
          inserted: 0,
          skipped: true,
        };
      }

      const userId = await verifyApiKey(input.apiKey);

      if (!input.candles || input.candles.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No candle data provided",
        });
      }

      const records = input.candles.map((candle) => ({
        id: nanoid(),
        userId,
        accountId: input.accountId || null,
        symbol: candle.symbol.toUpperCase(),
        timeframe: candle.timeframe,
        priceType: null,
        time: new Date(candle.timestamp),
        openBid: candle.openBid.toString(),
        highBid: candle.highBid.toString(),
        lowBid: candle.lowBid.toString(),
        closeBid: candle.closeBid.toString(),
        openAsk: candle.openAsk.toString(),
        highAsk: candle.highAsk.toString(),
        lowAsk: candle.lowAsk.toString(),
        closeAsk: candle.closeAsk.toString(),
        open: candle.openBid.toString(),
        high: candle.highBid.toString(),
        low: candle.lowBid.toString(),
        close: candle.closeBid.toString(),
        bidPrice: null,
        askPrice: null,
        bidVolume: null,
        askVolume: null,
      }));

      const inserted = await db
        .insert(historicalPrices)
        .values(records)
        .onConflictDoNothing({
          target: [
            historicalPrices.accountId,
            historicalPrices.symbol,
            historicalPrices.timeframe,
            historicalPrices.time,
          ],
        })
        .returning({ id: historicalPrices.id });

      return {
        success: true,
        inserted: inserted.length,
      };
    }),

  ping: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const userId = await verifyApiKey(input.apiKey);

      return {
        success: true,
        message: "Connection OK",
        userId,
        timestamp: new Date().toISOString(),
      };
    }),
};
