/**
 * Central provider registry. Maps provider string identifiers
 * to lazy factory functions. Providers are only loaded when needed.
 */
import type { ProviderCapabilityMap, TradingProvider } from "./types";
import { MT_TERMINAL_PROVIDERS } from "../mt5/constants";
import { DXTRADE_PROVIDER_INFO } from "./dxtrade";
import { TOPSTEPX_PROVIDER_INFO } from "./topstepx";
import { TRADOVATE_PROVIDER_INFO } from "./tradovate";

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
      `Unknown provider: "${name}". Supported: ${Object.keys(
        providerFactories
      ).join(", ")}`
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
    capabilities: ProviderCapabilityMap;
  }
> = {
  "mt5-terminal": {
    name: "MetaTrader 5",
    description:
      "Terminal-farm MT5 sync using broker login, password and server.",
    authType: "credentials",
    fields: ["login", "password", "server"],
    status: "active",
    capabilities: {
      connect: {
        supported: true,
        readiness: "implemented",
        note: "MT5 terminal connections are fully supported.",
      },
      disconnect: {
        supported: true,
        readiness: "implemented",
        note: "MT5 terminal connections are fully supported.",
      },
      fetchHistory: {
        supported: true,
        readiness: "implemented",
        note: "MT5 terminal trade sync is supported.",
      },
      fetchOpenPositions: {
        supported: true,
        readiness: "implemented",
        note: "MT5 terminal position sync is supported.",
      },
      fetchAccountInfo: {
        supported: true,
        readiness: "implemented",
        note: "MT5 terminal account sync is supported.",
      },
    },
  },
  "mt4-terminal": {
    name: "MetaTrader 4",
    description:
      "Terminal-farm MT4 sync using broker login, password and server.",
    authType: "credentials",
    fields: ["login", "password", "server"],
    status: "coming_soon",
    capabilities: {
      connect: {
        supported: false,
        readiness: "planned",
        note: "MT4 terminal sync is not available yet.",
      },
      disconnect: {
        supported: true,
        readiness: "implemented",
        note: "There is no live MT4 integration to release yet.",
      },
      fetchHistory: {
        supported: false,
        readiness: "planned",
        note: "MT4 trade-history sync is not available yet.",
      },
      fetchOpenPositions: {
        supported: false,
        readiness: "planned",
        note: "MT4 open-position sync is not available yet.",
      },
      fetchAccountInfo: {
        supported: false,
        readiness: "planned",
        note: "MT4 account sync is not available yet.",
      },
    },
  },
  ctrader: {
    name: "cTrader",
    description:
      "Connect via OAuth2. Used by FTMO, FundedNext, E8 Markets, FundingPips, Alpha Capital, Maven Trading.",
    authType: "oauth",
    fields: [],
    status: "active",
    capabilities: {
      connect: {
        supported: true,
        readiness: "implemented",
        note: "cTrader account verification is supported.",
      },
      disconnect: {
        supported: true,
        readiness: "implemented",
        note: "cTrader is stateless between sync runs.",
      },
      fetchHistory: {
        supported: true,
        readiness: "implemented",
        note: "cTrader trade-history sync is supported.",
      },
      fetchOpenPositions: {
        supported: true,
        readiness: "implemented",
        note: "cTrader open-position sync is supported.",
      },
      fetchAccountInfo: {
        supported: true,
        readiness: "implemented",
        note: "cTrader account sync is supported.",
      },
      exchangeCode: {
        supported: true,
        readiness: "implemented",
        note: "cTrader supports OAuth authorization-code exchange.",
      },
      refreshToken: {
        supported: true,
        readiness: "implemented",
        note: "cTrader supports OAuth refresh-token rotation.",
      },
    },
  },
  "match-trader": {
    name: "Match-Trader",
    description:
      "Connect with login credentials. Used by FTMO, FundedNext, E8 Markets, Maven Trading.",
    authType: "credentials",
    fields: ["serverUrl", "login", "password"],
    status: "active",
    capabilities: {
      connect: {
        supported: true,
        readiness: "implemented",
        note: "Match-Trader account verification is supported.",
      },
      disconnect: {
        supported: true,
        readiness: "implemented",
        note: "Match-Trader is stateless between sync runs.",
      },
      fetchHistory: {
        supported: true,
        readiness: "implemented",
        note: "Match-Trader trade-history sync is supported.",
      },
      fetchOpenPositions: {
        supported: true,
        readiness: "implemented",
        note: "Match-Trader open-position sync is supported.",
      },
      fetchAccountInfo: {
        supported: true,
        readiness: "implemented",
        note: "Match-Trader account sync is supported.",
      },
    },
  },
  tradelocker: {
    name: "TradeLocker",
    description:
      "Connect with email & password. Used by FTMO, E8 Markets, Alpha Capital, DNA Funded.",
    authType: "credentials",
    fields: ["email", "password", "server"],
    status: "active",
    capabilities: {
      connect: {
        supported: true,
        readiness: "implemented",
        note: "TradeLocker account verification is supported.",
      },
      disconnect: {
        supported: true,
        readiness: "implemented",
        note: "TradeLocker is stateless between sync runs.",
      },
      fetchHistory: {
        supported: true,
        readiness: "implemented",
        note: "TradeLocker trade-history sync is supported.",
      },
      fetchOpenPositions: {
        supported: true,
        readiness: "implemented",
        note: "TradeLocker open-position sync is supported.",
      },
      fetchAccountInfo: {
        supported: true,
        readiness: "implemented",
        note: "TradeLocker account sync is supported.",
      },
      refreshToken: {
        supported: true,
        readiness: "implemented",
        note: "TradeLocker issues refresh tokens for its JWT auth flow.",
      },
    },
  },
  dxtrade: {
    ...DXTRADE_PROVIDER_INFO,
  },
  tradovate: {
    ...TRADOVATE_PROVIDER_INFO,
  },
  topstepx: {
    ...TOPSTEPX_PROVIDER_INFO,
  },
};
