import { NextRequest } from "next/server";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[Chat Proxy] Request body:", JSON.stringify(body, null, 2));

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

    console.log("[Chat Proxy] Backend response status:", response.status);
    console.log("[Chat Proxy] Backend response headers:", Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const error = await response.text();
      console.error("[Chat Proxy] Backend error:", error);
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
