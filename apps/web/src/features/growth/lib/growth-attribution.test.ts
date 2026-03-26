import { describe, expect, it } from "bun:test";

import {
  areGrowthTouchesEquivalent,
  buildStoredGrowthTouch,
} from "./growth-attribution";

describe("growth attribution", () => {
  it("treats the same touch as equivalent even when storage metadata differs", () => {
    const storedTouch = buildStoredGrowthTouch("visitor-1", {
      type: "referral",
      code: "PE123456",
      landingPath: "/sign-up",
      query: "ref=PE123456",
    });

    expect(
      areGrowthTouchesEquivalent(storedTouch, {
        type: "referral",
        code: "PE123456",
        landingPath: "/sign-up",
        query: "ref=PE123456",
      })
    ).toBe(true);
  });

  it("detects when the incoming touch changed", () => {
    const storedTouch = buildStoredGrowthTouch("visitor-1", {
      type: "referral",
      code: "PE123456",
      landingPath: "/sign-up",
      query: "ref=PE123456",
    });

    expect(
      areGrowthTouchesEquivalent(storedTouch, {
        type: "referral",
        code: "PE999999",
        landingPath: "/sign-up",
        query: "ref=PE999999",
      })
    ).toBe(false);
  });
});
