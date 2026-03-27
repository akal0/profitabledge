/**
 * Platform Connections Router
 *
 * Manages external trading platform connections:
 * - OAuth flow (cTrader)
 * - Credential-based connections (Match-Trader, TradeLocker)
 * - Manual sync triggers
 * - Sync history logs
 * - Equity snapshots for charts
 */
import { z } from "zod";
import { router, protectedProcedure } from "../lib/trpc";
import { db } from "../db";
import {
  platformConnection,
  equitySnapshot,
  syncLog,
} from "../db/schema/connections";
import {
  brokerDealEvent,
  brokerOrderEvent,
  brokerSession,
  brokerSyncCheckpoint,
} from "../db/schema/mt5-sync";
import { openTrade, tradingAccount } from "../db/schema/trading";
import { eq, and, desc, gte, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { encryptCredentials } from "../lib/providers/credential-cipher";
import {
  getProvider,
  getSupportedProviders,
  PROVIDER_INFO,
} from "../lib/providers/registry";
import { resolveUniqueConnectionDisplayName } from "../lib/connections/display-name";
import { sanitizeConnectionMeta } from "../lib/connections/sanitize-meta";
import { syncConnection } from "../lib/providers/sync-engine";
import { getSyncSchedulerStatus } from "../lib/providers/sync-scheduler";
import { getCTraderAuthUrl } from "../lib/providers/ctrader";
import { getTradovateAuthUrl } from "../lib/providers/tradovate";
import { createMtTerminalConnection } from "../lib/mt5/worker-control";
import { isMtTerminalProvider } from "../lib/mt5/constants";
import { buildMtConnectionCompleteness } from "../lib/mt5/completeness";
import {
  buildMt5LiveLeaseHolder,
  getMt5LiveLeaseHolder,
  normalizeMt5LiveLeaseRoute,
  shouldRenewMt5LiveLease,
} from "../lib/mt5/live-lease";
import { withMt5ForceSyncRequest } from "../lib/mt5/queue-state";
import {
  isMtWorkerHostSnapshotFresh,
  listMtWorkerHostSnapshots,
} from "../lib/mt5/host-status";
import { createNotification } from "../lib/notifications";
import { assertAlphaFeatureEnabled } from "../lib/ops/alpha-runtime";
import {
  ensureActivationMilestone,
  recordAppEvent,
  recordOperationalError,
} from "../lib/ops/event-log";
import { createOAuthConnection } from "../lib/connections/oauth";
import type { ProviderAuthorizedAccount } from "../lib/providers/types";

const credentialsSchema = z.record(z.string(), z.string());
const connectionMetaSchema = z
  .record(z.string(), z.unknown())
  .optional()
  .default({});

async function createConnectionSettingsNotification(input: {
  userId: string;
  title: string;
  body: string;
  connectionId: string;
  provider: string;
  displayName: string;
  accountId?: string | null;
  accountName?: string | null;
  updatedFields?: string[];
}) {
  try {
    await createNotification({
      userId: input.userId,
      accountId: input.accountId ?? null,
      type: "settings_updated",
      title: input.title,
      body: input.body,
      metadata: {
        connectionId: input.connectionId,
        provider: input.provider,
        displayName: input.displayName,
        accountId: input.accountId ?? null,
        accountName: input.accountName ?? null,
        updatedFields: input.updatedFields ?? [],
        url: "/dashboard/settings/connections",
      },
    });
  } catch (error) {
    console.error("[Connections] Notification failed:", error);
  }
}

function getDiscoveredProviderAccounts(
  meta: unknown
): ProviderAuthorizedAccount[] {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return [];
  }

  const rows = (meta as Record<string, unknown>).discoveredAccounts;
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === "object" && !Array.isArray(row)
    )
    .map((row) => {
      const environment: ProviderAuthorizedAccount["environment"] =
        row.environment === "live" || row.environment === "demo"
          ? row.environment
          : "unknown";

      return {
        providerAccountId: String(row.providerAccountId ?? ""),
        accountNumber:
          row.accountNumber != null ? String(row.accountNumber) : null,
        label: row.label != null ? String(row.label) : null,
        brokerName: row.brokerName != null ? String(row.brokerName) : null,
        currency: row.currency != null ? String(row.currency) : null,
        environment,
        metadata:
          row.metadata &&
          typeof row.metadata === "object" &&
          !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : undefined,
      };
    })
    .filter((row) => row.providerAccountId.length > 0);
}

function normalizeAccountIdentifier(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.toLowerCase();
}

function chooseDiscoveredProviderAccount(input: {
  provider: string;
  discoveredAccounts: ProviderAuthorizedAccount[];
  accountNumber: string | null;
}) {
  if (input.discoveredAccounts.length === 0) {
    return null;
  }

  if (input.discoveredAccounts.length === 1) {
    return input.discoveredAccounts[0] ?? null;
  }

  const normalizedAccountNumber = normalizeAccountIdentifier(input.accountNumber);
  if (!normalizedAccountNumber) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `This ${input.provider} connection has multiple broker accounts. Add an account number to the selected trading account before linking it.`,
    });
  }

  const exactMatch =
    input.discoveredAccounts.find((candidate) => {
      return (
        normalizeAccountIdentifier(candidate.accountNumber) ===
        normalizedAccountNumber
      );
    }) ?? null;

  if (exactMatch) {
    return exactMatch;
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `Could not match trading account ${input.accountNumber} to any ${input.provider} broker account on this connection.`,
  });
}

function resolveConnectionLinkMeta(input: {
  provider: string;
  currentMeta: unknown;
  accountNumber: string | null;
}) {
  const currentMeta =
    input.currentMeta &&
    typeof input.currentMeta === "object" &&
    !Array.isArray(input.currentMeta)
      ? { ...(input.currentMeta as Record<string, unknown>) }
      : {};
  const discoveredAccounts = getDiscoveredProviderAccounts(currentMeta);

  if (input.provider !== "ctrader" && input.provider !== "tradovate") {
    return currentMeta;
  }

  const selectedAccount = chooseDiscoveredProviderAccount({
    provider: input.provider,
    discoveredAccounts,
    accountNumber: input.accountNumber,
  });

  if (!selectedAccount) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `No broker accounts were discovered for this ${input.provider} connection. Reconnect it and try again.`,
    });
  }

  if (input.provider === "ctrader") {
    currentMeta.ctraderAccountId = selectedAccount.providerAccountId;
  }

  if (input.provider === "tradovate") {
    currentMeta.tradovateAccountId = selectedAccount.providerAccountId;
  }

  currentMeta.brokerName = selectedAccount.brokerName ?? currentMeta.brokerName;
  currentMeta.currency = selectedAccount.currency ?? currentMeta.currency;
  currentMeta.selectedProviderAccount = {
    providerAccountId: selectedAccount.providerAccountId,
    accountNumber: selectedAccount.accountNumber,
    label: selectedAccount.label,
    environment: selectedAccount.environment,
  };

  return sanitizeConnectionMeta(currentMeta);
}

export const connectionsRouter = router({
  /** List all connections for the current user. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.query.platformConnection.findMany({
      where: eq(platformConnection.userId, ctx.session.user.id),
      orderBy: desc(platformConnection.createdAt),
    });
    // Strip encrypted credentials from response
    return rows.map(({ encryptedCredentials: _, credentialIv: __, ...safe }) => ({
      ...safe,
      meta: sanitizeConnectionMeta(
        safe.meta && typeof safe.meta === "object"
          ? (safe.meta as Record<string, unknown>)
          : null
      ),
    }));
  }),

  getSyncRuntimeStatus: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.query.platformConnection.findMany({
      where: eq(platformConnection.userId, ctx.session.user.id),
      orderBy: desc(platformConnection.updatedAt),
    });
    const scheduledConnections = rows.filter(
      (connection) =>
        !isMtTerminalProvider(connection.provider) &&
        (connection.syncIntervalMinutes ?? 0) > 0
    );
    const now = Date.now();
    const dueNowCount = scheduledConnections.filter((connection) => {
      if (connection.isPaused) {
        return false;
      }

      if (!connection.lastSyncSuccessAt) {
        return true;
      }

      return (
        connection.lastSyncSuccessAt.getTime() <
        now - (connection.syncIntervalMinutes ?? 0) * 60_000
      );
    }).length;
    const connectionIds = scheduledConnections.map((connection) => connection.id);
    const recentLogs =
      connectionIds.length > 0
        ? await db.query.syncLog.findMany({
            where: inArray(syncLog.connectionId, connectionIds),
            orderBy: desc(syncLog.createdAt),
            limit: 5,
          })
        : [];

    return {
      scheduler: getSyncSchedulerStatus(),
      summary: {
        scheduledCount: scheduledConnections.length,
        activeCount: scheduledConnections.filter(
          (connection) => !connection.isPaused
        ).length,
        pausedCount: scheduledConnections.filter(
          (connection) => connection.isPaused
        ).length,
        errorCount: scheduledConnections.filter(
          (connection) => connection.status === "error"
        ).length,
        dueNowCount,
      },
      recentRuns: recentLogs.map((row) => ({
        id: row.id,
        connectionId: row.connectionId,
        status: row.status,
        tradesInserted: row.tradesInserted,
        errorMessage: row.errorMessage,
        durationMs: row.durationMs,
        createdAt: row.createdAt,
      })),
    };
  }),

  /** Read-only MT terminal supervisor status for the current user's terminal connections. */
  getMtSupervisorStatus: protectedProcedure.query(async ({ ctx }) => {
    const allConnections = await db.query.platformConnection.findMany({
      where: eq(platformConnection.userId, ctx.session.user.id),
      orderBy: desc(platformConnection.createdAt),
    });
    const terminalConnections = allConnections.filter((connection) =>
      isMtTerminalProvider(connection.provider)
    );

    const connectionById = new Map(
      terminalConnections.map((connection) => [connection.id, connection])
    );
    const visibleConnectionIds = new Set(connectionById.keys());
    const sessionRows =
      terminalConnections.length > 0
        ? await db.query.brokerSession.findMany({
            where: inArray(
              brokerSession.connectionId,
              terminalConnections.map((connection) => connection.id)
            ),
            orderBy: desc(brokerSession.updatedAt),
          })
        : [];
    const sessionByConnectionId = new Map(
      sessionRows.map((session) => [session.connectionId, session])
    );
    const checkpointRows =
      terminalConnections.length > 0
        ? await db.query.brokerSyncCheckpoint.findMany({
            where: inArray(
              brokerSyncCheckpoint.connectionId,
              terminalConnections.map((connection) => connection.id)
            ),
          })
        : [];
    const checkpointByConnectionId = new Map(
      checkpointRows.map((checkpoint) => [checkpoint.connectionId, checkpoint])
    );
    const accountIds = [...new Set(
      [
        ...terminalConnections
          .map((connection) => connection.accountId)
          .filter((value): value is string => Boolean(value)),
        ...sessionRows
          .map((session) => session.accountId)
          .filter((value): value is string => Boolean(value)),
      ]
    )];
    const openTradeRows =
      accountIds.length > 0
        ? await db.query.openTrade.findMany({
            where: inArray(openTrade.accountId, accountIds),
            columns: {
              accountId: true,
              ticket: true,
              tradeType: true,
            },
          })
        : [];
    const openTradesByAccountId = new Map<string, typeof openTradeRows>();
    for (const openTradeRow of openTradeRows) {
      const bucket = openTradesByAccountId.get(openTradeRow.accountId) ?? [];
      bucket.push(openTradeRow);
      openTradesByAccountId.set(openTradeRow.accountId, bucket);
    }
    const dealRows =
      terminalConnections.length > 0
        ? await db.query.brokerDealEvent.findMany({
            where: inArray(
              brokerDealEvent.connectionId,
              terminalConnections.map((connection) => connection.id)
            ),
            columns: {
              connectionId: true,
              remoteDealId: true,
              remoteOrderId: true,
              positionId: true,
              entryType: true,
              side: true,
              eventTime: true,
            },
          })
        : [];
    const orderRows =
      terminalConnections.length > 0
        ? await db.query.brokerOrderEvent.findMany({
            where: inArray(
              brokerOrderEvent.connectionId,
              terminalConnections.map((connection) => connection.id)
            ),
            columns: {
              connectionId: true,
              remoteOrderId: true,
              positionId: true,
              side: true,
              eventTime: true,
            },
          })
        : [];
    const dealRowsByConnectionId = new Map<string, typeof dealRows>();
    for (const dealRow of dealRows) {
      const bucket = dealRowsByConnectionId.get(dealRow.connectionId) ?? [];
      bucket.push(dealRow);
      dealRowsByConnectionId.set(dealRow.connectionId, bucket);
    }
    const orderRowsByConnectionId = new Map<string, typeof orderRows>();
    for (const orderRow of orderRows) {
      const bucket = orderRowsByConnectionId.get(orderRow.connectionId) ?? [];
      bucket.push(orderRow);
      orderRowsByConnectionId.set(orderRow.connectionId, bucket);
    }

    const buildCompleteness = (connectionId: string, accountId: string | null) => {
      const checkpoint = checkpointByConnectionId.get(connectionId) ?? null;
      const scopedDeals = dealRowsByConnectionId.get(connectionId) ?? [];
      const scopedOrders = orderRowsByConnectionId.get(connectionId) ?? [];
      const scopedOpenTrades = accountId
        ? openTradesByAccountId.get(accountId) ?? []
        : [];
      return buildMtConnectionCompleteness({
        checkpoint,
        deals: scopedDeals,
        orders: scopedOrders,
        openTrades: scopedOpenTrades,
      });
    };

    try {
      const hostSnapshots = await listMtWorkerHostSnapshots();
      const freshHostSnapshots = hostSnapshots.filter(({ row }) =>
        isMtWorkerHostSnapshotFresh(row.lastSeenAt)
      );
      const relevantHosts =
        terminalConnections.length > 0
          ? freshHostSnapshots.filter(({ snapshot }) =>
              snapshot.workers.some(
                (worker) =>
                  sessionRows.some(
                    (session) => session.workerHostId === worker.workerId
                  ) ||
                  worker.activeConnections.some((connection) =>
                    visibleConnectionIds.has(connection.connectionId)
                  )
              )
            )
          : freshHostSnapshots;

      const workers = relevantHosts.flatMap(({ snapshot }) =>
        snapshot.workers
          .map((worker) => ({
            slot: worker.slot,
            workerId: worker.workerId,
            hostId: snapshot.workerHostId,
            hostLabel: snapshot.host?.label ?? snapshot.workerHostId,
            hostEnvironment: snapshot.host?.environment ?? null,
            hostProvider: snapshot.host?.provider ?? null,
            hostRegion: snapshot.host?.region ?? null,
            pid: worker.pid ?? null,
            alive: worker.alive,
            healthy: worker.healthy,
            startedAt: worker.startedAt ?? null,
            restartCount: worker.restartCount,
            lastExitCode: worker.lastExitCode ?? null,
            lastExitAt: worker.lastExitAt ?? null,
            lastStartError: worker.lastStartError ?? null,
            nextRestartAt: worker.nextRestartAt ?? null,
            statusFresh: worker.statusFresh,
            phase: worker.status?.phase ?? null,
            state: worker.status?.state ?? null,
            updatedAt: worker.status?.updatedAt ?? null,
            lastError: worker.status?.lastError ?? null,
            activeConnections: worker.activeConnections
              .filter((connection) => {
                if (!visibleConnectionIds.has(connection.connectionId)) {
                  return false;
                }

                const owningWorkerId =
                  sessionByConnectionId.get(connection.connectionId)?.workerHostId ??
                  null;
                return !owningWorkerId || owningWorkerId === worker.workerId;
              })
              .map((connection) => {
                const platformConnection = connectionById.get(
                  connection.connectionId
                );
                if (!platformConnection) {
                  return null;
                }

                return {
                  connectionId: connection.connectionId,
                  displayName: platformConnection.displayName,
                  provider: platformConnection.provider,
                  sessionKey: connection.sessionKey ?? null,
                  lastHeartbeatAt: connection.lastHeartbeatAt ?? null,
                  lastSyncedAt: connection.lastSyncedAt ?? null,
                  sessionMeta: connection.sessionMeta ?? {},
                  completeness: buildCompleteness(
                    connection.connectionId,
                    sessionByConnectionId.get(connection.connectionId)?.accountId ??
                      platformConnection.accountId ??
                      null
                  ),
                };
              })
              .filter((connection): connection is NonNullable<typeof connection> =>
                connection !== null
              )
          }))
          .filter(
            (worker) =>
              terminalConnections.length === 0 ||
              worker.activeConnections.length > 0 ||
              sessionRows.some((session) => session.workerHostId === worker.workerId)
          )
      );

      const sessions = sessionRows.map((session) => {
        const connection = connectionById.get(session.connectionId)!;
        const matchingWorker =
          workers.find((worker) => worker.workerId === session.workerHostId) ??
          workers.find((worker) =>
            worker.activeConnections.some(
              (activeConnection) =>
                activeConnection.connectionId === session.connectionId
            )
          );
        const sessionMeta =
          session.meta && typeof session.meta === "object"
            ? (session.meta as Record<string, unknown>)
            : {};

        const lastSyncedAt =
          typeof sessionMeta.lastSyncedAt === "string"
            ? sessionMeta.lastSyncedAt
            : matchingWorker?.activeConnections.find(
                  (activeConnection) =>
                    activeConnection.connectionId === session.connectionId
                )?.lastSyncedAt ?? null;

        return {
          connectionId: session.connectionId,
          displayName: connection.displayName,
          provider: connection.provider,
          workerId: session.workerHostId ?? "unknown",
          slot: matchingWorker?.slot ?? null,
          alive: matchingWorker?.alive ?? false,
          sessionKey: session.sessionKey ?? null,
          lastHeartbeatAt: session.heartbeatAt?.toISOString() ?? null,
          lastSyncedAt,
          sessionMeta,
          completeness: buildCompleteness(
            session.connectionId,
            session.accountId ?? connection.accountId ?? null
          ),
        };
      });

      const completenessByConnectionId = new Map(
        terminalConnections.map((connection) => [
          connection.id,
          buildCompleteness(
            connection.id,
            sessionByConnectionId.get(connection.id)?.accountId ??
              connection.accountId ??
              null
          ),
        ])
      );

      const summary =
        freshHostSnapshots.length > 0
          ? {
              ok: freshHostSnapshots.every(({ snapshot }) => snapshot.ok),
              status: freshHostSnapshots.every(({ snapshot }) => snapshot.ok)
                ? "ok"
                : "degraded",
              mode:
                freshHostSnapshots.length === 1
                  ? freshHostSnapshots[0]!.snapshot.mode
                  : `${freshHostSnapshots.length} hosts`,
              desiredChildren: freshHostSnapshots.reduce(
                (sum, { snapshot }) => sum + snapshot.desiredChildren,
                0
              ),
              runningChildren: freshHostSnapshots.reduce(
                (sum, { snapshot }) => sum + snapshot.runningChildren,
                0
              ),
              healthyChildren: freshHostSnapshots.reduce(
                (sum, { snapshot }) => sum + snapshot.healthyChildren,
                0
              ),
              hostCount: freshHostSnapshots.length,
              startedAt:
                freshHostSnapshots.length === 1
                  ? freshHostSnapshots[0]!.snapshot.startedAt ?? null
                  : null,
              updatedAt:
                freshHostSnapshots
                  .map(({ snapshot }) => snapshot.updatedAt ?? null)
                  .filter((value): value is string => Boolean(value))
                  .sort()
                  .at(-1) ?? null,
              uptimeSeconds: Math.max(
                ...freshHostSnapshots.map(
                  ({ snapshot }) => snapshot.uptimeSeconds ?? 0
                ),
                0
              ),
              adminHost:
                freshHostSnapshots.length === 1
                  ? freshHostSnapshots[0]!.snapshot.admin?.host ?? null
                  : null,
              adminPort:
                freshHostSnapshots.length === 1
                  ? freshHostSnapshots[0]!.snapshot.admin?.port ?? null
                  : null,
              historyGapConnections: [...completenessByConnectionId.values()].filter(
                (completeness) => completeness.historyGapDetected
              ).length,
              closeOrdersWithoutExitDeals: [...completenessByConnectionId.values()].reduce(
                (sum, completeness) =>
                  sum + completeness.closeOrdersWithoutExitDeals,
                0
              ),
              openPositionsMissingEntryDeals: [...completenessByConnectionId.values()].reduce(
                (sum, completeness) =>
                  sum + completeness.openPositionsMissingEntryDeals,
                0
              ),
            }
          : null;

      const hosts = freshHostSnapshots.map(({ snapshot }) => ({
        workerHostId: snapshot.workerHostId,
        label: snapshot.host?.label ?? snapshot.workerHostId,
        machineName: snapshot.host?.machineName ?? snapshot.workerHostId,
        environment: snapshot.host?.environment ?? null,
        provider: snapshot.host?.provider ?? null,
        region: snapshot.host?.region ?? null,
        regionGroup: snapshot.host?.regionGroup ?? null,
        countryCode: snapshot.host?.countryCode ?? null,
        timezone: snapshot.host?.timezone ?? null,
        status: snapshot.status,
        ok: snapshot.ok,
        mode: snapshot.mode,
        desiredChildren: snapshot.desiredChildren,
        runningChildren: snapshot.runningChildren,
        healthyChildren: snapshot.healthyChildren,
        updatedAt: snapshot.updatedAt ?? null,
      }));

      const seenSessionIds = new Set(sessions.map((session) => session.connectionId));

      return {
        available: summary !== null,
        error:
          summary !== null ? null : "No MT5 worker host reports received yet.",
        summary,
        hosts,
        workers,
        sessions,
        pendingConnections: terminalConnections
          .filter((connection) => !sessionByConnectionId.has(connection.id))
          .map((connection) => ({
            connectionId: connection.id,
            displayName: connection.displayName,
            provider: connection.provider,
            status: connection.status,
            isPaused: connection.isPaused,
            lastError: connection.lastError,
            completeness: completenessByConnectionId.get(connection.id) ?? null,
          })),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return {
        available: false,
        error: message,
        summary: null,
        hosts: [],
        workers: [],
        sessions: [],
        pendingConnections: terminalConnections.map((connection) => ({
          connectionId: connection.id,
          displayName: connection.displayName,
          provider: connection.provider,
          status: connection.status,
          isPaused: connection.isPaused,
          lastError: connection.lastError,
          completeness: buildCompleteness(
            connection.id,
            sessionByConnectionId.get(connection.id)?.accountId ??
              connection.accountId ??
              null
          ),
        })),
      };
    }
  }),

  heartbeatTerminalLeases: protectedProcedure
    .input(
      z.object({
        connectionIds: z.array(z.string()).min(1).max(12),
        leaseId: z.string().uuid(),
        route: z.string().max(160).nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertAlphaFeatureEnabled("connections");
      assertAlphaFeatureEnabled("mt5Ingestion");

      const connectionIds = [...new Set(input.connectionIds)].slice(0, 12);
      const rows = await db.query.platformConnection.findMany({
        where: and(
          eq(platformConnection.userId, ctx.session.user.id),
          inArray(platformConnection.id, connectionIds)
        ),
      });
      const terminalConnections = rows.filter((connection) =>
        isMtTerminalProvider(connection.provider)
      );

      if (terminalConnections.length === 0) {
        return { success: true, connectionIds: [] as string[] };
      }

      const now = new Date();
      const route = normalizeMt5LiveLeaseRoute(input.route);
      const renewableConnections = terminalConnections.filter(
        (connection) =>
          !connection.isPaused &&
          shouldRenewMt5LiveLease(
            getMt5LiveLeaseHolder(connection.meta, input.leaseId),
            {
              now,
              route,
            }
          )
      );

      await Promise.all(
        renewableConnections.map((connection) => {
          const holder = buildMt5LiveLeaseHolder({
            leaseId: input.leaseId,
            now,
            route,
          });

          return db
            .update(platformConnection)
            .set({
              meta: sql`jsonb_set(
                COALESCE(${platformConnection.meta}, '{}'::jsonb),
                ARRAY['mt5LiveLeases', 'holders', ${input.leaseId}]::text[],
                ${JSON.stringify(holder)}::jsonb,
                true
              )`,
            })
            .where(eq(platformConnection.id, connection.id));
        })
      );

      return {
        success: true,
        connectionIds: terminalConnections
          .filter((connection) => !connection.isPaused)
          .map((connection) => connection.id),
      };
    }),

  releaseTerminalLeases: protectedProcedure
    .input(
      z.object({
        connectionIds: z.array(z.string()).min(1).max(12),
        leaseId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertAlphaFeatureEnabled("connections");
      assertAlphaFeatureEnabled("mt5Ingestion");

      const connectionIds = [...new Set(input.connectionIds)].slice(0, 12);
      const rows = await db.query.platformConnection.findMany({
        where: and(
          eq(platformConnection.userId, ctx.session.user.id),
          inArray(platformConnection.id, connectionIds)
        ),
      });
      const terminalConnectionIds = rows
        .filter((connection) => isMtTerminalProvider(connection.provider))
        .map((connection) => connection.id);

      if (terminalConnectionIds.length === 0) {
        return { success: true, connectionIds: [] as string[] };
      }

      await Promise.all(
        terminalConnectionIds.map((connectionId) =>
          db
            .update(platformConnection)
            .set({
              meta: sql`COALESCE(${platformConnection.meta}, '{}'::jsonb) #- ARRAY['mt5LiveLeases', 'holders', ${input.leaseId}]::text[]`,
            })
            .where(eq(platformConnection.id, connectionId))
        )
      );

      return {
        success: true,
        connectionIds: terminalConnectionIds,
      };
    }),

  /** Get a single connection (must belong to user). */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const conn = await db.query.platformConnection.findFirst({
        where: and(
          eq(platformConnection.id, input.id),
          eq(platformConnection.userId, ctx.session.user.id)
        ),
      });
      if (!conn) throw new TRPCError({ code: "NOT_FOUND" });
      const { encryptedCredentials: _, credentialIv: __, ...safe } = conn;
      return {
        ...safe,
        meta: sanitizeConnectionMeta(
          safe.meta && typeof safe.meta === "object"
            ? (safe.meta as Record<string, unknown>)
            : null
        ),
      };
    }),

  /** Get supported providers and their info. */
  getProviders: protectedProcedure.query(() => {
    return {
      providers: getSupportedProviders(),
      info: PROVIDER_INFO,
    };
  }),

  /** Generate OAuth authorization URL. */
  getOAuthUrl: protectedProcedure
    .input(
      z.object({
        provider: z.enum(["ctrader", "tradovate", "topstepx"]),
      })
    )
    .query(async ({ ctx, input }) => {
      const state = Buffer.from(
        JSON.stringify({
          userId: ctx.session.user.id,
          provider: input.provider,
        })
      ).toString("base64url");

      if (input.provider === "ctrader") {
        return { url: getCTraderAuthUrl(state) };
      }

      if (input.provider === "tradovate") {
        return { url: getTradovateAuthUrl(state) };
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `OAuth not configured for provider: ${input.provider}`,
      });
    }),

  /** Complete OAuth flow — store tokens after callback. */
  completeOAuth: protectedProcedure
    .input(
      z.object({
        provider: z.string(),
        code: z.string(),
        displayName: z.string().min(1),
        meta: connectionMetaSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertAlphaFeatureEnabled("connections");
      if (input.provider !== "ctrader" && input.provider !== "tradovate") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Provider ${input.provider} does not support OAuth`,
        });
      }

      const { connection: conn } = await createOAuthConnection({
        userId: ctx.session.user.id,
        provider: input.provider,
        code: input.code,
        displayName: input.displayName,
        meta: input.meta,
      });

      await Promise.all([
        ensureActivationMilestone({
          userId: ctx.session.user.id,
          key: "account_connected",
          source: "server",
          metadata: {
            provider: conn.provider,
            connectionId: conn.id,
            mode: "oauth",
          },
        }),
        recordAppEvent({
          userId: ctx.session.user.id,
          category: "connections",
          name: "connection.oauth.completed",
          source: "server",
          summary: `${conn.displayName} connected`,
          metadata: {
            provider: conn.provider,
            connectionId: conn.id,
          },
          isUserVisible: true,
        }),
      ]);

      await createConnectionSettingsNotification({
        userId: ctx.session.user.id,
        title: "Connection added",
        body: `${conn.displayName} is connected and ready to link to a trading account.`,
        connectionId: conn.id,
        provider: conn.provider,
        displayName: conn.displayName,
        updatedFields: ["provider", "displayName"],
      });

      return { connectionId: conn.id };
    }),

  /** Create a credential-based connection. Validates creds before storing. */
  createCredential: protectedProcedure
    .input(
      z.object({
        provider: z.string(),
        displayName: z.string().min(1),
        credentials: credentialsSchema,
        meta: connectionMetaSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertAlphaFeatureEnabled("connections");
      if (isMtTerminalProvider(input.provider)) {
        assertAlphaFeatureEnabled("mt5Ingestion");
      }

      if (isMtTerminalProvider(input.provider)) {
        const conn = await createMtTerminalConnection({
          userId: ctx.session.user.id,
          provider: input.provider,
          displayName: input.displayName,
          credentials: input.credentials,
          meta: input.meta,
        });

        await Promise.all([
          ensureActivationMilestone({
            userId: ctx.session.user.id,
            key: "account_connected",
            source: "server",
            metadata: {
              provider: conn.provider,
              connectionId: conn.id,
              mode: "terminal-farm",
            },
          }),
          recordAppEvent({
            userId: ctx.session.user.id,
            category: "connections",
            name: "connection.created",
            source: "server",
            summary: `${conn.displayName} queued`,
            metadata: {
              provider: conn.provider,
              connectionId: conn.id,
              mode: "terminal-farm",
            },
            isUserVisible: true,
          }),
        ]);

        await createConnectionSettingsNotification({
          userId: ctx.session.user.id,
          title: "Connection queued",
          body: `${conn.displayName} was queued for the MT terminal worker.`,
          connectionId: conn.id,
          provider: conn.provider,
          displayName: conn.displayName,
          updatedFields: ["provider", "displayName", "status"],
        });

        return {
          connectionId: conn.id,
          accountInfo: null,
          mode: "terminal-farm" as const,
        };
      }

      const provider = await getProvider(input.provider);

      // Validate credentials by connecting
      let accountInfo;
      try {
        accountInfo = await provider.connect({
          credentials: input.credentials,
          meta: input.meta,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        await recordOperationalError({
          userId: ctx.session.user.id,
          category: "connections",
          name: "connection.validation_failed",
          source: "server",
          summary: `Could not connect to ${input.provider}`,
          metadata: {
            provider: input.provider,
            message: msg,
          },
          isUserVisible: true,
        });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Could not connect to ${input.provider}: ${msg}`,
        });
      }

      const { encrypted, iv } = encryptCredentials(
        JSON.stringify(input.credentials)
      );
      const displayName = await resolveUniqueConnectionDisplayName({
        userId: ctx.session.user.id,
        provider: input.provider,
        displayName: input.displayName,
      });
      const safeMeta = sanitizeConnectionMeta(input.meta);

      const [conn] = await db
        .insert(platformConnection)
        .values({
          userId: ctx.session.user.id,
          provider: input.provider,
          displayName,
          meta: {
            ...safeMeta,
            accountInfoSnapshot: {
              balance: accountInfo.balance,
              currency: accountInfo.currency,
              brokerName: accountInfo.brokerName,
            },
          },
          encryptedCredentials: encrypted,
          credentialIv: iv,
          status: "active",
        })
        .returning();

      await Promise.all([
        ensureActivationMilestone({
          userId: ctx.session.user.id,
          key: "account_connected",
          source: "server",
          metadata: {
            provider: conn.provider,
            connectionId: conn.id,
            mode: "credentials",
          },
        }),
        recordAppEvent({
          userId: ctx.session.user.id,
          category: "connections",
          name: "connection.created",
          source: "server",
          summary: `${displayName} connected`,
          metadata: {
            provider: conn.provider,
            connectionId: conn.id,
            mode: "credentials",
          },
          isUserVisible: true,
        }),
      ]);

      await createConnectionSettingsNotification({
        userId: ctx.session.user.id,
        title: "Connection added",
        body: `${displayName} is connected and ready to link to a trading account.`,
        connectionId: conn.id,
        provider: conn.provider,
        displayName: conn.displayName,
        updatedFields: ["provider", "displayName"],
      });

      return { connectionId: conn.id, accountInfo };
    }),

  /** Link a connection to an existing trading account. */
  linkAccount: protectedProcedure
    .input(
      z.object({
        connectionId: z.string(),
        accountId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertAlphaFeatureEnabled("connections");
      const [conn, acct] = await Promise.all([
        db.query.platformConnection.findFirst({
          where: and(
            eq(platformConnection.id, input.connectionId),
            eq(platformConnection.userId, ctx.session.user.id)
          ),
        }),
        db.query.tradingAccount.findFirst({
          where: and(
            eq(tradingAccount.id, input.accountId),
            eq(tradingAccount.userId, ctx.session.user.id)
          ),
        }),
      ]);

      if (!conn || !acct) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const nextMeta = resolveConnectionLinkMeta({
        provider: conn.provider,
        currentMeta: conn.meta,
        accountNumber: acct.accountNumber ?? null,
      });

      await db
        .update(platformConnection)
        .set({ accountId: input.accountId, meta: nextMeta, updatedAt: new Date() })
        .where(eq(platformConnection.id, input.connectionId));

      await createConnectionSettingsNotification({
        userId: ctx.session.user.id,
        title: "Connection linked",
        body: `Linked ${conn.displayName} to ${acct.name}.`,
        connectionId: conn.id,
        provider: conn.provider,
        displayName: conn.displayName,
        accountId: acct.id,
        accountName: acct.name,
        updatedFields: ["accountId"],
      });

      await recordAppEvent({
        userId: ctx.session.user.id,
        category: "connections",
        name: "connection.linked",
        source: "server",
        summary: `${conn.displayName} linked to ${acct.name}`,
        metadata: {
          connectionId: conn.id,
          accountId: acct.id,
          provider: conn.provider,
        },
        isUserVisible: true,
      });

      return { success: true };
    }),

  /** Trigger an immediate sync. */
  syncNow: protectedProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertAlphaFeatureEnabled("connections");
      const conn = await db.query.platformConnection.findFirst({
        where: and(
          eq(platformConnection.id, input.connectionId),
          eq(platformConnection.userId, ctx.session.user.id)
        ),
      });

      if (!conn) throw new TRPCError({ code: "NOT_FOUND" });

      if (isMtTerminalProvider(conn.provider)) {
        assertAlphaFeatureEnabled("mt5Ingestion");
        await db
          .update(platformConnection)
          .set({
            status: "pending",
            lastError: null,
            meta: withMt5ForceSyncRequest(
              conn.meta && typeof conn.meta === "object"
                ? (conn.meta as Record<string, unknown>)
                : {},
              {
                reason: "manual-sync",
              }
            ),
            updatedAt: new Date(),
          })
          .where(eq(platformConnection.id, input.connectionId));

        return {
          connectionId: input.connectionId,
          status: "queued" as const,
          tradesFound: 0,
          tradesInserted: 0,
          tradesDuplicated: 0,
          errorMessage: null,
          durationMs: 0,
        };
      }

      try {
        const result = await syncConnection(input.connectionId, {
          notifySuccess: true,
          source: "manual",
        });

        await recordAppEvent({
          userId: ctx.session.user.id,
          category: "connections",
          name:
            result.status === "success"
              ? "connection.sync.completed"
              : "connection.sync.non_success",
          source: "server",
          summary: `${conn.displayName} sync ${result.status}`,
          metadata: {
            connectionId: conn.id,
            provider: conn.provider,
            status: result.status,
            tradesInserted: result.tradesInserted,
            tradesFound: result.tradesFound,
            errorMessage: result.errorMessage,
          },
          isUserVisible: result.status !== "success",
        });

        if (result.tradesInserted > 0) {
          await ensureActivationMilestone({
            userId: ctx.session.user.id,
            key: "trades_synced",
            source: "server",
            metadata: {
              connectionId: conn.id,
              provider: conn.provider,
              tradesInserted: result.tradesInserted,
            },
          });
        }

        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Connection sync failed";
        await recordOperationalError({
          userId: ctx.session.user.id,
          category: "connections",
          name: "connection.sync.failed",
          source: "server",
          summary: `${conn.displayName} sync failed`,
          metadata: {
            connectionId: conn.id,
            provider: conn.provider,
            message,
          },
          isUserVisible: true,
        });
        throw error;
      }
    }),

  /** Update sync interval, pause state, or display name. */
  updateSettings: protectedProcedure
    .input(
      z.object({
        connectionId: z.string(),
        syncIntervalMinutes: z.number().min(0).max(1440).optional(),
        isPaused: z.boolean().optional(),
        displayName: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertAlphaFeatureEnabled("connections");
      const conn = await db.query.platformConnection.findFirst({
        where: and(
          eq(platformConnection.id, input.connectionId),
          eq(platformConnection.userId, ctx.session.user.id)
        ),
      });

      if (!conn) throw new TRPCError({ code: "NOT_FOUND" });

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.syncIntervalMinutes !== undefined)
        updates.syncIntervalMinutes = input.syncIntervalMinutes;
      if (input.isPaused !== undefined) updates.isPaused = input.isPaused;
      if (input.displayName) {
        updates.displayName = await resolveUniqueConnectionDisplayName({
          userId: ctx.session.user.id,
          provider: conn.provider,
          displayName: input.displayName,
          excludeConnectionId: conn.id,
        });
      }

      await db
        .update(platformConnection)
        .set(updates)
        .where(eq(platformConnection.id, input.connectionId));

      if (input.isPaused !== undefined) {
        await createConnectionSettingsNotification({
          userId: ctx.session.user.id,
          title: input.isPaused ? "Sync paused" : "Sync resumed",
          body: `${conn.displayName} sync has been ${
            input.isPaused ? "paused" : "resumed"
          }.`,
          connectionId: conn.id,
          provider: conn.provider,
          displayName: conn.displayName,
          accountId: conn.accountId,
          updatedFields: ["isPaused"],
        });
      }

      return { success: true };
    }),

  /** Delete a connection and all its sync logs. */
  delete: protectedProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const conn = await db.query.platformConnection.findFirst({
        where: and(
          eq(platformConnection.id, input.connectionId),
          eq(platformConnection.userId, ctx.session.user.id)
        ),
      });

      if (!conn) throw new TRPCError({ code: "NOT_FOUND" });

      await db
        .delete(platformConnection)
        .where(eq(platformConnection.id, input.connectionId));

      await createConnectionSettingsNotification({
        userId: ctx.session.user.id,
        title: "Connection deleted",
        body: `${conn.displayName} has been removed.`,
        connectionId: conn.id,
        provider: conn.provider,
        displayName: conn.displayName,
        accountId: conn.accountId,
        updatedFields: ["deleted"],
      });

      return { success: true };
    }),

  /** Get recent sync logs for a connection. */
  getSyncLogs: protectedProcedure
    .input(
      z.object({
        connectionId: z.string(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const conn = await db.query.platformConnection.findFirst({
        where: and(
          eq(platformConnection.id, input.connectionId),
          eq(platformConnection.userId, ctx.session.user.id)
        ),
      });

      if (!conn) throw new TRPCError({ code: "NOT_FOUND" });

      return db.query.syncLog.findMany({
        where: eq(syncLog.connectionId, input.connectionId),
        orderBy: desc(syncLog.createdAt),
        limit: input.limit,
      });
    }),

  /** Get equity snapshots for charts. */
  getEquitySnapshots: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        days: z.number().min(1).max(365).default(90),
      })
    )
    .query(async ({ ctx, input }) => {
      const acct = await db.query.tradingAccount.findFirst({
        where: and(
          eq(tradingAccount.id, input.accountId),
          eq(tradingAccount.userId, ctx.session.user.id)
        ),
      });

      if (!acct) throw new TRPCError({ code: "NOT_FOUND" });

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - input.days);
      const cutoffStr = cutoff.toISOString().split("T")[0];

      return db.query.equitySnapshot.findMany({
        where: and(
          eq(equitySnapshot.accountId, input.accountId),
          gte(equitySnapshot.snapshotDate, cutoffStr)
        ),
        orderBy: equitySnapshot.snapshotDate,
      });
    }),
});
