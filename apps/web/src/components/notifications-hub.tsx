"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Bell, Check, Dot, Newspaper, 
  TrendingUp, TrendingDown, AlertTriangle, 
  Target, Users, Settings, Activity,
  DollarSign, Trophy, MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useTRPC } from "@/utils/trpc";

type NotificationPriority = "urgent" | "high" | "normal" | "low";

type ImpactLevel = "High" | "Medium" | "Low" | "Holiday";

const priorityConfig: Record<NotificationPriority, { color: string; icon: React.ReactNode; label: string }> = {
  urgent: {
    color: "text-red-400 bg-red-500/10 border-red-500/20",
    icon: <AlertTriangle className="w-3 h-3" />,
    label: "Urgent"
  },
  high: {
    color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    icon: <Activity className="w-3 h-3" />,
    label: "High"
  },
  normal: {
    color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
    icon: <Bell className="w-3 h-3" />,
    label: "Normal"
  },
  low: {
    color: "text-white/40 bg-white/5 border-white/10",
    icon: <Dot className="w-3 h-3" />,
    label: "Low"
  }
};

function getNotificationPriority(type?: string | null): NotificationPriority {
  switch (type) {
    case "alert_triggered":
    case "prop_violation":
      return "urgent";
    case "trade_closed":
    case "goal_achieved":
    case "prop_phase_advanced":
      return "high";
    case "trade_opened":
    case "post_exit_ready":
    case "goal_progress":
      return "normal";
    default:
      return "low";
  }
}

type NotificationMetadata = {
  source?: string;
  impact?: string | null;
  country?: string | null;
  date?: string;
  title?: string;
  url?: string;
  accountId?: string;
  journalEntryId?: string;
  eventCount?: number;
  eventTitles?: string[];
};

type NotificationItem = {
  id: string;
  title: string;
  body?: string | null;
  type?: string | null;
  metadata?: NotificationMetadata | null;
  readAt?: Date | string | null;
  createdAt: Date | string;
};

type NotificationCategory = "all" | "trades" | "goals" | "alerts" | "news" | "social" | "system";

const impactBadgeClasses: Record<ImpactLevel, string> = {
  High: "bg-red-500/20 text-red-200 ring-red-500/30",
  Medium: "bg-orange-500/20 text-orange-200 ring-orange-500/30",
  Low: "bg-yellow-500/20 text-yellow-200 ring-yellow-500/30",
  Holiday: "bg-neutral-500/20 text-neutral-200 ring-neutral-500/30",
};

function normalizeImpact(impact?: string | null): ImpactLevel {
  if (!impact) return "Low";
  const trimmed = impact.trim();
  if (["High", "Medium", "Low", "Holiday"].includes(trimmed)) {
    return trimmed as ImpactLevel;
  }
  if (trimmed.toLowerCase().includes("holiday")) return "Holiday";
  if (trimmed.toLowerCase().includes("high")) return "High";
  if (trimmed.toLowerCase().includes("medium")) return "Medium";
  return "Low";
}

function formatTimestamp(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type DateGroup = "today" | "yesterday" | "thisWeek" | "older";

function getDateGroup(value: Date | string): DateGroup {
  const date = value instanceof Date ? value : new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  if (date >= today) return "today";
  if (date >= yesterday) return "yesterday";
  if (date >= weekAgo) return "thisWeek";
  return "older";
}

function groupByDate(items: NotificationItem[]): { group: DateGroup; items: NotificationItem[] }[] {
  const groups: Record<DateGroup, NotificationItem[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  };

  for (const item of items) {
    const group = getDateGroup(item.createdAt);
    groups[group].push(item);
  }

  const result: { group: DateGroup; items: NotificationItem[] }[] = [];
  if (groups.today.length > 0) result.push({ group: "today", items: groups.today });
  if (groups.yesterday.length > 0) result.push({ group: "yesterday", items: groups.yesterday });
  if (groups.thisWeek.length > 0) result.push({ group: "thisWeek", items: groups.thisWeek });
  if (groups.older.length > 0) result.push({ group: "older", items: groups.older });

  return result;
}

const dateGroupLabels: Record<DateGroup, string> = {
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "This Week",
  older: "Earlier",
};

function categorizeNotification(type?: string | null): NotificationCategory {
  if (!type) return "system";

  switch (type) {
    case "trade_closed":
    case "trade_opened":
    case "post_exit_ready":
    case "trade_imported":
      return "trades";
    case "goal_achieved":
    case "goal_progress":
      return "goals";
    case "alert_triggered":
    case "prop_violation":
    case "prop_phase_advanced":
      return "alerts";
    case "news_upcoming":
      return "news";
    case "leaderboard_update":
    case "copier_signal":
      return "social";
    case "webhook_sync":
    case "api_key":
    case "settings_updated":
    case "system_maintenance":
    case "system_update":
    default:
      return "system";
  }
}

function buildCalendarUrl(metadata?: NotificationMetadata | null) {
  if (!metadata) return "/dashboard/news";
  const params = new URLSearchParams();
  if (metadata.country) params.set("currency", metadata.country);
  if (metadata.impact) params.set("impact", metadata.impact);
  if (metadata.date) {
    params.set("start", metadata.date);
    params.set("end", metadata.date);
  }
  const qs = params.toString();
  return qs ? `/dashboard/news?${qs}` : "/dashboard/news";
}

function buildNotificationUrl(item: NotificationItem) {
  if (item.metadata?.url) {
    return item.metadata.url;
  }

  switch (item.type) {
    case "trade_closed":
    case "trade_opened":
      return "/dashboard/trades";
    case "post_exit_ready":
      return item.metadata?.journalEntryId
        ? `/dashboard/journal?entryId=${item.metadata.journalEntryId}&entryType=trade_review`
        : "/dashboard/journal?entryType=trade_review";
    case "goal_achieved":
    case "goal_progress":
      return "/dashboard/goals";
    case "prop_violation":
    case "prop_phase_advanced":
      return item.metadata?.accountId
        ? `/dashboard/prop-tracker/${item.metadata.accountId}`
        : "/dashboard/prop-tracker";
    case "alert_triggered":
      return "/dashboard/settings/alerts";
    default:
      return null;
  }
}

function NotificationsList({
  items,
  markRead,
  onNavigate,
}: {
  items: NotificationItem[];
  markRead: any;
  onNavigate: (url: string) => void;
}) {
  const groupedItems = groupByDate(items);

  return (
    <>
      {groupedItems.map((group) => (
        <div key={group.group}>
          {/* Date Group Header */}
          <div className="sticky top-0 z-10 bg-sidebar/95 backdrop-blur-sm px-3 py-1.5 border-b border-white/5">
            <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              {dateGroupLabels[group.group]}
            </span>
          </div>
          {group.items.map((item, index) => {
            const isNews = item.type === "news_upcoming";
            const targetUrl = isNews ? buildCalendarUrl(item.metadata) : buildNotificationUrl(item);
            const impact =
              isNews && item.metadata?.impact
                ? normalizeImpact(item.metadata.impact)
                : null;
            const eventCount = isNews ? (item.metadata?.eventCount ?? 1) : 0;
            const priority = getNotificationPriority(item.type);
            const priorityStyle = priorityConfig[priority];
            const isUrgent = priority === "urgent";
            const isHigh = priority === "high";

            return (
              <div key={item.id}>
                {index > 0 ? (
                  <DropdownMenuSeparator className="bg-white/5 my-1" />
                ) : null}
                <DropdownMenuItem
                  className={cn(
                    "p-2.5 flex flex-col items-start gap-1 hover:bg-sidebar-accent! rounded-sm",
                    targetUrl && "cursor-pointer",
                    isUrgent && "border-l-2 border-red-500/50 bg-red-500/5"
                  )}
                  onSelect={(event) => event.preventDefault()}
                  onClick={() => {
                    if (!item.readAt) {
                      markRead.mutate({ ids: [item.id] });
                    }
                    if (targetUrl) {
                      onNavigate(targetUrl);
                    }
                  }}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    {!item.readAt ? (
                      <Dot className={cn("size-4 shrink-0", isUrgent ? "text-red-400" : isHigh ? "text-orange-400" : "text-teal-400")} />
                    ) : (
                      <Check className="size-3.5 text-white/30 shrink-0" />
                    )}
                    {isNews && (
                      <Newspaper className="size-3.5 text-white/40 shrink-0" />
                    )}
                    {isUrgent && (
                      <AlertTriangle className="size-3.5 text-red-400 shrink-0" />
                    )}
                    {priority === "high" && !isUrgent && (
                      <Activity className="size-3.5 text-orange-400 shrink-0" />
                    )}
                    <span
                      className={cn(
                        "text-xs font-semibold flex-1",
                        item.readAt ? "text-white/50" : isUrgent ? "text-red-100" : "text-white"
                      )}
                    >
                      {item.title}
                    </span>
                    {impact && (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-sm ring px-2 py-1 text-[9px] font-medium tracking-wide shrink-0",
                          impactBadgeClasses[impact]
                        )}
                      >
                        {impact}
                      </span>
                    )}
                    {isNews && eventCount > 1 && (
                      <span className="inline-flex items-center rounded-sm bg-white/5 px-1.5 py-0.5 text-[9px] font-medium text-white/50 shrink-0">
                        {eventCount}
                      </span>
                    )}
                    {!isNews && (priority === "urgent" || priority === "high") && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[9px] font-medium shrink-0",
                          priorityStyle.color
                        )}
                      >
                        {priorityStyle.icon}
                        {priorityStyle.label}
                      </span>
                    )}
                  </div>
                  {item.body ? (
                    <span className="text-[11px] text-white/60 line-clamp-2 pl-5">
                      {item.body}
                    </span>
                  ) : null}
                  {targetUrl && (
                    <span className="text-[10px] text-teal-400/70 pl-5">
                      Click to open →
                    </span>
                  )}
                  <span className="text-[10px] text-white/40 pl-5">
                    {formatTimestamp(item.createdAt)}
                  </span>
                </DropdownMenuItem>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

export default function NotificationsHub() {
  const router = useRouter();
  const trpc = useTRPC();
  const [activeTab, setActiveTab] = useState<NotificationCategory>("all");
  const [open, setOpen] = useState(false);
  const { data: notifications = [], refetch } =
    trpc.notifications.list.useQuery(
      { limit: 25 },
      {
        refetchInterval: 15000,
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: true,
      }
    );
  const { data: preferences } = trpc.notifications.getPreferences.useQuery();
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => refetch(),
  });
  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => refetch(),
  });
  const shownRef = useRef<Set<string>>(new Set());

  const items = notifications as NotificationItem[];

  // Categorize notifications
  const categorizedNotifications = useMemo(() => {
    const categories: Record<NotificationCategory, NotificationItem[]> = {
      all: items,
      trades: items.filter(
        (item) => categorizeNotification(item.type) === "trades"
      ),
      goals: items.filter(
        (item) => categorizeNotification(item.type) === "goals"
      ),
      alerts: items.filter(
        (item) => categorizeNotification(item.type) === "alerts"
      ),
      news: items.filter(
        (item) => categorizeNotification(item.type) === "news"
      ),
      social: items.filter(
        (item) => categorizeNotification(item.type) === "social"
      ),
      system: items.filter(
        (item) => categorizeNotification(item.type) === "system"
      ),
    };
    return categories;
  }, [items]);

  // Count unread per category
  const unreadCounts = useMemo(() => {
    const counts: Record<NotificationCategory, number> = {
      all: items.filter((item) => !item.readAt).length,
      trades: categorizedNotifications.trades.filter((item) => !item.readAt)
        .length,
      goals: categorizedNotifications.goals.filter((item) => !item.readAt)
        .length,
      alerts: categorizedNotifications.alerts.filter((item) => !item.readAt)
        .length,
      news: categorizedNotifications.news.filter((item) => !item.readAt).length,
      social: categorizedNotifications.social.filter((item) => !item.readAt)
        .length,
      system: categorizedNotifications.system.filter((item) => !item.readAt)
        .length,
    };
    return counts;
  }, [items, categorizedNotifications]);

  const unreadCount = unreadCounts.all;

  const handleNavigate = (url: string) => {
    setOpen(false);
    router.push(url);
  };

  useEffect(() => {
    if (!preferences?.push) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [preferences?.push]);

  useEffect(() => {
    if (!preferences?.push) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    notifications.forEach((item) => {
      if (item.readAt) return;
      if (shownRef.current.has(item.id)) return;
      shownRef.current.add(item.id);
      const title = item.title || "Notification";
      const body = item.body || "";
      new Notification(title, { body });
    });
  }, [notifications, preferences?.push]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          className="relative ring ring-white/5 bg-sidebar hover:bg-sidebar-accent rounded-sm text-white/70 h-9 w-9 p-0 shadow-md"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white px-1">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="rounded-sm bg-sidebar border border-white/5 p-0 w-[420px] h-[480px] overflow-hidden flex flex-col"
        align="end"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <span className="text-sm font-semibold text-white/80">
            Notifications
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[10px] rounded-sm text-white/50 hover:text-white hover:bg-sidebar-accent"
              onClick={() => {
                setOpen(false);
                router.push("/dashboard/settings/notifications");
              }}
            >
              <Settings className="size-3.5 mr-1" />
              Settings
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[10px] rounded-sm text-white/50 hover:text-white hover:bg-sidebar-accent"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending || unreadCount === 0}
            >
              <Check className="size-3.5 mr-1" />
              Mark all
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as NotificationCategory)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="w-full grid grid-cols-7 rounded-none bg-sidebar border-b border-white/5 h-10 p-0 text-[10px]">
            <TabsTrigger
              value="all"
              className="rounded-none text-[10px] data-[state=active]:bg-sidebar-accent data-[state=active]:text-white relative h-10 flex items-center justify-center gap-1 px-1"
            >
              <span>All</span>
              {unreadCounts.all > 0 && (
                <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-sm bg-teal-500/20 text-[8px] font-semibold text-teal-400 px-0.5">
                  {unreadCounts.all}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="trades"
              className="rounded-none text-[10px] data-[state=active]:bg-sidebar-accent data-[state=active]:text-white relative h-10 flex items-center justify-center gap-1 px-1"
            >
              <span>Trades</span>
              {unreadCounts.trades > 0 && (
                <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-sm bg-teal-500/20 text-[8px] font-semibold text-teal-400 px-0.5">
                  {unreadCounts.trades}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="goals"
              className="rounded-none text-[10px] data-[state=active]:bg-sidebar-accent data-[state=active]:text-white relative h-10 flex items-center justify-center gap-1 px-1"
            >
              <span>Goals</span>
              {unreadCounts.goals > 0 && (
                <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-sm bg-teal-500/20 text-[8px] font-semibold text-teal-400 px-0.5">
                  {unreadCounts.goals}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="alerts"
              className="rounded-none text-[10px] data-[state=active]:bg-sidebar-accent data-[state=active]:text-white relative h-10 flex items-center justify-center gap-1 px-1"
            >
              <span>Alerts</span>
              {unreadCounts.alerts > 0 && (
                <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-sm bg-red-500/20 text-[8px] font-semibold text-red-400 px-0.5">
                  {unreadCounts.alerts}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="news"
              className="rounded-none text-[10px] data-[state=active]:bg-sidebar-accent data-[state=active]:text-white relative h-10 flex items-center justify-center gap-1 px-1"
            >
              <span>News</span>
              {unreadCounts.news > 0 && (
                <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-sm bg-teal-500/20 text-[8px] font-semibold text-teal-400 px-0.5">
                  {unreadCounts.news}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="social"
              className="rounded-none text-[10px] data-[state=active]:bg-sidebar-accent data-[state=active]:text-white relative h-10 flex items-center justify-center gap-1 px-1"
            >
              <span>Social</span>
              {unreadCounts.social > 0 && (
                <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-sm bg-teal-500/20 text-[8px] font-semibold text-teal-400 px-0.5">
                  {unreadCounts.social}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="system"
              className="rounded-none text-[10px] data-[state=active]:bg-sidebar-accent data-[state=active]:text-white relative h-10 flex items-center justify-center gap-1 px-1"
            >
              <span>System</span>
              {unreadCounts.system > 0 && (
                <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-sm bg-teal-500/20 text-[8px] font-semibold text-teal-400 px-0.5">
                  {unreadCounts.system}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto min-h-[300px]">
            <TabsContent
              value="all"
              className="m-0 p-0 overflow-x-hidden focus-visible:outline-none"
            >
              {items.length === 0 ? (
                <div className="px-3 py-12 text-xs text-white/40 text-center">
                  No notifications yet.
                </div>
              ) : (
                <NotificationsList items={items} markRead={markRead} onNavigate={handleNavigate} />
              )}
            </TabsContent>

            <TabsContent
              value="trades"
              className="m-0 p-0 overflow-x-hidden focus-visible:outline-none"
            >
              {categorizedNotifications.trades.length === 0 ? (
                <div className="px-3 py-12 text-xs text-white/40 text-center">
                  No trade notifications.
                </div>
              ) : (
                <NotificationsList
                  items={categorizedNotifications.trades}
                  markRead={markRead}
                  onNavigate={handleNavigate}
                />
              )}
            </TabsContent>

            <TabsContent
              value="system"
              className="m-0 p-0 overflow-x-hidden focus-visible:outline-none"
            >
              {categorizedNotifications.system.length === 0 ? (
                <div className="px-3 py-12 text-xs text-white/40 text-center">
                  No system notifications.
                </div>
              ) : (
                <NotificationsList
                  items={categorizedNotifications.system}
                  markRead={markRead}
                  onNavigate={handleNavigate}
                />
              )}
            </TabsContent>

            <TabsContent
              value="news"
              className="m-0 p-0 overflow-x-hidden focus-visible:outline-none"
            >
              {categorizedNotifications.news.length === 0 ? (
                <div className="px-3 py-12 text-xs text-white/40 text-center">
                  No news notifications.
                </div>
              ) : (
                <NotificationsList
                  items={categorizedNotifications.news}
                  markRead={markRead}
                  onNavigate={handleNavigate}
                />
              )}
            </TabsContent>

            <TabsContent
              value="goals"
              className="m-0 p-0 overflow-x-hidden focus-visible:outline-none"
            >
              {categorizedNotifications.goals.length === 0 ? (
                <div className="px-3 py-12 text-xs text-white/40 text-center">
                  No goal notifications.
                </div>
              ) : (
                <NotificationsList
                  items={categorizedNotifications.goals}
                  markRead={markRead}
                  onNavigate={handleNavigate}
                />
              )}
            </TabsContent>

            <TabsContent
              value="alerts"
              className="m-0 p-0 overflow-x-hidden focus-visible:outline-none"
            >
              {categorizedNotifications.alerts.length === 0 ? (
                <div className="px-3 py-12 text-xs text-white/40 text-center">
                  No alert notifications.
                </div>
              ) : (
                <NotificationsList
                  items={categorizedNotifications.alerts}
                  markRead={markRead}
                  onNavigate={handleNavigate}
                />
              )}
            </TabsContent>

            <TabsContent
              value="social"
              className="m-0 p-0 overflow-x-hidden focus-visible:outline-none"
            >
              {categorizedNotifications.social.length === 0 ? (
                <div className="px-3 py-12 text-xs text-white/40 text-center">
                  No social notifications.
                </div>
              ) : (
                <NotificationsList
                  items={categorizedNotifications.social}
                  markRead={markRead}
                  onNavigate={handleNavigate}
                />
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
