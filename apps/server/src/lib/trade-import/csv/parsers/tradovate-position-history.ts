import type {
  BrokerCsvImportContext,
  BrokerCsvParser,
  NormalizedImportedTrade,
} from "../types";
import {
  coalesce,
  inferTradeDirectionFromMove,
  parseTradeDirection,
  pickDate,
  pickNumber,
  pickValue,
} from "../utils";
import {
  buildTradovatePairedTrade,
  groupTradovatePairedTrades,
  type TradovatePairedTrade,
} from "./tradovate-paired";

function inferTradovateTradeDirection(
  record: Record<string, string>,
  input: {
    openPrice: number | null;
    closePrice: number | null;
    profit: number | null;
  }
): "long" | "short" | null {
  const direct =
    parseTradeDirection(
      pickValue(record, [
        "Direction",
        "Side",
        "Action",
        "Buy/Sell",
        "Trade Type",
      ])
    ) ?? inferTradeDirectionFromMove(input);

  if (direct) return direct;

  const buyQty = pickNumber(record, [
    "Buy Qty",
    "Bought Qty",
    "Bought",
    "Entry Buy Qty",
  ]);
  const sellQty = pickNumber(record, [
    "Sell Qty",
    "Sold Qty",
    "Sold",
    "Entry Sell Qty",
  ]);

  if ((buyQty ?? 0) > 0 && (sellQty ?? 0) === 0) {
    return "long";
  }

  if ((sellQty ?? 0) > 0 && (buyQty ?? 0) === 0) {
    return "short";
  }

  return null;
}

function mapTradovatePositionHistoryTrade(
  record: Record<string, string>,
  index: number
): NormalizedImportedTrade | null {
  const symbol = pickValue(record, [
    "Contract",
    "Symbol",
    "Product",
    "Instrument",
    "Market",
  ]);

  const openTime = pickDate(
    record,
    ["Open Time", "Entry Time", "Opened", "Entry Date/Time", "Start Time"],
    [
      ["Open Date", "Open Time"],
      ["Entry Date", "Entry Time"],
      ["Start Date", "Start Time"],
      ["Date Opened", "Time Opened"],
    ]
  );
  const closeTime = pickDate(
    record,
    ["Close Time", "Exit Time", "Closed", "Exit Date/Time", "End Time"],
    [
      ["Close Date", "Close Time"],
      ["Exit Date", "Exit Time"],
      ["End Date", "End Time"],
      ["Date Closed", "Time Closed"],
    ]
  );
  const openPrice = pickNumber(record, [
    "Open Price",
    "Entry Price",
    "Avg Open Price",
    "Avg Entry Price",
    "Average Open Price",
    "Average Entry Price",
    "Buy Price",
  ]);
  const closePrice = pickNumber(record, [
    "Close Price",
    "Exit Price",
    "Avg Close Price",
    "Avg Exit Price",
    "Average Close Price",
    "Average Exit Price",
    "Sell Price",
  ]);
  const profit = pickNumber(record, [
    "Net P/L",
    "Net PnL",
    "Realized PnL",
    "Realized P/L",
    "Profit",
    "P/L",
    "PnL",
  ]);
  const tradeType = inferTradovateTradeDirection(record, {
    openPrice,
    closePrice,
    profit,
  });

  if (!symbol || !tradeType) {
    return null;
  }

  const volume = coalesce(
    pickNumber(record, [
      "Qty",
      "Quantity",
      "Position Qty",
      "Trade Qty",
      "Net Qty",
      "Filled Qty",
    ]),
    pickNumber(record, ["Buy Qty", "Bought Qty", "Bought"]),
    pickNumber(record, ["Sell Qty", "Sold Qty", "Sold"])
  );

  return {
    ticket:
      pickValue(record, [
        "Position ID",
        "Position Id",
        "Position",
        "Trade ID",
        "Trade Id",
      ]) ?? `tradovate-position-${index + 1}`,
    symbol,
    tradeType,
    volume,
    openPrice,
    closePrice,
    openTime,
    closeTime,
    profit,
    sl: pickNumber(record, ["Stop Loss", "SL"]),
    tp: pickNumber(record, ["Take Profit", "TP"]),
    swap: pickNumber(record, ["Swap"]),
    commissions: coalesce(
      pickNumber(record, ["Commission", "Commissions"]),
      pickNumber(record, ["Fees", "Exchange Fees", "Total Fees"])
    ),
    pips: null,
    comment: pickValue(record, ["Comment", "Strategy", "Notes"]),
    brokerMeta: {
      importReportType: "position-history",
      positionId:
        pickValue(record, ["Position ID", "Position Id", "Position"]) ?? null,
      accountNumber:
        pickValue(record, ["Account", "Account Number", "Account Num"]) ?? null,
      rawDirection:
        pickValue(record, ["Direction", "Side", "Action", "Buy/Sell"]) ?? null,
    },
  };
}

function parseTradovatePositionHistoryPair(
  record: Record<string, string>
): TradovatePairedTrade | null {
  const symbol = pickValue(record, ["Contract", "Symbol", "Product"]);
  const qty = pickNumber(record, ["Paired Qty", "Pair Qty", "Quantity"]);
  const buyPrice = pickNumber(record, ["Buy Price"]);
  const sellPrice = pickNumber(record, ["Sell Price"]);
  const pnl = pickNumber(record, ["P/L", "PnL", "Profit"]);
  const boughtTimestamp = pickDate(record, ["Bought Timestamp"]);
  const soldTimestamp = pickDate(record, ["Sold Timestamp"]);

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
    buyFillId: pickValue(record, ["Buy Fill ID", "Buy Fill Id"]) ?? "",
    sellFillId: pickValue(record, ["Sell Fill ID", "Sell Fill Id"]) ?? "",
    buyPrice,
    sellPrice,
    pnl,
    boughtTimestamp,
    soldTimestamp,
    tickSize: pickNumber(record, ["_tickSize", "Tick Size"]),
    priceFormat: pickValue(record, ["_priceFormat", "Price Format"]) ?? null,
    currency: pickValue(record, ["Currency"]),
    accountNumber:
      pickValue(record, ["Account", "Account Number", "Account Num"]) ?? null,
    positionId:
      pickValue(record, ["Position ID", "Position Id", "Position"]) ?? null,
    pairId: pickValue(record, ["Pair ID", "Pair Id"]) ?? null,
    reportMeta: {
      product: pickValue(record, ["Product"]) ?? null,
      productDescription:
        pickValue(record, ["Product Description"]) ?? null,
    },
  });
}

export const tradovatePositionHistoryCsvParser: BrokerCsvParser = {
  id: "tradovate-position-history",
  label: "Tradovate Position History",
  brokers: ["tradovate"],
  detect(context) {
    if (context.broker !== "tradovate") {
      return 0;
    }

    const headerKeys = context.document.headers.map((header) =>
      header.toLowerCase()
    );
    const normalizedHeaders = headerKeys.map((header) =>
      header.replace(/[^a-z]/g, "")
    );
    const requiredPairHeaders = [
      "positionid",
      "pairid",
      "buyfillid",
      "sellfillid",
      "pairedqty",
      "buyprice",
      "sellprice",
      "pl",
      "boughttimestamp",
      "soldtimestamp",
    ];

    const hasPairedShape = requiredPairHeaders.every((needle) =>
      normalizedHeaders.includes(needle)
    );
    if (hasPairedShape) {
      return 100;
    }

    const hasSymbol = headerKeys.some(
      (header) =>
        header.includes("contract") ||
        header.includes("symbol") ||
        header.includes("product")
    );
    const hasPnl = headerKeys.some(
      (header) =>
        header.includes("p/l") ||
        header.includes("pnl") ||
        header.includes("profit")
    );
    const hasLifecycle = headerKeys.some(
      (header) =>
        header.includes("open") ||
        header.includes("entry") ||
        header.includes("close") ||
        header.includes("exit")
    );

    return hasSymbol && hasPnl && hasLifecycle ? 95 : 0;
  },
  parse(context) {
    const pairedTrades = context.document.records
      .map(parseTradovatePositionHistoryPair)
      .filter((trade): trade is TradovatePairedTrade => Boolean(trade));

    const trades =
      pairedTrades.length > 0
        ? groupTradovatePairedTrades({
            trades: pairedTrades,
            reportType: "position-history",
          })
        : context.document.records
            .map(mapTradovatePositionHistoryTrade)
            .filter((trade): trade is NormalizedImportedTrade => Boolean(trade));

    const accountNumber =
      context.document.records
        .map((record) =>
          pickValue(record, ["Account", "Account Number", "Account Num"])
        )
        .find((value): value is string => Boolean(value && value.trim())) ??
      null;
    const currency =
      context.document.records
        .map((record) => pickValue(record, ["Currency"]))
        .find((value): value is string => Boolean(value && value.trim())) ??
      null;

    return {
      parserId: "tradovate-position-history",
      parserLabel: "Tradovate Position History",
      reportType: "position-history",
      trades,
      warnings: [],
      accountHints: {
        currency,
        accountNumber,
        brokerType: "other",
        brokerMeta: {
          importProvider: "tradovate",
          reportType: "position-history",
        },
      },
    };
  },
};
