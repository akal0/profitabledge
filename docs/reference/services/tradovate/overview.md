# Tradovate Connector Overview

Current status:

- CSV import path implemented for Tradovate Performance and Position History exports
- OAuth/API sync still not implemented
- live WebSocket sync still not implemented

This document describes the official Tradovate surfaces available to Profitabledge for:

- account linking
- closed-trade history sync
- open-position sync
- live account/order/position updates
- manual file import fallback
- broker-native quote ingestion for analytics

## Official sources

- [Tradovate API access support article](https://tradovate.zendesk.com/hc/en-us/articles/4408844269851-How-Can-I-Access-Your-API)
- [Tradovate OAuth registration support article](https://tradovate.zendesk.com/hc/en-us/articles/360041518712-How-do-I-Authorize-an-Application-to-Use-My-API)
- [Should I use OAuth, an API key, or an API key with a dedicated password?](https://tradovate.zendesk.com/hc/en-us/articles/360059734493-Should-I-Use-OAuth-an-API-Key-or-an-API-Key-with-a-Dedicated-Password)
- [Tradovate reports export docs](https://tradovate.zendesk.com/hc/en-us/articles/17100956960539-Reports-Page)
- [How is the Tradovate API partitioned?](https://raw.githubusercontent.com/tradovate/example-api-faq/main/docs/HowIsTheTradovateApiPartitioned.md)
- [How are the request rate and data size limits calculated?](https://raw.githubusercontent.com/tradovate/example-api-faq/main/docs/HowAreTheRequestRateAndDataSizeLimitsCalculated.md)
- [Official OAuth example](https://github.com/tradovate/example-api-oauth)
- [Official API JavaScript example](https://github.com/tradovate/example-api-js)
- [Official WebSocket user sync example](https://github.com/tradovate/example-api-js/tree/master/example-code/user-sync-request)

## What Profitabledge can collect from Tradovate

Tradovate exposes three useful collection paths.

### 1. OAuth + API sync

This is the primary SaaS path.

Official OAuth example flow:

1. redirect the user to `https://trader.tradovate.com/oauth`
2. receive an authorization `code`
3. exchange it at `POST https://demo.tradovateapi.com/v1/auth/oauthtoken`
4. call `/auth/me` with the returned bearer token

Source: [official OAuth example](https://github.com/tradovate/example-api-oauth), [API access article](https://tradovate.zendesk.com/hc/en-us/articles/4408844269851-How-Can-I-Access-Your-API)

Use this path for:

- account discovery
- closed-trade history bootstrap
- open-position sync
- periodic reconciliation

### 2. WebSocket user sync

This is the primary live-update path.

Tradovate officially documents a WebSocket-based user sync/request API alongside REST and market-data APIs. The official `user-sync-request` example shows:

- connect to `wss://demo.tradovateapi.com/v1/websocket` or `wss://live.tradovateapi.com/v1/websocket`
- authenticate over the socket
- send `user/syncRequest`
- receive an initial snapshot plus incremental entity updates

The example explicitly shows live entities including:

- `accounts`
- `positions`
- `orders`
- `fills`
- `fillPairs`
- `cashBalances`
- `contracts`
- `products`
- `executions`
- `orderVersions`

Sources: [API partition doc](https://raw.githubusercontent.com/tradovate/example-api-faq/main/docs/HowIsTheTradovateApiPartitioned.md), [official user-sync example](https://github.com/tradovate/example-api-js/tree/master/example-code/user-sync-request)

Use this path for:

- live trade open/close updates
- partial fills and partial exits
- order lifecycle changes
- faster balance and position updates than pure polling

### 3. CSV report exports

This is the fallback/manual path.

Tradovate officially supports CSV export from its Reports page for:

- Orders
- Position History
- Cash History
- Client Statements
- Subscriptions

Source: [Reports Page](https://tradovate.zendesk.com/hc/en-us/articles/17100956960539-Reports-Page)

Use this path for:

- manual backfill when API access is unavailable
- one-time historical imports
- recovery if live sync was unavailable for a period

This is not suitable for live sync.

## Recommended connector model for Profitabledge

Tradovate should not be built like MT5 terminal sync. It should be built like an API-native futures connector with a live stream.

### Primary mode: OAuth connection

User flow:

1. user clicks Connect Tradovate
2. user completes Tradovate OAuth consent
3. Profitabledge stores encrypted access token and refresh metadata in `platform_connection`
4. Profitabledge discovers Tradovate accounts and links one or more accounts
5. Profitabledge starts a live sync session for each linked account

Why this should be the default:

- official support guidance recommends OAuth for applications used by others
- API-key-with-password flows become awkward with 2FA
- OAuth avoids asking end users for raw login credentials

Source: [Should I Use OAuth, an API Key, or an API Key with a Dedicated Password?](https://tradovate.zendesk.com/hc/en-us/articles/360059734493-Should-I-Use-OAuth-an-API-Key-or-an-API-Key-with-a-Dedicated-Password)

### Secondary mode: file import

Offer a Tradovate CSV upload path for users who:

- do not have API access enabled
- only want historical imports
- need to repair gaps after downtime

In the current codebase, this extends the upload flow in:

- `/Users/abdul/Desktop/profitabledge/apps/server/src/routers/upload.ts`

The import path is now structured as:

- `/Users/abdul/Desktop/profitabledge/apps/server/src/lib/trade-import/csv/document.ts`
  - robust CSV document parsing with delimiter detection and quoted-field handling
- `/Users/abdul/Desktop/profitabledge/apps/server/src/lib/trade-import/csv/bundle.ts`
  - broker-level multi-file bundle parsing and supplemental enrichment
- `/Users/abdul/Desktop/profitabledge/apps/server/src/lib/trade-import/csv/registry.ts`
  - broker/report adapter selection
- `/Users/abdul/Desktop/profitabledge/apps/server/src/lib/trade-import/csv/parsers/...`
  - broker-specific adapters

That architecture is intended to make future broker CSV support incremental instead of adding more upload-route branching.

Current limitation:

- bundle import is implemented for Tradovate, with `Performance` or `Position History` as the trade source
- `Fills`, `Orders`, `Cash History`, and `Account Balance History` are recognized as supplemental reports inside the same upload bundle
- follow-up enrichment uploads for an already-imported Tradovate account are now supported through `upload.enrichCsvAccount`, and the dashboard header exposes that action whenever the selected account is a Tradovate account
- re-uploading the same Tradovate files against the same account is now treated as an idempotent enrichment pass: existing tickets are only updated when the normalized trade payload actually changes, and the UI reports `No new data to import` when nothing new is present
- the shared CSV upload UI now allows users to build a Tradovate report bundle across multiple file-picker opens or drag-drop actions, so they do not need to select the entire report set in one pass
- the initial add-account CSV flow uses the same multi-file bundle behavior, so a user can queue `Performance`, `Position History`, and supplemental Tradovate exports before or after choosing Tradovate as the broker
- when both `Performance` and `Position History` are present, Profitabledge now merges those trade-source reports instead of discarding `Position History`
- when a first-time Tradovate CSV bundle includes an account number that already exists on one of the user’s imported Tradovate accounts, the add-account flow stops and offers `Enrich existing account` or `Create duplicate account` explicitly instead of silently creating ambiguity
- `Account Balance History` and `Cash History` now feed account-level live balance metadata during CSV import/enrichment, and if those files are absent Profitabledge derives a current balance from `initialBalance + imported closed-trade PnL`

## How the live sync should work

### Bootstrap

On first connect or after reconnect:

1. call `/auth/me`
2. fetch account list
3. fetch current positions
4. fetch historical fills and order state since the last saved checkpoint
5. open the WebSocket user sync stream
6. persist a checkpoint only after both bootstrap and stream handoff are stable

### Steady state

During steady state:

- WebSocket user sync is the primary source of truth for live changes
- periodic REST reconciliation heals missed or out-of-order stream events
- market data subscription is optional for trade analytics, but not required for basic trade sync

### Reconciliation cadence

Tradovate documents request-rate and response-size limits. Current official guidance references:

- 5 requests/second
- roughly 100 to 200 requests/minute
- 50 items per response in common cases
- about 5 MB response size

Source: [How are the request rate and data size limits calculated?](https://raw.githubusercontent.com/tradovate/example-api-faq/main/docs/HowAreTheRequestRateAndDataSizeLimitsCalculated.md)

That means the connector should:

- prefer streaming over frequent REST polling
- page historical requests
- reconcile in short windows using cursors and entity IDs
- back off aggressively on rate-limit penalties

## Which Tradovate entities should be canonical

Tradovate is futures-first and partials are common. Use immutable execution events as the source of truth.

Recommended mapping:

- `fill`
  - canonical immutable execution event
- `fillPair`
  - helper for grouping opening and closing executions
- `position`
  - current live state only
- `order`
  - order lifecycle state
- `orderVersion`
  - modification history
- `executionReport`
  - execution/order acknowledgements
- `cashBalance`
  - account ledger and balance changes

Inference from official sources:

- the user sync example exposes `fills`, `fillPairs`, `orders`, `positions`, `cashBalances`, and `orderVersions`
- the entity-system conventions imply matching REST list endpoints for the major entity types, but exact endpoint paths and filters should be confirmed from the live API docs during implementation

Sources: [official user-sync example](https://github.com/tradovate/example-api-js/tree/master/example-code/user-sync-request), [API partition doc](https://raw.githubusercontent.com/tradovate/example-api-faq/main/docs/HowIsTheTradovateApiPartitioned.md)

## Price feed and advanced metrics

For basic trade sync, Tradovate market data is optional.

For EA-grade analytics parity, it is useful.

Tradovate officially separates market data from user/account sync:

- HTTP market-data API
- WebSocket market-data API

The official JavaScript example shows a separate market-data socket layer with operations for:

- quotes
- DOMs
- chart data
- histogram data

Sources: [API partition doc](https://raw.githubusercontent.com/tradovate/example-api-faq/main/docs/HowIsTheTradovateApiPartitioned.md), [official API JavaScript example](https://github.com/tradovate/example-api-js)

Recommended use in Profitabledge:

- Phase 1: trades, positions, balances only
- Phase 2: subscribe to quote data for symbols with open positions
- Phase 3: replay chart or tick-like market data around entry/exit windows for manipulation and post-exit metrics

Important implementation note:

- the official `accessTokenRequest` example returns both `accessToken` and `mdAccessToken`
- the official OAuth sample only demonstrates standard OAuth token exchange
- confirm the exact market-data auth shape for OAuth-connected apps before building quote sync

Sources: [official API JavaScript example](https://github.com/tradovate/example-api-js), [official OAuth example](https://github.com/tradovate/example-api-oauth)

## File import design

Tradovate CSV import should support at least:

- Performance
- Position History
- Fills
- Orders
- Cash History
- Account Balance History
- Client Statements

Recommended product behavior:

- Performance
  - group paired fills into normalized realized trades
  - collapse partial exits that share the same closing fill/time into one imported trade row
  - preserve raw fill IDs, tick size, and price format in `brokerMeta`
- Position History
  - create closed trades
  - act as a fallback base report when `Performance` is unavailable
- Fills
  - preserve raw execution rows for future execution-timeline enrichment
  - enrich the imported trades with per-fill commissions and matching order IDs
  - not ideal as a standalone trade import because fills do not express completed lifecycles by themselves
- Orders
  - enrich order lifecycle, entry/exit intent, venue, and modifications when available
- Cash History / Client Statements
  - create ledger events, deposits, withdrawals, fees, subscriptions
  - contribute fee breakdown metadata when transaction IDs line up with imported fills
- Account Balance History
  - create daily balance/equity snapshots, not individual trades

Current validated state:

- official docs confirm report export exists, but do not publish the CSV column schemas
- the current implementation has been validated against a real Tradovate `Performance` export shaped as paired fills with `buyFillId`, `sellFillId`, `qty`, `buyPrice`, `sellPrice`, `pnl`, `boughtTimestamp`, and `soldTimestamp`
- the current implementation has also been validated against a real Tradovate `Position History` export shaped as paired fill rows with `Position ID`, `Pair ID`, `Buy Fill ID`, `Sell Fill ID`, `Paired Qty`, `Buy Price`, `Sell Price`, `P/L`, `Bought Timestamp`, and `Sold Timestamp`
- Tradovate `Performance` PnL strings use `$x` for gains and `$(x)` for losses, and the import parser now normalizes both formats
- Position History support still exists, but Performance is the preferred report for closed-trade imports because it better preserves partial exits
- real `Fills`, `Orders`, `Cash History`, and `Account Balance History` samples have been inspected and are now accepted as supplemental bundle files alongside the base trade report
- the bundle importer prefers `Performance` over `Position History` when both are present in the same upload
- `Fills` and `Orders` currently enrich imported trades with commissions and execution/order metadata
- `Cash History` and `Account Balance History` are recognized today but are still mostly pass-through metadata for later ledger/snapshot work

## What fits the current provider interface

The current provider abstraction in:

- `/Users/abdul/Desktop/profitabledge/apps/server/src/lib/providers/types.ts`

is a good fit for:

- OAuth token exchange
- account discovery
- REST history backfill
- open-position polling
- balance/equity polling

It is not enough by itself for Tradovate live sync because:

- Tradovate has an official user WebSocket sync surface
- partials and order-state changes are better modeled as event streams than as periodic trade-list polling

## Recommended code shape in this repo

### Phase 1: connector MVP

Build:

- `apps/server/src/lib/providers/tradovate.ts`
  - OAuth exchange
  - `/auth/me`
  - account discovery
  - historical backfill
  - open positions
  - account state

Store:

- Tradovate access tokens in `platform_connection`
- Tradovate account IDs in `platform_connection.meta`

### Phase 2: live user sync worker

Add a Tradovate sync worker/service that:

- opens a long-lived user WebSocket
- normalizes fills/orders/positions/cash updates
- posts them into the same raw-event model used by MT5 where practical

This should be a normal server-side/background service, not a Windows terminal worker.

### Phase 3: price analytics

Add optional Tradovate market-data subscriptions for:

- live quote tracking on open symbols
- post-exit metric windows
- better slippage/spread estimation

## Testing strategy

Official Tradovate docs also describe:

- demo API environments
- live API environments
- pre-authorized docs/testing for API keys

Sources: [API partition doc](https://raw.githubusercontent.com/tradovate/example-api-faq/main/docs/HowIsTheTradovateApiPartitioned.md), [How Can I Test My API Key?](https://tradovate.zendesk.com/hc/en-us/articles/360063966493-How-Can-I-Test-My-API-Key)

Recommended testing order:

1. sample CSV imports
2. OAuth connect against demo-capable testing environment
3. REST bootstrap against a small account
4. user WebSocket stream with opens, closes, and partials
5. reconnect and reconciliation tests
6. market-data analytics tests

## Current open questions

These need confirmation during implementation:

1. whether every end user of a third-party OAuth app must separately enable paid API access, or whether the requirement primarily applies to app registration owners
2. the exact REST endpoint shapes and pagination filters for fills, fillPairs, orders, orderVersions, and cash balances in the current live docs
3. the exact market-data auth shape for OAuth-based apps
4. the exact persistence targets for standalone re-imports of Orders, Cash History, Account Balance History, and Client Statements after the initial bundle import

## Recommendation

Implement Tradovate in this order:

1. Tradovate OAuth connect + REST history sync
2. Tradovate user WebSocket sync loop
3. Tradovate market-data quote sync for advanced metrics

That sequence gives:

- a fast manual fallback
- a proper SaaS-native sync model
- a path to futures-grade live updates
- a later path to EA-like analytics parity without needing a terminal farm
