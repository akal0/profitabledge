"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { ChatEditorHandle } from "@/components/ai/chat-editor";
import type { CustomGoalCriteria } from "@/components/goals/custom-goal-builder";
import { useAssistantPageContext } from "@/hooks/use-assistant-page-context";
import { useAssistantStream } from "@/hooks/use-assistant-stream";
import { usePDFExport } from "@/hooks/use-pdf-export";
import type { AnalysisBlock, VizSpec } from "@/types/assistant-stream";
import { trpcClient } from "@/utils/trpc";
import { normalizeGoalTargetType } from "@/features/ai/premium-assistant/lib/premium-assistant-types";
import type { ChatMessage } from "@/features/ai/premium-assistant/lib/premium-assistant-types";
import { usePremiumAssistantSuggestions } from "@/features/ai/premium-assistant/hooks/use-premium-assistant-suggestions";
import { showAIErrorToast } from "@/lib/ai-error-toast";

interface UsePremiumAssistantControllerOptions {
  accountId?: string;
  contextPathOverride?: string;
}

export function usePremiumAssistantController({
  accountId,
  contextPathOverride,
}: UsePremiumAssistantControllerOptions) {
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
  const [conversationHistory, setConversationHistory] = useState<string[]>([]);
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [historySidebarOpen, setHistorySidebarOpen] = useState(false);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);

  const panelTransition = {
    x: { duration: 0.35, ease: "easeInOut" as const },
    opacity: { duration: 0.2, ease: "easeInOut" as const },
    width: panelOpen
      ? { duration: 0 }
      : { duration: 0.35, ease: "easeInOut" as const },
  };

  const { state, startStream, reset } = useAssistantStream();
  const { exportToPDF } = usePDFExport();
  const { fetchSuggestions } = usePremiumAssistantSuggestions({ accountId });

  useEffect(() => {
    if (!currentReportId) return;

    const loadMessages = async () => {
      try {
        const result = await trpcClient.ai.getMessages.query({
          reportId: currentReportId,
        });

        const loadedMessages: ChatMessage[] = result.items.map((message: any) => ({
          id: message.id,
          role: message.role as "user" | "assistant",
          content: message.content,
          html: message.htmlContent || undefined,
          createdAt: new Date(message.createdAt),
          visualization: message.data?.visualization as VizSpec | undefined,
          analysisBlocks: message.data?.analysisBlocks as
            | AnalysisBlock[]
            | undefined,
        }));

        setMessages(loadedMessages);
        setConversationHistory(
          loadedMessages.map((message) => `${message.role}: ${message.content}`)
        );
      } catch (error) {
        console.error("Failed to load messages:", error);
      }
    };

    loadMessages();
  }, [currentReportId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, state.lines]);

  useEffect(() => {
    if (
      messages.length > 0 &&
      (state.isStreaming || state.visualization || state.analysisBlocks.length > 0)
    ) {
      setPanelOpen(true);
    }
  }, [
    messages.length,
    state.analysisBlocks,
    state.isStreaming,
    state.visualization,
  ]);

  useEffect(() => {
    const content = [...state.lines, state.lineBuffer]
      .filter((line): line is string => Boolean(line))
      .join("\n");

    if (!state.isDone || content.length === 0) return;

    setMessages((prev) => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage?.role === "assistant" && lastMessage.content === "") {
        if (currentReportId) {
          trpcClient.ai.addMessage
            .mutate({
              reportId: currentReportId,
              role: "assistant",
              content,
              data:
                state.visualization || state.analysisBlocks.length > 0
                  ? {
                      visualization: state.visualization,
                      analysisBlocks: state.analysisBlocks,
                    }
                  : undefined,
            })
            .catch((error) => {
              if (process.env.NODE_ENV !== "production") {
                console.error("Failed to persist assistant message:", error);
              }
            });
          void queryClient.invalidateQueries({ queryKey: ["ai.getReports"] });
        }

        return prev.map((message, index) =>
          index === prev.length - 1
            ? {
                ...message,
                content,
                visualization: state.visualization || undefined,
                analysisBlocks: state.analysisBlocks,
              }
            : message
        );
      }

      return prev;
    });

    setConversationHistory((prev) => [...prev, `assistant: ${content}`]);
  }, [
    currentReportId,
    queryClient,
    state.analysisBlocks,
    state.isDone,
    state.lineBuffer,
    state.lines,
    state.visualization,
  ]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!inputValue.trim() || state.isStreaming) return;
      if (!accountId) {
        toast.error("Select an account before starting the assistant.");
        return;
      }

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
      if (goalKeywords.some((keyword) => lowerInput.includes(keyword))) {
        setShowGoalDialog(true);
        setInputValue("");
        setInputHtml("");
        editorRef.current?.clear();
        return;
      }

      setSelectedVisualization(null);
      setSelectedAnalysisBlocks(null);

      let reportId = currentReportId;
      if (!reportId) {
        try {
          const report = await trpcClient.ai.createReport.mutate({
            title: inputValue.slice(0, 50) + (inputValue.length > 50 ? "..." : ""),
            accountId,
          });
          reportId = report.id;
          setCurrentReportId(reportId);
          void queryClient.invalidateQueries({ queryKey: ["ai.getReports"] });
        } catch (error) {
          if (process.env.NODE_ENV !== "production") {
            console.error("Failed to create report:", error);
          }
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

      if (reportId) {
        trpcClient.ai.addMessage
          .mutate({
            reportId,
            role: "user",
            content: inputValue,
            htmlContent: inputHtml || undefined,
          })
          .catch((error) => {
            if (process.env.NODE_ENV !== "production") {
              console.error("Failed to persist user message:", error);
            }
          });
      }

      const message = inputValue;
      const nextConversationHistory = [
        ...conversationHistory,
        `user: ${message}`,
      ];
      setConversationHistory(nextConversationHistory);
      setInputValue("");
      setInputHtml("");
      setIsTyping(false);
      editorRef.current?.clear();
      editorRef.current?.focus();
      reset();

      await startStream("/api/assistant/stream", {
        message,
        accountId,
        conversationHistory: nextConversationHistory,
        evidenceMode,
        pageContext,
      });
    },
    [
      accountId,
      conversationHistory,
      currentReportId,
      evidenceMode,
      inputHtml,
      inputValue,
      pageContext,
      reset,
      startStream,
      state.isStreaming,
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
  }, [queryClient, reset]);

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
    } catch {
      toast.error("Failed to export PDF");
    }
  }, [exportToPDF, messages]);

  const handleSelectReport = useCallback((reportId: string) => {
    setCurrentReportId(reportId);
    setHistorySidebarOpen(false);
  }, []);

  const handleCreateGoal = useCallback(
    async (criteria: CustomGoalCriteria, title: string, type: string) => {
      if (!accountId) {
        toast.error("Select an account before creating a goal.");
        return;
      }

      try {
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
            break;
        }

        await trpcClient.goals.create.mutate({
          accountId,
          type: type as "daily" | "weekly" | "monthly" | "milestone",
          targetType: normalizeGoalTargetType(criteria.metric),
          targetValue: criteria.targetValue,
          startDate: startDate.toISOString(),
          deadline: deadline?.toISOString() || null,
          title,
          description: criteria.description || `Track ${criteria.metric}`,
          isCustom: true,
          customCriteria: criteria,
        });

        await queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey[0];
            return typeof key === "string" && key.startsWith("goals.");
          },
        });

        setShowGoalDialog(false);
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
        if (process.env.NODE_ENV !== "production") {
          console.error("Failed to create goal:", error);
        }
        if (!showAIErrorToast(error)) {
          toast.error("Failed to create goal. Please try again.");
        }
      }
    },
    [accountId, queryClient]
  );

  const currentVisualization =
    selectedVisualization ||
    state.visualization ||
    messages.filter((message) => message.role === "assistant").pop()?.visualization;

  const currentAnalysisBlocks =
    selectedAnalysisBlocks ??
    (state.analysisBlocks.length > 0
      ? state.analysisBlocks
      : messages.filter((message) => message.role === "assistant").pop()
          ?.analysisBlocks || []);

  return {
    accountId,
    editorRef,
    messagesEndRef,
    inputValue,
    setInputValue,
    setInputHtml,
    setIsTyping,
    isTyping,
    evidenceMode,
    setEvidenceMode,
    messages,
    panelOpen,
    setPanelOpen,
    selectedVisualization,
    setSelectedVisualization,
    selectedAnalysisBlocks,
    setSelectedAnalysisBlocks,
    panelTransition,
    showGoalDialog,
    setShowGoalDialog,
    historySidebarOpen,
    setHistorySidebarOpen,
    currentReportId,
    state,
    fetchSuggestions,
    handleSubmit,
    handleSuggestionClick,
    handleViewTrades,
    handleClear,
    handleExportPDF,
    handleSelectReport,
    handleCreateGoal,
    currentVisualization,
    currentAnalysisBlocks,
  };
}
