import { z } from "zod";

import type {
  ManualTradeDate,
  ManualTradeDirection,
  ManualTradeMode,
  ManualTradeValidationIssue,
  ManualTradeValidationResult,
} from "./types";

export const manualTradeDirectionSchema = z.enum(["long", "short"]);
export const manualTradeModeSchema = z.enum(["open", "closed"]);

export const manualTradeTimingSchema = z.object({
  openTime: z.union([z.date(), z.string(), z.null()]).optional(),
  closeTime: z.union([z.date(), z.string(), z.null()]).optional(),
  mode: manualTradeModeSchema.default("closed"),
});

export const manualTradeCoreSchema = z.object({
  accountId: z.string().min(1),
  symbol: z.string().min(1),
  tradeType: manualTradeDirectionSchema,
  volume: z.number().positive().optional(),
  openPrice: z.number().positive().optional(),
  closePrice: z.number().positive().optional(),
  currentPrice: z.number().positive().optional(),
  openTime: z.union([z.date(), z.string(), z.null()]).optional(),
  closeTime: z.union([z.date(), z.string(), z.null()]).optional(),
  sl: z.number().optional(),
  tp: z.number().optional(),
  profit: z.number().optional(),
  commissions: z.number().optional(),
  swap: z.number().optional(),
  sessionTag: z.string().optional(),
  modelTag: z.string().optional(),
  customTags: z.array(z.string()).optional(),
});

function coerceManualTradeDate(input: ManualTradeDate) {
  if (input == null || input === "") return null;
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : new Date(input);
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildIssue(
  field: string,
  message: string
): ManualTradeValidationIssue {
  return { field, message };
}

export function validateManualTradeTiming(input: {
  openTime?: ManualTradeDate;
  closeTime?: ManualTradeDate;
  mode?: ManualTradeMode;
  allowOpenTrade?: boolean;
}): ManualTradeValidationResult {
  const mode = input.mode ?? "closed";
  const openTime = coerceManualTradeDate(input.openTime);
  const closeTime = coerceManualTradeDate(input.closeTime);
  const issues: ManualTradeValidationIssue[] = [];

  if (!openTime) {
    issues.push(buildIssue("openTime", "Open time is required."));
  }

  if (mode === "closed" && !closeTime) {
    issues.push(buildIssue("closeTime", "Close time is required."));
  }

  if (openTime && closeTime && closeTime <= openTime) {
    issues.push(buildIssue("closeTime", "Close time must be after open time."));
  }

  if (mode === "open" && input.allowOpenTrade === false) {
    issues.push(
      buildIssue("mode", "This account or flow does not allow open trades.")
    );
  }

  return {
    isValid: issues.length === 0,
    issues,
    openTime,
    closeTime,
    mode,
    hasLiveWindow: mode === "open" || !closeTime,
  };
}

export function normalizeManualTradeDirection(
  value: string | null | undefined
): ManualTradeDirection | null {
  const next = String(value || "")
    .trim()
    .toLowerCase();
  if (next === "long" || next === "buy") return "long";
  if (next === "short" || next === "sell") return "short";
  return null;
}

export function normalizeManualTradeMode(
  value: string | null | undefined
): ManualTradeMode | null {
  const next = String(value || "")
    .trim()
    .toLowerCase();
  if (next === "open" || next === "live") return "open";
  if (next === "closed" || next === "close") return "closed";
  return null;
}
