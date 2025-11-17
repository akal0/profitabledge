import {
  pgTable,
  text,
  timestamp,
  integer,
  numeric,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const tradingAccount = pgTable("trading_account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  broker: text("broker").notNull(),
  initialBalance: numeric("initial_balance"),
  initialCurrency: varchar("initial_currency", { length: 8 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const trade = pgTable("trade", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => tradingAccount.id, { onDelete: "cascade" }),
  // CSV-derived fields
  open: text("open"),
  tradeType: varchar("trade_type", { length: 8 }), // long | short
  volume: numeric("volume"),
  symbol: varchar("symbol", { length: 64 }),
  openPrice: numeric("open_price"),
  sl: numeric("sl"),
  tp: numeric("tp"),
  close: text("close"),
  closePrice: numeric("close_price"),
  swap: numeric("swap"),
  commissions: numeric("commissions"),
  profit: numeric("profit"),
  pips: numeric("pips"),
  tradeDurationSeconds: text("trade_duration_seconds"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Historical OHLCV-like candle storage for 5m timeframe (or others)
export const historicalPrices = pgTable("historical_prices", {
  id: text("id").primaryKey(),
  symbol: varchar("symbol", { length: 64 }).notNull(),
  timeframe: varchar("timeframe", { length: 16 }).notNull(), // e.g., "tick", "5m"
  priceType: varchar("price_type", { length: 8 }), // bid | ask (for candle frames)
  time: timestamp("time").notNull(),
  // Optional OHLC fields for candle timeframes
  open: numeric("open"),
  high: numeric("high"),
  low: numeric("low"),
  close: numeric("close"),
  // Optional tick fields for tick timeframe
  bidPrice: numeric("bid_price"),
  askPrice: numeric("ask_price"),
  bidVolume: numeric("bid_volume"),
  askVolume: numeric("ask_volume"),
  // Merged bid/ask OHLC for candle timeframes
  openBid: numeric("open_bid"),
  highBid: numeric("high_bid"),
  lowBid: numeric("low_bid"),
  closeBid: numeric("close_bid"),
  openAsk: numeric("open_ask"),
  highAsk: numeric("high_ask"),
  lowAsk: numeric("low_ask"),
  closeAsk: numeric("close_ask"),
});
