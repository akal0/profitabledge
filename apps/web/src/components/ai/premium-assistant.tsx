"use client";

/**
 * Premium AI Trading Assistant
 *
 * Two-pane interface:
 * - Left: Chat with streaming responses and markdown
 * - Right: Dynamic visualization panel with charts/widgets
 * 
 * Features:
 * - Chat history sidebar with search
 * - PDF export for analysis reports
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useAssistantStream } from "@/hooks/use-assistant-stream";
import { usePDFExport } from "@/hooks/use-pdf-export";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// UI Components
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ui/shadcn-io/ai/message";
import { Response } from "@/components/ui/shadcn-io/ai/response";
import { Badge } from "@/components/ui/badge";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ui/shadcn-io/ai/prompt-input";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// AI Components
import { AnalysisBlockRenderer } from "./analysis-block-renderer";
import { AnalysisPanelSkeleton } from "./analysis-skeleton";
import { ChatEditor, type ChatEditorHandle } from "./chat-editor";
import { TRADE_COMMAND_SUGGESTIONS } from "./trade-command-suggestions";
import { ChatHistorySidebar } from "./chat-history-sidebar";
import { trpcOptions } from "@/utils/trpc";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  WidgetBlockRenderer,
  WidgetBlockSkeleton,
} from "./widget-block-renderer";
import { STAGE_CONFIG } from "@/types/assistant-stream";
import type { VizSpec, AnalysisBlock } from "@/types/assistant-stream";
import type { SuggestionItem } from "./types";

// Icons
import {
  Sparkles,
  ChevronRight,
  BarChart3,
  AtSign,
  Slash,
  Target,
  FileDown,
  History,
} from "lucide-react";

import { IconSidebarLeftArrow } from "central-icons";
import { AIGoalGenerator } from "@/components/goals/ai-goal-generator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CustomGoalCriteria } from "@/components/goals/custom-goal-builder";
import { trpcClient } from "@/utils/trpc";
import { useAssistantPageContext } from "@/hooks/use-assistant-page-context";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  html?: string;
  createdAt: Date;
  visualization?: VizSpec;
  analysisBlocks?: AnalysisBlock[];
}

interface PremiumAssistantProps {
  accountId?: string;
  userImage?: string | null;
  userName?: string | null;
  className?: string;
  contextPathOverride?: string;
}

const TRADING_SUGGESTIONS = [
  "What's my edge?",
  "Where am I leaking money?",
  "Am I tilted right now?",
  "How is this session going?",
  "What's my most profitable pair this week?",
  "What's my win rate in the New York session?",
  "How's my performance this month?",
  "Which day of the week am I most profitable?",
  "What's my average trade duration?",
  "How much am I leaving on the table?",
  "What should I focus on in my journal?",
  "How close am I to failing my prop challenge?",
];

export function PremiumAssistant({
  accountId,
  userImage,
  userName,
  className,
  contextPathOverride,
}: PremiumAssistantProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pageContext = useAssistantPageContext(
    "premium-assistant",
    contextPathOverride
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ChatEditorHandle>(null);
  const [inputValue, setInputValue] = useState("");
  const [inputHtml, setInputHtml] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [evidenceMode, setEvidenceMode] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedVisualization, setSelectedVisualization] =
    useState<VizSpec | null>(null);
  const [selectedAnalysisBlocks, setSelectedAnalysisBlocks] = useState<
    AnalysisBlock[] | null
  >(null);
  const panelTransition = {
    x: { duration: 0.35, ease: "easeInOut" as const },
    opacity: { duration: 0.2, ease: "easeInOut" as const },
    width: panelOpen ? { duration: 0 } : { duration: 0.35, ease: "easeInOut" as const },
  };
  const [conversationHistory, setConversationHistory] = useState<string[]>([]);
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [historySidebarOpen, setHistorySidebarOpen] = useState(false);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);

  const { state, startStream, reset } = useAssistantStream();
  const { exportToPDF, exportToClipboard } = usePDFExport();

  const sessionTagsOpts = trpcOptions.trades.listSessionTags.queryOptions({
    accountId: accountId || "",
  });
  const { data: sessionTags } = useQuery({
    ...sessionTagsOpts,
    enabled: Boolean(accountId),
  });

  const modelTagsOpts = trpcOptions.trades.listModelTags.queryOptions({
    accountId: accountId || "",
  });
  const { data: modelTags } = useQuery({
    ...modelTagsOpts,
    enabled: Boolean(accountId),
  });

  const symbolsOpts = trpcOptions.trades.listSymbols.queryOptions({
    accountId: accountId || "",
  });
  const { data: symbols } = useQuery({
    ...symbolsOpts,
    enabled: Boolean(accountId),
  });
  const sessionTagsList = (sessionTags as any[]) || [];
  const modelTagsList = (modelTags as any[]) || [];
  const symbolsList = (symbols as string[]) || [];

  useEffect(() => {
    if (!currentReportId) return;

    const loadMessages = async () => {
      try {
        const result = await trpcClient.ai.getMessages.query({
          reportId: currentReportId,
        });

        const loadedMessages: ChatMessage[] = result.items.map((msg: any) => ({
          id: msg.id,
          role: msg.role as "user" | "assistant",
          content: msg.content,
          html: msg.htmlContent || undefined,
          createdAt: new Date(msg.createdAt),
          visualization: msg.data?.visualization as VizSpec | undefined,
          analysisBlocks: msg.data?.analysisBlocks as AnalysisBlock[] | undefined,
        }));

        setMessages(loadedMessages);
        setConversationHistory(
          loadedMessages.map((m) => `${m.role}: ${m.content}`)
        );
      } catch (error) {
        console.error("Failed to load messages:", error);
      }
    };

    loadMessages();
  }, [currentReportId]);

  const fetchSuggestions = useCallback(
    async (query: string, type: "mention" | "command") => {
      const lowerQuery = query.toLowerCase();
      if (type === "command") {
        return TRADE_COMMAND_SUGGESTIONS.filter((item) => {
          if (!query) return true;
          return (
            item.name.toLowerCase().includes(lowerQuery) ||
            item.description?.toLowerCase().includes(lowerQuery)
          );
        });
      }

      const mentionItems: SuggestionItem[] = [];

      if (sessionTagsList.length > 0) {
        sessionTagsList.forEach((tag: any) => {
          const name = typeof tag === "string" ? tag : tag?.name;
          if (!name) return;
          if (!query || name.toLowerCase().includes(lowerQuery)) {
            mentionItems.push({
              id: name,
              name,
              type: "session",
              description: "Session tag",
              category: "session",
            });
          }
        });
      }

      if (modelTagsList.length > 0) {
        modelTagsList.forEach((tag: any) => {
          const name = typeof tag === "string" ? tag : tag?.name;
          if (!name) return;
          if (!query || name.toLowerCase().includes(lowerQuery)) {
            mentionItems.push({
              id: name,
              name,
              type: "model",
              description: "Model tag",
              category: "model",
            });
          }
        });
      }

      if (symbolsList.length > 0) {
        symbolsList.forEach((symbol: string) => {
          if (!symbol) return;
          if (!query || symbol.toLowerCase().includes(lowerQuery)) {
            mentionItems.push({
              id: symbol,
              name: symbol,
              type: "symbol",
              description: "Symbol",
              category: "symbol",
            });
          }
        });
      }

      const outcomes = [
        { id: "Win", name: "Win" },
        { id: "Loss", name: "Loss" },
        { id: "BE", name: "Break-even" },
        { id: "PW", name: "Partial win" },
      ];
      outcomes.forEach((item) => {
        if (!query || item.name.toLowerCase().includes(lowerQuery)) {
          mentionItems.push({
            id: item.id,
            name: item.name,
            type: "field",
            description: "Outcome",
            category: "Outcome",
          });
        }
      });

      const protocolAlignments = [
        { id: "Aligned", name: "Aligned" },
        { id: "Against", name: "Against" },
        { id: "Discretionary", name: "Discretionary" },
      ];
      protocolAlignments.forEach((item) => {
        if (!query || item.name.toLowerCase().includes(lowerQuery)) {
          mentionItems.push({
            id: item.id,
            name: item.name,
            type: "field",
            description: "Protocol alignment",
            category: "Protocol",
          });
        }
      });

      const tradeDirections = [
        { id: "Long", name: "Long" },
        { id: "Short", name: "Short" },
      ];
      tradeDirections.forEach((item) => {
        if (!query || item.name.toLowerCase().includes(lowerQuery)) {
          mentionItems.push({
            id: item.id,
            name: item.name,
            type: "field",
            description: "Trade direction",
            category: "Direction",
          });
        }
      });

      return mentionItems;
    },
    [modelTagsList, sessionTagsList, symbolsList]
  );

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, state.lines]);

  // Auto-show panel when visualization is available
  useEffect(() => {
    if (
      messages.length > 0 &&
      (state.isStreaming ||
        state.visualization ||
        state.analysisBlocks.length > 0)
    ) {
      setPanelOpen(true);
    }
  }, [
    state.visualization,
    state.analysisBlocks,
    state.isStreaming,
    messages.length,
  ]);

  // Commit streaming response when done
  useEffect(() => {
    const content = [...state.lines, state.lineBuffer]
      .filter((line): line is string => Boolean(line))
      .join("\n");

    if (state.isDone && content.length > 0) {

      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.role === "assistant" && lastMessage.content === "") {
          // Save assistant message to database
          if (currentReportId) {
            trpcClient.ai.addMessage.mutate({
              reportId: currentReportId,
              role: "assistant",
              content,
              data: state.visualization || state.analysisBlocks.length > 0 
                ? { visualization: state.visualization, analysisBlocks: state.analysisBlocks }
                : undefined,
            }).catch(console.error);
          }
          
          return prev.map((m, i) =>
            i === prev.length - 1
              ? {
                  ...m,
                  content,
                  visualization: state.visualization || undefined,
                  analysisBlocks: state.analysisBlocks,
                }
              : m
          );
        }
        return prev;
      });

      // Update conversation history
      setConversationHistory((prev) => [...prev, `assistant: ${content}`]);
    }
  }, [
    state.isDone,
    state.lines,
    state.lineBuffer,
    state.visualization,
    state.analysisBlocks,
    currentReportId,
  ]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim() || state.isStreaming) return;
      if (!accountId) {
        alert("Please select an account first");
        return;
      }

      // Check if user is asking to create a goal
      const goalKeywords = [
        "create goal",
        "set goal",
        "make goal",
        "new goal",
        "create a goal",
        "set a goal",
        "goal for",
      ];
      const lowerInput = inputValue.toLowerCase();
      const isGoalRequest = goalKeywords.some((keyword) =>
        lowerInput.includes(keyword)
      );

      if (isGoalRequest) {
        setShowGoalDialog(true);
        setInputValue("");
        setInputHtml("");
        editorRef.current?.clear();
        return;
      }

      setSelectedVisualization(null);
      setSelectedAnalysisBlocks(null);

      // Create report if this is the first message
      let reportId = currentReportId;
      if (!reportId) {
        try {
          const report = await trpcClient.ai.createReport.mutate({
            title: inputValue.slice(0, 50) + (inputValue.length > 50 ? "..." : ""),
            accountId,
          });
          reportId = report.id;
          setCurrentReportId(reportId);
        } catch (error) {
          console.error("Failed to create report:", error);
        }
      }

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: inputValue,
        html: inputHtml || inputValue,
        createdAt: new Date(),
      };

      setMessages((prev) => [
        ...prev,
        userMessage,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "",
          createdAt: new Date(),
        },
      ]);

      // Save user message to database
      if (reportId) {
        trpcClient.ai.addMessage.mutate({
          reportId,
          role: "user",
          content: inputValue,
          htmlContent: inputHtml || undefined,
        }).catch(console.error);
      }

      setConversationHistory((prev) => [...prev, `user: ${inputValue}`]);

      setInputValue("");
      setInputHtml("");
      setIsTyping(false);
      editorRef.current?.clear();
      editorRef.current?.focus();
      reset();

      await startStream("/api/assistant/stream", {
        message: inputValue,
        accountId,
        conversationHistory,
        evidenceMode,
        pageContext,
      });
    },
    [
      inputValue,
      inputHtml,
      state.isStreaming,
      accountId,
      conversationHistory,
      startStream,
      reset,
      currentReportId,
      pageContext,
    ]
  );

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInputValue(suggestion);
  }, []);

  const handleViewTrades = useCallback(
    (tradeIds: string[]) => {
      router.push(`/dashboard/trades?ids=${tradeIds.join(",")}`);
    },
    [router]
  );

  const handleClear = useCallback(() => {
    setMessages([]);
    setConversationHistory([]);
    setCurrentReportId(null);
    reset();
    setPanelOpen(false);
    queryClient.invalidateQueries({ queryKey: ["ai.getReports"] });
  }, [reset, queryClient]);

  const handleExportPDF = useCallback(async () => {
    if (messages.length === 0) {
      toast.error("No messages to export");
      return;
    }
    try {
      await exportToPDF(messages, {
        title: "AI Trading Analysis Report",
        includeVisualizations: true,
        includeAnalysis: true,
      });
      toast.success("Report exported to PDF");
    } catch (error) {
      toast.error("Failed to export PDF");
    }
  }, [messages, exportToPDF]);

  const handleCopyToClipboard = useCallback(async () => {
    if (messages.length === 0) {
      toast.error("No messages to copy");
      return;
    }
    try {
      await exportToClipboard(messages);
      toast.success("Conversation copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  }, [messages, exportToClipboard]);

  const handleSelectReport = useCallback((reportId: string) => {
    setCurrentReportId(reportId);
    setHistorySidebarOpen(false);
  }, []);

  const handleCreateGoal = useCallback(
    async (criteria: CustomGoalCriteria, title: string, type: string) => {
      if (!accountId) {
        alert("Please select an account first");
        return;
      }

      try {
        // Calculate date range based on goal type
        const startDate = new Date();
        let deadline: Date | null = null;

        switch (type) {
          case "daily":
            deadline = new Date(startDate);
            deadline.setDate(deadline.getDate() + 1);
            break;
          case "weekly":
            deadline = new Date(startDate);
            deadline.setDate(deadline.getDate() + 7);
            break;
          case "monthly":
            deadline = new Date(startDate);
            deadline.setMonth(deadline.getMonth() + 1);
            break;
          default:
            // milestone has no deadline
            break;
        }

        await trpcClient.goals.create.mutate({
          accountId,
          type: type as "daily" | "weekly" | "monthly" | "milestone",
          targetType: criteria.metric,
          targetValue: criteria.targetValue,
          startDate: startDate.toISOString(),
          deadline: deadline?.toISOString() || null,
          title,
          description: criteria.description || `Track ${criteria.metric}`,
          isCustom: true,
          customCriteria: criteria,
        });

        // Invalidate all goals-related queries
        await queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey[0];
            return typeof key === 'string' && key.startsWith('goals.');
          }
        });

        setShowGoalDialog(false);

        // Add success message to chat
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: `### Goal Created\n\nI've created your goal: **${title}**. You can track its progress in the Goals page.`,
            createdAt: new Date(),
          },
        ]);
      } catch (error) {
        console.error("Failed to create goal:", error);
        alert("Failed to create goal. Please try again.");
      }
    },
    [accountId, queryClient]
  );

  // Get current visualization (from streaming state or last message)
  const currentVisualization =
    selectedVisualization ||
    state.visualization ||
    messages.filter((m) => m.role === "assistant").pop()?.visualization;

  const currentAnalysisBlocks =
    selectedAnalysisBlocks ??
    (state.analysisBlocks.length > 0
      ? state.analysisBlocks
      : messages.filter((m) => m.role === "assistant").pop()?.analysisBlocks ||
        []);

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
    <TooltipProvider>
      <div
        className={cn(
          "flex h-full w-full bg-sidebar overflow-hidden min-h-0",
          className
        )}
      >
        {/* Chat History Sidebar */}
        <ChatHistorySidebar
          accountId={accountId}
          onSelectReport={handleSelectReport}
          onNewChat={handleClear}
          currentReportId={currentReportId}
          isOpen={historySidebarOpen}
          onClose={() => setHistorySidebarOpen(false)}
        />

        {/* Left Panel - Chat */}
        <motion.div
          initial={false}
          className={cn("flex flex-col h-full relative overflow-hidden min-h-0 flex-1")}
          animate={{ width: "auto" }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
        >
          {/* Ambient gradient orbs */}
          <AmbientOrbs isTyping={isTyping} />

          {/* History Toggle Button */}
          <button
            onClick={() => setHistorySidebarOpen(!historySidebarOpen)}
            className="absolute left-4 top-4 z-30 flex items-center gap-2 px-3 py-2 border border-white/5 text-white/50 hover:text-white hover:bg-sidebar-accent transition-colors cursor-pointer backdrop-blur-2xl rounded-lg"
          >
            <History className="w-4 h-4" />
          </button>
        {/* Messages Container */}
        <div className="flex-1 overflow-hidden relative flex mx-auto w-full min-h-0 z-10">
          {messages.length === 0 ? (
            <EmptyState
              onSuggestionClick={handleSuggestionClick}
              suggestions={TRADING_SUGGESTIONS}
            />
          ) : (
            <ScrollArea className="h-full w-full relative z-0">
              <div className="space-y-6 px-8 py-6 w-full relative z-0">
                {messages.map((message, index) => (
                  <Message
                    key={message.id}
                    from={message.role}
                    className="w-full"
                  >
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
                          ? "bg-transparent border-none p-0 w-full rounded-none"
                          : "bg-transparent border-none p-0 text-white! rounded-none"
                      }
                    >
                      {message.role === "assistant" ? (
                        message.content === "" && state.isStreaming ? (
                          <StreamingContent
                            lines={state.lines}
                            lineBuffer={state.lineBuffer}
                            stage={state.stage}
                            statusMessage={state.statusMessage}
                          />
                        ) : (
                          <AssistantResponseCards content={message.content} />
                        )
                      ) : (
                        <div className="bg-sidebar h-full w-full border border-white/5 p-1 flex flex-col rounded-sm">
                          <div className="flex w-full items-start justify-between gap-3 px-3.5 py-2">
                            <h2 className="text-sm font-medium text-white/50">
                              Your message
                            </h2>
                          </div>
                          <div className="bg-white dark:bg-sidebar-accent dark:hover:brightness-120 transition-all duration-150 flex flex-col h-full w-full rounded-sm">
                            <div className="flex flex-col p-3.5 h-full text-white">
                              {message.html ? (
                                <div
                                  className="prose prose-invert max-w-none text-sm"
                                  dangerouslySetInnerHTML={{
                                    __html: message.html,
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

                      {/* Show visualization indicator */}
                      {message.visualization && (
                        <button
                          onClick={() => {
                            setSelectedVisualization(
                              message.visualization || null
                            );
                            setSelectedAnalysisBlocks(
                              message.analysisBlocks || []
                            );
                            setPanelOpen(true);
                          }}
                          className="mt-3 flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors cursor-pointer w-max"
                        >
                          View visualization
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </MessageContent>
                  </Message>
                ))}

                <div ref={messagesEndRef} />
                <div aria-hidden="true" className="h-36" />
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Input Area */}
        <div className="absolute inset-x-0 bottom-0 w-full px-8 pointer-events-none z-20">
          <motion.div
            layout="size"
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className={cn(
              "mx-auto w-full pointer-events-auto",
              panelOpen ? "max-w-4xl" : "max-w-5xl"
            )}
          >
            <PromptInput
              onSubmit={handleSubmit}
              id="assistant-input-form"
              className="bg-sidebar/5 backdrop-blur-lg w-full transition-colors rounded-none! border-white/5 group"
            >
              <ChatEditor
                ref={editorRef}
                disabled={state.isStreaming}
                placeholder="Ask anything to get an idea of your edge..."
                onChange={(value) => {
                  setInputValue(value);
                  setIsTyping(value.trim().length > 0);
                }}
                onHtmlChange={(value) => setInputHtml(value)}
                onSubmit={() => {
                  const form = document.getElementById(
                    "assistant-input-form"
                  ) as HTMLFormElement | null;
                  form?.requestSubmit();
                }}
                fetchSuggestions={fetchSuggestions}
                className="text-white placeholder:text-white/50 bg-transparent w-full group-hover:bg-sidebar/15! transition-colors border-b-0"
              />
              <PromptInputToolbar className="px-3 group-hover:bg-sidebar/15 transition-colors">
                <PromptInputTools>
                  {messages.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClear}
                      className="text-xs text-white/50 hover:text-white rounded-none"
                    >
                      Clear chat
                    </Button>
                  )}
                  <Toggle
                    size="sm"
                    variant="outline"
                    pressed={evidenceMode}
                    onPressedChange={setEvidenceMode}
                    className="text-xs text-white/70 border-0 px-3 data-[state=on]:bg-accent data-[state=on]:text-white cursor-pointer transition-colors"
                  >
                    Evidence
                  </Toggle>
                </PromptInputTools>
                <div className="flex items-center gap-1">
                  {messages.length > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={handleExportPDF}
                          className="h-8 w-8 text-white/60 hover:text-white"
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Export as PDF</TooltipContent>
                    </Tooltip>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => editorRef.current?.insertText("@")}
                    className="h-8 w-8 text-white/60 hover:text-white"
                  >
                    <AtSign className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => editorRef.current?.insertText("/")}
                    className="h-8 w-8 text-white/60 hover:text-white"
                  >
                    <Slash className="h-4 w-4" />
                  </Button>
                  <PromptInputSubmit
                    disabled={state.isStreaming || !inputValue.trim()}
                    className="bg-transparent hover:bg-sidebar text-white border-0"
                  />
                </div>
              </PromptInputToolbar>
            </PromptInput>
          </motion.div>
        </div>
      </motion.div>

      {/* Right Panel - Analysis & Visualization */}
      <motion.div
        initial={false}
        className="h-full border-l border-white/5 bg-sidebar overflow-x-hidden overflow-y-auto min-h-0"
        animate={{
          width: panelOpen ? "40%" : "0%",
          x: panelOpen ? 0 : "100%",
          opacity: panelOpen ? 1 : 0,
        }}
        transition={panelTransition}
        style={{ pointerEvents: panelOpen ? "auto" : "none" }}
      >
        <div className="h-full flex flex-col">
          {/* Panel Header */}
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white/90">
                Analysis
              </span>
              {state.isStreaming && (
                <Badge variant="outline" className="text-[10px] animate-pulse">
                  Live
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPanelOpen(false)}
              className="text-white/50 hover:text-white"
            >
              <IconSidebarLeftArrow className="w-4 h-4 rotate-180" />
            </Button>
          </div>

          <Separator />

          {/* Panel Content */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Visualization */}
              {currentVisualization ? (
                <WidgetBlockRenderer
                  viz={currentVisualization}
                  onViewTrades={handleViewTrades}
                  accountId={accountId}
                />
              ) : state.isStreaming ? (
                <WidgetBlockSkeleton />
              ) : null}

              {/* Analysis Blocks */}
              {state.isStreaming && currentAnalysisBlocks.length === 0 ? (
                <AnalysisPanelSkeleton />
              ) : (
                <>
                  {nonCoverageBlocks.map((block, index) => (
                    <AnalysisBlockRenderer
                      key={index}
                      block={block}
                      index={index}
                      onViewTrades={handleViewTrades}
                    />
                  ))}

                  {coverageBlocks.map((block, index) => (
                    <AnalysisBlockRenderer
                      key={`coverage-${index}`}
                      block={block}
                      index={nonCoverageBlocks.length + index}
                      onViewTrades={handleViewTrades}
                    />
                  ))}

                  {calloutBlocks.map((block, index) => (
                    <AnalysisBlockRenderer
                      key={`callout-${index}`}
                      block={block}
                      index={
                        nonCoverageBlocks.length + coverageBlocks.length + index
                      }
                      onViewTrades={handleViewTrades}
                    />
                  ))}
                </>
              )}

              {/* Empty State */}
              {!currentVisualization &&
                currentAnalysisBlocks.length === 0 &&
                !state.isStreaming && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <BarChart3 className="w-12 h-12 text-white/10 mb-4" />
                    <p className="text-sm text-white/40">
                      Ask a question to see analysis here
                    </p>
                  </div>
                )}
            </div>
          </ScrollArea>
        </div>
      </motion.div>

      {/* Panel Toggle (when hidden) */}
      {!panelOpen &&
        (currentVisualization || currentAnalysisBlocks.length > 0) && (
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute right-4 top-4 flex items-center gap-2 px-3 py-2 border border-white/5 text-white/50 hover:text-white hover:bg-sidebar-accent transition-colors cursor-pointer backdrop-blur-2xl"
            onClick={() => {
              setPanelOpen(true);
            }}
          >
            <IconSidebarLeftArrow className="w-4 h-4" />
            <span className="text-xs font-medium">Show analysis</span>
          </motion.button>
        )}

      {/* Goal Creation Dialog */}
      <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-sidebar border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Target className="w-5 h-5 text-purple-400" />
              Create Trading Goal
            </DialogTitle>
          </DialogHeader>
          <AIGoalGenerator
            onGoalGenerated={handleCreateGoal}
            onCancel={() => setShowGoalDialog(false)}
            accountId={accountId || ""}
          />
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}

function splitMarkdownSections(markdown: string): Array<{
  title: string;
  body: string;
}> {
  const lines = String(markdown || "").split("\n");
  const sections: Array<{ title: string; body: string }> = [];
  let current: { title: string; body: string } | null = null;

  const pushCurrent = () => {
    if (current) {
      sections.push({
        title: current.title,
        body: current.body.trim(),
      });
    }
  };

  for (const line of lines) {
    if (line.startsWith("### ")) {
      pushCurrent();
      current = { title: line.replace(/^###\s+/, "").trim(), body: "" };
      continue;
    }
    if (!current) {
      current = { title: "Your message", body: "" };
    }
    current.body += `${line}\n`;
  }
  pushCurrent();

  return sections;
}

function sentenceCase(value: string): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function decorateMentions(text: string): string {
  if (!text) return text;
  return text.replace(
    /(^|[\s(])([@/])([A-Za-z0-9_.-]+)/g,
    (match, prefix, sigil, token) => {
      const scheme = sigil === "@" ? "mention" : "command";
      return `${prefix}[${sigil}${token}](${scheme}:${token})`;
    }
  );
}

function AssistantResponseCards({ content }: { content: string }) {
  const sections = splitMarkdownSections(content);
  if (sections.length === 0) {
    return (
      <Response parseIncompleteMarkdown={false}>
        {decorateMentions(content)}
      </Response>
    );
  }

  return (
    <div className="space-y-4 w-full">
      {sections.map((section, idx) => (
        <div
          key={`${section.title}-${idx}`}
          className="bg-sidebar h-full w-full border border-white/5 p-1 flex flex-col group rounded-sm"
        >
          <div className="flex w-full items-start justify-between gap-3 px-3.5 py-2">
            <h2 className="text-sm font-medium text-white/50">
              <span className="normal-case">{sentenceCase(section.title)}</span>
            </h2>
          </div>
          <div className="bg-white dark:bg-sidebar-accent dark:hover:brightness-120 transition-all duration-150 flex flex-col h-full w-full rounded-sm">
            <div className="flex flex-col p-3.5 h-full text-white">
              <Response parseIncompleteMarkdown={false}>
                {decorateMentions(section.body)}
              </Response>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== SUB-COMPONENTS =====

function EmptyState({
  onSuggestionClick,
  suggestions,
}: {
  onSuggestionClick: (s: string) => void;
  suggestions: string[];
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 w-full">
      <div className="w-full max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h3 className="text-3xl font-medium text-white">
            Your edge assistant
          </h3>
          <p className="text-sm text-white/50 max-w-md mx-auto">
            Ask questions about your trades, analyze performance, compare
            sessions, or discover patterns in your data.
          </p>
        </div>

        <div className="w-full">
          <p className="text-xs font-medium mb-3 text-white/40 uppercase tracking-wider">
            Try asking
          </p>

          <div className="flex flex-wrap justify-center gap-2 w-full">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => onSuggestionClick(suggestion)}
                className="inline-flex items-center justify-center px-4 py-2 rounded-full text-[13px] font-medium border border-white/5 bg-sidebar hover:bg-sidebar-accent text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const AMBIENT_ORBS = [
  {
    // Large indigo — slightly right of center
    w: 550, h: 500,
    topOffset: -250, leftOffset: 30,
    color: "rgba(99,102,241,0.18)",
    drift: { x: [0, 80, -50, 100, -30, 0], y: [0, -60, 40, -80, 30, 0] },
    dur: 6,
  },
  {
    // Medium blue — slightly left of center
    w: 420, h: 450,
    topOffset: -100, leftOffset: -120,
    color: "rgba(59,130,246,0.14)",
    drift: { x: [0, -70, 90, -40, 60, 0], y: [0, 50, -70, 60, -40, 0] },
    dur: 8,
  },
  {
    // Violet — center, nudged up
    w: 350, h: 370,
    topOffset: -180, leftOffset: -30,
    color: "rgba(139,92,246,0.16)",
    drift: { x: [0, 55, -75, 45, -60, 0], y: [0, -45, 65, -55, 35, 0] },
    dur: 5,
  },
  {
    // Small warm purple — below center-right
    w: 280, h: 300,
    topOffset: 60, leftOffset: 80,
    color: "rgba(124,58,237,0.12)",
    drift: { x: [0, -50, 65, -70, 40, 0], y: [0, 60, -45, 50, -65, 0] },
    dur: 7,
  },
  {
    // Small slate-blue — above center-left
    w: 300, h: 280,
    topOffset: -220, leftOffset: -80,
    color: "rgba(79,109,205,0.1)",
    drift: { x: [0, 45, -65, 55, -35, 0], y: [0, -55, 45, -35, 60, 0] },
    dur: 9,
  },
];

function AmbientOrbs({ isTyping }: { isTyping: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {AMBIENT_ORBS.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: orb.w,
            height: orb.h,
            top: `calc(50% + ${orb.topOffset}px)`,
            left: `calc(50% + ${orb.leftOffset}px)`,
            marginTop: -(orb.h / 2),
            marginLeft: -(orb.w / 2),
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
            filter: "blur(60px)",
          }}
          initial={false}
          animate={
            isTyping
              ? { x: orb.drift.x, y: orb.drift.y }
              : { x: 0, y: 0 }
          }
          transition={
            isTyping
              ? { duration: orb.dur, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }
              : { duration: 2, ease: "easeOut" }
          }
        />
      ))}
    </div>
  );
}

function StreamingContent({
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
      {/* Status indicator */}
      {stage && (
        <div className="flex items-center gap-2 text-xs text-white">
          <TextShimmer
            as="span"
            className="text-xs [--base-color:rgba(255,255,255,0.5)] [--base-gradient-color:rgba(255,255,255,0.95)]"
          >
            {displayMessage}
          </TextShimmer>
        </div>
      )}

      {/* Streamed markdown rendered as output */}
      {(lines.length > 0 || lineBuffer) && (
        <div className="prose prose-invert prose-sm max-w-none">
          <Response parseIncompleteMarkdown={true}>
            {`${lines.join("\n")}${lineBuffer}`}
          </Response>
        </div>
      )}
    </div>
  );
}
