"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAssistantStream } from "@/hooks/use-assistant-stream";
import { useFloatingAssistant } from "@/stores/floating-assistant";
import { useAccountStore } from "@/stores/account";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, X, Send, Maximize2, RotateCcw } from "lucide-react";
import { Response } from "@/components/ui/shadcn-io/ai/response";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { STAGE_CONFIG } from "@/types/assistant-stream";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAssistantPageContext } from "@/hooks/use-assistant-page-context";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

const QUICK_SUGGESTIONS = [
  "What's my edge right now?",
  "Am I tilted today?",
  "How is this session going?",
];

export function FloatingAssistant() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const accountId = useAccountStore((state) => state.selectedAccountId);
  const { isOpen, close, initialQuery, setInitialQuery } = useFloatingAssistant();
  const { state, startStream, reset } = useAssistantStream();
  const pageContext = useAssistantPageContext("floating-assistant");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationHistory, setConversationHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialQuery && isOpen) {
      setInput(initialQuery);
      setInitialQuery(null);
    }
  }, [initialQuery, isOpen, setInitialQuery]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, state.lines]);

  useEffect(() => {
    const content = [...state.lines, state.lineBuffer]
      .filter((line): line is string => Boolean(line))
      .join("\n");

    if (state.isDone && content.length > 0) {
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.role === "assistant" && lastMessage.content === "") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content } : m
          );
        }
        return prev;
      });
      setConversationHistory((prev) => [...prev, `assistant: ${content}`]);
    }
  }, [state.isDone, state.lines, state.lineBuffer]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim() || state.isStreaming) return;
      if (!accountId) {
        return;
      }

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: input,
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

      setConversationHistory((prev) => [...prev, `user: ${input}`]);
      const messageToSend = input;
      setInput("");
      reset();

      await startStream("/api/assistant/stream", {
        message: messageToSend,
        accountId,
        conversationHistory,
        evidenceMode: false,
        pageContext,
      });
    },
    [
      input,
      state.isStreaming,
      accountId,
      conversationHistory,
      startStream,
      reset,
      pageContext,
    ]
  );

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  }, []);

  const handleOpenFull = useCallback(() => {
    close();
    const sourcePath = `${pathname || "/dashboard"}${
      searchParams?.toString() ? `?${searchParams.toString()}` : ""
    }`;
    const params = new URLSearchParams();
    if (accountId) params.set("accountId", accountId);
    params.set("sourcePath", sourcePath);
    router.push(`/assistant?${params.toString()}`);
  }, [accountId, close, pathname, router, searchParams]);

  const handleClear = useCallback(() => {
    setMessages([]);
    setConversationHistory([]);
    reset();
  }, [reset]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape") {
        close();
      }
    },
    [handleSubmit, close]
  );

  const orbVariants = {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    hover: { scale: 1.05 },
    tap: { scale: 0.95 },
  };

  const panelVariants = {
    hidden: {
      opacity: 0,
      scale: 0.9,
      y: 20,
      transformOrigin: "bottom right" as const,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        stiffness: 300,
        damping: 25,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      y: 20,
      transition: {
        duration: 0.15,
      },
    },
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence mode="wait">
        {!isOpen ? (
          <motion.button
            key="orb"
            variants={orbVariants}
            initial="initial"
            animate="animate"
            whileHover="hover"
            whileTap="tap"
            onClick={() => useFloatingAssistant.getState().open()}
            className="relative w-12 h-12 rounded-full bg-teal-500 shadow-lg shadow-teal-500/20 flex items-center justify-center cursor-pointer group hover:brightness-110 transition-all duration-200"
          >
            <Sparkles className="w-5 h-5 text-white" />
          </motion.button>
        ) : (
          <motion.div
            key="panel"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-[400px] h-[520px] bg-sidebar border border-white/5 shadow-2xl shadow-black/40 flex flex-col overflow-hidden"
          >
            <div className="flex flex-col h-full p-1">
              <div className="flex items-center justify-between px-3.5 py-2.5 widget-header">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-white/50 group-hover:text-white transition-all duration-250" />
                  <span className="text-xs font-medium text-white/50 group-hover:text-white transition-all duration-250">
                    AI Assistant
                  </span>
                  {state.isStreaming && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-teal-500/20 text-teal-400 animate-pulse">
                      thinking...
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleOpenFull}
                    className="h-7 w-7 text-white/50 hover:text-white hover:bg-sidebar-accent rounded-none"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </Button>
                  {messages.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleClear}
                      className="h-7 w-7 text-white/50 hover:text-white hover:bg-sidebar-accent rounded-none"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={close}
                    className="h-7 w-7 text-white/50 hover:text-white hover:bg-sidebar-accent rounded-none"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 bg-sidebar-accent group-hover:brightness-120 transition-all duration-250 overflow-hidden flex flex-col">
                <ScrollArea className="flex-1 p-3.5">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                      <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center mb-3">
                        <Sparkles className="w-5 h-5 text-teal-400" />
                      </div>
                      <p className="text-xs text-white/50 mb-4">
                        Ask me anything about your trading
                      </p>
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {QUICK_SUGGESTIONS.map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="text-[11px] px-2.5 py-1.5 border border-white/5 bg-sidebar text-white/50 hover:text-white hover:bg-sidebar-accent transition-colors cursor-pointer"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            "flex",
                            message.role === "user" ? "justify-end" : "justify-start"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[85%] px-3 py-2 text-xs",
                              message.role === "user"
                                ? "bg-teal-500/20 text-white border border-teal-500/30"
                                : "bg-sidebar text-white/90 border border-white/5"
                            )}
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
                                <div className="prose prose-invert prose-sm max-w-none">
                                  <Response parseIncompleteMarkdown={false}>
                                    {message.content}
                                  </Response>
                                </div>
                              )
                            ) : (
                              message.content
                            )}
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                <div className="p-2 border-t border-white/5">
                  <form onSubmit={handleSubmit} className="relative">
                    <Textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask about your trades..."
                      disabled={state.isStreaming}
                      className="min-h-[40px] max-h-[100px] pr-10 resize-none bg-sidebar border-white/5 text-white placeholder:text-white/40 focus-visible:ring-teal-500/50 text-xs rounded-none"
                      rows={1}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!input.trim() || state.isStreaming}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 bg-teal-500 hover:bg-teal-600 text-white disabled:opacity-50 rounded-none"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  </form>
                  <p className="text-[10px] text-white/30 mt-1.5 text-center">
                    Press Enter to send, Esc to close
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
    <div className="space-y-2">
      {stage && (
        <div className="flex items-center gap-2">
          <TextShimmer
            as="span"
            className="text-xs [--base-color:rgba(255,255,255,0.5)] [--base-gradient-color:rgba(255,255,255,0.95)]"
          >
            {displayMessage}
          </TextShimmer>
        </div>
      )}
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
