"use client";

import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import { cn } from "@/lib/utils";
import {
  ShieldAlert,
  AlertTriangle,
  TrendingDown,
  Flame,
  Zap,
  Trophy,
} from "lucide-react";

const ruleIcons: Record<string, typeof ShieldAlert> = {
  consecutive_loss_cooldown: TrendingDown,
  daily_loss_halt: AlertTriangle,
  win_streak_reduce_size: Trophy,
  revenge_trade_block: Flame,
  overtrading_throttle: Zap,
};

const ruleColors: Record<string, string> = {
  consecutive_loss_cooldown: "#ef4444",
  daily_loss_halt: "#f59e0b",
  win_streak_reduce_size: "#22c55e",
  revenge_trade_block: "#f97316",
  overtrading_throttle: "#8b5cf6",
};

export default function ConditionalRulesPage() {
  const accountId = useAccountStore((s) => s.selectedAccountId);

  const { data, isLoading } = trpc.rules.getConditionalRuleStatus.useQuery(
    { accountId: accountId || "" },
    { enabled: !!accountId }
  );

  if (!accountId) {
    return (
      <div className="flex flex-col w-full">
        <div className="px-6 sm:px-8 py-8">
          <p className="text-sm text-white/40 text-center">
            Select an account to view conditional rules.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col w-full">
        <div className="px-6 sm:px-8 py-5 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  const rules = data?.rules || [];
  const activeCount = rules.filter((r: any) => r.active).length;

  return (
    <div className="flex flex-col w-full">
      {/* Heading */}
      <div className="px-6 sm:px-8 py-5">
        <h2 className="text-sm font-semibold text-white">Conditional rules</h2>
        <p className="text-xs text-white/40 mt-0.5">
          Dynamic rules that activate based on your recent trading behavior.
        </p>
      </div>

      <Separator />

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Status</Label>
          <p className="text-xs text-white/40 mt-0.5">Current rule activity.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded ring ring-white/5">
            <span className="text-[10px] text-white/40">Total:</span>
            <span className="text-xs text-white font-medium">
              {rules.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 rounded ring ring-amber-500/10">
            <span className="text-[10px] text-amber-400/70">Triggered:</span>
            <span className="text-xs text-amber-400 font-medium">
              {activeCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 rounded ring ring-emerald-500/10">
            <span className="text-[10px] text-emerald-400/70">Clear:</span>
            <span className="text-xs text-emerald-400 font-medium">
              {rules.length - activeCount}
            </span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Rule rows */}
      {rules.length === 0 ? (
        <div className="px-6 sm:px-8 py-8">
          <p className="text-sm text-white/40 text-center">
            No conditional rules configured. Trade data is needed to evaluate
            behavioral rules.
          </p>
        </div>
      ) : (
        rules.map((rule: any, idx: number) => {
          const Icon = ruleIcons[rule.id] || ShieldAlert;
          const color = ruleColors[rule.id] || "#818cf8";

          return (
            <div key={rule.id}>
              <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
                <div className="flex items-center gap-3">
                  <div
                    className="size-8 rounded-md flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${color}15` }}
                  >
                    <Icon className="size-4" style={{ color }} />
                  </div>
                  <div>
                    <Label className="text-sm text-white/80 font-medium">
                      {rule.name}
                    </Label>
                    <div className="mt-1">
                      <span
                        className={cn(
                          "text-[9px] font-semibold px-2 py-0.5 rounded-full",
                          rule.active
                            ? "bg-red-500/20 text-red-400"
                            : "bg-emerald-500/20 text-emerald-400"
                        )}
                      >
                        {rule.active ? "TRIGGERED" : "CLEAR"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-white/50">{rule.description}</p>

                  <div className="flex items-center gap-4 text-[10px]">
                    <div>
                      <span className="text-white/30">Threshold: </span>
                      <span className="text-white/60">{rule.threshold}</span>
                    </div>
                    <div>
                      <span className="text-white/30">Current: </span>
                      <span
                        className={cn(
                          "font-medium",
                          rule.active ? "text-red-400" : "text-white/60"
                        )}
                      >
                        {rule.currentValue}
                      </span>
                    </div>
                  </div>

                  {rule.active && rule.recommendation && (
                    <div className="px-2 py-1.5 bg-amber-500/10 ring ring-amber-500/10 rounded text-[10px] text-amber-300/80">
                      {rule.recommendation}
                    </div>
                  )}
                </div>
              </div>
              {idx < rules.length - 1 && <Separator />}
            </div>
          );
        })
      )}
    </div>
  );
}
