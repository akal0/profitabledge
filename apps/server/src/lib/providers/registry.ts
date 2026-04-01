/**
 * Central provider registry. Maps provider string identifiers
 * to lazy factory functions. Providers are only loaded when needed.
 */
import type { ProviderCapabilityMap, TradingProvider } from "./types";
import { WORKER_MANAGED_PROVIDERS } from "../mt5/constants";
import { DXTRADE_PROVIDER_INFO } from "./dxtrade";
import { NINJATRADER_PROVIDER_INFO } from "./ninjatrader";
import { RITHMIC_PROVIDER_INFO } from "./rithmic";
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
  ninjatrader: async () => {
    const { NinjaTraderProvider } = await import("./ninjatrader");
    return new NinjaTraderProvider();
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
  return [...WORKER_MANAGED_PROVIDERS, ...Object.keys(providerFactories)];
}

/** Provider display metadata for the frontend. */
export const PROVIDER_INFO: Record<
  string,
  {
    name: string;
    description: string;
    authType: "oauth" | "credentials" | "api_key";
    fields: readonly string[];
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
    status: "active",
    capabilities: {
      connect: {
        supported: true,
        readiness: "implemented",
        note: "MT4 terminal connections are supported through the terminal worker.",
      },
      disconnect: {
        supported: true,
        readiness: "implemented",
        note: "MT4 terminal connections can be released by the worker.",
      },
      fetchHistory: {
        supported: true,
        readiness: "implemented",
        note: "MT4 terminal trade sync is supported.",
      },
      fetchOpenPositions: {
        supported: true,
        readiness: "implemented",
        note: "MT4 terminal position sync is supported.",
      },
      fetchAccountInfo: {
        supported: true,
        readiness: "implemented",
        note: "MT4 terminal account sync is supported.",
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
  ninjatrader: {
    ...NINJATRADER_PROVIDER_INFO,
  },
  rithmic: {
    ...RITHMIC_PROVIDER_INFO,
  },
  tradovate: {
    ...TRADOVATE_PROVIDER_INFO,
  },
  topstepx: {
    ...TOPSTEPX_PROVIDER_INFO,
  },
};
