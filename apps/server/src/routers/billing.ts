import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { z } from "zod";
import { db } from "../db";
import {
  billingCustomer,
  billingEntitlementOverride,
  billingOrder,
  billingSubscription,
  billingWebhookEvent,
} from "../db/schema/billing";
import { user as userTable } from "../db/schema/auth";
import { activationMilestone } from "../db/schema/operations";
import { tradingAccount } from "../db/schema/trading";
import {
  getAffiliateCommissionBps as getServerAffiliateCommissionBps,
  getBillingPlanDefinition,
  getBillingPlanDefinitions,
  getHigherBillingPlanKey,
  BILLING_PLAN_TIER,
  getWebAppUrl,
  REFERRAL_EDGE_CREDIT_AMOUNT,
  REFERRAL_EDGE_CREDIT_THRESHOLD,
  REFERRAL_FREE_MONTH_THRESHOLD,
  REFERRAL_UPGRADE_TRIAL_DAYS,
  REFERRAL_UPGRADE_TRIAL_THRESHOLD,
  resolvePlanKeyFromStripePriceId,
  type BillingPlanKey,
} from "../lib/billing/config";
import { createUpgradeOfferDiscount } from "../lib/billing/discounts";
import {
  applyForAffiliate,
  approveAffiliateApplication,
  attachAffiliateAttributionToUser,
  attachReferralConversionToUser,
  buildAffiliateDashboard as buildAffiliateDashboardState,
  buildAffiliateState,
  cancelAffiliateWithdrawal,
  captureGrowthTouch,
  claimPendingGrowthAttribution,
  createAffiliateStripeConnectSession,
  deleteAffiliatePaymentMethod as deleteAffiliatePaymentMethodRecord,
  buildReferralState,
  disconnectAffiliateStripeConnect,
  getAffiliateCommissionBpsForUser,
  ensureAffiliateOfferForCheckout,
  ensureReferralRewardsForUser,
  getAffiliateCheckoutAttribution,
  getAffiliatePayoutSettings,
  getAvailableReferralFreeMonthGrantForPlan,
  getEffectiveBillingState,
  listAffiliatePayoutQueue,
  listAffiliateApplications,
  markAffiliateSubscriptionActive,
  markAffiliateManualWithdrawalPaid,
  recordAffiliatePayout,
  readGrowthTouchFromCookies,
  readGrowthVisitorTokenFromCookies,
  markReferralConversionPaid,
  markReferralRewardGrantConsumed,
  recordAffiliateCommissionEvent,
  refreshAffiliateStripeConnectAccount,
  rejectAffiliateApplication,
  rejectAffiliateWithdrawal,
  requestAffiliateWithdrawal,
  saveAffiliateCommissionSplit,
  saveAffiliateOffer,
  saveAffiliateTierSettings,
  saveAffiliatePaymentMethod,
  saveAffiliateTrackingLink,
  sendAffiliateStripeWithdrawal,
  setDefaultAffiliatePaymentMethod,
  syncUserPremiumFlag,
  updateAffiliateProfileEffects,
  approveAffiliateWithdrawal,
  getAffiliatePublicProfile,
  AFFILIATE_TIER_KEYS,
  AFFILIATE_TIER_MODES,
  AFFILIATE_TIER_EFFECT_VARIANTS,
  AFFILIATE_PFP_EFFECTS,
  AFFILIATE_NAME_EFFECTS,
  AFFILIATE_NAME_FONTS,
  AFFILIATE_NAME_COLORS,
} from "../lib/billing/growth";
import { getUserEdgeCreditSnapshot } from "../lib/billing/edge-credits";
import {
  createStripeBillingPortalSession,
  createStripeCheckoutSession,
  createStripeCustomer,
  getStripeClient,
  isStripeMissingCustomerError,
  retrieveStripeCustomer,
} from "../lib/billing/stripe";
import { normalizeAuthUsername } from "../lib/auth-usernames";
import {
  ensureActivationMilestone,
  recordAppEvent,
} from "../lib/ops/event-log";
import { hasStaffAccess } from "../lib/staff-access";
import { protectedProcedure, publicProcedure, router } from "../lib/trpc";

const ONBOARDING_COMPLETION_KEY = "onboarding_completed";
const ONBOARDING_ACTIVITY_KEYS = [
  "account_connected",
  "trades_synced",
  "journal_entry_created",
  "replay_session_created",
  "assistant_prompt_started",
] as const;
const AFFILIATE_PAYMENT_METHOD_TYPES = [
  "paypal",
  "wise",
  "bank_transfer",
  "crypto",
  "other",
] as const;
const BETA_STRIPE_MIGRATION_OVERRIDE_SOURCE = "beta_stripe_migration";
const BETA_STRIPE_MIGRATION_GRACE_DAYS = 30;
const STAFF_ACCESS_OVERRIDE_SOURCE = "staff_access_manual";
const STAFF_ACCESS_PRESET_KEYS = [
  "ambassador",
  "partner",
  "launch",
  "lifetime",
  "manual",
] as const;
const STAFF_ACCESS_PRESETS = {
  ambassador: { label: "Ambassador year", durationDays: 365 },
  partner: { label: "Partner year", durationDays: 365 },
  launch: { label: "Launch month", durationDays: 30 },
  lifetime: { label: "Lifetime", durationDays: 3650 },
  manual: { label: "Custom", durationDays: null },
} as const;

function isGrowthAdmin(input: {
  role?: string | null;
  email?: string | null;
}) {
  return hasStaffAccess(input);
}

function isActiveSubscriptionStatus(status?: string | null) {
  return status === "active" || status === "trialing";
}

function assertAppRelativePath(value?: string | null) {
  if (!value) {
    return "/onboarding";
  }

  if (!value.startsWith("/")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Return path must start with /",
    });
  }

  return value;
}

function buildAppUrl(
  relativePath?: string | null,
  params?: Record<string, string | null | undefined>
) {
  const url = new URL(assertAppRelativePath(relativePath), getWebAppUrl());

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined || value === "") {
        continue;
      }

      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

function normalizeBillingAccessIdentifier(value: string) {
  return value.trim();
}

async function findUserByBillingAccessIdentifier(identifier: string) {
  const normalizedIdentifier = normalizeBillingAccessIdentifier(identifier);
  const normalizedEmail = normalizedIdentifier.toLowerCase();
  const normalizedUsername = normalizeAuthUsername(normalizedIdentifier);

  const [targetUser] = await db
    .select({
      id: userTable.id,
      email: userTable.email,
      role: userTable.role,
      username: userTable.username,
      name: userTable.name,
    })
    .from(userTable)
    .where(
      or(
        sql`lower(${userTable.email}) = ${normalizedEmail}`,
        eq(userTable.username, normalizedUsername)
      )
    )
    .limit(1);

  if (!targetUser) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "User not found",
    });
  }

  return targetUser;
}

async function upsertStaffAccessOverride(input: {
  targetUserId: string;
  planKey: Extract<BillingPlanKey, "professional" | "institutional">;
  durationDays: number;
  actor: {
    id: string;
    email: string | null;
    role: string | null;
  };
  presetKey: keyof typeof STAFF_ACCESS_PRESETS;
  reason?: string | null;
}) {
  const now = new Date();
  const endsAt = new Date(
    now.getTime() + input.durationDays * 24 * 60 * 60 * 1000
  );

  const [existingOverride] = await db
    .select({
      id: billingEntitlementOverride.id,
      metadata: billingEntitlementOverride.metadata,
      startsAt: billingEntitlementOverride.startsAt,
    })
    .from(billingEntitlementOverride)
    .where(
      and(
        eq(billingEntitlementOverride.userId, input.targetUserId),
        eq(billingEntitlementOverride.sourceType, STAFF_ACCESS_OVERRIDE_SOURCE)
      )
    )
    .orderBy(desc(billingEntitlementOverride.endsAt), desc(billingEntitlementOverride.createdAt))
    .limit(1);

  const metadata = {
    ...(existingOverride?.metadata && typeof existingOverride.metadata === "object"
      ? existingOverride.metadata
      : {}),
    presetKey: input.presetKey,
    reason: input.reason ?? null,
    grantedByUserId:
      existingOverride?.metadata &&
      typeof existingOverride.metadata === "object" &&
      "grantedByUserId" in existingOverride.metadata
        ? (existingOverride.metadata.grantedByUserId as string | null | undefined) ??
          input.actor.id
        : input.actor.id,
    grantedByEmail:
      existingOverride?.metadata &&
      typeof existingOverride.metadata === "object" &&
      "grantedByEmail" in existingOverride.metadata
        ? (existingOverride.metadata.grantedByEmail as string | null | undefined) ??
          input.actor.email
        : input.actor.email,
    grantedByRole:
      existingOverride?.metadata &&
      typeof existingOverride.metadata === "object" &&
      "grantedByRole" in existingOverride.metadata
        ? (existingOverride.metadata.grantedByRole as string | null | undefined) ??
          input.actor.role
        : input.actor.role,
    grantedAt:
      existingOverride?.metadata &&
      typeof existingOverride.metadata === "object" &&
      "grantedAt" in existingOverride.metadata
        ? (existingOverride.metadata.grantedAt as string | null | undefined) ??
          now.toISOString()
        : now.toISOString(),
    updatedByUserId: input.actor.id,
    updatedByEmail: input.actor.email,
    updatedByRole: input.actor.role,
    updatedAt: now.toISOString(),
    revokedByUserId: null,
    revokedByEmail: null,
    revokedByRole: null,
    revokedAt: null,
  };

  if (existingOverride) {
    const startsAt =
      existingOverride.startsAt && existingOverride.startsAt.getTime() < now.getTime()
        ? existingOverride.startsAt
        : now;

    const [updated] = await db
      .update(billingEntitlementOverride)
      .set({
        planKey: input.planKey,
        metadata,
        startsAt,
        endsAt,
        updatedAt: now,
      })
      .where(eq(billingEntitlementOverride.id, existingOverride.id))
      .returning();

    return updated;
  }

  const [inserted] = await db
    .insert(billingEntitlementOverride)
    .values({
      id: crypto.randomUUID(),
      userId: input.targetUserId,
      sourceType: STAFF_ACCESS_OVERRIDE_SOURCE,
      planKey: input.planKey,
      metadata,
      startsAt: now,
      endsAt,
    })
    .returning();

  return inserted;
}

async function revokeStaffAccessOverride(input: {
  targetUserId: string;
  actor: {
    id: string;
    email: string | null;
    role: string | null;
  };
  reason?: string | null;
}) {
  const now = new Date();

  const updated = await db
    .update(billingEntitlementOverride)
    .set({
      endsAt: now,
      updatedAt: now,
      metadata: sql`coalesce(${billingEntitlementOverride.metadata}, '{}'::jsonb) || ${JSON.stringify({
        reason: input.reason ?? null,
        updatedByUserId: input.actor.id,
        updatedByEmail: input.actor.email,
        updatedByRole: input.actor.role,
        updatedAt: now.toISOString(),
        revokedByUserId: input.actor.id,
        revokedByEmail: input.actor.email,
        revokedByRole: input.actor.role,
        revokedAt: now.toISOString(),
      })}::jsonb`,
    })
    .where(
      and(
        eq(billingEntitlementOverride.userId, input.targetUserId),
        eq(billingEntitlementOverride.sourceType, STAFF_ACCESS_OVERRIDE_SOURCE),
        gte(billingEntitlementOverride.endsAt, now)
      )
    )
    .returning({
      id: billingEntitlementOverride.id,
    });

  return updated.length;
}

async function listStaffAccessOverrides() {
  const now = new Date();
  return db
    .select({
      id: billingEntitlementOverride.id,
      planKey: billingEntitlementOverride.planKey,
      metadata: billingEntitlementOverride.metadata,
      startsAt: billingEntitlementOverride.startsAt,
      endsAt: billingEntitlementOverride.endsAt,
      userId: userTable.id,
      email: userTable.email,
      username: userTable.username,
      name: userTable.name,
      role: userTable.role,
    })
    .from(billingEntitlementOverride)
    .innerJoin(userTable, eq(userTable.id, billingEntitlementOverride.userId))
    .where(
      and(
        eq(billingEntitlementOverride.sourceType, STAFF_ACCESS_OVERRIDE_SOURCE),
        lte(billingEntitlementOverride.startsAt, now),
        gte(billingEntitlementOverride.endsAt, now)
      )
    )
    .orderBy(desc(billingEntitlementOverride.endsAt), userTable.email);
}

function getGrowthCookieContext(
  ctx: {
    req?: {
      cookies: {
        get(name: string):
          | {
              value: string;
            }
          | undefined;
      };
    };
  }
) {
  return {
    visitorToken: readGrowthVisitorTokenFromCookies(ctx.req?.cookies),
    storedTouch: readGrowthTouchFromCookies(ctx.req?.cookies),
  };
}

function normalizeBillingMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function parseAmountCents(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function resolveCommissionableOrderAmount(input: {
  subtotalAmount?: unknown;
  discountAmount?: unknown;
  totalAmount?: unknown;
}) {
  const subtotalAmount = parseAmountCents(input.subtotalAmount);
  const discountAmount = parseAmountCents(input.discountAmount);

  if (subtotalAmount !== null || discountAmount !== null) {
    return Math.max((subtotalAmount ?? 0) - (discountAmount ?? 0), 0);
  }

  return Math.max(parseAmountCents(input.totalAmount) ?? 0, 0);
}

function extractAffiliateOrderMetadata(
  metadata?: Record<string, unknown> | null
) {
  const parsedCommissionBps = Number(metadata?.affiliate_commission_bps);

  return {
    affiliateAttributionId:
      typeof metadata?.affiliate_attribution_id === "string"
        ? metadata.affiliate_attribution_id
        : null,
    rewardGrantId:
      typeof metadata?.referral_reward_grant_id === "string"
        ? metadata.referral_reward_grant_id
        : null,
    commissionBps:
      Number.isFinite(parsedCommissionBps) && parsedCommissionBps > 0
        ? Math.round(parsedCommissionBps)
        : null,
  };
}

async function getUserRow(userId: string) {
  const row = await db
    .select({
      id: userTable.id,
      email: userTable.email,
      name: userTable.name,
      role: userTable.role,
      isPremium: userTable.isPremium,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (!row[0]) {
    throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  }

  return row[0];
}

async function getAccessStatus(input: {
  userId: string;
  role?: string | null;
  email?: string | null;
}) {
  return {
    privateBetaRequired: false,
    hasPrivateBetaAccess: true,
    hasAdminBypass: false,
    redemption: null,
  };
}

async function getActiveBillingState(userId: string) {
  return getEffectiveBillingState(userId);
}

async function getOnboardingStatus(userId: string) {
  const [completionMilestone] = await db
    .select({
      key: activationMilestone.key,
      completedAt: activationMilestone.lastSeenAt,
    })
    .from(activationMilestone)
    .where(
      and(
        eq(activationMilestone.userId, userId),
        eq(activationMilestone.key, ONBOARDING_COMPLETION_KEY)
      )
    )
    .limit(1);

  if (completionMilestone) {
    return {
      isComplete: true,
      completedAt: completionMilestone.completedAt,
      source: "milestone" as const,
    };
  }

  const [existingAccount] = await db
    .select({
      completedAt: tradingAccount.createdAt,
    })
    .from(tradingAccount)
    .where(eq(tradingAccount.userId, userId))
    .orderBy(desc(tradingAccount.createdAt))
    .limit(1);

  if (existingAccount) {
    return {
      isComplete: true,
      completedAt: existingAccount.completedAt,
      source: "account" as const,
    };
  }

  const [activityMilestone] = await db
    .select({
      completedAt: activationMilestone.lastSeenAt,
      key: activationMilestone.key,
    })
    .from(activationMilestone)
    .where(
      and(
        eq(activationMilestone.userId, userId),
        inArray(activationMilestone.key, [...ONBOARDING_ACTIVITY_KEYS])
      )
    )
    .orderBy(desc(activationMilestone.lastSeenAt))
    .limit(1);

  if (activityMilestone) {
    return {
      isComplete: true,
      completedAt: activityMilestone.completedAt,
      source: "activity" as const,
    };
  }

  return {
    isComplete: false,
    completedAt: null,
    source: "pending" as const,
  };
}

async function claimPendingGrowthAttributionIfOnboardingPending(input: {
  userId: string;
  visitorToken?: string | null;
  source?: string | null;
}) {
  const onboarding = await getOnboardingStatus(input.userId);
  if (onboarding.isComplete) {
    return {
      referral: null,
      affiliate: null,
      pending: null,
    };
  }

  return claimPendingGrowthAttribution(input);
}

function fromStripeTimestamp(value?: number | null) {
  return value ? new Date(value * 1000) : null;
}

function resolvePlanKeyFromStripeState(input: {
  metadata?: Record<string, unknown> | null;
  priceId?: string | null;
}) {
  const metadataPlanKey =
    typeof input.metadata?.plan_key === "string" ? input.metadata.plan_key : null;
  if (
    metadataPlanKey === "student" ||
    metadataPlanKey === "professional" ||
    metadataPlanKey === "institutional"
  ) {
    return metadataPlanKey as BillingPlanKey;
  }

  return resolvePlanKeyFromStripePriceId(input.priceId);
}

async function upsertBillingCustomerFromStripe(input: {
  userId: string;
  stripeCustomerId: string;
  email?: string | null;
  name?: string | null;
  defaultPaymentMethodId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const existing = await db
    .select()
    .from(billingCustomer)
    .where(eq(billingCustomer.userId, input.userId))
    .limit(1);

  const values = {
    provider: "stripe" as const,
    providerCustomerId: input.stripeCustomerId,
    stripeCustomerId: input.stripeCustomerId,
    stripeDefaultPaymentMethodId: input.defaultPaymentMethodId ?? null,
    email: input.email ?? null,
    name: input.name ?? null,
    metadata: input.metadata ?? null,
    updatedAt: new Date(),
  };

  if (existing[0]) {
    const [updated] = await db
      .update(billingCustomer)
      .set(values)
      .where(eq(billingCustomer.id, existing[0].id))
      .returning();

    return updated ?? existing[0];
  }

  const [inserted] = await db
    .insert(billingCustomer)
    .values({
      id: crypto.randomUUID(),
      userId: input.userId,
      ...values,
    })
    .returning();

  return inserted;
}

async function upsertBillingSubscriptionFromStripe(input: {
  userId: string;
  stripeSubscriptionId: string;
  stripeCustomerId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripePriceId?: string | null;
  stripeProductId?: string | null;
  stripeLatestInvoiceId?: string | null;
  metadata?: Record<string, unknown> | null;
  status: string;
  currency?: string | null;
  amount?: number | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  trialStart?: Date | null;
  trialEnd?: Date | null;
  startedAt?: Date | null;
  endsAt?: Date | null;
  endedAt?: Date | null;
  canceledAt?: Date | null;
}) {
  const existing = await db
    .select()
    .from(billingSubscription)
    .where(eq(billingSubscription.stripeSubscriptionId, input.stripeSubscriptionId))
    .limit(1);

  const planKey = resolvePlanKeyFromStripeState({
    metadata: input.metadata ?? null,
    priceId: input.stripePriceId ?? null,
  });

  const values = {
    userId: input.userId,
    provider: "stripe" as const,
    providerSubscriptionId: input.stripeSubscriptionId,
    providerCustomerId: input.stripeCustomerId ?? null,
    providerCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
    providerPriceId: input.stripePriceId ?? null,
    providerProductId: input.stripeProductId ?? null,
    stripeSubscriptionId: input.stripeSubscriptionId,
    stripeCustomerId: input.stripeCustomerId ?? null,
    stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
    stripePriceId: input.stripePriceId ?? null,
    stripeProductId: input.stripeProductId ?? null,
    stripeLatestInvoiceId: input.stripeLatestInvoiceId ?? null,
    planKey,
    status: input.status,
    currency: input.currency ?? null,
    amount: input.amount ?? null,
    cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
    currentPeriodStart: input.currentPeriodStart ?? null,
    currentPeriodEnd: input.currentPeriodEnd ?? null,
    trialStart: input.trialStart ?? null,
    trialEnd: input.trialEnd ?? null,
    startedAt: input.startedAt ?? null,
    endsAt: input.endsAt ?? null,
    endedAt: input.endedAt ?? null,
    canceledAt: input.canceledAt ?? null,
    metadata: input.metadata ?? null,
    updatedAt: new Date(),
  };

  if (existing[0]) {
    const [updated] = await db
      .update(billingSubscription)
      .set(values)
      .where(eq(billingSubscription.id, existing[0].id))
      .returning();
    return updated ?? existing[0];
  }

  const [inserted] = await db
    .insert(billingSubscription)
    .values({
      id: crypto.randomUUID(),
      ...values,
    })
    .returning();
  return inserted;
}

async function upsertBillingOrderFromStripe(input: {
  userId: string;
  providerOrderId: string;
  stripeInvoiceId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
  stripePriceId?: string | null;
  stripeProductId?: string | null;
  metadata?: Record<string, unknown> | null;
  status: string;
  currency?: string | null;
  subtotalAmount?: number | null;
  discountAmount?: number | null;
  taxAmount?: number | null;
  totalAmount?: number | null;
  paid?: boolean;
  paidAt?: Date | null;
  createdAt?: Date | null;
}) {
  const existing = await db
    .select()
    .from(billingOrder)
    .where(eq(billingOrder.providerOrderId, input.providerOrderId))
    .limit(1);

  const planKey = resolvePlanKeyFromStripeState({
    metadata: input.metadata ?? null,
    priceId: input.stripePriceId ?? null,
  });

  const values = {
    userId: input.userId,
    provider: "stripe" as const,
    providerOrderId: input.providerOrderId,
    providerCustomerId: input.stripeCustomerId ?? null,
    providerSubscriptionId: input.stripeSubscriptionId ?? null,
    providerCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
    providerInvoiceId: input.stripeInvoiceId ?? null,
    providerPaymentIntentId: input.stripePaymentIntentId ?? null,
    providerChargeId: input.stripeChargeId ?? null,
    providerPriceId: input.stripePriceId ?? null,
    providerProductId: input.stripeProductId ?? null,
    stripeInvoiceId: input.stripeInvoiceId ?? null,
    stripeCustomerId: input.stripeCustomerId ?? null,
    stripeSubscriptionId: input.stripeSubscriptionId ?? null,
    stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
    stripePaymentIntentId: input.stripePaymentIntentId ?? null,
    stripeChargeId: input.stripeChargeId ?? null,
    stripePriceId: input.stripePriceId ?? null,
    stripeProductId: input.stripeProductId ?? null,
    planKey,
    status: input.status,
    currency: input.currency ?? null,
    subtotalAmount: input.subtotalAmount ?? null,
    discountAmount: input.discountAmount ?? null,
    taxAmount: input.taxAmount ?? null,
    totalAmount: input.totalAmount ?? null,
    paid: Boolean(input.paid),
    paidAt: input.paidAt ?? null,
    metadata: input.metadata ?? null,
    updatedAt: new Date(),
  };

  if (existing[0]) {
    const [updated] = await db
      .update(billingOrder)
      .set(values)
      .where(eq(billingOrder.id, existing[0].id))
      .returning();
    return updated ?? existing[0];
  }

  const [inserted] = await db
    .insert(billingOrder)
    .values({
      id: crypto.randomUUID(),
      createdAt: input.createdAt ?? new Date(),
      ...values,
    })
    .returning();
  return inserted;
}

async function updateUserPremiumFlag(userId: string) {
  await syncUserPremiumFlag(userId);
}

async function ensureStripeCustomerForUser(user: Awaited<ReturnType<typeof getUserRow>>) {
  const [existing] = await db
    .select()
    .from(billingCustomer)
    .where(eq(billingCustomer.userId, user.id))
    .limit(1);

  if (existing?.stripeCustomerId) {
    try {
      const customer = await retrieveStripeCustomer(existing.stripeCustomerId);
      if (customer && !customer.deleted) {
        return upsertBillingCustomerFromStripe({
          userId: user.id,
          stripeCustomerId: customer.id,
          email: customer.email ?? user.email,
          name: customer.name ?? user.name,
          defaultPaymentMethodId:
            typeof customer.invoice_settings?.default_payment_method === "string"
              ? customer.invoice_settings.default_payment_method
              : null,
          metadata: normalizeBillingMetadata(customer.metadata),
        });
      }
    } catch (error) {
      if (!isStripeMissingCustomerError(error)) {
        throw error;
      }
    }
  }

  const customer = await createStripeCustomer({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  return upsertBillingCustomerFromStripe({
    userId: user.id,
    stripeCustomerId: customer.id,
    email: customer.email ?? user.email,
    name: customer.name ?? user.name,
    metadata: normalizeBillingMetadata(customer.metadata),
  });
}

async function findUserIdForStripeCustomer(input: {
  stripeCustomerId?: string | null;
  metadataUserId?: string | null;
}) {
  if (input.metadataUserId) {
    return input.metadataUserId;
  }

  if (!input.stripeCustomerId) {
    return null;
  }

  const [existing] = await db
    .select({
      userId: billingCustomer.userId,
    })
    .from(billingCustomer)
    .where(eq(billingCustomer.stripeCustomerId, input.stripeCustomerId))
    .limit(1);

  if (existing?.userId) {
    return existing.userId;
  }

  const customer = await retrieveStripeCustomer(input.stripeCustomerId);
  if (!customer || customer.deleted) {
    return null;
  }

  return typeof customer.metadata?.user_id === "string"
    ? customer.metadata.user_id
    : null;
}

async function syncStripePaidInvoiceForSubscription(input: {
  stripe: Stripe;
  userId: string;
  subscription: any;
  subscriptionMetadata?: Record<string, unknown> | null;
}) {
  const latestInvoiceId =
    typeof input.subscription.latest_invoice === "string"
      ? input.subscription.latest_invoice
      : input.subscription.latest_invoice?.id ?? null;

  let invoice: any | null = null;
  if (latestInvoiceId) {
    invoice = await input.stripe.invoices.retrieve(latestInvoiceId);
  }

  const invoiceIsPaid = Boolean(
    invoice &&
      (invoice.status === "paid" || invoice.status_transitions?.paid_at != null)
  );
  if (!invoiceIsPaid) {
    const invoices = await input.stripe.invoices.list({
      subscription: input.subscription.id,
      limit: 5,
    });

    invoice =
      invoices.data.find(
        (row: any) =>
          row.status === "paid" || row.status_transitions?.paid_at != null
      ) ?? invoice;
  }

  if (
    !invoice ||
    (invoice.status !== "paid" && invoice.status_transitions?.paid_at == null)
  ) {
    return null;
  }

  const line =
    invoice.lines.data.find((item: any) => item.type === "subscription") ??
    invoice.lines.data[0];
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id ?? input.subscription.id ?? null;
  const [subscriptionRow] = subscriptionId
    ? await db
        .select()
        .from(billingSubscription)
        .where(eq(billingSubscription.stripeSubscriptionId, subscriptionId))
        .limit(1)
    : [null];
  const metadata = {
    ...(normalizeBillingMetadata(subscriptionRow?.metadata) ?? {}),
    ...(input.subscriptionMetadata ?? {}),
    ...(normalizeBillingMetadata(invoice.metadata) ?? {}),
  };
  const affiliateOrderMetadata = extractAffiliateOrderMetadata(metadata);
  const price = line?.price ?? null;
  const discountAmount = Array.isArray(invoice.total_discount_amounts)
    ? invoice.total_discount_amounts.reduce(
        (sum: number, item: any) => sum + (item.amount ?? 0),
        0
      )
    : 0;
  const taxAmount =
    (typeof invoice.tax === "number" ? invoice.tax : null) ??
    (Array.isArray(invoice.total_taxes)
      ? invoice.total_taxes.reduce(
          (sum: number, item: any) => sum + (item.amount ?? 0),
          0
        )
      : 0);
  const paidAt =
    fromStripeTimestamp(invoice.status_transitions?.paid_at) ??
    fromStripeTimestamp(invoice.created) ??
    fromStripeTimestamp(input.subscription.start_date) ??
    new Date();
  const order = await upsertBillingOrderFromStripe({
    userId: input.userId,
    providerOrderId: invoice.id,
    stripeInvoiceId: invoice.id,
    stripeCustomerId:
      typeof invoice.customer === "string"
        ? invoice.customer
        : invoice.customer?.id ??
          (typeof input.subscription.customer === "string"
            ? input.subscription.customer
            : input.subscription.customer?.id ?? null),
    stripeSubscriptionId: subscriptionId,
    stripePaymentIntentId:
      typeof invoice.payment_intent === "string"
        ? invoice.payment_intent
        : invoice.payment_intent?.id ?? null,
    stripeChargeId:
      typeof invoice.charge === "string" ? invoice.charge : invoice.charge?.id ?? null,
    stripePriceId: price?.id ?? subscriptionRow?.stripePriceId ?? null,
    stripeProductId:
      (typeof price?.product === "string" ? price.product : price?.product?.id) ??
      subscriptionRow?.stripeProductId ??
      null,
    metadata,
    status: invoice.status ?? "paid",
    currency: invoice.currency?.toUpperCase() ?? null,
    subtotalAmount: invoice.subtotal ?? null,
    discountAmount,
    taxAmount,
    totalAmount: invoice.total ?? invoice.amount_paid ?? null,
    paid: true,
    paidAt,
    createdAt: fromStripeTimestamp(invoice.created),
  });

  await markReferralConversionPaid({
    referredUserId: input.userId,
    orderId: invoice.id,
    subscriptionId,
    paidAt,
  });

  await recordAffiliateCommissionEvent({
    provider: "stripe",
    providerOrderId: invoice.id,
    providerSubscriptionId: subscriptionId,
    billingOrderId: order.id,
    stripeInvoiceId: invoice.id,
    stripeSubscriptionId: subscriptionId,
    referredUserId: input.userId,
    affiliateAttributionId: affiliateOrderMetadata.affiliateAttributionId,
    planKey: order.planKey,
    orderAmount: resolveCommissionableOrderAmount({
      subtotalAmount: invoice.subtotal,
      discountAmount,
      totalAmount: invoice.total ?? invoice.amount_paid,
    }),
    subtotalAmount: invoice.subtotal ?? null,
    discountAmount,
    taxAmount,
    currency: invoice.currency?.toUpperCase() ?? null,
    commissionBps: affiliateOrderMetadata.commissionBps,
    metadata,
    occurredAt: paidAt,
  });

  if (affiliateOrderMetadata.rewardGrantId) {
    await markReferralRewardGrantConsumed(affiliateOrderMetadata.rewardGrantId);
  }

  return order;
}

async function syncStripeBillingStateForUser(
  user: Awaited<ReturnType<typeof getUserRow>>
) {
  const stripe = getStripeClient();
  const existingCustomer = await ensureStripeCustomerForUser(user);

  if (!existingCustomer?.stripeCustomerId) {
    const billing = await getActiveBillingState(user.id);
    return { activePlanKey: billing.activePlanKey };
  }

  const customer = await retrieveStripeCustomer(existingCustomer.stripeCustomerId);
  if (customer && !customer.deleted) {
    await upsertBillingCustomerFromStripe({
      userId: user.id,
      stripeCustomerId: customer.id,
      email: customer.email ?? user.email,
      name: customer.name ?? user.name,
      defaultPaymentMethodId:
        typeof customer.invoice_settings?.default_payment_method === "string"
          ? customer.invoice_settings.default_payment_method
          : null,
      metadata: normalizeBillingMetadata(customer.metadata),
    });
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: existingCustomer.stripeCustomerId,
    status: "all",
    limit: 20,
  });

  for (const rawSubscription of subscriptions.data) {
    const subscription = rawSubscription as any;
    const primaryItem = subscription.items.data[0];
    const price = primaryItem?.price;
    const subscriptionMetadata = normalizeBillingMetadata(subscription.metadata);

    await upsertBillingSubscriptionFromStripe({
      userId: user.id,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id ?? null,
      stripePriceId: price?.id ?? null,
      stripeProductId:
        typeof price?.product === "string" ? price.product : price?.product?.id ?? null,
      stripeLatestInvoiceId:
        typeof subscription.latest_invoice === "string"
          ? subscription.latest_invoice
          : subscription.latest_invoice?.id ?? null,
      metadata: subscriptionMetadata,
      status: subscription.status,
      currency: price?.currency?.toUpperCase() ?? null,
      amount: price?.unit_amount ?? null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodStart: fromStripeTimestamp(subscription.current_period_start),
      currentPeriodEnd: fromStripeTimestamp(subscription.current_period_end),
      trialStart: fromStripeTimestamp(subscription.trial_start),
      trialEnd: fromStripeTimestamp(subscription.trial_end),
      startedAt: fromStripeTimestamp(subscription.start_date),
      endedAt: fromStripeTimestamp(subscription.ended_at),
      canceledAt: fromStripeTimestamp(subscription.canceled_at),
    });

    await syncStripePaidInvoiceForSubscription({
      stripe,
      userId: user.id,
      subscription,
      subscriptionMetadata,
    });

    if (subscription.status === "active" || subscription.status === "trialing") {
      await markAffiliateSubscriptionActive({
        referredUserId: user.id,
        subscriptionId: subscription.id,
        activatedAt: fromStripeTimestamp(subscription.start_date) ?? new Date(),
      });
    }
  }

  const hasActiveStripeSubscription = subscriptions.data.some((subscription) =>
    isActiveSubscriptionStatus(subscription.status)
  );

  if (hasActiveStripeSubscription) {
    await finalizeStripeBetaMigrationForUserId({
      userId: user.id,
      completedByUserId: "stripe_sync",
    });
  }

  await updateUserPremiumFlag(user.id);
  const billing = await getActiveBillingState(user.id);
  return { activePlanKey: billing.activePlanKey };
}

export async function syncStripeBillingStateForUserId(userId: string) {
  const user = await getUserRow(userId);
  return syncStripeBillingStateForUser(user);
}

function buildLegacyDisconnectMetadata(input: {
  metadata: unknown;
  disconnectedByUserId: string;
  reason?: string | null;
  now: Date;
}) {
  const metadata = normalizeBillingMetadata(input.metadata) ?? {};

  return {
    ...metadata,
    legacyDisconnect: {
      disconnectedAt: input.now.toISOString(),
      disconnectedByUserId: input.disconnectedByUserId,
      reason: input.reason ?? null,
      source: "stripe_migration",
    },
  };
}

function buildBetaStripeMigrationEndsAt(input: {
  latestLegacyPeriodEnd?: Date | null;
  now: Date;
}) {
  const minimumEndsAt = new Date(
    input.now.getTime() +
      BETA_STRIPE_MIGRATION_GRACE_DAYS * 24 * 60 * 60 * 1000
  );

  const latestLegacyPeriodEnd = input.latestLegacyPeriodEnd;
  if (
    latestLegacyPeriodEnd &&
    latestLegacyPeriodEnd.getTime() > minimumEndsAt.getTime()
  ) {
    return latestLegacyPeriodEnd;
  }

  return minimumEndsAt;
}

function buildStripeBetaMigrationMetadata(input: {
  metadata: unknown;
  status: "pending" | "completed";
  targetPlanKey?: BillingPlanKey | null;
  preparedByUserId?: string | null;
  completedByUserId?: string | null;
  accessEndsAt?: Date | null;
  now: Date;
}) {
  const metadata = normalizeBillingMetadata(input.metadata) ?? {};
  const existingMigration =
    metadata.stripeBetaMigration &&
    typeof metadata.stripeBetaMigration === "object" &&
    !Array.isArray(metadata.stripeBetaMigration)
      ? (metadata.stripeBetaMigration as Record<string, unknown>)
      : {};

  const preparedAt =
    input.status === "pending"
      ? input.now.toISOString()
      : typeof existingMigration.preparedAt === "string"
      ? existingMigration.preparedAt
      : input.now.toISOString();

  return {
    ...metadata,
    stripeBetaMigration: {
      ...existingMigration,
      status: input.status,
      targetPlanKey: input.targetPlanKey ?? existingMigration.targetPlanKey ?? null,
      preparedAt,
      preparedByUserId:
        input.preparedByUserId ??
        (typeof existingMigration.preparedByUserId === "string"
          ? existingMigration.preparedByUserId
          : null),
      accessEndsAt:
        input.accessEndsAt?.toISOString() ??
        (typeof existingMigration.accessEndsAt === "string"
          ? existingMigration.accessEndsAt
          : null),
      completedAt:
        input.status === "completed" ? input.now.toISOString() : null,
      completedByUserId:
        input.status === "completed" ? input.completedByUserId ?? null : null,
    },
  };
}

async function getActiveLegacyBillingSnapshot(userId: string) {
  const subscriptions = await db
    .select({
      id: billingSubscription.id,
      planKey: billingSubscription.planKey,
      currentPeriodEnd: billingSubscription.currentPeriodEnd,
      updatedAt: billingSubscription.updatedAt,
    })
    .from(billingSubscription)
    .where(
      and(
        eq(billingSubscription.userId, userId),
        eq(billingSubscription.provider, "stripe"),
        inArray(billingSubscription.status, ["active", "trialing"])
      )
    )
    .orderBy(
      desc(billingSubscription.currentPeriodEnd),
      desc(billingSubscription.updatedAt)
    );

  if (subscriptions.length === 0) {
    return null;
  }

  const highestPlanKey = subscriptions.reduce<BillingPlanKey>(
    (currentHighest, subscription) => {
      const planKey = getBillingPlanDefinition(
        subscription.planKey as BillingPlanKey
      )
        ? (subscription.planKey as BillingPlanKey)
        : ("student" as BillingPlanKey);

      return getHigherBillingPlanKey(currentHighest, planKey);
    },
    "student"
  );

  const latestPeriodEnd = subscriptions.reduce<Date | null>(
    (latest, subscription) => {
      if (!subscription.currentPeriodEnd) {
        return latest;
      }

      if (!latest) {
        return subscription.currentPeriodEnd;
      }

      return latest.getTime() >= subscription.currentPeriodEnd.getTime()
        ? latest
        : subscription.currentPeriodEnd;
    },
    null
  );

  return {
    activePlanKey: highestPlanKey,
    latestPeriodEnd,
    subscriptionCount: subscriptions.length,
    subscriptions,
  };
}

async function getActiveBetaStripeMigrationOverride(userId: string) {
  const now = new Date();
  const [override] = await db
    .select({
      id: billingEntitlementOverride.id,
      planKey: billingEntitlementOverride.planKey,
      startsAt: billingEntitlementOverride.startsAt,
      endsAt: billingEntitlementOverride.endsAt,
    })
    .from(billingEntitlementOverride)
    .where(
      and(
        eq(billingEntitlementOverride.userId, userId),
        eq(
          billingEntitlementOverride.sourceType,
          BETA_STRIPE_MIGRATION_OVERRIDE_SOURCE
        ),
        lte(billingEntitlementOverride.startsAt, now),
        gte(billingEntitlementOverride.endsAt, now)
      )
    )
    .orderBy(desc(billingEntitlementOverride.endsAt))
    .limit(1);

  return override ?? null;
}

async function ensureBetaStripeMigrationOverride(input: {
  userId: string;
  targetPlanKey: BillingPlanKey;
  endsAt: Date;
}) {
  const [existingOverride] = await db
    .select({
      id: billingEntitlementOverride.id,
      planKey: billingEntitlementOverride.planKey,
      startsAt: billingEntitlementOverride.startsAt,
      endsAt: billingEntitlementOverride.endsAt,
    })
    .from(billingEntitlementOverride)
    .where(
      and(
        eq(billingEntitlementOverride.userId, input.userId),
        eq(
          billingEntitlementOverride.sourceType,
          BETA_STRIPE_MIGRATION_OVERRIDE_SOURCE
        )
      )
    )
    .orderBy(desc(billingEntitlementOverride.endsAt))
    .limit(1);

  const now = new Date();
  const planKey = existingOverride?.planKey
    ? getHigherBillingPlanKey(
        existingOverride.planKey as BillingPlanKey,
        input.targetPlanKey
      )
    : input.targetPlanKey;
  const startsAt =
    existingOverride?.startsAt && existingOverride.startsAt.getTime() < now.getTime()
      ? existingOverride.startsAt
      : now;
  const endsAt =
    existingOverride?.endsAt &&
    existingOverride.endsAt.getTime() > input.endsAt.getTime()
      ? existingOverride.endsAt
      : input.endsAt;

  if (existingOverride) {
    const [updated] = await db
      .update(billingEntitlementOverride)
      .set({
        planKey,
        startsAt,
        endsAt,
        updatedAt: now,
      })
      .where(eq(billingEntitlementOverride.id, existingOverride.id))
      .returning();

    return updated ?? existingOverride;
  }

  const [inserted] = await db
    .insert(billingEntitlementOverride)
    .values({
      id: crypto.randomUUID(),
      userId: input.userId,
      sourceType: BETA_STRIPE_MIGRATION_OVERRIDE_SOURCE,
      planKey,
      startsAt,
      endsAt,
    })
    .returning();

  return inserted;
}

async function setStripeBetaMigrationCustomerState(input: {
  userId: string;
  status: "pending" | "completed";
  targetPlanKey?: BillingPlanKey | null;
  preparedByUserId?: string | null;
  completedByUserId?: string | null;
  accessEndsAt?: Date | null;
}) {
  const [customer] = await db
    .select()
    .from(billingCustomer)
    .where(eq(billingCustomer.userId, input.userId))
    .limit(1);

  if (!customer) {
    return null;
  }

  const now = new Date();
  const [updated] = await db
    .update(billingCustomer)
    .set({
      metadata: buildStripeBetaMigrationMetadata({
        metadata: customer.metadata,
        status: input.status,
        targetPlanKey: input.targetPlanKey ?? null,
        preparedByUserId: input.preparedByUserId ?? null,
        completedByUserId: input.completedByUserId ?? null,
        accessEndsAt: input.accessEndsAt ?? null,
        now,
      }),
      updatedAt: now,
    })
    .where(eq(billingCustomer.id, customer.id))
    .returning();

  return updated ?? customer;
}

async function getStripeBetaMigrationState(userId: string) {
  const legacy = await getActiveLegacyBillingSnapshot(userId);
  const activeOverride = await getActiveBetaStripeMigrationOverride(userId);
  const [activeStripeSubscription] = await db
    .select({
      id: billingSubscription.id,
      planKey: billingSubscription.planKey,
      currentPeriodEnd: billingSubscription.currentPeriodEnd,
    })
    .from(billingSubscription)
    .where(
      and(
        eq(billingSubscription.userId, userId),
        eq(billingSubscription.provider, "stripe"),
        inArray(billingSubscription.status, ["active", "trialing"])
      )
    )
    .orderBy(
      desc(billingSubscription.currentPeriodEnd),
      desc(billingSubscription.updatedAt)
    )
    .limit(1);

  const requiresCheckout =
    !activeStripeSubscription && Boolean(activeOverride || legacy);
  const targetPlanKey = activeOverride?.planKey
    ? (activeOverride.planKey as BillingPlanKey)
    : legacy?.activePlanKey ?? null;

  return {
    requiresCheckout,
    targetPlanKey,
    accessEndsAt: activeOverride?.endsAt ?? legacy?.latestPeriodEnd ?? null,
    hasTemporaryAccess: Boolean(activeOverride),
    hasActiveStripeSubscription: Boolean(activeStripeSubscription),
    hasLegacyBilling: Boolean(legacy),
    legacySubscriptionCount: legacy?.subscriptionCount ?? 0,
  };
}

async function listLegacyBillingCustomers() {
  const rows = await db
    .select({
      subscription: billingSubscription,
      customer: {
        id: billingCustomer.id,
        provider: billingCustomer.provider,
        stripeCustomerId: billingCustomer.stripeCustomerId,
      },
      user: {
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
        username: userTable.username,
        isPremium: userTable.isPremium,
      },
    })
    .from(billingSubscription)
    .innerJoin(userTable, eq(billingSubscription.userId, userTable.id))
    .leftJoin(billingCustomer, eq(billingCustomer.userId, billingSubscription.userId))
    .where(
      and(
        eq(billingSubscription.provider, "stripe"),
        inArray(billingSubscription.status, ["active", "trialing"])
      )
    )
    .orderBy(
      desc(billingSubscription.currentPeriodEnd),
      desc(billingSubscription.updatedAt)
    );

  const grouped = new Map<
    string,
    {
      user: {
        id: string;
        name: string | null;
        email: string | null;
        username: string | null;
        isPremium: boolean | null;
      };
      customer: {
        provider: string | null;
        stripeCustomerId: string | null;
      } | null;
      activeLegacyPlanKey: BillingPlanKey;
      latestLegacyPeriodEnd: Date | null;
      subscriptions: Array<{
        id: string;
        planKey: string;
        status: string;
        amount: number | null;
        currency: string | null;
        currentPeriodStart: Date | null;
        currentPeriodEnd: Date | null;
        startedAt: Date | null;
        updatedAt: Date;
      }>;
    }
  >();

  for (const row of rows) {
    const existing = grouped.get(row.user.id);
    const planKey = getBillingPlanDefinition(
      row.subscription.planKey as BillingPlanKey
    )
      ? (row.subscription.planKey as BillingPlanKey)
      : ("student" as BillingPlanKey);

    if (!existing) {
      grouped.set(row.user.id, {
        user: row.user,
        customer: row.customer,
        activeLegacyPlanKey: planKey,
        latestLegacyPeriodEnd: row.subscription.currentPeriodEnd ?? null,
        subscriptions: [
          {
            id: row.subscription.id,
            planKey: row.subscription.planKey,
            status: row.subscription.status,
            amount: row.subscription.amount,
            currency: row.subscription.currency,
            currentPeriodStart: row.subscription.currentPeriodStart,
            currentPeriodEnd: row.subscription.currentPeriodEnd,
            startedAt: row.subscription.startedAt,
            updatedAt: row.subscription.updatedAt,
          },
        ],
      });
      continue;
    }

    existing.activeLegacyPlanKey = getHigherBillingPlanKey(
      existing.activeLegacyPlanKey,
      planKey
    );
    existing.latestLegacyPeriodEnd =
      (existing.latestLegacyPeriodEnd?.getTime() ?? 0) >=
      (row.subscription.currentPeriodEnd?.getTime() ?? 0)
        ? existing.latestLegacyPeriodEnd
        : (row.subscription.currentPeriodEnd ?? existing.latestLegacyPeriodEnd);
    existing.subscriptions.push({
      id: row.subscription.id,
      planKey: row.subscription.planKey,
      status: row.subscription.status,
      amount: row.subscription.amount,
      currency: row.subscription.currency,
      currentPeriodStart: row.subscription.currentPeriodStart,
      currentPeriodEnd: row.subscription.currentPeriodEnd,
      startedAt: row.subscription.startedAt,
      updatedAt: row.subscription.updatedAt,
    });
  }

  const entries = Array.from(grouped.values());
  const cutoverStates = await Promise.all(
    entries.map(async (entry) => ({
      userId: entry.user.id,
      ...(await getLegacyBillingCutoverState(entry.user.id)),
    }))
  );
  const cutoverStateByUserId = new Map(
    cutoverStates.map((entry) => [entry.userId, entry])
  );

  return entries
    .map((entry) => ({
      ...entry,
      subscriptionCount: entry.subscriptions.length,
      hasStripeCustomer: Boolean(entry.customer?.stripeCustomerId),
      stripeCustomerId: entry.customer?.stripeCustomerId ?? null,
      hasActiveStripeSubscription: Boolean(
        cutoverStateByUserId.get(entry.user.id)?.hasActiveStripeSubscription
      ),
      activeStripeSubscriptionId:
        cutoverStateByUserId.get(entry.user.id)?.activeStripeSubscriptionId ??
        null,
      hasActiveEntitlementOverride: Boolean(
        cutoverStateByUserId.get(entry.user.id)?.hasActiveEntitlementOverride
      ),
      activeEntitlementOverrideId:
        cutoverStateByUserId.get(entry.user.id)?.activeEntitlementOverrideId ??
        null,
    }))
    .sort(
      (left, right) =>
        (right.latestLegacyPeriodEnd?.getTime() ?? 0) -
        (left.latestLegacyPeriodEnd?.getTime() ?? 0)
    );
}

async function getLegacyBillingCutoverState(userId: string) {
  const [activeStripeSubscription] = await db
    .select({
      id: billingSubscription.id,
    })
    .from(billingSubscription)
    .where(
      and(
        eq(billingSubscription.userId, userId),
        eq(billingSubscription.provider, "stripe"),
        inArray(billingSubscription.status, ["active", "trialing"])
      )
    )
    .orderBy(
      desc(billingSubscription.currentPeriodEnd),
      desc(billingSubscription.updatedAt)
    )
    .limit(1);

  const now = new Date();
  const [activeOverride] = await db
    .select({
      id: billingEntitlementOverride.id,
    })
    .from(billingEntitlementOverride)
    .where(
      and(
        eq(billingEntitlementOverride.userId, userId),
        lte(billingEntitlementOverride.startsAt, now),
        gte(billingEntitlementOverride.endsAt, now)
      )
    )
    .orderBy(desc(billingEntitlementOverride.endsAt))
    .limit(1);

  return {
    hasActiveStripeSubscription: Boolean(activeStripeSubscription),
    activeStripeSubscriptionId: activeStripeSubscription?.id ?? null,
    hasActiveEntitlementOverride: Boolean(activeOverride),
    activeEntitlementOverrideId: activeOverride?.id ?? null,
  };
}

export async function prepareLegacyBillingCustomerForStripeBetaMigrationByUserId(
  input: {
    userId: string;
    preparedByUserId: string;
    reason?: string | null;
  }
) {
  await syncStripeBillingStateForUserId(input.userId);

  const legacy = await getActiveLegacyBillingSnapshot(input.userId);
  const cutoverState = await getLegacyBillingCutoverState(input.userId);
  if (!legacy) {
    const billing = await getActiveBillingState(input.userId);
    return {
      userId: input.userId,
      preparedOverrideId: null,
      disconnectedSubscriptionCount: 0,
      activePlanKey: billing.activePlanKey,
      hasActiveStripeSubscription: cutoverState.hasActiveStripeSubscription,
    };
  }

  let preparedOverrideId: string | null = null;
  if (!cutoverState.hasActiveStripeSubscription) {
    const endsAt = buildBetaStripeMigrationEndsAt({
      latestLegacyPeriodEnd: legacy.latestPeriodEnd,
      now: new Date(),
    });
    const override = await ensureBetaStripeMigrationOverride({
      userId: input.userId,
      targetPlanKey: legacy.activePlanKey,
      endsAt,
    });
    preparedOverrideId = override.id;

    await setStripeBetaMigrationCustomerState({
      userId: input.userId,
      status: "pending",
      targetPlanKey: legacy.activePlanKey,
      preparedByUserId: input.preparedByUserId,
      accessEndsAt: endsAt,
    });
  }

  const disconnected = await disconnectLegacyBillingCustomerByUserId({
    userId: input.userId,
    disconnectedByUserId: input.preparedByUserId,
    reason:
      input.reason ??
      "Private beta billing was moved to Stripe. Continue in Settings > Billing to re-enter payment details.",
  });

  return {
    ...disconnected,
    preparedOverrideId,
    hasActiveStripeSubscription: cutoverState.hasActiveStripeSubscription,
  };
}

async function prepareAllLegacyBillingCustomersForStripeBetaMigration(input: {
  preparedByUserId: string;
  reason?: string | null;
}) {
  const customers = await listLegacyBillingCustomers();
  let preparedUserCount = 0;
  let preparedOverrideCount = 0;
  let disconnectedSubscriptionCount = 0;

  for (const customer of customers) {
    const result = await prepareLegacyBillingCustomerForStripeBetaMigrationByUserId(
      {
        userId: customer.user.id,
        preparedByUserId: input.preparedByUserId,
        reason: input.reason ?? null,
      }
    );

    preparedUserCount += 1;
    if (result.preparedOverrideId) {
      preparedOverrideCount += 1;
    }
    disconnectedSubscriptionCount += result.disconnectedSubscriptionCount;
  }

  return {
    preparedUserCount,
    preparedOverrideCount,
    disconnectedSubscriptionCount,
  };
}

async function finalizeStripeBetaMigrationForUserId(input: {
  userId: string;
  completedByUserId: string;
}) {
  const now = new Date();
  const overrideRows = await db
    .select({
      id: billingEntitlementOverride.id,
      planKey: billingEntitlementOverride.planKey,
      endsAt: billingEntitlementOverride.endsAt,
    })
    .from(billingEntitlementOverride)
    .where(
      and(
        eq(billingEntitlementOverride.userId, input.userId),
        eq(
          billingEntitlementOverride.sourceType,
          BETA_STRIPE_MIGRATION_OVERRIDE_SOURCE
        ),
        gte(billingEntitlementOverride.endsAt, now)
      )
    );

  for (const override of overrideRows) {
    await db
      .update(billingEntitlementOverride)
      .set({
        endsAt: now,
        updatedAt: now,
      })
      .where(eq(billingEntitlementOverride.id, override.id));
  }

  const legacy = await getActiveLegacyBillingSnapshot(input.userId);
  if (legacy) {
    await disconnectLegacyBillingCustomerByUserId({
      userId: input.userId,
      disconnectedByUserId: input.completedByUserId,
      reason: "Legacy Polar access was disabled after Stripe billing became active",
    });
  }

  if (overrideRows.length > 0 || legacy) {
    await setStripeBetaMigrationCustomerState({
      userId: input.userId,
      status: "completed",
      targetPlanKey:
        overrideRows[0]?.planKey
          ? (overrideRows[0].planKey as BillingPlanKey)
          : legacy?.activePlanKey ?? null,
      completedByUserId: input.completedByUserId,
      accessEndsAt: null,
    });

    await recordAppEvent({
      userId: input.userId,
      category: "billing",
      name: "stripe_beta_migration_completed",
      source: "billing_sync",
      summary: "Legacy beta billing access was migrated to Stripe",
      level: "info",
      metadata: {
        completedByUserId: input.completedByUserId,
        clearedOverrideCount: overrideRows.length,
        disconnectedLegacySubscriptionCount: legacy?.subscriptionCount ?? 0,
      },
    });
  }
}

export async function disconnectLegacyBillingCustomerByUserId(input: {
  userId: string;
  disconnectedByUserId: string;
  reason?: string | null;
}) {
  const cutoverState = await getLegacyBillingCutoverState(input.userId);
  if (
    !cutoverState.hasActiveStripeSubscription &&
    !cutoverState.hasActiveEntitlementOverride
  ) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Legacy access can only be disconnected after Stripe access is active or an entitlement override is in place",
    });
  }

  const subscriptions = await db
    .select()
    .from(billingSubscription)
    .where(
      and(
        eq(billingSubscription.userId, input.userId),
        eq(billingSubscription.provider, "stripe"),
        inArray(billingSubscription.status, ["active", "trialing"])
      )
    );

  const now = new Date();

  for (const subscription of subscriptions) {
    await db
      .update(billingSubscription)
      .set({
        status: "canceled",
        cancelAtPeriodEnd: false,
        currentPeriodEnd:
          subscription.currentPeriodEnd &&
          subscription.currentPeriodEnd.getTime() < now.getTime()
            ? subscription.currentPeriodEnd
            : now,
        endedAt: subscription.endedAt ?? now,
        canceledAt: subscription.canceledAt ?? now,
        metadata: buildLegacyDisconnectMetadata({
          metadata: subscription.metadata,
          disconnectedByUserId: input.disconnectedByUserId,
          reason: input.reason ?? null,
          now,
        }),
        updatedAt: now,
      })
      .where(eq(billingSubscription.id, subscription.id));
  }

  const [customer] = await db
    .select()
    .from(billingCustomer)
    .where(eq(billingCustomer.userId, input.userId))
    .limit(1);

  if (customer) {
    await db
      .update(billingCustomer)
      .set({
        metadata: buildLegacyDisconnectMetadata({
          metadata: customer.metadata,
          disconnectedByUserId: input.disconnectedByUserId,
          reason: input.reason ?? null,
          now,
        }),
        updatedAt: now,
      })
      .where(eq(billingCustomer.id, customer.id));
  }

  if (subscriptions.length > 0) {
    await recordAppEvent({
      userId: input.userId,
      category: "billing",
      name: "legacy_billing_disconnected",
      source: "growth_admin",
      summary: "Legacy Polar-backed billing access was disconnected",
      level: "warning",
      metadata: {
        disconnectedByUserId: input.disconnectedByUserId,
        disconnectedSubscriptionCount: subscriptions.length,
        reason: input.reason ?? null,
      },
    });
  }

  await updateUserPremiumFlag(input.userId);
  const billing = await getActiveBillingState(input.userId);

  return {
    userId: input.userId,
    disconnectedSubscriptionCount: subscriptions.length,
    activePlanKey: billing.activePlanKey,
    hasStripeCustomer: Boolean(billing.customer?.stripeCustomerId),
  };
}

async function disconnectAllLegacyBillingCustomers(input: {
  disconnectedByUserId: string;
  reason?: string | null;
}) {
  const customers = (await listLegacyBillingCustomers()).filter(
    (customer) =>
      customer.hasActiveStripeSubscription ||
      customer.hasActiveEntitlementOverride
  );
  let disconnectedUserCount = 0;
  let disconnectedSubscriptionCount = 0;

  for (const customer of customers) {
    const result = await disconnectLegacyBillingCustomerByUserId({
      userId: customer.user.id,
      disconnectedByUserId: input.disconnectedByUserId,
      reason: input.reason ?? null,
    });

    if (result.disconnectedSubscriptionCount > 0) {
      disconnectedUserCount += 1;
      disconnectedSubscriptionCount += result.disconnectedSubscriptionCount;
    }
  }

  return {
    disconnectedUserCount,
    disconnectedSubscriptionCount,
  };
}

function assertGrowthAdmin(input: {
  role?: string | null;
  email?: string | null;
}) {
  if (!isGrowthAdmin(input)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
}

const completeGrowthAccessInput = z.object({
  referralCode: z.string().optional(),
  affiliateCode: z.string().optional(),
  source: z.string().optional(),
});

async function completeGrowthAccessForUser(
  user: Awaited<ReturnType<typeof getUserRow>>,
  input: z.infer<typeof completeGrowthAccessInput>
) {
  if (input.referralCode && input.affiliateCode) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Use either a referral code or an affiliate code, not both",
    });
  }

  let growthMessage: string | null = null;
  let growthType: "referral" | "affiliate" | null = null;

  if (input.referralCode) {
    try {
      await attachReferralConversionToUser({
        userId: user.id,
        referralCode: input.referralCode,
        source: input.source ?? "onboarding",
      });
      growthType = "referral";
    } catch (error) {
      if (error instanceof TRPCError && error.code === "BAD_REQUEST") {
        growthMessage = error.message;
      } else {
        throw error;
      }
    }
  }

  if (input.affiliateCode) {
    try {
      await attachAffiliateAttributionToUser({
        userId: user.id,
        affiliateCode: input.affiliateCode,
        source: input.source ?? "onboarding",
      });
      growthType = "affiliate";
    } catch (error) {
      if (error instanceof TRPCError && error.code === "BAD_REQUEST") {
        growthMessage = error.message;
      } else {
        throw error;
      }
    }
  }

  const access = await getAccessStatus({
    userId: user.id,
    role: user.role,
    email: user.email,
  });

  return {
    access,
    growth: {
      type: growthType,
      message: growthMessage,
    },
  };
}

export const billingRouter = router({
  getPublicConfig: publicProcedure.query(() => {
    const plans = getBillingPlanDefinitions().map((plan) => ({
      key: plan.key,
      title: plan.title,
      summary: plan.summary,
      priceLabel: plan.priceLabel,
      highlight: plan.highlight,
      ctaLabel: plan.ctaLabel,
      features: plan.features,
      accountAllowanceLabel: plan.accountAllowanceLabel,
      includedAiCredits: plan.includedAiCredits,
      includedLiveSyncSlots: plan.includedLiveSyncSlots,
      includesPropTracker: plan.includesPropTracker,
      isFree: plan.isFree,
      isConfigured: plan.isFree || Boolean(plan.stripePriceId),
    }));

    return {
      privateBetaRequired: false,
      referralRewards: {
        edgeCreditThreshold: REFERRAL_EDGE_CREDIT_THRESHOLD,
        edgeCreditAmount: REFERRAL_EDGE_CREDIT_AMOUNT,
        freeMonthThreshold: REFERRAL_FREE_MONTH_THRESHOLD,
        upgradeTrialThreshold: REFERRAL_UPGRADE_TRIAL_THRESHOLD,
        upgradeTrialDays: REFERRAL_UPGRADE_TRIAL_DAYS,
      },
      plans,
    };
  }),

  getAffiliatePublicProfile: publicProcedure
    .input(z.object({ code: z.string().min(1) }))
    .query(async ({ input }) => {
      return getAffiliatePublicProfile(input.code);
    }),

  captureGrowthTouch: publicProcedure
    .input(
      z.object({
        type: z.enum(["affiliate", "referral"]),
        code: z.string().optional(),
        offerCode: z.string().optional(),
        channel: z.string().optional(),
        trackingLinkSlug: z.string().optional(),
        affiliateGroupSlug: z.string().optional(),
        landingPath: z.string().optional(),
        query: z.string().optional(),
        visitorToken: z.string().optional(),
        touchCookie: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const fallbackTouch =
        input.touchCookie != null
          ? readGrowthTouchFromCookies({
              get(name: string) {
                return name === "pe_growth_touch"
                  ? {
                      value: input.touchCookie!,
                    }
                  : undefined;
              },
            })
          : null;
      const visitorToken =
        input.visitorToken?.trim() ||
        fallbackTouch?.visitorToken ||
        getGrowthCookieContext(ctx).visitorToken;

      if (!visitorToken) {
        return {
          captured: false,
          pending: null,
        };
      }

      const pending = await captureGrowthTouch({
        visitorToken,
        referralCode: input.type === "referral" ? input.code ?? null : null,
        affiliateCode: input.type === "affiliate" ? input.code ?? null : null,
        affiliateOfferCode: input.offerCode ?? null,
        channel: input.channel ?? null,
        affiliateTrackingLinkSlug: input.trackingLinkSlug ?? null,
        affiliateGroupSlug: input.affiliateGroupSlug ?? null,
        sourcePath: input.landingPath ?? null,
        referrerUrl: ctx.req.headers.get("referer"),
        metadata: input.query
          ? {
              query: input.query,
            }
          : null,
      });

      return {
        captured: Boolean(pending),
        pending,
      };
    }),

  claimPendingGrowthAttribution: protectedProcedure.mutation(async ({ ctx }) => {
    const { visitorToken, storedTouch } = getGrowthCookieContext(ctx);

    return claimPendingGrowthAttributionIfOnboardingPending({
      userId: ctx.session.user.id,
      visitorToken: visitorToken ?? storedTouch?.visitorToken ?? null,
      source: "auth_claim",
    });
  }),

  completeGrowthAccess: protectedProcedure
    .input(completeGrowthAccessInput)
    .mutation(async ({ ctx, input }) => {
      const user = await getUserRow(ctx.session.user.id);
      return completeGrowthAccessForUser(user, input);
    }),

  completeAccessSetup: protectedProcedure
    .input(completeGrowthAccessInput)
    .mutation(async ({ ctx, input }) => {
      const user = await getUserRow(ctx.session.user.id);
      return completeGrowthAccessForUser(user, input);
    }),

  getState: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserRow(ctx.session.user.id);
    const [access, referral, affiliate, billing, onboarding, credits] =
      await Promise.all([
        getAccessStatus({
          userId: user.id,
          role: user.role,
          email: user.email,
        }),
        buildReferralState(user.id),
        buildAffiliateState(user.id),
        getActiveBillingState(user.id),
        getOnboardingStatus(user.id),
        getUserEdgeCreditSnapshot(user.id),
      ]);
    const isAdmin = isGrowthAdmin({
      role: user.role,
      email: user.email,
    });

    return {
      access,
      onboarding,
      referral,
      affiliate,
      billing: {
        activePlanKey: billing.activePlanKey,
        customer: billing.customer,
        subscription: billing.subscription,
        override: billing.override,
        credits,
      },
      admin: {
        isAdmin,
      },
    };
  }),

  getInvoiceHistory: protectedProcedure.query(async ({ ctx }) => {
    const invoices = await db
      .select({
        id: billingOrder.id,
        provider: billingOrder.provider,
        providerOrderId: billingOrder.providerOrderId,
        stripeInvoiceId: billingOrder.stripeInvoiceId,
        planKey: billingOrder.planKey,
        status: billingOrder.status,
        currency: billingOrder.currency,
        subtotalAmount: billingOrder.subtotalAmount,
        discountAmount: billingOrder.discountAmount,
        taxAmount: billingOrder.taxAmount,
        totalAmount: billingOrder.totalAmount,
        paid: billingOrder.paid,
        paidAt: billingOrder.paidAt,
        createdAt: billingOrder.createdAt,
      })
      .from(billingOrder)
      .where(eq(billingOrder.userId, ctx.session.user.id))
      .orderBy(desc(billingOrder.paidAt), desc(billingOrder.createdAt))
      .limit(25);

    return invoices.map((invoice) => ({
      ...invoice,
      referenceId: invoice.providerOrderId ?? invoice.stripeInvoiceId,
      planTitle:
        getBillingPlanDefinition(invoice.planKey as BillingPlanKey)?.title ??
        "Student",
    }));
  }),

  applyForAffiliate: protectedProcedure
    .input(
      z.object({
        whyApply: z.string().trim().min(24).max(1200),
        promotionPlan: z.string().trim().min(16).max(1200),
        estimatedMonthlyReferrals: z.number().int().min(0).max(100000),
        audienceSize: z.number().int().min(0).max(100000000).optional().nullable(),
        twitter: z.string().max(200).optional().nullable(),
        discord: z.string().max(200).optional().nullable(),
        website: z.string().max(200).optional().nullable(),
        location: z.string().max(100).optional().nullable(),
        otherSocials: z.string().max(500).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const application = await applyForAffiliate({
        userId: ctx.session.user.id,
        details: input,
      });

      return {
        application,
      };
    }),

  getAffiliateDashboard: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserRow(ctx.session.user.id);
    const isAdmin = isGrowthAdmin({
      role: user.role,
      email: user.email,
    });
    const dashboard = await buildAffiliateDashboardState(user.id);

    if (!dashboard && !isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Affiliate access required",
      });
    }

    return {
      dashboard,
      isAdmin,
    };
  }),

  getAffiliatePayoutSettings: protectedProcedure.query(async ({ ctx }) => {
    return getAffiliatePayoutSettings(ctx.session.user.id);
  }),

  saveAffiliateOffer: protectedProcedure
    .input(
      z.object({
        affiliateUserId: z.string(),
        affiliateOfferId: z.string().optional(),
        code: z.string().min(3).max(64),
        label: z.string().min(2).max(80),
        description: z.string().max(300).optional(),
        discountBasisPoints: z.number().int().min(100).max(10000),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserRow(ctx.session.user.id);
      assertGrowthAdmin({ role: user.role, email: user.email });

      return saveAffiliateOffer({
        affiliateUserId: input.affiliateUserId,
        createdByUserId: user.id,
        affiliateOfferId: input.affiliateOfferId ?? null,
        code: input.code,
        label: input.label,
        description: input.description ?? null,
        discountBasisPoints: input.discountBasisPoints,
        isDefault: input.isDefault,
      });
    }),

  saveAffiliateCommissionSplit: protectedProcedure
    .input(
      z.object({
        affiliateUserId: z.string(),
        commissionBps: z.number().int().min(0).max(10000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserRow(ctx.session.user.id);
      assertGrowthAdmin({ role: user.role, email: user.email });

      return saveAffiliateCommissionSplit({
        affiliateUserId: input.affiliateUserId,
        commissionBps: input.commissionBps,
      });
    }),

  saveAffiliateTierSettings: protectedProcedure
    .input(
      z.object({
        affiliateUserId: z.string(),
        tierMode: z.enum(AFFILIATE_TIER_MODES),
        tierKey: z.enum(AFFILIATE_TIER_KEYS),
        offerCode: z.string().min(3).max(64),
        offerLabel: z.string().min(2).max(80),
        offerDescription: z.string().max(300).optional(),
        discountPercent: z.number().min(1).max(100).optional(),
        payoutSplitPercent: z.number().min(0).max(100).optional(),
        badgeLabel: z.string().min(1).max(40).optional(),
        effectVariant: z.enum(AFFILIATE_TIER_EFFECT_VARIANTS).optional(),
        benefits: z
          .object({
            customCodeLinks: z.boolean().optional(),
            affiliateDashboard: z.boolean().optional(),
            withdrawals: z.boolean().optional(),
            proofBadge: z.boolean().optional(),
            premiumAccess: z.boolean().optional(),
            creatorKit: z.boolean().optional(),
            prioritySupport: z.boolean().optional(),
            earlyAccess: z.boolean().optional(),
            featuredProof: z.boolean().optional(),
            coBrandedCampaigns: z.boolean().optional(),
            milestoneBonuses: z.boolean().optional(),
            brandedEdge: z.boolean().optional(),
            founderSupport: z.boolean().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserRow(ctx.session.user.id);
      assertGrowthAdmin({ role: user.role, email: user.email });

      return saveAffiliateTierSettings({
        affiliateUserId: input.affiliateUserId,
        updatedByUserId: user.id,
        tierMode: input.tierMode,
        tierKey: input.tierKey,
        offerCode: input.offerCode,
        offerLabel: input.offerLabel,
        offerDescription: input.offerDescription ?? null,
        discountBasisPoints:
          typeof input.discountPercent === "number"
            ? Math.round(input.discountPercent * 100)
            : null,
        commissionBps:
          typeof input.payoutSplitPercent === "number"
            ? Math.round(input.payoutSplitPercent * 100)
            : null,
        badgeLabel: input.badgeLabel ?? null,
        effectVariant: input.effectVariant ?? null,
        benefits: input.benefits ?? null,
      });
    }),

  saveAffiliateTrackingLink: protectedProcedure
    .input(
      z.object({
        trackingLinkId: z.string().optional(),
        affiliateOfferId: z.string().optional(),
        name: z.string().min(2).max(80),
        destinationPath: z.string().optional(),
        affiliateGroupSlug: z.string().optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return saveAffiliateTrackingLink({
        affiliateUserId: ctx.session.user.id,
        trackingLinkId: input.trackingLinkId ?? null,
        affiliateOfferId: input.affiliateOfferId ?? null,
        name: input.name,
        destinationPath: input.destinationPath ?? null,
        affiliateGroupSlug: input.affiliateGroupSlug ?? null,
        isDefault: input.isDefault,
      });
    }),

  createAffiliateStripeConnectSession: protectedProcedure
    .input(
      z.object({
        mode: z.enum(["onboarding", "dashboard"]).optional(),
        refreshPath: z.string().optional(),
        returnPath: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const refreshPath = assertAppRelativePath(
        input.refreshPath ?? "/dashboard/settings/billing/payment-methods"
      );
      const returnPath = assertAppRelativePath(
        input.returnPath ?? "/dashboard/settings/billing/payment-methods"
      );
      return createAffiliateStripeConnectSession({
        affiliateUserId: ctx.session.user.id,
        mode: input.mode ?? "onboarding",
        refreshUrl: buildAppUrl(refreshPath, { stripe: "refresh" }),
        returnUrl: buildAppUrl(returnPath, { stripe: "connected" }),
      });
    }),

  refreshAffiliateStripeConnectAccount: protectedProcedure.mutation(async ({
    ctx,
  }) => {
    return refreshAffiliateStripeConnectAccount(ctx.session.user.id);
  }),

  disconnectAffiliateStripeConnect: protectedProcedure.mutation(async ({
    ctx,
  }) => {
    return disconnectAffiliateStripeConnect(ctx.session.user.id);
  }),

  saveAffiliatePaymentMethod: protectedProcedure
    .input(
      z.object({
        paymentMethodId: z.string().optional(),
        methodType: z.enum(AFFILIATE_PAYMENT_METHOD_TYPES),
        label: z.string().min(2).max(80),
        recipientName: z.string().max(120).optional(),
        details: z.string().min(4).max(1000),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return saveAffiliatePaymentMethod({
        affiliateUserId: ctx.session.user.id,
        paymentMethodId: input.paymentMethodId ?? null,
        methodType: input.methodType,
        label: input.label,
        recipientName: input.recipientName ?? null,
        details: input.details,
        isDefault: input.isDefault,
      });
    }),

  updateAffiliateProfileEffects: protectedProcedure
    .input(
      z.object({
        pfpEffect: z.enum(AFFILIATE_PFP_EFFECTS).optional(),
        nameEffect: z.enum(AFFILIATE_NAME_EFFECTS).optional(),
        nameFont: z.enum(AFFILIATE_NAME_FONTS).optional(),
        nameColor: z.enum(AFFILIATE_NAME_COLORS).optional(),
        badgeLabel: z.string().min(1).max(40).optional(),
        effectVariant: z.string().min(1).max(40).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return updateAffiliateProfileEffects(ctx.session.user.id, input);
    }),

  requestAffiliateWithdrawal: protectedProcedure
    .input(
      z.object({
        amountUsd: z.number().int().positive().optional(),
        destinationType: z.enum(["stripe_connect", "manual"]),
        paymentMethodId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return requestAffiliateWithdrawal({
        affiliateUserId: ctx.session.user.id,
        amount: input.amountUsd ?? null,
        destinationType: input.destinationType,
        paymentMethodId: input.paymentMethodId ?? null,
      });
    }),

  cancelAffiliateWithdrawal: protectedProcedure
    .input(
      z.object({
        withdrawalRequestId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return cancelAffiliateWithdrawal({
        affiliateUserId: ctx.session.user.id,
        withdrawalRequestId: input.withdrawalRequestId,
      });
    }),

  deleteAffiliatePaymentMethod: protectedProcedure
    .input(
      z.object({
        paymentMethodId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return deleteAffiliatePaymentMethodRecord({
        affiliateUserId: ctx.session.user.id,
        paymentMethodId: input.paymentMethodId,
      });
    }),

  setDefaultAffiliatePaymentMethod: protectedProcedure
    .input(
      z.object({
        paymentMethodId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return setDefaultAffiliatePaymentMethod({
        affiliateUserId: ctx.session.user.id,
        paymentMethodId: input.paymentMethodId,
      });
    }),

  markOnboardingComplete: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await getUserRow(ctx.session.user.id);

    await ensureActivationMilestone({
      userId: user.id,
      key: ONBOARDING_COMPLETION_KEY,
      source: "onboarding",
      metadata: {
        pagePath: "/onboarding",
      },
    });

    return {
      onboarding: await getOnboardingStatus(user.id),
    };
  }),

  createCheckout: protectedProcedure
    .input(
      z.object({
        planKey: z.enum(["professional", "institutional"]),
        returnPath: z.string().optional(),
        affiliateOfferCode: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const plan = getBillingPlanDefinition(input.planKey);
      if (!plan || !plan.stripePriceId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "That plan is not configured in Stripe",
        });
      }

      const user = await getUserRow(ctx.session.user.id);
      const stripeCustomer = await ensureStripeCustomerForUser(user);
      const growthCookieContext = getGrowthCookieContext(ctx);
      await claimPendingGrowthAttributionIfOnboardingPending({
        userId: user.id,
        visitorToken:
          growthCookieContext.visitorToken ??
          growthCookieContext.storedTouch?.visitorToken ??
          null,
        source: "checkout",
      });
      const billing = await getActiveBillingState(user.id);
      const currentPlanTier = BILLING_PLAN_TIER[billing.activePlanKey] ?? 0;
      const targetPlanTier = BILLING_PLAN_TIER[input.planKey] ?? 0;

      if (targetPlanTier <= currentPlanTier) {
        const targetPlanTitle = getBillingPlanDefinition(input.planKey)?.title ?? "plan";

        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            targetPlanTier === currentPlanTier
              ? `You're already on the ${targetPlanTitle} plan`
              : `Downgrades to ${targetPlanTitle} aren't available from this checkout flow`,
        });
      }

      const referralRewardGrant =
        await getAvailableReferralFreeMonthGrantForPlan(user.id, input.planKey);
      const affiliateCheckout = input.affiliateOfferCode?.trim()
        ? await ensureAffiliateOfferForCheckout({
            userId: user.id,
            affiliateOfferCode: input.affiliateOfferCode,
          })
        : await getAffiliateCheckoutAttribution(user.id);
      const affiliateCommissionBps = affiliateCheckout.attribution?.affiliateUserId
        ? await getAffiliateCommissionBpsForUser(
            affiliateCheckout.attribution.affiliateUserId
          )
        : null;
      const upgradeOfferDiscount = referralRewardGrant
        ? null
        : await createUpgradeOfferDiscount({
            userId: user.id,
            currentPlanKey: billing.activePlanKey,
            targetPlanKey: input.planKey,
          });
      const affiliateOfferCouponId =
        affiliateCheckout.offer?.discountProvider === "stripe"
          ? (affiliateCheckout.offer.providerDiscountId ?? null)
          : null;
      const referralRewardCouponId =
        referralRewardGrant?.discountProvider === "stripe"
          ? (referralRewardGrant.providerDiscountId ?? null)
          : null;

      if (affiliateCheckout.offer && !affiliateOfferCouponId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "That affiliate offer is not configured for Stripe checkout yet",
        });
      }
      if (
        affiliateCheckout.offer &&
        (referralRewardCouponId || upgradeOfferDiscount?.id)
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Affiliate offer codes cannot be combined with other checkout discounts",
        });
      }
      const checkoutCouponId =
        affiliateOfferCouponId ??
        referralRewardCouponId ??
        upgradeOfferDiscount?.id ??
        null;

      const returnPath = assertAppRelativePath(input.returnPath);
      const successBase = buildAppUrl(returnPath, {
        checkout: "success",
        plan: plan.key,
      });
      const successUrl = `${successBase}&session_id={CHECKOUT_SESSION_ID}`;

      const metadata = {
        user_id: user.id,
        plan_key: plan.key,
        billing_provider: "stripe",
        ...(affiliateCheckout.attribution?.id
          ? {
              affiliate_attribution_id: affiliateCheckout.attribution.id,
              affiliate_code: affiliateCheckout.attribution.affiliateCode,
              affiliate_commission_bps: String(
                affiliateCommissionBps ?? getServerAffiliateCommissionBps()
              ),
              ...(affiliateCheckout.offer?.id
                ? {
                    affiliate_offer_id: affiliateCheckout.offer.id,
                  }
                : {}),
              ...(affiliateCheckout.offer?.code
                ? {
                    affiliate_offer_code: affiliateCheckout.offer.code,
                  }
                : {}),
              ...(affiliateCheckout.attribution.affiliateTrackingLinkId
                ? {
                    affiliate_tracking_link_id:
                      affiliateCheckout.attribution.affiliateTrackingLinkId,
                  }
                : {}),
            }
          : {}),
        ...(referralRewardGrant?.id
          ? { referral_reward_grant_id: referralRewardGrant.id }
          : {}),
      };

      const checkout = await createStripeCheckoutSession({
        customerId: stripeCustomer?.stripeCustomerId ?? null,
        customerEmail: user.email,
        customerName: user.name,
        clientReferenceId: user.id,
        planKey: plan.key,
        couponId: checkoutCouponId,
        successUrl,
        cancelUrl: buildAppUrl(returnPath),
        metadata: {
          ...metadata,
        },
      });

      return {
        url: checkout.url,
        id: checkout.id,
      };
    }),

  createCustomerPortalSession: protectedProcedure
    .input(
      z.object({
        returnPath: z.string().optional(),
        flow: z.enum(["manage", "cancel"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserRow(ctx.session.user.id);
      const billing = await getActiveBillingState(user.id);

      if (!billing.customer?.stripeCustomerId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No Stripe customer is linked to this account yet",
        });
      }

      if (input.flow === "cancel" && !billing.subscription?.stripeSubscriptionId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active Stripe subscription is linked to this account yet",
        });
      }

      const session = await createStripeBillingPortalSession({
        customerId: billing.customer.stripeCustomerId,
        returnUrl: buildAppUrl(
          input.returnPath ?? "/dashboard/settings/billing"
        ),
        flow: input.flow,
        subscriptionId: billing.subscription?.stripeSubscriptionId ?? null,
      });

      return {
        url: session.url,
      };
    }),

  syncBillingState: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await getUserRow(ctx.session.user.id);
    return syncStripeBillingStateForUser(user);
  }),

  listStaffAccessOverrides: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserRow(ctx.session.user.id);
    assertGrowthAdmin({ role: user.role, email: user.email });

    return listStaffAccessOverrides();
  }),

  grantStaffAccessOverride: protectedProcedure
    .input(
      z.object({
        userIdentifier: z.string().trim().min(3).max(160),
        planKey: z.enum(["professional", "institutional"]),
        presetKey: z.enum(STAFF_ACCESS_PRESET_KEYS),
        durationDays: z.number().int().min(1).max(3650).default(365),
        reason: z.string().trim().max(240).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserRow(ctx.session.user.id);
      assertGrowthAdmin({ role: user.role, email: user.email });

      const targetUser = await findUserByBillingAccessIdentifier(
        input.userIdentifier
      );
      const override = await upsertStaffAccessOverride({
        targetUserId: targetUser.id,
        planKey: input.planKey,
        durationDays: input.durationDays,
        actor: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        presetKey: input.presetKey,
        reason: input.reason ?? null,
      });

      await syncUserPremiumFlag(targetUser.id);

      return {
        override,
        user: targetUser,
      };
    }),

  revokeStaffAccessOverride: protectedProcedure
    .input(
      z.object({
        userIdentifier: z.string().trim().min(3).max(160),
        reason: z.string().trim().max(240).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserRow(ctx.session.user.id);
      assertGrowthAdmin({ role: user.role, email: user.email });

      const targetUser = await findUserByBillingAccessIdentifier(
        input.userIdentifier
      );
      const deletedCount = await revokeStaffAccessOverride({
        targetUserId: targetUser.id,
        actor: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        reason: input.reason ?? null,
      });
      await syncUserPremiumFlag(targetUser.id);

      return {
        deletedCount,
        user: targetUser,
      };
    }),

  listAffiliateApplications: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserRow(ctx.session.user.id);
    assertGrowthAdmin({ role: user.role, email: user.email });

    return listAffiliateApplications();
  }),

  listAffiliatePayoutQueue: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserRow(ctx.session.user.id);
    assertGrowthAdmin({ role: user.role, email: user.email });

    return listAffiliatePayoutQueue();
  }),

  approveAffiliateWithdrawal: protectedProcedure
    .input(
      z.object({
        withdrawalRequestId: z.string(),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserRow(ctx.session.user.id);
      assertGrowthAdmin({ role: user.role, email: user.email });

      return approveAffiliateWithdrawal({
        withdrawalRequestId: input.withdrawalRequestId,
        reviewedByUserId: user.id,
        notes: input.notes ?? null,
      });
    }),

  rejectAffiliateWithdrawal: protectedProcedure
    .input(
      z.object({
        withdrawalRequestId: z.string(),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserRow(ctx.session.user.id);
      assertGrowthAdmin({ role: user.role, email: user.email });

      return rejectAffiliateWithdrawal({
        withdrawalRequestId: input.withdrawalRequestId,
        reviewedByUserId: user.id,
        notes: input.notes ?? null,
      });
    }),

  sendAffiliateStripeWithdrawal: protectedProcedure
    .input(
      z.object({
        withdrawalRequestId: z.string(),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserRow(ctx.session.user.id);
      assertGrowthAdmin({ role: user.role, email: user.email });

      return sendAffiliateStripeWithdrawal({
        withdrawalRequestId: input.withdrawalRequestId,
        reviewedByUserId: user.id,
        notes: input.notes ?? null,
      });
    }),

  markAffiliateManualWithdrawalPaid: protectedProcedure
    .input(
      z.object({
        withdrawalRequestId: z.string(),
        paymentMethodId: z.string().optional(),
        externalReference: z.string().max(120).optional(),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserRow(ctx.session.user.id);
      assertGrowthAdmin({ role: user.role, email: user.email });

      return markAffiliateManualWithdrawalPaid({
        withdrawalRequestId: input.withdrawalRequestId,
        reviewedByUserId: user.id,
        paymentMethodId: input.paymentMethodId ?? null,
        externalReference: input.externalReference ?? null,
        notes: input.notes ?? null,
      });
    }),

  recordAffiliatePayout: protectedProcedure
    .input(
      z.object({
        affiliateUserId: z.string(),
        paymentMethodId: z.string().optional(),
        externalReference: z.string().max(120).optional(),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserRow(ctx.session.user.id);
      assertGrowthAdmin({ role: user.role, email: user.email });

      return recordAffiliatePayout({
        affiliateUserId: input.affiliateUserId,
        createdByUserId: user.id,
        paymentMethodId: input.paymentMethodId ?? null,
        externalReference: input.externalReference ?? null,
        notes: input.notes ?? null,
      });
    }),

  approveAffiliate: protectedProcedure
    .input(
      z.object({
        applicationId: z.string(),
        adminNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserRow(ctx.session.user.id);
      assertGrowthAdmin({ role: user.role, email: user.email });

      return approveAffiliateApplication({
        applicationId: input.applicationId,
        reviewedByUserId: user.id,
        adminNotes: input.adminNotes ?? null,
      });
    }),

  rejectAffiliate: protectedProcedure
    .input(
      z.object({
        applicationId: z.string(),
        adminNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserRow(ctx.session.user.id);
      assertGrowthAdmin({ role: user.role, email: user.email });

      return rejectAffiliateApplication({
        applicationId: input.applicationId,
        reviewedByUserId: user.id,
        adminNotes: input.adminNotes ?? null,
      });
    }),

});

export async function syncStripeWebhookEvent(event: Stripe.Event) {
  const objectId =
    typeof (event.data.object as { id?: unknown })?.id === "string"
      ? ((event.data.object as { id: string }).id ?? null)
      : null;

  const seen = await db
    .select()
    .from(billingWebhookEvent)
    .where(
      and(
        eq(billingWebhookEvent.provider, "stripe"),
        eq(billingWebhookEvent.providerEventId, event.id)
      )
    )
    .limit(1);

  if (seen[0]?.processingStatus === "processed") {
    return;
  }

  const [webhookRow] = seen[0]
    ? await db
        .update(billingWebhookEvent)
        .set({
          providerObjectId: objectId,
          eventKey: `stripe:${event.id}`,
          eventType: event.type,
          objectId,
          processingStatus: "pending",
          processedAt: null,
          errorMessage: null,
          payload: event as unknown as Record<string, unknown>,
        })
        .where(eq(billingWebhookEvent.id, seen[0].id))
        .returning()
    : await db
        .insert(billingWebhookEvent)
        .values({
          id: crypto.randomUUID(),
          provider: "stripe",
          providerEventId: event.id,
          providerObjectId: objectId,
          eventKey: `stripe:${event.id}`,
          eventType: event.type,
          objectId,
          processingStatus: "pending",
          payload: event as unknown as Record<string, unknown>,
        })
        .returning();

  try {
    if (event.type.startsWith("customer.")) {
      const customer = event.data.object as Stripe.Customer;
      if (!customer.deleted) {
        const userId = await findUserIdForStripeCustomer({
          stripeCustomerId: customer.id,
          metadataUserId:
            typeof customer.metadata?.user_id === "string"
              ? customer.metadata.user_id
              : null,
        });
        if (userId) {
          await upsertBillingCustomerFromStripe({
            userId,
            stripeCustomerId: customer.id,
            email: customer.email ?? null,
            name: customer.name ?? null,
            defaultPaymentMethodId:
              typeof customer.invoice_settings?.default_payment_method ===
              "string"
                ? customer.invoice_settings.default_payment_method
                : null,
            metadata: normalizeBillingMetadata(customer.metadata),
          });
        }
      }
    } else if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId =
        typeof session.metadata?.user_id === "string"
          ? session.metadata.user_id
          : session.client_reference_id ?? null;

      if (userId && typeof session.customer === "string") {
        const customer = await retrieveStripeCustomer(session.customer);
        if (customer && !customer.deleted) {
          await upsertBillingCustomerFromStripe({
            userId,
            stripeCustomerId: customer.id,
            email: customer.email ?? null,
            name: customer.name ?? null,
            defaultPaymentMethodId:
              typeof customer.invoice_settings?.default_payment_method ===
              "string"
                ? customer.invoice_settings.default_payment_method
                : null,
            metadata: normalizeBillingMetadata(customer.metadata),
          });
        }
      }
    } else if (event.type.startsWith("customer.subscription.")) {
      const subscription = event.data.object as any;
      const userId = await findUserIdForStripeCustomer({
        stripeCustomerId:
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id ?? null,
        metadataUserId:
          typeof subscription.metadata?.user_id === "string"
            ? subscription.metadata.user_id
            : null,
      });

      if (userId) {
        const primaryItem = subscription.items.data[0];
        const price = primaryItem?.price;
        await upsertBillingSubscriptionFromStripe({
          userId,
          stripeSubscriptionId: subscription.id,
          stripeCustomerId:
            typeof subscription.customer === "string"
              ? subscription.customer
              : subscription.customer?.id ?? null,
          stripePriceId: price?.id ?? null,
          stripeProductId:
            typeof price?.product === "string"
              ? price.product
              : price?.product?.id ?? null,
          stripeLatestInvoiceId:
            typeof subscription.latest_invoice === "string"
              ? subscription.latest_invoice
              : subscription.latest_invoice?.id ?? null,
          metadata: normalizeBillingMetadata(subscription.metadata),
          status: subscription.status,
          currency: price?.currency?.toUpperCase() ?? null,
          amount: price?.unit_amount ?? null,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodStart: fromStripeTimestamp(
            subscription.current_period_start
          ),
          currentPeriodEnd: fromStripeTimestamp(subscription.current_period_end),
          trialStart: fromStripeTimestamp(subscription.trial_start),
          trialEnd: fromStripeTimestamp(subscription.trial_end),
          startedAt: fromStripeTimestamp(subscription.start_date),
          endedAt: fromStripeTimestamp(subscription.ended_at),
          canceledAt: fromStripeTimestamp(subscription.canceled_at),
        });

        if (
          subscription.status === "active" ||
          subscription.status === "trialing"
        ) {
          await markAffiliateSubscriptionActive({
            referredUserId: userId,
            subscriptionId: subscription.id,
            activatedAt:
              fromStripeTimestamp(subscription.start_date) ?? new Date(),
          });
        }

        await updateUserPremiumFlag(userId);
      }
    } else if (
      event.type === "invoice.paid" ||
      event.type === "invoice.payment_failed" ||
      event.type === "invoice.finalized"
    ) {
      const invoice = event.data.object as any;
      const userId = await findUserIdForStripeCustomer({
        stripeCustomerId:
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id ?? null,
        metadataUserId: null,
      });

      if (userId) {
        const line =
          invoice.lines.data.find((item: any) => item.type === "subscription") ??
          invoice.lines.data[0];
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id ?? null;
        const [subscriptionRow] = subscriptionId
          ? await db
              .select()
              .from(billingSubscription)
              .where(eq(billingSubscription.stripeSubscriptionId, subscriptionId))
              .limit(1)
          : [null];
        const metadata = {
          ...(normalizeBillingMetadata(subscriptionRow?.metadata) ?? {}),
          ...(normalizeBillingMetadata(invoice.metadata) ?? {}),
        };
        const affiliateOrderMetadata = extractAffiliateOrderMetadata(metadata);
        const price = line?.price ?? null;
        const discountAmount = Array.isArray(invoice.total_discount_amounts)
          ? invoice.total_discount_amounts.reduce(
              (sum: number, item: any) => sum + (item.amount ?? 0),
              0
            )
          : 0;
        const taxAmount =
          (typeof invoice.tax === "number" ? invoice.tax : null) ??
          (Array.isArray(invoice.total_taxes)
            ? invoice.total_taxes.reduce(
                (sum: number, item: any) => sum + (item.amount ?? 0),
                0
              )
            : 0);
        const paidAt =
          fromStripeTimestamp(invoice.status_transitions?.paid_at) ??
          fromStripeTimestamp(invoice.created) ??
          new Date();
        const order = await upsertBillingOrderFromStripe({
          userId,
          providerOrderId: invoice.id,
          stripeInvoiceId: invoice.id,
          stripeCustomerId:
            typeof invoice.customer === "string"
              ? invoice.customer
              : invoice.customer?.id ?? null,
          stripeSubscriptionId: subscriptionId,
          stripePaymentIntentId:
            typeof invoice.payment_intent === "string"
              ? invoice.payment_intent
              : invoice.payment_intent?.id ?? null,
          stripeChargeId:
            typeof invoice.charge === "string"
              ? invoice.charge
              : invoice.charge?.id ?? null,
          stripePriceId: price?.id ?? subscriptionRow?.stripePriceId ?? null,
          stripeProductId:
            (typeof price?.product === "string"
              ? price.product
              : price?.product?.id) ??
            subscriptionRow?.stripeProductId ??
            null,
          metadata,
          status: invoice.status ?? (event.type === "invoice.paid" ? "paid" : "open"),
          currency: invoice.currency?.toUpperCase() ?? null,
          subtotalAmount: invoice.subtotal ?? null,
          discountAmount,
          taxAmount,
          totalAmount: invoice.total ?? invoice.amount_paid ?? null,
          paid: event.type === "invoice.paid" || invoice.paid,
          paidAt: event.type === "invoice.paid" || invoice.paid ? paidAt : null,
          createdAt: fromStripeTimestamp(invoice.created),
        });

        if (event.type === "invoice.paid" || invoice.paid) {
          await markReferralConversionPaid({
            referredUserId: userId,
            orderId: invoice.id,
            subscriptionId,
            paidAt,
          });

          await recordAffiliateCommissionEvent({
            provider: "stripe",
            providerOrderId: invoice.id,
            providerSubscriptionId: subscriptionId,
            billingOrderId: order.id,
            stripeInvoiceId: invoice.id,
            stripeSubscriptionId: subscriptionId,
            referredUserId: userId,
            affiliateAttributionId: affiliateOrderMetadata.affiliateAttributionId,
            planKey: order.planKey,
            orderAmount: resolveCommissionableOrderAmount({
              subtotalAmount: invoice.subtotal,
              discountAmount,
              totalAmount: invoice.total ?? invoice.amount_paid,
            }),
            subtotalAmount: invoice.subtotal ?? null,
            discountAmount,
            taxAmount,
            currency: invoice.currency?.toUpperCase() ?? null,
            commissionBps: affiliateOrderMetadata.commissionBps,
            metadata,
            occurredAt: paidAt,
          });

          if (affiliateOrderMetadata.rewardGrantId) {
            await markReferralRewardGrantConsumed(
              affiliateOrderMetadata.rewardGrantId
            );
          }
        }

        await updateUserPremiumFlag(userId);
      }
    }

    await db
      .update(billingWebhookEvent)
      .set({
        processingStatus: "processed",
        processedAt: new Date(),
        errorMessage: null,
        payload: event as unknown as Record<string, unknown>,
      })
      .where(eq(billingWebhookEvent.id, webhookRow.id));
  } catch (error) {
    await db
      .update(billingWebhookEvent)
      .set({
        processingStatus: "failed",
        processedAt: null,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        payload: event as unknown as Record<string, unknown>,
      })
      .where(eq(billingWebhookEvent.id, webhookRow.id));

    throw error;
  }
}
