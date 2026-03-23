import {
  getBillingPlanDefinition,
  BILLING_PLAN_TIER,
  type BillingPlanKey,
} from "./config";
import { clampStripeDisplayString, getStripeClient } from "./stripe";

function isUpgradeTargetPlan(
  currentPlanKey: BillingPlanKey,
  targetPlanKey: BillingPlanKey
) {
  return BILLING_PLAN_TIER[targetPlanKey] > BILLING_PLAN_TIER[currentPlanKey];
}

export function getUpgradeOfferBasisPoints(targetPlanKey: BillingPlanKey) {
  return (
    getBillingPlanDefinition(targetPlanKey)?.upgradeOfferBasisPoints ?? null
  );
}

export async function createUpgradeOfferDiscount(input: {
  userId: string;
  currentPlanKey: BillingPlanKey;
  targetPlanKey: BillingPlanKey;
}) {
  if (!isUpgradeTargetPlan(input.currentPlanKey, input.targetPlanKey)) {
    return null;
  }

  const plan = getBillingPlanDefinition(input.targetPlanKey);
  const basisPoints = plan?.upgradeOfferBasisPoints ?? null;
  if (!basisPoints) {
    return null;
  }

  const stripe = getStripeClient();

  return stripe.coupons.create({
    percent_off: basisPoints / 100,
    duration: "once",
    max_redemptions: 1,
    name: clampStripeDisplayString(
      `Upgrade ${input.targetPlanKey} ${input.userId.slice(0, 8)}`
    ),
    metadata: {
      user_id: input.userId,
      reward_type: "upgrade_offer",
      current_plan: input.currentPlanKey,
      target_plan: input.targetPlanKey,
      basis_points: String(basisPoints),
      billing_provider: "stripe",
    },
  });
}
