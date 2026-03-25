type UnknownRecord = Record<string, unknown>;

const MT5_QUEUE_STATE_KEY = "mt5Queue";
const MT5_FORCE_SYNC_REQUESTED_AT_KEY = "forceSyncRequestedAt";
const MT5_FORCE_SYNC_REASON_KEY = "forceSyncReason";
const MT5_LAST_CLAIMED_AT_KEY = "lastClaimedAt";

export interface Mt5ForceSyncRequest {
  requestedAt: string;
  reason: string | null;
}

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as UnknownRecord;
}

function normalizeIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export function getMt5ForceSyncRequest(meta: unknown): Mt5ForceSyncRequest | null {
  const connectionMeta = asRecord(meta);
  const queueState = asRecord(connectionMeta?.[MT5_QUEUE_STATE_KEY]);
  const requestedAt = normalizeIsoTimestamp(
    queueState?.[MT5_FORCE_SYNC_REQUESTED_AT_KEY]
  );

  if (!requestedAt) {
    return null;
  }

  return {
    requestedAt,
    reason:
      typeof queueState?.[MT5_FORCE_SYNC_REASON_KEY] === "string"
        ? queueState[MT5_FORCE_SYNC_REASON_KEY]
        : null,
  };
}

export function withMt5ForceSyncRequest(
  meta: Record<string, unknown> | null | undefined,
  input: {
    requestedAt?: Date;
    reason?: string | null;
  }
) {
  const nextMeta = meta ? { ...meta } : {};
  const queueState = asRecord(nextMeta[MT5_QUEUE_STATE_KEY]);

  nextMeta[MT5_QUEUE_STATE_KEY] = {
    ...(queueState ?? {}),
    [MT5_FORCE_SYNC_REQUESTED_AT_KEY]: (
      input.requestedAt ?? new Date()
    ).toISOString(),
    [MT5_FORCE_SYNC_REASON_KEY]: input.reason?.trim() || null,
  };

  return nextMeta;
}

export function clearMt5ForceSyncRequest(
  meta: Record<string, unknown> | null | undefined,
  input?: {
    claimedAt?: Date;
  }
) {
  const nextMeta = meta ? { ...meta } : {};
  const queueState = asRecord(nextMeta[MT5_QUEUE_STATE_KEY]);
  const claimedAt = input?.claimedAt ?? new Date();

  nextMeta[MT5_QUEUE_STATE_KEY] = {
    ...(queueState ?? {}),
    [MT5_FORCE_SYNC_REQUESTED_AT_KEY]: null,
    [MT5_FORCE_SYNC_REASON_KEY]: null,
    [MT5_LAST_CLAIMED_AT_KEY]: claimedAt.toISOString(),
  };

  return nextMeta;
}
