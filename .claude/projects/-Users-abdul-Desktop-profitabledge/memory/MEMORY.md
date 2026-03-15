# Project Memory

## Architecture
- Monorepo: apps/web (Next.js frontend, port 3001) + apps/server (Next.js API backend, port 3000)
- tRPC for API, Drizzle ORM + PostgreSQL, Better Auth, TailwindCSS v4, shadcn/ui
- MT5 EA data bridge sends webhook data to server

## Dashboard Styling Reference Pattern
- Main wrapper: `<main className="p-6 space-y-4 py-4">`
- Settings pages use: `<div className="max-w-4xl pt-4">`
- Dark mode: `dark:text-neutral-200` for secondary, `dark:text-white` for primary
- Cards use `bg-sidebar border-white/5` pattern in dark mode

## Key Issues Found (March 2026 Audit)
- See `audit-2026-03.md` for full details
- Critical: plain-text passwords in shared trades (pnl-cards.ts:270, social.ts:214)
- Dead code: social.ts router (replaced by social-redesign.ts)
- Trades page has nested SidebarProvider (conflicts with layout)
- TooltipProvider nested inside each Tooltip component (perf issue)
- Webhook manager uses in-memory storage (lost on restart)
- Reports sidebar link points to "#" instead of "/dashboard/reports"
- Tags settings page has no backend mutations (UI-only)
- DrawdownCell fires per-row queries (N+1 problem)
