import { describe, expect, it } from "bun:test";

import {
  areGrowthTouchesEquivalent,
  buildStoredGrowthTouch,
  readGrowthTouchFromSearchParams,
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

  it("parses affiliate group and tracking metadata from the query string", () => {
    const searchParams = new URLSearchParams(
      "aff=AFF123456&offer=PROFIT10&link=twitter-bio&group=alpha-desk&channel=twitter"
    );

    expect(readGrowthTouchFromSearchParams(searchParams, "/invite/trader")).toEqual({
      type: "affiliate",
      code: "AFF123456",
      offerCode: "PROFIT10",
      channel: "twitter",
      trackingLinkSlug: "twitter-bio",
      affiliateGroupSlug: "alpha-desk",
      landingPath: "/invite/trader",
      query: searchParams.toString(),
    });
  });

  it("supports offer-only affiliate touches", () => {
    const searchParams = new URLSearchParams("offer=PROFIT10&channel=discord");

    expect(readGrowthTouchFromSearchParams(searchParams, "/sign-up")).toEqual({
      type: "affiliate",
      code: "",
      offerCode: "PROFIT10",
      channel: "discord",
      affiliateGroupSlug: undefined,
      trackingLinkSlug: undefined,
      landingPath: "/sign-up",
      query: searchParams.toString(),
    });
  });
});
