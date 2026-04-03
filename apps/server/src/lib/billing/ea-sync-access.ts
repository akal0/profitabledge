import { TRPCError } from "@trpc/server";

import { getBillingPlanTitle } from "./config";
import { canAccessBillingFeature } from "./feature-gates";
import { getEffectiveBillingState } from "./growth";

export const EA_SYNC_REQUIRED_PLAN_MESSAGE =
  `EA sync requires ${getBillingPlanTitle("professional")} or ${getBillingPlanTitle("institutional")} access.`;
export const BROKER_SYNC_REQUIRED_PLAN_MESSAGE =
  `Broker sync requires ${getBillingPlanTitle("professional")} or ${getBillingPlanTitle("institutional")} access.`;

export async function getLiveSyncAccessState(userId: string) {
  const billing = await getEffectiveBillingState(userId);

  return {
    activePlanKey: billing.activePlanKey,
    hasAccess: canAccessBillingFeature(billing.activePlanKey, "live-sync"),
  };
}

export async function requireLiveSyncAccess(
  userId: string,
  message = BROKER_SYNC_REQUIRED_PLAN_MESSAGE
) {
  const access = await getLiveSyncAccessState(userId);

  if (!access.hasAccess) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message,
    });
  }

  return access;
}

export async function requireEaSyncAccess(userId: string) {
  return requireLiveSyncAccess(userId, EA_SYNC_REQUIRED_PLAN_MESSAGE);
}
