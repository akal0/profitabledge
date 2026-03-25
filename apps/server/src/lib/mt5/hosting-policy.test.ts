import { describe, expect, it } from "bun:test";

import {
  evaluateMt5HostPlacement,
  mergeMt5ConnectionHostingMeta,
  resolveMt5ClaimHostProfile,
  resolveMt5ConnectionHostingPolicy,
  withStrictMt5HostingGeoPolicy,
} from "./hosting-policy";

describe("mt5 hosting policy", () => {
  it("defaults terminal connections to shared hosts while preferring the trader region", () => {
    const merged = mergeMt5ConnectionHostingMeta({
      rawMeta: {},
      userId: "user_canada",
      userTimezone: "America/Toronto",
    });

    const policy = resolveMt5ConnectionHostingPolicy({
      userId: "user_canada",
      userTimezone: "America/Toronto",
      connectionMeta: merged,
    });

    expect(policy.deviceIsolationMode).toBe("shared-host");
    expect(policy.requiredHostTags).toEqual([]);
    expect(policy.preferredRegionGroups).toEqual(["north-america"]);
    expect(policy.geoEnforcement).toBe("strict");
  });

  it("rejects a London host for a Toronto trader", () => {
    const policy = resolveMt5ConnectionHostingPolicy({
      userId: "user_canada",
      userTimezone: "America/Toronto",
      connectionMeta: {
        mt5Hosting: {
          preferredHostCountries: ["CA"],
        },
      },
    });
    const host = resolveMt5ClaimHostProfile({
      hostId: "lon-trader-01",
      host: {
        region: "lon1",
        countryCode: "GB",
        timezone: "Europe/London",
        tags: ["pool:north-america"],
      },
    });

    const evaluation = evaluateMt5HostPlacement({
      policy,
      host,
    });

    expect(evaluation.eligible).toBe(false);
    expect(evaluation.reasons).toContain("country-mismatch");
  });

  it("accepts a North American shared host for the same trader", () => {
    const policy = resolveMt5ConnectionHostingPolicy({
      userId: "user_canada",
      userTimezone: "America/Toronto",
      connectionMeta: {
        mt5Hosting: {
          preferredHostCountries: ["CA"],
        },
      },
    });
    const host = resolveMt5ClaimHostProfile({
      hostId: "tor-trader-01",
      host: {
        region: "tor1",
        countryCode: "CA",
        timezone: "America/Toronto",
        tags: ["pool:north-america"],
      },
    });

    const evaluation = evaluateMt5HostPlacement({
      policy,
      host,
    });

    expect(host.deviceIsolationMode).toBe("shared-host");
    expect(evaluation.eligible).toBe(true);
    expect(evaluation.assignment.hostCountryCode).toBe("CA");
    expect(evaluation.assignment.deviceIdentityKey).toBe("host:tor-trader-01");
  });

  it("allows a region mismatch when the user explicitly accepted best-effort placement", () => {
    const policy = resolveMt5ConnectionHostingPolicy({
      userId: "user_india",
      userTimezone: "Asia/Kolkata",
      connectionMeta: {
        mt5Hosting: {
          preferredRegionGroups: ["asia"],
          geoEnforcement: "best-effort",
        },
      },
    });
    const host = resolveMt5ClaimHostProfile({
      hostId: "lon-shared-01",
      host: {
        region: "lon1",
        countryCode: "GB",
        timezone: "Europe/London",
        tags: ["pool:europe"],
      },
    });

    const evaluation = evaluateMt5HostPlacement({
      policy,
      host,
    });

    expect(evaluation.eligible).toBe(true);
    expect(evaluation.reasons).toEqual([]);
    expect(evaluation.assignment.hostRegionGroup).toBe("europe");
  });

  it("keeps geo preferences strict for host selection when a matching region exists", () => {
    const policy = resolveMt5ConnectionHostingPolicy({
      userId: "user_usa",
      userTimezone: "America/New_York",
      connectionMeta: {
        mt5Hosting: {
          preferredRegionGroups: ["north-america"],
          geoEnforcement: "best-effort",
        },
      },
    });

    expect(withStrictMt5HostingGeoPolicy(policy).geoEnforcement).toBe("strict");
  });
});
