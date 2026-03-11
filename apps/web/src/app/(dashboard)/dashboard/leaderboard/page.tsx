"use client";

import * as React from "react";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  Target,
  Shield,
  TrendingDown,
  Trophy,
  CheckCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

type LeaderboardCategory = "consistency" | "execution" | "discipline" | "risk";
type LeaderboardPeriod = "30d" | "90d" | "all_time";

interface LeaderboardEntryData {
  entry: {
    id: string;
    accountId: string;
    percentile: number | null;
    percentileBand: string | null;
    metricValues: any;
    totalTrades: number;
    sampleValid: boolean | null;
  };
  account: {
    id: string;
    name: string;
    verificationLevel: string | null;
  };
  owner: {
    username: string | null;
    isVerified: boolean | null;
    verifiedSince: string | null;
    totalVerifiedTrades: number | null;
  };
}

function LeaderboardEntryCard({ data, rank }: { data: LeaderboardEntryData; rank: number }) {
  const { entry, account } = data;
  const { percentile, percentileBand, metricValues, totalTrades, sampleValid } = entry;

  const getPercentileBadgeColor = (percentile: number) => {
    if (percentile <= 10) return "text-teal-400 border-teal-400/30 bg-teal-400/10";
    if (percentile <= 25) return "text-blue-400 border-blue-400/30 bg-blue-400/10";
    if (percentile <= 50) return "text-purple-400 border-purple-400/30 bg-purple-400/10";
    if (percentile <= 75) return "text-amber-400 border-amber-400/30 bg-amber-400/10";
    return "text-white/40 border-white/10 bg-white/5";
  };

  const getVerificationIcon = (level: string) => {
    switch (level) {
      case "prop_verified":
        return <CheckCircle className="size-4 text-teal-400" />;
      case "api_verified":
        return <CheckCircle className="size-4 text-blue-400" />;
      case "ea_synced":
        return <CheckCircle className="size-4 text-purple-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="border border-white/5 rounded-lg p-4 bg-sidebar hover:bg-sidebar-accent/50 transition-colors">
      <div className="flex items-center justify-between">
        {/* Account Info */}
        <div className="flex items-center gap-3 flex-1">
          <div className="text-2xl font-bold text-white/20 min-w-[3rem]">
            #{rank}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white">
                {account?.name || "Trading Account"}
              </p>
              {account?.verificationLevel && getVerificationIcon(account.verificationLevel)}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-white/40">
                {totalTrades} trades
              </p>
              {!sampleValid && (
                <span className="text-xs text-amber-400">
                  (Sample size warning)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Percentile Badge */}
        <div className="text-right">
          <div className={cn(
            "inline-block px-3 py-1.5 rounded-full border text-sm font-medium mb-1",
            getPercentileBadgeColor(percentile ?? 0)
          )}>
            {percentileBand}
          </div>
          <p className="text-xs text-white/40">
            {percentile}th percentile
          </p>
        </div>
      </div>

      {/* Metrics Preview */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {Object.entries(metricValues).slice(0, 3).map(([key, value]) => (
          <div key={key} className="p-2 rounded bg-sidebar-accent/50">
            <p className="text-xs text-white/40 capitalize">
              {key.replace(/([A-Z])/g, " $1").trim()}
            </p>
            <p className="text-sm font-medium text-white mt-0.5">
              {typeof value === "number" ? value.toFixed(2) : String(value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryDescription({ category }: { category: LeaderboardCategory }) {
  const descriptions = {
    consistency: {
      icon: <Activity className="size-5 text-teal-400" />,
      title: "Consistency Leaderboard",
      description: "Rewards median R-multiple, low drawdown, and low variance. Boring traders rank higher.",
      metrics: ["Median R", "Max Drawdown", "R Variance"],
    },
    execution: {
      icon: <Target className="size-5 text-blue-400" />,
      title: "Execution Leaderboard",
      description: "Rewards RR capture efficiency, manipulation timing, and exit quality.",
      metrics: ["RR Capture", "Manip Efficiency", "Exit Efficiency"],
    },
    discipline: {
      icon: <Shield className="size-5 text-purple-400" />,
      title: "Discipline Leaderboard",
      description: "Rewards protocol adherence, no revenge trading, and session discipline.",
      metrics: ["Protocol Rate", "Revenge Rate", "Session Adherence"],
    },
    risk: {
      icon: <TrendingDown className="size-5 text-amber-400" />,
      title: "Risk Management Leaderboard",
      description: "Rewards low drawdown, consistent risk sizing, and stop-loss adherence.",
      metrics: ["Max Drawdown", "Avg Risk", "SL Adherence"],
    },
  };

  const info = descriptions[category];

  return (
    <div className="mb-6 p-4 rounded-lg bg-sidebar border border-white/5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded bg-sidebar-accent">
          {info.icon}
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-white mb-1">
            {info.title}
          </h2>
          <p className="text-sm text-white/60 mb-3">
            {info.description}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-white/40">Key metrics:</p>
            {info.metrics.map((metric) => (
              <span
                key={metric}
                className="text-xs px-2 py-1 rounded bg-sidebar-accent/50 text-white/70"
              >
                {metric}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [category, setCategory] = React.useState<LeaderboardCategory>("consistency");
  const [period, setPeriod] = React.useState<LeaderboardPeriod>("30d");

  // Get leaderboard data
  const { data: leaderboardData, isLoading } = trpc.social.getLeaderboard.useQuery({
    category,
    period,
    limit: 100,
  });

  const periodLabels = {
    "30d": "Last 30 Days",
    "90d": "Last 90 Days",
    "all_time": "All Time",
  };

  return (
    <main className="p-6 space-y-4 py-4 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="size-6 text-teal-400" />
          <h1 className="text-2xl font-bold text-white">Leaderboards</h1>
        </div>
        <p className="text-sm text-white/60">
          Quality-based rankings that reward consistency and discipline over raw performance
        </p>
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-3 mb-6">
        <p className="text-sm text-white/60">Time period:</p>
        <Select value={period} onValueChange={(value) => setPeriod(value as LeaderboardPeriod)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30d">{periodLabels["30d"]}</SelectItem>
            <SelectItem value="90d">{periodLabels["90d"]}</SelectItem>
            <SelectItem value="all_time">{periodLabels["all_time"]}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Category Tabs */}
      <Tabs
        value={category}
        onValueChange={(value) => setCategory(value as LeaderboardCategory)}
        className="mb-6"
      >
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="consistency">
            <Activity className="size-4 mr-2" />
            Consistency
          </TabsTrigger>
          <TabsTrigger value="execution">
            <Target className="size-4 mr-2" />
            Execution
          </TabsTrigger>
          <TabsTrigger value="discipline">
            <Shield className="size-4 mr-2" />
            Discipline
          </TabsTrigger>
          <TabsTrigger value="risk">
            <TrendingDown className="size-4 mr-2" />
            Risk
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Category Description */}
      <CategoryDescription category={category} />

      {/* Leaderboard Entries */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-32 rounded-lg bg-sidebar-accent/30 animate-pulse"
            />
          ))}
        </div>
      ) : !leaderboardData || leaderboardData.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="size-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/60">No leaderboard entries yet</p>
          <p className="text-sm text-white/40 mt-1">
            Accounts need at least 100 verified trades to appear on leaderboards
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {leaderboardData.map((item, index) => (
            <LeaderboardEntryCard
              key={item.entry.id}
              data={item}
              rank={index + 1}
            />
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-8 p-4 rounded-lg bg-blue-400/10 border border-blue-400/20">
        <div className="flex items-start gap-3">
          <Clock className="size-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-200 mb-1">
              How Rankings Work
            </p>
            <ul className="text-xs text-white/60 space-y-1">
              <li>• Rankings are percentile-based, not absolute positions</li>
              <li>• Minimum 100 trades required to appear on leaderboards</li>
              <li>• Only verified accounts (EA-synced or higher) are shown</li>
              <li>• Leaderboards are recalculated daily at 3 AM UTC</li>
              <li>• Boring consistency always beats flashy gambling</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
