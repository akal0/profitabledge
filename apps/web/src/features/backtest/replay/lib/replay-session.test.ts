import { describe, expect, it } from "bun:test";

import {
  normalizeReplaySessionRecord,
  parseReplayConfigIdentity,
  serializeReplayConfigIdentity,
} from "./replay-session";

describe("replay session persistence", () => {
  it("round-trips replay config identities", () => {
    const identity = {
      symbol: "EURUSD",
      timeframe: "m5",
      startDate: "2024-01-02",
      endDate: "2024-03-01",
    } as const;

    expect(parseReplayConfigIdentity(serializeReplayConfigIdentity(identity))).toEqual(
      identity
    );
  });

  it("normalizes saved replay sessions into a usable client payload", () => {
    const session = normalizeReplaySessionRecord({
      id: "session-1",
      name: "London open",
      symbol: "EURUSD",
      timeframe: "m5",
      initialBalance: "12500",
      riskPercent: "1.5",
      playbackSpeed: "3",
      trades: [
        {
          id: "trade-1",
          direction: "long",
          entryPrice: "1.105",
          entryTimeUnix: 1_700_000_000,
          volume: "1",
          status: "open",
        },
      ],
    });

    expect(session.initialBalance).toBe(12500);
    expect(session.riskPercent).toBe(1.5);
    expect(session.playbackSpeed).toBe(3);
    expect(session.trades).toHaveLength(1);
    expect(session.trades[0]?.entryPrice).toBe(1.105);
    expect(session.candleRequest.symbol).toBe("EURUSD");
  });
});
