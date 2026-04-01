import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";

import { db } from "../../db";
import { user as userTable } from "../../db/schema/auth";
import {
  affiliateApplication,
  affiliateAttribution,
  affiliateCommissionEvent,
  affiliateGroup,
  affiliateGroupMember,
  affiliatePaymentMethod,
  affiliatePayout,
  affiliatePendingAttribution,
  affiliateProviderAccount,
  affiliateProfile,
  affiliateOffer,
  affiliateTouchEvent,
  affiliateTrackingLink,
  affiliateWithdrawalRequest,
  billingCustomer,
  billingEntitlementOverride,
  billingOrder,
  billingSubscription,
  edgeCreditGrant,
  referralConversion,
  referralProfile,
  referralRewardGrant,
  type AffiliateApplicationDetails,
} from "../../db/schema/billing";
import {
  getAffiliateCommissionBps,
  getBillingPlanDefinition,
  getBillingPlanDefinitions,
  getHigherBillingPlanKey,
  getNextBillingPlanKey,
  getWebAppUrl,
  REFERRAL_EDGE_CREDIT_AMOUNT,
  REFERRAL_EDGE_CREDIT_THRESHOLD,
  REFERRAL_FREE_MONTH_THRESHOLD,
  REFERRAL_UPGRADE_TRIAL_DAYS,
  REFERRAL_UPGRADE_TRIAL_THRESHOLD,
  type BillingPlanKey,
} from "./config";
import {
  AFFILIATE_PREMIUM_PLAN_KEY,
  AFFILIATE_PRO_REVENUE_THRESHOLD_CENTS,
  AFFILIATE_TIER_CONFIG,
  AFFILIATE_TIER_EFFECT_VARIANTS,
  AFFILIATE_TIER_KEYS,
  AFFILIATE_TIER_MODES,
  AFFILIATE_TIER_OVERRIDE_ENDS_AT,
  AFFILIATE_TIER_OVERRIDE_SOURCE,
  ACTIVE_SUBSCRIPTION_STATUSES,
  CHECKOUT_ORDER_GRACE_WINDOW_MS,
  GROWTH_TOUCH_COOKIE,
  GROWTH_VISITOR_COOKIE,
  REWARD_TYPE_EDGE_CREDITS,
  REWARD_TYPE_FREE_MONTH,
  REWARD_TYPE_UPGRADE_TRIAL,
  type AffiliateBenefitKey,
  type AffiliateEffectVariant,
  type AffiliateTierKey,
  type AffiliateTierMode,
} from "./growth-config";
import {
  buildAffiliateCode,
  buildAffiliateOfferCode,
  buildAffiliateBenefitFlags,
  buildAffiliatePublicProofMetadata,
  buildAffiliateProgramMetadata,
  buildAffiliateShareUrl,
  buildAffiliateTrackingLinkSlug,
  buildAffiliateTierSnapshot,
  buildAttributionExpiryDate,
  buildGroupName,
  buildReferralCode,
  buildReferralShareUrl,
  collapseWhitespace,
  formatAffiliatePlanLabel,
  getAffiliateAutomaticTierKey,
  getAffiliateMetadataObject,
  isAffiliateEffectVariant,
  isAffiliateTierKey,
  isAffiliateTierMode,
  normalizeDestinationPath,
  normalizeAffiliateTierKey,
  normalizeAffiliateTierMode,
  normalizeGrowthCode,
  normalizeGrowthSlug,
  normalizeVisitorToken,
  parseAffiliateBenefitFlags,
  parseStoredGrowthTouch,
  readGrowthTouchFromCookies,
  readGrowthVisitorTokenFromCookies,
  slugify,
} from "./growth-helpers";
import { clampStripeDisplayString, getStripeClient } from "./stripe";
import {
  createStripeConnectedAccount,
  createStripeLoginLink,
  createStripeOnboardingLink,
  createStripeTransfer,
  deleteStripeConnectedAccount,
  resolveStripeOnboardingStatus,
  retrieveStripeConnectedAccount,
} from "./stripe-connect";

export {
  AFFILIATE_PREMIUM_PLAN_KEY,
  AFFILIATE_PRO_REVENUE_THRESHOLD_CENTS,
  AFFILIATE_TIER_CONFIG,
  AFFILIATE_TIER_EFFECT_VARIANTS,
  AFFILIATE_TIER_KEYS,
  AFFILIATE_TIER_MODES,
  AFFILIATE_TIER_OVERRIDE_ENDS_AT,
  AFFILIATE_TIER_OVERRIDE_SOURCE,
  ACTIVE_SUBSCRIPTION_STATUSES,
  CHECKOUT_ORDER_GRACE_WINDOW_MS,
  GROWTH_TOUCH_COOKIE,
  GROWTH_VISITOR_COOKIE,
  REWARD_TYPE_EDGE_CREDITS,
  REWARD_TYPE_FREE_MONTH,
  REWARD_TYPE_UPGRADE_TRIAL,
} from "./growth-config";

export {
  buildAffiliateBenefitFlags,
  buildAffiliatePublicProofMetadata,
  buildAffiliateProgramMetadata,
  buildAffiliateShareUrl,
  buildAffiliateTierSnapshot,
  buildAttributionExpiryDate,
  buildGroupName,
  buildReferralShareUrl,
  buildAffiliateTrackingLinkSlug,
  buildAffiliateCode,
  buildAffiliateOfferCode,
  buildReferralCode,
  collapseWhitespace,
  formatAffiliatePlanLabel,
  getAffiliateAutomaticTierKey,
  getAffiliateMetadataObject,
  isAffiliateEffectVariant,
  isAffiliateTierKey,
  isAffiliateTierMode,
  normalizeAffiliateTierKey,
  normalizeAffiliateTierMode,
  normalizeDestinationPath,
  normalizeGrowthCode,
  normalizeGrowthSlug,
  normalizeVisitorToken,
  parseAffiliateBenefitFlags,
  parseStoredGrowthTouch,
  readGrowthTouchFromCookies,
  readGrowthVisitorTokenFromCookies,
  slugify,
} from "./growth-helpers";

type MinimalUser = {
  id: string;
  name: string;
  email: string;
};

type GrowthTouchType = "affiliate" | "referral";

type StoredGrowthTouch = {
  type: GrowthTouchType;
  code: string;
  offerCode?: string;
  trackingLinkSlug?: string;
  affiliateGroupSlug?: string;
  landingPath?: string;
  query?: string;
  visitorToken: string;
  capturedAtISO: string;
};

type AffiliateTouchContext = {
  profile: typeof affiliateProfile.$inferSelect;
  offer: typeof affiliateOffer.$inferSelect | null;
  trackingLink: typeof affiliateTrackingLink.$inferSelect | null;
};

type PendingAttributionRow = typeof affiliatePendingAttribution.$inferSelect;

async function getUsername(userId: string) {
  const [row] = await db
    .select({ username: userTable.username })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  return row?.username ?? null;
}

function isPendingAttributionActive(
  pending: PendingAttributionRow,
  now = new Date()
) {
  return (
    pending.status === "pending" && pending.expiresAt.getTime() > now.getTime()
  );
}

function isActiveSubscriptionStatus(status?: string | null) {
  return status === "active" || status === "trialing";
}

async function getMinimalUser(userId: string): Promise<MinimalUser> {
  const rows = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (!rows[0]) {
    throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  }

  return rows[0];
}

export async function getEffectiveBillingState(userId: string) {
  const subscriptions = await db
    .select()
    .from(billingSubscription)
    .where(eq(billingSubscription.userId, userId))
    .orderBy(
      desc(billingSubscription.currentPeriodEnd),
      desc(billingSubscription.updatedAt)
    );

  const [customer] = await db
    .select()
    .from(billingCustomer)
    .where(eq(billingCustomer.userId, userId))
    .limit(1);

  const paidOrders = await db
    .select()
    .from(billingOrder)
    .where(and(eq(billingOrder.userId, userId), eq(billingOrder.paid, true)))
    .orderBy(
      desc(billingOrder.paidAt),
      desc(billingOrder.updatedAt),
      desc(billingOrder.createdAt)
    )
    .limit(10);

  const now = new Date();
  const [override] = await db
    .select()
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

  const activeSubscriptions = subscriptions.filter((subscription) =>
    isActiveSubscriptionStatus(subscription.status)
  );

  const subscription =
    activeSubscriptions.sort((left, right) => {
      const leftPlanKey = left.planKey as BillingPlanKey;
      const rightPlanKey = right.planKey as BillingPlanKey;
      const rightPrice =
        getBillingPlanDefinition(rightPlanKey)?.monthlyPriceCents ?? 0;
      const leftPrice =
        getBillingPlanDefinition(leftPlanKey)?.monthlyPriceCents ?? 0;

      if (rightPrice !== leftPrice) {
        return rightPrice - leftPrice;
      }

      const rightPeriodEnd = right.currentPeriodEnd?.getTime() ?? 0;
      const leftPeriodEnd = left.currentPeriodEnd?.getTime() ?? 0;
      if (rightPeriodEnd !== leftPeriodEnd) {
        return rightPeriodEnd - leftPeriodEnd;
      }

      return right.updatedAt.getTime() - left.updatedAt.getTime();
    })[0] ??
    subscriptions[0] ??
    null;

  const subscriptionPlanKey = activeSubscriptions.reduce<BillingPlanKey>(
    (highestPlanKey, currentSubscription) => {
      const currentPlanKey = currentSubscription.planKey as BillingPlanKey;
      return getBillingPlanDefinition(currentPlanKey)
        ? getHigherBillingPlanKey(highestPlanKey, currentPlanKey)
        : highestPlanKey;
    },
    "student"
  );

  const recentPaidOrderPlanKey = paidOrders.reduce<BillingPlanKey>(
    (highestPlanKey, currentOrder) => {
      const currentPlanKey = currentOrder.planKey as BillingPlanKey;
      const planDefinition = getBillingPlanDefinition(currentPlanKey);
      if (!planDefinition) {
        return highestPlanKey;
      }

      const paidAt = currentOrder.paidAt ?? currentOrder.createdAt;
      if (now.getTime() - paidAt.getTime() > CHECKOUT_ORDER_GRACE_WINDOW_MS) {
        return highestPlanKey;
      }

      return getHigherBillingPlanKey(highestPlanKey, currentPlanKey);
    },
    "student"
  );

  const activePlanKey =
    override?.planKey &&
    getBillingPlanDefinition(override.planKey as BillingPlanKey)
      ? getHigherBillingPlanKey(
          getHigherBillingPlanKey(subscriptionPlanKey, recentPaidOrderPlanKey),
          override.planKey as BillingPlanKey
        )
      : getHigherBillingPlanKey(subscriptionPlanKey, recentPaidOrderPlanKey);

  return {
    subscription: subscription ?? null,
    customer: customer ?? null,
    override: override ?? null,
    activePlanKey,
  };
}

export async function syncUserPremiumFlag(userId: string) {
  const { activePlanKey, subscription, override } = await getEffectiveBillingState(userId);
  const isPremium =
    activePlanKey !== "student" &&
    Boolean(
      (subscription && isActiveSubscriptionStatus(subscription.status)) || override
    );

  await db
    .update(userTable)
    .set({
      isPremium,
      updatedAt: new Date(),
    })
    .where(eq(userTable.id, userId));
}

async function getAffiliateReferredRevenueAmount(affiliateUserId: string) {
  const [row] = await db
    .select({
      amount:
        sql<number>`coalesce(sum(${affiliateCommissionEvent.orderAmount}), 0)::int`,
    })
    .from(affiliateCommissionEvent)
    .where(eq(affiliateCommissionEvent.affiliateUserId, affiliateUserId));

  return row?.amount ?? 0;
}

async function getAffiliatePremiumOverrideRow(userId: string) {
  const now = new Date();
  const [override] = await db
    .select()
    .from(billingEntitlementOverride)
    .where(
      and(
        eq(billingEntitlementOverride.userId, userId),
        eq(billingEntitlementOverride.sourceType, AFFILIATE_TIER_OVERRIDE_SOURCE),
        lte(billingEntitlementOverride.startsAt, now),
        gte(billingEntitlementOverride.endsAt, now)
      )
    )
    .orderBy(desc(billingEntitlementOverride.endsAt))
    .limit(1);

  return override ?? null;
}

async function syncAffiliatePremiumAccess(input: {
  userId: string;
  shouldGrant: boolean;
}) {
  const rows = await db
    .select()
    .from(billingEntitlementOverride)
    .where(
      and(
        eq(billingEntitlementOverride.userId, input.userId),
        eq(billingEntitlementOverride.sourceType, AFFILIATE_TIER_OVERRIDE_SOURCE)
      )
    )
    .orderBy(desc(billingEntitlementOverride.endsAt), desc(billingEntitlementOverride.createdAt));

  const now = new Date();

  if (!input.shouldGrant) {
    for (const row of rows) {
      if (row.endsAt.getTime() > now.getTime()) {
        await db
          .update(billingEntitlementOverride)
          .set({
            endsAt: now,
            updatedAt: now,
          })
          .where(eq(billingEntitlementOverride.id, row.id));
      }
    }
    await syncUserPremiumFlag(input.userId);
    return null;
  }

  const [primary, ...duplicates] = rows;
  for (const duplicate of duplicates) {
    if (duplicate.endsAt.getTime() > now.getTime()) {
      await db
        .update(billingEntitlementOverride)
        .set({
          endsAt: now,
          updatedAt: now,
        })
        .where(eq(billingEntitlementOverride.id, duplicate.id));
    }
  }

  if (primary) {
    await db
      .update(billingEntitlementOverride)
      .set({
        planKey: AFFILIATE_PREMIUM_PLAN_KEY,
        startsAt:
          primary.startsAt.getTime() <= now.getTime() ? primary.startsAt : now,
        endsAt: AFFILIATE_TIER_OVERRIDE_ENDS_AT,
        updatedAt: now,
      })
      .where(eq(billingEntitlementOverride.id, primary.id));
  } else {
    await db.insert(billingEntitlementOverride).values({
      id: crypto.randomUUID(),
      userId: input.userId,
      sourceType: AFFILIATE_TIER_OVERRIDE_SOURCE,
      sourceRewardGrantId: null,
      planKey: AFFILIATE_PREMIUM_PLAN_KEY,
      startsAt: now,
      endsAt: AFFILIATE_TIER_OVERRIDE_ENDS_AT,
    });
  }

  await syncUserPremiumFlag(input.userId);
  return getAffiliatePremiumOverrideRow(input.userId);
}

async function getReferralProfileRow(userId: string) {
  const rows = await db
    .select()
    .from(referralProfile)
    .where(eq(referralProfile.userId, userId))
    .limit(1);

  return rows[0] ?? null;
}

export async function ensureReferralProfile(userId: string) {
  const existing = await getReferralProfileRow(userId);
  if (existing) {
    return existing;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = buildReferralCode();
    try {
      const inserted = await db
        .insert(referralProfile)
        .values({
          id: crypto.randomUUID(),
          userId,
          code,
        })
        .returning();

      if (inserted[0]) {
        return inserted[0];
      }
    } catch {
      // Retry on code collisions.
    }
  }

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Unable to generate referral profile",
  });
}

async function getAffiliateProfileRow(userId: string) {
  const rows = await db
    .select()
    .from(affiliateProfile)
    .where(eq(affiliateProfile.userId, userId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getApprovedAffiliateProfile(userId: string) {
  const row = await getAffiliateProfileRow(userId);
  if (!row || !row.isActive || !row.approvedAt) {
    return null;
  }
  return row;
}

export async function getAffiliateCommissionBpsForUser(affiliateUserId: string) {
  const profile = await getAffiliateProfileRow(affiliateUserId);
  return profile?.commissionBps ?? getAffiliateCommissionBps();
}

async function getReferralProfileByCode(code: string) {
  const normalized = normalizeGrowthCode(code);
  if (!normalized) {
    return null;
  }

  const [profile] = await db
    .select()
    .from(referralProfile)
    .where(
      and(eq(referralProfile.code, normalized), eq(referralProfile.isActive, true))
    )
    .limit(1);

  return profile ?? null;
}

async function getApprovedAffiliateProfileByCode(code: string) {
  const normalized = normalizeGrowthCode(code);

  // Try exact code match first
  if (normalized) {
    const [profile] = await db
      .select()
      .from(affiliateProfile)
      .where(and(eq(affiliateProfile.code, normalized), eq(affiliateProfile.isActive, true)))
      .limit(1);

    if (profile?.approvedAt) {
      return profile;
    }
  }

  // Fallback: resolve by username
  const username = code.trim().toLowerCase();
  if (!username) {
    return null;
  }

  const [profile] = await db
    .select({ profile: affiliateProfile })
    .from(affiliateProfile)
    .innerJoin(userTable, eq(userTable.id, affiliateProfile.userId))
    .where(
      and(
        sql`lower(${userTable.username}) = ${username}`,
        eq(affiliateProfile.isActive, true)
      )
    )
    .limit(1);

  if (!profile?.profile?.approvedAt) {
    return null;
  }

  return profile.profile;
}

export async function getAffiliatePublicProfile(code: string) {
  const resolvedProfile = await getApprovedAffiliateProfileByCode(code);
  const resolvedOffer =
    resolvedProfile ? null : await getAffiliateOfferByCode(code);
  const profile =
    resolvedProfile ??
    (resolvedOffer
      ? await getApprovedAffiliateProfile(resolvedOffer.affiliateUserId)
      : null);
  if (!profile) {
    return null;
  }

  const offers = await getAffiliateOfferRows(profile.userId);
  const defaultOffer =
    resolvedOffer ??
    offers.find((row) => row.isDefault) ??
    offers[0] ??
    null;

  const [row] = await db
    .select({
      name: userTable.name,
      username: userTable.username,
      image: userTable.image,
    })
    .from(userTable)
    .where(eq(userTable.id, profile.userId))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    name: profile.displayName || row.name,
    username: row.username,
    image: row.image,
    defaultOfferCode: defaultOffer?.code ?? null,
  };
}

async function getAffiliateOfferRows(userId: string) {
  return db
    .select()
    .from(affiliateOffer)
    .where(
      and(eq(affiliateOffer.affiliateUserId, userId), eq(affiliateOffer.isActive, true))
    )
    .orderBy(desc(affiliateOffer.isDefault), desc(affiliateOffer.createdAt));
}

export async function getAffiliateOfferByCode(code: string) {
  const normalized = normalizeGrowthCode(code);
  if (!normalized) {
    return null;
  }

  const [offer] = await db
    .select()
    .from(affiliateOffer)
    .where(and(eq(affiliateOffer.code, normalized), eq(affiliateOffer.isActive, true)))
    .limit(1);

  return offer ?? null;
}

async function getAffiliateOfferById(offerId?: string | null) {
  if (!offerId) {
    return null;
  }

  const [offer] = await db
    .select()
    .from(affiliateOffer)
    .where(and(eq(affiliateOffer.id, offerId), eq(affiliateOffer.isActive, true)))
    .limit(1);

  return offer ?? null;
}

async function getAffiliateTrackingLinkRows(userId: string) {
  return db
    .select()
    .from(affiliateTrackingLink)
    .where(
      and(
        eq(affiliateTrackingLink.affiliateUserId, userId),
        eq(affiliateTrackingLink.isActive, true)
      )
    )
    .orderBy(desc(affiliateTrackingLink.isDefault), desc(affiliateTrackingLink.createdAt));
}

async function ensureAffiliateDefaultOfferForTier(input: {
  profile: typeof affiliateProfile.$inferSelect;
  desiredDiscountBasisPoints: number;
  forceDiscount: boolean;
}) {
  const createdByUserId =
    input.profile.tierAssignedByUserId ??
    input.profile.approvedByUserId ??
    input.profile.userId;
  const offers = await getAffiliateOfferRows(input.profile.userId);
  let defaultOffer = offers.find((row) => row.isDefault) ?? offers[0] ?? null;

  if (!defaultOffer) {
    defaultOffer = await ensureAffiliateOfferRow(input.profile, createdByUserId);
  }

  if (
    !defaultOffer ||
    (!input.forceDiscount &&
      defaultOffer.discountBasisPoints === input.desiredDiscountBasisPoints)
  ) {
    return defaultOffer;
  }

  return saveAffiliateOffer({
    affiliateUserId: input.profile.userId,
    createdByUserId,
    affiliateOfferId: defaultOffer.id,
    code: defaultOffer.code,
    label: defaultOffer.label,
    description: defaultOffer.description ?? null,
    discountBasisPoints: input.desiredDiscountBasisPoints,
    isDefault: true,
  });
}

async function syncAffiliateTierState(affiliateUserId: string) {
  const profile = await getApprovedAffiliateProfile(affiliateUserId);
  if (!profile) {
    await syncAffiliatePremiumAccess({
      userId: affiliateUserId,
      shouldGrant: false,
    });
    return null;
  }

  const referredRevenueAmount = await getAffiliateReferredRevenueAmount(
    affiliateUserId
  );
  const metadata = getAffiliateMetadataObject(
    (profile.metadata as Record<string, unknown> | null | undefined) ?? null
  );
  const currentProgram =
    metadata.program && typeof metadata.program === "object"
      ? (metadata.program as Record<string, unknown>)
      : null;
  const tierMode = normalizeAffiliateTierMode(profile.tierMode);
  const tierKey =
    tierMode === "manual"
      ? "elite"
      : getAffiliateAutomaticTierKey(referredRevenueAmount);
  const tierDefaults = AFFILIATE_TIER_CONFIG[tierKey];
  const defaultOffer = await ensureAffiliateDefaultOfferForTier({
    profile,
    desiredDiscountBasisPoints:
      tierMode === "manual"
        ? normalizeAffiliateTierKey(profile.tierKey) === "elite"
          ? (currentProgram && typeof currentProgram.discountBasisPoints === "number"
              ? Math.round(currentProgram.discountBasisPoints)
              : tierDefaults.defaultDiscountBasisPoints)
          : tierDefaults.defaultDiscountBasisPoints
        : tierDefaults.defaultDiscountBasisPoints,
    forceDiscount: tierMode !== "manual",
  });

  const manualBenefitFlags =
    tierMode === "manual"
      ? parseAffiliateBenefitFlags(currentProgram, "elite")
      : null;
  const currentPublicProof = buildAffiliatePublicProofMetadata(metadata);
  const nextPublicProof =
    tierMode === "manual"
      ? {
          badgeLabel:
            typeof currentPublicProof.badgeLabel === "string" &&
            currentPublicProof.badgeLabel.trim()
              ? currentPublicProof.badgeLabel.trim()
              : tierDefaults.publicProof.badgeLabel,
          effectVariant: isAffiliateEffectVariant(currentPublicProof.effectVariant)
            ? currentPublicProof.effectVariant
            : tierDefaults.publicProof.effectVariant,
        }
      : {
          badgeLabel: tierDefaults.publicProof.badgeLabel,
          effectVariant: tierDefaults.publicProof.effectVariant,
        };
  const nextProgram = buildAffiliateProgramMetadata({
    tierKey,
    tierMode,
    referredRevenueAmount,
    commissionBps:
      tierMode === "manual"
        ? profile.commissionBps
        : tierDefaults.defaultCommissionBps,
    discountBasisPoints:
      defaultOffer?.discountBasisPoints ?? tierDefaults.defaultDiscountBasisPoints,
    benefits: manualBenefitFlags,
  });

  const nextMetadata =
    tierMode === "manual"
      ? {
          ...metadata,
          publicProof: {
            ...(metadata.publicProof && typeof metadata.publicProof === "object"
              ? (metadata.publicProof as Record<string, unknown>)
              : {}),
            badgeLabel: nextPublicProof.badgeLabel,
            effectVariant: nextPublicProof.effectVariant,
          },
          program: nextProgram,
        }
      : {
          ...metadata,
          publicProof: {
            badgeLabel: nextPublicProof.badgeLabel,
            effectVariant: nextPublicProof.effectVariant,
          },
          program: nextProgram,
        };

  const shouldUpdateProfile =
    profile.commissionBps !==
      (tierMode === "manual"
        ? profile.commissionBps
        : tierDefaults.defaultCommissionBps) ||
    normalizeAffiliateTierKey(profile.tierKey) !== tierKey ||
    normalizeAffiliateTierMode(profile.tierMode) !== tierMode ||
    !profile.tierAssignedAt ||
    JSON.stringify(metadata) !== JSON.stringify(nextMetadata);

  let resolvedProfile = profile;
  if (shouldUpdateProfile) {
    const [updated] = await db
      .update(affiliateProfile)
      .set({
        commissionBps:
          tierMode === "manual"
            ? profile.commissionBps
            : tierDefaults.defaultCommissionBps,
        tierKey,
        tierMode,
        tierAssignedAt:
          normalizeAffiliateTierKey(profile.tierKey) !== tierKey ||
          normalizeAffiliateTierMode(profile.tierMode) !== tierMode
            ? new Date()
            : profile.tierAssignedAt ?? new Date(),
        tierAssignedByUserId:
          tierMode === "manual"
            ? profile.tierAssignedByUserId ?? profile.approvedByUserId
            : null,
        metadata: nextMetadata,
        updatedAt: new Date(),
      })
      .where(eq(affiliateProfile.id, profile.id))
      .returning();

    if (updated) {
      resolvedProfile = updated;
    }
  }

  const premiumOverride = await syncAffiliatePremiumAccess({
    userId: affiliateUserId,
    shouldGrant: true,
  });

  return {
    profile: resolvedProfile,
    defaultOffer:
      defaultOffer ??
      (await ensureAffiliateDefaultOfferForTier({
        profile: resolvedProfile,
        desiredDiscountBasisPoints: tierDefaults.defaultDiscountBasisPoints,
        forceDiscount: false,
      })),
    premiumOverride,
    tier: buildAffiliateTierSnapshot({
      profile: resolvedProfile,
      referredRevenueAmount,
      discountBasisPoints:
        defaultOffer?.discountBasisPoints ?? tierDefaults.defaultDiscountBasisPoints,
    }),
  };
}

async function getAffiliateTrackingLinkById(trackingLinkId?: string | null) {
  if (!trackingLinkId) {
    return null;
  }

  const [trackingLink] = await db
    .select()
    .from(affiliateTrackingLink)
    .where(
      and(
        eq(affiliateTrackingLink.id, trackingLinkId),
        eq(affiliateTrackingLink.isActive, true)
      )
    )
    .limit(1);

  return trackingLink ?? null;
}

async function getAffiliateTrackingLinkBySlug(input: {
  affiliateProfileId: string;
  slug?: string | null;
}) {
  const normalizedSlug = normalizeGrowthSlug(input.slug);
  if (!normalizedSlug) {
    return null;
  }

  const [trackingLink] = await db
    .select()
    .from(affiliateTrackingLink)
    .where(
      and(
        eq(affiliateTrackingLink.affiliateProfileId, input.affiliateProfileId),
        eq(affiliateTrackingLink.slug, normalizedSlug),
        eq(affiliateTrackingLink.isActive, true)
      )
    )
    .limit(1);

  return trackingLink ?? null;
}

async function getAffiliateGroupBySlug(input: {
  affiliateProfileId: string;
  slug?: string | null;
}) {
  const normalizedSlug = normalizeGrowthSlug(input.slug);
  if (!normalizedSlug) {
    return null;
  }

  const [group] = await db
    .select()
    .from(affiliateGroup)
    .where(
      and(
        eq(affiliateGroup.affiliateProfileId, input.affiliateProfileId),
        eq(affiliateGroup.slug, normalizedSlug),
        eq(affiliateGroup.isActive, true)
      )
    )
    .limit(1);

  return group ?? null;
}

async function getAffiliatePaymentMethods(userId: string) {
  return db
    .select()
    .from(affiliatePaymentMethod)
    .where(
      and(
        eq(affiliatePaymentMethod.affiliateUserId, userId),
        eq(affiliatePaymentMethod.isActive, true)
      )
    )
    .orderBy(
      desc(affiliatePaymentMethod.isDefault),
      desc(affiliatePaymentMethod.createdAt)
    );
}

async function getAffiliatePayoutRows(userId: string) {
  return db
    .select({
      payout: affiliatePayout,
      paymentMethod: affiliatePaymentMethod,
      providerAccount: affiliateProviderAccount,
      withdrawalRequest: affiliateWithdrawalRequest,
    })
    .from(affiliatePayout)
    .leftJoin(
      affiliatePaymentMethod,
      eq(affiliatePayout.paymentMethodId, affiliatePaymentMethod.id)
    )
    .leftJoin(
      affiliateProviderAccount,
      eq(affiliatePayout.providerAccountId, affiliateProviderAccount.id)
    )
    .leftJoin(
      affiliateWithdrawalRequest,
      eq(affiliatePayout.withdrawalRequestId, affiliateWithdrawalRequest.id)
    )
    .where(eq(affiliatePayout.affiliateUserId, userId))
    .orderBy(desc(affiliatePayout.paidAt), desc(affiliatePayout.createdAt));
}

async function getAffiliateProviderAccountRow(userId: string) {
  const [account] = await db
    .select()
    .from(affiliateProviderAccount)
    .where(
      and(
        eq(affiliateProviderAccount.affiliateUserId, userId),
        eq(affiliateProviderAccount.provider, "stripe_connect")
      )
    )
    .limit(1);

  return account ?? null;
}

async function getAffiliateWithdrawalRequestRows(userId: string) {
  return db
    .select({
      request: affiliateWithdrawalRequest,
      providerAccount: affiliateProviderAccount,
      paymentMethod: affiliatePaymentMethod,
    })
    .from(affiliateWithdrawalRequest)
    .leftJoin(
      affiliateProviderAccount,
      eq(affiliateWithdrawalRequest.providerAccountId, affiliateProviderAccount.id)
    )
    .leftJoin(
      affiliatePaymentMethod,
      eq(affiliateWithdrawalRequest.paymentMethodId, affiliatePaymentMethod.id)
    )
    .where(eq(affiliateWithdrawalRequest.affiliateUserId, userId))
    .orderBy(
      desc(affiliateWithdrawalRequest.requestedAt),
      desc(affiliateWithdrawalRequest.createdAt)
    );
}

async function getUnpaidAffiliateCommissionEvents(userId: string) {
  return db
    .select()
    .from(affiliateCommissionEvent)
    .where(
      and(
        eq(affiliateCommissionEvent.affiliateUserId, userId),
        isNull(affiliateCommissionEvent.affiliatePayoutId)
      )
    )
    .orderBy(desc(affiliateCommissionEvent.occurredAt), desc(affiliateCommissionEvent.createdAt));
}

function buildAffiliatePayoutSummary(input: {
  unpaidEvents: Array<{ commissionAmount: number | null }>;
  payouts: Array<{ payout: { amount: number | null } }>;
}) {
  return {
    availableAmount: input.unpaidEvents.reduce(
      (sum, row) => sum + (row.commissionAmount ?? 0),
      0
    ),
    availableEventCount: input.unpaidEvents.length,
    paidAmount: input.payouts.reduce(
      (sum, row) => sum + (row.payout.amount ?? 0),
      0
    ),
    payoutCount: input.payouts.length,
  };
}

function buildStripeConnectStatusLabel(
  account: typeof affiliateProviderAccount.$inferSelect | null
) {
  if (!account) {
    return "Not connected";
  }

  switch (account.onboardingStatus) {
    case "enabled":
      return "Connected";
    case "pending_review":
      return "Pending review";
    case "disconnected":
      return "Disconnected";
    default:
      return "Needs onboarding";
  }
}

function buildWithdrawalDestinationLabel(input: {
  destinationType?: string | null;
  paymentMethod?: {
    label?: string | null;
    methodType?: string | null;
  } | null;
  providerAccount?: {
    provider?: string | null;
  } | null;
}) {
  if (input.destinationType === "stripe_connect") {
    return "Stripe Connect";
  }

  if (input.paymentMethod?.label) {
    return input.paymentMethod.methodType
      ? `${input.paymentMethod.label} · ${input.paymentMethod.methodType.replace(/_/g, " ")}`
      : input.paymentMethod.label;
  }

  if (input.providerAccount?.provider === "stripe_connect") {
    return "Stripe Connect";
  }

  return "Manual fallback";
}

async function getPendingAttributionRow(visitorToken: string) {
  const [pending] = await db
    .select()
    .from(affiliatePendingAttribution)
    .where(eq(affiliatePendingAttribution.visitorToken, visitorToken))
    .limit(1);

  return pending ?? null;
}

async function resolveAffiliateTouchContext(
  input: {
    affiliateCode?: string | null;
    offerCode?: string | null;
    trackingLinkSlug?: string | null;
    affiliateTrackingLinkId?: string | null;
    affiliateGroupSlug?: string | null;
    affiliateOfferId?: string | null;
  },
  options?: {
    strict?: boolean;
  }
): Promise<AffiliateTouchContext | null> {
  const strict = options?.strict ?? false;
  const rawAffiliateCode = input.affiliateCode?.trim() ?? "";
  const normalizedOfferCode = normalizeGrowthCode(input.offerCode ?? "");

  const offer =
    (input.affiliateOfferId
      ? await getAffiliateOfferById(input.affiliateOfferId)
      : null) ??
    (normalizedOfferCode ? await getAffiliateOfferByCode(normalizedOfferCode) : null);

  let profile =
    rawAffiliateCode
      ? await getApprovedAffiliateProfileByCode(rawAffiliateCode)
      : null;

  if (offer) {
    const offerProfile = await getApprovedAffiliateProfile(offer.affiliateUserId);
    if (!offerProfile) {
      if (strict) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That affiliate offer is no longer active",
        });
      }

      return null;
    }

    if (profile && profile.id !== offerProfile.id) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Affiliate code and offer code do not belong to the same affiliate",
      });
    }

    profile = offerProfile;
  }

  if (!profile) {
    if (strict) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid affiliate code",
      });
    }

    return null;
  }

  const trackingLink =
    (input.affiliateTrackingLinkId
      ? await getAffiliateTrackingLinkById(input.affiliateTrackingLinkId)
      : null) ??
    (await getAffiliateTrackingLinkBySlug({
      affiliateProfileId: profile.id,
      slug: input.trackingLinkSlug,
    }));

  if (
    strict &&
    input.trackingLinkSlug &&
    normalizeGrowthSlug(input.trackingLinkSlug) &&
    !trackingLink
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That affiliate tracking link is not available",
    });
  }

  return {
    profile,
    offer,
    trackingLink,
  };
}

async function upsertAffiliateProviderAccountFromStripe(input: {
  affiliateUserId: string;
  account: Awaited<ReturnType<typeof retrieveStripeConnectedAccount>>;
}) {
  const existing = await getAffiliateProviderAccountRow(input.affiliateUserId);
  const payload = {
    provider: "stripe_connect" as const,
    providerAccountId: input.account.id,
    country: input.account.country ?? null,
    currency: input.account.default_currency?.toUpperCase() ?? null,
    email: input.account.email ?? null,
    onboardingStatus: resolveStripeOnboardingStatus(input.account),
    detailsSubmitted: Boolean(input.account.details_submitted),
    chargesEnabled: Boolean(input.account.charges_enabled),
    payoutsEnabled: Boolean(input.account.payouts_enabled),
    isActive: true,
    disconnectedAt: null,
    lastSyncedAt: new Date(),
    metadata: input.account,
    updatedAt: new Date(),
  };

  if (existing) {
    const [updated] = await db
      .update(affiliateProviderAccount)
      .set(payload)
      .where(eq(affiliateProviderAccount.id, existing.id))
      .returning();

    return updated ?? existing;
  }

  const [inserted] = await db
    .insert(affiliateProviderAccount)
    .values({
      id: crypto.randomUUID(),
      affiliateUserId: input.affiliateUserId,
      ...payload,
    })
    .returning();

  return inserted ?? null;
}

function isReconnectableStripeAccountError(error: unknown) {
  if (!(error instanceof TRPCError) || error.code !== "BAD_REQUEST") {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("does not have access to account") ||
    message.includes("account does not exist") ||
    message.includes("application access may have been revoked") ||
    message.includes("no such account")
  );
}

async function getOrCreateAffiliateStripeConnectedAccount(input: {
  affiliateUserId: string;
  email?: string | null;
}) {
  const existingAccount = await getAffiliateProviderAccountRow(input.affiliateUserId);
  if (existingAccount?.providerAccountId) {
    try {
      return await retrieveStripeConnectedAccount(existingAccount.providerAccountId);
    } catch (error) {
      if (!isReconnectableStripeAccountError(error)) {
        throw error;
      }
    }
  }

  return createStripeConnectedAccount({
    affiliateUserId: input.affiliateUserId,
    email: input.email,
  });
}

function getIgnoredGrowthClaimReason(error: unknown) {
  if (!(error instanceof TRPCError) || error.code !== "BAD_REQUEST") {
    return null;
  }

  if (error.message === "You cannot use your own affiliate link") {
    return "self_affiliate";
  }

  if (error.message === "You cannot refer yourself") {
    return "self_referral";
  }

  return null;
}

async function ensureAffiliateOfferRow(
  profile: typeof affiliateProfile.$inferSelect,
  createdByUserId?: string | null
) {
  const existingRows = await getAffiliateOfferRows(profile.userId);
  if (existingRows[0]) {
    return existingRows[0];
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code =
      attempt === 0
        ? buildAffiliateOfferCode(profile.code)
        : buildAffiliateOfferCode(`${profile.code}${attempt + 1}`);

    try {
      const [inserted] = await db
        .insert(affiliateOffer)
        .values({
          id: crypto.randomUUID(),
          affiliateProfileId: profile.id,
          affiliateUserId: profile.userId,
          code,
          label: `${profile.displayName || "Affiliate"} offer`,
          description: "Default affiliate checkout offer.",
          discountType: "percentage",
          discountBasisPoints: 1000,
          isDefault: true,
          createdByUserId: createdByUserId ?? profile.approvedByUserId ?? null,
        })
        .returning();

      if (inserted) {
        return inserted;
      }
    } catch {
      // Retry on code collisions.
    }
  }

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Unable to create affiliate offer",
  });
}

async function ensureAffiliateTrackingLinkRow(input: {
  profile: typeof affiliateProfile.$inferSelect;
  group: typeof affiliateGroup.$inferSelect | null;
  offer: typeof affiliateOffer.$inferSelect | null;
}) {
  const existingRows = await getAffiliateTrackingLinkRows(input.profile.userId);
  if (existingRows[0]) {
    return existingRows[0];
  }

  const baseSlug = buildAffiliateTrackingLinkSlug("main");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    try {
      const [inserted] = await db
        .insert(affiliateTrackingLink)
        .values({
          id: crypto.randomUUID(),
          affiliateProfileId: input.profile.id,
          affiliateUserId: input.profile.userId,
          affiliateOfferId: input.offer?.id ?? null,
          name: "Default share link",
          slug,
          destinationPath: "/sign-up",
          affiliateGroupSlug: input.group?.slug ?? null,
          utmSource: "affiliate",
          utmMedium: "share",
          utmCampaign: input.profile.code.toLowerCase(),
          isDefault: true,
        })
        .returning();

      if (inserted) {
        return inserted;
      }
    } catch {
      // Retry on slug collisions.
    }
  }

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Unable to create affiliate share link",
  });
}

async function createStripeAffiliateOfferCoupon(input: {
  code: string;
  label: string;
  basisPoints: number;
}) {
  const stripe = getStripeClient();
  return stripe.coupons.create({
    duration: "once",
    percent_off: input.basisPoints / 100,
    name: clampStripeDisplayString(input.label || input.code),
    metadata: {
      affiliate_offer_code: input.code,
      billing_provider: "stripe",
    },
  });
}

async function ensureAffiliateProfileApproved(
  user: MinimalUser,
  approvedByUserId: string
) {
  const existing = await getAffiliateProfileRow(user.id);
  const referral = await ensureReferralProfile(user.id);
  const partnerDefaults = AFFILIATE_TIER_CONFIG.partner;
  const publicProofDefaults = {
    publicProof: partnerDefaults.publicProof,
    program: buildAffiliateProgramMetadata({
      tierKey: "partner",
      tierMode: "automatic",
      referredRevenueAmount: 0,
      commissionBps: partnerDefaults.defaultCommissionBps,
      discountBasisPoints: partnerDefaults.defaultDiscountBasisPoints,
    }),
  };

  if (existing) {
    const [updated] = await db
      .update(affiliateProfile)
      .set({
        code: existing.code || referral.code,
        displayName: existing.displayName || user.name,
        commissionBps:
          existing.commissionBps ?? partnerDefaults.defaultCommissionBps,
        tierKey: normalizeAffiliateTierKey(existing.tierKey),
        tierMode: normalizeAffiliateTierMode(existing.tierMode),
        tierAssignedAt: existing.tierAssignedAt ?? new Date(),
        tierAssignedByUserId:
          existing.tierAssignedByUserId ?? approvedByUserId,
        isActive: true,
        approvedAt: new Date(),
        approvedByUserId,
        metadata:
          existing.metadata && typeof existing.metadata === "object"
            ? {
                ...(existing.metadata as Record<string, unknown>),
                publicProof:
                  (
                    (existing.metadata as Record<string, unknown>)
                      .publicProof as Record<string, unknown> | undefined
                  ) ?? publicProofDefaults.publicProof,
              }
            : publicProofDefaults,
        updatedAt: new Date(),
      })
      .where(eq(affiliateProfile.id, existing.id))
      .returning();

    if (updated) {
      return updated;
    }
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = attempt === 0 ? referral.code : buildAffiliateCode();
    try {
      const inserted = await db
        .insert(affiliateProfile)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          code,
          displayName: user.name,
          commissionBps: partnerDefaults.defaultCommissionBps,
          tierKey: "partner",
          tierMode: "automatic",
          tierAssignedAt: new Date(),
          tierAssignedByUserId: approvedByUserId,
          isActive: true,
          approvedAt: new Date(),
          approvedByUserId,
          metadata: publicProofDefaults,
        })
        .returning();

      if (inserted[0]) {
        return inserted[0];
      }
    } catch {
      // Retry on code collisions.
    }
  }

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Unable to activate affiliate profile",
  });
}

async function ensureAffiliateGroupRow(
  profileId: string,
  ownerUser: MinimalUser
) {
  const existingRows = await db
    .select()
    .from(affiliateGroup)
    .where(eq(affiliateGroup.affiliateProfileId, profileId))
    .limit(1);

  if (existingRows[0]) {
    return existingRows[0];
  }

  const baseName = buildGroupName(ownerUser.name);
  const baseSlug =
    slugify(ownerUser.name || ownerUser.email.split("@")[0] || "group") ||
    "group";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;

    try {
      const inserted = await db
        .insert(affiliateGroup)
        .values({
          id: crypto.randomUUID(),
          affiliateProfileId: profileId,
          ownerUserId: ownerUser.id,
          name: baseName,
          slug,
          description: "Free mentorship group for traders joining through this affiliate.",
        })
        .returning();

      if (inserted[0]) {
        return inserted[0];
      }
    } catch {
      // Retry on slug collisions.
    }
  }

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Unable to create affiliate group",
  });
}

export async function getLatestAffiliateApplication(userId: string) {
  const rows = await db
    .select()
    .from(affiliateApplication)
    .where(eq(affiliateApplication.userId, userId))
    .orderBy(desc(affiliateApplication.updatedAt), desc(affiliateApplication.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

function normalizeAffiliateApplicationText(value?: string | null) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function normalizeAffiliateApplicationNumber(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sanitizeAffiliateApplicationDetails(input: {
  whyApply: string;
  promotionPlan: string;
  estimatedMonthlyReferrals: number;
  audienceSize?: number | null;
  twitter?: string | null;
  discord?: string | null;
  website?: string | null;
  location?: string | null;
  otherSocials?: string | null;
}): AffiliateApplicationDetails {
  return {
    whyApply: input.whyApply.trim(),
    promotionPlan: input.promotionPlan.trim(),
    estimatedMonthlyReferrals: input.estimatedMonthlyReferrals,
    audienceSize: normalizeAffiliateApplicationNumber(input.audienceSize),
    twitter: normalizeAffiliateApplicationText(input.twitter),
    discord: normalizeAffiliateApplicationText(input.discord),
    website: normalizeAffiliateApplicationText(input.website),
    location: normalizeAffiliateApplicationText(input.location),
    otherSocials: normalizeAffiliateApplicationText(input.otherSocials),
  };
}

export async function applyForAffiliate(input: {
  userId: string;
  details: {
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
}) {
  const profile = await getApprovedAffiliateProfile(input.userId);
  if (profile) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "You are already an approved affiliate",
    });
  }

  const details = sanitizeAffiliateApplicationDetails(input.details);

  const existing = await getLatestAffiliateApplication(input.userId);
  if (existing) {
    const [updated] = await db
      .update(affiliateApplication)
      .set({
        status: "pending",
        message: details.whyApply,
        details,
        adminNotes: null,
        reviewedAt: null,
        reviewedByUserId: null,
        updatedAt: new Date(),
      })
      .where(eq(affiliateApplication.id, existing.id))
      .returning();

    return updated ?? existing;
  }

  const [inserted] = await db
    .insert(affiliateApplication)
    .values({
      id: crypto.randomUUID(),
      userId: input.userId,
      message: details.whyApply,
      details,
    })
    .returning();

  return inserted;
}

export async function listAffiliateApplications() {
  const applications = await db
    .select({
      application: affiliateApplication,
      user: {
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
        username: userTable.username,
        twitter: userTable.twitter,
        discord: userTable.discord,
        website: userTable.website,
        location: userTable.location,
      },
    })
    .from(affiliateApplication)
    .innerJoin(userTable, eq(affiliateApplication.userId, userTable.id))
    .orderBy(
      asc(affiliateApplication.status),
      desc(affiliateApplication.createdAt)
    );

  if (!applications.length) {
    return [];
  }

  const userIds = applications.map((entry) => entry.user.id);
  const referralStats = await db
    .select({
      referrerUserId: referralConversion.referrerUserId,
      signups: sql<number>`count(*)::int`,
      paidConversions:
        sql<number>`count(*) filter (where ${referralConversion.status} = 'paid')::int`,
    })
    .from(referralConversion)
    .where(inArray(referralConversion.referrerUserId, userIds))
    .groupBy(referralConversion.referrerUserId);

  const statsByUserId = new Map(
    referralStats.map((entry) => [entry.referrerUserId, entry])
  );

  return applications.map((entry) => {
    const stats = statsByUserId.get(entry.user.id);

    return {
      ...entry,
      referralStats: {
        signups: stats?.signups ?? 0,
        paidConversions: stats?.paidConversions ?? 0,
      },
    };
  });
}

export async function approveAffiliateApplication(input: {
  applicationId: string;
  reviewedByUserId: string;
  adminNotes?: string | null;
}) {
  const rows = await db
    .select()
    .from(affiliateApplication)
    .where(eq(affiliateApplication.id, input.applicationId))
    .limit(1);

  const application = rows[0];
  if (!application) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Affiliate application not found",
    });
  }

  const user = await getMinimalUser(application.userId);
  const approvedProfile = await ensureAffiliateProfileApproved(
    user,
    input.reviewedByUserId
  );
  const group = await ensureAffiliateGroupRow(approvedProfile.id, user);
  const offer = await ensureAffiliateOfferRow(
    approvedProfile,
    input.reviewedByUserId
  );
  const trackingLink = await ensureAffiliateTrackingLinkRow({
    profile: approvedProfile,
    group,
    offer,
  });

  await db
    .update(referralProfile)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(referralProfile.userId, user.id));

  const [updatedApplication] = await db
    .update(affiliateApplication)
    .set({
      status: "approved",
      adminNotes: input.adminNotes?.trim() || null,
      reviewedAt: new Date(),
      reviewedByUserId: input.reviewedByUserId,
      updatedAt: new Date(),
    })
    .where(eq(affiliateApplication.id, application.id))
    .returning();

  const synced = await syncAffiliateTierState(user.id);

  return {
    application: updatedApplication ?? application,
    profile: synced?.profile ?? approvedProfile,
    group,
    offer: synced?.defaultOffer ?? offer,
    trackingLink,
    tier: synced?.tier ?? null,
  };
}

export async function rejectAffiliateApplication(input: {
  applicationId: string;
  reviewedByUserId: string;
  adminNotes?: string | null;
}) {
  const rows = await db
    .select()
    .from(affiliateApplication)
    .where(eq(affiliateApplication.id, input.applicationId))
    .limit(1);

  const application = rows[0];
  if (!application) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Affiliate application not found",
    });
  }

  const [updated] = await db
    .update(affiliateApplication)
    .set({
      status: "rejected",
      adminNotes: input.adminNotes?.trim() || null,
      reviewedAt: new Date(),
      reviewedByUserId: input.reviewedByUserId,
      updatedAt: new Date(),
    })
    .where(eq(affiliateApplication.id, application.id))
    .returning();

  return updated ?? application;
}

async function getReferralConversionsByReferrer(userId: string) {
  return db
    .select({
      id: referralConversion.id,
      referralProfileId: referralConversion.referralProfileId,
      referrerUserId: referralConversion.referrerUserId,
      referredUserId: referralConversion.referredUserId,
      referralCode: referralConversion.referralCode,
      source: referralConversion.source,
      status: referralConversion.status,
      paidOrderId: referralConversion.paidOrderId,
      paidSubscriptionId: referralConversion.paidSubscriptionId,
      paidAt: referralConversion.paidAt,
      createdAt: referralConversion.createdAt,
      updatedAt: referralConversion.updatedAt,
      referredUsername: userTable.username,
    })
    .from(referralConversion)
    .leftJoin(userTable, eq(userTable.id, referralConversion.referredUserId))
    .where(eq(referralConversion.referrerUserId, userId))
    .orderBy(desc(referralConversion.createdAt));
}

function buildReferralProgress(paidConversions: number) {
  const nextEdgeCredit =
    REFERRAL_EDGE_CREDIT_THRESHOLD -
    (paidConversions % REFERRAL_EDGE_CREDIT_THRESHOLD || REFERRAL_EDGE_CREDIT_THRESHOLD);
  const nextFreeMonth =
    REFERRAL_FREE_MONTH_THRESHOLD -
    (paidConversions % REFERRAL_FREE_MONTH_THRESHOLD || REFERRAL_FREE_MONTH_THRESHOLD);
  const nextUpgradeTrial =
    REFERRAL_UPGRADE_TRIAL_THRESHOLD -
    (paidConversions % REFERRAL_UPGRADE_TRIAL_THRESHOLD ||
      REFERRAL_UPGRADE_TRIAL_THRESHOLD);

  return {
    paidConversions,
    edgeCreditThreshold: REFERRAL_EDGE_CREDIT_THRESHOLD,
    edgeCreditAmount: REFERRAL_EDGE_CREDIT_AMOUNT,
    freeMonthThreshold: REFERRAL_FREE_MONTH_THRESHOLD,
    upgradeTrialThreshold: REFERRAL_UPGRADE_TRIAL_THRESHOLD,
    nextEdgeCreditIn: paidConversions === 0 ? REFERRAL_EDGE_CREDIT_THRESHOLD : nextEdgeCredit,
    nextFreeMonthIn: paidConversions === 0 ? REFERRAL_FREE_MONTH_THRESHOLD : nextFreeMonth,
    nextUpgradeTrialIn:
      paidConversions === 0 ? REFERRAL_UPGRADE_TRIAL_THRESHOLD : nextUpgradeTrial,
  };
}

export async function buildReferralState(userId: string) {
  const activeAffiliate = await getApprovedAffiliateProfile(userId);
  const profile = activeAffiliate ? await getReferralProfileRow(userId) : await ensureReferralProfile(userId);
  const conversions = await getReferralConversionsByReferrer(userId);
  const rewardGrants = await db
    .select()
    .from(referralRewardGrant)
    .where(eq(referralRewardGrant.userId, userId))
    .orderBy(desc(referralRewardGrant.grantedAt));

  const signups = conversions.length;
  const paidConversions = conversions.filter((row) => row.status === "paid").length;

  return {
    isHiddenBecauseAffiliate: Boolean(activeAffiliate),
    profile:
      profile && profile.isActive && !activeAffiliate
        ? {
            id: profile.id,
            code: profile.code,
            shareUrl: buildReferralShareUrl(profile.code),
          }
        : null,
    stats: {
      signups,
      paidConversions,
    },
    progress: buildReferralProgress(paidConversions),
    grants: rewardGrants,
    conversions,
  };
}

export async function buildAffiliateState(userId: string) {
  const application = await getLatestAffiliateApplication(userId);
  const synced = await syncAffiliateTierState(userId);
  const profile = synced?.profile ?? (await getApprovedAffiliateProfile(userId));

  if (!profile) {
    return {
      isAffiliate: false,
      application,
      profile: null,
      stats: {
        signups: 0,
        paidCustomers: 0,
        totalCommissionAmount: 0,
      },
    };
  }

  const username = await getUsername(userId);

  const offers = await getAffiliateOfferRows(userId);
  const defaultOffer = offers.find((row) => row.isDefault) ?? offers[0] ?? null;

  const attributions = await db
    .select()
    .from(affiliateAttribution)
    .where(eq(affiliateAttribution.affiliateUserId, userId))
    .orderBy(desc(affiliateAttribution.createdAt));

  const commissionEventRows = await db
    .select({
      id: affiliateCommissionEvent.id,
      affiliateAttributionId: affiliateCommissionEvent.affiliateAttributionId,
      affiliateUserId: affiliateCommissionEvent.affiliateUserId,
      referredUserId: affiliateCommissionEvent.referredUserId,
      referredUsernameSnapshot: affiliateCommissionEvent.referredUsername,
      referredEmailSnapshot: affiliateCommissionEvent.referredEmail,
      provider: affiliateCommissionEvent.provider,
      providerOrderId: affiliateCommissionEvent.providerOrderId,
      billingOrderId: affiliateCommissionEvent.billingOrderId,
      stripeInvoiceId: affiliateCommissionEvent.stripeInvoiceId,
      polarOrderId: affiliateCommissionEvent.polarOrderId,
      polarSubscriptionId: affiliateCommissionEvent.polarSubscriptionId,
      stripeSubscriptionId: affiliateCommissionEvent.stripeSubscriptionId,
      trackedPlanKey: affiliateCommissionEvent.planKey,
      orderAmount: affiliateCommissionEvent.orderAmount,
      commissionBps: affiliateCommissionEvent.commissionBps,
      commissionAmount: affiliateCommissionEvent.commissionAmount,
      currency: affiliateCommissionEvent.currency,
      affiliatePayoutId: affiliateCommissionEvent.affiliatePayoutId,
      paidOutAt: affiliateCommissionEvent.paidOutAt,
      occurredAt: affiliateCommissionEvent.occurredAt,
      metadata: affiliateCommissionEvent.metadata,
      createdAt: affiliateCommissionEvent.createdAt,
      updatedAt: affiliateCommissionEvent.updatedAt,
      referredUsername: userTable.username,
      referredName: userTable.name,
      referredEmail: userTable.email,
      planKey: billingOrder.planKey,
    })
    .from(affiliateCommissionEvent)
    .leftJoin(userTable, eq(userTable.id, affiliateCommissionEvent.referredUserId))
    .leftJoin(billingOrder, eq(billingOrder.id, affiliateCommissionEvent.billingOrderId))
    .where(eq(affiliateCommissionEvent.affiliateUserId, userId))
    .orderBy(
      desc(affiliateCommissionEvent.occurredAt),
      desc(affiliateCommissionEvent.createdAt)
    );
  const commissionEvents = commissionEventRows.map((row) => {
    const metadata =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null;
    const metadataPlanKey =
      typeof metadata?.plan_key === "string" ? metadata.plan_key : null;
    const paymentPlanKey = row.trackedPlanKey ?? row.planKey ?? metadataPlanKey;

    return {
      ...row,
      orderReference: row.providerOrderId ?? row.stripeInvoiceId ?? null,
      referredUsername: row.referredUsernameSnapshot ?? row.referredUsername,
      referredEmail: row.referredEmailSnapshot ?? row.referredEmail,
      paymentPlanKey,
      paymentPlanLabel: formatAffiliatePlanLabel(paymentPlanKey),
    };
  });

  const shareUrl = buildAffiliateShareUrl({
    affiliateCode: profile.code,
    username,
  });

  return {
    isAffiliate: true,
    application,
    profile: {
      id: profile.id,
      code: profile.code,
      commissionBps: profile.commissionBps,
      tierKey: synced?.tier.key ?? normalizeAffiliateTierKey(profile.tierKey),
      offerCode: defaultOffer?.code ?? null,
      defaultOfferCode: defaultOffer?.code ?? null,
      shareUrl,
    },
    tier: synced?.tier ?? null,
    stats: {
      signups: attributions.length,
      paidCustomers: attributions.filter((row) => row.firstPaidAt).length,
      totalCommissionAmount: commissionEvents.reduce(
        (sum, row) => sum + (row.commissionAmount ?? 0),
        0
      ),
      referredRevenueAmount:
        synced?.tier.referredRevenueAmount ??
        commissionEvents.reduce((sum, row) => sum + (row.orderAmount ?? 0), 0),
    },
  };
}

export async function buildAffiliateDashboard(userId: string) {
  const synced = await syncAffiliateTierState(userId);
  const profile = synced?.profile ?? (await getApprovedAffiliateProfile(userId));
  if (!profile) {
    return null;
  }

  const username = await getUsername(userId);

  const offers = await getAffiliateOfferRows(userId);
  const defaultOffer = offers.find((row) => row.isDefault) ?? offers[0] ?? null;

  const attributions = await db
    .select()
    .from(affiliateAttribution)
    .where(eq(affiliateAttribution.affiliateUserId, userId))
    .orderBy(desc(affiliateAttribution.createdAt));

  const commissionEvents = await db
    .select()
    .from(affiliateCommissionEvent)
    .where(eq(affiliateCommissionEvent.affiliateUserId, userId))
    .orderBy(desc(affiliateCommissionEvent.occurredAt), desc(affiliateCommissionEvent.createdAt));
  const touchEvents = await db
    .select()
    .from(affiliateTouchEvent)
    .where(eq(affiliateTouchEvent.affiliateUserId, userId))
    .orderBy(desc(affiliateTouchEvent.createdAt));

  // Build channel stats from touch event metadata
  const channelMap = new Map<string, { touches: number }>();
  for (const touch of touchEvents) {
    const ch =
      (touch.metadata as Record<string, unknown> | null)?.channel as string | undefined;
    if (ch) {
      const entry = channelMap.get(ch) ?? { touches: 0 };
      entry.touches += 1;
      channelMap.set(ch, entry);
    }
  }

  const channelStats = Array.from(channelMap.entries()).map(([name, stat]) => ({
    channel: name,
    touches: stat.touches,
    shareUrl: buildAffiliateShareUrl({
      affiliateCode: profile.code,
      username,
      channel: name,
    }),
  }));

  const shareUrl = buildAffiliateShareUrl({
    affiliateCode: profile.code,
    username,
  });

  return {
    profile: {
      id: profile.id,
      code: profile.code,
      commissionBps: profile.commissionBps,
      tierKey: synced?.tier.key ?? normalizeAffiliateTierKey(profile.tierKey),
      offerCode: defaultOffer?.code ?? null,
      defaultOfferCode: defaultOffer?.code ?? null,
      shareUrl,
      publicProof: buildAffiliatePublicProofMetadata(
        (profile.metadata as Record<string, unknown> | null | undefined) ?? null
      ),
    },
    tier:
      synced?.tier ??
      buildAffiliateTierSnapshot({
        profile,
        referredRevenueAmount: commissionEvents.reduce(
          (sum, row) => sum + (row.orderAmount ?? 0),
          0
        ),
        discountBasisPoints:
          defaultOffer?.discountBasisPoints ??
          AFFILIATE_TIER_CONFIG[
            normalizeAffiliateTierKey(profile.tierKey)
          ].defaultDiscountBasisPoints,
      }),
    premiumAccess: {
      isActive: Boolean(synced?.premiumOverride),
      planKey: synced?.premiumOverride?.planKey ?? AFFILIATE_PREMIUM_PLAN_KEY,
      sourceType:
        synced?.premiumOverride?.sourceType ?? AFFILIATE_TIER_OVERRIDE_SOURCE,
      endsAt: synced?.premiumOverride?.endsAt ?? null,
    },
    defaultOffer,
    offers,
    channels: channelStats,
    stats: {
      signups: attributions.length,
      paidCustomers: attributions.filter((row) => row.firstPaidAt).length,
      totalCommissionAmount: commissionEvents.reduce(
        (sum, row) => sum + (row.commissionAmount ?? 0),
        0
      ),
      referredRevenueAmount:
        synced?.tier.referredRevenueAmount ??
        commissionEvents.reduce((sum, row) => sum + (row.orderAmount ?? 0), 0),
      linkClicks: touchEvents.length,
    },
    attributions,
    commissionEvents,
    touchEvents,
  };
}

export async function getAffiliatePayoutSettings(userId: string) {
  const synced = await syncAffiliateTierState(userId);
  const profile = synced?.profile ?? (await getApprovedAffiliateProfile(userId));
  if (!profile) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Affiliate access required",
    });
  }

  const paymentMethods = await getAffiliatePaymentMethods(userId);
  const payouts = await getAffiliatePayoutRows(userId);
  const unpaidEvents = await getUnpaidAffiliateCommissionEvents(userId);
  const providerAccount = await getAffiliateProviderAccountRow(userId);
  const withdrawalRequests = await getAffiliateWithdrawalRequestRows(userId);
  const summary = buildAffiliatePayoutSummary({
    unpaidEvents,
    payouts,
  });

  return {
    commissionBps: profile.commissionBps,
    tier: synced?.tier ?? null,
    premiumAccess: {
      isActive: Boolean(synced?.premiumOverride),
      planKey: synced?.premiumOverride?.planKey ?? AFFILIATE_PREMIUM_PLAN_KEY,
      sourceType:
        synced?.premiumOverride?.sourceType ?? AFFILIATE_TIER_OVERRIDE_SOURCE,
      endsAt: synced?.premiumOverride?.endsAt ?? null,
    },
    stripeConnect: providerAccount
      ? {
          id: providerAccount.id,
          provider: providerAccount.provider,
          accountId: providerAccount.providerAccountId,
          accountLabel: "Stripe Express payout account",
          statusLabel: buildStripeConnectStatusLabel(providerAccount),
          onboardingStatus: providerAccount.onboardingStatus,
          chargesEnabled: providerAccount.chargesEnabled,
          payoutsEnabled: providerAccount.payoutsEnabled,
          detailsSubmitted: providerAccount.detailsSubmitted,
          lastSyncedAt: providerAccount.lastSyncedAt,
          currency: providerAccount.currency,
          country: providerAccount.country,
        }
      : null,
    manualPaymentMethods: paymentMethods,
    summary,
    withdrawalRequests: withdrawalRequests.map((row) => ({
      ...row.request,
      amountUsd: row.request.amount,
      destinationLabel: buildWithdrawalDestinationLabel({
        destinationType: row.request.destinationType,
        paymentMethod: row.paymentMethod,
        providerAccount: row.providerAccount,
      }),
      providerAccount: row.providerAccount
        ? {
            id: row.providerAccount.id,
            provider: row.providerAccount.provider,
            onboardingStatus: row.providerAccount.onboardingStatus,
            payoutsEnabled: row.providerAccount.payoutsEnabled,
            chargesEnabled: row.providerAccount.chargesEnabled,
          }
        : null,
      paymentMethod: row.paymentMethod
        ? {
            id: row.paymentMethod.id,
            label: row.paymentMethod.label,
            methodType: row.paymentMethod.methodType,
          }
        : null,
    })),
    payouts: payouts.map((row) => ({
      ...row.payout,
      amountUsd: row.payout.amount,
      provider: row.providerAccount?.provider ?? null,
      destinationLabel: buildWithdrawalDestinationLabel({
        destinationType: row.payout.destinationType,
        paymentMethod: row.paymentMethod,
        providerAccount: row.providerAccount,
      }),
      paymentMethod: row.paymentMethod
        ? {
            id: row.paymentMethod.id,
            label: row.paymentMethod.label,
            methodType: row.paymentMethod.methodType,
          }
        : null,
      providerAccount: row.providerAccount
        ? {
            id: row.providerAccount.id,
            provider: row.providerAccount.provider,
            providerAccountId: row.providerAccount.providerAccountId,
          }
        : null,
      withdrawalRequest: row.withdrawalRequest
        ? {
            id: row.withdrawalRequest.id,
            status: row.withdrawalRequest.status,
            destinationType: row.withdrawalRequest.destinationType,
          }
        : null,
    })),
  };
}

async function selectCommissionEventsForWithdrawal(input: {
  affiliateUserId: string;
  amountLimit: number;
}) {
  const unpaidEvents = await getUnpaidAffiliateCommissionEvents(input.affiliateUserId);
  const selected: typeof unpaidEvents = [];
  let runningAmount = 0;

  for (const event of unpaidEvents) {
    const eventAmount = event.commissionAmount ?? 0;
    if (eventAmount <= 0) {
      continue;
    }

    if (selected.length > 0 && runningAmount + eventAmount > input.amountLimit) {
      continue;
    }

    if (selected.length === 0 && eventAmount > input.amountLimit) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Requested withdrawal amount is below the next payable commission event",
      });
    }

    selected.push(event);
    runningAmount += eventAmount;

    if (runningAmount >= input.amountLimit) {
      break;
    }
  }

  if (selected.length === 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No unpaid affiliate commission is available",
    });
  }

  return {
    selected,
    amount: runningAmount,
    currency: selected.find((row) => row.currency)?.currency ?? "USD",
  };
}

async function claimCommissionEventsForPayout(input: {
  affiliateUserId: string;
  payoutId: string;
  eventIds: string[];
  paidAt: Date;
}) {
  return db
    .update(affiliateCommissionEvent)
    .set({
      affiliatePayoutId: input.payoutId,
      paidOutAt: input.paidAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(affiliateCommissionEvent.affiliateUserId, input.affiliateUserId),
        isNull(affiliateCommissionEvent.affiliatePayoutId),
        inArray(affiliateCommissionEvent.id, input.eventIds)
      )
    )
    .returning();
}

async function releaseCommissionEventsFromPayout(payoutId: string) {
  await db
    .update(affiliateCommissionEvent)
    .set({
      affiliatePayoutId: null,
      paidOutAt: null,
      updatedAt: new Date(),
    })
    .where(eq(affiliateCommissionEvent.affiliatePayoutId, payoutId));
}

export async function saveAffiliateOffer(input: {
  affiliateUserId: string;
  createdByUserId: string;
  affiliateOfferId?: string | null;
  code: string;
  label: string;
  description?: string | null;
  discountBasisPoints: number;
  isDefault?: boolean;
}) {
  const profile = await getApprovedAffiliateProfile(input.affiliateUserId);
  if (!profile) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Affiliate not found",
    });
  }

  const normalizedCode = normalizeGrowthCode(input.code);
  if (!normalizedCode) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Offer code is required",
    });
  }

  const basisPoints = Math.max(100, Math.min(10000, Math.round(input.discountBasisPoints)));
  let existing: typeof affiliateOffer.$inferSelect | null = null;

  if (input.affiliateOfferId) {
    const [row] = await db
      .select()
      .from(affiliateOffer)
      .where(
        and(
          eq(affiliateOffer.id, input.affiliateOfferId),
          eq(affiliateOffer.affiliateUserId, input.affiliateUserId)
        )
      )
      .limit(1);

    existing = row ?? null;
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Affiliate offer not found",
      });
    }
  }

  const stripeCoupon = await createStripeAffiliateOfferCoupon({
    code: normalizedCode,
    label: input.label.trim(),
    basisPoints,
  });

  let savedOffer: typeof affiliateOffer.$inferSelect | null = null;
  if (existing) {
    const [updated] = await db
      .update(affiliateOffer)
      .set({
        code: normalizedCode,
        label: input.label.trim(),
        description: input.description?.trim() || null,
        discountProvider: "stripe",
        providerDiscountId: stripeCoupon.id,
        providerPromotionCodeId: null,
        discountBasisPoints: basisPoints,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(affiliateOffer.id, existing.id))
      .returning();

    savedOffer = updated ?? null;
  } else {
    const [inserted] = await db
      .insert(affiliateOffer)
      .values({
        id: crypto.randomUUID(),
        affiliateProfileId: profile.id,
        affiliateUserId: input.affiliateUserId,
        code: normalizedCode,
        label: input.label.trim(),
        description: input.description?.trim() || null,
        discountProvider: "stripe",
        providerDiscountId: stripeCoupon.id,
        providerPromotionCodeId: null,
        discountBasisPoints: basisPoints,
        isActive: true,
        createdByUserId: input.createdByUserId,
      })
      .returning();

    savedOffer = inserted ?? null;
  }

  if (!savedOffer) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to save affiliate offer",
    });
  }

  const allOffers = await getAffiliateOfferRows(input.affiliateUserId);
  const existingDefault = allOffers.find(
    (row) => row.id !== savedOffer!.id && row.isDefault
  );
  const defaultOfferId =
    input.isDefault || !existingDefault ? savedOffer.id : existingDefault.id;

  await db
    .update(affiliateOffer)
    .set({
      isDefault: false,
      updatedAt: new Date(),
    })
    .where(eq(affiliateOffer.affiliateUserId, input.affiliateUserId));

  await db
    .update(affiliateOffer)
    .set({
      isDefault: true,
      updatedAt: new Date(),
    })
    .where(eq(affiliateOffer.id, defaultOfferId));

  const offers = await getAffiliateOfferRows(input.affiliateUserId);
  return offers.find((row) => row.id === savedOffer.id) ?? savedOffer;
}

export async function saveAffiliateCommissionSplit(input: {
  affiliateUserId: string;
  commissionBps: number;
}) {
  const profile = await getApprovedAffiliateProfile(input.affiliateUserId);
  if (!profile) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Affiliate not found",
    });
  }

  const commissionBps = Math.max(0, Math.min(10000, Math.round(input.commissionBps)));
  const [updated] = await db
    .update(affiliateProfile)
    .set({
      commissionBps,
      updatedAt: new Date(),
    })
    .where(eq(affiliateProfile.id, profile.id))
    .returning();

  return updated ?? profile;
}

export async function saveAffiliateTierSettings(input: {
  affiliateUserId: string;
  updatedByUserId: string;
  tierMode: AffiliateTierMode;
  tierKey: AffiliateTierKey;
  offerCode: string;
  offerLabel: string;
  offerDescription?: string | null;
  discountBasisPoints?: number | null;
  commissionBps?: number | null;
  badgeLabel?: string | null;
  effectVariant?: string | null;
  benefits?: Partial<Record<AffiliateBenefitKey, boolean>> | null;
}) {
  const profile = await getApprovedAffiliateProfile(input.affiliateUserId);
  if (!profile) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Affiliate not found",
    });
  }

  const referredRevenueAmount = await getAffiliateReferredRevenueAmount(
    input.affiliateUserId
  );
  const nextTierMode = normalizeAffiliateTierMode(input.tierMode);
  const automaticTierKey = getAffiliateAutomaticTierKey(referredRevenueAmount);
  const nextTierKey =
    nextTierMode === "manual" ? "elite" : automaticTierKey;

  if (nextTierMode === "manual" && input.tierKey !== "elite") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only the Elite tier can be assigned manually",
    });
  }

  const metadata = getAffiliateMetadataObject(
    (profile.metadata as Record<string, unknown> | null | undefined) ?? null
  );
  const program =
    metadata.program && typeof metadata.program === "object"
      ? (metadata.program as Record<string, unknown>)
      : null;
  const tierDefaults = AFFILIATE_TIER_CONFIG[nextTierKey];
  const nextCommissionBps =
    nextTierMode === "manual"
      ? Math.max(
          0,
          Math.min(
            10000,
            Math.round(input.commissionBps ?? profile.commissionBps)
          )
        )
      : tierDefaults.defaultCommissionBps;
  const nextDiscountBasisPoints =
    nextTierMode === "manual"
      ? Math.max(
          100,
          Math.min(
            10000,
            Math.round(
              input.discountBasisPoints ??
                (typeof program?.discountBasisPoints === "number"
                  ? Number(program.discountBasisPoints)
                  : tierDefaults.defaultDiscountBasisPoints)
            )
          )
        )
      : tierDefaults.defaultDiscountBasisPoints;
  const nextBenefitFlags =
    nextTierMode === "manual"
      ? buildAffiliateBenefitFlags("elite", input.benefits ?? null)
      : buildAffiliateBenefitFlags(nextTierKey);
  const nextBadgeLabel =
    nextTierMode === "manual"
      ? input.badgeLabel?.trim() || tierDefaults.publicProof.badgeLabel
      : tierDefaults.publicProof.badgeLabel;
  const nextEffectVariant =
    nextTierMode === "manual" && isAffiliateEffectVariant(input.effectVariant)
      ? input.effectVariant
      : tierDefaults.publicProof.effectVariant;

  const offers = await getAffiliateOfferRows(input.affiliateUserId);
  const defaultOffer = offers.find((row) => row.isDefault) ?? offers[0] ?? null;
  const normalizedOfferCode = normalizeGrowthCode(input.offerCode);
  if (!normalizedOfferCode) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Offer code is required",
    });
  }

  const trimmedOfferLabel = input.offerLabel.trim();
  if (!trimmedOfferLabel) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Offer label is required",
    });
  }

  const trimmedOfferDescription = input.offerDescription?.trim() || null;
  const shouldSaveOffer =
    !defaultOffer ||
    defaultOffer.code !== normalizedOfferCode ||
    defaultOffer.label !== trimmedOfferLabel ||
    (defaultOffer.description ?? null) !== trimmedOfferDescription ||
    defaultOffer.discountBasisPoints !== nextDiscountBasisPoints;

  const savedOffer = shouldSaveOffer
    ? await saveAffiliateOffer({
        affiliateUserId: input.affiliateUserId,
        createdByUserId: input.updatedByUserId,
        affiliateOfferId: defaultOffer?.id ?? null,
        code: normalizedOfferCode,
        label: trimmedOfferLabel,
        description: trimmedOfferDescription,
        discountBasisPoints: nextDiscountBasisPoints,
        isDefault: true,
      })
    : defaultOffer;

  const nextMetadata =
    nextTierMode === "manual"
      ? {
          ...metadata,
          publicProof: {
            ...(metadata.publicProof && typeof metadata.publicProof === "object"
              ? (metadata.publicProof as Record<string, unknown>)
              : {}),
            badgeLabel: nextBadgeLabel,
            effectVariant: nextEffectVariant,
          },
          program: buildAffiliateProgramMetadata({
            tierKey: nextTierKey,
            tierMode: nextTierMode,
            referredRevenueAmount,
            commissionBps: nextCommissionBps,
            discountBasisPoints: nextDiscountBasisPoints,
            benefits: nextBenefitFlags,
          }),
        }
      : {
          ...metadata,
          publicProof: {
            badgeLabel: tierDefaults.publicProof.badgeLabel,
            effectVariant: tierDefaults.publicProof.effectVariant,
          },
          program: buildAffiliateProgramMetadata({
            tierKey: nextTierKey,
            tierMode: nextTierMode,
            referredRevenueAmount,
            commissionBps: nextCommissionBps,
            discountBasisPoints: nextDiscountBasisPoints,
          }),
        };

  await db
    .update(affiliateProfile)
    .set({
      commissionBps: nextCommissionBps,
      tierKey: nextTierKey,
      tierMode: nextTierMode,
      tierAssignedAt: new Date(),
      tierAssignedByUserId:
        nextTierMode === "manual" ? input.updatedByUserId : null,
      metadata: nextMetadata,
      updatedAt: new Date(),
    })
    .where(eq(affiliateProfile.id, profile.id));

  const synced = await syncAffiliateTierState(input.affiliateUserId);
  if (!synced) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to save affiliate tier settings",
    });
  }

  return {
    profile: synced.profile,
    offer: synced.defaultOffer ?? savedOffer,
    premiumAccess: synced.premiumOverride,
    tier: synced.tier,
  };
}

export async function saveAffiliateTrackingLink(input: {
  affiliateUserId: string;
  trackingLinkId?: string | null;
  affiliateOfferId?: string | null;
  name: string;
  destinationPath?: string | null;
  affiliateGroupSlug?: string | null;
  isDefault?: boolean;
}) {
  const profile = await getApprovedAffiliateProfile(input.affiliateUserId);
  if (!profile) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Affiliate access required",
    });
  }

  const [group] = await db
    .select()
    .from(affiliateGroup)
    .where(eq(affiliateGroup.affiliateProfileId, profile.id))
    .limit(1);
  const offers = await getAffiliateOfferRows(input.affiliateUserId);
  const selectedOffer =
    (input.affiliateOfferId
      ? offers.find((row) => row.id === input.affiliateOfferId)
      : offers.find((row) => row.isDefault) ?? offers[0]) ?? null;

  let existing: typeof affiliateTrackingLink.$inferSelect | null = null;
  if (input.trackingLinkId) {
    const [row] = await db
      .select()
      .from(affiliateTrackingLink)
      .where(
        and(
          eq(affiliateTrackingLink.id, input.trackingLinkId),
          eq(affiliateTrackingLink.affiliateUserId, input.affiliateUserId)
        )
      )
      .limit(1);
    existing = row ?? null;
  }

  let savedLink: typeof affiliateTrackingLink.$inferSelect | null = null;
  if (existing) {
    const [updated] = await db
      .update(affiliateTrackingLink)
      .set({
        affiliateOfferId: selectedOffer?.id ?? null,
        name: input.name.trim(),
        destinationPath: normalizeDestinationPath(input.destinationPath),
        affiliateGroupSlug: input.affiliateGroupSlug?.trim() || group?.slug || null,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(affiliateTrackingLink.id, existing.id))
      .returning();
    savedLink = updated ?? null;
  } else {
    const baseSlug = buildAffiliateTrackingLinkSlug(input.name);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
      try {
        const [inserted] = await db
          .insert(affiliateTrackingLink)
          .values({
            id: crypto.randomUUID(),
            affiliateProfileId: profile.id,
            affiliateUserId: input.affiliateUserId,
            affiliateOfferId: selectedOffer?.id ?? null,
            name: input.name.trim(),
            slug,
            destinationPath: normalizeDestinationPath(input.destinationPath),
            affiliateGroupSlug:
              input.affiliateGroupSlug?.trim() || group?.slug || null,
            utmSource: "affiliate",
            utmMedium: "share",
            utmCampaign: profile.code.toLowerCase(),
          })
          .returning();

        savedLink = inserted ?? null;
        if (savedLink) {
          break;
        }
      } catch {
        // Retry on slug collisions.
      }
    }
  }

  if (!savedLink) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to save affiliate link",
    });
  }

  const allLinks = await getAffiliateTrackingLinkRows(input.affiliateUserId);
  const existingDefault = allLinks.find(
    (row) => row.id !== savedLink!.id && row.isDefault
  );
  const defaultLinkId =
    input.isDefault || !existingDefault ? savedLink.id : existingDefault.id;

  await db
    .update(affiliateTrackingLink)
    .set({
      isDefault: false,
      updatedAt: new Date(),
    })
    .where(eq(affiliateTrackingLink.affiliateUserId, input.affiliateUserId));

  await db
    .update(affiliateTrackingLink)
    .set({
      isDefault: true,
      updatedAt: new Date(),
    })
    .where(eq(affiliateTrackingLink.id, defaultLinkId));

  const links = await getAffiliateTrackingLinkRows(input.affiliateUserId);
  return links.find((row) => row.id === savedLink.id) ?? savedLink;
}

export async function createAffiliateStripeConnectSession(input: {
  affiliateUserId: string;
  refreshUrl: string;
  returnUrl: string;
  mode?: "onboarding" | "dashboard";
}) {
  const profile = await getApprovedAffiliateProfile(input.affiliateUserId);
  if (!profile) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Affiliate access required",
    });
  }

  const user = await getMinimalUser(input.affiliateUserId);
  const stripeAccount = await getOrCreateAffiliateStripeConnectedAccount({
    affiliateUserId: input.affiliateUserId,
    email: user.email,
  });

  const providerAccount = await upsertAffiliateProviderAccountFromStripe({
    affiliateUserId: input.affiliateUserId,
    account: stripeAccount,
  });

  const prefersDashboard = (input.mode ?? "onboarding") === "dashboard";
  const canOpenExpressDashboard = Boolean(stripeAccount.details_submitted);

  if (prefersDashboard && canOpenExpressDashboard) {
    const link = await createStripeLoginLink(stripeAccount.id);
    return {
      url: link.url,
      providerAccount,
    };
  }

  const link = await createStripeOnboardingLink({
    accountId: stripeAccount.id,
    refreshUrl: input.refreshUrl,
    returnUrl: input.returnUrl,
  });

  return {
    url: link.url,
    providerAccount,
  };
}

export async function refreshAffiliateStripeConnectAccount(affiliateUserId: string) {
  const profile = await getApprovedAffiliateProfile(affiliateUserId);
  if (!profile) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Affiliate access required",
    });
  }

  const providerAccount = await getAffiliateProviderAccountRow(affiliateUserId);
  if (!providerAccount?.providerAccountId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Stripe Connect account not found",
    });
  }

  const user = await getMinimalUser(affiliateUserId);
  const stripeAccount = await getOrCreateAffiliateStripeConnectedAccount({
    affiliateUserId,
    email: user.email,
  });
  return upsertAffiliateProviderAccountFromStripe({
    affiliateUserId,
    account: stripeAccount,
  });
}

export async function disconnectAffiliateStripeConnect(affiliateUserId: string) {
  const profile = await getApprovedAffiliateProfile(affiliateUserId);
  if (!profile) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Affiliate access required",
    });
  }

  const providerAccount = await getAffiliateProviderAccountRow(affiliateUserId);
  if (!providerAccount) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Stripe Connect account not found",
    });
  }

  if (providerAccount.providerAccountId) {
    try {
      await deleteStripeConnectedAccount(providerAccount.providerAccountId);
    } catch {
      // Local disconnect still disables payouts even if remote deletion is rejected.
    }
  }

  const [updated] = await db
    .update(affiliateProviderAccount)
    .set({
      isActive: false,
      onboardingStatus: "disconnected",
      disconnectedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(affiliateProviderAccount.id, providerAccount.id))
    .returning();

  return updated ?? providerAccount;
}

export async function requestAffiliateWithdrawal(input: {
  affiliateUserId: string;
  amount?: number | null;
  destinationType: "stripe_connect" | "manual";
  paymentMethodId?: string | null;
}) {
  const profile = await getApprovedAffiliateProfile(input.affiliateUserId);
  if (!profile) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Affiliate access required",
    });
  }

  const unpaidEvents = await getUnpaidAffiliateCommissionEvents(input.affiliateUserId);
  const summary = buildAffiliatePayoutSummary({
    unpaidEvents,
    payouts: [],
  });

  if (summary.availableAmount <= 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No affiliate commission is available to withdraw",
    });
  }

  const requestedAmount =
    input.amount && Number.isInteger(input.amount) ? input.amount : summary.availableAmount;
  if (requestedAmount <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Withdrawal amount must be a positive integer",
    });
  }
  if (requestedAmount > summary.availableAmount) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Requested amount exceeds available affiliate balance",
    });
  }

  const providerAccount =
    input.destinationType === "stripe_connect"
      ? await getAffiliateProviderAccountRow(input.affiliateUserId)
      : null;
  if (input.destinationType === "stripe_connect") {
    if (!providerAccount?.isActive || !providerAccount.payoutsEnabled) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Connect Stripe and finish onboarding before requesting payout",
      });
    }
  }

  const paymentMethods =
    input.destinationType === "manual"
      ? await getAffiliatePaymentMethods(input.affiliateUserId)
      : [];
  const paymentMethod =
    input.destinationType === "manual"
      ? input.paymentMethodId
        ? paymentMethods.find((row) => row.id === input.paymentMethodId) ?? null
        : paymentMethods.find((row) => row.isDefault) ?? paymentMethods[0] ?? null
      : null;

  if (input.destinationType === "manual" && !paymentMethod) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Choose a manual payout method before requesting withdrawal",
    });
  }

  const [existingPending] = await db
    .select()
    .from(affiliateWithdrawalRequest)
    .where(
      and(
        eq(affiliateWithdrawalRequest.affiliateUserId, input.affiliateUserId),
        inArray(affiliateWithdrawalRequest.status, ["pending", "approved"])
      )
    )
    .limit(1);
  if (existingPending) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "A withdrawal request is already open",
    });
  }

  const selection = await selectCommissionEventsForWithdrawal({
    affiliateUserId: input.affiliateUserId,
    amountLimit: requestedAmount,
  });

  const [request] = await db
    .insert(affiliateWithdrawalRequest)
    .values({
      id: crypto.randomUUID(),
      affiliateUserId: input.affiliateUserId,
      destinationType: input.destinationType,
      providerAccountId: providerAccount?.id ?? null,
      paymentMethodId: paymentMethod?.id ?? null,
      amount: selection.amount,
      currency: selection.currency,
      status: "pending",
    })
    .returning();

  return request ?? null;
}

export async function cancelAffiliateWithdrawal(input: {
  affiliateUserId: string;
  withdrawalRequestId: string;
}) {
  const [request] = await db
    .select()
    .from(affiliateWithdrawalRequest)
    .where(
      and(
        eq(affiliateWithdrawalRequest.id, input.withdrawalRequestId),
        eq(affiliateWithdrawalRequest.affiliateUserId, input.affiliateUserId)
      )
    )
    .limit(1);

  if (!request) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Withdrawal request not found",
    });
  }

  if (request.status !== "pending") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Only pending withdrawal requests can be cancelled",
    });
  }

  const [updated] = await db
    .update(affiliateWithdrawalRequest)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(affiliateWithdrawalRequest.id, request.id))
    .returning();

  return updated ?? request;
}

export async function approveAffiliateWithdrawal(input: {
  withdrawalRequestId: string;
  reviewedByUserId: string;
  notes?: string | null;
}) {
  const [request] = await db
    .select()
    .from(affiliateWithdrawalRequest)
    .where(eq(affiliateWithdrawalRequest.id, input.withdrawalRequestId))
    .limit(1);

  if (!request) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Withdrawal request not found",
    });
  }

  if (request.status !== "pending") {
    return request;
  }

  const now = new Date();
  const [updated] = await db
    .update(affiliateWithdrawalRequest)
    .set({
      status: "approved",
      notes: input.notes?.trim() || request.notes,
      approvedAt: now,
      reviewedAt: now,
      reviewedByUserId: input.reviewedByUserId,
      updatedAt: now,
    })
    .where(eq(affiliateWithdrawalRequest.id, request.id))
    .returning();

  return updated ?? request;
}

export async function rejectAffiliateWithdrawal(input: {
  withdrawalRequestId: string;
  reviewedByUserId: string;
  notes?: string | null;
}) {
  const [request] = await db
    .select()
    .from(affiliateWithdrawalRequest)
    .where(eq(affiliateWithdrawalRequest.id, input.withdrawalRequestId))
    .limit(1);

  if (!request) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Withdrawal request not found",
    });
  }

  if (request.status === "paid") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Paid withdrawals cannot be rejected",
    });
  }

  const now = new Date();
  const [updated] = await db
    .update(affiliateWithdrawalRequest)
    .set({
      status: "rejected",
      notes: input.notes?.trim() || request.notes,
      rejectedAt: now,
      reviewedAt: now,
      reviewedByUserId: input.reviewedByUserId,
      updatedAt: now,
    })
    .where(eq(affiliateWithdrawalRequest.id, request.id))
    .returning();

  return updated ?? request;
}

async function finalizeAffiliateWithdrawalPayout(input: {
  withdrawalRequest: typeof affiliateWithdrawalRequest.$inferSelect;
  createdByUserId: string;
  destinationType: "manual" | "stripe_connect";
  paymentMethodId?: string | null;
  providerAccountId?: string | null;
  externalReference?: string | null;
  notes?: string | null;
  stripeTransferId?: string | null;
  selection?: Awaited<ReturnType<typeof selectCommissionEventsForWithdrawal>>;
}) {
  const selection =
    input.selection ??
    (await selectCommissionEventsForWithdrawal({
      affiliateUserId: input.withdrawalRequest.affiliateUserId,
      amountLimit: input.withdrawalRequest.amount,
    }));

  const payoutId = crypto.randomUUID();
  const paidAt = new Date();
  const provisionalCurrency = selection.currency ?? input.withdrawalRequest.currency;

  await db.insert(affiliatePayout).values({
    id: payoutId,
    affiliateUserId: input.withdrawalRequest.affiliateUserId,
    withdrawalRequestId: input.withdrawalRequest.id,
    destinationType: input.destinationType,
    providerAccountId: input.providerAccountId ?? null,
    paymentMethodId: input.paymentMethodId ?? null,
    amount: 0,
    currency: provisionalCurrency,
    eventCount: 0,
    status: "processing",
    externalReference: input.externalReference ?? null,
    stripeTransferId: input.stripeTransferId ?? null,
    notes: input.notes ?? null,
    createdByUserId: input.createdByUserId,
    paidAt,
  });

  const claimedEvents = await claimCommissionEventsForPayout({
    affiliateUserId: input.withdrawalRequest.affiliateUserId,
    payoutId,
    eventIds: selection.selected.map((row) => row.id),
    paidAt,
  });

  if (claimedEvents.length !== selection.selected.length) {
    await releaseCommissionEventsFromPayout(payoutId);
    await db.delete(affiliatePayout).where(eq(affiliatePayout.id, payoutId));
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Affiliate balance changed before the payout could be settled",
    });
  }

  const amount = selection.amount;
  const currency = selection.currency ?? provisionalCurrency;

  const [payout] = await db
    .update(affiliatePayout)
    .set({
      amount,
      currency,
      eventCount: claimedEvents.length,
      status: "paid",
      updatedAt: new Date(),
    })
    .where(eq(affiliatePayout.id, payoutId))
    .returning();

  const [updatedRequest] = await db
    .update(affiliateWithdrawalRequest)
    .set({
      status: "paid",
      externalReference: input.externalReference ?? input.withdrawalRequest.externalReference,
      providerTransferId:
        input.stripeTransferId ?? input.withdrawalRequest.providerTransferId,
      notes: input.notes ?? input.withdrawalRequest.notes,
      paidAt,
      reviewedAt: paidAt,
      reviewedByUserId: input.createdByUserId,
      updatedAt: paidAt,
    })
    .where(eq(affiliateWithdrawalRequest.id, input.withdrawalRequest.id))
    .returning();

  return {
    payout: payout ?? null,
    withdrawalRequest: updatedRequest ?? input.withdrawalRequest,
  };
}

export async function markAffiliateManualWithdrawalPaid(input: {
  withdrawalRequestId: string;
  reviewedByUserId: string;
  paymentMethodId?: string | null;
  externalReference?: string | null;
  notes?: string | null;
}) {
  const [request] = await db
    .select()
    .from(affiliateWithdrawalRequest)
    .where(eq(affiliateWithdrawalRequest.id, input.withdrawalRequestId))
    .limit(1);

  if (!request) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Withdrawal request not found",
    });
  }

  if (!["pending", "approved"].includes(request.status)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Withdrawal request cannot be paid",
    });
  }

  const paymentMethods = await getAffiliatePaymentMethods(request.affiliateUserId);
  const selectedPaymentMethod = input.paymentMethodId
    ? paymentMethods.find((row) => row.id === input.paymentMethodId) ?? null
    : paymentMethods.find((row) => row.id === request.paymentMethodId) ??
      paymentMethods.find((row) => row.isDefault) ??
      paymentMethods[0] ??
      null;

  if (!selectedPaymentMethod) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Affiliate has no manual payout method on file",
    });
  }

  return finalizeAffiliateWithdrawalPayout({
    withdrawalRequest: request,
    createdByUserId: input.reviewedByUserId,
    destinationType: "manual",
    paymentMethodId: selectedPaymentMethod.id,
    externalReference: input.externalReference ?? null,
    notes: input.notes ?? null,
  });
}

export async function sendAffiliateStripeWithdrawal(input: {
  withdrawalRequestId: string;
  reviewedByUserId: string;
  notes?: string | null;
}) {
  const [request] = await db
    .select()
    .from(affiliateWithdrawalRequest)
    .where(eq(affiliateWithdrawalRequest.id, input.withdrawalRequestId))
    .limit(1);

  if (!request) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Withdrawal request not found",
    });
  }

  if (!["pending", "approved"].includes(request.status)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Withdrawal request cannot be paid",
    });
  }

  const providerAccount = await getAffiliateProviderAccountRow(request.affiliateUserId);
  if (!providerAccount?.providerAccountId || !providerAccount.payoutsEnabled) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Stripe Connect payouts are not enabled for this affiliate",
    });
  }

  const selection = await selectCommissionEventsForWithdrawal({
    affiliateUserId: request.affiliateUserId,
    amountLimit: request.amount,
  });

  if (selection.amount !== request.amount) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Affiliate balance changed since this withdrawal was approved",
    });
  }

  const transfer = await createStripeTransfer({
    accountId: providerAccount.providerAccountId,
    amount: selection.amount,
    currency: selection.currency,
    description: `Affiliate payout ${request.id}`,
    metadata: {
      affiliate_user_id: request.affiliateUserId,
      withdrawal_request_id: request.id,
    },
  });

  try {
    return finalizeAffiliateWithdrawalPayout({
      withdrawalRequest: request,
      createdByUserId: input.reviewedByUserId,
      destinationType: "stripe_connect",
      providerAccountId: providerAccount.id,
      stripeTransferId: transfer.id,
      notes: input.notes ?? null,
      selection,
    });
  } catch (error) {
    // The transfer exists at this point, so preserve the request for manual reconciliation.
    await db
      .update(affiliateWithdrawalRequest)
      .set({
        status: "failed",
        providerTransferId: transfer.id,
        notes: input.notes?.trim() || request.notes,
        reviewedAt: new Date(),
        reviewedByUserId: input.reviewedByUserId,
        updatedAt: new Date(),
      })
      .where(eq(affiliateWithdrawalRequest.id, request.id));
    throw error;
  }
}

export async function saveAffiliatePaymentMethod(input: {
  affiliateUserId: string;
  paymentMethodId?: string | null;
  methodType: string;
  label: string;
  recipientName?: string | null;
  details: string;
  isDefault?: boolean;
}) {
  const profile = await getApprovedAffiliateProfile(input.affiliateUserId);
  if (!profile) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Affiliate access required",
    });
  }

  let savedMethod: typeof affiliatePaymentMethod.$inferSelect | null = null;

  if (input.paymentMethodId) {
    const [existing] = await db
      .select()
      .from(affiliatePaymentMethod)
      .where(
        and(
          eq(affiliatePaymentMethod.id, input.paymentMethodId),
          eq(affiliatePaymentMethod.affiliateUserId, input.affiliateUserId)
        )
      )
      .limit(1);

    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Payment method not found",
      });
    }

    const [updated] = await db
      .update(affiliatePaymentMethod)
      .set({
        methodType: input.methodType,
        label: input.label,
        recipientName: input.recipientName ?? null,
        details: input.details,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(affiliatePaymentMethod.id, existing.id))
      .returning();

    savedMethod = updated ?? null;
  } else {
    const [inserted] = await db
      .insert(affiliatePaymentMethod)
      .values({
        id: crypto.randomUUID(),
        affiliateUserId: input.affiliateUserId,
        methodType: input.methodType,
        label: input.label,
        recipientName: input.recipientName ?? null,
        details: input.details,
      })
      .returning();

    savedMethod = inserted ?? null;
  }

  if (!savedMethod) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to save payment method",
    });
  }

  const existingMethods = await getAffiliatePaymentMethods(input.affiliateUserId);
  const existingDefault = existingMethods.find(
    (row) => row.id !== savedMethod!.id && row.isDefault
  );
  const defaultMethodId =
    input.isDefault || !existingDefault ? savedMethod.id : existingDefault.id;

  await db
    .update(affiliatePaymentMethod)
    .set({
      isDefault: false,
      updatedAt: new Date(),
    })
    .where(eq(affiliatePaymentMethod.affiliateUserId, input.affiliateUserId));

  await db
    .update(affiliatePaymentMethod)
    .set({
      isDefault: true,
      updatedAt: new Date(),
    })
    .where(eq(affiliatePaymentMethod.id, defaultMethodId));

  const methods = await getAffiliatePaymentMethods(input.affiliateUserId);
  return methods.find((row) => row.id === savedMethod.id) ?? savedMethod;
}

export async function deleteAffiliatePaymentMethod(input: {
  affiliateUserId: string;
  paymentMethodId: string;
}) {
  const profile = await getApprovedAffiliateProfile(input.affiliateUserId);
  if (!profile) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Affiliate access required",
    });
  }

  const [existing] = await db
    .select()
    .from(affiliatePaymentMethod)
    .where(
      and(
        eq(affiliatePaymentMethod.id, input.paymentMethodId),
        eq(affiliatePaymentMethod.affiliateUserId, input.affiliateUserId)
      )
    )
    .limit(1);

  if (!existing) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Payment method not found",
    });
  }

  await db
    .delete(affiliatePaymentMethod)
    .where(eq(affiliatePaymentMethod.id, existing.id));

  const remainingMethods = await getAffiliatePaymentMethods(input.affiliateUserId);
  if (remainingMethods.length > 0 && !remainingMethods.some((row) => row.isDefault)) {
    await db
      .update(affiliatePaymentMethod)
      .set({
        isDefault: true,
        updatedAt: new Date(),
      })
      .where(eq(affiliatePaymentMethod.id, remainingMethods[0].id));
  }

  return {
    success: true,
  };
}

export async function setDefaultAffiliatePaymentMethod(input: {
  affiliateUserId: string;
  paymentMethodId: string;
}) {
  const profile = await getApprovedAffiliateProfile(input.affiliateUserId);
  if (!profile) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Affiliate access required",
    });
  }

  const [method] = await db
    .select()
    .from(affiliatePaymentMethod)
    .where(
      and(
        eq(affiliatePaymentMethod.id, input.paymentMethodId),
        eq(affiliatePaymentMethod.affiliateUserId, input.affiliateUserId),
        eq(affiliatePaymentMethod.isActive, true)
      )
    )
    .limit(1);

  if (!method) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Payment method not found",
    });
  }

  await db
    .update(affiliatePaymentMethod)
    .set({
      isDefault: false,
      updatedAt: new Date(),
    })
    .where(eq(affiliatePaymentMethod.affiliateUserId, input.affiliateUserId));

  const [updated] = await db
    .update(affiliatePaymentMethod)
    .set({
      isDefault: true,
      updatedAt: new Date(),
    })
    .where(eq(affiliatePaymentMethod.id, method.id))
    .returning();

  return updated ?? method;
}

export async function listAffiliatePayoutQueue() {
  const affiliates = await db
    .select({
      profile: affiliateProfile,
      user: {
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
        username: userTable.username,
      },
    })
    .from(affiliateProfile)
    .innerJoin(userTable, eq(affiliateProfile.userId, userTable.id))
    .where(and(eq(affiliateProfile.isActive, true)))
    .orderBy(desc(affiliateProfile.approvedAt), desc(affiliateProfile.createdAt));

  const queue = await Promise.all(
    affiliates
      .filter((entry) => Boolean(entry.profile.approvedAt))
      .map(async (entry) => {
      const synced = await syncAffiliateTierState(entry.user.id);
      const profile = synced?.profile ?? entry.profile;
      const paymentMethods = await getAffiliatePaymentMethods(entry.user.id);
      const payouts = await getAffiliatePayoutRows(entry.user.id);
      const unpaidEvents = await getUnpaidAffiliateCommissionEvents(entry.user.id);
      const providerAccount = await getAffiliateProviderAccountRow(entry.user.id);
      const withdrawalRequests = await getAffiliateWithdrawalRequestRows(entry.user.id);
      const offers = await getAffiliateOfferRows(entry.user.id);
      const trackingLinks = await getAffiliateTrackingLinkRows(entry.user.id);
      const summary = buildAffiliatePayoutSummary({
        unpaidEvents,
        payouts,
      });
      const defaultOffer = offers.find((row) => row.isDefault) ?? offers[0] ?? null;
      const defaultLink =
        trackingLinks.find((row) => row.isDefault) ?? trackingLinks[0] ?? null;
      const offerLookup = new Map(offers.map((row) => [row.id, row]));

      return {
        affiliate: {
          id: entry.user.id,
          name: entry.user.name,
          email: entry.user.email,
          username: entry.user.username,
          code: profile.code,
          commissionBps: profile.commissionBps,
          tierKey: normalizeAffiliateTierKey(profile.tierKey),
        },
        tier:
          synced?.tier ??
          buildAffiliateTierSnapshot({
            profile,
            referredRevenueAmount: 0,
            discountBasisPoints:
              defaultOffer?.discountBasisPoints ??
              AFFILIATE_TIER_CONFIG[
                normalizeAffiliateTierKey(profile.tierKey)
              ].defaultDiscountBasisPoints,
          }),
        premiumAccess: {
          isActive: Boolean(synced?.premiumOverride),
          planKey:
            synced?.premiumOverride?.planKey ?? AFFILIATE_PREMIUM_PLAN_KEY,
          sourceType:
            synced?.premiumOverride?.sourceType ??
            AFFILIATE_TIER_OVERRIDE_SOURCE,
          endsAt: synced?.premiumOverride?.endsAt ?? null,
        },
        paymentMethods,
        manualPaymentMethods: paymentMethods,
        stripeConnect: providerAccount
          ? {
              id: providerAccount.id,
              accountId: providerAccount.providerAccountId,
              provider: providerAccount.provider,
              onboardingStatus: providerAccount.onboardingStatus,
              statusLabel: buildStripeConnectStatusLabel(providerAccount),
              payoutsEnabled: providerAccount.payoutsEnabled,
              chargesEnabled: providerAccount.chargesEnabled,
            }
          : null,
        defaultPaymentMethod:
          paymentMethods.find((row) => row.isDefault) ?? paymentMethods[0] ?? null,
        defaultOffer,
        offers,
        defaultLink: defaultLink
          ? {
              ...defaultLink,
              shareUrl: buildAffiliateShareUrl({
                affiliateCode: profile.code,
                username: entry.user.username,
                groupSlug: defaultLink.affiliateGroupSlug ?? null,
                offerCode:
                  defaultLink.affiliateOfferId &&
                  offerLookup.get(defaultLink.affiliateOfferId)
                    ? offerLookup.get(defaultLink.affiliateOfferId)!.code
                    : null,
                trackingLinkSlug: defaultLink.slug,
                destinationPath: defaultLink.destinationPath,
              }),
            }
          : null,
        links: trackingLinks.map((link) => ({
          ...link,
          shareUrl: buildAffiliateShareUrl({
            affiliateCode: profile.code,
            username: entry.user.username,
            groupSlug: link.affiliateGroupSlug ?? null,
            offerCode:
              link.affiliateOfferId && offerLookup.get(link.affiliateOfferId)
                ? offerLookup.get(link.affiliateOfferId)!.code
                : null,
            trackingLinkSlug: link.slug,
            destinationPath: link.destinationPath,
          }),
        })),
        summary,
        withdrawalRequests: withdrawalRequests.map((row) => ({
          ...row.request,
          amountUsd: row.request.amount,
          destinationLabel: buildWithdrawalDestinationLabel({
            destinationType: row.request.destinationType,
            paymentMethod: row.paymentMethod,
            providerAccount: row.providerAccount,
          }),
          providerAccount: row.providerAccount
            ? {
                id: row.providerAccount.id,
                provider: row.providerAccount.provider,
                onboardingStatus: row.providerAccount.onboardingStatus,
                payoutsEnabled: row.providerAccount.payoutsEnabled,
              }
            : null,
          paymentMethod: row.paymentMethod
            ? {
                id: row.paymentMethod.id,
                label: row.paymentMethod.label,
                methodType: row.paymentMethod.methodType,
              }
            : null,
        })),
        recentPayouts: payouts.slice(0, 5).map((row) => ({
          ...row.payout,
          amountUsd: row.payout.amount,
          destinationLabel: buildWithdrawalDestinationLabel({
            destinationType: row.payout.destinationType,
            paymentMethod: row.paymentMethod,
            providerAccount: row.providerAccount,
          }),
          paymentMethod: row.paymentMethod
            ? {
                id: row.paymentMethod.id,
                label: row.paymentMethod.label,
                methodType: row.paymentMethod.methodType,
              }
            : null,
        })),
        payouts: payouts.map((row) => ({
          ...row.payout,
          amountUsd: row.payout.amount,
          destinationLabel: buildWithdrawalDestinationLabel({
            destinationType: row.payout.destinationType,
            paymentMethod: row.paymentMethod,
            providerAccount: row.providerAccount,
          }),
          paymentMethod: row.paymentMethod
            ? {
                id: row.paymentMethod.id,
                label: row.paymentMethod.label,
                methodType: row.paymentMethod.methodType,
              }
            : null,
        })),
      };
      })
  );

  return queue.sort(
    (a, b) => b.summary.availableAmount - a.summary.availableAmount
  );
}

export async function recordAffiliatePayout(input: {
  affiliateUserId: string;
  createdByUserId: string;
  paymentMethodId?: string | null;
  externalReference?: string | null;
  notes?: string | null;
}) {
  const profile = await getApprovedAffiliateProfile(input.affiliateUserId);
  if (!profile) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Affiliate not found",
    });
  }

  const unpaidEvents = await getUnpaidAffiliateCommissionEvents(input.affiliateUserId);
  if (unpaidEvents.length === 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No unpaid affiliate commission is available",
    });
  }

  const paymentMethods = await getAffiliatePaymentMethods(input.affiliateUserId);
  const selectedPaymentMethod = input.paymentMethodId
    ? paymentMethods.find((row) => row.id === input.paymentMethodId) ?? null
    : paymentMethods.find((row) => row.isDefault) ?? paymentMethods[0] ?? null;

  if (!selectedPaymentMethod) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Affiliate has no payment method on file",
    });
  }

  const payoutId = crypto.randomUUID();
  const paidAt = new Date();
  const provisionalCurrency =
    unpaidEvents.find((row) => row.currency)?.currency ?? "USD";

  await db.insert(affiliatePayout).values({
    id: payoutId,
    affiliateUserId: input.affiliateUserId,
    paymentMethodId: selectedPaymentMethod.id,
    amount: 0,
    currency: provisionalCurrency,
    eventCount: 0,
    status: "processing",
    externalReference: input.externalReference ?? null,
    notes: input.notes ?? null,
    createdByUserId: input.createdByUserId,
    paidAt,
  });

  const claimedEvents = await db
    .update(affiliateCommissionEvent)
    .set({
      affiliatePayoutId: payoutId,
      paidOutAt: paidAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(affiliateCommissionEvent.affiliateUserId, input.affiliateUserId),
        isNull(affiliateCommissionEvent.affiliatePayoutId)
      )
    )
    .returning();

  if (claimedEvents.length === 0) {
    await db.delete(affiliatePayout).where(eq(affiliatePayout.id, payoutId));

    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No unpaid affiliate commission is available",
    });
  }

  const amount = claimedEvents.reduce(
    (sum: number, row: (typeof claimedEvents)[number]) =>
      sum + (row.commissionAmount ?? 0),
    0
  );
  const currency =
    claimedEvents.find((row: (typeof claimedEvents)[number]) => row.currency)
      ?.currency ?? provisionalCurrency;

  const [payout] = await db
    .update(affiliatePayout)
    .set({
      amount,
      currency,
      eventCount: claimedEvents.length,
      status: "paid",
      updatedAt: new Date(),
    })
    .where(eq(affiliatePayout.id, payoutId))
    .returning();

  if (!payout) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to record payout",
    });
  }

  return {
    ...payout,
    paymentMethod: {
      id: selectedPaymentMethod.id,
      label: selectedPaymentMethod.label,
      methodType: selectedPaymentMethod.methodType,
    },
  };
}

type ResolvedGrowthTouchTarget =
  | {
      touchType: "referral";
      referralProfile: typeof referralProfile.$inferSelect;
      referralCode: string;
      affiliateProfile: null;
      affiliateOffer: null;
      trackingLink: null;
      affiliateCode: null;
      affiliateUserId: null;
      affiliateGroupSlug: null;
    }
  | {
      touchType: "affiliate";
      referralProfile: null;
      referralCode: null;
      affiliateProfile: typeof affiliateProfile.$inferSelect;
      affiliateOffer: typeof affiliateOffer.$inferSelect | null;
      trackingLink: typeof affiliateTrackingLink.$inferSelect | null;
      affiliateCode: string;
      affiliateUserId: string;
      affiliateGroupSlug: string | null;
    };

function pendingAttributionMatchesResolvedTouch(
  pending: PendingAttributionRow,
  resolved: ResolvedGrowthTouchTarget
) {
  if (pending.touchType !== resolved.touchType) {
    return false;
  }

  if (resolved.touchType === "referral") {
    return (
      pending.referralProfileId === resolved.referralProfile.id &&
      pending.referralCode === resolved.referralCode
    );
  }

  return (
    pending.affiliateProfileId === resolved.affiliateProfile.id &&
    pending.affiliateOfferId === (resolved.affiliateOffer?.id ?? null) &&
    pending.affiliateTrackingLinkId === (resolved.trackingLink?.id ?? null) &&
    pending.affiliateCode === resolved.affiliateCode &&
    pending.affiliateGroupSlug === resolved.affiliateGroupSlug
  );
}

async function resolveGrowthTouchTarget(input: {
  referralCode?: string | null;
  affiliateCode?: string | null;
  affiliateOfferCode?: string | null;
  affiliateTrackingLinkSlug?: string | null;
  affiliateGroupSlug?: string | null;
}) {
  const referralCode = input.referralCode
    ? normalizeGrowthCode(input.referralCode)
    : "";
  const rawAffiliateCode = input.affiliateCode?.trim() ?? "";
  const affiliateCode = rawAffiliateCode
    ? normalizeGrowthCode(rawAffiliateCode)
    : "";
  const affiliateOfferCode = input.affiliateOfferCode
    ? normalizeGrowthCode(input.affiliateOfferCode)
    : "";

  if (referralCode && (rawAffiliateCode || affiliateOfferCode)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Use either a referral code or an affiliate code, not both",
    });
  }

  if (referralCode) {
    const [profile] = await db
      .select()
      .from(referralProfile)
      .where(
        and(eq(referralProfile.code, referralCode), eq(referralProfile.isActive, true))
      )
      .limit(1);

    if (!profile) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid referral code",
      });
    }

    return {
      touchType: "referral" as const,
      referralProfile: profile,
      referralCode,
      affiliateProfile: null,
      affiliateOffer: null,
      trackingLink: null,
      affiliateCode: null,
      affiliateUserId: null,
      affiliateGroupSlug: null,
    };
  }

  let offer: typeof affiliateOffer.$inferSelect | null = null;
  if (affiliateOfferCode) {
    offer = await getAffiliateOfferByCode(affiliateOfferCode);
    if (!offer) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid affiliate offer code",
      });
    }
  }

  let profile: typeof affiliateProfile.$inferSelect | null = null;
  if (offer) {
    const [row] = await db
      .select()
      .from(affiliateProfile)
      .where(
        and(
          eq(affiliateProfile.id, offer.affiliateProfileId),
          eq(affiliateProfile.isActive, true)
        )
      )
      .limit(1);
    profile = row ?? null;
  } else if (rawAffiliateCode) {
    profile = await getApprovedAffiliateProfileByCode(rawAffiliateCode);
  }

  const approvedProfile =
    profile && profile.approvedAt && profile.isActive ? profile : null;
  if (!approvedProfile) {
    return null;
  }

  if (affiliateCode && approvedProfile.code !== affiliateCode && offer) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Affiliate offer code does not match affiliate link",
    });
  }

  let trackingLink: typeof affiliateTrackingLink.$inferSelect | null = null;
  if (input.affiliateTrackingLinkSlug?.trim()) {
    const [row] = await db
      .select()
      .from(affiliateTrackingLink)
      .where(
        and(
          eq(affiliateTrackingLink.affiliateProfileId, approvedProfile.id),
          eq(
            affiliateTrackingLink.slug,
            input.affiliateTrackingLinkSlug.trim().toLowerCase()
          ),
          eq(affiliateTrackingLink.isActive, true)
        )
      )
      .limit(1);
    trackingLink = row ?? null;
  }

  return {
    touchType: "affiliate" as const,
    referralProfile: null,
    referralCode: null,
    affiliateProfile: approvedProfile,
    affiliateOffer:
      offer ??
      (trackingLink?.affiliateOfferId
        ? (await db
            .select()
            .from(affiliateOffer)
            .where(eq(affiliateOffer.id, trackingLink.affiliateOfferId))
            .limit(1))[0] ?? null
        : null),
    trackingLink,
    affiliateCode: approvedProfile.code,
    affiliateUserId: approvedProfile.userId,
    affiliateGroupSlug:
      input.affiliateGroupSlug?.trim() || trackingLink?.affiliateGroupSlug || null,
  };
}

export async function captureGrowthTouch(input: {
  visitorToken: string;
  sourcePath?: string | null;
  referralCode?: string | null;
  affiliateCode?: string | null;
  affiliateOfferCode?: string | null;
  channel?: string | null;
  affiliateTrackingLinkSlug?: string | null;
  affiliateGroupSlug?: string | null;
  referrerUrl?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  if (!input.visitorToken.trim()) {
    return null;
  }

  const resolved = await resolveGrowthTouchTarget(input);
  if (!resolved) {
    return null;
  }

  const now = new Date();
  const channel = input.channel?.trim().toLowerCase() || null;
  const touchMetadata = {
    ...(input.metadata ?? {}),
    ...(channel ? { channel } : {}),
  };

  await db.insert(affiliateTouchEvent).values({
    id: crypto.randomUUID(),
    visitorToken: input.visitorToken,
    touchType: resolved.touchType,
    affiliateProfileId: resolved.affiliateProfile?.id ?? null,
    affiliateUserId: resolved.affiliateUserId,
    referralProfileId: resolved.referralProfile?.id ?? null,
    affiliateOfferId: resolved.affiliateOffer?.id ?? null,
    affiliateTrackingLinkId: resolved.trackingLink?.id ?? null,
    affiliateCode: resolved.affiliateCode,
    referralCode: resolved.referralCode,
    affiliateGroupSlug: resolved.affiliateGroupSlug,
    sourcePath: normalizeDestinationPath(input.sourcePath),
    referrerUrl: input.referrerUrl?.trim() || null,
    metadata: Object.keys(touchMetadata).length > 0 ? touchMetadata : null,
    createdAt: now,
  });

  const [existingPending] = await db
    .select()
    .from(affiliatePendingAttribution)
    .where(eq(affiliatePendingAttribution.visitorToken, input.visitorToken))
    .limit(1);

  if (existingPending && isPendingAttributionActive(existingPending, now)) {
    if (pendingAttributionMatchesResolvedTouch(existingPending, resolved)) {
      const [updated] = await db
        .update(affiliatePendingAttribution)
        .set({
          lastTouchedAt: now,
          metadata: Object.keys(touchMetadata).length > 0 ? touchMetadata : null,
          updatedAt: now,
        })
        .where(eq(affiliatePendingAttribution.id, existingPending.id))
        .returning();

      return updated ?? existingPending;
    }
  }

  const pendingPayload = {
    status: "pending",
    touchType: resolved.touchType,
    affiliateProfileId: resolved.affiliateProfile?.id ?? null,
    affiliateUserId: resolved.affiliateUserId,
    referralProfileId: resolved.referralProfile?.id ?? null,
    affiliateOfferId: resolved.affiliateOffer?.id ?? null,
    affiliateTrackingLinkId: resolved.trackingLink?.id ?? null,
    affiliateCode: resolved.affiliateCode,
    referralCode: resolved.referralCode,
    affiliateGroupSlug: resolved.affiliateGroupSlug,
    firstTouchedAt: now,
    lastTouchedAt: now,
    expiresAt: buildAttributionExpiryDate(now),
    claimedUserId: null,
    claimedAt: null,
    metadata: Object.keys(touchMetadata).length > 0 ? touchMetadata : null,
    updatedAt: now,
  };

  if (existingPending) {
    const [updated] = await db
      .update(affiliatePendingAttribution)
      .set(pendingPayload)
      .where(eq(affiliatePendingAttribution.id, existingPending.id))
      .returning();
    return updated ?? existingPending;
  }

  const [inserted] = await db
    .insert(affiliatePendingAttribution)
    .values({
      id: crypto.randomUUID(),
      visitorToken: input.visitorToken,
      ...pendingPayload,
    })
    .returning();

  return inserted ?? null;
}

function resolvePaidReferralOrderReference(order: {
  id: string;
  providerOrderId: string | null;
  providerInvoiceId: string | null;
  stripeInvoiceId: string | null;
}) {
  return (
    order.providerOrderId ??
    order.providerInvoiceId ??
    order.stripeInvoiceId ??
    order.id
  );
}

async function backfillReferralConversionPaidStatus(userId: string) {
  const [paidOrder] = await db
    .select({
      id: billingOrder.id,
      providerOrderId: billingOrder.providerOrderId,
      providerInvoiceId: billingOrder.providerInvoiceId,
      stripeInvoiceId: billingOrder.stripeInvoiceId,
      providerSubscriptionId: billingOrder.providerSubscriptionId,
      paidAt: billingOrder.paidAt,
      updatedAt: billingOrder.updatedAt,
      createdAt: billingOrder.createdAt,
    })
    .from(billingOrder)
    .where(and(eq(billingOrder.userId, userId), eq(billingOrder.paid, true)))
    .orderBy(
      desc(billingOrder.paidAt),
      desc(billingOrder.updatedAt),
      desc(billingOrder.createdAt)
    )
    .limit(1);

  if (!paidOrder) {
    return null;
  }

  return markReferralConversionPaid({
    referredUserId: userId,
    orderId: resolvePaidReferralOrderReference(paidOrder),
    subscriptionId: paidOrder.providerSubscriptionId ?? null,
    paidAt: paidOrder.paidAt ?? paidOrder.updatedAt ?? paidOrder.createdAt,
  });
}

export async function claimPendingGrowthAttribution(input: {
  userId: string;
  visitorToken?: string | null;
  source?: string | null;
}) {
  if (!input.visitorToken?.trim()) {
    return {
      referral: null,
      affiliate: null,
      pending: null,
    };
  }

  const now = new Date();
  const [pending] = await db
    .select()
    .from(affiliatePendingAttribution)
    .where(eq(affiliatePendingAttribution.visitorToken, input.visitorToken.trim()))
    .limit(1);

  if (!pending || pending.expiresAt.getTime() <= now.getTime()) {
    return {
      referral: null,
      affiliate: null,
      pending: pending ?? null,
    };
  }

  const [existingReferral] = await db
    .select()
    .from(referralConversion)
    .where(eq(referralConversion.referredUserId, input.userId))
    .limit(1);
  const [existingAffiliate] = await db
    .select()
    .from(affiliateAttribution)
    .where(eq(affiliateAttribution.referredUserId, input.userId))
    .limit(1);

  let referral: typeof referralConversion.$inferSelect | null =
    existingReferral ?? null;
  let affiliate: typeof affiliateAttribution.$inferSelect | null =
    existingAffiliate ?? null;
  let pendingStatus = "claimed";
  let pendingMetadata =
    pending.metadata && typeof pending.metadata === "object"
      ? { ...(pending.metadata as Record<string, unknown>) }
      : null;

  if (!referral && !affiliate) {
    if (pending.touchType === "referral" && pending.referralCode) {
      try {
        referral = await attachReferralConversionToUser({
          userId: input.userId,
          referralCode: pending.referralCode,
          source: input.source ?? "claim",
        });
      } catch (error) {
        const ignoredReason = getIgnoredGrowthClaimReason(error);
        if (!ignoredReason) {
          throw error;
        }

        pendingStatus = "ignored";
        pendingMetadata = {
          ...(pendingMetadata ?? {}),
          ignoredReason,
        };
      }
    }

    if (pending.touchType === "affiliate" && pending.affiliateCode) {
      try {
        affiliate = await attachAffiliateAttributionToUser({
          userId: input.userId,
          affiliateCode: pending.affiliateCode,
          affiliateOfferId: pending.affiliateOfferId ?? null,
          affiliateTrackingLinkId: pending.affiliateTrackingLinkId ?? null,
          source: input.source ?? "claim",
        });
      } catch (error) {
        const ignoredReason = getIgnoredGrowthClaimReason(error);
        if (!ignoredReason) {
          throw error;
        }

        pendingStatus = "ignored";
        pendingMetadata = {
          ...(pendingMetadata ?? {}),
          ignoredReason,
        };
      }
    }
  }

  if (referral && referral.status !== "paid") {
    referral = (await backfillReferralConversionPaidStatus(input.userId)) ?? referral;
  }

  await db
    .update(affiliatePendingAttribution)
    .set({
      status: pendingStatus,
      claimedUserId: input.userId,
      claimedAt: now,
      metadata: pendingMetadata,
      updatedAt: now,
    })
    .where(eq(affiliatePendingAttribution.id, pending.id));

  return {
    referral,
    affiliate,
    pending,
  };
}

export async function ensureAffiliateOfferForCheckout(input: {
  userId: string;
  affiliateOfferCode: string;
}) {
  const offer = await getAffiliateOfferByCode(input.affiliateOfferCode);
  if (!offer) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid affiliate discount code",
    });
  }

  const profile = await getApprovedAffiliateProfile(offer.affiliateUserId);
  if (!profile) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Affiliate offer is not active",
    });
  }

  const [existingReferral] = await db
    .select()
    .from(referralConversion)
    .where(eq(referralConversion.referredUserId, input.userId))
    .limit(1);
  if (existingReferral) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A referral is already attached to this account",
    });
  }

  const [existingAffiliate] = await db
    .select()
    .from(affiliateAttribution)
    .where(eq(affiliateAttribution.referredUserId, input.userId))
    .limit(1);

  if (existingAffiliate && existingAffiliate.affiliateUserId !== offer.affiliateUserId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This account is already attributed to another affiliate",
    });
  }

  const attribution =
    existingAffiliate ??
    (await attachAffiliateAttributionToUser({
      userId: input.userId,
      affiliateCode: profile.code,
      affiliateOfferId: offer.id,
      source: "checkout",
    }));

  return {
    offer,
    attribution,
  };
}

export async function getAffiliateCheckoutAttribution(userId: string) {
  const [attribution] = await db
    .select()
    .from(affiliateAttribution)
    .where(eq(affiliateAttribution.referredUserId, userId))
    .limit(1);

  if (!attribution) {
    return {
      attribution: null,
      offer: null,
    };
  }

  const offer = attribution.affiliateOfferId
    ? (
        await db
          .select()
          .from(affiliateOffer)
          .where(
            and(
              eq(affiliateOffer.id, attribution.affiliateOfferId),
              eq(affiliateOffer.isActive, true)
            )
          )
          .limit(1)
      )[0] ?? null
    : null;

  return {
    attribution,
    offer,
  };
}

export async function attachReferralConversionToUser(input: {
  userId: string;
  referralCode: string;
  source?: string | null;
}) {
  const normalized = normalizeGrowthCode(input.referralCode);
  if (!normalized) {
    return null;
  }

  const [existingReferral] = await db
    .select()
    .from(referralConversion)
    .where(eq(referralConversion.referredUserId, input.userId))
    .limit(1);

  if (existingReferral) {
    return (
      (existingReferral.status === "paid"
        ? existingReferral
        : await backfillReferralConversionPaidStatus(input.userId)) ?? existingReferral
    );
  }

  const [existingAffiliate] = await db
    .select()
    .from(affiliateAttribution)
    .where(eq(affiliateAttribution.referredUserId, input.userId))
    .limit(1);

  if (existingAffiliate) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "An affiliate invite is already attached to this account",
    });
  }

  const [profile] = await db
    .select()
    .from(referralProfile)
    .where(
      and(eq(referralProfile.code, normalized), eq(referralProfile.isActive, true))
    )
    .limit(1);

  if (!profile) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid referral code",
    });
  }

  if (profile.userId === input.userId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "You cannot refer yourself",
    });
  }

  const [inserted] = await db
    .insert(referralConversion)
    .values({
      id: crypto.randomUUID(),
      referralProfileId: profile.id,
      referrerUserId: profile.userId,
      referredUserId: input.userId,
      referralCode: normalized,
      source: input.source?.trim() || "app",
    })
    .returning();

  if (!inserted) {
    return null;
  }

  return (await backfillReferralConversionPaidStatus(input.userId)) ?? inserted;
}

async function joinAffiliateGroupIfNeeded(input: {
  userId: string;
  groupId: string;
  source?: string | null;
}) {
  const existingMembership = await db
    .select()
    .from(affiliateGroupMember)
    .where(eq(affiliateGroupMember.userId, input.userId))
    .limit(1);

  if (existingMembership[0]) {
    return existingMembership[0];
  }

  const [inserted] = await db
    .insert(affiliateGroupMember)
    .values({
      id: crypto.randomUUID(),
      affiliateGroupId: input.groupId,
      userId: input.userId,
      source: input.source?.trim() || "open_link",
    })
    .onConflictDoNothing({
      target: [affiliateGroupMember.affiliateGroupId, affiliateGroupMember.userId],
    })
    .returning();

  return inserted ?? null;
}

export async function attachAffiliateAttributionToUser(input: {
  userId: string;
  affiliateCode: string;
  affiliateOfferId?: string | null;
  affiliateTrackingLinkId?: string | null;
  source?: string | null;
}) {
  if (!input.affiliateCode.trim()) {
    return null;
  }

  const [existingAffiliate] = await db
    .select()
    .from(affiliateAttribution)
    .where(eq(affiliateAttribution.referredUserId, input.userId))
    .limit(1);

  if (existingAffiliate) {
    return existingAffiliate;
  }

  const [existingReferral] = await db
    .select()
    .from(referralConversion)
    .where(eq(referralConversion.referredUserId, input.userId))
    .limit(1);

  if (existingReferral) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A referral invite is already attached to this account",
    });
  }

  const approvedProfile = await getApprovedAffiliateProfileByCode(input.affiliateCode);
  if (!approvedProfile) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid affiliate code",
    });
  }

  if (approvedProfile.userId === input.userId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "You cannot use your own affiliate link",
    });
  }

  const [inserted] = await db
    .insert(affiliateAttribution)
    .values({
      id: crypto.randomUUID(),
      affiliateProfileId: approvedProfile.id,
      affiliateUserId: approvedProfile.userId,
      referredUserId: input.userId,
      affiliateCode: approvedProfile.code,
      affiliateOfferId: input.affiliateOfferId ?? null,
      affiliateTrackingLinkId: input.affiliateTrackingLinkId ?? null,
      affiliateGroupId: null,
      metadata: {
        source: input.source?.trim() || "app",
        affiliateOfferId: input.affiliateOfferId ?? null,
        affiliateTrackingLinkId: input.affiliateTrackingLinkId ?? null,
      },
    })
    .returning();

  return inserted ?? null;
}

async function createReferralRewardGrant(input: {
  userId: string;
  rewardType: string;
  sequenceNumber: number;
  conversionCount: number;
  status?: string;
  edgeCredits?: number | null;
  discountProvider?: string | null;
  providerDiscountId?: string | null;
  providerDiscountCode?: string | null;
  targetPlanKey?: string | null;
  overrideStartsAt?: Date | null;
  overrideEndsAt?: Date | null;
  metadata?: Record<string, unknown> | null;
}) {
  const existing = await db
    .select()
    .from(referralRewardGrant)
    .where(
      and(
        eq(referralRewardGrant.userId, input.userId),
        eq(referralRewardGrant.rewardType, input.rewardType),
        eq(referralRewardGrant.sequenceNumber, input.sequenceNumber)
      )
    )
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const [inserted] = await db
    .insert(referralRewardGrant)
    .values({
      id: crypto.randomUUID(),
      userId: input.userId,
      rewardType: input.rewardType,
      sequenceNumber: input.sequenceNumber,
      conversionCount: input.conversionCount,
      status: input.status ?? "granted",
      edgeCredits: input.edgeCredits ?? null,
      discountProvider: input.discountProvider ?? null,
      providerDiscountId: input.providerDiscountId ?? null,
      providerDiscountCode: input.providerDiscountCode ?? null,
      targetPlanKey: input.targetPlanKey ?? null,
      overrideStartsAt: input.overrideStartsAt ?? null,
      overrideEndsAt: input.overrideEndsAt ?? null,
      metadata: input.metadata ?? null,
    })
    .returning();

  return inserted;
}

async function grantEdgeCreditReward(userId: string, sequenceNumber: number) {
  const grant = await createReferralRewardGrant({
    userId,
    rewardType: REWARD_TYPE_EDGE_CREDITS,
    sequenceNumber,
    conversionCount: sequenceNumber * REFERRAL_EDGE_CREDIT_THRESHOLD,
    status: "granted",
    edgeCredits: REFERRAL_EDGE_CREDIT_AMOUNT,
  });

  if (!grant) {
    return null;
  }

  await db
    .insert(edgeCreditGrant)
    .values({
      id: crypto.randomUUID(),
      userId,
      referralRewardGrantId: grant.id,
      amountCredits: REFERRAL_EDGE_CREDIT_AMOUNT,
      remainingCredits: REFERRAL_EDGE_CREDIT_AMOUNT,
    })
    .onConflictDoNothing({
      target: [edgeCreditGrant.referralRewardGrantId],
    });

  return grant;
}

async function createOneMonthDiscount(input: {
  userId: string;
  sequenceNumber: number;
  planKey: BillingPlanKey;
}) {
  const stripe = getStripeClient();
  return stripe.coupons.create({
    duration: "repeating",
    duration_in_months: 1,
    percent_off: 100,
    max_redemptions: 1,
    name: clampStripeDisplayString(
      `Reward ${input.sequenceNumber} ${input.planKey} ${input.userId.slice(0, 8)}`
    ),
    metadata: {
      user_id: input.userId,
      reward_type: REWARD_TYPE_FREE_MONTH,
      reward_sequence: input.sequenceNumber,
      target_plan: input.planKey,
      billing_provider: "stripe",
    },
  });
}

async function grantFreeMonthReward(userId: string, sequenceNumber: number) {
  const existing = await db
    .select()
    .from(referralRewardGrant)
    .where(
      and(
        eq(referralRewardGrant.userId, userId),
        eq(referralRewardGrant.rewardType, REWARD_TYPE_FREE_MONTH),
        eq(referralRewardGrant.sequenceNumber, sequenceNumber)
      )
    )
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const billing = await getEffectiveBillingState(userId);
  const subscriptionPlanKey =
    billing.subscription && isActiveSubscriptionStatus(billing.subscription.status)
      ? (billing.subscription.planKey as BillingPlanKey)
      : null;
  const targetPlanKey =
    subscriptionPlanKey && subscriptionPlanKey !== "student"
      ? subscriptionPlanKey
      : ("professional" as BillingPlanKey);

  const discount = await createOneMonthDiscount({
    userId,
    sequenceNumber,
    planKey: targetPlanKey,
  });

  let status = "available";
  if (
    billing.subscription &&
    subscriptionPlanKey === targetPlanKey &&
    billing.subscription.stripeSubscriptionId
  ) {
    const stripe = getStripeClient();
    await stripe.subscriptions.update(billing.subscription.stripeSubscriptionId, {
      discounts: [
        {
          coupon: discount.id,
        },
      ],
    });
    status = "applied";
  }

  return createReferralRewardGrant({
    userId,
    rewardType: REWARD_TYPE_FREE_MONTH,
    sequenceNumber,
    conversionCount: sequenceNumber * REFERRAL_FREE_MONTH_THRESHOLD,
    status,
    discountProvider: "stripe",
    providerDiscountId: discount.id,
    targetPlanKey,
  });
}

async function grantUpgradeTrialReward(userId: string, sequenceNumber: number) {
  const existing = await db
    .select()
    .from(referralRewardGrant)
    .where(
      and(
        eq(referralRewardGrant.userId, userId),
        eq(referralRewardGrant.rewardType, REWARD_TYPE_UPGRADE_TRIAL),
        eq(referralRewardGrant.sequenceNumber, sequenceNumber)
      )
    )
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const billing = await getEffectiveBillingState(userId);
  const targetPlanKey = getNextBillingPlanKey(billing.activePlanKey);
  if (!targetPlanKey) {
    return null;
  }

  const [latestOverride] = await db
    .select()
    .from(billingEntitlementOverride)
    .where(eq(billingEntitlementOverride.userId, userId))
    .orderBy(desc(billingEntitlementOverride.endsAt))
    .limit(1);

  const now = new Date();
  const startsAt =
    latestOverride?.endsAt && latestOverride.endsAt.getTime() > now.getTime()
      ? latestOverride.endsAt
      : now;
  const endsAt = new Date(
    startsAt.getTime() + REFERRAL_UPGRADE_TRIAL_DAYS * 24 * 60 * 60 * 1000
  );

  const grant = await createReferralRewardGrant({
    userId,
    rewardType: REWARD_TYPE_UPGRADE_TRIAL,
    sequenceNumber,
    conversionCount: sequenceNumber * REFERRAL_UPGRADE_TRIAL_THRESHOLD,
    status: "applied",
    targetPlanKey,
    overrideStartsAt: startsAt,
    overrideEndsAt: endsAt,
  });

  if (!grant) {
    return null;
  }

  await db
    .insert(billingEntitlementOverride)
    .values({
      id: crypto.randomUUID(),
      userId,
      sourceType: REWARD_TYPE_UPGRADE_TRIAL,
      sourceRewardGrantId: grant.id,
      planKey: targetPlanKey,
      startsAt,
      endsAt,
    })
    .onConflictDoNothing({
      target: [billingEntitlementOverride.sourceRewardGrantId],
    });

  return grant;
}

export async function ensureReferralRewardsForUser(userId: string) {
  const paidConversions = await db
    .select()
    .from(referralConversion)
    .where(
      and(
        eq(referralConversion.referrerUserId, userId),
        eq(referralConversion.status, "paid")
      )
    );

  const count = paidConversions.length;

  for (
    let sequence = 1;
    sequence <= Math.floor(count / REFERRAL_EDGE_CREDIT_THRESHOLD);
    sequence += 1
  ) {
    await grantEdgeCreditReward(userId, sequence);
  }

  for (
    let sequence = 1;
    sequence <= Math.floor(count / REFERRAL_FREE_MONTH_THRESHOLD);
    sequence += 1
  ) {
    await grantFreeMonthReward(userId, sequence);
  }

  for (
    let sequence = 1;
    sequence <= Math.floor(count / REFERRAL_UPGRADE_TRIAL_THRESHOLD);
    sequence += 1
  ) {
    await grantUpgradeTrialReward(userId, sequence);
  }
}

export async function markReferralConversionPaid(input: {
  referredUserId: string;
  orderId?: string | null;
  subscriptionId?: string | null;
  paidAt?: Date | null;
}) {
  const rows = await db
    .select()
    .from(referralConversion)
    .where(eq(referralConversion.referredUserId, input.referredUserId))
    .limit(1);

  const conversion = rows[0];
  if (!conversion) {
    return null;
  }

  if (conversion.status !== "paid") {
    const [updated] = await db
      .update(referralConversion)
      .set({
        status: "paid",
        paidOrderId: input.orderId ?? conversion.paidOrderId,
        paidSubscriptionId: input.subscriptionId ?? conversion.paidSubscriptionId,
        paidAt: input.paidAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(referralConversion.id, conversion.id))
      .returning();

    await ensureReferralRewardsForUser(conversion.referrerUserId);
    return updated ?? conversion;
  }

  await ensureReferralRewardsForUser(conversion.referrerUserId);
  return conversion;
}

export async function markAffiliateSubscriptionActive(input: {
  referredUserId: string;
  subscriptionId?: string | null;
  activatedAt?: Date | null;
}) {
  const rows = await db
    .select()
    .from(affiliateAttribution)
    .where(eq(affiliateAttribution.referredUserId, input.referredUserId))
    .limit(1);

  const attribution = rows[0];
  if (!attribution) {
    return null;
  }

  const paidAt = input.activatedAt ?? new Date();
  await db
    .update(affiliateAttribution)
    .set({
      status: "active",
      convertedSubscriptionId:
        input.subscriptionId ?? attribution.convertedSubscriptionId,
      firstPaidAt: attribution.firstPaidAt ?? paidAt,
      lastPaidAt: paidAt,
      updatedAt: new Date(),
    })
    .where(eq(affiliateAttribution.id, attribution.id));

  return attribution;
}

export async function recordAffiliateCommissionEvent(input: {
  referredUserId: string;
  provider?: string | null;
  providerOrderId?: string | null;
  providerSubscriptionId?: string | null;
  billingOrderId?: string | null;
  stripeInvoiceId?: string | null;
  stripeSubscriptionId?: string | null;
  affiliateAttributionId?: string | null;
  orderAmount?: number | null;
  subtotalAmount?: number | null;
  discountAmount?: number | null;
  taxAmount?: number | null;
  currency?: string | null;
  planKey?: string | null;
  commissionBps?: number | null;
  metadata?: Record<string, unknown> | null;
  occurredAt?: Date | null;
}) {
  const metadataAttributionId =
    typeof input.metadata?.affiliate_attribution_id === "string"
      ? input.metadata.affiliate_attribution_id
      : null;
  const metadataAffiliateCode =
    typeof input.metadata?.affiliate_code === "string"
      ? input.metadata.affiliate_code
      : null;
  const metadataOfferCode =
    typeof input.metadata?.affiliate_offer_code === "string"
      ? input.metadata.affiliate_offer_code
      : null;
  const metadataOfferId =
    typeof input.metadata?.affiliate_offer_id === "string"
      ? input.metadata.affiliate_offer_id
      : null;
  const metadataTrackingLinkId =
    typeof input.metadata?.affiliate_tracking_link_id === "string"
      ? input.metadata.affiliate_tracking_link_id
      : null;
  const metadataPlanKey =
    typeof input.metadata?.plan_key === "string" ? input.metadata.plan_key : null;

  const resolvedAttributionId =
    input.affiliateAttributionId ?? metadataAttributionId ?? null;
  const attributionRows = resolvedAttributionId
    ? await db
        .select()
        .from(affiliateAttribution)
        .where(eq(affiliateAttribution.id, resolvedAttributionId))
        .limit(1)
    : await db
        .select()
        .from(affiliateAttribution)
        .where(eq(affiliateAttribution.referredUserId, input.referredUserId))
        .limit(1);

  let attribution: typeof affiliateAttribution.$inferSelect | null =
    attributionRows[0] ?? null;
  if (!attribution && (metadataAffiliateCode || metadataOfferCode || metadataOfferId)) {
    const touchContext = await resolveAffiliateTouchContext(
      {
        affiliateCode: metadataAffiliateCode,
        offerCode: metadataOfferCode,
        affiliateOfferId: metadataOfferId,
        affiliateTrackingLinkId: metadataTrackingLinkId,
      },
      { strict: false }
    );

    if (touchContext?.profile) {
      try {
        attribution = await attachAffiliateAttributionToUser({
          userId: input.referredUserId,
          affiliateCode: touchContext.profile.code,
          affiliateOfferId: touchContext.offer?.id ?? null,
          affiliateTrackingLinkId: touchContext.trackingLink?.id ?? null,
          source: "order_metadata",
        });
      } catch (error) {
        if (!(error instanceof TRPCError) || error.code !== "BAD_REQUEST") {
          throw error;
        }
      }
    }
  }

  if (!attribution) {
    return null;
  }

  const provider = input.provider ?? "stripe";
  const providerOrderId = input.providerOrderId ?? input.stripeInvoiceId ?? null;
  if (!providerOrderId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Affiliate commission event requires an order reference",
    });
  }

  const existingEvent = await db
    .select()
    .from(affiliateCommissionEvent)
    .where(
      and(
        eq(affiliateCommissionEvent.provider, provider),
        eq(affiliateCommissionEvent.providerOrderId, providerOrderId)
      )
    )
    .limit(1);

  if (existingEvent[0]) {
    await syncAffiliateTierState(attribution.affiliateUserId);
    return existingEvent[0];
  }

  const commissionBaseAmount =
    input.subtotalAmount != null
      ? Math.max(0, input.subtotalAmount - (input.discountAmount ?? 0))
      : input.orderAmount != null && input.taxAmount != null
      ? Math.max(0, input.orderAmount - input.taxAmount)
      : input.orderAmount ?? 0;
  const [profile] = await db
    .select({
      commissionBps: affiliateProfile.commissionBps,
    })
    .from(affiliateProfile)
    .where(eq(affiliateProfile.id, attribution.affiliateProfileId))
    .limit(1);

  const commissionBps =
    input.commissionBps ?? profile?.commissionBps ?? getAffiliateCommissionBps();
  const commissionAmount = Math.round(
    (commissionBaseAmount * commissionBps) / 10000
  );
  const occurredAt = input.occurredAt ?? new Date();
  const [referredUser] = await db
    .select({
      username: userTable.username,
      email: userTable.email,
    })
    .from(userTable)
    .where(eq(userTable.id, attribution.referredUserId))
    .limit(1);

  const [inserted] = await db
    .insert(affiliateCommissionEvent)
    .values({
      id: crypto.randomUUID(),
      affiliateAttributionId: attribution.id,
      affiliateUserId: attribution.affiliateUserId,
      referredUserId: attribution.referredUserId,
      referredUsername: referredUser?.username ?? null,
      referredEmail: referredUser?.email ?? null,
      provider,
      providerOrderId,
      providerSubscriptionId:
        input.providerSubscriptionId ?? input.stripeSubscriptionId ?? null,
      billingOrderId: input.billingOrderId ?? null,
      stripeInvoiceId: input.stripeInvoiceId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      planKey: input.planKey ?? metadataPlanKey ?? null,
      orderAmount: commissionBaseAmount,
      commissionBps,
      commissionAmount,
      currency: input.currency ?? null,
      occurredAt,
      metadata: input.metadata ?? null,
    })
    .returning();

  await db
    .update(affiliateAttribution)
    .set({
      status: "active",
      firstPaidAt: attribution.firstPaidAt ?? occurredAt,
      lastPaidAt: occurredAt,
      convertedSubscriptionId:
        input.providerSubscriptionId ??
        input.stripeSubscriptionId ??
        attribution.convertedSubscriptionId,
      updatedAt: new Date(),
    })
    .where(eq(affiliateAttribution.id, attribution.id));

  await syncAffiliateTierState(attribution.affiliateUserId);

  return inserted ?? null;
}

export async function getAvailableReferralFreeMonthGrantForPlan(
  userId: string,
  planKey: BillingPlanKey
) {
  const rows = await db
    .select()
    .from(referralRewardGrant)
    .where(
      and(
        eq(referralRewardGrant.userId, userId),
        eq(referralRewardGrant.rewardType, REWARD_TYPE_FREE_MONTH),
        eq(referralRewardGrant.status, "available"),
        eq(referralRewardGrant.targetPlanKey, planKey)
      )
    )
    .orderBy(asc(referralRewardGrant.grantedAt))
    .limit(1);

  return rows[0] ?? null;
}

export const AFFILIATE_PFP_EFFECTS = [
  "none",
  "gold_glow",
  "emerald_pulse",
  "rainbow_ring",
  "frost_aura",
  "shadow_pulse",
  "electric_spark",
  "sakura_ring",
  "neon_pulse",
  "hearts",
  "custom",
] as const;

export const AFFILIATE_NAME_EFFECTS = [
  "none",
  "sparkle",
  "glow",
  "shimmer",
  "gradient_shift",
  "breathe",
] as const;

export const AFFILIATE_NAME_FONTS = [
  "default",
  "serif",
  "mono",
  "display",
  "handwriting",
  "gothic",
  "thin",
  "rounded",
] as const;

export const AFFILIATE_NAME_COLORS = [
  "default",
  "gold",
  "emerald",
  "ocean",
  "sunset",
  "rose",
  "aurora",
  "ice",
  "midnight",
  "fire",
  "neon",
  "custom",
] as const;

export async function updateAffiliateProfileEffects(
  userId: string,
  effects: {
    pfpEffect?: string;
    nameEffect?: string;
    nameFont?: string;
    nameColor?: string;
    badgeLabel?: string;
    effectVariant?: string;
  }
) {
  const profile = await getApprovedAffiliateProfile(userId);
  if (!profile) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Affiliate access required",
    });
  }

  if (
    normalizeAffiliateTierMode(profile.tierMode) !== "manual" ||
    normalizeAffiliateTierKey(profile.tierKey) !== "elite"
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only Elite affiliates can customize proof effects",
    });
  }

  const existingMetadata =
    profile.metadata && typeof profile.metadata === "object"
      ? (profile.metadata as Record<string, unknown>)
      : {};
  const existingPublicProof =
    existingMetadata.publicProof &&
    typeof existingMetadata.publicProof === "object"
      ? (existingMetadata.publicProof as Record<string, unknown>)
      : { badgeLabel: "Affiliate", effectVariant: "gold-emerald" };

  const updatedPublicProof = { ...existingPublicProof };

  if (effects.pfpEffect !== undefined) updatedPublicProof.pfpEffect = effects.pfpEffect;
  if (effects.nameEffect !== undefined) updatedPublicProof.nameEffect = effects.nameEffect;
  if (effects.nameFont !== undefined) updatedPublicProof.nameFont = effects.nameFont;
  if (effects.nameColor !== undefined) updatedPublicProof.nameColor = effects.nameColor;
  if (effects.badgeLabel !== undefined) updatedPublicProof.badgeLabel = effects.badgeLabel;
  if (effects.effectVariant !== undefined) updatedPublicProof.effectVariant = effects.effectVariant;

  const [updated] = await db
    .update(affiliateProfile)
    .set({
      metadata: { ...existingMetadata, publicProof: updatedPublicProof },
      updatedAt: new Date(),
    })
    .where(eq(affiliateProfile.id, profile.id))
    .returning();

  return updated ?? profile;
}

export async function markReferralRewardGrantConsumed(grantId: string) {
  const rows = await db
    .select()
    .from(referralRewardGrant)
    .where(eq(referralRewardGrant.id, grantId))
    .limit(1);

  if (!rows[0]) {
    return null;
  }

  const [updated] = await db
    .update(referralRewardGrant)
    .set({
      status: "consumed",
      updatedAt: new Date(),
    })
    .where(eq(referralRewardGrant.id, grantId))
    .returning();

  return updated ?? rows[0];
}
