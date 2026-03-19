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
import { normalizeAIProviderError } from "@/lib/ai/provider-errors";
import { streamToNDJSON } from "@/lib/ai/streaming-orchestrator";
import {
  buildAlphaFeatureDisabledResponse,
  getServerAlphaFlags,
} from "@/lib/ops/alpha-runtime";
import {
  ensureActivationMilestone,
  recordAppEvent,
  recordOperationalError,
} from "@/lib/ops/event-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (!getServerAlphaFlags().aiAssistant) {
      return NextResponse.json(
        buildAlphaFeatureDisabledResponse("aiAssistant"),
        { status: 503 }
      );
    }

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

    await Promise.all([
      ensureActivationMilestone({
        userId: session.user.id,
        key: "assistant_prompt_started",
        source: "server",
        metadata: {
          accountId,
          page: pageContext?.pathname ?? null,
        },
      }),
      recordAppEvent({
        userId: session.user.id,
        category: "ai",
        name: "assistant.stream.started",
        source: "server",
        pagePath:
          typeof pageContext?.pathname === "string" ? pageContext.pathname : null,
        summary: "Assistant stream request started",
        metadata: {
          accountId,
          evidenceMode: Boolean(evidenceMode),
        },
      }),
    ]);

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
    const normalized = normalizeAIProviderError(
      error,
      "AI is temporarily unavailable. Please try again later."
    );
    console.error(`[API] Stream error: ${normalized.message}`);
    await recordOperationalError({
      category: "ai",
      name: "assistant.stream.failed",
      source: "server",
      summary: normalized.message,
      metadata: {
        httpStatus: normalized.httpStatus,
      },
      isUserVisible: true,
    });
    return NextResponse.json(
      { error: normalized.message },
      { status: normalized.httpStatus }
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
