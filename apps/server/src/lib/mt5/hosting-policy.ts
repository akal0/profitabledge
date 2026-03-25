import { z } from "zod";

const HOSTING_POLICY_VERSION = "2026-03-24.1";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeOptionalString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function normalizeCountryCode(value: unknown) {
  const normalized = normalizeOptionalString(value);
  return normalized ? normalized.toUpperCase() : null;
}

function normalizeRegionGroup(value: unknown) {
  const normalized = normalizeOptionalString(value)?.toLowerCase();
  if (!normalized) {
    return null;
  }

  switch (normalized) {
    case "na":
    case "north-america":
    case "north america":
      return "north-america";
    case "latam":
    case "south-america":
    case "south america":
      return "south-america";
    case "eu":
    case "europe":
      return "europe";
    case "asia":
      return "asia";
    case "apac":
    case "asia-pacific":
    case "asia pacific":
      return "asia-pacific";
    case "mea":
    case "middle-east":
    case "middle east":
    case "middle-east-africa":
    case "middle east africa":
    case "africa":
      return "middle-east-africa";
    case "anz":
    case "oceania":
    case "australia":
      return "oceania";
    default:
      return normalized;
  }
}

function normalizeRegionGroupArray(value: unknown) {
  return uniqueStrings(
    normalizeStringArray(value).map((entry) => normalizeRegionGroup(entry))
  );
}

const SOUTH_AMERICA_TIMEZONES = new Set([
  "argentina",
  "araguaina",
  "asuncion",
  "bahia",
  "belem",
  "bogota",
  "buenos_aires",
  "campo_grande",
  "caracas",
  "cayenne",
  "cuiaba",
  "fortaleza",
  "godthab",
  "guayaquil",
  "guyana",
  "la_paz",
  "lima",
  "maceio",
  "manaus",
  "montevideo",
  "paramaribo",
  "porto_velho",
  "recife",
  "rio_branco",
  "santarem",
  "santiago",
  "sao_paulo",
]);

export function inferRegionGroupFromTimezone(timezone: string | null | undefined) {
  const normalized = normalizeOptionalString(timezone);
  if (!normalized || normalized === "UTC" || normalized === "Etc/UTC") {
    return null;
  }

  if (normalized.startsWith("Europe/")) {
    return "europe";
  }

  if (normalized.startsWith("Asia/")) {
    if (
      normalized.startsWith("Asia/Dubai") ||
      normalized.startsWith("Asia/Riyadh") ||
      normalized.startsWith("Asia/Qatar") ||
      normalized.startsWith("Asia/Kuwait")
    ) {
      return "middle-east-africa";
    }

    return "asia";
  }

  if (normalized.startsWith("Africa/")) {
    return "middle-east-africa";
  }

  if (
    normalized.startsWith("Australia/") ||
    normalized === "Pacific/Auckland" ||
    normalized === "Pacific/Fiji"
  ) {
    return "oceania";
  }

  if (normalized.startsWith("America/")) {
    const parts = normalized.toLowerCase().split("/");
    const americaRegion = parts[1] ?? "";
    const city = parts[parts.length - 1] ?? "";
    return SOUTH_AMERICA_TIMEZONES.has(city)
      || SOUTH_AMERICA_TIMEZONES.has(americaRegion)
      ? "south-america"
      : "north-america";
  }

  return null;
}

function inferRegionGroupFromCountryCode(countryCode: string | null | undefined) {
  const normalized = normalizeCountryCode(countryCode);
  if (!normalized) {
    return null;
  }

  if (["CA", "US", "MX"].includes(normalized)) {
    return "north-america";
  }

  if (
    [
      "AR",
      "BO",
      "BR",
      "CL",
      "CO",
      "EC",
      "GY",
      "PE",
      "PY",
      "SR",
      "UY",
      "VE",
    ].includes(normalized)
  ) {
    return "south-america";
  }

  if (
    [
      "GB",
      "IE",
      "FR",
      "DE",
      "NL",
      "ES",
      "IT",
      "PT",
      "PL",
      "CZ",
      "AT",
      "CH",
      "SE",
      "NO",
      "DK",
      "FI",
      "RO",
      "HU",
      "GR",
    ].includes(normalized)
  ) {
    return "europe";
  }

  if (["AU", "NZ"].includes(normalized)) {
    return "oceania";
  }

  if (["AE", "QA", "KW", "SA", "ZA", "NG", "KE", "EG", "MA"].includes(normalized)) {
    return "middle-east-africa";
  }

  return "asia";
}

function normalizeTag(tag: string) {
  return tag.trim();
}

function parseReservedUserIdFromTags(tags: string[]) {
  for (const tag of tags) {
    if (tag.startsWith("user:")) {
      return tag.slice("user:".length).trim() || null;
    }
    if (tag.startsWith("trader:")) {
      return tag.slice("trader:".length).trim() || null;
    }
  }

  return null;
}

export const mt5ClaimHostSchema = z.object({
  label: z.string().min(1).optional(),
  environment: z.string().min(1).optional(),
  provider: z.string().min(1).nullable().optional(),
  region: z.string().min(1).nullable().optional(),
  regionGroup: z.string().min(1).nullable().optional(),
  countryCode: z.string().min(2).max(8).nullable().optional(),
  city: z.string().min(1).nullable().optional(),
  timezone: z.string().min(1).nullable().optional(),
  publicIp: z.string().min(1).nullable().optional(),
  tags: z.array(z.string().min(1)).optional().default([]),
  deviceIsolationMode: z
    .enum(["dedicated-user-host", "shared-host"])
    .optional(),
  reservedUserId: z.string().min(1).nullable().optional(),
});

export type Mt5ClaimHostInput = z.infer<typeof mt5ClaimHostSchema>;

export interface Mt5ConnectionHostingPolicy {
  version: string;
  ownerUserId: string;
  traderTimezone: string | null;
  preferredRegionGroups: string[];
  preferredHostCountries: string[];
  requiredHostTags: string[];
  deviceIsolationMode: "dedicated-user-host" | "shared-host";
  stickyHostId: string | null;
  geoEnforcement: "strict" | "best-effort";
}

export interface Mt5HostProfile {
  hostId: string;
  label: string | null;
  environment: string | null;
  provider: string | null;
  region: string | null;
  regionGroup: string | null;
  countryCode: string | null;
  city: string | null;
  timezone: string | null;
  publicIp: string | null;
  tags: string[];
  reservedUserId: string | null;
  deviceIsolationMode: "dedicated-user-host" | "shared-host";
  deviceIdentityKey: string;
}

export function withStrictMt5HostingGeoPolicy(
  policy: Mt5ConnectionHostingPolicy
): Mt5ConnectionHostingPolicy {
  if (
    policy.preferredHostCountries.length === 0 &&
    policy.preferredRegionGroups.length === 0
  ) {
    return policy;
  }

  return {
    ...policy,
    geoEnforcement: "strict",
  };
}

export function getUserTimezoneFromWidgetPreferences(widgetPreferences: unknown) {
  const preferences = asRecord(widgetPreferences);
  return normalizeOptionalString(preferences?.timezone);
}

export function resolveMt5ConnectionHostingPolicy(input: {
  userId: string;
  userTimezone?: string | null;
  connectionMeta: unknown;
}): Mt5ConnectionHostingPolicy {
  const meta = asRecord(input.connectionMeta) ?? {};
  const hosting = asRecord(meta.mt5Hosting) ?? {};
  const traderTimezone =
    normalizeOptionalString(hosting.traderTimezone) ?? input.userTimezone ?? null;
  const preferredHostCountries = uniqueStrings(
    normalizeStringArray(hosting.preferredHostCountries).map((entry) =>
      normalizeCountryCode(entry)
    )
  );
  const preferredRegionGroups = normalizeRegionGroupArray(
    hosting.preferredRegionGroups
  );
  const inferredRegionGroup = inferRegionGroupFromTimezone(traderTimezone);
  const normalizedPreferredRegionGroups =
    preferredRegionGroups.length > 0
      ? preferredRegionGroups
      : inferredRegionGroup
        ? [inferredRegionGroup]
        : [];
  const explicitDeviceIsolationMode =
    normalizeOptionalString(hosting.deviceIsolationMode) ?? null;
  const deviceIsolationMode =
    explicitDeviceIsolationMode === "dedicated-user-host"
      ? "dedicated-user-host"
      : "shared-host";
  const requiredHostTags = uniqueStrings(
    normalizeStringArray(hosting.requiredHostTags).map((tag) => normalizeTag(tag))
  );
  const geoEnforcementRaw =
    normalizeOptionalString(hosting.geoEnforcement)?.toLowerCase() ?? null;
  const geoEnforcement =
    geoEnforcementRaw === "best-effort"
      ? "best-effort"
      : preferredHostCountries.length > 0 || normalizedPreferredRegionGroups.length > 0
        ? "strict"
        : "best-effort";

  return {
    version: HOSTING_POLICY_VERSION,
    ownerUserId: input.userId,
    traderTimezone,
    preferredRegionGroups: normalizedPreferredRegionGroups,
    preferredHostCountries,
    requiredHostTags,
    deviceIsolationMode,
    stickyHostId: normalizeOptionalString(hosting.stickyHostId),
    geoEnforcement,
  };
}

export function mergeMt5ConnectionHostingMeta(input: {
  rawMeta?: Record<string, unknown> | null;
  userId: string;
  userTimezone?: string | null;
}): Record<string, unknown> {
  const rawMeta = input.rawMeta ?? {};
  const existingHosting = asRecord(rawMeta.mt5Hosting) ?? {};
  const policy = resolveMt5ConnectionHostingPolicy({
    userId: input.userId,
    userTimezone: input.userTimezone,
    connectionMeta: rawMeta,
  });

  return {
    ...rawMeta,
    mt5Hosting: {
      ...existingHosting,
      version: policy.version,
      ownerUserId: policy.ownerUserId,
      traderTimezone: policy.traderTimezone,
      preferredRegionGroups: policy.preferredRegionGroups,
      preferredHostCountries: policy.preferredHostCountries,
      requiredHostTags: policy.requiredHostTags,
      deviceIsolationMode: policy.deviceIsolationMode,
      stickyHostId: policy.stickyHostId,
      geoEnforcement: policy.geoEnforcement,
    },
  };
}

export function resolveMt5ClaimHostProfile(input: {
  hostId: string;
  host?: Mt5ClaimHostInput | null;
}): Mt5HostProfile {
  const host: Mt5ClaimHostInput = input.host ?? { tags: [] };
  const tags = uniqueStrings(
    (host.tags ?? []).map((tag: string) => normalizeTag(tag))
  );
  const countryCode = normalizeCountryCode(host.countryCode);
  const timezone = normalizeOptionalString(host.timezone);
  const explicitRegionGroup = normalizeRegionGroup(host.regionGroup);
  const reservedUserId =
    normalizeOptionalString(host.reservedUserId) ?? parseReservedUserIdFromTags(tags);
  const deviceIsolationMode =
    host.deviceIsolationMode === "dedicated-user-host"
      ? "dedicated-user-host"
      : "shared-host";

  return {
    hostId: input.hostId,
    label: normalizeOptionalString(host.label),
    environment: normalizeOptionalString(host.environment),
    provider: normalizeOptionalString(host.provider),
    region: normalizeOptionalString(host.region),
    regionGroup:
      explicitRegionGroup ??
      inferRegionGroupFromCountryCode(countryCode) ??
      inferRegionGroupFromTimezone(timezone),
    countryCode,
    city: normalizeOptionalString(host.city),
    timezone,
    publicIp: normalizeOptionalString(host.publicIp),
    tags,
    reservedUserId,
    deviceIsolationMode,
    deviceIdentityKey: `host:${input.hostId}`,
  };
}

export function evaluateMt5HostPlacement(input: {
  policy: Mt5ConnectionHostingPolicy;
  host: Mt5HostProfile;
}) {
  const { policy, host } = input;
  const reasons: string[] = [];

  if (policy.stickyHostId && policy.stickyHostId !== host.hostId) {
    reasons.push("sticky-host-mismatch");
  }

  const missingHostTags = policy.requiredHostTags.filter(
    (tag) => !host.tags.includes(tag)
  );
  if (missingHostTags.length > 0) {
    reasons.push(`missing-host-tags:${missingHostTags.join(",")}`);
  }

  if (
    policy.deviceIsolationMode === "dedicated-user-host" &&
    host.deviceIsolationMode !== "dedicated-user-host"
  ) {
    reasons.push("shared-host-disallowed");
  }

  if (policy.preferredHostCountries.length > 0) {
    if (!host.countryCode && policy.geoEnforcement === "strict") {
      reasons.push("host-country-unknown");
    } else if (
      policy.geoEnforcement === "strict" &&
      host.countryCode &&
      !policy.preferredHostCountries.includes(host.countryCode)
    ) {
      reasons.push("country-mismatch");
    }
  }

  if (policy.preferredRegionGroups.length > 0) {
    if (!host.regionGroup && policy.geoEnforcement === "strict") {
      reasons.push("host-region-group-unknown");
    } else if (
      policy.geoEnforcement === "strict" &&
      host.regionGroup &&
      !policy.preferredRegionGroups.includes(host.regionGroup)
    ) {
      reasons.push("region-group-mismatch");
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    assignment: {
      policyVersion: policy.version,
      hostId: host.hostId,
      hostRegion: host.region,
      hostRegionGroup: host.regionGroup,
      hostCountryCode: host.countryCode,
      hostTimezone: host.timezone,
      publicIp: host.publicIp,
      deviceIsolationMode: policy.deviceIsolationMode,
      deviceIdentityKey: host.deviceIdentityKey,
      traderTimezone: policy.traderTimezone,
    },
  };
}
