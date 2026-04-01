import { TRPCError } from "@trpc/server";
import { parseImportDocument } from "./document";
import { dxtradeStatementCsvParser } from "./parsers/dxtrade-statement";
import { genericTradeStatementCsvParser } from "./parsers/generic-trade-statement";
import { ninjatraderPerformanceReportCsvParser } from "./parsers/ninjatrader-performance-report";
import { rithmicRTraderProCsvParser } from "./parsers/rithmic-rtrader-pro";
import { tradovatePerformanceCsvParser } from "./parsers/tradovate-performance";
import { tradovatePositionHistoryCsvParser } from "./parsers/tradovate-position-history";
import type {
  BrokerCsvImportContext,
  BrokerCsvParser,
  ParsedBrokerCsvImport,
} from "./types";

const parsers: BrokerCsvParser[] = [
  dxtradeStatementCsvParser,
  ninjatraderPerformanceReportCsvParser,
  rithmicRTraderProCsvParser,
  tradovatePerformanceCsvParser,
  tradovatePositionHistoryCsvParser,
  genericTradeStatementCsvParser,
];

function supportsBroker(parser: BrokerCsvParser, broker: string): boolean {
  return parser.brokers === "*" || parser.brokers.includes(broker);
}

export function parseBrokerCsvImport(input: {
  broker: string;
  fileContent: string | Buffer;
  fileName?: string | null;
}): ParsedBrokerCsvImport {
  const document = parseImportDocument({
    fileName: input.fileName,
    fileContent: input.fileContent,
  });
  const context: BrokerCsvImportContext = {
    broker: input.broker,
    fileName: input.fileName ?? null,
    document,
  };

  if (document.records.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The file is empty or does not contain any data rows.",
    });
  }

  const ranked = parsers
    .filter((parser) => supportsBroker(parser, input.broker))
    .map((parser) => ({
      parser,
      score: parser.detect(context),
    }))
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  if (!best || best.score <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        input.broker === "tradovate"
          ? "Unsupported Tradovate CSV format. Export the Performance or Position History report for now."
          : "Unsupported file format. The file headers could not be matched to a supported trade statement parser.",
    });
  }

  if (
    input.broker === "tradovate" &&
    best.parser.id !== "tradovate-position-history" &&
    best.parser.id !== "tradovate-performance"
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Tradovate CSV import currently supports the Performance and Position History reports. Export one of those from Tradovate Reports and try again.",
    });
  }

  const parsed = best.parser.parse(context);
  if (parsed.trades.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        input.broker === "tradovate"
          ? "No trades were parsed from this Tradovate CSV. Confirm you exported the Performance or Position History report, not Orders or Cash History."
          : "No trades were parsed from the uploaded file.",
    });
  }

  return parsed;
}
