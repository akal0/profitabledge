"use client";

import { z } from "zod";

import {
  parseDateTimeInputValue,
  toDateTimeInputValue,
} from "@/components/trades/trade-date-time-field";
import type {
  InlineTradeUpdateInput,
  TradeRow,
} from "@/features/trades/table/lib/trade-table-types";

const requiredNumberMessage = "Enter a valid number";
const requiredPositiveNumberMessage = "Enter a value greater than zero";

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRequiredNumber(value: string) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRequiredPositiveNumber(value: string) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export const tradeDetailFormSchema = z
  .object({
    closePrice: z.string(),
    closeTime: z.string(),
    commissions: z.string(),
    customTags: z.array(z.string().trim().min(1)).max(50),
    modelTag: z.string(),
    openPrice: z.string(),
    openTime: z.string(),
    profit: z.string(),
    protocolAlignment: z
      .enum(["aligned", "against", "discretionary"])
      .nullable(),
    sessionTag: z.string(),
    sl: z.string(),
    swap: z.string(),
    symbol: z.string().trim().min(1, "Enter a symbol").max(20),
    tp: z.string(),
    tradeType: z.enum(["long", "short"]),
    volume: z.string(),
  })
  .superRefine((values, context) => {
    if (parseRequiredPositiveNumber(values.volume) == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: requiredPositiveNumberMessage,
        path: ["volume"],
      });
    }

    if (parseRequiredPositiveNumber(values.openPrice) == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: requiredPositiveNumberMessage,
        path: ["openPrice"],
      });
    }

    if (parseRequiredPositiveNumber(values.closePrice) == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: requiredPositiveNumberMessage,
        path: ["closePrice"],
      });
    }

    if (parseRequiredNumber(values.profit) == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: requiredNumberMessage,
        path: ["profit"],
      });
    }

    if (parseRequiredNumber(values.commissions) == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: requiredNumberMessage,
        path: ["commissions"],
      });
    }

    if (parseRequiredNumber(values.swap) == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: requiredNumberMessage,
        path: ["swap"],
      });
    }

    if (values.sl.trim() && parseOptionalNumber(values.sl) == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: requiredNumberMessage,
        path: ["sl"],
      });
    }

    if (values.tp.trim() && parseOptionalNumber(values.tp) == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: requiredNumberMessage,
        path: ["tp"],
      });
    }

    const openTime = parseDateTimeInputValue(values.openTime);
    const closeTime = parseDateTimeInputValue(values.closeTime);

    if (!openTime) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid open time",
        path: ["openTime"],
      });
    }

    if (!closeTime) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid close time",
        path: ["closeTime"],
      });
    }

    if (openTime && closeTime && closeTime <= openTime) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Close time must be after open time",
        path: ["closeTime"],
      });
    }
  });

export type TradeDetailFormValues = z.infer<typeof tradeDetailFormSchema>;
export type TradeDetailField = keyof TradeDetailFormValues;

export const TRADE_DETAIL_CORE_FIELDS = [
  "symbol",
  "tradeType",
  "volume",
  "openPrice",
  "closePrice",
  "openTime",
  "closeTime",
] as const satisfies TradeDetailField[];

export const TRADE_DETAIL_METRIC_FIELDS = [
  "profit",
  "commissions",
  "swap",
] as const satisfies TradeDetailField[];

export const TRADE_DETAIL_ADVANCED_FIELDS = [
  "sl",
  "tp",
] as const satisfies TradeDetailField[];

export const TRADE_DETAIL_TAG_FIELDS = [
  "sessionTag",
  "modelTag",
  "customTags",
  "protocolAlignment",
] as const satisfies TradeDetailField[];

export const TRADE_DETAIL_LOCAL_STORAGE_PREFIX = "trade-detail-draft";

export function createTradeDetailFormValues(trade: TradeRow): TradeDetailFormValues {
  return {
    closePrice:
      trade.closePrice != null && Number.isFinite(Number(trade.closePrice))
        ? String(trade.closePrice)
        : "",
    closeTime: toDateTimeInputValue(new Date(trade.close)),
    commissions:
      trade.commissions != null && Number.isFinite(Number(trade.commissions))
        ? String(trade.commissions)
        : "0",
    customTags: Array.isArray(trade.customTags) ? trade.customTags : [],
    modelTag: trade.modelTag ?? "",
    openPrice:
      trade.openPrice != null && Number.isFinite(Number(trade.openPrice))
        ? String(trade.openPrice)
        : "",
    openTime: toDateTimeInputValue(new Date(trade.open)),
    profit:
      trade.profit != null && Number.isFinite(Number(trade.profit))
        ? String(trade.profit)
        : "0",
    protocolAlignment: trade.protocolAlignment ?? null,
    sessionTag: trade.sessionTag ?? "",
    sl:
      trade.sl != null && Number.isFinite(Number(trade.sl))
        ? String(trade.sl)
        : "",
    swap:
      trade.swap != null && Number.isFinite(Number(trade.swap))
        ? String(trade.swap)
        : "0",
    symbol: trade.rawSymbol ?? trade.symbol ?? "",
    tp:
      trade.tp != null && Number.isFinite(Number(trade.tp))
        ? String(trade.tp)
        : "",
    tradeType: trade.tradeDirection,
    volume:
      trade.volume != null && Number.isFinite(Number(trade.volume))
        ? String(trade.volume)
        : "",
  };
}

export function getTradeDetailFieldErrors(values: TradeDetailFormValues) {
  const parsed = tradeDetailFormSchema.safeParse(values);

  if (parsed.success) {
    return {} as Partial<Record<TradeDetailField, string>>;
  }

  return parsed.error.issues.reduce(
    (accumulator, issue) => {
      const field = issue.path[0] as TradeDetailField | undefined;
      if (field && !accumulator[field]) {
        accumulator[field] = issue.message;
      }
      return accumulator;
    },
    {} as Partial<Record<TradeDetailField, string>>
  );
}

export function hasTradeDetailSectionErrors(
  errors: Partial<Record<TradeDetailField, string>>,
  fields: readonly TradeDetailField[]
) {
  return fields.some((field) => Boolean(errors[field]));
}

export function hasTradeDetailSectionChanges(
  draft: TradeDetailFormValues,
  saved: TradeDetailFormValues,
  fields: readonly TradeDetailField[]
) {
  return fields.some((field) => {
    const draftValue = draft[field];
    const savedValue = saved[field];

    if (Array.isArray(draftValue) && Array.isArray(savedValue)) {
      return draftValue.join("\u0001") !== savedValue.join("\u0001");
    }

    return draftValue !== savedValue;
  });
}

export function buildTradeDetailUpdateInput(
  tradeId: string,
  values: TradeDetailFormValues,
  fields: readonly TradeDetailField[]
) {
  const payload: InlineTradeUpdateInput = { tradeId };

  for (const field of fields) {
    switch (field) {
      case "symbol":
        payload.symbol = values.symbol.trim().toUpperCase();
        break;
      case "tradeType":
        payload.tradeType = values.tradeType;
        break;
      case "volume":
        payload.volume = parseRequiredPositiveNumber(values.volume) ?? undefined;
        break;
      case "openPrice":
        payload.openPrice =
          parseRequiredPositiveNumber(values.openPrice) ?? undefined;
        break;
      case "closePrice":
        payload.closePrice =
          parseRequiredPositiveNumber(values.closePrice) ?? undefined;
        break;
      case "openTime": {
        const parsed = parseDateTimeInputValue(values.openTime);
        payload.openTime = parsed?.toISOString();
        break;
      }
      case "closeTime": {
        const parsed = parseDateTimeInputValue(values.closeTime);
        payload.closeTime = parsed?.toISOString();
        break;
      }
      case "sl":
        payload.sl = parseOptionalNumber(values.sl);
        break;
      case "tp":
        payload.tp = parseOptionalNumber(values.tp);
        break;
      case "profit":
        payload.profit = parseRequiredNumber(values.profit) ?? undefined;
        break;
      case "commissions":
        payload.commissions = parseRequiredNumber(values.commissions) ?? undefined;
        break;
      case "swap":
        payload.swap = parseRequiredNumber(values.swap) ?? undefined;
        break;
      case "sessionTag":
        payload.sessionTag = values.sessionTag.trim() || null;
        break;
      case "modelTag":
        payload.modelTag = values.modelTag.trim() || null;
        break;
      case "customTags":
        payload.customTags = values.customTags;
        break;
      case "protocolAlignment":
        payload.protocolAlignment = values.protocolAlignment;
        break;
    }
  }

  return payload;
}

export function getTradeDetailDraftStorageKey(tradeId: string) {
  return `${TRADE_DETAIL_LOCAL_STORAGE_PREFIX}:${tradeId}`;
}
