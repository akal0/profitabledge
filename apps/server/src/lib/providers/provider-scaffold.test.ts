import { describe, expect, it } from "bun:test";

import {
  DXTRADE_PROVIDER_INFO,
  DXTradeProvider,
} from "./dxtrade";
import {
  ProviderMethodUnsupportedError,
  unsupportedProviderMethod,
} from "./scaffold";
import {
  TOPSTEPX_PROVIDER_INFO,
  TopstepXProvider,
} from "./topstepx";
import {
  TRADOVATE_PROVIDER_INFO,
  TradovateProvider,
} from "./tradovate";

const providerCases = [
  {
    provider: new DXTradeProvider(),
    info: DXTRADE_PROVIDER_INFO,
  },
  {
    provider: new TopstepXProvider(),
    info: TOPSTEPX_PROVIDER_INFO,
  },
  {
    provider: new TradovateProvider(),
    info: TRADOVATE_PROVIDER_INFO,
  },
];

describe("provider metadata", () => {
  it("marks the completed providers as active with core sync capabilities", () => {
    for (const current of providerCases) {
      expect(current.info.status).toBe("active");
      expect(current.info.capabilities.connect?.supported).toBe(true);
      expect(current.info.capabilities.fetchHistory?.supported).toBe(true);
      expect(current.info.capabilities.fetchOpenPositions?.supported).toBe(true);
      expect(current.info.capabilities.fetchAccountInfo?.supported).toBe(true);
      expect(current.info.capabilities.disconnect?.supported).toBe(true);
    }

    expect(TRADOVATE_PROVIDER_INFO.capabilities.exchangeCode?.supported).toBe(true);
    expect(TRADOVATE_PROVIDER_INFO.capabilities.refreshToken?.supported).toBe(true);
    expect(DXTRADE_PROVIDER_INFO.capabilities.exchangeCode?.supported).toBe(false);
    expect(TOPSTEPX_PROVIDER_INFO.capabilities.exchangeCode?.supported).toBe(false);
  });

  it("keeps disconnect as a safe no-op", async () => {
    for (const current of providerCases) {
      await expect(current.provider.disconnect()).resolves.toBeUndefined();
    }
  });

  it("still exposes the unsupported helper for future scaffolds", () => {
    expect(() =>
      unsupportedProviderMethod("DXTrade", "exchangeCode", "Not ready yet.")
    ).toThrow(ProviderMethodUnsupportedError);
  });
});
