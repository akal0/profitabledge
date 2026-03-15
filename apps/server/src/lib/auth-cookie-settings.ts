function normalizeOrigin(value: string | undefined | null) {
  const normalized = value?.trim().replace(/\/+$/, "");
  return normalized || null;
}

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

export function resolveAuthBaseUrl(env: NodeJS.ProcessEnv = process.env) {
  return (
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
      return !!webOrigin && webOrigin !== authOrigin;
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
