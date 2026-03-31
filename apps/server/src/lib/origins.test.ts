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

    expect(getAllowedWebOrigins()).toEqual(
      expect.arrayContaining([
        "http://localhost:3310",
        "http://127.0.0.1:3310",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "http://tauri.localhost",
        "https://tauri.localhost",
        "tauri://localhost",
        "https://profitabledge.com",
        "https://www.profitabledge.com",
      ])
    );
  });

  it("includes the canonical app hostname when the app domain is configured", () => {
    process.env.CORS_ORIGIN = "https://www.profitabledge.com";
    process.env.WEB_URL = undefined;
    process.env.NEXT_PUBLIC_WEB_URL = undefined;

    expect(getAllowedWebOrigins()).toEqual(
      expect.arrayContaining([
        "http://localhost:3310",
        "http://127.0.0.1:3310",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "http://tauri.localhost",
        "https://tauri.localhost",
        "tauri://localhost",
        "https://profitabledge.com",
        "https://www.profitabledge.com",
      ])
    );
  });

  it("includes all first-party aliases when the deployed www host is configured", () => {
    process.env.CORS_ORIGIN = undefined;
    process.env.WEB_URL = "https://www.profitabledge.com";
    process.env.NEXT_PUBLIC_WEB_URL = undefined;

    expect(getAllowedWebOrigins()).toEqual(
      expect.arrayContaining([
        "https://profitabledge.com",
        "https://www.profitabledge.com",
      ])
    );
  });

  it("normalizes trailing slashes for configured web origins", () => {
    process.env.CORS_ORIGIN = "https://profitabledge-web.vercel.app/";
    process.env.WEB_URL = "https://profitabledge-web.vercel.app/";
    process.env.NEXT_PUBLIC_WEB_URL =
      "https://profitabledge-web.vercel.app/";

    expect(getAllowedWebOrigins()).toEqual(
      expect.arrayContaining([
        "http://localhost:3310",
        "http://127.0.0.1:3310",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "http://tauri.localhost",
        "https://tauri.localhost",
        "tauri://localhost",
        "https://profitabledge-web.vercel.app",
      ])
    );
  });

  it("normalizes comma-separated CORS origin lists", () => {
    process.env.CORS_ORIGIN =
      " https://profitabledge-web.vercel.app/ , https://preview.example.com/ ";
    process.env.WEB_URL = undefined;
    process.env.NEXT_PUBLIC_WEB_URL = undefined;

    expect(getAllowedWebOrigins()).toEqual(
      expect.arrayContaining([
        "http://localhost:3310",
        "http://127.0.0.1:3310",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "http://tauri.localhost",
        "https://tauri.localhost",
        "tauri://localhost",
        "https://profitabledge-web.vercel.app",
        "https://preview.example.com",
      ])
    );
  });
});
