import {
  getBillingPlanDefinition,
  getHigherBillingPlanKey,
  type BillingPlanKey,
} from "./config";

export const STAFF_ACCESS_OVERRIDE_SOURCE = "staff_access_manual";

type BillingOverrideLike = {
  planKey?: string | null;
  sourceType?: string | null;
};

function normalizeBillingPlanKey(
  value?: string | null
): BillingPlanKey | null {
  if (!value) {
    return null;
  }

  return getBillingPlanDefinition(value as BillingPlanKey)
    ? (value as BillingPlanKey)
    : null;
}

export function selectPrimaryBillingOverride<T extends BillingOverrideLike>(
  overrides: readonly T[]
): T | null {
  const validOverrides = overrides.filter(
    (override): override is T => normalizeBillingPlanKey(override.planKey) !== null
  );

  if (validOverrides.length === 0) {
    return null;
  }

  const activeStaffOverride = validOverrides.find(
    (override) => override.sourceType === STAFF_ACCESS_OVERRIDE_SOURCE
  );

  if (activeStaffOverride) {
    return activeStaffOverride;
  }

  return validOverrides.reduce<T | null>((highestOverride, currentOverride) => {
    if (!highestOverride) {
      return currentOverride;
    }

    const highestPlanKey = normalizeBillingPlanKey(highestOverride.planKey);
    const currentPlanKey = normalizeBillingPlanKey(currentOverride.planKey);

    if (!highestPlanKey) {
      return currentOverride;
    }

    if (!currentPlanKey) {
      return highestOverride;
    }

    return getHigherBillingPlanKey(highestPlanKey, currentPlanKey) ===
      currentPlanKey
      ? currentOverride
      : highestOverride;
  }, null);
}

export function resolveEffectiveBillingPlanKey(input: {
  subscriptionPlanKey: BillingPlanKey;
  recentPaidOrderPlanKey?: BillingPlanKey;
  overrides?: readonly BillingOverrideLike[];
}) {
  const basePlanKey = getHigherBillingPlanKey(
    input.subscriptionPlanKey,
    input.recentPaidOrderPlanKey ?? "student"
  );
  const primaryOverride = selectPrimaryBillingOverride(input.overrides ?? []);
  const overridePlanKey = normalizeBillingPlanKey(primaryOverride?.planKey);

  if (!overridePlanKey) {
    return basePlanKey;
  }

  if (primaryOverride?.sourceType === STAFF_ACCESS_OVERRIDE_SOURCE) {
    return overridePlanKey;
  }

  return getHigherBillingPlanKey(basePlanKey, overridePlanKey);
}
