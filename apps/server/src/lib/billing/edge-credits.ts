import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type {
  GenerateContentRequest,
  Part,
  UsageMetadata,
} from "@google/generative-ai";

import { db } from "../../db";
import {
  aiCreditUsage,
  billingEntitlementOverride,
  billingSubscription,
  edgeCreditGrant,
} from "../../db/schema/billing";
import {
  getBillingPlanDefinition,
  getHigherBillingPlanKey,
  type BillingPlanKey,
} from "./config";

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;
const MILLION = 1_000_000;
const DEFAULT_ESTIMATED_MAX_OUTPUT_TOKENS = 1_024;

export const EDGE_CREDIT_USD_MICROS = 10_000;
export const EDGE_CREDIT_EXHAUSTED_MESSAGE =
  "No Edge credits remain for platform AI this billing cycle. Upgrade your plan or wait for the next reset.";

export type AICredentialSource = "platform" | "user_key";

type GeminiModelPricing = {
  inputMicrosPerMillion: number;
  cachedInputMicrosPerMillion: number;
  outputMicrosPerMillion: number;
};

const GEMINI_MODEL_PRICING: Record<string, GeminiModelPricing> = {
  "gemini-2.5-flash": {
    inputMicrosPerMillion: 300_000,
    cachedInputMicrosPerMillion: 30_000,
    outputMicrosPerMillion: 2_500_000,
  },
  "gemini-2.5-flash-lite": {
    inputMicrosPerMillion: 100_000,
    cachedInputMicrosPerMillion: 10_000,
    outputMicrosPerMillion: 400_000,
  },
};

export type EdgeCreditSnapshot = {
  activePlanKey: BillingPlanKey;
  allowanceCredits: number;
  spentCredits: number;
  planRemainingCredits: number;
  bonusRemainingCredits: number;
  remainingCredits: number;
  spentCostMicros: number;
  cycleStart: Date | null;
  cycleEnd: Date | null;
};

export type RecordAICreditUsageInput = {
  userId: string;
  accountId?: string | null;
  credentialSource: AICredentialSource;
  provider: string;
  model: string;
  featureKey: string;
  usageMetadata?: UsageMetadata | null;
  estimatedPromptTokens?: number | null;
  estimatedMaxOutputTokens?: number | null;
  estimatedCostMicros?: number | null;
  chargedCostMicros?: number | null;
  metadata?: Record<string, unknown> | null;
};

type GenerateContentRequestLike =
  | string
  | Array<string | Part>
  | GenerateContentRequest;

function roundMicros(
  tokenCount: number,
  priceMicrosPerMillion: number
): number {
  return Math.max(
    0,
    Math.ceil((Math.max(0, tokenCount) * priceMicrosPerMillion) / MILLION)
  );
}

function resolvePricing(model: string): GeminiModelPricing {
  return GEMINI_MODEL_PRICING[model] ?? GEMINI_MODEL_PRICING["gemini-2.5-flash"];
}

function getBillingCycleAnchor(periodStart?: Date | null) {
  if (periodStart) {
    return periodStart;
  }

  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function calculateGeminiCostMicros(input: {
  model: string;
  usageMetadata?: UsageMetadata | null;
}) {
  const usage = input.usageMetadata;
  if (!usage) {
    return 0;
  }

  const pricing = resolvePricing(input.model);
  const cachedTokens = Math.max(0, usage.cachedContentTokenCount ?? 0);
  const promptTokens = Math.max(0, usage.promptTokenCount ?? 0);
  const uncachedPromptTokens = Math.max(0, promptTokens - cachedTokens);
  const outputTokens = Math.max(0, usage.candidatesTokenCount ?? 0);

  return (
    roundMicros(uncachedPromptTokens, pricing.inputMicrosPerMillion) +
    roundMicros(cachedTokens, pricing.cachedInputMicrosPerMillion) +
    roundMicros(outputTokens, pricing.outputMicrosPerMillion)
  );
}

export function estimatePromptTokens(request: GenerateContentRequestLike) {
  const serialized =
    typeof request === "string" ? request : JSON.stringify(request ?? "");
  const normalizedLength = Math.max(1, serialized.length);

  // Heuristic only for pre-call budgeting. We keep it slightly conservative.
  return Math.ceil(normalizedLength / 3.5);
}

export function extractEstimatedMaxOutputTokens(
  request: GenerateContentRequestLike
) {
  if (
    request &&
    typeof request === "object" &&
    !Array.isArray(request) &&
    "generationConfig" in request
  ) {
    const candidate = request.generationConfig?.maxOutputTokens;
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
  }

  return DEFAULT_ESTIMATED_MAX_OUTPUT_TOKENS;
}

export function estimateGeminiCostMicros(input: {
  model: string;
  promptTokens: number;
  maxOutputTokens?: number | null;
}) {
  const pricing = resolvePricing(input.model);
  const maxOutputTokens =
    input.maxOutputTokens && input.maxOutputTokens > 0
      ? input.maxOutputTokens
      : DEFAULT_ESTIMATED_MAX_OUTPUT_TOKENS;

  return (
    roundMicros(input.promptTokens, pricing.inputMicrosPerMillion) +
    roundMicros(maxOutputTokens, pricing.outputMicrosPerMillion)
  );
}

export async function getUserEdgeCreditSnapshot(
  userId: string
): Promise<EdgeCreditSnapshot> {
  const [subscription] = await db
    .select({
      planKey: billingSubscription.planKey,
      currentPeriodStart: billingSubscription.currentPeriodStart,
      currentPeriodEnd: billingSubscription.currentPeriodEnd,
      startedAt: billingSubscription.startedAt,
    })
    .from(billingSubscription)
    .where(
      and(
        eq(billingSubscription.userId, userId),
        inArray(billingSubscription.status, [...ACTIVE_SUBSCRIPTION_STATUSES])
      )
    )
    .orderBy(
      desc(billingSubscription.currentPeriodEnd),
      desc(billingSubscription.updatedAt)
    )
    .limit(1);

  const now = new Date();
  const [override] = await db
    .select({
      planKey: billingEntitlementOverride.planKey,
      startsAt: billingEntitlementOverride.startsAt,
      endsAt: billingEntitlementOverride.endsAt,
    })
    .from(billingEntitlementOverride)
    .where(
      and(
        eq(billingEntitlementOverride.userId, userId),
        lte(billingEntitlementOverride.startsAt, now),
        gte(billingEntitlementOverride.endsAt, now)
      )
    )
    .orderBy(desc(billingEntitlementOverride.endsAt))
    .limit(1);

  const subscriptionPlanKey = (subscription?.planKey ??
    "student") as BillingPlanKey;
  const activePlanKey = override?.planKey
    ? getHigherBillingPlanKey(
        subscriptionPlanKey,
        override.planKey as BillingPlanKey
      )
    : subscriptionPlanKey;
  const plan = getBillingPlanDefinition(activePlanKey);
  const allowanceCredits = plan?.includedAiCredits ?? 0;

  const cycleStart = getBillingCycleAnchor(
    subscription?.currentPeriodStart ?? subscription?.startedAt ?? null
  );
  const cycleEnd = subscription?.currentPeriodEnd ?? null;

  const usageConditions = [
    eq(aiCreditUsage.userId, userId),
    eq(aiCreditUsage.credentialSource, "platform"),
    gte(aiCreditUsage.createdAt, cycleStart),
  ];

  if (cycleEnd) {
    usageConditions.push(lte(aiCreditUsage.createdAt, cycleEnd));
  }

  const [usageRow] = await db
    .select({
      spentCostMicros:
        sql<number>`coalesce(sum(${aiCreditUsage.chargedCostMicros}), 0)`.mapWith(
          Number
        ),
    })
    .from(aiCreditUsage)
    .where(and(...usageConditions));

  const spentCostMicros = Math.max(0, usageRow?.spentCostMicros ?? 0);
  const spentCredits = Math.ceil(spentCostMicros / EDGE_CREDIT_USD_MICROS);
  const planRemainingCredits = Math.max(0, allowanceCredits - spentCredits);

  const [bonusRow] = await db
    .select({
      bonusRemainingCredits:
        sql<number>`coalesce(sum(${edgeCreditGrant.remainingCredits}), 0)`.mapWith(
          Number
        ),
    })
    .from(edgeCreditGrant)
    .where(
      and(
        eq(edgeCreditGrant.userId, userId),
        or(isNull(edgeCreditGrant.expiresAt), gte(edgeCreditGrant.expiresAt, now))
      )
    );

  const bonusRemainingCredits = Math.max(
    0,
    bonusRow?.bonusRemainingCredits ?? 0
  );
  const remainingCredits = planRemainingCredits + bonusRemainingCredits;

  return {
    activePlanKey,
    allowanceCredits,
    spentCredits,
    planRemainingCredits,
    bonusRemainingCredits,
    remainingCredits,
    spentCostMicros,
    cycleStart: allowanceCredits > 0 || bonusRemainingCredits > 0 ? cycleStart : null,
    cycleEnd,
  };
}

export async function assertPlatformAICreditsAvailable(userId: string) {
  const snapshot = await getUserEdgeCreditSnapshot(userId);

  if (snapshot.remainingCredits <= 0) {
    const error = new Error(EDGE_CREDIT_EXHAUSTED_MESSAGE);
    error.name = "EdgeCreditExhaustedError";
    throw error;
  }

  return snapshot;
}

export async function recordAICreditUsage(input: RecordAICreditUsageInput) {
  const snapshotBefore =
    input.credentialSource === "platform"
      ? await getUserEdgeCreditSnapshot(input.userId)
      : null;

  await db.insert(aiCreditUsage).values({
    id: crypto.randomUUID(),
    userId: input.userId,
    accountId: input.accountId ?? null,
    credentialSource: input.credentialSource,
    provider: input.provider,
    model: input.model,
    featureKey: input.featureKey,
    promptTokenCount: input.usageMetadata?.promptTokenCount ?? null,
    candidatesTokenCount: input.usageMetadata?.candidatesTokenCount ?? null,
    totalTokenCount: input.usageMetadata?.totalTokenCount ?? null,
    cachedContentTokenCount: input.usageMetadata?.cachedContentTokenCount ?? null,
    estimatedPromptTokens: input.estimatedPromptTokens ?? null,
    estimatedMaxOutputTokens: input.estimatedMaxOutputTokens ?? null,
    estimatedCostMicros: input.estimatedCostMicros ?? null,
    chargedCostMicros: Math.max(0, input.chargedCostMicros ?? 0),
    metadata: input.metadata ?? null,
  });

  if (
    input.credentialSource !== "platform" ||
    !snapshotBefore ||
    snapshotBefore.bonusRemainingCredits <= 0
  ) {
    return;
  }

  const chargedCredits = Math.ceil(
    Math.max(0, input.chargedCostMicros ?? 0) / EDGE_CREDIT_USD_MICROS
  );
  const bonusCreditsToConsume = Math.max(
    0,
    chargedCredits - snapshotBefore.planRemainingCredits
  );

  if (bonusCreditsToConsume <= 0) {
    return;
  }

  let remainingToConsume = bonusCreditsToConsume;
  const now = new Date();
  const grants = await db
    .select()
    .from(edgeCreditGrant)
    .where(
      and(
        eq(edgeCreditGrant.userId, input.userId),
        or(isNull(edgeCreditGrant.expiresAt), gte(edgeCreditGrant.expiresAt, now))
      )
    )
    .orderBy(asc(edgeCreditGrant.createdAt));

  for (const grant of grants) {
    if (remainingToConsume <= 0) {
      break;
    }

    const available = Math.max(0, grant.remainingCredits);
    if (available <= 0) {
      continue;
    }

    const consumed = Math.min(available, remainingToConsume);
    remainingToConsume -= consumed;

    await db
      .update(edgeCreditGrant)
      .set({
        remainingCredits: available - consumed,
        updatedAt: new Date(),
      })
      .where(eq(edgeCreditGrant.id, grant.id));
  }
}
