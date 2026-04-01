export type BillingPlanKey = "student" | "professional" | "institutional";

export const BILLING_PLAN_TITLES: Record<BillingPlanKey, string> = {
  student: "Explorer",
  professional: "Trader",
  institutional: "Elite",
};

export const BILLING_PLAN_SHORT_BADGES: Record<BillingPlanKey, string> = {
  student: "Free",
  professional: "Most popular",
  institutional: "Best value",
};

export function getBillingPlanTitle(planKey: BillingPlanKey) {
  return BILLING_PLAN_TITLES[planKey];
}

export function getNextBillingPlanKey(planKey: BillingPlanKey) {
  switch (planKey) {
    case "student":
      return "professional" as const;
    case "professional":
      return "institutional" as const;
    default:
      return null;
  }
}
