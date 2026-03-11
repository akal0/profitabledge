"use client";

import { useState } from "react";
import { trpc } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Lightbulb,
  AlertTriangle,
  Info,
  CheckCircle,
  X,
  Eye,
  RefreshCw,
  Brain,
  TrendingUp,
  TrendingDown,
  Shield,
  Search,
  Sparkles,
} from "lucide-react";

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertTriangle,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  info: {
    icon: Info,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  positive: {
    icon: CheckCircle,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
} as const;

const CATEGORY_CONFIG = {
  behavioral: { icon: Brain, label: "Behavioral" },
  efficiency: { icon: TrendingUp, label: "Efficiency" },
  risk: { icon: Shield, label: "Risk" },
  pattern: { icon: Search, label: "Pattern" },
  anomaly: { icon: Sparkles, label: "Anomaly" },
  positive: { icon: TrendingDown, label: "Positive" },
} as const;

export function InsightPanel() {
  const accountId = useAccountStore((s) => s.selectedAccountId);
  const [open, setOpen] = useState(false);

  const { data: insightsData, refetch } = trpc.ai.getInsights.useQuery(
    { accountId: accountId ?? "", unreadOnly: false, limit: 20 },
    { enabled: !!accountId && open, refetchInterval: 30_000 }
  );

  const markRead = trpc.ai.markInsightRead.useMutation({
    onSuccess: () => refetch(),
  });
  const dismiss = trpc.ai.dismissInsight.useMutation({
    onSuccess: () => refetch(),
  });
  const generate = trpc.ai.generateInsightsManual.useMutation({
    onSuccess: () => refetch(),
  });

  const insights = insightsData?.items ?? [];
  const unreadCount = insightsData?.unreadCount ?? 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative gap-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Lightbulb className="h-4 w-4" />
          Insights
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 text-[10px] font-bold text-black">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[440px] bg-sidebar border-white/5 overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-sm font-medium">
              AI Insights
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                if (accountId) generate.mutate({ accountId });
              }}
              disabled={generate.isPending}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${generate.isPending ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
          <SheetDescription className="text-xs">
            Proactive insights from your Trading Brain
          </SheetDescription>
        </SheetHeader>

        {insights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Lightbulb className="h-8 w-8 mb-3 opacity-30" />
            <p className="text-sm font-medium">No insights yet</p>
            <p className="text-xs mt-1 text-center px-4">
              Keep trading and the AI will generate personalized insights based
              on your patterns.
            </p>
            {accountId && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => generate.mutate({ accountId })}
                disabled={generate.isPending}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 mr-2 ${generate.isPending ? "animate-spin" : ""}`}
                />
                Generate Now
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3 pb-6">
            {insights.map((insight) => {
              const severity =
                SEVERITY_CONFIG[
                  insight.severity as keyof typeof SEVERITY_CONFIG
                ] || SEVERITY_CONFIG.info;
              const category =
                CATEGORY_CONFIG[
                  insight.category as keyof typeof CATEGORY_CONFIG
                ] || CATEGORY_CONFIG.behavioral;
              const SeverityIcon = severity.icon;
              const CategoryIcon = category.icon;

              return (
                <div
                  key={insight.id}
                  className={`rounded-lg border p-3 transition-all ${severity.bg} ${severity.border} ${
                    !insight.isRead ? "ring-1 ring-teal-500/30" : "opacity-80"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <SeverityIcon
                      className={`h-4 w-4 mt-0.5 shrink-0 ${severity.color}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-medium truncate">
                          {insight.title}
                        </h4>
                        <div className="flex items-center gap-1 shrink-0">
                          {!insight.isRead && (
                            <button
                              onClick={() =>
                                markRead.mutate({ insightId: insight.id })
                              }
                              className="p-0.5 rounded hover:bg-white/5"
                              title="Mark as read"
                            >
                              <Eye className="h-3 w-3 text-muted-foreground" />
                            </button>
                          )}
                          <button
                            onClick={() =>
                              dismiss.mutate({ insightId: insight.id })
                            }
                            className="p-0.5 rounded hover:bg-white/5"
                            title="Dismiss"
                          >
                            <X className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {insight.message}
                      </p>
                      {insight.recommendation && (
                        <p className="text-xs text-teal-400/80 mt-2 italic">
                          {insight.recommendation}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">
                          <CategoryIcon className="h-2.5 w-2.5" />
                          {category.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(insight.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Insight count badge for sidebar navigation
 */
export function InsightBadge() {
  const accountId = useAccountStore((s) => s.selectedAccountId);

  const { data } = trpc.ai.getInsights.useQuery(
    { accountId: accountId ?? "", unreadOnly: true, limit: 1 },
    { enabled: !!accountId, refetchInterval: 30_000 }
  );

  const count = data?.unreadCount ?? 0;
  if (count === 0) return null;

  return (
    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-500 px-1 text-[10px] font-bold text-black">
      {count > 9 ? "9+" : count}
    </span>
  );
}
