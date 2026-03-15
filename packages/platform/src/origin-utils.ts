export interface OriginCandidateOptions {
  envUrl?: string;
  fallbackPort: number;
  location?: Pick<Location, "protocol" | "hostname">;
}

function isPresent(value: string | undefined): value is string {
  return Boolean(value);
}

export function getOriginCandidates({
  envUrl,
  fallbackPort,
  location,
}: OriginCandidateOptions): string[] {
  if (location) {
    const localhost = `${location.protocol}//localhost:${fallbackPort}`;
    const isLanIp = /^\d+\.\d+\.\d+\.\d+$/.test(location.hostname);
    const lan = isLanIp ? `${location.protocol}//${location.hostname}:${fallbackPort}` : "";
    const ordered = isLanIp ? [envUrl, lan, localhost] : [envUrl, localhost, lan];
    return Array.from(new Set(ordered.filter(isPresent)));
  }

  return [envUrl || `http://localhost:${fallbackPort}`];
}

export function rewriteRequestToBase(
  input: RequestInfo | URL,
  base: string,
  primary: string
): RequestInfo | URL {
  if (typeof input === "string") {
    if (/^https?:\/\//i.test(input)) {
      if (primary && input.startsWith(primary)) {
        return input.replace(primary, base);
      }
      return input;
    }

    return `${base}${input.startsWith("/") ? "" : "/"}${input}`;
  }

  return input;
}
