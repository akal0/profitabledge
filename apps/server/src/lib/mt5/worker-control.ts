import { desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db } from "../../db";
import { platformConnection } from "../../db/schema/connections";
import {
  brokerDealEvent,
  brokerOrderEvent,
  brokerSession,
  brokerSyncCheckpoint,
} from "../../db/schema/mt5-sync";
import { openTrade } from "../../db/schema/trading";
import {
  decryptCredentials,
  encryptCredentials,
} from "../providers/credential-cipher";
import { resolveUniqueConnectionDisplayName } from "../connections/display-name";
import { isMtTerminalProvider } from "./constants";
import { buildMtConnectionCompleteness } from "./completeness";
import { getServerEnv } from "../env";

const ACTIVE_LEASE_MS = 60 * 1000;

function toPlatformConnectionStatus(
  workerStatus: string,
  lastError?: string | null
): "pending" | "active" | "error" {
  if (lastError) {
    return "error";
  }

  switch (workerStatus) {
    case "active":
    case "idle":
    case "running":
    case "success":
      return "active";
    case "bootstrapping":
    case "syncing":
    case "pending":
      return "pending";
    case "error":
    case "degraded":
      return "error";
    default:
      return "pending";
  }
}

export interface MtWorkerBootstrapPayload {
  connectionId: string;
  provider: string;
  displayName: string;
  accountId: string | null;
  credentials: Record<string, string>;
  meta: Record<string, unknown>;
  syncCursor: string | null;
  checkpoint: {
    lastDealTime: string | null;
    lastDealId: string | null;
    lastOrderTime: string | null;
    lastPositionPollAt: string | null;
    lastAccountPollAt: string | null;
    lastFullReconcileAt: string | null;
  } | null;
  status: string;
}

export function assertWorkerSecret(workerSecret: string | null | undefined) {
  const expected = getServerEnv().BROKER_WORKER_SECRET;

  if (!expected) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "BROKER_WORKER_SECRET is not configured",
    });
  }

  if (!workerSecret || workerSecret !== expected) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid worker secret",
    });
  }
}

export async function createMtTerminalConnection(input: {
  userId: string;
  provider: string;
  displayName: string;
  credentials: Record<string, string>;
  meta?: Record<string, unknown>;
}) {
  if (!isMtTerminalProvider(input.provider)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Unsupported MT terminal provider: ${input.provider}`,
    });
  }

  if (input.provider !== "mt5-terminal") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${input.provider} terminal sync is not implemented yet`,
    });
  }

  const login = input.credentials.login?.trim();
  const password = input.credentials.password?.trim();
  const server = input.credentials.server?.trim();

  if (!login || !password || !server) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "MT terminal connections require login, password, and server.",
    });
  }

  const { encrypted, iv } = encryptCredentials(
    JSON.stringify({
      login,
      password,
      server,
    })
  );
  const displayName = await resolveUniqueConnectionDisplayName({
    userId: input.userId,
    provider: input.provider,
    displayName: input.displayName,
  });

  const [conn] = await db
    .insert(platformConnection)
    .values({
      userId: input.userId,
      provider: input.provider,
      displayName,
      meta: {
        ...(input.meta ?? {}),
        login,
        platform: "mt5",
        serverName: server,
        passwordType:
          typeof input.meta?.passwordType === "string"
            ? input.meta.passwordType
            : "trading",
        connectionMode: "terminal-farm",
      },
      encryptedCredentials: encrypted,
      credentialIv: iv,
      status: "pending",
      syncIntervalMinutes: 1,
    })
    .returning();

  return conn;
}

export async function claimMtConnections(input: {
  workerHostId: string;
  limit: number;
}) {
  const connections = await db.query.platformConnection.findMany({
    where: inArray(platformConnection.provider, ["mt5-terminal"]),
    orderBy: desc(platformConnection.updatedAt),
  });

  const candidates = connections.filter((connection) => !connection.isPaused);
  if (candidates.length === 0) {
    return [];
  }

  const sessions = await db.query.brokerSession.findMany({
    where: inArray(
      brokerSession.connectionId,
      candidates.map((connection) => connection.id)
    ),
  });

  const sessionByConnection = new Map(
    sessions.map((session) => [session.connectionId, session])
  );
  const now = Date.now();
  const claimed: Array<{
    connectionId: string;
    provider: string;
    displayName: string;
    status: string;
    accountId: string | null;
  }> = [];

  for (const connection of candidates) {
    if (claimed.length >= input.limit) {
      break;
    }

    const session = sessionByConnection.get(connection.id);
    const isLeasedToSameWorker = session?.workerHostId === input.workerHostId;
    const leaseExpired =
      !session?.heartbeatAt ||
      now - session.heartbeatAt.getTime() > ACTIVE_LEASE_MS;

    if (session && !isLeasedToSameWorker && !leaseExpired) {
      continue;
    }

    const nextSessionStatus =
      connection.status === "active" ? "syncing" : "bootstrapping";
    const nextConnectionStatus = toPlatformConnectionStatus(nextSessionStatus);

    await db
      .insert(brokerSession)
      .values({
        connectionId: connection.id,
        accountId: connection.accountId ?? null,
        platform: connection.provider === "mt4-terminal" ? "mt4" : "mt5",
        workerHostId: input.workerHostId,
        status: nextSessionStatus,
        heartbeatAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: brokerSession.connectionId,
        set: {
          accountId: connection.accountId ?? null,
          platform: connection.provider === "mt4-terminal" ? "mt4" : "mt5",
          workerHostId: input.workerHostId,
          status: nextSessionStatus,
          heartbeatAt: new Date(),
          updatedAt: new Date(),
        },
      });

    await db
      .update(platformConnection)
      .set({
        status: nextConnectionStatus,
        lastSyncAttemptAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(platformConnection.id, connection.id));

      claimed.push({
      connectionId: connection.id,
      provider: connection.provider,
      displayName: connection.displayName,
      status: nextConnectionStatus,
      accountId: connection.accountId ?? null,
    });
  }

  return claimed;
}

export async function getMtConnectionBootstrap(connectionId: string) {
  const connection = await db.query.platformConnection.findFirst({
    where: eq(platformConnection.id, connectionId),
  });
  const checkpoint = await db.query.brokerSyncCheckpoint.findFirst({
    where: eq(brokerSyncCheckpoint.connectionId, connectionId),
  });

  if (!connection || !isMtTerminalProvider(connection.provider)) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "MT terminal connection not found",
    });
  }

  if (!connection.encryptedCredentials || !connection.credentialIv) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Connection has no stored MT terminal credentials",
    });
  }

  const decrypted = JSON.parse(
    decryptCredentials(connection.encryptedCredentials, connection.credentialIv)
  ) as Record<string, unknown>;
  const credentials = Object.fromEntries(
    Object.entries(decrypted).map(([key, value]) => [key, String(value ?? "")])
  );
  const scopedDeals = connection.accountId
    ? await db.query.brokerDealEvent.findMany({
        where: eq(brokerDealEvent.connectionId, connectionId),
        columns: {
          remoteDealId: true,
          remoteOrderId: true,
          positionId: true,
          entryType: true,
          side: true,
          eventTime: true,
        },
      })
    : [];
  const scopedOrders = connection.accountId
    ? await db.query.brokerOrderEvent.findMany({
        where: eq(brokerOrderEvent.connectionId, connectionId),
        columns: {
          remoteOrderId: true,
          positionId: true,
          side: true,
          eventTime: true,
        },
      })
    : [];
  const scopedOpenTrades = connection.accountId
    ? await db.query.openTrade.findMany({
        where: eq(openTrade.accountId, connection.accountId),
        columns: {
          ticket: true,
          tradeType: true,
        },
      })
    : [];
  const completeness = buildMtConnectionCompleteness({
    checkpoint: checkpoint ?? null,
    deals: scopedDeals,
    orders: scopedOrders,
    openTrades: scopedOpenTrades,
  });
  const connectionMeta =
    connection.meta && typeof connection.meta === "object"
      ? (connection.meta as Record<string, unknown>)
      : {};

  return {
    connectionId: connection.id,
    provider: connection.provider,
    displayName: connection.displayName,
    accountId: connection.accountId ?? null,
    credentials,
    meta: {
      ...connectionMeta,
      gapHeal: completeness,
    },
    syncCursor: connection.syncCursor?.toISOString() ?? null,
    checkpoint: checkpoint
      ? {
          lastDealTime: checkpoint.lastDealTime?.toISOString() ?? null,
          lastDealId: checkpoint.lastDealId ?? null,
          lastOrderTime: checkpoint.lastOrderTime?.toISOString() ?? null,
          lastPositionPollAt:
            checkpoint.lastPositionPollAt?.toISOString() ?? null,
          lastAccountPollAt:
            checkpoint.lastAccountPollAt?.toISOString() ?? null,
          lastFullReconcileAt:
            checkpoint.lastFullReconcileAt?.toISOString() ?? null,
        }
      : null,
    status: connection.status,
  } satisfies MtWorkerBootstrapPayload;
}

export async function reportMtConnectionStatus(input: {
  connectionId: string;
  workerHostId: string;
  status: string;
  sessionKey?: string;
  lastError?: string | null;
  meta?: Record<string, unknown>;
}) {
  const connection = await db.query.platformConnection.findFirst({
    where: eq(platformConnection.id, input.connectionId),
  });

  if (!connection || !isMtTerminalProvider(connection.provider)) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "MT terminal connection not found",
    });
  }

  const currentMeta =
    connection.meta && typeof connection.meta === "object"
      ? (connection.meta as Record<string, unknown>)
      : {};

  await db
    .insert(brokerSession)
    .values({
      connectionId: input.connectionId,
      accountId: connection.accountId ?? null,
      platform: connection.provider === "mt4-terminal" ? "mt4" : "mt5",
      workerHostId: input.workerHostId,
      sessionKey: input.sessionKey ?? null,
      status: input.status,
      heartbeatAt: new Date(),
      lastError: input.lastError ?? null,
      meta: input.meta ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: brokerSession.connectionId,
      set: {
        accountId: connection.accountId ?? null,
        platform: connection.provider === "mt4-terminal" ? "mt4" : "mt5",
        workerHostId: input.workerHostId,
        sessionKey: input.sessionKey ?? null,
        status: input.status,
        heartbeatAt: new Date(),
        lastError: input.lastError ?? null,
        meta: input.meta ?? null,
        updatedAt: new Date(),
      },
    });

  await db
    .update(platformConnection)
    .set({
      status: toPlatformConnectionStatus(input.status, input.lastError),
      lastError: input.lastError ?? null,
      updatedAt: new Date(),
      meta: {
        ...currentMeta,
        mt5Worker: {
          workerHostId: input.workerHostId,
          sessionKey: input.sessionKey ?? null,
          reportedAt: new Date().toISOString(),
          ...(input.meta ?? {}),
        },
      },
    })
    .where(eq(platformConnection.id, input.connectionId));

  return {
    success: true,
  };
}
