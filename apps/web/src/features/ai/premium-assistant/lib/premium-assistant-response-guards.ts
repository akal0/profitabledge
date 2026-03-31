import type { AnalysisBlock, VizSpec } from "@/types/assistant-stream";

export const REPHRASE_REQUEST_MARKDOWN =
  "I couldn't understand your request. Could you please rephrase it?";

const MISUNDERSTOOD_RESPONSE_PATTERNS = [
  /\bprovided query (?:was )?unclear\b/i,
  /\bi (?:couldn't|could not|do not|don't) understand\b/i,
  /\bcould you please rephrase(?: (?:that|it|your request))?\b/i,
  /\bplease rephrase(?: (?:that|it|your request))?\b/i,
  /\bgeneral recommendation based on your trader profile\b/i,
];

export function isMisunderstoodAssistantResponse(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;

  return MISUNDERSTOOD_RESPONSE_PATTERNS.some((pattern) =>
    pattern.test(trimmed)
  );
}

export function normalizeMisunderstoodAssistantPayload({
  content,
  analysisBlocks,
  visualization,
}: {
  content: string;
  analysisBlocks?: AnalysisBlock[] | null;
  visualization?: VizSpec | null;
}) {
  if (!isMisunderstoodAssistantResponse(content)) {
    return {
      content,
      analysisBlocks: analysisBlocks ?? [],
      visualization: visualization ?? null,
    };
  }

  return {
    content: REPHRASE_REQUEST_MARKDOWN,
    analysisBlocks: [] as AnalysisBlock[],
    visualization: null as VizSpec | null,
  };
}
