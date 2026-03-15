import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "../../db";
import { deletedImportedTrade } from "../../db/schema/trading";

import {
  buildImportedTradeIdentityFingerprint,
  buildStoredImportedTradeIdentityFingerprint,
} from "./persistence";

export async function loadDeletedImportedTradeMatchers(input: {
  accountId: string;
  trades: Array<{ ticket?: string | null }>;
}) {
  const rows = await db
    .select({
      ticket: deletedImportedTrade.ticket,
      fingerprint: deletedImportedTrade.importFingerprint,
    })
    .from(deletedImportedTrade)
    .where(eq(deletedImportedTrade.accountId, input.accountId));

  return {
    tickets: new Set(
      rows
        .map((row) => row.ticket)
        .filter((value): value is string => typeof value === "string")
    ),
    fingerprints: new Set(
      rows
        .map((row) => row.fingerprint)
        .filter((value): value is string => typeof value === "string")
    ),
  };
}

export async function archiveDeletedImportedTrades(input: {
  tx: typeof db;
  trades: Array<Record<string, unknown>>;
}) {
  if (input.trades.length === 0) return;

  const values = input.trades.map((tradeRow) => ({
    id: randomUUID(),
    originalTradeId:
      typeof tradeRow.originalTradeId === "string"
        ? tradeRow.originalTradeId
        : typeof tradeRow.id === "string"
          ? tradeRow.id
          : null,
    accountId: String(tradeRow.accountId ?? ""),
    ticket:
      typeof tradeRow.ticket === "string" ? tradeRow.ticket : null,
    importFingerprint: buildStoredImportedTradeIdentityFingerprint({
      ticket:
        typeof tradeRow.ticket === "string" ? tradeRow.ticket : null,
      symbol:
        typeof tradeRow.symbol === "string" ? tradeRow.symbol : null,
      openTime: tradeRow.openTime instanceof Date ? tradeRow.openTime : null,
      closeTime: tradeRow.closeTime instanceof Date ? tradeRow.closeTime : null,
      volume:
        typeof tradeRow.volume === "string" ? tradeRow.volume : null,
      profit:
        typeof tradeRow.profit === "string" ? tradeRow.profit : null,
    }),
    importSource: "manual_delete",
    importParserId: null,
    importReportType: null,
    tradeSnapshot: tradeRow,
    deletedAt: new Date(),
  }));

  await input.tx.insert(deletedImportedTrade).values(values as never);
}

export function buildDeletedImportedTradeMatcher(trade: {
  ticket?: string | null;
}) {
  return buildImportedTradeIdentityFingerprint({
    ticket: trade.ticket ?? null,
    open: null,
    tradeType: null,
    volume: null,
    symbol: null,
    openPrice: null,
    sl: null,
    tp: null,
    close: null,
    closePrice: null,
    swap: null,
    commissions: null,
    profit: null,
    pips: null,
    tradeDurationSeconds: null,
    openTime: null,
    closeTime: null,
    sessionTag: null,
    sessionTagColor: null,
  });
}
