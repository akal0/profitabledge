import {
  index,
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
  numeric,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  role: text("role").default("user"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  lastLoginMethod: text("last_login_method"),
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

  profileEffects: jsonb("profile_effects").$type<{
    pfpEffect?: string;
    nameEffect?: string;
    nameFont?: string;
    nameColor?: string;
  }>(),

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
  impersonatedBy: text("impersonated_by"),
  activeOrganizationId: text("active_organization_id"),
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

export const twoFactor = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => ({
    secretIdx: index("two_factor_secret_idx").on(table.secret),
    userUnique: uniqueIndex("two_factor_user_idx").on(table.userId),
  })
);

export const passkey = pgTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    aaguid: text("aaguid"),
  },
  (table) => ({
    userIdx: index("passkey_user_idx").on(table.userId),
    credentialUnique: uniqueIndex("passkey_credential_idx").on(
      table.credentialID
    ),
  })
);

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logo: text("logo"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    slugUnique: uniqueIndex("organization_slug_idx").on(table.slug),
  })
);

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("member_user_idx").on(table.userId),
    userMembershipUnique: uniqueIndex("member_org_user_idx").on(
      table.organizationId,
      table.userId
    ),
  })
);

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => ({
    organizationIdx: index("invitation_org_idx").on(table.organizationId),
    emailIdx: index("invitation_email_idx").on(table.email),
  })
);

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
