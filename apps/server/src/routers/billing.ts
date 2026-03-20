import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  billingCustomer,
  billingOrder,
  billingSubscription,
  billingWebhookEvent,
  privateBetaCode,
  privateBetaRedemption,
} from "../db/schema/billing";
import { user as userTable } from "../db/schema/auth";
import { activationMilestone } from "../db/schema/operations";
import { tradingAccount } from "../db/schema/trading";
import {
  getAffiliateCommissionBps as getServerAffiliateCommissionBps,
  getBillingPlanDefinition,
  getBillingPlanDefinitions,
  getWebAppUrl,
  isPrivateBetaAdminEmail,
  isPrivateBetaRequired,
  REFERRAL_EDGE_CREDIT_AMOUNT,
  REFERRAL_EDGE_CREDIT_THRESHOLD,
  REFERRAL_FREE_MONTH_THRESHOLD,
  REFERRAL_UPGRADE_TRIAL_DAYS,
  REFERRAL_UPGRADE_TRIAL_THRESHOLD,
  resolvePlanKeyFromProductId,
  type BillingPlanKey,
} from "../lib/billing/config";
import { createUpgradeOfferDiscount } from "../lib/billing/discounts";
import {
  normalizePrivateBetaCode,
  validatePrivateBetaCodeInput,
} from "../lib/billing/private-beta";
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
  joinPrivateBetaWaitlist,
  listAffiliatePayoutQueue,
  listAffiliateApplications,
  listPrivateBetaWaitlistEntries,
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
  saveAffiliatePaymentMethod,
  saveAffiliateTrackingLink,
  sendAffiliateStripeWithdrawal,
  setDefaultAffiliatePaymentMethod,
  updateAffiliateProfileEffects,
  updatePrivateBetaWaitlistEntry,
  approveAffiliateWithdrawal,
  getAffiliatePublicProfile,
  AFFILIATE_PFP_EFFECTS,
  AFFILIATE_NAME_EFFECTS,
  AFFILIATE_NAME_FONTS,
  AFFILIATE_NAME_COLORS,
} from "../lib/billing/growth";
import { getUserEdgeCreditSnapshot } from "../lib/billing/edge-credits";
import { getPolarClient } from "../lib/billing/polar";
import { ensureActivationMilestone } from "../lib/ops/event-log";
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

function buildPrivateBetaCode() {
  return `BETA${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function isGrowthAdminEmail(email?: string | null) {
  return isPrivateBetaAdminEmail(email);
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

async function getAccessStatus(userId: string, email?: string | null) {
  const required = isPrivateBetaRequired();
  const isAdmin = isGrowthAdminEmail(email);

  const redemptionRows = await db
    .select({
      id: privateBetaRedemption.id,
      redeemedAt: privateBetaRedemption.redeemedAt,
      source: privateBetaRedemption.source,
      code: privateBetaCode.code,
      label: privateBetaCode.label,
    })
    .from(privateBetaRedemption)
    .innerJoin(
      privateBetaCode,
      eq(privateBetaRedemption.codeId, privateBetaCode.id)
    )
    .where(eq(privateBetaRedemption.userId, userId))
    .limit(1);

  const redemption = redemptionRows[0] ?? null;

  return {
    privateBetaRequired: required,
    hasPrivateBetaAccess: required ? Boolean(redemption || isAdmin) : true,
    hasAdminBypass: required ? isAdmin && !redemption : false,
    redemption,
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

async function redeemPrivateBetaCode(input: {
  userId: string;
  email?: string | null;
  code: string;
  source?: string;
}) {
  const normalized = normalizePrivateBetaCode(input.code);
  if (!normalized) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Private beta code is required",
    });
  }

  const access = await getAccessStatus(input.userId, input.email);
  if (access.redemption) {
    return access.redemption;
  }

  const validation = await validatePrivateBetaCodeInput(normalized);
  if (!validation.valid) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: validation.message,
    });
  }

  const reservation = await db
    .update(privateBetaCode)
    .set({
      redeemedCount: sql`${privateBetaCode.redeemedCount} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(privateBetaCode.id, validation.row.id),
        eq(privateBetaCode.isActive, true),
        sql`(${privateBetaCode.expiresAt} IS NULL OR ${privateBetaCode.expiresAt} >= NOW())`,
        sql`(${privateBetaCode.maxRedemptions} IS NULL OR ${privateBetaCode.redeemedCount} < ${privateBetaCode.maxRedemptions})`
      )
    )
    .returning({ id: privateBetaCode.id });

  if (!reservation[0]) {
    const latestAccess = await getAccessStatus(input.userId, input.email);
    if (latestAccess.redemption) {
      return latestAccess.redemption;
    }

    const latestValidation = await validatePrivateBetaCodeInput(normalized);
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: latestValidation.valid
        ? "That private beta code is no longer available"
        : latestValidation.message,
    });
  }

  const inserted = await db
    .insert(privateBetaRedemption)
    .values({
      id: crypto.randomUUID(),
      codeId: validation.row.id,
      userId: input.userId,
      email: input.email ?? null,
      source: input.source ?? "app",
    })
    .onConflictDoNothing({
      target: privateBetaRedemption.userId,
    })
    .returning({ id: privateBetaRedemption.id });

  if (!inserted[0]) {
    await db
      .update(privateBetaCode)
      .set({
        redeemedCount: sql`GREATEST(${privateBetaCode.redeemedCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(privateBetaCode.id, validation.row.id));

    const latestAccess = await getAccessStatus(input.userId, input.email);
    if (latestAccess.redemption) {
      return latestAccess.redemption;
    }

    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Unable to redeem private beta code",
    });
  }

  const redeemedAccess = await getAccessStatus(input.userId, input.email);
  if (redeemedAccess.redemption) {
    return redeemedAccess.redemption;
  }

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Private beta access was redeemed but could not be loaded",
  });
}

async function upsertBillingCustomerFromPolar(input: {
  userId: string;
  polarCustomerId: string;
  polarExternalId: string;
  email?: string | null;
  name?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const existing = await db
    .select()
    .from(billingCustomer)
    .where(eq(billingCustomer.userId, input.userId))
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(billingCustomer)
      .set({
        polarCustomerId: input.polarCustomerId,
        polarExternalId: input.polarExternalId,
        email: input.email ?? null,
        name: input.name ?? null,
        metadata: input.metadata ?? null,
        updatedAt: new Date(),
      })
      .where(eq(billingCustomer.id, existing[0].id))
      .returning();

    return updated;
  }

  const [inserted] = await db
    .insert(billingCustomer)
    .values({
      id: crypto.randomUUID(),
      userId: input.userId,
      polarCustomerId: input.polarCustomerId,
      polarExternalId: input.polarExternalId,
      email: input.email ?? null,
      name: input.name ?? null,
      metadata: input.metadata ?? null,
    })
    .returning();

  return inserted;
}

async function upsertBillingSubscriptionFromPolar(input: {
  userId: string;
  polarSubscriptionId: string;
  polarCustomerId?: string | null;
  polarCheckoutId?: string | null;
  polarProductId?: string | null;
  planKey: BillingPlanKey;
  status: string;
  currency?: string | null;
  amount?: number | null;
  recurringInterval?: string | null;
  recurringIntervalCount?: number | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  trialStart?: Date | null;
  trialEnd?: Date | null;
  startedAt?: Date | null;
  endsAt?: Date | null;
  endedAt?: Date | null;
  canceledAt?: Date | null;
  metadata?: Record<string, unknown>;
}) {
  const existing = await db
    .select()
    .from(billingSubscription)
    .where(
      eq(billingSubscription.polarSubscriptionId, input.polarSubscriptionId)
    )
    .limit(1);

  const values = {
    userId: input.userId,
    polarSubscriptionId: input.polarSubscriptionId,
    polarCustomerId: input.polarCustomerId ?? null,
    polarCheckoutId: input.polarCheckoutId ?? null,
    polarProductId: input.polarProductId ?? null,
    planKey: input.planKey,
    status: input.status,
    currency: input.currency ?? null,
    amount: input.amount ?? null,
    recurringInterval: input.recurringInterval ?? null,
    recurringIntervalCount: input.recurringIntervalCount ?? null,
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
    return updated;
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

async function upsertBillingOrderFromPolar(input: {
  userId: string;
  polarOrderId: string;
  polarCustomerId?: string | null;
  polarSubscriptionId?: string | null;
  polarCheckoutId?: string | null;
  polarProductId?: string | null;
  planKey: BillingPlanKey;
  status: string;
  currency?: string | null;
  subtotalAmount?: number | null;
  discountAmount?: number | null;
  taxAmount?: number | null;
  totalAmount?: number | null;
  paid?: boolean;
  paidAt?: Date | null;
  metadata?: Record<string, unknown>;
}) {
  const existing = await db
    .select()
    .from(billingOrder)
    .where(eq(billingOrder.polarOrderId, input.polarOrderId))
    .limit(1);

  const values = {
    userId: input.userId,
    polarOrderId: input.polarOrderId,
    polarCustomerId: input.polarCustomerId ?? null,
    polarSubscriptionId: input.polarSubscriptionId ?? null,
    polarCheckoutId: input.polarCheckoutId ?? null,
    polarProductId: input.polarProductId ?? null,
    planKey: input.planKey,
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
    return updated;
  }

  const [inserted] = await db
    .insert(billingOrder)
    .values({
      id: crypto.randomUUID(),
      ...values,
    })
    .returning();
  return inserted;
}

async function updateUserPremiumFlag(userId: string) {
  const { activePlanKey, subscription } = await getActiveBillingState(userId);
  const isPremium =
    activePlanKey !== "student" &&
    Boolean(subscription && isActiveSubscriptionStatus(subscription.status));

  await db
    .update(userTable)
    .set({
      isPremium,
      updatedAt: new Date(),
    })
    .where(eq(userTable.id, userId));
}

function assertGrowthAdmin(email?: string | null) {
  if (!isGrowthAdminEmail(email)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
}

const completeGrowthAccessInput = z.object({
  betaCode: z.string().optional(),
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

  if (input.betaCode) {
    await redeemPrivateBetaCode({
      userId: user.id,
      email: user.email,
      code: input.betaCode,
      source: input.source ?? "onboarding",
    });
  }

  const access = await getAccessStatus(user.id, user.email);
  if (access.privateBetaRequired && !access.hasPrivateBetaAccess) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "A valid private beta code is required to continue",
    });
  }

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
      includesBacktest: plan.includesBacktest,
      includesCopier: plan.includesCopier,
      isFree: plan.isFree,
      isConfigured: plan.isFree || Boolean(plan.polarProductId),
    }));

    return {
      privateBetaRequired: isPrivateBetaRequired(),
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

  joinPrivateBetaWaitlist: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        source: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const entry = await joinPrivateBetaWaitlist({
        email: input.email,
        source: input.source ?? "root",
      });

      return {
        id: entry.id,
        email: entry.email,
        status: entry.status,
      };
    }),

  validatePrivateBetaCode: publicProcedure
    .input(
      z.object({
        code: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const validation = await validatePrivateBetaCodeInput(input.code);
      if (!validation.valid) {
        return validation;
      }

      return {
        valid: true,
        code: validation.code,
        label: validation.label,
        remaining: validation.remaining,
      };
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

    return claimPendingGrowthAttribution({
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
        getAccessStatus(user.id, user.email),
        buildReferralState(user.id),
        buildAffiliateState(user.id),
        getActiveBillingState(user.id),
        getOnboardingStatus(user.id),
        getUserEdgeCreditSnapshot(user.id),
      ]);
    const isAdmin = isGrowthAdminEmail(user.email);

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
        polarOrderId: billingOrder.polarOrderId,
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
      planTitle:
        getBillingPlanDefinition(invoice.planKey as BillingPlanKey)?.title ??
        "Student",
    }));
  }),

  applyForAffiliate: protectedProcedure
    .input(
      z.object({
        message: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const application = await applyForAffiliate({
        userId: ctx.session.user.id,
        message: input.message ?? null,
      });

      return {
        application,
      };
    }),

  getAffiliateDashboard: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserRow(ctx.session.user.id);
    const isAdmin = isGrowthAdminEmail(user.email);
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
      assertGrowthAdmin(user.email);

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
      assertGrowthAdmin(user.email);

      return saveAffiliateCommissionSplit({
        affiliateUserId: input.affiliateUserId,
        commissionBps: input.commissionBps,
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
      if (!plan || !plan.polarProductId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "That plan is not configured in Polar",
        });
      }

      const user = await getUserRow(ctx.session.user.id);
      const growthCookieContext = getGrowthCookieContext(ctx);
      await claimPendingGrowthAttribution({
        userId: user.id,
        visitorToken:
          growthCookieContext.visitorToken ??
          growthCookieContext.storedTouch?.visitorToken ??
          null,
        source: "checkout",
      });
      const access = await getAccessStatus(user.id, user.email);
      if (access.privateBetaRequired && !access.hasPrivateBetaAccess) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Redeem a private beta code before starting checkout",
        });
      }

      const referralRewardGrant =
        await getAvailableReferralFreeMonthGrantForPlan(user.id, input.planKey);
      const billing = await getActiveBillingState(user.id);
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
      if (
        affiliateCheckout.offer &&
        (referralRewardGrant?.polarDiscountId || upgradeOfferDiscount?.id)
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Affiliate offer codes cannot be combined with other checkout discounts",
        });
      }
      const checkoutDiscountId =
        affiliateCheckout.offer?.polarDiscountId ??
        referralRewardGrant?.polarDiscountId ??
        upgradeOfferDiscount?.id ??
        null;

      const polar = getPolarClient();
      const returnPath = assertAppRelativePath(input.returnPath);
      // Build successUrl manually so {CHECKOUT_ID} is not URL-encoded by URLSearchParams
      const successBase = buildAppUrl(returnPath, {
        checkout: "success",
        plan: plan.key,
      });
      const successUrl = `${successBase}&checkout_id={CHECKOUT_ID}`;

      const checkout = await polar.checkouts.create({
        products: [plan.polarProductId],
        externalCustomerId: user.id,
        customerEmail: user.email,
        customerName: user.name,
        discountId: checkoutDiscountId,
        allowDiscountCodes: false,
        successUrl,
        returnUrl: buildAppUrl(returnPath),
        metadata: {
          user_id: user.id,
          plan_key: plan.key,
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
        },
        customerMetadata: {
          user_id: user.id,
          ...(affiliateCheckout.attribution?.affiliateCode
            ? { affiliate_code: affiliateCheckout.attribution.affiliateCode }
            : {}),
        },
      });

      return {
        url: checkout.url,
      };
    }),

  createCustomerPortalSession: protectedProcedure
    .input(
      z.object({
        returnPath: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserRow(ctx.session.user.id);
      const billing = await getActiveBillingState(user.id);

      if (!billing.customer && !billing.subscription) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No Polar customer is linked to this account yet",
        });
      }

      const polar = getPolarClient();
      const session = await polar.customerSessions.create({
        externalCustomerId: user.id,
        returnUrl: buildAppUrl(
          input.returnPath ?? "/dashboard/settings/billing"
        ),
      });

      return {
        url: session.customerPortalUrl,
      };
    }),

  syncFromPolar: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await getUserRow(ctx.session.user.id);
    const polar = getPolarClient();

    let polarCustomer = null;

    try {
      polarCustomer = await polar.customers.getExternal({
        externalId: user.id,
      });
    } catch {
      polarCustomer = null;
    }

    if (polarCustomer) {
      await upsertBillingCustomerFromPolar({
        userId: user.id,
        polarCustomerId: polarCustomer.id,
        polarExternalId: user.id,
        email: polarCustomer.email ?? null,
        name: polarCustomer.name ?? null,
      });

      // Fetch subscriptions for this customer
      const subscriptionsPage = await polar.subscriptions.list({
        externalCustomerId: user.id,
        limit: 10,
      });

      for (const sub of subscriptionsPage.result.items) {
        await upsertBillingSubscriptionFromPolar({
          userId: user.id,
          polarSubscriptionId: sub.id,
          polarCustomerId: sub.customerId,
          polarProductId: sub.productId,
          planKey: resolvePlanKeyFromProductId(sub.productId),
          status: sub.status,
          currency: sub.currency ?? null,
          amount: sub.amount ?? null,
          recurringInterval: sub.recurringInterval ?? null,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? false,
          currentPeriodStart: sub.currentPeriodStart
            ? new Date(sub.currentPeriodStart)
            : null,
          currentPeriodEnd: sub.currentPeriodEnd
            ? new Date(sub.currentPeriodEnd)
            : null,
          startedAt: sub.startedAt ? new Date(sub.startedAt) : null,
          endsAt: sub.endsAt ? new Date(sub.endsAt) : null,
          endedAt: sub.endedAt ? new Date(sub.endedAt) : null,
          canceledAt: sub.canceledAt ? new Date(sub.canceledAt) : null,
          metadata:
            (sub.metadata as Record<string, string | number | boolean>) ?? {},
        });

        if (sub.status === "active") {
          await markAffiliateSubscriptionActive({
            referredUserId: user.id,
            subscriptionId: sub.id,
            activatedAt: sub.startedAt ? new Date(sub.startedAt) : new Date(),
          });
        }
      }

      // Fetch orders for this customer
      const ordersPage = await polar.orders.list({
        externalCustomerId: user.id,
        limit: 50,
      });

      for (const order of ordersPage.result.items) {
        const orderMetadata = normalizeBillingMetadata(order.metadata);
        const affiliateOrderMetadata =
          extractAffiliateOrderMetadata(orderMetadata);

        await upsertBillingOrderFromPolar({
          userId: user.id,
          polarOrderId: order.id,
          polarCustomerId: order.customerId,
          polarSubscriptionId: order.subscriptionId ?? null,
          polarProductId: order.productId ?? null,
          planKey: resolvePlanKeyFromProductId(order.productId),
          status: order.status,
          currency: order.currency ?? null,
          subtotalAmount: order.subtotalAmount ?? null,
          discountAmount: order.discountAmount ?? null,
          taxAmount: order.taxAmount ?? null,
          totalAmount: order.totalAmount ?? null,
          paid: order.status === "paid",
          paidAt: order.status === "paid" ? new Date(order.createdAt) : null,
          metadata: orderMetadata ?? {},
        });

        if (order.status === "paid") {
          await markReferralConversionPaid({
            referredUserId: user.id,
            orderId: order.id,
            subscriptionId: order.subscriptionId ?? null,
            paidAt: new Date(order.createdAt),
          });

          await recordAffiliateCommissionEvent({
            referredUserId: user.id,
            polarOrderId: order.id,
            polarSubscriptionId: order.subscriptionId ?? null,
            affiliateAttributionId:
              affiliateOrderMetadata.affiliateAttributionId,
            orderAmount: resolveCommissionableOrderAmount({
              subtotalAmount: order.subtotalAmount,
              discountAmount: order.discountAmount,
              totalAmount: order.totalAmount,
            }),
            currency: order.currency ?? null,
            commissionBps: affiliateOrderMetadata.commissionBps,
            metadata: orderMetadata,
            occurredAt: new Date(order.createdAt),
          });

          if (affiliateOrderMetadata.rewardGrantId) {
            await markReferralRewardGrantConsumed(
              affiliateOrderMetadata.rewardGrantId
            );
          }
        }
      }

      await updateUserPremiumFlag(user.id);
    }

    const billing = await getActiveBillingState(user.id);
    return { activePlanKey: billing.activePlanKey };
  }),

  createPrivateBetaCode: protectedProcedure
    .input(
      z.object({
        label: z.string().min(2),
        description: z.string().optional(),
        code: z.string().optional(),
        maxRedemptions: z.number().int().positive().nullable().optional(),
        expiresAt: z.date().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserRow(ctx.session.user.id);
      assertGrowthAdmin(user.email);

      const code = normalizePrivateBetaCode(
        input.code ?? buildPrivateBetaCode()
      );
      const inserted = await db
        .insert(privateBetaCode)
        .values({
          id: crypto.randomUUID(),
          code,
          label: input.label,
          description: input.description ?? null,
          maxRedemptions: input.maxRedemptions ?? null,
          expiresAt: input.expiresAt ?? null,
          createdByUserId: user.id,
        })
        .returning();

      return inserted[0];
    }),

  listPrivateBetaCodes: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserRow(ctx.session.user.id);
    assertGrowthAdmin(user.email);

    return db
      .select()
      .from(privateBetaCode)
      .orderBy(desc(privateBetaCode.createdAt));
  }),

  listAffiliateApplications: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserRow(ctx.session.user.id);
    assertGrowthAdmin(user.email);

    return listAffiliateApplications();
  }),

  listAffiliatePayoutQueue: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserRow(ctx.session.user.id);
    assertGrowthAdmin(user.email);

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
      assertGrowthAdmin(user.email);

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
      assertGrowthAdmin(user.email);

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
      assertGrowthAdmin(user.email);

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
      assertGrowthAdmin(user.email);

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
      assertGrowthAdmin(user.email);

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
      assertGrowthAdmin(user.email);

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
      assertGrowthAdmin(user.email);

      return rejectAffiliateApplication({
        applicationId: input.applicationId,
        reviewedByUserId: user.id,
        adminNotes: input.adminNotes ?? null,
      });
    }),

  listPrivateBetaWaitlistEntries: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserRow(ctx.session.user.id);
    assertGrowthAdmin(user.email);

    return listPrivateBetaWaitlistEntries();
  }),

  updatePrivateBetaWaitlistEntry: protectedProcedure
    .input(
      z.object({
        entryId: z.string(),
        status: z.string().optional(),
        notes: z.string().optional(),
        invitedCodeId: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserRow(ctx.session.user.id);
      assertGrowthAdmin(user.email);

      return updatePrivateBetaWaitlistEntry({
        entryId: input.entryId,
        reviewedByUserId: user.id,
        status: input.status ?? null,
        notes: input.notes ?? null,
        invitedCodeId: input.invitedCodeId ?? null,
      });
    }),
});

export async function syncPolarWebhookEvent(event: any) {
  const objectId = event?.data?.id ?? null;
  const eventKey = `${event.type}:${objectId ?? "unknown"}:${new Date(
    event.timestamp
  ).toISOString()}`;

  const seen = await db
    .select()
    .from(billingWebhookEvent)
    .where(eq(billingWebhookEvent.eventKey, eventKey))
    .limit(1);

  if (seen[0]) {
    return;
  }

  await db.insert(billingWebhookEvent).values({
    id: crypto.randomUUID(),
    eventKey,
    eventType: event.type,
    objectId,
    payload: event,
  });

  if (event.type.startsWith("customer.")) {
    const externalId = event.data.externalId ?? event.data.external_id ?? null;
    if (!externalId) {
      return;
    }

    await upsertBillingCustomerFromPolar({
      userId: externalId,
      polarCustomerId: event.data.id,
      polarExternalId: externalId,
      email: event.data.email ?? null,
      name: event.data.name ?? null,
      metadata: event.data.metadata ?? {},
    });

    return;
  }

  if (event.type.startsWith("subscription.")) {
    const externalId = event.data.customer?.externalId ?? null;
    const userId =
      externalId ??
      (
        await db
          .select()
          .from(billingCustomer)
          .where(eq(billingCustomer.polarCustomerId, event.data.customerId))
          .limit(1)
      )[0]?.userId;

    if (!userId) {
      return;
    }

    await upsertBillingCustomerFromPolar({
      userId,
      polarCustomerId: event.data.customer.id,
      polarExternalId: event.data.customer.externalId ?? userId,
      email: event.data.customer.email ?? null,
      name: event.data.customer.name ?? null,
      metadata: event.data.customer.metadata ?? {},
    });

    await upsertBillingSubscriptionFromPolar({
      userId,
      polarSubscriptionId: event.data.id,
      polarCustomerId: event.data.customerId,
      polarCheckoutId: event.data.checkoutId,
      polarProductId: event.data.productId,
      planKey: resolvePlanKeyFromProductId(event.data.productId),
      status: event.data.status,
      currency: event.data.currency,
      amount: event.data.amount,
      recurringInterval: event.data.recurringInterval,
      recurringIntervalCount: event.data.recurringIntervalCount,
      cancelAtPeriodEnd: event.data.cancelAtPeriodEnd,
      currentPeriodStart: event.data.currentPeriodStart,
      currentPeriodEnd: event.data.currentPeriodEnd,
      trialStart: event.data.trialStart,
      trialEnd: event.data.trialEnd,
      startedAt: event.data.startedAt,
      endsAt: event.data.endsAt,
      endedAt: event.data.endedAt,
      canceledAt: event.data.canceledAt,
      metadata: event.data.metadata ?? {},
    });

    if (event.type === "subscription.active") {
      await markAffiliateSubscriptionActive({
        referredUserId: userId,
        subscriptionId: event.data.id,
        activatedAt: new Date(event.timestamp),
      });
    }

    await updateUserPremiumFlag(userId);
    return;
  }

  if (event.type.startsWith("order.")) {
    const externalId = event.data.customer?.externalId ?? null;
    const userId =
      externalId ??
      (
        await db
          .select()
          .from(billingCustomer)
          .where(eq(billingCustomer.polarCustomerId, event.data.customerId))
          .limit(1)
      )[0]?.userId;

    if (!userId) {
      return;
    }

    const orderMetadata = normalizeBillingMetadata(event.data.metadata);
    const affiliateOrderMetadata = extractAffiliateOrderMetadata(orderMetadata);

    await upsertBillingCustomerFromPolar({
      userId,
      polarCustomerId: event.data.customer.id,
      polarExternalId: event.data.customer.externalId ?? userId,
      email: event.data.customer.email ?? null,
      name: event.data.customer.name ?? null,
      metadata: event.data.customer.metadata ?? {},
    });

    await upsertBillingOrderFromPolar({
      userId,
      polarOrderId: event.data.id,
      polarCustomerId: event.data.customerId,
      polarSubscriptionId: event.data.subscriptionId,
      polarCheckoutId: event.data.checkoutId,
      polarProductId: event.data.productId,
      planKey: resolvePlanKeyFromProductId(event.data.productId),
      status: event.data.status,
      currency: event.data.currency,
      subtotalAmount: event.data.subtotalAmount,
      discountAmount: event.data.discountAmount,
      taxAmount: event.data.taxAmount,
      totalAmount: event.data.totalAmount,
      paid: event.data.paid,
      paidAt: event.type === "order.paid" ? new Date(event.timestamp) : null,
      metadata: orderMetadata ?? {},
    });

    if (event.type === "order.paid") {
      await markReferralConversionPaid({
        referredUserId: userId,
        orderId: event.data.id,
        subscriptionId: event.data.subscriptionId ?? null,
        paidAt: new Date(event.timestamp),
      });

      await recordAffiliateCommissionEvent({
        referredUserId: userId,
        polarOrderId: event.data.id,
        polarSubscriptionId: event.data.subscriptionId ?? null,
        affiliateAttributionId: affiliateOrderMetadata.affiliateAttributionId,
        orderAmount: resolveCommissionableOrderAmount({
          subtotalAmount: event.data.subtotalAmount,
          discountAmount: event.data.discountAmount,
          totalAmount: event.data.totalAmount,
        }),
        currency: event.data.currency ?? null,
        commissionBps: affiliateOrderMetadata.commissionBps,
        metadata: orderMetadata,
        occurredAt: new Date(event.timestamp),
      });

      if (affiliateOrderMetadata.rewardGrantId) {
        await markReferralRewardGrantConsumed(
          affiliateOrderMetadata.rewardGrantId
        );
      }
    }
  }
}
