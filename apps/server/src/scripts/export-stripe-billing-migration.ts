import "dotenv/config";

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "../db";
import { billingCustomer, billingSubscription } from "../db/schema/billing";
import {
  getBillingPlanDefinition,
  type BillingPlanKey,
} from "../lib/billing/config";

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;
const DEFAULT_OUTPUT_PATH = resolve(
  process.cwd(),
  "tmp/stripe-billing-migration.csv"
);

function toCsvCell(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  const normalized = String(value);
  if (
    normalized.includes(",") ||
    normalized.includes("\"") ||
    normalized.includes("\n")
  ) {
    return `"${normalized.replace(/"/g, "\"\"")}"`;
  }

  return normalized;
}

function compareSubscriptionPriority(
  left: {
    planKey: string;
    currentPeriodEnd: Date | null;
    updatedAt: Date;
  },
  right: {
    planKey: string;
    currentPeriodEnd: Date | null;
    updatedAt: Date;
  }
) {
  const leftPrice =
    getBillingPlanDefinition(left.planKey as BillingPlanKey)?.monthlyPriceCents ??
    0;
  const rightPrice =
    getBillingPlanDefinition(right.planKey as BillingPlanKey)?.monthlyPriceCents ??
    0;

  if (leftPrice !== rightPrice) {
    return rightPrice - leftPrice;
  }

  const leftPeriodEnd = left.currentPeriodEnd?.getTime() ?? 0;
  const rightPeriodEnd = right.currentPeriodEnd?.getTime() ?? 0;
  if (leftPeriodEnd !== rightPeriodEnd) {
    return rightPeriodEnd - leftPeriodEnd;
  }

  return right.updatedAt.getTime() - left.updatedAt.getTime();
}

function resolveScheduledTimestamps(currentPeriodEnd?: Date | null) {
  const minimumStartMs = Date.now() + 25 * 60 * 60 * 1000;
  const cycleAnchorMs = currentPeriodEnd?.getTime() ?? minimumStartMs;
  const scheduledStartMs = Math.max(cycleAnchorMs, minimumStartMs);

  return {
    startDateEpoch: Math.floor(scheduledStartMs / 1000),
    billingCycleAnchorEpoch: Math.floor(scheduledStartMs / 1000),
    adjusted: scheduledStartMs !== cycleAnchorMs,
  };
}

async function main() {
  const outFlag = process.argv.find((value) => value.startsWith("--out="));
  const outPath = outFlag ? resolve(outFlag.slice(6)) : DEFAULT_OUTPUT_PATH;

  const rows = await db
    .select({
      userId: billingSubscription.userId,
      subscriptionId: billingSubscription.id,
      polarSubscriptionId: billingSubscription.polarSubscriptionId,
      planKey: billingSubscription.planKey,
      currentPeriodEnd: billingSubscription.currentPeriodEnd,
      cancelAtPeriodEnd: billingSubscription.cancelAtPeriodEnd,
      updatedAt: billingSubscription.updatedAt,
      stripeCustomerId: billingCustomer.stripeCustomerId,
    })
    .from(billingSubscription)
    .innerJoin(billingCustomer, eq(billingCustomer.userId, billingSubscription.userId))
    .where(
      and(
        eq(billingSubscription.provider, "polar"),
        inArray(billingSubscription.status, [...ACTIVE_SUBSCRIPTION_STATUSES])
      )
    )
    .orderBy(
      desc(billingSubscription.currentPeriodEnd),
      desc(billingSubscription.updatedAt)
    );

  const selectedByUserId = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const existing = selectedByUserId.get(row.userId);
    if (!existing) {
      selectedByUserId.set(row.userId, row);
      continue;
    }

    if (compareSubscriptionPriority(existing, row) > 0) {
      selectedByUserId.set(row.userId, row);
    }
  }

  const csvRows: string[][] = [
    [
      "customer",
      "start_date",
      "price",
      "quantity",
      "billing_cycle_anchor",
      "collection_method",
      "proration_behavior",
      "cancel_at_period_end",
      "metadata_source",
      "metadata_third_party_sub_id",
      "metadata_user_id",
      "metadata_plan_key",
    ],
  ];

  let skippedWithoutStripeCustomer = 0;
  let skippedWithoutPrice = 0;
  let adjustedStartDateCount = 0;

  for (const row of selectedByUserId.values()) {
    const plan = getBillingPlanDefinition(row.planKey as BillingPlanKey);
    if (!row.stripeCustomerId) {
      skippedWithoutStripeCustomer += 1;
      continue;
    }

    if (!plan?.stripePriceId) {
      skippedWithoutPrice += 1;
      continue;
    }

    const schedule = resolveScheduledTimestamps(row.currentPeriodEnd);
    if (schedule.adjusted) {
      adjustedStartDateCount += 1;
    }

    csvRows.push([
      row.stripeCustomerId,
      schedule.startDateEpoch,
      plan.stripePriceId,
      1,
      schedule.billingCycleAnchorEpoch,
      "charge_automatically",
      "none",
      row.cancelAtPeriodEnd,
      "external:polar",
      row.polarSubscriptionId ?? row.subscriptionId,
      row.userId,
      row.planKey,
    ].map((value) => toCsvCell(value)));
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, csvRows.map((row) => row.join(",")).join("\n"));

  const summaryPath = outPath.replace(/\.csv$/i, ".summary.json");
  writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        outPath,
        subscriptionCount: csvRows.length - 1,
        skippedWithoutStripeCustomer,
        skippedWithoutPrice,
        adjustedStartDateCount,
      },
      null,
      2
    )
  );

  console.log(
    JSON.stringify(
      {
        outPath,
        summaryPath,
        subscriptionCount: csvRows.length - 1,
        skippedWithoutStripeCustomer,
        skippedWithoutPrice,
        adjustedStartDateCount,
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
