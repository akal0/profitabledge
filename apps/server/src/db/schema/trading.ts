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
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
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
  preferredDataSource: varchar("preferred_data_source", { length: 50 }).default(
    "dukascopy"
  ), // 'dukascopy', 'alphavantage', 'truefx', 'broker'
  averageSpreadPips: numeric("average_spread_pips"), // User-reported average spread for calibration
  breakevenThresholdPips: numeric("breakeven_threshold_pips").default("0.5"), // Account-level BE tolerance used for trade outcome classification
  initialBalance: numeric("initial_balance"),
  initialCurrency: varchar("initial_currency", { length: 8 }),
  // Live account status (updated by EA)
  isVerified: integer("is_verified").default(0), // 0 = manual upload, 1 = EA-synced (verified)
  liveBalance: numeric("live_balance"), // Current account balance from EA
  liveEquity: numeric("live_equity"), // Current equity (balance + floating P&L)
  liveMargin: numeric("live_margin"), // Used margin
  liveFreeMargin: numeric("live_free_margin"), // Free margin available
  lastSyncedAt: timestamp("last_synced_at"), // Last time EA sent data

  // Prop Firm Challenge Tracking
  isPropAccount: boolean("is_prop_account").default(false),
  propFirmId: text("prop_firm_id"), // Foreign key added after propFirm table definition
  propChallengeRuleId: text("prop_challenge_rule_id"), // Foreign key added after propChallengeRule table definition
  propCurrentPhase: integer("prop_current_phase"), // 1, 2, 3, or 0 for funded
  propPhaseStartDate: date("prop_phase_start_date"),
  propPhaseStartBalance: numeric("prop_phase_start_balance"),
  propPhaseStartEquity: numeric("prop_phase_start_equity"),
  propDailyHighWaterMark: numeric("prop_daily_high_water_mark"), // For trailing daily loss (resets daily)
  propPhaseHighWaterMark: numeric("prop_phase_high_water_mark"), // For max drawdown
  propPhaseCurrentProfit: numeric("prop_phase_current_profit"),
  propPhaseCurrentProfitPercent: numeric("prop_phase_current_profit_percent"),
  propPhaseTradingDays: integer("prop_phase_trading_days").default(0), // Days with at least 1 trade
  propPhaseStatus: varchar("prop_phase_status", { length: 20 }), // "active" | "passed" | "failed" | "paused"
  propPhaseBestDayProfit: numeric("prop_phase_best_day_profit"), // For consistency rule (E8)
  propPhaseBestDayProfitPercent: numeric("prop_phase_best_day_profit_percent"),
  propManualOverride: boolean("prop_manual_override").default(false), // User manually set prop firm
  propDetectedFirmId: text("prop_detected_firm_id"), // Auto-detected prop firm (for user review)
  propChallengeInstanceId: text("prop_challenge_instance_id"), // Shared challenge lineage across multiple broker accounts
  propIsCurrentChallengeStage: boolean(
    "prop_is_current_challenge_stage"
  ).default(true), // Only the active stage account should drive live rule syncs

  // Social features (verified accounts only)
  verificationLevel: varchar("verification_level", { length: 20 }).default(
    "unverified"
  ), // unverified, ea_synced, api_verified, prop_verified
  socialOptIn: boolean("social_opt_in").default(false), // Opt-in to social features
  socialVisibleSince: timestamp("social_visible_since"), // When account became public
  followerCount: integer("follower_count").default(0),
  feedEventCount: integer("feed_event_count").default(0),
  tags: jsonb("tags").$type<string[]>().default([]).notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const symbolMapping = pgTable(
  "symbol_mapping",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    canonicalSymbol: varchar("canonical_symbol", { length: 64 }).notNull(),
    aliases: jsonb("aliases").$type<string[]>().default([]).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_symbol_mapping_user").on(table.userId),
    userCanonicalIdx: uniqueIndex("idx_symbol_mapping_user_canonical").on(
      table.userId,
      table.canonicalSymbol
    ),
  })
);

export const trade = pgTable(
  "trade",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    ticket: varchar("ticket", { length: 100 }), // MT5 ticket number (unique per broker)
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
    openTime: timestamp("open_time"), // When the trade was opened
    closeTime: timestamp("close_time"), // When the trade was closed
    useBrokerData: integer("use_broker_data").default(0), // 0 = use public data, 1 = has broker-specific data
    originType: varchar("origin_type", { length: 24 }), // broker_sync | csv_import | manual_entry
    originLabel: text("origin_label"), // Human-readable provenance label for public proof pages
    originCapturedAt: timestamp("origin_captured_at"), // When provenance was first recorded

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

    // Execution quality (from EA)
    entrySpreadPips: numeric("entry_spread_pips"), // Spread at entry (pips)
    exitSpreadPips: numeric("exit_spread_pips"), // Spread at exit (pips)
    entrySlippagePips: numeric("entry_slippage_pips"), // Slippage at entry (pips, abs)
    exitSlippagePips: numeric("exit_slippage_pips"), // Slippage at exit (pips, abs)
    slModCount: integer("sl_mod_count"), // SL modifications count
    tpModCount: integer("tp_mod_count"), // TP modifications count
    partialCloseCount: integer("partial_close_count"), // Partial closes count
    exitDealCount: integer("exit_deal_count"), // Exit deals count
    exitVolume: numeric("exit_volume"), // Exit volume summed across deals
    entryDealCount: integer("entry_deal_count"), // Entry deals count
    entryVolume: numeric("entry_volume"), // Entry volume summed across deals
    scaleInCount: integer("scale_in_count"), // Scale-in count
    scaleOutCount: integer("scale_out_count"), // Scale-out count
    trailingStopDetected: boolean("trailing_stop_detected"), // Trailing stop detected
    entryPeakDurationSeconds: integer("entry_peak_duration_seconds"), // Seconds to entry peak
    postExitPeakDurationSeconds: integer("post_exit_peak_duration_seconds"), // Seconds to post-exit peak
    entryBalance: numeric("entry_balance"), // Account balance at entry
    entryEquity: numeric("entry_equity"), // Account equity at entry
    entryMargin: numeric("entry_margin"), // Account margin at entry
    entryFreeMargin: numeric("entry_free_margin"), // Free margin at entry
    entryMarginLevel: numeric("entry_margin_level"), // Margin level at entry

    // Advanced trading metrics - User configuration
    alphaWeightedMpe: numeric("alpha_weighted_mpe").default("0.30"), // User-configurable alpha for Est Weighted MPE (default 0.30)
    beThresholdPips: numeric("be_threshold_pips").default("0.5"), // BE threshold in pips (default 0.5)

    // Generalized tagging system
    // Time/Session tags (renamed from killzone for generality)
    sessionTag: text("session_tag"), // Session tag name (e.g., "London Open", "Asian Session", "NY-London Overlap")
    sessionTagColor: varchar("session_tag_color", { length: 7 }), // Hex color for visual identification

    // Strategy/Model tags
    modelTag: text("model_tag"), // Model/strategy tag (e.g., "Liquidity Raid", "Breaker Block", "Discretionary")
    modelTagColor: varchar("model_tag_color", { length: 7 }), // Hex color for model categorization

    // Protocol/Rule adherence tags (factual, not judgmental)
    protocolAlignment: varchar("protocol_alignment", { length: 20 }), // 'aligned' | 'against' | 'discretionary'

    // Outcome classification (cached for query performance)
    outcome: varchar("outcome", { length: 8 }), // 'Win' | 'Loss' | 'BE' | 'PW'

    // Intent metrics (cached for performance)
    plannedRR: numeric("planned_rr"), // Initial TP/SL ratio
    plannedRiskPips: numeric("planned_risk_pips"), // SL size in pips
    plannedTargetPips: numeric("planned_target_pips"), // TP size in pips

    // Opportunity metrics (cached from advanced-metrics.ts calculations)
    mfePips: numeric("mfe_pips"), // Maximum Favorable Excursion in pips
    maePips: numeric("mae_pips"), // Maximum Adverse Excursion (drawdown) in pips
    mpeManipLegR: numeric("mpe_manip_leg_r"), // MPE from manipulation reference, in R
    mpeManipPE_R: numeric("mpe_manip_pe_r"), // Post-exit MPE from manipulation, in R
    maxRR: numeric("max_rr"), // Maximum R:R available during trade
    rawSTDV: numeric("raw_stdv"), // Raw volatility (same as MPE Manip Leg R)
    rawSTDV_PE: numeric("raw_stdv_pe"), // Post-exit volatility
    stdvBucket: varchar("stdv_bucket", { length: 16 }), // Volatility bucket: "-2 STDV", "-1 STDV", "0 STDV", "+1 STDV", "+2 STDV"
    estimatedWeightedMPE_R: numeric("estimated_weighted_mpe_r"), // Weighted MPE for TP recommendations

    // Execution metrics (cached from advanced-metrics.ts calculations)
    realisedRR: numeric("realised_rr"), // Actual R:R achieved after commissions/swaps

    // Efficiency metrics (cached from advanced-metrics.ts calculations)
    rrCaptureEfficiency: numeric("rr_capture_efficiency"), // % of max RR captured (0-100)
    manipRREfficiency: numeric("manip_rr_efficiency"), // % of manipulation captured (can exceed 100)
    exitEfficiency: numeric("exit_efficiency"), // Exit timing quality vs post-exit peak (0-100)

    // Legacy fields (kept for backward compatibility during migration)
    killzone: text("killzone"), // DEPRECATED: Use sessionTag instead
    killzoneColor: varchar("killzone_color", { length: 7 }), // DEPRECATED: Use sessionTagColor instead
    brokerMeta: jsonb("broker_meta").$type<Record<string, unknown> | null>(), // Connector-specific execution metadata (MT5 reason/source trails, ids, etc.)
    customTags: jsonb("custom_tags").$type<string[]>().default([]).notNull(),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    // Indexes for filtering performance
    sessionTagIdx: index("idx_trade_session_tag").on(
      table.accountId,
      table.sessionTag
    ),
    modelTagIdx: index("idx_trade_model_tag").on(
      table.accountId,
      table.modelTag
    ),
    protocolAlignmentIdx: index("idx_trade_protocol_alignment").on(
      table.accountId,
      table.protocolAlignment
    ),
    outcomeIdx: index("idx_trade_outcome").on(table.accountId, table.outcome),
  })
);

export const deletedImportedTrade = pgTable(
  "deleted_imported_trade",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    originalTradeId: text("original_trade_id"),
    ticket: varchar("ticket", { length: 100 }),
    importFingerprint: text("import_fingerprint").notNull(),
    importSource: varchar("import_source", { length: 32 }),
    importParserId: varchar("import_parser_id", { length: 128 }),
    importReportType: varchar("import_report_type", { length: 128 }),
    tradeSnapshot: jsonb("trade_snapshot").$type<Record<
      string,
      unknown
    > | null>(),
    deletedAt: timestamp("deleted_at").notNull().defaultNow(),
  },
  (table) => ({
    accountFingerprintIdx: uniqueIndex(
      "deleted_imported_trade_account_fingerprint_idx"
    ).on(table.accountId, table.importFingerprint),
    accountTicketIdx: index("deleted_imported_trade_account_ticket_idx").on(
      table.accountId,
      table.ticket
    ),
  })
);

export const publicAccountShare = pgTable(
  "public_account_share",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    publicAccountSlug: text("public_account_slug").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    revokedAt: timestamp("revoked_at"),
    viewCount: integer("view_count").notNull().default(0),
    lastViewedAt: timestamp("last_viewed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: index("public_account_share_account_idx").on(table.accountId),
    activeIdx: index("public_account_share_active_idx").on(
      table.accountId,
      table.isActive
    ),
    slugIdx: uniqueIndex("public_account_share_slug_idx").on(
      table.publicAccountSlug
    ),
  })
);

export const tradeTrustEvent = pgTable(
  "trade_trust_event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    tradeId: text("trade_id"),
    eventType: varchar("event_type", { length: 24 }).notNull(), // update | delete
    changeSource: varchar("change_source", { length: 24 })
      .notNull()
      .default("app"),
    originType: varchar("origin_type", { length: 24 }),
    changedFields: jsonb("changed_fields")
      .$type<string[]>()
      .default([])
      .notNull(),
    beforeData: jsonb("before_data").$type<Record<string, unknown> | null>(),
    afterData: jsonb("after_data").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    accountEventIdx: index("trade_trust_event_account_event_idx").on(
      table.accountId,
      table.eventType
    ),
    accountTradeIdx: index("trade_trust_event_account_trade_idx").on(
      table.accountId,
      table.tradeId
    ),
    createdIdx: index("trade_trust_event_created_idx").on(table.createdAt),
  })
);

// Open (active) trades - synced from EA in real-time
export const openTrade = pgTable(
  "open_trade",
  {
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
    sessionTag: text("session_tag"),
    sessionTagColor: varchar("session_tag_color", { length: 7 }),
    slModCount: integer("sl_mod_count"),
    tpModCount: integer("tp_mod_count"),
    partialCloseCount: integer("partial_close_count"),
    entryDealCount: integer("entry_deal_count"),
    exitDealCount: integer("exit_deal_count"),
    entryVolume: numeric("entry_volume"),
    exitVolume: numeric("exit_volume"),
    scaleInCount: integer("scale_in_count"),
    scaleOutCount: integer("scale_out_count"),
    trailingStopDetected: boolean("trailing_stop_detected"),
    // Metadata
    comment: text("comment"),
    magicNumber: integer("magic_number"),
    brokerMeta: jsonb("broker_meta").$type<Record<string, unknown> | null>(),
    lastUpdatedAt: timestamp("last_updated_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("open_trade_account_ticket_idx").on(
      table.accountId,
      table.ticket
    ),
    index("open_trade_account_idx").on(table.accountId),
  ]
);

// Historical OHLCV-like candle storage for 5m timeframe (or others)
// User-specific price data from EA
export const historicalPrices = pgTable(
  "historical_prices",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }), // Privacy: each user only sees their data
    accountId: text("account_id").references(() => tradingAccount.id, {
      onDelete: "cascade",
    }), // Optional: link to specific account
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
  },
  (table) => ({
    accountSymbolTimeIdx: index("idx_historical_prices_account_symbol_time").on(
      table.accountId,
      table.symbol,
      table.time
    ),
    userSymbolTimeIdx: index("idx_historical_prices_user_symbol_time").on(
      table.userId,
      table.symbol,
      table.time
    ),
    accountSymbolTfTimeUniqueIdx: uniqueIndex(
      "idx_historical_prices_account_symbol_tf_time_unique"
    ).on(table.accountId, table.symbol, table.timeframe, table.time),
  })
);

// Trade View System - Saved filter/column configurations (lenses on trade data)
export const tradeView = pgTable(
  "trade_view",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Metadata
    name: text("name").notNull(), // e.g., "Scoreboard", "Execution Quality", "Model Performance"
    description: text("description"), // Optional user notes
    icon: text("icon"), // Optional emoji/icon for visual identification
    isDefault: boolean("is_default").default(false), // Set as default view for user
    sortOrder: integer("sort_order").default(0), // User-defined order in view switcher

    // View configuration (stored as JSONB for flexibility)
    config: jsonb("config").notNull(), // TradeViewConfig type (filters, columns, sorting)

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    // Indexes
    userIdx: index("idx_trade_view_user").on(table.userId),
    userSortIdx: index("idx_trade_view_sort").on(table.userId, table.sortOrder),
  })
);

// Goals & Progress Tracking
export const goal = pgTable(
  "goal",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").references(() => tradingAccount.id, {
      onDelete: "cascade",
    }), // null = all accounts

    // Goal type and timeframe
    type: varchar("type", { length: 20 }).notNull(), // 'daily' | 'weekly' | 'monthly' | 'milestone'

    // What metric to track
    targetType: varchar("target_type", { length: 30 }).notNull(), // 'profit' | 'winRate' | 'consistency' | 'rr' | 'trades' | 'streak'
    targetValue: numeric("target_value").notNull(), // Target to achieve
    currentValue: numeric("current_value").default("0"), // Current progress

    // Timeframe
    startDate: date("start_date").notNull(), // When goal started
    deadline: date("deadline"), // null for milestones (no deadline)

    // Status
    status: varchar("status", { length: 20 }).notNull().default("active"), // 'active' | 'achieved' | 'failed' | 'paused'

    // Metadata
    title: text("title").notNull(), // User-friendly title
    description: text("description"), // Optional description
    achievements: jsonb("achievements"), // Array of achievement badges/milestones

    // Custom goal criteria (for complex, data-driven goals)
    customCriteria: jsonb("custom_criteria"), // { filters: [], metric: "", comparator: "", baselineValue: number }
    isCustom: boolean("is_custom").default(false), // true = custom goal with filters

    // Progress tracking
    progressHistory: jsonb("progress_history"), // Daily/periodic progress snapshots

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"), // When goal was achieved/failed
  },
  (table) => ({
    userIdx: index("idx_goal_user").on(table.userId),
    accountIdx: index("idx_goal_account").on(table.accountId),
    statusIdx: index("idx_goal_status").on(table.status),
    userStatusIdx: index("idx_goal_user_status").on(table.userId, table.status),
  })
);

// ============== PROP FIRM CHALLENGE TRACKER ==============

// Prop Firm Registry - Static data about supported prop firms
export const propFirm = pgTable(
  "prop_firm",
  {
    id: text("id").primaryKey(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(), // "FTMO", "FundedNext", "E8Markets", etc.
    displayName: text("display_name").notNull(),
    description: text("description"),
    logo: text("logo"), // URL or path to logo
    website: text("website"),
    supportedPlatforms: jsonb("supported_platforms"), // ["mt5", "mt4", "ctrader"]
    brokerDetectionPatterns: jsonb("broker_detection_patterns"), // ["FTMO", "FTMO-Demo"]
    active: boolean("active").default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    ownerIdx: index("idx_prop_firm_owner").on(table.createdByUserId),
  })
);

// Prop Firm Challenge Rules - Define rules for each challenge type
export const propChallengeRule = pgTable(
  "prop_challenge_rule",
  {
    id: text("id").primaryKey(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    propFirmId: text("prop_firm_id")
      .notNull()
      .references(() => propFirm.id, { onDelete: "cascade" }),
    challengeType: text("challenge_type").notNull(), // "standard", "express", "track", etc.
    displayName: text("display_name").notNull(), // "2-Step Standard", "1-Step Express"

    // Phase configuration stored as JSONB for flexibility
    // Structure: { order: number, name: string, profitTarget: number, profitTargetType: "percentage" | "absolute", ... }[]
    phases: jsonb("phases").notNull(),

    active: boolean("active").default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    propFirmIdx: index("idx_prop_challenge_rule_firm").on(table.propFirmId),
    ownerIdx: index("idx_prop_challenge_rule_owner").on(table.createdByUserId),
  })
);

// Prop Challenge Instance - Shared lineage across multiple accounts/stages
export const propChallengeInstance = pgTable(
  "prop_challenge_instance",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    propFirmId: text("prop_firm_id").notNull(),
    propChallengeRuleId: text("prop_challenge_rule_id").notNull(),
    currentPhase: integer("current_phase").notNull().default(1),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    currentAccountId: text("current_account_id").references(
      () => tradingAccount.id,
      { onDelete: "set null" }
    ),
    startedAt: date("started_at"),
    lastStageStartedAt: date("last_stage_started_at"),
    passedAt: timestamp("passed_at"),
    failedAt: timestamp("failed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_prop_challenge_instance_user").on(table.userId),
    userStatusIdx: index("idx_prop_challenge_instance_user_status").on(
      table.userId,
      table.status
    ),
    currentAccountIdx: index("idx_prop_challenge_instance_current_account").on(
      table.currentAccountId
    ),
  })
);

// Prop Challenge Stage Account - Stage/account history inside a challenge instance
export const propChallengeStageAccount = pgTable(
  "prop_challenge_stage_account",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    challengeInstanceId: text("challenge_instance_id")
      .notNull()
      .references(() => propChallengeInstance.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    phaseOrder: integer("phase_order").notNull(),
    phaseLabel: text("phase_label"),
    stageStatus: varchar("stage_status", { length: 20 })
      .notNull()
      .default("active"),
    phaseStartedAt: date("phase_started_at"),
    phaseCompletedAt: timestamp("phase_completed_at"),
    phaseFailedAt: timestamp("phase_failed_at"),
    startBalance: numeric("start_balance"),
    startEquity: numeric("start_equity"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    challengeIdx: index("idx_prop_challenge_stage_account_challenge").on(
      table.challengeInstanceId
    ),
    accountIdx: index("idx_prop_challenge_stage_account_account").on(
      table.accountId
    ),
    challengePhaseIdx: index("idx_prop_challenge_stage_account_phase").on(
      table.challengeInstanceId,
      table.phaseOrder
    ),
    challengeAccountPhaseUniqueIdx: uniqueIndex(
      "idx_prop_challenge_stage_account_unique"
    ).on(table.challengeInstanceId, table.accountId, table.phaseOrder),
  })
);

// Prop Daily Snapshot - Track daily metrics for rule monitoring
export const propDailySnapshot = pgTable(
  "prop_daily_snapshot",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    startingBalance: numeric("starting_balance").notNull(),
    startingEquity: numeric("starting_equity").notNull(),
    endingBalance: numeric("ending_balance").notNull(),
    endingEquity: numeric("ending_equity").notNull(),
    dailyProfit: numeric("daily_profit").notNull(),
    dailyProfitPercent: numeric("daily_profit_percent").notNull(),
    dailyHighWaterMark: numeric("daily_high_water_mark"), // Highest equity during the day
    dailyDrawdown: numeric("daily_drawdown"), // Drawdown from daily high
    dailyDrawdownPercent: numeric("daily_drawdown_percent"),
    tradesCount: integer("trades_count").default(0),
    isTradingDay: boolean("is_trading_day").default(false), // At least 1 trade placed
    breachedDailyLoss: boolean("breached_daily_loss").default(false),
    breachedMaxLoss: boolean("breached_max_loss").default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    accountDateIdx: uniqueIndex("idx_prop_daily_snapshot_account_date").on(
      table.accountId,
      table.date
    ),
    accountIdx: index("idx_prop_daily_snapshot_account").on(table.accountId),
    dateIdx: index("idx_prop_daily_snapshot_date").on(table.date),
  })
);

// Performance Alert Rules - User-defined alert thresholds
export const performanceAlertRule = pgTable(
  "performance_alert_rule",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").references(() => tradingAccount.id, {
      onDelete: "cascade",
    }), // null = applies to all accounts
    name: varchar("name", { length: 100 }).notNull(),
    ruleType: varchar("rule_type", { length: 30 }).notNull(), // "daily_loss" | "max_drawdown" | "win_streak" | "loss_streak" | "consecutive_green" | "consecutive_red"
    thresholdValue: numeric("threshold_value").notNull(), // e.g., 5 for 5% daily loss, 3 for 3-trade streak
    thresholdUnit: varchar("threshold_unit", { length: 20 }).notNull(), // "percent" | "usd" | "count"
    alertSeverity: varchar("alert_severity", { length: 20 })
      .notNull()
      .default("warning"), // "info" | "warning" | "critical"
    isEnabled: boolean("is_enabled").notNull().default(true),
    notifyInApp: boolean("notify_in_app").notNull().default(true),
    notifyEmail: boolean("notify_email").notNull().default(false),
    cooldownMinutes: integer("cooldown_minutes").default(60), // Min time between repeat alerts
    lastTriggeredAt: timestamp("last_triggered_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_perf_alert_rule_user").on(table.userId),
    accountIdx: index("idx_perf_alert_rule_account").on(table.accountId),
    enabledIdx: index("idx_perf_alert_rule_enabled").on(table.isEnabled),
  })
);

// Performance Alert History - Triggered alerts log
export const performanceAlert = pgTable(
  "performance_alert",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").references(() => tradingAccount.id, {
      onDelete: "cascade",
    }),
    ruleId: text("rule_id").references(() => performanceAlertRule.id, {
      onDelete: "set null",
    }),
    alertType: varchar("alert_type", { length: 30 }).notNull(), // Same as ruleType
    severity: varchar("severity", { length: 20 }).notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    currentValue: numeric("current_value"),
    thresholdValue: numeric("threshold_value"),
    acknowledged: boolean("acknowledged").default(false),
    acknowledgedAt: timestamp("acknowledged_at"),
    metadata: jsonb("metadata"), // Additional context
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_perf_alert_user").on(table.userId),
    accountIdx: index("idx_perf_alert_account").on(table.accountId),
    severityIdx: index("idx_perf_alert_severity").on(table.severity),
    createdIdx: index("idx_perf_alert_created").on(table.createdAt),
  })
);

// Prop Firm Alerts - Track rule violations and warnings
export const propAlert = pgTable(
  "prop_alert",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    alertType: varchar("alert_type", { length: 20 }).notNull(), // "warning" | "breach" | "milestone"
    severity: varchar("severity", { length: 20 }).notNull(), // "info" | "warning" | "critical"
    rule: varchar("rule", { length: 50 }).notNull(), // "daily_loss", "max_loss", "profit_target", "consistency"
    message: text("message").notNull(),
    currentValue: numeric("current_value"),
    thresholdValue: numeric("threshold_value"),
    metadata: jsonb("metadata"), // Additional context
    acknowledged: boolean("acknowledged").default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: index("idx_prop_alert_account").on(table.accountId),
    severityIdx: index("idx_prop_alert_severity").on(table.severity),
    accountSeverityIdx: index("idx_prop_alert_account_severity").on(
      table.accountId,
      table.severity
    ),
  })
);

// ============== TRADING RULES ENGINE ==============

// Trading Rule Sets - User-defined rule configurations
export const tradingRuleSet = pgTable(
  "trading_rule_set",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").references(() => tradingAccount.id, {
      onDelete: "cascade",
    }), // null = applies to all accounts
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),

    // Rule configuration stored as JSONB for flexibility
    rules: jsonb("rules").notNull().$type<{
      requireSL?: boolean;
      requireTP?: boolean;
      requireSessionTag?: boolean;
      requireModelTag?: boolean;
      maxEntrySpreadPips?: number;
      maxEntrySlippagePips?: number;
      maxExitSlippagePips?: number;
      maxPlannedRiskPips?: number;
      minPlannedRR?: number;
      maxPlannedRR?: number;
      maxDrawdownPct?: number;
      disallowScaleIn?: boolean;
      disallowScaleOut?: boolean;
      disallowPartials?: boolean;
      minHoldSeconds?: number;
      maxHoldSeconds?: number;
      // Session/time restrictions
      allowedSessions?: string[];
      allowedDays?: number[]; // 0-6, 0 = Sunday
      // Symbol restrictions
      allowedSymbols?: string[];
      blockedSymbols?: string[];
      // Risk restrictions
      maxDailyTrades?: number;
      maxConcurrentTrades?: number;
      maxDailyLossPercent?: number;
      maxPositionSizePercent?: number;
    }>(),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_trading_rule_set_user").on(table.userId),
    accountIdx: index("idx_trading_rule_set_account").on(table.accountId),
    activeIdx: index("idx_trading_rule_set_active").on(table.isActive),
  })
);

// Trade Rule Evaluations - Store compliance results per trade
export const tradeRuleEvaluation = pgTable(
  "trade_rule_evaluation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tradeId: text("trade_id")
      .notNull()
      .references(() => trade.id, { onDelete: "cascade" }),
    ruleSetId: text("rule_set_id")
      .notNull()
      .references(() => tradingRuleSet.id, { onDelete: "cascade" }),

    status: varchar("status", { length: 20 }).notNull(), // "pass" | "fail" | "partial"
    score: numeric("score"), // 0-100 compliance score
    passedRules: integer("passed_rules").notNull().default(0),
    failedRules: integer("failed_rules").notNull().default(0),
    totalRules: integer("total_rules").notNull().default(0),

    violations: jsonb("violations").$type<string[]>(), // List of violation messages
    metadata: jsonb("metadata"), // Additional evaluation data

    evaluatedAt: timestamp("evaluated_at").notNull().defaultNow(),
  },
  (table) => ({
    tradeIdx: index("idx_trade_rule_eval_trade").on(table.tradeId),
    ruleSetIdx: index("idx_trade_rule_eval_ruleset").on(table.ruleSetId),
    statusIdx: index("idx_trade_rule_eval_status").on(table.status),
  })
);

// ============== PNL CARD TEMPLATES & SHARING ==============

// Card Templates - Pre-defined and user-created card designs
export const pnlCardTemplate = pgTable(
  "pnl_card_template",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }), // null = system template
    name: text("name").notNull(),
    description: text("description"),

    // Visual configuration
    backgroundType: varchar("background_type", { length: 20 })
      .notNull()
      .default("gradient"), // 'gradient' | 'image' | 'solid'
    backgroundValue: text("background_value").notNull(), // gradient colors, image URL, or hex color
    backgroundImageUrl: text("background_image_url"), // Custom background image

    // Layout configuration stored as JSONB
    layout: jsonb("layout").notNull(), // { font, colors, positions, elements }

    // Template metadata
    isPublic: boolean("is_public").default(false), // Public templates available to all users
    isSystem: boolean("is_system").default(false), // System-provided templates
    usageCount: integer("usage_count").default(0), // Track popularity

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_pnl_card_template_user").on(table.userId),
    publicIdx: index("idx_pnl_card_template_public").on(table.isPublic),
  })
);

// Shared PnL Cards - Generated and shared trade cards
export const sharedPnlCard = pgTable(
  "shared_pnl_card",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    shareId: text("share_id").notNull().unique(), // Short, shareable ID (e.g., "abc123")
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tradeId: text("trade_id")
      .notNull()
      .references(() => trade.id, { onDelete: "cascade" }),
    templateId: text("template_id").references(() => pnlCardTemplate.id, {
      onDelete: "set null",
    }),

    // Card configuration (snapshot at time of creation)
    config: jsonb("config").notNull(), // Complete card configuration

    // Generated card data (cached for performance)
    imageUrl: text("image_url"), // Generated card image URL
    cardData: jsonb("card_data").notNull(), // Trade stats snapshot

    // Privacy & sharing settings
    isPublic: boolean("is_public").default(true), // Public vs private share
    expiresAt: timestamp("expires_at"), // Optional expiration
    password: text("password"), // Optional password protection (hashed)

    // Analytics
    viewCount: integer("view_count").default(0),
    lastViewedAt: timestamp("last_viewed_at"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_shared_pnl_card_user").on(table.userId),
    tradeIdx: index("idx_shared_pnl_card_trade").on(table.tradeId),
    shareIdIdx: uniqueIndex("idx_shared_pnl_card_share_id").on(table.shareId),
  })
);

// ============== PROP FIRM RELATIONS ==============

export const propFirmRelations = relations(propFirm, ({ one, many }) => ({
  owner: one(user, {
    fields: [propFirm.createdByUserId],
    references: [user.id],
  }),
  challengeRules: many(propChallengeRule),
}));

export const propChallengeRuleRelations = relations(
  propChallengeRule,
  ({ one }) => ({
    owner: one(user, {
      fields: [propChallengeRule.createdByUserId],
      references: [user.id],
    }),
    propFirm: one(propFirm, {
      fields: [propChallengeRule.propFirmId],
      references: [propFirm.id],
    }),
  })
);

export const propChallengeInstanceRelations = relations(
  propChallengeInstance,
  ({ one, many }) => ({
    user: one(user, {
      fields: [propChallengeInstance.userId],
      references: [user.id],
    }),
    currentAccount: one(tradingAccount, {
      fields: [propChallengeInstance.currentAccountId],
      references: [tradingAccount.id],
    }),
    stageAccounts: many(propChallengeStageAccount),
  })
);

export const propChallengeStageAccountRelations = relations(
  propChallengeStageAccount,
  ({ one }) => ({
    challengeInstance: one(propChallengeInstance, {
      fields: [propChallengeStageAccount.challengeInstanceId],
      references: [propChallengeInstance.id],
    }),
    account: one(tradingAccount, {
      fields: [propChallengeStageAccount.accountId],
      references: [tradingAccount.id],
    }),
  })
);

export const propAlertRelations = relations(propAlert, ({ one }) => ({
  account: one(tradingAccount, {
    fields: [propAlert.accountId],
    references: [tradingAccount.id],
  }),
}));

export const propDailySnapshotRelations = relations(
  propDailySnapshot,
  ({ one }) => ({
    account: one(tradingAccount, {
      fields: [propDailySnapshot.accountId],
      references: [tradingAccount.id],
    }),
  })
);

// ============== TRADE MEDIA RELATIONS ==============
// Note: tradeMediaRelations is defined in journal.ts to avoid circular imports

export const tradeRelations = relations(trade, ({ one, many }) => ({
  account: one(tradingAccount, {
    fields: [trade.accountId],
    references: [tradingAccount.id],
  }),
}));

export const symbolMappingRelations = relations(symbolMapping, ({ one }) => ({
  user: one(user, {
    fields: [symbolMapping.userId],
    references: [user.id],
  }),
}));

export const tradingAccountRelations = relations(
  tradingAccount,
  ({ one, many }) => ({
    user: one(user, {
      fields: [tradingAccount.userId],
      references: [user.id],
    }),
    propChallengeInstance: one(propChallengeInstance, {
      fields: [tradingAccount.propChallengeInstanceId],
      references: [propChallengeInstance.id],
    }),
    trades: many(trade),
    publicShares: many(publicAccountShare),
    tradeTrustEvents: many(tradeTrustEvent),
    openTrades: many(openTrade),
    goals: many(goal),
    propChallengeStages: many(propChallengeStageAccount),
  })
);

export const publicAccountShareRelations = relations(
  publicAccountShare,
  ({ one }) => ({
    user: one(user, {
      fields: [publicAccountShare.userId],
      references: [user.id],
    }),
    account: one(tradingAccount, {
      fields: [publicAccountShare.accountId],
      references: [tradingAccount.id],
    }),
  })
);

export const tradeTrustEventRelations = relations(
  tradeTrustEvent,
  ({ one }) => ({
    user: one(user, {
      fields: [tradeTrustEvent.userId],
      references: [user.id],
    }),
    account: one(tradingAccount, {
      fields: [tradeTrustEvent.accountId],
      references: [tradingAccount.id],
    }),
  })
);
