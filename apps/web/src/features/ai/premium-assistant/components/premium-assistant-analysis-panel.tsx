"use client";

import { motion } from "framer-motion";
import { IconSidebarLeftArrow } from "central-icons";
import { BarChart3 } from "lucide-react";
import { AnalysisBlockRenderer } from "@/components/ai/analysis-block-renderer";
import { AnalysisPanelSkeleton } from "@/components/ai/analysis-skeleton";
import { WidgetBlockRenderer, WidgetBlockSkeleton } from "@/components/ai/widget-block-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { AnalysisBlock, VizSpec } from "@/types/assistant-stream";

export function PremiumAssistantAnalysisPanel({
  panelOpen,
  panelTransition,
  isStreaming,
  currentVisualization,
  currentAnalysisBlocks,
  accountId,
  onViewTrades,
  onClose,
  onOpen,
}: {
  panelOpen: boolean;
  panelTransition: {
    x: { duration: number; ease: "easeInOut" };
    opacity: { duration: number; ease: "easeInOut" };
    width: { duration: number; ease: "easeInOut" } | { duration: number };
  };
  isStreaming: boolean;
  currentVisualization: VizSpec | null | undefined;
  currentAnalysisBlocks: AnalysisBlock[];
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
      <motion.div
        initial={false}
        className="min-h-0 h-full overflow-x-hidden overflow-y-auto border-l border-white/5 bg-sidebar"
        animate={{
          width: panelOpen ? "40%" : "0%",
          x: panelOpen ? 0 : "100%",
          opacity: panelOpen ? 1 : 0,
        }}
        transition={panelTransition}
        style={{ pointerEvents: panelOpen ? "auto" : "none" }}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white/90">Analysis</span>
              {isStreaming ? (
                <Badge variant="outline" className="animate-pulse text-[10px]">
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

          <ScrollArea className="flex-1">
            <div className="space-y-4 p-4">
              {currentVisualization ? (
                <WidgetBlockRenderer
                  viz={currentVisualization}
                  onViewTrades={onViewTrades}
                  accountId={accountId}
                />
              ) : isStreaming ? (
                <WidgetBlockSkeleton />
              ) : null}

              {isStreaming && currentAnalysisBlocks.length === 0 ? (
                <AnalysisPanelSkeleton />
              ) : (
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
                      index={nonCoverageBlocks.length + coverageBlocks.length + index}
                      onViewTrades={onViewTrades}
                    />
                  ))}
                </>
              )}

              {!currentVisualization &&
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
          </ScrollArea>
        </div>
      </motion.div>

      {!panelOpen && (currentVisualization || currentAnalysisBlocks.length > 0) ? (
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute right-4 top-4 flex cursor-pointer items-center gap-2 border border-white/5 px-3 py-2 text-white/50 backdrop-blur-2xl transition-colors hover:bg-sidebar-accent hover:text-white"
          onClick={onOpen}
        >
          <IconSidebarLeftArrow className="h-4 w-4" />
          <span className="text-xs font-medium">Show analysis</span>
        </motion.button>
      ) : null}
    </>
  );
}
