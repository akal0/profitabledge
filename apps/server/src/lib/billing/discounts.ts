import {
  getBillingPlanDefinition,
  BILLING_PLAN_TIER,
  type BillingPlanKey,
} from "./config";
import { getPolarClient } from "./polar";

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
  if (!plan?.polarProductId || !basisPoints) {
    return null;
  }

  const polar = getPolarClient();

  return polar.discounts.create({
    duration: "once",
    type: "percentage",
    basisPoints,
    maxRedemptions: 1,
    products: [plan.polarProductId],
    name: `Upgrade offer ${input.targetPlanKey} for ${input.userId}`,
    metadata: {
      user_id: input.userId,
      reward_type: "upgrade_offer",
      current_plan: input.currentPlanKey,
      target_plan: input.targetPlanKey,
      basis_points: String(basisPoints),
    },
  });
}
