import "dotenv/config";

import { and, desc, eq, inArray, ne } from "drizzle-orm";

import { db } from "../db";
import { user as userTable } from "../db/schema/auth";
import { billingCustomer, billingSubscription } from "../db/schema/billing";
import { getStripeClient } from "../lib/billing/stripe";

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;

function mergeMigrationMetadata(
  metadata: unknown,
  input: {
    source: string;
    stripeCustomerId: string;
    polarCustomerId?: string | null;
  }
) {
  const existing =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};

  return {
    ...existing,
    stripeMigration: {
      source: input.source,
      stripeCustomerId: input.stripeCustomerId,
      polarCustomerId: input.polarCustomerId ?? null,
      backfilledAt: new Date().toISOString(),
    },
  };
}

async function main() {
  const stripe = getStripeClient();
  const rows = await db
    .select({
      userId: userTable.id,
      email: userTable.email,
      name: userTable.name,
      billingCustomerId: billingCustomer.id,
      stripeCustomerId: billingCustomer.stripeCustomerId,
      polarCustomerId: billingCustomer.polarCustomerId,
      customerMetadata: billingCustomer.metadata,
      subscriptionId: billingSubscription.id,
      planKey: billingSubscription.planKey,
      currentPeriodEnd: billingSubscription.currentPeriodEnd,
      updatedAt: billingSubscription.updatedAt,
    })
    .from(billingSubscription)
    .innerJoin(userTable, eq(userTable.id, billingSubscription.userId))
    .leftJoin(billingCustomer, eq(billingCustomer.userId, billingSubscription.userId))
    .where(
      and(
        inArray(billingSubscription.status, [...ACTIVE_SUBSCRIPTION_STATUSES]),
        ne(billingSubscription.planKey, "student")
      )
    )
    .orderBy(
      desc(billingSubscription.currentPeriodEnd),
      desc(billingSubscription.updatedAt)
    );

  const candidates = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!candidates.has(row.userId)) {
      candidates.set(row.userId, row);
    }
  }

  let createdCount = 0;
  let skippedCount = 0;

  for (const row of candidates.values()) {
    if (row.stripeCustomerId) {
      skippedCount += 1;
      continue;
    }

    const customer = await stripe.customers.create({
      email: row.email ?? undefined,
      name: row.name ?? undefined,
      metadata: {
        user_id: row.userId,
        migrated_from: "polar",
        legacy_plan_key: row.planKey,
      },
    });

    if (row.billingCustomerId) {
      await db
        .update(billingCustomer)
        .set({
          stripeCustomerId: customer.id,
          email: row.email ?? null,
          name: row.name ?? null,
          metadata: mergeMigrationMetadata(row.customerMetadata, {
            source: "backfill_stripe_billing_customers",
            stripeCustomerId: customer.id,
            polarCustomerId: row.polarCustomerId ?? null,
          }),
          updatedAt: new Date(),
        })
        .where(eq(billingCustomer.id, row.billingCustomerId));
    } else {
      await db.insert(billingCustomer).values({
        id: crypto.randomUUID(),
        userId: row.userId,
        provider: "stripe",
        providerCustomerId: customer.id,
        stripeCustomerId: customer.id,
        email: row.email ?? null,
        name: row.name ?? null,
        metadata: mergeMigrationMetadata(null, {
          source: "backfill_stripe_billing_customers",
          stripeCustomerId: customer.id,
          polarCustomerId: null,
        }),
      });
    }

    createdCount += 1;
  }

  console.log(
    JSON.stringify(
      {
        totalCandidates: candidates.size,
        createdCount,
        skippedCount,
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
