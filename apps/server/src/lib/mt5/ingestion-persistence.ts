import { and, eq, inArray, notInArray, or } from "drizzle-orm";
import { db } from "../../db";
import { equitySnapshot, platformConnection } from "../../db/schema/connections";
import {
  brokerAccountSnapshot,
  brokerDealEvent,
  brokerLedgerEvent,
  brokerOrderEvent,
  brokerPositionSnapshot,
  brokerSession,
  brokerSymbolSpec,
} from "../../db/schema/mt5-sync";
import { openTrade, tradingAccount } from "../../db/schema/trading";
import { ensurePropChallengeLineageForAccount } from "../prop-challenge-lineage";
import { buildAutoPropAccountFields } from "../prop-firm-detection";
import { insertHistoricalPriceSnapshots } from "../price-ingestion";
import { deriveSessionTagAt } from "../session-tags";
import {
  buildSymbolSpecMap,
  buildTradeLifecycleMetrics,
  getOrderTradeKey,
  getTradeKey,
  mergeBrokerMetaExecutionContext,
  normalizeTradeSide,
  parseDate,
  toDecimal,
} from "./ingestion-helpers";
import {
  type ModifiedPositionSeed,
  type Mt5ExecutionContext,
  type Mt5SymbolSpec,
  type Mt5SyncFrameInput,
  type OpenedPositionSeed,
} from "./ingestion-types";
import {
  canonicalizeBrokerSymbol,
  normalizeBrokerSymbol,
  resolveBrokerPipSize,
  type MtSymbolSpecLike,
} from "./symbol-specs";

type MtPlatform = "mt4" | "mt5";

function resolveMtPlatform(provider: string): MtPlatform {
  return provider === "mt4-terminal" ? "mt4" : "mt5";
}

export async function ensureMt5TradingAccount(
  connectionId: string,
  account: Mt5SyncFrameInput["account"]
) {
  const connection = await db.query.platformConnection.findFirst({
    where: eq(platformConnection.id, connectionId),
  });

  if (!connection) {
    throw new Error(`Connection ${connectionId} not found`);
  }

  const accountNumber = account.login.trim();
  const brokerServer = account.serverName.trim();
  const brokerName = account.brokerName.trim();
  const platform = resolveMtPlatform(connection.provider);
  const { updates: autoPropFields } = await buildAutoPropAccountFields({
    broker: brokerName,
    brokerServer,
    initialBalance: account.balance,
  });

  const existing =
    connection.accountId != null
      ? await db.query.tradingAccount.findFirst({
          where: eq(tradingAccount.id, connection.accountId),
        })
      : await db.query.tradingAccount.findFirst({
          where: and(
            eq(tradingAccount.userId, connection.userId),
            eq(tradingAccount.accountNumber, accountNumber),
            eq(tradingAccount.brokerServer, brokerServer)
          ),
        });

  const commonUpdates = {
    broker: brokerName,
    brokerType: platform,
    brokerServer,
    accountNumber,
    liveBalance: account.balance.toString(),
    liveEquity: account.equity.toString(),
    liveMargin: toDecimal(account.margin),
    liveFreeMargin: toDecimal(account.freeMargin),
    preferredDataSource: "broker",
    isVerified: 1,
    verificationLevel: "api_verified",
    initialCurrency: account.currency.toUpperCase().slice(0, 8),
    lastSyncedAt: parseDate(account.snapshotTime),
    ...autoPropFields,
  } as const;

  if (existing) {
    await db
      .update(tradingAccount)
      .set({
        ...commonUpdates,
        initialBalance:
          existing.initialBalance == null
            ? account.balance.toString()
            : existing.initialBalance,
      })
      .where(eq(tradingAccount.id, existing.id));

    if (connection.accountId !== existing.id) {
      await db
        .update(platformConnection)
        .set({ accountId: existing.id, updatedAt: new Date() })
        .where(eq(platformConnection.id, connectionId));
    }

    if (autoPropFields.isPropAccount) {
      await ensurePropChallengeLineageForAccount(existing.id);
    }

    return {
      connection,
      accountId: existing.id,
      platform,
    };
  }

  const accountId = crypto.randomUUID();
  await db.insert(tradingAccount).values({
    id: accountId,
    userId: connection.userId,
    name: connection.displayName || `${brokerName} ${accountNumber}`,
    initialBalance: account.balance.toString(),
    ...commonUpdates,
  });

  if (autoPropFields.isPropAccount) {
    await ensurePropChallengeLineageForAccount(accountId);
  }

  await db
    .update(platformConnection)
    .set({ accountId, updatedAt: new Date() })
    .where(eq(platformConnection.id, connectionId));

  return {
    connection,
    accountId,
    platform,
  };
}

export async function upsertBrokerSession(
  connectionId: string,
  accountId: string,
  platform: MtPlatform,
  session: Mt5SyncFrameInput["session"] | undefined
) {
  if (!session) {
    return;
  }

  await db
    .insert(brokerSession)
    .values({
      connectionId,
      accountId,
      platform,
      workerHostId: session.workerHostId ?? null,
      sessionKey: session.sessionKey ?? null,
      status: session.status ?? "syncing",
      heartbeatAt: session.heartbeatAt
        ? parseDate(session.heartbeatAt)
        : new Date(),
      lastLoginAt: session.lastLoginAt ? parseDate(session.lastLoginAt) : null,
      lastError: session.lastError ?? null,
      meta: session.meta ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: brokerSession.connectionId,
      set: {
        accountId,
        workerHostId: session.workerHostId ?? null,
        sessionKey: session.sessionKey ?? null,
        status: session.status ?? "syncing",
        heartbeatAt: session.heartbeatAt
          ? parseDate(session.heartbeatAt)
          : new Date(),
        lastLoginAt: session.lastLoginAt
          ? parseDate(session.lastLoginAt)
          : null,
        lastError: session.lastError ?? null,
        meta: session.meta ?? null,
        updatedAt: new Date(),
      },
    });
}

export async function projectAccountSnapshot(
  connectionId: string,
  accountId: string,
  platform: MtPlatform,
  account: Mt5SyncFrameInput["account"]
) {
  const snapshotTime = parseDate(account.snapshotTime);

  await db.insert(brokerAccountSnapshot).values({
    connectionId,
    accountId,
    platform,
    login: null,
    serverName: null,
    brokerName: account.brokerName,
    currency: account.currency.toUpperCase().slice(0, 16),
    leverage: account.leverage ?? null,
    balance: account.balance.toString(),
    equity: account.equity.toString(),
    margin: toDecimal(account.margin),
    freeMargin: toDecimal(account.freeMargin),
    marginLevel: toDecimal(account.marginLevel),
    snapshotTime,
    rawPayload: account.rawPayload ?? null,
  });

  const dateKey = snapshotTime.toISOString().split("T")[0];

  await db
    .insert(equitySnapshot)
    .values({
      accountId,
      snapshotDate: dateKey,
      balance: account.balance.toString(),
      equity: account.equity.toString(),
      source: "api",
      updatedAt: snapshotTime,
    })
    .onConflictDoUpdate({
      target: [equitySnapshot.accountId, equitySnapshot.snapshotDate],
      set: {
        balance: account.balance.toString(),
        equity: account.equity.toString(),
        source: "api",
        updatedAt: snapshotTime,
      },
    });
}

export async function projectPriceSnapshots(
  userId: string,
  accountId: string,
  priceSnapshots: Mt5SyncFrameInput["priceSnapshots"]
) {
  if (priceSnapshots.length === 0) {
    return {
      priceSnapshotsInserted: 0,
    };
  }

  try {
    const result = await insertHistoricalPriceSnapshots({
      userId,
      accountId,
      snapshots: priceSnapshots,
    });

    return {
      priceSnapshotsInserted: result.inserted,
    };
  } catch (error) {
    console.error(
      `[mt5] price snapshot persistence failed for account ${accountId}`,
      error
    );
    return {
      priceSnapshotsInserted: 0,
    };
  }
}

export async function projectSymbolSpecs(
  connectionId: string,
  accountId: string,
  platform: MtPlatform,
  symbolSpecs: Mt5SyncFrameInput["symbolSpecs"]
) {
  if (symbolSpecs.length === 0) {
    return {
      symbolSpecsInserted: 0,
      symbolSpecsBySymbol: new Map<string, Mt5SymbolSpec>(),
    };
  }

  const deduped = new Map<string, Mt5SymbolSpec>();
  for (const symbolSpec of symbolSpecs) {
    const normalized = normalizeBrokerSymbol(symbolSpec.symbol);
    const existing = deduped.get(normalized);
    if (!existing || existing.snapshotTime <= symbolSpec.snapshotTime) {
      deduped.set(normalized, {
        ...symbolSpec,
        symbol: normalized,
        canonicalSymbol: symbolSpec.canonicalSymbol
          ? normalizeBrokerSymbol(symbolSpec.canonicalSymbol)
          : canonicalizeBrokerSymbol(symbolSpec.symbol),
      });
    }
  }

  const values = [...deduped.values()].map((symbolSpec) => ({
    connectionId,
    accountId,
    platform,
    symbol: normalizeBrokerSymbol(symbolSpec.symbol),
    canonicalSymbol: symbolSpec.canonicalSymbol
      ? normalizeBrokerSymbol(symbolSpec.canonicalSymbol)
      : canonicalizeBrokerSymbol(symbolSpec.symbol),
    digits: symbolSpec.digits ?? null,
    pointSize: toDecimal(symbolSpec.pointSize),
    tickSize: toDecimal(symbolSpec.tickSize),
    contractSize: toDecimal(symbolSpec.contractSize),
    pipSize: toDecimal(
      resolveBrokerPipSize(symbolSpec.symbol, symbolSpec as MtSymbolSpecLike)
    ),
    spreadPoints: symbolSpec.spreadPoints ?? null,
    spreadFloat: symbolSpec.spreadFloat ?? null,
    currencyBase: symbolSpec.currencyBase ?? null,
    currencyProfit: symbolSpec.currencyProfit ?? null,
    currencyMargin: symbolSpec.currencyMargin ?? null,
    path: symbolSpec.path ?? null,
    snapshotTime: parseDate(symbolSpec.snapshotTime),
    rawPayload: symbolSpec.rawPayload ?? null,
    ingestedAt: new Date(),
  }));

  for (const value of values) {
    await db
      .insert(brokerSymbolSpec)
      .values({
        id: crypto.randomUUID(),
        ...value,
      })
      .onConflictDoUpdate({
        target: [
          brokerSymbolSpec.platform,
          brokerSymbolSpec.accountId,
          brokerSymbolSpec.symbol,
        ],
        set: {
          connectionId: value.connectionId,
          canonicalSymbol: value.canonicalSymbol,
          digits: value.digits,
          pointSize: value.pointSize,
          tickSize: value.tickSize,
          contractSize: value.contractSize,
          pipSize: value.pipSize,
          spreadPoints: value.spreadPoints,
          spreadFloat: value.spreadFloat,
          currencyBase: value.currencyBase,
          currencyProfit: value.currencyProfit,
          currencyMargin: value.currencyMargin,
          path: value.path,
          snapshotTime: value.snapshotTime,
          rawPayload: value.rawPayload,
          ingestedAt: value.ingestedAt,
        },
      });
  }

  return {
    symbolSpecsInserted: values.length,
    symbolSpecsBySymbol: buildSymbolSpecMap([...deduped.values()]),
  };
}

export async function projectOpenPositions(
  connectionId: string,
  accountId: string,
  platform: MtPlatform,
  positions: Mt5SyncFrameInput["positions"],
  snapshotTime: Date,
  executionContextsByTradeKey: Map<string, Mt5ExecutionContext>
) {
  const existingOpenTrades = await db.query.openTrade.findMany({
    where: eq(openTrade.accountId, accountId),
  });
  const existingTickets = new Set(
    existingOpenTrades.map((openPosition) => openPosition.ticket)
  );
  const existingOpenTradeByTicket = new Map(
    existingOpenTrades.map((openPosition) => [
      openPosition.ticket,
      openPosition,
    ])
  );
  const openedPositions: OpenedPositionSeed[] = [];
  const modifiedPositions: ModifiedPositionSeed[] = [];

  if (positions.length > 0) {
    const positionIds = positions.map((position) => position.remotePositionId);
    const dealRows = await db.query.brokerDealEvent.findMany({
      where: and(
        eq(brokerDealEvent.accountId, accountId),
        inArray(brokerDealEvent.positionId, positionIds)
      ),
    });
    const remoteOrderIds = [
      ...new Set(
        dealRows
          .map((row) => row.remoteOrderId)
          .filter((value): value is string => Boolean(value))
      ),
    ];
    const orderRows = await db.query.brokerOrderEvent.findMany({
      where: and(
        eq(brokerOrderEvent.accountId, accountId),
        remoteOrderIds.length > 0
          ? or(
              inArray(brokerOrderEvent.positionId, positionIds),
              inArray(brokerOrderEvent.remoteOrderId, remoteOrderIds)
            )
          : inArray(brokerOrderEvent.positionId, positionIds)
      ),
    });
    const dealRowsByPosition = new Map<string, typeof dealRows>();
    for (const row of dealRows) {
      if (!row.positionId) {
        continue;
      }

      const bucket = dealRowsByPosition.get(row.positionId) ?? [];
      bucket.push(row);
      dealRowsByPosition.set(row.positionId, bucket);
    }
    const orderRowsByPosition = new Map<string, typeof orderRows>();
    for (const row of orderRows) {
      if (!row.positionId) {
        continue;
      }

      const bucket = orderRowsByPosition.get(row.positionId) ?? [];
      bucket.push(row);
      orderRowsByPosition.set(row.positionId, bucket);
    }

    await db.insert(brokerPositionSnapshot).values(
      positions.map((position) => ({
        connectionId,
        accountId,
        platform,
        remotePositionId: position.remotePositionId,
        side: position.side,
        symbol: position.symbol.toUpperCase(),
        volume: position.volume.toString(),
        openPrice: position.openPrice.toString(),
        currentPrice: toDecimal(position.currentPrice),
        profit: toDecimal(position.profit),
        swap: toDecimal(position.swap),
        commission: toDecimal(position.commission),
        sl: toDecimal(position.sl),
        tp: toDecimal(position.tp),
        comment: position.comment ?? null,
        magicNumber: position.magicNumber ?? null,
        snapshotTime: position.snapshotTime
          ? parseDate(position.snapshotTime)
          : snapshotTime,
        rawPayload: position.rawPayload ?? null,
      }))
    );

    const tickets = positions.map((position) => position.remotePositionId);
    const activeTicketSet = new Set(tickets);
    const removedTradeKeys = [...existingTickets].filter(
      (ticket) => !activeTicketSet.has(ticket)
    );
    const removedOpenTrades = removedTradeKeys
      .map((ticket) => existingOpenTradeByTicket.get(ticket))
      .filter((row): row is NonNullable<(typeof existingOpenTrades)[number]> =>
        Boolean(row)
      );

    for (const position of positions) {
      const tradeKey = position.remotePositionId;
      const existingOpenTrade = existingOpenTradeByTicket.get(tradeKey) ?? null;
      const nextSl = toDecimal(position.sl);
      const nextTp = toDecimal(position.tp);

      if (!existingOpenTrade) {
        openedPositions.push({
          ticket: tradeKey,
          symbol: position.symbol.toUpperCase(),
          tradeType: position.side,
          volume: position.volume,
          openPrice: position.openPrice,
          openTime: parseDate(position.openTime),
          sl: position.sl ?? null,
          tp: position.tp ?? null,
          comment: position.comment ?? null,
          magicNumber: position.magicNumber ?? null,
        });
      } else if (
        existingOpenTrade.sl !== nextSl ||
        existingOpenTrade.tp !== nextTp
      ) {
        modifiedPositions.push({
          ticket: tradeKey,
          newSl: position.sl ?? null,
          newTp: position.tp ?? null,
          comment: position.comment ?? null,
          magicNumber: position.magicNumber ?? null,
        });
      }

      const executionContext =
        executionContextsByTradeKey.get(tradeKey) ?? null;
      const tradeMetrics = buildTradeLifecycleMetrics({
        tradeKey,
        tradeType: normalizeTradeSide(position.side),
        dealRows: (dealRowsByPosition.get(position.remotePositionId) ?? []).map(
          (row) => ({
            remoteDealId: row.remoteDealId,
            remoteOrderId: row.remoteOrderId ?? null,
            positionId: row.positionId ?? null,
            entryType: row.entryType ?? null,
            eventTime: row.eventTime,
            volume: row.volume,
            rawPayload: row.rawPayload ?? null,
          })
        ),
        orderRows: (
          orderRowsByPosition.get(position.remotePositionId) ?? []
        ).map((row) => ({
          remoteOrderId: row.remoteOrderId,
          positionId: row.positionId ?? null,
          state: row.state ?? null,
          orderType: row.orderType ?? null,
          sl: row.sl,
          tp: row.tp,
          rawPayload: row.rawPayload ?? null,
          eventTime: row.eventTime,
        })),
      });
      const { sessionTag, sessionTagColor } = deriveSessionTagAt(
        parseDate(position.openTime)
      );
      const record = {
        id: crypto.randomUUID(),
        accountId,
        ticket: tradeKey,
        symbol: position.symbol.toUpperCase(),
        tradeType: normalizeTradeSide(position.side),
        volume: position.volume.toString(),
        openPrice: position.openPrice.toString(),
        openTime: parseDate(position.openTime),
        sl: nextSl,
        tp: nextTp,
        currentPrice: toDecimal(position.currentPrice),
        swap: toDecimal(position.swap) ?? "0",
        commission: toDecimal(position.commission) ?? "0",
        profit: toDecimal(position.profit) ?? "0",
        sessionTag: sessionTag ?? undefined,
        sessionTagColor,
        slModCount: tradeMetrics.slModCount,
        tpModCount: tradeMetrics.tpModCount,
        partialCloseCount: tradeMetrics.partialCloseCount,
        entryDealCount: tradeMetrics.entryDealCount,
        exitDealCount: tradeMetrics.exitDealCount,
        entryVolume: tradeMetrics.entryVolume.toString(),
        exitVolume: tradeMetrics.exitVolume.toString(),
        scaleInCount: tradeMetrics.scaleInCount,
        scaleOutCount: tradeMetrics.scaleOutCount,
        trailingStopDetected: tradeMetrics.trailingStopDetected,
        comment: position.comment ?? null,
        magicNumber: position.magicNumber ?? null,
        brokerMeta:
          position.rawPayload && typeof position.rawPayload === "object"
            ? mergeBrokerMetaExecutionContext(
                {
                  ...(tradeMetrics.brokerMeta ?? {}),
                  platform,
                  positionId: position.remotePositionId,
                  magicNumber: position.magicNumber ?? null,
                  sessionTag,
                  sessionTagColor,
                  raw: position.rawPayload,
                },
                executionContext
              )
            : mergeBrokerMetaExecutionContext(
                tradeMetrics.brokerMeta as Record<string, unknown> | null,
                executionContext
              ),
        lastUpdatedAt: position.snapshotTime
          ? parseDate(position.snapshotTime)
          : snapshotTime,
        createdAt: new Date(),
      };

      await db
        .insert(openTrade)
        .values(record)
        .onConflictDoUpdate({
          target: [openTrade.accountId, openTrade.ticket],
          set: {
            symbol: record.symbol,
            tradeType: record.tradeType,
            volume: record.volume,
            openPrice: record.openPrice,
            openTime: record.openTime,
            sl: record.sl,
            tp: record.tp,
            currentPrice: record.currentPrice,
            swap: record.swap,
            commission: record.commission,
            profit: record.profit,
            sessionTag: record.sessionTag,
            sessionTagColor: record.sessionTagColor,
            slModCount: record.slModCount,
            tpModCount: record.tpModCount,
            partialCloseCount: record.partialCloseCount,
            entryDealCount: record.entryDealCount,
            exitDealCount: record.exitDealCount,
            entryVolume: record.entryVolume,
            exitVolume: record.exitVolume,
            scaleInCount: record.scaleInCount,
            scaleOutCount: record.scaleOutCount,
            trailingStopDetected: record.trailingStopDetected,
            comment: record.comment,
            magicNumber: record.magicNumber,
            brokerMeta: record.brokerMeta,
            lastUpdatedAt: record.lastUpdatedAt,
          },
        });
    }

    await db
      .delete(openTrade)
      .where(
        and(
          eq(openTrade.accountId, accountId),
          notInArray(openTrade.ticket, tickets)
        )
      );

    return {
      openPositionsUpserted: positions.length,
      openedPositions,
      modifiedPositions,
      removedTradeKeys,
      removedOpenTrades,
    };
  }

  const removedOpenTrades = existingOpenTrades;
  await db.delete(openTrade).where(eq(openTrade.accountId, accountId));
  return {
    openPositionsUpserted: 0,
    openedPositions,
    modifiedPositions,
    removedTradeKeys: [...existingTickets],
    removedOpenTrades,
  };
}

export async function insertDealEvents(
  connectionId: string,
  accountId: string,
  platform: MtPlatform,
  deals: Mt5SyncFrameInput["deals"],
  reconcileMode: "incremental" | "full-reconcile" = "incremental"
) {
  let inserted = 0;
  const affectedTradeKeys = new Set<string>();
  const shouldRefreshExisting = reconcileMode === "full-reconcile";

  for (const deal of deals) {
    const values = {
      connectionId,
      accountId,
      platform,
      remoteDealId: deal.remoteDealId,
      remoteOrderId: deal.remoteOrderId ?? null,
      positionId: deal.positionId ?? null,
      entryType: deal.entryType,
      side: deal.side,
      symbol: deal.symbol.toUpperCase(),
      volume: deal.volume.toString(),
      price: deal.price.toString(),
      profit: toDecimal(deal.profit),
      commission: toDecimal(deal.commission),
      swap: toDecimal(deal.swap),
      fee: toDecimal(deal.fee),
      sl: toDecimal(deal.sl),
      tp: toDecimal(deal.tp),
      comment: deal.comment ?? null,
      rawPayload: deal.rawPayload ?? null,
      eventTime: parseDate(deal.eventTime),
    };

    const query = db.insert(brokerDealEvent).values(values);
    const result = shouldRefreshExisting
      ? await query
          .onConflictDoUpdate({
            target: [
              brokerDealEvent.platform,
              brokerDealEvent.accountId,
              brokerDealEvent.remoteDealId,
            ],
            set: {
              remoteOrderId: values.remoteOrderId,
              positionId: values.positionId,
              entryType: values.entryType,
              side: values.side,
              symbol: values.symbol,
              volume: values.volume,
              price: values.price,
              profit: values.profit,
              commission: values.commission,
              swap: values.swap,
              fee: values.fee,
              sl: values.sl,
              tp: values.tp,
              comment: values.comment,
              rawPayload: values.rawPayload,
              eventTime: values.eventTime,
            },
          })
          .returning({ id: brokerDealEvent.id })
      : await query.onConflictDoNothing().returning({ id: brokerDealEvent.id });

    if (result.length > 0) {
      inserted += 1;
      affectedTradeKeys.add(
        getTradeKey({
          positionId: deal.positionId ?? null,
          remoteOrderId: deal.remoteOrderId ?? null,
          remoteDealId: deal.remoteDealId,
        })
      );
    }
  }

  return {
    dealEventsInserted: inserted,
    affectedTradeKeys: [...affectedTradeKeys],
  };
}

export async function insertOrderEvents(
  connectionId: string,
  accountId: string,
  platform: MtPlatform,
  orders: Mt5SyncFrameInput["orders"],
  reconcileMode: "incremental" | "full-reconcile" = "incremental"
) {
  let inserted = 0;
  const affectedTradeKeys = new Set<string>();
  const shouldRefreshExisting = reconcileMode === "full-reconcile";

  for (const order of orders) {
    const values = {
      connectionId,
      accountId,
      platform,
      eventKey: order.eventKey,
      remoteOrderId: order.remoteOrderId,
      positionId: order.positionId ?? null,
      side: order.side ?? null,
      orderType: order.orderType ?? null,
      state: order.state ?? null,
      symbol: order.symbol?.toUpperCase() ?? null,
      requestedVolume: toDecimal(order.requestedVolume),
      filledVolume: toDecimal(order.filledVolume),
      price: toDecimal(order.price),
      sl: toDecimal(order.sl),
      tp: toDecimal(order.tp),
      comment: order.comment ?? null,
      rawPayload: order.rawPayload ?? null,
      eventTime: parseDate(order.eventTime),
    };

    const query = db.insert(brokerOrderEvent).values(values);
    const result = shouldRefreshExisting
      ? await query
          .onConflictDoUpdate({
            target: [
              brokerOrderEvent.platform,
              brokerOrderEvent.accountId,
              brokerOrderEvent.eventKey,
            ],
            set: {
              remoteOrderId: values.remoteOrderId,
              positionId: values.positionId,
              side: values.side,
              orderType: values.orderType,
              state: values.state,
              symbol: values.symbol,
              requestedVolume: values.requestedVolume,
              filledVolume: values.filledVolume,
              price: values.price,
              sl: values.sl,
              tp: values.tp,
              comment: values.comment,
              rawPayload: values.rawPayload,
              eventTime: values.eventTime,
            },
          })
          .returning({ id: brokerOrderEvent.id })
      : await query
          .onConflictDoNothing()
          .returning({ id: brokerOrderEvent.id });

    if (result.length > 0) {
      inserted += 1;
      affectedTradeKeys.add(
        getOrderTradeKey({
          positionId: order.positionId ?? null,
          remoteOrderId: order.remoteOrderId,
        })
      );
    }
  }

  return {
    orderEventsInserted: inserted,
    affectedTradeKeys: [...affectedTradeKeys],
  };
}

export async function insertLedgerEvents(
  connectionId: string,
  accountId: string,
  platform: MtPlatform,
  ledgerEvents: Mt5SyncFrameInput["ledgerEvents"],
  reconcileMode: "incremental" | "full-reconcile" = "incremental"
) {
  let inserted = 0;
  const shouldRefreshExisting = reconcileMode === "full-reconcile";

  for (const event of ledgerEvents) {
    const values = {
      connectionId,
      accountId,
      platform,
      remoteDealId: event.remoteDealId,
      remoteOrderId: event.remoteOrderId ?? null,
      positionId: event.positionId ?? null,
      ledgerType: event.ledgerType ?? null,
      amount: event.amount.toString(),
      commission: toDecimal(event.commission),
      swap: toDecimal(event.swap),
      fee: toDecimal(event.fee),
      comment: event.comment ?? null,
      rawPayload: event.rawPayload ?? null,
      eventTime: parseDate(event.eventTime),
    };

    const query = db.insert(brokerLedgerEvent).values(values);
    const result = shouldRefreshExisting
      ? await query
          .onConflictDoUpdate({
            target: [
              brokerLedgerEvent.platform,
              brokerLedgerEvent.accountId,
              brokerLedgerEvent.remoteDealId,
            ],
            set: {
              remoteOrderId: values.remoteOrderId,
              positionId: values.positionId,
              ledgerType: values.ledgerType,
              amount: values.amount,
              commission: values.commission,
              swap: values.swap,
              fee: values.fee,
              comment: values.comment,
              rawPayload: values.rawPayload,
              eventTime: values.eventTime,
            },
          })
          .returning({ id: brokerLedgerEvent.id })
      : await query
          .onConflictDoNothing()
          .returning({ id: brokerLedgerEvent.id });

    if (result.length > 0) {
      inserted += 1;
    }
  }

  return {
    ledgerEventsInserted: inserted,
  };
}
