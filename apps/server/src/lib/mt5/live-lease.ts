export const MT5_LIVE_LEASE_HEARTBEAT_MS = 30_000;
export const MT5_LIVE_LEASE_DURATION_MS = 90_000;
export const MT5_LIVE_LEASE_RENEW_THRESHOLD_MS = 45_000;
export const MT5_LIVE_LEASE_ROUTE_MAX_LENGTH = 160;

const MT5_LIVE_LEASES_KEY = "mt5LiveLeases";
const MT5_LIVE_LEASE_HOLDERS_KEY = "holders";

type UnknownRecord = Record<string, unknown>;

export interface Mt5LiveLeaseHolder {
  leaseId: string;
  lastHeartbeatAt: string;
  leaseUntil: string;
  route: string | null;
}

export interface Mt5LiveLeaseSnapshot {
  active: boolean;
  activeHolderCount: number;
  lastHeartbeatAt: string | null;
  leaseUntil: string | null;
  holders: Record<string, Mt5LiveLeaseHolder>;
  activeHolders: Mt5LiveLeaseHolder[];
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

export function normalizeMt5LiveLeaseRoute(route: string | null | undefined) {
  if (typeof route !== "string") {
    return null;
  }

  const trimmed = route.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, MT5_LIVE_LEASE_ROUTE_MAX_LENGTH);
}

function normalizeMt5LiveLeaseHolder(
  leaseId: string,
  value: unknown
): Mt5LiveLeaseHolder | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const lastHeartbeatAt = normalizeIsoTimestamp(record.lastHeartbeatAt);
  const leaseUntil = normalizeIsoTimestamp(record.leaseUntil);

  if (!lastHeartbeatAt || !leaseUntil) {
    return null;
  }

  return {
    leaseId,
    lastHeartbeatAt,
    leaseUntil,
    route: normalizeMt5LiveLeaseRoute(
      typeof record.route === "string" ? record.route : null
    ),
  };
}

export function getMt5LiveLeaseHolders(meta: unknown) {
  const connectionMeta = asRecord(meta);
  const liveLeases = asRecord(connectionMeta?.[MT5_LIVE_LEASES_KEY]);
  const holders = asRecord(liveLeases?.[MT5_LIVE_LEASE_HOLDERS_KEY]);

  if (!holders) {
    return {} as Record<string, Mt5LiveLeaseHolder>;
  }

  const normalized: Record<string, Mt5LiveLeaseHolder> = {};
  for (const [leaseId, holder] of Object.entries(holders)) {
    const parsedHolder = normalizeMt5LiveLeaseHolder(leaseId, holder);
    if (parsedHolder) {
      normalized[leaseId] = parsedHolder;
    }
  }

  return normalized;
}

export function getMt5LiveLeaseHolder(meta: unknown, leaseId: string) {
  return getMt5LiveLeaseHolders(meta)[leaseId] ?? null;
}

export function buildMt5LiveLeaseHolder(input: {
  leaseId: string;
  now?: Date;
  route?: string | null;
}): Mt5LiveLeaseHolder {
  const now = input.now ?? new Date();

  return {
    leaseId: input.leaseId,
    lastHeartbeatAt: now.toISOString(),
    leaseUntil: new Date(
      now.getTime() + MT5_LIVE_LEASE_DURATION_MS
    ).toISOString(),
    route: normalizeMt5LiveLeaseRoute(input.route),
  };
}

export function shouldRenewMt5LiveLease(
  holder: Mt5LiveLeaseHolder | null,
  input?: {
    now?: Date;
    route?: string | null;
  }
) {
  if (!holder) {
    return true;
  }

  const now = input?.now ?? new Date();
  const nextRoute = normalizeMt5LiveLeaseRoute(input?.route);
  if (holder.route !== nextRoute) {
    return true;
  }

  return (
    new Date(holder.leaseUntil).getTime() - now.getTime() <=
    MT5_LIVE_LEASE_RENEW_THRESHOLD_MS
  );
}

export function getMt5LiveLeaseSnapshot(
  meta: unknown,
  now: Date = new Date()
): Mt5LiveLeaseSnapshot {
  const holders = getMt5LiveLeaseHolders(meta);
  const nowMs = now.getTime();
  const activeHolders = Object.values(holders)
    .filter((holder) => new Date(holder.leaseUntil).getTime() > nowMs)
    .sort(
      (left, right) =>
        new Date(right.leaseUntil).getTime() -
        new Date(left.leaseUntil).getTime()
    );

  const latestHeartbeatAt =
    activeHolders
      .map((holder) => holder.lastHeartbeatAt)
      .sort()
      .at(-1) ?? null;

  return {
    active: activeHolders.length > 0,
    activeHolderCount: activeHolders.length,
    lastHeartbeatAt: latestHeartbeatAt,
    leaseUntil: activeHolders[0]?.leaseUntil ?? null,
    holders,
    activeHolders,
  };
}
