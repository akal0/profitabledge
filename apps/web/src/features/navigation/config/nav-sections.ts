import type { ComponentType } from "react";
import type { AlphaFeatureKey } from "@profitabledge/platform";
import {
  Sparkles,
  Copy,
  Target,
  Trophy,
  Building2,
  Award,
  Newspaper,
  BarChart3,
  Rss,
  TrendingUp,
} from "lucide-react";
import { publicAlphaFlags } from "@/lib/alpha-flags";

import DashboardIcon from "@/public/icons/navigation/dashboard.svg";
import CalendarIcon from "@/public/icons/navigation/calendar.svg";
import JournalIcon from "@/public/icons/navigation/journal.svg";

export type NavIcon = ComponentType<{ className?: string }>;

export type PlanKey = "student" | "professional" | "institutional";

export const PLAN_TIER: Record<PlanKey, number> = {
  student: 0,
  professional: 1,
  institutional: 2,
};

export function meetsRequirement(
  current: PlanKey | string,
  required: PlanKey
): boolean {
  return (PLAN_TIER[current as PlanKey] ?? 0) >= PLAN_TIER[required];
}

export type NavItem = {
  title: string;
  url: string;
  icon: NavIcon;
  isActive?: boolean;
  /** Minimum billing plan required to access this item */
  planRequirement?: PlanKey;
  featureFlag?: AlphaFeatureKey;
  disabledTooltip?: string;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Analysis",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: DashboardIcon },
      { title: "Reports", url: "/dashboard/reports", icon: BarChart3 },
      { title: "Trades", url: "/dashboard/trades", icon: CalendarIcon },
      { title: "Journal", url: "/dashboard/journal", icon: JournalIcon },
      { title: "Psychology", url: "/dashboard/psychology", icon: TrendingUp },
      { title: "Goals", url: "/dashboard/goals", icon: Target },
    ] satisfies NavItem[],
  } satisfies NavSection,
  {
    label: "Accounts",
    items: [
      {
        title: "Trading accounts",
        url: "/dashboard/accounts",
        icon: Building2,
      },
      {
        title: "Prop tracker",
        url: "/dashboard/prop-tracker",
        icon: Trophy,
        planRequirement: "professional",
      },
    ] satisfies NavItem[],
  } satisfies NavSection,
  ...(publicAlphaFlags.community
    ? [
        {
          label: "Community",
          items: [
            { title: "Feed", url: "/dashboard/feed", icon: Rss },
            { title: "Leaderboard", url: "/dashboard/leaderboard", icon: Award },
            { title: "Achievements", url: "/dashboard/achievements", icon: Trophy },
            { title: "News", url: "/dashboard/news", icon: Newspaper },
          ],
        } satisfies NavSection,
      ]
    : []),
  {
    label: "Tools",
    items: [
      {
        title: "Trade copier",
        url: "/dashboard/copier",
        icon: Copy,
        planRequirement: "institutional" as PlanKey,
      },
      ...(publicAlphaFlags.aiAssistant
        ? [
            {
              title: "AI Assistant",
              url: "/assistant",
              icon: Sparkles,
              planRequirement: "professional" as PlanKey,
            },
          ]
        : []),
      {
        title: "Backtest",
        url: "/backtest",
        icon: BarChart3,
        planRequirement: "professional" as PlanKey,
        featureFlag: "backtest",
        disabledTooltip: "Coming soon!",
      },
    ] satisfies NavItem[],
  } satisfies NavSection,
].filter((section) => section.items.length > 0);
