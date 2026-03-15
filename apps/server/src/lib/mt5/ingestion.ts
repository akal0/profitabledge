import { and, eq } from "drizzle-orm";

import { db } from "../../db";
import { platformConnection, syncLog } from "../../db/schema/connections";
import { brokerDealEvent, brokerOrderEvent } from "../../db/schema/mt5-sync";
import { cache, cacheKeys } from "../cache";
import { cacheNamespaces, enhancedCache } from "../enhanced-cache";
import {
  enrichProjectedMt5Trades,
  refreshRecentMt5TradeAnalytics,
} from "./enrichment";
import {
  getOrderTradeKey,
  getTradeKey,
  parseDate,
  sanitizeMt5SyncFrame,
} from "./ingestion-helpers";
import {
  ensureMt5TradingAccount,
  insertDealEvents,
  insertLedgerEvents,
  insertOrderEvents,
  projectAccountSnapshot,
  projectOpenPositions,
  projectPriceSnapshots,
  projectSymbolSpecs,
  upsertBrokerSession,
} from "./ingestion-persistence";
import {
  collectAllMt5TradeKeysForAccount,
  emitMt5ClosedTradeSideEffects,
  emitMt5CopierPositionSideEffects,
  projectClosedTrades,
  updateCheckpoint,
} from "./ingestion-trade-projection";
import {
  mt5SyncFrameSchema,
  type Mt5SyncFrameInput,
  type RemovedOpenTradeSeed,
} from "./ingestion-types";
import { syncPropAccountState } from "../prop-rule-monitor";

export { mt5SyncFrameSchema };
export type { Mt5SyncFrameInput } from "./ingestion-types";

export async function ingestMt5SyncFrame(rawInput: Mt5SyncFrameInput) {
  const startedAt = Date.now();
  const input = mt5SyncFrameSchema.parse(sanitizeMt5SyncFrame(rawInput));
  const reconcileMode =
    input.session?.meta?.historyMode === "full-reconcile"
      ? "full-reconcile"
      : "incremental";
  const snapshotTime = parseDate(input.account.snapshotTime);
  const { connection, accountId } = await ensureMt5TradingAccount(
    input.connectionId,
    input.account
  );

  await upsertBrokerSession(input.connectionId, accountId, input.session);
  await projectAccountSnapshot(input.connectionId, accountId, input.account);
  const { symbolSpecsInserted, symbolSpecsBySymbol } = await projectSymbolSpecs(
    input.connectionId,
    accountId,
    input.symbolSpecs
  );
  const executionContextsByTradeKey = new Map(
    input.executionContexts.map((executionContext) => [
      executionContext.tradeKey,
      executionContext,
    ])
  );

  const { dealEventsInserted, affectedTradeKeys } = await insertDealEvents(
    input.connectionId,
    accountId,
    input.deals,
    reconcileMode
  );
  const { orderEventsInserted, affectedTradeKeys: affectedOrderTradeKeys } =
    await insertOrderEvents(
      input.connectionId,
      accountId,
      input.orders,
      reconcileMode
    );
  const { ledgerEventsInserted } = await insertLedgerEvents(
    input.connectionId,
    accountId,
    input.ledgerEvents,
    reconcileMode
  );
  const { priceSnapshotsInserted } = await projectPriceSnapshots(
    connection.userId,
    accountId,
    input.priceSnapshots
  );
  const {
    openPositionsUpserted,
    openedPositions,
    modifiedPositions,
    removedTradeKeys,
    removedOpenTrades,
  } = await projectOpenPositions(
    input.connectionId,
    accountId,
    input.positions,
    snapshotTime,
    executionContextsByTradeKey
  );
  const removedOpenTradesByKey = new Map<string, RemovedOpenTradeSeed>(
    removedOpenTrades.map((openTradeRow) => [
      openTradeRow.ticket,
      {
        ticket: openTradeRow.ticket,
        symbol: openTradeRow.symbol,
        tradeType: openTradeRow.tradeType,
        volume: openTradeRow.volume,
        openPrice: openTradeRow.openPrice,
        currentPrice: openTradeRow.currentPrice,
        openTime: openTradeRow.openTime,
        sl: openTradeRow.sl,
        tp: openTradeRow.tp,
        profit: openTradeRow.profit,
        swap: openTradeRow.swap,
        commission: openTradeRow.commission,
        comment: openTradeRow.comment,
        magicNumber: openTradeRow.magicNumber,
        brokerMeta:
          openTradeRow.brokerMeta && typeof openTradeRow.brokerMeta === "object"
            ? (openTradeRow.brokerMeta as Record<string, unknown>)
            : null,
      },
    ])
  );
  await emitMt5CopierPositionSideEffects({
    accountId,
    account: input.account,
    openedPositions,
    modifiedPositions,
    removedOpenTrades: [...removedOpenTradesByKey.values()],
  });
  const tradeKeysToProject = [
    ...new Set([
      ...affectedTradeKeys,
      ...affectedOrderTradeKeys,
      ...removedTradeKeys,
    ]),
  ];
  const fullReconcileTradeKeys =
    reconcileMode === "full-reconcile"
      ? await collectAllMt5TradeKeysForAccount({
          accountId,
          connectionId: input.connectionId,
        })
      : [];
  const projectionTradeKeys = [
    ...new Set([...tradeKeysToProject, ...fullReconcileTradeKeys]),
  ];
  const { tradesProjected, tradeIds, createdTradeIds } =
    await projectClosedTrades(accountId, projectionTradeKeys, {
      removedOpenTradesByKey,
      executionContextsByTradeKey,
      symbolSpecsBySymbol,
    });
  const { tradesEnriched } = await enrichProjectedMt5Trades({
    accountId,
    tradeIds,
  });
  const { tradesRefreshed } = await refreshRecentMt5TradeAnalytics({
    accountId,
    asOf: snapshotTime,
  });

  await updateCheckpoint(input.connectionId, accountId, input);

  const currentMeta =
    connection.meta && typeof connection.meta === "object"
      ? (connection.meta as Record<string, unknown>)
      : {};

  await db
    .update(platformConnection)
    .set({
      accountId,
      status: input.session?.lastError ? "error" : "active",
      lastError: input.session?.lastError ?? null,
      lastSyncAttemptAt: new Date(),
      lastSyncSuccessAt: new Date(),
      lastSyncedTradeCount: tradesProjected,
      meta: {
        ...currentMeta,
        mt5: {
          login: input.account.login,
          serverName: input.account.serverName,
          brokerName: input.account.brokerName,
          workerHostId: input.session?.workerHostId ?? null,
          sessionKey: input.session?.sessionKey ?? null,
          lastSnapshotAt: input.account.snapshotTime,
        },
      },
      updatedAt: new Date(),
    })
    .where(eq(platformConnection.id, input.connectionId));

  await db.insert(syncLog).values({
    connectionId: input.connectionId,
    accountId,
    status: input.session?.lastError ? "error" : "success",
    tradesFound: input.deals.length,
    tradesInserted: tradesProjected,
    tradesDuplicated: Math.max(0, input.deals.length - dealEventsInserted),
    errorMessage: input.session?.lastError ?? null,
    durationMs: Date.now() - startedAt,
  });

  cache.invalidate(cacheKeys.liveMetrics(accountId));
  await enhancedCache.invalidateByTags([
    cacheNamespaces.TRADES,
    `account:${accountId}`,
  ]);
  await syncPropAccountState(accountId, { saveAlerts: true });

  const result = {
    connectionId: input.connectionId,
    accountId,
    dealEventsInserted,
    orderEventsInserted,
    ledgerEventsInserted,
    symbolSpecsInserted,
    priceSnapshotsInserted,
    openPositionsUpserted,
    tradesProjected,
    tradesEnriched,
    tradesRefreshed,
  };

  await emitMt5ClosedTradeSideEffects({
    userId: connection.userId,
    accountId,
    connectionDisplayName: connection.displayName,
    tradeIds: createdTradeIds,
  });

  return result;
}

export async function backfillMt5ProjectedTrades(input?: {
  accountId?: string;
  connectionId?: string;
  emitSideEffects?: boolean;
}) {
  const dealFilters: Array<ReturnType<typeof eq>> = [];
  const orderFilters: Array<ReturnType<typeof eq>> = [];
  if (input?.accountId) {
    dealFilters.push(eq(brokerDealEvent.accountId, input.accountId));
    orderFilters.push(eq(brokerOrderEvent.accountId, input.accountId));
  }
  if (input?.connectionId) {
    dealFilters.push(eq(brokerDealEvent.connectionId, input.connectionId));
    orderFilters.push(eq(brokerOrderEvent.connectionId, input.connectionId));
  }

  const dealQuery = db
    .select({
      accountId: brokerDealEvent.accountId,
      connectionId: brokerDealEvent.connectionId,
      remoteDealId: brokerDealEvent.remoteDealId,
      remoteOrderId: brokerDealEvent.remoteOrderId,
      positionId: brokerDealEvent.positionId,
    })
    .from(brokerDealEvent);

  const dealRows =
    dealFilters.length > 0
      ? await dealQuery.where(and(...dealFilters))
      : await dealQuery;
  const orderQuery = db
    .select({
      accountId: brokerOrderEvent.accountId,
      connectionId: brokerOrderEvent.connectionId,
      remoteOrderId: brokerOrderEvent.remoteOrderId,
      positionId: brokerOrderEvent.positionId,
    })
    .from(brokerOrderEvent);
  const orderRows =
    orderFilters.length > 0
      ? await orderQuery.where(and(...orderFilters))
      : await orderQuery;

  const buckets = new Map<
    string,
    { connectionId: string | null; tradeKeys: Set<string> }
  >();

  for (const row of dealRows) {
    const tradeKey = getTradeKey({
      positionId: row.positionId ?? null,
      remoteOrderId: row.remoteOrderId ?? null,
      remoteDealId: row.remoteDealId,
    });
    const bucket = buckets.get(row.accountId) ?? {
      connectionId: row.connectionId,
      tradeKeys: new Set<string>(),
    };
    bucket.tradeKeys.add(tradeKey);
    if (!bucket.connectionId) {
      bucket.connectionId = row.connectionId;
    }
    buckets.set(row.accountId, bucket);
  }

  for (const row of orderRows) {
    const tradeKey = getOrderTradeKey({
      positionId: row.positionId ?? null,
      remoteOrderId: row.remoteOrderId,
    });
    const bucket = buckets.get(row.accountId) ?? {
      connectionId: row.connectionId,
      tradeKeys: new Set<string>(),
    };
    bucket.tradeKeys.add(tradeKey);
    if (!bucket.connectionId) {
      bucket.connectionId = row.connectionId;
    }
    buckets.set(row.accountId, bucket);
  }

  let accountsProcessed = 0;
  let tradesProjected = 0;
  let tradesEnriched = 0;
  let notificationsEmitted = 0;
  const accountResults: Array<{
    accountId: string;
    connectionId: string | null;
    tradeKeys: number;
    tradesProjected: number;
    tradesEnriched: number;
    createdTradeIds: string[];
  }> = [];

  for (const [accountId, bucket] of buckets.entries()) {
    const {
      tradesProjected: projectedCount,
      tradeIds,
      createdTradeIds,
    } = await projectClosedTrades(accountId, [...bucket.tradeKeys]);
    const { tradesEnriched: enrichedCount } = await enrichProjectedMt5Trades({
      accountId,
      tradeIds,
    });

    if (
      input?.emitSideEffects &&
      createdTradeIds.length > 0 &&
      bucket.connectionId
    ) {
      const connection = await db.query.platformConnection.findFirst({
        where: eq(platformConnection.id, bucket.connectionId),
        columns: {
          userId: true,
          displayName: true,
        },
      });

      if (connection) {
        await emitMt5ClosedTradeSideEffects({
          userId: connection.userId,
          accountId,
          connectionDisplayName: connection.displayName,
          tradeIds: createdTradeIds,
        });
        notificationsEmitted += createdTradeIds.length;
      }
    }

    cache.invalidate(cacheKeys.liveMetrics(accountId));
    await enhancedCache.invalidateByTags([
      cacheNamespaces.TRADES,
      `account:${accountId}`,
    ]);

    accountsProcessed += 1;
    tradesProjected += projectedCount;
    tradesEnriched += enrichedCount;
    accountResults.push({
      accountId,
      connectionId: bucket.connectionId,
      tradeKeys: bucket.tradeKeys.size,
      tradesProjected: projectedCount,
      tradesEnriched: enrichedCount,
      createdTradeIds,
    });
  }

  return {
    accountsProcessed,
    tradesProjected,
    tradesEnriched,
    notificationsEmitted,
    accountResults,
  };
}
