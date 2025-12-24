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
  brokerType: varchar("broker_type", { length: 50 }), // 'mt4', 'mt5', 'ctrader', 'other'
  brokerServer: varchar("broker_server", { length: 255 }), // MT5 server (e.g., "FTMO-Demo", "ICMarkets-Live03")
  accountNumber: varchar("account_number", { length: 100 }), // MT5 account number for unique identification
  preferredDataSource: varchar("preferred_data_source", { length: 50 }).default("dukascopy"), // 'dukascopy', 'alphavantage', 'truefx', 'broker'
  averageSpreadPips: numeric("average_spread_pips"), // User-reported average spread for calibration
  initialBalance: numeric("initial_balance"),
  initialCurrency: varchar("initial_currency", { length: 8 }),
  // Live account status (updated by EA)
  isVerified: integer("is_verified").default(0), // 0 = manual upload, 1 = EA-synced (verified)
  liveBalance: numeric("live_balance"), // Current account balance from EA
  liveEquity: numeric("live_equity"), // Current equity (balance + floating P&L)
  liveMargin: numeric("live_margin"), // Used margin
  liveFreeMargin: numeric("live_free_margin"), // Free margin available
  lastSyncedAt: timestamp("last_synced_at"), // Last time EA sent data
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
  useBrokerData: integer("use_broker_data").default(0), // 0 = use public data, 1 = has broker-specific data

  // Advanced trading metrics - Manipulation structure
  manipulationHigh: numeric("manipulation_high"), // High of manipulation leg (for longs/shorts)
  manipulationLow: numeric("manipulation_low"), // Low of manipulation leg (for longs/shorts)
  manipulationPips: numeric("manipulation_pips"), // Size of manipulation in pips (derived once)

  // Advanced trading metrics - Entry price action (cached for performance)
  entryPeakPrice: numeric("entry_peak_price"), // Max favorable price during trade (before exit)
  entryPeakTimestamp: timestamp("entry_peak_timestamp"), // When peak was reached

  // Advanced trading metrics - Post-exit price action (cached for performance)
  postExitPeakPrice: numeric("post_exit_peak_price"), // Max favorable price after exit
  postExitPeakTimestamp: timestamp("post_exit_peak_timestamp"), // When post-exit peak was reached
  postExitSamplingDuration: integer("post_exit_sampling_duration"), // Seconds sampled after exit (e.g., 3600 for 1h)

  // Advanced trading metrics - User configuration
  alphaWeightedMpe: numeric("alpha_weighted_mpe").default("0.30"), // User-configurable alpha for Est Weighted MPE (default 0.30)
  beThresholdPips: numeric("be_threshold_pips").default("0.5"), // BE threshold in pips (default 0.5)

  // Killzone tagging
  killzone: text("killzone"), // Killzone tag name (e.g., "London Open", "New York", etc.)
  killzoneColor: varchar("killzone_color", { length: 7 }), // Hex color for the killzone tag (e.g., "#FF5733")

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Open (active) trades - synced from EA in real-time
export const openTrade = pgTable("open_trade", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => tradingAccount.id, { onDelete: "cascade" }),
  ticket: varchar("ticket", { length: 100 }).notNull(), // MT5 ticket number (unique per broker)
  symbol: varchar("symbol", { length: 64 }).notNull(),
  tradeType: varchar("trade_type", { length: 8 }).notNull(), // long | short (buy | sell)
  volume: numeric("volume").notNull(), // Lot size
  openPrice: numeric("open_price").notNull(),
  openTime: timestamp("open_time").notNull(),
  sl: numeric("sl"), // Stop loss
  tp: numeric("tp"), // Take profit
  // Live floating data (updated on each tick)
  currentPrice: numeric("current_price"), // Current bid/ask depending on direction
  swap: numeric("swap").default("0"),
  commission: numeric("commission").default("0"),
  profit: numeric("profit").default("0"), // Floating profit/loss
  // Metadata
  comment: text("comment"),
  magicNumber: integer("magic_number"),
  lastUpdatedAt: timestamp("last_updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Historical OHLCV-like candle storage for 5m timeframe (or others)
// User-specific price data from EA
export const historicalPrices = pgTable("historical_prices", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }), // Privacy: each user only sees their data
  accountId: text("account_id").references(() => tradingAccount.id, { onDelete: "cascade" }), // Optional: link to specific account
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
