import type { NextRequest } from "next/server";
import { auth } from "./auth";

type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;

const SESSION_CACHE_TTL_MS = Number(
  process.env.SESSION_CACHE_TTL_MS ?? 15_000
);
const SESSION_CACHE_STALE_ON_ERROR_MS = Number(
  process.env.SESSION_CACHE_STALE_ON_ERROR_MS ?? 5 * 60_000
);

const sessionCache = new Map<
  string,
  {
    session: AuthSession;
    freshUntil: number;
    staleUntil: number;
  }
>();
const pendingSessionLookups = new Map<string, Promise<AuthSession>>();

function getSessionCacheKey(req: NextRequest): string | null {
  const cookie = req.headers.get("cookie");
  const authorization = req.headers.get("authorization");

  if (!cookie && !authorization) {
    return null;
  }

  return `${cookie ?? ""}::${authorization ?? ""}`;
}

function isRetryableSessionStoreError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  return (
    message.includes("data transfer quota") ||
    message.includes("HTTP status 402") ||
    message.includes("Unable to connect") ||
    message.includes("ConnectionRefused")
  );
}

function cleanupExpiredSessionCache(now: number) {
  if (sessionCache.size < 512) {
    return;
  }

  for (const [key, value] of sessionCache.entries()) {
    if (value.staleUntil <= now) {
      sessionCache.delete(key);
    }
  }
}

export async function createContext(req: NextRequest) {
  const now = Date.now();
  const cacheKey = getSessionCacheKey(req);
  const cookie = req.headers.get("cookie");
  const authorization = req.headers.get("authorization");

  if (!cacheKey) {
    return {
      session: null,
    };
  }

  const cached = sessionCache.get(cacheKey);
  if (cached && cached.freshUntil > now) {
    return {
      session: cached.session,
    };
  }

  let session: AuthSession;
  try {
    const pending = pendingSessionLookups.get(cacheKey);
    if (pending) {
      session = await pending;
    } else {
      const headers = new Headers();
      if (cookie) {
        headers.set("cookie", cookie);
      }
      if (authorization) {
        headers.set("authorization", authorization);
      }

      const lookup = auth.api
        .getSession({
          headers,
        })
        .finally(() => {
          pendingSessionLookups.delete(cacheKey);
        });
      pendingSessionLookups.set(cacheKey, lookup);
      session = await lookup;
    }
  } catch (error) {
    if (cached && cached.staleUntil > now && isRetryableSessionStoreError(error)) {
      return {
        session: cached.session,
      };
    }
    throw error;
  }

  cleanupExpiredSessionCache(now);
  sessionCache.set(cacheKey, {
    session,
    freshUntil: now + SESSION_CACHE_TTL_MS,
    staleUntil: now + SESSION_CACHE_STALE_ON_ERROR_MS,
  });

  return {
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
