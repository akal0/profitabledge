"use client";

import { motion } from "framer-motion";
import { AtSign, ChevronRight, FileDown, History, Slash } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ui/shadcn-io/ai/message";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ui/shadcn-io/ai/prompt-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ChatEditor } from "@/components/ai/chat-editor";
import { ChatHistorySidebar } from "@/components/ai/chat-history-sidebar";
import { PremiumAssistantAmbientOrbs } from "@/features/ai/premium-assistant/components/premium-assistant-ambient-orbs";
import { PremiumAssistantAnalysisPanel } from "@/features/ai/premium-assistant/components/premium-assistant-analysis-panel";
import { PremiumAssistantEmptyState } from "@/features/ai/premium-assistant/components/premium-assistant-empty-state";
import { PremiumAssistantGoalDialog } from "@/features/ai/premium-assistant/components/premium-assistant-goal-dialog";
import { PremiumAssistantResponseCards } from "@/features/ai/premium-assistant/components/premium-assistant-response-cards";
import { PremiumAssistantStreamingContent } from "@/features/ai/premium-assistant/components/premium-assistant-streaming-content";
import { usePremiumAssistantController } from "@/features/ai/premium-assistant/hooks/use-premium-assistant-controller";
import { TRADING_SUGGESTIONS } from "@/features/ai/premium-assistant/lib/premium-assistant-types";

interface PremiumAssistantProps {
  accountId?: string;
  userImage?: string | null;
  userName?: string | null;
  className?: string;
  contextPathOverride?: string;
}

export function PremiumAssistant({
  accountId,
  userImage,
  userName,
  className,
  contextPathOverride,
}: PremiumAssistantProps) {
  const controller = usePremiumAssistantController({
    accountId,
    contextPathOverride,
  });

  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex h-full min-h-0 w-full overflow-hidden bg-sidebar",
          className
        )}
      >
        <ChatHistorySidebar
          accountId={accountId}
          onSelectReport={controller.handleSelectReport}
          onNewChat={controller.handleClear}
          currentReportId={controller.currentReportId}
          isOpen={controller.historySidebarOpen}
          onClose={() => controller.setHistorySidebarOpen(false)}
        />

        <motion.div
          initial={false}
          className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden"
          animate={{ width: "auto" }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
        >
          <PremiumAssistantAmbientOrbs isTyping={controller.isTyping} />

          <button
            onClick={() =>
              controller.setHistorySidebarOpen(!controller.historySidebarOpen)
            }
            className="absolute left-4 top-4 z-30 flex cursor-pointer items-center gap-2 rounded-lg border border-white/5 px-3 py-2 text-white/50 backdrop-blur-2xl transition-colors hover:bg-sidebar-accent hover:text-white"
          >
            <History className="h-4 w-4" />
          </button>

          <div className="relative z-10 mx-auto flex min-h-0 w-full flex-1 overflow-hidden">
            {controller.messages.length === 0 ? (
              <PremiumAssistantEmptyState
                onSuggestionClick={controller.handleSuggestionClick}
                suggestions={TRADING_SUGGESTIONS}
              />
            ) : (
              <ScrollArea className="relative z-0 h-full w-full">
                <div className="relative z-0 w-full space-y-6 px-8 py-6">
                  {controller.messages.map((message) => (
                    <Message key={message.id} from={message.role} className="w-full">
                      <MessageAvatar
                        src={
                          message.role === "user"
                            ? userImage ||
                              "https://api.dicebear.com/7.x/avataaars/svg?seed=user"
                            : "https://api.dicebear.com/7.x/bottts/svg?seed=assistant&backgroundColor=b6e3f4"
                        }
                        name={message.role === "user" ? userName || "You" : "AI"}
                      />
                      <MessageContent
                        className={
                          message.role === "assistant"
                            ? "w-full rounded-none border-none bg-transparent p-0"
                            : "rounded-none border-none bg-transparent p-0 text-white!"
                        }
                      >
                        {message.role === "assistant" ? (
                          message.content === "" && controller.state.isStreaming ? (
                            <PremiumAssistantStreamingContent
                              lines={controller.state.lines}
                              lineBuffer={controller.state.lineBuffer}
                              stage={controller.state.stage}
                              statusMessage={controller.state.statusMessage}
                            />
                          ) : (
                            <PremiumAssistantResponseCards content={message.content} />
                          )
                        ) : (
                          <div className="flex h-full w-full flex-col rounded-sm border border-white/5 bg-sidebar p-1">
                            <div className="flex w-full items-start justify-between gap-3 px-3.5 py-2">
                              <h2 className="text-sm font-medium text-white/50">
                                Your message
                              </h2>
                            </div>
                            <div className="flex h-full w-full flex-col rounded-sm bg-white transition-all duration-150 dark:bg-sidebar-accent dark:hover:brightness-120">
                              <div className="flex h-full flex-col p-3.5 text-white">
                                {message.html ? (
                                  <div
                                    className="prose prose-invert max-w-none text-sm"
                                    dangerouslySetInnerHTML={{ __html: message.html }}
                                  />
                                ) : (
                                  <div className="text-sm text-white">
                                    {message.content}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {message.visualization ? (
                          <button
                            onClick={() => {
                              controller.setSelectedVisualization(
                                message.visualization || null
                              );
                              controller.setSelectedAnalysisBlocks(
                                message.analysisBlocks || []
                              );
                              controller.setPanelOpen(true);
                            }}
                            className="mt-3 flex w-max cursor-pointer items-center gap-1 text-xs text-purple-400 transition-colors hover:text-purple-300"
                          >
                            View visualization
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        ) : null}
                      </MessageContent>
                    </Message>
                  ))}

                  <div ref={controller.messagesEndRef} />
                  <div aria-hidden="true" className="h-36" />
                </div>
              </ScrollArea>
            )}
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 w-full px-8">
            <motion.div
              layout="size"
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className={cn(
                "mx-auto w-full pointer-events-auto",
                controller.panelOpen ? "max-w-4xl" : "max-w-5xl"
              )}
            >
              <PromptInput
                onSubmit={controller.handleSubmit}
                id="assistant-input-form"
                className="w-full rounded-none! border-white/5 bg-sidebar/5 backdrop-blur-lg transition-colors group"
              >
                <ChatEditor
                  ref={controller.editorRef}
                  disabled={controller.state.isStreaming}
                  placeholder="Ask anything to get an idea of your edge..."
                  onChange={(value) => {
                    controller.setInputValue(value);
                    controller.setIsTyping(value.trim().length > 0);
                  }}
                  onHtmlChange={controller.setInputHtml}
                  onSubmit={() => {
                    const form = document.getElementById(
                      "assistant-input-form"
                    ) as HTMLFormElement | null;
                    form?.requestSubmit();
                  }}
                  fetchSuggestions={controller.fetchSuggestions}
                  className="w-full border-b-0 bg-transparent text-white transition-colors placeholder:text-white/50 group-hover:bg-sidebar/15!"
                />
                <PromptInputToolbar className="px-3 transition-colors group-hover:bg-sidebar/15">
                  <PromptInputTools>
                    {controller.messages.length > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={controller.handleClear}
                        className="rounded-none text-xs text-white/50 hover:text-white"
                      >
                        Clear chat
                      </Button>
                    ) : null}
                    <Toggle
                      size="sm"
                      variant="outline"
                      pressed={controller.evidenceMode}
                      onPressedChange={controller.setEvidenceMode}
                      className="cursor-pointer border-0 px-3 text-xs text-white/70 transition-colors data-[state=on]:bg-accent data-[state=on]:text-white"
                    >
                      Evidence
                    </Toggle>
                  </PromptInputTools>
                  <div className="flex items-center gap-1">
                    {controller.messages.length > 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={controller.handleExportPDF}
                            className="h-8 w-8 text-white/60 hover:text-white"
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Export as PDF</TooltipContent>
                      </Tooltip>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => controller.editorRef.current?.insertText("@")}
                      className="h-8 w-8 text-white/60 hover:text-white"
                    >
                      <AtSign className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => controller.editorRef.current?.insertText("/")}
                      className="h-8 w-8 text-white/60 hover:text-white"
                    >
                      <Slash className="h-4 w-4" />
                    </Button>
                    <PromptInputSubmit
                      disabled={
                        controller.state.isStreaming ||
                        !controller.inputValue.trim()
                      }
                      className="border-0 bg-transparent text-white hover:bg-sidebar"
                    />
                  </div>
                </PromptInputToolbar>
              </PromptInput>
            </motion.div>
          </div>
        </motion.div>

        <PremiumAssistantAnalysisPanel
          panelOpen={controller.panelOpen}
          panelTransition={controller.panelTransition}
          isStreaming={controller.state.isStreaming}
          currentVisualization={controller.currentVisualization}
          currentAnalysisBlocks={controller.currentAnalysisBlocks}
          accountId={accountId}
          onViewTrades={controller.handleViewTrades}
          onClose={() => controller.setPanelOpen(false)}
          onOpen={() => controller.setPanelOpen(true)}
        />

        <PremiumAssistantGoalDialog
          open={controller.showGoalDialog}
          onOpenChange={controller.setShowGoalDialog}
          onGoalGenerated={controller.handleCreateGoal}
          accountId={accountId || ""}
        />
      </div>
    </TooltipProvider>
  );
}
