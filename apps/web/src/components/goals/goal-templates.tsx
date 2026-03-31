"use client";

import { Target, TrendingUp, Award, Calendar } from "lucide-react";

export interface GoalTemplate {
  id: string;
  type: "daily" | "weekly" | "monthly" | "milestone";
  targetType:
    | "profit"
    | "winRate"
    | "consistency"
    | "rr"
    | "trades"
    | "streak"
    | "journalRate"
    | "ruleCompliance"
    | "edgeTradeRate"
    | "breakAfterLoss"
    | "checklistCompletion";
  title: string;
  description: string;
  targetValue: number;
  icon: typeof Target;
  color: string;
}

export const goalTemplates: GoalTemplate[] = [
  // Daily goals
  {
    id: "daily-profit-100",
    type: "daily",
    targetType: "profit",
    title: "$100 Daily Profit",
    description: "Hit $100 profit in a single day",
    targetValue: 100,
    icon: Target,
    color: "#10b981",
  },
  {
    id: "daily-profit-500",
    type: "daily",
    targetType: "profit",
    title: "$500 Daily Profit",
    description: "Achieve $500 profit in a single day",
    targetValue: 500,
    icon: Target,
    color: "#10b981",
  },
  {
    id: "daily-trades-5",
    type: "daily",
    targetType: "trades",
    title: "5 Trades Per Day",
    description: "Execute 5 quality trades daily",
    targetValue: 5,
    icon: TrendingUp,
    color: "#3b82f6",
  },

  // Weekly goals
  {
    id: "weekly-win-rate-60",
    type: "weekly",
    targetType: "winRate",
    title: "60% Win Rate",
    description: "Achieve 60% win rate this week",
    targetValue: 60,
    icon: Award,
    color: "#8b5cf6",
  },
  {
    id: "weekly-profit-1000",
    type: "weekly",
    targetType: "profit",
    title: "$1,000 Weekly Profit",
    description: "Make $1,000 profit this week",
    targetValue: 1000,
    icon: Target,
    color: "#10b981",
  },
  {
    id: "weekly-rr-2",
    type: "weekly",
    targetType: "rr",
    title: "2:1 Risk/Reward",
    description: "Maintain average 2:1 R:R ratio",
    targetValue: 2,
    icon: TrendingUp,
    color: "#f59e0b",
  },
  {
    id: "weekly-rule-compliance-90",
    type: "weekly",
    targetType: "ruleCompliance",
    title: "90% Rule Compliance",
    description: "Keep at least 90% of trades aligned with your protocol.",
    targetValue: 90,
    icon: Award,
    color: "#14b8a6",
  },
  {
    id: "weekly-edge-trade-rate-85",
    type: "weekly",
    targetType: "edgeTradeRate",
    title: "85% Edge Trades",
    description:
      "Take most trades with a tagged session or model instead of impulse entries.",
    targetValue: 85,
    icon: TrendingUp,
    color: "#22c55e",
  },
  {
    id: "weekly-break-after-loss-80",
    type: "weekly",
    targetType: "breakAfterLoss",
    title: "80% Post-Loss Pause",
    description:
      "Respect a 15-minute pause after losses at least 80% of the time.",
    targetValue: 80,
    icon: Calendar,
    color: "#f97316",
  },

  // Monthly goals
  {
    id: "monthly-profit-5000",
    type: "monthly",
    targetType: "profit",
    title: "$5,000 Monthly Profit",
    description: "Achieve $5,000 profit this month",
    targetValue: 5000,
    icon: Target,
    color: "#10b981",
  },
  {
    id: "monthly-profit-10000",
    type: "monthly",
    targetType: "profit",
    title: "$10,000 Monthly Profit",
    description: "Hit $10,000 profit this month",
    targetValue: 10000,
    icon: Target,
    color: "#10b981",
  },
  {
    id: "monthly-consistency-80",
    type: "monthly",
    targetType: "consistency",
    title: "80% Consistency",
    description: "Maintain 80% green days ratio",
    targetValue: 80,
    icon: Calendar,
    color: "#8b5cf6",
  },
  {
    id: "monthly-journal-rate-80",
    type: "monthly",
    targetType: "journalRate",
    title: "Journal 80% of Trades",
    description:
      "Link reviews to most closed trades so mistakes and strengths stay searchable.",
    targetValue: 80,
    icon: Target,
    color: "#38bdf8",
  },
  {
    id: "monthly-checklist-completion-90",
    type: "monthly",
    targetType: "checklistCompletion",
    title: "90% Checklist Completion",
    description: "Complete your pre-trade checklist before almost every trade.",
    targetValue: 90,
    icon: Award,
    color: "#a855f7",
  },

  // Milestone goals
  {
    id: "milestone-streak-10",
    type: "milestone",
    targetType: "streak",
    title: "10 Win Streak",
    description: "Achieve 10 consecutive winning trades",
    targetValue: 10,
    icon: Award,
    color: "#f59e0b",
  },
  {
    id: "milestone-win-rate-70",
    type: "milestone",
    targetType: "winRate",
    title: "70% Win Rate",
    description: "Reach 70% overall win rate",
    targetValue: 70,
    icon: Award,
    color: "#8b5cf6",
  },
  {
    id: "milestone-profit-50000",
    type: "milestone",
    targetType: "profit",
    title: "$50,000 total profit",
    description: "Reach $50,000 in total profits",
    targetValue: 50000,
    icon: Target,
    color: "#10b981",
  },
];

export function getTemplatesByType(type: GoalTemplate["type"]) {
  return goalTemplates.filter((t) => t.type === type);
}

export function getTemplateById(id: string) {
  return goalTemplates.find((t) => t.id === id);
}
