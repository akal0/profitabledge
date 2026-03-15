import { describe, expect, it } from "bun:test";

import {
  getAuthCookieSettings,
  resolveAuthBaseUrl,
} from "./auth-cookie-settings";

describe("auth cookie settings", () => {
  it("keeps localhost development cookies on default settings", () => {
    expect(
      getAuthCookieSettings({
        baseUrl: "http://localhost:3000",
        allowedWebOrigins: ["http://localhost:3001"],
      })
    ).toEqual({
      useSecureCookies: false,
      defaultCookieAttributes: undefined,
    });
  });

  it("switches to cross-site secure cookies for split production origins", () => {
    expect(
      getAuthCookieSettings({
        baseUrl: "https://profitabledge-server.vercel.app",
        allowedWebOrigins: ["https://profitabledge-web.vercel.app"],
      })
    ).toEqual({
      useSecureCookies: true,
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
      },
    });
  });

  it("normalizes the auth base url from env", () => {
    const env = {
      ...process.env,
      BETTER_AUTH_URL: "https://profitabledge-server.vercel.app/",
      NEXT_PUBLIC_SERVER_URL: "https://fallback.example.com/",
    };

    expect(
      resolveAuthBaseUrl(env)
    ).toBe("https://profitabledge-server.vercel.app");
  });
});
