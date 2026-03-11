"use client";

import { useState } from "react";
import { trpc } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Scale,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { WidgetWrapper } from "./widget-wrapper";

const RULE_TYPE_LABELS: Record<string, string> = {
  allowed_sessions: "Allowed Sessions",
  blocked_sessions: "Blocked Sessions",
  allowed_symbols: "Allowed Symbols",
  max_trades_per_day: "Max Trades/Day",
  max_consecutive_losses: "Max Consecutive Losses",
  min_rr_ratio: "Min R:R Ratio",
  protocol_required: "Protocol Required",
  max_daily_loss: "Max Daily Loss",
  no_trading_during_news: "No News Trading",
  time_restriction: "Time Restriction",
};

const CATEGORY_COLORS: Record<string, string> = {
  session: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  symbol: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  risk: "text-red-400 bg-red-500/10 border-red-500/20",
  timing: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  setup: "text-teal-400 bg-teal-500/10 border-teal-500/20",
  psychology: "text-pink-400 bg-pink-500/10 border-pink-500/20",
};

export function RuleComplianceWidget({
  isEditing = false,
  className,
}: {
  isEditing?: boolean;
  className?: string;
}) {
  const accountId = useAccountStore((s) => s.selectedAccountId);
  const [sheetOpen, setSheetOpen] = useState(false);

  const {
    data: rules,
    isLoading,
    refetch: refetchRules,
  } = trpc.ai.getRules.useQuery(
    { accountId: accountId ?? "" },
    { enabled: !!accountId }
  );

  const { data: compliance } = trpc.ai.getDailyCompliance.useQuery(
    { accountId: accountId ?? "" },
    { enabled: !!accountId }
  );

  const { data: suggestedRules } = trpc.ai.getSuggestedRules.useQuery(
    { accountId: accountId ?? "" },
    { enabled: !!accountId && sheetOpen }
  );

  const createRule = trpc.ai.createRule.useMutation({
    onSuccess: () => {
      refetchRules();
      toast.success("Rule created");
    },
  });

  const deleteRule = trpc.ai.deleteRule.useMutation({
    onSuccess: () => {
      refetchRules();
      toast.success("Rule deleted");
    },
  });

  const activeRules = rules ?? [];
  const totalRules = activeRules.length;
  const passCount = compliance?.passed ?? 0;
  const failCount = compliance?.failed ?? 0;
  const complianceRate =
    totalRules > 0 ? Math.round((passCount / totalRules) * 100) : 100;

  return (
    <>
      <WidgetWrapper
        isEditing={isEditing}
        className={className}
        icon={Scale}
        title="Rule compliance"
        showHeader
        onClick={() => setSheetOpen(true)}
        contentClassName="flex-col justify-end p-3.5"
      >
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Skeleton className="h-20 w-20 rounded-full" />
          </div>
        ) : totalRules === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center">
            <Scale className="h-8 w-8 text-white/20 mb-2" />
            <p className="text-xs text-white/50">No rules defined</p>
            <p className="text-[10px] text-white/30 mt-1">
              Click to set up trading rules
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center justify-center flex-1">
              <div className="relative w-24 h-24">
                <svg
                  viewBox="0 0 100 100"
                  className="w-full h-full -rotate-90"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-white/10"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(complianceRate / 100) * 264} 264`}
                    className={
                      complianceRate >= 80
                        ? "text-emerald-400"
                        : complianceRate >= 60
                        ? "text-amber-400"
                        : "text-rose-400"
                    }
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className={cn(
                      "text-xl font-bold",
                      complianceRate >= 80
                        ? "text-emerald-400"
                        : complianceRate >= 60
                        ? "text-amber-400"
                        : "text-rose-400"
                    )}
                  >
                    {complianceRate}%
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-white/40 mt-2">
                {passCount} passed / {failCount} failed
              </p>
            </div>

            {failCount > 0 && compliance?.violations && (
              <div className="space-y-1 mt-auto">
                {compliance.violations
                  .slice(0, 2)
                  .map((v: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 text-[10px]"
                    >
                      <XCircle className="h-2.5 w-2.5 text-rose-400 shrink-0" />
                      <span className="text-white/50 truncate">
                        {v.ruleName}: {v.message}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </WidgetWrapper>

      {/* Rules management sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[440px] sm:w-[500px] bg-sidebar border-white/5 overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-sm font-medium flex items-center gap-2">
              <Scale className="h-4 w-4 text-teal-400" />
              Trading Rules
            </SheetTitle>
            <SheetDescription className="text-xs">
              Define rules and track compliance automatically
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 pb-6">
            {/* Active rules */}
            <div>
              <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-3">
                Active Rules ({activeRules.length})
              </h3>

              {activeRules.length === 0 ? (
                <div className="rounded-lg border border-white/5 bg-white/3 p-4 text-center">
                  <p className="text-sm text-white/50">No rules set up yet</p>
                  <p className="text-xs text-white/30 mt-1">
                    Add rules below or use AI suggestions
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeRules.map((rule: any) => (
                    <div
                      key={rule.id}
                      className="rounded-lg border border-white/5 bg-white/3 p-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium truncate">
                              {rule.name}
                            </p>
                            <span
                              className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded-xs border",
                                CATEGORY_COLORS[rule.category] ??
                                  "text-white/50 bg-white/5 border-white/10"
                              )}
                            >
                              {rule.category}
                            </span>
                          </div>
                          <p className="text-[10px] text-white/40">
                            {RULE_TYPE_LABELS[rule.ruleType] ?? rule.ruleType}
                            {rule.violationCount > 0 && (
                              <span className="text-rose-400 ml-2">
                                {rule.violationCount} violations
                              </span>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteRule.mutate({ ruleId: rule.id })}
                          className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Suggested Rules */}
            {suggestedRules && suggestedRules.length > 0 && (
              <>
                <Separator className="bg-white/10" />
                <div>
                  <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <Lightbulb className="h-3 w-3 text-yellow-400" />
                    AI Suggested Rules
                  </h3>
                  <div className="space-y-2">
                    {suggestedRules.map((suggestion, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <p className="text-sm font-medium">
                            {suggestion.name}
                          </p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] text-teal-400 hover:text-teal-300"
                            onClick={() => {
                              if (!accountId) return;
                              createRule.mutate({
                                accountId,
                                name: suggestion.name,
                                ruleType: suggestion.ruleType,
                                category: suggestion.category,
                                config: suggestion.config,
                              });
                            }}
                            disabled={createRule.isPending}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                          </Button>
                        </div>
                        <p className="text-[10px] text-white/50">
                          {suggestion.rationale}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Today's Compliance */}
            {compliance && totalRules > 0 && (
              <>
                <Separator className="bg-white/10" />
                <div>
                  <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-3">
                    Today&apos;s Compliance
                  </h3>
                  <div className="rounded-lg border border-white/5 bg-white/3 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {complianceRate >= 80 ? (
                          <CheckCircle className="h-5 w-5 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-amber-400" />
                        )}
                        <span
                          className={cn(
                            "text-2xl font-bold",
                            complianceRate >= 80
                              ? "text-emerald-400"
                              : complianceRate >= 60
                              ? "text-amber-400"
                              : "text-rose-400"
                          )}
                        >
                          {complianceRate}%
                        </span>
                      </div>
                      <div className="text-right text-[10px] text-white/40">
                        <p>{passCount} passed</p>
                        <p>{failCount} failed</p>
                      </div>
                    </div>

                    {compliance.violations &&
                      compliance.violations.length > 0 && (
                        <div className="space-y-1.5 border-t border-white/5 pt-2 mt-2">
                          {compliance.violations.map((v: any, i: number) => (
                            <div
                              key={i}
                              className="flex items-center gap-1.5 text-xs"
                            >
                              <XCircle className="h-3 w-3 text-rose-400 shrink-0" />
                              <span className="text-white/60">
                                {v.ruleName}: {v.message}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
