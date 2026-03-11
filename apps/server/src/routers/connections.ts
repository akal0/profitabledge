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
import { eq, and, desc, gte, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { encryptCredentials } from "../lib/providers/credential-cipher";
import {
  getProvider,
  getSupportedProviders,
  PROVIDER_INFO,
} from "../lib/providers/registry";
import { resolveUniqueConnectionDisplayName } from "../lib/connections/display-name";
import { syncConnection } from "../lib/providers/sync-engine";
import { getCTraderAuthUrl } from "../lib/providers/ctrader";
import { createMtTerminalConnection } from "../lib/mt5/worker-control";
import { isMtTerminalProvider } from "../lib/mt5/constants";
import { buildMtConnectionCompleteness } from "../lib/mt5/completeness";
import {
  isMtWorkerHostSnapshotFresh,
  listMtWorkerHostSnapshots,
} from "../lib/mt5/host-status";

const credentialsSchema = z.record(z.string(), z.string());
const connectionMetaSchema = z
  .record(z.string(), z.unknown())
  .optional()
  .default({});

export const connectionsRouter = router({
  /** List all connections for the current user. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.query.platformConnection.findMany({
      where: eq(platformConnection.userId, ctx.session.user.id),
      orderBy: desc(platformConnection.createdAt),
    });
    // Strip encrypted credentials from response
    return rows.map(({ encryptedCredentials: _, credentialIv: __, ...safe }) => safe);
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

    if (terminalConnections.length === 0) {
      return {
        available: false,
        error: null,
        summary: null,
        hosts: [],
        workers: [],
        sessions: [],
        pendingConnections: [],
      };
    }

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
      const relevantHosts = freshHostSnapshots.filter(({ snapshot }) =>
        snapshot.workers.some(
          (worker) =>
            sessionRows.some((session) => session.workerHostId === worker.workerId) ||
            worker.activeConnections.some((connection) =>
              visibleConnectionIds.has(connection.connectionId)
            )
        )
      );

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
        relevantHosts.length > 0
          ? {
              ok: relevantHosts.every(({ snapshot }) => snapshot.ok),
              status: relevantHosts.every(({ snapshot }) => snapshot.ok)
                ? "ok"
                : "degraded",
              mode:
                relevantHosts.length === 1
                  ? relevantHosts[0]!.snapshot.mode
                  : `${relevantHosts.length} hosts`,
              desiredChildren: relevantHosts.reduce(
                (sum, { snapshot }) => sum + snapshot.desiredChildren,
                0
              ),
              runningChildren: relevantHosts.reduce(
                (sum, { snapshot }) => sum + snapshot.runningChildren,
                0
              ),
              healthyChildren: relevantHosts.reduce(
                (sum, { snapshot }) => sum + snapshot.healthyChildren,
                0
              ),
              hostCount: relevantHosts.length,
              startedAt:
                relevantHosts.length === 1
                  ? relevantHosts[0]!.snapshot.startedAt ?? null
                  : null,
              updatedAt:
                relevantHosts
                  .map(({ snapshot }) => snapshot.updatedAt ?? null)
                  .filter((value): value is string => Boolean(value))
                  .sort()
                  .at(-1) ?? null,
              uptimeSeconds: Math.max(
                ...relevantHosts.map(({ snapshot }) => snapshot.uptimeSeconds ?? 0),
                0
              ),
              adminHost:
                relevantHosts.length === 1
                  ? relevantHosts[0]!.snapshot.admin?.host ?? null
                  : null,
              adminPort:
                relevantHosts.length === 1
                  ? relevantHosts[0]!.snapshot.admin?.port ?? null
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

      const hosts = relevantHosts.map(({ snapshot }) => ({
        workerHostId: snapshot.workerHostId,
        label: snapshot.host?.label ?? snapshot.workerHostId,
        machineName: snapshot.host?.machineName ?? snapshot.workerHostId,
        environment: snapshot.host?.environment ?? null,
        provider: snapshot.host?.provider ?? null,
        region: snapshot.host?.region ?? null,
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
      return safe;
    }),

  /** Get supported providers and their info. */
  getProviders: protectedProcedure.query(() => {
    return {
      providers: getSupportedProviders(),
      info: PROVIDER_INFO,
    };
  }),

  /** Generate OAuth authorization URL (for cTrader). */
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
      const provider = await getProvider(input.provider);

      if (!provider.exchangeCode) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Provider ${input.provider} does not support OAuth`,
        });
      }

      const redirectUri =
        input.provider === "ctrader"
          ? process.env.CTRADER_REDIRECT_URI!
          : "";

      const credentials = await provider.exchangeCode(
        input.code,
        redirectUri
      );

      const { encrypted, iv } = encryptCredentials(
        JSON.stringify(credentials)
      );
      const expiresAt = credentials.expiresAt
        ? new Date(credentials.expiresAt)
        : null;
      const displayName = await resolveUniqueConnectionDisplayName({
        userId: ctx.session.user.id,
        provider: input.provider,
        displayName: input.displayName,
      });

      const [conn] = await db
        .insert(platformConnection)
        .values({
          userId: ctx.session.user.id,
          provider: input.provider,
          displayName,
          meta: input.meta,
          encryptedCredentials: encrypted,
          credentialIv: iv,
          tokenExpiresAt: expiresAt,
          status: "active",
        })
        .returning();

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
      if (isMtTerminalProvider(input.provider)) {
        const conn = await createMtTerminalConnection({
          userId: ctx.session.user.id,
          provider: input.provider,
          displayName: input.displayName,
          credentials: input.credentials,
          meta: input.meta,
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

      const [conn] = await db
        .insert(platformConnection)
        .values({
          userId: ctx.session.user.id,
          provider: input.provider,
          displayName,
          meta: {
            ...input.meta,
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

      await db
        .update(platformConnection)
        .set({ accountId: input.accountId, updatedAt: new Date() })
        .where(eq(platformConnection.id, input.connectionId));

      return { success: true };
    }),

  /** Trigger an immediate sync. */
  syncNow: protectedProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const conn = await db.query.platformConnection.findFirst({
        where: and(
          eq(platformConnection.id, input.connectionId),
          eq(platformConnection.userId, ctx.session.user.id)
        ),
      });

      if (!conn) throw new TRPCError({ code: "NOT_FOUND" });

      if (isMtTerminalProvider(conn.provider)) {
        await db
          .update(platformConnection)
          .set({
            status: "pending",
            lastSyncAttemptAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(platformConnection.id, input.connectionId));

        return {
          connectionId: input.connectionId,
          status: "success" as const,
          tradesFound: 0,
          tradesInserted: 0,
          tradesDuplicated: 0,
          errorMessage: null,
          durationMs: 0,
        };
      }

      return syncConnection(input.connectionId);
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
