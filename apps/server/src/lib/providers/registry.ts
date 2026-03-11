/**
 * Central provider registry. Maps provider string identifiers
 * to lazy factory functions. Providers are only loaded when needed.
 */
import type { TradingProvider } from "./types";
import { MT_TERMINAL_PROVIDERS } from "../mt5/constants";

const providerFactories: Record<string, () => Promise<TradingProvider>> = {
  ctrader: async () => {
    const { CTraderProvider } = await import("./ctrader");
    return new CTraderProvider();
  },
  "match-trader": async () => {
    const { MatchTraderProvider } = await import("./match-trader");
    return new MatchTraderProvider();
  },
  tradelocker: async () => {
    const { TradeLockerProvider } = await import("./tradelocker");
    return new TradeLockerProvider();
  },
  dxtrade: async () => {
    const { DXTradeProvider } = await import("./dxtrade");
    return new DXTradeProvider();
  },
  tradovate: async () => {
    const { TradovateProvider } = await import("./tradovate");
    return new TradovateProvider();
  },
  topstepx: async () => {
    const { TopstepXProvider } = await import("./topstepx");
    return new TopstepXProvider();
  },
};

export async function getProvider(name: string): Promise<TradingProvider> {
  const factory = providerFactories[name];
  if (!factory) {
    throw new Error(
      `Unknown provider: "${name}". Supported: ${Object.keys(providerFactories).join(", ")}`
    );
  }
  return factory();
}

export function getSupportedProviders(): string[] {
  return [...MT_TERMINAL_PROVIDERS, ...Object.keys(providerFactories)];
}

/** Provider display metadata for the frontend. */
export const PROVIDER_INFO: Record<
  string,
  {
    name: string;
    description: string;
    authType: "oauth" | "credentials";
    fields: string[];
    status: "active" | "coming_soon";
  }
> = {
  "mt5-terminal": {
    name: "MetaTrader 5",
    description:
      "Terminal-farm MT5 sync using broker login, password and server.",
    authType: "credentials",
    fields: ["login", "password", "server"],
    status: "active",
  },
  "mt4-terminal": {
    name: "MetaTrader 4",
    description:
      "Terminal-farm MT4 sync using broker login, password and server.",
    authType: "credentials",
    fields: ["login", "password", "server"],
    status: "coming_soon",
  },
  ctrader: {
    name: "cTrader",
    description: "Connect via OAuth2. Used by FTMO, FundedNext, E8 Markets, FundingPips, Alpha Capital, Maven Trading.",
    authType: "oauth",
    fields: [],
    status: "active",
  },
  "match-trader": {
    name: "Match-Trader",
    description: "Connect with login credentials. Used by FTMO, FundedNext, E8 Markets, Maven Trading.",
    authType: "credentials",
    fields: ["serverUrl", "login", "password"],
    status: "active",
  },
  tradelocker: {
    name: "TradeLocker",
    description: "Connect with email & password. Used by FTMO, E8 Markets, Alpha Capital, DNA Funded.",
    authType: "credentials",
    fields: ["email", "password", "server"],
    status: "active",
  },
  dxtrade: {
    name: "DXTrade",
    description: "Used by FundingPips, Alpha Capital, BrightFunded, FundedNext.",
    authType: "credentials",
    fields: ["serverUrl", "login", "password"],
    status: "coming_soon",
  },
  tradovate: {
    name: "Tradovate",
    description: "Futures platform. Used by Apex Trader Funding, Topstep (legacy).",
    authType: "oauth",
    fields: [],
    status: "coming_soon",
  },
  topstepx: {
    name: "TopstepX",
    description: "Futures platform. Used by Topstep exclusively.",
    authType: "credentials",
    fields: ["apiKey"],
    status: "coming_soon",
  },
};
