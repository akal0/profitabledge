import catalog from "./trading-catalog-data";

export type TradingEntityStatus =
  | "active"
  | "shutdown"
  | "suspended"
  | "rebranded";

export type BrokerCategory = "cfd" | "futures" | "crypto";
export type PropFirmCategory = "cfd" | "futures" | "stocks" | "crypto" | "multi";
export type PlatformCategory = "platform";

export type BrokerCatalogEntry = {
  id: string;
  name: string;
  displayName: string;
  website: string;
  logo: string;
  type: "broker";
  category: BrokerCategory;
  status: "active";
  platforms: string[];
  regulated: boolean;
  regulators: string[];
  headquarters: string;
  assetClasses: string[];
  serverPatterns: string[];
  aliases: string[];
  popular?: boolean;
  note?: string | null;
};

export type PropFirmCatalogEntry = {
  id: string;
  name: string;
  displayName: string;
  website: string;
  logo: string;
  type: "prop-firm";
  category: PropFirmCategory;
  status: TradingEntityStatus;
  description: string;
  supportedPlatforms: string[];
  brokerDetectionPatterns: string[];
  challengeTypes: string[];
  payoutSplit: string;
  accountSizes: number[];
  aliases: string[];
  popular?: boolean;
  notes?: string | null;
};

export type PlatformCatalogEntry = {
  id: string;
  name: string;
  displayName: string;
  logo: string;
  type: "platform";
  category: PlatformCategory;
  aliases: string[];
  website: string;
};

type TradingCatalogJson = {
  generatedAt: string;
  brokers: BrokerCatalogEntry[];
  propFirms: PropFirmCatalogEntry[];
  platforms: PlatformCatalogEntry[];
  popularBrokerIds: string[];
  popularPropFirmIds: string[];
};

const typedCatalog = catalog as TradingCatalogJson;

export const TRADING_CATALOG_GENERATED_AT = typedCatalog.generatedAt;
export const BROKER_CATALOG = typedCatalog.brokers;
export const PROP_FIRM_CATALOG = typedCatalog.propFirms;
export const PLATFORM_CATALOG = typedCatalog.platforms;
export const POPULAR_BROKER_IDS = typedCatalog.popularBrokerIds;
export const POPULAR_PROP_FIRM_IDS = typedCatalog.popularPropFirmIds;

export const ACTIVE_BROKER_CATALOG = BROKER_CATALOG.filter(
  (broker) => broker.status === "active"
);

export const ACTIVE_PROP_FIRM_CATALOG = PROP_FIRM_CATALOG.filter(
  (firm) => firm.status === "active"
);

export type TradingSelectorEntry =
  | BrokerCatalogEntry
  | PropFirmCatalogEntry
  | PlatformCatalogEntry;

export const TRADING_SELECTOR_CATALOG: TradingSelectorEntry[] = [
  ...ACTIVE_PROP_FIRM_CATALOG,
  ...ACTIVE_BROKER_CATALOG,
  ...PLATFORM_CATALOG,
];

export function normalizeTradingCatalogKey(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
