/**
 * Proxy route for AI Assistant field catalog
 *
 * Forwards requests to the server app and returns JSON
 */

import { NextRequest } from "next/server";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const cookie = request.headers.get("Cookie") || "";
    const authorization = request.headers.get("Authorization") || "";

    const forwardHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Cookie: cookie,
    };
    if (authorization) {
      forwardHeaders.Authorization = authorization;
    }

    const passthroughHeaders = [
      "x-forwarded-host",
      "x-forwarded-proto",
      "x-forwarded-port",
      "origin",
      "referer",
      "user-agent",
    ];
    passthroughHeaders.forEach((key) => {
      const value = request.headers.get(key);
      if (value) {
        forwardHeaders[key] = value;
      }
    });

    const url = new URL(request.url);
    const response = await fetch(
      `${SERVER_URL}/api/assistant/fields${url.search}`,
      {
        method: "GET",
        headers: forwardHeaders,
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return new Response(error, {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
