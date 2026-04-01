import {
  createProviderScaffoldMetadata,
  ScaffoldedTradingProvider,
} from "./scaffold";

export const NINJATRADER_PROVIDER_INFO = createProviderScaffoldMetadata({
  name: "NinjaTrader",
  description:
    "API-key based NinjaTrader connection flow. Credentials can be saved now while live sync remains in progress.",
  authType: "api_key",
  fields: ["apiKey"],
  status: "coming_soon",
  capabilityNotes: {
    connect:
      "NinjaTrader credentials can be stored now, but live account verification is not wired yet.",
    fetchHistory:
      "Use the NinjaTrader CSV import until the live API endpoints are finalized.",
    fetchOpenPositions:
      "Open-position sync is planned for the NinjaTrader live API path.",
    fetchAccountInfo:
      "Account snapshots are planned for the NinjaTrader live API path.",
    exchangeCode: "NinjaTrader uses API-key authentication for this flow.",
    refreshToken: "NinjaTrader API-key flows do not use OAuth refresh tokens.",
  },
});

export class NinjaTraderProvider extends ScaffoldedTradingProvider {
  constructor() {
    super("NinjaTrader", NINJATRADER_PROVIDER_INFO.capabilities);
  }
}
