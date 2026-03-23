import "dotenv/config";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "../db";
import { billingSubscription } from "../db/schema/billing";
import { prepareLegacyBillingCustomerForStripeBetaMigrationByUserId } from "../routers/billing";

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;
const SCRIPT_ACTOR = "stripe_beta_cutover_script";

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
  let preparedUserCount = 0;
  let preparedOverrideCount = 0;
  let disconnectedSubscriptionCount = 0;

  for (const userId of userIds) {
    if (dryRun) {
      preparedUserCount += 1;
      continue;
    }

    const result =
      await prepareLegacyBillingCustomerForStripeBetaMigrationByUserId({
        userId,
        preparedByUserId: SCRIPT_ACTOR,
        reason:
          "Private beta billing is moving to Stripe. Continue in Settings > Billing to re-enter payment details.",
      });

    preparedUserCount += 1;
    if (result.preparedOverrideId) {
      preparedOverrideCount += 1;
    }
    disconnectedSubscriptionCount += result.disconnectedSubscriptionCount;
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        totalLegacyUsers: userIds.length,
        preparedUserCount,
        preparedOverrideCount,
        disconnectedSubscriptionCount,
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
