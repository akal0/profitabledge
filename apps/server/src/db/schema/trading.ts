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
