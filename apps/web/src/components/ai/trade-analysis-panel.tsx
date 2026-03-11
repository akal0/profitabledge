/**
 * Trade Analysis Panel
 * 
 * Right-side panel that shows structured analysis for the current query.
 * Slides in/out automatically based on analysis availability.
 */

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssistantStreamState } from "@/types/assistant-stream";
import { STAGE_CONFIG } from "@/types/assistant-stream";
import { AnalysisBlockRenderer } from "./analysis-block-renderer";
import {
  WidgetBlockRenderer,
  WidgetBlockSkeleton,
} from "./widget-block-renderer";
import { AnalysisPanelSkeleton } from "./analysis-skeleton";
import { TextShimmer } from "@/components/ui/text-shimmer";

interface TradeAnalysisPanelProps {
  streamState: AssistantStreamState;
  onClose?: () => void;
  isOpen?: boolean;
  onExitComplete?: () => void;
  accountId?: string;
  className?: string;
}

export function TradeAnalysisPanel({
  streamState,
  onClose,
  isOpen,
  onExitComplete,
  accountId,
  className,
}: TradeAnalysisPanelProps) {
  const { stage, statusMessage, analysisBlocks, isStreaming, isDone } = streamState;
  const nonCoverageBlocks = analysisBlocks.filter(
    (block) => block.type !== "coverage" && block.type !== "callout"
  );
  const coverageBlocks = analysisBlocks.filter(
    (block) => block.type === "coverage"
  );
  const calloutBlocks = analysisBlocks.filter(
    (block) => block.type === "callout"
  );

  // Determine if panel should be visible
  const hasContent = analysisBlocks.length > 0 || isStreaming;
  const isVisible =
    isOpen === undefined ? hasContent : isOpen && hasContent;

  // Get stage display info
  const stageConfig = stage ? STAGE_CONFIG[stage] : null;

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {isVisible && (
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className={cn(
            "fixed right-0 top-0 h-full w-full md:w-[480px] lg:w-[560px]",
            "bg-sidebar border-l border-white/5 z-40",
            "flex flex-col",
            className
          )}
        >
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-white/5">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-white">Trade Analysis</h2>
              {stageConfig && (
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <div className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isStreaming ? "bg-purple-500 animate-pulse" : "bg-green-500"
                  )} />
                  <TextShimmer
                    as="span"
                    className="text-xs [--base-color:rgba(255,255,255,0.4)] [--base-gradient-color:rgba(255,255,255,0.9)]"
                  >
                    {statusMessage || stageConfig.message}
                  </TextShimmer>
                </div>
              )}
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                aria-label="Close analysis panel"
              >
                <X className="h-5 w-5 text-white/50" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Show skeleton while streaming and no blocks yet */}
            {isStreaming && analysisBlocks.length === 0 && (
              <AnalysisPanelSkeleton stage={stageConfig?.label} />
            )}

            {/* Visualization */}
            {streamState.visualization && (
              <div className="p-6 pb-0">
                <WidgetBlockRenderer
                  viz={streamState.visualization}
                  accountId={accountId}
                />
              </div>
            )}

            {isStreaming && !streamState.visualization && (
              <div className="p-6 pb-0">
                <WidgetBlockSkeleton />
              </div>
            )}

            {/* Render analysis blocks */}
            {analysisBlocks.length > 0 && (
              <div className="space-y-4 p-6">
                {nonCoverageBlocks.map((block, index) => (
                  <AnalysisBlockRenderer
                    key={index}
                    block={block}
                    index={index}
                  />
                ))}

                {coverageBlocks.map((block, index) => (
                  <AnalysisBlockRenderer
                    key={`coverage-${index}`}
                    block={block}
                    index={nonCoverageBlocks.length + index}
                  />
                ))}

                {calloutBlocks.map((block, index) => (
                  <AnalysisBlockRenderer
                    key={`callout-${index}`}
                    block={block}
                    index={nonCoverageBlocks.length + coverageBlocks.length + index}
                  />
                ))}

                {/* Show partial skeleton if still streaming */}
                {isStreaming && (
                  <div className="opacity-50">
                    <div className="h-24 rounded-lg border border-white/5 bg-dashboard-background shimmer" />
                  </div>
                )}
              </div>
            )}

            {/* Completion state */}
            {isDone && analysisBlocks.length > 0 && (
              <div className="p-6 pt-0">
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                  <p className="text-sm text-green-400">Analysis complete</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
