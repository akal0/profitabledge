import { describe, expect, test } from "bun:test";

import { buildHighWaterMarkEvent } from "./feed-event-generator";

describe("feed-event-generator", () => {
  test("does not emit a high water mark when balance does not exceed the previous high", () => {
    expect(buildHighWaterMarkEvent(1000, 1000)).toBeNull();
    expect(buildHighWaterMarkEvent(1000, 999.5)).toBeNull();
  });

  test("emits a high water mark milestone when balance makes a new high", () => {
    const event = buildHighWaterMarkEvent(1000, 1250.25);

    expect(event).not.toBeNull();
    expect(event?.type).toBe("high_water_mark");
    expect(event?.caption).toBe("New account high watermark");
    expect(event?.data).toEqual({
      metricChange: {
        metric: "account_high_water_mark",
        from: 1000,
        to: 1250.25,
      },
    });
  });
});
