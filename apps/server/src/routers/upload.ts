import { randomUUID } from "crypto";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db } from "../db";
import { tradingAccount, trade } from "../db/schema/trading";
import { notifyEarnedAchievements } from "../lib/achievements";
import { createNotification } from "../lib/notifications";
import { buildAutoPropAccountFields } from "../lib/prop-firm-detection";
import { ensurePropChallengeLineageForAccount } from "../lib/prop-challenge-lineage";
import { syncPropAccountState } from "../lib/prop-rule-monitor";
import { parseBrokerCsvImportBundle } from "../lib/trade-import/csv/bundle";
import { loadDeletedImportedTradeMatchers } from "../lib/trade-import/deleted-imported-trades";
import {
  buildImportedTradeCoreIdentityFingerprint,
  buildImportedTradeIdentityFingerprint,
  buildImportedTradeInsertRecord,
  buildImportedTradeUpdateRecord,
  buildStoredImportedTradeCoreIdentityFingerprint,
  buildStoredImportedTradeIdentityFingerprint,
  hasImportedTradeChanges,
  mapStoredTradeToImportedTrade,
} from "../lib/trade-import/persistence";
import { protectedProcedure, router } from "../lib/trpc";

const csvFileInputSchema = z.object({
  fileName: z.string().optional().nullable(),
  csvBase64: z.string().min(1),
});

const importCsvInputSchema = z
  .object({
    name: z.string().min(1),
    broker: z.string().min(1),
    csvBase64: z.string().optional(),
    fileName: z.string().optional(),
    files: z.array(csvFileInputSchema).optional(),
    initialBalance: z.number().nonnegative().optional(),
    initialCurrency: z.enum(["$", "£", "€"]).optional(),
    existingAccountAction: z.enum(["enrich", "create_duplicate"]).optional(),
    existingAccountId: z.string().min(1).optional(),
  })
  .refine(
    (value) =>
      (value.files != null && value.files.length > 0) ||
      Boolean(value.csvBase64 && value.csvBase64.length > 0),
    {
      message: "At least one CSV file is required.",
      path: ["files"],
    }
  );

const enrichCsvAccountInputSchema = z.object({
  accountId: z.string().min(1),
  files: z.array(csvFileInputSchema).min(1),
});

function decodeCsvFiles(
  files: Array<{ fileName?: string | null; csvBase64: string }>
) {
  return files.map((file) => ({
    fileName: file.fileName ?? null,
    csvText: Buffer.from(file.csvBase64, "base64").toString("utf8"),
  }));
}

async function applyParsedImportToExistingAccount(input: {
  userId: string;
  accountId: string;
  account: {
    id: string;
    name: string;
    broker: string;
    brokerServer: string | null;
    accountNumber: string | null;
    initialCurrency: string | null;
    initialBalance?: string | null;
    liveBalance?: string | null;
    liveEquity?: string | null;
  };
  parsedImport: ReturnType<typeof parseBrokerCsvImportBundle>;
}) {
  const { userId, account, accountId, parsedImport } = input;

  const existingTrades = await db
    .select({
      id: trade.id,
      ticket: trade.ticket,
      open: trade.open,
      tradeType: trade.tradeType,
      volume: trade.volume,
      symbol: trade.symbol,
      openPrice: trade.openPrice,
      sl: trade.sl,
      tp: trade.tp,
      close: trade.close,
      closePrice: trade.closePrice,
      swap: trade.swap,
      commissions: trade.commissions,
      profit: trade.profit,
      pips: trade.pips,
      tradeDurationSeconds: trade.tradeDurationSeconds,
      openTime: trade.openTime,
      closeTime: trade.closeTime,
      sessionTag: trade.sessionTag,
      sessionTagColor: trade.sessionTagColor,
      brokerMeta: trade.brokerMeta,
    })
    .from(trade)
    .where(eq(trade.accountId, accountId));

  const existingTradeByTicket = new Map(
    existingTrades
      .filter((row) => row.ticket)
      .map((row) => [row.ticket as string, row])
  );
  const existingTradeByFingerprint = new Map<
    string,
    (typeof existingTrades)[number]
  >();
  const existingTradeByCoreFingerprint = new Map<
    string,
    (typeof existingTrades)[number]
  >();
  existingTrades.forEach((row) => {
    const fingerprint = buildStoredImportedTradeIdentityFingerprint(row);
    if (!existingTradeByFingerprint.has(fingerprint)) {
      existingTradeByFingerprint.set(fingerprint, row);
    }

    const coreFingerprint =
      buildStoredImportedTradeCoreIdentityFingerprint(row);
    if (!existingTradeByCoreFingerprint.has(coreFingerprint)) {
      existingTradeByCoreFingerprint.set(coreFingerprint, row);
    }
  });
  const deletedTradeMatchers = await loadDeletedImportedTradeMatchers({
    accountId,
    trades: parsedImport.trades,
  });

  const inserts: ReturnType<typeof buildImportedTradeInsertRecord>[] = [];
  const updates: Array<{
    id: string;
    data: ReturnType<typeof buildImportedTradeUpdateRecord>;
  }> = [];
  let suppressedDeletedTrades = 0;

  parsedImport.trades.forEach((parsedTrade, index) => {
    const tradeFingerprint = buildImportedTradeIdentityFingerprint(parsedTrade);
    const tradeCoreFingerprint =
      buildImportedTradeCoreIdentityFingerprint(parsedTrade);
    const exactFingerprintMatch =
      existingTradeByFingerprint.get(tradeFingerprint) ?? null;
    const ticketMatch =
      parsedTrade.ticket != null
        ? existingTradeByTicket.get(parsedTrade.ticket) ?? null
        : null;
    const safeTicketMatch =
      ticketMatch &&
      buildStoredImportedTradeCoreIdentityFingerprint(ticketMatch) ===
        tradeCoreFingerprint
        ? ticketMatch
        : null;
    const coreFingerprintMatch =
      existingTradeByCoreFingerprint.get(tradeCoreFingerprint) ?? null;
    // Tickets from broker exports are not always globally stable, so only trust
    // a ticket hit when the rest of the trade identity still lines up.
    const existingTrade =
      exactFingerprintMatch ?? safeTicketMatch ?? coreFingerprintMatch;

    if (existingTrade) {
      if (
        hasImportedTradeChanges({
          existingTrade,
          trade: parsedTrade,
          importMeta: parsedImport,
        })
      ) {
        updates.push({
          id: existingTrade.id,
          data: buildImportedTradeUpdateRecord({
            existingTrade,
            trade: parsedTrade,
            importMeta: parsedImport,
          }),
        });
      }
      return;
    }

    if (
      (parsedTrade.ticket != null &&
        deletedTradeMatchers.tickets.has(parsedTrade.ticket)) ||
      deletedTradeMatchers.fingerprints.has(tradeFingerprint)
    ) {
      suppressedDeletedTrades += 1;
      return;
    }

    inserts.push(
      buildImportedTradeInsertRecord({
        accountId,
        trade: parsedTrade,
        index,
        importMeta: parsedImport,
      })
    );
  });

  let accountMetadataUpdated = false;

  let insertedTrades: Array<{ id: string }> = [];

  if (inserts.length > 0) {
    insertedTrades = await db
      .insert(trade)
      .values(inserts as any)
      .returning({ id: trade.id });
  }

  if (updates.length > 0) {
    await Promise.all(
      updates.map((update) =>
        db
          .update(trade)
          .set(update.data as any)
          .where(eq(trade.id, update.id))
      )
    );
  }

  const accountUpdate: Record<string, string | Date | null> = {};

  if (!account.accountNumber && parsedImport.accountHints?.accountNumber) {
    accountUpdate.accountNumber = parsedImport.accountHints.accountNumber;
  }

  if (!account.initialCurrency && parsedImport.accountHints?.currency) {
    accountUpdate.initialCurrency = parsedImport.accountHints.currency;
  }

  if (!account.brokerServer && parsedImport.accountHints?.brokerServer) {
    accountUpdate.brokerServer = parsedImport.accountHints.brokerServer;
  }

  const hintedLiveBalance = parsedImport.accountHints?.liveBalance;
  const hintedLiveEquity = parsedImport.accountHints?.liveEquity;

  if (hintedLiveBalance != null && Number.isFinite(hintedLiveBalance)) {
    const normalized = hintedLiveBalance.toString();
    if (account.liveBalance !== normalized) {
      accountUpdate.liveBalance = normalized;
    }
  } else if (account.initialBalance != null) {
    const [profitAgg] = await db
      .select({
        totalProfit: sql<number>`COALESCE(SUM(CAST(${trade.profit} AS NUMERIC)), 0)`,
      })
      .from(trade)
      .where(eq(trade.accountId, accountId));

    const derivedLiveBalance =
      Number(account.initialBalance) + Number(profitAgg?.totalProfit ?? 0);

    if (Number.isFinite(derivedLiveBalance)) {
      const normalized = derivedLiveBalance.toString();
      if (account.liveBalance !== normalized) {
        accountUpdate.liveBalance = normalized;
      }
    }
  }

  if (hintedLiveEquity != null && Number.isFinite(hintedLiveEquity)) {
    const normalized = hintedLiveEquity.toString();
    if (account.liveEquity !== normalized) {
      accountUpdate.liveEquity = normalized;
    }
  }

  if (
    Object.keys(accountUpdate).some((key) =>
      [
        "liveBalance",
        "liveEquity",
        "accountNumber",
        "initialCurrency",
        "brokerServer",
      ].includes(key)
    )
  ) {
    accountUpdate.lastSyncedAt = new Date();
  }

  if (Object.keys(accountUpdate).length > 0) {
    await db
      .update(tradingAccount)
      .set(accountUpdate as any)
      .where(eq(tradingAccount.id, accountId));
    accountMetadataUpdated = true;
  }

  void emitFeedEventsForTrades(insertedTrades.map((row) => row.id));

  if (insertedTrades.length > 0 || updates.length > 0) {
    await syncPropAccountState(accountId, { saveAlerts: true });
  }

  if (insertedTrades.length > 0 || updates.length > 0) {
    const skippedDeletedSuffix =
      suppressedDeletedTrades > 0
        ? ` ${suppressedDeletedTrades} previously deleted trade${
            suppressedDeletedTrades === 1 ? "" : "s"
          } skipped.`
        : "";

    await createNotification({
      userId,
      accountId,
      type: "trade_imported",
      title: "CSV enrichment complete",
      body:
        insertedTrades.length > 0
          ? `${updates.length} trade${
              updates.length === 1 ? "" : "s"
            } updated and ${insertedTrades.length} new trade${
              insertedTrades.length === 1 ? "" : "s"
            } added to ${account.name}.${skippedDeletedSuffix}`
          : `${updates.length} trade${
              updates.length === 1 ? "" : "s"
            } updated in ${account.name}.${skippedDeletedSuffix}`,
      metadata: {
        accountId,
        accountName: account.name,
        broker: account.broker,
        tradesUpdated: updates.length,
        tradesCreated: insertedTrades.length,
        suppressedDeletedTrades,
        parserId: parsedImport.parserId,
        parserLabel: parsedImport.parserLabel,
        reportType: parsedImport.reportType,
        importFiles: parsedImport.files,
        warnings: parsedImport.warnings,
      },
    });
  }

  return {
    parserId: parsedImport.parserId,
    parserLabel: parsedImport.parserLabel,
    reportType: parsedImport.reportType,
    files: parsedImport.files,
    warnings: parsedImport.warnings,
    tradesUpdated: updates.length,
    tradesCreated: insertedTrades.length,
    suppressedDeletedTrades,
    accountMetadataUpdated,
    noNewData:
      insertedTrades.length === 0 &&
      updates.length === 0 &&
      !accountMetadataUpdated,
  };
}

async function emitFeedEventsForTrades(tradeIds: string[]) {
  if (tradeIds.length === 0) {
    return;
  }

  await Promise.all(
    tradeIds.map((tradeId) =>
      import("../lib/feed-event-generator").then((module) =>
        module
          .generateFeedEventForTrade(tradeId)
          .catch((err) => console.error("Feed event generation failed:", err))
      )
    )
  ).catch((err) => console.error("Feed event batch failed:", err));
}

export const uploadRouter = router({
  importCsv: protectedProcedure
    .input(importCsvInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { updates: autoPropFields } = await buildAutoPropAccountFields({
        broker: input.broker,
        brokerServer: null,
        initialBalance: input.initialBalance ?? null,
      });

      const normalizedFiles =
        input.files && input.files.length > 0
          ? input.files
          : [
              {
                fileName: input.fileName ?? null,
                csvBase64: input.csvBase64 ?? "",
              },
            ];

      const parsedImport = parseBrokerCsvImportBundle({
        broker: input.broker,
        files: decodeCsvFiles(normalizedFiles),
      });

      const parsedAccountNumber =
        parsedImport.accountHints?.accountNumber?.trim() ?? null;
      const matchedExistingAccount =
        input.broker === "tradovate" && parsedAccountNumber
          ? await db.query.tradingAccount.findFirst({
              where: and(
                eq(tradingAccount.userId, userId),
                eq(tradingAccount.broker, input.broker),
                eq(tradingAccount.accountNumber, parsedAccountNumber)
              ),
              columns: {
                id: true,
                name: true,
                broker: true,
                brokerServer: true,
                accountNumber: true,
                initialCurrency: true,
                initialBalance: true,
                liveBalance: true,
                liveEquity: true,
              },
            })
          : null;

      if (matchedExistingAccount) {
        if (input.existingAccountAction === "enrich") {
          if (
            input.existingAccountId &&
            input.existingAccountId !== matchedExistingAccount.id
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Selected Tradovate account did not match the uploaded CSV account number.",
            });
          }

          const result = await applyParsedImportToExistingAccount({
            userId,
            accountId: matchedExistingAccount.id,
            account: matchedExistingAccount,
            parsedImport,
          });

          return {
            status: "enriched_existing" as const,
            accountId: matchedExistingAccount.id,
            matchedExistingAccount: {
              id: matchedExistingAccount.id,
              name: matchedExistingAccount.name,
              broker: matchedExistingAccount.broker,
              accountNumber: matchedExistingAccount.accountNumber,
            },
            ...result,
          };
        }

        if (input.existingAccountAction !== "create_duplicate") {
          return {
            status: "requires_account_resolution" as const,
            parserId: parsedImport.parserId,
            parserLabel: parsedImport.parserLabel,
            reportType: parsedImport.reportType,
            files: parsedImport.files,
            warnings: parsedImport.warnings,
            matchedExistingAccount: {
              id: matchedExistingAccount.id,
              name: matchedExistingAccount.name,
              broker: matchedExistingAccount.broker,
              accountNumber: matchedExistingAccount.accountNumber,
            },
          };
        }
      }

      const accountId = randomUUID();
      await db.insert(tradingAccount).values({
        id: accountId,
        userId,
        name: input.name,
        broker: input.broker,
        brokerType: parsedImport.accountHints?.brokerType ?? "other",
        brokerServer: parsedImport.accountHints?.brokerServer ?? null,
        accountNumber: parsedImport.accountHints?.accountNumber ?? null,
        initialBalance: input.initialBalance as any,
        initialCurrency:
          input.initialCurrency ?? parsedImport.accountHints?.currency ?? null,
        ...autoPropFields,
      });

      if (autoPropFields.isPropAccount) {
        await ensurePropChallengeLineageForAccount(accountId);
      }

      const inserts = parsedImport.trades.map((parsedTrade, index) =>
        buildImportedTradeInsertRecord({
          accountId,
          trade: parsedTrade,
          index,
          importMeta: parsedImport,
        })
      );

      if (inserts.length > 0) {
        const insertedTrades = await db
          .insert(trade)
          .values(inserts as any)
          .returning({ id: trade.id });

        void emitFeedEventsForTrades(insertedTrades.map((row) => row.id));

        await syncPropAccountState(accountId, { saveAlerts: true });
      }

      const [createdAccount] = await db
        .select({
          id: tradingAccount.id,
          name: tradingAccount.name,
          broker: tradingAccount.broker,
          brokerServer: tradingAccount.brokerServer,
          accountNumber: tradingAccount.accountNumber,
          initialCurrency: tradingAccount.initialCurrency,
          initialBalance: tradingAccount.initialBalance,
          liveBalance: tradingAccount.liveBalance,
          liveEquity: tradingAccount.liveEquity,
        })
        .from(tradingAccount)
        .where(eq(tradingAccount.id, accountId))
        .limit(1);

      if (createdAccount) {
        await applyParsedImportToExistingAccount({
          userId,
          accountId,
          account: createdAccount,
          parsedImport,
        });
      }

      await createNotification({
        userId,
        accountId,
        type: "trade_imported",
        title: "CSV import complete",
        body: `${inserts.length} trades imported into ${input.name}.`,
        metadata: {
          accountId,
          accountName: input.name,
          broker: input.broker,
          tradesImported: inserts.length,
          parserId: parsedImport.parserId,
          parserLabel: parsedImport.parserLabel,
          reportType: parsedImport.reportType,
          importFiles: parsedImport.files,
          warnings: parsedImport.warnings,
        },
      });

      if (inserts.length > 0) {
        void notifyEarnedAchievements({
          userId,
          accountId,
          source: "csv-import",
        }).catch((error) => {
          console.error("[Upload] Achievement notification failed:", error);
        });
      }

      return {
        status: "created" as const,
        accountId,
        parserId: parsedImport.parserId,
        parserLabel: parsedImport.parserLabel,
        reportType: parsedImport.reportType,
        files: parsedImport.files,
        warnings: parsedImport.warnings,
        tradesImported: inserts.length,
      };
    }),
  enrichCsvAccount: protectedProcedure
    .input(enrichCsvAccountInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const [account] = await db
        .select({
          id: tradingAccount.id,
          name: tradingAccount.name,
          broker: tradingAccount.broker,
          brokerServer: tradingAccount.brokerServer,
          accountNumber: tradingAccount.accountNumber,
          initialCurrency: tradingAccount.initialCurrency,
          initialBalance: tradingAccount.initialBalance,
          liveBalance: tradingAccount.liveBalance,
          liveEquity: tradingAccount.liveEquity,
        })
        .from(tradingAccount)
        .where(
          and(
            eq(tradingAccount.id, input.accountId),
            eq(tradingAccount.userId, userId)
          )
        )
        .limit(1);

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found.",
        });
      }

      if (account.broker !== "tradovate") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Supplemental CSV enrichment is currently only supported for Tradovate accounts.",
        });
      }

      const existingTrades = await db
        .select({
          id: trade.id,
          ticket: trade.ticket,
          open: trade.open,
          tradeType: trade.tradeType,
          volume: trade.volume,
          symbol: trade.symbol,
          openPrice: trade.openPrice,
          sl: trade.sl,
          tp: trade.tp,
          close: trade.close,
          closePrice: trade.closePrice,
          swap: trade.swap,
          commissions: trade.commissions,
          profit: trade.profit,
          pips: trade.pips,
          tradeDurationSeconds: trade.tradeDurationSeconds,
          openTime: trade.openTime,
          closeTime: trade.closeTime,
          sessionTag: trade.sessionTag,
          sessionTagColor: trade.sessionTagColor,
          brokerMeta: trade.brokerMeta,
        })
        .from(trade)
        .where(eq(trade.accountId, input.accountId));

      const parsedImport = parseBrokerCsvImportBundle({
        broker: account.broker,
        files: decodeCsvFiles(input.files),
        existingTrades: existingTrades.map(mapStoredTradeToImportedTrade),
      });

      const result = await applyParsedImportToExistingAccount({
        userId,
        accountId: input.accountId,
        account,
        parsedImport,
      });

      return {
        accountId: input.accountId,
        ...result,
      };
    }),
});
