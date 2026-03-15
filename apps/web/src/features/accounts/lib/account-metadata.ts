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
  brokerType?: string | null;
  brokerServer?: string | null;
  accountNumber?: string | number | null;
  lastImportedAt?: string | Date | null;
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

const DEMO_ACCOUNT_NAME = "Demo account";
const DEMO_BROKER = "Profitabledge";
const DEMO_BROKER_SERVER = "Profitabledge-Demo01";
const DEMO_ACCOUNT_PREFIX = "DEMO-";

export function getBrokerImage(broker?: string | null): string {
  switch (broker) {
    case "ftmo":
      return "/brokers/FTMO.png";
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
  if (!account) return "/brokers/FTMO.png";

  const broker = account.broker?.toLowerCase() ?? "";

  // 1. Broker name match
  if (broker.includes("ftmo")) return "/brokers/FTMO.png";
  if (broker.includes("metaquotes")) return "/brokers/mt5.png";
  if (broker.includes("tradovate")) return "/brokers/tradovate.png";

  // 2. Broker type / connection method
  if (account.brokerType === "mt5") return "/brokers/mt5.png";
  if (account.brokerType === "tradovate") return "/brokers/tradovate.png";

  return "/brokers/FTMO.png";
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

  const brokerType = account.brokerType?.toLowerCase();
  const hasImport = Boolean(account.lastImportedAt);

  if (account.verificationLevel === "api_verified") {
    return {
      label: "API synced",
      className: "ring-cyan-500/30 bg-cyan-500/15 text-cyan-300",
    };
  }

  if (accountIsEaSynced(account) || hasVerifiedFlag(account)) {
    if (brokerType === "mt5" || account.brokerServer) {
      return {
        label: "MT5 synced",
        className: "ring-sky-500/30 bg-sky-500/15 text-sky-300",
      };
    }

    if (brokerType === "mt4") {
      return {
        label: "MT4 synced",
        className: "ring-indigo-500/30 bg-indigo-500/15 text-indigo-300",
      };
    }

    return {
      label: "EA synced",
      className: "ring-teal-500/30 bg-teal-500/15 text-teal-300",
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
  return (
    account.name === DEMO_ACCOUNT_NAME &&
    account.broker === DEMO_BROKER &&
    account.brokerServer === DEMO_BROKER_SERVER &&
    String(account.accountNumber || "").startsWith(DEMO_ACCOUNT_PREFIX)
  );
}
