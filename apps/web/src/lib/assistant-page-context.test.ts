import { describe, expect, it } from "bun:test";

import { buildContextFromPath } from "./assistant-page-context";

describe("buildContextFromPath", () => {
  it("captures journal entry context from query params", () => {
    const context = buildContextFromPath(
      "/dashboard/journal?entryId=entry-123&tab=review-ready",
      null,
      "floating-assistant"
    );

    expect(context.surface).toBe("journal");
    expect(context.journalEntryId).toBe("entry-123");
    expect(context.source).toBe("floating-assistant");
  });

  it("captures replay session context from the route", () => {
    const context = buildContextFromPath(
      "/backtest/session-42/review",
      null,
      "premium-assistant"
    );

    expect(context.surface).toBe("backtest");
    expect(context.backtestSessionId).toBe("session-42");
  });
});
