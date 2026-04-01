import { getServerEnv } from "../env";

export const BILLING_PLAN_KEYS = [
  "student",
  "professional",
  "institutional",
] as const;

export const BILLING_INTERVALS = ["monthly", "annual"] as const;

export type BillingPlanKey = (typeof BILLING_PLAN_KEYS)[number];
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const DEFAULT_BILLING_INTERVAL = "annual" as const;

export const BILLING_PLAN_TIER: Record<BillingPlanKey, number> = {
  student: 0,
  professional: 1,
  institutional: 2,
};

export const REFERRAL_EDGE_CREDIT_THRESHOLD = 5;
export const REFERRAL_EDGE_CREDIT_AMOUNT = 1000;
export const REFERRAL_FREE_MONTH_THRESHOLD = 20;
export const REFERRAL_UPGRADE_TRIAL_THRESHOLD = 40;
export const REFERRAL_UPGRADE_TRIAL_DAYS = 30;

export function getHigherBillingPlanKey(
  left: BillingPlanKey,
  right: BillingPlanKey
) {
  return BILLING_PLAN_TIER[left] >= BILLING_PLAN_TIER[right] ? left : right;
}

export function getNextBillingPlanKey(planKey: BillingPlanKey) {
  if (planKey === "student") {
    return "professional" as BillingPlanKey;
  }

  if (planKey === "professional") {
    return "institutional" as BillingPlanKey;
  }

  return null;
}

export type BillingPlanDefinition = {
  key: BillingPlanKey;
  title: string;
  tagline: string;
  summary: string;
  priceLabel: string;
  monthlyPriceCents: number;
  annualPriceCents: number | null;
  annualMonthlyPriceCents: number | null;
  annualDiscountPercent: number | null;
  defaultTrialDays: number;
  highlight: string | null;
  ctaLabel: string;
  features: string[];
  accountAllowanceLabel: string;
  includedAiCredits: number;
  includedLiveSyncSlots: number;
  includesPropTracker: boolean;
  includesAdvancedAnalytics: boolean;
  includesExports: boolean;
  liveSyncFrequencyLabel: string;
  isFree: boolean;
  upgradeOfferBasisPoints: number | null;
  stripePriceId?: string;
  stripeAnnualPriceId?: string;
};

export function getBillingPlanDefinitions(): BillingPlanDefinition[] {
  const env = getServerEnv();

  return [
    {
      key: "student",
      title: "Explorer",
      tagline: "Build the habit before you size up.",
      summary:
        "Track one account for free with core journaling, basic analytics, and enough AI preview to understand your edge.",
      priceLabel: "Free",
      monthlyPriceCents: 0,
      annualPriceCents: null,
      annualMonthlyPriceCents: null,
      annualDiscountPercent: null,
      defaultTrialDays: 0,
      highlight: null,
      ctaLabel: "Start free",
      features: [
        "1 account with manual or CSV imports",
        "Core dashboard, journal, calendar, and trade review",
        "Basic analytics with generous history and habit-building tools",
        "30 Edge credits every month to sample AI",
        "No credit card required",
      ],
      accountAllowanceLabel: "1 account",
      includedAiCredits: 30,
      includedLiveSyncSlots: 0,
      includesPropTracker: false,
      includesAdvancedAnalytics: false,
      includesExports: false,
      liveSyncFrequencyLabel: "Manual import only",
      isFree: true,
      upgradeOfferBasisPoints: null,
    },
    {
      key: "professional",
      title: "Trader",
      tagline: "The paid plan most traders actually need.",
      summary:
        "Unlock live sync, deeper analytics, exports, and prop-tracker workflows without jumping to an enterprise-style price point.",
      priceLabel: "£29 / month",
      monthlyPriceCents: 2900,
      annualPriceCents: 27600,
      annualMonthlyPriceCents: 2300,
      annualDiscountPercent: 21,
      defaultTrialDays: 7,
      highlight: "Most popular",
      ctaLabel: "Start 7-day trial",
      features: [
        "Up to 5 accounts",
        "Unlimited imports with exports, templates, and advanced filters",
        "Prop tracker, reports, and advanced analytics",
        "1 live sync slot for real-time broker sync",
        "300 Edge credits every month",
      ],
      accountAllowanceLabel: "Up to 5",
      includedAiCredits: 300,
      includedLiveSyncSlots: 1,
      includesPropTracker: true,
      includesAdvancedAnalytics: true,
      includesExports: true,
      liveSyncFrequencyLabel: "Real-time sync",
      isFree: false,
      upgradeOfferBasisPoints: 1000,
      stripePriceId: env.STRIPE_PRICE_PROFESSIONAL_MONTHLY_ID,
      stripeAnnualPriceId: env.STRIPE_PRICE_PROFESSIONAL_ANNUAL_ID,
    },
    {
      key: "institutional",
      title: "Elite",
      tagline: "For multi-account traders who want the full stack.",
      summary:
        "Scale across multiple live accounts with more AI capacity, deeper analytics, and the full prop-performance toolkit.",
      priceLabel: "£59 / month",
      monthlyPriceCents: 5900,
      annualPriceCents: 56400,
      annualMonthlyPriceCents: 4700,
      annualDiscountPercent: 20,
      defaultTrialDays: 7,
      highlight: "Best value",
      ctaLabel: "Start 7-day trial",
      features: [
        "Unlimited accounts",
        "Custom reports, elite analytics, and Monte Carlo prop tools",
        "5 live sync slots",
        "1,500 Edge credits every month",
        "Priority sync for multi-account workflows",
      ],
      accountAllowanceLabel: "Unlimited",
      includedAiCredits: 1500,
      includedLiveSyncSlots: 5,
      includesPropTracker: true,
      includesAdvancedAnalytics: true,
      includesExports: true,
      liveSyncFrequencyLabel: "Priority live sync",
      isFree: false,
      upgradeOfferBasisPoints: 1500,
      stripePriceId: env.STRIPE_PRICE_INSTITUTIONAL_MONTHLY_ID,
      stripeAnnualPriceId: env.STRIPE_PRICE_INSTITUTIONAL_ANNUAL_ID,
    },
  ];
}

export function getBillingPlanDefinition(planKey: BillingPlanKey) {
  return getBillingPlanDefinitions().find((plan) => plan.key === planKey);
}

export function getBillingPlanTitle(planKey: BillingPlanKey) {
  return getBillingPlanDefinition(planKey)?.title ?? "Explorer";
}

export function getBillingPlanPricing(
  planKey: BillingPlanKey,
  interval: BillingInterval = DEFAULT_BILLING_INTERVAL
) {
  const plan = getBillingPlanDefinition(planKey);
  if (!plan) {
    return null;
  }

  if (interval === "annual" && plan.annualPriceCents && plan.annualMonthlyPriceCents) {
    return {
      interval,
      amountCents: plan.annualPriceCents,
      monthlyEquivalentCents: plan.annualMonthlyPriceCents,
      annualDiscountPercent: plan.annualDiscountPercent,
    };
  }

  return {
    interval: "monthly" as const,
    amountCents: plan.monthlyPriceCents,
    monthlyEquivalentCents: plan.monthlyPriceCents,
    annualDiscountPercent: null,
  };
}

export function resolvePlanKeyFromStripePriceId(priceId?: string | null) {
  if (!priceId) {
    return "student" as BillingPlanKey;
  }

  const plan = getBillingPlanDefinitions().find(
    (item) =>
      (item.stripePriceId && item.stripePriceId === priceId) ||
      (item.stripeAnnualPriceId && item.stripeAnnualPriceId === priceId)
  );

  return plan?.key ?? ("student" as BillingPlanKey);
}

export function getAffiliateCommissionBps() {
  return getServerEnv().AFFILIATE_COMMISSION_BPS ?? 2000;
}

export function getWebAppUrl() {
  const env = getServerEnv();
  return env.WEB_URL ?? process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3001";
}
