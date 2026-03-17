import { NextRequest } from "next/server";
import { normalizeOriginUrl } from "@profitabledge/platform";

const SERVER_URL =
  normalizeOriginUrl(process.env.NEXT_PUBLIC_SERVER_URL) ||
  "http://localhost:3000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Forward request to server
    const response = await fetch(`${SERVER_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward auth headers
        Cookie: request.headers.get("Cookie") || "",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Chat Proxy] Backend request failed", {
        status: response.status,
      });
      return new Response(error, { status: response.status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }

    // Return streaming response
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("[Chat Proxy] Proxy error:", error);
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
