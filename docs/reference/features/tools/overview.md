# Tools Section Reference

This section covers the tool-like product areas that sit alongside the main analysis loop.

## Routes

- `/`
- `/assistant`
- `/backtest`
- `/dashboard/copier`
- `/dashboard/affiliate`
- `/dashboard/growth`
- `/dashboard/growth-admin`
- `/dashboard/referrals`
- `/dashboard/settings`
- `/dashboard/settings/ai`
- `/dashboard/settings/support`
- `/dashboard/settings/billing`
- `/dashboard/settings/billing/payment-methods`

## Main frontend ownership

### AI Assistant

- `apps/web/src/features/ai/...`
- `apps/web/src/components/ai/...`
- `apps/web/src/components/ai-elements/...`

### Backtest

- `apps/web/src/app/(backtest)/backtest/...`
- `apps/web/src/features/backtest/...`
- `apps/web/src/components/backtest/...`
- replay screen state now lives primarily in feature hooks under `apps/web/src/features/backtest/replay/hooks/...`, including candle loading in `use-replay-candle-loader.ts` and route lifecycle/reset logic in `use-replay-page-lifecycle.ts`

### Trade copier

- `apps/web/src/app/(dashboard)/dashboard/copier/page.tsx`
- `apps/web/src/components/copier/...`

### Settings, billing, and connections

- `apps/web/src/app/page.tsx`
- `apps/web/src/features/growth/...`
- `apps/web/src/app/(dashboard)/dashboard/growth/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/(growth)/growth-admin/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/settings/...`
- `apps/web/src/app/(dashboard)/dashboard/referrals/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/affiliate/page.tsx`
- `apps/web/src/features/settings/ai-keys/...`
- `apps/web/src/features/settings/...`
- `apps/web/src/features/platform/alpha/...`

## Main backend ownership

### AI

- `apps/server/src/routers/ai.ts`
- `apps/server/src/routers/ai/...`
- `apps/server/src/lib/ai/...`

### Backtest

- `apps/server/src/routers/backtest.ts`
- `apps/server/src/routers/backtest/...`
- `apps/server/src/db/schema/backtest.ts`

### Copier

- `apps/server/src/routers/copier.ts`
- `apps/server/src/routers/copier/groups.ts`
- `apps/server/src/routers/copier/health.ts`
- `apps/server/src/db/schema/copier.ts`

### Billing, growth access, and connections

- `apps/server/src/routers/billing.ts`
- `apps/server/src/routers/ai-keys.ts`
- `apps/server/src/app/api/polar/webhooks/route.ts`
- `apps/server/src/lib/billing/...`
- `apps/server/src/lib/ai/provider-keys.ts`
- `apps/server/src/routers/connections.ts`
- `apps/server/src/routers/api-keys.ts`
- `apps/server/src/lib/providers/...`
- `apps/server/src/db/schema/connections.ts`

## Responsibilities

### AI Assistant

- chat and assistant UX
- prompt input and streaming
- structured AI reports/intelligence helpers
- platform-funded Gemini usage should flow through the shared metered helper so assistant, journal AI, and other AI tool surfaces record token usage and deduct Edge credits when the app key is used
- Gemini/provider quota and availability failures should resolve into short user-facing `AI ...` messages so assistant and other AI tool surfaces can toast them cleanly instead of surfacing raw provider payloads
- keep AI query execution split by concern: `query-executor.ts` should own execution flow, `query-executor-sql.ts` should own WHERE/select/aggregate SQL construction, and `query-executor-analytics.ts` should own recommendation, cohort, clustering, and persona helper logic

### Backtest

- replay and simulation surfaces
- backtest-specific persistence and tooling
- keep the route layer thin: replay market-state, remote-data, persistence, session-ops, review-mode, trade-engine, candle loading, and lifecycle/reset behavior should stay in `features/backtest/replay/hooks`
- keep `apps/server/src/routers/backtest.ts` as a composition root; transport serialization and session analytics should live in adjacent helper modules under `apps/server/src/routers/backtest`

### Trade copier

- copier connection management and copier-specific workflows
- keep group CRUD and slave assignment procedures in `apps/server/src/routers/copier/groups.ts`
- keep copier attribution, slave stats, and health monitoring procedures in `apps/server/src/routers/copier/health.ts`

### Settings

- user configuration
- subscription and plan management
- billing plan cards should present explicit plan entitlements, and the billing wallet should surface the current cycle's remaining Edge credits against the active plan allowance alongside renewal state
- plan-funded AI usage should consume measured Edge credits from the active billing cycle; calls only bypass credit spend when they are executed with a user-provided key path instead of the platform key
- the AI settings route should let users save and validate personal Gemini, OpenAI, and Anthropic keys, while clearly distinguishing between providers that are live in the runtime today and providers that are stored now for future routing
- supported Gemini-backed features should continue to route through the saved Gemini key automatically before the platform key path is used
- the AI settings route should also show where each provider key is created, so members can jump directly to Google AI Studio, OpenAI platform keys, or Anthropic Console keys from the settings UI
- the AI settings route now includes a provider-toggled usage section for `Profitabledge`, `Gemini`, `OpenAI`, and `Anthropic`, backed by the persisted AI usage ledger rather than frontend-only estimates
- billing settings now use a shared journal-style subnav mounted at the billing route-layout level directly under the settings shell header, so plan management stays on the overview page while affiliate payout instructions and payout history live on `/dashboard/settings/billing/payment-methods`
- the billing overview page now also includes an invoice-history table sourced from mirrored Polar order records, without exposing the full trades-style table toolbar stack
- for the current Vercel-oriented beta posture, keep local/dev envs free to enable Backtest, scheduled sync, and MT5 ingestion, but set those alpha flags off in production when deploying a workerless Vercel beta; the main sidebar keeps Backtest visible as a disabled `Coming soon!` item when the flag is off, while Connections downgrades MT5 terminal sync and background-sync messaging instead of implying the worker stack is live
- the root route is a temporary private-beta gate that either validates/stores a beta code and forwards into sign-up/onboarding or captures a waitlist email through the public growth-access mutation
- the sign-up form now includes the beta code in the Better Auth request so the server can reject account creation before a user row is written when private beta is compulsory
- billing settings now own plan management, while the dedicated billing payment-methods subpage owns affiliate payout methods and payout history
- in localhost/non-production builds, billing also exposes affiliate payout-method test presets that prefill production-shaped manual payout details instead of introducing a separate dev-only payout type
- the Growth sidebar section now includes the growth overview, referrals, and affiliate routes, while growth-admin stays available as a separate admin-only direct route for beta codes, waitlist review, affiliate approvals, and affiliate payouts
- the growth overview and growth-admin routes now share a billing-style route layout for allowlisted admins, mounting a `Growth` / `Growth admin` underlined tab strip directly under the dashboard header while keeping the page bodies on the same shadowed settings-card language used by Billing
- allowlisted admin accounts bypass the redeemed beta-code requirement for admin-only growth tooling, so operators can issue codes before unlocking the rest of the platform on that account
- referrals and affiliates are distinct systems and now live on separate routes: every non-affiliate member gets a referral profile with milestone rewards on `/dashboard/referrals`, while only admin-approved affiliates receive recurring commission tracking on `/dashboard/affiliate`
- the affiliate dashboard owns commission totals, invite activity, affiliate share assets, and the single mentorship group attached to an approved affiliate, while Billing holds the affiliate's payout-method management
- the referrals route owns member referral stats, reward progress/history, and affiliate applications
- account connections
- API keys
- platform preferences
- support diagnostics, in-app alpha feedback, and private feature requests
- alpha-supported connection providers only; future provider stubs should stay hidden from the connect flow until operational

## Development notes

- the assistant has both frontend streaming surfaces and server orchestration; changes usually require both
- connection work should start from the provider registry and settings connections flow, not only from the UI
- during alpha, the visible provider catalog is intentionally narrower than the full registry; check the connection catalog before exposing a provider
- settings/support work should prefer the operations router and operations tables for diagnostics, milestones, feedback, and feature requests instead of inventing feature-local storage
- backtest is its own tool surface and should not be forced into dashboard-only patterns when that hurts usability

## First files to inspect for changes

- `apps/web/src/features/ai/...`
- `apps/server/src/routers/ai.ts`
- `apps/server/src/lib/ai/...`
- `apps/web/src/app/(backtest)/backtest/...`
- `apps/server/src/routers/backtest.ts`
- `apps/web/src/app/(dashboard)/dashboard/copier/page.tsx`
- `apps/server/src/routers/copier.ts`
- `apps/web/src/app/(dashboard)/dashboard/settings/...`
- `apps/server/src/routers/connections.ts`
- `apps/server/src/lib/providers/registry.ts`
