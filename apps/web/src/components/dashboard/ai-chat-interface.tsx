"use client";

/**
 * AI Trading Insights Chat Interface
 *
 * Beautiful two-column chat layout with streaming responses
 */

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import {
  Send,
  Sparkles,
  TrendingUp,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useAssistantPageContext } from "@/hooks/use-assistant-page-context";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AIChatInterfaceProps {
  accountId?: string;
  className?: string;
}

export function AIChatInterface({
  accountId,
  className,
}: AIChatInterfaceProps) {
  const pageContext = useAssistantPageContext("dashboard-chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const suggestedQueries = [
    {
      icon: TrendingUp,
      text: "How well did I do this week?",
      color: "text-emerald-500",
    },
    {
      icon: BarChart3,
      text: "What's my best performing asset?",
      color: "text-blue-500",
    },
    {
      icon: AlertCircle,
      text: "How deep do my trades drawdown?",
      color: "text-amber-500",
    },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    const assistantMessageIndex = messages.length + 1;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage },
      { role: "assistant", content: "" },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          messages: [...messages, { role: "user", content: userMessage }],
          pageContext,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        try {
          const error = JSON.parse(errorText);
          throw new Error(error.error || "Failed to get response");
        } catch {
          throw new Error(errorText || "Failed to get response");
        }
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response body");

      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;

        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[assistantMessageIndex] = {
            role: "assistant",
            content: fullContent,
          };
          return newMessages;
        });
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[assistantMessageIndex] = {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        };
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (text: string) => {
    setInput(text);
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Chat Messages - Two Column Layout */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full p-6 mb-6">
              <Sparkles className="w-12 h-12 text-blue-500" />
            </div>
            <h2 className="text-2xl font-semibold mb-3">
              Trading insights assistant
            </h2>
            <p className="text-muted-foreground max-w-md mb-8">
              Ask me anything about your trading performance. I can analyze your
              metrics, identify patterns, and help you improve.
            </p>

            <div className="grid gap-3 w-full max-w-2xl">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Try asking:
              </p>
              {suggestedQueries.map((query, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(query.text)}
                  className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:bg-accent hover:border-accent-foreground/20 transition-all text-left group"
                >
                  <query.icon className={cn("w-5 h-5", query.color)} />
                  <span className="text-sm group-hover:text-foreground">
                    {query.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message List */}
        <div className="space-y-6 max-w-5xl mx-auto">
          {messages.map((message, idx) => (
            <div
              key={idx}
              className={cn(
                "grid gap-4",
                message.role === "user"
                  ? "grid-cols-[1fr,auto]"
                  : "grid-cols-[auto,1fr]"
              )}
            >
              {/* User Message - Right Side */}
              {message.role === "user" && (
                <>
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-6 py-4">
                      <p className="text-primary-foreground text-sm leading-relaxed">
                        {message.content}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start pt-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                      You
                    </div>
                  </div>
                </>
              )}

              {/* AI Message - Left Side */}
              {message.role === "assistant" && (
                <>
                  <div className="flex items-start pt-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-card border border-border px-6 py-5 shadow-sm">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => (
                              <p className="text-sm leading-relaxed mb-3 last:mb-0">
                                {children}
                              </p>
                            ),
                            strong: ({ children }) => (
                              <strong className="font-semibold text-foreground">
                                {children}
                              </strong>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc list-inside space-y-1 my-3">
                                {children}
                              </ul>
                            ),
                            li: ({ children }) => (
                              <li className="text-sm text-muted-foreground">
                                {children}
                              </li>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="grid grid-cols-[auto,1fr] gap-4">
              <div className="flex items-start pt-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white animate-pulse" />
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-card border border-border px-6 py-5">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <form onSubmit={handleSubmit} className="px-4 py-4">
          <div
            className={cn(
              "relative rounded-2xl border transition-all",
              isFocused
                ? "border-primary shadow-lg shadow-primary/5 ring-2 ring-primary/10"
                : "border-border shadow-sm"
            )}
          >
            <Textarea
              value={input}
              onChange={handleInputChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Ask about your trading performance..."
              className="min-h-[80px] max-h-[200px] resize-none border-0 bg-transparent px-4 py-3 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as any);
                }
              }}
            />
            <div className="flex items-center justify-between px-4 pb-3">
              <p className="text-xs text-muted-foreground">
                Press{" "}
                <kbd className="px-1.5 py-0.5 text-xs font-mono rounded bg-muted">
                  Enter
                </kbd>{" "}
                to send,{" "}
                <kbd className="px-1.5 py-0.5 text-xs font-mono rounded bg-muted">
                  Shift + Enter
                </kbd>{" "}
                for new line
              </p>
              <Button
                type="submit"
                size="sm"
                disabled={!input.trim() || isLoading}
                className="gap-2 rounded-xl"
              >
                <Send className="w-4 h-4" />
                Send
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
