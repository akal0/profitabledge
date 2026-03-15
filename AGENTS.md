# AGENTS.md

## Mission

Work from the docs tree first, then the code, then update the docs before finishing.

Documentation is not optional in this repository. It is part of the feature implementation workflow.

## Canonical documentation tree

Always start from:

- `docs/README.md`

Current-state reference docs live under:

- `docs/reference/architecture`
- `docs/reference/frontend`
- `docs/reference/backend`
- `docs/reference/database`
- `docs/reference/features`
- `docs/reference/services`
- `docs/reference/operations`

Roadmaps and historical planning docs live under:

- `docs/reference/roadmap`

Use roadmap docs for intent or product direction. Do not use them as the primary implementation source of truth.

## Source-of-truth order

If sources conflict, trust them in this order:

1. code
2. `docs/reference/...`
3. roadmap or planning docs

If code and docs disagree, update the docs to match reality before closing the task.

## Default operating procedure

Follow this workflow on every implementation task.

### Step 1: Classify the task

Before touching code, identify which kind of change it is:

- frontend route or UI change
- backend API or domain logic change
- database/schema change
- feature-level behavior change
- service/integration change
- cross-cutting change like navigation, notifications, auth, or account state
- documentation-only change

### Step 2: Read the minimum required docs first

Read only the smallest relevant set needed to stay efficient, but do not skip the docs entirely.

Use this lookup matrix.

#### Frontend page, component, or UX change

Read:

1. `docs/README.md`
2. relevant feature doc under `docs/reference/features/...`
3. `docs/reference/frontend/overview.md`

Also read `docs/reference/architecture/overview.md` if the change affects app structure, shared layout, or data flow.

#### Backend router, rule engine, or business logic change

Read:

1. `docs/README.md`
2. relevant feature doc under `docs/reference/features/...`
3. `docs/reference/backend/overview.md`

Also read `docs/reference/database/overview.md` if the change touches persistence.

#### Database or migration change

Read:

1. `docs/README.md`
2. relevant feature doc under `docs/reference/features/...` or service doc
3. `docs/reference/database/overview.md`
4. `docs/reference/backend/overview.md`

#### Service or integration change

Read:

1. `docs/README.md`
2. relevant service doc under `docs/reference/services/...`
3. `docs/reference/backend/overview.md`
4. `docs/reference/architecture/overview.md`

#### Cross-cutting shell, navigation, auth, notifications, or account-state change

Read:

1. `docs/README.md`
2. relevant feature doc or docs if multiple sections are affected
3. `docs/reference/frontend/overview.md`
4. `docs/reference/backend/overview.md`
5. `docs/reference/architecture/overview.md`

#### Ambiguous or large task

Read:

1. `docs/README.md`
2. the closest feature doc
3. the closest platform docs
4. roadmap docs only if product intent is unclear

### Step 3: Verify against the code

Docs are required, but code is authoritative.

After reading the relevant docs:

1. inspect the actual entrypoints in code
2. confirm the current implementation pattern
3. note any mismatches between docs and code

Never rely on docs alone for behavior that can be verified in code.

### Step 4: Implement using existing patterns

When making changes:

- prefer nearby existing patterns over inventing new ones
- keep ownership aligned with the documented structure
- if a change affects multiple surfaces, prefer extracting a shared component or helper
- if a feature changes product behavior, update both implementation and documentation in the same task

### Step 5: Update docs before closing

If your change affects behavior, structure, ownership, or workflow, update the closest docs in `docs/reference/...`.

This includes:

- new features
- feature updates
- feature removals
- refactors that change responsibility or flow
- schema and migration changes
- API or router changes
- rule-engine changes
- provider/integration changes
- navigation, notification, or account-state changes

### Step 6: Verify both code and docs

Before finishing:

1. verify the code change as appropriate
2. verify the doc change is accurate, concise, and in the right canonical location
3. fix any stale pointer docs if the canonical location changed

## Definition of done

A task is not done until all of the following are true:

1. relevant docs were consulted before implementation
2. code changes are complete
3. relevant `docs/reference/...` files were updated or explicitly confirmed still accurate
4. stale docs introduced by the change were corrected or removed
5. final response includes which docs were consulted and which docs were updated

## Documentation update rules

### Update existing docs by default

Prefer updating the closest existing current-state doc instead of creating a new doc.

Add a new doc only when:

- a new product area is introduced
- a new service/integration is introduced
- a current doc becomes too broad to stay useful
- a new architecture concept needs its own stable reference

### Canonical location rules

- canonical long-form docs belong under `docs/reference/...`
- root-level and feature-folder markdown files should usually be pointer docs only
- `README.md` and `CLAUDE.md` may remain as entrypoints, but should point into the canonical docs tree where appropriate

### Pointer doc rules

Use a lightweight pointer doc when:

- an old path is still useful as an entrypoint
- a tool expects a file at a fixed path
- moving the canonical content would otherwise make the repo harder to navigate

Do not duplicate the full guide in multiple places unless there is a strong reason.

## Efficiency rules

Be detailed in process, but efficient in execution.

### Required efficiency behavior

- read the minimum relevant docs first, not the entire docs tree
- prefer current-state docs over roadmap docs
- prefer updating one canonical doc over duplicating the same information in multiple files
- if a change is localized, update only the affected docs, not unrelated areas
- if docs are stale, fix the relevant stale section instead of rewriting the whole tree unless necessary

### When docs are missing or too thin

If the needed doc does not exist or is insufficient:

1. inspect the code directly
2. complete the change
3. create or expand the missing current-state doc so the gap does not remain

## Task-to-doc mapping cheatsheet

Use this as the default map.

- dashboard, trades, journal, psychology, goals
  - `docs/reference/features/analysis/overview.md`
- accounts, prop tracker, prop flows, prop rules
  - `docs/reference/features/accounts/overview.md`
- feed, leaderboard, achievements, news
  - `docs/reference/features/community/overview.md`
- assistant, backtest, copier, settings, connections
  - `docs/reference/features/tools/overview.md`
- web app structure or route ownership
  - `docs/reference/frontend/overview.md`
- routers, auth, providers, server APIs
  - `docs/reference/backend/overview.md`
- schema, migrations, persistence model
  - `docs/reference/database/overview.md`
- system shape and data flow
  - `docs/reference/architecture/overview.md`
- MT5 worker or EA behavior
  - `docs/reference/services/...`
- branching, workflow, and documentation policy
  - `docs/reference/operations/...`

## Feature removal workflow

If removing or deprecating a feature:

1. update the implementation
2. remove or revise references in current-state docs
3. fix index docs or pointers if they still mention the old feature as active
4. note the removal clearly in the final response

Do not leave the docs describing removed behavior as if it still exists.

## Final response requirements

When the task involves implementation or behavior change, always state:

- which docs were consulted
- which docs were updated

If no doc updates were needed, say that explicitly and why.
