"use client";

import { use } from "react";
import { trpc } from "@/utils/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Calendar,
  Target,
  Shield,
  Bell,
  ArrowLeft,
  Trophy,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { PropPhaseTimeline } from "@/components/prop-phase-timeline";
import {
  APP_RECHARTS_TOOLTIP_CONTENT_STYLE,
  APP_RECHARTS_TOOLTIP_LABEL_STYLE,
} from "@/components/ui/tooltip";

export default function PropTrackerPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const { data: dashboard, isLoading } = trpc.propFirms.getTrackerDashboard.useQuery({ accountId });
  const { data: probability } = trpc.propFirms.calculateProbability.useQuery({ accountId });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-muted-foreground">Loading tracker...</div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center">
        <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="mb-2 text-xl font-semibold">Account not found</h2>
        <p className="mb-4 text-muted-foreground">This account does not exist or is not a prop account</p>
        <Link href="/dashboard/accounts">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Accounts
          </Button>
        </Link>
      </div>
    );
  }

  const { account, propFirm, currentPhase, ruleCheck, alerts, snapshots, commandCenter } = dashboard;
  const survivalTone = getSurvivalTone(commandCenter?.survivalState);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/accounts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Prop Challenge Tracker</h1>
          <p className="text-muted-foreground">
            {propFirm?.displayName} - {account.name}
          </p>
        </div>
      </div>

      {/* Phase Timeline */}
      <PropPhaseTimeline accountId={accountId} />

      {/* Command Center */}
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="bg-sidebar border border-white/5 p-1 flex flex-col group">
          <div className="flex w-full gap-1.5 items-center p-3.5 widget-header justify-between">
            <div className="flex items-center gap-1.5">
              <Shield className="size-4 stroke-white/50 group-hover:stroke-white transition-all duration-250" />
              <h2 className="text-xs font-medium flex items-center gap-2 text-white/50 group-hover:text-white transition-all duration-250">
                <span>Command Center</span>
              </h2>
            </div>
            <Badge className={survivalTone.badge}>{survivalTone.label}</Badge>
          </div>

          <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-250 p-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <CommandMetricCard
                label="Target remaining"
                value={commandCenter?.targetRemainingPct ?? 0}
                suffix="%"
                hint="Profit still needed"
              />
              <CommandMetricCard
                label="Daily headroom"
                value={commandCenter?.dailyHeadroomPct ?? 0}
                suffix="%"
                hint="Before daily breach"
              />
              <CommandMetricCard
                label="Max-loss headroom"
                value={commandCenter?.maxHeadroomPct ?? 0}
                suffix="%"
                hint="Overall survival room"
              />
              <CommandMetricCard
                label="Required pace"
                value={commandCenter?.requiredDailyPacePct ?? 0}
                suffix="%/day"
                hint="Needed if you keep trading"
                muted={commandCenter?.requiredDailyPacePct == null}
              />
            </div>
          </div>
        </div>

        <div className="bg-sidebar border border-white/5 p-1 flex flex-col group">
          <div className="flex w-full gap-1.5 items-center p-3.5 widget-header">
            <Target className="size-4 stroke-white/50 group-hover:stroke-white transition-all duration-250" />
            <h2 className="text-xs font-medium flex items-center gap-2 text-white/50 group-hover:text-white transition-all duration-250">
              <span>Best Next Move</span>
            </h2>
          </div>

          <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-250 p-6">
            <div className="space-y-3">
              {(commandCenter?.nextActions || []).slice(0, 4).map((item: string, index: number) => (
                <div
                  key={`${item}-${index}`}
                  className="flex items-start gap-3 border border-white/5 bg-black/20 p-3"
                >
                  <span className="mt-0.5 text-xs font-semibold text-teal-300">
                    {index + 1}.
                  </span>
                  <p className="text-sm leading-6 text-white/75">{item}</p>
                </div>
              ))}
              {commandCenter?.minTradingDaysRemaining ? (
                <p className="text-xs text-white/40">
                  Remaining minimum-day requirement: {commandCenter.minTradingDaysRemaining} trading day(s).
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Hero Card - Current Phase Overview */}
      <div className="bg-sidebar border border-white/5 p-1 flex flex-col group">
        <div className="flex w-full gap-1.5 items-center p-3.5 widget-header">
          <Trophy className="size-4 stroke-white/50 group-hover:stroke-white fill-sidebar transition-all duration-250" />
          <h2 className="text-xs font-medium flex items-center gap-2 text-white/50 group-hover:text-white transition-all duration-250">
            <span>{currentPhase?.name || `Phase ${account.propCurrentPhase}`}</span>
          </h2>
          <div className="ml-auto">
            <Badge
              className={`${
                account.propPhaseStatus === "active"
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                  : account.propPhaseStatus === "passed"
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : "bg-red-500/20 text-red-400 border-red-500/30"
              } border`}
            >
              {account.propPhaseStatus?.toUpperCase()}
            </Badge>
          </div>
        </div>

        <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-250 p-6">
          <div className="grid gap-6 md:grid-cols-3 mb-6">
            <div className="flex flex-col">
              <div className="mb-2 text-xs text-white/40">Profit Target</div>
              <div className="text-2xl font-medium text-white">
                <AnimatedNumber
                  value={currentPhase?.profitTarget || 0}
                  format={(n) =>
                    currentPhase?.profitTargetType === "percentage"
                      ? `${n.toFixed(1)}%`
                      : `$${n.toLocaleString()}`
                  }
                  springOptions={{ bounce: 0, duration: 2000 }}
                />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="mb-2 text-xs text-white/40">Current Profit</div>
              <div
                className={`text-2xl font-medium ${
                  ruleCheck.metrics.currentProfitPercent >= 0 ? "text-teal-400" : "text-rose-400"
                }`}
              >
                <AnimatedNumber
                  value={ruleCheck.metrics.currentProfitPercent}
                  format={(n) => {
                    const sign = n >= 0 ? "+" : "";
                    return `${sign}${n.toFixed(2)}%`;
                  }}
                  springOptions={{ bounce: 0, duration: 2000 }}
                />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="mb-2 text-xs text-white/40">Days Remaining</div>
              <div className="text-2xl font-medium text-white">
                {ruleCheck.metrics.daysRemaining !== null
                  ? ruleCheck.metrics.daysRemaining
                  : "∞"}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-white/60">Progress to Target</span>
              <span className="font-semibold text-white">
                {Math.min(
                  ((ruleCheck.metrics.currentProfitPercent / (currentPhase?.profitTarget || 10)) * 100).toFixed(1),
                  100
                )}
                %
              </span>
            </div>
            <div className="h-2 w-full bg-sidebar rounded-none">
              <div
                className="h-2 bg-teal-400 transition-all"
                style={{
                  width: `${Math.min(
                    (ruleCheck.metrics.currentProfitPercent / (currentPhase?.profitTarget || 10)) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Rule Status Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Daily Loss */}
        <RuleCard
          title="Daily Loss"
          currentValue={ruleCheck.metrics.dailyDrawdownPercent}
          thresholdValue={currentPhase?.dailyLossLimit || 5}
          icon={<Shield className="h-5 w-5" />}
          type="loss"
          format="percentage"
        />

        {/* Max Loss */}
        <RuleCard
          title="Max Loss"
          currentValue={ruleCheck.metrics.maxDrawdownPercent}
          thresholdValue={currentPhase?.maxLoss || 10}
          icon={<AlertTriangle className="h-5 w-5" />}
          type="loss"
          format="percentage"
        />

        {/* Trading Days */}
        <RuleCard
          title="Trading Days"
          currentValue={ruleCheck.metrics.tradingDays}
          thresholdValue={currentPhase?.minTradingDays || 0}
          icon={<Calendar className="h-5 w-5" />}
          type="goal"
          format="number"
        />

        {/* Profit Target */}
        <RuleCard
          title="Profit Target"
          currentValue={ruleCheck.metrics.currentProfitPercent}
          thresholdValue={currentPhase?.profitTarget || 10}
          icon={<Target className="h-5 w-5" />}
          type="goal"
          format="percentage"
        />
      </div>

      {/* Probability Calculator & Alerts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Probability Card */}
        <div className="bg-sidebar border border-white/5 p-1 flex flex-col group">
          <div className="flex w-full gap-1.5 items-center p-3.5 widget-header">
            <BarChart3 className="size-4 stroke-white/50 group-hover:stroke-white transition-all duration-250" />
            <h2 className="text-xs font-medium flex items-center gap-2 text-white/50 group-hover:text-white transition-all duration-250">
              <span>Pass Probability</span>
            </h2>
          </div>

          <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-250 flex flex-col h-full w-full p-6">
            {probability ? (
              <div className="space-y-4">
                <div className="text-center">
                  <div
                    className={`text-4xl font-medium ${
                      probability.passPercentage >= 80
                        ? "text-teal-400"
                        : probability.passPercentage >= 50
                          ? "text-yellow-400"
                          : "text-rose-400"
                    }`}
                  >
                    <AnimatedNumber
                      value={probability.passPercentage}
                      format={(n) => `${n.toFixed(1)}%`}
                      springOptions={{ bounce: 0, duration: 2000 }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-white/40">Probability of Passing</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <div className="text-xs text-white/40">Est. Days to Target</div>
                    <div className="text-xl font-medium text-white">
                      {probability.daysToTarget !== null ? probability.daysToTarget : "N/A"}
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <div className="text-xs text-white/40">Risk of Failure</div>
                    <div className="text-xl font-medium text-rose-400">
                      <AnimatedNumber
                        value={probability.riskOfFailure}
                        format={(n) => `${n.toFixed(1)}%`}
                        springOptions={{ bounce: 0, duration: 2000 }}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-none bg-sidebar border border-white/5 p-3 text-xs text-white/60">
                  {probability.message}
                  {commandCenter?.requiredDailyPacePct != null ? (
                    <div className="mt-2 text-white/45">
                      Needed pace from here: {commandCenter.requiredDailyPacePct.toFixed(2)}% per remaining day.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-white/40">
                Not enough data to calculate probability
              </div>
            )}
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="bg-sidebar border border-white/5 p-1 flex flex-col group">
          <div className="flex w-full gap-1.5 items-center p-3.5 widget-header justify-between">
            <div className="flex items-center gap-1.5">
              <Bell className="size-4 stroke-white/50 group-hover:stroke-white transition-all duration-250" />
              <h2 className="text-xs font-medium flex items-center gap-2 text-white/50 group-hover:text-white transition-all duration-250">
                <span>Recent Alerts</span>
              </h2>
            </div>
            <Badge className="bg-sidebar-accent text-white/60 border-white/5">{alerts.length}</Badge>
          </div>

          <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-250 flex flex-col h-full w-full overflow-hidden">
            <div className="space-y-2 p-3.5 overflow-y-auto">
              {alerts.slice(0, 5).map((alert: any) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-2 border p-3 ${
                    alert.severity === "critical"
                      ? "border-rose-500/30 bg-rose-500/5"
                      : alert.severity === "warning"
                        ? "border-yellow-500/30 bg-yellow-500/5"
                        : "border-blue-500/30 bg-blue-500/5"
                  }`}
                >
                  {alert.severity === "critical" ? (
                    <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                  ) : alert.severity === "warning" ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
                  )}
                  <div className="flex-1">
                    <p className="text-xs font-medium text-white/80">{alert.message}</p>
                    <p className="text-[10px] text-white/40">
                      {new Date(alert.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}

              {alerts.length === 0 && (
                <div className="py-8 text-center text-xs text-white/40">
                  No alerts yet - keep trading!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Daily P&L Chart */}
        <div className="bg-sidebar border border-white/5 p-1 flex flex-col group">
          <div className="flex w-full gap-1.5 items-center p-3.5 widget-header">
            <BarChart3 className="size-4 stroke-white/50 group-hover:stroke-white transition-all duration-250" />
            <h2 className="text-xs font-medium flex items-center gap-2 text-white/50 group-hover:text-white transition-all duration-250">
              <span>Daily Profit/Loss</span>
            </h2>
          </div>

          <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-250 flex flex-col h-full w-full p-4">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={snapshots.slice().reverse()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#888" }} />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} />
                <Tooltip
                  contentStyle={APP_RECHARTS_TOOLTIP_CONTENT_STYLE}
                  labelStyle={APP_RECHARTS_TOOLTIP_LABEL_STYLE}
                />
                <Area
                  type="monotone"
                  dataKey="dailyProfitPercent"
                  stroke="#2dd4bf"
                  fill="#2dd4bf"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cumulative P&L Chart */}
        <div className="bg-sidebar border border-white/5 p-1 flex flex-col group">
          <div className="flex w-full gap-1.5 items-center p-3.5 widget-header">
            <TrendingUp className="size-4 stroke-white/50 group-hover:stroke-white transition-all duration-250" />
            <h2 className="text-xs font-medium flex items-center gap-2 text-white/50 group-hover:text-white transition-all duration-250">
              <span>Cumulative Profit</span>
            </h2>
          </div>

          <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-250 flex flex-col h-full w-full p-4">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={snapshots.slice().reverse()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#888" }} />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} />
                <Tooltip
                  contentStyle={APP_RECHARTS_TOOLTIP_CONTENT_STYLE}
                  labelStyle={APP_RECHARTS_TOOLTIP_LABEL_STYLE}
                />
                <Line type="monotone" dataKey="endingBalance" stroke="#2dd4bf" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function getSurvivalTone(state?: string) {
  switch (state) {
    case "critical":
      return {
        label: "Critical",
        badge: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
      };
    case "fragile":
      return {
        label: "Fragile",
        badge: "bg-orange-500/20 text-orange-300 border border-orange-500/30",
      };
    case "tight":
      return {
        label: "Tight",
        badge: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
      };
    default:
      return {
        label: "Stable",
        badge: "bg-teal-500/20 text-teal-300 border border-teal-500/30",
      };
  }
}

function CommandMetricCard({
  label,
  value,
  suffix,
  hint,
  muted,
}: {
  label: string;
  value: number;
  suffix: string;
  hint: string;
  muted?: boolean;
}) {
  return (
    <div className="border border-white/5 bg-black/20 p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-medium ${muted ? "text-white/40" : "text-white"}`}>
        {muted ? "N/A" : `${value.toFixed(2)}${suffix}`}
      </div>
      <div className="mt-2 text-xs text-white/45">{hint}</div>
    </div>
  );
}

function RuleCard({
  title,
  currentValue,
  thresholdValue,
  icon,
  type,
  format,
}: {
  title: string;
  currentValue: number;
  thresholdValue: number;
  icon: React.ReactNode;
  type: "loss" | "goal";
  format: "percentage" | "number";
}) {
  // Calculate status
  const percentage = (currentValue / thresholdValue) * 100;
  let status: "safe" | "warning" | "danger" = "safe";

  if (type === "loss") {
    if (percentage >= 100) status = "danger";
    else if (percentage >= 80) status = "warning";
  } else {
    if (percentage >= 100) status = "safe";
    else if (percentage >= 90) status = "warning";
    else status = "danger";
  }

  const statusColors = {
    safe: "border-teal-500/30 bg-teal-500/5",
    warning: "border-yellow-500/30 bg-yellow-500/5",
    danger: "border-rose-500/30 bg-rose-500/5",
  };

  const statusIcons = {
    safe: <CheckCircle2 className="h-4 w-4 text-teal-400" />,
    warning: <AlertTriangle className="h-4 w-4 text-yellow-400" />,
    danger: <AlertCircle className="h-4 w-4 text-rose-400" />,
  };

  const progressColors = {
    safe: "bg-teal-400",
    warning: "bg-yellow-400",
    danger: "bg-rose-400",
  };

  return (
    <div className={`bg-sidebar border border-white/5 p-1 flex flex-col group ${statusColors[status]}`}>
      <div className="flex w-full gap-1.5 items-center p-3.5 widget-header justify-between">
        <div className="flex items-center gap-1.5">
          {icon}
          <h2 className="text-xs font-medium flex items-center gap-2 text-white/50 group-hover:text-white transition-all duration-250">
            <span>{title}</span>
          </h2>
        </div>
        {statusIcons[status]}
      </div>

      <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-250 flex flex-col justify-between h-full w-full p-3.5">
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-white/40">Current</span>
            <span className="text-xl font-medium text-white">
              <AnimatedNumber
                value={currentValue}
                format={(n) =>
                  format === "percentage" ? `${n.toFixed(2)}%` : n.toFixed(0)
                }
                springOptions={{ bounce: 0, duration: 2000 }}
              />
            </span>
          </div>

          <div className="flex items-baseline justify-between text-xs">
            <span className="text-white/40">Limit</span>
            <span className="font-medium text-white/60">
              {format === "percentage" ? `${thresholdValue}%` : thresholdValue}
            </span>
          </div>

          <div className="h-2 w-full bg-sidebar rounded-none">
            <div
              className={`h-2 transition-all ${progressColors[status]}`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
