export interface OriginCandidateOptions {
  envUrl?: string;
  fallbackPort: number;
  location?: Pick<Location, "protocol" | "hostname">;
}

function isPresent(value: string | undefined): value is string {
  return Boolean(value);
}

function isLanIp(hostname: string): boolean {
  return /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".test")
  );
}

export function normalizeOriginUrl(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.replace(/\/+$/, "");
}

export function getOriginCandidates({
  envUrl,
  fallbackPort,
  location,
}: OriginCandidateOptions): string[] {
  const normalizedEnvUrl = normalizeOriginUrl(envUrl);

  if (location) {
    const localhost = `${location.protocol}//localhost:${fallbackPort}`;
    const lanHost = isLanIp(location.hostname);
    const localHost = isLocalHostname(location.hostname);
    const lan = lanHost ? `${location.protocol}//${location.hostname}:${fallbackPort}` : "";

    if (!localHost && !lanHost) {
      return normalizedEnvUrl ? [normalizedEnvUrl] : [];
    }

    const ordered = lanHost
      ? [normalizedEnvUrl, lan, localhost]
      : [normalizedEnvUrl, localhost, lan];
    return Array.from(new Set(ordered.filter(isPresent)));
  }

  return [normalizedEnvUrl || `http://localhost:${fallbackPort}`];
}

export function rewriteRequestToBase(
  input: RequestInfo | URL,
  base: string,
  primary: string
): RequestInfo | URL {
  const normalizedBase = normalizeOriginUrl(base) || base;
  const normalizedPrimary = normalizeOriginUrl(primary) || primary;

  if (typeof input === "string") {
    if (/^https?:\/\//i.test(input)) {
      if (normalizedPrimary && input.startsWith(normalizedPrimary)) {
        return input.replace(normalizedPrimary, normalizedBase);
      }
      return input;
    }

    return `${normalizedBase}${input.startsWith("/") ? "" : "/"}${input}`;
  }

  return input;
}
