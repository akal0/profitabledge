# Community Section Reference

This section covers the trader-facing community surfaces that still exist in the route tree but are intentionally hidden from product discovery during the current alpha.

The economic calendar route at `/dashboard/news` is no longer part of this held-back set. It is beta-visible and should be treated as a dashboard analysis surface rather than a community discovery route.

## Routes

- `/dashboard/feed`
- `/dashboard/leaderboard`
- `/dashboard/achievements`

## Main frontend ownership

Route pages:

- `apps/web/src/app/(dashboard)/dashboard/feed/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/leaderboard/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/achievements/page.tsx`

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

## Development notes

- these pages are product/community surfaces, not settings pages
- discovery for these routes is intentionally disabled in the sidebar, command palette, settings navigation, notification deep-links, and public-profile routing until the community product loop is ready to ship
- `/dashboard/news` is the exception: it now belongs to the beta-visible dashboard IA and should not be treated as hidden community discovery
- if a notification or badge is tied to social activity, check the notification hub and category mapping too
- if ranking logic changes, verify the server router and any related database entities before changing only the frontend copy

## First files to inspect for changes

- `apps/web/src/app/(dashboard)/dashboard/feed/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/leaderboard/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/achievements/page.tsx`
- `apps/server/src/routers/social-redesign.ts`
- `apps/server/src/routers/market-data.ts`
- `apps/server/src/routers/notifications.ts`
