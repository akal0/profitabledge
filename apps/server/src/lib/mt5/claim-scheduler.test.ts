import { describe, expect, it } from "bun:test";

import { selectMt5Claims } from "./claim-scheduler";

describe("mt5 claim scheduler", () => {
  it("prioritizes institutional users ahead of lower plans", () => {
    const selected = selectMt5Claims(
      [
        {
          connectionId: "pro-1",
          userId: "professional-user",
          planKey: "professional" as const,
          concurrentSlotCap: 1,
          currentActiveSlots: 0,
          queueTier: 1,
          dueAt: "2026-03-25T12:00:00.000Z",
          lastRequestedAt: "2026-03-25T12:01:00.000Z",
          updatedAt: "2026-03-25T12:01:00.000Z",
          connection: null,
        },
        {
          connectionId: "inst-1",
          userId: "institutional-user",
          planKey: "institutional" as const,
          concurrentSlotCap: 5,
          currentActiveSlots: 0,
          queueTier: 1,
          dueAt: "2026-03-25T12:00:00.000Z",
          lastRequestedAt: "2026-03-25T12:00:00.000Z",
          updatedAt: "2026-03-25T12:00:00.000Z",
          connection: null,
        },
      ],
      1
    );

    expect(selected.map((candidate) => candidate.connectionId)).toEqual(["inst-1"]);
  });

  it("gives one slot per user before granting a second slot in the same pass", () => {
    const selected = selectMt5Claims(
      [
        {
          connectionId: "inst-a-1",
          userId: "institutional-a",
          planKey: "institutional" as const,
          concurrentSlotCap: 5,
          currentActiveSlots: 0,
          queueTier: 1,
          dueAt: "2026-03-25T12:00:00.000Z",
          lastRequestedAt: "2026-03-25T12:02:00.000Z",
          updatedAt: "2026-03-25T12:02:00.000Z",
          connection: null,
        },
        {
          connectionId: "inst-a-2",
          userId: "institutional-a",
          planKey: "institutional" as const,
          concurrentSlotCap: 5,
          currentActiveSlots: 0,
          queueTier: 1,
          dueAt: "2026-03-25T12:00:00.000Z",
          lastRequestedAt: "2026-03-25T12:01:00.000Z",
          updatedAt: "2026-03-25T12:01:00.000Z",
          connection: null,
        },
        {
          connectionId: "inst-b-1",
          userId: "institutional-b",
          planKey: "institutional" as const,
          concurrentSlotCap: 5,
          currentActiveSlots: 0,
          queueTier: 1,
          dueAt: "2026-03-25T12:00:00.000Z",
          lastRequestedAt: "2026-03-25T12:00:00.000Z",
          updatedAt: "2026-03-25T12:00:00.000Z",
          connection: null,
        },
      ],
      2
    );

    expect(selected.map((candidate) => candidate.connectionId)).toEqual([
      "inst-a-1",
      "inst-b-1",
    ]);
  });

  it("respects the plan live slot cap", () => {
    const selected = selectMt5Claims(
      [
        {
          connectionId: "pro-1",
          userId: "professional-user",
          planKey: "professional" as const,
          concurrentSlotCap: 1,
          currentActiveSlots: 1,
          queueTier: 1,
          dueAt: "2026-03-25T12:00:00.000Z",
          lastRequestedAt: "2026-03-25T12:02:00.000Z",
          updatedAt: "2026-03-25T12:02:00.000Z",
          connection: null,
        },
        {
          connectionId: "inst-1",
          userId: "institutional-user",
          planKey: "institutional" as const,
          concurrentSlotCap: 5,
          currentActiveSlots: 0,
          queueTier: 1,
          dueAt: "2026-03-25T12:00:00.000Z",
          lastRequestedAt: "2026-03-25T12:01:00.000Z",
          updatedAt: "2026-03-25T12:01:00.000Z",
          connection: null,
        },
      ],
      2
    );

    expect(selected.map((candidate) => candidate.connectionId)).toEqual(["inst-1"]);
  });

  it("blocks student users from live slots when their cap is zero", () => {
    const selected = selectMt5Claims(
      [
        {
          connectionId: "student-1",
          userId: "student-user",
          planKey: "student" as const,
          concurrentSlotCap: 0,
          currentActiveSlots: 0,
          queueTier: 1,
          dueAt: "2026-03-25T12:00:00.000Z",
          lastRequestedAt: "2026-03-25T12:02:00.000Z",
          updatedAt: "2026-03-25T12:02:00.000Z",
          connection: null,
        },
      ],
      1
    );

    expect(selected).toEqual([]);
  });

  it("prioritizes live refresh jobs ahead of cold refresh jobs", () => {
    const selected = selectMt5Claims(
      [
        {
          connectionId: "cold-1",
          userId: "institutional-user",
          planKey: "institutional" as const,
          concurrentSlotCap: 5,
          currentActiveSlots: 0,
          queueTier: 0,
          dueAt: "2026-03-25T11:55:00.000Z",
          lastRequestedAt: null,
          updatedAt: "2026-03-25T12:00:00.000Z",
          connection: null,
        },
        {
          connectionId: "live-1",
          userId: "professional-user",
          planKey: "professional" as const,
          concurrentSlotCap: 1,
          currentActiveSlots: 0,
          queueTier: 1,
          dueAt: "2026-03-25T11:59:00.000Z",
          lastRequestedAt: "2026-03-25T12:01:00.000Z",
          updatedAt: "2026-03-25T12:01:00.000Z",
          connection: null,
        },
      ],
      1
    );

    expect(selected.map((candidate) => candidate.connectionId)).toEqual(["live-1"]);
  });

  it("lets severely overdue cold refresh jobs outrank live traffic", () => {
    const selected = selectMt5Claims(
      [
        {
          connectionId: "cold-aged-1",
          userId: "student-user",
          planKey: "student" as const,
          concurrentSlotCap: 1,
          currentActiveSlots: 0,
          queueTier: 2,
          dueAt: "2026-03-25T11:40:00.000Z",
          lastRequestedAt: null,
          updatedAt: "2026-03-25T12:00:00.000Z",
          connection: null,
        },
        {
          connectionId: "live-1",
          userId: "institutional-user",
          planKey: "institutional" as const,
          concurrentSlotCap: 5,
          currentActiveSlots: 0,
          queueTier: 1,
          dueAt: "2026-03-25T11:59:00.000Z",
          lastRequestedAt: "2026-03-25T12:01:00.000Z",
          updatedAt: "2026-03-25T12:01:00.000Z",
          connection: null,
        },
      ],
      1
    );

    expect(selected.map((candidate) => candidate.connectionId)).toEqual([
      "cold-aged-1",
    ]);
  });
});
