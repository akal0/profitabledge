/**
 * Premium Chat Interface
 * 
 * Line-by-line streaming with smooth animations.
 * Multi-stage loading states and completion shimmer.
 */

"use client";

import { useState, useRef, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ui/shadcn-io/ai/message";
import { Response } from "@/components/ui/shadcn-io/ai/response";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ui/shadcn-io/ai/prompt-input";
import {
  Suggestions,
  Suggestion,
} from "@/components/ui/shadcn-io/ai/suggestion";
import { Sparkles, Copy, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { TextShimmer } from "@/components/ui/text-shimmer";
import type { AssistantStreamState, StreamStage } from "@/types/assistant-stream";
import { STAGE_CONFIG } from "@/types/assistant-stream";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  streamState?: AssistantStreamState;
}

interface PremiumChatInterfaceProps {
  messages: ChatMessage[];
  streamState: AssistantStreamState;
  userImage?: string | null;
  userName?: string | null;
  onSendMessage: (content: string) => void;
  onClear: () => void;
  isStreaming: boolean;
  className?: string;
}

const TRADING_SUGGESTIONS = [
  "What's my average RR capture efficiency?",
  "How do I perform in London vs NY session?",
  "Show my best trades this month",
  "Where am I leaving money on the table?",
  "Which setups give me the best edge?",
  "Analyze my stop loss placement",
];

// Stage indicator component
const StageIndicator = memo(({ stage, message }: { stage: StreamStage | null; message: string }) => {
  if (!stage) return null;
  
  const config = STAGE_CONFIG[stage];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 text-sm"
    >
      <div className="relative flex items-center justify-center">
        <div className="h-2 w-2 rounded-full bg-purple-500 stage-pulse" />
        <div className="absolute h-4 w-4 rounded-full bg-purple-500/20 animate-ping" />
      </div>
      <TextShimmer className="text-white/70" duration={2}>
        {message || config.message}
      </TextShimmer>
    </motion.div>
  );
});
StageIndicator.displayName = "StageIndicator";

// Streaming line component with animation
const StreamingLine = memo(({ 
  line, 
  index, 
  isTyping = false,
  justCompleted = false,
}: { 
  line: string; 
  index: number; 
  isTyping?: boolean;
  justCompleted?: boolean;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05, duration: 0.2 }}
    className={cn(
      "stream-line",
      isTyping && "typing-indicator",
      justCompleted && "shimmer-once"
    )}
  >
    <Response parseIncompleteMarkdown={isTyping}>
      {line}
    </Response>
  </motion.div>
));
StreamingLine.displayName = "StreamingLine";

// Assistant message with streaming support
const AssistantMessage = memo(({
  content,
  streamState,
  isStreaming,
}: {
  content: string;
  streamState?: AssistantStreamState;
  isStreaming: boolean;
}) => {
  const lines = streamState?.lines || [];
  const lineBuffer = streamState?.lineBuffer || "";
  const stage = streamState?.stage;
  const statusMessage = streamState?.statusMessage || "";
  const justCompleted = streamState?.justCompleted || false;
  const isDone = streamState?.isDone || false;

  // If we have stream state, render line by line
  if (streamState && (lines.length > 0 || lineBuffer || isStreaming)) {
    return (
      <div className={cn("space-y-2", justCompleted && "shimmer-once")}>
        {/* Stage indicator while streaming */}
        {isStreaming && stage && (
          <StageIndicator stage={stage} message={statusMessage} />
        )}

        {/* Committed lines */}
        {lines.map((line, i) => (
          <StreamingLine 
            key={`line-${i}`} 
            line={line} 
            index={i}
            justCompleted={justCompleted && i === lines.length - 1}
          />
        ))}

        {/* Currently typing line */}
        {lineBuffer && (
          <StreamingLine 
            line={lineBuffer} 
            index={lines.length} 
            isTyping={true}
          />
        )}

        {/* Loading skeleton when streaming but no content yet */}
        {isStreaming && lines.length === 0 && !lineBuffer && (
          <div className="space-y-2">
            <div className="h-4 w-3/4 bg-white/5 rounded shimmer" />
            <div className="h-4 w-1/2 bg-white/5 rounded shimmer" />
          </div>
        )}
      </div>
    );
  }

  // Fallback to regular response
  return (
    <div className={cn(justCompleted && "shimmer-once")}>
      <Response>{content}</Response>
    </div>
  );
});
AssistantMessage.displayName = "AssistantMessage";

export function PremiumChatInterface({
  messages,
  streamState,
  userImage,
  userName,
  onSendMessage,
  onClear,
  isStreaming,
  className,
}: PremiumChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamState.lines, streamState.lineBuffer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isStreaming) return;
    
    onSendMessage(inputValue);
    setInputValue("");
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  return (
    <div className={cn("flex flex-col h-full w-full bg-sidebar", className)}>
      {/* Messages Container */}
      <div className="flex-1 overflow-hidden w-full relative flex flex-col">
        {messages.length === 0 ? (
          <EmptyState onSuggestionClick={handleSuggestionClick} />
        ) : (
          <div className="flex-1 overflow-y-auto w-full">
            <div className="space-y-6 px-8 py-6 w-full max-w-4xl mx-auto">
              {messages.map((message, idx) => (
                <Message key={message.id} from={message.role}>
                  <MessageAvatar
                    src={
                      message.role === "user"
                        ? userImage || "https://api.dicebear.com/7.x/avataaars/svg?seed=user"
                        : "https://api.dicebear.com/7.x/bottts/svg?seed=assistant&backgroundColor=b6e3f4"
                    }
                    name={message.role === "user" ? userName || "You" : "AI"}
                    className="ring-0"
                  />

                  <MessageContent className="rounded-sm text-white">
                    {message.role === "assistant" ? (
                      <AssistantMessage
                        content={message.content}
                        streamState={message.streamState}
                        isStreaming={isStreaming && idx === messages.length - 1}
                      />
                    ) : (
                      <p className="text-white/90">{message.content}</p>
                    )}
                  </MessageContent>
                </Message>
              ))}

              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="w-full bg-sidebar shrink-0">
        <Separator />
        <div className="w-full max-w-4xl mx-auto p-6">
          <div className="flex items-center gap-2 mb-4">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="text-white/50 hover:text-white/70 hover:bg-white/5"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
          
          <PromptInput
            onSubmit={handleSubmit}
            className="border-white/10 bg-sidebar-accent w-full rounded-lg"
          >
            <PromptInputTextarea
              value={inputValue}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setInputValue(e.target.value)
              }
              placeholder="Ask about your trading performance, patterns, or edge..."
              disabled={isStreaming}
              className="text-white placeholder:text-white/40 bg-transparent w-full p-4 min-h-[60px]"
            />
            <PromptInputToolbar className="border-t-white/5">
              <PromptInputTools>
                {isStreaming && (
                  <span className="text-xs text-purple-400 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
                    Analyzing...
                  </span>
                )}
              </PromptInputTools>

              <PromptInputSubmit
                disabled={isStreaming || !inputValue.trim()}
                className="bg-purple-600 hover:bg-purple-500 text-white border-0"
              />
            </PromptInputToolbar>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}

// Empty state component
function EmptyState({ onSuggestionClick }: { onSuggestionClick: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 w-full">
      <div className="w-full max-w-3xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-4"
        >
          <div className="relative">
            <Sparkles className="h-16 w-16 text-purple-400/50 mx-auto" />
            <div className="absolute inset-0 blur-2xl bg-purple-500/20 rounded-full" />
          </div>
          <h3 className="text-2xl font-medium text-white">
            Trading AI Assistant
          </h3>
          <p className="text-sm text-white/50 max-w-lg mx-auto leading-relaxed">
            Ask questions about your trades, analyze performance patterns, 
            compare sessions, or discover your trading edge. I'll show you 
            the data behind every insight.
          </p>
        </motion.div>

        {/* Suggestions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full"
        >
          <p className="mb-4 text-xs font-medium text-white/40">
            Try asking
          </p>
          <Suggestions className="mb-4 justify-center flex-wrap gap-2">
            {TRADING_SUGGESTIONS.map((suggestion, i) => (
              <motion.div
                key={suggestion}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.05 }}
              >
                <Suggestion
                  suggestion={suggestion}
                  onClick={onSuggestionClick}
                  className="border-white/5 bg-sidebar-accent/50 hover:bg-sidebar-accent text-white/70 hover:text-white text-xs transition-all duration-200"
                />
              </motion.div>
            ))}
          </Suggestions>
        </motion.div>
      </div>
    </div>
  );
}
