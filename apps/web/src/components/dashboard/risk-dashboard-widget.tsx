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
  Shield,
  TrendingDown,
  Percent,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Target,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { APP_RECHARTS_TOOLTIP_CONTENT_STYLE } from "@/components/ui/tooltip";
import { WidgetWrapper } from "./widget-wrapper";
import { formatSignedCurrency } from "./charts/dashboard-chart-ui";

const WIDGET_CONTENT_SEPARATOR_CLASS =
  "-mx-3.5 shrink-0 self-stretch";

export function RiskDashboardWidget({
  isEditing = false,
  className,
}: {
  isEditing?: boolean;
  className?: string;
}) {
  const accountId = useAccountStore((s) => s.selectedAccountId);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: riskData, isLoading: loadingRisk } =
    trpc.ai.getRiskOfRuin.useQuery(
      { accountId: accountId ?? "" },
      { enabled: !!accountId }
    );

  const { data: drawdownData } = trpc.ai.getDrawdownProfile.useQuery(
    { accountId: accountId ?? "" },
    { enabled: !!accountId }
  );

  const { data: positionData } = trpc.ai.getPositionSizing.useQuery(
    { accountId: accountId ?? "" },
    { enabled: !!accountId }
  );

  const {
    data: monteCarloData,
    isLoading: loadingMC,
    refetch: refetchMC,
  } = trpc.ai.runSimulation.useQuery(
    {
      accountId: accountId ?? "",
      simulations: 3000,
      tradeCount: 100,
    },
    { enabled: !!accountId && sheetOpen }
  );

  const ruin = riskData?.probabilityOfRuin ?? 0;
  const kellyCriterion = riskData?.kellyCriterion ?? 0;
  const halfKelly = riskData?.halfKelly ?? 0;
  const maxDD = drawdownData?.maxDrawdown ?? 0;
  const isInDrawdown = drawdownData?.isInDrawdown ?? false;
  const currentDD = drawdownData?.currentDrawdownPct ?? 0;

  // Risk level classification
  const riskLevel =
    ruin > 50
      ? "critical"
      : ruin > 20
      ? "warning"
      : ruin > 5
      ? "moderate"
      : "low";
  const riskConfig = {
    critical: { color: "text-red-400", bg: "bg-red-500/10", label: "Critical" },
    warning: {
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      label: "Elevated",
    },
    moderate: {
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
      label: "Moderate",
    },
    low: {
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      label: "Low Risk",
    },
  }[riskLevel];

  return (
    <>
      <WidgetWrapper
        isEditing={isEditing}
        className={className}
        icon={Shield}
        title="Risk intelligence"
        showHeader
        onClick={() => setSheetOpen(true)}
        contentClassName="flex-col justify-end p-3.5"
        headerRight={
          <span
            className={cn(
              "text-[10px] font-semibold px-2 py-1 rounded-sm",
              riskConfig.bg,
              riskConfig.color
            )}
          >
            {riskConfig.label}
          </span>
        }
      >
        {loadingRisk ? (
          <div className="space-y-2 flex-1">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <div className="flex h-full flex-col justify-end">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 pb-2">
              <div>
                <p className="text-[10px] uppercase text-white/40">
                  Ruin probability
                </p>
                <p
                  className={cn(
                    "text-xl font-bold",
                    ruin > 20
                      ? "text-rose-400"
                      : ruin > 5
                      ? "text-amber-400"
                      : "text-emerald-400"
                  )}
                >
                  {ruin.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-white/40">
                  Max drawdown
                </p>
                <p className="text-xl font-bold text-white/90">
                  {maxDD.toFixed(1)}%
                </p>
              </div>
            </div>

            <Separator className={WIDGET_CONTENT_SEPARATOR_CLASS} />

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 py-2">
              <div>
                <p className="text-[10px] uppercase text-white/40">
                  Kelly criterion
                </p>
                <p className="text-sm font-medium text-teal-400">
                  {kellyCriterion.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-white/40">
                  Half-Kelly
                </p>
                <p className="text-sm font-medium text-white/70">
                  {halfKelly.toFixed(1)}%
                </p>
              </div>
            </div>

            <Separator className={WIDGET_CONTENT_SEPARATOR_CLASS} />

            <div className="mt-auto flex items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-1.5 text-[10px]">
                {isInDrawdown ? (
                  <TrendingDown className="h-3 w-3 text-amber-400" />
                ) : (
                  <CheckCircle className="h-3 w-3 text-emerald-400" />
                )}
                <span
                  className={cn(
                    isInDrawdown ? "text-amber-400" : "text-white/50"
                  )}
                >
                  {isInDrawdown
                    ? "Currently in drawdown"
                    : "At equity peak"}
                </span>
              </div>
              <div className="text-right">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    isInDrawdown ? "text-amber-400" : "text-emerald-400"
                  )}
                >
                  {isInDrawdown ? `${currentDD.toFixed(1)}%` : "0.0%"}
                </p>
                <p className="text-[10px] text-white/30">
                  {isInDrawdown
                    ? `${formatSignedCurrency(
                        -(drawdownData?.currentDrawdownDollars ?? 0)
                      )} from peak`
                    : "No active drawdown"}
                </p>
              </div>
            </div>
          </div>
        )}
      </WidgetWrapper>

      {/* Full risk dashboard sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[500px] sm:w-[560px] bg-sidebar border-white/5 overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-teal-400" />
              Risk Intelligence Dashboard
            </SheetTitle>
            <SheetDescription className="text-xs">
              Monte Carlo simulation, drawdown analysis & position sizing
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 pb-6">
            {/* Risk of Ruin */}
            <div>
              <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-3">
                Risk of Ruin Analysis
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-white/3 p-3 text-center">
                  <p className="text-[10px] text-white/40 uppercase">
                    Ruin Prob.
                  </p>
                  <p className={cn("text-2xl font-bold", riskConfig.color)}>
                    {ruin.toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-lg bg-white/3 p-3 text-center">
                  <p className="text-[10px] text-white/40 uppercase">Kelly</p>
                  <p className="text-2xl font-bold text-teal-400">
                    {kellyCriterion.toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-lg bg-white/3 p-3 text-center">
                  <p className="text-[10px] text-white/40 uppercase">
                    Safe Risk
                  </p>
                  <p className="text-2xl font-bold text-white/90">
                    {(riskData?.safeRiskPerTrade ?? 0).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            <Separator className="bg-white/10" />

            {/* Drawdown Profile */}
            <div>
              <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-3">
                Drawdown Profile
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="rounded-lg bg-white/3 p-3">
                  <p className="text-[10px] text-white/40 uppercase">
                    Max Drawdown
                  </p>
                  <p className="text-xl font-bold text-rose-400">
                    {maxDD.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-white/30 mt-0.5">
                    ${(drawdownData?.maxDrawdownDollars ?? 0).toFixed(0)}
                  </p>
                </div>
                <div className="rounded-lg bg-white/3 p-3">
                  <p className="text-[10px] text-white/40 uppercase">
                    Avg Drawdown
                  </p>
                  <p className="text-xl font-bold text-white/70">
                    {(drawdownData?.avgDrawdown ?? 0).toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-white/30 mt-0.5">
                    Avg {(drawdownData?.avgRecoveryTrades ?? 0).toFixed(0)}{" "}
                    trades to recover
                  </p>
                </div>
              </div>

              {isInDrawdown && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <div>
                      <p className="text-sm font-medium text-amber-400">
                        Currently in drawdown
                      </p>
                      <p className="text-xs text-white/50">
                        {currentDD.toFixed(1)}% from peak ($
                        {(drawdownData?.currentDrawdownDollars ?? 0).toFixed(0)}
                        )
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator className="bg-white/10" />

            {/* Position Sizing Recommendations */}
            {positionData && positionData.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-3">
                  Position Sizing
                </h3>
                <div className="space-y-2">
                  {positionData.map((rec: any, i: number) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-lg border p-3",
                        i === 1
                          ? "border-teal-500/30 bg-teal-500/5"
                          : "border-white/5 bg-white/3"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium">{rec.method}</p>
                        <span
                          className={cn(
                            "text-sm font-bold",
                            i === 1 ? "text-teal-400" : "text-white/70"
                          )}
                        >
                          {rec.riskPerTrade.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-[10px] text-white/40">
                        {rec.rationale}
                      </p>
                      {i === 1 && (
                        <span className="inline-block mt-1.5 text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded-xs">
                          Recommended
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator className="bg-white/10" />

            {/* Monte Carlo */}
            <div>
              <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-3">
                Monte Carlo Simulation
              </h3>

              {loadingMC ? (
                <div className="space-y-2">
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : monteCarloData ? (
                <>
                  {/* Equity projection chart */}
                  <div className="h-48 w-full mb-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={monteCarloData.percentiles.p50.map(
                          (v: number, i: number) => ({
                            trade: i,
                            p5: monteCarloData.percentiles.p5[i],
                            p25: monteCarloData.percentiles.p25[i],
                            p50: v,
                            p75: monteCarloData.percentiles.p75[i],
                            p95: monteCarloData.percentiles.p95[i],
                          })
                        )}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(255,255,255,0.05)"
                        />
                        <XAxis
                          dataKey="trade"
                          tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                        />
                        <RechartsTooltip
                          contentStyle={APP_RECHARTS_TOOLTIP_CONTENT_STYLE}
                          formatter={(value: number) => [
                            `$${value.toFixed(0)}`,
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="p5"
                          stroke="none"
                          fill="rgba(251,113,133,0.1)"
                          fillOpacity={1}
                        />
                        <Area
                          type="monotone"
                          dataKey="p25"
                          stroke="none"
                          fill="rgba(251,189,35,0.1)"
                          fillOpacity={1}
                        />
                        <Area
                          type="monotone"
                          dataKey="p50"
                          stroke="#2dd4bf"
                          strokeWidth={2}
                          fill="rgba(45,212,191,0.1)"
                          fillOpacity={1}
                        />
                        <Area
                          type="monotone"
                          dataKey="p75"
                          stroke="none"
                          fill="rgba(45,212,191,0.05)"
                          fillOpacity={1}
                        />
                        <Area
                          type="monotone"
                          dataKey="p95"
                          stroke="none"
                          fill="rgba(45,212,191,0.03)"
                          fillOpacity={1}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* MC Probabilities */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-white/3 p-2.5">
                      <p className="text-[10px] text-white/40">Profitable</p>
                      <p className="text-sm font-bold text-emerald-400">
                        {monteCarloData.probabilities.profitableAfter.toFixed(
                          0
                        )}
                        %
                      </p>
                    </div>
                    <div className="rounded-lg bg-white/3 p-2.5">
                      <p className="text-[10px] text-white/40">
                        Double Account
                      </p>
                      <p className="text-sm font-bold text-teal-400">
                        {monteCarloData.probabilities.doubleAccount.toFixed(0)}%
                      </p>
                    </div>
                    <div className="rounded-lg bg-white/3 p-2.5">
                      <p className="text-[10px] text-white/40">DD {">"}20%</p>
                      <p className="text-sm font-bold text-amber-400">
                        {monteCarloData.probabilities.drawdownExceeds20.toFixed(
                          0
                        )}
                        %
                      </p>
                    </div>
                    <div className="rounded-lg bg-white/3 p-2.5">
                      <p className="text-[10px] text-white/40">DD {">"}50%</p>
                      <p className="text-sm font-bold text-rose-400">
                        {monteCarloData.probabilities.drawdownExceeds50.toFixed(
                          0
                        )}
                        %
                      </p>
                    </div>
                  </div>

                  {/* Final equity */}
                  <div className="mt-3 rounded-lg bg-white/3 p-3">
                    <p className="text-[10px] text-white/40 mb-1">
                      Median Final Equity (after {monteCarloData.tradeCount}{" "}
                      trades)
                    </p>
                    <p className="text-lg font-bold text-teal-400">
                      ${monteCarloData.finalEquity.p50.toFixed(0)}
                    </p>
                    <p className="text-[10px] text-white/30">
                      Range: ${monteCarloData.finalEquity.p5.toFixed(0)} — $
                      {monteCarloData.finalEquity.p95.toFixed(0)}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <BarChart3 className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-xs">Need 10+ trades for simulation</p>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
