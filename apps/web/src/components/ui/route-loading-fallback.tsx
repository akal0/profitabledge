"use client";

import { TextShimmer } from "@/components/ui/text-shimmer";
import { cn } from "@/lib/utils";

const ROUTE_LOADING_COPY = {
  accounts: "Balancing the ledgers and lining up your accounts...",
  achievements: "Polishing the trophies and tallying the milestones...",
  affiliate: "Linking partners, payouts, and affiliate numbers...",
  assistant: "Warming up the copilot and tuning the prompts...",
  beta: "Checking your invite access and opening the beta gate...",
  continue: "Confirming your plan and opening your workspace...",
  dashboard: "Tinkering with the widgets and calendars...",
  edges: "Laying out your Edges, shared strategies, and rule sheets...",
  economicCalendar: "Pinning the key events onto the calendar...",
  feed: "Stacking the latest market notes and community signals...",
  goals: "Sharpening the targets and lining up the milestones...",
  growth: "Lining up funnels, experiments, and growth stats...",
  growthAdmin: "Sorting campaigns, controls, and admin levers...",
  journal: "Opening the notebook and arranging your reflections...",
  journalShare:
    "Checking share access, approved viewers, and private journal pages...",
  leaderboard: "Sorting the standings and polishing the podium...",
  login: "Checking your credentials and opening the desk...",
  news: "Pinning the key events onto the calendar...",
  onboarding: "Laying out the essentials for your trading workspace...",
  propTracker: "Checking limits, phases, and prop account pace...",
  publicProof: "Pulling together the public track record and account proof...",
  publicProofTrades: "Loading the public trade ledger and execution history...",
  verification: "Validating the signature and resolving the verification record...",
  referrals: "Counting invites, clicks, and referral momentum...",
  reports: "Compiling the breakdowns, scorecards, and report views...",
  settings: "Opening the control room and loading your settings...",
  settingsAi: "Dialing in the assistant and its preferences...",
  settingsAlerts: "Tuning the bells, nudges, and triggers...",
  settingsApi: "Securing keys and lining up integrations...",
  settingsBilling: "Reconciling plans, invoices, and billing details...",
  settingsBroker: "Matching brokers, feeds, and account wiring...",
  settingsCompliance: "Reviewing the guardrails and paperwork...",
  settingsConnections: "Checking terminals, bridges, and live connections...",
  settingsEaSetup: "Wiring the EA and double-checking the handshake...",
  settingsEdges: "Opening the Edge workspace and syncing Edges...",
  settingsMetrics: "Organizing scorecards and performance markers...",
  settingsNotifications: "Queueing pings, digests, and reminders...",
  settingsProfile: "Freshening up your profile and account details...",
  settingsRisk: "Measuring limits, buffers, and risk rules...",
  settingsRules: "Arranging the Edge and rule checks...",
  settingsSessions: "Reviewing devices, sessions, and sign-ins...",
  settingsSocial: "Hooking up profiles and community links...",
  settingsSymbolMapping: "Matching broker symbols and standardizing the map...",
  settingsSupport: "Gathering help docs and support options...",
  settingsTags: "Sorting labels, categories, and tag groups...",
  settingsTimezone: "Lining up clocks, sessions, and market hours...",
  sharedCard: "Loading the shared performance card and presentation view...",
  signUp: "Preparing your workspace and opening account creation...",
  trades: "Putting every trade in its place...",
  tradesToolbar: "Arranging the filters, tags, and trade controls...",
  verifiedTrackRecord:
    "Verifying the shared track record and rebuilding the proof sheet...",
} as const;

export type RouteLoadingVariant = keyof typeof ROUTE_LOADING_COPY;

type RouteLoadingFallbackProps = {
  route: RouteLoadingVariant;
  className?: string;
  textClassName?: string;
  message?: string;
  animated?: boolean;
};

function normalizeFallbackClassName(className?: string) {
  if (!className) {
    return className;
  }

  return className
    .replace(/\bmin-h-full\b/g, "min-h-[calc(100dvh-8rem)]")
    .replace(/\bmin-h-0\b/g, "min-h-[calc(100dvh-8rem)]");
}

export function RouteLoadingFallback({
  route,
  className,
  textClassName,
  message,
  animated = true,
}: RouteLoadingFallbackProps) {
  const copy = message ?? ROUTE_LOADING_COPY[route];
  const normalizedClassName = normalizeFallbackClassName(className);
  const textClasses = cn(
    "text-base font-medium leading-relaxed tracking-[-0.04em] text-balance",
    "sm:text-lg",
    textClassName
  );

  return (
    <div
      className={cn(
        "flex h-full min-h-[calc(100dvh-8rem)] w-full flex-1 items-center justify-center px-6 py-10 text-center",
        normalizedClassName
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
