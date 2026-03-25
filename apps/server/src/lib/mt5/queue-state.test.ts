import { describe, expect, it } from "bun:test";

import {
  clearMt5ForceSyncRequest,
  getMt5ForceSyncRequest,
  withMt5ForceSyncRequest,
} from "./queue-state";

describe("mt5 queue state", () => {
  it("stores and reads a forced sync request", () => {
    const meta = withMt5ForceSyncRequest(
      {
        foo: "bar",
      },
      {
        requestedAt: new Date("2026-03-25T02:30:00.000Z"),
        reason: "manual-sync",
      }
    );

    expect(getMt5ForceSyncRequest(meta)).toEqual({
      requestedAt: "2026-03-25T02:30:00.000Z",
      reason: "manual-sync",
    });
  });

  it("clears the forced sync request while preserving queue metadata", () => {
    const requested = withMt5ForceSyncRequest(undefined, {
      requestedAt: new Date("2026-03-25T02:30:00.000Z"),
      reason: "connection-created",
    });
    const cleared = clearMt5ForceSyncRequest(requested, {
      claimedAt: new Date("2026-03-25T02:31:00.000Z"),
    });

    expect(getMt5ForceSyncRequest(cleared)).toBeNull();
    expect(cleared).toMatchObject({
      mt5Queue: {
        forceSyncRequestedAt: null,
        forceSyncReason: null,
        lastClaimedAt: "2026-03-25T02:31:00.000Z",
      },
    });
  });
});
