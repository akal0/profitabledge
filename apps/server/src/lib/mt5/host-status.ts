import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import { brokerWorkerHost } from "../../db/schema/mt5-sync";

const HOST_SNAPSHOT_STALE_MS = 2 * 60 * 1000;

const activeConnectionSchema = z.object({
  connectionId: z.string(),
  lastHeartbeatAt: z.string().nullable().optional(),
  lastSyncedAt: z.string().nullable().optional(),
  sessionKey: z.string().nullable().optional(),
  sessionMeta: z.record(z.string(), z.unknown()).optional().default({}),
});

const hostMetadataSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    machineName: z.string().min(1),
    environment: z.string().min(1),
    provider: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    regionGroup: z.string().nullable().optional(),
    countryCode: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    timezone: z.string().nullable().optional(),
    publicIp: z.string().nullable().optional(),
    tags: z.array(z.string()).optional().default([]),
    deviceIsolationMode: z.string().nullable().optional(),
    reservedUserId: z.string().nullable().optional(),
    deviceIdentityKey: z.string().nullable().optional(),
    deviceProfileId: z.string().nullable().optional(),
    os: z.string().nullable().optional(),
    pythonVersion: z.string().nullable().optional(),
    sessionsRoot: z.string().nullable().optional(),
    statusRoot: z.string().nullable().optional(),
    terminalPath: z.string().nullable().optional(),
    terminalPathMapPatterns: z.array(z.string()).optional().default([]),
  })
  .optional()
  .nullable();

const workerStatusSchema = z
  .object({
    activeConnections: z.array(activeConnectionSchema).optional().default([]),
    lastError: z.string().nullable().optional(),
    phase: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

const workerSnapshotSchema = z.object({
  slot: z.number().int(),
  workerId: z.string(),
  pid: z.number().int().nullable().optional(),
  alive: z.boolean(),
  healthy: z.boolean(),
  startedAt: z.string().nullable().optional(),
  restartCount: z.number().int().optional().default(0),
  lastExitCode: z.number().int().nullable().optional(),
  lastExitAt: z.string().nullable().optional(),
  lastStartError: z.string().nullable().optional(),
  nextRestartAt: z.string().nullable().optional(),
  statusPath: z.string().nullable().optional(),
  statusFresh: z.boolean().optional().default(false),
  status: workerStatusSchema,
  activeConnections: z.array(activeConnectionSchema).optional().default([]),
});

export const mtWorkerHostSnapshotSchema = z.object({
  workerHostId: z.string().min(1),
  ok: z.boolean(),
  status: z.string().min(1),
  startedAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
  uptimeSeconds: z.number().int().nonnegative().optional().default(0),
  desiredChildren: z.number().int().nonnegative(),
  runningChildren: z.number().int().nonnegative(),
  healthyChildren: z.number().int().nonnegative(),
  mode: z.string().min(1),
  host: hostMetadataSchema,
  admin: z
    .object({
      host: z.string(),
      port: z.number().int(),
    })
    .optional(),
  workers: z.array(workerSnapshotSchema).optional().default([]),
});

export type MtWorkerHostSnapshot = z.infer<typeof mtWorkerHostSnapshotSchema>;
export type MtWorkerProcessSnapshot = z.infer<typeof workerSnapshotSchema>;
export type MtWorkerActiveConnectionSnapshot = z.infer<
  typeof activeConnectionSchema
>;

export function isMtWorkerHostSnapshotFresh(lastSeenAt: Date | null | undefined) {
  if (!lastSeenAt) {
    return false;
  }

  return Date.now() - lastSeenAt.getTime() <= HOST_SNAPSHOT_STALE_MS;
}

function parseOptionalDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function deriveHostError(snapshot: MtWorkerHostSnapshot) {
  if (snapshot.ok) {
    return null;
  }

  for (const worker of snapshot.workers) {
    if (worker.lastStartError) {
      return worker.lastStartError;
    }
    if (worker.status?.lastError) {
      return worker.status.lastError;
    }
  }

  return snapshot.status;
}

export async function reportMtWorkerHostSnapshot(
  input: MtWorkerHostSnapshot
) {
  const lastSeenAt = new Date();

  await db
    .insert(brokerWorkerHost)
    .values({
      workerHostId: input.workerHostId,
      mode: input.mode,
      status: input.status,
      desiredChildren: input.desiredChildren,
      runningChildren: input.runningChildren,
      healthyChildren: input.healthyChildren,
      adminHost: input.admin?.host ?? null,
      adminPort: input.admin?.port ?? null,
      startedAt: parseOptionalDate(input.startedAt),
      lastSeenAt,
      lastError: deriveHostError(input),
      meta: input,
      updatedAt: lastSeenAt,
    })
    .onConflictDoUpdate({
      target: brokerWorkerHost.workerHostId,
      set: {
        mode: input.mode,
        status: input.status,
        desiredChildren: input.desiredChildren,
        runningChildren: input.runningChildren,
        healthyChildren: input.healthyChildren,
        adminHost: input.admin?.host ?? null,
        adminPort: input.admin?.port ?? null,
        startedAt: parseOptionalDate(input.startedAt),
        lastSeenAt,
        lastError: deriveHostError(input),
        meta: input,
        updatedAt: lastSeenAt,
      },
    });

  return {
    success: true,
  };
}

export async function listMtWorkerHostSnapshots() {
  const rows = await db.query.brokerWorkerHost.findMany({
    orderBy: desc(brokerWorkerHost.lastSeenAt),
  });

  return rows
    .map((row) => {
      const parsed = mtWorkerHostSnapshotSchema.safeParse(row.meta);
      if (!parsed.success) {
        return null;
      }

      return {
        row,
        snapshot: parsed.data,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

export async function getMtWorkerHostSnapshot(workerHostId: string) {
  const row = await db.query.brokerWorkerHost.findFirst({
    where: eq(brokerWorkerHost.workerHostId, workerHostId),
  });

  if (!row) {
    return null;
  }

  const parsed = mtWorkerHostSnapshotSchema.safeParse(row.meta);
  if (!parsed.success) {
    return null;
  }

  return {
    row,
    snapshot: parsed.data,
  };
}
