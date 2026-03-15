# Architecture Overview

This repo is a Bun + Turborepo monorepo for a trading analytics product with a web app, a server app, shared packages, and MT5-side integrations.

## Top-level structure

- `apps/web`
  - Next.js frontend on port `3001`
  - renders the dashboard, assistant, onboarding, public profile/share pages, and feature UIs
- `apps/server`
  - Next.js server on port `3000`
  - owns tRPC, auth, database access, domain logic, worker endpoints, and upload routes
- `packages/contracts`
  - shared TypeScript contract exports and generated tRPC declaration surface
- `packages/platform`
  - shared platform utilities like origin resolution, failover fetch, and alpha-flag resolution
- `services/mt5-worker`
  - Python worker for terminal-farm MT5 syncing
- `EA`
  - MetaTrader-side Expert Advisors for price and execution enrichment

## Runtime boundaries

### Web app

Main responsibilities:

- page routing
- same-origin proxying of browser auth and tRPC traffic into the server app for split deployments
- temporary root beta-gate and waitlist capture before authenticated onboarding
- dashboard shell and navigation
- React Query + tRPC client usage
- chart/widget rendering
- feature-level UI state
- lightweight alpha usage tracking and feature gating

Key files:

- `apps/web/src/app/layout.tsx`
- `apps/web/src/components/providers.tsx`
- `apps/web/src/utils/trpc.ts`
- `apps/web/src/app/trpc/[trpc]/route.ts`
- `apps/web/src/app/api/auth/[...all]/route.ts`
- `apps/web/src/app/(dashboard)/layout.tsx`

### Server app

Main responsibilities:

- Better Auth session handling
- tRPC router exposure
- domain logic for accounts, trades, goals, AI, notifications, prop tracking, and integrations
- database reads/writes via Drizzle
- worker-facing API routes for MT5 sync
- request-only API serving; scheduled provider sync now runs from a separate worker script
- health/ops endpoints for alpha support and runtime verification

Key files:

- `apps/server/src/app/trpc/[trpc]/route.ts`
- `apps/server/src/routers/index.ts`
- `apps/server/src/lib/context.ts`
- `apps/server/src/lib/auth.ts`
- `apps/server/src/lib/auth-cookie-settings.ts`
- `apps/server/src/lib/trpc.ts`
- `apps/server/src/db/index.ts`
- `apps/server/src/app/api/health/route.ts`

### Shared packages

- `packages/contracts`
  - shared type-safe exports consumed by web and server, including generated router declarations under `packages/contracts/generated/server`
- `packages/platform`
  - shared origin/fetch helpers so the web app can fail over between local and configured server URLs
  - shared alpha flag definitions used by both env validation and route/UI gates

## Main request/data flow

For most app features, the flow is:

1. route page in `apps/web/src/app/...`
2. feature components/hooks in `apps/web/src/features/...`
3. browser request through the web-origin proxy in `apps/web/src/app/trpc/[trpc]/route.ts`
4. router procedure in `apps/server/src/routers/...`
5. domain logic in `apps/server/src/lib/...`
6. database access through `apps/server/src/db/...`

Auth follows the same split-deployment rule:

1. browser auth action hits `apps/web/src/app/api/auth/[...all]/route.ts`
2. the web app forwards the request to the server auth handler
3. Better Auth resolves its public base URL from the web origin in split deployments, so callbacks and session cookies stay first-party to the browser-facing app origin

Example:

- `/dashboard/prop-tracker/[accountId]`
  - page in `apps/web/src/app/(dashboard)/dashboard/prop-tracker/[accountId]/page.tsx`
  - queries `propFirms` procedures through the shared tRPC client
  - server logic runs through `apps/server/src/routers/prop-firms.ts`
  - prop evaluation happens in `apps/server/src/lib/prop-rule-monitor.ts`
  - persisted state lives largely in `apps/server/src/db/schema/trading.ts`

Alpha diagnostics follow the same layered path:

- `/dashboard/settings/support`
  - queries `operations.getSupportSnapshot`
  - server assembles runtime/config, sync diagnostics, milestones, recent events, and feedback
  - persistence lives in `apps/server/src/db/schema/operations.ts`

## Integration surfaces

The repo has two major external sync paths.

### Terminal-farm MT5 sync

- user stores MT5 credentials
- server exposes worker claim/status/sync endpoints
- Python worker logs into real terminals and posts normalized sync frames
- Bun scheduler worker handles periodic provider sync outside the request server

Main code:

- `apps/server/src/app/api/mt5-worker/...`
- `apps/server/src/lib/mt5/...`
- `apps/server/src/lib/providers/sync-engine.ts`
- `apps/server/src/scripts/run-sync-scheduler.ts`
- `services/mt5-worker/...`

### EA-side enrichment

- MT5 EA posts price/execution data into the server
- used for richer drawdown/execution/manipulation analytics

Main code:

- `apps/server/src/routers/webhook.ts`
- `EA/profitabledge_data_bridge.mq5`
- `EA/ProfitabledgeSync.mq5`

## Product section map

The sidebar is currently grouped like this:

- `Analysis`
  - Dashboard, Trades, Journal, Psychology, Goals
- `Accounts`
  - Trading accounts, Prop tracker
- `Community`
  - Feed, Leaderboard, Achievements, News
- `Tools`
  - Trade copier, AI Assistant, Backtest
- `Growth`
  - Referrals for members, Affiliate dashboard for approved affiliates/admins, and Beta access for admins
- `Settings`
  - dashboard settings area, rendered separately from the main nav groups
- sidebar footer actions
  - `Request a feature` opens a private in-app request dialog backed by the operations router and shared product-area catalog, while `Settings` stays as its own footer action below the main nav groups

Nav config lives in:

- `apps/web/src/features/navigation/config/nav-sections.ts`

Alpha route/page gating lives in:

- `apps/web/src/lib/alpha-flags.ts`
- `apps/web/src/features/platform/alpha/...`

## Architecture rules worth preserving

- keep route files thinner than feature files
- prefer server-side domain logic over page-level business logic
- use tRPC for app data instead of ad-hoc fetches
- keep schema + migration + router + UI in sync when adding persisted product behavior
- reuse shared dashboard shell, widget wrapper, badge, and separator patterns instead of re-styling feature-by-feature
