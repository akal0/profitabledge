# Frontend Overview

The frontend lives in `apps/web` and is a Next.js App Router application using React 19, TanStack Query, tRPC, Tailwind v4, and shared UI primitives.

## Key frontend entrypoints

- `apps/web/src/app/page.tsx`
  - animated marketing and invite-entry landing surface
- `apps/web/src/app/layout.tsx`
  - root layout
- `apps/web/src/components/providers.tsx`
  - React Query, tRPC, theme, tooltip, and toaster providers
- `apps/web/src/utils/trpc.ts`
  - shared tRPC clients, query client, and `trpcOptions`
  - typed through `@profitabledge/contracts/trpc`, a source TypeScript module in `packages/contracts/src/trpc.ts` that points at the generated contract surface under `packages/contracts/generated/server`
- `apps/web/src/app/trpc/[trpc]/route.ts`
  - same-origin browser proxy for tRPC requests into the server app
- `apps/web/src/app/api/auth/[...all]/route.ts`
  - same-origin browser proxy for Better Auth routes into the server app
- `apps/web/src/app/(dashboard)/layout.tsx`
  - dashboard shell composition, sidebar, header, breadcrumbs, account context, and plan/admin/affiliate route guards

## Route layout

High-level route groups:

- `(auth)`
  - login and sign-up
- `(dashboard)`
  - primary product area
- `(backtest)`
  - backtest-focused entrypoint
- `(onboarding)`
  - onboarding wizard, plan selection, and private-beta access redemption
- `(public)`
  - alpha-limited public surfaces: share pages, verified pages, and link-only public proof pages

Main dashboard pages currently include:

- `/dashboard`
- `/dashboard/affiliate`
- `/dashboard/growth`
- `/dashboard/growth-admin`
- `/dashboard/referrals`
- `/dashboard/trades`
- `/dashboard/journal`
- `/dashboard/psychology`
- `/dashboard/goals`
- `/dashboard/accounts`
- `/dashboard/prop-tracker`
- `/dashboard/settings`
- `/dashboard/settings/ai`
- `/dashboard/settings/support`
- `/dashboard/settings/billing`
- `/dashboard/settings/billing/payment-methods`

## Feature ownership

Use these folders when adding frontend code:

- `apps/web/src/features/accounts`
  - account catalog, add-account flow, account metadata helpers
- `apps/web/src/features/dashboard`
  - widgets, home, charts, calendar, dashboard-specific logic
- `apps/web/src/features/dashboard-shell`
  - header, bootstrap, breadcrumbs, shell guards and helpers
- `apps/web/src/features/navigation`
  - sidebar sections and navigation components
- `apps/web/src/features/growth`
  - referral or affiliate invite intent storage and other cross-route growth access helpers
- `apps/web/src/features/trades`
  - table, bulk actions, toolbar
- `apps/web/src/features/public-proof`
  - link-only public proof pages and supporting trust-signal UI
- `apps/web/src/features/ai`
  - assistant and prompt input features
- `apps/web/src/features/backtest`
  - backtest and replay experiences
- `apps/web/src/features/settings`
  - settings, connections, and support diagnostics UI
- `apps/web/src/features/platform/alpha`
  - feature locks, alpha page tracking, and runtime gate surfaces
- `apps/web/src/lib/assistant-page-context.ts`
  - pure assistant page-context parsing shared by assistant surfaces and smoke tests

Shared components live in:

- `apps/web/src/components/ui`
  - base primitives
- `apps/web/src/components`
  - reusable cross-feature components

## Current frontend conventions

- keep `page.tsx` focused on composition, queries, and high-level layout
- move reusable or complex UI into `features/...` or `components/...`
- keep data fetching on shared `trpcOptions` + React Query paths
- prefer existing dashboard shell patterns before inventing new surfaces
- if the same badge, status chip, or card treatment appears in multiple pages, extract it
- keep selected-account actions in the dashboard header when they are contextual to the current account rather than a whole page
- keep alpha-gated surfaces behind both nav-level hiding and route-level lock screens so disabled features do not partially render
- the accounts route should stay a composition layer; section chrome, account cards, and manual prop-flow assignment/builders belong in `apps/web/src/features/accounts/components`
- the prop-tracker detail route should stay a composition layer; assembled panels live in `apps/web/src/features/accounts/prop-tracker/components`, shared display primitives live in `apps/web/src/features/accounts/prop-tracker/components/prop-tracker-detail-primitives.tsx`, and date/metric/status helpers live in `apps/web/src/features/accounts/prop-tracker/lib`
- the replay route should stay a composition layer; market-state, remote-data, session-control, persistence, interaction, candle-loading, lifecycle/reset, and review hooks belong in `apps/web/src/features/backtest/replay/hooks`
- the trades route should stay a composition layer; reference queries belong in `apps/web/src/features/trades/table/hooks/use-trade-table-reference-data.ts`, client-filter analytics belong in `apps/web/src/features/trades/table/hooks/use-trade-table-filtered-data.ts`, and saved-view / query / column-state helpers belong in `apps/web/src/features/trades/table/hooks` and `apps/web/src/features/trades/table/lib` rather than being reimplemented inside `apps/web/src/app/(dashboard)/dashboard/trades/...`
- dashboard export/share affordances should stay on the shared `features/dashboard/widgets` PNG helper path, so single overview widgets, the full overview widget grid, chart cards, the full chart widget grid, and calendar surfaces can all reuse the same generously padded sidebar-canvas capture logic without route-local screenshot code in `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- chart widget layout controls belong in the chart section itself rather than the dashboard header; date navigation, presets, and chart-only customization state should stay owned by `apps/web/src/components/dashboard/chart-widgets.tsx` and `apps/web/src/features/dashboard/home/hooks/use-dashboard-home-layout.ts`
- calendar summary-widget layout controls should stay in the calendar toolbar as built-in presets rather than drag/resize edit chrome, so the right rail remains a curated set of calendar-specific widget variants such as weekly breakdowns and best/worst-day callouts owned by `apps/web/src/features/dashboard/calendar/components`
- heavyweight chart setup should stay in chart feature hooks; `trading-view-chart.tsx` should keep interaction state and delegate chart creation / series sync to `apps/web/src/features/charts/trading-view/hooks/use-trading-view-chart-core.ts`

Current example:

- Tradovate accounts expose a header-level CSV enrichment sheet next to the account-status badge so users can merge supplemental broker reports into the currently selected account from anywhere in the dashboard
- the Tradovate enrichment sheet is idempotent from the user perspective and surfaces a `No new data to import` result when the uploaded files do not add or change anything on the selected account
- shared multi-file CSV uploads now accumulate files across repeated file-picker opens and drag-drop actions, so users can build an import bundle incrementally instead of selecting every file in one shot
- the initial add-account CSV sheet now also allows users to queue a Tradovate bundle before broker selection, and if the uploaded files resolve to an already-imported Tradovate account number the sheet pauses and offers `Enrich existing account` or `Create duplicate account`
- in the add-account CSV flow, account details now appear above the file uploader so the account can be named and classified before files are attached
- the dashboard widget grid now filters out live-only widgets for non-live accounts while preserving those widgets in the saved layout for live-capable accounts, so manual/CSV accounts do not show empty widget slots
- the dashboard header treats prop-account classification separately from live-sync status, so prop accounts only show live connection or live-synced badges when they actually have EA/API/terminal-backed live support
- the dashboard shell and overview header now classify selected accounts from actual account/notification state: imported CSV accounts show `Imported account` plus a passive `Last updated` chip, EA-synced accounts show `EA-synced account` plus a passive sync timestamp, and only connector-backed accounts keep a manual `Sync account` trigger
- the sidebar account selector mirrors that source classification with row icons: demo workspace accounts show the violet flask, connection-backed accounts show a plug, and EA-synced accounts keep the teal check indicator
- the main dashboard sidebar footer now exposes a `Request a feature` action above `Settings`; it opens an in-app dialog backed by a shared product catalog covering current analysis, accounts, community, tools, growth, settings, onboarding, and public/share surfaces, and submits the request privately through the operations router instead of sending members to GitHub in the browser
- app-router pages that depend on `useSearchParams()` are now isolated behind suspense boundaries so the web build can prerender static pages without CSR bailout failures
- the dashboard and backtest shells now emit lightweight page-view events into the operations router, so alpha usage can be reviewed from the support page without wiring an external analytics SDK first
- the root route is now the primary marketing and invite-entry surface, while beta validation and access redemption live inside the auth/onboarding flow instead of replacing the landing page
- the sign-up route now forwards the beta code inside the auth request itself, so account creation is blocked server-side when private beta is required and the submitted code is missing or invalid
- the sign-up route waits for billing public-config resolution before starting email or social auth, so private-beta enforcement cannot be bypassed by clicking a sign-up action before the invite requirements finish loading
- when private beta is enabled, the social sign-up buttons on the sign-up route no longer trigger email/password validation; they now focus the beta-code field, explain that an invite code is required, and only continue into Google or X OAuth once the code validates
- onboarding plan selection now stays inside the existing `(onboarding)` shell while reading live billing config from tRPC, starting Polar checkout for paid plans, redeeming stored private-beta, referral, or affiliate invite intent, and restoring the user to the account-setup step after checkout instead of resetting the flow
- the onboarding and billing plan cards now share the same plan-entitlement talking points, so descriptions like account allowance, included edge credits, live-sync slots, prop tracker, backtesting, and copier access stay aligned across both surfaces
- the onboarding plan step now renders on a wider shell than the other onboarding steps, while keeping the card body content at its natural height so wider plan cards do not introduce extra empty vertical space
- the onboarding route now calls `billing.syncFromPolar` on paid-checkout return, with a short retry window for local-dev or webhook-lag scenarios, so the selected plan is mirrored into app billing state before the user finishes onboarding
- the onboarding route now self-skips for completed users, while older users who already finished onboarding but still need private-beta redemption are dropped straight into the access step instead of the full wizard
- the onboarding step-resume cache is now keyed per signed-in user in session storage, so a stale step from one account cannot push a different newly created account past the initial `Profile` step
- onboarding now waits for any stored beta/referral access intent from sign-up to redeem before bootstrapping the current step, so brand-new users do not get pushed from `Profile` to `Select a plan` just because access redemption finishes a moment later
- shared CSV upload surfaces now show the first three uploaded files inline and collapse any additional files behind a `+x more` hover tooltip, so onboarding and account-import flows stay compact without losing visibility into queued uploads
- the onboarding shell now uses a scrollable responsive layout instead of a fixed-height desktop frame, so long profile/account-import forms remain usable on smaller screens and when CSV/account metadata expands vertically
- the login page now lands directly on `/dashboard`, and the dashboard shell no longer force-bounces signed-in members back to onboarding just because billing/onboarding state is incomplete
- the onboarding account step now flips its footer CTA to `Go to dashboard` as soon as CSV import, demo workspace creation, or broker/EA setup intent makes the member ready to continue, instead of waiting on a stale account-list refresh
- the dashboard sidebar now exposes a `Growth` section with `/dashboard/growth`, `/dashboard/referrals`, and `/dashboard/affiliate`, while `/dashboard/growth-admin` remains an admin-only direct route instead of a persistent sidebar item
- the growth overview and growth-admin routes now live under a shared dashboard route-group layout that mounts a billing-style underlined admin tab strip directly beneath the header, while growth, referrals, affiliate, and growth-admin page bodies reuse the same shadowed settings-card shell language as Billing instead of bespoke route-local framing
- the growth overview and growth admin surfaces now live on their own dashboard routes, while Billing keeps payout-method management inside Billing for approved affiliates
- on localhost/non-production builds, the affiliate payment-method form exposes test preset buttons for PayPal, Wise, bank transfer, and crypto, but those presets still save the same production-compatible payout method types and fields
- allowlisted admins can still open admin-only growth routes such as `/dashboard/growth-admin` while private beta is active, even if that admin account has not redeemed a beta code, and the older `/dashboard/beta-access` path now redirects there
- the settings sidebar now includes a dedicated billing page for plan management and affiliate payout methods, while the main Growth sidebar section owns the growth overview, referrals, and affiliate dashboard
- the billing settings area now uses a shared billing route layout that mounts the journal-style subnav directly under the settings shell header, with `/dashboard/settings/billing` focused on plan management and `/dashboard/settings/billing/payment-methods` handling affiliate payout instructions and payout history
- the current Vercel-safe beta posture should be applied through deployment env flags rather than local defaults: when Backtest, scheduled sync, or MT5 ingestion are disabled in production, the main sidebar still shows Backtest as a disabled `Coming soon!` item, and Connections downgrades MT5/auto-sync copy so the UI matches the workerless beta environment without breaking local development
- the settings sidebar now also includes a dedicated AI page for personal Gemini, OpenAI, and Anthropic keys, using the same settings shell language as billing/connections while keeping provider-key UI in `apps/web/src/features/settings/ai-keys`
- the AI settings page should present Gemini as live for current in-product routing while OpenAI and Anthropic appear as validated connector-ready providers until multi-provider runtime selection is enabled
- the AI settings page should surface provider-specific key-source links and a usage analytics section with toggles for `Profitabledge`, `Gemini`, `OpenAI`, and `Anthropic`, so members can both connect keys and inspect recent AI activity from the same route
- the sidebar `NavUser` dropdown should act as quick access into concrete settings destinations such as profile, billing, and notifications, while sign-out routes through the shared Better Auth client and the current-plan / upgrade CTA reflects the live billing plan, showing the target plan's current upgrade offer badge (`10% off` for `Professional`, `15% off` for `Institutional`) and disappearing once the member is already on `Institutional`
- account cards now expose a dedicated public-proof dialog that creates, rotates, revokes, and copies revocable `/{username}/{publicAccountSlug}/trades` links, while the public page itself lives outside the dashboard shell and stays focused on trust signals plus a curated trade ledger rather than reusing the owner dashboard
- the public proof page now uses a proof-first tabbed IA (`Overview`, `Trades`, `Stats`, `Trust`): overview owns the trust/status hero, KPI rail, and chart switcher; trades keeps the read-only grouped/sortable ledger; stats owns advanced performance cards and monthly/daily breakdowns; trust owns provenance, verification, edit/delete disclosure, and audit-coverage messaging

## Shared UI patterns that are heavily reused

- widget shell and card surfaces
  - `apps/web/src/components/dashboard/widget-wrapper.tsx`
- dashboard widget spacing/separators
  - `apps/web/src/features/dashboard/widgets/lib/widget-shared`
- shared select/menu surfaces
  - `apps/web/src/components/ui/select.tsx`
  - `apps/web/src/components/ui/filter-menu-styles.ts`
- badges, buttons, sheets, tooltips, separators
  - `apps/web/src/components/ui/...`

These are the first places to look before building a new surface style.

Current note:

- the shared `Select` primitive now reuses the same dark filter-menu surface language as the journal and trades toolbars, so dashboard/product pages should prefer sizing/layout overrides only instead of introducing page-specific select skins
- AI mutations and assistant streaming surfaces should route provider/rate-limit failures through the shared AI toast path, so users see a short recoverable message instead of raw quota errors or stalled UI state
- the journal entry route now waits for fetched entry state to hydrate before mounting the content editor, journal autosave debounces the full draft so slash-inserted widgets do not trigger overlapping `journal.update` loops, and journal save actions read from the live editor snapshot so slash/AI/chart inserts are not lost behind stale page-state content
- dashboard charts mounted inside the journal editor should use the embedded render mode rather than full dashboard fetch/render behavior, booting into a one-week window with comparison disabled and non-essential Recharts churn removed so rich chart blocks stay responsive inside TipTap
- the journal Insights tab now uses a dedicated shell primitive modeled after `/dashboard/prop-tracker`, so workflow cards, question/pattern panels, and psychology/performance analysis all share the same nested border/body structure instead of mixing route-local widget frames
- dashboard widget edit entry should come from direct double-click interactions on widget surfaces rather than long-press timers, so the main widget grid and chart widget section share the same discoverable gesture without a separate long-press path

## State and data patterns

- server data
  - TanStack Query + tRPC
- account selection and shell state
  - local stores under `apps/web/src/stores`
- search params / view state
  - `nuqs` where already in use
- lightweight alpha usage tracking
  - `apps/web/src/lib/alpha-analytics.ts`
  - `apps/web/src/features/platform/alpha/hooks/use-alpha-page-tracking.ts`

## Frontend build/check workflow

From repo root:

```bash
bun dev:web
bun check-types
bun lint
bun test
```

From `apps/web`:

```bash
bun dev
bun check-types
bun lint
bun build
```

`apps/web` package-local `build` and `check-types` now regenerate the shared tRPC declarations before they run, so isolated builds like Vercel's `apps/web` root-directory project do not depend on ignored generated files already existing in a developer workspace.

At runtime, browser-side server origin resolution is intentionally stricter than local development:

- set `NEXT_PUBLIC_SERVER_URL` to the bare server origin, for example `https://profitabledge-server.vercel.app`
- trailing slashes are normalized away before tRPC/auth/proxy requests are built
- localhost/LAN failover is only kept for local browser sessions; production browser sessions stay pinned to the configured server origin instead of retrying `localhost`
- browser auth and tRPC traffic now terminates on the web app origin first (`/api/auth/...` and `/trpc/...`) and is proxied server-side, so split deployments do not depend on third-party browser cookies between separate `*.vercel.app` project domains
- the server proxy strips upstream compression and transfer headers before returning proxied auth/tRPC responses, so browsers do not attempt to decode already-decoded bodies on split deployments
- the assistant surface lives at `/assistant`, and the legacy `/ai` path is kept as a redirect so stale bundles or old navigation links do not 404 in production
- unfinished community discovery surfaces are intentionally hidden from the sidebar, command palette, settings navigation, notification deep-links, and public-profile routing until feed, leaderboard, and public-profile paths are ready to ship

## When working on a new section

Start from:

1. the route page in `apps/web/src/app/...`
2. the owning feature folder in `apps/web/src/features/...`
3. the dashboard shell/nav/breadcrumb files if the section is user-visible in navigation

That keeps feature work aligned with the rest of the app instead of scattering logic into the route tree.
