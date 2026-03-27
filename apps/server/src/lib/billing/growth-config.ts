import type { BillingPlanKey } from "./config";

export const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;
export const CHECKOUT_ORDER_GRACE_WINDOW_MS = 15 * 60 * 1000;
export const AFFILIATE_ATTRIBUTION_WINDOW_DAYS = 180;
export const GROWTH_VISITOR_COOKIE = "pe_growth_visitor";
export const GROWTH_TOUCH_COOKIE = "pe_growth_touch";
export const REWARD_TYPE_EDGE_CREDITS = "edge_credits";
export const REWARD_TYPE_FREE_MONTH = "free_month";
export const REWARD_TYPE_UPGRADE_TRIAL = "upgrade_trial";
export const AFFILIATE_TIER_OVERRIDE_SOURCE = "affiliate_tier";
export const AFFILIATE_PREMIUM_PLAN_KEY = "professional" as BillingPlanKey;
export const AFFILIATE_PRO_REVENUE_THRESHOLD_CENTS = 250_000;
export const AFFILIATE_TIER_OVERRIDE_ENDS_AT = new Date("2099-12-31T23:59:59.999Z");

export const AFFILIATE_TIER_KEYS = ["partner", "pro", "elite"] as const;
export const AFFILIATE_TIER_MODES = ["automatic", "manual"] as const;
export const AFFILIATE_TIER_EFFECT_VARIANTS = [
  "gold-emerald",
  "emerald_aurora",
  "teal_signal",
] as const;

export const AFFILIATE_BENEFIT_KEYS = [
  "customCodeLinks",
  "affiliateDashboard",
  "withdrawals",
  "proofBadge",
  "premiumAccess",
  "creatorKit",
  "prioritySupport",
  "earlyAccess",
  "featuredProof",
  "coBrandedCampaigns",
  "milestoneBonuses",
  "brandedEdge",
  "founderSupport",
] as const;

export type AffiliateTierKey = (typeof AFFILIATE_TIER_KEYS)[number];
export type AffiliateTierMode = (typeof AFFILIATE_TIER_MODES)[number];
export type AffiliateEffectVariant = (typeof AFFILIATE_TIER_EFFECT_VARIANTS)[number];
export type AffiliateBenefitKey = (typeof AFFILIATE_BENEFIT_KEYS)[number];

export const AFFILIATE_BENEFIT_COPY: Record<
  AffiliateBenefitKey,
  {
    label: string;
    description: string;
    ctaLabel: string;
  }
> = {
  customCodeLinks: {
    label: "Custom code + tracked link",
    description: "Share a branded discount code and tracked link from your affiliate dashboard.",
    ctaLabel: "Share assets",
  },
  affiliateDashboard: {
    label: "Affiliate dashboard",
    description: "Track revenue, commissions, channels, and referred customers from one route.",
    ctaLabel: "Open dashboard",
  },
  withdrawals: {
    label: "Withdrawals",
    description: "Connect Stripe and request payout withdrawals once commission becomes available.",
    ctaLabel: "Open billing",
  },
  proofBadge: {
    label: "Proof-page badge",
    description: "Show an affiliate badge and public proof treatment tied to your current tier.",
    ctaLabel: "View proof treatment",
  },
  premiumAccess: {
    label: "Premium platform access",
    description: "Stay on a paid platform plan while your affiliate profile remains active.",
    ctaLabel: "Premium included",
  },
  creatorKit: {
    label: "Creator kit",
    description: "Unlock partner assets and launch material once you reach the Pro tier.",
    ctaLabel: "Access creator kit",
  },
  prioritySupport: {
    label: "Priority support",
    description: "Get faster responses and partner support once your affiliate account levels up.",
    ctaLabel: "Partner support",
  },
  earlyAccess: {
    label: "Early access",
    description: "Preview upcoming product releases before the main rollout.",
    ctaLabel: "Early access",
  },
  featuredProof: {
    label: "Featured proof treatment",
    description: "Upgrade your public proof styling once you reach a higher affiliate tier.",
    ctaLabel: "Proof treatment",
  },
  coBrandedCampaigns: {
    label: "Co-branded campaigns",
    description: "Run deeper launch campaigns and custom partner pages as an Elite affiliate.",
    ctaLabel: "Campaign access",
  },
  milestoneBonuses: {
    label: "Milestone bonuses",
    description: "Become eligible for custom bonus payouts tied to launch or referral milestones.",
    ctaLabel: "Bonus eligibility",
  },
  brandedEdge: {
    label: "Branded Edge",
    description: "Unlock your own Edge-style creator asset as part of the Elite program.",
    ctaLabel: "Branded Edge",
  },
  founderSupport: {
    label: "Founder line",
    description: "Get the highest-touch support path reserved for Elite affiliate partners.",
    ctaLabel: "Founder line",
  },
};

export const AFFILIATE_TIER_CONFIG: Record<
  AffiliateTierKey,
  {
    label: string;
    mode: AffiliateTierMode;
    summary: string;
    defaultCommissionBps: number;
    defaultDiscountBasisPoints: number;
    publicProof: {
      badgeLabel: string;
      effectVariant: AffiliateEffectVariant;
    };
    benefits: Record<AffiliateBenefitKey, boolean>;
  }
> = {
  partner: {
    label: "Partner",
    mode: "automatic",
    summary: "Default affiliate tier with recurring revenue share, tracked links, and standard proof treatment.",
    defaultCommissionBps: 2000,
    defaultDiscountBasisPoints: 1000,
    publicProof: {
      badgeLabel: "Affiliate",
      effectVariant: "gold-emerald",
    },
    benefits: {
      customCodeLinks: true,
      affiliateDashboard: true,
      withdrawals: true,
      proofBadge: true,
      premiumAccess: true,
      creatorKit: false,
      prioritySupport: false,
      earlyAccess: false,
      featuredProof: false,
      coBrandedCampaigns: false,
      milestoneBonuses: false,
      brandedEdge: false,
      founderSupport: false,
    },
  },
  pro: {
    label: "Pro",
    mode: "automatic",
    summary: "Automatic upgrade tier for affiliates who cross the referred revenue threshold.",
    defaultCommissionBps: 2500,
    defaultDiscountBasisPoints: 1000,
    publicProof: {
      badgeLabel: "Pro Affiliate",
      effectVariant: "emerald_aurora",
    },
    benefits: {
      customCodeLinks: true,
      affiliateDashboard: true,
      withdrawals: true,
      proofBadge: true,
      premiumAccess: true,
      creatorKit: true,
      prioritySupport: true,
      earlyAccess: true,
      featuredProof: true,
      coBrandedCampaigns: false,
      milestoneBonuses: false,
      brandedEdge: false,
      founderSupport: false,
    },
  },
  elite: {
    label: "Elite",
    mode: "manual",
    summary: "Manual partner tier for curated affiliates with custom economics and partner treatment.",
    defaultCommissionBps: 2500,
    defaultDiscountBasisPoints: 1500,
    publicProof: {
      badgeLabel: "Elite Affiliate",
      effectVariant: "teal_signal",
    },
    benefits: {
      customCodeLinks: true,
      affiliateDashboard: true,
      withdrawals: true,
      proofBadge: true,
      premiumAccess: true,
      creatorKit: true,
      prioritySupport: true,
      earlyAccess: true,
      featuredProof: true,
      coBrandedCampaigns: true,
      milestoneBonuses: true,
      brandedEdge: true,
      founderSupport: true,
    },
  },
};
