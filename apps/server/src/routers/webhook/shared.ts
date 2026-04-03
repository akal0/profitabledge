import { createHash } from "crypto";

import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import { db } from "../../db";
import { apiKey } from "../../db/schema/auth";
import { tradingAccount } from "../../db/schema/trading";
import {
  EA_SYNC_REQUIRED_PLAN_MESSAGE,
  getLiveSyncAccessState,
} from "../../lib/billing/ea-sync-access";

type VerifiedApiKeyCacheEntry = {
  userId: string;
  isActive: boolean;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  hasEaSyncAccess: boolean;
  cachedAt: number;
};

const API_KEY_CACHE_TTL_MS = Number(process.env.API_KEY_CACHE_TTL_MS ?? 60_000);
const API_KEY_LAST_USED_UPDATE_MS = Number(
  process.env.API_KEY_LAST_USED_UPDATE_MS ?? 15 * 60_000
);

export const ENABLE_EA_CANDLE_INGESTION =
  process.env.ENABLE_EA_CANDLE_INGESTION !== "false";

const verifiedApiKeyCache = new Map<string, VerifiedApiKeyCacheEntry>();
const pendingApiKeyLookups = new Map<
  string,
  Promise<Omit<VerifiedApiKeyCacheEntry, "cachedAt">>
>();
const pendingApiKeyTouches = new Map<string, Promise<Date>>();

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function cleanupVerifiedApiKeyCache(now: number) {
  if (verifiedApiKeyCache.size < 512) {
    return;
  }

  for (const [key, value] of verifiedApiKeyCache.entries()) {
    if (value.cachedAt + API_KEY_CACHE_TTL_MS <= now) {
      verifiedApiKeyCache.delete(key);
    }
  }
}

function isRetryableApiKeyStoreError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : "";

  return (
    message.includes("data transfer quota") ||
    message.includes("HTTP status 402") ||
    message.includes("Unable to connect") ||
    message.includes("ConnectionRefused")
  );
}

async function loadVerifiedApiKey(
  hash: string
): Promise<Omit<VerifiedApiKeyCacheEntry, "cachedAt">> {
  const result = await db
    .select({
      userId: apiKey.userId,
      isActive: apiKey.isActive,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
    })
    .from(apiKey)
    .where(eq(apiKey.keyHash, hash))
    .limit(1);

  if (!result.length) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid API key",
    });
  }

  const { userId, isActive, expiresAt, lastUsedAt } = result[0];
  const { hasAccess: hasEaSyncAccess } = await getLiveSyncAccessState(userId);

  return {
    userId,
    isActive,
    expiresAt: expiresAt ?? null,
    lastUsedAt: lastUsedAt ?? null,
    hasEaSyncAccess,
  };
}

async function getVerifiedApiKeyRecord(
  hash: string
): Promise<Omit<VerifiedApiKeyCacheEntry, "cachedAt">> {
  const pending = pendingApiKeyLookups.get(hash);
  if (pending) {
    return pending;
  }

  const lookup = loadVerifiedApiKey(hash).finally(() => {
    pendingApiKeyLookups.delete(hash);
  });
  pendingApiKeyLookups.set(hash, lookup);
  return lookup;
}

async function touchApiKeyLastUsed(hash: string, now: number) {
  const pending = pendingApiKeyTouches.get(hash);
  if (pending) {
    return pending;
  }

  const touchTime = new Date(now);
  const update = db
    .update(apiKey)
    .set({ lastUsedAt: touchTime, updatedAt: touchTime })
    .where(eq(apiKey.keyHash, hash))
    .then(() => touchTime)
    .finally(() => {
      pendingApiKeyTouches.delete(hash);
    });
  pendingApiKeyTouches.set(hash, update);
  return update;
}

async function maybeTouchApiKeyLastUsed(
  hash: string,
  now: number,
  fallback: Date | null
) {
  try {
    return await touchApiKeyLastUsed(hash, now);
  } catch (error) {
    if (isRetryableApiKeyStoreError(error)) {
      return fallback;
    }
    throw error;
  }
}

async function requireCurrentWebhookAccess(userId: string) {
  const { hasAccess } = await getLiveSyncAccessState(userId);

  if (!hasAccess) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: EA_SYNC_REQUIRED_PLAN_MESSAGE,
    });
  }
}

export async function verifyApiKey(key: string): Promise<string> {
  const hash = hashApiKey(key);
  const now = Date.now();
  const cached = verifiedApiKeyCache.get(hash);

  if (cached && cached.cachedAt + API_KEY_CACHE_TTL_MS > now) {
    if (!cached.isActive) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "API key has been revoked",
      });
    }

    if (cached.expiresAt && cached.expiresAt.getTime() < now) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "API key has expired",
      });
    }

    await requireCurrentWebhookAccess(cached.userId);

    const shouldTouchLastUsed =
      !cached.lastUsedAt ||
      now - cached.lastUsedAt.getTime() >= API_KEY_LAST_USED_UPDATE_MS;

    if (shouldTouchLastUsed) {
      const touchTime = await maybeTouchApiKeyLastUsed(
        hash,
        now,
        cached.lastUsedAt
      );
      cached.lastUsedAt = touchTime;
      cached.cachedAt = now;
      verifiedApiKeyCache.set(hash, cached);
    }

    return cached.userId;
  }

  const { userId, isActive, expiresAt, lastUsedAt, hasEaSyncAccess } =
    await getVerifiedApiKeyRecord(hash);

  cleanupVerifiedApiKeyCache(now);
  verifiedApiKeyCache.set(hash, {
    userId,
    isActive,
    expiresAt: expiresAt ?? null,
    lastUsedAt: lastUsedAt ?? null,
    hasEaSyncAccess,
    cachedAt: now,
  });

  if (!isActive) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "API key has been revoked",
    });
  }

  if (expiresAt && expiresAt < new Date()) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "API key has expired",
    });
  }

  if (!hasEaSyncAccess) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: EA_SYNC_REQUIRED_PLAN_MESSAGE,
    });
  }

  const shouldTouchLastUsed =
    !lastUsedAt || now - lastUsedAt.getTime() >= API_KEY_LAST_USED_UPDATE_MS;
  const touchedAt = shouldTouchLastUsed
    ? await maybeTouchApiKeyLastUsed(hash, now, lastUsedAt)
    : lastUsedAt;

  verifiedApiKeyCache.set(hash, {
    userId,
    isActive,
    expiresAt: expiresAt ?? null,
    lastUsedAt: touchedAt ?? null,
    hasEaSyncAccess,
    cachedAt: now,
  });

  return userId;
}

export async function findWebhookAccountIdByNumber(
  userId: string,
  accountNumber: string
) {
  const accounts = await db
    .select({ id: tradingAccount.id })
    .from(tradingAccount)
    .where(
      and(
        eq(tradingAccount.userId, userId),
        eq(tradingAccount.accountNumber, accountNumber)
      )
    )
    .limit(1);

  return accounts[0]?.id ?? null;
}

export async function requireWebhookAccountIdByNumber(
  userId: string,
  accountNumber: string
) {
  const accountId = await findWebhookAccountIdByNumber(userId, accountNumber);
  if (accountId) {
    return accountId;
  }

  throw new TRPCError({
    code: "NOT_FOUND",
    message: "Account not found",
  });
}
