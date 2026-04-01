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

function mapRithmicTrade(
  record: Record<string, string>,
  index: number
): NormalizedImportedTrade | null {
  const symbol = pickValue(record, [
    "Symbol",
    "Contract",
    "Instrument",
    "Product",
  ]);
  const openTime = pickDate(
    record,
    ["Open Time", "Entry Time", "Open Date/Time", "Entry Date/Time"],
    [
      ["Open Date", "Open Time"],
      ["Entry Date", "Entry Time"],
    ]
  );
  const closeTime = pickDate(
    record,
    ["Close Time", "Exit Time", "Close Date/Time", "Exit Date/Time"],
    [
      ["Close Date", "Close Time"],
      ["Exit Date", "Exit Time"],
    ]
  );
  const openPrice = pickNumber(record, [
    "Open Price",
    "Entry Price",
    "Buy Price",
  ]);
  const closePrice = pickNumber(record, [
    "Close Price",
    "Exit Price",
    "Sell Price",
  ]);
  const profit = pickNumber(record, ["P/L", "PnL", "Profit", "Net P/L"]);
  const tradeType =
    parseTradeDirection(
      pickValue(record, ["Side", "Direction", "B/S", "Buy/Sell", "Action"])
    ) ?? inferTradeDirectionFromMove({ openPrice, closePrice, profit });

  if (!symbol || !tradeType || !openTime || !closeTime) {
    return null;
  }

  return {
    ticket:
      pickValue(record, ["Trade ID", "Trade Id", "Order ID", "Order Id"]) ??
      `rithmic-${index + 1}`,
    symbol,
    tradeType,
    volume: pickNumber(record, ["Qty", "Quantity", "Contracts", "Lots"]),
    openPrice,
    closePrice,
    openTime,
    closeTime,
    profit,
    sl: pickNumber(record, ["SL", "Stop Loss"]),
    tp: pickNumber(record, ["TP", "Take Profit"]),
    swap: null,
    commissions: coalesceNumbers(
      pickNumber(record, ["Commission", "Commissions"]),
      pickNumber(record, ["Fees", "Fee"])
    ),
    pips: null,
    tradeDurationSeconds: deriveTradeDurationSeconds(openTime, closeTime),
    comment: pickValue(record, ["Comment", "Notes"]),
    brokerMeta: {
      importProvider: "rithmic",
      accountNumber: pickValue(record, ["Account", "Account Number"]),
    },
  };
}

function coalesceNumbers(...values: Array<number | null>): number | null {
  for (const value of values) {
    if (value != null) {
      return value;
    }
  }
  return null;
}

export const rithmicRTraderProCsvParser: BrokerCsvParser = {
  id: "rithmic-rtrader-pro",
  label: "Rithmic R|Trader Pro",
  brokers: ["rithmic"],
  detect(context: BrokerCsvImportContext) {
    if (context.broker !== "rithmic") {
      return 0;
    }

    const normalizedHeaders = context.document.headers.map((header) =>
      header.toLowerCase()
    );
    const hasSymbol = normalizedHeaders.some(
      (header) =>
        header.includes("symbol") ||
        header.includes("contract") ||
        header.includes("instrument")
    );
    const hasRithmicDirection = normalizedHeaders.some(
      (header) =>
        header.includes("b/s") ||
        header.includes("buy/sell") ||
        header.includes("direction")
    );
    const hasLifecycle = normalizedHeaders.some(
      (header) =>
        header.includes("entry") ||
        header.includes("open") ||
        header.includes("exit") ||
        header.includes("close")
    );
    const hasProfit = normalizedHeaders.some(
      (header) =>
        header.includes("p/l") ||
        header.includes("pnl") ||
        header.includes("profit")
    );

    return hasSymbol && hasRithmicDirection && hasLifecycle && hasProfit ? 95 : 0;
  },
  parse(context: BrokerCsvImportContext) {
    const trades = context.document.records
      .map(mapRithmicTrade)
      .filter((trade): trade is NormalizedImportedTrade => Boolean(trade));

    return {
      parserId: "rithmic-rtrader-pro",
      parserLabel: "Rithmic R|Trader Pro",
      reportType: "trade-statement",
      trades,
      warnings: [],
      accountHints: {
        brokerType: "rithmic",
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
