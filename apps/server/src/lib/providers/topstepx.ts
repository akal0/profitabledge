/**
 * TopstepX / ProjectX REST API Provider scaffold.
 *
 * REST + JWT auth: POST /api/Auth/loginKey -> token
 * Used by: Topstep exclusively
 */
import {
  createProviderScaffoldMetadata,
  ScaffoldedTradingProvider,
} from "./scaffold";

export const TOPSTEPX_PROVIDER_INFO = createProviderScaffoldMetadata({
  name: "TopstepX",
  description: "Futures platform. Used by Topstep exclusively.",
  authType: "credentials",
  fields: ["apiKey"],
  status: "coming_soon",
  capabilityNotes: {
    connect: "TopstepX authentication has not been wired into the sync engine yet.",
    fetchHistory:
      "Trade history sync depends on the ProjectX / TopstepX API integration.",
    fetchOpenPositions:
      "Open-position sync depends on the ProjectX / TopstepX API integration.",
    fetchAccountInfo:
      "Account snapshot sync depends on the ProjectX / TopstepX API integration.",
    exchangeCode: "TopstepX does not use an OAuth flow.",
    refreshToken: "TopstepX does not expose refresh-token credentials here.",
  },
});

export class TopstepXProvider extends ScaffoldedTradingProvider {
  constructor() {
    super("TopstepX", TOPSTEPX_PROVIDER_INFO.capabilities);
  }
}
