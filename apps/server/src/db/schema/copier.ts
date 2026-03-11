import {
  pgTable,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { tradingAccount } from "./trading";

/**
 * Copy Group - Links a master account to multiple slave accounts
 * Each group represents one "signal source" that can be copied to many destinations
 */
export const copyGroup = pgTable("copy_group", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  masterAccountId: text("master_account_id")
    .notNull()
    .references(() => tradingAccount.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("idx_copy_group_user").on(table.userId),
  masterIdx: index("idx_copy_group_master").on(table.masterAccountId),
}));

/**
 * Copy Slave - Configuration for a slave account within a copy group
 * Contains all settings for lot sizing, risk management, and filters
 */
export const copySlave = pgTable("copy_slave", {
  id: text("id").primaryKey(),
  copyGroupId: text("copy_group_id")
    .notNull()
    .references(() => copyGroup.id, { onDelete: "cascade" }),
  slaveAccountId: text("slave_account_id")
    .notNull()
    .references(() => tradingAccount.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").default(true),

  // Lot Sizing Mode
  lotMode: text("lot_mode").default("multiplier"), // 'fixed', 'multiplier', 'balance_ratio', 'risk_percent'
  fixedLot: numeric("fixed_lot").default("0.01"),
  lotMultiplier: numeric("lot_multiplier").default("1.0"),
  riskPercent: numeric("risk_percent").default("1.0"), // % of account per trade

  // Risk Management
  maxLotSize: numeric("max_lot_size").default("10.0"),
  maxDailyLoss: numeric("max_daily_loss"), // NULL = no limit
  maxTradesPerDay: integer("max_trades_per_day"), // NULL = no limit
  maxDrawdownPercent: numeric("max_drawdown_percent"), // Stop copying if DD exceeds

  // SL/TP Adjustments
  slMode: text("sl_mode").default("copy"), // 'copy', 'fixed_pips', 'adjusted'
  slFixedPips: numeric("sl_fixed_pips"),
  slMultiplier: numeric("sl_multiplier").default("1.0"),
  tpMode: text("tp_mode").default("copy"), // 'copy', 'fixed_pips', 'adjusted'
  tpFixedPips: numeric("tp_fixed_pips"),
  tpMultiplier: numeric("tp_multiplier").default("1.0"),

  // Filters
  symbolWhitelist: jsonb("symbol_whitelist"), // ["EURUSD", "GBPUSD"] or NULL for all
  symbolBlacklist: jsonb("symbol_blacklist"), // ["XAUUSD"]
  sessionFilter: jsonb("session_filter"), // ["London", "New York"] or NULL for all
  minLotSize: numeric("min_lot_size").default("0.01"),

  // Execution Settings
  maxSlippagePips: numeric("max_slippage_pips").default("3.0"),
  copyPendingOrders: boolean("copy_pending_orders").default(false),
  copySlTpModifications: boolean("copy_sl_tp_modifications").default(true),
  reverseTrades: boolean("reverse_trades").default(false), // Copy as opposite direction

  // Stats (updated automatically)
  totalCopiedTrades: integer("total_copied_trades").default(0),
  totalProfit: numeric("total_profit").default("0"),
  lastCopyAt: timestamp("last_copy_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  groupIdx: index("idx_copy_slave_group").on(table.copyGroupId),
  slaveAccountIdx: index("idx_copy_slave_account").on(table.slaveAccountId),
}));

/**
 * Copy Signal - Individual trade copy signal sent to a slave
 * Tracks the full lifecycle from creation to execution
 */
export const copySignal = pgTable("copy_signal", {
  id: text("id").primaryKey(),
  copySlaveId: text("copy_slave_id")
    .notNull()
    .references(() => copySlave.id, { onDelete: "cascade" }),
  masterTicket: text("master_ticket").notNull(),
  slaveTicket: text("slave_ticket"), // Filled when slave executes
  signalType: text("signal_type").notNull(), // 'open', 'modify', 'close'
  status: text("status").default("pending"), // 'pending', 'sent', 'executed', 'failed', 'rejected'

  // Signal Data
  symbol: text("symbol").notNull(),
  tradeType: text("trade_type").notNull(), // 'buy', 'sell'
  masterVolume: numeric("master_volume").notNull(),
  slaveVolume: numeric("slave_volume"), // Calculated volume for slave
  openPrice: numeric("open_price"),
  sl: numeric("sl"),
  tp: numeric("tp"),

  // For modify signals
  newSl: numeric("new_sl"),
  newTp: numeric("new_tp"),

  // For close signals
  closePrice: numeric("close_price"),
  profit: numeric("profit"),

  // Execution Results
  executedAt: timestamp("executed_at"),
  executedPrice: numeric("executed_price"),
  slippagePips: numeric("slippage_pips"),
  errorMessage: text("error_message"),
  rejectionReason: text("rejection_reason"), // Why signal was rejected (risk limit, filter, etc.)

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  slaveIdx: index("idx_copy_signal_slave").on(table.copySlaveId),
  masterTicketIdx: index("idx_copy_signal_master_ticket").on(table.masterTicket),
  statusIdx: index("idx_copy_signal_status").on(table.copySlaveId, table.status),
  createdAtIdx: index("idx_copy_signal_created").on(table.copySlaveId, table.createdAt),
}));
