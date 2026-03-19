"use client";

import { TextShimmer } from "@/components/ui/text-shimmer";
import { cn } from "@/lib/utils";

const ROUTE_LOADING_COPY = {
  accounts: "Balancing the ledgers and lining up your accounts...",
  achievements: "Polishing the trophies and tallying the milestones...",
  affiliate: "Linking partners, payouts, and affiliate numbers...",
  assistant: "Warming up the copilot and tuning the prompts...",
  backtest: "Rewinding the charts and setting the stage...",
  backtestReplay: "Resetting the candles and rebuilding the replay desk...",
  copier: "Syncing the copier routes and account links...",
  dashboard: "Tinkering with the widgets and calendars...",
  economicCalendar: "Pinning the key events onto the calendar...",
  feed: "Stacking the latest market notes and community signals...",
  goals: "Sharpening the targets and lining up the milestones...",
  growth: "Lining up funnels, experiments, and growth stats...",
  growthAdmin: "Sorting campaigns, controls, and admin levers...",
  journal: "Opening the notebook and arranging your reflections...",
  leaderboard: "Sorting the standings and polishing the podium...",
  login: "Checking your credentials and opening the desk...",
  news: "Pinning the key events onto the calendar...",
  onboarding: "Laying out the essentials for your trading workspace...",
  propTracker: "Checking limits, phases, and prop account pace...",
  psychology: "Untangling patterns, emotions, and decision loops...",
  referrals: "Counting invites, clicks, and referral momentum...",
  settingsAi: "Dialing in the assistant and its preferences...",
  settingsAlerts: "Tuning the bells, nudges, and triggers...",
  settingsApi: "Securing keys and lining up integrations...",
  settingsBilling: "Reconciling plans, invoices, and billing details...",
  settingsBroker: "Matching brokers, feeds, and account wiring...",
  settingsCompliance: "Reviewing the guardrails and paperwork...",
  settingsConnections: "Checking terminals, bridges, and live connections...",
  settingsEaSetup: "Wiring the EA and double-checking the handshake...",
  settingsMetrics: "Organizing scorecards and performance markers...",
  settingsNotifications: "Queueing pings, digests, and reminders...",
  settingsProfile: "Freshening up your profile and account details...",
  settingsRisk: "Measuring limits, buffers, and risk rules...",
  settingsRules: "Arranging the playbook and rule checks...",
  settingsSessions: "Reviewing devices, sessions, and sign-ins...",
  settingsSocial: "Hooking up profiles and community links...",
  settingsSupport: "Gathering help docs and support options...",
  settingsTags: "Sorting labels, categories, and tag groups...",
  settingsTimezone: "Lining up clocks, sessions, and market hours...",
  trades: "Putting every trade in its place...",
  tradesToolbar: "Arranging the filters, tags, and trade controls...",
} as const;

export type RouteLoadingVariant = keyof typeof ROUTE_LOADING_COPY;

type RouteLoadingFallbackProps = {
  route: RouteLoadingVariant;
  className?: string;
  textClassName?: string;
  message?: string;
  animated?: boolean;
};

export function RouteLoadingFallback({
  route,
  className,
  textClassName,
  message,
  animated = true,
}: RouteLoadingFallbackProps) {
  const copy = message ?? ROUTE_LOADING_COPY[route];
  const textClasses = cn(
    "text-base font-medium leading-relaxed tracking-[-0.04em] text-balance",
    "sm:text-lg",
    textClassName
  );

  return (
    <div
      className={cn(
        "flex h-full min-h-full w-full flex-1 items-center justify-center px-6 py-10 text-center",
        className
      )}
    >
      <div className="mx-auto flex w-full max-w-2xl items-center justify-center">
        {animated ? (
          <TextShimmer
            as="p"
            duration={2.4}
            spread={1.6}
            className={cn(
              textClasses,
              "[--base-color:rgb(255_255_255_/_0.24)] [--base-gradient-color:rgb(255_255_255_/_0.9)]"
            )}
          >
            {copy}
          </TextShimmer>
        ) : (
          <p className={cn(textClasses, "text-white/72")}>{copy}</p>
        )}
      </div>
    </div>
  );
}
