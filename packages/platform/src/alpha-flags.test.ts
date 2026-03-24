import { describe, expect, it } from "bun:test";

import {
  getAlphaFeatureDisabledMessage,
  resolvePublicAlphaFlags,
  resolveServerAlphaFlags,
} from "./alpha-flags";

describe("alpha-flags", () => {
  it("falls back to defaults when env vars are absent", () => {
    const flags = resolveServerAlphaFlags({});

    expect(flags.aiAssistant).toBe(true);
    expect(flags.community).toBe(false);
    expect(flags.connections).toBe(true);
    expect(flags.scheduledSync).toBe(true);
  });

  it("respects explicit public env overrides", () => {
    const flags = resolvePublicAlphaFlags({
      NEXT_PUBLIC_ALPHA_ENABLE_AI_ASSISTANT: "false",
      NEXT_PUBLIC_ALPHA_ENABLE_COMMUNITY: "true",
    });

    expect(flags.aiAssistant).toBe(false);
    expect(flags.community).toBe(true);
  });

  it("returns short operator-facing disabled messages", () => {
    expect(getAlphaFeatureDisabledMessage("connections")).toContain(
      "temporarily unavailable"
    );
  });
});
