import { describe, expect, it } from "bun:test";

import {
  getOriginCandidates,
  normalizeOriginUrl,
  rewriteRequestToBase,
} from "./origin-utils";

describe("origin-utils", () => {
  it("normalizes slash-suffixed env origins", () => {
    expect(normalizeOriginUrl("https://profitabledge-server.vercel.app/")).toBe(
      "https://profitabledge-server.vercel.app"
    );
  });

  it("keeps production browser candidates pinned to the configured env origin", () => {
    expect(
      getOriginCandidates({
        envUrl: "https://profitabledge-server.vercel.app/",
        fallbackPort: 3000,
        location: {
          protocol: "https:",
          hostname: "profitabledge-web.vercel.app",
        },
      })
    ).toEqual(["https://profitabledge-server.vercel.app"]);
  });

  it("keeps localhost failover for local browser sessions", () => {
    expect(
      getOriginCandidates({
        envUrl: "http://localhost:3000/",
        fallbackPort: 3000,
        location: {
          protocol: "http:",
          hostname: "localhost",
        },
      })
    ).toEqual(["http://localhost:3000"]);
  });

  it("rewrites request targets without leaving double slashes in the base origin", () => {
    expect(
      rewriteRequestToBase(
        "/trpc/users.me?batch=1",
        "https://profitabledge-server.vercel.app/",
        ""
      )
    ).toBe("https://profitabledge-server.vercel.app/trpc/users.me?batch=1");
  });
});
