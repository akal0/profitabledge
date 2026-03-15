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
