"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { useRouter } from "next/navigation";

import { countRangeDays } from "@/components/dashboard/chart-comparison-utils";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import {
  PropTrackerAlertsPanel,
  PropTrackerChartSection,
  PropTrackerCommandCenterSection,
  PropTrackerCurrentPhaseRulesPanel,
  PropTrackerFundedBanner,
  PropTrackerHeaderCard,
  PropTrackerNotFoundState,
  PropTrackerProbabilityPanel,
  PropTrackerRuleWatchPanel,
} from "@/features/accounts/prop-tracker/components/prop-tracker-detail-sections";
import type { SurvivalState } from "@/features/accounts/prop-tracker/lib/prop-tracker-detail";
import {
  addMonths,
  clampRangeToBounds,
  endOfMonth,
  formatMetricValue,
  formatSignedMetricValue,
  getMetricMode,
  getPropStatusAppearance,
  getSurvivalTone,
  isSameCalendarDay,
  isSameCalendarMonth,
  startOfMonth,
  toNumber,
} from "@/features/accounts/prop-tracker/lib/prop-tracker-detail";
import { useDateRangeStore } from "@/stores/date-range";
import { trpc } from "@/utils/trpc";

export default function PropTrackerPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const router = useRouter();
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

  const chartQuickRanges = useMemo(() => {
    if (!chartBoundsRange || availableChartDays <= 1) {
      return [];
    }

    return [
      {
        label: "All time",
        getRange: (minDate: Date, maxDate: Date) => ({
          start: minDate,
          end: maxDate,
        }),
      },
    ];
  }, [availableChartDays, chartBoundsRange]);

  const showChartMonthSelector = useMemo(() => {
    if (!chartBoundsRange) return false;
    return !isSameCalendarMonth(chartBoundsRange.min, chartBoundsRange.max);
  }, [chartBoundsRange]);

  const activeChartMonthStart = useMemo(
    () => (resolvedChartRange ? startOfMonth(resolvedChartRange.start) : null),
    [resolvedChartRange]
  );

  const isAllTimeChartRange = useMemo(() => {
    if (!resolvedChartRange || !chartBoundsRange) return false;
    return (
      isSameCalendarDay(resolvedChartRange.start, chartBoundsRange.min) &&
      isSameCalendarDay(resolvedChartRange.end, chartBoundsRange.max)
    );
  }, [chartBoundsRange, resolvedChartRange]);

  const activeChartMonthLabel = useMemo(() => {
    if (isAllTimeChartRange) return "All time";
    if (!activeChartMonthStart) return "";
    return activeChartMonthStart.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, [activeChartMonthStart, isAllTimeChartRange]);

  const canNavigateChartPrevious = useMemo(() => {
    if (isAllTimeChartRange || !activeChartMonthStart || !chartBoundsRange) {
      return false;
    }

    return (
      activeChartMonthStart.getTime() >
      startOfMonth(chartBoundsRange.min).getTime()
    );
  }, [activeChartMonthStart, chartBoundsRange, isAllTimeChartRange]);

  const canNavigateChartNext = useMemo(() => {
    if (isAllTimeChartRange || !activeChartMonthStart || !chartBoundsRange) {
      return false;
    }

    return (
      activeChartMonthStart.getTime() <
      startOfMonth(chartBoundsRange.max).getTime()
    );
  }, [activeChartMonthStart, chartBoundsRange, isAllTimeChartRange]);

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
    return <RouteLoadingFallback route="propTracker" className="min-h-[calc(100vh-10rem)]" />;
  }

  if (!dashboard) {
    return <PropTrackerNotFoundState />;
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
  const survivalState = (commandCenter?.survivalState ||
    "stable") as SurvivalState;
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
  const bestDayValue =
    metricMode === "currency"
      ? toNumber(ruleCheck.metrics.bestDayProfit)
      : toNumber(ruleCheck.metrics.bestDayProfitPercent);
  const worstDrawdownTaken =
    metricMode === "currency"
      ? toNumber(ruleCheck.metrics.maxDrawdownTaken)
      : toNumber(ruleCheck.metrics.maxDrawdownTakenPercent);

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
      {isFunded ? <PropTrackerFundedBanner /> : null}

      <PropTrackerHeaderCard
        accountId={accountId}
        account={{
          id: account.id,
          name: account.name,
        }}
        propFirm={propFirm}
        statusInfo={statusInfo}
        currentBalance={currentBalance}
        phaseLabel={phaseLabel}
        isFunded={isFunded}
        metricMode={metricMode}
        currentResult={currentResult}
        tradingDays={ruleCheck.metrics.tradingDays}
        minTradingDays={minTradingDays}
        dailyDrawdown={dailyDrawdown}
        maxDrawdown={maxDrawdown}
        targetValue={targetValue}
        onRemoved={() => router.push("/dashboard/accounts")}
      />

      <PropTrackerCommandCenterSection
        survivalTone={survivalTone}
        survivalState={survivalState}
        nextActions={(commandCenter?.nextActions || []).slice(0, 4)}
        requiredDailyPace={requiredDailyPace}
        metricMode={metricMode}
        bestDayValue={bestDayValue}
        currentEquity={currentEquity}
        worstDrawdownTaken={worstDrawdownTaken}
      />

      <PropTrackerRuleWatchPanel ruleWatch={ruleWatch} />

      {currentPhase && !isFunded ? (
        <PropTrackerCurrentPhaseRulesPanel
          phaseLabel={phaseLabel}
          currentPhase={currentPhase}
          metricMode={metricMode}
          targetValue={targetValue}
          dailyLossLimit={dailyLossLimit}
          maxLossLimit={maxLossLimit}
          minTradingDays={minTradingDays}
        />
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <PropTrackerProbabilityPanel
          probability={probability}
          probabilityTone={probabilityTone}
        />
        <PropTrackerAlertsPanel
          paginatedAlerts={paginatedAlerts}
          totalAlertCount={totalAlertCount}
          totalAlertPages={totalAlertPages}
          alertsPage={alertsPage}
          onPreviousPage={() => setAlertsPage((page) => Math.max(1, page - 1))}
          onNextPage={() =>
            setAlertsPage((page) => Math.min(totalAlertPages, page + 1))
          }
        />
      </section>

      <PropTrackerChartSection
        accountId={accountId}
        chartBoundsRange={chartBoundsRange}
        resolvedChartRange={resolvedChartRange}
        availableChartDays={availableChartDays}
        chartQuickRanges={chartQuickRanges}
        chartBoundsLoading={chartBoundsLoading}
        showChartMonthSelector={showChartMonthSelector}
        activeChartMonthLabel={activeChartMonthLabel}
        canNavigateChartPrevious={canNavigateChartPrevious}
        canNavigateChartNext={canNavigateChartNext}
        onRangeChange={applyChartRange}
        onPreviousMonth={() => handleChartMonthStep(-1)}
        onNextMonth={() => handleChartMonthStep(1)}
      />
    </main>
  );
}
