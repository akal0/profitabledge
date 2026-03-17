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
- account performance and broker-owned trade interpretation
  - `apps/server/src/routers/accounts/performance.ts`
  - `apps/server/src/lib/trades/trade-outcome.ts`
- verification and public track records
  - `apps/server/src/routers/accounts/track-record.ts`
- public proof share and trust-audit APIs
  - `apps/server/src/routers/proof.ts`
  - `apps/server/src/routers/proof/...`
  - `apps/server/src/lib/public-proof/...`
  - `apps/server/src/lib/public-proof/page-data.ts` owns public proof overview/stat/trust shaping so router queries can stay focused on fetch + authorization instead of inlining proof-page aggregation logic
- health and sync status
  - `apps/server/src/routers/accounts/health.ts`

These files exist to keep `accounts.ts` as the router composition surface rather
than forcing every account concern back into one file.

Public proof pages are intentionally separate from social/public-profile work:

- the revocable link and signed-out read APIs live under the dedicated proof router
- trade provenance and edit/delete trust events live in `apps/server/src/db/schema/trading.ts` and the `lib/public-proof` helpers
- this keeps `/verified` track-record logic, social discovery, and public proof-of-edge pages decoupled

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
