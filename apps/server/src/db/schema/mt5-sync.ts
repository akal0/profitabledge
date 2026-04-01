import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { platformConnection } from "./connections";
import { tradingAccount } from "./trading";

export const brokerSession = pgTable(
  "broker_session",
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
    platform: varchar("platform", { length: 32 }).notNull().default("mt5"),
    workerHostId: text("worker_host_id"),
    sessionKey: text("session_key"),
    status: varchar("status", { length: 32 }).notNull().default("bootstrapping"),
    heartbeatAt: timestamp("heartbeat_at"),
    lastLoginAt: timestamp("last_login_at"),
    lastError: text("last_error"),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    connectionUniqueIdx: uniqueIndex("idx_broker_session_connection").on(
      table.connectionId
    ),
    accountIdx: index("idx_broker_session_account").on(table.accountId),
    statusIdx: index("idx_broker_session_status").on(table.status),
    workerIdx: index("idx_broker_session_worker").on(table.workerHostId),
  })
);

export const brokerWorkerHost = pgTable(
  "broker_worker_host",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workerHostId: text("worker_host_id").notNull(),
    mode: varchar("mode", { length: 32 }),
    status: varchar("status", { length: 32 }),
    desiredChildren: integer("desired_children"),
    runningChildren: integer("running_children"),
    healthyChildren: integer("healthy_children"),
    adminHost: text("admin_host"),
    adminPort: integer("admin_port"),
    startedAt: timestamp("started_at"),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    lastError: text("last_error"),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    workerHostUniqueIdx: uniqueIndex("idx_broker_worker_host_worker").on(
      table.workerHostId
    ),
    lastSeenIdx: index("idx_broker_worker_host_last_seen").on(table.lastSeenAt),
    statusIdx: index("idx_broker_worker_host_status").on(table.status),
  })
);

export const brokerDealEvent = pgTable(
  "broker_deal_event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    connectionId: text("connection_id")
      .notNull()
      .references(() => platformConnection.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 32 }).notNull().default("mt5"),
    remoteDealId: text("remote_deal_id").notNull(),
    remoteOrderId: text("remote_order_id"),
    positionId: text("position_id"),
    entryType: varchar("entry_type", { length: 16 }),
    side: varchar("side", { length: 8 }),
    symbol: varchar("symbol", { length: 64 }).notNull(),
    volume: numeric("volume").notNull(),
    price: numeric("price").notNull(),
    profit: numeric("profit"),
    commission: numeric("commission"),
    swap: numeric("swap"),
    fee: numeric("fee"),
    sl: numeric("sl"),
    tp: numeric("tp"),
    comment: text("comment"),
    rawPayload: jsonb("raw_payload"),
    eventTime: timestamp("event_time").notNull(),
    ingestedAt: timestamp("ingested_at").notNull().defaultNow(),
  },
  (table) => ({
    accountEventIdx: index("idx_broker_deal_event_account_time").on(
      table.accountId,
      table.eventTime
    ),
    connectionIdx: index("idx_broker_deal_event_connection").on(
      table.connectionId
    ),
    connectionEventIdx: index("idx_broker_deal_event_connection_time").on(
      table.connectionId,
      table.eventTime
    ),
    positionIdx: index("idx_broker_deal_event_position").on(
      table.accountId,
      table.positionId
    ),
    remoteUniqueIdx: uniqueIndex("idx_broker_deal_event_remote").on(
      table.platform,
      table.accountId,
      table.remoteDealId
    ),
  })
);

export const brokerOrderEvent = pgTable(
  "broker_order_event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    connectionId: text("connection_id")
      .notNull()
      .references(() => platformConnection.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 32 }).notNull().default("mt5"),
    eventKey: text("event_key").notNull(),
    remoteOrderId: text("remote_order_id").notNull(),
    positionId: text("position_id"),
    side: varchar("side", { length: 8 }),
    orderType: varchar("order_type", { length: 32 }),
    state: varchar("state", { length: 32 }),
    symbol: varchar("symbol", { length: 64 }),
    requestedVolume: numeric("requested_volume"),
    filledVolume: numeric("filled_volume"),
    price: numeric("price"),
    sl: numeric("sl"),
    tp: numeric("tp"),
    comment: text("comment"),
    rawPayload: jsonb("raw_payload"),
    eventTime: timestamp("event_time").notNull(),
    ingestedAt: timestamp("ingested_at").notNull().defaultNow(),
  },
  (table) => ({
    accountEventIdx: index("idx_broker_order_event_account_time").on(
      table.accountId,
      table.eventTime
    ),
    connectionIdx: index("idx_broker_order_event_connection").on(
      table.connectionId
    ),
    connectionEventIdx: index("idx_broker_order_event_connection_time").on(
      table.connectionId,
      table.eventTime
    ),
    remoteUniqueIdx: uniqueIndex("idx_broker_order_event_remote").on(
      table.platform,
      table.accountId,
      table.eventKey
    ),
  })
);

export const brokerLedgerEvent = pgTable(
  "broker_ledger_event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    connectionId: text("connection_id")
      .notNull()
      .references(() => platformConnection.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 32 }).notNull().default("mt5"),
    remoteDealId: text("remote_deal_id").notNull(),
    remoteOrderId: text("remote_order_id"),
    positionId: text("position_id"),
    ledgerType: varchar("ledger_type", { length: 32 }),
    amount: numeric("amount").notNull(),
    commission: numeric("commission"),
    swap: numeric("swap"),
    fee: numeric("fee"),
    comment: text("comment"),
    rawPayload: jsonb("raw_payload"),
    eventTime: timestamp("event_time").notNull(),
    ingestedAt: timestamp("ingested_at").notNull().defaultNow(),
  },
  (table) => ({
    accountEventIdx: index("idx_broker_ledger_event_account_time").on(
      table.accountId,
      table.eventTime
    ),
    connectionIdx: index("idx_broker_ledger_event_connection").on(
      table.connectionId
    ),
    remoteUniqueIdx: uniqueIndex("idx_broker_ledger_event_remote").on(
      table.platform,
      table.accountId,
      table.remoteDealId
    ),
  })
);

export const brokerPositionSnapshot = pgTable(
  "broker_position_snapshot",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    connectionId: text("connection_id")
      .notNull()
      .references(() => platformConnection.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 32 }).notNull().default("mt5"),
    remotePositionId: text("remote_position_id").notNull(),
    side: varchar("side", { length: 8 }).notNull(),
    symbol: varchar("symbol", { length: 64 }).notNull(),
    volume: numeric("volume").notNull(),
    openPrice: numeric("open_price").notNull(),
    currentPrice: numeric("current_price"),
    profit: numeric("profit"),
    swap: numeric("swap"),
    commission: numeric("commission"),
    sl: numeric("sl"),
    tp: numeric("tp"),
    comment: text("comment"),
    magicNumber: integer("magic_number"),
    snapshotTime: timestamp("snapshot_time").notNull(),
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    accountSnapshotIdx: index("idx_broker_position_snapshot_account_time").on(
      table.accountId,
      table.snapshotTime
    ),
    connectionIdx: index("idx_broker_position_snapshot_connection").on(
      table.connectionId
    ),
    remotePositionIdx: index("idx_broker_position_snapshot_remote").on(
      table.accountId,
      table.remotePositionId
    ),
  })
);

export const brokerAccountSnapshot = pgTable(
  "broker_account_snapshot",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    connectionId: text("connection_id")
      .notNull()
      .references(() => platformConnection.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 32 }).notNull().default("mt5"),
    login: text("login"),
    serverName: text("server_name"),
    brokerName: text("broker_name"),
    currency: varchar("currency", { length: 16 }),
    leverage: integer("leverage"),
    balance: numeric("balance").notNull(),
    equity: numeric("equity").notNull(),
    margin: numeric("margin"),
    freeMargin: numeric("free_margin"),
    marginLevel: numeric("margin_level"),
    snapshotTime: timestamp("snapshot_time").notNull(),
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    accountSnapshotIdx: index("idx_broker_account_snapshot_account_time").on(
      table.accountId,
      table.snapshotTime
    ),
    connectionIdx: index("idx_broker_account_snapshot_connection").on(
      table.connectionId
    ),
  })
);

export const brokerSymbolSpec = pgTable(
  "broker_symbol_spec",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    connectionId: text("connection_id")
      .notNull()
      .references(() => platformConnection.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 32 }).notNull().default("mt5"),
    symbol: varchar("symbol", { length: 64 }).notNull(),
    canonicalSymbol: varchar("canonical_symbol", { length: 64 }),
    digits: integer("digits"),
    pointSize: numeric("point_size"),
    tickSize: numeric("tick_size"),
    contractSize: numeric("contract_size"),
    pipSize: numeric("pip_size"),
    spreadPoints: integer("spread_points"),
    spreadFloat: boolean("spread_float"),
    currencyBase: varchar("currency_base", { length: 16 }),
    currencyProfit: varchar("currency_profit", { length: 16 }),
    currencyMargin: varchar("currency_margin", { length: 16 }),
    path: text("path"),
    snapshotTime: timestamp("snapshot_time").notNull(),
    rawPayload: jsonb("raw_payload"),
    ingestedAt: timestamp("ingested_at").notNull().defaultNow(),
  },
  (table) => ({
    accountSymbolIdx: index("idx_broker_symbol_spec_account_symbol").on(
      table.accountId,
      table.symbol
    ),
    connectionIdx: index("idx_broker_symbol_spec_connection").on(
      table.connectionId
    ),
    canonicalIdx: index("idx_broker_symbol_spec_canonical").on(
      table.accountId,
      table.canonicalSymbol
    ),
    remoteUniqueIdx: uniqueIndex("idx_broker_symbol_spec_remote").on(
      table.platform,
      table.accountId,
      table.symbol
    ),
  })
);

export const brokerSyncCheckpoint = pgTable(
  "broker_sync_checkpoint",
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
    platform: varchar("platform", { length: 32 }).notNull().default("mt5"),
    lastDealTime: timestamp("last_deal_time"),
    lastDealId: text("last_deal_id"),
    lastOrderTime: timestamp("last_order_time"),
    lastPositionPollAt: timestamp("last_position_poll_at"),
    lastAccountPollAt: timestamp("last_account_poll_at"),
    lastFullReconcileAt: timestamp("last_full_reconcile_at"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    connectionUniqueIdx: uniqueIndex("idx_broker_sync_checkpoint_connection").on(
      table.connectionId
    ),
    accountIdx: index("idx_broker_sync_checkpoint_account").on(table.accountId),
  })
);

export const brokerSessionRelations = relations(brokerSession, ({ one }) => ({
  connection: one(platformConnection, {
    fields: [brokerSession.connectionId],
    references: [platformConnection.id],
  }),
  account: one(tradingAccount, {
    fields: [brokerSession.accountId],
    references: [tradingAccount.id],
  }),
}));

export const brokerDealEventRelations = relations(
  brokerDealEvent,
  ({ one }) => ({
    connection: one(platformConnection, {
      fields: [brokerDealEvent.connectionId],
      references: [platformConnection.id],
    }),
    account: one(tradingAccount, {
      fields: [brokerDealEvent.accountId],
      references: [tradingAccount.id],
    }),
  })
);

export const brokerOrderEventRelations = relations(
  brokerOrderEvent,
  ({ one }) => ({
    connection: one(platformConnection, {
      fields: [brokerOrderEvent.connectionId],
      references: [platformConnection.id],
    }),
    account: one(tradingAccount, {
      fields: [brokerOrderEvent.accountId],
      references: [tradingAccount.id],
    }),
  })
);

export const brokerLedgerEventRelations = relations(
  brokerLedgerEvent,
  ({ one }) => ({
    connection: one(platformConnection, {
      fields: [brokerLedgerEvent.connectionId],
      references: [platformConnection.id],
    }),
    account: one(tradingAccount, {
      fields: [brokerLedgerEvent.accountId],
      references: [tradingAccount.id],
    }),
  })
);

export const brokerPositionSnapshotRelations = relations(
  brokerPositionSnapshot,
  ({ one }) => ({
    connection: one(platformConnection, {
      fields: [brokerPositionSnapshot.connectionId],
      references: [platformConnection.id],
    }),
    account: one(tradingAccount, {
      fields: [brokerPositionSnapshot.accountId],
      references: [tradingAccount.id],
    }),
  })
);

export const brokerAccountSnapshotRelations = relations(
  brokerAccountSnapshot,
  ({ one }) => ({
    connection: one(platformConnection, {
      fields: [brokerAccountSnapshot.connectionId],
      references: [platformConnection.id],
    }),
    account: one(tradingAccount, {
      fields: [brokerAccountSnapshot.accountId],
      references: [tradingAccount.id],
    }),
  })
);

export const brokerSymbolSpecRelations = relations(
  brokerSymbolSpec,
  ({ one }) => ({
    connection: one(platformConnection, {
      fields: [brokerSymbolSpec.connectionId],
      references: [platformConnection.id],
    }),
    account: one(tradingAccount, {
      fields: [brokerSymbolSpec.accountId],
      references: [tradingAccount.id],
    }),
  })
);

export const brokerSyncCheckpointRelations = relations(
  brokerSyncCheckpoint,
  ({ one }) => ({
    connection: one(platformConnection, {
      fields: [brokerSyncCheckpoint.connectionId],
      references: [platformConnection.id],
    }),
    account: one(tradingAccount, {
      fields: [brokerSyncCheckpoint.accountId],
      references: [tradingAccount.id],
    }),
  })
);
