import {
  ACTIVE_BROKER_CATALOG,
  ACTIVE_PROP_FIRM_CATALOG,
  PLATFORM_CATALOG,
  POPULAR_BROKER_IDS,
  POPULAR_PROP_FIRM_IDS,
  normalizeTradingCatalogKey,
} from "@profitabledge/contracts/trading-catalog";
import { PROFITABLEDGE_FAVICON_PATH } from "@/lib/brand-assets";

export type BrokerOption = {
  value: string;
  label: string;
  image: string;
  type: "broker" | "prop-firm" | "platform";
  category:
    | "popular"
    | "prop-cfd"
    | "prop-futures"
    | "prop-stocks"
    | "broker-cfd"
    | "broker-futures"
    | "broker-crypto"
    | "platform";
  aliases: string[];
  serverPatterns?: string[];
  popular?: boolean;
  supportsMultiCsvImport?: boolean;
  supplementalCsvReports?: string[];
};

export type LiveCapabilityAccountLike = {
  isVerified?: number | boolean | null;
  verificationLevel?: string | null;
};

export type AccountSourceBadgeAccountLike = LiveCapabilityAccountLike & {
  name?: string | null;
  broker?: string | null;
  brokerType?: string | null;
  brokerServer?: string | null;
  accountNumber?: string | number | null;
  lastImportedAt?: string | Date | null;
};

export type BrokerSettingsDisplayAccountLike = AccountSourceBadgeAccountLike & {
  preferredDataSource?: string | null;
};

export type AccountSourceBadge = {
  label: string;
  className: string;
};

type DemoWorkspaceAccountLike = {
  name?: string | null;
  broker?: string | null;
  brokerServer?: string | null;
  accountNumber?: string | number | null;
};

const TRADOVATE_SUPPLEMENTAL_REPORTS = [
  "Performance",
  "Position History",
  "Fills",
  "Orders",
  "Cash History",
  "Account Balance History",
];

function optionCategoryFromPropFirm(category: string): BrokerOption["category"] {
  switch (category) {
    case "futures":
      return "prop-futures";
    case "stocks":
      return "prop-stocks";
    default:
      return "prop-cfd";
  }
}

function optionCategoryFromBroker(category: string): BrokerOption["category"] {
  switch (category) {
    case "futures":
      return "broker-futures";
    case "crypto":
      return "broker-crypto";
    default:
      return "broker-cfd";
  }
}

const PLATFORM_OPTION_BLACKLIST = new Set(["tradovate", "ninjatrader", "oanda", "ib"]);

function sortBrokerOptions(options: BrokerOption[]) {
  return [...options].sort((left, right) => left.label.localeCompare(right.label));
}

const POPULAR_OPTION_IDS = new Set([...POPULAR_PROP_FIRM_IDS, ...POPULAR_BROKER_IDS]);

const PROP_FIRM_OPTIONS: BrokerOption[] = sortBrokerOptions(
  ACTIVE_PROP_FIRM_CATALOG.map((firm) => ({
    value: firm.id,
    label: firm.displayName,
    image: firm.logo,
    type: "prop-firm",
    category: optionCategoryFromPropFirm(firm.category),
    aliases: firm.aliases,
    serverPatterns: firm.brokerDetectionPatterns,
    popular: POPULAR_OPTION_IDS.has(firm.id),
  }))
);

const BROKER_ONLY_OPTIONS: BrokerOption[] = sortBrokerOptions(
  ACTIVE_BROKER_CATALOG.map((broker) => ({
    value: broker.id,
    label: broker.displayName,
    image: broker.logo,
    type: "broker",
    category: optionCategoryFromBroker(broker.category),
    aliases: broker.aliases,
    serverPatterns: broker.serverPatterns,
    popular: POPULAR_OPTION_IDS.has(broker.id),
    supportsMultiCsvImport: broker.id === "tradovate",
    supplementalCsvReports:
      broker.id === "tradovate" ? TRADOVATE_SUPPLEMENTAL_REPORTS : undefined,
  }))
);

const PLATFORM_OPTIONS: BrokerOption[] = sortBrokerOptions(
  PLATFORM_CATALOG.filter((platform) => !PLATFORM_OPTION_BLACKLIST.has(platform.id)).map(
    (platform) => ({
      value: platform.id,
      label: platform.displayName,
      image: platform.logo,
      type: "platform",
      category: "platform",
      aliases: platform.aliases,
      serverPatterns: [],
    })
  )
);

export const BROKER_OPTIONS: BrokerOption[] = [
  ...PROP_FIRM_OPTIONS,
  ...BROKER_ONLY_OPTIONS,
  ...PLATFORM_OPTIONS,
];

export const SELECTABLE_BROKER_OPTIONS = BROKER_OPTIONS.filter(
  (option) => option.type !== "platform"
);

const BROKER_OPTIONS_BY_VALUE = new Map(
  BROKER_OPTIONS.map((option) => [option.value, option])
);

const PLATFORM_LOGOS = Object.fromEntries(
  PLATFORM_CATALOG.map((platform) => [platform.id, platform.logo])
) as Record<string, string>;

const DEMO_ACCOUNT_NAMES = new Set(["Profitabledge demo", "Demo account"]);
const DEMO_BROKERS = new Set(["Demo broker", "Profitabledge"]);
const DEMO_BROKER_SERVERS = new Set([
  "Profitabledge-Demo",
  "Profitabledge-Demo01",
]);
const DEMO_ACCOUNT_PREFIXES = ["PE", "DEMO-"];

const BROKER_TYPE_LABELS: Record<string, string> = {
  mt4: "MetaTrader 4",
  mt5: "MetaTrader 5",
  ctrader: "cTrader",
  ib: "Interactive Brokers",
  "match-trader": "Match-Trader",
  oanda: "OANDA",
  dxtrade: "DXtrade",
  tradelocker: "TradeLocker",
  tradovate: "Tradovate",
  topstepx: "TopstepX",
  rithmic: "Rithmic",
  ninjatrader: "NinjaTrader",
  cqg: "CQG",
  tt: "Trading Technologies",
  tradingview: "TradingView",
  other: "Other",
};

const DATA_SOURCE_LABELS: Record<string, string> = {
  dukascopy: "Dukascopy",
  alphavantage: "Alpha Vantage",
  truefx: "TrueFX",
  broker: "Broker",
};

function getNormalizedOptionKeys(option: BrokerOption) {
  return [
    option.value,
    option.label,
    ...option.aliases,
    ...(option.serverPatterns ?? []),
  ].map((value) => normalizeTradingCatalogKey(value));
}

export function findBrokerOption(
  value?: string | null,
  { includePlatforms = true }: { includePlatforms?: boolean } = {}
): BrokerOption | null {
  const normalized = normalizeTradingCatalogKey(value);
  if (!normalized) return null;

  const direct = BROKER_OPTIONS_BY_VALUE.get(String(value || "").trim().toLowerCase());
  if (direct && (includePlatforms || direct.type !== "platform")) {
    return direct;
  }

  for (const option of BROKER_OPTIONS) {
    if (!includePlatforms && option.type === "platform") continue;
    if (getNormalizedOptionKeys(option).includes(normalized)) {
      return option;
    }
  }

  return null;
}

export function findBrokerByServerPattern(
  value?: string | null,
  { includePlatforms = false }: { includePlatforms?: boolean } = {}
): BrokerOption | null {
  const normalized = normalizeTradingCatalogKey(value);
  if (!normalized) return null;

  let bestMatch: BrokerOption | null = null;
  let bestScore = 0;

  for (const option of BROKER_OPTIONS) {
    if (!includePlatforms && option.type === "platform") continue;
    for (const pattern of option.serverPatterns ?? []) {
      const normalizedPattern = normalizeTradingCatalogKey(pattern);
      if (!normalizedPattern) continue;
      if (!normalized.includes(normalizedPattern)) continue;

      const score = normalizedPattern.length;
      if (score > bestScore) {
        bestMatch = option;
        bestScore = score;
      }
    }
  }

  return bestMatch;
}

export function getBrokerImage(
  broker?: string | null,
  brokerType?: string | null,
  brokerServer?: string | null
): string {
  const exact = findBrokerOption(broker);
  if (exact) return exact.image;

  const serverMatch = findBrokerByServerPattern(brokerServer || broker);
  if (serverMatch) return serverMatch.image;

  const platformMatch = findBrokerOption(brokerType);
  if (platformMatch?.type === "platform") {
    return platformMatch.image;
  }

  const normalizedBrokerType = normalizeTradingCatalogKey(brokerType);
  if (normalizedBrokerType && PLATFORM_LOGOS[normalizedBrokerType]) {
    return PLATFORM_LOGOS[normalizedBrokerType];
  }

  return PROFITABLEDGE_FAVICON_PATH;
}

type AccountImageLike = {
  broker?: string | null;
  brokerType?: string | null;
  brokerServer?: string | null;
  verificationLevel?: string | null;
};

/**
 * Returns the image path for an account based on its broker and connection method.
 * - FTMO accounts → FTMO logo
 * - MT5 EA-synced or MT5 connector accounts → MT5 logo
 * - Everything else → FTMO logo as default
 */
export function getAccountImage(account?: AccountImageLike | null): string {
  if (!account) return PROFITABLEDGE_FAVICON_PATH;

  if (normalizeTradingCatalogKey(account.broker) === "demo broker") {
    return PROFITABLEDGE_FAVICON_PATH;
  }

  return getBrokerImage(
    account.broker,
    account.brokerType,
    account.brokerServer
  );
}

export function brokerSupportsMultiCsvImport(broker?: string | null): boolean {
  return findBrokerOption(broker, { includePlatforms: false })
    ?.supportsMultiCsvImport
    ? true
    : false;
}

export function getBrokerLabel(broker?: string | null): string {
  return (
    findBrokerOption(broker, { includePlatforms: false })?.label ??
    broker ??
    "Broker"
  );
}

export function getBrokerSupplementalCsvReports(
  broker?: string | null
): string[] {
  return (
    findBrokerOption(broker, { includePlatforms: false })
      ?.supplementalCsvReports ?? []
  );
}

function normalizeNonEmptyString(value?: string | null): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getBrokerSettingsBrokerLabel(
  account?: BrokerSettingsDisplayAccountLike | null
): string {
  if (!account) return "Broker";

  if (
    isDemoWorkspaceAccount({
      name: account.name,
      broker: account.broker,
      brokerServer: account.brokerServer,
      accountNumber: account.accountNumber,
    })
  ) {
    return "Profitabledge demo";
  }

  const broker = normalizeNonEmptyString(account.broker);
  if (broker) {
    return getBrokerLabel(broker);
  }

  const brokerType = normalizeNonEmptyString(account.brokerType)?.toLowerCase();
  if (brokerType) {
    return BROKER_TYPE_LABELS[brokerType] ?? brokerType;
  }

  return "Broker";
}

export function getBrokerSettingsPlatformLabel(
  account?: BrokerSettingsDisplayAccountLike | null
): string {
  if (!account) return "Platform";

  if (
    isDemoWorkspaceAccount({
      name: account.name,
      broker: account.broker,
      brokerServer: account.brokerServer,
      accountNumber: account.accountNumber,
    })
  ) {
    return "Profitabledge";
  }

  const brokerType = normalizeNonEmptyString(account.brokerType)?.toLowerCase();
  if (brokerType) {
    return BROKER_TYPE_LABELS[brokerType] ?? brokerType;
  }

  return "Other";
}

export function getBrokerSettingsDataSourceLabel(
  account?: BrokerSettingsDisplayAccountLike | null
): string {
  if (!account) return "Data source";

  if (
    isDemoWorkspaceAccount({
      name: account.name,
      broker: account.broker,
      brokerServer: account.brokerServer,
      accountNumber: account.accountNumber,
    })
  ) {
    return "Profitabledge";
  }

  const preferredDataSource = normalizeNonEmptyString(
    account.preferredDataSource
  )?.toLowerCase();
  if (preferredDataSource) {
    return DATA_SOURCE_LABELS[preferredDataSource] ?? preferredDataSource;
  }

  if (
    account.verificationLevel === "api_verified" ||
    account.verificationLevel === "ea_synced" ||
    hasVerifiedFlag(account)
  ) {
    return "Broker";
  }

  return "Dukascopy";
}

function hasVerifiedFlag(account?: LiveCapabilityAccountLike | null): boolean {
  if (!account) return false;

  return typeof account.isVerified === "boolean"
    ? account.isVerified
    : account.isVerified === 1;
}

export function accountSupportsLiveSync(
  account?: LiveCapabilityAccountLike | null
): boolean {
  if (!account) return false;

  return (
    hasVerifiedFlag(account) ||
    account.verificationLevel === "ea_synced" ||
    account.verificationLevel === "api_verified"
  );
}

export function accountIsEaSynced(
  account?: LiveCapabilityAccountLike | null
): boolean {
  if (!account) return false;

  return (
    account.verificationLevel === "ea_synced" ||
    (hasVerifiedFlag(account) && account.verificationLevel !== "api_verified")
  );
}

export function getAccountSourceBadge(
  account?: AccountSourceBadgeAccountLike | null
): AccountSourceBadge {
  if (!account) {
    return {
      label: "Manual",
      className: "ring-white/10 bg-sidebar text-white/50",
    };
  }

  if (
    isDemoWorkspaceAccount({
      name: account.name,
      broker: account.broker,
      brokerServer: account.brokerServer,
      accountNumber: account.accountNumber,
    })
  ) {
    return {
      label: "Demo account",
      className: "ring-violet-500/30 bg-violet-500/15 text-violet-200",
    };
  }

  const brokerType = account.brokerType?.toLowerCase();
  const hasImport = Boolean(account.lastImportedAt);

  if (account.verificationLevel === "api_verified") {
    return {
      label: "Broker sync",
      className: "ring-sky-500/30 bg-sky-500/15 text-sky-300",
    };
  }

  if (accountIsEaSynced(account) || hasVerifiedFlag(account)) {
    return {
      label: "EA synced",
      className:
        brokerType === "mt4"
          ? "ring-indigo-500/30 bg-indigo-500/15 text-indigo-300"
          : "ring-teal-500/30 bg-teal-500/15 text-teal-300",
    };
  }

  if (hasImport) {
    return {
      label: "CSV imported",
      className: "ring-amber-500/30 bg-amber-500/15 text-amber-300",
    };
  }

  return {
    label: "Manual",
    className: "ring-white/10 bg-sidebar text-white/50",
  };
}

export function isDemoWorkspaceAccount(
  account: DemoWorkspaceAccountLike
): boolean {
  const accountNumber = String(account.accountNumber || "");

  return (
    DEMO_ACCOUNT_NAMES.has(String(account.name ?? "")) &&
    DEMO_BROKERS.has(String(account.broker ?? "")) &&
    DEMO_BROKER_SERVERS.has(String(account.brokerServer ?? "")) &&
    DEMO_ACCOUNT_PREFIXES.some((prefix) => accountNumber.startsWith(prefix))
  );
}
