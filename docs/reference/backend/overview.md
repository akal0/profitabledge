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
  - mixed-currency all-account totals should be normalized through the shared currency helper when the client sends a preferred dashboard currency
- account performance and broker-owned trade interpretation
  - `apps/server/src/routers/accounts/performance.ts`
  - `apps/server/src/lib/trades/trade-outcome.ts`
- CSV/XML/XLSX trade import normalization
  - `apps/server/src/routers/upload.ts`
  - `apps/server/src/lib/trade-import/...`
  - parser modules should emit the shared normalized trade shape first, then let bundle/persistence layers handle dedupe and inserts; broker-specific logic should stay in parser detection, pairing, and account-hint extraction rather than leaking into persistence
- verification and public track records
  - `apps/server/src/routers/accounts/track-record.ts`
- public proof share and trust-audit APIs
  - `apps/server/src/routers/proof.ts`
  - `apps/server/src/routers/proof/...`
  - `apps/server/src/lib/public-proof/...`
  - `apps/server/src/lib/public-proof/page-data.ts` owns public proof overview/stat/trust shaping so router queries can stay focused on fetch + authorization instead of inlining proof-page aggregation logic
  - public-proof trust classification should distinguish `Broker sync` / `Broker verified` from `EA synced` / `EA verified`, and the seeded Profitabledge demo account must override those trust labels instead of inheriting generic live-sync wording from stored verification fields
  - live public-proof open-trade rows should treat their headline floating P&L as net open P&L (`profit + swap`) while still preserving raw swap separately for any downstream UI that wants to break it out
- health and sync status
  - `apps/server/src/routers/accounts/health.ts`

These files exist to keep `accounts.ts` as the router composition surface rather
than forcing every account concern back into one file.

Current account guardrails:

- `apps/server/src/routers/accounts.ts`
  - owns the hard delete mutation guard that prevents a user from deleting their only remaining account
  - all-account `stats` queries can receive an optional preferred currency so portfolio money metrics are normalized before the frontend renders the widgets

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
