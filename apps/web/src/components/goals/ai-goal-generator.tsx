"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Send, Lightbulb, Target, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpcClient } from "@/utils/trpc";
import { showAIErrorToast } from "@/lib/ai-error-toast";
import type { CustomGoalCriteria } from "./custom-goal-builder";

interface AIGoalGeneratorProps {
  onGoalGenerated: (criteria: CustomGoalCriteria, title: string, type: string) => void;
  onCancel: () => void;
  accountId: string;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  goal?: {
    criteria: CustomGoalCriteria;
    title: string;
    type: string;
  };
}

const GOAL_SUGGESTIONS = [
  "Improve my win rate in Asia session",
  "Reduce losses on EURUSD",
  "Increase profit factor for long trades",
  "Better consistency on Mondays",
  "Improve ICT model performance",
];

export function AIGoalGenerator({
  onGoalGenerated,
  onCancel,
  accountId,
}: AIGoalGeneratorProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'll help you create a personalized trading goal. Tell me what you'd like to improve, and I'll analyze your trading data to create a specific, measurable goal.\n\nFor example:\n• \"Improve my win rate in Asia session\"\n• \"Reduce my losses on EURUSD\"\n• \"Increase my profit factor for long trades\"",
    },
  ]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    setIsGenerating(true);

    try {
      // Call AI to parse the goal
      const response = await trpcClient.ai.generateGoal.mutate({
        prompt: userMessage,
        accountId,
      });

      // Add assistant response with the generated goal
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.message,
          goal: response.goal
            ? {
                criteria: response.goal.criteria as CustomGoalCriteria,
                title: response.goal.title,
                type: response.goal.type,
              }
            : undefined,
        },
      ]);
    } catch (error) {
      console.error("Failed to generate goal:", error);
      showAIErrorToast(error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I'm sorry, I had trouble understanding that. Could you try rephrasing? For example: 'I want to improve my win rate in the London session to 70%'",
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseSuggestion = (suggestion: string) => {
    setInput(suggestion);
  };

  const handleAcceptGoal = (goal: NonNullable<Message["goal"]>) => {
    onGoalGenerated(goal.criteria, goal.title, goal.type);
  };

  return (
    <div className="flex flex-col h-[600px]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20">
          <Sparkles className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">
            AI Goal Generator
          </h3>
          <p className="text-sm text-white/60">
            Describe what you want to improve, and I'll create a goal for you
          </p>
        </div>
      </div>

      {/* Suggestions (show only if no user messages yet) */}
      {messages.filter((m) => m.role === "user").length === 0 && (
        <motion.div
          className="mb-4 space-y-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 text-xs text-white/50 mb-2">
            <Lightbulb className="w-3 h-3" />
            <span>Try these suggestions:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {GOAL_SUGGESTIONS.map((suggestion, index) => (
              <motion.button
                key={index}
                onClick={() => handleUseSuggestion(suggestion)}
                className="px-3 py-1.5 rounded-full text-xs bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all border border-white/10"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {suggestion}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-4 ${
                  message.role === "user"
                    ? "bg-blue-500/20 border border-blue-500/30"
                    : "bg-white/5 border border-white/10"
                }`}
              >
                <p className="text-sm text-white/90 whitespace-pre-wrap">
                  {message.content}
                </p>

                {/* Goal card if present */}
                {message.goal && (
                  <motion.div
                    className="mt-4 p-4 rounded-lg border border-white/20 bg-white/5"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <Target className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-white mb-1">
                          {message.goal.title}
                        </h4>
                        <p className="text-xs text-white/60">
                          {message.goal.criteria.description}
                        </p>
                      </div>
                    </div>

                    {/* Filters */}
                    {message.goal.criteria.filters.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-white/50 mb-2">Filters:</p>
                        <div className="flex flex-wrap gap-2">
                          {message.goal.criteria.filters.map((filter, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 rounded text-xs bg-white/10 text-white/80"
                            >
                              {filter.type}: {filter.value}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                      <div>
                        <span className="text-white/50">Metric: </span>
                        <span className="text-white/80">
                          {message.goal.criteria.metric}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/50">Target: </span>
                        <span className="text-white/80">
                          {message.goal.criteria.targetValue}
                        </span>
                      </div>
                      {message.goal.criteria.baselineValue && (
                        <div>
                          <span className="text-white/50">Current: </span>
                          <span className="text-white/80">
                            {message.goal.criteria.baselineValue}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-white/50">Timeframe: </span>
                        <span className="text-white/80">{message.goal.type}</span>
                      </div>
                    </div>

                    {/* Accept button */}
                    <Button
                      onClick={() => handleAcceptGoal(message.goal!)}
                      className="w-full"
                      size="sm"
                    >
                      <Target className="w-4 h-4 mr-2" />
                      Create This Goal
                    </Button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading indicator */}
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="flex items-center gap-2 text-white/60">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Analyzing your request...</span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Describe the goal you want to achieve..."
          className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          disabled={isGenerating}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || isGenerating}
          className="px-4 py-3"
        >
          {isGenerating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </Button>
      </div>

      {/* Cancel button */}
      <Button
        onClick={onCancel}
        variant="outline"
        className="w-full mt-4"
      >
        Back to Templates
      </Button>
    </div>
  );
}
