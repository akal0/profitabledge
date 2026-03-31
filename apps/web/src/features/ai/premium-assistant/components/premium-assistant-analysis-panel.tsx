"use client";

import { AnimatePresence, motion } from "motion/react";
import { IconSidebarLeftArrow } from "central-icons";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnalysisBlockRenderer } from "@/components/ai/analysis-block-renderer";
import { WidgetBlockRenderer } from "@/components/ai/widget-block-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator, VerticalSeparator } from "@/components/ui/separator";
import type {
  AnalysisBlock,
  StreamStage,
  VizSpec,
} from "@/types/assistant-stream";
import { PremiumAssistantStreamingContent } from "@/features/ai/premium-assistant/components/premium-assistant-streaming-content";

export function PremiumAssistantAnalysisPanel({
  panelOpen,
  isStreaming,
  presentationReady,
  currentVisualization,
  currentAnalysisBlocks,
  streamStage,
  statusMessage,
  accountId,
  onViewTrades,
  onClose,
  onOpen,
}: {
  panelOpen: boolean;
  isStreaming: boolean;
  presentationReady: boolean;
  currentVisualization: VizSpec | null | undefined;
  currentAnalysisBlocks: AnalysisBlock[];
  streamStage: StreamStage | null;
  statusMessage: string;
  accountId?: string;
  onViewTrades: (tradeIds: string[]) => void;
  onClose: () => void;
  onOpen: () => void;
}) {
  const nonCoverageBlocks = currentAnalysisBlocks.filter(
    (block) => block.type !== "coverage" && block.type !== "callout"
  );
  const coverageBlocks = currentAnalysisBlocks.filter(
    (block) => block.type === "coverage"
  );
  const calloutBlocks = currentAnalysisBlocks.filter(
    (block) => block.type === "callout"
  );

  return (
    <>
      <div
        className={cn(
          "absolute inset-y-0 right-0 z-20 min-h-0 max-w-full overflow-hidden bg-sidebar transition-[opacity,transform] duration-300 ease-in-out",
          panelOpen
            ? "translate-x-0 opacity-100"
            : "translate-x-full opacity-0 pointer-events-none"
        )}
        style={{ width: "min(100%, var(--assistant-analysis-width))" }}
      >
        <div className="flex h-full">
          <VerticalSeparator className="shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white/90">
                  Analysis
                </span>
                {isStreaming ? (
                  <Badge
                    variant="outline"
                    className="animate-pulse text-[10px]"
                  >
                    Live
                  </Badge>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-white/50 hover:text-white"
              >
                <IconSidebarLeftArrow className="h-4 w-4 rotate-180" />
              </Button>
            </div>

            <Separator />

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              <div className="space-y-4 p-4">
                <AnimatePresence initial={false} mode="wait">
                  {presentationReady && currentVisualization ? (
                    <motion.div
                      key={currentVisualization.title}
                      initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
                      transition={{
                        duration: 0.35,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <WidgetBlockRenderer
                        viz={currentVisualization}
                        onViewTrades={onViewTrades}
                        accountId={accountId}
                      />
                    </motion.div>
                  ) : !presentationReady ? (
                    <motion.div
                      key="streaming-steps"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.24 }}
                    >
                      <PremiumAssistantStreamingContent
                        lines={[]}
                        lineBuffer=""
                        stage={streamStage}
                        statusMessage={statusMessage}
                        showResponse={false}
                        className="py-1"
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {presentationReady ? (
                  <>
                    {nonCoverageBlocks.map((block, index) => (
                      <AnalysisBlockRenderer
                        key={index}
                        block={block}
                        index={index}
                        onViewTrades={onViewTrades}
                      />
                    ))}

                    {coverageBlocks.map((block, index) => (
                      <AnalysisBlockRenderer
                        key={`coverage-${index}`}
                        block={block}
                        index={nonCoverageBlocks.length + index}
                        onViewTrades={onViewTrades}
                      />
                    ))}

                    {calloutBlocks.map((block, index) => (
                      <AnalysisBlockRenderer
                        key={`callout-${index}`}
                        block={block}
                        index={
                          nonCoverageBlocks.length +
                          coverageBlocks.length +
                          index
                        }
                        onViewTrades={onViewTrades}
                      />
                    ))}
                  </>
                ) : null}

                {presentationReady &&
                !currentVisualization &&
                currentAnalysisBlocks.length === 0 &&
                !isStreaming ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <BarChart3 className="mb-4 h-12 w-12 text-white/10" />
                    <p className="text-sm text-white/40">
                      Ask a question to see analysis here
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {!panelOpen &&
      ((presentationReady && currentVisualization) ||
        currentAnalysisBlocks.length > 0) ? (
        <button
          className="absolute right-4 top-4 z-30 flex cursor-pointer items-center gap-2 border border-white/5 bg-sidebar/90 px-3 py-2 text-white/50 transition-colors hover:bg-sidebar-accent hover:text-white rounded-md"
          onClick={onOpen}
        >
          <IconSidebarLeftArrow className="size-3" />
          <span className="text-xs font-medium">Show analysis</span>
        </button>
      ) : null}
    </>
  );
}
