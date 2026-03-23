import { TRPCError } from "@trpc/server";

import { parseImportDocument } from "./document";
import { parseBrokerCsvImport } from "./registry";
import type {
  ImportedAccountHints,
  NormalizedImportedTrade,
  ParsedBrokerCsvImport,
} from "./types";
import { normalizeKey, pickNumber, pickValue } from "./utils";

export interface ParsedImportTrade {
  ticket: string | null;
  open: string | null;
  tradeType: "long" | "short" | null;
  volume: number | null;
  symbol: string | null;
  openPrice: number | null;
  sl: number | null;
  tp: number | null;
  close: string | null;
  closePrice: number | null;
  swap: number | null;
  commissions: number | null;
  profit: number | null;
  pips: number | null;
  tradeDurationSeconds: string | null;
  openTime: Date | null;
  closeTime: Date | null;
  sessionTag: string | null;
  sessionTagColor: string | null;
}

export interface ParsedImportAccountHints {
  brokerType: string | null;
  brokerServer: string | null;
  accountNumber: string | null;
  currency: string | null;
  liveBalance: number | null;
  liveEquity: number | null;
}

export interface ParsedImportBundle {
  parserId: string;
  parserLabel: string;
  reportType: string;
  files: string[];
  warnings: string[];
  accountHints: ParsedImportAccountHints;
  trades: ParsedImportTrade[];
  existingTrades: ParsedImportTrade[];
}

type ImportFileInput = {
  fileName?: string | null;
  fileContent: string | Buffer;
};

type TradeSourceImport = ParsedBrokerCsvImport & {
  fileName: string | null;
};

type SupplementalCategory =
  | "fills"
  | "orders"
  | "cash-history"
  | "account-balance-history";

type SupplementalFile = {
  category: SupplementalCategory;
  accountHints: ParsedImportAccountHints;
};

const TRADE_SOURCE_PRIORITY: Record<string, number> = {
  "tradovate-performance": 0,
  "tradovate-position-history": 1,
};

function toParsedImportTrade(
  trade: NormalizedImportedTrade
): ParsedImportTrade {
  return {
    ticket: trade.ticket,
    open: trade.openTime?.toISOString() ?? null,
    tradeType: trade.tradeType,
    volume: trade.volume,
    symbol: trade.symbol,
    openPrice: trade.openPrice,
    sl: trade.sl,
    tp: trade.tp,
    close: trade.closeTime?.toISOString() ?? null,
    closePrice: trade.closePrice,
    swap: trade.swap,
    commissions: trade.commissions,
    profit: trade.profit,
    pips: trade.pips,
    tradeDurationSeconds: trade.tradeDurationSeconds ?? null,
    openTime: trade.openTime,
    closeTime: trade.closeTime,
    sessionTag: null,
    sessionTagColor: null,
  };
}

function toParsedImportAccountHints(
  accountHints?: ImportedAccountHints
): ParsedImportAccountHints {
  return {
    brokerType: accountHints?.brokerType ?? null,
    brokerServer: accountHints?.brokerServer ?? null,
    accountNumber: accountHints?.accountNumber ?? null,
    currency: accountHints?.currency ?? null,
    liveBalance: accountHints?.liveBalance ?? null,
    liveEquity: accountHints?.liveEquity ?? null,
  };
}

function mergeAccountHints(
  current: ParsedImportAccountHints,
  next: ParsedImportAccountHints
): ParsedImportAccountHints {
  return {
    brokerType: current.brokerType ?? next.brokerType,
    brokerServer: current.brokerServer ?? next.brokerServer,
    accountNumber: current.accountNumber ?? next.accountNumber,
    currency: current.currency ?? next.currency,
    liveBalance: next.liveBalance ?? current.liveBalance,
    liveEquity: next.liveEquity ?? current.liveEquity,
  };
}

function createEmptyAccountHints(): ParsedImportAccountHints {
  return {
    brokerType: null,
    brokerServer: null,
    accountNumber: null,
    currency: null,
    liveBalance: null,
    liveEquity: null,
  };
}

function uniqueWarnings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalizeFileName(fileName: string | null | undefined): string | null {
  const trimmed = fileName?.trim();
  return trimmed ? trimmed : null;
}

function getTradeFingerprint(trade: ParsedImportTrade): string {
  return [
    trade.symbol ?? "",
    trade.tradeType ?? "",
    trade.openTime?.toISOString() ?? "",
    trade.closeTime?.toISOString() ?? "",
    trade.volume ?? "",
    trade.profit ?? "",
  ].join("|");
}

function getTradeSourcePriority(parserId: string): number {
  return TRADE_SOURCE_PRIORITY[parserId] ?? 10;
}

function looksLikeHeader(
  headers: string[],
  candidates: string[],
  mode: "all" | "any" = "all"
): boolean {
  const normalizedHeaders = headers.map(normalizeKey);
  const matches = candidates.map((candidate) =>
    normalizedHeaders.some((header) => header === normalizeKey(candidate))
  );

  return mode === "all" ? matches.every(Boolean) : matches.some(Boolean);
}

function extractSupplementalAccountHints(
  file: ImportFileInput
): ParsedImportAccountHints {
  const document = parseImportDocument({
    fileName: file.fileName,
    fileContent: file.fileContent,
  });
  const records = document.records;
  if (records.length === 0) {
    return createEmptyAccountHints();
  }

  const accountNumber =
    records
      .map((record) =>
        pickValue(record, ["Account", "Account Number", "Account Num"])
      )
      .find((value): value is string => Boolean(value && value.trim())) ?? null;
  const currency =
    records
      .map((record) => pickValue(record, ["Currency"]))
      .find((value): value is string => Boolean(value && value.trim())) ?? null;

  const liveBalanceCandidates = records
    .map((record) =>
      pickNumber(record, [
        "Balance",
        "Account Balance",
        "Ending Balance",
        "Total Amount",
        "Cash Balance",
        "Net Cash",
        "Net Liquidating Value",
      ])
    )
    .filter(
      (value): value is number => value != null && Number.isFinite(value)
    );

  const liveEquityCandidates = records
    .map((record) =>
      pickNumber(record, [
        "Equity",
        "Net Liquidating Value",
        "Net Liq",
        "NetLiq",
      ])
    )
    .filter(
      (value): value is number => value != null && Number.isFinite(value)
    );

  return {
    brokerType: null,
    brokerServer: null,
    accountNumber,
    currency,
    liveBalance: liveBalanceCandidates.at(-1) ?? null,
    liveEquity: liveEquityCandidates.at(-1) ?? null,
  };
}

function classifyTradovateSupplementalFile(
  file: ImportFileInput
): SupplementalFile | null {
  const document = parseImportDocument({
    fileName: file.fileName,
    fileContent: file.fileContent,
  });
  const headers = document.headers;
  const normalizedName = normalizeKey(file.fileName ?? "");

  const category: SupplementalCategory | null = normalizedName.includes(
    "account balance"
  )
    ? "account-balance-history"
    : normalizedName.includes("cash history") ||
      normalizedName.includes("client statement")
    ? "cash-history"
    : normalizedName.includes("fills")
    ? "fills"
    : normalizedName.includes("orders") ||
      normalizedName.includes("order details")
    ? "orders"
    : looksLikeHeader(headers, ["Order ID", "Status"], "all")
    ? "orders"
    : looksLikeHeader(headers, ["Fill ID", "Order ID"], "all")
    ? "fills"
    : looksLikeHeader(
        headers,
        ["Net Liquidating Value", "Balance", "Equity"],
        "any"
      )
    ? "account-balance-history"
    : looksLikeHeader(
        headers,
        ["Cash Balance", "Net Cash", "Transaction Type", "Amount"],
        "any"
      )
    ? "cash-history"
    : null;

  if (!category) {
    return null;
  }

  return {
    category,
    accountHints: extractSupplementalAccountHints(file),
  };
}

function buildBundleDescriptor(input: {
  broker: string;
  tradeSources: TradeSourceImport[];
}) {
  if (input.tradeSources.length === 1) {
    const [first] = input.tradeSources;
    return {
      parserId: first.parserId,
      parserLabel: first.parserLabel,
      reportType: first.reportType,
    };
  }

  const brokerLabel =
    input.broker.length > 0
      ? `${input.broker[0]!.toUpperCase()}${input.broker.slice(1)}`
      : "Broker";

  return {
    parserId: `csv-bundle:${input.broker}`,
    parserLabel: `${brokerLabel} CSV Bundle`,
    reportType: "bundle",
  };
}

export function parseBrokerCsvImportBundle(input: {
  broker: string;
  files: ImportFileInput[];
  existingTrades?: ParsedImportTrade[];
}): ParsedImportBundle {
  const tradeSources: TradeSourceImport[] = [];
  let accountHints = createEmptyAccountHints();
  const warnings: string[] = [];

  for (const file of input.files) {
    try {
      const parsed = parseBrokerCsvImport({
        broker: input.broker,
        fileContent: file.fileContent,
        fileName: file.fileName ?? null,
      });

      tradeSources.push({
        ...parsed,
        fileName: normalizeFileName(file.fileName),
      });
      accountHints = mergeAccountHints(
        accountHints,
        toParsedImportAccountHints(parsed.accountHints)
      );
      warnings.push(...parsed.warnings);
      continue;
    } catch (error) {
      if (input.broker === "tradovate") {
        const supplemental = classifyTradovateSupplementalFile(file);
        if (supplemental) {
          accountHints = mergeAccountHints(
            accountHints,
            supplemental.accountHints
          );
          continue;
        }
      }

      const fileLabel = normalizeFileName(file.fileName);
      const message =
        error instanceof TRPCError ? error.message : "Unsupported file format.";

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: fileLabel
          ? `Unable to parse ${fileLabel}: ${message}`
          : message,
      });
    }
  }

  if (tradeSources.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        input.broker === "tradovate"
          ? "No Tradovate trade report was found in the upload bundle. Include Performance or Position History as the base report."
          : "No supported trade rows were found in the uploaded file bundle.",
    });
  }

  tradeSources.sort(
    (left, right) =>
      getTradeSourcePriority(left.parserId) -
      getTradeSourcePriority(right.parserId)
  );

  const dedupedTrades = new Map<string, ParsedImportTrade>();
  for (const source of tradeSources) {
    for (const trade of source.trades.map(toParsedImportTrade)) {
      const fingerprint = getTradeFingerprint(trade);
      if (!dedupedTrades.has(fingerprint)) {
        dedupedTrades.set(fingerprint, trade);
      }
    }
  }

  const descriptor = buildBundleDescriptor({
    broker: input.broker,
    tradeSources,
  });

  return {
    parserId: descriptor.parserId,
    parserLabel: descriptor.parserLabel,
    reportType: descriptor.reportType,
    files: input.files.map(
      (file) => normalizeFileName(file.fileName) ?? "upload.csv"
    ),
    warnings: uniqueWarnings(warnings),
    accountHints: accountHints.brokerType
      ? accountHints
      : {
          ...accountHints,
          brokerType: input.broker.toLowerCase().includes("mt")
            ? "mt5"
            : "other",
        },
    trades: [...dedupedTrades.values()],
    existingTrades: input.existingTrades ?? [],
  };
}
