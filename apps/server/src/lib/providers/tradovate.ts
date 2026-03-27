/**
 * Tradovate REST API Provider scaffold.
 *
 * OAuth2 + WebSocket for live data
 * Used by: Apex Trader Funding, Topstep (legacy), SpeedUp Trader
 */
import {
  createProviderScaffoldMetadata,
  ScaffoldedTradingProvider,
} from "./scaffold";

export const TRADOVATE_PROVIDER_INFO = createProviderScaffoldMetadata({
  name: "Tradovate",
  description: "Futures platform. Used by Apex Trader Funding, Topstep (legacy).",
  authType: "oauth",
  fields: [],
  status: "coming_soon",
  capabilityNotes: {
    connect: "Tradovate OAuth and live account lookup are not wired in yet.",
    fetchHistory:
      "Tradovate trade-history sync still needs authenticated REST/WebSocket wiring.",
    fetchOpenPositions:
      "Tradovate position sync still needs authenticated REST/WebSocket wiring.",
    fetchAccountInfo:
      "Tradovate account snapshots still need authenticated REST/WebSocket wiring.",
    exchangeCode: "Tradovate OAuth exchange is not wired in yet.",
    refreshToken: "Tradovate OAuth refresh is not wired in yet.",
  },
});

export class TradovateProvider extends ScaffoldedTradingProvider {
  constructor() {
    super("Tradovate", TRADOVATE_PROVIDER_INFO.capabilities);
  }
}
