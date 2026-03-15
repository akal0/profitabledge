"use client";

import * as React from "react";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  AlertTriangle,
  Trophy,
  Filter,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isPublicAlphaFeatureEnabled } from "@/lib/alpha-flags";
import { AlphaFeatureLocked } from "@/features/platform/alpha/components/alpha-feature-locked";

type EventType =
  | "trade_closed"
  | "execution_insight"
  | "discipline_break"
  | "streak_milestone"
  | "session_summary"
  | "all";

interface FeedEventCardProps {
  event: {
    id: string;
    eventType: string;
    accountId: string;
    tradeId: string | null;
    eventData: any;
    caption: string | null;
    createdAt: Date | string;
    isVisible: boolean | null;
  };
  account: {
    id: string;
    name: string;
    verificationLevel: string | null;
    followerCount: number | null;
  };
  owner: {
    id: string;
    name: string;
    username: string | null;
    isVerified: boolean | null;
    verifiedSince: string | null;
  };
}

function FeedEventCard({ event, account }: FeedEventCardProps) {
  const { eventType, eventData, caption, createdAt } = event;

  const getEventIcon = () => {
    switch (eventType) {
      case "trade_closed":
        return eventData.outcome === "Win" ? (
          <TrendingUp className="size-5 text-teal-400" />
        ) : (
          <TrendingDown className="size-5 text-red-400" />
        );
      case "execution_insight":
        return <Target className="size-5 text-amber-400" />;
      case "discipline_break":
        return <AlertTriangle className="size-5 text-orange-400" />;
      case "streak_milestone":
        return <Trophy className="size-5 text-purple-400" />;
      case "session_summary":
        return <Activity className="size-5 text-blue-400" />;
      default:
        return <Activity className="size-5 text-white/40" />;
    }
  };

  const getVerificationBadge = (level: string) => {
    const badges = {
      prop_verified: { text: "Prop Verified", color: "text-teal-400 border-teal-400/30 bg-teal-400/10" },
      api_verified: { text: "API Verified", color: "text-blue-400 border-blue-400/30 bg-blue-400/10" },
      ea_synced: { text: "EA Synced", color: "text-purple-400 border-purple-400/30 bg-purple-400/10" },
      unverified: { text: "Unverified", color: "text-white/40 border-white/10 bg-white/5" },
    };
    const badge = badges[level as keyof typeof badges] || badges.unverified;
    return (
      <span className={cn("text-xs px-2 py-0.5 rounded border", badge.color)}>
        {badge.text}
      </span>
    );
  };

  const formatTimestamp = (date: Date | string) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="border border-white/5 rounded-lg p-4 bg-sidebar hover:bg-sidebar-accent/50 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-sidebar-accent">
            {getEventIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white">
                {account?.name || "Trading Account"}
              </p>
              {account?.verificationLevel && getVerificationBadge(account.verificationLevel)}
            </div>
            <p className="text-xs text-white/40 mt-0.5">
              {formatTimestamp(createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Caption */}
      {caption && (
        <p className="text-sm text-white/80 mb-3">
          {caption}
        </p>
      )}

      {/* Event-specific content */}
      {eventType === "trade_closed" && (
        <div className="grid grid-cols-4 gap-3 p-3 rounded bg-sidebar-accent/50">
          <div>
            <p className="text-xs text-white/40">Symbol</p>
            <p className="text-sm font-medium text-white">{eventData.symbol}</p>
          </div>
          <div>
            <p className="text-xs text-white/40">Outcome</p>
            <p className={cn(
              "text-sm font-medium",
              eventData.outcome === "Win" ? "text-teal-400" : "text-red-400"
            )}>
              {eventData.outcome}
            </p>
          </div>
          <div>
            <p className="text-xs text-white/40">R-Multiple</p>
            <p className={cn(
              "text-sm font-medium",
              eventData.rMultiple >= 0 ? "text-teal-400" : "text-red-400"
            )}>
              {eventData.rMultiple}R
            </p>
          </div>
          <div>
            <p className="text-xs text-white/40">Hold Time</p>
            <p className="text-sm font-medium text-white">{eventData.holdTime}</p>
          </div>
        </div>
      )}

      {eventType === "execution_insight" && (
        <div className="p-3 rounded bg-amber-400/10 border border-amber-400/20">
          <p className="text-sm text-amber-200">
            Missed {eventData.missedR}R potential on {eventData.symbol}
          </p>
          <p className="text-xs text-white/50 mt-1">
            Exit efficiency: {eventData.exitEfficiency}%
          </p>
        </div>
      )}

      {eventType === "discipline_break" && (
        <div className="p-3 rounded bg-orange-400/10 border border-orange-400/20">
          <p className="text-sm text-orange-200">
            Protocol violation: {eventData.violationType}
          </p>
          {eventData.details && (
            <p className="text-xs text-white/50 mt-1">{eventData.details}</p>
          )}
        </div>
      )}

      {eventType === "streak_milestone" && (
        <div className="p-3 rounded bg-purple-400/10 border border-purple-400/20">
          <p className="text-sm text-purple-200">
            {eventData.streakLength} {eventData.streakType} streak
          </p>
          <p className="text-xs text-white/50 mt-1">
            Total R: {eventData.totalR}R
          </p>
        </div>
      )}

      {eventType === "session_summary" && (
        <div className="grid grid-cols-3 gap-3 p-3 rounded bg-sidebar-accent/50">
          <div>
            <p className="text-xs text-white/40">Win Rate</p>
            <p className="text-sm font-medium text-white">{eventData.winRate}%</p>
          </div>
          <div>
            <p className="text-xs text-white/40">Total R</p>
            <p className={cn(
              "text-sm font-medium",
              eventData.totalR >= 0 ? "text-teal-400" : "text-red-400"
            )}>
              {eventData.totalR}R
            </p>
          </div>
          <div>
            <p className="text-xs text-white/40">Trades</p>
            <p className="text-sm font-medium text-white">{eventData.tradeCount}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FeedPage() {
  const communityEnabled = isPublicAlphaFeatureEnabled("community");

  const [selectedEventType, setSelectedEventType] = React.useState<EventType>("all");
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Get public feed (following feed would require account follow state)
  const { data: feedData, isLoading, refetch } = trpc.social.getPublicFeed.useQuery({
    limit: 50,
    offset: 0,
    verificationLevel: "ea_synced", // Minimum verification level
  }, {
    enabled: communityEnabled,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const filteredEvents = React.useMemo(() => {
    if (!feedData) return [];
    if (selectedEventType === "all") return feedData;
    return feedData.filter((item) => item.event.eventType === selectedEventType);
  }, [feedData, selectedEventType]);

  if (!communityEnabled) {
    return (
      <AlphaFeatureLocked
        feature="community"
        title="Community feed is held back in this alpha"
      />
    );
  }

  return (
    <main className="p-6 space-y-4 py-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Trade Feed</h1>
          <p className="text-sm text-white/60">
            Live updates from verified trading accounts
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("size-4 mr-2", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Filter Tabs */}
      <Tabs
        value={selectedEventType}
        onValueChange={(value) => setSelectedEventType(value as EventType)}
        className="mb-6"
      >
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="trade_closed">Trades</TabsTrigger>
          <TabsTrigger value="execution_insight">Insights</TabsTrigger>
          <TabsTrigger value="discipline_break">Discipline</TabsTrigger>
          <TabsTrigger value="streak_milestone">Streaks</TabsTrigger>
          <TabsTrigger value="session_summary">Sessions</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Feed Events */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-40 rounded-lg bg-sidebar-accent/30 animate-pulse"
            />
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="size-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/60">No feed events yet</p>
          <p className="text-sm text-white/40 mt-1">
            Follow verified accounts to see their trading activity
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((item) => (
            <FeedEventCard key={item.event.id} event={item.event} account={item.account} owner={item.owner} />
          ))}
        </div>
      )}
    </main>
  );
}
