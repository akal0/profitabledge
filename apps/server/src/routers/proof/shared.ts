import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "../../db";
import { user as userTable } from "../../db/schema/auth";
import { affiliateProfile } from "../../db/schema/billing";
import { publicAccountShare, tradingAccount } from "../../db/schema/trading";
import {
  buildPublicAccountSlug,
  buildPublicProofPath,
} from "../../lib/public-proof/share-slug";

export async function ensureOwnedProofAccount(
  userId: string,
  accountId: string
) {
  const [account] = await db
    .select({
      id: tradingAccount.id,
      userId: tradingAccount.userId,
      name: tradingAccount.name,
      broker: tradingAccount.broker,
    })
    .from(tradingAccount)
    .where(
      and(eq(tradingAccount.id, accountId), eq(tradingAccount.userId, userId))
    )
    .limit(1);

  if (!account) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Account not found",
    });
  }

  return account;
}

export async function getProofOwnerIdentity(userId: string) {
  const [owner] = await db
    .select({
      id: userTable.id,
      username: userTable.username,
      name: userTable.name,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (!owner) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "User not found",
    });
  }

  return owner;
}

export async function generateUniquePublicAccountSlug(accountName: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const publicAccountSlug = buildPublicAccountSlug(accountName);
    const [existing] = await db
      .select({ id: publicAccountShare.id })
      .from(publicAccountShare)
      .where(eq(publicAccountShare.publicAccountSlug, publicAccountSlug))
      .limit(1);

    if (!existing) {
      return publicAccountSlug;
    }
  }

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Unable to generate a unique proof link",
  });
}

export async function getLatestOwnedPublicShare(accountId: string) {
  const rows = await db
    .select({
      id: publicAccountShare.id,
      publicAccountSlug: publicAccountShare.publicAccountSlug,
      isActive: publicAccountShare.isActive,
      revokedAt: publicAccountShare.revokedAt,
      viewCount: publicAccountShare.viewCount,
      lastViewedAt: publicAccountShare.lastViewedAt,
      createdAt: publicAccountShare.createdAt,
      updatedAt: publicAccountShare.updatedAt,
    })
    .from(publicAccountShare)
    .where(eq(publicAccountShare.accountId, accountId))
    .orderBy(desc(publicAccountShare.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

export function serializeOwnedSharePath(
  username: string | null | undefined,
  publicAccountSlug: string
) {
  if (!username) return null;
  return buildPublicProofPath(username, publicAccountSlug);
}

export async function loadPublicShareBySlug(publicAccountSlug: string) {
  const [share] = await db
    .select({
      id: publicAccountShare.id,
      userId: publicAccountShare.userId,
      accountId: publicAccountShare.accountId,
      publicAccountSlug: publicAccountShare.publicAccountSlug,
      isActive: publicAccountShare.isActive,
      revokedAt: publicAccountShare.revokedAt,
      viewCount: publicAccountShare.viewCount,
      lastViewedAt: publicAccountShare.lastViewedAt,
      createdAt: publicAccountShare.createdAt,
      updatedAt: publicAccountShare.updatedAt,
      username: userTable.username,
      traderName: userTable.name,
      traderImage: userTable.image,
      traderBannerUrl: userTable.profileBannerUrl,
      traderBannerPosition: userTable.profileBannerPosition,
      traderProfileEffects: userTable.profileEffects,
      accountName: tradingAccount.name,
      broker: tradingAccount.broker,
      brokerType: tradingAccount.brokerType,
      brokerServer: tradingAccount.brokerServer,
      verificationLevel: tradingAccount.verificationLevel,
      isVerified: tradingAccount.isVerified,
      lastSyncedAt: tradingAccount.lastSyncedAt,
      initialBalance: tradingAccount.initialBalance,
      initialCurrency: tradingAccount.initialCurrency,
    })
    .from(publicAccountShare)
    .innerJoin(userTable, eq(userTable.id, publicAccountShare.userId))
    .innerJoin(
      tradingAccount,
      eq(tradingAccount.id, publicAccountShare.accountId)
    )
    .where(eq(publicAccountShare.publicAccountSlug, publicAccountSlug))
    .limit(1);

  return share ?? null;
}

export async function resolveActivePublicShareOrThrow(input: {
  username: string;
  publicAccountSlug: string;
}) {
  const share = await loadPublicShareBySlug(input.publicAccountSlug);

  if (!share) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Proof page not found",
    });
  }

  if (share.username !== input.username) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Proof page not found",
    });
  }

  if (!share.isActive) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This proof link is no longer active",
    });
  }

  return share;
}

export async function getPublicProofAffiliateState(userId: string) {
  const [profile] = await db
    .select({
      metadata: affiliateProfile.metadata,
      approvedAt: affiliateProfile.approvedAt,
    })
    .from(affiliateProfile)
    .where(
      and(
        eq(affiliateProfile.userId, userId),
        eq(affiliateProfile.isActive, true)
      )
    )
    .limit(1);

  if (!profile?.approvedAt) {
    return {
      isAffiliate: false,
      badgeLabel: null,
      effectVariant: null,
    };
  }

  const metadata =
    profile.metadata && typeof profile.metadata === "object"
      ? (profile.metadata as Record<string, unknown>)
      : null;
  const publicProof =
    metadata?.publicProof && typeof metadata.publicProof === "object"
      ? (metadata.publicProof as Record<string, unknown>)
      : null;

  return {
    isAffiliate: true,
    badgeLabel:
      typeof publicProof?.badgeLabel === "string" && publicProof.badgeLabel.trim()
        ? publicProof.badgeLabel.trim()
        : "Affiliate",
    effectVariant:
      typeof publicProof?.effectVariant === "string" &&
      publicProof.effectVariant.trim()
        ? publicProof.effectVariant.trim()
        : "gold-emerald",
  };
}
