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
  const symbol = pickValue(record, [
    "Symbol",
    "Instrument",
    "Market",
    "Contract",
    "Product",
  ]);
  const openTime = pickDate(record, [
    "Open",
    "Open time",
    "Open Time",
    "Open date",
    "Open Date",
    "OpenTime",
    "Entry Time",
    "Entry Date/Time",
    "Opened",
    "Time",
  ], [
    ["Open Date", "Open Time"],
    ["Entry Date", "Entry Time"],
    ["Date Opened", "Time Opened"],
  ]);
  const closeTime = pickDate(record, [
    "Close",
    "Close time",
    "Close Time",
    "Close date",
    "Close Date",
    "CloseTime",
    "Exit Time",
    "Exit Date/Time",
    "Closed",
    "Time 2",
  ], [
    ["Close Date", "Close Time"],
    ["Exit Date", "Exit Time"],
    ["Date Closed", "Time Closed"],
  ]);
  const openPrice = pickNumber(record, [
    "Open Price",
    "Price",
    "Entry Price",
  ]);
  const closePrice = pickNumber(record, [
    "Close Price",
    "Price 1",
    "Price 2",
    "Price (1)",
    "Price_Close",
    "Exit Price",
  ]);
  const profit = pickNumber(record, [
    "Profit",
    "Net Profit",
    "P/L",
    "PnL",
    "Profit/Loss",
    "Net P/L",
  ]);
  const tradeType =
    parseTradeDirection(
      pickValue(record, ["Type", "Side", "Direction", "Action", "Buy/Sell"])
    ) ??
    inferTradeDirectionFromMove({ openPrice, closePrice, profit });

  if (!symbol || !tradeType) {
    return null;
  }

  return {
    ticket:
      pickValue(record, [
        "Ticket",
        "Trade ID",
        "Trade Id",
        "Order ID",
        "Order Id",
        "Position ID",
        "Position Id",
        "Position",
      ]) ??
      `generic-${index + 1}`,
    symbol,
    tradeType,
    volume: pickNumber(record, [
      "Volume",
      "Qty",
      "Quantity",
      "Lots",
      "Lot Size",
    ]),
    openPrice,
    closePrice,
    openTime,
    closeTime,
    profit,
    sl: pickNumber(record, ["SL", "Stop Loss", "S / L"]),
    tp: pickNumber(record, ["TP", "Take Profit", "T / P"]),
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
    const hasSymbol = headerKeys.some(
      (header) =>
        header.includes("symbol") ||
        header.includes("instrument") ||
        header.includes("contract") ||
        header.includes("market")
    );
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
    const isMt5ClosedPositionsShape =
      headerKeys.includes("position") &&
      headerKeys.includes("time") &&
      headerKeys.includes("time 2") &&
      headerKeys.includes("price") &&
      headerKeys.includes("price 2") &&
      hasSymbol &&
      hasProfit;

    if (isMt5ClosedPositionsShape) {
      return 85;
    }

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
