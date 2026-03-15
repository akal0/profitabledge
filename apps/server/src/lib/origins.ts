function parseOriginList(value: string | undefined | null) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function getAllowedWebOrigins() {
  const origins = new Set<string>(["http://localhost:3001"]);

  for (const origin of parseOriginList(process.env.CORS_ORIGIN)) {
    origins.add(origin);
  }

  const envCandidates = [process.env.WEB_URL, process.env.NEXT_PUBLIC_WEB_URL]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  for (const origin of envCandidates) {
    origins.add(origin.replace(/\/$/, ""));
  }

  return [...origins];
}
