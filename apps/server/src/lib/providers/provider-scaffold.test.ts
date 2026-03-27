import { describe, expect, it } from "bun:test";

import {
  DXTRADE_PROVIDER_INFO,
  DXTradeProvider,
} from "./dxtrade";
import {
  ProviderMethodUnsupportedError,
  unsupportedProviderMethod,
} from "./scaffold";
import type { ProviderMethodName } from "./types";
import {
  TOPSTEPX_PROVIDER_INFO,
  TopstepXProvider,
} from "./topstepx";
import {
  TRADOVATE_PROVIDER_INFO,
  TradovateProvider,
} from "./tradovate";

type ProviderCase = {
  name: string;
  provider: {
    connect: (config: { credentials: Record<string, string>; meta: Record<string, unknown> }) => Promise<unknown>;
    fetchHistory: (
      config: { credentials: Record<string, string>; meta: Record<string, unknown> },
      since: Date | null,
      accountMeta: Record<string, unknown>
    ) => Promise<unknown>;
    fetchOpenPositions: (
      config: { credentials: Record<string, string>; meta: Record<string, unknown> },
      accountMeta: Record<string, unknown>
    ) => Promise<unknown>;
    fetchAccountInfo: (
      config: { credentials: Record<string, string>; meta: Record<string, unknown> },
      accountMeta: Record<string, unknown>
    ) => Promise<unknown>;
    exchangeCode: (code: string, redirectUri: string) => Promise<unknown>;
    refreshToken: (credentials: Record<string, string>) => Promise<unknown>;
    disconnect: () => Promise<void>;
    capabilities: Record<string, { supported: boolean; readiness: string; note: string } | undefined>;
  };
  info:
    | typeof DXTRADE_PROVIDER_INFO
    | typeof TOPSTEPX_PROVIDER_INFO
    | typeof TRADOVATE_PROVIDER_INFO;
};

const providerCases: ProviderCase[] = [
  {
    name: "DXTrade",
    provider: new DXTradeProvider(),
    info: DXTRADE_PROVIDER_INFO,
  },
  {
    name: "TopstepX",
    provider: new TopstepXProvider(),
    info: TOPSTEPX_PROVIDER_INFO,
  },
  {
    name: "Tradovate",
    provider: new TradovateProvider(),
    info: TRADOVATE_PROVIDER_INFO,
  },
];

async function expectUnsupported(
  promise: Promise<unknown>,
  providerName: string,
  method: ProviderMethodName
) {
  try {
    await promise;
    throw new Error(`Expected ${providerName}.${method} to throw`);
  } catch (error) {
    expect(error).toBeInstanceOf(ProviderMethodUnsupportedError);
    const typedError = error as ProviderMethodUnsupportedError;
    expect(typedError.providerName).toBe(providerName);
    expect(typedError.method).toBe(method);
  }
}

describe("provider scaffolding", () => {
  it("exposes explicit capability metadata for the scaffolded providers", () => {
    for (const current of providerCases) {
      expect(current.info.capabilities.connect?.supported).toBe(false);
      expect(current.info.capabilities.fetchHistory?.supported).toBe(false);
      expect(current.info.capabilities.fetchOpenPositions?.supported).toBe(false);
      expect(current.info.capabilities.fetchAccountInfo?.supported).toBe(false);
      expect(current.info.capabilities.exchangeCode?.supported).toBe(false);
      expect(current.info.capabilities.refreshToken?.supported).toBe(false);
      expect(current.info.capabilities.disconnect?.supported).toBe(true);
    }
  });

  it("throws a consistent unsupported-method error shape", async () => {
    for (const current of providerCases) {
      await expectUnsupported(
        current.provider.connect({ credentials: {}, meta: {} }),
        current.name,
        "connect"
      );
      await expectUnsupported(
        current.provider.fetchHistory({ credentials: {}, meta: {} }, null, {}),
        current.name,
        "fetchHistory"
      );
      await expectUnsupported(
        current.provider.fetchOpenPositions({ credentials: {}, meta: {} }, {}),
        current.name,
        "fetchOpenPositions"
      );
      await expectUnsupported(
        current.provider.fetchAccountInfo({ credentials: {}, meta: {} }, {}),
        current.name,
        "fetchAccountInfo"
      );
      await expectUnsupported(
        current.provider.exchangeCode("code", "https://example.com/callback"),
        current.name,
        "exchangeCode"
      );
      await expectUnsupported(
        current.provider.refreshToken({ accessToken: "token" }),
        current.name,
        "refreshToken"
      );
    }
  });

  it("keeps disconnect as a safe no-op", async () => {
    for (const current of providerCases) {
      await expect(current.provider.disconnect()).resolves.toBeUndefined();
    }
  });

  it("creates the same unsupported error helper directly", () => {
    expect(() =>
      unsupportedProviderMethod("DXTrade", "connect", "Not ready yet.")
    ).toThrow(ProviderMethodUnsupportedError);
  });
});
