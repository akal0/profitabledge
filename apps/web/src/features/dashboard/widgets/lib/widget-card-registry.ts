"use client";

import type { ComponentType } from "react";
import { CoachingWidget } from "@/components/dashboard/coaching-widget";
import { DailyBriefingCard } from "@/components/dashboard/daily-briefing-card";
import { RuleComplianceWidget } from "@/components/dashboard/rule-compliance-widget";
import { TiltmeterWidget } from "@/components/dashboard/tiltmeter-widget";
import {
  AccountBalanceCard,
  AccountEquityCard,
  AverageRRCard,
  HoldTimeCard,
  ProfitExpectancyCard,
  ProfitFactorCard,
  WinRateCard,
  WinStreakCard,
} from "@/features/dashboard/widgets/components/account-overview-cards";
import {
  ExecutionScorecardCard,
  MoneyLeftOnTableCard,
  OpenTradesWidget,
  SessionPerformanceCard,
  TradeStreakCalendarCard,
} from "@/features/dashboard/widgets/components/activity-cards";
import {
  AssetProfitabilityCard,
  ConsistencyScoreCard,
  TotalLossesCard,
  TradeCountsCard,
} from "@/features/dashboard/widgets/components/performance-breakdown-cards";
import type { WidgetType } from "@/features/dashboard/widgets/lib/widget-config";
import type { WidgetValueMode } from "@/features/dashboard/widgets/lib/widget-shared";

export type WidgetCardComponentProps = {
  accountId?: string;
  isEditing?: boolean;
  valueMode?: WidgetValueMode;
  currencyCode?: string;
  className?: string;
};

export const dashboardWidgetCardComponents: Record<
  WidgetType,
  ComponentType<WidgetCardComponentProps>
> = {
  "account-balance": AccountBalanceCard,
  "account-equity": AccountEquityCard,
  "win-rate": WinRateCard,
  "profit-factor": ProfitFactorCard,
  "win-streak": WinStreakCard,
  "hold-time": HoldTimeCard,
  "average-rr": AverageRRCard,
  "trade-counts": TradeCountsCard,
  "profit-expectancy": ProfitExpectancyCard,
  "consistency-score": ConsistencyScoreCard,
  "execution-scorecard": ExecutionScorecardCard,
  "money-left-on-table": MoneyLeftOnTableCard,
  tiltmeter: TiltmeterWidget,
  "daily-briefing": DailyBriefingCard,
  "rule-compliance": RuleComplianceWidget,
  "edge-coach": CoachingWidget,
  "asset-profitability": AssetProfitabilityCard,
  "total-losses": TotalLossesCard,
  "open-trades": OpenTradesWidget,
  "session-performance": SessionPerformanceCard,
  "streak-calendar": TradeStreakCalendarCard,
};
