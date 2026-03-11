/**
 * Streaming AI Trading Assistant Orchestrator
 *
 * Yields events as it processes queries, enabling real-time UI updates.
 * Events: status, delta (text), analysis blocks, visualization, done
 */

import { generatePlan } from "./plan-generator";
import { executePlan } from "./query-executor";
import { assembleAnswer, assembleProfileAnswer } from "./answer-assembler";
import { buildVizSpec, type VizSpec } from "./visualization-registry";
import { buildTradesUrl } from "./url-builder";
import { getGuardrailStatus } from "./guardrails";
import type { TradeQueryPlan } from "./query-plan";
import { getFullProfile, condenseProfile } from "./engine/trader-profile";
import type { CondensedProfile } from "./engine/types";
import { detectTiltStatus, computeMentalPerformanceScore } from "./engine/psychology-engine";
import { getCurrentSessionState, generateCoachingNudges } from "./engine/session-tracker";
import { getMemoryPromptContext, processConversationMemories } from "./engine/memory-manager";
import {
  maybeHandleSpecialistQuery,
  type AssistantPageContext,
} from "./assistant-specialists";

// ===== EVENT TYPES =====

export type StreamStage =
  | "thinking"
  | "planning"
  | "querying"
  | "aggregating"
  | "writing"
  | "finalizing";

export type StreamEvent =
  | { event: "status"; stage: StreamStage; message: string }
  | { event: "delta"; text: string }
  | { event: "analysis"; block: AnalysisBlock }
  | { event: "visualization"; viz: VizSpec }
  | { event: "profile"; profile: CondensedProfile }
  | { event: "insight"; insights: any[] }
  | { event: "alert"; alerts: any[] }
  | { event: "done" }
  | { event: "error"; message: string };

export type ConfidenceLevel = "exploratory" | "moderate" | "high";

export type AnalysisBlock =
  | { type: "querySummary"; title: string; bullets: string[] }
  | { type: "insights"; title: string; items: string[] }
  | { type: "recommendations"; title: string; items: string[] }
  | {
      type: "sources";
      title: string;
      items: Array<{ label: string; detail: string }>;
      tradesUrl?: string;
    }
  | {
      type: "coverage";
      title: string;
      n: number;
      from?: string;
      to?: string;
      confidence?: ConfidenceLevel;
    }
  | {
      type: "stats";
      title: string;
      rows: Array<{ label: string; value: string; note?: string }>;
    }
  | {
      type: "breakdownTable";
      title: string;
      columns: string[];
      rows: (string | number | null)[][];
    }
  | {
      type: "tradePreview";
      title: string;
      tradeIds: string[];
      columns: string[];
      rows: any[][];
    }
  | {
      type: "callout";
      tone: "info" | "warning" | "success";
      title: string;
      body: string;
    }
  | { type: "visualization"; viz: VizSpec }
  | {
      type: "profileSummary";
      profile: CondensedProfile;
    }
  | {
      type: "edgeConditions";
      title: string;
      edges: Array<{ label: string; winRate: number; trades: number; confidence: string }>;
      leaks: Array<{ label: string; winRate: number; trades: number; confidence: string }>;
    }
  | {
      type: "insightCard";
      title: string;
      severity: string;
      message: string;
      recommendation: string;
    }
  | {
      type: "tiltStatus";
      tiltScore: number;
      level: string;
      indicators: Array<{ label: string; severity: string }>;
      mentalScore?: number;
    }
  | {
      type: "sessionCoaching";
      isActive: boolean;
      tradeCount: number;
      wins: number;
      losses: number;
      runningPnL: number;
      nudges: Array<{ type: string; title: string; message: string; severity: string }>;
    };

// ===== CONTEXT =====

export interface StreamingContext {
  userId: string;
  accountId: string;
  conversationHistory?: string[];
  evidenceMode?: boolean;
  pageContext?: AssistantPageContext;
}

// ===== MAIN STREAMING ORCHESTRATOR =====

/**
 * Stream query processing events
 */
export async function* streamQuery(
  userMessage: string,
  context: StreamingContext
): AsyncGenerator<StreamEvent> {
  console.log("[StreamOrchestrator] Processing:", userMessage);

  try {
    // ===== STAGE: THINKING =====
    yield {
      event: "status",
      stage: "thinking",
      message: "Understanding your question...",
    };

    // Load trader profile, psychology, and memory in parallel
    let condensed: CondensedProfile | undefined;
    let fullProfileData: any = null;
    let tiltStatus: any;
    let mentalScore: any;
    let sessionState: any;
    let coachingNudges: any[] = [];
    let memoryContext = "";

    try {
      // First load the profile (needed by psychology/coaching functions)
      const fullProfile = await getFullProfile(context.accountId, context.userId).catch(() => null);
      fullProfileData = fullProfile;

      if (fullProfile) {
        condensed = condenseProfile(
          fullProfile.profile,
          fullProfile.edges,
          fullProfile.leaks
        );
      }

      // Now load psychology, session, and memory in parallel (using profile data)
      const [tilt, mental, session, nudges, memory] = await Promise.allSettled([
        fullProfile ? detectTiltStatus(context.accountId, context.userId, fullProfile.profile).catch(() => null) : Promise.resolve(null),
        fullProfile ? computeMentalPerformanceScore(context.accountId, context.userId, fullProfile.profile).catch(() => null) : Promise.resolve(null),
        getCurrentSessionState(context.accountId, 8, context.userId).catch(
          () => null
        ),
        fullProfile ? generateCoachingNudges(context.accountId, context.userId, fullProfile.profile).catch(() => []) : Promise.resolve([]),
        getMemoryPromptContext(context.userId).catch(() => ""),
      ]);

      if (tilt.status === "fulfilled") tiltStatus = tilt.value;
      if (mental.status === "fulfilled") mentalScore = mental.value;
      if (session.status === "fulfilled") sessionState = session.value;
      if (nudges.status === "fulfilled") coachingNudges = nudges.value ?? [];
      if (memory.status === "fulfilled") memoryContext = memory.value ?? "";
    } catch (e) {
      console.warn("[StreamOrchestrator] Could not load profile:", e);
    }

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
    })

    if (specialist.handled && specialist.message) {
      for (const block of specialist.analysisBlocks || []) {
        yield {
          event: "analysis",
          block,
        }
      }

      for await (const chunk of streamText(specialist.message)) {
        yield { event: "delta", text: chunk }
      }
      yield { event: "done" };
      return;
    }

    // Small delay for visual feedback
    await sleep(300);

    // ===== STAGE: PLANNING =====
    yield {
      event: "status",
      stage: "planning",
      message: "Mapping question to trade fields...",
    };

    // Enrich conversation history with coaching context
    const enrichedHistory = [...(context.conversationHistory ?? [])];
    if (memoryContext) {
      enrichedHistory.unshift(`[TRADER MEMORY]\n${memoryContext}`);
    }
    if (tiltStatus && tiltStatus.tiltScore > 20) {
      enrichedHistory.unshift(
        `[TILT STATUS] Score: ${tiltStatus.tiltScore}/100 (${tiltStatus.level}). Active indicators: ${tiltStatus.indicators?.map((i: any) => i.label ?? i.message ?? "Tilt signal").join(", ") || "none"}`
      );
    }
    if (sessionState?.isActive) {
      enrichedHistory.unshift(
        `[LIVE SESSION] ${sessionState.tradeCount} trades, ${sessionState.wins}W/${sessionState.losses}L, P&L: $${sessionState.runningPnL?.toFixed(2)}`
      );
    }

    const planResult = await generatePlan(
      userMessage,
      enrichedHistory,
      context.accountId,
      condensed
    );

    if (!planResult.success || !planResult.plan) {
      if (planResult.needsFieldCatalog) {
        yield {
          event: "delta",
          text:
            "I couldn't map that request to your trade fields. Try rephrasing or mention the metric you want to analyze.",
        };
        yield { event: "done" };
        return;
      }

      yield {
        event: "error",
        message: planResult.error || "Could not understand query",
      };
      return;
    }

    const plan = planResult.plan;
    console.log("[StreamOrchestrator] Plan:", JSON.stringify(plan, null, 2));

    // ===== PROFILE SUMMARY SHORT-CIRCUIT =====
    if ((plan as any)._profileSummary && condensed) {
      yield {
        event: "analysis",
        block: { type: "profileSummary", profile: condensed },
      };

      // Also emit edge/leak conditions
      const fp = await getFullProfile(context.accountId, context.userId);
      if (fp && (fp.edges.length > 0 || fp.leaks.length > 0)) {
        yield {
          event: "analysis",
          block: {
            type: "edgeConditions",
            title: "Your Edge & Leak Conditions",
            edges: fp.edges.slice(0, 5).map((e) => ({
              label: e.label,
              winRate: e.winRate,
              trades: e.trades,
              confidence: e.confidence,
            })),
            leaks: fp.leaks.slice(0, 5).map((l) => ({
              label: l.label,
              winRate: l.winRate,
              trades: l.trades,
              confidence: l.confidence,
            })),
          },
        };
      }

      const answer = assembleProfileAnswer(condensed);
      for await (const chunk of streamText(answer.markdown)) {
        yield { event: "delta", text: chunk };
      }
      yield { event: "done" };
      return;
    }

    // ===== STAGE: QUERYING =====
    yield {
      event: "status",
      stage: "querying",
      message: "Scanning matching trades...",
    };

    const executionResult = await executePlan(plan, {
      userId: context.userId,
      accountId: context.accountId,
    });

    if (!executionResult.success) {
      yield {
        event: "error",
        message: executionResult.error || "Query execution failed",
      };
      return;
    }

    // ===== STAGE: AGGREGATING =====
    yield {
      event: "status",
      stage: "aggregating",
      message: "Computing stats and breakdowns...",
    };

    const guardrail = getGuardrailStatus(executionResult, plan);
    if (guardrail) {
      yield {
        event: "analysis",
        block: {
          type: "callout",
          tone: "warning",
          title: "I don't know yet",
          body: guardrail.message,
        },
      };
    } else {
      // Emit coverage block
      yield {
        event: "analysis",
        block: buildCoverageBlock(executionResult, plan),
      };

      const improvementRows = Array.isArray(executionResult.data?.improvements)
        ? executionResult.data.improvements
        : [];
      if (improvementRows.length > 0) {
        yield {
          event: "analysis",
          block: {
            type: "stats",
            title: "Improvements",
            rows: improvementRows,
          },
        };
      }

      const insightItems = Array.isArray(executionResult.data?.insights)
        ? executionResult.data.insights
        : [];
      if (insightItems.length > 0) {
        yield {
          event: "analysis",
          block: {
            type: "insights",
            title: "Insights",
            items: insightItems,
          },
        };
      }

      const recommendationItems = Array.isArray(
        executionResult.data?.recommendations
      )
        ? executionResult.data.recommendations
        : [];
      if (recommendationItems.length > 0) {
        yield {
          event: "analysis",
          block: {
            type: "recommendations",
            title: "Recommendations",
            items: recommendationItems,
          },
        };
      }

      if (context.evidenceMode) {
        yield {
          event: "analysis",
          block: buildEvidenceBlock(executionResult, plan, context),
        };
        yield {
          event: "analysis",
          block: buildSourcesBlock(executionResult, plan, context),
        };
      }

      // Build and emit visualization
      const vizSpec = buildVizSpec(plan, executionResult);

      yield {
        event: "visualization",
        viz: vizSpec,
      };
    }

    // ===== STAGE: WRITING =====
    yield {
      event: "status",
      stage: "writing",
      message: "Drafting explanation...",
    };

    // Assemble answer and stream it character by character
    const answer = assembleAnswer(executionResult, plan, {
      userMessage,
      profile: condensed,
    });

    // Stream the markdown answer
    for await (const chunk of streamText(answer.markdown)) {
      yield { event: "delta", text: chunk };
    }

    // ===== STAGE: FINALIZING =====
    yield {
      event: "status",
      stage: "finalizing",
      message: "Formatting output...",
    };

    // Emit additional analysis blocks based on intent
    if (
      !guardrail &&
      plan.intent === "aggregate" &&
      plan.groupBy &&
      executionResult.meta?.groups
    ) {
      yield {
        event: "analysis",
        block: buildBreakdownBlock(executionResult, plan),
      };
    }

    // Emit confidence callout if low sample size
    const rowCount = executionResult.meta?.rowCount || 0;
    if (rowCount < 30 && !guardrail) {
      yield {
        event: "analysis",
        block: {
          type: "callout",
          tone: "warning",
          title: "Limited data",
          body: `This analysis is based on ${rowCount} trade${
            rowCount === 1 ? "" : "s"
          }. Results may not be statistically significant. Consider gathering more data for reliable insights.`,
        },
      };
    }

    // Emit tilt status if elevated
    if (tiltStatus && tiltStatus.tiltScore > 15) {
      yield {
        event: "analysis",
        block: {
          type: "tiltStatus",
          tiltScore: tiltStatus.tiltScore,
          level: tiltStatus.level,
          indicators: tiltStatus.indicators ?? [],
          mentalScore: mentalScore?.totalScore ?? mentalScore?.overall,
        },
      };
    }

    // Emit session coaching if active with nudges
    if (sessionState?.isActive && coachingNudges.length > 0) {
      yield {
        event: "analysis",
        block: {
          type: "sessionCoaching",
          isActive: true,
          tradeCount: sessionState.tradeCount ?? 0,
          wins: sessionState.wins ?? 0,
          losses: sessionState.losses ?? 0,
          runningPnL: sessionState.runningPnL ?? 0,
          nudges: coachingNudges.slice(0, 3),
        },
      };
    }

    // Process memory from this conversation (async, don't block)
    processConversationMemories(
      context.userId,
      userMessage,
      answer.markdown
    ).catch(() => {});

    // ===== DONE =====
    yield { event: "done" };
  } catch (error) {
    console.error("[StreamOrchestrator] Error:", error);
    yield {
      event: "error",
      message:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

// ===== HELPER FUNCTIONS =====

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Stream text with natural typing speed
 */
async function* streamText(text: string): AsyncGenerator<string> {
  // Split into words for more natural streaming
  const words = text.split(/(\s+)/);

  for (const word of words) {
    yield word;
    // Small delay between words (10-30ms)
    await sleep(Math.random() * 20 + 10);
  }
}

/**
 * Build query summary block from plan
 */
function buildQuerySummaryBlock(plan: TradeQueryPlan): AnalysisBlock {
  const bullets: string[] = [];

  // Intent
  const intentLabels: Record<string, string> = {
    list_trades: "Listing trades",
    aggregate: "Computing statistics",
    compare: "Comparing groups",
    diagnose: "Diagnosing patterns",
    recommendation: "Generating recommendation",
  };
  bullets.push(intentLabels[plan.intent] || plan.intent);

  // Filters
  if (plan.filters.length > 0) {
    const filterDescriptions = plan.filters.map((f) => {
      const opLabels: Record<string, string> = {
        eq: "=",
        neq: "≠",
        gt: ">",
        gte: "≥",
        lt: "<",
        lte: "≤",
        in: "in",
        contains: "contains",
        between: "between",
      };
      return `${f.field} ${opLabels[f.op]} ${JSON.stringify(f.value)}`;
    });
    bullets.push(`Filters: ${filterDescriptions.join(", ")}`);
  }

  // Timeframe
  if (plan.timeframe) {
    if (plan.timeframe.lastNDays) {
      bullets.push(`Last ${plan.timeframe.lastNDays} days`);
    } else if (plan.timeframe.from || plan.timeframe.to) {
      const from = plan.timeframe.from || "start";
      const to = plan.timeframe.to || "now";
      bullets.push(`Date range: ${from} to ${to}`);
    }
  }

  // Group by
  if (plan.groupBy && plan.groupBy.length > 0) {
    bullets.push(`Grouped by: ${plan.groupBy.map((g) => g.field).join(", ")}`);
  }

  // Aggregations
  if (plan.aggregates && plan.aggregates.length > 0) {
    const aggLabels = plan.aggregates.map((a) => `${a.fn}(${a.field || "*"})`);
    bullets.push(`Computing: ${aggLabels.join(", ")}`);
  }

  // Compare
  if (plan.compare) {
    bullets.push(
      `Comparing: "${plan.compare.a.label}" vs "${plan.compare.b.label}"`
    );
    bullets.push(
      `Metric: ${plan.compare.metric.agg}(${plan.compare.metric.field})`
    );
  }

  // Visualization
  if (plan.vizType) {
    bullets.push(`Display: ${plan.vizType.replace(/_/g, " ")}`);
  }

  return {
    type: "querySummary",
    title: "Query plan",
    bullets,
  };
}

function buildEvidenceBlock(
  result: { meta?: any },
  plan: TradeQueryPlan,
  context: StreamingContext
): AnalysisBlock {
  const bullets: string[] = [];
  const meta = result.meta || {};

  bullets.push(`Query plan: ${sentenceCase(plan.explanation)}`);

  if (plan.filters.length > 0) {
    const filterDescriptions = plan.filters.map((f) => {
      const opLabels: Record<string, string> = {
        eq: "=",
        neq: "≠",
        gt: ">",
        gte: "≥",
        lt: "<",
        lte: "≤",
        in: "in",
        contains: "contains",
        between: "between",
      };
      return `${f.field} ${opLabels[f.op]} ${JSON.stringify(f.value)}`;
    });
    bullets.push(`Filters: ${filterDescriptions.join(", ")}`);
  }

  if (meta.timeframe) {
    bullets.push(`Time range: ${meta.timeframe}`);
  }

  bullets.push(`Sample size (n): ${meta.rowCount ?? 0}`);

  return {
    type: "querySummary",
    title: "Evidence",
    bullets,
  };
}

function buildSourcesBlock(
  result: { meta?: any },
  plan: TradeQueryPlan,
  context: StreamingContext
): AnalysisBlock {
  const meta = result.meta || {};
  const aggregates = meta.aggregates || {};
  const items: Array<{ label: string; detail: string }> = [];

  const filterText =
    plan.filters.length > 0
      ? plan.filters.map((f) => `${f.field} ${f.op} ${JSON.stringify(f.value)}`).join(", ")
      : "no filters";

  if (plan.aggregates && plan.aggregates.length > 0) {
    for (const agg of plan.aggregates) {
      const value = aggregates[agg.as];
      const label = sentenceCase(agg.as.replace(/_/g, " "));
      const metric =
        agg.field && agg.fn !== "count"
          ? `${agg.fn} of ${agg.field}`
          : "count of trades";
      const details: string[] = [
        `Metric: ${metric}`,
        `Sample size = ${meta.rowCount ?? 0}`,
      ];
      if (plan.filters.length > 0) {
        details.push(`Filters: ${filterText}`);
      }
      if (meta.timeframe) {
        details.push(`Time range: ${meta.timeframe}`);
      }
      items.push({ label, detail: details.join(" · ") });
    }
  }

  const tradesUrl = buildTradesUrlFromPlan(context.accountId, plan);

  return {
    type: "sources",
    title: "Sources",
    items,
    tradesUrl,
  };
}

/**
 * Build coverage block from execution result
 */
function buildCoverageBlock(
  result: { meta?: any },
  plan: TradeQueryPlan
): AnalysisBlock {
  const meta = result.meta || {};
  const n = meta.rowCount || 0;

  // Determine confidence
  let confidence: ConfidenceLevel = "high";
  if (n < 30) confidence = "exploratory";
  else if (n < 100) confidence = "moderate";

  // Extract date range if available
  let from: string | undefined;
  let to: string | undefined;

  if (meta.timeframe) {
    // Try to parse "2024-01-01 to 2024-12-31" format
    const match = meta.timeframe.match(/(\d{4}-\d{2}-\d{2})/g);
    if (match && match.length >= 2) {
      from = match[0];
      to = match[1];
    }
  } else if (plan.timeframe) {
    from = plan.timeframe.from;
    to = plan.timeframe.to;
    if (plan.timeframe.lastNDays) {
      const now = new Date();
      const past = new Date(now);
      past.setDate(past.getDate() - plan.timeframe.lastNDays);
      from = past.toISOString().split("T")[0];
      to = now.toISOString().split("T")[0];
    }
  }

  return {
    type: "coverage",
    title: "Sample size",
    n,
    from,
    to,
    confidence,
  };
}

/**
 * Build breakdown table block from grouped results
 */
function buildBreakdownBlock(
  result: { meta?: any },
  plan: TradeQueryPlan
): AnalysisBlock {
  const groups = result.meta?.groups || [];
  const groupField = plan.groupBy?.[0]?.field || "group";
  const titleGroup = formatFieldLabel(groupField);

  // Build columns
  const columns = [groupField];
  if (plan.aggregates) {
    columns.push(...plan.aggregates.map((a) => a.as));
  }

  // Build rows
  const rows = groups.slice(0, 20).map((g: any) => {
    const row: (string | number | null)[] = [g[groupField] || "Unknown"];
    if (plan.aggregates) {
      for (const agg of plan.aggregates) {
        const value = g[agg.as];
        if (typeof value === "number") {
          row.push(Number(value.toFixed(2)));
        } else {
          row.push(value);
        }
      }
    }
    return row;
  });

  return {
    type: "breakdownTable",
    title: `Breakdown by ${titleGroup}`,
    columns: columns.map((c) => formatFieldLabel(c)),
    rows,
  };
}

function buildTradesUrlFromPlan(
  accountId: string,
  plan: TradeQueryPlan
): string | undefined {
  try {
    const filters: any = {};
    if (plan.timeframe) {
      if (plan.timeframe.from || plan.timeframe.to) {
        filters.dateRange = {
          start: plan.timeframe.from,
          end: plan.timeframe.to,
        };
      } else if (plan.timeframe.lastNDays) {
        const now = new Date();
        const past = new Date(now);
        past.setDate(past.getDate() - plan.timeframe.lastNDays);
        filters.dateRange = {
          start: past.toISOString().split("T")[0],
          end: now.toISOString().split("T")[0],
        };
      }
    }

    for (const filter of plan.filters) {
      if (filter.field === "symbol") {
        const symbol = String(filter.value || "");
        if (symbol) filters.symbols = [symbol];
      }
      if (filter.field === "sessionTag") {
        const tag = String(filter.value || "");
        if (tag) filters.sessionTags = [tag];
      }
      if (filter.field === "modelTag") {
        const tag = String(filter.value || "");
        if (tag) filters.modelTags = [tag];
      }
      if (filter.field === "outcome") {
        const outcome = String(filter.value || "");
        if (outcome) filters.outcomes = [outcome];
      }
      if (filter.field === "tradeType") {
        filters.tradeType = String(filter.value || "").toLowerCase();
      }
    }

    return buildTradesUrl(accountId, filters);
  } catch {
    return undefined;
  }
}

function sentenceCase(value: string): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function formatFieldLabel(key: string): string {
  const cleaned = key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

// ===== SERIALIZATION FOR HTTP STREAMING =====

/**
 * Convert stream to NDJSON for HTTP response
 */
export async function streamToNDJSON(
  userMessage: string,
  context: StreamingContext
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of streamQuery(userMessage, context)) {
          const line = JSON.stringify(event) + "\n";
          controller.enqueue(encoder.encode(line));
        }
        controller.close();
      } catch (error) {
        const errorEvent: StreamEvent = {
          event: "error",
          message: error instanceof Error ? error.message : "Stream error",
        };
        controller.enqueue(encoder.encode(JSON.stringify(errorEvent) + "\n"));
        controller.close();
      }
    },
  });
}
