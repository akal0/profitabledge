import { timingSafeEqual } from "node:crypto";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  notInArray,
  or,
} from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db } from "../../db";
import { platformConnection } from "../../db/schema/connections";
import { user as userTable } from "../../db/schema/auth";
import {
  billingEntitlementOverride,
  billingOrder,
  billingSubscription,
} from "../../db/schema/billing";
import {
  brokerDealEvent,
  brokerOrderEvent,
  brokerSession,
  brokerSyncCheckpoint,
} from "../../db/schema/mt5-sync";
import { openTrade } from "../../db/schema/trading";
import {
  getBillingPlanDefinition,
  getHigherBillingPlanKey,
  type BillingPlanKey,
} from "../billing/config";
import {
  decryptCredentials,
  encryptCredentials,
} from "../providers/credential-cipher";
import { resolveUniqueConnectionDisplayName } from "../connections/display-name";
import { sanitizeConnectionMeta } from "../connections/sanitize-meta";
import { isMtTerminalProvider } from "./constants";
import { buildMtConnectionCompleteness } from "./completeness";
import { getServerEnv } from "../env";
import { getMt5LiveLeaseSnapshot } from "./live-lease";
import {
  evaluateMt5HostPlacement,
  getUserTimezoneFromWidgetPreferences,
  mergeMt5ConnectionHostingMeta,
  type Mt5ClaimHostInput,
  type Mt5HostProfile,
  resolveMt5ClaimHostProfile,
  resolveMt5ConnectionHostingPolicy,
  withStrictMt5HostingGeoPolicy,
} from "./hosting-policy";
import {
  isMtWorkerHostSnapshotFresh,
  listMtWorkerHostSnapshots,
} from "./host-status";
import {
  selectMt5Claims,
  type Mt5ClaimSchedulingCandidate,
} from "./claim-scheduler";
import {
  clearMt5ForceSyncRequest,
  getMt5ForceSyncRequest,
  withMt5ForceSyncRequest,
} from "./queue-state";
import { getMt5RuntimeState } from "./runtime-state";

const ACTIVE_LEASE_MS = 60 * 1000;
const CHECKOUT_ORDER_GRACE_WINDOW_MS = 15 * 60 * 1000;
const LIVE_QUEUE_REFRESH_MS = 15 * 1000;
const POST_EXIT_QUEUE_REFRESH_MS = 30 * 1000;
const INITIAL_BOOTSTRAP_RETRY_MS = 30 * 1000;
const COLD_QUEUE_SOFT_AGING_FLOOR_MS = 60 * 1000;
const COLD_QUEUE_HARD_AGING_FLOOR_MS = 5 * 60 * 1000;

type Mt5ClaimMode = "live" | "cold";

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
    case "sleeping":
      return "pending";
    case "error":
    case "degraded":
      return "error";
    default:
      return "pending";
  }
}

function isActiveSubscriptionStatus(status?: string | null) {
  return status === "active" || status === "trialing";
}

function isActiveSessionHeartbeat(
  heartbeatAt: Date | null | undefined,
  now: number
) {
  if (!heartbeatAt) {
    return false;
  }

  return now - heartbeatAt.getTime() <= ACTIVE_LEASE_MS;
}

function isClaimOccupyingSessionStatus(status?: string | null) {
  return (
    status === "bootstrapping" ||
    status === "syncing" ||
    status === "active" ||
    status === "running"
  );
}

function isClaimOccupyingSession(
  session:
    | {
        heartbeatAt?: Date | null;
        status?: string | null;
      }
    | null
    | undefined,
  now: number
) {
  return (
    isActiveSessionHeartbeat(session?.heartbeatAt, now) &&
    isClaimOccupyingSessionStatus(session?.status)
  );
}

export function canMtWorkerTakeSessionOwnership(
  session:
    | {
        workerHostId?: string | null;
        heartbeatAt?: Date | null;
        status?: string | null;
      }
    | null
    | undefined,
  workerId: string,
  now: number
) {
  if (!session) {
    return true;
  }

  if (session.workerHostId === workerId) {
    return true;
  }

  return !isClaimOccupyingSession(session, now);
}

function getLatestSyncActivityAt(connection: {
  lastSyncAttemptAt?: Date | null;
  lastSyncSuccessAt?: Date | null;
}) {
  return Math.max(
    connection.lastSyncAttemptAt?.getTime() ?? 0,
    connection.lastSyncSuccessAt?.getTime() ?? 0
  );
}

function resolveMt5ConcurrentSlotCap(
  planKey: BillingPlanKey,
  claimMode: Mt5ClaimMode
) {
  const includedLiveSyncSlots =
    getBillingPlanDefinition(planKey)?.includedLiveSyncSlots ?? 0;

  if (claimMode === "live") {
    return includedLiveSyncSlots;
  }

  return Math.max(1, includedLiveSyncSlots);
}

function resolveColdQueueTier(input: {
  lastActivityAt: number;
  dueAt: number;
  coldIntervalMs: number;
  now: number;
}) {
  if (input.lastActivityAt <= 0) {
    return 0;
  }

  const overdueMs = Math.max(input.now - input.dueAt, 0);
  const softThresholdMs = Math.max(
    input.coldIntervalMs,
    COLD_QUEUE_SOFT_AGING_FLOOR_MS
  );
  const hardThresholdMs = Math.max(
    input.coldIntervalMs * 2,
    COLD_QUEUE_HARD_AGING_FLOOR_MS
  );

  if (overdueMs >= hardThresholdMs) {
    return 2;
  }

  if (overdueMs >= softThresholdMs) {
    return 1;
  }

  return 0;
}

export function resolveMt5ClaimQueueSelection(
  connection: {
    accountId?: string | null;
    status?: string | null;
    meta?: unknown;
    lastSyncAttemptAt?: Date | null;
    lastSyncSuccessAt?: Date | null;
    syncIntervalMinutes?: number | null;
  },
  liveLease: ReturnType<typeof getMt5LiveLeaseSnapshot>,
  now: number
): {
  claimMode: Mt5ClaimMode;
  queueTier: number;
  dueAt: string;
  lastRequestedAt: string | null;
} | null {
  const lastActivityAt = getLatestSyncActivityAt(connection);
  const forcedSyncRequest = getMt5ForceSyncRequest(connection.meta);

  if (forcedSyncRequest) {
    return {
      claimMode: liveLease.active ? "live" : "cold",
      queueTier: 3,
      dueAt: forcedSyncRequest.requestedAt,
      lastRequestedAt: forcedSyncRequest.requestedAt,
    };
  }

  if (!connection.lastSyncSuccessAt) {
    const dueAt = lastActivityAt + INITIAL_BOOTSTRAP_RETRY_MS;
    if (lastActivityAt > 0 && dueAt > now) {
      return null;
    }

    return {
      claimMode: liveLease.active ? "live" : "cold",
      queueTier: liveLease.active ? 1 : 0,
      dueAt: new Date(lastActivityAt > 0 ? dueAt : now).toISOString(),
      lastRequestedAt: liveLease.active ? liveLease.lastHeartbeatAt : null,
    };
  }

  if (liveLease.active) {
    const dueAt = lastActivityAt + LIVE_QUEUE_REFRESH_MS;
    if (lastActivityAt > 0 && dueAt > now) {
      return null;
    }

    return {
      claimMode: "live",
      queueTier: 1,
      dueAt: new Date(lastActivityAt > 0 ? dueAt : now).toISOString(),
      lastRequestedAt: liveLease.lastHeartbeatAt,
    };
  }

  const runtimeState = getMt5RuntimeState(connection.meta, new Date(now));
  const postExitBoostUntilAt = runtimeState.postExitBoostUntil
    ? new Date(runtimeState.postExitBoostUntil).getTime()
    : 0;
  if (postExitBoostUntilAt > now) {
    const dueAt = lastActivityAt + POST_EXIT_QUEUE_REFRESH_MS;
    if (lastActivityAt > 0 && dueAt > now) {
      return null;
    }

    return {
      claimMode: "cold",
      queueTier: 1,
      dueAt: new Date(lastActivityAt > 0 ? dueAt : now).toISOString(),
      lastRequestedAt: null,
    };
  }

  if ((connection.syncIntervalMinutes ?? 0) <= 0) {
    return null;
  }

  const coldIntervalMinutes = Math.max(connection.syncIntervalMinutes ?? 0, 1);
  const coldIntervalMs = coldIntervalMinutes * 60 * 1000;
  const dueAt = lastActivityAt + coldIntervalMs;
  if (lastActivityAt > 0 && dueAt > now) {
    return null;
  }

  return {
    claimMode: "cold",
    queueTier: resolveColdQueueTier({
      lastActivityAt,
      dueAt,
      coldIntervalMs,
      now,
    }),
    dueAt: new Date(lastActivityAt > 0 ? dueAt : now).toISOString(),
    lastRequestedAt: null,
  };
}

async function resolveMt5UserPlanKeys(userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) {
    return new Map<string, BillingPlanKey>();
  }

  const now = new Date();
  const recentPaidThreshold = new Date(
    now.getTime() - CHECKOUT_ORDER_GRACE_WINDOW_MS
  );

  const [subscriptions, overrides, paidOrders] = await Promise.all([
    db
      .select({
        userId: billingSubscription.userId,
        planKey: billingSubscription.planKey,
        status: billingSubscription.status,
      })
      .from(billingSubscription)
      .where(inArray(billingSubscription.userId, uniqueUserIds)),
    db
      .select({
        userId: billingEntitlementOverride.userId,
        planKey: billingEntitlementOverride.planKey,
      })
      .from(billingEntitlementOverride)
      .where(
        and(
          inArray(billingEntitlementOverride.userId, uniqueUserIds),
          lte(billingEntitlementOverride.startsAt, now),
          gte(billingEntitlementOverride.endsAt, now)
        )
      ),
    db
      .select({
        userId: billingOrder.userId,
        planKey: billingOrder.planKey,
      })
      .from(billingOrder)
      .where(
        and(
          inArray(billingOrder.userId, uniqueUserIds),
          eq(billingOrder.paid, true),
          gte(billingOrder.paidAt, recentPaidThreshold)
        )
      ),
  ]);

  const planByUserId = new Map<string, BillingPlanKey>(
    uniqueUserIds.map((userId) => [userId, "student"])
  );

  for (const subscription of subscriptions) {
    if (!isActiveSubscriptionStatus(subscription.status)) {
      continue;
    }

    const planKey = subscription.planKey as BillingPlanKey;
    if (!getBillingPlanDefinition(planKey)) {
      continue;
    }

    planByUserId.set(
      subscription.userId,
      getHigherBillingPlanKey(planByUserId.get(subscription.userId) ?? "student", planKey)
    );
  }

  for (const order of paidOrders) {
    const planKey = order.planKey as BillingPlanKey;
    if (!getBillingPlanDefinition(planKey)) {
      continue;
    }

    planByUserId.set(
      order.userId,
      getHigherBillingPlanKey(planByUserId.get(order.userId) ?? "student", planKey)
    );
  }

  for (const override of overrides) {
    const planKey = override.planKey as BillingPlanKey;
    if (!getBillingPlanDefinition(planKey)) {
      continue;
    }

    planByUserId.set(
      override.userId,
      getHigherBillingPlanKey(planByUserId.get(override.userId) ?? "student", planKey)
    );
  }

  return planByUserId;
}

export interface MtWorkerBootstrapPayload {
  connectionId: string;
  provider: string;
  displayName: string;
  accountId: string | null;
  isPaused: boolean;
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
  liveLease: {
    active: boolean;
    activeHolderCount: number;
    lastHeartbeatAt: string | null;
    leaseUntil: string | null;
  };
}

export function assertWorkerSecret(workerSecret: string | null | undefined) {
  const expected = getServerEnv().BROKER_WORKER_SECRET;

  if (!expected) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "BROKER_WORKER_SECRET is not configured",
    });
  }

  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(workerSecret || "", "utf8");
  const isMatch =
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer);

  if (!workerSecret || !isMatch) {
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

  const login = input.credentials.login?.trim();
  const password = input.credentials.password?.trim();
  const server = input.credentials.server?.trim();
  const platform = input.provider === "mt4-terminal" ? "mt4" : "mt5";

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
  const userRow = await db.query.user.findFirst({
    where: eq(userTable.id, input.userId),
    columns: {
      widgetPreferences: true,
    },
  });
  const userTimezone = getUserTimezoneFromWidgetPreferences(
    userRow?.widgetPreferences
  );
  const mergedMeta = mergeMt5ConnectionHostingMeta({
    rawMeta:
      input.meta && typeof input.meta === "object"
        ? (input.meta as Record<string, unknown>)
        : {},
    userId: input.userId,
    userTimezone,
  });
  const queuedMeta = withMt5ForceSyncRequest(mergedMeta, {
    reason: "connection-created",
  });
  const safeQueuedMeta = sanitizeConnectionMeta(queuedMeta);

  const [conn] = await db
    .insert(platformConnection)
    .values({
      userId: input.userId,
      provider: input.provider,
      displayName,
      meta: {
        ...safeQueuedMeta,
        platform,
        passwordType:
          typeof input.meta?.passwordType === "string"
            ? input.meta.passwordType
            : "trading",
        connectionMode: "terminal-farm",
      },
      encryptedCredentials: encrypted,
      credentialIv: iv,
      status: "pending",
      syncIntervalMinutes: 0,
    })
    .returning();

  return conn;
}

export async function claimMtConnections(input: {
  hostId?: string;
  workerId?: string;
  workerHostId?: string;
  limit: number;
  host?: Mt5ClaimHostInput;
}) {
  const workerId =
    input.workerId?.trim() || input.workerHostId?.trim() || input.hostId?.trim();
  if (!workerId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "workerId is required",
    });
  }

  const hostId = input.hostId?.trim() || workerId;
  const hostProfile = resolveMt5ClaimHostProfile({
    hostId,
    host: input.host ?? null,
  });
  const connections = await db.query.platformConnection.findMany({
    where: inArray(platformConnection.provider, ["mt5-terminal"]),
    orderBy: desc(platformConnection.updatedAt),
  });
  const now = Date.now();

  const candidates = connections.filter((connection) => !connection.isPaused);
  if (candidates.length === 0) {
    return [];
  }
  const userRows = await db
    .select({
      id: userTable.id,
      widgetPreferences: userTable.widgetPreferences,
    })
    .from(userTable)
    .where(inArray(userTable.id, candidates.map((connection) => connection.userId)));
  const userTimezoneById = new Map(
    userRows.map((row) => [
      row.id,
      getUserTimezoneFromWidgetPreferences(row.widgetPreferences),
    ])
  );

  const sessions = await db.query.brokerSession.findMany({
    where: inArray(
      brokerSession.connectionId,
      connections.map((connection) => connection.id)
    ),
  });
  const planByUserId = await resolveMt5UserPlanKeys(
    candidates.map((connection) => connection.userId)
  );
  const connectionById = new Map(
    connections.map((connection) => [connection.id, connection])
  );
  const sessionByConnection = new Map(
    sessions.map((session) => [session.connectionId, session])
  );
  const activeSlotCountByUserId = new Map<string, number>();
  for (const session of sessions) {
    if (!isClaimOccupyingSession(session, now)) {
      continue;
    }

    const connection = connectionById.get(session.connectionId);
    if (!connection) {
      continue;
    }

    activeSlotCountByUserId.set(
      connection.userId,
      (activeSlotCountByUserId.get(connection.userId) ?? 0) + 1
    );
  }
  const freshHostProfiles: Mt5HostProfile[] = (
    await listMtWorkerHostSnapshots()
  )
    .filter(
      ({ row, snapshot }) =>
        isMtWorkerHostSnapshotFresh(row.lastSeenAt) &&
        snapshot.ok &&
        snapshot.healthyChildren > 0
    )
    .map(({ snapshot }) =>
      resolveMt5ClaimHostProfile({
        hostId: snapshot.workerHostId,
        host: {
          label: snapshot.host?.label ?? undefined,
          environment: snapshot.host?.environment ?? undefined,
          provider: snapshot.host?.provider ?? undefined,
          region: snapshot.host?.region ?? undefined,
          regionGroup: snapshot.host?.regionGroup ?? undefined,
          countryCode: snapshot.host?.countryCode ?? undefined,
          city: snapshot.host?.city ?? undefined,
          timezone: snapshot.host?.timezone ?? undefined,
          publicIp: snapshot.host?.publicIp ?? undefined,
          tags: snapshot.host?.tags ?? [],
          deviceIsolationMode:
            snapshot.host?.deviceIsolationMode === "dedicated-user-host"
              ? "dedicated-user-host"
              : "shared-host",
          reservedUserId: snapshot.host?.reservedUserId ?? undefined,
        },
      })
    );
  const schedulableCandidates: Array<
    Mt5ClaimSchedulingCandidate<{
      connection: (typeof candidates)[number];
      nextConnectionStatus: "pending" | "active" | "error";
      claimPlacement: Record<string, unknown>;
      claimMode: Mt5ClaimMode;
      enforceLiveLease: boolean;
    }>
  > = [];
  const claimed: Array<{
    connectionId: string;
    provider: string;
    displayName: string;
    status: string;
    accountId: string | null;
    hostId: string;
    workerId: string;
    claimPlacement: Record<string, unknown>;
    claimMode: Mt5ClaimMode;
    enforceLiveLease: boolean;
  }> = [];

  for (const connection of candidates) {
    const liveLease = getMt5LiveLeaseSnapshot(connection.meta);
    const policy = resolveMt5ConnectionHostingPolicy({
      userId: connection.userId,
      userTimezone: userTimezoneById.get(connection.userId) ?? null,
      connectionMeta: connection.meta,
    });
    const placement = evaluateMt5HostPlacement({
      policy,
      host: hostProfile,
    });
    if (!placement.eligible) {
      continue;
    }

    const strictGeoPolicy = withStrictMt5HostingGeoPolicy(policy);
    const strictGeoPlacement =
      strictGeoPolicy === policy
        ? placement
        : evaluateMt5HostPlacement({
            policy: strictGeoPolicy,
            host: hostProfile,
          });
    const preferredRegionalHostAvailable =
      strictGeoPolicy !== policy &&
      !strictGeoPlacement.eligible &&
      freshHostProfiles.some((candidateHost) =>
        evaluateMt5HostPlacement({
          policy: strictGeoPolicy,
          host: candidateHost,
        }).eligible
      );
    if (preferredRegionalHostAvailable) {
      continue;
    }

    const session = sessionByConnection.get(connection.id);
    if (isClaimOccupyingSession(session, now)) {
      continue;
    }

    const planKey = planByUserId.get(connection.userId) ?? "student";
    const queueSelection = resolveMt5ClaimQueueSelection(
      connection,
      liveLease,
      now
    );
    if (!queueSelection) {
      continue;
    }

    const concurrentSlotCap = resolveMt5ConcurrentSlotCap(
      planKey,
      queueSelection.claimMode
    );
    if (concurrentSlotCap <= 0) {
      continue;
    }

    const nextSessionStatus =
      connection.status === "active" ? "syncing" : "bootstrapping";
    const nextConnectionStatus = toPlatformConnectionStatus(nextSessionStatus);
    schedulableCandidates.push({
      connectionId: connection.id,
      userId: connection.userId,
      planKey,
      concurrentSlotCap,
      currentActiveSlots: activeSlotCountByUserId.get(connection.userId) ?? 0,
      queueTier: queueSelection.queueTier,
      dueAt: queueSelection.dueAt,
      lastRequestedAt: queueSelection.lastRequestedAt,
      updatedAt: connection.updatedAt,
      connection: {
        connection,
        nextConnectionStatus,
        claimPlacement: strictGeoPlacement.assignment,
        claimMode: queueSelection.claimMode,
        enforceLiveLease: queueSelection.claimMode === "live",
      },
    });
  }

  const selectedCandidates = selectMt5Claims(schedulableCandidates, input.limit);

  for (const candidate of selectedCandidates) {
    const {
      connection,
      nextConnectionStatus,
      claimPlacement,
      claimMode,
      enforceLiveLease,
    } = candidate.connection;
    const claimStatus = connection.status === "active" ? "syncing" : "bootstrapping";
    const claimSessionKey = `${workerId}:${connection.id}`;
    const claimTimestamp = new Date();
    const staleHeartbeatBefore = new Date(claimTimestamp.getTime() - ACTIVE_LEASE_MS);
    const claimSessionMeta = {
      hostId,
      workerId,
      claimPlacement,
      planKey: candidate.planKey,
      claimMode,
      enforceLiveLease,
    };

    const updatedExistingSession = await db
      .update(brokerSession)
      .set({
        accountId: connection.accountId ?? null,
        platform: connection.provider === "mt4-terminal" ? "mt4" : "mt5",
        workerHostId: workerId,
        sessionKey: claimSessionKey,
        status: claimStatus,
        heartbeatAt: claimTimestamp,
        lastError: null,
        meta: claimSessionMeta,
        updatedAt: claimTimestamp,
      })
      .where(
        and(
          eq(brokerSession.connectionId, connection.id),
          or(
            eq(brokerSession.workerHostId, workerId),
            notInArray(brokerSession.status, [
              "bootstrapping",
              "syncing",
              "active",
              "running",
            ]),
            isNull(brokerSession.heartbeatAt),
            lte(brokerSession.heartbeatAt, staleHeartbeatBefore)
          )
        )
      )
      .returning({
        connectionId: brokerSession.connectionId,
      });

    if (updatedExistingSession.length === 0) {
      const insertedSession = await db
        .insert(brokerSession)
        .values({
          connectionId: connection.id,
          accountId: connection.accountId ?? null,
          platform: connection.provider === "mt4-terminal" ? "mt4" : "mt5",
          workerHostId: workerId,
          sessionKey: claimSessionKey,
          status: claimStatus,
          heartbeatAt: claimTimestamp,
          lastError: null,
          meta: claimSessionMeta,
          updatedAt: claimTimestamp,
        })
        .onConflictDoNothing({
          target: brokerSession.connectionId,
        })
        .returning({
          connectionId: brokerSession.connectionId,
        });

      if (insertedSession.length === 0) {
        continue;
      }
    }

    await db
      .update(platformConnection)
      .set({
        status: nextConnectionStatus,
        lastSyncAttemptAt: claimTimestamp,
        meta: clearMt5ForceSyncRequest(
          connection.meta && typeof connection.meta === "object"
            ? (connection.meta as Record<string, unknown>)
            : {},
          { claimedAt: claimTimestamp }
        ),
        updatedAt: claimTimestamp,
      })
      .where(eq(platformConnection.id, connection.id));

    claimed.push({
      connectionId: connection.id,
      provider: connection.provider,
      displayName: connection.displayName,
      status: nextConnectionStatus,
      accountId: connection.accountId ?? null,
      hostId,
      workerId,
      claimPlacement,
      claimMode,
      enforceLiveLease,
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
  const userRow = await db.query.user.findFirst({
    where: eq(userTable.id, connection.userId),
    columns: {
      widgetPreferences: true,
    },
  });
  const userTimezone = getUserTimezoneFromWidgetPreferences(
    userRow?.widgetPreferences
  );
  const enrichedConnectionMeta = mergeMt5ConnectionHostingMeta({
    rawMeta: connectionMeta,
    userId: connection.userId,
    userTimezone,
  });
  const liveLease = getMt5LiveLeaseSnapshot(enrichedConnectionMeta);
  const { mt5LiveLeases: _, ...bootstrapMeta } = enrichedConnectionMeta;

  return {
    connectionId: connection.id,
    provider: connection.provider,
    displayName: connection.displayName,
    accountId: connection.accountId ?? null,
    isPaused: connection.isPaused,
    credentials,
    meta: {
      ...bootstrapMeta,
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
    liveLease: {
      active: liveLease.active,
      activeHolderCount: liveLease.activeHolderCount,
      lastHeartbeatAt: liveLease.lastHeartbeatAt,
      leaseUntil: liveLease.leaseUntil,
    },
  } satisfies MtWorkerBootstrapPayload;
}

export async function reportMtConnectionStatus(input: {
  connectionId: string;
  workerHostId: string;
  hostId?: string;
  workerId?: string;
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
  const workerId = input.workerId ?? input.workerHostId;
  const currentSession = await db.query.brokerSession.findFirst({
    where: eq(brokerSession.connectionId, input.connectionId),
  });
  if (
    !canMtWorkerTakeSessionOwnership(
      currentSession,
      workerId,
      Date.now()
    )
  ) {
    return {
      success: true,
      ignored: true,
    };
  }
  const sessionMeta = {
    ...(input.meta ?? {}),
    hostId: input.hostId ?? null,
    workerId,
  };

  await db
    .insert(brokerSession)
    .values({
      connectionId: input.connectionId,
      accountId: connection.accountId ?? null,
      platform: connection.provider === "mt4-terminal" ? "mt4" : "mt5",
      workerHostId: workerId,
      sessionKey: input.sessionKey ?? null,
      status: input.status,
      heartbeatAt: new Date(),
      lastError: input.lastError ?? null,
      meta: sessionMeta,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: brokerSession.connectionId,
      set: {
        accountId: connection.accountId ?? null,
        platform: connection.provider === "mt4-terminal" ? "mt4" : "mt5",
        workerHostId: workerId,
        sessionKey: input.sessionKey ?? null,
        status: input.status,
        heartbeatAt: new Date(),
        lastError: input.lastError ?? null,
        meta: sessionMeta,
        updatedAt: new Date(),
      },
    });

  await db
    .update(platformConnection)
    .set({
      status: toPlatformConnectionStatus(input.status, input.lastError),
      lastError: input.lastError ?? null,
      updatedAt: new Date(),
      meta: sanitizeConnectionMeta({
        ...currentMeta,
        mt5Worker: {
          workerHostId: workerId,
          reportedAt: new Date().toISOString(),
          ...sessionMeta,
        },
      }),
    })
    .where(eq(platformConnection.id, input.connectionId));

  return {
    success: true,
  };
}
