import { describe, expect, it } from "bun:test";

import {
  createDefaultTradeWindow,
  formatHoldDuration,
  inferMarketTypeFromSymbol,
  parsePositiveNumberInput,
} from "./manual-trade-entry-shared";

describe("manual-trade-entry-shared", () => {
  it("infers market types from common symbols", () => {
    expect(inferMarketTypeFromSymbol("eurusd")).toBe("forex");
    expect(inferMarketTypeFromSymbol("xauusd")).toBe("commodities");
    expect(inferMarketTypeFromSymbol("nas100")).toBe("indices");
    expect(inferMarketTypeFromSymbol("btcusd")).toBe("crypto");
  });

  it("builds a one-hour default trade window", () => {
    const { openTime, closeTime } = createDefaultTradeWindow();
    expect(closeTime.getTime() - openTime.getTime()).toBe(60 * 60 * 1000);
  });

  it("formats hold duration and parses numeric inputs", () => {
    const openTime = new Date("2026-03-27T09:00:00Z");
    const closeTime = new Date("2026-03-27T11:15:00Z");

    expect(formatHoldDuration(openTime, closeTime)).toBe("2h 15m");
    expect(parsePositiveNumberInput(" 1.25 ")).toBe(1.25);
    expect(parsePositiveNumberInput("0")).toBeNull();
  });
});
