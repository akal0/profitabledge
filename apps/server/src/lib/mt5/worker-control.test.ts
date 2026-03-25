import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { resetServerEnvForTests } from "../env";
import { withMt5ForceSyncRequest } from "./queue-state";

const ORIGINAL_ENV = { ...process.env };

describe("assertWorkerSecret", () => {
  beforeEach(() => {
    process.env.BROKER_WORKER_SECRET = "worker-secret";
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/profitabledge";
    resetServerEnvForTests();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetServerEnvForTests();
  });

  it("accepts the configured worker secret", async () => {
    const { assertWorkerSecret } = await import("./worker-control");
    expect(() => assertWorkerSecret("worker-secret")).not.toThrow();
  });

  it("rejects an invalid worker secret", async () => {
    const { assertWorkerSecret } = await import("./worker-control");
    expect(() => assertWorkerSecret("wrong-secret")).toThrow("Invalid worker secret");
  });

  it("lets a forced MT5 sync bypass the normal due window", async () => {
    const { resolveMt5ClaimQueueSelection } = await import("./worker-control");
    const selection = resolveMt5ClaimQueueSelection(
      {
        status: "active",
        meta: withMt5ForceSyncRequest(undefined, {
          requestedAt: new Date("2026-03-25T02:00:00.000Z"),
          reason: "manual-sync",
        }),
        lastSyncAttemptAt: new Date("2026-03-25T02:05:00.000Z"),
        lastSyncSuccessAt: new Date("2026-03-25T02:05:00.000Z"),
        syncIntervalMinutes: 15,
      },
      {
        active: false,
        activeHolderCount: 0,
        lastHeartbeatAt: null,
        leaseUntil: null,
        holders: {},
        activeHolders: [],
      },
      new Date("2026-03-25T02:05:10.000Z").getTime()
    );

    expect(selection).toMatchObject({
      claimMode: "cold",
      queueTier: 3,
      dueAt: "2026-03-25T02:00:00.000Z",
      lastRequestedAt: "2026-03-25T02:00:00.000Z",
    });
  });

  it("retries first-time MT5 bootstraps on a short cadence", async () => {
    const { resolveMt5ClaimQueueSelection } = await import("./worker-control");

    expect(
      resolveMt5ClaimQueueSelection(
        {
          status: "error",
          meta: {},
          lastSyncAttemptAt: new Date("2026-03-25T02:10:00.000Z"),
          lastSyncSuccessAt: null,
          syncIntervalMinutes: 15,
        },
        {
          active: false,
          activeHolderCount: 0,
          lastHeartbeatAt: null,
          leaseUntil: null,
          holders: {},
          activeHolders: [],
        },
        new Date("2026-03-25T02:10:20.000Z").getTime()
      )
    ).toBeNull();

    expect(
      resolveMt5ClaimQueueSelection(
        {
          status: "error",
          meta: {},
          lastSyncAttemptAt: new Date("2026-03-25T02:10:00.000Z"),
          lastSyncSuccessAt: null,
          syncIntervalMinutes: 15,
        },
        {
          active: false,
          activeHolderCount: 0,
          lastHeartbeatAt: null,
          leaseUntil: null,
          holders: {},
          activeHolders: [],
        },
        new Date("2026-03-25T02:10:31.000Z").getTime()
      )
    ).toMatchObject({
      claimMode: "cold",
      queueTier: 0,
      dueAt: "2026-03-25T02:10:30.000Z",
      lastRequestedAt: null,
    });
  });

  it("does not let a different worker take over a fresh active MT5 session", async () => {
    const { canMtWorkerTakeSessionOwnership } = await import("./worker-control");

    expect(
      canMtWorkerTakeSessionOwnership(
        {
          workerHostId: "worker-a",
          status: "syncing",
          heartbeatAt: new Date("2026-03-25T02:10:00.000Z"),
        },
        "worker-b",
        new Date("2026-03-25T02:10:30.000Z").getTime()
      )
    ).toBe(false);
  });

  it("lets the same worker reclaim its own MT5 session record", async () => {
    const { canMtWorkerTakeSessionOwnership } = await import("./worker-control");

    expect(
      canMtWorkerTakeSessionOwnership(
        {
          workerHostId: "worker-a",
          status: "syncing",
          heartbeatAt: new Date("2026-03-25T02:10:00.000Z"),
        },
        "worker-a",
        new Date("2026-03-25T02:10:30.000Z").getTime()
      )
    ).toBe(true);
  });
});
