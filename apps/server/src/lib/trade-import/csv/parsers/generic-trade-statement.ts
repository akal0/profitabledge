import type {
  BrokerCsvImportContext,
  BrokerCsvParser,
  NormalizedImportedTrade,
} from "../types";
import {
  inferTradeDirectionFromMove,
  parseTradeDirection,
  pickDate,
  pickNumber,
  pickValue,
} from "../utils";

function mapGenericTrade(
  record: Record<string, string>,
  index: number
): NormalizedImportedTrade | null {
  const symbol = pickValue(record, ["Symbol", "Instrument", "Market"]);
  const openTime = pickDate(record, [
    "Open",
    "Open time",
    "Open Time",
    "Open date",
    "Open Date",
    "OpenTime",
    "Entry Time",
  ]);
  const closeTime = pickDate(record, [
    "Close",
    "Close time",
    "Close Time",
    "Close date",
    "Close Date",
    "CloseTime",
    "Exit Time",
  ]);
  const openPrice = pickNumber(record, ["Open Price", "Price", "Entry Price"]);
  const closePrice = pickNumber(record, [
    "Close Price",
    "Price 1",
    "Price (1)",
    "Price_Close",
    "Exit Price",
  ]);
  const profit = pickNumber(record, ["Profit", "Net Profit", "P/L", "PnL"]);
  const tradeType =
    parseTradeDirection(pickValue(record, ["Type", "Side", "Direction"])) ??
    inferTradeDirectionFromMove({ openPrice, closePrice, profit });

  if (!symbol || !tradeType) {
    return null;
  }

  return {
    ticket:
      pickValue(record, ["Ticket", "Trade ID", "Trade Id", "Order ID", "Order Id"]) ??
      `generic-${index + 1}`,
    symbol,
    tradeType,
    volume: pickNumber(record, ["Volume", "Qty", "Quantity", "Lots"]),
    openPrice,
    closePrice,
    openTime,
    closeTime,
    profit,
    sl: pickNumber(record, ["SL", "Stop Loss"]),
    tp: pickNumber(record, ["TP", "Take Profit"]),
    swap: pickNumber(record, ["Swap"]),
    commissions: pickNumber(record, ["Commissions", "Commission"]),
    pips: pickNumber(record, ["Pips"]),
    comment: pickValue(record, ["Comment", "Notes"]),
    brokerMeta: null,
  };
}

export const genericTradeStatementCsvParser: BrokerCsvParser = {
  id: "generic-trade-statement",
  label: "Generic Trade Statement",
  brokers: "*",
  detect(context) {
    const headerKeys = context.document.headers.map((header) => header.toLowerCase());
    const hasSymbol = headerKeys.some((header) => header.includes("symbol"));
    const hasOpen =
      headerKeys.some((header) => header.includes("open")) ||
      headerKeys.some((header) => header.includes("entry"));
    const hasClose =
      headerKeys.some((header) => header.includes("close")) ||
      headerKeys.some((header) => header.includes("exit"));
    const hasProfit =
      headerKeys.some((header) => header.includes("profit")) ||
      headerKeys.some((header) => header.includes("p/l")) ||
      headerKeys.some((header) => header.includes("pnl"));

    return hasSymbol && hasOpen && hasClose && hasProfit ? 60 : 0;
  },
  parse(context) {
    const trades = context.document.records
      .map(mapGenericTrade)
      .filter((trade): trade is NormalizedImportedTrade => Boolean(trade));

    return {
      parserId: "generic-trade-statement",
      parserLabel: "Generic Trade Statement",
      reportType: "trade-statement",
      trades,
      warnings: [],
      accountHints: {
        brokerType: "other",
      },
    };
  },
};
