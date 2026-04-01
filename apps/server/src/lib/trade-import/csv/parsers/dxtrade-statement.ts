import type {
  BrokerCsvImportContext,
  BrokerCsvParser,
  NormalizedImportedTrade,
} from "../types";
import {
  deriveTradeDurationSeconds,
  inferTradeDirectionFromMove,
  parseTradeDirection,
  pickDate,
  pickNumber,
  pickValue,
} from "../utils";

function coalesceNumbers(...values: Array<number | null>): number | null {
  for (const value of values) {
    if (value != null) {
      return value;
    }
  }
  return null;
}

function mapDxTradeStatementTrade(
  record: Record<string, string>,
  index: number
): NormalizedImportedTrade | null {
  const symbol = pickValue(record, ["Symbol", "Instrument", "Contract"]);
  const openTime = pickDate(
    record,
    ["Open Time", "Entry Time", "Open Date/Time"],
    [["Open Date", "Open Time"]]
  );
  const closeTime = pickDate(
    record,
    ["Close Time", "Exit Time", "Close Date/Time"],
    [["Close Date", "Close Time"]]
  );
  const openPrice = pickNumber(record, ["Open Price", "Entry Price"]);
  const closePrice = pickNumber(record, ["Close Price", "Exit Price"]);
  const profit = pickNumber(record, ["Profit", "Net Profit", "P/L", "PnL"]);
  const tradeType =
    parseTradeDirection(
      pickValue(record, ["Side", "Direction", "Action", "Buy/Sell"])
    ) ?? inferTradeDirectionFromMove({ openPrice, closePrice, profit });

  if (!symbol || !tradeType || !openTime || !closeTime) {
    return null;
  }

  return {
    ticket:
      pickValue(record, ["Position ID", "Position Id", "Order ID", "Order Id"]) ??
      `dxtrade-${index + 1}`,
    symbol,
    tradeType,
    volume: pickNumber(record, ["Volume", "Quantity", "Qty", "Size"]),
    openPrice,
    closePrice,
    openTime,
    closeTime,
    profit,
    sl: pickNumber(record, ["SL", "Stop Loss"]),
    tp: pickNumber(record, ["TP", "Take Profit"]),
    swap: pickNumber(record, ["Swap", "Financing"]),
    commissions: coalesceNumbers(
      pickNumber(record, ["Commission", "Commissions"]),
      pickNumber(record, ["Fee", "Fees"])
    ),
    pips: null,
    tradeDurationSeconds: deriveTradeDurationSeconds(openTime, closeTime),
    comment: pickValue(record, ["Comment", "Notes"]),
    brokerMeta: {
      importProvider: "dxtrade",
      accountNumber: pickValue(record, ["Account", "Account Number"]),
    },
  };
}

export const dxtradeStatementCsvParser: BrokerCsvParser = {
  id: "dxtrade-statement",
  label: "DXTrade Statement",
  brokers: ["dxtrade"],
  detect(context: BrokerCsvImportContext) {
    if (context.broker !== "dxtrade") {
      return 0;
    }

    const normalizedHeaders = context.document.headers.map((header) =>
      header.toLowerCase()
    );
    const hasSymbol = normalizedHeaders.some(
      (header) => header.includes("symbol") || header.includes("instrument")
    );
    const hasLifecycle = normalizedHeaders.some(
      (header) =>
        header.includes("open time") ||
        header.includes("entry time") ||
        header.includes("close time") ||
        header.includes("exit time")
    );
    const hasProfit = normalizedHeaders.some(
      (header) =>
        header.includes("profit") ||
        header.includes("p/l") ||
        header.includes("pnl")
    );
    const hasSide = normalizedHeaders.some(
      (header) =>
        header.includes("side") ||
        header.includes("direction") ||
        header.includes("buy/sell")
    );

    return hasSymbol && hasLifecycle && hasProfit && hasSide ? 95 : 0;
  },
  parse(context: BrokerCsvImportContext) {
    const trades = context.document.records
      .map(mapDxTradeStatementTrade)
      .filter((trade): trade is NormalizedImportedTrade => Boolean(trade));

    return {
      parserId: "dxtrade-statement",
      parserLabel: "DXTrade Statement",
      reportType: "trade-statement",
      trades,
      warnings: [],
      accountHints: {
        brokerType: "dxtrade",
        accountNumber:
          context.document.records
            .map((record) => pickValue(record, ["Account", "Account Number"]))
            .find((value): value is string => Boolean(value && value.trim())) ?? null,
        currency:
          context.document.records
            .map((record) => pickValue(record, ["Currency"]))
            .find((value): value is string => Boolean(value && value.trim())) ?? null,
      },
    };
  },
};
