import type { ExecutionResult } from "../ai/query-executor";
import type { TradeQueryPlan } from "../ai/query-plan";
import type { AnalysisBlock } from "../ai/streaming-orchestrator";
import type { VizSpec } from "../ai/visualization-registry";
import type {
  AssistantFilters,
  ConversationContext,
  RenderedWidget,
  ToolCall,
} from "./types";

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function assignSingleOrArray<T>(values: T[]): T | T[] | undefined {
  if (values.length === 0) return undefined;
  return values.length === 1 ? values[0] : values;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export function buildRenderedWidgets(payload: {
  visualization?: VizSpec | null;
  analysisBlocks?: AnalysisBlock[];
}): RenderedWidget[] {
  const widgets: RenderedWidget[] = [];

  for (const block of payload.analysisBlocks || []) {
    widgets.push({ type: "analysis", block });
  }

  if (payload.visualization) {
    widgets.push({ type: "visualization", viz: payload.visualization });
  }

  return widgets;
}

export function buildToolCallsFromPlan(args: {
  userMessage: string;
  plan?: TradeQueryPlan | null;
  executionResult?: ExecutionResult | null;
  visualization?: VizSpec | null;
}): ToolCall[] {
  const toolCalls: ToolCall[] = [];

  if (args.plan) {
    toolCalls.push({
      name: "generate_plan",
      input: {
        message: args.userMessage,
      },
      output: {
        intent: args.plan.intent,
        filters: args.plan.filters,
        timeframe: args.plan.timeframe,
        groupBy: args.plan.groupBy,
        aggregates: args.plan.aggregates,
        vizType: args.plan.vizType,
        componentHint: args.plan.componentHint,
      },
    });
  }

  if (args.executionResult) {
    toolCalls.push({
      name: "execute_plan",
      output: {
        success: args.executionResult.success,
        rowCount: args.executionResult.meta?.rowCount ?? 0,
        filters: args.executionResult.meta?.filters ?? [],
        timeframe: args.executionResult.meta?.timeframe,
      },
    });
  }

  if (args.visualization) {
    toolCalls.push({
      name: "build_visualization",
      output: {
        type: args.visualization.type,
        component: args.visualization.component,
        title: args.visualization.title,
      },
    });
  }

  return toolCalls;
}

export function buildConversationContextFromPlan(args: {
  plan?: TradeQueryPlan | null;
  visualization?: VizSpec | null;
}): ConversationContext | null {
  const { plan, visualization } = args;

  if (!plan) {
    return {
      referencedEntities: {},
    };
  }

  const lastFilters: AssistantFilters = {};
  const symbolValues: string[] = [];
  const sessionValues: string[] = [];
  const modelValues: string[] = [];
  const directionValues: Array<"long" | "short"> = [];
  const stdvValues: string[] = [];
  const outcomeValues: Array<"Win" | "Loss" | "BE" | "PW"> = [];
  const protocolValues: Array<"aligned" | "against" | "discretionary"> = [];
  const originValues: Array<"broker_sync" | "csv_import" | "manual_entry"> = [];
  const customTagValues: string[] = [];

  for (const filter of plan.filters || []) {
    const values =
      filter.op === "between"
        ? [filter.value?.from, filter.value?.to]
        : asArray(filter.value);

    switch (filter.field) {
      case "symbol":
        symbolValues.push(...values.map((value) => String(value)));
        break;
      case "sessionTag":
        sessionValues.push(...values.map((value) => String(value)));
        break;
      case "modelTag":
      case "edgeName":
        modelValues.push(...values.map((value) => String(value)));
        break;
      case "tradeType":
        for (const value of values) {
          const normalized = String(value).toLowerCase();
          if (normalized === "long" || normalized === "short") {
            directionValues.push(normalized);
          }
        }
        break;
      case "protocolAlignment":
        for (const value of values) {
          const normalized = String(value).toLowerCase();
          if (
            normalized === "aligned" ||
            normalized === "against" ||
            normalized === "discretionary"
          ) {
            protocolValues.push(normalized);
          }
        }
        break;
      case "outcome":
        for (const value of values) {
          const normalized = String(value) as "Win" | "Loss" | "BE" | "PW";
          if (["Win", "Loss", "BE", "PW"].includes(normalized)) {
            outcomeValues.push(normalized);
          }
        }
        break;
      case "profit":
        if (filter.op === "gte" || filter.op === "gt") {
          lastFilters.minProfit = parseNumber(filter.value);
        }
        if (filter.op === "lte" || filter.op === "lt") {
          lastFilters.maxProfit = parseNumber(filter.value);
        }
        if (filter.op === "between") {
          lastFilters.minProfit = parseNumber(filter.value?.from);
          lastFilters.maxProfit = parseNumber(filter.value?.to);
        }
        break;
      case "volume":
        if (filter.op === "gte" || filter.op === "gt") {
          lastFilters.minVolume = parseNumber(filter.value);
        }
        if (filter.op === "lte" || filter.op === "lt") {
          lastFilters.maxVolume = parseNumber(filter.value);
        }
        if (filter.op === "between") {
          lastFilters.minVolume = parseNumber(filter.value?.from);
          lastFilters.maxVolume = parseNumber(filter.value?.to);
        }
        break;
      case "realisedRR":
        if (filter.op === "gte" || filter.op === "gt") {
          lastFilters.minRR = parseNumber(filter.value);
        }
        if (filter.op === "lte" || filter.op === "lt") {
          lastFilters.maxRR = parseNumber(filter.value);
        }
        if (filter.op === "between") {
          lastFilters.minRR = parseNumber(filter.value?.from);
          lastFilters.maxRR = parseNumber(filter.value?.to);
        }
        break;
      case "stdvBucket":
        stdvValues.push(...values.map((value) => String(value)));
        break;
      case "customTags":
      case "customTag":
        customTagValues.push(...values.map((value) => String(value)));
        break;
      case "originType":
        for (const value of values) {
          const normalized = String(value) as
            | "broker_sync"
            | "csv_import"
            | "manual_entry";
          if (["broker_sync", "csv_import", "manual_entry"].includes(normalized)) {
            originValues.push(normalized);
          }
        }
        break;
      default:
        break;
    }
  }

  lastFilters.symbol = assignSingleOrArray(symbolValues);
  lastFilters.sessionTag = assignSingleOrArray(sessionValues);
  lastFilters.modelTag = assignSingleOrArray(modelValues);
  lastFilters.direction = directionValues[0];
  lastFilters.protocolAlignment = assignSingleOrArray(protocolValues);
  lastFilters.outcome = assignSingleOrArray(outcomeValues);
  lastFilters.stdvBucket = assignSingleOrArray(stdvValues);
  lastFilters.customTag = assignSingleOrArray(customTagValues);
  lastFilters.originType = assignSingleOrArray(originValues);

  if (plan.timeframe?.from) {
    lastFilters.dateFrom = plan.timeframe.from;
  }
  if (plan.timeframe?.to) {
    lastFilters.dateTo = plan.timeframe.to;
  }

  const tradeIds = Array.from(
    new Set(
      asArray(visualization?.data.tradeIds).filter(
        (tradeId): tradeId is string => typeof tradeId === "string"
      )
    )
  );

  const metricField =
    plan.compare?.metric.field ||
    plan.aggregates?.[0]?.field ||
    visualization?.data.yAxis ||
    plan.componentHint ||
    plan.vizType;

  return {
    lastMentionedSymbol: assignSingleOrArray(symbolValues),
    lastMentionedDateRange:
      plan.timeframe?.from || plan.timeframe?.to
        ? {
            from: plan.timeframe?.from || "",
            to: plan.timeframe?.to || plan.timeframe?.from || "",
          }
        : undefined,
    lastMentionedMetric: metricField || undefined,
    lastMentionedSession: sessionValues[0],
    lastMentionedStrategy: modelValues[0],
    lastMentionedDirection: directionValues[0],
    lastMentionedTrades: tradeIds.length > 0 ? tradeIds : undefined,
    lastFilters,
    referencedEntities: {},
  };
}
