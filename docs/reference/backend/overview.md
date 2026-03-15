# Backend Overview

## Main ownership

- account APIs
  - `apps/server/src/routers/accounts.ts`
  - `apps/server/src/routers/accounts/...`
- trades APIs
  - `apps/server/src/routers/trades.ts`
  - `apps/server/src/routers/trades/...`
- journal APIs
  - `apps/server/src/routers/journal.ts`
  - `apps/server/src/routers/journal/...`
- notifications and achievement side effects
  - `apps/server/src/lib/notifications.ts`
  - `apps/server/src/lib/achievements.ts`

## Current account helper ownership

- archive preferences
  - `apps/server/src/routers/accounts/archive-preferences.ts`
- aggregated portfolio stats
  - `apps/server/src/routers/accounts/aggregated-stats.ts`
- verification and public track records
  - `apps/server/src/routers/accounts/track-record.ts`
- health and sync status
  - `apps/server/src/routers/accounts/health.ts`

These files exist to keep `accounts.ts` as the router composition surface rather
than forcing every account concern back into one file.

## Verification commands

Run these from the repo root:

- `bun check-types`
- `bun lint`
- `bun test`
- `bun run build`

`bun run build` is currently treated as a bundle-integrity smoke check. Next
builds skip type and lint enforcement so missing modules and route-resolution
issues still fail the build, while repo-wide TypeScript and ESLint debt is left
to the separate verification commands.
