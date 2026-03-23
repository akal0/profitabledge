import "dotenv/config";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "../db";
import { billingSubscription } from "../db/schema/billing";
import {
  disconnectLegacyBillingCustomerByUserId,
  syncStripeBillingStateForUserId,
} from "../routers/billing";

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const legacyRows = await db
    .select({
      userId: billingSubscription.userId,
    })
    .from(billingSubscription)
    .where(
      and(
        eq(billingSubscription.provider, "polar"),
        inArray(billingSubscription.status, [...ACTIVE_SUBSCRIPTION_STATUSES])
      )
    );

  const userIds = [...new Set(legacyRows.map((row) => row.userId))];
  let syncedUserCount = 0;
  let cutoverReadyUserCount = 0;
  let disconnectedUserCount = 0;
  let skippedUserCount = 0;

  for (const userId of userIds) {
    await syncStripeBillingStateForUserId(userId);
    syncedUserCount += 1;

    const [activeStripeSubscription] = await db
      .select({
        id: billingSubscription.id,
      })
      .from(billingSubscription)
      .where(
        and(
          eq(billingSubscription.userId, userId),
          eq(billingSubscription.provider, "stripe"),
          inArray(billingSubscription.status, [...ACTIVE_SUBSCRIPTION_STATUSES])
        )
      )
      .limit(1);

    if (!activeStripeSubscription) {
      skippedUserCount += 1;
      continue;
    }

    cutoverReadyUserCount += 1;
    if (dryRun) {
      continue;
    }

    const result = await disconnectLegacyBillingCustomerByUserId({
      userId,
      disconnectedByUserId: "stripe_billing_cutover_script",
      reason: "Legacy Polar access disabled after Stripe subscription became active",
    });

    if (result.disconnectedSubscriptionCount > 0) {
      disconnectedUserCount += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        totalLegacyUsers: userIds.length,
        syncedUserCount,
        cutoverReadyUserCount,
        disconnectedUserCount,
        skippedUserCount,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
