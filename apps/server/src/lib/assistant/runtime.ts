import type { AssistantPageContext } from "../ai/assistant-specialists";
import {
  streamQuery,
  type AnalysisBlock,
} from "../ai/streaming-orchestrator";
import type { VizSpec } from "../ai/visualization-registry";
import type { AssistantResponseMetadata } from "./types";

export type AssistantRuntimeResult = {
  content: string;
  analysisBlocks: AnalysisBlock[];
  visualization: VizSpec | null;
  metadata: AssistantResponseMetadata | null;
  error: string | null;
};

export async function collectAssistantResponse(
  message: string,
  context: {
    userId: string;
    accountId: string;
    conversationHistory?: string[];
    evidenceMode?: boolean;
    pageContext?: AssistantPageContext;
  }
): Promise<AssistantRuntimeResult> {
  const analysisBlocks: AnalysisBlock[] = [];
  let visualization: VizSpec | null = null;
  let metadata: AssistantResponseMetadata | null = null;
  let error: string | null = null;
  let content = "";

  for await (const event of streamQuery(message, context)) {
    switch (event.event) {
      case "delta":
        content += event.text;
        break;
      case "analysis":
        analysisBlocks.push(event.block);
        break;
      case "visualization":
        visualization = event.viz;
        break;
      case "metadata":
        metadata = event.metadata;
        break;
      case "error":
        error = event.message;
        break;
      default:
        break;
    }
  }

  return {
    content: content.trim(),
    analysisBlocks,
    visualization,
    metadata,
    error,
  };
}
