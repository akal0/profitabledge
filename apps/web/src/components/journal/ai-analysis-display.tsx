"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Brain,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  RefreshCw,
  Send,
  Loader2,
  Tag,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  journalActionButtonClassName,
  journalActionIconButtonClassName,
} from "./action-button-styles";

interface AIAnalysisDisplayProps {
  entryId: string;
  className?: string;
}

const SENTIMENT_CONFIG = {
  positive: { color: "text-green-400", bg: "bg-green-400/10", icon: TrendingUp },
  negative: { color: "text-red-400", bg: "bg-red-400/10", icon: TrendingDown },
  neutral: { color: "text-white/60", bg: "bg-white/10", icon: Minus },
  mixed: { color: "text-yellow-400", bg: "bg-yellow-400/10", icon: AlertTriangle },
};

const PATTERN_TYPE_CONFIG = {
  pattern: { color: "text-blue-400", bg: "bg-blue-400/10", icon: Brain },
  strength: { color: "text-green-400", bg: "bg-green-400/10", icon: TrendingUp },
  weakness: { color: "text-red-400", bg: "bg-red-400/10", icon: TrendingDown },
  recommendation: { color: "text-yellow-400", bg: "bg-yellow-400/10", icon: Lightbulb },
  correlation: { color: "text-purple-400", bg: "bg-purple-400/10", icon: Target },
};

function Minus(props: any) {
  return <span className="w-4 h-4 flex items-center justify-center">−</span>;
}

export function AIAnalysisDisplay({ entryId, className }: AIAnalysisDisplayProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: entry, isLoading, refetch } = trpc.journal.get.useQuery({ id: entryId });
  const analyzeMutation = trpc.journal.analyzeEntry.useMutation();

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      await analyzeMutation.mutateAsync({ entryId });
      await refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to analyze journal entry"
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoading) {
    return (
      <Card className={cn("bg-sidebar border-white/10", className)}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasAnalysis = entry?.aiSummary || entry?.aiKeyInsights || entry?.aiPatterns;

  if (!hasAnalysis) {
    return (
      <Card className={cn("bg-sidebar border-white/10", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Sparkles className="h-5 w-5 text-teal-400" />
            AI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Brain className="h-10 w-10 text-white/20 mb-3" />
            <p className="text-sm text-white/40 mb-4">
              No AI analysis yet
            </p>
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className={journalActionButtonClassName}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze Entry
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sentiment = (entry?.aiSentiment as keyof typeof SENTIMENT_CONFIG) || "neutral";
  const sentimentConfig = SENTIMENT_CONFIG[sentiment];
  const SentimentIcon = sentimentConfig.icon;

  return (
    <Card className={cn("bg-sidebar border-white/10", className)}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-white">
          <Sparkles className="h-5 w-5 text-teal-400" />
          AI Analysis
        </CardTitle>
        <Button
          size="sm"
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className={journalActionIconButtonClassName}
        >
          <RefreshCw className={cn("h-4 w-4", isAnalyzing && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {entry?.aiSummary && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-white/60 uppercase tracking-wider">
              Summary
            </h4>
            <p className="text-sm text-white/80 leading-relaxed">
              {entry.aiSummary}
            </p>
          </div>
        )}

        {entry?.aiSentiment && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40">Sentiment:</span>
            <Badge
              variant="outline"
              className={cn(
                "border-0",
                sentimentConfig.bg,
                sentimentConfig.color
              )}
            >
              <SentimentIcon className="h-3 w-3 mr-1" />
              {sentiment}
            </Badge>
          </div>
        )}

        {entry?.aiKeyInsights && (entry.aiKeyInsights as string[]).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-white/60 uppercase tracking-wider">
              Key Insights
            </h4>
            <ul className="space-y-1.5">
              {(entry.aiKeyInsights as string[]).map((insight, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                  <Lightbulb className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {entry?.aiTopics && (entry.aiTopics as string[]).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-white/60 uppercase tracking-wider">
              Topics
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {(entry.aiTopics as string[]).map((topic, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-xs border-white/10 text-white/60"
                >
                  <Tag className="h-3 w-3 mr-1" />
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {entry?.aiPatterns && (entry.aiPatterns as any[]).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-white/60 uppercase tracking-wider">
              Detected Patterns
            </h4>
            <div className="space-y-2">
              {(entry.aiPatterns as any[]).map((pattern, i) => {
                const config = PATTERN_TYPE_CONFIG[pattern.type as keyof typeof PATTERN_TYPE_CONFIG] || PATTERN_TYPE_CONFIG.pattern;
                const Icon = config.icon;
                return (
                  <div
                    key={i}
                    className="p-3 bg-sidebar-accent border border-white/10"
                  >
                    <div className="flex items-start gap-2">
                      <div className={cn("p-1.5", config.bg)}>
                        <Icon className={cn("h-4 w-4", config.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white">
                            {pattern.title}
                          </p>
                          {pattern.confidence && (
                            <span className="text-xs text-white/40">
                              {Math.round(pattern.confidence * 100)}% confidence
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/60 mt-1">
                          {pattern.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {entry?.aiAnalyzedAt && (
          <p className="text-xs text-white/30 pt-2">
            Analyzed {formatDistanceToNow(new Date(entry.aiAnalyzedAt), { addSuffix: true })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function JournalInsightsPanel({ className }: { className?: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);

  const askJournalMutation = trpc.journal.askJournal.useMutation();

  const handleAsk = async () => {
    if (!question.trim()) return;
    try {
      const result = await askJournalMutation.mutateAsync({ question });
      setAnswer(result.answer);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to query journal insights"
      );
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <Card className="bg-sidebar border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Brain className="h-5 w-5 text-teal-400" />
            Ask Your Journal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What patterns do you see in my journal?"
                className="flex-1 bg-sidebar-accent border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 rounded-md"
                onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              />
              <Button
                onClick={handleAsk}
                disabled={askJournalMutation.isPending || !question.trim()}
                className={journalActionIconButtonClassName}
              >
                {askJournalMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            {answer && (
              <div className="p-3 bg-teal-500/10 border border-teal-500/20">
                <p className="text-sm text-white/80">{answer}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {[
                "What patterns do you see?",
                "How's my psychology affecting trades?",
                "What should I improve?",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setQuestion(q);
                  }}
                  className="text-xs px-2 py-1 bg-sidebar-accent border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function PatternAnalysisCard({ className }: { className?: string }) {
  const [patterns, setPatterns] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const analyzePatternsMutation = trpc.journal.analyzePatterns.useMutation({
    onSuccess: (result: any[]) => {
      setPatterns(result);
      setErrorMessage(null);
    },
    onError: (error: any) => {
      setPatterns([]);
      setErrorMessage(error.message);
    },
  });

  React.useEffect(() => {
    analyzePatternsMutation.mutate({ limit: 10 });
  }, []);

  const isLoading = analyzePatternsMutation.isPending && patterns.length === 0;

  if (isLoading) {
    return (
      <Card className={cn("bg-sidebar border-white/10", className)}>
        <CardHeader className="flex flex-row items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-9" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 bg-sidebar-accent" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("bg-sidebar border-white/10", className)}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-white">
          <Target className="h-5 w-5 text-teal-400" />
          Detected Patterns
        </CardTitle>
        <Button
          size="sm"
          onClick={() => analyzePatternsMutation.mutate({ limit: 10 })}
          disabled={analyzePatternsMutation.isPending}
          className={journalActionIconButtonClassName}
        >
          <RefreshCw
            className={cn("h-4 w-4", analyzePatternsMutation.isPending && "animate-spin")}
          />
        </Button>
      </CardHeader>
      <CardContent>
        {patterns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Target className="mb-3 h-10 w-10 text-white/20" />
            <p className="text-sm text-white/40">
              {errorMessage ?? "Not enough entries yet to extract patterns"}
            </p>
            <p className="mt-2 text-xs text-white/30">
              Add at least three meaningful journal entries to build a reliable pattern set.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {patterns.slice(0, 5).map((pattern, i) => {
              const config =
                PATTERN_TYPE_CONFIG[
                  pattern.type as keyof typeof PATTERN_TYPE_CONFIG
                ] || PATTERN_TYPE_CONFIG.pattern;
              const Icon = config.icon;
              return (
                <div
                  key={i}
                  className="border border-white/10 bg-sidebar-accent p-3 transition-colors hover:border-white/20"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("p-1.5", config.bg)}>
                        <Icon className={cn("h-4 w-4", config.color)} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{pattern.title}</p>
                        <p className="line-clamp-1 text-xs text-white/40">
                          {pattern.description}
                        </p>
                      </div>
                    </div>
                    {pattern.confidence && (
                      <Badge
                        variant="outline"
                        className="border-white/10 text-xs text-white/60"
                      >
                        {Math.round(pattern.confidence * 100)}%
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
