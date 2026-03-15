export type BillingPlanKey = "student" | "professional" | "institutional";

export const BILLING_PLAN_CARD_META: Record<
  BillingPlanKey,
  { imageSrc: string; badgeClassName: string }
> = {
  student: {
    imageSrc: "/plans/explorer.png",
    badgeClassName: "bg-sidebar text-sidebar",
  },
  professional: {
    imageSrc: "/plans/trader.png",
    badgeClassName: "ring ring-blue-500/20 bg-blue-500/10 text-blue-300",
  },
  institutional: {
    imageSrc: "/plans/institutional.png",
    badgeClassName: "ring ring-emerald-500/20 bg-emerald-500/10 text-white",
  },
};

export function getBillingPlanCardBadgeClassName(planKey: BillingPlanKey) {
  return BILLING_PLAN_CARD_META[planKey].badgeClassName;
}
