# Notification System Analysis & Improvements

## Current System Overview

### Backend (Strong Foundation)

```
apps/server/src/lib/notification-hub.ts
```

- ✅ 16+ notification types implemented
- ✅ Categories: trades, goals, alerts, news, system, social
- ✅ Priority levels: low, normal, high, urgent
- ✅ Per-category preferences
- ✅ Deduplication (dedupeKey)
- ✅ Batch queueing
- ✅ Event bus integration

### Frontend (Needs Work)

```
apps/web/src/components/notifications-hub.tsx
```

- ⚠️ Only 4 categories: all, trades, system, news
- ⚠️ Missing: goals, alerts, social categories
- ⚠️ No priority styling
- ⚠️ No date grouping
- ⚠️ No rich actions

---

## Issues Found

### 1. Category Mismatch

**Backend defines:** `trades | goals | alerts | news | system | social`
**Frontend shows:** `all | trades | system | news`

```typescript
// Current frontend (line 40)
type NotificationCategory = "all" | "trades" | "system" | "news";

// Missing: goals, alerts, social
```

### 2. No Priority Visual Distinction

Backend assigns priorities but frontend doesn't display them differently:

- urgent (red) - prop_violation, alert_triggered
- high (orange) - trade_closed, goal_achieved, prop_phase_advanced
- normal (default) - trade_opened, post_exit_ready, goal_progress
- low (muted) - everything else

### 3. Notification Types Not Fully Utilized

These types exist but aren't shown in frontend:

- `goal_achieved` / `goal_progress` → Should be in "goals" tab
- `alert_triggered` / `prop_violation` / `prop_phase_advanced` → Should be in "alerts" tab
- `leaderboard_update` / `copier_signal` → Should be in "social" tab

### 4. Missing Features

- No date grouping (Today, Yesterday, This Week)
- No rich action buttons (View Trade, Dismiss, Settings)
- No notification settings UI
- No bulk actions

---

## Recommended Improvements

### Phase 1: Fix Category Mapping (Quick Win)

Update `apps/web/src/components/notifications-hub.tsx`:

```typescript
// Line 40 - Add missing categories
type NotificationCategory =
  | "all"
  | "trades"
  | "goals"
  | "alerts"
  | "news"
  | "social"
  | "system";

// Line 71 - Update categorize function
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
    default:
      return "system";
  }
}
```

### Phase 2: Add Priority Styling

```typescript
// Add priority badges
const priorityColors = {
  urgent: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  normal: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  low: "bg-white/5 text-white/40 border-white/10",
};

// Get priority from type
function getNotificationPriority(
  type?: string | null
): "urgent" | "high" | "normal" | "low" {
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
```

### Phase 3: Enhanced UI Layout

```
┌─────────────────────────────────────────────────┐
│  Notifications          [Settings] [Mark All ✓] │
├─────────────────────────────────────────────────┤
│  [All(12)] [Trades(3)] [Goals(2)] [Alerts(5)] │
│  [News(1)] [Social(1)] [System(0)]             │
├─────────────────────────────────────────────────┤
│  TODAY                                           │
│  ┌─────────────────────────────────────────────┐ │
│  │ 🔴 Alert: Daily loss limit -5%              │ │
│  │    Your account is approaching the daily... │ │
│  │    2 min ago                    [View] [✓]  │ │
│  └─────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────┐ │
│  │ 🟢 Trade closed: +$234.50                   │ │
│  │    EURUSD long closed at TP                 │ │
│  │    15 min ago                   [View] [✓] │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  YESTERDAY                                        │
│  ┌─────────────────────────────────────────────┐ │
│  │ 🟡 Goal: 60% win rate target - 58%          │ │
│  │    2 trades remaining to reach goal          │ │
│  │    Yesterday                   [View] [✓]   │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Phase 4: Add Rich Actions

```typescript
// Action buttons per notification type
const notificationActions = {
  trades: [
    { label: "View Trade", href: "/dashboard/trades/{id}" },
    { label: "Add Note", action: "openNotes" },
  ],
  goals: [
    { label: "View Goal", href: "/dashboard/goals/{id}" },
    { label: "Dismiss", action: "dismiss" },
  ],
  alerts: [
    { label: "View Rules", href: "/dashboard/settings/rules" },
    { label: "Acknowledge", action: "acknowledge" },
  ],
  prop: [
    { label: "View Challenge", href: "/dashboard/prop-tracker/{id}" },
    { label: "Details", action: "openDetails" },
  ],
  social: [{ label: "View Profile", href: "/dashboard/feed" }],
};
```

### Phase 5: Notification Settings UI

Create `apps/web/src/app/(dashboard)/dashboard/settings/notifications/page.tsx`:

```typescript
// Notification preferences UI
const notificationSettings = {
  trades: {
    tradeClosed: {
      label: "Trade closed",
      description: "When a trade closes",
      default: true,
    },
    tradeOpened: {
      label: "Trade opened",
      description: "When a trade opens",
      default: false,
    },
    postExit: {
      label: "Post-exit analysis",
      description: "Money left on table",
      default: true,
    },
  },
  goals: {
    goalAchieved: {
      label: "Goal achieved",
      description: "When you hit a goal",
      default: true,
    },
    goalProgress: {
      label: "Goal progress",
      description: "Milestone updates",
      default: true,
    },
  },
  alerts: {
    alertTriggered: {
      label: "Alert triggered",
      description: "When an alert fires",
      default: true,
    },
    propViolation: {
      label: "Prop violation",
      description: "Rule breach warning",
      default: true,
    },
    propAdvanced: {
      label: "Phase advanced",
      description: "Prop firm progress",
      default: true,
    },
  },
  news: {
    newsUpcoming: {
      label: "News events",
      description: "Economic calendar",
      default: true,
    },
  },
  social: {
    leaderboardUpdate: {
      label: "Leaderboard changes",
      description: "Rank updates",
      default: false,
    },
    copierSignal: {
      label: "Copier signals",
      description: "Copy trade signals",
      default: false,
    },
  },
  channels: {
    inApp: {
      label: "In-app notifications",
      description: "Show in app",
      default: true,
    },
    push: {
      label: "Push notifications",
      description: "Browser notifications",
      default: false,
    },
    email: {
      label: "Email digest",
      description: "Daily summary",
      default: false,
    },
  },
};
```

### Phase 6: Smart Grouping

```typescript
// Group notifications by time
function groupByDate(notifications) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const thisWeek = new Date(today);
  thisWeek.setDate(thisWeek.getDate() - 7);

  return {
    today: notifications.filter((n) => new Date(n.createdAt) >= today),
    yesterday: notifications.filter((n) => {
      const d = new Date(n.createdAt);
      return d >= yesterday && d < today;
    }),
    thisWeek: notifications.filter((n) => {
      const d = new Date(n.createdAt);
      return d >= thisWeek && d < yesterday;
    }),
    older: notifications.filter((n) => new Date(n.createdAt) < thisWeek),
  };
}
```

---

## Implementation Checklist

### Quick Wins (1-2 hours)

- [ ] Fix category mapping (add goals, alerts, social tabs)
- [ ] Add priority color coding
- [ ] Update tabs from 4 to 7 categories

### Medium Effort (1 day)

- [ ] Add date grouping (Today, Yesterday, This Week)
- [ ] Add action buttons per notification type
- [ ] Create notification settings page

### Enhanced Features (1 week)

- [ ] Add rich notification templates (trade card, goal card, alert card)
- [ ] Add quick filters (unread, urgent, today)
- [ ] Add bulk actions (mark read, delete, snooze)
- [ ] Add notification sound preferences
- [ ] Add "do not disturb" hours

### Advanced (1+ weeks)

- [ ] Real-time WebSocket notifications
- [ ] Email digest builder
- [ ] Mobile push notifications
- [ ] Telegram/Discord integration
- [ ] Notification analytics (what users interact with)

---

## Files to Modify

1. **`apps/web/src/components/notifications-hub.tsx`**

   - Add missing categories
   - Add priority styling
   - Add date grouping
   - Add action buttons

2. **Create `apps/web/src/app/(dashboard)/dashboard/settings/notifications/page.tsx`**

   - Notification preferences UI
   - Channel settings
   - Per-type toggles

3. **Update `apps/server/src/routers/notifications.ts`**
   - Add category filter support
   - Add priority to response

---

## Summary

Your notification system has a **strong backend** with 16+ types, categories, priorities, and deduplication. The issue is the **frontend doesn't showcase all these capabilities**.

The news section works well because it has a dedicated page with the economic calendar. Apply the same pattern:

- Each category should have its own tab
- Each type should have appropriate styling
- Each should have contextual actions

Start with Phase 1 (fix category mapping) - it's a 30-minute fix that immediately adds value.
