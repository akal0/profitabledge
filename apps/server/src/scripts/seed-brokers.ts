import { BROKER_CATALOG } from "@profitabledge/contracts/trading-catalog";

export const BROKERS = BROKER_CATALOG.map((broker) => ({
  id: broker.id,
  name: broker.name,
  displayName: broker.displayName,
  website: broker.website,
  logo: broker.logo,
  platforms: broker.platforms,
  regulated: broker.regulated,
  regulators: broker.regulators,
  headquarters: broker.headquarters,
  type: broker.type,
  assetClasses: broker.assetClasses,
  serverPatterns: broker.serverPatterns,
  status: broker.status,
}));

if (import.meta.main) {
  console.log(JSON.stringify(BROKERS, null, 2));
}
