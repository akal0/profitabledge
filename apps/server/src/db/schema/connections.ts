import {
  pgTable,
  text,
  timestamp,
  varchar,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  integer,
  numeric,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";
import { tradingAccount } from "./trading";

/**
 * Platform connections — stores encrypted OAuth/JWT credentials
 * for external trading platform auto-sync.
 *
 * Encryption: AES-256-GCM with server-side CREDENTIAL_ENCRYPTION_KEY env var.
 * Each record has its own random 12-byte IV.
 */
export const platformConnection = pgTable(
  "platform_connection",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").references(() => tradingAccount.id, {
      onDelete: "set null",
    }),

    // Provider identifier
    provider: varchar("provider", { length: 50 }).notNull(),
    // 'ctrader' | 'match-trader' | 'tradelocker' | 'dxtrade' | 'tradovate' | 'topstepx'

    displayName: text("display_name").notNull(),

    // Non-sensitive provider metadata only (plain JSON)
    // Provider credentials, logins, and OAuth tokens must stay out of this
    // column and live in encrypted storage instead.
    // cTrader: { ctraderAccountId, brokerName, currency }
    meta: jsonb("meta"),

    // AES-256-GCM encrypted credentials blob (base64)
    encryptedCredentials: text("encrypted_credentials"),
    credentialIv: text("credential_iv"),

    // Connection lifecycle
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    // 'pending' | 'active' | 'error' | 'expired' | 'disconnected'
    lastError: text("last_error"),
    lastSyncAttemptAt: timestamp("last_sync_attempt_at"),
    lastSyncSuccessAt: timestamp("last_sync_success_at"),
    lastSyncedTradeCount: integer("last_synced_trade_count").default(0),

    // Incremental sync cursor
    syncCursor: timestamp("sync_cursor"),
    syncIntervalMinutes: integer("sync_interval_minutes").default(0),

    // OAuth token expiry
    tokenExpiresAt: timestamp("token_expires_at"),

    isPaused: boolean("is_paused").notNull().default(false),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_platform_conn_user").on(table.userId),
    userCreatedIdx: index("idx_platform_conn_user_created").on(
      table.userId,
      table.createdAt
    ),
    userUpdatedIdx: index("idx_platform_conn_user_updated").on(
      table.userId,
      table.updatedAt
    ),
    providerIdx: index("idx_platform_conn_provider").on(table.provider),
    statusIdx: index("idx_platform_conn_status").on(table.status),
    userProviderIdx: uniqueIndex("idx_platform_conn_user_provider_name").on(
      table.userId,
      table.provider,
      table.displayName
    ),
  })
);

/**
 * Equity snapshots — one row per account per calendar date.
 * Used for equity curve charts and prop rule HWM tracking.
 */
export const equitySnapshot = pgTable(
  "equity_snapshot",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),

    snapshotDate: text("snapshot_date").notNull(), // 'YYYY-MM-DD'

    balance: numeric("balance").notNull(),
    equity: numeric("equity").notNull(),
    floatingPnl: numeric("floating_pnl"),

    highEquity: numeric("high_equity"),
    lowEquity: numeric("low_equity"),

    closedTradesCount: integer("closed_trades_count").default(0),
    dailyRealizedPnl: numeric("daily_realized_pnl"),

    source: varchar("source", { length: 20 }).default("api"),
    // 'ea' | 'api' | 'manual'

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    accountDateIdx: uniqueIndex("idx_equity_snapshot_account_date").on(
      table.accountId,
      table.snapshotDate
    ),
    accountIdx: index("idx_equity_snapshot_account").on(table.accountId),
    dateIdx: index("idx_equity_snapshot_date").on(table.snapshotDate),
  })
);

/**
 * Sync logs — audit trail of every sync run.
 */
export const syncLog = pgTable(
  "sync_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    connectionId: text("connection_id")
      .notNull()
      .references(() => platformConnection.id, { onDelete: "cascade" }),
    accountId: text("account_id").references(() => tradingAccount.id, {
      onDelete: "set null",
    }),

    status: varchar("status", { length: 20 }).notNull(),
    // 'success' | 'partial' | 'error' | 'skipped'
    tradesFound: integer("trades_found").default(0),
    tradesInserted: integer("trades_inserted").default(0),
    tradesDuplicated: integer("trades_duplicated").default(0),
    errorMessage: text("error_message"),
    durationMs: integer("duration_ms"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    connectionIdx: index("idx_sync_log_connection").on(table.connectionId),
    connectionCreatedIdx: index("idx_sync_log_connection_created").on(
      table.connectionId,
      table.createdAt
    ),
    createdIdx: index("idx_sync_log_created").on(table.createdAt),
  })
);

// ── Relations ───────────────────────────────────────────────────────

export const platformConnectionRelations = relations(
  platformConnection,
  ({ one, many }) => ({
    user: one(user, {
      fields: [platformConnection.userId],
      references: [user.id],
    }),
    account: one(tradingAccount, {
      fields: [platformConnection.accountId],
      references: [tradingAccount.id],
    }),
    syncLogs: many(syncLog),
  })
);

export const equitySnapshotRelations = relations(equitySnapshot, ({ one }) => ({
  account: one(tradingAccount, {
    fields: [equitySnapshot.accountId],
    references: [tradingAccount.id],
  }),
}));

export const syncLogRelations = relations(syncLog, ({ one }) => ({
  connection: one(platformConnection, {
    fields: [syncLog.connectionId],
    references: [platformConnection.id],
  }),
  account: one(tradingAccount, {
    fields: [syncLog.accountId],
    references: [tradingAccount.id],
  }),
}));
