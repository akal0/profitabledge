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

function mapNinjaTraderTrade(
  record: Record<string, string>,
  index: number
): NormalizedImportedTrade | null {
  const symbol = pickValue(record, ["Instrument", "Symbol", "Contract"]);
  const openTime = pickDate(
    record,
    ["Entry Time", "Open Time", "Entry Date/Time"],
    [["Entry Date", "Entry Time"]]
  );
  const closeTime = pickDate(
    record,
    ["Exit Time", "Close Time", "Exit Date/Time"],
    [["Exit Date", "Exit Time"]]
  );
  const openPrice = pickNumber(record, ["Entry Price", "Open Price"]);
  const closePrice = pickNumber(record, ["Exit Price", "Close Price"]);
  const profit = pickNumber(record, ["Profit", "Profit Currency", "Net Profit"]);
  const tradeType =
    parseTradeDirection(
      pickValue(record, ["Market pos.", "Position", "Direction", "Side"])
    ) ?? inferTradeDirectionFromMove({ openPrice, closePrice, profit });

  if (!symbol || !tradeType || !openTime || !closeTime) {
    return null;
  }

  return {
    ticket:
      pickValue(record, ["Trade #", "Trade ID", "Order ID", "Order Id"]) ??
      `ninjatrader-${index + 1}`,
    symbol,
    tradeType,
    volume: pickNumber(record, ["Qty", "Quantity", "Contracts"]),
    openPrice,
    closePrice,
    openTime,
    closeTime,
    profit,
    sl: null,
    tp: null,
    swap: null,
    commissions: coalesceNumbers(
      pickNumber(record, ["Commission", "Commissions"]),
      pickNumber(record, ["Fees", "Fee"])
    ),
    pips: null,
    tradeDurationSeconds: deriveTradeDurationSeconds(openTime, closeTime),
    comment: pickValue(record, ["Signal name", "Comment", "Notes"]),
    brokerMeta: {
      importProvider: "ninjatrader",
      accountNumber: pickValue(record, ["Account", "Account Name"]),
    },
  };
}

export const ninjatraderPerformanceReportCsvParser: BrokerCsvParser = {
  id: "ninjatrader-performance-report",
  label: "NinjaTrader Performance Report",
  brokers: ["ninjatrader"],
  detect(context: BrokerCsvImportContext) {
    if (context.broker !== "ninjatrader") {
      return 0;
    }

    const normalizedHeaders = context.document.headers.map((header) =>
      header.toLowerCase()
    );
    const requiredHints = [
      normalizedHeaders.some((header) => header.includes("instrument")),
      normalizedHeaders.some((header) => header.includes("market pos")),
      normalizedHeaders.some((header) => header.includes("entry time")),
      normalizedHeaders.some((header) => header.includes("exit time")),
      normalizedHeaders.some((header) => header.includes("profit")),
    ];

    return requiredHints.every(Boolean) ? 100 : 0;
  },
  parse(context: BrokerCsvImportContext) {
    const trades = context.document.records
      .map(mapNinjaTraderTrade)
      .filter((trade): trade is NormalizedImportedTrade => Boolean(trade));

    return {
      parserId: "ninjatrader-performance-report",
      parserLabel: "NinjaTrader Performance Report",
      reportType: "performance-report",
      trades,
      warnings: [],
      accountHints: {
        brokerType: "ninjatrader",
        accountNumber:
          context.document.records
            .map((record) => pickValue(record, ["Account", "Account Name"]))
            .find((value): value is string => Boolean(value && value.trim())) ?? null,
        currency:
          context.document.records
            .map((record) => pickValue(record, ["Currency"]))
            .find((value): value is string => Boolean(value && value.trim())) ?? null,
      },
    };
  },
};
