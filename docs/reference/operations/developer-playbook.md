# Developer Playbook

## Verification workflow

Use the repo root as the default entrypoint:

1. `bun check-types`
2. `bun lint`
3. `bun test`
4. `bun run build`

## What these commands mean in this branch

- `bun check-types`
  - runs Turbo `check-types`
  - expects `server` and `web` package scripts to exist
- `bun lint`
  - runs package `lint` scripts through Turbo
  - `server` lint currently aliases to typechecking
  - `web` lint uses Next ESLint config
- `bun test`
  - runs Bun-discovered `*.test.ts` and `*.spec.ts` files directly
- `bun run build`
  - builds `web` and `server` through Turbo
  - Next build skips typechecking and lint enforcement on this branch, so build
    is specifically a bundle and route-resolution smoke test

## Branch verification rule

When carving a feature branch out of a dirty snapshot, the branch is not ready
to push until the four commands above run successfully on that branch.

## Dirty snapshot workflow

When the worktree contains many mixed changes, do not split directly from the
dirty state. Use this order instead:

1. create one full snapshot branch and commit the entire current state there
2. create a small number of feature branches from `main`
3. restore feature-owned paths from the snapshot branch onto each feature branch
4. verify each feature branch independently
5. merge verified feature branches into one release branch
6. merge the release branch into `main` only after the full release branch passes

This keeps the full state recoverable while still producing clean reviewable
branches.

## Recommended branch layout

- `profitabledge/wip/<snapshot-name>`
  - one safety branch containing the whole mixed state
- `profitabledge/chore/<topic>`
  - repo tooling, CI, docs, env, contracts, platform wiring
- `profitabledge/features/<topic>`
  - feature-level branches
- `profitabledge/release/<topic>`
  - integration branch used to prepare the final merge to `main`

## Recommended feature branch order

Use dependency order instead of page-name order. In this repo the clean default
is:

1. `profitabledge/chore/repo-platform`
2. `profitabledge/features/dashboard-foundation`
3. `profitabledge/features/accounts-prop`
4. `profitabledge/features/analysis`
5. `profitabledge/features/backtest-replay`
6. `profitabledge/features/ai-assistant`
7. `profitabledge/features/copier-mt5`
8. `profitabledge/features/ops`
9. `profitabledge/features/community`

`dashboard-foundation` should land before `analysis` because shared shell and
sidebar ownership affect dashboard, trades, journal, and goals together.

## Path restore rule

When splitting from the snapshot branch, prefer:

```bash
git restore --source <snapshot-branch> -- <paths...>
```

This is safer than splitting directly from an uncommitted worktree because the
source paths are now anchored to a committed snapshot.

## Release branch rule

Do not deploy a feature branch directly unless it is intentionally the release
candidate. Merge the verified feature branches into one release branch first,
run the full repo verification there, then merge that release branch into
`main` for Vercel.
