/**
 * Proxy route for AI Assistant streaming endpoint
 * 
 * Forwards requests to the server app and streams responses back
 */

import { NextRequest } from "next/server";
import { normalizeOriginUrl } from "@profitabledge/platform";

const SERVER_URL =
  normalizeOriginUrl(process.env.NEXT_PUBLIC_SERVER_URL) ||
  "http://localhost:3000";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Get all headers to forward
    const cookie = request.headers.get("Cookie") || "";
    const authorization = request.headers.get("Authorization") || "";

    // Forward request to server
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

    const response = await fetch(`${SERVER_URL}/api/assistant/stream`, {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify(body),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Assistant Stream Proxy] Backend request failed", {
        status: response.status,
      });
      return new Response(error, { 
        status: response.status, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    // Return streaming response with proper headers
    return new Response(response.body, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[Assistant Stream Proxy] Error:", error);
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
