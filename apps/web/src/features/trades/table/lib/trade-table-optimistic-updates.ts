import type {
  InlineTradeUpdateField,
  InlineTradeUpdateInput,
  TradeRow,
} from "./trade-table-types";

const INLINE_TRADE_UPDATE_FIELDS: InlineTradeUpdateField[] = [
  "symbol",
  "tradeType",
  "volume",
  "openPrice",
  "closePrice",
  "openTime",
  "closeTime",
  "sl",
  "tp",
  "profit",
  "commissions",
  "swap",
  "sessionTag",
  "protocolAlignment",
  "modelTag",
  "customTags",
];

const INLINE_TRADE_UPDATE_FIELD_LABELS: Record<
  InlineTradeUpdateField,
  string
> = {
  closePrice: "close price",
  closeTime: "close time",
  commissions: "commissions",
  customTags: "trade tags",
  modelTag: "edge",
  openPrice: "open price",
  openTime: "open time",
  profit: "profit",
  protocolAlignment: "protocol alignment",
  sessionTag: "session",
  sl: "stop loss",
  swap: "swap",
  symbol: "symbol",
  tp: "take profit",
  tradeType: "direction",
  volume: "volume",
};

export function getInlineTradeUpdateField(
  input: InlineTradeUpdateInput
): InlineTradeUpdateField | null {
  for (const field of INLINE_TRADE_UPDATE_FIELDS) {
    if (field in input) {
      return field;
    }
  }

  return null;
}

export function getInlineTradeUpdateFieldLabel(
  field: InlineTradeUpdateField | null
) {
  return field ? INLINE_TRADE_UPDATE_FIELD_LABELS[field] : "trade field";
}

export function applyInlineTradeUpdateToTrade(
  trade: TradeRow,
  input: InlineTradeUpdateInput
): TradeRow {
  if (trade.id !== input.tradeId) {
    return trade;
  }

  let nextTrade = trade;

  if (input.symbol !== undefined) {
    const symbol = input.symbol.toUpperCase();
    nextTrade = {
      ...nextTrade,
      rawSymbol: symbol,
      symbol,
      symbolGroup: symbol,
    };
  }

  if (input.tradeType !== undefined) {
    nextTrade = { ...nextTrade, tradeDirection: input.tradeType };
  }

  if (input.volume !== undefined) {
    nextTrade = { ...nextTrade, volume: input.volume };
  }

  if (input.openPrice !== undefined) {
    nextTrade = { ...nextTrade, openPrice: input.openPrice };
  }

  if (input.closePrice !== undefined) {
    nextTrade = { ...nextTrade, closePrice: input.closePrice };
  }

  if (input.openTime !== undefined) {
    nextTrade = { ...nextTrade, open: input.openTime };
  }

  if (input.closeTime !== undefined) {
    nextTrade = { ...nextTrade, close: input.closeTime };
  }

  if (input.sl !== undefined) {
    nextTrade = { ...nextTrade, sl: input.sl };
  }

  if (input.tp !== undefined) {
    nextTrade = { ...nextTrade, tp: input.tp };
  }

  if (input.profit !== undefined) {
    nextTrade = { ...nextTrade, profit: input.profit };
  }

  if (input.commissions !== undefined) {
    nextTrade = { ...nextTrade, commissions: input.commissions };
  }

  if (input.swap !== undefined) {
    nextTrade = { ...nextTrade, swap: input.swap };
  }

  if (input.sessionTag !== undefined) {
    nextTrade = { ...nextTrade, sessionTag: input.sessionTag };
  }

  if (input.protocolAlignment !== undefined) {
    nextTrade = {
      ...nextTrade,
      protocolAlignment: input.protocolAlignment,
    };
  }

  if (input.modelTag !== undefined) {
    nextTrade = {
      ...nextTrade,
      edgeName: input.modelTag,
      modelTag: input.modelTag,
    };
  }

  if (input.customTags !== undefined) {
    nextTrade = { ...nextTrade, customTags: input.customTags };
  }

  return nextTrade;
}

export function applyInlineTradeUpdateToQueryData(
  data: unknown,
  input: InlineTradeUpdateInput
) {
  if (!data || typeof data !== "object") {
    return data;
  }

  if (Array.isArray((data as { pages?: unknown }).pages)) {
    return {
      ...(data as { pages: unknown[] }),
      pages: (data as { pages: Array<Record<string, unknown>> }).pages.map(
        (page) => {
          if (!Array.isArray(page.items)) {
            return page;
          }

          return {
            ...page,
            items: page.items.map((item) =>
              applyInlineTradeUpdateToTrade(item as TradeRow, input)
            ),
          };
        }
      ),
    };
  }

  if (Array.isArray((data as { items?: unknown }).items)) {
    return {
      ...(data as { items: unknown[] }),
      items: (data as { items: unknown[] }).items.map((item) =>
        applyInlineTradeUpdateToTrade(item as TradeRow, input)
      ),
    };
  }

  if ((data as { id?: string }).id === input.tradeId) {
    return applyInlineTradeUpdateToTrade(data as TradeRow, input);
  }

  return data;
}
