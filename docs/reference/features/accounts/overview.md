# Accounts Section Reference

This section covers broker accounts, prop accounts, prop progression, and the related tracker surfaces.

## Routes

- `/dashboard/accounts`
- `/dashboard/prop-tracker`
- `/dashboard/prop-tracker/[accountId]`

## Main frontend ownership

- account routes and prop tracker pages
  - `apps/web/src/app/(dashboard)/dashboard/accounts/page.tsx`
  - `apps/web/src/app/(dashboard)/dashboard/prop-tracker/page.tsx`
  - `apps/web/src/app/(dashboard)/dashboard/prop-tracker/[accountId]/page.tsx`
- shared account and prop-tracker UI
  - `apps/web/src/features/accounts/components/...`
  - `apps/web/src/features/accounts/prop-tracker/components/...`
  - `apps/web/src/components/prop-account-status-badges.tsx`
  - `apps/web/src/components/prop-phase-timeline.tsx`

## Current behavior

- the accounts route should stay a composition layer; section chrome, account cards, and prop-assignment flows belong under `apps/web/src/features/accounts/components`
- broker and prop account cards now consolidate secondary actions such as track record, account tags, public proof, archive, and delete into a shared `Actions` menu instead of scattering icon buttons across each card header
- the `/dashboard/prop-tracker` route shows an overview summary area above `Prop accounts`, followed by the prop-account card grid
- the `/dashboard/prop-tracker` overview stat cards and the two command panels above `Prop accounts` now reuse the dashboard widget shell with the same rounded outer frame, inset inner ring, and tighter header/separator rhythm as the main dashboard surfaces
- the `/dashboard/prop-tracker/[accountId]` route should stay a composition layer; assembled panels and shared display primitives belong under `apps/web/src/features/accounts/prop-tracker/...`
- prop-account classification is separate from live-sync capability, so a prop account can still be manual or CSV-backed without live widgets or live-connection badges

## Development rules for this area

- reuse shared dashboard/widget surface patterns instead of introducing another card system
- keep route files focused on composition and data wiring
- prefer shared prop badge, timeline, and status helpers across `/accounts` and `/prop-tracker`

## First files to inspect for changes

- `apps/web/src/app/(dashboard)/dashboard/accounts/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/prop-tracker/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/prop-tracker/[accountId]/page.tsx`
- `apps/web/src/features/accounts/components/...`
- `apps/web/src/features/accounts/prop-tracker/components/...`
