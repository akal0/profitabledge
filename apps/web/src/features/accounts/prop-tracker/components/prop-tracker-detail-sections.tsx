import {
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Shield,
  Target,
  Trophy,
} from "lucide-react";

import PickerComponent from "@/components/dashboard/calendar/picker";
import { WidgetWrapper } from "@/components/dashboard/widget-wrapper";
import { PropPhaseTimeline } from "@/components/prop-phase-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator, VerticalSeparator } from "@/components/ui/separator";
import {
  DailyNetCard,
  DrawdownChartCard,
  EquityCurveCard,
} from "@/features/dashboard/charts/components/comparison-chart-cards";
import { WIDGET_CONTENT_SEPARATOR_CLASS } from "@/features/dashboard/widgets/lib/widget-shared";
import { RemovePropAccountButton } from "@/features/accounts/components/remove-prop-account-button";
import { PropAccountPhaseActionsMenu } from "@/features/accounts/prop-tracker/components/prop-account-phase-actions-menu";
import { cn } from "@/lib/utils";

import type {
  MetricMode,
  PropFirmLike,
  RuleWatchItem,
  StatusAppearance,
  SurvivalState,
  SurvivalTone,
} from "../lib/prop-tracker-detail";
import {
  CHART_ACTION_GROUP_BUTTON_CLASS,
  CHART_ACTION_GROUP_CLASS,
  GOALS_SURFACE_OUTER_CLASS,
  HEADER_BADGE_CLASS,
  PANEL_ROW_PADDING_CLASS,
  formatMetricValue,
  formatSignedMetricValue,
  formatUsd,
} from "../lib/prop-tracker-detail";
import {
  AlertRow,
  ColumnMetric,
  NextActionRow,
  OverviewPanel,
  PassedMetricCheck,
  PropFirmAvatar,
  PropTrackerLoadingState,
  PropTrackerNotFoundState,
  RuleWatchMetric,
} from "./prop-tracker-detail-primitives";

export {
  PropTrackerLoadingState,
  PropTrackerNotFoundState,
} from "./prop-tracker-detail-primitives";

type PropTrackerHeaderCardProps = {
  accountId: string;
  account: {
    id: string;
    name: string;
  };
  propFirm?: PropFirmLike | null;
  statusInfo: StatusAppearance;
  currentBalance: number;
  phaseLabel: string;
  isFunded: boolean;
  metricMode: MetricMode;
  currentResult: number;
  tradingDays: number;
  minTradingDays: number;
  dailyDrawdown: number;
  maxDrawdown: number;
  targetValue: number | null;
  dashboard?: {
    account?: {
      propCurrentPhase?: number | null;
    } | null;
    challengeRule?: {
      phases?: unknown;
    } | null;
  } | null;
  onRemoved: () => void;
};

type PropTrackerCommandCenterSectionProps = {
  survivalTone: SurvivalTone;
  survivalState: SurvivalState;
  nextActions: string[];
  requiredDailyPace: number | null;
  metricMode: MetricMode;
  bestDayValue: number;
  currentEquity: number;
  worstDrawdownTaken: number;
};

type PropTrackerCurrentPhaseRulesPanelProps = {
  phaseLabel: string;
  currentPhase: {
    maxLossType?: string | null;
    timeLimitDays?: number | null;
  };
  metricMode: MetricMode;
  targetValue: number | null;
  dailyLossLimit: number | null;
  maxLossLimit: number | null;
  minTradingDays: number;
};

type PropTrackerProbabilityPanelProps = {
  probability?: {
    passPercentage: number;
    riskOfFailure: number;
    daysToTarget?: number | null;
    avgDailyReturn?: number | null;
    message: string;
  } | null;
  probabilityTone: string;
};

type PropTrackerAlert = {
  id: string;
  severity: "critical" | "warning" | "info" | string;
  message: string;
  createdAt: string | Date;
};

type PropTrackerAlertsPanelProps = {
  paginatedAlerts: PropTrackerAlert[];
  totalAlertCount: number;
  totalAlertPages: number;
  alertsPage: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

type PropTrackerChartSectionProps = {
  accountId: string;
  chartBoundsRange: { min: Date; max: Date } | null;
  resolvedChartRange: { start: Date; end: Date } | null;
  availableChartDays: number;
  chartQuickRanges: Array<{
    label: string;
    getRange: (minDate: Date, maxDate: Date) => { start: Date; end: Date };
  }>;
  chartBoundsLoading: boolean;
  showChartMonthSelector: boolean;
  activeChartMonthLabel: string;
  canNavigateChartPrevious: boolean;
  canNavigateChartNext: boolean;
  onRangeChange: (nextStart: Date, nextEnd: Date) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
};

export function PropTrackerFundedBanner() {
  return (
    <div className={GOALS_SURFACE_OUTER_CLASS}>
      <div className="flex items-center justify-between gap-4 rounded-sm ring ring-amber-400/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.18),rgba(245,158,11,0.08))] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="rounded-sm ring ring-amber-300/20 bg-amber-300/10 p-2">
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
          className="h-7 rounded-sm ring-amber-300/25 bg-amber-300/10 px-1.5 text-[10px] text-amber-100"
        >
          Passed
        </Badge>
      </div>
    </div>
  );
}

export function PropTrackerHeaderCard({
  accountId,
  account,
  propFirm,
  statusInfo,
  currentBalance,
  phaseLabel,
  isFunded,
  metricMode,
  currentResult,
  tradingDays,
  minTradingDays,
  dailyDrawdown,
  maxDrawdown,
  targetValue,
  dashboard,
  onRemoved,
}: PropTrackerHeaderCardProps) {
  return (
    <>
      <WidgetWrapper
        icon={Trophy}
        title={propFirm?.displayName || "Prop firm"}
        headerRight={
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn(HEADER_BADGE_CLASS, statusInfo.className)}
            >
              {statusInfo.label}
            </Badge>
            <PropAccountPhaseActionsMenu
              accountId={account.id}
              accountName={account.name}
              dashboard={dashboard ?? undefined}
            />
            <RemovePropAccountButton
              accountId={account.id}
              accountName={account.name}
              onRemoved={onRemoved}
            />
          </div>
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
              <p className="text-xs text-white/45">Account balance</p>
              <p className="text-lg font-semibold text-teal-400">
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
                <div className="inline-flex items-center gap-1.5 rounded-full ring ring-emerald-400/20 bg-emerald-400/10 px-2 py-1">
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
                <p className="text-xs text-white/35">Account progress</p>
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
                {tradingDays}
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
        className="rounded-sm ring-white/5"
      />
    </>
  );
}

export function PropTrackerCommandCenterSection({
  survivalTone,
  survivalState,
  nextActions,
  requiredDailyPace,
  metricMode,
  bestDayValue,
  currentEquity,
  worstDrawdownTaken,
}: PropTrackerCommandCenterSectionProps) {
  return (
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
            value={formatMetricValue(bestDayValue, metricMode)}
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
            value={formatMetricValue(worstDrawdownTaken, metricMode)}
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
          {nextActions.slice(0, 4).map((action, index) => (
            <div key={`${action}-${index}`}>
              <NextActionRow text={action} survivalState={survivalState} />
              {index < nextActions.slice(0, 4).length - 1 ? (
                <Separator />
              ) : null}
            </div>
          ))}
          {nextActions.length === 0 ? (
            <div className={PANEL_ROW_PADDING_CLASS}>
              <p className="text-xs text-white/55">
                No immediate corrective action. Current challenge state is
                controlled.
              </p>
            </div>
          ) : null}
        </div>
      </OverviewPanel>
    </section>
  );
}

export function PropTrackerRuleWatchPanel({
  ruleWatch,
}: {
  ruleWatch: RuleWatchItem[];
}) {
  return (
    <OverviewPanel
      icon={Shield}
      title="Rule watch"
      description="Current live readings against the active phase requirements"
    >
      <div className="flex flex-col md:flex-row md:items-stretch">
        {ruleWatch.map((item, index) => (
          <div key={item.label} className="contents">
            <RuleWatchMetric {...item} />
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
  );
}

export function PropTrackerCurrentPhaseRulesPanel({
  phaseLabel,
  currentPhase,
  metricMode,
  targetValue,
  dailyLossLimit,
  maxLossLimit,
  minTradingDays,
}: PropTrackerCurrentPhaseRulesPanelProps) {
  return (
    <OverviewPanel
      icon={Shield}
      title="Current phase rules"
      description="Active thresholds for the current challenge phase"
      badge={
        <Badge
          variant="outline"
          className="h-7 rounded-sm ring-white/10 px-1.5 text-[10px] text-white/55"
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
  );
}

export function PropTrackerProbabilityPanel({
  probability,
  probabilityTone,
}: PropTrackerProbabilityPanelProps) {
  return (
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
  );
}

export function PropTrackerAlertsPanel({
  paginatedAlerts,
  totalAlertCount,
  totalAlertPages,
  alertsPage,
  onPreviousPage,
  onNextPage,
}: PropTrackerAlertsPanelProps) {
  return (
    <OverviewPanel
      icon={Bell}
      title="Recent alerts"
      description="Latest rule warnings, breaches, and milestones"
      badge={
        <Badge
          variant="outline"
          className="h-7 rounded-sm ring-white/10 px-1.5 text-[10px] text-white/55"
        >
          {totalAlertCount}
        </Badge>
      }
      bodyClassName="px-0 py-0 sm:px-0 sm:py-0"
    >
      <div className="flex h-full flex-col">
        {paginatedAlerts.length > 0 ? (
          paginatedAlerts.map((alert, index) => (
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
                  className="h-8 rounded-sm ring-white/10 bg-sidebar px-3 text-[11px] text-white/65 hover:bg-sidebar-accent"
                  disabled={alertsPage === 1}
                  onClick={onPreviousPage}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 rounded-sm ring-white/10 bg-sidebar px-3 text-[11px] text-white/65 hover:bg-sidebar-accent"
                  disabled={alertsPage >= totalAlertPages}
                  onClick={onNextPage}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </OverviewPanel>
  );
}

export function PropTrackerChartSection({
  accountId,
  chartBoundsRange,
  resolvedChartRange,
  availableChartDays,
  chartQuickRanges,
  chartBoundsLoading,
  showChartMonthSelector,
  activeChartMonthLabel,
  canNavigateChartPrevious,
  canNavigateChartNext,
  onRangeChange,
  onPreviousMonth,
  onNextMonth,
}: PropTrackerChartSectionProps) {
  return (
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
            quickRanges={chartQuickRanges}
            onRangeChange={onRangeChange}
          />
        ) : chartBoundsLoading ? (
          <div className="h-9 w-48">
            <Skeleton className="h-full w-full rounded-none bg-sidebar-accent" />
          </div>
        ) : null}

        {showChartMonthSelector ? (
          <div className={CHART_ACTION_GROUP_CLASS}>
            <Button
              aria-label="Show previous month"
              className={CHART_ACTION_GROUP_BUTTON_CLASS}
              disabled={!canNavigateChartPrevious}
              onClick={onPreviousMonth}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              className="h-[38px] min-w-[10rem] cursor-default rounded-none ring-x ring-white/5 bg-sidebar px-4 py-2 text-xs text-white/70 hover:bg-sidebar"
              disabled
            >
              {activeChartMonthLabel || "Select month"}
            </Button>
            <Button
              aria-label="Show next month"
              className={CHART_ACTION_GROUP_BUTTON_CLASS}
              disabled={!canNavigateChartNext}
              onClick={onNextMonth}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <DailyNetCard accountId={accountId} hideComparison />
        <EquityCurveCard accountId={accountId} hideComparison />
        <DrawdownChartCard accountId={accountId} hideComparison />
      </div>
    </section>
  );
}
