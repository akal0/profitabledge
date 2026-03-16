import { describe, expect, it } from "bun:test";

import { parseBrokerCsvImportBundle } from "./bundle";

describe("parseBrokerCsvImportBundle", () => {
  it("parses quoted date fields through the shared CSV parser stack", () => {
    const csv = `Symbol,Open Time,Close Time,Type,Volume,Open Price,Close Price,Profit
ES,"Mar 15, 2026 10:00 AM","Mar 15, 2026 10:05 AM",Buy,1,5000,5004,200`;

    const result = parseBrokerCsvImportBundle({
      broker: "generic",
      files: [{ fileName: "statement.csv", csvText: csv }],
    });

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]).toMatchObject({
      symbol: "ES",
      tradeType: "long",
      volume: 1,
      profit: 200,
    });
    expect(result.trades[0]?.openTime?.getFullYear()).toBe(2026);
    expect(result.trades[0]?.openTime?.getMonth()).toBe(2);
    expect(result.trades[0]?.openTime?.getDate()).toBe(15);
    expect(result.files).toEqual(["statement.csv"]);
  });

  it("accepts Tradovate supplemental files without treating them as trade rows", () => {
    const performanceCsv = `Symbol,Buy Fill Id,Sell Fill Id,Qty,Buy Price,Sell Price,PnL,Bought Timestamp,Sold Timestamp
NQ,1001,1002,1,20000,20010,100,03/15/2026 10:00 AM,03/15/2026 10:05 AM`;
    const ordersCsv = `Order ID,Status
abc123,Filled`;

    const result = parseBrokerCsvImportBundle({
      broker: "tradovate",
      files: [
        { fileName: "Performance.csv", csvText: performanceCsv },
        { fileName: "Orders.csv", csvText: ordersCsv },
      ],
    });

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]).toMatchObject({
      symbol: "NQ",
      tradeType: "long",
      volume: 1,
      profit: 100,
    });
    expect(result.files).toEqual(["Performance.csv", "Orders.csv"]);
  });

  it("accepts placeholder Order Details exports and captures account balance history totals", () => {
    const performanceCsv = `Symbol,Buy Fill Id,Sell Fill Id,Qty,Buy Price,Sell Price,PnL,Bought Timestamp,Sold Timestamp
NQ,1001,1002,1,20000,20010,100,03/15/2026 10:00 AM,03/15/2026 10:05 AM`;
    const accountBalanceHistoryCsv = `Account ID,Account Name,Trade Date,Total Amount,Total Realized PNL
43919354,DEMO7032316,2026-03-15,"50,685.12",685.12`;

    const result = parseBrokerCsvImportBundle({
      broker: "tradovate",
      files: [
        { fileName: "Performance.csv", csvText: performanceCsv },
        { fileName: "Order Details.csv", csvText: "undefined" },
        {
          fileName: "Account Balance History.csv",
          csvText: accountBalanceHistoryCsv,
        },
      ],
    });

    expect(result.trades).toHaveLength(1);
    expect(result.accountHints.liveBalance).toBe(50685.12);
    expect(result.files).toEqual([
      "Performance.csv",
      "Order Details.csv",
      "Account Balance History.csv",
    ]);
  });
});
