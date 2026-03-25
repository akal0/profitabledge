import type {
  ConnectionRegionOption,
  TerminalHostRow,
} from "./connection-types";

export const MT5_REGION_PREFERENCE_AUTO = "auto";

const REGION_GROUPS = [
  "north-america",
  "south-america",
  "europe",
  "asia",
  "asia-pacific",
  "middle-east-africa",
  "oceania",
] as const;

type RegionGroup = (typeof REGION_GROUPS)[number];

export type Mt5PlacementWarning = {
  title: string;
  description: string;
  confirmLabel: string;
  allowCrossRegionFallback: boolean;
  availableHosts: string[];
  requestedRegionGroup: string | null;
  requestedRegionLabel: string | null;
  preferredRegionGroup: string | null;
  preferredRegionLabel: string | null;
  traderTimezone: string | null;
};

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

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeRegionGroup(value: string | null | undefined) {
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

function asRegionGroup(value: string | null | undefined): RegionGroup | null {
  const normalized = normalizeRegionGroup(value);
  if (!normalized) {
    return null;
  }

  return REGION_GROUPS.includes(normalized as RegionGroup)
    ? (normalized as RegionGroup)
    : null;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function describeHost(host: TerminalHostRow) {
  const location = host.region ?? host.countryCode ?? host.timezone ?? host.label;
  return `${host.label} (${location})`;
}

function getAvailableHosts(hosts: TerminalHostRow[]) {
  return hosts.filter((host) => host.ok && host.healthyChildren > 0);
}

export function getRegionGroupLabel(regionGroup: string | null | undefined) {
  switch (normalizeRegionGroup(regionGroup)) {
    case "north-america":
      return "North America";
    case "south-america":
      return "South America";
    case "europe":
      return "Europe";
    case "asia":
      return "Asia";
    case "asia-pacific":
      return "Asia Pacific";
    case "middle-east-africa":
      return "Middle East / Africa";
    case "oceania":
      return "Oceania";
    default:
      return "your preferred region";
  }
}

export function getMt5RegionOptions(
  hosts: TerminalHostRow[]
): ConnectionRegionOption[] {
  const availableHosts = getAvailableHosts(hosts);

  return [
    {
      value: MT5_REGION_PREFERENCE_AUTO,
      label: "Auto",
      hint: "Use the trader timezone to prefer the closest region",
    },
    ...REGION_GROUPS.map((regionGroup) => {
      const hostCount = availableHosts.filter(
        (host) => normalizeRegionGroup(host.regionGroup) === regionGroup
      ).length;

      return {
        value: regionGroup,
        label: getRegionGroupLabel(regionGroup),
        hint:
          hostCount > 0
            ? `${hostCount} host${hostCount === 1 ? "" : "s"} online`
            : "No hosts online",
      };
    }),
  ];
}

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
    return SOUTH_AMERICA_TIMEZONES.has(city) ||
      SOUTH_AMERICA_TIMEZONES.has(americaRegion)
      ? "south-america"
      : "north-america";
  }

  return null;
}

export function resolveMt5RequestedRegionGroup(input: {
  traderTimezone: string | null;
  selectedRegion: string | null | undefined;
}) {
  const selectedRegion = asRegionGroup(input.selectedRegion);
  if (selectedRegion) {
    return selectedRegion;
  }

  return inferRegionGroupFromTimezone(input.traderTimezone);
}

export function buildMt5ConnectionHostingMeta(input: {
  traderTimezone: string | null;
  selectedRegion?: string | null | undefined;
  allowCrossRegionFallback: boolean;
  existingHosting?: Record<string, unknown> | null;
  warning?: Mt5PlacementWarning | null;
}) {
  const preferredRegionGroup = resolveMt5RequestedRegionGroup({
    traderTimezone: input.traderTimezone,
    selectedRegion: input.selectedRegion,
  });

  return {
    mt5Hosting: {
      ...(input.existingHosting ?? {}),
      traderTimezone: input.traderTimezone,
      preferredRegionGroups: preferredRegionGroup ? [preferredRegionGroup] : [],
      preferredRegionSelection:
        asRegionGroup(input.selectedRegion) ?? MT5_REGION_PREFERENCE_AUTO,
      geoEnforcement: input.allowCrossRegionFallback ? "best-effort" : "strict",
      placementConsent:
        input.warning
          ? {
              acceptedAt: new Date().toISOString(),
              requestedRegionGroup: input.warning.requestedRegionGroup,
              requestedRegionLabel: input.warning.requestedRegionLabel,
              preferredRegionGroup: input.warning.preferredRegionGroup,
              preferredRegionLabel: input.warning.preferredRegionLabel,
              availableHosts: input.warning.availableHosts,
            }
          : undefined,
    },
  } satisfies Record<string, unknown>;
}

export function buildMt5ConnectionMeta(input: {
  baseMeta?: Record<string, unknown>;
  traderTimezone: string | null;
  selectedRegion?: string | null | undefined;
  allowOutOfRegion: boolean;
  warning?: Mt5PlacementWarning | null;
}) {
  const baseMeta = input.baseMeta ?? {};
  const existingHosting =
    baseMeta.mt5Hosting &&
    typeof baseMeta.mt5Hosting === "object" &&
    !Array.isArray(baseMeta.mt5Hosting)
      ? (baseMeta.mt5Hosting as Record<string, unknown>)
      : null;

  return {
    ...baseMeta,
    ...buildMt5ConnectionHostingMeta({
      traderTimezone: input.warning?.traderTimezone ?? input.traderTimezone,
      selectedRegion: input.selectedRegion,
      allowCrossRegionFallback: input.allowOutOfRegion,
      existingHosting,
      warning: input.warning ?? null,
    }),
  } satisfies Record<string, unknown>;
}

export function buildMt5PlacementWarning(input: {
  traderTimezone: string | null;
  selectedRegion?: string | null | undefined;
  hosts: TerminalHostRow[];
}): Mt5PlacementWarning | null {
  const preferredRegionGroup = inferRegionGroupFromTimezone(input.traderTimezone);
  const requestedRegionGroup = resolveMt5RequestedRegionGroup({
    traderTimezone: input.traderTimezone,
    selectedRegion: input.selectedRegion,
  });
  const selectedRegionGroup = asRegionGroup(input.selectedRegion);

  if (!preferredRegionGroup && !requestedRegionGroup) {
    return null;
  }

  const availableHosts = getAvailableHosts(input.hosts);
  const requestedHosts =
    requestedRegionGroup === null
      ? []
      : availableHosts.filter(
          (host) => normalizeRegionGroup(host.regionGroup) === requestedRegionGroup
        );
  const preferredRegionLabel = getRegionGroupLabel(preferredRegionGroup);
  const requestedRegionLabel = getRegionGroupLabel(requestedRegionGroup);
  const availableRegionLabels = uniqueStrings(
    availableHosts.map((host) =>
      normalizeRegionGroup(host.regionGroup)
        ? getRegionGroupLabel(host.regionGroup)
        : null
    )
  );
  const visibleHosts =
    (requestedHosts.length > 0 ? requestedHosts : availableHosts)
      .slice(0, 3)
      .map((host) => describeHost(host));

  if (
    selectedRegionGroup &&
    preferredRegionGroup &&
    selectedRegionGroup !== preferredRegionGroup
  ) {
    const availabilityNote =
      requestedHosts.length === 0
        ? ` We also do not currently have any ${requestedRegionLabel} MT5 hosts online, so this connection may fall back to another region until one is available.`
        : "";
    return {
      title: `Connect to ${requestedRegionLabel} instead of ${preferredRegionLabel}?`,
      description:
        `Your saved or browser timezone maps this trader to ${preferredRegionLabel}, but you selected ${requestedRegionLabel}. ` +
        `If you continue, Profitabledge will prefer that selected region for this MT5 connection.${availabilityNote}`,
      confirmLabel: `Use ${requestedRegionLabel}`,
      allowCrossRegionFallback: requestedHosts.length === 0,
      availableHosts: visibleHosts,
      requestedRegionGroup,
      requestedRegionLabel,
      preferredRegionGroup,
      preferredRegionLabel,
      traderTimezone: input.traderTimezone,
    };
  }

  if (!requestedRegionGroup || requestedHosts.length > 0) {
    return null;
  }

  const availableRegionsText =
    availableRegionLabels.length > 0
      ? ` Available regions: ${availableRegionLabels.join(", ")}.`
      : "";
  const visibleHostsText =
    visibleHosts.length > 0
      ? ` Online hosts: ${visibleHosts.join(", ")}.`
      : "";

  return {
    title: `Connect without a ${requestedRegionLabel} MT5 host?`,
    description:
      `We currently do not have any ${requestedRegionLabel} MT5 servers online for this account.` +
      availableRegionsText +
      visibleHostsText +
      " If you continue, Profitabledge will allow this MT5 connection to run on a different region until a closer host is available.",
    confirmLabel: "Connect anyway",
    allowCrossRegionFallback: true,
    availableHosts: visibleHosts,
    requestedRegionGroup,
    requestedRegionLabel,
    preferredRegionGroup,
    preferredRegionLabel,
    traderTimezone: input.traderTimezone,
  };
}
