# Agent And Tooling Reference

This is the human-readable summary of repo-level agent/tooling context.

## Important local development rule

Do not start, stop, or restart the development servers unless explicitly asked.

Assume the user already has:

- web on `3001`
- server on `3000`

## Core stack

- Bun
- Turborepo
- Next.js
- React 19
- tRPC
- Drizzle
- Postgres / Neon
- Better Auth

## High-signal file entrypoints

- web tRPC client
  - `apps/web/src/utils/trpc.ts`
- dashboard shell
  - `apps/web/src/app/(dashboard)/layout.tsx`
- main tRPC router
  - `apps/server/src/routers/index.ts`
- auth
  - `apps/server/src/lib/auth.ts`
- tRPC context
  - `apps/server/src/lib/context.ts`
- database schema barrel
  - `apps/server/src/db/schema/index.ts`

## Environment assumptions

Backend examples:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `CORS_ORIGIN`
- worker/provider secrets where relevant

Frontend examples:

- `NEXT_PUBLIC_SERVER_URL`

## Canonical doc note

`CLAUDE.md` still exists at repo root as a tooling entrypoint, but current project reference docs live under `docs/reference/...`.
