# Verified Implementation Status vs FULL_APP_IMPROVEMENT_PRD

> **Audit Date**: March 7, 2026
> **Method**: Verified against the current codebase, not inferred from filenames or old notes

---

## Executive Read

The previous status pass was materially inaccurate in both directions:

- It marked several real features as missing even though they already exist in code.
- It marked several roadmap items as implemented when they were only labels, placeholders, or partial shells.

Use this file as the corrected short-form status summary.

---

## Implemented Or Meaningfully Present

### Dashboard / Charts

- On-dashboard `What If`, `Edge Coach`, and `Platform Benchmark` widgets exist.
- Monte Carlo chart exists.
- Rolling performance chart exists.
- Risk-adjusted chart exists.
- Radar comparison chart exists.
- Bell curve chart exists.
- Correlation matrix chart exists.
- Daily briefing, session coaching, risk intelligence, and rule compliance widgets exist.

### Trades / Journal / Psychology

- Trade grouping exists.
- Advanced trade filters exist, including MFE/MAE range filters.
- Psychology analytics page exists with correlation matrix, scatter plot, and optimal-condition recommendations.
- Weekly and monthly review generation exists.
- Trade replay UI exists.

### AI / Rules / Onboarding / Social

- Server-side pre-trade evaluation endpoint exists and returns `allow / warn / block`.
- Guided onboarding wizard exists as a 4-step flow.
- Challenge simulator exists.
- Leaderboard and achievements exist.
- Session configuration and timezone settings exist.

---

## Partial Implementations

### Needs Completion, Not Reinvention

- `Trade Replay / Mini-Chart`: replay exists, but uses generated candles instead of verified historical replay and is not yet deeply embedded into the main trade workflow.
- `Auto-Generated Trade Journal`: prompt generation and review templates exist, but trade-close does not auto-create a prefilled journal entry.
- `Proactive Edge Coaching`: engines and widgets exist, but timed delivery and event-based surfacing are still incomplete.
- `Process Goals`: custom/flexible goals exist, but first-class process-goal tracking is still incomplete.
- `Prop Challenge Dashboard`: prop tracking exists, but not the full real-time command-center UI from the PRD.
- `What If` analysis: useful widget exists, but it is still heuristic and not the full scenario engine described in the PRD.
- `Anonymous Benchmarking`: now server-backed for the dashboard widget, but still lacks segmentation and a dedicated benchmark experience.
- `Guided Onboarding`: wizard exists, but resume state, sample-data path, and stronger first-insight handoff are still missing.
- `Real-Time Rule Enforcement`: backend evaluation exists, but EA-side invocation and in-terminal blocking UX are still missing.
- `All Accounts` aggregation: backend aggregated stats exist, but the main dashboard and selector flow are still single-account.
- `Trade Cost Analysis`: commissions and swaps are surfaced, but not yet synthesized into the stronger net-cost view described in the PRD.
- `Config Import/Export`: widget export/import exists, but not full app-level configuration backup/restore.

---

## Confirmed Missing High-Value Items

### Remaining P0-Class Gaps

1. `Edge Summary` hero widget
2. `All Accounts` aggregated view UI and selector flow
3. Auto-created trade journal entries on trade close
4. Proactive coaching delivery orchestration
5. Full prop challenge command-center dashboard
6. First-class process goals

### Remaining P1/P2 Gaps Worth Shipping Soon

- Time-contextual dashboard orchestration
- Calendar goal overlay / session-aware calendar
- Inline expandable trade detail in the main table
- Rule impact dashboard
- Multi-channel alerts
- Copy performance attribution
- Backtest vs live gap attribution
- Account health score
- Journal search / cross-reference
- Sample data mode
- Generic webhook format
- WebSocket real-time updates

---

## False Positives From The Old Audit

These were previously treated as implemented, but are not truly shipped in the app surface:

- `Edge Summary Widget`: not present as an active dashboard widget
- `Comparative Period Widget`: not present as an active dashboard widget
- `Prop Challenge Widget`: not present as an active dashboard widget

Why the confusion happened:

- Those names appear in `apps/web/src/components/dashboard/widget-export.ts`, but that file only defines export/import labels and metadata.

---

## False Negatives From The Old Audit

These were previously treated as missing, but they do exist:

- Guided onboarding wizard
- Server-side pre-trade evaluation endpoint
- Monte Carlo chart
- Rolling performance chart
- Risk-adjusted chart
- Psychology analytics page
- Correlation matrix chart
- Bell curve chart

---

## Recommended Build Order

1. Ship `All Accounts` aggregation UI on top of the backend stats that already exist.
2. Ship the real `Edge Summary` hero widget.
3. Auto-create journal entries on trade close.
4. Add event-timed coaching delivery.
5. Upgrade the prop tracker into a true risk/progress command center.
6. Promote process goals into first-class tracked entities.

That order improves the product more than adding yet another chart, because it closes the actual trader loop: identify edge, trade edge, review edge, repeat.
