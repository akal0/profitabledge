/**
 * AI Trading Assistant Orchestrator
 * 
 * Single entry point for all AI queries.
 * Pipeline: Natural Language → Plan → Execute → Answer
 * 
 * NO fixed routes. Everything goes through dynamic planning.
 */

import { generatePlan } from "./plan-generator";
import { executePlan } from "./query-executor";
import { assembleAnswer, assembleProfileAnswer } from "./answer-assembler";
import type { TradeQueryPlan } from "./query-plan";
import { getFullProfile, condenseProfile } from "./engine/trader-profile";
import type { CondensedProfile } from "./engine/types";
import {
  maybeHandleSpecialistQuery,
  type AssistantPageContext,
} from "./assistant-specialists";
import {
  computeMentalPerformanceScore,
  detectTiltStatus,
} from "./engine/psychology-engine";
import {
  generateCoachingNudges,
  getCurrentSessionState,
} from "./engine/session-tracker";

export interface OrchestratorContext {
  userId: string;
  accountId: string;
  conversationHistory?: string[];
  pageContext?: AssistantPageContext;
}

export interface OrchestratorResult {
  success: boolean;
  message: string;
  data?: any;
  plan?: TradeQueryPlan;
  debug?: {
    planGenerated: boolean;
    planValid: boolean;
    executionSuccessful: boolean;
    error?: string;
  };
}

/**
 * Main orchestrator - handles ALL queries
 */
export async function orchestrateQuery(
  userMessage: string,
  context: OrchestratorContext
): Promise<OrchestratorResult> {
  const debug: OrchestratorResult["debug"] = {
    planGenerated: false,
    planValid: false,
    executionSuccessful: false,
  };

  try {
    // Load trader profile (cached)
    let condensed: CondensedProfile | undefined;
    let fullProfileData:
      | Awaited<ReturnType<typeof getFullProfile>>
      | null
      | undefined;
    try {
      const fullProfile = await getFullProfile(
        context.accountId,
        context.userId
      );
      fullProfileData = fullProfile;
      if (fullProfile) {
        condensed = condenseProfile(
          fullProfile.profile,
          fullProfile.edges,
          fullProfile.leaks
        );
      }
    } catch (e) {
      console.warn("[Orchestrator] Could not load profile:", e);
    }

    const [tiltStatus, mentalScore, sessionState, coachingNudges] =
      await Promise.all([
        fullProfileData?.profile
          ? detectTiltStatus(
              context.accountId,
              context.userId,
              fullProfileData.profile
            ).catch(() => null)
          : Promise.resolve(null),
        fullProfileData?.profile
          ? computeMentalPerformanceScore(
              context.accountId,
              context.userId,
              fullProfileData.profile
            ).catch(() => null)
          : Promise.resolve(null),
        getCurrentSessionState(context.accountId, 8, context.userId).catch(
          () => null
        ),
        fullProfileData?.profile
          ? generateCoachingNudges(
              context.accountId,
              context.userId,
              fullProfileData.profile
            ).catch(() => [])
          : Promise.resolve([]),
      ]);

    const specialist = await maybeHandleSpecialistQuery(userMessage, {
      userId: context.userId,
      accountId: context.accountId,
      pageContext: context.pageContext,
      condensed,
      fullProfile: fullProfileData,
      tiltStatus,
      mentalScore,
      sessionState,
      coachingNudges,
    });

    if (specialist.handled && specialist.message) {
      return {
        success: true,
        message: specialist.message,
        data: specialist.data,
        debug,
      };
    }

    // Step 1: Generate plan from natural language
    const planResult = await generatePlan(
      userMessage,
      context.conversationHistory,
      context.accountId,
      condensed,
      context.userId
    );

    if (!planResult.success || !planResult.plan) {
      debug.error = planResult.error;
      
      // If AI needs field catalog, provide it
      if (planResult.needsFieldCatalog) {
        return {
          success: false,
          message:
            "I couldn't map that request to your trade fields. Try rephrasing or mention the metric you want to analyze.",
          debug,
        };
      }

      if (planResult.error?.startsWith("AI ")) {
        return {
          success: false,
          message: planResult.error,
          debug,
        };
      }

      return {
        success: false,
        message: `I couldn't understand your query. ${planResult.error || "Please rephrase and try again."}`,
        debug,
      };
    }

    debug.planGenerated = true;
    debug.planValid = true;
    const plan = planResult.plan;

    // Profile summary short-circuit
    if ((plan as any)._profileSummary && condensed) {
      const answer = assembleProfileAnswer(condensed);
      return {
        success: true,
        message: answer.markdown,
        data: answer.data,
        plan,
        debug,
      };
    }

    // Step 2: Execute plan
    const executionResult = await executePlan(plan, {
      userId: context.userId,
      accountId: context.accountId,
    });

    if (!executionResult.success) {
      debug.error = executionResult.error;
      return {
        success: false,
        message: `Query execution failed: ${executionResult.error}`,
        plan,
        debug,
      };
    }

    debug.executionSuccessful = true;

    // Step 3: Assemble answer
    const answer = assembleAnswer(executionResult, plan, {
      userMessage,
    });
    return {
      success: true,
      message: answer.markdown,
      data: answer.data,
      plan,
      debug,
    };
  } catch (error) {
    console.error("[Orchestrator] Unexpected error:", error);
    debug.error = error instanceof Error ? error.message : String(error);
    
    return {
      success: false,
      message: `An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`,
      debug,
    };
  }
}

/**
 * Handle conversational queries (with context)
 */
export async function orchestrateConversation(
  userMessage: string,
  context: OrchestratorContext,
  previousMessages: Array<{ role: string; content: string }>
): Promise<OrchestratorResult> {
  // Extract conversation context (last 3 exchanges)
  const contextMessages = previousMessages
    .slice(-6) // last 3 user + 3 assistant = 6 messages
    .map(m => `${m.role}: ${m.content}`)
    .filter(Boolean);

  return orchestrateQuery(userMessage, {
    ...context,
    conversationHistory: contextMessages,
  });
}

/**
 * Validate context before orchestrating
 */
export function validateContext(context: Partial<OrchestratorContext>): {
  valid: boolean;
  error?: string;
} {
  if (!context.userId) {
    return { valid: false, error: "User ID is required" };
  }

  if (!context.accountId) {
    return { valid: false, error: "Please select a trading account first" };
  }

  return { valid: true };
}
