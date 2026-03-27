function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const TOP_LEVEL_SENSITIVE_KEYS = new Set([
  "password",
  "accessToken",
  "refreshToken",
  "idToken",
  "apiKey",
  "secret",
  "clientSecret",
  "login",
  "serverName",
]);

export function sanitizeConnectionMeta(
  rawMeta: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const meta = asRecord(rawMeta);
  if (!meta) {
    return {};
  }

  const nextMeta = Object.fromEntries(
    Object.entries(meta).filter(([key]) => !TOP_LEVEL_SENSITIVE_KEYS.has(key))
  );

  const mt5Meta = asRecord(nextMeta.mt5);
  if (mt5Meta) {
    const {
      login: _login,
      serverName: _serverName,
      sessionKey: _sessionKey,
      ...safeMt5
    } = mt5Meta;
    nextMeta.mt5 = safeMt5;
  }

  const mt5WorkerMeta = asRecord(nextMeta.mt5Worker);
  if (mt5WorkerMeta) {
    const { sessionKey: _sessionKey, ...safeMt5Worker } = mt5WorkerMeta;
    nextMeta.mt5Worker = safeMt5Worker;
  }

  return nextMeta;
}
