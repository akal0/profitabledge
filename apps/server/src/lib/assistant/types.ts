import type { AnalysisBlock } from "../ai/streaming-orchestrator";
import type { VizSpec } from "../ai/visualization-registry";

export type AssistantFilters = {
  symbol?: string | string[];
  dateFrom?: string;
  dateTo?: string;
  direction?: "long" | "short";
  sessionTag?: string | string[];
  modelTag?: string | string[];
  protocolAlignment?:
    | "aligned"
    | "against"
    | "discretionary"
    | Array<"aligned" | "against" | "discretionary">;
  outcome?: "Win" | "Loss" | "BE" | "PW" | Array<"Win" | "Loss" | "BE" | "PW">;
  minProfit?: number;
  maxProfit?: number;
  minVolume?: number;
  maxVolume?: number;
  minRR?: number;
  maxRR?: number;
  stdvBucket?: string | string[];
  customTag?: string | string[];
  originType?:
    | "broker_sync"
    | "csv_import"
    | "manual_entry"
    | Array<"broker_sync" | "csv_import" | "manual_entry">;
};

export type ConversationContext = {
  lastMentionedSymbol?: string | string[];
  lastMentionedDateRange?: { from: string; to: string };
  lastMentionedMetric?: string;
  lastMentionedSession?: string;
  lastMentionedStrategy?: string;
  lastMentionedDirection?: "long" | "short";
  lastMentionedTrades?: string[];
  lastFilters?: AssistantFilters;
  referencedEntities: Record<string, unknown>;
};

export type ToolCall = {
  name: string;
  input?: unknown;
  output?: unknown;
};

export type RenderedWidget =
  | {
      type: "visualization";
      viz: VizSpec;
    }
  | {
      type: "analysis";
      block: AnalysisBlock;
    }
  | {
      type: "legacy-data";
      data: {
        visualization?: VizSpec | null;
        analysisBlocks?: AnalysisBlock[];
      };
    };

export type AssistantResponseMetadata = {
  toolCalls: ToolCall[];
  context: ConversationContext | null;
};
