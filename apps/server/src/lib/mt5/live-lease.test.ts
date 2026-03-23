import { describe, expect, it } from "bun:test";

import {
  buildMt5LiveLeaseHolder,
  getMt5LiveLeaseSnapshot,
  shouldRenewMt5LiveLease,
} from "./live-lease";

describe("mt5 live lease helpers", () => {
  it("detects active holders and ignores expired or invalid entries", () => {
    const now = new Date("2026-03-22T12:00:00.000Z");
    const activeHolder = buildMt5LiveLeaseHolder({
      leaseId: "live",
      now,
      route: "/dashboard/trades",
    });

    const snapshot = getMt5LiveLeaseSnapshot(
      {
        mt5LiveLeases: {
          holders: {
            live: activeHolder,
            expired: {
              leaseId: "expired",
              lastHeartbeatAt: "2026-03-22T11:57:00.000Z",
              leaseUntil: "2026-03-22T11:58:00.000Z",
            },
            invalid: {
              leaseId: "invalid",
              leaseUntil: "not-a-date",
            },
          },
        },
      },
      now
    );

    expect(snapshot.active).toBe(true);
    expect(snapshot.activeHolderCount).toBe(1);
    expect(snapshot.leaseUntil).toBe(activeHolder.leaseUntil);
    expect(snapshot.lastHeartbeatAt).toBe(activeHolder.lastHeartbeatAt);
    expect(snapshot.activeHolders.map((holder) => holder.leaseId)).toEqual([
      "live",
    ]);
  });

  it("only renews when the lease is near expiry or the route changes", () => {
    const now = new Date("2026-03-22T12:00:00.000Z");
    const freshHolder = buildMt5LiveLeaseHolder({
      leaseId: "live",
      now,
      route: "/dashboard/trades",
    });

    expect(
      shouldRenewMt5LiveLease(freshHolder, {
        now: new Date("2026-03-22T12:00:30.000Z"),
        route: "/dashboard/trades",
      })
    ).toBe(false);

    expect(
      shouldRenewMt5LiveLease(freshHolder, {
        now: new Date("2026-03-22T12:00:50.000Z"),
        route: "/dashboard/trades",
      })
    ).toBe(true);

    expect(
      shouldRenewMt5LiveLease(freshHolder, {
        now: new Date("2026-03-22T12:00:10.000Z"),
        route: "/dashboard/journal",
      })
    ).toBe(true);
  });
});
