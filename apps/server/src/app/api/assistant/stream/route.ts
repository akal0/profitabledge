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
import { buildCorsHeaders } from "@/lib/origins";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function withCors(request: NextRequest, response: Response) {
  const headers = new Headers(response.headers);
  const corsHeaders = buildCorsHeaders(request.headers.get("origin"), "POST, OPTIONS");

  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(headers),
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!getServerAlphaFlags().aiAssistant) {
      return withCors(
        request,
        NextResponse.json(buildAlphaFeatureDisabledResponse("aiAssistant"), {
          status: 503,
        })
      );
    }

    // Authenticate
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return withCors(
        request,
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    // Parse request
    const body = await request.json();
    const { message, accountId, conversationHistory, evidenceMode, pageContext } = body;

    if (!message || typeof message !== "string") {
      return withCors(
        request,
        NextResponse.json({ error: "Message is required" }, { status: 400 })
      );
    }

    if (!accountId || typeof accountId !== "string") {
      return withCors(
        request,
        NextResponse.json({ error: "Account ID is required" }, { status: 400 })
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

    return withCors(request, new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      },
    }));
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
    return withCors(
      request,
      NextResponse.json(
        { error: normalized.message },
        { status: normalized.httpStatus }
      )
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: new Headers(
      buildCorsHeaders(request.headers.get("origin"), "POST, OPTIONS")
    ),
  });
}
