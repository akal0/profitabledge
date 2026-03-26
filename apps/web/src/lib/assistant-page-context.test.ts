import { describe, expect, it } from "bun:test";

import { buildContextFromPath } from "./assistant-page-context";

describe("buildContextFromPath", () => {
  it("captures journal entry context from query params", () => {
    const context = buildContextFromPath(
      "/dashboard/journal?entryId=entry-123",
      null,
      "floating-assistant"
    );

    expect(context.surface).toBe("journal");
    expect(context.journalEntryId).toBe("entry-123");
    expect(context.source).toBe("floating-assistant");
  });

  it("captures journal route context from the path", () => {
    const context = buildContextFromPath(
      "/dashboard/journal/entry-42",
      null,
      "premium-assistant"
    );

    expect(context.surface).toBe("journal");
  });
});
