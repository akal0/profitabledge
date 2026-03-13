"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Dot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsListUnderlined,
  TabsTriggerUnderlined,
} from "@/components/ui/tabs";
import { useTRPC } from "@/utils/trpc";

type NotificationPriority = "urgent" | "high" | "normal" | "low";

type ImpactLevel = "High" | "Medium" | "Low" | "Holiday";

type KnownNotificationType =
  | "trade_closed"
  | "trade_opened"
  | "post_exit_ready"
  | "webhook_sync"
  | "news_upcoming"
  | "trade_imported"
  | "api_key"
  | "settings_updated"
  | "goal_achieved"
  | "goal_progress"
  | "achievement_earned"
  | "alert_triggered"
  | "prop_violation"
  | "prop_journey"
  | "prop_phase_advanced"
  | "leaderboard_update"
  | "copier_signal"
  | "system_maintenance"
  | "system_update";

type NotificationTab =
  | "all"
  | "trades"
  | "review-ready"
  | "goals"
  | "alerts"
  | "news"
  | "social"
  | "system";

type FilterableNotificationTab = Exclude<NotificationTab, "all">;

const priorityConfig: Record<
  NotificationPriority,
  { color: string; label: string }
> = {
  urgent: {
    color: "text-red-400 bg-red-500/10 border-red-500/20",
    label: "Urgent",
  },
  high: {
    color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    label: "High",
  },
  normal: {
    color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
    label: "Normal",
  },
  low: {
    color: "text-white/40 bg-white/5 border-white/10",
    label: "Low",
  },
};

function getNotificationPriority(type?: string | null): NotificationPriority {
  switch (type) {
    case "alert_triggered":
    case "prop_violation":
      return "urgent";
    case "prop_journey":
      return "normal";
    case "trade_closed":
    case "goal_achieved":
    case "achievement_earned":
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
  accountNumber?: string;
  broker?: string;
  journalEntryId?: string;
  journalEntryIds?: string[];
  linkedTradeIds?: string[];
  eventCount?: number;
  eventTitles?: string[];
  count?: number;
  fromWebhook?: number;
  backfilled?: number;
  reviewCount?: number;
  keyId?: string;
  keyPrefix?: string;
  name?: string;
  previousName?: string;
  expiresAt?: Date | string | null;
  updatedFields?: string[];
  ruleCount?: number;
  alertType?: string;
  severity?: string;
  currentValue?: number;
  thresholdValue?: number;
  tickets?: string[];
  balance?: number;
  equity?: number;
  phaseOrder?: number;
  nextPhase?: number;
  theme?: string | null;
};

function isFundedPropNotification(item: NotificationItem) {
  return (
    item.type === "prop_phase_advanced" &&
    (item.metadata?.theme === "gold" || item.metadata?.nextPhase === 0)
  );
}

type NotificationItem = {
  id: string;
  title: string;
  body?: string | null;
  type?: string | null;
  metadata?: NotificationMetadata | null;
  readAt?: Date | string | null;
  createdAt: Date | string;
};

const NOTIFICATION_TABS = [
  "all",
  "trades",
  "review-ready",
  "goals",
  "alerts",
  "news",
  "social",
  "system",
] as const satisfies readonly NotificationTab[];

const knownNotificationTypes = [
  "trade_closed",
  "trade_opened",
  "post_exit_ready",
  "webhook_sync",
  "news_upcoming",
  "trade_imported",
  "api_key",
  "settings_updated",
  "goal_achieved",
  "goal_progress",
  "achievement_earned",
  "alert_triggered",
  "prop_violation",
  "prop_journey",
  "prop_phase_advanced",
  "leaderboard_update",
  "copier_signal",
  "system_maintenance",
  "system_update",
] as const satisfies readonly KnownNotificationType[];

const notificationTabLabels: Record<NotificationTab, string> = {
  all: "All",
  trades: "Trades",
  "review-ready": "Review ready",
  goals: "Goals",
  alerts: "Alerts",
  news: "News",
  social: "Social",
  system: "System",
};

const notificationTabEmptyStates: Record<NotificationTab, string> = {
  all: "No notifications yet.",
  trades:
    "No trade notifications. Closed trades, imports, and execution updates will land here.",
  "review-ready":
    "No review-ready notifications. Auto-generated post-trade reviews will show up here.",
  goals:
    "No goal notifications. Goal milestones, achievements, and progress updates will land here.",
  alerts:
    "No alert notifications. Triggered alerts and prop-account violations will land here.",
  news: "No news notifications. Economic calendar events and impact updates will land here.",
  social:
    "No social notifications. Copier signals and leaderboard activity will land here.",
  system:
    "No system notifications. Sync status, API keys, settings changes, and platform updates will land here.",
};

const notificationTabBadgeClasses: Record<NotificationTab, string> = {
  all: "bg-teal-500/15 text-teal-300",
  trades: "bg-white/5 text-white/60",
  "review-ready": "bg-teal-500/15 text-teal-300",
  goals: "bg-emerald-500/15 text-emerald-300",
  alerts: "bg-red-500/15 text-red-300",
  news: "bg-amber-500/15 text-amber-300",
  social: "bg-sky-500/15 text-sky-300",
  system: "bg-white/5 text-white/60",
};

const notificationTypePrimaryTab: Record<
  KnownNotificationType,
  FilterableNotificationTab
> = {
  trade_closed: "trades",
  trade_opened: "trades",
  post_exit_ready: "review-ready",
  webhook_sync: "system",
  news_upcoming: "news",
  trade_imported: "trades",
  api_key: "system",
  settings_updated: "system",
  goal_achieved: "goals",
  goal_progress: "goals",
  achievement_earned: "goals",
  alert_triggered: "alerts",
  prop_violation: "alerts",
  prop_journey: "alerts",
  prop_phase_advanced: "alerts",
  leaderboard_update: "social",
  copier_signal: "social",
  system_maintenance: "system",
  system_update: "system",
};

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

function groupByDate(
  items: NotificationItem[]
): { group: DateGroup; items: NotificationItem[] }[] {
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
  if (groups.today.length > 0)
    result.push({ group: "today", items: groups.today });
  if (groups.yesterday.length > 0)
    result.push({ group: "yesterday", items: groups.yesterday });
  if (groups.thisWeek.length > 0)
    result.push({ group: "thisWeek", items: groups.thisWeek });
  if (groups.older.length > 0)
    result.push({ group: "older", items: groups.older });

  return result;
}

const dateGroupLabels: Record<DateGroup, string> = {
  today: "today",
  yesterday: "yesterday",
  thisWeek: "this week",
  older: "earlier",
};

function isKnownNotificationType(
  type?: string | null
): type is KnownNotificationType {
  return Boolean(
    type && knownNotificationTypes.includes(type as KnownNotificationType)
  );
}

function getNotificationPrimaryTab(
  type?: string | null
): FilterableNotificationTab {
  if (!isKnownNotificationType(type)) {
    return "system";
  }

  return notificationTypePrimaryTab[type];
}

function buildReviewReadyUrl(item: NotificationItem) {
  if (item.metadata?.url?.startsWith("/dashboard/journal")) {
    const [path, rawQuery] = item.metadata.url.split("?");
    const params = new URLSearchParams(rawQuery ?? "");

    if (!params.has("tab")) {
      params.set("tab", "review-ready");
    }

    const query = params.toString();
    return query ? `${path}?${query}` : path;
  }

  return item.metadata?.journalEntryId
    ? `/dashboard/journal?tab=review-ready&entryId=${item.metadata.journalEntryId}&entryType=trade_review`
    : "/dashboard/journal?tab=review-ready&entryType=trade_review";
}

function buildSettingsUpdatedUrl(metadata?: NotificationMetadata | null) {
  if (metadata?.alertType || metadata?.severity) {
    return "/dashboard/settings/alerts";
  }

  if (typeof metadata?.ruleCount === "number") {
    return "/dashboard/settings/compliance";
  }

  if (Array.isArray(metadata?.updatedFields) && metadata.updatedFields.length) {
    return "/dashboard/settings/metrics";
  }

  if (metadata?.broker || metadata?.accountNumber) {
    return "/dashboard/settings/connections";
  }

  return "/dashboard/settings";
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
  if (item.type === "post_exit_ready") {
    return buildReviewReadyUrl(item);
  }

  if (item.metadata?.url) {
    return item.metadata.url;
  }

  switch (item.type) {
    case "trade_closed":
    case "trade_opened":
    case "trade_imported":
      return "/dashboard/trades";
    case "goal_achieved":
    case "goal_progress":
      return "/dashboard/goals";
    case "achievement_earned":
      return "/dashboard/achievements";
    case "prop_violation":
    case "prop_journey":
    case "prop_phase_advanced":
      return item.metadata?.accountId
        ? `/dashboard/prop-tracker/${item.metadata.accountId}`
        : "/dashboard/prop-tracker";
    case "alert_triggered":
      return "/dashboard/settings/alerts";
    case "leaderboard_update":
      return "/dashboard/leaderboard";
    case "copier_signal":
      return "/dashboard/copier";
    case "api_key":
      return "/dashboard/settings/api";
    case "webhook_sync":
      return "/dashboard/settings/connections";
    case "settings_updated":
      return buildSettingsUpdatedUrl(item.metadata);
    case "system_maintenance":
    case "system_update":
      return "/dashboard/settings/notifications";
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
      {groupedItems.map((group, groupIndex) => (
        <div key={group.group}>
          {groupIndex > 0 && <Separator />}
          {/* Date Group Header */}
          <div className="sticky top-0 z-10 bg-sidebar/95 backdrop-blur-sm px-3 py-1.5">
            <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              {dateGroupLabels[group.group]}
            </span>
          </div>
          <Separator />
          <div className="px-1.5 py-1">
            {group.items.map((item, index) => {
              const isNews = item.type === "news_upcoming";
              const targetUrl = isNews
                ? buildCalendarUrl(item.metadata)
                : buildNotificationUrl(item);
              const impact =
                isNews && item.metadata?.impact
                  ? normalizeImpact(item.metadata.impact)
                  : null;
              const eventCount = isNews ? item.metadata?.eventCount ?? 1 : 0;
              const priority = getNotificationPriority(item.type);
              const priorityStyle = priorityConfig[priority];
              const isUrgent = priority === "urgent";
              const isHigh = priority === "high";
              const isFundedMilestone = isFundedPropNotification(item);

              return (
                <div key={item.id}>
                  {index > 0 ? (
                    <div className="-mx-1.5 my-1">
                      <Separator />
                    </div>
                  ) : null}
                  <DropdownMenuItem
                    className={cn(
                      "p-2.5 flex flex-col items-start gap-1 hover:bg-sidebar-accent! rounded-sm",
                      targetUrl && "cursor-pointer",
                      isUrgent && "border-l-2 border-red-500/50 bg-red-500/5",
                      isFundedMilestone &&
                        " border-amber-400/50 bg-amber-400/8 hover:bg-amber-400/15!"
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
                        <Dot
                          className={cn(
                            "size-4 shrink-0",
                            isUrgent
                              ? "text-red-400"
                              : isFundedMilestone
                              ? "text-amber-300"
                              : isHigh
                              ? "text-orange-400"
                              : "text-teal-400"
                          )}
                        />
                      ) : (
                        <Check className="size-3.5 text-white/30 shrink-0" />
                      )}
                      <span
                        className={cn(
                          "text-xs font-semibold flex-1",
                          item.readAt
                            ? "text-white/50"
                            : isUrgent
                            ? "text-red-100"
                            : isFundedMilestone
                            ? "text-amber-100"
                            : "text-white"
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
                      {!isNews &&
                        (isFundedMilestone ||
                          priority === "urgent" ||
                          priority === "high") && (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[9px] font-medium shrink-0",
                              isFundedMilestone
                                ? "border border-amber-300/25 bg-amber-300/10 text-amber-100"
                                : priorityStyle.color
                            )}
                          >
                            {isFundedMilestone ? "Funded" : priorityStyle.label}
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
        </div>
      ))}
    </>
  );
}

function NotificationTabPanel({
  value,
  items,
  emptyMessage,
  markRead,
  onNavigate,
}: {
  value: NotificationTab;
  items: NotificationItem[];
  emptyMessage: string;
  markRead: any;
  onNavigate: (url: string) => void;
}) {
  return (
    <TabsContent
      value={value}
      className="m-0 p-0 overflow-x-hidden focus-visible:outline-none"
    >
      {items.length === 0 ? (
        <div className="px-3 py-12 text-center text-xs text-white/40">
          {emptyMessage}
        </div>
      ) : (
        <NotificationsList
          items={items}
          markRead={markRead}
          onNavigate={onNavigate}
        />
      )}
    </TabsContent>
  );
}

export default function NotificationsHub() {
  const router = useRouter();
  const trpc = useTRPC();
  const [activeTab, setActiveTab] = useState<NotificationTab>("all");
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

  const notificationsByTab = useMemo(() => {
    const grouped: Record<NotificationTab, NotificationItem[]> = {
      all: items,
      trades: [],
      "review-ready": [],
      goals: [],
      alerts: [],
      news: [],
      social: [],
      system: [],
    };

    for (const item of items) {
      grouped[getNotificationPrimaryTab(item.type)].push(item);
    }

    return grouped;
  }, [items]);

  const unreadCounts = useMemo(() => {
    const counts: Record<NotificationTab, number> = {
      all: items.filter((item) => !item.readAt).length,
      trades: notificationsByTab.trades.filter((item) => !item.readAt).length,
      "review-ready": notificationsByTab["review-ready"].filter(
        (item) => !item.readAt
      ).length,
      goals: notificationsByTab.goals.filter((item) => !item.readAt).length,
      alerts: notificationsByTab.alerts.filter((item) => !item.readAt).length,
      news: notificationsByTab.news.filter((item) => !item.readAt).length,
      social: notificationsByTab.social.filter((item) => !item.readAt).length,
      system: notificationsByTab.system.filter((item) => !item.readAt).length,
    };
    return counts;
  }, [items, notificationsByTab]);

  const unreadCount = items.filter((item) => !item.readAt).length;

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
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-white/80">
            Notifications
          </span>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px] rounded-sm text-white/50 hover:text-white hover:bg-sidebar-accent"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending || unreadCount === 0}
          >
            <Check className="size-3" />
            Mark all
          </Button>
        </div>
        <Separator />

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            if (NOTIFICATION_TABS.includes(value as NotificationTab)) {
              setActiveTab(value as NotificationTab);
            }
          }}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="shrink-0">
            <div className="overflow-x-auto px-4 overscroll-x-contain">
              <TabsListUnderlined className="inline-flex h-auto min-w-max items-stretch gap-5 border-b-0 pr-4">
                {NOTIFICATION_TABS.map((tab) => {
                  const unread = unreadCounts[tab];

                  return (
                    <TabsTriggerUnderlined
                      key={tab}
                      value={tab}
                      className="h-10 shrink-0 gap-2 pb-0 pt-0 text-xs font-medium text-white/50 hover:text-white/80 data-[state=active]:border-teal-400 data-[state=active]:text-teal-400"
                    >
                      <span>{notificationTabLabels[tab]}</span>
                      {unread > 0 ? (
                        <span
                          className={cn(
                            "flex h-4 min-w-4 items-center justify-center rounded-sm px-1 text-[9px] font-semibold",
                            notificationTabBadgeClasses[tab]
                          )}
                        >
                          {unread > 9 ? "9+" : unread}
                        </span>
                      ) : null}
                    </TabsTriggerUnderlined>
                  );
                })}
              </TabsListUnderlined>
            </div>
            <Separator />
          </div>

          <div className="flex-1 overflow-auto min-h-[300px]">
            {NOTIFICATION_TABS.map((tab) => (
              <NotificationTabPanel
                key={tab}
                value={tab}
                items={notificationsByTab[tab]}
                emptyMessage={notificationTabEmptyStates[tab]}
                markRead={markRead}
                onNavigate={handleNavigate}
              />
            ))}
          </div>
        </Tabs>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
