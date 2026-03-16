"use client";

import { useState } from "react";
import { trpc } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
import { cn } from "@/lib/utils";
import { TRADE_SURFACE_CARD_CLASS } from "@/components/trades/trade-identifier-pill";

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertTriangle,
    label: "Critical",
    color: "text-red-400",
    cardColor: cn(TRADE_SURFACE_CARD_CLASS, "ring-l-2 ring-l-red-500/60"),
  },
  warning: {
    icon: AlertTriangle,
    label: "Warning",
    color: "text-amber-400",
    cardColor: cn(TRADE_SURFACE_CARD_CLASS, "ring-l-2 ring-l-amber-500/60"),
  },
  info: {
    icon: Info,
    label: "Info",
    color: "text-blue-400",
    cardColor: cn(TRADE_SURFACE_CARD_CLASS, "ring-l-2 ring-l-blue-500/60"),
  },
  positive: {
    icon: CheckCircle,
    label: "Positive",
    color: "text-emerald-400",
    cardColor: cn(TRADE_SURFACE_CARD_CLASS, "ring-l-2 ring-l-emerald-500/60"),
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

function formatInsightTitle(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return title;

  return words
    .map((word, index) => {
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }

      return /^[A-Z0-9:+/-]+$/.test(word) ? word : word.toLowerCase();
    })
    .join(" ");
}

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
      <button
        onClick={() => setOpen(true)}
        className="relative flex h-[38px] w-max items-center justify-center gap-1 rounded-sm ring ring-white/5 bg-sidebar px-3 py-2 text-xs text-white transition-all duration-250 hover:bg-sidebar-accent hover:brightness-110 active:scale-95 cursor-pointer"
      >
        <Lightbulb className="size-3 text-white/75" />
        <span>Insights</span>
        {unreadCount > 0 && (
          <span className="flex size-1 ml-1 items-center justify-center rounded-full bg-teal-500 text-[10px] font-bold text-black"></span>
        )}
      </button>

      <SheetContent
        side="right"
        className="w-full overflow-y-auto rounded-md p-0 sm:max-w-lg"
      >
        <div className="px-6 py-5 pb-0">
          <SheetHeader className="p-0">
            <div className="flex w-full items-end justify-between">
              <div className="flex flex-col items-start gap-1">
                <SheetTitle className="text-base font-semibold text-white">
                  AI Insights
                </SheetTitle>
                <p className="text-xs text-white/40">
                  Proactive insights from your Trading Brain
                </p>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <span className="text-xs text-white/40">
                    {unreadCount} unread
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 rounded-sm ring ring-white/5 bg-sidebar-accent px-3 text-xs text-white/60 hover:text-white"
                  onClick={() => {
                    if (accountId) generate.mutate({ accountId });
                  }}
                  disabled={generate.isPending}
                >
                  <RefreshCw
                    className={cn(
                      "size-3",
                      generate.isPending && "animate-spin"
                    )}
                  />
                  {generate.isPending ? "Generating…" : "Generate"}
                </Button>
              </div>
            </div>
          </SheetHeader>
        </div>

        <div className="mt-5">
          <Separator />
        </div>

        {insights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-sm ring ring-white/5 bg-sidebar-accent">
              <Lightbulb className="h-5 w-5 text-white/30" />
            </div>
            <p className="mt-4 text-sm font-medium text-white/60">
              No insights yet
            </p>
            <p className="mt-1 max-w-xs text-xs text-white/30">
              {generate.data?.count === 0
                ? "Not enough trade history to generate insights. Keep trading and try again."
                : "Keep trading and the AI will generate personalized insights based on your patterns."}
            </p>
            {accountId && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-4 h-8 gap-1.5 rounded-sm ring ring-white/5 bg-sidebar-accent px-4 text-xs text-white/60 hover:text-white"
                onClick={() => generate.mutate({ accountId })}
                disabled={generate.isPending}
              >
                <RefreshCw
                  className={cn("size-3", generate.isPending && "animate-spin")}
                />
                {generate.isPending ? "Generating…" : "Generate now"}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            {insights.map((insight, idx) => {
              const severity =
                SEVERITY_CONFIG[
                  insight.severity as keyof typeof SEVERITY_CONFIG
                ] ?? SEVERITY_CONFIG.info;
              const category =
                CATEGORY_CONFIG[
                  insight.category as keyof typeof CATEGORY_CONFIG
                ] ?? CATEGORY_CONFIG.behavioral;
              const SeverityIcon = severity.icon;
              const CategoryIcon = category.icon;

              return (
                <div key={insight.id}>
                  {/* Section header */}
                  <div className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SeverityIcon
                        className={cn("h-3.5 w-3.5 shrink-0", severity.color)}
                      />
                      <h3 className="text-xs font-semibold tracking-wide text-white/70">
                        {formatInsightTitle(insight.title)}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1">
                      {!insight.isRead && (
                        <button
                          onClick={() =>
                            markRead.mutate({ insightId: insight.id })
                          }
                          className="rounded p-1 text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
                          title="Mark as read"
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        onClick={() =>
                          dismiss.mutate({ insightId: insight.id })
                        }
                        className="rounded p-1 text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
                        title="Dismiss"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <Separator />

                  {/* Body */}
                  <div
                    className={cn("px-6 py-5", insight.isRead && "opacity-60")}
                  >
                    <p className="text-sm leading-relaxed text-white/60">
                      {insight.message}
                    </p>

                    {insight.recommendation && (
                      <div className="mt-4">
                        <div className="px-4 py-3 rounded-sm ring ring-teal-500/10 bg-teal-500/5">
                          <p className="text-xs font-semibold tracking-wide text-white/50 mb-1.5">
                            Recommendation
                          </p>
                          <p className="text-xs leading-relaxed text-teal-400/80">
                            {insight.recommendation}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 rounded-sm ring ring-white/5 bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/40">
                        <CategoryIcon className="h-2.5 w-2.5" />
                        {category.label}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] uppercase tracking-wide font-medium ring ring-white/5 bg-white/5",
                          severity.color
                        )}
                      >
                        {severity.label}
                      </span>
                      <span className="ml-auto text-[10px] text-white/25">
                        {new Date(insight.createdAt).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </span>
                    </div>
                  </div>

                  <Separator />
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
