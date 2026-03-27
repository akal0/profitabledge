/**
 * DXTrade REST API Provider scaffold.
 *
 * Session cookie auth: POST /dxsca-web/login -> JSESSIONID cookie
 * Used by: FundingPips, Alpha Capital, BrightFunded, FundedNext
 */
import {
  createProviderScaffoldMetadata,
  ScaffoldedTradingProvider,
} from "./scaffold";

export const DXTRADE_PROVIDER_INFO = createProviderScaffoldMetadata({
  name: "DXTrade",
  description: "Used by FundingPips, Alpha Capital, BrightFunded, FundedNext.",
  authType: "credentials",
  fields: ["serverUrl", "login", "password"],
  status: "coming_soon",
  capabilityNotes: {
    connect: "DXTrade login is not wired into the sync engine yet.",
    fetchHistory:
      "Trade history sync depends on the DXTrade session and reporting APIs.",
    fetchOpenPositions:
      "Open-position sync depends on the DXTrade session and reporting APIs.",
    fetchAccountInfo:
      "Account snapshot sync depends on the DXTrade session and reporting APIs.",
    exchangeCode: "DXTrade does not use an OAuth flow.",
    refreshToken: "DXTrade credentials are not refreshed through this scaffold.",
  },
});

export class DXTradeProvider extends ScaffoldedTradingProvider {
  constructor() {
    super("DXTrade", DXTRADE_PROVIDER_INFO.capabilities);
  }
}
