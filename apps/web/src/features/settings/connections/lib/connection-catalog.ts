import type { ConnectionProviderDefinition } from "@/features/settings/connections/lib/connection-types";
import { ACTIVE_PROP_FIRM_CATALOG } from "@profitabledge/contracts/trading-catalog";

function firmsForPlatforms(...platformIds: string[]) {
  const platformSet = new Set(platformIds);

  return ACTIVE_PROP_FIRM_CATALOG.filter((firm) =>
    firm.supportedPlatforms.some((platform) => platformSet.has(platform))
  )
    .map((firm) => firm.displayName)
    .sort((left, right) => left.localeCompare(right));
}

export const PROVIDERS: ConnectionProviderDefinition[] = [
  {
    id: "mt5-terminal",
    name: "MetaTrader 5",
    category: "forex",
    description:
      "Connect with your broker login, password, and server name. Profitabledge runs the terminal worker and syncs history plus live positions without an EA.",
    authType: "credentials",
    fields: ["login", "password", "server"],
    status: "active",
    firms: ["Any MT5 Broker", ...firmsForPlatforms("mt5")],
    color: "#2563EB",
  },
  {
    id: "mt4-terminal",
    name: "MetaTrader 4",
    category: "forex",
    description:
      "Connect with your broker login, password, and server name. MT4 terminal-farm support follows the same model as MT5.",
    authType: "credentials",
    fields: ["login", "password", "server"],
    status: "active",
    firms: ["Any MT4 Broker", ...firmsForPlatforms("mt4")],
    color: "#1D4ED8",
  },
  {
    id: "ctrader",
    name: "cTrader",
    category: "forex",
    description:
      "OAuth2 connection. Used by FTMO, FundedNext, E8 Markets, FundingPips, Alpha Capital, Maven Trading.",
    authType: "oauth",
    fields: [],
    status: "active",
    firms: firmsForPlatforms("ctrader"),
    color: "#00B4D8",
  },
  {
    id: "match-trader",
    name: "Match-Trader",
    category: "forex",
    description:
      "Login with your broker credentials. Used by FTMO, FundedNext, E8 Markets, Maven Trading.",
    authType: "credentials",
    fields: ["serverUrl", "login", "password"],
    status: "active",
    firms: firmsForPlatforms("match-trader"),
    color: "#6366F1",
  },
  {
    id: "tradelocker",
    name: "TradeLocker",
    category: "forex",
    description:
      "Login with email & password. Used by FTMO, E8 Markets, Alpha Capital, DNA Funded, BrightFunded.",
    authType: "credentials",
    fields: ["email", "password", "server"],
    status: "active",
    firms: firmsForPlatforms("tradelocker"),
    color: "#10B981",
  },
  {
    id: "dxtrade",
    name: "DXTrade",
    category: "forex",
    description:
      "Login with your DXTrade server URL, username, and password. Used by FTMO, The5ers, Alpha Capital Group, FXify, and other CFD prop firms.",
    authType: "credentials",
    fields: ["serverUrl", "login", "password"],
    status: "active",
    firms: firmsForPlatforms("dxtrade"),
    color: "#F59E0B",
  },
  {
    id: "tradovate",
    name: "Tradovate",
    category: "futures",
    description:
      "OAuth connection for Tradovate futures accounts. Syncs discovered accounts, closed trades, open positions, and account balances.",
    authType: "oauth",
    fields: [],
    status: "active",
    firms: firmsForPlatforms("tradovate"),
    color: "#EF4444",
  },
  {
    id: "topstepx",
    name: "TopstepX",
    category: "futures",
    description:
      "ProjectX / TopstepX API connection for Topstep futures accounts.",
    authType: "api_key",
    fields: ["username", "apiKey"],
    status: "active",
    firms: firmsForPlatforms("topstepx"),
    color: "#8B5CF6",
  },
  {
    id: "rithmic",
    name: "Rithmic",
    category: "futures",
    description:
      "Protocol-based futures sync for Apex, Bulenox, Earn2Trade, OneUp, and many prop firms. Uses the broker worker path.",
    authType: "credentials",
    fields: ["login", "password", "systemName", "fcmId"],
    status: "active",
    firms: firmsForPlatforms("rithmic"),
    color: "#DC2626",
    betaNote:
      "Worker-host setup is required on the backend before new Rithmic connections can sync live.",
  },
  {
    id: "ninjatrader",
    name: "NinjaTrader",
    category: "futures",
    description:
      "NinjaTrader API keys can be saved now. Live sync is still being finalized, and CSV import remains the current fallback.",
    authType: "api_key",
    fields: ["apiKey"],
    status: "coming_soon",
    firms: firmsForPlatforms("ninjatrader"),
    color: "#0F766E",
    betaNote:
      "Save the API key now from Settings > API keys, then activate live sync once the provider is promoted.",
  },
  {
    id: "tradingview",
    name: "TradingView",
    category: "multi",
    description:
      "TradingView does not expose broker trade history directly. Sync the broker that TradingView is connected to instead.",
    authType: "credentials",
    fields: [],
    status: "not_applicable",
    firms: firmsForPlatforms("tradingview"),
    color: "#2563EB",
    note: "Sync through your broker connection (Tradovate, Rithmic, DXTrade, MT5, and similar).",
  },
];

export const ALPHA_PROVIDERS = PROVIDERS.filter(
  (provider) => provider.status === "active"
);

export const SYNC_INTERVALS = [
  { value: "0", label: "Manual only" },
  { value: "15", label: "Every 15 min" },
  { value: "30", label: "Every 30 min" },
  { value: "60", label: "Every hour" },
  { value: "360", label: "Every 6 hours" },
  { value: "1440", label: "Daily" },
];
