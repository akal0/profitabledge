import {
  pgTable,
  text,
  timestamp,
  boolean,
  serial,
  jsonb,
  integer,
  numeric,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").unique(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  twitter: text("twitter"),
  discord: text("discord"),
  widgetPreferences: jsonb("widget_preferences"),
  chartWidgetPreferences: jsonb("chart_widget_preferences"),
  tablePreferences: jsonb("table_preferences"),
  advancedMetricsPreferences: jsonb("advanced_metrics_preferences"), // { disableSampleGating: boolean, alphaWeightedMpe: number }
  notificationPreferences: jsonb("notification_preferences"),

  // Sample gate preferences for progressive disclosure
  sampleGatePreferences: jsonb("sample_gate_preferences").$type<{
    disableAllGates?: boolean;
    minimumSamples?: {
      basic?: number;
      intermediate?: number;
      advanced?: number;
      statistical?: number;
    };
  }>(),

  // Social profile fields
  isPublicProfile: boolean("is_public_profile").default(false),
  displayName: text("display_name"),
  bio: text("bio"),
  profileBannerUrl: text("profile_banner_url"),
  profileBannerPosition: text("profile_banner_position"),
  location: text("location"),
  website: text("website"),
  tradingSince: timestamp("trading_since"),
  isPremium: boolean("is_premium").default(false),
  isVerified: boolean("is_verified").default(false),
  verificationBadgeType: text("verification_badge_type"), // 'premium' | 'funded' | 'mentor' | 'partner'
  leaderboardOptIn: boolean("leaderboard_opt_in").default(false),
  leaderboardDisplayName: text("leaderboard_display_name"),
  profileViews: integer("profile_views").default(0),

  // Quiet reputation signals (replaces follower counts)
  accountsFollowingCount: integer("accounts_following_count").default(0),
  patternFollowsCount: integer("pattern_follows_count").default(0),
  verifiedSince: timestamp("verified_since"),
  totalVerifiedTrades: integer("total_verified_trades").default(0),
  metricsStable: boolean("metrics_stable").default(false), // 90+ days, 100+ trades
  avgProtocolRate: numeric("avg_protocol_rate"), // Across all accounts

  hasSeenTour: boolean("has_seen_tour").notNull().default(false),

  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// API keys for MT4/MT5 Expert Advisor integration
export const apiKey = pgTable("api_key", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // User-friendly name: "My FTMO Account EA"
  keyHash: text("key_hash").notNull().unique(), // SHA-256 hash of the actual key
  keyPrefix: text("key_prefix").notNull(), // First 8 chars for display: "pe_live_abc123..."
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"), // Optional: keys can expire
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
