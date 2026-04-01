import { describe, expect, it } from "bun:test";

import { reconstructRoundTripsFromFills } from "./round-trip-reconstructor";

describe("reconstructRoundTripsFromFills", () => {
  it("collapses scaled entries and partial exits into one closed trade", () => {
    const trades = reconstructRoundTripsFromFills([
      {
        id: "1",
        groupKey: "position:1",
        symbol: "NQ",
        side: "buy",
        volume: 1,
        price: 20000,
        time: new Date("2026-03-15T10:00:00Z"),
        raw: { id: 1 },
      },
      {
        id: "2",
        groupKey: "position:1",
        symbol: "NQ",
        side: "buy",
        volume: 1,
        price: 20010,
        time: new Date("2026-03-15T10:01:00Z"),
        raw: { id: 2 },
      },
      {
        id: "3",
        groupKey: "position:1",
        symbol: "NQ",
        side: "sell",
        volume: 1,
        price: 20020,
        profit: 100,
        time: new Date("2026-03-15T10:03:00Z"),
        raw: { id: 3 },
      },
      {
        id: "4",
        groupKey: "position:1",
        symbol: "NQ",
        side: "sell",
        volume: 1,
        price: 20030,
        profit: 200,
        time: new Date("2026-03-15T10:05:00Z"),
        raw: { id: 4 },
      },
    ]);

    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({
      symbol: "NQ",
      tradeType: "long",
      volume: 2,
      openPrice: 20005,
      closePrice: 20025,
      profit: 300,
    });
  });

  it("starts a new cycle when a fill reverses through flat", () => {
    const trades = reconstructRoundTripsFromFills([
      {
        id: "1",
        groupKey: "symbol:ES",
        symbol: "ES",
        side: "sell",
        volume: 1,
        price: 5000,
        time: new Date("2026-03-15T10:00:00Z"),
        raw: { id: 1 },
      },
      {
        id: "2",
        groupKey: "symbol:ES",
        symbol: "ES",
        side: "buy",
        volume: 2,
        price: 4990,
        profit: 50,
        time: new Date("2026-03-15T10:02:00Z"),
        raw: { id: 2 },
      },
      {
        id: "3",
        groupKey: "symbol:ES",
        symbol: "ES",
        side: "sell",
        volume: 1,
        price: 5005,
        profit: 75,
        time: new Date("2026-03-15T10:05:00Z"),
        raw: { id: 3 },
      },
    ]);

    expect(trades).toHaveLength(2);
    expect(trades[0]).toMatchObject({
      symbol: "ES",
      tradeType: "short",
      volume: 1,
      profit: 25,
    });
    expect(trades[1]).toMatchObject({
      symbol: "ES",
      tradeType: "long",
      volume: 1,
      closePrice: 5005,
    });
  });
});
