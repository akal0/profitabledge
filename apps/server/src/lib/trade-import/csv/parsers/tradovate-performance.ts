import type {
  BrokerCsvImportContext,
  BrokerCsvParser,
} from "../types";
import { parseDateTime, pickNumber, pickValue } from "../utils";
import {
  buildTradovatePairedTrade,
  groupTradovatePairedTrades,
  type TradovatePairedTrade,
} from "./tradovate-paired";

function parsePerformanceRow(
  record: Record<string, string>
): TradovatePairedTrade | null {
  const symbol = pickValue(record, ["symbol", "Symbol", "contract", "Contract"]);
  const qty = pickNumber(record, ["qty", "Qty", "quantity", "Quantity"]);
  const buyPrice = pickNumber(record, ["buyPrice", "Buy Price", "buy price"]);
  const sellPrice = pickNumber(record, [
    "sellPrice",
    "Sell Price",
    "sell price",
  ]);
  const pnl = pickNumber(record, ["pnl", "PnL", "P/L", "Profit"]);
  const boughtTimestamp = parseDateTime(
    pickValue(record, ["boughtTimestamp", "Bought Timestamp"])
  );
  const soldTimestamp = parseDateTime(
    pickValue(record, ["soldTimestamp", "Sold Timestamp"])
  );

  if (
    !symbol ||
    qty == null ||
    buyPrice == null ||
    sellPrice == null ||
    pnl == null ||
    !boughtTimestamp ||
    !soldTimestamp
  ) {
    return null;
  }

  return buildTradovatePairedTrade({
    symbol,
    qty,
    buyFillId: pickValue(record, ["buyFillId", "Buy Fill Id"]) ?? "",
    sellFillId: pickValue(record, ["sellFillId", "Sell Fill Id"]) ?? "",
    buyPrice,
    sellPrice,
    pnl,
    boughtTimestamp,
    soldTimestamp,
    tickSize: pickNumber(record, ["_tickSize", "tickSize", "Tick Size"]),
    priceFormat:
      pickValue(record, ["_priceFormat", "priceFormat", "Price Format"]) ?? null,
  });
}

export const tradovatePerformanceCsvParser: BrokerCsvParser = {
  id: "tradovate-performance",
  label: "Tradovate Performance",
  brokers: ["tradovate"],
  detect(context) {
    if (context.broker !== "tradovate") {
      return 0;
    }

    const normalizedHeaders = context.document.headers.map((header) =>
      header.toLowerCase()
    );
    const required = [
      "symbol",
      "buyfillid",
      "sellfillid",
      "qty",
      "buyprice",
      "sellprice",
      "pnl",
      "boughttimestamp",
      "soldtimestamp",
    ];

    const present = required.filter((needle) =>
      normalizedHeaders.some((header) => header.replace(/[^a-z]/g, "") === needle)
    );

    return present.length === required.length ? 100 : 0;
  },
  parse(context) {
    const rawTrades = context.document.records
      .map(parsePerformanceRow)
      .filter((trade): trade is TradovatePairedTrade => Boolean(trade));

    return {
      parserId: "tradovate-performance",
      parserLabel: "Tradovate Performance",
      reportType: "performance",
      trades: groupTradovatePairedTrades({
        trades: rawTrades,
        reportType: "performance",
      }),
      warnings: [],
      accountHints: {
        brokerType: "other",
        brokerMeta: {
          importProvider: "tradovate",
          reportType: "performance",
        },
      },
    };
  },
};
