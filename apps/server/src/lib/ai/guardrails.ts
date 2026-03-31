import type { ExecutionResult } from "./query-executor";
import type { TradeQueryPlan } from "./query-plan";

export type GuardrailReason =
  | "insufficient_sample"
  | "missing_fields"
  | "high_variance";

export interface GuardrailStatus {
  reason: GuardrailReason;
  message: string;
}

export function formatGuardrailFollowUp(status: GuardrailStatus): string {
  const prompt =
    status.reason === "missing_fields"
      ? "If you can point me to a more complete metric, account, or timeframe, I can take another pass."
      : "If you can narrow it down to a specific account, timeframe, setup, or metric, I can take another pass.";

  return `${status.message}\n\n${prompt}`;
}

const MIN_SAMPLE_SIZE = 3;

export function getGuardrailStatus(
  result: ExecutionResult,
  plan: TradeQueryPlan
): GuardrailStatus | null {
  const rowCount = result.meta?.rowCount ?? 0;

  if (
    plan.intent !== "aggregate" &&
    plan.intent !== "compare" &&
    plan.intent !== "recommendation"
  ) {
    return null;
  }

  if (plan.intent === "compare" && result.data) {
    const countA = Number(result.data?.a?.count ?? 0);
    const countB = Number(result.data?.b?.count ?? 0);
    if (countA === 0 || countB === 0) {
      const minCount = Math.min(countA, countB);
      return {
        reason: "insufficient_sample",
        message: `I don't have enough data to answer this reliably yet (n=${minCount}).`,
      };
    }
  }

  if (rowCount === 0 || rowCount < MIN_SAMPLE_SIZE) {
    return {
      reason: "insufficient_sample",
      message: `I don't have enough data to answer this reliably yet (n=${rowCount}).`,
    };
  }

  if (hasMissingAggregates(result, plan)) {
    return {
      reason: "missing_fields",
      message:
        "I don't have enough data to answer this reliably yet (missing required fields for this metric).",
    };
  }

  return null;
}

function hasMissingAggregates(
  result: ExecutionResult,
  plan: TradeQueryPlan
): boolean {
  const aggregates = result.meta?.aggregates;
  if (!aggregates || !plan.aggregates || plan.aggregates.length === 0) {
    return false;
  }

  const values = plan.aggregates.map((agg) => aggregates[agg.as]);
  if (values.length === 0) return false;

  return values.every((value) => isMissingValue(value));
}

function isMissingValue(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "number") return Number.isNaN(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length === 0 || trimmed.toLowerCase() === "nan";
  }
  return false;
}
