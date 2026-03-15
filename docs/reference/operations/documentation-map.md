# Documentation Map

This repo now uses `docs/` as the canonical parent folder for project documentation.

## Canonical rule

If you are writing or updating a guide, put the real content under `docs/reference/...`.

Old locations may keep a short pointer file only when:

- a conventional entrypoint should still exist there, such as `README.md`
- a tool expects a file at a fixed path, such as `CLAUDE.md`

## Reference categories

- `docs/reference/architecture`
  - system shape and data flow
- `docs/reference/frontend`
  - web app structure and UI ownership
- `docs/reference/backend`
  - server architecture, routers, domain layers
- `docs/reference/database`
  - schema and migration references
- `docs/reference/features`
  - user-facing product sections grouped by the current nav/product model
- `docs/reference/services`
  - MT5 worker and EA integrations
- `docs/reference/operations`
  - development workflow and repo operation guides
- `docs/reference/roadmap`
  - planning docs and audits

## How to keep docs current

When shipping a meaningful feature:

1. update the code
2. update the closest current-state doc in `docs/reference/...`
3. only then update or ignore the old roadmap doc if it still matters

For the detailed repo operating procedure, follow:

- `AGENTS.md`

This file explains where docs live.
`AGENTS.md` explains how documentation work is required during implementation.

## What counts as a meaningful feature for docs

- new section/page or route
- new database entity or lineage model
- new sync/integration path
- new provider
- new cross-cutting product behavior like notifications, rule engines, or account progression

## Fastest way to stay oriented

Use this order:

1. `docs/README.md`
2. the section doc under `docs/reference/features/...`
3. the platform doc under `docs/reference/frontend`, `backend`, `database`, or `services`
4. the code itself

That path gets you current context faster than reading the older PRDs first.
