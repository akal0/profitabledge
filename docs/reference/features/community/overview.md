# Community Section Reference

This section covers the trader-facing community surfaces.

## Routes

- `/dashboard/feed`
- `/dashboard/leaderboard`
- `/dashboard/achievements`
- `/dashboard/news`

## Main frontend ownership

Route pages:

- `apps/web/src/app/(dashboard)/dashboard/feed/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/leaderboard/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/achievements/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/news/page.tsx`

Supporting UI lives primarily in:

- `apps/web/src/components`
- `apps/web/src/features/navigation`

## Main backend ownership

- social/feed/leaderboard style behavior
  - `apps/server/src/routers/social-redesign.ts`
- notifications tied to social changes
  - `apps/server/src/routers/notifications.ts`
  - `apps/server/src/lib/notification-hub.ts`
- market/news data
  - `apps/server/src/routers/market-data.ts`

## Responsibilities

### Feed

- community/social timeline style experiences
- trader-facing social content and interactions

### Leaderboard

- ranking and comparison surfaces
- achievement-adjacent community status

### Achievements

- milestone and gamified progress displays

### News

- news/economic or market-related discovery surfaces

## Development notes

- these pages are product/community surfaces, not settings pages
- if a notification or badge is tied to social activity, check the notification hub and category mapping too
- if ranking logic changes, verify the server router and any related database entities before changing only the frontend copy

## First files to inspect for changes

- `apps/web/src/app/(dashboard)/dashboard/feed/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/leaderboard/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/achievements/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/news/page.tsx`
- `apps/server/src/routers/social-redesign.ts`
- `apps/server/src/routers/market-data.ts`
- `apps/server/src/routers/notifications.ts`
