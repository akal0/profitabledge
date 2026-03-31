"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildNotificationPresentation,
  resolveNotificationTargetUrl,
} from "@profitabledge/platform";
import { Bell, Check, Dot } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { publicAlphaFlags } from "@/lib/alpha-flags";
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
import { queryClient, trpcOptions, useTRPC } from "@/utils/trpc";
import {
  ensureWebPushSubscription,
  showDesktopNotification,
} from "@/lib/push-notifications";
import { getNotificationBrandAsset } from "@/components/notifications/notification-branding";
import {
  buildNotificationToastId,
  showAppNotificationToast,
} from "@/components/notifications/notification-toast";

type NotificationPriority = "urgent" | "high" | "normal" | "low";

type ImpactLevel = "High" | "Medium" | "Low" | "Holiday";

const priorityConfig: Record<
  NotificationPriority,
  { color: string; label: string }
> = {
  urgent: {
    color: "text-red-400 bg-red-500/10 ring-red-500/20",
    label: "Urgent",
  },
  high: {
    color: "text-orange-400 bg-orange-500/10 ring-orange-500/20",
    label: "High",
  },
  normal: {
    color: "text-teal-400 bg-teal-500/10 ring-teal-500/20",
    label: "Normal",
  },
  low: {
    color: "text-white/40 bg-white/5 ring-white/10",
    label: "Low",
  },
};

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
  | "edge_invite"
  | "journal_share_request"
  | "journal_share_invite"
  | "journal_share_accepted"
  | "journal_share_declined"
  | "leaderboard_update"
  | "system_maintenance"
  | "system_update";

type NotificationTab =
  | "all"
  | "trades"
  | "goals"
  | "alerts"
  | "news"
  | "social"
  | "system";

type FilterableNotificationTab = Exclude<NotificationTab, "all">;

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
    case "edge_invite":
    case "journal_share_request":
    case "journal_share_invite":
    case "journal_share_accepted":
    case "journal_share_declined":
      return "normal";
    default:
      return "low";
  }
}

type NotificationMetadata = {
  kind?: string | null;
  source?: string;
  impact?: string | null;
  country?: string | null;
  date?: string;
  title?: string;
  url?: string;
  shareId?: string;
  shareToken?: string;
  sharePath?: string;
  inviteId?: string;
  requestId?: string;
  inviterUserId?: string;
  viewerUserId?: string;
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
  status?: string | null;
  provider?: string | null;
  displayName?: string | null;
  tradesInserted?: number;
  tradesDuplicated?: number;
  accountName?: string | null;
  initialBalance?: number;
  currencyCode?: string | null;
  pnl?: number;
  returnPct?: number;
  reviewedLabel?: string | null;
  tradeCount?: number;
  winRate?: number;
  weeklyPnL?: number;
  focusTitle?: string | null;
  data?: Record<string, unknown> | null;
  [key: string]: unknown;
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
  "goals",
  "alerts",
  "news",
  "social",
  "system",
] as const satisfies readonly NotificationTab[];

const SHOW_SOCIAL_NOTIFICATIONS = publicAlphaFlags.community;
const VISIBLE_NOTIFICATION_TABS: readonly NotificationTab[] =
  SHOW_SOCIAL_NOTIFICATIONS
    ? NOTIFICATION_TABS
    : NOTIFICATION_TABS.filter((tab) => tab !== "social");

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
  "edge_invite",
  "journal_share_request",
  "journal_share_invite",
  "journal_share_accepted",
  "journal_share_declined",
  "leaderboard_update",
  "system_maintenance",
  "system_update",
] as const satisfies readonly KnownNotificationType[];

const notificationTabLabels: Record<NotificationTab, string> = {
  all: "All",
  trades: "Trades",
  goals: "Goals",
  alerts: "Alerts",
  news: "Calendar",
  social: "Social",
  system: "System",
};

const notificationTabEmptyStates: Record<NotificationTab, string> = {
  all: "No notifications yet.",
  trades:
    "No trade notifications. Closed trades, imports, and execution updates will land here.",
  goals:
    "No goal notifications. Goal milestones, achievements, and progress updates will land here.",
  alerts:
    "No alert notifications. Triggered alerts and prop-account violations will land here.",
  news: "No calendar notifications. Economic events and impact updates will land here.",
  social:
    "No social notifications. Copier signals and leaderboard activity will land here.",
  system:
    "No system notifications. Sync status, API keys, settings changes, and platform updates will land here.",
};

const notificationTabBadgeClasses: Record<NotificationTab, string> = {
  all: "bg-teal-500/15 text-teal-300",
  trades: "bg-white/5 text-white/60",
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
  post_exit_ready: "trades",
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
  edge_invite: "system",
  journal_share_request: "system",
  journal_share_invite: "system",
  journal_share_accepted: "system",
  journal_share_declined: "system",
  leaderboard_update: "social",
  system_maintenance: "system",
  system_update: "system",
};

const primaryActionButtonClass =
  "rounded-sm bg-teal-500/18 ring-teal-500/30 px-2 text-[10px] text-teal-100 hover:bg-teal-500/24 h-max py-1";
const destructiveActionButtonClass =
  "rounded-sm bg-rose-500/16 ring-rose-500/30 px-2 text-[10px] text-rose-100 hover:bg-rose-500/22 h-max py-1";

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
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "This week",
  older: "Earlier",
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

function buildNotificationUrl(item: NotificationItem) {
  return resolveNotificationTargetUrl({
    type: item.type,
    metadata: item.metadata ?? null,
  });
}

function getNotificationTargetUrl(item: NotificationItem) {
  return buildNotificationUrl(item);
}

function getNotificationToastTargetUrl(item: NotificationItem) {
  const targetUrl = getNotificationTargetUrl(item);
  if (!targetUrl) {
    return null;
  }

  if (
    (item.type === "system_update" || item.type === "system_maintenance") &&
    !item.metadata?.url
  ) {
    return null;
  }

  return targetUrl;
}

function isJournalShareInviteActionable(item: NotificationItem) {
  return (
    item.type === "journal_share_invite" &&
    !item.readAt &&
    typeof item.metadata?.inviteId === "string" &&
    item.metadata.inviteId.length > 0
  );
}

function showNotificationToast(
  item: NotificationItem,
  options: {
    onNavigate: (url: string) => void;
    onMarkRead: (id: string) => void;
  }
) {
  const targetUrl = getNotificationToastTargetUrl(item);
  const metadata = (item.metadata as Record<string, unknown> | null) ?? null;
  const resolvedToastId = buildNotificationToastId({
    title: item.title,
    type: item.type,
    metadata,
    fallbackId: item.id,
  });

  showAppNotificationToast({
    title: item.title,
    body: item.body,
    type: item.type,
    metadata,
    createdAt: item.createdAt,
    readAt: item.readAt,
    toastId: resolvedToastId,
    duration: getNotificationPriority(item.type) === "urgent" ? 12000 : 8000,
    action: targetUrl
      ? {
          kind: "navigate",
          label: "Open notification destination",
          onClick: () => {
            if (!item.readAt) {
              options.onMarkRead(item.id);
            }
            if (resolvedToastId) {
              toast.dismiss(resolvedToastId);
            }
            options.onNavigate(targetUrl);
          },
        }
      : undefined,
  });
}

function shouldRequireDesktopInteraction(type?: string | null) {
  return type === "alert_triggered" || type === "prop_violation";
}

type InviteActionState = {
  inviteId: string;
  action: "accept" | "decline";
} | null;

function NotificationsList({
  items,
  markRead,
  onNavigate,
  inviteActionState,
  onAcceptInvite,
  onDeclineInvite,
}: {
  items: NotificationItem[];
  markRead: any;
  onNavigate: (url: string) => void;
  inviteActionState: InviteActionState;
  onAcceptInvite: (item: NotificationItem) => void;
  onDeclineInvite: (item: NotificationItem) => void;
}) {
  const groupedItems = groupByDate(items);

  return (
    <>
      {groupedItems.map((group, groupIndex) => (
        <div key={group.group}>
          {groupIndex > 0 && <Separator />}
          {/* Date Group Header */}
          <div className="sticky top-0 z-10 bg-sidebar/95 backdrop-blur-sm px-3 py-1.5">
            <span className="text-[10px] font-semibold text-white/40 normal-case">
              {dateGroupLabels[group.group]}
            </span>
          </div>
          <Separator />
          <div className="px-1.5 py-1">
            {group.items.map((item, index) => {
              const isNews = item.type === "news_upcoming";
              const targetUrl = getNotificationTargetUrl(item);
              const isActionableInvite = isJournalShareInviteActionable(item);
              const inviteId = item.metadata?.inviteId;
              const canClickThrough = Boolean(targetUrl) && !isActionableInvite;
              const isAcceptingInvite =
                inviteId &&
                inviteActionState?.inviteId === inviteId &&
                inviteActionState.action === "accept";
              const isDecliningInvite =
                inviteId &&
                inviteActionState?.inviteId === inviteId &&
                inviteActionState.action === "decline";
              const isInviteActionPending =
                inviteActionState !== null &&
                inviteActionState.inviteId === inviteId;
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
                      canClickThrough && "cursor-pointer",
                      isUrgent &&
                        "ring ring-red-500/25 bg-red-500/5 hover:bg-red-500/10! transition duration-250",
                      isFundedMilestone &&
                        " ring-amber-400/50 bg-amber-400/8 hover:bg-amber-400/15!"
                    )}
                    onSelect={(event) => event.preventDefault()}
                    onClick={() => {
                      if (!canClickThrough) {
                        return;
                      }
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
                                ? "ring ring-amber-300/25 bg-amber-300/10 text-amber-100"
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
                    {canClickThrough && (
                      <span className="text-[10px] text-teal-400/70 pl-5">
                        Click to open →
                      </span>
                    )}
                    <div className="flex w-full items-center justify-between gap-3 pl-5">
                      <span className="text-[10px] text-white/40">
                        {formatTimestamp(item.createdAt)}
                      </span>
                      {isActionableInvite ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button
                            size="sm"
                            className={destructiveActionButtonClass}
                            disabled={isInviteActionPending}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              onDeclineInvite(item);
                            }}
                          >
                            {isDecliningInvite ? "Declining..." : "Decline"}
                          </Button>

                          <Button
                            size="sm"
                            className={primaryActionButtonClass}
                            disabled={isInviteActionPending}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              onAcceptInvite(item);
                            }}
                          >
                            {isAcceptingInvite ? "Accepting..." : "Accept"}
                          </Button>
                        </div>
                      ) : null}
                    </div>
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
  inviteActionState,
  onAcceptInvite,
  onDeclineInvite,
}: {
  value: NotificationTab;
  items: NotificationItem[];
  emptyMessage: string;
  markRead: any;
  onNavigate: (url: string) => void;
  inviteActionState: InviteActionState;
  onAcceptInvite: (item: NotificationItem) => void;
  onDeclineInvite: (item: NotificationItem) => void;
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
          inviteActionState={inviteActionState}
          onAcceptInvite={onAcceptInvite}
          onDeclineInvite={onDeclineInvite}
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
  const [inviteActionState, setInviteActionState] =
    useState<InviteActionState>(null);
  const inactivePollingIntervalMs = 60_000;
  const activePollingIntervalMs = 15_000;
  const { data: notifications = [], isFetched: hasFetchedNotifications } =
    trpc.notifications.list.useQuery(
      { limit: 25 },
      {
        refetchInterval: open
          ? activePollingIntervalMs
          : inactivePollingIntervalMs,
        refetchIntervalInBackground: open,
        refetchOnWindowFocus: open,
      }
    );
  type NotificationQueryItem = (typeof notifications)[number];
  const { data: preferences } = trpc.notifications.getPreferences.useQuery();
  const notificationsQueryKey = trpcOptions.notifications.list.queryOptions({
    limit: 25,
  }).queryKey;
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      const readAt = new Date().toISOString();
      const current =
        (queryClient.getQueryData(notificationsQueryKey) as
          | NotificationQueryItem[]
          | undefined) ?? [];
      queryClient.setQueryData(
        notificationsQueryKey,
        current.map((item) => ({
          ...item,
          readAt: item.readAt ?? readAt,
        }))
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: notificationsQueryKey,
        refetchType: "active",
      });
    },
  });
  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: (_data, variables) => {
      const readAt = new Date().toISOString();
      const readIds = new Set(variables.ids);
      const current =
        (queryClient.getQueryData(notificationsQueryKey) as
          | NotificationQueryItem[]
          | undefined) ?? [];
      queryClient.setQueryData(
        notificationsQueryKey,
        current.map((item) =>
          readIds.has(item.id)
            ? { ...item, readAt: item.readAt ?? readAt }
            : item
        )
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: notificationsQueryKey,
        refetchType: "active",
      });
    },
  });
  const acceptInvite = trpc.journal.shares.acceptInvite.useMutation();
  const declineInvite = trpc.journal.shares.declineInvite.useMutation();
  const deliveredRef = useRef<Set<string>>(new Set());
  const initializedDeliveryRef = useRef(false);

  const items = useMemo(
    () => (notifications as NotificationItem[] | undefined) ?? [],
    [notifications]
  );
  const canUseInAppChannel = preferences?.inApp ?? true;
  const canUsePushChannel = preferences?.push === true;
  const {
    visibleItems,
    allUnreadItems,
    unreadItems,
    notificationsByTab,
    unreadCounts,
    unreadCount,
  } = useMemo(() => {
    const visibleItems = canUseInAppChannel ? items : [];
    const grouped: Record<NotificationTab, NotificationItem[]> = {
      all: visibleItems,
      trades: [],
      goals: [],
      alerts: [],
      news: [],
      social: [],
      system: [],
    };

    for (const item of visibleItems) {
      grouped[getNotificationPrimaryTab(item.type)].push(item);
    }

    const unreadItems = visibleItems.filter((item) => !item.readAt);
    const allUnreadItems = items.filter((item) => !item.readAt);
    const unreadCounts: Record<NotificationTab, number> = {
      all: unreadItems.length,
      trades: grouped.trades.filter((item) => !item.readAt).length,
      goals: grouped.goals.filter((item) => !item.readAt).length,
      alerts: grouped.alerts.filter((item) => !item.readAt).length,
      news: grouped.news.filter((item) => !item.readAt).length,
      social: grouped.social.filter((item) => !item.readAt).length,
      system: grouped.system.filter((item) => !item.readAt).length,
    };

    return {
      visibleItems,
      allUnreadItems,
      unreadItems,
      notificationsByTab: grouped,
      unreadCounts,
      unreadCount: unreadItems.length,
    };
  }, [canUseInAppChannel, items]);

  const handleNavigate = (url: string) => {
    setOpen(false);
    router.push(url);
  };

  const handleAcceptInvite = async (item: NotificationItem) => {
    const inviteId = item.metadata?.inviteId;
    if (!inviteId) return;

    setInviteActionState({ inviteId, action: "accept" });

    try {
      const result = await acceptInvite.mutateAsync({ inviteId });
      if (!item.readAt) {
        markRead.mutate({ ids: [item.id] });
      }
      toast.success("Invite accepted");
      handleNavigate(
        item.metadata?.url ||
          result.share.sharePath ||
          getNotificationTargetUrl(item) ||
          "/dashboard/journal?tab=shares"
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to accept invite"
      );
    } finally {
      setInviteActionState((current) =>
        current?.inviteId === inviteId && current.action === "accept"
          ? null
          : current
      );
    }
  };

  const handleDeclineInvite = async (item: NotificationItem) => {
    const inviteId = item.metadata?.inviteId;
    if (!inviteId) return;

    setInviteActionState({ inviteId, action: "decline" });

    try {
      await declineInvite.mutateAsync({ inviteId });
      if (!item.readAt) {
        markRead.mutate({ ids: [item.id] });
      }
      toast.success("Invite declined");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to decline invite"
      );
    } finally {
      setInviteActionState((current) =>
        current?.inviteId === inviteId && current.action === "decline"
          ? null
          : current
      );
    }
  };

  useEffect(() => {
    if (!SHOW_SOCIAL_NOTIFICATIONS && activeTab === "social") {
      setActiveTab("all");
    }
  }, [activeTab]);

  useEffect(() => {
    if (!canUsePushChannel) return;

    void ensureWebPushSubscription({ requestPermission: false }).catch(() => {
      // Silent keepalive. The settings page remains the explicit place for prompts.
    });

    if (typeof Notification === "undefined") return;
    if (!open) return;
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [canUsePushChannel, open]);

  useEffect(() => {
    if (!hasFetchedNotifications) return;

    if (!initializedDeliveryRef.current) {
      allUnreadItems.forEach((item) => {
        deliveredRef.current.add(item.id);
      });
      initializedDeliveryRef.current = true;
      return;
    }

    allUnreadItems.forEach((item) => {
      if (item.readAt) return;
      if (deliveredRef.current.has(item.id)) return;
      deliveredRef.current.add(item.id);

      const notificationTargetUrl = getNotificationTargetUrl(item);
      const isDocumentHidden =
        typeof document !== "undefined" &&
        document.visibilityState !== "visible";

      if (isDocumentHidden && canUsePushChannel) {
        const presentation = buildNotificationPresentation({
          title: item.title,
          body: item.body,
          type: item.type,
          metadata: (item.metadata as Record<string, unknown> | null) ?? null,
        });
        const brandAsset = getNotificationBrandAsset(presentation.brandKey);

        void showDesktopNotification({
          title: presentation.pushTitle,
          body: presentation.pushBody,
          url: notificationTargetUrl || "/dashboard/settings/notifications",
          tag: `profitabledge-notification-${item.id}`,
          requireInteraction:
            presentation.requireInteraction ||
            shouldRequireDesktopInteraction(item.type),
          icon: brandAsset.src,
          badge: brandAsset.src,
        });
        return;
      }

      if (!canUseInAppChannel) return;

      showNotificationToast(item, {
        onNavigate: handleNavigate,
        onMarkRead: (id) => markRead.mutate({ ids: [id] }),
      });
    });
  }, [
    allUnreadItems,
    canUseInAppChannel,
    canUsePushChannel,
    hasFetchedNotifications,
    handleNavigate,
    markRead,
  ]);

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
        className="rounded-sm bg-sidebar ring ring-white/5 p-0 w-[420px] h-[480px] overflow-hidden flex flex-col"
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

        {!canUseInAppChannel ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm font-medium text-white/80">
              In-app notifications are off
            </p>
            <p className="max-w-xs text-xs leading-relaxed text-white/45">
              Turn them back on to use the notification hub and the toast
              fallback when desktop push is unavailable.
            </p>
            <Button
              size="sm"
              className="rounded-sm bg-sidebar-accent text-white hover:bg-sidebar-accent/80"
              onClick={() =>
                handleNavigate("/dashboard/settings/notifications")
              }
            >
              Open settings
            </Button>
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              if (
                VISIBLE_NOTIFICATION_TABS.includes(value as NotificationTab)
              ) {
                setActiveTab(value as NotificationTab);
              }
            }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="shrink-0">
              <div className="overflow-x-auto px-4 overscroll-x-contain">
                <TabsListUnderlined className="inline-flex h-auto min-w-max items-stretch gap-5 border-b-0 pr-4">
                  {VISIBLE_NOTIFICATION_TABS.map((tab) => {
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
              {VISIBLE_NOTIFICATION_TABS.map((tab) => (
                <NotificationTabPanel
                  key={tab}
                  value={tab}
                  items={notificationsByTab[tab]}
                  emptyMessage={notificationTabEmptyStates[tab]}
                  markRead={markRead}
                  onNavigate={handleNavigate}
                  inviteActionState={inviteActionState}
                  onAcceptInvite={handleAcceptInvite}
                  onDeclineInvite={handleDeclineInvite}
                />
              ))}
            </div>
          </Tabs>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
