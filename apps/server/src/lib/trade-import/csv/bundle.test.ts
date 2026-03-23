import { describe, expect, it } from "bun:test";
import * as XLSX from "xlsx";

import { parseBrokerCsvImportBundle } from "./bundle";

describe("parseBrokerCsvImportBundle", () => {
  it("parses quoted date fields through the shared CSV parser stack", () => {
    const csv = `Symbol,Open Time,Close Time,Type,Volume,Open Price,Close Price,Profit
ES,"Mar 15, 2026 10:00 AM","Mar 15, 2026 10:05 AM",Buy,1,5000,5004,200`;

    const result = parseBrokerCsvImportBundle({
      broker: "generic",
      files: [{ fileName: "statement.csv", fileContent: csv }],
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

  it("parses FTMO-style trading journal statements through the generic parser", () => {
    const csv = `Ticket,Open,Type,Volume,Symbol,Price,SL,TP,Close,Price,Swap,Commissions,Profit,Pips,"Trade duration in seconds"
50275593,"2025-02-25 10:39:29",buy,2.5,GBPUSD,1.26189000,1.26194,1.26507000,"2025-02-25 12:02:38",1.26194000,0,-7.5,12.50000000,0,4989
48800661,"2025-02-13 12:16:03",sell,2.4,EURJPY,160.56000000,160.254,158.89800000,"2025-02-14 17:56:17",159.92800000,-30.95,-7.2,997.04000000,0,106814`;

    const result = parseBrokerCsvImportBundle({
      broker: "ftmo",
      files: [{ fileName: "trading-journal.csv", fileContent: csv }],
    });

    expect(result.parserId).toBe("generic-trade-statement");
    expect(result.trades).toHaveLength(2);
    expect(result.trades[0]).toMatchObject({
      ticket: "50275593",
      symbol: "GBPUSD",
      tradeType: "long",
      volume: 2.5,
      openPrice: 1.26189,
      closePrice: 1.26194,
      commissions: -7.5,
      profit: 12.5,
      tradeDurationSeconds: "4989",
    });
    expect(result.trades[1]).toMatchObject({
      ticket: "48800661",
      symbol: "EURJPY",
      tradeType: "short",
      swap: -30.95,
      tradeDurationSeconds: "106814",
    });
  });

  it("accepts Tradovate supplemental files without treating them as trade rows", () => {
    const performanceCsv = `Symbol,Buy Fill Id,Sell Fill Id,Qty,Buy Price,Sell Price,PnL,Bought Timestamp,Sold Timestamp
NQ,1001,1002,1,20000,20010,100,03/15/2026 10:00 AM,03/15/2026 10:05 AM`;
    const ordersCsv = `Order ID,Status
abc123,Filled`;

    const result = parseBrokerCsvImportBundle({
      broker: "tradovate",
      files: [
        { fileName: "Performance.csv", fileContent: performanceCsv },
        { fileName: "Orders.csv", fileContent: ordersCsv },
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
        { fileName: "Performance.csv", fileContent: performanceCsv },
        { fileName: "Order Details.csv", fileContent: "undefined" },
        {
          fileName: "Account Balance History.csv",
          fileContent: accountBalanceHistoryCsv,
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

  it("parses nested XML trade rows with contextual field names", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Trades>
  <Trade Ticket="1001">
    <Symbol>ES</Symbol>
    <Type>Buy</Type>
    <Volume>1</Volume>
    <Open>
      <Time>2026-03-15T10:00:00Z</Time>
      <Price>5000</Price>
    </Open>
    <Close>
      <Time>2026-03-15T10:05:00Z</Time>
      <Price>5004</Price>
    </Close>
    <Profit>200</Profit>
  </Trade>
</Trades>`;

    const result = parseBrokerCsvImportBundle({
      broker: "generic",
      files: [{ fileName: "statement.xml", fileContent: xml }],
    });

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]).toMatchObject({
      ticket: "1001",
      symbol: "ES",
      tradeType: "long",
      volume: 1,
      openPrice: 5000,
      closePrice: 5004,
      profit: 200,
    });
    expect(result.trades[0]?.openTime?.toISOString()).toBe(
      "2026-03-15T10:00:00.000Z"
    );
    expect(result.files).toEqual(["statement.xml"]);
  });

  it("parses statement-style XML tables even when the first row is a section label", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Report>
  <table>
    <tr><td>Closed Transactions</td></tr>
    <tr>
      <td>Ticket</td>
      <td>Symbol</td>
      <td>Open Time</td>
      <td>Close Time</td>
      <td>Type</td>
      <td>Volume</td>
      <td>Open Price</td>
      <td>Close Price</td>
      <td>Profit</td>
    </tr>
    <tr>
      <td>1002</td>
      <td>NQ</td>
      <td>2026.03.15 10:00:00</td>
      <td>2026.03.15 10:05:00</td>
      <td>Sell</td>
      <td>2</td>
      <td>6000</td>
      <td>5990</td>
      <td>400</td>
    </tr>
  </table>
</Report>`;

    const result = parseBrokerCsvImportBundle({
      broker: "generic",
      files: [{ fileName: "statement.xml", fileContent: xml }],
    });

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]).toMatchObject({
      ticket: "1002",
      symbol: "NQ",
      tradeType: "short",
      volume: 2,
      openPrice: 6000,
      closePrice: 5990,
      profit: 400,
    });
  });

  it("parses XLSX MT5 history exports and prefers the Positions section over Deals", () => {
    const workbook = XLSX.utils.book_new();
    const mt5Sheet = XLSX.utils.aoa_to_sheet([
      ["Trade History Report"],
      ["Account:", "", "", "1512745186 (USD, FTMO-Demo, demo, Hedge)"],
      ["Positions"],
      [
        "Time",
        "Position",
        "Symbol",
        "Type",
        "Volume",
        "Price",
        "S / L",
        "T / P",
        "Time",
        "Price",
        "Commission",
        "Swap",
        "Profit",
      ],
      [
        "2026.03.15 10:00:00",
        "1004",
        "EURUSD",
        "buy",
        "1.5",
        "1.1000",
        "",
        "",
        "2026.03.15 10:05:00",
        "1.1010",
        "-4.50",
        "0",
        "150",
      ],
      [],
      ["Deals"],
      [
        "Time",
        "Deal",
        "Symbol",
        "Type",
        "Direction",
        "Volume",
        "Price",
        "Order",
        "Commission",
        "Fee",
        "Swap",
        "Profit",
        "Balance",
        "Comment",
      ],
      [
        "2026.03.15 09:00:00",
        "9999",
        "",
        "balance",
        "",
        "",
        "",
        "",
        "0",
        "0",
        "0",
        "200000",
        "200000",
        "Initial account balance",
      ],
    ]);

    XLSX.utils.book_append_sheet(workbook, mt5Sheet, "MT5 Report");

    const fileContent = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer;

    const result = parseBrokerCsvImportBundle({
      broker: "generic",
      files: [{ fileName: "statement.xlsx", fileContent }],
    });

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]).toMatchObject({
      ticket: "1004",
      symbol: "EURUSD",
      tradeType: "long",
      volume: 1.5,
      openPrice: 1.1,
      closePrice: 1.101,
      profit: 150,
      commissions: -4.5,
    });
    expect(result.trades[0]?.openTime?.toISOString()).toBe(
      "2026-03-15T10:00:00.000Z"
    );
    expect(result.files).toEqual(["statement.xlsx"]);
  });
});
