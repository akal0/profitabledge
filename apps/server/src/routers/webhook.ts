import { router, publicProcedure } from "../lib/trpc";
import { z } from "zod";
import { db } from "../db";
import { historicalPrices } from "../db/schema/trading";
import { apiKey } from "../db/schema/auth";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createHash } from "crypto";
import { nanoid } from "nanoid";

/**
 * Webhook Router for MT4/MT5 Expert Advisor Integration
 *
 * This router handles incoming price data from user's Expert Advisors
 * running on their MetaTrader terminals.
 */

/**
 * Hash API key for secure storage
 */
function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Verify API key and return user ID
 */
async function verifyApiKey(key: string): Promise<string> {
  const hash = hashApiKey(key);

  const result = await db
    .select({
      userId: apiKey.userId,
      isActive: apiKey.isActive,
      expiresAt: apiKey.expiresAt,
    })
    .from(apiKey)
    .where(eq(apiKey.keyHash, hash))
    .limit(1);

  if (!result.length) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid API key",
    });
  }

  const { userId, isActive, expiresAt } = result[0];

  if (!isActive) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "API key has been revoked",
    });
  }

  if (expiresAt && expiresAt < new Date()) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "API key has expired",
    });
  }

  // Update last used timestamp
  await db
    .update(apiKey)
    .set({ lastUsedAt: new Date(), updatedAt: new Date() })
    .where(eq(apiKey.keyHash, hash));

  return userId;
}

export const webhookRouter = router({
  /**
   * Receive price updates from MT4/MT5 EA
   * Called by EA every N seconds (or on every tick) with current prices
   */
  priceUpdate: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        accountId: z.string().optional(), // Optional: link to specific trading account
        prices: z.array(
          z.object({
            symbol: z.string(),
            bid: z.number(),
            ask: z.number(),
            timestamp: z.string(), // ISO 8601 format
            bidVolume: z.number().optional(),
            askVolume: z.number().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      // Verify API key
      const userId = await verifyApiKey(input.apiKey);

      // Validate input
      if (!input.prices || input.prices.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No price data provided",
        });
      }

      // Rate limiting: max 100 ticks per second
      if (input.prices.length > 100) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many prices in single request (max 100)",
        });
      }

      // Bulk insert price data
      const records = input.prices.map((price) => ({
        id: nanoid(),
        userId,
        accountId: input.accountId || null,
        symbol: price.symbol.toUpperCase(),
        timeframe: "tick" as const,
        priceType: null, // Tick data doesn't have specific price type
        time: new Date(price.timestamp),
        bidPrice: price.bid.toString(),
        askPrice: price.ask.toString(),
        bidVolume: price.bidVolume?.toString() || null,
        askVolume: price.askVolume?.toString() || null,
        // OHLC fields null for tick data
        open: null,
        high: null,
        low: null,
        close: null,
        openBid: null,
        highBid: null,
        lowBid: null,
        closeBid: null,
        openAsk: null,
        highAsk: null,
        lowAsk: null,
        closeAsk: null,
      }));

      await db.insert(historicalPrices).values(records);

      return {
        success: true,
        inserted: records.length,
      };
    }),

  /**
   * Receive aggregated candle data from EA (for M1, M5, etc.)
   * This is more efficient for long trades
   */
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
        // OHLC with bid/ask separation
        openBid: candle.openBid.toString(),
        highBid: candle.highBid.toString(),
        lowBid: candle.lowBid.toString(),
        closeBid: candle.closeBid.toString(),
        openAsk: candle.openAsk.toString(),
        highAsk: candle.highAsk.toString(),
        lowAsk: candle.lowAsk.toString(),
        closeAsk: candle.closeAsk.toString(),
        // Legacy OHLC fields (use bid as default)
        open: candle.openBid.toString(),
        high: candle.highBid.toString(),
        low: candle.lowBid.toString(),
        close: candle.closeBid.toString(),
        // Tick fields null for candle data
        bidPrice: null,
        askPrice: null,
        bidVolume: null,
        askVolume: null,
      }));

      await db.insert(historicalPrices).values(records);

      return {
        success: true,
        inserted: records.length,
      };
    }),

  /**
   * Health check endpoint for EA to verify connection
   */
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

  /**
   * Register/sync MT5 account from EA
   * Called when EA first starts or when account info changes
   */
  registerAccount: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        accountNumber: z.string().min(1),
        accountName: z.string().optional(),
        broker: z.string().optional(),
        brokerServer: z.string().optional(),
        initialBalance: z.number().optional(),
        currency: z.string().optional(),
        leverage: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      console.log("[registerAccount] Received request:", {
        accountNumber: input.accountNumber,
        broker: input.broker,
        brokerServer: input.brokerServer,
      });

      const userId = await verifyApiKey(input.apiKey);
      console.log("[registerAccount] API key verified for user:", userId);

      // Import the tradingAccount table
      const { tradingAccount } = await import("../db/schema/trading");

      // Check if account already exists for this user (by account number + broker server)
      const existing = await db
        .select()
        .from(tradingAccount)
        .where(
          and(
            eq(tradingAccount.userId, userId),
            eq(tradingAccount.accountNumber, input.accountNumber),
            eq(tradingAccount.brokerServer, input.brokerServer || "")
          )
        )
        .limit(1);

      if (existing.length > 0) {
        console.log("[registerAccount] Account already exists:", existing[0].id);
        // Account already exists, return it
        return {
          success: true,
          accountId: existing[0].id,
          message: "Account already registered",
        };
      }

      // Create new trading account
      const accountId = nanoid();
      const accountName =
        input.accountName || `MT5 ${input.accountNumber}`;
      const broker = input.broker?.toLowerCase() || "mt5";

      console.log("[registerAccount] Creating new account:", {
        accountId,
        accountName,
        accountNumber: input.accountNumber,
        broker,
        brokerServer: input.brokerServer,
        brokerType: "mt5",
      });

      await db.insert(tradingAccount).values({
        id: accountId,
        userId,
        name: accountName,
        broker,
        brokerServer: input.brokerServer || null,
        accountNumber: input.accountNumber,
        initialBalance: input.initialBalance?.toString() || null,
        initialCurrency: (input.currency as "$" | "£" | "€") || "$",
        brokerType: "mt5",
        createdAt: new Date(),
      });

      console.log("[registerAccount] Account created successfully:", accountId);

      return {
        success: true,
        accountId,
        message: "Account registered successfully",
      };
    }),

  /**
   * Update account equity and status from EA
   * Called periodically (every few seconds) with current account state
   */
  updateAccountStatus: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        accountNumber: z.string().min(1),
        balance: z.number(),
        equity: z.number(),
        margin: z.number().optional(),
        freeMargin: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const userId = await verifyApiKey(input.apiKey);

      const { tradingAccount } = await import("../db/schema/trading");

      // Find the account
      const accounts = await db
        .select()
        .from(tradingAccount)
        .where(
          and(
            eq(tradingAccount.userId, userId),
            eq(tradingAccount.accountNumber, input.accountNumber)
          )
        )
        .limit(1);

      if (!accounts.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found. Please register account first.",
        });
      }

      // Update live account status
      await db
        .update(tradingAccount)
        .set({
          liveBalance: input.balance.toString(),
          liveEquity: input.equity.toString(),
          liveMargin: input.margin?.toString() || null,
          liveFreeMargin: input.freeMargin?.toString() || null,
          isVerified: 1, // Mark as verified (EA-synced)
          lastSyncedAt: new Date(),
        })
        .where(eq(tradingAccount.id, accounts[0].id));

      return {
        success: true,
        message: "Account status updated",
      };
    }),

  /**
   * Sync open trades from EA
   * Called when trades open/close/modify
   */
  syncOpenTrades: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        accountNumber: z.string().min(1),
        trades: z.array(
          z.object({
            ticket: z.string(), // MT5 ticket number
            symbol: z.string(),
            type: z.enum(["buy", "sell"]), // long/short
            volume: z.number(),
            openPrice: z.number(),
            openTime: z.string(), // ISO 8601
            sl: z.number().optional(),
            tp: z.number().optional(),
            currentPrice: z.number(),
            swap: z.number().optional(),
            commission: z.number().optional(),
            profit: z.number(),
            comment: z.string().optional(),
            magicNumber: z.number().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const userId = await verifyApiKey(input.apiKey);

      const { tradingAccount, openTrade } = await import("../db/schema/trading");

      // Find the account
      const accounts = await db
        .select()
        .from(tradingAccount)
        .where(
          and(
            eq(tradingAccount.userId, userId),
            eq(tradingAccount.accountNumber, input.accountNumber)
          )
        )
        .limit(1);

      if (!accounts.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      const accountId = accounts[0].id;

      // Delete all existing open trades for this account (full sync approach)
      await db.delete(openTrade).where(eq(openTrade.accountId, accountId));

      // Insert new open trades
      if (input.trades.length > 0) {
        const records = input.trades.map((trade) => ({
          id: nanoid(),
          accountId,
          ticket: trade.ticket,
          symbol: trade.symbol.toUpperCase(),
          tradeType: trade.type === "buy" ? "long" : "short",
          volume: trade.volume.toString(),
          openPrice: trade.openPrice.toString(),
          openTime: new Date(trade.openTime),
          // MT5 sends 0 when no SL/TP is set, so treat 0 as null
          sl: trade.sl != null && trade.sl > 0 ? trade.sl.toString() : null,
          tp: trade.tp != null && trade.tp > 0 ? trade.tp.toString() : null,
          currentPrice: trade.currentPrice.toString(),
          swap: trade.swap?.toString() || "0",
          commission: trade.commission?.toString() || "0",
          profit: trade.profit.toString(),
          comment: trade.comment || null,
          magicNumber: trade.magicNumber || null,
          lastUpdatedAt: new Date(),
          createdAt: new Date(),
        }));

        await db.insert(openTrade).values(records);
      }

      return {
        success: true,
        synced: input.trades.length,
      };
    }),

  /**
   * Sync closed (historical) trades from EA
   * Called when EA detects new closed trades in account history
   */
  syncClosedTrades: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        accountNumber: z.string().min(1),
        trades: z.array(
          z.object({
            ticket: z.string(), // MT5 ticket number
            symbol: z.string(),
            type: z.enum(["buy", "sell"]), // long/short
            volume: z.number(),
            openPrice: z.number(),
            openTime: z.string(), // ISO 8601
            closePrice: z.number(),
            closeTime: z.string(), // ISO 8601
            sl: z.number().optional(),
            tp: z.number().optional(),
            swap: z.number().optional(),
            commission: z.number().optional(),
            profit: z.number(),
            comment: z.string().optional(),
            magicNumber: z.number().optional(),
            // Manipulation structure data (calculated by EA during trade)
            manipulationHigh: z.number().optional(), // Highest price during trade
            manipulationLow: z.number().optional(), // Lowest price during trade
            manipulationPips: z.number().optional(), // Adverse movement in pips
            entryPeakPrice: z.number().optional(), // Best price during trade (max favorable)
            entryPeakTimestamp: z.string().optional(), // When peak was reached
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const userId = await verifyApiKey(input.apiKey);

      const { tradingAccount, trade } = await import("../db/schema/trading");

      // Find the account
      const accounts = await db
        .select()
        .from(tradingAccount)
        .where(
          and(
            eq(tradingAccount.userId, userId),
            eq(tradingAccount.accountNumber, input.accountNumber)
          )
        )
        .limit(1);

      if (!accounts.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      const accountId = accounts[0].id;

      // Check for duplicate trades by unique combination of fields
      // Since we don't have ticket column, use symbol + openTime + closeTime + profit
      const existingTrades = await db
        .select({
          symbol: trade.symbol,
          open: trade.open,
          close: trade.close,
          profit: trade.profit,
        })
        .from(trade)
        .where(eq(trade.accountId, accountId));

      const existingTradeKeys = new Set(
        existingTrades.map(
          (t) => `${t.symbol}-${t.open}-${t.close}-${t.profit}`
        )
      );

      // Filter out duplicates and insert new closed trades
      const newTrades = input.trades.filter((t) => {
        const key = `${t.symbol.toUpperCase()}-${t.openTime}-${t.closeTime}-${t.profit}`;
        return !existingTradeKeys.has(key);
      });

      if (newTrades.length > 0) {
        const records = newTrades.map((t) => {
          const openTime = new Date(t.openTime);
          const closeTime = new Date(t.closeTime);
          const durationSeconds = Math.floor(
            (closeTime.getTime() - openTime.getTime()) / 1000
          );

          return {
            id: nanoid(),
            accountId,
            // Map to correct schema field names
            symbol: t.symbol.toUpperCase(),
            tradeType: t.type === "buy" ? "long" : ("short" as "long" | "short"),
            open: t.openTime,
            close: t.closeTime,
            openPrice: t.openPrice.toString(),
            closePrice: t.closePrice.toString(),
            volume: t.volume.toString(),
            // MT5 sends 0 when no SL/TP is set, so treat 0 as null
            sl: t.sl != null && t.sl > 0 ? t.sl.toString() : null,
            tp: t.tp != null && t.tp > 0 ? t.tp.toString() : null,
            swap: t.swap?.toString() || "0",
            commissions: t.commission?.toString() || "0",
            profit: t.profit.toString(),
            pips: null, // Calculate if needed
            tradeDurationSeconds: durationSeconds.toString(),
            useBrokerData: 1, // Mark as broker data
            // Manipulation structure data from EA
            manipulationHigh: t.manipulationHigh?.toString() || null,
            manipulationLow: t.manipulationLow?.toString() || null,
            manipulationPips: t.manipulationPips?.toString() || null,
            entryPeakPrice: t.entryPeakPrice?.toString() || null,
            entryPeakTimestamp: t.entryPeakTimestamp ? new Date(t.entryPeakTimestamp) : null,
            createdAt: new Date(),
          };
        });

        await db.insert(trade).values(records);
      }

      return {
        success: true,
        synced: newTrades.length,
        skipped: input.trades.length - newTrades.length,
      };
    }),
});
