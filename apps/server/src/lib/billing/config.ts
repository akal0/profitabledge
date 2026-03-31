import { getServerEnv } from "../env";

export const BILLING_PLAN_KEYS = [
  "student",
  "professional",
  "institutional",
] as const;

export type BillingPlanKey = (typeof BILLING_PLAN_KEYS)[number];

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
  summary: string;
  priceLabel: string;
  monthlyPriceCents: number;
  highlight: string | null;
  ctaLabel: string;
  features: string[];
  accountAllowanceLabel: string;
  includedAiCredits: number;
  includedLiveSyncSlots: number;
  includesPropTracker: boolean;
  isFree: boolean;
  upgradeOfferBasisPoints: number | null;
  stripePriceId?: string;
  polarProductId?: string;
};

export function getBillingProvider() {
  const env = getServerEnv();
  return env.BILLING_PROVIDER ?? "stripe";
}

export function getBillingPlanDefinitions(): BillingPlanDefinition[] {
  const env = getServerEnv();

  return [
    {
      key: "student",
      title: "Student",
      summary:
        "Start with core journaling, analytics, and manual imports while you build a consistent review process.",
      priceLabel: "Free",
      monthlyPriceCents: 0,
      highlight: null,
      ctaLabel: "Select plan",
      features: [
        "1 manual or CSV account",
        "Core dashboard, trades, journal, and goals",
        "Starter history and storage limits",
        "No hosted sync",
      ],
      accountAllowanceLabel: "1 manual / CSV",
      includedAiCredits: 0,
      includedLiveSyncSlots: 0,
      includesPropTracker: false,
      isFree: true,
      upgradeOfferBasisPoints: null,
    },
    {
      key: "professional",
      title: "Professional",
      summary:
        "Unlock the full trading workflow with deeper analytics, prop tracking, and a live sync allowance.",
      priceLabel: "$29 / month",
      monthlyPriceCents: 2900,
      highlight: "Best offer",
      ctaLabel: "Select plan",
      features: [
        "Up to 5 accounts",
        "Prop tracker access",
        "1 live sync slot",
        "250 Edge credits every month",
      ],
      accountAllowanceLabel: "Up to 5",
      includedAiCredits: 250,
      includedLiveSyncSlots: 1,
      includesPropTracker: true,
      isFree: false,
      upgradeOfferBasisPoints: 1000,
      stripePriceId: env.STRIPE_PRICE_PROFESSIONAL_MONTHLY_ID,
      polarProductId: env.POLAR_PRODUCT_PRO_ID,
    },
    {
      key: "institutional",
      title: "Institutional",
      summary:
        "For advanced traders who want the broadest toolkit and more room for live workflows.",
      priceLabel: "$59 / month",
      monthlyPriceCents: 5900,
      highlight: "Full data access",
      ctaLabel: "Select plan",
      features: [
        "Unlimited accounts",
        "5 live sync slots",
        "1,500 Edge credits every month",
      ],
      accountAllowanceLabel: "Unlimited",
      includedAiCredits: 1500,
      includedLiveSyncSlots: 5,
      includesPropTracker: true,
      isFree: false,
      upgradeOfferBasisPoints: 1500,
      stripePriceId: env.STRIPE_PRICE_INSTITUTIONAL_MONTHLY_ID,
      polarProductId: env.POLAR_PRODUCT_ELITE_ID,
    },
  ];
}

export function getBillingPlanDefinition(planKey: BillingPlanKey) {
  return getBillingPlanDefinitions().find((plan) => plan.key === planKey);
}

export function resolvePlanKeyFromProductId(productId?: string | null) {
  if (!productId) {
    return "student" as BillingPlanKey;
  }

  const plan = getBillingPlanDefinitions().find(
    (item) => item.polarProductId && item.polarProductId === productId
  );

  return plan?.key ?? ("student" as BillingPlanKey);
}

export function resolvePlanKeyFromStripePriceId(priceId?: string | null) {
  if (!priceId) {
    return "student" as BillingPlanKey;
  }

  const plan = getBillingPlanDefinitions().find(
    (item) => item.stripePriceId && item.stripePriceId === priceId
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
