import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { tradingAccount } from "./trading";

export const billingCustomer = pgTable(
  "billing_customer",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 24 }).notNull().default("stripe"),
    providerCustomerId: varchar("provider_customer_id", { length: 120 }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 120 }),
    stripeDefaultPaymentMethodId: varchar("stripe_default_payment_method_id", {
      length: 120,
    }),
    email: text("email"),
    name: text("name"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("billing_customer_user_idx").on(table.userId),
    providerCustomerUnique: uniqueIndex("billing_customer_provider_customer_idx").on(
      table.providerCustomerId
    ),
    stripeCustomerUnique: uniqueIndex("billing_customer_stripe_customer_idx").on(
      table.stripeCustomerId
    ),
  })
);

export const billingSubscription = pgTable(
  "billing_subscription",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 24 }).notNull().default("stripe"),
    providerSubscriptionId: varchar("provider_subscription_id", {
      length: 120,
    }),
    providerCustomerId: varchar("provider_customer_id", { length: 120 }),
    providerCheckoutSessionId: varchar("provider_checkout_session_id", {
      length: 120,
    }),
    providerPriceId: varchar("provider_price_id", { length: 120 }),
    providerProductId: varchar("provider_product_id", { length: 120 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", {
      length: 120,
    }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 120 }),
    stripeCheckoutSessionId: varchar("stripe_checkout_session_id", {
      length: 120,
    }),
    stripePriceId: varchar("stripe_price_id", { length: 120 }),
    stripeProductId: varchar("stripe_product_id", { length: 120 }),
    stripeLatestInvoiceId: varchar("stripe_latest_invoice_id", { length: 120 }),
    planKey: varchar("plan_key", { length: 40 }).notNull(),
    status: varchar("status", { length: 40 }).notNull(),
    currency: varchar("currency", { length: 10 }),
    amount: integer("amount"),
    recurringInterval: varchar("recurring_interval", { length: 20 }),
    recurringIntervalCount: integer("recurring_interval_count"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    trialStart: timestamp("trial_start"),
    trialEnd: timestamp("trial_end"),
    startedAt: timestamp("started_at"),
    endsAt: timestamp("ends_at"),
    endedAt: timestamp("ended_at"),
    canceledAt: timestamp("canceled_at"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("billing_subscription_user_idx").on(
      table.userId,
      table.updatedAt
    ),
    providerSubscriptionUnique: uniqueIndex(
      "billing_subscription_provider_subscription_idx"
    ).on(table.providerSubscriptionId),
    stripeSubscriptionUnique: uniqueIndex(
      "billing_subscription_stripe_subscription_idx"
    ).on(table.stripeSubscriptionId),
    statusPeriodIdx: index("billing_subscription_status_period_idx").on(
      table.status,
      table.currentPeriodEnd
    ),
  })
);

export const billingOrder = pgTable(
  "billing_order",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 24 }).notNull().default("stripe"),
    providerOrderId: varchar("provider_order_id", { length: 120 }),
    providerCustomerId: varchar("provider_customer_id", { length: 120 }),
    providerSubscriptionId: varchar("provider_subscription_id", { length: 120 }),
    providerCheckoutSessionId: varchar("provider_checkout_session_id", {
      length: 120,
    }),
    providerInvoiceId: varchar("provider_invoice_id", { length: 120 }),
    providerPaymentIntentId: varchar("provider_payment_intent_id", {
      length: 120,
    }),
    providerChargeId: varchar("provider_charge_id", { length: 120 }),
    providerPriceId: varchar("provider_price_id", { length: 120 }),
    providerProductId: varchar("provider_product_id", { length: 120 }),
    stripeInvoiceId: varchar("stripe_invoice_id", { length: 120 }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 120 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 120 }),
    stripeCheckoutSessionId: varchar("stripe_checkout_session_id", {
      length: 120,
    }),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", {
      length: 120,
    }),
    stripeChargeId: varchar("stripe_charge_id", { length: 120 }),
    stripePriceId: varchar("stripe_price_id", { length: 120 }),
    stripeProductId: varchar("stripe_product_id", { length: 120 }),
    planKey: varchar("plan_key", { length: 40 }).notNull(),
    status: varchar("status", { length: 40 }).notNull(),
    currency: varchar("currency", { length: 10 }),
    subtotalAmount: integer("subtotal_amount"),
    discountAmount: integer("discount_amount"),
    taxAmount: integer("tax_amount"),
    totalAmount: integer("total_amount"),
    paid: boolean("paid").notNull().default(false),
    paidAt: timestamp("paid_at"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("billing_order_user_idx").on(table.userId, table.createdAt),
    providerOrderUnique: uniqueIndex("billing_order_provider_order_idx").on(
      table.providerOrderId
    ),
    stripeInvoiceUnique: uniqueIndex("billing_order_stripe_invoice_idx").on(
      table.stripeInvoiceId
    ),
  })
);

export const billingWebhookEvent = pgTable(
  "billing_webhook_event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    provider: varchar("provider", { length: 24 }).notNull().default("stripe"),
    providerEventId: varchar("provider_event_id", { length: 255 }),
    providerObjectId: varchar("provider_object_id", { length: 120 }),
    eventKey: varchar("event_key", { length: 255 }).notNull(),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    objectId: varchar("object_id", { length: 120 }),
    processingStatus: varchar("processing_status", { length: 32 })
      .notNull()
      .default("processed"),
    processedAt: timestamp("processed_at"),
    errorMessage: text("error_message"),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    eventKeyUnique: uniqueIndex("billing_webhook_event_key_idx").on(
      table.eventKey
    ),
    providerEventUnique: uniqueIndex("billing_webhook_event_provider_event_idx").on(
      table.provider,
      table.providerEventId
    ),
    eventTypeIdx: index("billing_webhook_event_type_idx").on(
      table.eventType,
      table.createdAt
    ),
  })
);

export const affiliateProfile = pgTable(
  "affiliate_profile",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 64 }).notNull(),
    displayName: text("display_name"),
    commissionBps: integer("commission_bps").notNull().default(2000),
    tierKey: varchar("tier_key", { length: 24 }).notNull().default("partner"),
    tierMode: varchar("tier_mode", { length: 24 }).notNull().default("automatic"),
    tierAssignedAt: timestamp("tier_assigned_at"),
    tierAssignedByUserId: text("tier_assigned_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    isActive: boolean("is_active").notNull().default(true),
    approvedAt: timestamp("approved_at"),
    approvedByUserId: text("approved_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userUnique: uniqueIndex("affiliate_profile_user_idx").on(table.userId),
    codeUnique: uniqueIndex("affiliate_profile_code_idx").on(table.code),
  })
);

// Legacy alpha-era table retained for migration history. New referral logic
// writes to referralProfile/referralConversion instead.
export const affiliateReferral = pgTable(
  "affiliate_referral",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    affiliateProfileId: text("affiliate_profile_id")
      .notNull()
      .references(() => affiliateProfile.id, { onDelete: "cascade" }),
    referrerUserId: text("referrer_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referredUserId: text("referred_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referralCode: varchar("referral_code", { length: 64 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("signed_up"),
    commissionBps: integer("commission_bps").notNull().default(2000),
    commissionAmount: integer("commission_amount"),
    convertedOrderId: varchar("converted_order_id", { length: 120 }),
    convertedSubscriptionId: varchar("converted_subscription_id", {
      length: 120,
    }),
    convertedAt: timestamp("converted_at"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    referredUserUnique: uniqueIndex("affiliate_referral_referred_user_idx").on(
      table.referredUserId
    ),
    referrerStatusIdx: index("affiliate_referral_referrer_status_idx").on(
      table.referrerUserId,
      table.status,
      table.createdAt
    ),
  })
);

export const referralProfile = pgTable(
  "referral_profile",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 64 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userUnique: uniqueIndex("referral_profile_user_idx").on(table.userId),
    codeUnique: uniqueIndex("referral_profile_code_idx").on(table.code),
  })
);

export const referralConversion = pgTable(
  "referral_conversion",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    referralProfileId: text("referral_profile_id")
      .notNull()
      .references(() => referralProfile.id, { onDelete: "cascade" }),
    referrerUserId: text("referrer_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referredUserId: text("referred_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referralCode: varchar("referral_code", { length: 64 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("signed_up"),
    paidOrderId: varchar("paid_order_id", { length: 120 }),
    paidSubscriptionId: varchar("paid_subscription_id", {
      length: 120,
    }),
    paidAt: timestamp("paid_at"),
    source: varchar("source", { length: 32 }).notNull().default("app"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    referredUserUnique: uniqueIndex("referral_conversion_referred_user_idx").on(
      table.referredUserId
    ),
    referrerStatusIdx: index("referral_conversion_referrer_status_idx").on(
      table.referrerUserId,
      table.status,
      table.createdAt
    ),
  })
);

export const referralRewardGrant = pgTable(
  "referral_reward_grant",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    rewardType: varchar("reward_type", { length: 40 }).notNull(),
    sequenceNumber: integer("sequence_number").notNull(),
    conversionCount: integer("conversion_count").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("granted"),
    edgeCredits: integer("edge_credits"),
    discountProvider: varchar("discount_provider", { length: 24 }),
    providerDiscountId: varchar("provider_discount_id", { length: 120 }),
    providerDiscountCode: varchar("provider_discount_code", { length: 128 }),
    targetPlanKey: varchar("target_plan_key", { length: 40 }),
    overrideStartsAt: timestamp("override_starts_at"),
    overrideEndsAt: timestamp("override_ends_at"),
    metadata: jsonb("metadata"),
    grantedAt: timestamp("granted_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userRewardUnique: uniqueIndex("referral_reward_grant_user_reward_idx").on(
      table.userId,
      table.rewardType,
      table.sequenceNumber
    ),
    userStatusIdx: index("referral_reward_grant_user_status_idx").on(
      table.userId,
      table.status,
      table.grantedAt
    ),
  })
);

export type AffiliateApplicationDetails = {
  whyApply: string;
  promotionPlan: string;
  estimatedMonthlyReferrals: number;
  audienceSize?: number | null;
  twitter?: string | null;
  discord?: string | null;
  website?: string | null;
  location?: string | null;
  otherSocials?: string | null;
};

export const affiliateApplication = pgTable(
  "affiliate_application",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    message: text("message"),
    details: jsonb("details").$type<AffiliateApplicationDetails>(),
    adminNotes: text("admin_notes"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userUnique: uniqueIndex("affiliate_application_user_idx").on(table.userId),
    statusIdx: index("affiliate_application_status_idx").on(
      table.status,
      table.createdAt
    ),
  })
);

export const affiliateGroup = pgTable(
  "affiliate_group",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    affiliateProfileId: text("affiliate_profile_id")
      .notNull()
      .references(() => affiliateProfile.id, { onDelete: "cascade" }),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    profileUnique: uniqueIndex("affiliate_group_profile_idx").on(
      table.affiliateProfileId
    ),
    slugUnique: uniqueIndex("affiliate_group_slug_idx").on(table.slug),
    ownerIdx: index("affiliate_group_owner_idx").on(table.ownerUserId),
  })
);

export const affiliateGroupMember = pgTable(
  "affiliate_group_member",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    affiliateGroupId: text("affiliate_group_id")
      .notNull()
      .references(() => affiliateGroup.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    source: varchar("source", { length: 32 }).notNull().default("open_link"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userUnique: uniqueIndex("affiliate_group_member_user_idx").on(table.userId),
    groupUserUnique: uniqueIndex("affiliate_group_member_group_user_idx").on(
      table.affiliateGroupId,
      table.userId
    ),
    groupIdx: index("affiliate_group_member_group_idx").on(table.affiliateGroupId),
  })
);

export const affiliateOffer = pgTable(
  "affiliate_offer",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    affiliateProfileId: text("affiliate_profile_id")
      .notNull()
      .references(() => affiliateProfile.id, { onDelete: "cascade" }),
    affiliateUserId: text("affiliate_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 64 }).notNull(),
    label: text("label").notNull(),
    description: text("description"),
    discountProvider: varchar("discount_provider", { length: 24 }),
    providerDiscountId: varchar("provider_discount_id", { length: 120 }),
    providerPromotionCodeId: varchar("provider_promotion_code_id", {
      length: 120,
    }),
    discountType: varchar("discount_type", { length: 24 })
      .notNull()
      .default("percentage"),
    discountBasisPoints: integer("discount_basis_points").notNull().default(1000),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    metadata: jsonb("metadata"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    codeUnique: uniqueIndex("affiliate_offer_code_idx").on(table.code),
    profileIdx: index("affiliate_offer_profile_idx").on(
      table.affiliateProfileId,
      table.isActive,
      table.createdAt
    ),
    affiliateDefaultIdx: index("affiliate_offer_affiliate_default_idx").on(
      table.affiliateUserId,
      table.isDefault
    ),
  })
);

export const affiliateTrackingLink = pgTable(
  "affiliate_tracking_link",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    affiliateProfileId: text("affiliate_profile_id")
      .notNull()
      .references(() => affiliateProfile.id, { onDelete: "cascade" }),
    affiliateUserId: text("affiliate_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    affiliateOfferId: text("affiliate_offer_id").references(() => affiliateOffer.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    destinationPath: text("destination_path").notNull().default("/sign-up"),
    affiliateGroupSlug: varchar("affiliate_group_slug", { length: 80 }),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    affiliateSlugUnique: uniqueIndex("affiliate_tracking_link_affiliate_slug_idx").on(
      table.affiliateProfileId,
      table.slug
    ),
    affiliateDefaultIdx: index("affiliate_tracking_link_affiliate_default_idx").on(
      table.affiliateUserId,
      table.isDefault
    ),
    offerIdx: index("affiliate_tracking_link_offer_idx").on(table.affiliateOfferId),
  })
);

export const affiliateTouchEvent = pgTable(
  "affiliate_touch_event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    visitorToken: varchar("visitor_token", { length: 120 }).notNull(),
    touchType: varchar("touch_type", { length: 24 }).notNull(),
    affiliateProfileId: text("affiliate_profile_id").references(
      () => affiliateProfile.id,
      {
        onDelete: "set null",
      }
    ),
    affiliateUserId: text("affiliate_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    referralProfileId: text("referral_profile_id").references(
      () => referralProfile.id,
      {
        onDelete: "set null",
      }
    ),
    affiliateOfferId: text("affiliate_offer_id").references(() => affiliateOffer.id, {
      onDelete: "set null",
    }),
    affiliateTrackingLinkId: text("affiliate_tracking_link_id").references(
      () => affiliateTrackingLink.id,
      {
        onDelete: "set null",
      }
    ),
    affiliateCode: varchar("affiliate_code", { length: 64 }),
    referralCode: varchar("referral_code", { length: 64 }),
    affiliateGroupSlug: varchar("affiliate_group_slug", { length: 80 }),
    sourcePath: text("source_path"),
    referrerUrl: text("referrer_url"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    visitorIdx: index("affiliate_touch_event_visitor_idx").on(
      table.visitorToken,
      table.createdAt
    ),
    affiliateIdx: index("affiliate_touch_event_affiliate_idx").on(
      table.affiliateUserId,
      table.createdAt
    ),
    offerIdx: index("affiliate_touch_event_offer_idx").on(
      table.affiliateOfferId,
      table.createdAt
    ),
    linkIdx: index("affiliate_touch_event_link_idx").on(
      table.affiliateTrackingLinkId,
      table.createdAt
    ),
  })
);

export const affiliatePendingAttribution = pgTable(
  "affiliate_pending_attribution",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    visitorToken: varchar("visitor_token", { length: 120 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    touchType: varchar("touch_type", { length: 24 }).notNull(),
    affiliateProfileId: text("affiliate_profile_id").references(
      () => affiliateProfile.id,
      {
        onDelete: "set null",
      }
    ),
    affiliateUserId: text("affiliate_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    referralProfileId: text("referral_profile_id").references(
      () => referralProfile.id,
      {
        onDelete: "set null",
      }
    ),
    affiliateOfferId: text("affiliate_offer_id").references(() => affiliateOffer.id, {
      onDelete: "set null",
    }),
    affiliateTrackingLinkId: text("affiliate_tracking_link_id").references(
      () => affiliateTrackingLink.id,
      {
        onDelete: "set null",
      }
    ),
    affiliateCode: varchar("affiliate_code", { length: 64 }),
    referralCode: varchar("referral_code", { length: 64 }),
    affiliateGroupSlug: varchar("affiliate_group_slug", { length: 80 }),
    firstTouchedAt: timestamp("first_touched_at").notNull().defaultNow(),
    lastTouchedAt: timestamp("last_touched_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
    claimedUserId: text("claimed_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    claimedAt: timestamp("claimed_at"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    visitorUnique: uniqueIndex("affiliate_pending_attribution_visitor_idx").on(
      table.visitorToken
    ),
    statusExpiryIdx: index("affiliate_pending_attribution_status_expiry_idx").on(
      table.status,
      table.expiresAt
    ),
    affiliateIdx: index("affiliate_pending_attribution_affiliate_idx").on(
      table.affiliateUserId,
      table.createdAt
    ),
  })
);

export const affiliateAttribution = pgTable(
  "affiliate_attribution",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    affiliateProfileId: text("affiliate_profile_id")
      .notNull()
      .references(() => affiliateProfile.id, { onDelete: "cascade" }),
    affiliateUserId: text("affiliate_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referredUserId: text("referred_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    affiliateCode: varchar("affiliate_code", { length: 64 }).notNull(),
    affiliateOfferId: text("affiliate_offer_id").references(() => affiliateOffer.id, {
      onDelete: "set null",
    }),
    affiliateTrackingLinkId: text("affiliate_tracking_link_id").references(
      () => affiliateTrackingLink.id,
      {
        onDelete: "set null",
      }
    ),
    affiliateGroupId: text("affiliate_group_id").references(
      () => affiliateGroup.id,
      {
        onDelete: "set null",
      }
    ),
    status: varchar("status", { length: 24 }).notNull().default("signed_up"),
    firstPaidAt: timestamp("first_paid_at"),
    lastPaidAt: timestamp("last_paid_at"),
    convertedSubscriptionId: varchar("converted_subscription_id", {
      length: 120,
    }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    referredUserUnique: uniqueIndex("affiliate_attribution_referred_user_idx").on(
      table.referredUserId
    ),
    affiliateStatusIdx: index("affiliate_attribution_affiliate_status_idx").on(
      table.affiliateUserId,
      table.status,
      table.createdAt
    ),
  })
);

export const affiliatePaymentMethod = pgTable(
  "affiliate_payment_method",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    affiliateUserId: text("affiliate_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    methodType: varchar("method_type", { length: 32 }).notNull(),
    label: text("label").notNull(),
    recipientName: text("recipient_name"),
    details: text("details").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    affiliateIdx: index("affiliate_payment_method_affiliate_idx").on(
      table.affiliateUserId,
      table.createdAt
    ),
    affiliateDefaultIdx: index("affiliate_payment_method_default_idx").on(
      table.affiliateUserId,
      table.isDefault
    ),
  })
);

export const affiliateProviderAccount = pgTable(
  "affiliate_provider_account",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    affiliateUserId: text("affiliate_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull().default("stripe_connect"),
    providerAccountId: varchar("provider_account_id", { length: 120 }).notNull(),
    country: varchar("country", { length: 8 }),
    currency: varchar("currency", { length: 8 }),
    email: text("email"),
    onboardingStatus: varchar("onboarding_status", { length: 24 })
      .notNull()
      .default("pending"),
    detailsSubmitted: boolean("details_submitted").notNull().default(false),
    chargesEnabled: boolean("charges_enabled").notNull().default(false),
    payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    disconnectedAt: timestamp("disconnected_at"),
    lastSyncedAt: timestamp("last_synced_at"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    affiliateUnique: uniqueIndex("affiliate_provider_account_affiliate_idx").on(
      table.affiliateUserId,
      table.provider
    ),
    providerAccountUnique: uniqueIndex(
      "affiliate_provider_account_provider_account_idx"
    ).on(table.providerAccountId),
  })
);

export const affiliateWithdrawalRequest = pgTable(
  "affiliate_withdrawal_request",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    affiliateUserId: text("affiliate_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    destinationType: varchar("destination_type", { length: 32 }).notNull(),
    providerAccountId: text("provider_account_id").references(
      () => affiliateProviderAccount.id,
      {
        onDelete: "set null",
      }
    ),
    paymentMethodId: text("payment_method_id").references(
      () => affiliatePaymentMethod.id,
      {
        onDelete: "set null",
      }
    ),
    amount: integer("amount").notNull().default(0),
    currency: varchar("currency", { length: 10 }).notNull().default("USD"),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    externalReference: text("external_reference"),
    providerTransferId: varchar("provider_transfer_id", { length: 120 }),
    providerPayoutId: varchar("provider_payout_id", { length: 120 }),
    notes: text("notes"),
    requestedAt: timestamp("requested_at").notNull().defaultNow(),
    approvedAt: timestamp("approved_at"),
    rejectedAt: timestamp("rejected_at"),
    cancelledAt: timestamp("cancelled_at"),
    paidAt: timestamp("paid_at"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    affiliateRequestedIdx: index("affiliate_withdrawal_request_affiliate_idx").on(
      table.affiliateUserId,
      table.requestedAt
    ),
    statusIdx: index("affiliate_withdrawal_request_status_idx").on(
      table.status,
      table.requestedAt
    ),
    providerIdx: index("affiliate_withdrawal_request_provider_idx").on(
      table.providerAccountId
    ),
  })
);

export const affiliatePayout = pgTable(
  "affiliate_payout",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    affiliateUserId: text("affiliate_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    withdrawalRequestId: text("withdrawal_request_id").references(
      () => affiliateWithdrawalRequest.id,
      {
        onDelete: "set null",
      }
    ),
    destinationType: varchar("destination_type", { length: 32 })
      .notNull()
      .default("manual"),
    providerAccountId: text("provider_account_id").references(
      () => affiliateProviderAccount.id,
      {
        onDelete: "set null",
      }
    ),
    paymentMethodId: text("payment_method_id").references(
      () => affiliatePaymentMethod.id,
      {
        onDelete: "set null",
      }
    ),
    amount: integer("amount").notNull().default(0),
    currency: varchar("currency", { length: 10 }).notNull().default("USD"),
    eventCount: integer("event_count").notNull().default(0),
    status: varchar("status", { length: 24 }).notNull().default("paid"),
    externalReference: text("external_reference"),
    stripeTransferId: varchar("stripe_transfer_id", { length: 120 }),
    stripePayoutId: varchar("stripe_payout_id", { length: 120 }),
    notes: text("notes"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    affiliatePaidIdx: index("affiliate_payout_affiliate_paid_idx").on(
      table.affiliateUserId,
      table.paidAt
    ),
    paymentMethodIdx: index("affiliate_payout_payment_method_idx").on(
      table.paymentMethodId
    ),
  })
);

export const affiliateCommissionEvent = pgTable(
  "affiliate_commission_event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    affiliateAttributionId: text("affiliate_attribution_id")
      .notNull()
      .references(() => affiliateAttribution.id, { onDelete: "cascade" }),
    affiliateUserId: text("affiliate_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referredUserId: text("referred_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referredUsername: text("referred_username"),
    referredEmail: text("referred_email"),
    provider: varchar("provider", { length: 24 }).notNull().default("stripe"),
    providerOrderId: varchar("provider_order_id", { length: 120 }),
    providerSubscriptionId: varchar("provider_subscription_id", { length: 120 }),
    billingOrderId: text("billing_order_id").references(() => billingOrder.id, {
      onDelete: "set null",
    }),
    stripeInvoiceId: varchar("stripe_invoice_id", { length: 120 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 120 }),
    planKey: varchar("plan_key", { length: 40 }),
    orderAmount: integer("order_amount"),
    commissionBps: integer("commission_bps").notNull().default(2000),
    commissionAmount: integer("commission_amount").notNull().default(0),
    currency: varchar("currency", { length: 10 }),
    affiliatePayoutId: text("affiliate_payout_id").references(
      () => affiliatePayout.id,
      {
        onDelete: "set null",
      }
    ),
    paidOutAt: timestamp("paid_out_at"),
    occurredAt: timestamp("occurred_at"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    providerOrderUnique: uniqueIndex("affiliate_commission_event_provider_order_idx").on(
      table.provider,
      table.providerOrderId
    ),
    stripeInvoiceUnique: uniqueIndex(
      "affiliate_commission_event_stripe_invoice_idx"
    ).on(table.stripeInvoiceId),
    affiliateOccurredIdx: index("affiliate_commission_event_affiliate_idx").on(
      table.affiliateUserId,
      table.occurredAt
    ),
    payoutIdx: index("affiliate_commission_event_payout_idx").on(
      table.affiliatePayoutId,
      table.occurredAt
    ),
  })
);

export const billingEntitlementOverride = pgTable(
  "billing_entitlement_override",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sourceType: varchar("source_type", { length: 32 }).notNull(),
    sourceRewardGrantId: text("source_reward_grant_id").references(
      () => referralRewardGrant.id,
      {
        onDelete: "cascade",
      }
    ),
    planKey: varchar("plan_key", { length: 40 }).notNull(),
    startsAt: timestamp("starts_at").notNull(),
    endsAt: timestamp("ends_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    rewardUnique: uniqueIndex("billing_entitlement_override_reward_idx").on(
      table.sourceRewardGrantId
    ),
    userPeriodIdx: index("billing_entitlement_override_user_period_idx").on(
      table.userId,
      table.startsAt,
      table.endsAt
    ),
  })
);

export const edgeCreditGrant = pgTable(
  "edge_credit_grant",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referralRewardGrantId: text("referral_reward_grant_id").references(
      () => referralRewardGrant.id,
      {
        onDelete: "cascade",
      }
    ),
    source: varchar("source", { length: 32 }).notNull().default("referral"),
    amountCredits: integer("amount_credits").notNull(),
    remainingCredits: integer("remaining_credits").notNull(),
    metadata: jsonb("metadata"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    rewardUnique: uniqueIndex("edge_credit_grant_reward_idx").on(
      table.referralRewardGrantId
    ),
    userCreatedIdx: index("edge_credit_grant_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
  })
);

export const aiCreditUsage = pgTable(
  "ai_credit_usage",
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
    credentialSource: varchar("credential_source", { length: 24 }).notNull(),
    provider: varchar("provider", { length: 32 }).notNull(),
    model: varchar("model", { length: 80 }).notNull(),
    featureKey: varchar("feature_key", { length: 80 }).notNull(),
    promptTokenCount: integer("prompt_token_count"),
    candidatesTokenCount: integer("candidates_token_count"),
    totalTokenCount: integer("total_token_count"),
    cachedContentTokenCount: integer("cached_content_token_count"),
    estimatedPromptTokens: integer("estimated_prompt_tokens"),
    estimatedMaxOutputTokens: integer("estimated_max_output_tokens"),
    estimatedCostMicros: integer("estimated_cost_micros"),
    chargedCostMicros: integer("charged_cost_micros").notNull().default(0),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userCreatedIdx: index("ai_credit_usage_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
    cycleSpendIdx: index("ai_credit_usage_cycle_spend_idx").on(
      table.userId,
      table.credentialSource,
      table.createdAt
    ),
    accountCreatedIdx: index("ai_credit_usage_account_created_idx").on(
      table.accountId,
      table.createdAt
    ),
    featureCreatedIdx: index("ai_credit_usage_feature_created_idx").on(
      table.featureKey,
      table.createdAt
    ),
  })
);
