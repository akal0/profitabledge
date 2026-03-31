# Database Overview

The database layer lives in `apps/server/src/db` and uses Drizzle ORM over Postgres/Neon.

## Core files

- `apps/server/src/db/index.ts`
  - Drizzle client creation
- `apps/server/src/db/schema/index.ts`
  - schema export barrel
- `apps/server/src/db/schema/*.ts`
  - domain schema ownership
- `apps/server/src/db/migrations/*`
  - generated and manual migrations

## Schema ownership map

Current schema files:

- `auth.ts`
  - users, sessions, verification, auth identities
- `trading.ts`
  - trading accounts, trades, prop state, challenge lineage, account metrics
- `connections.ts`
  - broker/platform connections and related sync state
- `mt5-sync.ts`
  - MT5 raw sync/supporting persistence
- `notifications.ts`
  - in-app notifications and related metadata
- `journal.ts`
  - journal entities and related content
- `backtest.ts`
  - backtest domain persistence
- `copier.ts`
  - trade copier entities
- `operations.ts`
  - alpha activation milestones, app events, and in-app feedback/support records
- `billing.ts`
  - mirrored Stripe billing state, webhook dedupe, member referral profiles/conversions/reward grants, admin-approved affiliate applications/profiles/attribution/groups/commission events, affiliate payment methods and payout records, entitlement overrides, and Edge credit usage/grant ledgers for platform-funded AI
- `social-redesign.ts`
  - feed/social/leaderboard related entities
- `ai.ts`
  - AI logs, saved provider credentials, or other AI-related structured entities
- `trader-brain.ts`
  - trader intelligence/profile style entities
- `coaching.ts`
  - coaching or guidance-supporting entities

## Persistence workflow

When you add a new persisted feature:

1. update the relevant schema file under `schema/...`
2. create or update the matching migration under `migrations/...`
3. update the server router/domain logic that reads it
4. update the web UI that depends on the new field/entity

Do not treat schema-only changes as done. In this repo, a useful database change almost always needs matching router and UI work.

## Commands

From repo root:

```bash
bun db:push
bun db:generate
bun db:migrate
bun db:studio
```

From `apps/server`:

```bash
bun db:push
bun db:generate
bun db:migrate
bun db:studio
```

## Current conventions

- keep domain tables grouped into schema files by product area, not by random field additions
- prefer explicit migrations for meaningful product changes
- use the server domain layer to enforce business meaning instead of relying on raw DB fields alone
- when a feature needs historical continuity, model it explicitly rather than overloading one account row

The recent prop challenge lineage work is the best example of that last rule: challenge progression now needs a challenge-level entity, not just per-account flags.

The same rule now applies to alpha operations work: support diagnostics, activation funnel tracking, and user feedback now persist in dedicated `operations.ts` tables instead of being inferred from ad hoc logs.

Billing follows the same approach: Stripe is the external billing system of record, and customer/subscription/order state, referral and affiliate growth state, affiliate payout operations, webhook dedupe, and reward-based entitlement overrides are mirrored into dedicated `billing.ts` tables so the app can enforce entitlements locally.
