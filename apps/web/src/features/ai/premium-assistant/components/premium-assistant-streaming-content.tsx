"use client";

import { Response } from "@/components/ui/shadcn-io/ai/response";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { STAGE_CONFIG } from "@/types/assistant-stream";

export function PremiumAssistantStreamingContent({
  lines,
  lineBuffer,
  stage,
  statusMessage,
}: {
  lines: string[];
  lineBuffer: string;
  stage: string | null;
  statusMessage: string;
}) {
  const stageConfig = stage
    ? STAGE_CONFIG[stage as keyof typeof STAGE_CONFIG]
    : null;
  const displayMessage = statusMessage || stageConfig?.message || "Processing...";

  return (
    <div className="space-y-3">
      {stage ? (
        <div className="flex items-center gap-2 text-xs text-white">
          <TextShimmer
            as="span"
            className="text-xs [--base-color:rgba(255,255,255,0.5)] [--base-gradient-color:rgba(255,255,255,0.95)]"
          >
            {displayMessage}
          </TextShimmer>
        </div>
      ) : null}

      {lines.length > 0 || lineBuffer ? (
        <div className="prose prose-invert prose-sm max-w-none">
          <Response parseIncompleteMarkdown>
            {`${lines.join("\n")}${lineBuffer}`}
          </Response>
        </div>
      ) : null}
    </div>
  );
}
