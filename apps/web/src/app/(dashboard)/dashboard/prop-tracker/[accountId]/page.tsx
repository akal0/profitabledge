"use client";

import {
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import confetti from "canvas-confetti";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Shield,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import PickerComponent from "@/components/dashboard/calendar/picker";
import { WidgetWrapper } from "@/components/dashboard/widget-wrapper";
import { PropPhaseTimeline } from "@/components/prop-phase-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator, VerticalSeparator } from "@/components/ui/separator";
import { countRangeDays } from "@/components/dashboard/chart-comparison-utils";
import { WIDGET_CONTENT_SEPARATOR_CLASS } from "@/features/dashboard/widgets/lib/widget-shared";
import {
  DailyNetCard,
  DrawdownChartCard,
  EquityCurveCard,
} from "@/features/dashboard/charts/components/comparison-chart-cards";
import { cn } from "@/lib/utils";
import { useDateRangeStore } from "@/stores/date-range";
import { trpc } from "@/utils/trpc";

type MetricMode = "currency" | "percent";
type SurvivalState = "critical" | "fragile" | "tight" | "stable";
type PropFirmLike = {
  id?: string | null;
  displayName?: string | null;
};

const HEADER_BADGE_CLASS = "h-7 rounded-sm px-1.5 text-[10px] font-medium";
const FTMO_PROP_FIRM_ID = "ftmo";
const FTMO_IMAGE_SRC = "/brokers/FTMO.png";
const GOALS_SURFACE_OUTER_CLASS =
  "group flex flex-col rounded-sm border border-white/5 bg-sidebar p-1.5";
const GOALS_SURFACE_INNER_CLASS =
  "flex flex-1 flex-col rounded-sm bg-sidebar-accent transition-all duration-250 group-hover:brightness-120";
const GOALS_PANEL_BODY_CLASS = "px-4 py-4 sm:px-5 sm:py-5";
const PANEL_ROW_PADDING_CLASS = "px-4 py-2.5 sm:px-5 sm:py-3";
const CHART_ACTION_GROUP_CLASS =
  "flex items-center overflow-hidden rounded-sm border border-white/5 bg-sidebar";
const CHART_ACTION_GROUP_BUTTON_CLASS =
  "h-[38px] rounded-none border-0 bg-sidebar px-3 py-2 text-xs text-white transition-colors hover:bg-sidebar-accent disabled:cursor-not-allowed disabled:text-white/25 disabled:hover:bg-sidebar";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addMonths(date: Date, value: number) {
  return new Date(date.getFullYear(), date.getMonth() + value, 1);
}

function clampRangeToBounds(
  range: { start: Date; end: Date },
  bounds: { min: Date; max: Date }
) {
  const nextStart = new Date(range.start);
  const nextEnd = new Date(range.end);

  if (nextStart < bounds.min) {
    nextStart.setTime(bounds.min.getTime());
  }

  if (nextEnd > bounds.max) {
    nextEnd.setTime(bounds.max.getTime());
  }

  return { start: nextStart, end: nextEnd };
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatUsd(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function formatMetricValue(
  value: number | null | undefined,
  mode: MetricMode,
  fallback = "—"
) {
  if (value == null || Number.isNaN(value)) return fallback;
  return mode === "currency" ? formatUsd(value) : `${value.toFixed(2)}%`;
}

function formatSignedMetricValue(
  value: number | null | undefined,
  mode: MetricMode,
  fallback = "—"
) {
  if (value == null || Number.isNaN(value)) return fallback;
  if (mode === "currency") {
    const abs = Math.abs(value);
    return `${value >= 0 ? "+" : "-"}${formatUsd(abs)}`;
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getMetricMode(currentPhase: any): MetricMode {
  return currentPhase?.profitTargetType === "absolute" ? "currency" : "percent";
}

function getPropStatusAppearance(status: string | null | undefined) {
  switch (status) {
    case "active":
      return {
        label: "Active",
        className: "border-blue-500/30 bg-blue-500/15 text-blue-400",
      };
    case "passed":
      return {
        label: "Passed",
        className: "border-teal-500/30 bg-teal-500/15 text-teal-400",
      };
    case "failed":
      return {
        label: "Failed",
        className: "border-red-500/30 bg-red-500/15 text-red-400",
      };
    case "paused":
      return {
        label: "Paused",
        className: "border-white/10 bg-sidebar text-white/50",
      };
    default:
      return {
        label: "Unknown",
        className: "border-white/10 bg-black/10 text-white/50 dark:bg-sidebar",
      };
  }
}

function getSurvivalTone(state?: string | null) {
  switch (state) {
    case "critical":
      return {
        label: "Critical",
        badge: "border-rose-500/30 bg-rose-500/15 text-rose-300",
      };
    case "fragile":
      return {
        label: "Fragile",
        badge: "border-amber-500/30 bg-amber-500/15 text-amber-300",
      };
    case "tight":
      return {
        label: "Tight",
        badge: "border-yellow-500/30 bg-yellow-500/15 text-yellow-300",
      };
    default:
      return {
        label: "Stable",
        badge: "border-teal-500/30 bg-teal-500/15 text-teal-300",
      };
  }
}

function isFtmoFirm(firm?: PropFirmLike | null) {
  const id = String(firm?.id || "").toLowerCase();
  const displayName = String(firm?.displayName || "").toLowerCase();
  return id === FTMO_PROP_FIRM_ID || displayName === "ftmo";
}

function PropFirmAvatar({
  firm,
  className,
}: {
  firm?: PropFirmLike | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-sm border border-white/10 bg-white/[0.04]",
        className
      )}
    >
      {isFtmoFirm(firm) ? (
        <Image
          src={FTMO_IMAGE_SRC}
          alt="FTMO"
          fill
          sizes="64px"
          className="object-contain p-2"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Trophy className="size-5 text-white/55" />
        </div>
      )}
    </div>
  );
}

function OverviewStatCard({
  icon: Icon,
  label,
  value,
  hint,
  iconClassName,
  valueClassName,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  iconClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div className={GOALS_SURFACE_OUTER_CLASS}>
      <div className={cn(GOALS_SURFACE_INNER_CLASS, "p-4")}>
        <div className="mb-2 flex items-center gap-3">
          <Icon className={cn("h-4 w-4 text-white/60", iconClassName)} />
          <span className="text-xs text-white/50">{label}</span>
        </div>
        <div
          className={cn("text-2xl font-semibold text-white", valueClassName)}
        >
          {value}
        </div>
        <p className="mt-1 text-sm text-white/40">{hint}</p>
      </div>
    </div>
  );
}

function OverviewPanel({
  icon: Icon,
  title,
  description,
  badge,
  bodyClassName,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={GOALS_SURFACE_OUTER_CLASS}>
      <div className={cn(GOALS_SURFACE_INNER_CLASS, "h-full")}>
        <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-sm border border-white/5 bg-sidebar p-2">
              <Icon className="h-4 w-4 text-white/60" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">{title}</h2>
              <p className="mt-0.5 text-xs text-white/40">{description}</p>
            </div>
          </div>
          {badge ? <div className="shrink-0">{badge}</div> : null}
        </div>
        <Separator />
        <div
          className={cn(
            "flex-1 overflow-hidden",
            GOALS_PANEL_BODY_CLASS,
            bodyClassName
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function ColumnMetric({
  label,
  value,
  hint,
  valueClassName,
}: {
  label: string;
  value: string;
  hint: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-2 text-center md:py-5">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/30">
        {label}
      </p>
      <p
        className={cn("mt-2 text-xl font-semibold text-white", valueClassName)}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-white/40">{hint}</p>
    </div>
  );
}

function PassedMetricCheck() {
  return (
    <div className="mt-2 flex flex-col items-center">
      <div className="flex size-9 items-center justify-center rounded-full border-2 border-emerald-400 bg-emerald-400/10">
        <CheckCircle2 className="size-4 text-emerald-400" />
      </div>
      <p className="mt-1 text-[9px] text-emerald-400/70">Passed</p>
    </div>
  );
}

function RuleWatchMetric({
  label,
  current,
  threshold,
  hint,
  status,
  currentClassName,
  completed = false,
}: {
  label: string;
  current: string;
  threshold: string;
  hint: string;
  status: "safe" | "warning" | "danger";
  currentClassName?: string;
  completed?: boolean;
}) {
  const statusClassName =
    status === "danger"
      ? "text-rose-300"
      : status === "warning"
      ? "text-amber-300"
      : "text-teal-300";

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-2 text-center md:py-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
        {label}
      </p>
      {completed ? (
        <PassedMetricCheck />
      ) : (
        <p
          className={cn(
            "mt-2 text-xl font-semibold",
            currentClassName ?? statusClassName
          )}
        >
          {current}
        </p>
      )}
    </div>
  );
}

function NextActionRow({
  text,
  survivalState,
}: {
  text: string;
  survivalState: SurvivalState;
}) {
  const tone = getSurvivalTone(survivalState);

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 transition-colors hover:bg-sidebar",
        PANEL_ROW_PADDING_CLASS
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "size-1.5 rounded-full",
              survivalState === "critical"
                ? "bg-rose-400"
                : survivalState === "fragile"
                ? "bg-amber-300"
                : survivalState === "tight"
                ? "bg-yellow-300"
                : "bg-teal-400"
            )}
          />
          <p className="text-xs font-medium text-white">{tone.label}</p>
        </div>
        <p className="mt-1 pl-4 text-xs leading-relaxed text-white/65">
          {text}
        </p>
      </div>
    </div>
  );
}

function AlertRow({ alert }: { alert: any }) {
  const icon =
    alert.severity === "critical" ? (
      <AlertCircle className="size-3.5 text-rose-400" />
    ) : alert.severity === "warning" ? (
      <AlertTriangle className="size-3.5 text-amber-300" />
    ) : (
      <Trophy className="size-3.5 text-blue-400" />
    );

  const badgeClassName =
    alert.severity === "critical"
      ? "border-rose-500/30 bg-rose-500/15 text-rose-300"
      : alert.severity === "warning"
      ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
      : "border-blue-500/30 bg-blue-500/15 text-blue-300";

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 transition-colors hover:bg-sidebar",
        PANEL_ROW_PADDING_CLASS
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="pt-0.5">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-medium leading-relaxed text-white/80">
            {alert.message}
          </p>
          <p className="mt-1 text-[10px] text-white/35">
            {new Date(alert.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <Badge
        variant="outline"
        className={cn(HEADER_BADGE_CLASS, badgeClassName)}
      >
        {alert.severity}
      </Badge>
    </div>
  );
}

function DetailLoadingState() {
  return (
    <main className="space-y-6 p-6 py-4">
      <div className="flex items-center gap-3">
        <div className="h-8 w-20 animate-pulse rounded-sm border border-white/5 bg-sidebar" />
        <div className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded-sm bg-sidebar" />
          <div className="h-6 w-44 animate-pulse rounded-sm bg-sidebar" />
        </div>
      </div>

      <div className="rounded-sm border border-white/5 bg-sidebar p-1.5">
        <div className="h-64 animate-pulse rounded-sm bg-sidebar-accent" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((key) => (
          <div
            key={key}
            className="rounded-sm border border-white/5 bg-sidebar p-1.5"
          >
            <div className="h-28 animate-pulse rounded-sm bg-sidebar-accent" />
          </div>
        ))}
      </div>
    </main>
  );
}

export default function PropTrackerPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const [alertsPage, setAlertsPage] = useState(1);
  const fundedConfettiAccountRef = useRef<string | null>(null);
  const chartRangeStart = useDateRangeStore((state) => state.start);
  const chartRangeEnd = useDateRangeStore((state) => state.end);
  const setChartRange = useDateRangeStore((state) => state.setRange);
  const setChartBounds = useDateRangeStore((state) => state.setBounds);
  const { data: dashboard, isLoading } =
    trpc.propFirms.getTrackerDashboard.useQuery({ accountId });
  const { data: probability } = trpc.propFirms.calculateProbability.useQuery({
    accountId,
  });
  const { data: chartBounds, isLoading: chartBoundsLoading } =
    trpc.accounts.opensBounds.useQuery(
      { accountId },
      {
        enabled: Boolean(accountId),
      }
    );
  const { data: alertsPagination } = trpc.propFirms.getAlerts.useQuery({
    accountId,
    page: alertsPage,
    pageSize: 5,
  });

  const chartBoundsRange = useMemo(() => {
    if (!chartBounds?.minISO || !chartBounds?.maxISO) return null;
    return {
      min: new Date(chartBounds.minISO),
      max: new Date(chartBounds.maxISO),
    };
  }, [chartBounds?.maxISO, chartBounds?.minISO]);

  const resolvedChartRange = useMemo(() => {
    if (chartRangeStart && chartRangeEnd) {
      const selectedRange = {
        start: new Date(chartRangeStart),
        end: new Date(chartRangeEnd),
      };

      return chartBoundsRange
        ? clampRangeToBounds(selectedRange, chartBoundsRange)
        : selectedRange;
    }

    if (!chartBoundsRange) return null;

    const fallbackEnd = new Date(chartBoundsRange.max);
    const fallbackStart = new Date(chartBoundsRange.max);
    fallbackStart.setDate(fallbackStart.getDate() - 29);

    return {
      start:
        fallbackStart < chartBoundsRange.min
          ? new Date(chartBoundsRange.min)
          : fallbackStart,
      end: fallbackEnd,
    };
  }, [chartBoundsRange, chartRangeEnd, chartRangeStart]);

  const availableChartDays = useMemo(() => {
    if (!chartBoundsRange) return 1;
    return countRangeDays({
      start: chartBoundsRange.min,
      end: chartBoundsRange.max,
    });
  }, [chartBoundsRange]);

  const activeChartMonthStart = useMemo(
    () => (resolvedChartRange ? startOfMonth(resolvedChartRange.start) : null),
    [resolvedChartRange]
  );

  const activeChartMonthLabel = useMemo(() => {
    if (!activeChartMonthStart) return "";
    return activeChartMonthStart.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, [activeChartMonthStart]);

  const canNavigateChartPrevious = useMemo(() => {
    if (!activeChartMonthStart || !chartBoundsRange) return false;
    return (
      activeChartMonthStart.getTime() >
      startOfMonth(chartBoundsRange.min).getTime()
    );
  }, [activeChartMonthStart, chartBoundsRange]);

  const canNavigateChartNext = useMemo(() => {
    if (!activeChartMonthStart || !chartBoundsRange) return false;
    return (
      activeChartMonthStart.getTime() <
      startOfMonth(chartBoundsRange.max).getTime()
    );
  }, [activeChartMonthStart, chartBoundsRange]);

  useEffect(() => {
    setAlertsPage(1);
  }, [accountId]);

  useEffect(() => {
    if (!chartBoundsRange) return;

    setChartBounds(chartBoundsRange.min, chartBoundsRange.max);

    const fallbackEnd = new Date(chartBoundsRange.max);
    const fallbackStart = new Date(chartBoundsRange.max);
    fallbackStart.setDate(fallbackStart.getDate() - 29);

    const nextRange = clampRangeToBounds(
      {
        start:
          fallbackStart < chartBoundsRange.min
            ? new Date(chartBoundsRange.min)
            : fallbackStart,
        end: fallbackEnd,
      },
      chartBoundsRange
    );

    setChartRange(nextRange.start, nextRange.end);
  }, [accountId, chartBoundsRange, setChartBounds, setChartRange]);

  useEffect(() => {
    if (dashboard?.account?.propCurrentPhase !== 0 || !dashboard.account?.id) {
      return;
    }

    if (fundedConfettiAccountRef.current === dashboard.account.id) {
      return;
    }

    fundedConfettiAccountRef.current = dashboard.account.id;
    const duration = 2200;
    const end = Date.now() + duration;
    const colors = ["#fbbf24", "#f59e0b", "#fde68a", "#ffffff"];

    (function frame() {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 70,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 70,
        origin: { x: 1 },
        colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }, [dashboard?.account?.id, dashboard?.account?.propCurrentPhase]);

  const applyChartRange = (nextStart: Date, nextEnd: Date) => {
    setChartRange(nextStart, nextEnd);
  };

  const handleChartMonthStep = (direction: -1 | 1) => {
    if (!activeChartMonthStart || !chartBoundsRange) return;

    const nextMonth = addMonths(activeChartMonthStart, direction);
    const nextRange = clampRangeToBounds(
      {
        start: startOfMonth(nextMonth),
        end: endOfMonth(nextMonth),
      },
      chartBoundsRange
    );

    applyChartRange(nextRange.start, nextRange.end);
  };

  if (isLoading) {
    return <DetailLoadingState />;
  }

  if (!dashboard) {
    return (
      <main className="space-y-6 p-6 py-4">
        <div className={GOALS_SURFACE_OUTER_CLASS}>
          <div
            className={cn(
              GOALS_SURFACE_INNER_CLASS,
              "min-h-[320px] items-center justify-center px-8 py-10 text-center"
            )}
          >
            <AlertCircle className="mb-4 size-10 text-white/20" />
            <h2 className="text-lg font-semibold text-white">
              Prop account not found
            </h2>
            <p className="mt-2 max-w-md text-sm text-white/40">
              This account is unavailable or is no longer marked as a prop
              account.
            </p>
            <Link href="/dashboard/prop-tracker" className="mt-6">
              <Button className="h-9 rounded-sm border border-white/5 bg-sidebar px-4 text-xs text-white hover:bg-sidebar-accent hover:brightness-110">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Back to tracker
              </Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { account, propFirm, currentPhase, ruleCheck, alerts, commandCenter } =
    dashboard;
  const effectivePhaseStatus =
    dashboard.effectivePhaseStatus ||
    ruleCheck.phaseStatus ||
    account.propPhaseStatus ||
    "active";
  const isFunded = account.propCurrentPhase === 0;
  const statusInfo = isFunded
    ? {
        label: "Funded",
        className: "border-amber-400/25 bg-amber-400/10 text-amber-200",
      }
    : getPropStatusAppearance(effectivePhaseStatus);
  const survivalTone = getSurvivalTone(commandCenter?.survivalState);
  const metricMode = getMetricMode(currentPhase);
  const currentBalance = toNumber(
    ruleCheck.metrics.currentBalance,
    toNumber(account.liveBalance, toNumber(account.initialBalance))
  );
  const currentEquity = toNumber(
    ruleCheck.metrics.currentEquity,
    toNumber(account.liveEquity, currentBalance)
  );
  const currentResult =
    metricMode === "currency"
      ? toNumber(ruleCheck.metrics.currentProfit)
      : toNumber(ruleCheck.metrics.currentProfitPercent);
  const dailyDrawdown =
    metricMode === "currency"
      ? toNumber(ruleCheck.metrics.dailyDrawdown)
      : toNumber(ruleCheck.metrics.dailyDrawdownPercent);
  const maxDrawdown =
    metricMode === "currency"
      ? toNumber(ruleCheck.metrics.maxDrawdown)
      : toNumber(ruleCheck.metrics.maxDrawdownPercent);
  const targetValue =
    currentPhase?.profitTarget != null
      ? toNumber(currentPhase.profitTarget)
      : null;
  const dailyLossLimit =
    currentPhase?.dailyLossLimit != null
      ? toNumber(currentPhase.dailyLossLimit)
      : null;
  const maxLossLimit =
    currentPhase?.maxLoss != null ? toNumber(currentPhase.maxLoss) : null;
  const targetRemaining =
    targetValue != null ? Math.max(0, targetValue - currentResult) : null;
  const dailyHeadroom =
    dailyLossLimit != null ? Math.max(0, dailyLossLimit - dailyDrawdown) : null;
  const maxHeadroom =
    maxLossLimit != null ? Math.max(0, maxLossLimit - maxDrawdown) : null;
  const requiredDailyPace =
    ruleCheck.metrics.daysRemaining != null &&
    ruleCheck.metrics.daysRemaining > 0 &&
    targetRemaining != null
      ? targetRemaining / ruleCheck.metrics.daysRemaining
      : null;
  const minTradingDays = toNumber(currentPhase?.minTradingDays);
  const phaseLabel =
    account.propCurrentPhase === 0
      ? "Funded"
      : currentPhase?.name || `Phase ${account.propCurrentPhase ?? 1}`;
  const paginatedAlerts = alertsPagination?.items ?? alerts.slice(0, 5);
  const totalAlertCount = alertsPagination?.totalCount ?? alerts.length;
  const totalAlertPages = alertsPagination?.totalPages ?? 1;
  const probabilityValue = probability?.passPercentage ?? 0;
  const probabilityTone =
    probabilityValue >= 80
      ? "text-teal-400"
      : probabilityValue >= 50
      ? "text-amber-300"
      : "text-rose-400";

  const ruleWatch = [
    {
      label: "Daily DD",
      current: formatMetricValue(dailyDrawdown, metricMode),
      threshold: formatMetricValue(dailyLossLimit, metricMode),
      hint: "Current-day drawdown vs allowed limit",
      completed: isFunded,
      status:
        dailyLossLimit != null && dailyDrawdown >= dailyLossLimit
          ? ("danger" as const)
          : dailyLossLimit != null && dailyDrawdown >= dailyLossLimit * 0.8
          ? ("warning" as const)
          : ("safe" as const),
    },
    {
      label: "Max DD",
      current: formatMetricValue(maxDrawdown, metricMode),
      threshold: formatMetricValue(maxLossLimit, metricMode),
      hint: "Live phase drawdown vs challenge ceiling",
      currentClassName: maxDrawdown >= 0 ? "text-teal-300" : "text-rose-300",
      completed: isFunded,
      status:
        maxLossLimit != null && maxDrawdown >= maxLossLimit
          ? ("danger" as const)
          : maxLossLimit != null && maxDrawdown >= maxLossLimit * 0.8
          ? ("warning" as const)
          : ("safe" as const),
    },
    {
      label: "Trading Days",
      current: String(ruleCheck.metrics.tradingDays),
      threshold: minTradingDays > 0 ? String(minTradingDays) : "None",
      hint: "Distinct trading days counted from phase trades",
      completed: isFunded,
      status:
        minTradingDays > 0 && ruleCheck.metrics.tradingDays < minTradingDays
          ? ("warning" as const)
          : ("safe" as const),
    },
    {
      label: "Target",
      current: formatSignedMetricValue(currentResult, metricMode),
      threshold: formatMetricValue(targetValue, metricMode),
      hint: "Phase target checked against live evaluated profit",
      currentClassName: currentResult >= 0 ? "text-rose-300" : "text-teal-300",
      completed: isFunded,
      status:
        targetValue != null && currentResult >= targetValue
          ? ("safe" as const)
          : targetValue != null && currentResult >= targetValue * 0.9
          ? ("warning" as const)
          : ("danger" as const),
    },
  ];

  return (
    <main className="space-y-6 p-6 py-4">
      {isFunded ? (
        <div className={GOALS_SURFACE_OUTER_CLASS}>
          <div className="flex items-center justify-between gap-4 rounded-sm border border-amber-400/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.18),rgba(245,158,11,0.08))] px-4 py-3 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="rounded-sm border border-amber-300/20 bg-amber-300/10 p-2">
                <Trophy className="h-4 w-4 text-amber-200" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-50">
                  Funded stage reached
                </p>
                <p className="mt-0.5 text-xs text-amber-100/70">
                  This prop account has cleared the challenge ladder and is now
                  tracked as funded.
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className="h-7 rounded-sm border-amber-300/25 bg-amber-300/10 px-1.5 text-[10px] text-amber-100"
            >
              Passed
            </Badge>
          </div>
        </div>
      ) : null}

      <WidgetWrapper
        icon={Trophy}
        title={propFirm?.displayName || "Prop firm"}
        headerRight={
          <Badge
            variant="outline"
            className={cn(HEADER_BADGE_CLASS, statusInfo.className)}
          >
            {statusInfo.label}
          </Badge>
        }
        showHeader
        className="h-auto"
        contentClassName="h-auto flex-col justify-between p-6 py-3.5"
      >
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <PropFirmAvatar
              firm={propFirm}
              className="size-12 shrink-0 rounded-full!"
            />
            <div>
              <p className="text-sm font-semibold text-white">
                {propFirm?.displayName || "Prop firm"}
              </p>
              <p className="mt-0.5 text-xs font-medium text-white/50">
                {account.name}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div>
              <p className="text-white/45 text-xs"> Account balance </p>
              <p className=" text-lg font-semibold text-teal-400">
                {formatUsd(currentBalance)}
              </p>
            </div>
          </div>
        </div>

        <Separator
          className={cn(WIDGET_CONTENT_SEPARATOR_CLASS, "my-5 -mx-6!")}
        />

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mt-1 text-sm font-semibold text-white">
              {phaseLabel}
            </p>
            <p className="mt-1 text-xs text-white/45">
              {isFunded
                ? "Challenge target cleared. Live performance is now measured from the funded start."
                : metricMode === "currency"
                ? "Absolute challenge thresholds"
                : "Percentage challenge thresholds"}
            </p>
          </div>
          <div className="text-right">
            {isFunded ? (
              <div className="flex flex-col items-end">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1">
                  <CheckCircle2 className="size-3 text-emerald-400" />
                  <span className="text-[11px] font-medium text-emerald-300">
                    In profit
                  </span>
                </div>
                <p
                  className={cn(
                    "mt-1 text-base font-semibold",
                    currentResult >= 0 ? "text-teal-400" : "text-rose-400"
                  )}
                >
                  {formatSignedMetricValue(currentResult, metricMode)}
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-white/35">Current result</p>
                <p
                  className={cn(
                    "mt-1 text-lg font-semibold",
                    currentResult >= 0 ? "text-teal-400" : "text-rose-400"
                  )}
                >
                  {formatSignedMetricValue(currentResult, metricMode)}
                </p>
              </>
            )}
          </div>
        </div>

        <Separator
          className={cn(WIDGET_CONTENT_SEPARATOR_CLASS, "my-5 -mx-6!")}
        />

        <div className="flex flex-wrap items-start justify-between gap-y-4 pb-4">
          <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
            <p className="text-xs text-white/35">Trading days</p>
            {isFunded ? (
              <PassedMetricCheck />
            ) : (
              <p className="mt-1 text-sm font-semibold text-white/85">
                {ruleCheck.metrics.tradingDays}
                {minTradingDays > 0 ? ` / ${minTradingDays}` : ""}
              </p>
            )}
          </div>

          <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
            <p className="text-xs text-white/35">Daily DD</p>
            {isFunded ? (
              <PassedMetricCheck />
            ) : (
              <p className="mt-1 text-sm font-semibold text-white/85">
                {formatMetricValue(dailyDrawdown, metricMode)}
              </p>
            )}
          </div>

          <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
            <p className="text-xs text-white/35">Max DD</p>
            {isFunded ? (
              <PassedMetricCheck />
            ) : (
              <p className="mt-1 text-sm font-semibold text-white/85">
                {formatMetricValue(maxDrawdown, metricMode)}
              </p>
            )}
          </div>

          <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
            <p className="text-xs text-white/35">Target</p>
            {isFunded ? (
              <PassedMetricCheck />
            ) : (
              <p className="mt-1 text-sm font-semibold text-white/85">
                {formatMetricValue(targetValue, metricMode)}
              </p>
            )}
          </div>
        </div>
      </WidgetWrapper>

      <PropPhaseTimeline
        accountId={accountId}
        className="rounded-sm border-white/5"
      />

      {/* <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewStatCard
          icon={Target}
          label="Target remaining"
          value={formatMetricValue(targetRemaining, metricMode)}
          hint="Still needed to clear this phase"
          iconClassName="text-amber-300"
        />
        <OverviewStatCard
          icon={Calendar}
          label="Days remaining"
          value={
            ruleCheck.metrics.daysRemaining != null
              ? `${ruleCheck.metrics.daysRemaining}`
              : "∞"
          }
          hint="Time left in the current phase"
          iconClassName="text-blue-400"
        />
        <OverviewStatCard
          icon={Shield}
          label="Daily headroom"
          value={formatMetricValue(dailyHeadroom, metricMode)}
          hint="Room before a daily breach"
          iconClassName="text-teal-400"
        />
        <OverviewStatCard
          icon={AlertTriangle}
          label="Max headroom"
          value={formatMetricValue(maxHeadroom, metricMode)}
          hint="Overall survival room left"
          iconClassName="text-rose-300"
        />
        </section> */}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <OverviewPanel
          icon={Shield}
          title="Portfolio command center"
          description="Live challenge state derived from trades, equity, and rule thresholds"
          badge={
            <Badge
              variant="outline"
              className={cn(HEADER_BADGE_CLASS, survivalTone.badge)}
            >
              {survivalTone.label}
            </Badge>
          }
        >
          <div className="flex h-full min-h-[168px] flex-col md:flex-row md:items-stretch">
            <ColumnMetric
              label="Required Pace"
              value={
                requiredDailyPace != null
                  ? formatMetricValue(requiredDailyPace, metricMode)
                  : "N/A"
              }
              hint="Needed per remaining day"
            />
            <Separator className="my-4 md:hidden" />
            <VerticalSeparator className="mx-5 hidden self-stretch md:block" />
            <ColumnMetric
              label="Best day"
              value={formatMetricValue(
                metricMode === "currency"
                  ? toNumber(ruleCheck.metrics.bestDayProfit)
                  : toNumber(ruleCheck.metrics.bestDayProfitPercent),
                metricMode
              )}
              hint="Strongest realized day this phase"
            />
            <Separator className="my-4 md:hidden" />
            <VerticalSeparator className="mx-5 hidden self-stretch md:block" />
            <ColumnMetric
              label="Current Equity"
              value={formatUsd(currentEquity)}
              hint="Live account state after floating P&L"
            />
            <Separator className="my-4 md:hidden" />
            <VerticalSeparator className="mx-5 hidden self-stretch md:block" />
            <ColumnMetric
              label="Worst DD Taken"
              value={formatMetricValue(
                metricMode === "currency"
                  ? toNumber(ruleCheck.metrics.maxDrawdownTaken)
                  : toNumber(ruleCheck.metrics.maxDrawdownTakenPercent),
                metricMode
              )}
              hint="Peak drawdown observed this phase"
            />
          </div>
        </OverviewPanel>

        <OverviewPanel
          icon={Target}
          title="Best next move"
          description="Prioritized actions from the live challenge state"
          bodyClassName="px-0 py-0 sm:px-0 sm:py-0"
        >
          <div className="flex flex-col">
            {(commandCenter?.nextActions || [])
              .slice(0, 4)
              .map((action: string, index: number) => (
                <div key={`${action}-${index}`}>
                  <NextActionRow
                    text={action}
                    survivalState={
                      (commandCenter?.survivalState ||
                        "stable") as SurvivalState
                    }
                  />
                  {index <
                  (commandCenter?.nextActions || []).slice(0, 4).length - 1 ? (
                    <Separator />
                  ) : null}
                </div>
              ))}
            {(!commandCenter?.nextActions ||
              commandCenter.nextActions.length === 0) && (
              <div className={PANEL_ROW_PADDING_CLASS}>
                <p className="text-xs text-white/55">
                  No immediate corrective action. Current challenge state is
                  controlled.
                </p>
              </div>
            )}
          </div>
        </OverviewPanel>
      </section>

      <OverviewPanel
        icon={Shield}
        title="Rule watch"
        description="Current live readings against the active phase requirements"
      >
        <div className="flex flex-col md:flex-row md:items-stretch">
          {ruleWatch.map((item, index) => (
            <div key={item.label} className="contents">
              <RuleWatchMetric
                label={item.label}
                current={item.current}
                threshold={item.threshold}
                hint={item.hint}
                status={item.status}
                currentClassName={item.currentClassName}
                completed={item.completed}
              />
              {index < ruleWatch.length - 1 ? (
                <>
                  <Separator className="my-4 md:hidden" />
                  <VerticalSeparator className="mx-5 hidden self-stretch md:block" />
                </>
              ) : null}
            </div>
          ))}
        </div>
      </OverviewPanel>

      {currentPhase && account.propCurrentPhase !== 0 ? (
        <OverviewPanel
          icon={Shield}
          title="Current phase rules"
          description="Active thresholds for the current challenge phase"
          badge={
            <Badge
              variant="outline"
              className="h-7 rounded-sm border-white/10 px-1.5 text-[10px] text-white/55"
            >
              {phaseLabel}
            </Badge>
          }
        >
          <div className="flex h-full min-h-[168px] flex-col xl:flex-row xl:items-stretch">
            <ColumnMetric
              label="Target"
              value={formatMetricValue(targetValue, metricMode)}
              hint="Phase profit objective"
            />
            <Separator className="my-4 xl:hidden" />
            <VerticalSeparator className="mx-5 hidden self-stretch xl:block" />
            <ColumnMetric
              label="Daily limit"
              value={formatMetricValue(dailyLossLimit, metricMode)}
              hint="Allowed daily drawdown"
            />
            <Separator className="my-4 xl:hidden" />
            <VerticalSeparator className="mx-5 hidden self-stretch xl:block" />
            <ColumnMetric
              label="Max DD"
              value={formatMetricValue(maxLossLimit, metricMode)}
              hint={
                currentPhase.maxLossType === "trailing"
                  ? "Trailing phase ceiling"
                  : "Phase drawdown ceiling"
              }
            />
            <Separator className="my-4 xl:hidden" />
            <VerticalSeparator className="mx-5 hidden self-stretch xl:block" />
            <ColumnMetric
              label="Time Limit"
              value={
                currentPhase.timeLimitDays != null
                  ? `${currentPhase.timeLimitDays}d`
                  : "Unlimited"
              }
              hint="Maximum duration allowed"
            />
            <Separator className="my-4 xl:hidden" />
            <VerticalSeparator className="mx-5 hidden self-stretch xl:block" />
            <ColumnMetric
              label="Min Days"
              value={minTradingDays > 0 ? `${minTradingDays}` : "None"}
              hint="Required trading days"
            />
          </div>
        </OverviewPanel>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <OverviewPanel
          icon={BarChart3}
          title="Pass probability"
          description="Projection based on recent phase snapshots"
        >
          {probability ? (
            <div className="flex h-full min-h-[168px] flex-col">
              <div className="flex flex-col md:flex-row md:items-stretch">
                <ColumnMetric
                  label="Pass chance"
                  value={`${probability.passPercentage.toFixed(1)}%`}
                  hint="Monte Carlo projection"
                  valueClassName={probabilityTone}
                />
                <Separator className="my-4 md:hidden" />
                <VerticalSeparator className="mx-5 hidden self-stretch md:block" />
                <ColumnMetric
                  label="Risk of Failure"
                  value={`${probability.riskOfFailure.toFixed(1)}%`}
                  hint="Projected failure rate"
                  valueClassName="text-rose-400"
                />
                <Separator className="my-4 md:hidden" />
                <VerticalSeparator className="mx-5 hidden self-stretch md:block" />
                <ColumnMetric
                  label="Est. Days"
                  value={
                    probability.daysToTarget != null
                      ? `${probability.daysToTarget}`
                      : "N/A"
                  }
                  hint="Expected days to target"
                />
                <Separator className="my-4 md:hidden" />
                <VerticalSeparator className="mx-5 hidden self-stretch md:block" />
                <ColumnMetric
                  label="Avg Daily"
                  value={`${(probability.avgDailyReturn || 0).toFixed(2)}%`}
                  hint="Mean daily snapshot return"
                />
              </div>

              <Separator
                className={cn(
                  WIDGET_CONTENT_SEPARATOR_CLASS,
                  "my-4 -mx-4 sm:-mx-5"
                )}
              />
              <p className="text-xs leading-relaxed text-white/55">
                {probability.message}
              </p>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-white/40">
              Not enough data to calculate probability.
            </div>
          )}
        </OverviewPanel>

        <OverviewPanel
          icon={Bell}
          title="Recent alerts"
          description="Latest rule warnings, breaches, and milestones"
          badge={
            <Badge
              variant="outline"
              className="h-7 rounded-sm border-white/10 px-1.5 text-[10px] text-white/55"
            >
              {totalAlertCount}
            </Badge>
          }
          bodyClassName="px-0 py-0 sm:px-0 sm:py-0"
        >
          <div className="flex h-full flex-col">
            {paginatedAlerts.length > 0 ? (
              paginatedAlerts.map((alert: any, index: number) => (
                <div key={alert.id}>
                  <AlertRow alert={alert} />
                  {index < paginatedAlerts.length - 1 ? <Separator /> : null}
                </div>
              ))
            ) : (
              <div className={PANEL_ROW_PADDING_CLASS}>
                <p className="text-xs text-white/55">
                  No alerts yet. The current phase has not triggered any recent
                  warnings or breaches.
                </p>
              </div>
            )}

            {totalAlertPages > 1 ? (
              <>
                <Separator />
                <div className="flex items-center justify-between px-4 py-3 sm:px-5">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                    Page {alertsPage} of {totalAlertPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 rounded-sm border-white/10 bg-sidebar px-3 text-[11px] text-white/65 hover:bg-sidebar-accent"
                      disabled={alertsPage === 1}
                      onClick={() =>
                        setAlertsPage((page) => Math.max(1, page - 1))
                      }
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 rounded-sm border-white/10 bg-sidebar px-3 text-[11px] text-white/65 hover:bg-sidebar-accent"
                      disabled={alertsPage >= totalAlertPages}
                      onClick={() =>
                        setAlertsPage((page) =>
                          Math.min(totalAlertPages, page + 1)
                        )
                      }
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </OverviewPanel>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          {chartBoundsRange && resolvedChartRange ? (
            <PickerComponent
              defaultStart={resolvedChartRange.start}
              defaultEnd={resolvedChartRange.end}
              minDate={chartBoundsRange.min}
              maxDate={chartBoundsRange.max}
              valueStart={resolvedChartRange.start}
              valueEnd={resolvedChartRange.end}
              minDays={1}
              maxDays={availableChartDays}
              quickRanges={[
                {
                  label: "All time",
                  getRange: (minDate, maxDate) => ({
                    start: minDate,
                    end: maxDate,
                  }),
                },
              ]}
              onRangeChange={applyChartRange}
            />
          ) : chartBoundsLoading ? (
            <div className="h-9 w-48">
              <Skeleton className="h-full w-full rounded-none bg-sidebar-accent" />
            </div>
          ) : null}

          <div className={CHART_ACTION_GROUP_CLASS}>
            <Button
              aria-label="Show previous month"
              className={CHART_ACTION_GROUP_BUTTON_CLASS}
              disabled={!canNavigateChartPrevious}
              onClick={() => handleChartMonthStep(-1)}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              className="h-[38px] min-w-[10rem] cursor-default rounded-none border-x border-white/5 bg-sidebar px-4 py-2 text-xs text-white/70 hover:bg-sidebar"
              disabled
            >
              {activeChartMonthLabel || "Select month"}
            </Button>
            <Button
              aria-label="Show next month"
              className={CHART_ACTION_GROUP_BUTTON_CLASS}
              disabled={!canNavigateChartNext}
              onClick={() => handleChartMonthStep(1)}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <DailyNetCard accountId={accountId} hideComparison />
          <EquityCurveCard accountId={accountId} hideComparison />
          <DrawdownChartCard accountId={accountId} hideComparison />
        </div>
      </section>
    </main>
  );
}
