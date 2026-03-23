export type CsvRowRecord = Record<string, string>;

export interface ParsedCsvDocument {
  delimiter: string;
  headers: string[];
  rows: string[][];
  records: CsvRowRecord[];
}

export interface BrokerCsvImportContext {
  broker: string;
  fileName: string | null;
  document: ParsedCsvDocument;
}

export interface BrokerCsvImportFileInput {
  fileName: string | null;
  fileContent: string | Buffer;
}

export interface NormalizedImportedTrade {
  ticket: string | null;
  symbol: string;
  tradeType: "long" | "short";
  volume: number | null;
  openPrice: number | null;
  closePrice: number | null;
  openTime: Date | null;
  closeTime: Date | null;
  profit: number | null;
  sl: number | null;
  tp: number | null;
  swap: number | null;
  commissions: number | null;
  pips: number | null;
  tradeDurationSeconds: string | null;
  comment: string | null;
  brokerMeta?: Record<string, unknown> | null;
}

export interface ImportedAccountHints {
  currency?: string | null;
  accountNumber?: string | null;
  brokerServer?: string | null;
  brokerType?: string | null;
  liveBalance?: number | null;
  liveEquity?: number | null;
  brokerMeta?: Record<string, unknown> | null;
}

export interface ParsedBrokerCsvImport {
  parserId: string;
  parserLabel: string;
  reportType: string;
  trades: NormalizedImportedTrade[];
  warnings: string[];
  accountHints?: ImportedAccountHints;
}

export interface ParsedBrokerCsvImportFileSummary {
  fileName: string | null;
  parserId: string;
  parserLabel: string;
  reportType: string;
  category: "trade-source" | "supplemental";
  tradeCount?: number;
}

export interface ParsedBrokerCsvImportBundle extends ParsedBrokerCsvImport {
  files: ParsedBrokerCsvImportFileSummary[];
}

export interface BrokerCsvParser {
  id: string;
  label: string;
  brokers: string[] | "*";
  detect(context: BrokerCsvImportContext): number;
  parse(context: BrokerCsvImportContext): ParsedBrokerCsvImport;
}
