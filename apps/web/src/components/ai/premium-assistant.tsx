"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AtSign,
  ChevronRight,
  FileDown,
  History,
  PanelLeftIcon,
  Slash,
} from "lucide-react";

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
import { useSidebar } from "@/components/ui/sidebar";
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
import { PremiumAssistantAnalysisPanel } from "@/features/ai/premium-assistant/components/premium-assistant-analysis-panel";
import { PremiumAssistantEmptyState } from "@/features/ai/premium-assistant/components/premium-assistant-empty-state";
import { PremiumAssistantGoalDialog } from "@/features/ai/premium-assistant/components/premium-assistant-goal-dialog";
import { PremiumAssistantResponseCards } from "@/features/ai/premium-assistant/components/premium-assistant-response-cards";
import {
  PremiumAssistantStreamingContent,
} from "@/features/ai/premium-assistant/components/premium-assistant-streaming-content";
import { usePremiumAssistantController } from "@/features/ai/premium-assistant/hooks/use-premium-assistant-controller";
import { PROFITABLEDGE_FAVICON_PATH } from "@/lib/brand-assets";
import {
  WidgetBlockRenderer,
} from "@/components/ai/widget-block-renderer";

const ALLOWED_ASSISTANT_HTML_TAGS = new Set([
  "p",
  "br",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "code",
  "pre",
  "blockquote",
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);

function sanitizeAssistantHtml(markup: string) {
  if (typeof window === "undefined") {
    return markup;
  }

  const parser = new DOMParser();
  const documentFragment = parser.parseFromString(markup || "", "text/html");
  const root = documentFragment.body ?? documentFragment.documentElement;

  if (!root) {
    return markup;
  }

  const sanitizeNode = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();

      if (!ALLOWED_ASSISTANT_HTML_TAGS.has(tagName)) {
        const parent = element.parentNode;
        if (parent) {
          while (element.firstChild) {
            parent.insertBefore(element.firstChild, element);
          }
          parent.removeChild(element);
        }
        return;
      }

      for (const attribute of Array.from(element.attributes)) {
        const attributeName = attribute.name.toLowerCase();
        if (attributeName.startsWith("on")) {
          element.removeAttribute(attribute.name);
          continue;
        }

        if (tagName === "a" && attributeName === "href") {
          const href = attribute.value.trim();
          if (
            !href.startsWith("http://") &&
            !href.startsWith("https://") &&
            !href.startsWith("mailto:")
          ) {
            element.removeAttribute(attribute.name);
          }
          continue;
        }

        if (tagName === "a" && ["target", "rel"].includes(attributeName)) {
          continue;
        }

        if (attributeName !== "class") {
          element.removeAttribute(attribute.name);
        }
      }

      if (tagName === "a") {
        element.setAttribute("rel", "noopener noreferrer");
        element.setAttribute("target", "_blank");
      }
    }

    for (const child of Array.from(node.childNodes)) {
      sanitizeNode(child);
    }
  };

  sanitizeNode(root);
  return documentFragment.body?.innerHTML ?? markup;
}

function SidebarToggleButton() {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm border border-white/10 bg-sidebar/80 text-white/70 transition-colors hover:bg-white/8 hover:text-white"
    >
      <PanelLeftIcon className="h-4 w-4" />
    </button>
  );
}

function AssistantEmptyArtwork() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[url('/landing/hero-background-assistant.svg')] bg-cover bg-center bg-no-repeat opacity-[0.22]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_34%,rgba(5,5,5,0.5)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,5,0.22)_0%,rgba(5,5,5,0.4)_100%)]" />
    </div>
  );
}

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
  const isEmptyState = controller.messages.length === 0;
  const [streamPresentationComplete, setStreamPresentationComplete] =
    useState(true);
  const isAssistantPresentationInFlight =
    controller.state.isStreaming ||
    (controller.state.isDone && !streamPresentationComplete);
  const effectivePanelOpen =
    controller.panelOpen && !isAssistantPresentationInFlight;
  const analysisPresentationReady =
    controller.state.presentationReady && streamPresentationComplete;

  useEffect(() => {
    if (controller.state.isStreaming) {
      setStreamPresentationComplete(false);
    }
  }, [controller.state.isStreaming]);

  return (
    <TooltipProvider>
      <div
        className={cn(
          "relative flex h-full min-h-0 w-full overflow-hidden",
          isEmptyState ? "bg-[#050505]" : "bg-sidebar",
          className
        )}
        style={
          {
            "--assistant-analysis-width": "clamp(40rem, 40vw, 58rem)",
          } as React.CSSProperties
        }
      >
        {isEmptyState ? <AssistantEmptyArtwork /> : null}

        <ChatHistorySidebar
          accountId={accountId}
          userImage={userImage}
          userName={userName}
          onSelectReport={controller.handleSelectReport}
          onNewChat={controller.handleClear}
          currentReportId={controller.currentReportId}
          isOpen={controller.historySidebarOpen}
          onClose={() => controller.setHistorySidebarOpen(false)}
        />

        <div
          className={cn(
            "relative z-10 flex h-full min-h-0 flex-1 flex-col overflow-hidden transition-[margin-right] ease-in-out",
            effectivePanelOpen
              ? "duration-0 lg:mr-[var(--assistant-analysis-width)]"
              : "duration-300 lg:mr-0"
          )}
          style={{ contain: "layout style" }}
        >
          <div className="absolute left-4 top-4 z-30 flex items-center gap-2 sm:left-6 lg:left-8">
            <SidebarToggleButton />
            <button
              onClick={() =>
                controller.setHistorySidebarOpen(!controller.historySidebarOpen)
              }
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm border border-white/10 bg-sidebar/80 text-white/70 transition-colors hover:bg-white/8 hover:text-white"
            >
              <History className="h-4 w-4" />
            </button>
          </div>

          <div className="relative z-10 mx-auto flex min-h-0 w-full flex-1 overflow-hidden">
            {isEmptyState ? (
              <PremiumAssistantEmptyState
                onSuggestionClick={controller.handleSuggestionClick}
                suggestions={controller.starterSuggestions}
                isLoadingSuggestions={controller.isStarterSuggestionsLoading}
              />
            ) : (
              <ScrollArea className="relative z-0 h-full w-full">
                <div className="relative z-0 w-full space-y-6 px-8 py-6">
                  {controller.messages.map((message, index) => {
                    const isLatestMessage =
                      index === controller.messages.length - 1;
                    const isActiveAssistantPresentation =
                      message.role === "assistant" &&
                      isLatestMessage &&
                      (controller.state.isStreaming ||
                        (controller.state.isDone &&
                          !streamPresentationComplete));

                    return (
                    <Message
                      key={message.id}
                      from={message.role}
                      className="w-full"
                    >
                      <MessageAvatar
                        src={
                          message.role === "user"
                            ? userImage || ""
                            : PROFITABLEDGE_FAVICON_PATH
                        }
                        name={
                          message.role === "user"
                            ? userName || "You"
                            : "Profitabledge"
                        }
                      />
                      <MessageContent
                        className={
                          message.role === "assistant"
                            ? "w-full rounded-none border-none bg-transparent p-0"
                            : "rounded-none border-none bg-transparent p-0 text-white!"
                        }
                      >
                        {message.role === "assistant" ? (
                          isActiveAssistantPresentation ? (
                            <div className="w-full space-y-4 py-1">
                              <PremiumAssistantStreamingContent
                                lines={controller.state.lines}
                                lineBuffer={controller.state.lineBuffer}
                                stage={controller.state.stage}
                                statusMessage={controller.state.statusMessage}
                                showResponse={controller.state.presentationReady}
                                finalizePresentation={controller.state.isDone}
                                onPresentationComplete={() =>
                                  setStreamPresentationComplete(true)
                                }
                              />
                              <AnimatePresence initial={false} mode="wait">
                                {controller.state.presentationReady &&
                                controller.state.visualization ? (
                                  <motion.div
                                    key={controller.state.visualization.title}
                                    initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                    exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
                                    transition={{
                                      duration: 0.35,
                                      ease: [0.22, 1, 0.36, 1],
                                    }}
                                  >
                                    <WidgetBlockRenderer
                                      viz={controller.state.visualization}
                                      accountId={accountId}
                                      onViewTrades={controller.handleViewTrades}
                                    />
                                  </motion.div>
                                ) : null}
                              </AnimatePresence>
                            </div>
                          ) : (
                            <PremiumAssistantResponseCards
                              content={message.content}
                              analysisBlocks={message.analysisBlocks}
                              visualization={message.visualization}
                              accountId={accountId}
                              onViewTrades={controller.handleViewTrades}
                            />
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
                                    dangerouslySetInnerHTML={{
                                      __html: sanitizeAssistantHtml(message.html),
                                    }}
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
                    );
                  })}

                  <div ref={controller.messagesEndRef} />
                  <div aria-hidden="true" className="h-36" />
                </div>
              </ScrollArea>
            )}
          </div>

          <div
            className="pointer-events-none absolute inset-x-0 bottom-6 z-30 px-8"
          >
            <div className="mx-auto w-full max-w-5xl pointer-events-auto">
              <PromptInput
                onSubmit={controller.handleSubmit}
                id="assistant-input-form"
                className="w-full divide-y-0 rounded-md! border-white/5 bg-sidebar/95 backdrop-blur-none transition-colors group"
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
                <PromptInputToolbar className="px-3 pb-3 pt-1 transition-colors group-hover:bg-sidebar/15">
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
                      onClick={() =>
                        controller.editorRef.current?.insertText("@")
                      }
                      className="h-8 w-8 text-white/60 hover:text-white"
                    >
                      <AtSign className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        controller.editorRef.current?.insertText("/")
                      }
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
            </div>
          </div>
        </div>

          <PremiumAssistantAnalysisPanel
            panelOpen={effectivePanelOpen}
            isStreaming={controller.state.isStreaming}
            presentationReady={analysisPresentationReady}
            currentVisualization={controller.currentVisualization}
            currentAnalysisBlocks={controller.currentAnalysisBlocks}
            streamStage={controller.state.stage}
            statusMessage={controller.state.statusMessage}
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
