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
import { trpcClient, trpcOptions } from "@/utils/trpc";
import { normalizeGoalTargetType } from "@/features/ai/premium-assistant/lib/premium-assistant-types";
import type { ChatMessage } from "@/features/ai/premium-assistant/lib/premium-assistant-types";
import { usePremiumAssistantSuggestions } from "@/features/ai/premium-assistant/hooks/use-premium-assistant-suggestions";
import { showAIErrorToast } from "@/lib/ai-error-toast";
import { getGoalSchedule } from "@/lib/goals-dates";
import { invalidateGoalQueries } from "@/lib/goals-query";

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
  const messagesRef = useRef<ChatMessage[]>([]);
  const loadRequestRef = useRef(0);
  const pendingHydrationReportIdRef = useRef<string | null>(null);
  const finalizedAssistantSignatureRef = useRef<string | null>(null);
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
  const reportsQueryKey = trpcOptions.ai.getReports.queryOptions({
    limit: 50,
    accountId,
  }).queryKey;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!currentReportId) return;

    const loadMessages = async () => {
      const requestId = ++loadRequestRef.current;
      const reportId = currentReportId;

      try {
        const result = await trpcClient.ai.getMessages.query({
          reportId,
        });

        if (
          loadRequestRef.current !== requestId ||
          currentReportId !== reportId
        ) {
          return;
        }

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
        const latestAssistantWithAnalysis = [...loadedMessages]
          .reverse()
          .find(
            (message) =>
              message.role === "assistant" &&
              (message.visualization || (message.analysisBlocks?.length ?? 0) > 0)
          );

        const hasPendingPlaceholder = messagesRef.current.some(
          (message) => message.role === "assistant" && message.content === ""
        );
        if (
          pendingHydrationReportIdRef.current === reportId &&
          hasPendingPlaceholder &&
          loadedMessages.length <= messagesRef.current.length
        ) {
          return;
        }

        setMessages(loadedMessages);
        setConversationHistory(
          loadedMessages.map((message) => `${message.role}: ${message.content}`)
        );
        setSelectedVisualization(latestAssistantWithAnalysis?.visualization || null);
        setSelectedAnalysisBlocks(
          latestAssistantWithAnalysis?.analysisBlocks || []
        );
        setPanelOpen(Boolean(latestAssistantWithAnalysis));
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

    if (!state.isDone) return;

    const fallbackContent =
      state.error
        ? `I ran into an error: ${state.error}`
        : state.analysisBlocks.length > 0 || state.visualization
          ? "I analyzed your data and added the result to the analysis panel."
          : "I couldn't generate a useful answer for that question. Try asking it with a bit more detail.";

    const finalContent = content.length > 0 ? content : fallbackContent;
    const completionSignature = [
      currentReportId || "no-report",
      finalContent,
      state.analysisBlocks.length,
      Boolean(state.visualization),
      state.error || "",
    ].join("::");

    if (finalizedAssistantSignatureRef.current === completionSignature) {
      return;
    }
    finalizedAssistantSignatureRef.current = completionSignature;

    setMessages((prev) => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage?.role === "assistant" && lastMessage.content === "") {
        return prev.map((message, index) =>
          index === prev.length - 1
            ? {
                ...message,
                content: finalContent,
                visualization: state.visualization || undefined,
                analysisBlocks: state.analysisBlocks,
              }
            : message
        );
      }

      return [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          content: finalContent,
          createdAt: new Date(),
          visualization: state.visualization || undefined,
          analysisBlocks: state.analysisBlocks,
        },
      ];
    });

    if (currentReportId) {
      pendingHydrationReportIdRef.current = null;
      trpcClient.ai.addMessage
        .mutate({
          reportId: currentReportId,
          role: "assistant",
          content: finalContent,
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
      void queryClient.invalidateQueries({ queryKey: reportsQueryKey });
    }

    setConversationHistory((prev) =>
      prev[prev.length - 1] === `assistant: ${finalContent}`
        ? prev
        : [...prev, `assistant: ${finalContent}`]
    );
  }, [currentReportId, queryClient, reportsQueryKey, state]);

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
          pendingHydrationReportIdRef.current = reportId;
          setCurrentReportId(reportId);
          void queryClient.invalidateQueries({ queryKey: reportsQueryKey });
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
      finalizedAssistantSignatureRef.current = null;
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
    editorRef.current?.setText(suggestion);
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
    setSelectedVisualization(null);
    setSelectedAnalysisBlocks([]);
    pendingHydrationReportIdRef.current = null;
    finalizedAssistantSignatureRef.current = null;
    reset();
    setPanelOpen(false);
    queryClient.invalidateQueries({ queryKey: reportsQueryKey });
  }, [queryClient, reportsQueryKey, reset]);

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
    reset();
    setSelectedVisualization(null);
    setSelectedAnalysisBlocks([]);
    setPanelOpen(false);
    pendingHydrationReportIdRef.current = null;
    finalizedAssistantSignatureRef.current = null;
    setCurrentReportId(reportId);
    setHistorySidebarOpen(false);
  }, [reset]);

  const handleCreateGoal = useCallback(
    async (criteria: CustomGoalCriteria, title: string, type: string) => {
      if (!accountId) {
        toast.error("Select an account before creating a goal.");
        return;
      }

      try {
        const normalizedType =
          type === "daily" ||
          type === "weekly" ||
          type === "monthly" ||
          type === "milestone"
            ? type
            : "weekly";
        const { startDate, deadline } = getGoalSchedule(normalizedType);

        await trpcClient.goals.create.mutate({
          accountId,
          type: normalizedType,
          targetType: normalizeGoalTargetType(criteria.metric),
          targetValue: criteria.targetValue,
          startDate,
          deadline,
          title,
          description: criteria.description || `Track ${criteria.metric}`,
          isCustom: true,
          customCriteria: criteria,
        });

        await invalidateGoalQueries(queryClient);

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
    state.visualization ||
    selectedVisualization ||
    (!state.isStreaming
      ? messages.filter((message) => message.role === "assistant").pop()
          ?.visualization
      : null);

  const currentAnalysisBlocks =
    selectedAnalysisBlocks ??
    (state.analysisBlocks.length > 0
      ? state.analysisBlocks
      : !state.isStreaming
        ? messages.filter((message) => message.role === "assistant").pop()
            ?.analysisBlocks || []
        : []);

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
