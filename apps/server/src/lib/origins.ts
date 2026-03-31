function normalizeOrigin(value: string | undefined | null) {
  const normalized = value?.trim().replace(/\/+$/, "");
  return normalized || null;
}

const DEFAULT_CLIENT_ORIGINS = [
  "http://localhost:3310",
  "http://127.0.0.1:3310",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:1420",
  "http://127.0.0.1:1420",
  "http://tauri.localhost",
  "https://tauri.localhost",
  "tauri://localhost",
] as const;

const FIRST_PARTY_WEB_HOST_GROUPS = [
  [
    "profitabledge.com",
    "www.profitabledge.com",
    "beta.profitabledge.com",
    "www.beta.profitabledge.com",
  ],
] as const;

function parseOriginList(value: string | undefined | null) {
  return (value ?? "")
    .split(",")
    .map((entry) => normalizeOrigin(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function expandOriginAliases(origin: string) {
  try {
    const url = new URL(origin);

    for (const group of FIRST_PARTY_WEB_HOST_GROUPS) {
      if (!group.includes(url.hostname as (typeof group)[number])) {
        continue;
      }

      return group.map((hostname) => {
        const variant = new URL(origin);
        variant.hostname = hostname;
        return variant.origin;
      });
    }
  } catch {
    // Preserve the normalized input if it is not a valid URL origin.
  }

  return [origin];
}

function addOrigin(origins: Set<string>, origin: string) {
  for (const candidate of expandOriginAliases(origin)) {
    origins.add(candidate);
  }
}

export function getAllowedWebOrigins() {
  const origins = new Set<string>();

  for (const origin of DEFAULT_CLIENT_ORIGINS) {
    addOrigin(origins, origin);
  }

  for (const origin of parseOriginList(process.env.CORS_ORIGIN)) {
    addOrigin(origins, origin);
  }

  const envCandidates = [
    process.env.WEB_URL,
    process.env.NEXT_PUBLIC_WEB_URL,
  ]
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => Boolean(value));

  for (const origin of envCandidates) {
    addOrigin(origins, origin);
  }

  return [...origins];
}

export function isAllowedClientOrigin(origin: string | null | undefined) {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return false;
  }

  return getAllowedWebOrigins().includes(normalizedOrigin);
}

export function buildCorsHeaders(
  origin: string | null | undefined,
  methods = "GET, POST, OPTIONS"
): Record<string, string> {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin || !isAllowedClientOrigin(normalizedOrigin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": normalizedOrigin,
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With, X-Client-Version",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}
