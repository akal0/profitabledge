import { getBillingPlanDefinition, getWebAppUrl, type BillingPlanKey } from "./config";
import {
  AFFILIATE_ATTRIBUTION_WINDOW_DAYS,
  AFFILIATE_BENEFIT_COPY,
  AFFILIATE_BENEFIT_KEYS,
  AFFILIATE_PREMIUM_PLAN_KEY,
  AFFILIATE_PRO_REVENUE_THRESHOLD_CENTS,
  AFFILIATE_TIER_CONFIG,
  type AffiliateBenefitKey,
  type AffiliateEffectVariant,
  type AffiliateTierKey,
  type AffiliateTierMode,
} from "./growth-config";

export type StoredGrowthTouch = {
  type: "affiliate" | "referral";
  code: string;
  offerCode?: string;
  trackingLinkSlug?: string;
  affiliateGroupSlug?: string;
  landingPath?: string;
  query?: string;
  visitorToken: string;
  capturedAtISO: string;
};

type AffiliateTierProgress = {
  currentTierKey: AffiliateTierKey;
  nextTierKey: AffiliateTierKey;
  nextTierLabel: string;
  thresholdAmount: number | null;
  remainingAmount: number | null;
  progressPercent: number | null;
  statusMessage: string;
  isAutomatic: boolean;
};

export function collapseWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function normalizeGrowthSlug(input?: string | null) {
  return (input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeVisitorToken(input?: string | null) {
  const value = (input ?? "").trim();
  return value.length > 0 ? value.slice(0, 120) : null;
}

export function normalizeDestinationPath(input?: string | null) {
  const value = input?.trim() || "/sign-up";
  return value.startsWith("/") ? value : "/sign-up";
}

export function normalizeGrowthCode(input: string) {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function buildAffiliateCode() {
  return `AFF${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function buildReferralCode() {
  return `PE${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function buildAffiliateOfferCode(seed: string) {
  return normalizeGrowthCode(seed).slice(0, 64);
}

export function buildGroupName(name?: string | null) {
  const base = name?.trim() || "Profitabledge";
  return `${base}'s Mentorship`;
}

export function buildAffiliateTrackingLinkSlug(label: string) {
  return slugify(label) || "main";
}

export function buildAffiliateShareUrl(input: {
  affiliateCode: string;
  username?: string | null;
  groupSlug?: string | null;
  offerCode?: string | null;
  trackingLinkSlug?: string | null;
  channel?: string | null;
  destinationPath?: string | null;
}) {
  const handle = input.username || input.affiliateCode;
  const url = new URL(`/invite/${encodeURIComponent(handle)}`, getWebAppUrl());
  if (input.channel) {
    url.searchParams.set("channel", input.channel);
  }
  return url.toString();
}

export function buildReferralShareUrl(code: string) {
  const url = new URL("/sign-up", getWebAppUrl());
  url.searchParams.set("ref", code);
  return url.toString();
}

export function formatAffiliatePlanLabel(planKey?: string | null) {
  if (!planKey) {
    return "Unknown";
  }

  const plan = getBillingPlanDefinition(planKey as BillingPlanKey);
  if (plan?.title) {
    return plan.title;
  }

  return planKey
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function buildAffiliatePublicProofMetadata(
  metadata?: Record<string, unknown> | null
) {
  const program =
    metadata?.program && typeof metadata.program === "object"
      ? (metadata.program as Record<string, unknown>)
      : null;
  const tierKey = isAffiliateTierKey(program?.tierKey) ? program.tierKey : "partner";
  const tierDefaults = AFFILIATE_TIER_CONFIG[tierKey].publicProof;
  const publicProof =
    metadata && typeof metadata === "object"
      ? ((metadata.publicProof as Record<string, unknown> | undefined) ?? undefined)
      : undefined;

  return {
    badgeLabel:
      typeof publicProof?.badgeLabel === "string" && publicProof.badgeLabel.trim()
        ? publicProof.badgeLabel.trim()
        : tierDefaults.badgeLabel,
    effectVariant:
      typeof publicProof?.effectVariant === "string" &&
      publicProof.effectVariant.trim()
        ? publicProof.effectVariant.trim()
        : tierDefaults.effectVariant,
  };
}

export function buildAffiliateBenefitFlags(
  tierKey: AffiliateTierKey,
  overrides?: Partial<Record<AffiliateBenefitKey, boolean>> | null
) {
  return AFFILIATE_BENEFIT_KEYS.reduce(
    (acc, key) => {
      acc[key] = overrides?.[key] ?? AFFILIATE_TIER_CONFIG[tierKey].benefits[key];
      return acc;
    },
    {} as Record<AffiliateBenefitKey, boolean>
  );
}

export function parseAffiliateBenefitFlags(
  program?: Record<string, unknown> | null,
  tierKey: AffiliateTierKey = "partner"
) {
  const rawBenefits =
    program?.benefits && typeof program.benefits === "object"
      ? (program.benefits as Record<string, unknown>)
      : null;

  return buildAffiliateBenefitFlags(
    tierKey,
    rawBenefits
      ? AFFILIATE_BENEFIT_KEYS.reduce(
          (acc, key) => {
            if (typeof rawBenefits[key] === "boolean") {
              acc[key] = rawBenefits[key] as boolean;
            }
            return acc;
          },
          {} as Partial<Record<AffiliateBenefitKey, boolean>>
        )
      : null
  );
}

export function getAffiliateMetadataObject(
  metadata?: Record<string, unknown> | null
): Record<string, unknown> {
  return metadata && typeof metadata === "object" ? metadata : {};
}

export function isAffiliateTierKey(value: unknown): value is AffiliateTierKey {
  return typeof value === "string" && ["partner", "pro", "elite"].includes(value);
}

export function isAffiliateTierMode(value: unknown): value is AffiliateTierMode {
  return typeof value === "string" && ["automatic", "manual"].includes(value);
}

export function isAffiliateEffectVariant(
  value: unknown
): value is AffiliateEffectVariant {
  return (
    typeof value === "string" &&
    ["gold-emerald", "emerald_aurora", "teal_signal"].includes(value)
  );
}

export function normalizeAffiliateTierKey(value: unknown): AffiliateTierKey {
  return isAffiliateTierKey(value) ? value : "partner";
}

export function normalizeAffiliateTierMode(value: unknown): AffiliateTierMode {
  return isAffiliateTierMode(value) ? value : "automatic";
}

export function getAffiliateAutomaticTierKey(
  referredRevenueAmount: number
): AffiliateTierKey {
  return referredRevenueAmount >= AFFILIATE_PRO_REVENUE_THRESHOLD_CENTS
    ? "pro"
    : "partner";
}

export function buildAffiliateTierProgress(
  tierKey: AffiliateTierKey,
  referredRevenueAmount: number
): AffiliateTierProgress {
  if (tierKey === "partner") {
    const remaining = Math.max(
      AFFILIATE_PRO_REVENUE_THRESHOLD_CENTS - referredRevenueAmount,
      0
    );

    return {
      currentTierKey: tierKey,
      nextTierKey: "pro",
      nextTierLabel: AFFILIATE_TIER_CONFIG.pro.label,
      thresholdAmount: AFFILIATE_PRO_REVENUE_THRESHOLD_CENTS,
      remainingAmount: remaining,
      progressPercent: Math.min(
        100,
        Math.round(
          (Math.max(referredRevenueAmount, 0) /
            AFFILIATE_PRO_REVENUE_THRESHOLD_CENTS) *
            100
        )
      ),
      statusMessage:
        remaining > 0
          ? `${new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(remaining / 100)} in referred revenue until Pro`
          : "Pro unlocked",
      isAutomatic: true,
    };
  }

  return {
    currentTierKey: tierKey,
    nextTierKey: "elite",
    nextTierLabel: AFFILIATE_TIER_CONFIG.elite.label,
    thresholdAmount: null,
    remainingAmount: null,
    progressPercent: null,
    statusMessage: "Elite is manually assigned for top affiliate partners.",
    isAutomatic: false,
  };
}

export function buildAffiliateBenefitsList(input: {
  tierKey: AffiliateTierKey;
  benefitFlags: Record<AffiliateBenefitKey, boolean>;
}) {
  return AFFILIATE_BENEFIT_KEYS.map((key) => ({
    key,
    label: AFFILIATE_BENEFIT_COPY[key].label,
    description: AFFILIATE_BENEFIT_COPY[key].description,
    ctaLabel: AFFILIATE_BENEFIT_COPY[key].ctaLabel,
    enabled: input.benefitFlags[key],
  }));
}

export function buildAffiliateTierSnapshot(input: {
  profile: { metadata?: unknown; tierKey: string; tierMode: string; commissionBps: number };
  referredRevenueAmount: number;
  discountBasisPoints: number;
}) {
  const metadata = getAffiliateMetadataObject(
    (input.profile.metadata as Record<string, unknown> | null | undefined) ?? null
  );
  const program =
    metadata.program && typeof metadata.program === "object"
      ? (metadata.program as Record<string, unknown>)
      : null;
  const tierKey = normalizeAffiliateTierKey(input.profile.tierKey);
  const tierMode = normalizeAffiliateTierMode(input.profile.tierMode);
  const benefitFlags = parseAffiliateBenefitFlags(program, tierKey);
  const publicProof = buildAffiliatePublicProofMetadata(metadata);

  return {
    key: tierKey,
    label: AFFILIATE_TIER_CONFIG[tierKey].label,
    mode: tierMode,
    modeLabel: tierMode === "manual" ? "Manual" : "Automatic",
    summary: AFFILIATE_TIER_CONFIG[tierKey].summary,
    referredRevenueAmount: input.referredRevenueAmount,
    effectiveCommissionBps: input.profile.commissionBps,
    effectiveDiscountBasisPoints: input.discountBasisPoints,
    publicProof,
    benefits: buildAffiliateBenefitsList({
      tierKey,
      benefitFlags,
    }),
    benefitFlags,
    progress: buildAffiliateTierProgress(tierKey, input.referredRevenueAmount),
    premiumPlanKey: AFFILIATE_PREMIUM_PLAN_KEY,
    canCustomizeProof: tierKey === "elite" && tierMode === "manual",
  };
}

export function buildAffiliateProgramMetadata(input: {
  tierKey: AffiliateTierKey;
  tierMode: AffiliateTierMode;
  referredRevenueAmount: number;
  commissionBps: number;
  discountBasisPoints: number;
  benefits?: Partial<Record<AffiliateBenefitKey, boolean>> | null;
}) {
  return {
    tierKey: input.tierKey,
    tierMode: input.tierMode,
    referredRevenueAmount: input.referredRevenueAmount,
    commissionBps: input.commissionBps,
    discountBasisPoints: input.discountBasisPoints,
    premiumPlanKey: AFFILIATE_PREMIUM_PLAN_KEY,
    benefits: buildAffiliateBenefitFlags(input.tierKey, input.benefits),
  };
}

export function buildAttributionExpiryDate(from = new Date()) {
  return new Date(
    from.getTime() + AFFILIATE_ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
}

export function parseStoredGrowthTouch(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as StoredGrowthTouch;
    if (!parsed?.type || !parsed?.visitorToken || !parsed?.capturedAtISO) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function readGrowthCookie(
  cookies:
    | {
        get(name: string):
          | {
              value: string;
            }
          | undefined;
      }
    | null
    | undefined,
  name: string
) {
  return cookies?.get(name)?.value ?? null;
}

export function readGrowthVisitorTokenFromCookies(
  cookies:
    | {
        get(name: string):
          | {
              value: string;
            }
          | undefined;
      }
    | null
    | undefined
) {
  return normalizeVisitorToken(readGrowthCookie(cookies, "pe_growth_visitor"));
}

export function readGrowthTouchFromCookies(
  cookies:
    | {
        get(name: string):
          | {
              value: string;
            }
          | undefined;
      }
    | null
    | undefined
) {
  return parseStoredGrowthTouch(readGrowthCookie(cookies, "pe_growth_touch"));
}
