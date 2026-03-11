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

export async function POST(request: NextRequest) {
  try {
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
