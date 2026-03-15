# Alpha Launch Hardening Plan

This document turns the current codebase audit into an execution plan for alpha launch readiness.

## Goals

- make the repo shippable with a dependable verification gate
- reduce onboarding friction for contributors
- de-risk the highest-probability alpha failures
- de-scope unfinished surfaces that would create support burden

## Current State Summary

The repo is not alpha-ready yet because the release gate is incomplete:

- server typecheck fails
- server production build fails
- web lint is not configured
- there is no CI workflow in the repo
- there is no real automated test suite
- the web app still depends on server source types through `packages/contracts/src/trpc.d.ts`
- background sync is started from the request server instead of a dedicated worker entrypoint

There is also structural debt that will slow the team down during alpha:

- several oversized route/router/lib files still own too much behavior
- stale workspace scripts and duplicate config files remain
- generated JS/DTS artifacts are mixed into app folders
- the root README still describes an old starter template instead of the real product

## Phase 0: Release Gate Stabilization

This phase is mandatory before alpha.

### Exit criteria

- `bun check-types` passes
- `bun run --cwd apps/server build` passes
- `bun run --cwd apps/web build` passes
- `bun run --cwd apps/web lint` runs non-interactively and passes
- a CI workflow exists and runs the same checks on pull requests

### Tasks

1. Fix server type debt
- repair the broken imports and stale field names in `apps/server/src/lib/ai-insights.ts`
- fix type model mismatches in `apps/server/src/lib/ai/engine/behavioral-analyzer.ts`
- fix stale trade/session field assumptions in `apps/server/src/lib/ai/engine/live-monitor.ts`
- resolve plan generator and leaderboard typing issues in `apps/server/src/lib/ai/plan-generator.ts` and `apps/server/src/lib/leaderboard-calculator.ts`
- repair router-level schema mismatches in `apps/server/src/routers/rules.ts`, `apps/server/src/routers/social-redesign.ts`, and `apps/server/src/routers/trades/mutations.ts`

2. Configure frontend lint
- add an explicit ESLint config for the web app
- stop relying on `next lint` interactive setup
- add a repo-level lint script or keep app-local scripts but make them CI-ready

3. Add CI
- add a GitHub Actions workflow for `check-types`, `build`, and `lint`
- fail fast on changed workspaces
- keep the first workflow minimal and stable

4. Remove web-to-server compile coupling
- replace `packages/contracts/src/trpc.d.ts` with a generated or deliberately published contract surface
- do not import `apps/server` source from the web app or shared packages

5. Add a minimum smoke-test layer
- auth sign-in/session check
- account registration/sync check
- historical/open trade sync check
- replay session save/load check
- AI assistant request sanity check

## Phase 1: Runtime Boundary Cleanup

This phase removes deployment risks and improves operational predictability.

### Exit criteria

- request server does not start background schedulers
- worker-like tasks have explicit entrypoints
- env/config validation fails early at startup

### Tasks

1. Move scheduler/background sync out of the request path
- remove scheduler boot from `apps/server/src/app/trpc/[trpc]/route.ts`
- introduce a dedicated worker or cron entrypoint for `sync-scheduler`
- document how alpha hosting should run the worker process

2. Add env validation
- create a shared server env schema
- validate required secrets and URLs at startup
- remove scattered force-unwrapped `process.env.*!` usage where possible

3. Tighten config ownership
- keep one canonical Next config per app
- remove duplicate compiled config artifacts
- document expected env vars in a maintained example file or docs reference

## Phase 2: Product Scope Hardening

This phase is about reducing alpha support burden.

### Exit criteria

- unfinished product surfaces are hidden or clearly disabled
- critical user paths are coherent and supportable
- alpha scope is explicit

### Tasks

1. De-scope unfinished surfaces
- hide or disable follow/unfollow until implemented
- hide incomplete provider stubs such as Tradovate, DXTrade, and TopstepX if they are not operational
- remove or gate half-wired social/community actions that would create broken expectations

2. Focus the supported alpha paths
- onboarding
- account connection and sync
- trades table and analytics
- journal
- replay/backtest
- AI assistant

3. Add guardrails to expensive features
- feature flags for AI-heavy surfaces
- kill switches for sync/provider integrations
- sensible rate limiting and fallback behavior

## Phase 3: Contributor and Support Readiness

This phase makes the repo easier to work in during alpha.

### Exit criteria

- onboarding docs are accurate
- support/debug paths are clear
- repo hygiene no longer fights contributors

### Tasks

1. Refresh docs
- replace stale starter-template README content with product-specific onboarding
- keep `docs/reference` aligned with the real architecture
- add an alpha operations page with deploy, rollback, and incident basics

2. Add support tooling
- basic admin/support visibility for account sync state
- user feedback path in the app
- error monitoring and logging dashboards

3. Clean workspace hygiene
- remove stale scripts and duplicate files
- keep generated artifacts out of tracked source
- keep root scripts aligned with actual workspaces

## Phase 4: Structural Cleanup After the Gate Is Green

This phase improves maintainability but is secondary to shipping alpha safely.

### Main hotspots

- `apps/server/src/lib/mt5/ingestion.ts`
- `apps/server/src/routers/accounts.ts`
- `apps/server/src/routers/webhook.ts`
- `apps/web/src/app/(dashboard)/dashboard/backtest/replay/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/trades/components/trade-table-infinite.tsx`
- `apps/server/src/lib/ai/query-executor.ts`
- `apps/server/src/lib/journal-ai-capture.ts`

### Tasks

1. Keep splitting oversized composition roots
- route/page files should mostly orchestrate
- feature logic should live in hooks, services, and feature-local modules

2. Standardize ownership
- router folders: `queries`, `mutations`, `services`, `shared`
- frontend features: `components`, `hooks`, `lib`, `types`

3. Continue reducing source coupling
- keep app imports inside app boundaries
- keep shared packages small and explicit

## Suggested Execution Order

1. Fix release gate failures
2. Configure lint and CI
3. Break web-to-server compile coupling
4. Move background sync to a worker boundary
5. De-scope unfinished alpha surfaces
6. Refresh docs and repo hygiene
7. Continue large-file decomposition

## Items That Can Wait Until Post-Alpha

- deeper visual polish
- non-core provider integrations
- broad social/community expansion
- advanced analytics that are not part of the alpha promise
- additional architectural refactors outside the hotspots above

## Definition of Alpha Ready

The repo is alpha-ready when:

- builds are green
- typecheck is green
- lint is green
- basic smoke coverage exists
- deployment/runtime boundaries are explicit
- unsupported features are hidden
- docs match reality
- the team has a sane way to debug user issues during the alpha window
