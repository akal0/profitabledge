/**
 * Trading Insights AI Chat API Route
 * 
 * NEW ARCHITECTURE: Single orchestrator pipeline
 * Natural Language → Plan → Execute → Answer
 * 
 * NO fixed routes - everything goes through dynamic planning
 */

import { NextRequest } from "next/server";
import { auth } from "../../../lib/auth";
import {
  orchestrateConversation,
  validateContext,
} from "../../../lib/ai/orchestrator";
import {
  buildAlphaFeatureDisabledResponse,
  getServerAlphaFlags,
} from "../../../lib/ops/alpha-runtime";
import {
  ensureActivationMilestone,
  recordAppEvent,
  recordOperationalError,
} from "../../../lib/ops/event-log";

export async function POST(request: NextRequest) {
  try {
    if (!getServerAlphaFlags().aiAssistant) {
      return new Response(JSON.stringify(buildAlphaFeatureDisabledResponse("aiAssistant")), {
        status: 503,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      });
    }

    // 1. Authenticate user
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { messages, accountId, pageContext } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response("Invalid request: messages array required", {
        status: 400,
      });
    }

    // 3. Get the last user message
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "user") {
      return new Response("Invalid request: last message must be from user", {
        status: 400,
      });
    }

    const userMessage = lastMessage.content;

    // 4. Validate context
    const contextValidation = validateContext({
      userId: session.user.id,
      accountId,
    });

    if (!contextValidation.valid) {
      return new Response(contextValidation.error || "Invalid context", {
        status: 400,
      });
    }

    // 6. Orchestrate query through unified pipeline
    console.log("[Chat API] Orchestrating query:", userMessage);
    await Promise.all([
      ensureActivationMilestone({
        userId: session.user.id,
        key: "assistant_prompt_started",
        source: "server",
        metadata: {
          accountId: accountId ?? null,
          page: pageContext?.pathname ?? null,
        },
      }),
      recordAppEvent({
        userId: session.user.id,
        category: "ai",
        name: "chat.request.started",
        source: "server",
        pagePath:
          typeof pageContext?.pathname === "string" ? pageContext.pathname : null,
        summary: userMessage.slice(0, 120),
        metadata: {
          accountId: accountId ?? null,
        },
      }),
    ]);

    const result = await orchestrateConversation(
      userMessage,
      {
        userId: session.user.id,
        accountId: accountId!,
        pageContext,
      },
      messages.slice(0, -1) // All messages except the current one
    );

    // 7. Return result
    if (result.success) {
      return new Response(result.message, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    } else {
      // Return error as plain text (still user-friendly)
      return new Response(result.message, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
        status: 400,
      });
    }
  } catch (error) {
    console.error("Chat API error:", error);
    await recordOperationalError({
      category: "ai",
      name: "chat.request.failed",
      source: "server",
      summary: error instanceof Error ? error.message : "Unknown error",
      isUserVisible: true,
    });
    return new Response(
      `I encountered an error processing your request: ${error instanceof Error ? error.message : "Unknown error"}`,
      { 
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      }
    );
  }
}
