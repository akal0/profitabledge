/**
 * Assistant Shell
 * 
 * Premium two-pane layout: Chat (left) + Analysis Panel (right)
 * The analysis panel slides in automatically when AI is working.
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAssistantStream } from "@/hooks/use-assistant-stream";
import { PremiumChatInterface } from "./premium-chat-interface";
import { TradeAnalysisPanel } from "./trade-analysis-panel";
import type { AssistantStreamState } from "@/types/assistant-stream";
import { useAssistantPageContext } from "@/hooks/use-assistant-page-context";

interface AssistantShellProps {
  accountId?: string;
  userImage?: string | null;
  userName?: string | null;
  className?: string;
}

export function AssistantShell({
  accountId,
  userImage,
  userName,
  className,
}: AssistantShellProps) {
  const { state, startStream, reset } = useAssistantStream();
  const pageContext = useAssistantPageContext("premium-assistant");
  const [panelOpen, setPanelOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: Date;
    streamState?: AssistantStreamState;
  }>>([]);

  // Auto-show panel when streaming starts
  useEffect(() => {
    if (state.isStreaming || state.analysisBlocks.length > 0) {
      setPanelOpen(true);
    }
  }, [state.isStreaming, state.analysisBlocks.length]);

  const handleSendMessage = useCallback(async (content: string) => {
    const userMessageId = Date.now().toString();
    const assistantMessageId = (Date.now() + 1).toString();

    // Add user message
    setMessages(prev => [...prev, {
      id: userMessageId,
      role: "user",
      content,
      createdAt: new Date(),
    }]);

    // Add placeholder assistant message
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      createdAt: new Date(),
      streamState: state,
    }]);

    // Start streaming
    await startStream("/api/assistant/stream", {
      accountId,
      message: content,
      conversationHistory: messages.map((message) => `${message.role}: ${message.content}`),
      pageContext,
    });
  }, [accountId, messages, pageContext, startStream, state]);

  // Update assistant message with stream state
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "assistant") {
        const fullContent = [...state.lines, state.lineBuffer].filter(Boolean).join("\n");
        setMessages(prev => prev.map(m => 
          m.id === lastMessage.id 
            ? { ...m, content: fullContent, streamState: state }
            : m
        ));
      }
    }
  }, [state.lines, state.lineBuffer, messages.length]);

  const handleClosePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  const handleClear = useCallback(() => {
    setMessages([]);
    reset();
    setPanelOpen(false);
  }, [reset]);

  return (
    <div className={cn("flex h-full w-full relative", className)}>
      {/* Main Chat Area */}
      <div 
        className={cn(
          "flex-1 h-full transition-all duration-300 ease-out",
          panelOpen && "lg:pr-[560px]"
        )}
      >
        <PremiumChatInterface
          messages={messages}
          streamState={state}
          userImage={userImage}
          userName={userName}
          onSendMessage={handleSendMessage}
          onClear={handleClear}
          isStreaming={state.isStreaming}
        />
      </div>

      {/* Analysis Panel (slides in from right) */}
      <TradeAnalysisPanel
        streamState={state}
        onClose={handleClosePanel}
        isOpen={panelOpen}
        accountId={accountId}
      />
    </div>
  );
}
