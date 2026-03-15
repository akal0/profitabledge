# MT5 Terminal Farm Design

**Status**: Draft  
**Date**: March 9, 2026  
**Scope**: First-party MT5 credential sync, separate from the EA path

## Summary

This document defines how Profitabledge should support MT5 auto-sync without relying on MetaApi and without requiring the user to install the Profitabledge EA.

The core constraint is simple:

- MT5 does not expose a broker-agnostic retail server API that we can call directly with `login + password + server`.
- The official integration path exposed by MetaQuotes is through a locally running terminal process.

Because of that, a first-party MT5 connector is not a normal SaaS API integration. It is a **terminal orchestration problem**.

Profitabledge must own:

- terminal lifecycle
- broker session login
- polling and reconciliation
- raw execution ingestion
- account/session health

The existing EA remains the high-fidelity enrichment path for:

- manipulation tracking
- spread/slippage
- post-exit price tracking
- execution-side metrics that the terminal farm cannot recover precisely

## Goals

- Let a user connect MT5 with `server`, `login`, and `password`
- Sync history, open positions, and account state without the EA
- Support as many brokers and prop-firm MT5 servers as practical
- Preserve a clean normalized model that other platforms can use later
- Keep the MT5 farm operationally separate from the web app and API

## Non-Goals

- Trade execution in v1
- Tick-perfect post-exit analytics in v1
- Replacing the EA for advanced execution metrics
- Reverse-engineering MetaTrader server protocol
- Claiming true push-based broker events where MT5 only gives us terminal polling

## Ground Truth

MT5 first-party sync should be built around the official local-terminal integration surface:

- `initialize`
- `login`
- `account_info`
- `positions_get`
- `history_deals_get`
- `history_orders_get`

This means each synced account must be attached to a real terminal session managed by us.

Official references:

- [MetaTrader5 initialize](https://www.mql5.com/en/docs/python_metatrader5/mt5initialize_py)
- [MetaTrader5 login](https://www.mql5.com/pt/docs/python_metatrader5/mt5login_py)
- [MetaTrader5 history_deals_get](https://www.mql5.com/en/docs/python_metatrader5/mt5historydealsget_py)
- [MetaTrader5 positions_get](https://www.mql5.com/en/docs/python_metatrader5/mt5positionsget_py)

## Product Model

Profitabledge should expose two MT5 sync modes:

### 1. Credential Sync

This is the terminal-farm product.

It provides:

- account verification
- closed trade history
- open positions
- balance/equity snapshots
- near-live state updates

It does **not** guarantee:

- exact spread/slippage
- exact intra-trade opportunity curve
- exact post-exit continuation metrics

### 2. Agent Sync

This is the existing EA model.

It provides:

- manipulation structure
- intra-trade price path
- post-exit peak tracking
- execution metadata that only the terminal-side agent sees reliably

The correct long-term UX is:

- credential sync = default onboarding
- EA sync = advanced upgrade

## High-Level Architecture

The system should be split into a control plane and an execution plane.

### Control Plane

Lives with the main app/backend.

Components:

- `Broker Connection API`
- `Credential Vault`
- `MT5 Session Orchestrator`
- `Sync Scheduler`
- `Ingestion Pipeline`
- `Projection Workers`
- `Realtime Event Publisher`

Responsibilities:

- accept user credentials
- encrypt and store secrets
- assign accounts to workers
- track sync health
- ingest normalized events
- update product-facing tables

### Execution Plane

Runs the MT5 farm.

Components:

- `Worker Host`
- `Terminal Runtime`
- `Local MT5 Adapter`
- `Worker Watchdog`
- `Session Heartbeat Reporter`

Responsibilities:

- run isolated MT5 terminal sessions
- log into broker servers
- read account state and history from the local terminal
- publish normalized deltas back to the control plane
- restart broken sessions

## Recommended Runtime Shape

### Central App Stack

Keep the core app in the current TypeScript/Bun stack.

### MT5 Worker Stack

Use a separate Python worker service for v1.

Reason:

- the official `MetaTrader5` package is Python-first
- it reduces integration risk
- it keeps terminal-specific code out of the Next/TRPC app

The Python worker should not be public-facing. It should communicate through:

- a queue
- signed task leases
- outbound calls to the control plane

## Worker Isolation Model

Each synced MT5 account should map to one isolated terminal session.

Isolation unit options:

1. One Windows VM per account  
   Highest isolation, expensive

2. One Windows host with multiple isolated terminal directories  
   Best v1 tradeoff

3. Wine/Linux emulation  
   Not recommended for v1

Recommendation:

- start with Windows hosts
- run one terminal instance per account
- keep each instance in an isolated data directory
- treat the host as a session density pool, not as a multi-tenant app server

Inference:

- Windows is the safest production target because MT5 is Windows-native
- Linux/Wine may work for some brokers, but it adds failure modes that are operationally expensive

## Session Lifecycle

### 1. Connection Created

User submits:

- `server`
- `login`
- `password`
- optional `passwordType`

The API:

- validates format
- encrypts credentials
- creates `platform_connection`
- enqueues `mt5.bootstrap`

### 2. Worker Assignment

The orchestrator:

- picks a worker host with spare capacity
- creates a `broker_session`
- assigns a lease
- sends bootstrap instructions

### 3. Terminal Bootstrap

The worker:

- ensures MT5 terminal binary is present
- ensures account-scoped terminal directory exists
- launches or reuses the account session
- calls `initialize`
- calls `login`
- verifies terminal/account identity

### 4. Initial Backfill

After login succeeds:

- fetch account info
- fetch open positions
- fetch historical deals and orders for the bootstrap window
- store raw events first
- build derived trade projections

Recommendation:

- default initial backfill window: 90 days
- allow server-side expansion to 365 days in batches

### 5. Continuous Sync

The worker enters a polling loop:

- positions every `2-5s`
- account info every `5-10s`
- deals every `5-10s`
- full reconciliation every `30-60m`

### 6. Recovery

If login fails, terminal hangs, or the broker server becomes unreachable:

- mark session degraded
- retry with backoff
- restart the terminal if health checks fail
- escalate to `connection.status = error` after threshold breach

## Why Raw Executions Must Be the Source of Truth

The current app is centered on `trade`, `open_trade`, and account snapshots. That is good for reads, but not good enough as the ingestion source for MT5.

MT5 has:

- multiple deals per position
- scale-ins
- partial closes
- order history separate from deal history
- position lifecycle that is not always one entry / one exit

Therefore the terminal farm should ingest:

- orders
- deals
- position snapshots
- account snapshots

Then derive:

- `trade`
- `open_trade`
- `equity_snapshot`

## Proposed Data Model

Keep existing read tables:

- `platform_connection`
- `trading_account`
- `trade`
- `open_trade`
- `equity_snapshot`

Add immutable MT5 ingestion tables:

### `broker_session`

- `id`
- `connection_id`
- `worker_host_id`
- `session_key`
- `platform`
- `status`
- `heartbeat_at`
- `last_login_at`
- `last_error`
- `created_at`
- `updated_at`

### `broker_order_event`

- `id`
- `connection_id`
- `account_id`
- `platform`
- `remote_order_id`
- `position_id`
- `symbol`
- `side`
- `type`
- `state`
- `requested_volume`
- `filled_volume`
- `price`
- `sl`
- `tp`
- `comment`
- `raw_payload`
- `event_time`
- `ingested_at`

### `broker_deal_event`

- `id`
- `connection_id`
- `account_id`
- `platform`
- `remote_deal_id`
- `remote_order_id`
- `position_id`
- `entry_type`
- `symbol`
- `side`
- `volume`
- `price`
- `profit`
- `commission`
- `swap`
- `fee`
- `comment`
- `raw_payload`
- `event_time`
- `ingested_at`

Unique key:

- `(platform, account_id, remote_deal_id)`

### `broker_position_snapshot`

- `id`
- `connection_id`
- `account_id`
- `platform`
- `remote_position_id`
- `symbol`
- `side`
- `volume`
- `open_price`
- `current_price`
- `profit`
- `swap`
- `sl`
- `tp`
- `snapshot_time`
- `raw_payload`

### `broker_account_snapshot`

- `id`
- `connection_id`
- `account_id`
- `balance`
- `equity`
- `margin`
- `free_margin`
- `margin_level`
- `snapshot_time`
- `raw_payload`

### `broker_sync_checkpoint`

- `connection_id`
- `last_deal_time`
- `last_deal_id`
- `last_order_time`
- `last_position_poll_at`
- `last_account_poll_at`
- `last_full_reconcile_at`
- `updated_at`

## Projection Strategy

The UI should continue reading the existing tables.

### `trade`

Derived from grouped MT5 deal events.

Grouping rule:

- primary key for lifecycle: `position_id`
- fallback only when `position_id` is absent

Each derived trade should aggregate:

- first entry deal
- final exit deal
- weighted average entry
- weighted average exit
- total commission
- total swap
- realized PnL
- total size in/out

### `open_trade`

Derived from the latest open-position snapshots.

### `equity_snapshot`

Derived from account snapshots, collapsed to one row per day for charts, with optional higher-frequency raw snapshots retained separately.

## Sync Semantics

### Polling, Not Fake Streaming

MT5 terminal farm v1 should be honest about its update model.

What users experience:

- near-live updates

What the system actually does:

- frequent polling plus delta publication

Recommendation:

- open trades and account state: publish only changed rows
- closed deals: idempotent append
- websocket layer: push projection changes to clients after ingestion

### Cursors

Use a compound checkpoint:

- `last_deal_time`
- `last_deal_id`

Reason:

- timestamps alone are not enough under burst activity
- deal ids alone are not always safe across bootstrap windows

Recommendation:

- poll with small overlap, for example `cursor_time - 60s`
- dedupe on unique deal key

### Reconciliation

Run a periodic full reconciliation because terminals and brokers are not perfectly reliable.

Reconcile:

- open positions
- recent deals
- account balance/equity

Recommendation:

- recent deals reconciliation window: last 24h
- deep reconciliation window: last 7d overnight

## Broker Server Discovery Risk

Supporting "all brokers" on MT5 has a hidden operational edge case:

- some brokers and prop firms work fine with a generic MT5 terminal
- some require broker-specific terminal presets or server config files

Design implication:

- `platform_connection.meta` should store `server_name`
- optionally store `server_config_blob` or `terminal_distribution_hint`

This is a real v1 risk area and should be treated as part of onboarding, not as an afterthought.

## Security Model

### Secrets

- credentials encrypted at rest with KMS-backed envelope encryption
- decrypted only on worker bootstrap or re-login
- never logged
- never exposed to the browser after create

### Password Type

Support:

- `trading`
- `investor`

Inference:

- investor password is preferable for read-only import where supported
- some brokers or prop environments may not provide one, so the system must allow either with explicit labeling

### Worker Trust Boundary

Workers should:

- fetch credentials just-in-time
- hold them in memory only
- wipe them on session teardown
- report only normalized payloads or redacted raw payloads

## Operational Controls

Each worker host needs:

- heartbeat every `10-15s`
- terminal-process watchdog
- memory and handle-count alarms
- stale session detection
- relogin threshold alarms
- screenshot or log bundle capture for debugging

Each connection needs statuses beyond the current app-level states:

- `provisioning`
- `bootstrapping`
- `syncing`
- `degraded`
- `error`
- `paused`

## Integration With Existing Profitabledge Tables

Current code surfaces that stay relevant:

- [connections.ts](/Users/abdul/Desktop/profitabledge/apps/server/src/db/schema/connections.ts)
- [trading.ts](/Users/abdul/Desktop/profitabledge/apps/server/src/db/schema/trading.ts)
- [webhook.ts](/Users/abdul/Desktop/profitabledge/apps/server/src/routers/webhook.ts)
- [EA/ProfitabledgeSync.mq5](/Users/abdul/Desktop/profitabledge/EA/ProfitabledgeSync.mq5)

Recommended relationship:

- terminal farm writes normalized raw MT5 events
- projection jobs update `trade`, `open_trade`, and `equity_snapshot`
- EA, when present, enriches those projected trades with advanced metrics

That means the EA becomes an enrichment layer, not the ingestion backbone.

## Suggested Service Boundaries

### `apps/server`

Owns:

- user APIs
- connection management
- encrypted credential storage
- projection jobs
- websocket fanout

### `services/mt5-worker`

Owns:

- terminal bootstrap
- login
- polling
- session health
- normalized event publishing

### `services/mt5-orchestrator`

Optional in v1. Can start inside `apps/server`, then split later.

Owns:

- worker assignment
- queue dispatch
- lease management
- failover

## Rollout Plan

### Phase 0

Design and schema

- add immutable broker event tables
- add broker session tables
- define normalized MT5 event contracts

### Phase 1

Single-worker private alpha

- one Windows worker host
- manual worker assignment
- one account per terminal session
- polling only
- 90-day backfill

### Phase 2

Projection and realtime stabilization

- open trade projection
- trade lifecycle builder
- websocket publishing
- session health dashboards

### Phase 3

Multi-host orchestration

- worker leasing
- failover
- density tuning
- automated recovery

### Phase 4

EA enrichment merge

- attach EA to an existing MT5 credential-synced account
- merge exact manipulation/post-exit metrics into projected trades

## What We Should Build Next

Implementation order for the codebase:

1. Add raw broker event schema and session/checkpoint tables
2. Build an MT5 normalized event contract document
3. Create a Python `mt5-worker` prototype that can:
   - initialize terminal
   - login
   - fetch account info
   - fetch positions
   - fetch historical deals
4. Add a server-side ingestion endpoint for normalized worker payloads
5. Build the projection layer from `broker_deal_event` to `trade`
6. Only after that, wire UI onboarding for MT5 credential sync

## Local Control-Plane Test

The current repo now includes the first locally testable control-plane slice:

- raw MT5 ingestion tables in schema
- worker ingestion router
- local mock sync script

Suggested local flow:

1. Set `DATABASE_URL`
2. Set `MT5_TEST_USER_ID` to an existing local user id
3. Run schema sync with `bun run db:push` from `apps/server`
4. Run the mock ingestion with `bun run mt5:mock-sync`
5. Inspect:
   - `platform_connection`
   - `trading_account`
   - `broker_account_snapshot`
   - `broker_position_snapshot`
   - `broker_deal_event`
   - `trade`
   - `open_trade`
   - `equity_snapshot`

The mock script creates or reuses a local `mt5-terminal` connection, then pushes:

- one account snapshot
- one open position
- one closed trade lifecycle
- one order event

This validates:

- account auto-linking
- raw MT5 event storage
- open trade projection
- closed trade projection
- daily equity snapshot updates

## Sources

- [MetaTrader5 initialize](https://www.mql5.com/en/docs/python_metatrader5/mt5initialize_py)
- [MetaTrader5 login](https://www.mql5.com/pt/docs/python_metatrader5/mt5login_py)
- [MetaTrader5 history_deals_get](https://www.mql5.com/en/docs/python_metatrader5/mt5historydealsget_py)
- [MetaTrader5 positions_get](https://www.mql5.com/en/docs/python_metatrader5/mt5positionsget_py)
