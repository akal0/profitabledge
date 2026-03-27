import { PROFITABLEDGE_FAVICON_PATH } from "@/lib/brand-assets";

export type BrokerOption = {
  value: string;
  label: string;
  image: string;
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

export const BROKER_OPTIONS: BrokerOption[] = [
  { value: "ftmo", label: "FTMO", image: "/brokers/FTMO.png" },
  { value: "fundingpips", label: "FundingPips", image: "/brokers/FTMO.png" },
  {
    value: "tradovate",
    label: "Tradovate",
    image: "/brokers/tradovate.png",
    supportsMultiCsvImport: true,
    supplementalCsvReports: [
      "Performance",
      "Position History",
      "Fills",
      "Orders",
      "Cash History",
      "Account Balance History",
    ],
  },
  {
    value: "alphacapitalgroup",
    label: "AlphaCapitalGroup",
    image: "/brokers/FTMO.png",
  },
  {
    value: "seacrestfunded",
    label: "SeacrestFunded",
    image: "/brokers/FTMO.png",
  },
];

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
  oanda: "OANDA",
  tradovate: "Tradovate",
  topstepx: "TopstepX",
  rithmic: "Rithmic",
  ninjatrader: "NinjaTrader",
  other: "Other",
};

const DATA_SOURCE_LABELS: Record<string, string> = {
  dukascopy: "Dukascopy",
  alphavantage: "Alpha Vantage",
  truefx: "TrueFX",
  broker: "Broker",
};

export function getBrokerImage(broker?: string | null): string {
  switch (broker?.toLowerCase()) {
    case "ftmo":
      return "/brokers/FTMO.png";
    case "metaquotes":
    case "mt5":
      return "/brokers/mt5.png";
    case "tradovate":
    case "topstepx":
    case "rithmic":
    case "ninjatrader":
      return "/brokers/tradovate.png";
    default:
      return "/brokers/FTMO.png";
  }
}

type AccountImageLike = {
  broker?: string | null;
  brokerType?: string | null;
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

  const broker = account.broker?.toLowerCase() ?? "";

  // 1. Broker name match
  if (broker === "demo broker") return PROFITABLEDGE_FAVICON_PATH;
  if (broker.includes("ftmo")) return "/brokers/FTMO.png";
  if (broker.includes("metaquotes")) return "/brokers/mt5.png";
  if (broker.includes("tradovate")) return "/brokers/tradovate.png";

  // 2. Broker type / connection method
  if (account.brokerType === "mt5") return "/brokers/mt5.png";
  if (
    account.brokerType === "tradovate" ||
    account.brokerType === "topstepx" ||
    account.brokerType === "rithmic" ||
    account.brokerType === "ninjatrader"
  ) {
    return "/brokers/tradovate.png";
  }

  return PROFITABLEDGE_FAVICON_PATH;
}

export function brokerSupportsMultiCsvImport(broker?: string | null): boolean {
  return BROKER_OPTIONS.find((option) => option.value === broker)
    ?.supportsMultiCsvImport
    ? true
    : false;
}

export function getBrokerLabel(broker?: string | null): string {
  return (
    BROKER_OPTIONS.find((option) => option.value === broker)?.label ??
    broker ??
    "Broker"
  );
}

export function getBrokerSupplementalCsvReports(
  broker?: string | null
): string[] {
  return (
    BROKER_OPTIONS.find((option) => option.value === broker)
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
