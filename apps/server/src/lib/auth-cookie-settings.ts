function normalizeOrigin(value: string | undefined | null) {
  const normalized = value?.trim().replace(/\/+$/, "");
  return normalized || null;
}

const SAME_SITE_FIRST_PARTY_HOST_GROUPS = [
  [
    "profitabledge.com",
    "www.profitabledge.com",
    "beta.profitabledge.com",
    "www.beta.profitabledge.com",
    "api.profitabledge.com",
    "www.api.profitabledge.com",
  ],
] as const;

function toOrigin(value: string | undefined | null) {
  const normalized = normalizeOrigin(value);
  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized).origin;
  } catch {
    return null;
  }
}

function isKnownSameSitePair(left: string, right: string) {
  try {
    const leftUrl = new URL(left);
    const rightUrl = new URL(right);

    if (leftUrl.protocol !== rightUrl.protocol) {
      return false;
    }

    return SAME_SITE_FIRST_PARTY_HOST_GROUPS.some(
      (group) =>
        group.includes(leftUrl.hostname as (typeof group)[number]) &&
        group.includes(rightUrl.hostname as (typeof group)[number])
    );
  } catch {
    return false;
  }
}

function firstNonLocalhostOrigin(csv: string | undefined | null): string | null {
  if (!csv) return null;
  for (const entry of csv.split(",")) {
    const origin = normalizeOrigin(entry);
    if (!origin) continue;
    try {
      const { hostname } = new URL(origin);
      if (hostname !== "localhost" && hostname !== "127.0.0.1") return origin;
    } catch {
      // skip malformed entries
    }
  }
  return null;
}

function firstOrigin(csv: string | undefined | null): string | null {
  if (!csv) return null;
  for (const entry of csv.split(",")) {
    const origin = normalizeOrigin(entry);
    if (!origin) continue;
    try {
      return new URL(origin).origin;
    } catch {
      // skip malformed entries
    }
  }
  return null;
}

function isIgnoredLoopbackOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

export function resolveAuthBaseUrl(env: NodeJS.ProcessEnv = process.env) {
  return (
    normalizeOrigin(env.WEB_URL) ||
    normalizeOrigin(env.NEXT_PUBLIC_WEB_URL) ||
    // In proxy architectures CORS_ORIGIN points at the web app that
    // forwards auth requests, so it represents the origin the browser
    // sees.  Using it here keeps the auth base URL aligned with the web
    // domain, which prevents cookies from being marked cross-origin
    // unnecessarily.
    firstNonLocalhostOrigin(env.CORS_ORIGIN) ||
    firstOrigin(env.CORS_ORIGIN) ||
    normalizeOrigin(env.BETTER_AUTH_URL) ||
    normalizeOrigin(env.NEXT_PUBLIC_SERVER_URL) ||
    "http://localhost:3000"
  );
}

export function getAuthCookieSettings({
  baseUrl,
  allowedWebOrigins,
}: {
  baseUrl: string;
  allowedWebOrigins: string[];
}) {
  const authOrigin = toOrigin(baseUrl);
  const useSecureCookies = authOrigin?.startsWith("https://") === true;
  const hasCrossOriginClient =
    !!authOrigin &&
    allowedWebOrigins.some((origin) => {
      const webOrigin = toOrigin(origin);
      if (!webOrigin || webOrigin === authOrigin) return false;
      if (isKnownSameSitePair(webOrigin, authOrigin)) return false;
      // Ignore local HTTP loopback origins during browser development, but
      // still treat custom desktop schemes as cross-origin so Tauri can send
      // auth cookies on direct API calls.
      if (isIgnoredLoopbackOrigin(webOrigin)) return false;
      return true;
    });

  return {
    useSecureCookies,
    defaultCookieAttributes:
      useSecureCookies && hasCrossOriginClient
        ? {
            sameSite: "none" as const,
            secure: true,
          }
        : undefined,
  };
}
