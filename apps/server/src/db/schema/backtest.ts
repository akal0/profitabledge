import {
  pgTable,
  text,
  timestamp,
  integer,
  numeric,
  varchar,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";
import { tradingAccount, tradingRuleSet } from "./trading";

// ============== BACKTEST SESSIONS ==============

// Backtest Session - Stores a backtest session and its configuration
export const backtestSession = pgTable("backtest_session", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  
  // Session metadata
  name: text("name").notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, completed, archived
  
  // Symbol and timeframe configuration
  symbol: varchar("symbol", { length: 64 }).notNull(),
  timeframe: varchar("timeframe", { length: 16 }).notNull(), // 1m, 5m, 15m, 30m, 1h, 4h, 1d
  startDate: timestamp("start_date"), // Historical start date
  endDate: timestamp("end_date"), // Historical end date
  
  // Account configuration
  initialBalance: numeric("initial_balance").notNull().default("10000"),
  currency: varchar("currency", { length: 8 }).default("USD"),
  riskPercent: numeric("risk_percent").default("1"), // Default risk per trade
  defaultSLPips: integer("default_sl_pips").default(20),
  defaultTPPips: integer("default_tp_pips").default(40),
  
  // Session results (updated as session progresses)
  finalBalance: numeric("final_balance"),
  finalEquity: numeric("final_equity"),
  totalPnL: numeric("total_pnl"),
  totalPnLPercent: numeric("total_pnl_percent"),
  totalTrades: integer("total_trades").default(0),
  winningTrades: integer("winning_trades").default(0),
  losingTrades: integer("losing_trades").default(0),
  winRate: numeric("win_rate"),
  profitFactor: numeric("profit_factor"),
  maxDrawdown: numeric("max_drawdown"),
  maxDrawdownPercent: numeric("max_drawdown_percent"),
  sharpeRatio: numeric("sharpe_ratio"),
  averageRR: numeric("average_rr"),
  averageWin: numeric("average_win"),
  averageLoss: numeric("average_loss"),
  largestWin: numeric("largest_win"),
  largestLoss: numeric("largest_loss"),
  longestWinStreak: integer("longest_win_streak"),
  longestLoseStreak: integer("longest_lose_streak"),
  averageHoldTimeSeconds: integer("average_hold_time_seconds"),
  
  // Indicator configuration used during session
  indicatorConfig: jsonb("indicator_config").$type<{
    sma1?: { enabled: boolean; period: number; color: string };
    sma2?: { enabled: boolean; period: number; color: string };
    ema1?: { enabled: boolean; period: number; color: string };
    rsi?: { enabled: boolean; period: number };
    macd?: { enabled: boolean; fastPeriod: number; slowPeriod: number; signalPeriod: number };
    bb?: { enabled: boolean; period: number; stdDev: number };
    atr?: { enabled: boolean; period: number };
  }>(),
  
  // Playback state (for resumable sessions)
  lastCandleIndex: integer("last_candle_index"),
  playbackSpeed: numeric("playback_speed").default("1"),
  workspaceState: jsonb("workspace_state").$type<Record<string, unknown>>(),
  simulationConfig: jsonb("simulation_config").$type<Record<string, unknown>>(),
  linkedRuleSetId: text("linked_rule_set_id").references(() => tradingRuleSet.id, {
    onDelete: "set null",
  }),
  
  // Data source info
  dataSource: varchar("data_source", { length: 50 }).default("simulated"), // simulated, twelvedata, ea_candles
  candleSourceId: text("candle_source_id"), // Reference to ea_candle_data if using EA data
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  userIdx: index("idx_backtest_session_user").on(table.userId),
  userStatusIdx: index("idx_backtest_session_user_status").on(table.userId, table.status),
  symbolIdx: index("idx_backtest_session_symbol").on(table.symbol),
  linkedRuleSetIdx: index("idx_backtest_session_rule_set").on(table.linkedRuleSetId),
}));

// Backtest Trade - Individual trades within a backtest session
export const backtestTrade = pgTable("backtest_trade", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: text("session_id")
    .notNull()
    .references(() => backtestSession.id, { onDelete: "cascade" }),
  
  // Trade details
  direction: varchar("direction", { length: 8 }).notNull(), // long, short
  entryPrice: numeric("entry_price").notNull(),
  entryTime: timestamp("entry_time").notNull(),
  entryTimeUnix: integer("entry_time_unix"), // Unix timestamp for chart alignment
  entryBalance: numeric("entry_balance"),
  
  // Exit details (null if still open)
  exitPrice: numeric("exit_price"),
  exitTime: timestamp("exit_time"),
  exitTimeUnix: integer("exit_time_unix"),
  exitType: varchar("exit_type", { length: 20 }), // sl, tp, manual, timeout
  
  // Risk parameters
  sl: numeric("sl"),
  tp: numeric("tp"),
  slPips: numeric("sl_pips"),
  tpPips: numeric("tp_pips"),
  riskPercent: numeric("risk_percent"),
  
  // Position sizing
  volume: numeric("volume").notNull(),
  pipValue: numeric("pip_value"),
  fees: numeric("fees"),
  commission: numeric("commission"),
  swap: numeric("swap"),
  entrySpreadPips: numeric("entry_spread_pips"),
  entrySlippagePips: numeric("entry_slippage_pips"),
  exitSlippagePips: numeric("exit_slippage_pips"),
  slippagePrice: numeric("slippage_price"),
  
  // Results
  status: varchar("status", { length: 20 }).notNull().default("open"), // open, closed, stopped, target
  pnl: numeric("pnl"),
  pnlPercent: numeric("pnl_percent"),
  pnlPips: numeric("pnl_pips"),
  realizedRR: numeric("realized_rr"),
  
  // Execution quality metrics (for learning)
  mfePips: numeric("mfe_pips"), // Max favorable excursion during trade
  maePips: numeric("mae_pips"), // Max adverse excursion during trade
  holdTimeSeconds: integer("hold_time_seconds"),
  
  // User notes
  notes: text("notes"),
  tags: jsonb("tags").$type<string[]>(),
  
  // Chart state at entry (for replay/review)
  entryIndicatorValues: jsonb("entry_indicator_values").$type<{
    rsi?: number;
    macd?: number;
    macdSignal?: number;
    atr?: number;
    sma1?: number;
    sma2?: number;
    ema1?: number;
    bbUpper?: number;
    bbMiddle?: number;
    bbLower?: number;
  }>(),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  sessionIdx: index("idx_backtest_trade_session").on(table.sessionId),
  sessionStatusIdx: index("idx_backtest_trade_session_status").on(table.sessionId, table.status),
  directionIdx: index("idx_backtest_trade_direction").on(table.sessionId, table.direction),
}));

// ============== EA CANDLE DATA STORAGE ==============

// EA Candle Data Set - Metadata for a set of candles uploaded from EA
export const eaCandleDataSet = pgTable("ea_candle_data_set", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id")
    .references(() => tradingAccount.id, { onDelete: "set null" }), // Optional link to specific account
  
  // Dataset metadata
  name: text("name").notNull(), // User-defined name for this dataset
  description: text("description"),
  
  // Symbol and timeframe
  symbol: varchar("symbol", { length: 64 }).notNull(),
  timeframe: varchar("timeframe", { length: 16 }).notNull(), // tick, 1m, 5m, 15m, 30m, 1h, 4h, 1d
  
  // Data range
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  candleCount: integer("candle_count").notNull().default(0),
  
  // Source info
  broker: varchar("broker", { length: 100 }),
  brokerServer: varchar("broker_server", { length: 255 }),
  uploadedFrom: varchar("uploaded_from", { length: 50 }).default("ea"), // ea, csv, api
  
  // Quality metrics
  hasVolume: boolean("has_volume").default(false),
  hasBidAsk: boolean("has_bid_ask").default(false),
  gapCount: integer("gap_count").default(0), // Number of gaps in data
  averageSpread: numeric("average_spread"), // Average spread if bid/ask available
  
  // Status
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, archived, processing
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("idx_ea_candle_data_set_user").on(table.userId),
  userSymbolIdx: index("idx_ea_candle_data_set_user_symbol").on(table.userId, table.symbol),
  symbolTimeframeIdx: index("idx_ea_candle_data_set_symbol_tf").on(table.symbol, table.timeframe),
}));

// EA Candle - Individual candle data from EA
export const eaCandle = pgTable("ea_candle", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  dataSetId: text("data_set_id")
    .notNull()
    .references(() => eaCandleDataSet.id, { onDelete: "cascade" }),
  
  // Time
  time: timestamp("time").notNull(),
  timeUnix: integer("time_unix").notNull(), // Unix timestamp for fast lookups
  
  // OHLCV
  open: numeric("open").notNull(),
  high: numeric("high").notNull(),
  low: numeric("low").notNull(),
  close: numeric("close").notNull(),
  volume: numeric("volume"),
  tickVolume: integer("tick_volume"),
  
  // Optional bid/ask OHLC (for tick-level accuracy)
  openBid: numeric("open_bid"),
  highBid: numeric("high_bid"),
  lowBid: numeric("low_bid"),
  closeBid: numeric("close_bid"),
  openAsk: numeric("open_ask"),
  highAsk: numeric("high_ask"),
  lowAsk: numeric("low_ask"),
  closeAsk: numeric("close_ask"),
  
  // Spread at close (if available)
  spread: numeric("spread"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  dataSetTimeIdx: index("idx_ea_candle_dataset_time").on(table.dataSetId, table.timeUnix),
  uniqueDataSetTime: uniqueIndex("idx_ea_candle_unique").on(table.dataSetId, table.timeUnix),
}));

// ============== RELATIONS ==============

export const backtestSessionRelations = relations(backtestSession, ({ one, many }) => ({
  user: one(user, {
    fields: [backtestSession.userId],
    references: [user.id],
  }),
  trades: many(backtestTrade),
}));

export const backtestTradeRelations = relations(backtestTrade, ({ one }) => ({
  session: one(backtestSession, {
    fields: [backtestTrade.sessionId],
    references: [backtestSession.id],
  }),
}));

export const eaCandleDataSetRelations = relations(eaCandleDataSet, ({ one, many }) => ({
  user: one(user, {
    fields: [eaCandleDataSet.userId],
    references: [user.id],
  }),
  account: one(tradingAccount, {
    fields: [eaCandleDataSet.accountId],
    references: [tradingAccount.id],
  }),
  candles: many(eaCandle),
}));

export const eaCandleRelations = relations(eaCandle, ({ one }) => ({
  dataSet: one(eaCandleDataSet, {
    fields: [eaCandle.dataSetId],
    references: [eaCandleDataSet.id],
  }),
}));
