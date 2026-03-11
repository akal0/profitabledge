/**
 * Streaming AI Assistant API Endpoint
 * 
 * POST /api/assistant/stream
 * 
 * Accepts: { message: string, accountId: string }
 * Returns: NDJSON stream of events
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { streamToNDJSON } from "@/lib/ai/streaming-orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request
    const body = await request.json();
    const { message, accountId, conversationHistory, evidenceMode, pageContext } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    if (!accountId || typeof accountId !== "string") {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    console.log("[API] Streaming assistant request:", {
      userId: session.user.id,
      accountId,
      message: message.substring(0, 100),
    });

    // Create streaming response
    const stream = await streamToNDJSON(message, {
      userId: session.user.id,
      accountId,
      conversationHistory: conversationHistory || [],
      evidenceMode: Boolean(evidenceMode),
      pageContext,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error("[API] Stream error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    },
  });
}
