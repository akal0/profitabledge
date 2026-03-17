# Alpha Operations

This page describes the current alpha runtime and verification model.

## Release gate

From repo root, the alpha verification gate is:

```bash
bun check-types
bun lint
bun test
bun run --cwd apps/server build
bun run --cwd apps/web build
```

The same checks now run in `.github/workflows/ci.yml`.

## Environment setup

Use the maintained example files as the starting point:

- `apps/server/.env.example`
- `apps/web/.env.example`

For local and CI build sanity, the most important variables are:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_SERVER_URL`
- `NEXT_PUBLIC_WEB_URL`
- `CREDENTIAL_ENCRYPTION_KEY`
- `BROKER_WORKER_SECRET`
- `ALPHA_ENABLE_AI_ASSISTANT`
- `ALPHA_ENABLE_COMMUNITY`
- `ALPHA_ENABLE_CONNECTIONS`
- `ALPHA_ENABLE_BACKTEST`
- `ALPHA_ENABLE_FEEDBACK`
- `ALPHA_ENABLE_SUPPORT_DIAGNOSTICS`
- `ALPHA_ENABLE_SCHEDULED_SYNC`
- `ALPHA_ENABLE_MT5_INGESTION`
- `ALPHA_SUPPORT_EMAIL`
- `NEXT_PUBLIC_ALPHA_ENABLE_AI_ASSISTANT`
- `NEXT_PUBLIC_ALPHA_ENABLE_COMMUNITY`
- `NEXT_PUBLIC_ALPHA_ENABLE_CONNECTIONS`
- `NEXT_PUBLIC_ALPHA_ENABLE_BACKTEST`
- `NEXT_PUBLIC_ALPHA_ENABLE_FEEDBACK`
- `NEXT_PUBLIC_ALPHA_ENABLE_SUPPORT_DIAGNOSTICS`

Production note:

- the server Vercel project owns Better Auth CORS and trusted-origin checks, so `WEB_URL`, `NEXT_PUBLIC_WEB_URL`, and `CORS_ORIGIN` must be set on the `apps/server` deployment as well as any web-side `NEXT_PUBLIC_*` settings
- use bare origins such as `https://profitabledge-web.vercel.app` without a trailing slash; the server now normalizes trailing slashes, but origin-only values are still the intended format
- set `NEXT_PUBLIC_SERVER_URL` on the web deployment to the bare server origin such as `https://profitabledge-server.vercel.app`; the web client now normalizes trailing slashes, and production browser sessions no longer fall back to `localhost` when that value is present or expected
- Better Auth session cookies now stay on the default localhost behavior for local development, but secure split-origin deployments like separate `profitabledge-web.vercel.app` and `profitabledge-server.vercel.app` projects switch to `SameSite=None` secure cookies so social-login sessions survive the redirect back into the web app

## Runtime shape

The request-serving apps and worker-like processes are now separate concerns:

- `apps/server`
  - Next.js server app for tRPC, auth, upload routes, and server APIs
- `apps/web`
  - Next.js frontend app
- `services/mt5-worker`
  - Python MT5 terminal worker / supervisor
- `bun run --cwd apps/server sync:worker`
  - server-side scheduled provider sync worker

Important rule:

- the tRPC route in `apps/server/src/app/trpc/[trpc]/route.ts` no longer boots background schedulers

## Observability and support

Alpha support tooling now has three layers:

- health endpoints
  - `apps/server/src/app/api/health/route.ts`
  - `apps/web/src/app/api/health/route.ts`
- persisted operations data
  - `activation_milestone`
  - `app_event`
  - `user_feedback`
- in-app diagnostics
  - `/dashboard/settings/support`
  - backed by `apps/server/src/routers/operations.ts`

The support page is intentionally user-scoped. It exposes:

- current alpha flags
- runtime/config readiness
- connection and sync diagnostics
- recent visible errors
- activation milestones
- recent feedback submissions

## Contracts

The web app no longer imports `apps/server` source types directly for tRPC.

- generated declarations live under `packages/contracts/generated/server`
- regenerate them with `bun run contracts:generate-trpc`
- root `bun check-types` and `bun build` run contract generation first

## Alpha scope guardrails

The connections UI only exposes supported alpha providers:

- `mt5-terminal`
- `ctrader`
- `match-trader`
- `tradelocker`

Non-operational provider stubs remain in the repo for future implementation, but they are not shown as connectable alpha options.

Public profiles are intentionally held back during alpha. Public sharing remains limited to share-card, verified-track-record, and link-only public proof surfaces.

The public proof surface is intentionally narrower than community discovery:

- URLs are revocable and human-readable: `/{username}/{publicAccountSlug}/trades`
- proof pages stay link-only and are not surfaced in feeds, leaderboards, or public-profile discovery
- the page is trades-first and trust-first, exposing connection source, trade provenance, and edit/delete trust signals instead of the owner dashboard

The web shell and backtest shell now emit lightweight `navigation` events into the operations router so alpha usage can be inspected from the support page without a separate analytics vendor.

## Incident basics

If alpha issues appear in production, verify in this order:

1. `bun check-types`
2. `bun run --cwd apps/server build`
3. `bun run --cwd apps/web build`
4. worker processes:
   - Python MT5 supervisor
   - `bun run --cwd apps/server sync:worker`
5. `/api/health` on both apps
6. environment values against the example files

If a provider-specific issue appears, de-scope the affected provider in the settings catalog before widening alpha access again.
