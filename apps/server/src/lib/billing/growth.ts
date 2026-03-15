import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, isNull, lte } from "drizzle-orm";

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
  affiliateProfile,
  billingCustomer,
  billingEntitlementOverride,
  billingSubscription,
  edgeCreditGrant,
  privateBetaWaitlist,
  referralConversion,
  referralProfile,
  referralRewardGrant,
} from "../../db/schema/billing";
import {
  getAffiliateCommissionBps,
  getBillingPlanDefinition,
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
import { getPolarClient } from "./polar";

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;
const REWARD_TYPE_EDGE_CREDITS = "edge_credits";
const REWARD_TYPE_FREE_MONTH = "free_month";
const REWARD_TYPE_UPGRADE_TRIAL = "upgrade_trial";

type MinimalUser = {
  id: string;
  name: string;
  email: string;
};

function buildReferralCode() {
  return `PE${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function buildAffiliateCode() {
  return `AFF${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function buildGroupName(name?: string | null) {
  const base = name?.trim() || "Profitabledge";
  return `${base}'s Mentorship`;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function buildReferralShareUrl(code: string) {
  const url = new URL("/sign-up", getWebAppUrl());
  url.searchParams.set("ref", code);
  return url.toString();
}

function buildAffiliateShareUrl(code: string, groupSlug?: string | null) {
  const url = new URL("/sign-up", getWebAppUrl());
  url.searchParams.set("aff", code);
  if (groupSlug) {
    url.searchParams.set("group", groupSlug);
  }
  return url.toString();
}

export function normalizeGrowthCode(input: string) {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeWaitlistEmail(input: string) {
  return input.trim().toLowerCase();
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
  const [subscription] = await db
    .select()
    .from(billingSubscription)
    .where(eq(billingSubscription.userId, userId))
    .orderBy(
      desc(billingSubscription.currentPeriodEnd),
      desc(billingSubscription.updatedAt)
    )
    .limit(1);

  const [customer] = await db
    .select()
    .from(billingCustomer)
    .where(eq(billingCustomer.userId, userId))
    .limit(1);

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

  const subscriptionPlanKey =
    subscription && isActiveSubscriptionStatus(subscription.status)
      ? (subscription.planKey as BillingPlanKey)
      : ("student" as BillingPlanKey);

  const activePlanKey =
    override?.planKey &&
    getBillingPlanDefinition(override.planKey as BillingPlanKey)
      ? getHigherBillingPlanKey(
          subscriptionPlanKey,
          override.planKey as BillingPlanKey
        )
      : subscriptionPlanKey;

  return {
    subscription: subscription ?? null,
    customer: customer ?? null,
    override: override ?? null,
    activePlanKey,
  };
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
    })
    .from(affiliatePayout)
    .leftJoin(
      affiliatePaymentMethod,
      eq(affiliatePayout.paymentMethodId, affiliatePaymentMethod.id)
    )
    .where(eq(affiliatePayout.affiliateUserId, userId))
    .orderBy(desc(affiliatePayout.paidAt), desc(affiliatePayout.createdAt));
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

async function ensureAffiliateProfileApproved(
  user: MinimalUser,
  approvedByUserId: string
) {
  const existing = await getAffiliateProfileRow(user.id);
  const referral = await ensureReferralProfile(user.id);

  if (existing) {
    const [updated] = await db
      .update(affiliateProfile)
      .set({
        code: existing.code || referral.code,
        displayName: existing.displayName || user.name,
        isActive: true,
        approvedAt: new Date(),
        approvedByUserId,
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
          isActive: true,
          approvedAt: new Date(),
          approvedByUserId,
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

export async function applyForAffiliate(input: {
  userId: string;
  message?: string | null;
}) {
  const profile = await getApprovedAffiliateProfile(input.userId);
  if (profile) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "You are already an approved affiliate",
    });
  }

  const existing = await getLatestAffiliateApplication(input.userId);
  if (existing) {
    const [updated] = await db
      .update(affiliateApplication)
      .set({
        status: "pending",
        message: input.message?.trim() || null,
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
      message: input.message?.trim() || null,
    })
    .returning();

  return inserted;
}

export async function listAffiliateApplications() {
  return db
    .select({
      application: affiliateApplication,
      user: {
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
      },
    })
    .from(affiliateApplication)
    .innerJoin(userTable, eq(affiliateApplication.userId, userTable.id))
    .orderBy(
      asc(affiliateApplication.status),
      desc(affiliateApplication.createdAt)
    );
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

  return {
    application: updatedApplication ?? application,
    profile: approvedProfile,
    group,
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

export async function joinPrivateBetaWaitlist(input: {
  email: string;
  source?: string | null;
}) {
  const normalizedEmail = normalizeWaitlistEmail(input.email);
  if (!normalizedEmail) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Email is required",
    });
  }

  const rows = await db
    .select()
    .from(privateBetaWaitlist)
    .where(eq(privateBetaWaitlist.email, normalizedEmail))
    .limit(1);

  if (rows[0]) {
    return rows[0];
  }

  const [inserted] = await db
    .insert(privateBetaWaitlist)
    .values({
      id: crypto.randomUUID(),
      email: normalizedEmail,
      source: input.source?.trim() || "root",
    })
    .returning();

  return inserted;
}

export async function listPrivateBetaWaitlistEntries() {
  return db
    .select()
    .from(privateBetaWaitlist)
    .orderBy(desc(privateBetaWaitlist.createdAt));
}

export async function updatePrivateBetaWaitlistEntry(input: {
  entryId: string;
  reviewedByUserId: string;
  status?: string | null;
  notes?: string | null;
  invitedCodeId?: string | null;
}) {
  const rows = await db
    .select()
    .from(privateBetaWaitlist)
    .where(eq(privateBetaWaitlist.id, input.entryId))
    .limit(1);

  if (!rows[0]) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Waitlist entry not found",
    });
  }

  const [updated] = await db
    .update(privateBetaWaitlist)
    .set({
      status: input.status?.trim() || rows[0].status,
      notes: input.notes?.trim() || null,
      invitedCodeId: input.invitedCodeId ?? null,
      reviewedByUserId: input.reviewedByUserId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(privateBetaWaitlist.id, rows[0].id))
    .returning();

  return updated ?? rows[0];
}

async function getReferralConversionsByReferrer(userId: string) {
  return db
    .select()
    .from(referralConversion)
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
  const profile = await getApprovedAffiliateProfile(userId);

  if (!profile) {
    return {
      isAffiliate: false,
      application,
      profile: null,
      group: null,
      stats: {
        signups: 0,
        paidCustomers: 0,
        totalCommissionAmount: 0,
      },
    };
  }

  const [group] = await db
    .select()
    .from(affiliateGroup)
    .where(eq(affiliateGroup.affiliateProfileId, profile.id))
    .limit(1);

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

  return {
    isAffiliate: true,
    application,
    profile: {
      id: profile.id,
      code: profile.code,
      shareUrl: buildAffiliateShareUrl(profile.code, group?.slug ?? null),
    },
    group:
      group
        ? {
            id: group.id,
            name: group.name,
            slug: group.slug,
            description: group.description,
            inviteUrl: buildAffiliateShareUrl(profile.code, group.slug),
          }
        : null,
    stats: {
      signups: attributions.length,
      paidCustomers: attributions.filter((row) => row.firstPaidAt).length,
      totalCommissionAmount: commissionEvents.reduce(
        (sum, row) => sum + (row.commissionAmount ?? 0),
        0
      ),
    },
  };
}

export async function buildAffiliateDashboard(userId: string) {
  const profile = await getApprovedAffiliateProfile(userId);
  if (!profile) {
    return null;
  }

  const [group] = await db
    .select()
    .from(affiliateGroup)
    .where(eq(affiliateGroup.affiliateProfileId, profile.id))
    .limit(1);

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

  const members = group
    ? await db
        .select({
          membership: affiliateGroupMember,
          user: {
            id: userTable.id,
            name: userTable.name,
            email: userTable.email,
          },
        })
        .from(affiliateGroupMember)
        .innerJoin(userTable, eq(affiliateGroupMember.userId, userTable.id))
        .where(eq(affiliateGroupMember.affiliateGroupId, group.id))
        .orderBy(desc(affiliateGroupMember.createdAt))
    : [];

  return {
    profile: {
      id: profile.id,
      code: profile.code,
      shareUrl: buildAffiliateShareUrl(profile.code, group?.slug ?? null),
    },
    group:
      group
        ? {
            id: group.id,
            name: group.name,
            slug: group.slug,
            description: group.description,
            inviteUrl: buildAffiliateShareUrl(profile.code, group.slug),
            memberCount: members.length,
            members: members.map((row) => ({
              id: row.user.id,
              name: row.user.name,
              email: row.user.email,
              joinedAt: row.membership.createdAt,
            })),
          }
        : null,
    stats: {
      signups: attributions.length,
      paidCustomers: attributions.filter((row) => row.firstPaidAt).length,
      totalCommissionAmount: commissionEvents.reduce(
        (sum, row) => sum + (row.commissionAmount ?? 0),
        0
      ),
    },
    attributions,
    commissionEvents,
  };
}

export async function getAffiliatePayoutSettings(userId: string) {
  const profile = await getApprovedAffiliateProfile(userId);
  if (!profile) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Affiliate access required",
    });
  }

  const paymentMethods = await getAffiliatePaymentMethods(userId);
  const payouts = await getAffiliatePayoutRows(userId);
  const unpaidEvents = await getUnpaidAffiliateCommissionEvents(userId);
  const summary = buildAffiliatePayoutSummary({
    unpaidEvents,
    payouts,
  });

  return {
    paymentMethods,
    summary,
    payouts: payouts.map((row) => ({
      ...row.payout,
      paymentMethod: row.paymentMethod
        ? {
            id: row.paymentMethod.id,
            label: row.paymentMethod.label,
            methodType: row.paymentMethod.methodType,
          }
        : null,
    })),
  };
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
      const paymentMethods = await getAffiliatePaymentMethods(entry.user.id);
      const payouts = await getAffiliatePayoutRows(entry.user.id);
      const unpaidEvents = await getUnpaidAffiliateCommissionEvents(entry.user.id);
      const summary = buildAffiliatePayoutSummary({
        unpaidEvents,
        payouts,
      });

      return {
        affiliate: {
          id: entry.user.id,
          name: entry.user.name,
          email: entry.user.email,
          code: entry.profile.code,
        },
        paymentMethods,
        defaultPaymentMethod:
          paymentMethods.find((row) => row.isDefault) ?? paymentMethods[0] ?? null,
        summary,
        recentPayouts: payouts.slice(0, 5).map((row) => ({
          ...row.payout,
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
    (sum, row) => sum + (row.commissionAmount ?? 0),
    0
  );
  const currency =
    claimedEvents.find((row) => row.currency)?.currency ?? provisionalCurrency;

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
    return existingReferral;
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

  return inserted ?? null;
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
  affiliateGroupSlug?: string | null;
  source?: string | null;
}) {
  const normalized = normalizeGrowthCode(input.affiliateCode);
  if (!normalized) {
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

  const [profile] = await db
    .select()
    .from(affiliateProfile)
    .where(and(eq(affiliateProfile.code, normalized), eq(affiliateProfile.isActive, true)))
    .limit(1);

  const approvedProfile =
    profile && profile.approvedAt && profile.isActive ? profile : null;
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

  let groupRow: typeof affiliateGroup.$inferSelect | null = null;
  if (input.affiliateGroupSlug?.trim()) {
    const rows = await db
      .select()
      .from(affiliateGroup)
      .where(
        and(
          eq(affiliateGroup.affiliateProfileId, approvedProfile.id),
          eq(affiliateGroup.slug, input.affiliateGroupSlug.trim())
        )
      )
      .limit(1);

    if (!rows[0]) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "That affiliate group is not available",
      });
    }

    groupRow = rows[0];
  }

  const [inserted] = await db
    .insert(affiliateAttribution)
    .values({
      id: crypto.randomUUID(),
      affiliateProfileId: approvedProfile.id,
      affiliateUserId: approvedProfile.userId,
      referredUserId: input.userId,
      affiliateCode: approvedProfile.code,
      affiliateGroupId: groupRow?.id ?? null,
      metadata: {
        source: input.source?.trim() || "app",
      },
    })
    .returning();

  if (groupRow) {
    await joinAffiliateGroupIfNeeded({
      userId: input.userId,
      groupId: groupRow.id,
      source: input.source ?? "open_link",
    });
  }

  return inserted ?? null;
}

async function createReferralRewardGrant(input: {
  userId: string;
  rewardType: string;
  sequenceNumber: number;
  conversionCount: number;
  status?: string;
  edgeCredits?: number | null;
  polarDiscountId?: string | null;
  polarDiscountCode?: string | null;
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
      polarDiscountId: input.polarDiscountId ?? null,
      polarDiscountCode: input.polarDiscountCode ?? null,
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
  const plan = getBillingPlanDefinition(input.planKey);
  if (!plan?.polarProductId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Plan ${input.planKey} is not configured for discounts`,
    });
  }

  const polar = getPolarClient();
  return polar.discounts.create({
    duration: "repeating",
    durationInMonths: 1,
    type: "percentage",
    basisPoints: 10000,
    maxRedemptions: 1,
    products: [plan.polarProductId],
    name: `Referral reward ${input.sequenceNumber} for ${input.userId}`,
    metadata: {
      user_id: input.userId,
      reward_type: REWARD_TYPE_FREE_MONTH,
      reward_sequence: input.sequenceNumber,
      target_plan: input.planKey,
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
    billing.subscription.polarSubscriptionId
  ) {
    const polar = getPolarClient();
    await polar.subscriptions.update({
      id: billing.subscription.polarSubscriptionId,
      subscriptionUpdate: {
        discountId: discount.id,
      },
    });
    status = "applied";
  }

  return createReferralRewardGrant({
    userId,
    rewardType: REWARD_TYPE_FREE_MONTH,
    sequenceNumber,
    conversionCount: sequenceNumber * REFERRAL_FREE_MONTH_THRESHOLD,
    status,
    polarDiscountId: discount.id,
    polarDiscountCode: "code" in discount ? (discount.code as string | null) : null,
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
    await db
      .update(referralConversion)
      .set({
        status: "paid",
        paidOrderId: input.orderId ?? conversion.paidOrderId,
        paidSubscriptionId: input.subscriptionId ?? conversion.paidSubscriptionId,
        paidAt: input.paidAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(referralConversion.id, conversion.id));
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
  polarOrderId: string;
  polarSubscriptionId?: string | null;
  orderAmount?: number | null;
  currency?: string | null;
  occurredAt?: Date | null;
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

  const existingEvent = await db
    .select()
    .from(affiliateCommissionEvent)
    .where(eq(affiliateCommissionEvent.polarOrderId, input.polarOrderId))
    .limit(1);

  if (existingEvent[0]) {
    return existingEvent[0];
  }

  const commissionBps = getAffiliateCommissionBps();
  const commissionAmount = Math.round(
    ((input.orderAmount ?? 0) * commissionBps) / 10000
  );
  const occurredAt = input.occurredAt ?? new Date();

  const [inserted] = await db
    .insert(affiliateCommissionEvent)
    .values({
      id: crypto.randomUUID(),
      affiliateAttributionId: attribution.id,
      affiliateUserId: attribution.affiliateUserId,
      referredUserId: attribution.referredUserId,
      polarOrderId: input.polarOrderId,
      polarSubscriptionId: input.polarSubscriptionId ?? null,
      orderAmount: input.orderAmount ?? 0,
      commissionBps,
      commissionAmount,
      currency: input.currency ?? null,
      occurredAt,
    })
    .returning();

  await db
    .update(affiliateAttribution)
    .set({
      status: "active",
      firstPaidAt: attribution.firstPaidAt ?? occurredAt,
      lastPaidAt: occurredAt,
      convertedSubscriptionId:
        input.polarSubscriptionId ?? attribution.convertedSubscriptionId,
      updatedAt: new Date(),
    })
    .where(eq(affiliateAttribution.id, attribution.id));

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
