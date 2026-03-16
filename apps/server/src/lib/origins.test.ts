import { afterEach, describe, expect, it } from "bun:test";
import { getAllowedWebOrigins } from "./origins";

const ORIGINAL_ENV = {
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  WEB_URL: process.env.WEB_URL,
  NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL,
};

afterEach(() => {
  process.env.CORS_ORIGIN = ORIGINAL_ENV.CORS_ORIGIN;
  process.env.WEB_URL = ORIGINAL_ENV.WEB_URL;
  process.env.NEXT_PUBLIC_WEB_URL = ORIGINAL_ENV.NEXT_PUBLIC_WEB_URL;
});

describe("getAllowedWebOrigins", () => {
  it("includes the beta hostname when the canonical app domain is configured", () => {
    process.env.CORS_ORIGIN = undefined;
    process.env.WEB_URL = "https://profitabledge.com";
    process.env.NEXT_PUBLIC_WEB_URL = undefined;

    expect(getAllowedWebOrigins()).toEqual([
      "http://localhost:3001",
      "https://profitabledge.com",
      "https://beta.profitabledge.com",
    ]);
  });

  it("includes the canonical app hostname when the beta domain is configured", () => {
    process.env.CORS_ORIGIN = "https://beta.profitabledge.com";
    process.env.WEB_URL = undefined;
    process.env.NEXT_PUBLIC_WEB_URL = undefined;

    expect(getAllowedWebOrigins()).toEqual([
      "http://localhost:3001",
      "https://profitabledge.com",
      "https://beta.profitabledge.com",
    ]);
  });

  it("normalizes trailing slashes for configured web origins", () => {
    process.env.CORS_ORIGIN = "https://profitabledge-web.vercel.app/";
    process.env.WEB_URL = "https://profitabledge-web.vercel.app/";
    process.env.NEXT_PUBLIC_WEB_URL =
      "https://profitabledge-web.vercel.app/";

    expect(getAllowedWebOrigins()).toEqual([
      "http://localhost:3001",
      "https://profitabledge-web.vercel.app",
    ]);
  });

  it("normalizes comma-separated CORS origin lists", () => {
    process.env.CORS_ORIGIN =
      " https://profitabledge-web.vercel.app/ , https://preview.example.com/ ";
    process.env.WEB_URL = undefined;
    process.env.NEXT_PUBLIC_WEB_URL = undefined;

    expect(getAllowedWebOrigins()).toEqual([
      "http://localhost:3001",
      "https://profitabledge-web.vercel.app",
      "https://preview.example.com",
    ]);
  });
});
