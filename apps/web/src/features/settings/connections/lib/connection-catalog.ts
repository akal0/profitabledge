import type { ConnectionProviderDefinition } from "@/features/settings/connections/lib/connection-types";

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
    firms: ["Any MT5 Broker", "FTMO", "FundedNext"],
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
    firms: ["Any MT4 Broker", "FundingPips", "Alpha Capital"],
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
    firms: ["FTMO", "FundedNext", "E8", "FundingPips", "Alpha Capital"],
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
    firms: ["FTMO", "FundedNext", "E8", "Maven"],
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
    firms: ["FTMO", "E8", "Alpha Capital", "DNA Funded"],
    color: "#10B981",
  },
  {
    id: "dxtrade",
    name: "DXTrade",
    category: "forex",
    description: "Used by FundingPips, Alpha Capital, BrightFunded, FundedNext.",
    authType: "credentials",
    fields: ["serverUrl", "login", "password"],
    status: "coming_soon",
    firms: ["FundingPips", "Alpha Capital", "BrightFunded"],
    color: "#F59E0B",
  },
  {
    id: "tradovate",
    name: "Tradovate",
    category: "futures",
    description:
      "Futures platform with REST + WebSocket. Used by Apex Trader Funding, Topstep (legacy).",
    authType: "oauth",
    fields: [],
    status: "coming_soon",
    firms: ["Apex", "Topstep"],
    color: "#EF4444",
  },
  {
    id: "topstepx",
    name: "TopstepX",
    category: "futures",
    description: "Futures trading platform. Used exclusively by Topstep.",
    authType: "credentials",
    fields: ["apiKey"],
    status: "coming_soon",
    firms: ["Topstep"],
    color: "#8B5CF6",
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
