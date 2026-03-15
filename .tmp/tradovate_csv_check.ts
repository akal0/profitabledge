
import { readFileSync } from "node:fs";
import { parseBrokerCsvImport } from "./apps/server/src/lib/trade-import/csv/registry";
const files = [
  "/Users/abdul/Downloads/Performance (1).csv",
  "/Users/abdul/Downloads/Position History.csv",
  "/Users/abdul/Downloads/Fills.csv",
  "/Users/abdul/Downloads/Orders.csv",
  "/Users/abdul/Downloads/Cash History.csv",
  "/Users/abdul/Downloads/Account Balance History.csv",
  "/Users/abdul/Downloads/Order Details.csv",
];
for (const file of files) {
  try {
    const csv = readFileSync(file, "utf8");
    const parsed = parseBrokerCsvImport({
      broker: "tradovate",
      csvText: csv,
      fileName: file.split("/").pop() ?? null,
    });
    console.log(JSON.stringify({
      file,
      parserId: parsed.parserId,
      reportType: parsed.reportType,
      tradeCount: parsed.trades.length,
    }));
  } catch (error) {
    console.log(JSON.stringify({
      file,
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}
