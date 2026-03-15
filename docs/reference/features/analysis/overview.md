# Analysis Section Reference

This section maps to the core trading-analysis loop in the product.

## Routes

- `/dashboard`
- `/dashboard/trades`
- `/dashboard/journal`
- `/dashboard/psychology`
- `/dashboard/goals`

## Main frontend ownership

- dashboard widgets and home
  - `apps/web/src/features/dashboard/home`
  - `apps/web/src/features/dashboard/widgets`
  - `apps/web/src/components/dashboard`
- trades
  - `apps/web/src/features/trades`
  - `apps/web/src/components/trades`
- journal
  - `apps/web/src/components/journal`
- goals
  - `apps/web/src/components/goals`
- charts
  - `apps/web/src/features/dashboard/charts`
  - `apps/web/src/components/charts`
  - `apps/web/src/features/charts/trading-view`

## Main backend ownership

- dashboard metrics and related stats
  - `apps/server/src/routers/accounts.ts`
<<<<<<< Updated upstream
  - `apps/server/src/routers/accounts/aggregated-stats.ts`
  - `apps/server/src/routers/accounts/track-record.ts`
=======
>>>>>>> Stashed changes
  - `apps/server/src/routers/pnl-cards.ts`
  - `apps/server/src/routers/views.ts`
- trades
  - `apps/server/src/routers/trades.ts`
  - `apps/server/src/routers/trades/...`
  - `apps/server/src/lib/trades/...`
- journal
  - `apps/server/src/routers/journal.ts`
  - `apps/server/src/routers/journal/...`
- goals
  - `apps/server/src/routers/goals.ts`
- psychology / rules support
  - `apps/server/src/routers/ai/psychology-rules.ts`
  - `apps/server/src/routers/rules.ts`

## What this section is responsible for

### Dashboard

Purpose:

- top-level performance summary
- widgets and chart surfaces
- daily insight surfaces
- shell landing point for the rest of the product

Current behavior:

- select-based controls on analysis pages now inherit the shared journal/trades filter-menu surface from `apps/web/src/components/ui/select.tsx`, so dashboard widgets and supporting forms do not carry separate select skins
- account-balance remains visible for both live-synced and CSV/manual accounts
- the account-balance widget now follows the same live-metrics polling path as account equity, so closing or opening trades updates live-synced balances in place instead of waiting for a one-off stats refresh
- live-only dashboard widgets such as account equity and open trades are automatically hidden for non-live accounts, and the remaining widgets reflow instead of leaving empty tiles
- the account-equity widget no longer falls back to a fake zero when `liveEquity` is temporarily unavailable; it now derives equity from the best available account balance plus current floating P&L until a direct live-equity value is present
- the dashboard stats payload now coerces numeric aggregates before building balance/equity fallbacks, so baseline and P&L values cannot concatenate into inflated account-equity figures on demo, CSV, or stale-live accounts
- dashboard widget `RR` mode now uses a fixed baseline risk unit where `1R = 1% of the account baseline`, so balance, equity, floating P&L, expectancy, and loss widgets share the same conversion rule
- dashboard widgets now expose a header-level PNG export action that captures the widget at its current rendered size, including user-driven resize state, strips widget control chrome such as share buttons, live chips, baseline editors, and header toggles from the exported image, and flattens both the widget surface and padded canvas onto the app's `bg-sidebar` palette without export-only blur, glow, or transparent card backgrounds so single widgets can be posted cleanly to social or sent directly
- the main trading calendar and economic calendar now reuse the shared PNG export flow, so the active month, week, day, or list calendar layout can be downloaded straight from the calendar header without route-local screenshot code; the trading calendar export strips the `View account stats` CTA so the PNG stays focused on the calendar surface
- the dashboard calendar goal overlay now suppresses empty start markers on zero-trade days, so goal callouts only appear for real deadline dates or active trading days that meaningfully anchor the goal window
- the open-trades widget bottom-aligns partial pages so a small number of live positions sit in the lowest visible slots instead of stretching upward through the card
- the open-trades widget keeps a separator above the first visible trade on partial pages, while full four-trade pages still omit the top divider
- the dashboard header now splits selected-account state by source: connector-backed accounts keep `Sync account` and trigger `connections.syncNow`, CSV-imported accounts show a timestamp-only `Last updated` chip sourced from the latest CSV import notification, EA-synced accounts show `Last updated` from their latest sync heartbeat without a manual action, and manual/all-accounts scope show no account action
- the dashboard shell account badge now distinguishes imported fallback accounts from true manual accounts, and labels webhook/EA-fed live accounts as `EA-synced account` instead of the old generic live-sync fallback
- chart widgets own their own section toolbar; the picker stays available even for one-day histories, quick range actions and month navigation only appear when the selected account history actually offers alternate days or months, the chart section now has its own presets control, enabled chart cards are no longer capped to the old 12-widget ceiling, and saved chart layouts accept the full current chart catalog including `Hold Time vs P&L`
- the dashboard calendar no longer seeds chart widgets with its month-grid spillover window; shared chart ranges now use the clamped visible selection, so one-day accounts do not default to a synthetic month-plus range
- short dashboard chart ranges now switch equity curve and maximum drawdown to intraday bucket views so one-day and low-day windows render on hourly, 2-hour, 4-hour, or 12-hour spacing instead of sparse trade-timestamp jumps
- dashboard widget collections now enter customization mode on widget double-click across the main widget grid, calendar summary sidebar, and chart widgets, replacing the older hold-to-edit gesture
- scatter-based chart widgets now share a more consistent visual treatment; `Hold Time vs P&L` uses the same axis, grid, sampling, tooltip, and point styling pattern as the MAE/MFE scatter chart instead of its older split summary layout
- the correlation matrix keeps its centered max-content layout for sparse datasets, but now uses larger minimum cell dimensions so one-column or low-row matrices do not collapse into tiny unreadable tiles
- the Monte Carlo chart widget now samples realized closed trades only, rejects one-sided selected ranges as insufficient for a credible simulation, applies a conservative uncertainty floor, and presents a qualitative simulated outlook plus confidence level; the exact positive-outcome rate is only surfaced when the selected range is broad and balanced enough
- the `Edge coach` widget now normalizes displayed coaching titles to sentence case, and dashboard RR labels/messages now use `RR` instead of `R:R`, so rotating insights and supporting widgets read like the rest of the dashboard insight surfaces
- dashboard AI insight generation now refreshes stale trader profiles before evaluating history thresholds, manual insight requests can fall back to the latest closed trades when the last-30-day window is sparse, and both the insight drawer and periodic toast now use the same Trading Brain pattern engine instead of separate simplified copy paths; pattern messaging humanizes meaningful trade-table field combinations like protocol, model, session, RR, and hold-time into natural sentences instead of raw `tag + bucket` labels, recent-match counts also respect RR/hold/time buckets instead of overcounting partial matches, and the dashboard header now includes a manual `Test insight toast` trigger for quick UI verification without resetting the scheduled toast timer
- the reusable lightweight chart surface now keeps chart bootstrapping and series synchronization in `features/charts/trading-view/hooks/use-trading-view-chart-core.ts`, so `trading-view-chart.tsx` mainly owns pointer interactions and overlay composition instead of all chart lifecycle concerns

### Trades

Purpose:

- trade table and filters
- trade detail workflows
- notes, tags, bulk actions, metrics
- drawdown and performance analytics entrypoint

Current behavior:

- bulk-action tag editors and selection menus on `/dashboard/trades` reuse the same dropdown/submenu and separator patterns as the trades filter toolbar, so interactive inputs stay within a single overlay stack instead of opening competing popovers
- select-style menus on `/dashboard/trades` now share the same filter-menu treatment through the shared `Select` primitive, including views, sort/group controls, filter menus, column selectors, and bulk-action selectors
- the trades toolbar keeps `Group by` beside search and filters using the same active trigger treatment as the filter menu, and grouped views now render inline section headers inside the actual table body with collapsible chevron controls instead of a separate summary strip above the grid; grouped win-rate badges follow the same closed-trade denominator as the main trades summaries rather than counting live rows
- the trades column chooser now persists hidden columns across refresh when no saved view is active, while column order persists separately through shared table preferences and can be rearranged directly by dragging table headers
- inline session/model tag editors in the trades table now follow the same filter-menu surface treatment and reuse existing account tag values with their saved colors, so adding a tag from a cell does not fork duplicate names or palettes
- persisted trade cells in the trades table now edit inline from the cell itself, while the trade detail sheet opens from row double-click or the single-trade floating-bar `View trade details` button; data rows and column headers also keep a pointer affordance so the interactive grid reads as clickable at a glance, and shared table autosizing now measures the rendered intrinsic width of chips/buttons plus padding so columns like `Swap` and `Protocol` expand when larger cell content appears instead of clipping pill styling, per-trade replay/share/export actions live in the floating actions menu when exactly one trade is selected instead of a dedicated row menu column, and live trades stay read-only with an explicit toast if the user tries to edit them
- the trade-table streak badge is derived from chronological trade order, so it remains directionally correct even when the table is sorted with the latest trades first
- the `/dashboard/trades` route now treats URL filter parsing, saved-view merging, numeric/date filter normalization, reference query loading, and preview-filter analytics as feature-owned logic under `apps/web/src/features/trades/table`, especially `hooks/use-trade-table-filter-controls.ts`, `hooks/use-trade-table-reference-data.ts`, `hooks/use-trade-table-filtered-data.ts`, `trade-table-filter-state.ts`, `trade-table-query-state.ts`, `trade-table-column-state.ts`, and `trade-table-view-state.ts`, so new trade filters should extend those shared modules instead of growing route-local parsing code
<<<<<<< Updated upstream
- dashboard-wide portfolio stats and verified-account share cards now depend on the account helper modules under `apps/server/src/routers/accounts`, so cross-account widgets should extend those helpers instead of reintroducing aggregate/track-record logic directly into `accounts.ts`
=======
>>>>>>> Stashed changes

### Journal

Purpose:

- trading journal and reflection workflows
- entry/media/editor experiences
- review templates and AI-linked journaling support

Current behavior:

- existing journal entries now wait for the fetched entry state to hydrate before the content editor mounts, so opening an entry lands on the real saved content immediately instead of requiring a tab switch to remount the editor
- journal entry autosave now debounces the full draft and prevents overlapping saves, while slash-inserted blocks sync their latest editor snapshot back into entry state immediately, so chart, trade, psychology, and AI-capture inserts both register unsaved changes correctly and persist through autosave/manual save without dropping visible editor content
- journal entry tags now use compact ringed pills with click-to-remove behavior, so long tags stay bounded, show a pointer affordance, and removal does not require a separate close icon
- trade-detail emotion tagging now treats each stage as a single updatable selection per trade, so changing `Before entry`, `During trade`, or `After exit` replaces the current choice instead of appending stale duplicates that block the latest selection from showing
- chart widgets embedded through the journal slash menu now render in a lighter embedded mode, which boots them into a one-week range, disables comparison mode, bounds trade-history fetches, avoids embedded Recharts mutation loops, and down-samples or de-animates the heaviest chart views so inserting chart blocks does not freeze the editor
- the journal `Insights` tab now follows the prop-tracker page language with section headers and nested shell surfaces for workflow, journal intelligence, and psychology/performance, instead of mixing unrelated widget frames
- the journal editor slash menu includes `AI Capture`, which accepts free-form narrative phrasing, rewrites weak opening clauses into cleaner sentence-case editorial titles, infers richer tags and psychology signals from ordinary trading language, preserves raw feeling notes when present, and maps strong journal cues into existing slash-command block types such as psychology widgets, account-context charts, and trade or trade-comparison review blocks before inserting the structured result directly into the current entry
- the journal AI capture pipeline now keeps its title/tag/date/psychology heuristics in `apps/server/src/lib/journal-ai-capture-inference.ts`, leaving `journal-ai-capture.ts` focused on provider calls, trade matching, and final block assembly
- AI Capture now syncs its resolved post-insert block set straight back into journal entry state, and manual entry saves now read from the live editor snapshot, so structured blocks inserted by the dialog persist even if page-level draft state has not finished settling yet
- AI Capture no longer echoes the raw capture note into the entry body; it inserts structured blocks, taller account-context charts, recent matched trades, and sentence-case block headings/titles while leaving the original capture text out of the saved journal content
- journal entry save/load paths preserve structured block props for callouts, charts, trade embeds, trade comparisons, and psychology widgets, so those blocks survive normal create/update/reload cycles instead of degrading into partial content; trade-comparison blocks also normalize and retain comparison metrics such as direction, P&L, pips, close time, and outcome labels
- the journal psychology/performance panel now sorts correlations by signal strength and uses the same darker nested shell treatment as the rest of Insights, with a dedicated recommendations strip, key-findings stack, and correlation map instead of the older flat widget styling
- the journal calendar now caps the main calendar surface height and lets that pane scroll internally, so the month grid stays contained without stretching the whole tab vertically
- dashboard chart blocks embedded inside the journal editor keep their normal hover behavior, but the Recharts keyboard-focus surface is disabled within the editor node view so chart blocks do not crash when focused inside TipTap

### Psychology

Purpose:

- behavior and correlation analysis
- psychology-focused views and insights

Current behavior:

- the tilt meter blends behavior-pattern signals with realized capital damage
- outsized one-trade losses, 24-hour net loss percentage, and realized intraday drawdown now materially increase tilt severity instead of relying only on revenge/FOMO/overtrading counts

### Goals

Purpose:

- numeric and behavioral target tracking
- goal progress surfaces
- accountability loop for trader improvement

Current behavior:

- the goals overview, streak cards, scorecard cards, and active-goal lists now reuse the dashboard widget shell with the same rounded outer frame, inset inner ring, and tighter header/separator rhythm instead of the older flatter goal-specific surfaces
- static goals-page headings now render in sentence case, and visible goal/suggested-goal titles are normalized away from title case to match the prop-tracker card treatment
- the top streak row now uses distinct semantic accents: `Green days` stays green throughout, while `Win streak` escalates from gray to amber to green as it closes in on the current record

## Development rules for this area

- use existing widget shell and chart patterns instead of introducing a new card system
- keep heavy calculations on the server, not in the page component
- reuse trade table feature modules rather than duplicating filtering/sorting logic elsewhere
- keep `/dashboard/trades` overlay surfaces consistent: toolbar menus, bulk-action bars, popovers, dialogs, and sheets should reuse shared trades surface styles instead of one-off component classes
- if a new analytics idea needs persistence, update the trading/journal/goal schema first, not only the UI

## First files to inspect for changes

- `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/trades/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/journal/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/psychology/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/goals/page.tsx`
- `apps/server/src/routers/trades.ts`
- `apps/server/src/routers/journal.ts`
- `apps/server/src/routers/goals.ts`
