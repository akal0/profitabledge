import { and, asc, eq, gte } from "drizzle-orm";

import { db } from "../../db";
import { aiCreditUsage } from "../../db/schema/billing";
import { EDGE_CREDIT_USD_MICROS } from "../billing/edge-credits";

export const AI_USAGE_VIEW_KEYS = [
  "profitabledge",
  "gemini",
  "openai",
  "anthropic",
] as const;

export type AIUsageViewKey = (typeof AI_USAGE_VIEW_KEYS)[number];

type AIUsagePoint = {
  date: string;
  label: string;
  requests: number;
  totalTokens: number;
  chargedCredits: number;
  spendUsd: number;
};

type AIUsageViewSummary = {
  totalRequests: number;
  totalTokens: number;
  chargedCredits: number;
  spendUsd: number;
  data: AIUsagePoint[];
};

function clampDays(days: number) {
  return Math.min(Math.max(Math.floor(days), 7), 90);
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function addUtcDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
}

function formatDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function createEmptyPoint(date: Date): AIUsagePoint {
  return {
    date: formatDayKey(date),
    label: formatDayLabel(date),
    requests: 0,
    totalTokens: 0,
    chargedCredits: 0,
    spendUsd: 0,
  };
}

function createEmptySummary(days: number, start: Date): AIUsageViewSummary {
  return {
    totalRequests: 0,
    totalTokens: 0,
    chargedCredits: 0,
    spendUsd: 0,
    data: Array.from({ length: days }, (_, index) =>
      createEmptyPoint(addUtcDays(start, index))
    ),
  };
}

function normalizeUsageProviderView(
  provider: string | null | undefined,
  model: string | null | undefined
): Exclude<AIUsageViewKey, "profitabledge"> | null {
  const normalizedProvider = (provider ?? "").trim().toLowerCase();
  const normalizedModel = (model ?? "").trim().toLowerCase();

  if (
    normalizedProvider === "google" ||
    normalizedProvider === "gemini" ||
    normalizedModel.startsWith("gemini")
  ) {
    return "gemini";
  }

  if (normalizedProvider === "openai" || normalizedModel.startsWith("gpt")) {
    return "openai";
  }

  if (
    normalizedProvider === "anthropic" ||
    normalizedProvider === "claude" ||
    normalizedModel.startsWith("claude")
  ) {
    return "anthropic";
  }

  return null;
}

function resolveTotalTokens(row: {
  totalTokenCount: number | null;
  promptTokenCount: number | null;
  candidatesTokenCount: number | null;
  estimatedPromptTokens: number | null;
}) {
  if (row.totalTokenCount != null) {
    return Math.max(0, row.totalTokenCount);
  }

  return Math.max(
    0,
    (row.promptTokenCount ?? 0) +
      (row.candidatesTokenCount ?? 0) +
      (row.estimatedPromptTokens ?? 0)
  );
}

function microsToCredits(value: number) {
  return Math.round((Math.max(0, value) / EDGE_CREDIT_USD_MICROS) * 100) / 100;
}

function microsToUsd(value: number) {
  return Math.round((Math.max(0, value) / 1_000_000) * 100) / 100;
}

function accumulate(
  summary: AIUsageViewSummary,
  dayIndex: number,
  row: {
    chargedCostMicros: number | null;
    totalTokenCount: number | null;
    promptTokenCount: number | null;
    candidatesTokenCount: number | null;
    estimatedPromptTokens: number | null;
  }
) {
  const chargedCostMicros = Math.max(0, row.chargedCostMicros ?? 0);
  const totalTokens = resolveTotalTokens(row);
  const chargedCredits = microsToCredits(chargedCostMicros);
  const spendUsd = microsToUsd(chargedCostMicros);
  const point = summary.data[dayIndex];

  point.requests += 1;
  point.totalTokens += totalTokens;
  point.chargedCredits =
    Math.round((point.chargedCredits + chargedCredits) * 100) / 100;
  point.spendUsd = Math.round((point.spendUsd + spendUsd) * 100) / 100;

  summary.totalRequests += 1;
  summary.totalTokens += totalTokens;
  summary.chargedCredits =
    Math.round((summary.chargedCredits + chargedCredits) * 100) / 100;
  summary.spendUsd = Math.round((summary.spendUsd + spendUsd) * 100) / 100;
}

export async function buildAIUsageSummary(userId: string, days = 30) {
  const normalizedDays = clampDays(days);
  const today = startOfUtcDay(new Date());
  const start = addUtcDays(today, -(normalizedDays - 1));

  const rows = await db
    .select({
      createdAt: aiCreditUsage.createdAt,
      credentialSource: aiCreditUsage.credentialSource,
      provider: aiCreditUsage.provider,
      model: aiCreditUsage.model,
      promptTokenCount: aiCreditUsage.promptTokenCount,
      candidatesTokenCount: aiCreditUsage.candidatesTokenCount,
      totalTokenCount: aiCreditUsage.totalTokenCount,
      estimatedPromptTokens: aiCreditUsage.estimatedPromptTokens,
      chargedCostMicros: aiCreditUsage.chargedCostMicros,
    })
    .from(aiCreditUsage)
    .where(and(eq(aiCreditUsage.userId, userId), gte(aiCreditUsage.createdAt, start)))
    .orderBy(asc(aiCreditUsage.createdAt));

  const views = Object.fromEntries(
    AI_USAGE_VIEW_KEYS.map((key) => [key, createEmptySummary(normalizedDays, start)])
  ) as Record<AIUsageViewKey, AIUsageViewSummary>;

  for (const row of rows) {
    const createdAt = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
    const dayIndex = Math.floor(
      (startOfUtcDay(createdAt).getTime() - start.getTime()) / 86_400_000
    );

    if (dayIndex < 0 || dayIndex >= normalizedDays) {
      continue;
    }

    const matchedViews = new Set<AIUsageViewKey>();
    if (row.credentialSource === "platform") {
      matchedViews.add("profitabledge");
    }

    const providerView = normalizeUsageProviderView(row.provider, row.model);
    if (providerView) {
      matchedViews.add(providerView);
    }

    for (const key of matchedViews) {
      accumulate(views[key], dayIndex, row);
    }
  }

  return {
    days: normalizedDays,
    views,
  };
}
