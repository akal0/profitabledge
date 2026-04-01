export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function coalesce<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value != null) {
      return value;
    }
  }

  return null;
}

export function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function pickString(
  source: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

export function pickBoolean(
  source: Record<string, unknown>,
  keys: string[]
): boolean | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return value !== 0;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "yes", "1", "active", "live"].includes(normalized)) {
        return true;
      }

      if (["false", "no", "0", "inactive", "demo"].includes(normalized)) {
        return false;
      }
    }
  }

  return null;
}

export function parseNumberValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  let normalized = value.trim();
  if (!normalized) {
    return null;
  }

  let negative = false;
  if (normalized.startsWith("(") && normalized.endsWith(")")) {
    negative = true;
    normalized = normalized.slice(1, -1);
  }

  normalized = normalized
    .replace(/[$,%]/g, "")
    .replace(/\s+/g, "")
    .replace(/,/g, "");

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return negative ? -parsed : parsed;
}

export function pickNumber(
  source: Record<string, unknown>,
  keys: string[]
): number | null {
  for (const key of keys) {
    const parsed = parseNumberValue(source[key]);
    if (parsed != null) {
      return parsed;
    }
  }

  return null;
}

export function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const epochMs = value > 10_000_000_000 ? value : value * 1000;
    const parsed = new Date(epochMs);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    return parseDateValue(numeric);
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const dotted = trimmed.replace(
    /^(\d{4})\.(\d{2})\.(\d{2})/, 
    "$1-$2-$3"
  );
  const dottedDate = new Date(dotted);
  return Number.isNaN(dottedDate.getTime()) ? null : dottedDate;
}

export function pickDate(
  source: Record<string, unknown>,
  keys: string[]
): Date | null {
  for (const key of keys) {
    const parsed = parseDateValue(source[key]);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function extractNestedRecordList(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value
      .map(asRecord)
      .filter((entry): entry is Record<string, unknown> => Boolean(entry));
  }

  const record = asRecord(value);
  if (!record) {
    return [];
  }

  const nestedKeys = [
    "items",
    "data",
    "results",
    "accounts",
    "positions",
    "orders",
    "trades",
    "fills",
    "rows",
  ];

  for (const key of nestedKeys) {
    const candidate = record[key];
    if (Array.isArray(candidate)) {
      return candidate
        .map(asRecord)
        .filter((entry): entry is Record<string, unknown> => Boolean(entry));
    }
  }

  return [];
}

export function extractRecordList(
  value: unknown,
  candidateKeys: string[] = []
): Record<string, unknown>[] {
  const direct = extractNestedRecordList(value);
  if (direct.length > 0) {
    return direct;
  }

  const record = asRecord(value);
  if (!record) {
    return [];
  }

  for (const key of candidateKeys) {
    const nested = extractNestedRecordList(record[key]);
    if (nested.length > 0) {
      return nested;
    }
  }

  return [];
}

export function extractErrorMessage(
  value: unknown,
  fallback: string
): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  const record = asRecord(value);
  if (!record) {
    return fallback;
  }

  return (
    pickString(record, [
      "error_description",
      "errorMessage",
      "message",
      "detail",
      "error",
    ]) ?? fallback
  );
}

export function getSetCookieValues(headers: Headers): string[] {
  const extendedHeaders = headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof extendedHeaders.getSetCookie === "function") {
    return extendedHeaders.getSetCookie();
  }

  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

export function parseCookieHeader(setCookieValues: string[]): Record<string, string> {
  const cookies: Record<string, string> = {};

  for (const value of setCookieValues) {
    const [nameValue] = value.split(";");
    const separatorIndex = nameValue.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const name = nameValue.slice(0, separatorIndex).trim();
    const cookieValue = nameValue.slice(separatorIndex + 1).trim();
    if (name && cookieValue) {
      cookies[name] = cookieValue;
    }
  }

  return cookies;
}

export function serializeCookies(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}
