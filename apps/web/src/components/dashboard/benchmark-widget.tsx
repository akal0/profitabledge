"use client";

import { Fragment } from "react";
import { trpc } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import { cn } from "@/lib/utils";
import { BarChart3, TrendingUp, Target, Shield, Users } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { TRADE_IDENTIFIER_PILL_CLASS } from "@/components/trades/trade-identifier-pill";
import { WidgetWrapper } from "./widget-wrapper";

const WIDGET_CONTENT_SEPARATOR_CLASS =
  "-mx-3.5 shrink-0 self-stretch";

// Anonymous benchmark - compare user metrics to platform percentiles
export function BenchmarkWidget({
  accountId,
  isEditing = false,
  className,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
}) {
  const storeAccountId = useAccountStore((s) => s.selectedAccountId);
  const effectiveAccountId = accountId || storeAccountId;

  const { data: benchmarkData } = trpc.social.getAnonymousBenchmark.useQuery(
    { accountId: effectiveAccountId || "" },
    { enabled: !!effectiveAccountId }
  );

  const userStats = benchmarkData?.user ?? null;
  const metricBenchmarks = benchmarkData?.metrics ?? null;
  const populationSize = benchmarkData?.populationSize ?? 0;

  const getPercentile = (
    percentile: number
  ) => {
    if (percentile >= 90)
      return {
        bandLabel: "Top 10%",
        color: "text-emerald-400",
        tone: "border-emerald-400/20 bg-emerald-400/12 text-emerald-200",
      };
    if (percentile >= 75)
      return {
        bandLabel: "Top 25%",
        color: "text-teal-400",
        tone: "border-teal-400/20 bg-teal-400/12 text-teal-200",
      };
    if (percentile >= 50)
      return {
        bandLabel: "Top 50%",
        color: "text-blue-400",
        tone: "border-blue-400/20 bg-blue-400/12 text-blue-200",
      };
    if (percentile >= 25)
      return {
        bandLabel: "Top 75%",
        color: "text-amber-400",
        tone: "border-amber-400/20 bg-amber-400/12 text-amber-200",
      };
    return {
      bandLabel: "Bottom 25%",
      color: "text-rose-400",
      tone: "border-rose-400/20 bg-rose-400/12 text-rose-200",
    };
  };

  if (!userStats) {
    return (
      <WidgetWrapper
        isEditing={isEditing}
        className={className}
        icon={Users}
        title="Platform benchmark"
        showHeader
        contentClassName="flex-col justify-center p-3.5"
      >
        <p className="text-xs text-white/30">
          Need at least 5 trades to benchmark this account
        </p>
      </WidgetWrapper>
    );
  }

  if (!metricBenchmarks || populationSize === 0) {
    return (
      <WidgetWrapper
        isEditing={isEditing}
        className={className}
        icon={Users}
        title="Platform benchmark"
        showHeader
        contentClassName="flex-col justify-center p-3.5"
      >
        <p className="text-xs text-white/30">
          Benchmark data will appear once enough verified public accounts have at least{" "}
          {benchmarkData?.minTradesRequired ?? 25} closed trades.
        </p>
      </WidgetWrapper>
    );
  }

  const metrics = [
    {
      label: "Win rate",
      icon: Target,
      value: `${userStats.winRate.toFixed(1)}%`,
      ...getPercentile(metricBenchmarks.winRate.percentile),
    },
    {
      label: "Profit factor",
      icon: TrendingUp,
      value: userStats.profitFactor.toFixed(2),
      ...getPercentile(metricBenchmarks.profitFactor.percentile),
    },
    {
      label: "Avg RR",
      icon: BarChart3,
      value: userStats.avgRR.toFixed(2),
      ...getPercentile(metricBenchmarks.avgRR.percentile),
    },
    {
      label: "Consistency",
      icon: Shield,
      value: `${userStats.consistency.toFixed(0)}%`,
      ...getPercentile(metricBenchmarks.consistency.percentile),
    },
  ];

  return (
    <WidgetWrapper
      isEditing={isEditing}
      className={className}
      icon={Users}
      title="Platform benchmark"
      showHeader
      contentClassName="flex-col h-full min-h-0 p-3.5"
      headerRight={
        <span className="text-[10px] text-white/30 text-right">
          {populationSize} accounts
        </span>
      }
    >
      <div className="flex h-full min-h-0 flex-col overflow-y-auto">
        <p className="text-[10px] text-white/30">
          Anonymous percentile bands from verified public accounts. Your
          account: {userStats.totalTrades} trades.
        </p>

        <Separator className={WIDGET_CONTENT_SEPARATOR_CLASS} />

        <div className="flex flex-1 flex-col">
          {metrics.map((m, index) => (
            <Fragment key={m.label}>
              {index > 0 ? (
                <Separator className={WIDGET_CONTENT_SEPARATOR_CLASS} />
              ) : null}
              <div className="flex items-center gap-3 py-2.5">
                <m.icon className="size-3.5 shrink-0 text-white/25" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-white/75">{m.label}</p>
                      <span
                        className={cn(
                          TRADE_IDENTIFIER_PILL_CLASS,
                          "mt-1",
                          m.tone
                        )}
                      >
                        {m.bandLabel}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white/90">
                        {m.value}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </WidgetWrapper>
  );
}
