# Profitabledge — Full App Improvement PRD

> **Purpose**: Comprehensive improvement roadmap across every section of the app to help traders discover, refine, and exploit their profitable edge.
> **Date**: March 7, 2026
> **Scope**: Full-stack — Dashboard, Trades, Journal, AI, Goals, Backtest, Prop Tracker, Social, Copier, Settings, EA Integration, Onboarding

## Implementation Reality Check

This PRD is still directionally useful, but parts of it no longer match the codebase. Before planning against the roadmap below, use these corrections as the current source of truth.

### Verified In Code

- The onboarding flow is already a 4-step wizard (`profile` → `plan` → `account` → `rules`), so `18.1 Guided Onboarding` is no longer a true greenfield item.
- The server already has a pre-trade evaluation endpoint (`webhook.evaluatePreTrade`) that returns `allow / warn / block`. The remaining gap is EA-side invocation and operator UX, not backend invention.
- Several chart differentiators are already present in the UI: Monte Carlo, rolling performance, risk-adjusted, radar comparison, bell curve, and correlation matrix.
- Psychology analytics is materially implemented: dedicated page, correlation matrix, scatter plot, and optimal-conditions analysis.
- Trade grouping and a meaningful slice of advanced filtering are already implemented in the trades UI.
- Challenge simulator, achievements, leaderboard, weekly/monthly review templates, session configuration, and timezone settings are all present.

### Previously Misclassified Or Overstated

- `edge-summary`, `period-comparison`, and `prop-challenge` were previously treated as shipped because they appear in `widget-export.ts`. In reality they are labels for export/import metadata, not active dashboard widget implementations.
- The previous benchmark widget was not a true platform benchmark; it used hardcoded percentile bands. This pass replaces it with a server-backed anonymous benchmark sourced from verified public accounts. It is now real, but still basic.
- Trade replay exists, but it currently replays generated candles derived from trade stats rather than verified historical candles. Treat this as partial, not done.
- The current `What If` widget is useful, but it is still heuristic and widget-level. It is not yet the full scenario engine described in the roadmap.

### Actual Remaining P0 Work

- `1.1 Edge Summary Hero Widget`: still missing as a first-class dashboard hero.
- `5.1 Auto-Generated Trade Journal Entries`: prompts and review generation exist, but closed trades do not auto-create prefilled journal entries.
- `6.1 Proactive Edge Coaching`: insight generation exists, but delivery is still mostly pull-based or widget-based rather than event-timed.
- `11.1 Real-Time Prop Challenge Dashboard`: pieces exist, but the high-signal gauge/projection dashboard is still incomplete.
- `15.1 Multi-Account Aggregated View`: backend aggregation exists, but the dashboard/account-selector UI is still missing, so this remains a high-value product gap.
- `7.1 Process Goals`: only partially expressible today; first-class tracking is still missing.

### Priority Adjustment

If the goal is shipping the best next version of Profitabledge rather than mechanically completing the original list, the order should be:

1. Multi-account aggregation
2. Edge summary hero
3. Auto-created trade journals
4. Proactive coaching delivery
5. Prop challenge command center
6. First-class process goals

Reason: these six items close the loop between "find the edge", "trade the edge", and "review the edge" more directly than further expanding already-good chart coverage.

---

## Table of Contents

1. [Dashboard & Widgets](#1-dashboard--widgets)
2. [Trade Table & Data Management](#2-trade-table--data-management)
3. [Calendar Section](#3-calendar-section)
4. [Chart Widgets & Visualization](#4-chart-widgets--visualization)
5. [Journal System](#5-journal-system)
6. [AI Engine & Assistant](#6-ai-engine--assistant)
7. [Goals & Accountability](#7-goals--accountability)
8. [Rules & Compliance](#8-rules--compliance)
9. [Alerts & Notifications](#9-alerts--notifications)
10. [Backtest Module](#10-backtest-module)
11. [Prop Firm Tracker](#11-prop-firm-tracker)
12. [Social & Feed](#12-social--feed)
13. [Leaderboard](#13-leaderboard)
14. [Trade Copier](#14-trade-copier)
15. [Accounts Management](#15-accounts-management)
16. [Settings & Configuration](#16-settings--configuration)
17. [EA / Webhook Integration](#17-ea--webhook-integration)
18. [Onboarding & Landing Page](#18-onboarding--landing-page)
19. [Cross-Cutting Concerns](#19-cross-cutting-concerns)
20. [Priority Matrix](#20-priority-matrix)

---

## 1. Dashboard & Widgets

### Current State

- 27 active dashboard widget types currently exposed in `widgets.tsx` (including `what-if`, `edge-coach`, and `benchmark`; excluding the still-unshipped `edge-summary`, `period-comparison`, and `prop-challenge`)
- Drag-and-drop reorder with dnd-kit, resizable spans (1-5 columns), max 15 widgets
- Widget preferences saved per user, USD/percent toggle
- Edit mode with tilt animation, widget presets
- Polls live metrics every 5 seconds for EA-connected accounts
- Insight panel (AI-generated insights sidebar)

### Improvements

#### 1.1 — "Edge Summary" Hero Widget [P0]

**Problem**: The dashboard shows metrics but doesn't synthesize them into a clear answer: "What is YOUR edge?"

**Solution**: A prominent top-of-dashboard widget that shows:

- Your top 3 edge conditions (e.g., "London session + EURUSD + shorts = 78% win rate, 2.4 avg RR")
- Your top 3 leak conditions (e.g., "Revenge trading after a loss = -$2,340 total impact")
- Today's trading conditions vs. your historical edge profile (green/amber/red traffic light)
- "Edge score" trending over last 30 days — are you trading your edge more or less?
- One-click to filter trade table to just edge/leak trades

**Why it matters**: This IS the core promise of "find YOUR profitable edge". Every other metric is a building block toward this answer. The edge/leak data already exists in the AI engine (`analyzeEdgeConditions`, `analyzeLeakConditions`) — it just needs a prominent, always-visible home.

#### 1.2 — Time-Contextual Dashboard [P1]

**Problem**: Dashboard is static — same view at 6am, during a session, or at end of day.

**Solution**:

- **Pre-session** (before first trade window): Show daily briefing, today's edge conditions, overnight news impact, psychological readiness check
- **During session** (open trades active): Promote open-trades widget, real-time P&L, current session stats, tiltmeter, rule compliance
- **Post-session** (after last trade window): Show session recap, today vs. target, journal prompt, improvement suggestions
- Auto-detect based on user's configured trading sessions or EA activity
- Manual override: "Show me pre-session view" button

#### 1.3 — Comparative Period Analysis Widget [P1]

**Problem**: No easy way to compare "this week vs last week" at a glance.

**Solution**: A comparison widget showing key metrics side-by-side with delta arrows:

- Win rate: 68% → 72% (+4%)
- Avg RR: 1.8 → 2.1 (+0.3)
- Profit factor: 1.4 → 1.9 (+0.5)
- Configurable comparison periods (week, month, quarter, custom)
- Green/red coloring on improvements/regressions

#### 1.4 — "What If" Scenario Widget [P2]

**Problem**: Traders can't easily see the impact of improving specific behaviors.

**Solution**: Interactive widget showing:

- "If you had held to TP on your last 10 partial winners, your account would be +$X"
- "If you had skipped your 5 lowest-RR trades this month, your win rate would be X%"
- "If you sized up 50% on your edge conditions only, your P&L would be +X%"
- Dynamically calculated from actual trade data — uses existing `postExitPeakPrice` and MFE/MAE data

#### 1.5 — Widget Quick Actions [P2]

**Problem**: Widgets are display-only.

**Solution**: Add contextual quick actions to each widget:

- Win rate widget → Click to filter trades table to wins/losses
- Open trades widget → Click trade to see details, quick-add notes
- Tiltmeter widget → Quick-log current emotional state
- Any metric → "Explain this" → AI assistant opens with context
- Any metric → "Drill down" → Opens relevant chart

#### 1.6 — Mobile-Responsive Dashboard [P2]

**Problem**: 5-column grid doesn't work well on mobile.

**Solution**: Auto-collapse to 1-2 column layout on mobile, swipeable widget cards, condensed metric display with expandable details.

---

## 2. Trade Table & Data Management

### Current State

- Infinite scroll with cursor-based pagination (50 per page)
- Extensive columns: symbol, direction, volume, profit, open/close price, SL/TP, duration, pips, commissions, swap, outcome, planned RR, realised RR, manipulation pips, MFE/MAE, execution metrics (spread, slippage, deal counts, scale in/out), session/model/protocol tags
- Filters: date range, trade direction, symbols, sessions, models, outcomes
- View management (saved filter/column configurations — "views" system)
- Bulk actions toolbar, drag-select, keyboard shortcuts
- Trade notes editor, emotion tagger
- Sample gate banner (minimum trades for statistical significance)
- PnL card and trade actions menu

### Improvements

#### 2.1 — Trade Replay / Mini-Chart Visualization [P0]

**Problem**: Traders see numbers but can't visually replay what happened in a trade.

**Solution**: Click any trade → opens a mini chart panel showing:

- Price action from manipulation leg through entry to exit (using data already fetched via Dukascopy for advanced metrics)
- Entry/exit markers with SL/TP lines
- MFE/MAE points highlighted on the chart
- Post-exit price movement (what you left on the table) — data already exists in `postExitPeakPrice`
- Overlaid with annotations or notes
- Time-scaled playback option (step through candles)

**Technical note**: The `historicalPrices` table already stores candle data. Dukascopy integration (`getHistoricalRates`) is already working. This is primarily a frontend visualization task.

#### 2.2 — Smart Grouping & Aggregation [P1]

**Problem**: Can only view trades as individual rows.

**Solution**:

- Group by: symbol, session, model, day, week, outcome, or any tag
- Collapsed group headers show aggregate stats (win rate, avg RR, total P&L, count)
- Expand to see individual trades within group
- Group comparison mode: two groups side by side
- "Group by edge condition" — shows trades that matched each identified edge

#### 2.3 — Trade Correlation Matrix [P2]

**Problem**: No way to see which combinations of factors produce the best results.

**Solution**: A matrix/heatmap view showing:

- Rows: sessions | Columns: symbols → Cell: win rate / avg RR / profit
- Highlight cells above/below average
- Click any cell to filter trades table to that combination
- Configurable axes (session × symbol, model × direction, day × session, etc.)
- Essentially the edge condition finder in visual form

#### 2.4 — Streak Context Column [P2]

**Problem**: Win/loss streaks are shown as a widget but not inline with trades.

**Solution**: "Streak #" column showing:

- Current streak number at time of that trade (e.g., "W3" = 3rd win in a row, "L2" = 2nd loss)
- Color-coded (green for win streaks, red for loss streaks)
- Helps identify revenge trading patterns or overconfidence
- Easy to filter: "Show me all trades that were the 4th+ in a losing streak"

#### 2.5 — Trade Cost Analysis Column [P1]

**Problem**: Commissions, swap, slippage are stored but not prominently surfaced.

**Solution**:

- "Net P&L" column: profit minus commissions, swap, slippage
- "Cost Impact" column: total costs as % of gross P&L
- Aggregate cost stats in table header/footer
- Alert badge when costs eat >X% of profits
- Data already exists: `commissions`, `swap`, `entrySpreadPips`, `exitSpreadPips`, `entrySlippagePips`, `exitSlippagePips`

#### 2.6 — Inline Expandable Trade Detail [P1]

**Problem**: Trade detail requires opening a separate sheet/panel.

**Solution**: Click any trade row to expand inline with:

- Quick note text field (already have `TradeNotesEditor`)
- Mini chart of the trade (from 2.1)
- Emotion tagger (already have `EmotionTagger`)
- Rating (1-5 stars for trade quality)
- AI auto-note (generated analysis)
- Tags editor (session, model, protocol — already have tag cells)
- Key metrics at a glance (planned RR vs realized, MFE/MAE, cost breakdown)

#### 2.7 — Advanced Statistical Filters [P2]

**Problem**: Can only filter by basic criteria.

**Solution**: Add statistical filters:

- "Trades with RR > 2.0"
- "Trades where MAE > 50% of SL" (trades that almost stopped out)
- "Trades held longer than average"
- "Trades following a loss" (revenge trading detector)
- "Trades during high-volatility sessions"
- Composite filters (AND/OR logic with visual builder)
- Save as a view for repeated use

#### 2.8 — Enhanced Export [P2]

**Problem**: Export exists but is basic.

**Solution**:

- Export current filtered/grouped view (not just all trades)
- PDF trade journal report with embedded mini-charts
- Tax-optimized export (separate commissions, swaps, net P&L by tax year)
- TradingView-compatible format
- CSV with configurable column selection

---

## 3. Calendar Section

### Current State

- P&L calendar showing daily results with configurable summary widgets
- Up to 6 calendar summary widgets with spans 1-2
- Date range picker and navigation
- Monthly view with daily cells

### Improvements

#### 3.1 — Session-Aware Calendar [P2]

**Problem**: Calendar shows days but traders think in sessions.

**Solution**: Option to view by trading session (London, NY, Asian). Day cells show sub-rows for each session traded, with independent P&L per session.

#### 3.2 — Goal Overlay on Calendar [P1]

**Problem**: Goals exist separately from the calendar.

**Solution**: Overlay goal progress on calendar:

- Daily target line showing if you hit your daily P&L goal
- Color-code days: green (goal met), yellow (partial), red (loss day), gray (no trades)
- Weekly progress bar at week boundaries
- Monthly target progress at top of calendar

#### 3.3 — Heatmap Mode [P1]

**Problem**: P&L values in cells don't give instant visual feedback at scale.

**Solution**: Toggle heatmap mode where cell background color intensity reflects P&L magnitude. Deep green = great day, deep red = bad day, neutral = small P&L. Like GitHub contribution graph but for trading.

#### 3.4 — "Best Conditions" Indicator [P2]

**Problem**: Calendar doesn't show WHEN the trader's edge was active.

**Solution**: Star/badge on days where the trader's identified edge conditions were present and traded. Shows pattern of how consistently they trade their edge.

---

## 4. Chart Widgets & Visualization

### Current State

- 16 chart widgets currently exposed, including monte-carlo, rolling-performance, correlation-matrix, radar-comparison, risk-adjusted, and bell-curve in addition to the original core set
- Comparison mode (vs previous period or vs another account via `CompareSwitch`)
- Drag-and-drop reorder in edit mode

### Improvements

#### 4.1 — Monte Carlo Equity Curve [P1]

**Problem**: Single equity curve doesn't show range of possible outcomes.

**Solution**: Monte Carlo simulation overlay showing:

- 1000+ randomized equity paths based on actual trade statistics
- 95th/5th percentile confidence bands (shaded area)
- Current actual equity line plotted against the band
- Probability of hitting specific balance targets annotated
- The `risk-simulator.ts` already has `runMonteCarloSimulation` — this is a frontend visualization task

#### 4.2 — Rolling Window Performance Chart [P1]

**Problem**: Static timeframe analysis. Can't see how performance evolves over time.

**Solution**: Line chart showing rolling metrics:

- 20-trade rolling win rate
- 20-trade rolling profit factor
- 20-trade rolling avg RR
- User-configurable window size (10, 20, 50 trades)
- Trend line overlay showing improvement/deterioration
- Annotate inflection points with AI insights

#### 4.3 — Radar / Spider Chart for Session & Strategy Comparison [P2]

**Problem**: Session/strategy performance shown as simple bars.

**Solution**: Radar chart comparing across multiple axes simultaneously:

- Win rate, avg RR, profit factor, consistency, avg hold time, avg pips per trade
- Overlay multiple sessions or strategies on same chart
- Instantly shows which approach is strongest and where

#### 4.4 — Risk-Adjusted Performance Chart [P2]

**Problem**: P&L charts don't account for risk taken.

**Solution**: Chart showing:

- Sharpe ratio over time (rolling)
- Sortino ratio (downside-only volatility)
- Calmar ratio (return / max drawdown)
- Risk-adjusted equity curve (P&L normalized by volatility of returns)

#### 4.5 — Psychology vs Performance Correlation Chart [P1]

**Problem**: Psychology data tracked in journal but not visually correlated with performance.

**Solution**: Scatter plot or overlay chart:

- X: mood/confidence/energy score | Y: P&L or win rate for that day
- Trend line showing correlation strength
- "Optimal zone" highlighted (e.g., confidence 7-9 = best win rate)
- Data source: `psychologyCorrelation` table + journal psychology snapshots

#### 4.6 — Trade Distribution Bell Curve [P2]

**Problem**: R-multiple distribution exists but doesn't show where you fall on the normal curve.

**Solution**: Overlay normal distribution on R-multiple histogram:

- Actual mean vs expected mean
- Standard deviation of outcomes
- Outlier trades highlighted (>2 STDV)
- Separate curves for edge conditions vs non-edge conditions

---

## 5. Journal System

### Current State

- Notion-style block-based editor with rich content types (paragraph, heading, image, video, chart embed, callout, code, quote, bullet list, numbered list, divider, checklist)
- Trade Ideas Journal phases: pre-trade, during-trade, post-trade
- Psychology tracker: mood, confidence, energy, focus, fear, greed, emotional state, sleep quality, distractions, market condition, trading environment
- Media attachments (images, videos for trades and entries)
- Templates (browsable, customizable, system-seeded and user-created)
- AI-powered summaries and pattern extraction
- Psychology correlations (cached, shows best trading conditions)
- Journal prompts (auto-queued after trade close, daily reflection, streaks)
- Goals linkable to journal entries

### Improvements

#### 5.1 — Auto-Generated Trade Journal Entries [P0]

**Problem**: Most traders don't journal consistently because it takes too much time and effort.

**Solution**: After each trade closes (via EA webhook), auto-generate a journal entry pre-filled with:

- Trade details (symbol, direction, entry/exit, P&L, RR, duration, costs)
- Mini chart of the trade (from Dukascopy data — same as 2.1)
- AI-generated observation: "This trade had high MAE — you were nearly stopped out before it ran. Your exit captured 65% of max RR."
- Prompted questions: "Why did you enter?", "What was your plan?", "What would you do differently?"
- Auto-linked to the trade record
- Notification: "Journal your EURUSD long — it just closed at +2.1R"
- User just needs to add their notes and rate the trade — 90% of the work is done

**Technical**: `generateTradeClosePrompt` already exists in `journal-prompts.ts`. Enhancement is to generate a full pre-filled entry, not just a prompt.

**Status correction**: treat this as **partial**. Prompt generation and review template infrastructure exist, but webhook-driven auto-creation of a journal entry is not implemented yet.

#### 5.2 — Psychology Dashboard / Analytics Page [P1]

**Problem**: Psychology data is collected (mood, confidence, etc.) but there's no dedicated view to analyze patterns.

**Solution**: Full psychology analytics page showing:

- Mood/confidence/energy trends over time (line chart)
- Performance by emotional state (bar chart: calm vs anxious vs excited)
- "Best trading conditions" summary: "You perform best when mood=7+, sleep=8+, in calm state"
- Tilt detection history with P&L impact quantification
- Emotional pattern recognition: "You tend to feel anxious after 2 consecutive losses, and your next trade's win rate drops 20%"
- The data infrastructure exists: `calculatePsychologyCorrelations`, `getBestTradingConditions`, `computePsychologyProfile` in the AI engine

#### 5.3 — Voice-to-Journal [P3]

**Problem**: Typing journal entries during/after trading sessions is disruptive.

**Solution**: Voice recording button that:

- Records audio during or after a session
- Transcribes using Web Speech API or Whisper
- Structures into journal blocks automatically
- Timestamps entries to correlate with trades
- Low friction: tap record, speak, done

#### 5.4 — Weekly/Monthly Review Templates [P1]

**Problem**: Traders need structured periodic reviews, not just daily entries.

**Solution**: Auto-generated weekly/monthly review entries with:

- Performance summary (auto-filled from trade data)
- Edge analysis: "Your edge conditions this week: X trades, Y win rate"
- Comparison vs previous period (deltas on all key metrics)
- Top 3 best trades & top 3 worst trades (linked, clickable)
- Improvement areas identified by AI
- Goals progress summary
- Prompted reflection questions
- Can be generated on demand or auto-generated on Sunday/1st of month

#### 5.5 — Journal Search & Cross-Reference [P2]

**Problem**: Journal entries accumulate but can't be effectively searched or cross-referenced.

**Solution**:

- Full-text search across all entries
- AI-powered semantic search ("find entries where I talked about overtrading")
- Auto-tag entries with detected themes (discipline, psychology, strategy, market analysis)
- Bidirectional trade ↔ journal linking (click trade to see its journal entry, click journal entry to see linked trades)
- "Similar entries" suggestions when writing

---

## 6. AI Engine & Assistant

### Current State

- Full AI orchestrator: Natural Language → Plan → Execute → Answer (Gemini 2.5 Flash)
- Trader profile computation: sessions, symbols, hold time, RR, execution, hourly, weekday, protocol, consistency, opportunity cost
- Edge/leak condition detection (2-4 dimensional combinatorial analysis)
- Live trade monitoring with 11 alert types and composite scoring
- Psychology engine: tilt detection, mental performance score
- Digest generator: morning briefing, trade feedback, milestones
- Rules engine: trade evaluation, compliance reports, suggested rules
- Risk simulator: Monte Carlo, risk of ruin, drawdown profile, position sizing
- Session tracker: coaching nudges, session summary
- Memory manager: persistent user context across sessions
- Streaming orchestrator with 6-stage pipeline
- Emotion tracking schema (pre-entry, during, post-exit)
- Premium assistant full-page chat interface
- Command palette quick queries (Cmd+K)

**Note**: A separate AI Engine PRD (`AI_ENGINE_PRD.md`) covers AI improvements in deep technical detail. The items below are the highest-impact improvements summarized.

### Improvements

#### 6.1 — Proactive Edge Coaching [P0]

**Problem**: AI is mostly reactive (answers questions) rather than proactive (pushes insights at the right moment).

**Solution**: AI surfaces insights at key moments without being asked:

- **Before session**: "Your edge conditions are active today — London + GBPUSD shorts = 74% historical win rate"
- **After trade close**: Immediate scoring — "This trade captured 65% of max RR. Your average is 72%. The early exit cost ~$X"
- **During losing streak**: "3 losses in a row. Your historical 4th trade win rate after 3 losses: 28%. Consider pausing."
- **Weekly**: "Your edge shifted — NY session overtook London. Here's what changed and why."
- Delivery: toast notifications, dashboard widget, insight panel, optional email digest

**Technical**: `generateTradeCloseInsights`, `monitorOpenTrades`, `generateMorningBriefing`, `generateCoachingNudges` all exist. The gap is proactive delivery timing and UX surfacing.

**Status correction**: treat this as **partial**. The intelligence exists; the orchestration and delivery layer is what remains.

#### 6.2 — "Ask About This" Context Menu [P1]

**Problem**: AI assistant requires manually describing what you want to ask about.

**Solution**: Right-click any trade, chart, metric, or widget → "Ask AI" → Opens assistant pre-loaded with full context:

- "Why did this trade underperform?"
- "How does this compare to my average?"
- "Is this consistent with my edge?"
- Context automatically injected into the orchestrator

#### 6.3 — Pattern Discovery Engine [P1]

**Problem**: Edge/leak conditions are computed but not continuously discovering NEW patterns.

**Solution**: Background analysis that continuously scans for:

- Emerging edge conditions (new combinations reaching statistical significance)
- Deteriorating edges (previously strong conditions weakening)
- Sequence patterns (performance of trade N+1 given outcome of trade N — revenge trading detection)
- Time-decay analysis (are your edges seasonal? monthly? do they rotate?)
- Report findings when significance threshold is reached, or in weekly digest

#### 6.4 — AI Trade Plan Generator [P2]

**Problem**: No pre-trade planning assistance.

**Solution**: AI generates trade plans based on:

- Current market conditions + trader's edge conditions + historical performance
- Outputs: suggested pairs, session, direction bias, position size, SL/TP levels, confidence score
- User reviews plan before session, then evaluates adherence post-session

#### 6.5 — Enhanced Natural Language Queries [P2]

**Problem**: Query engine is powerful but could handle more complex queries.

**Solution**: Support for:

- "Show me all trades where I moved my stop loss and eventually lost"
- "Compare my London performance in Q1 vs Q2"
- "What's the probability I hit my monthly target based on current pace?"
- Better follow-up handling: "those trades" → resolves to previous result set
- "What if" queries: "What if I removed GBPJPY from my trading?"

---

## 7. Goals & Accountability

### Current State

- Goal types: daily, weekly, monthly, milestone
- Target types: profit, winRate, consistency, rr, trades, streak
- Custom goals with flexible criteria (filters + metric + comparator)
- Progress tracking with history snapshots
- Streak tracker with current/longest streaks
- Milestone celebrations with animations
- Activity rings (Apple Watch-style)
- Goal stats (active/achieved/failed counts, completion rate)

### Improvements

#### 7.1 — Process Goals (Not Just Outcome Goals) [P0]

**Problem**: All goals are outcome-based (profit, win rate). Process goals drive the behaviors that lead to outcomes.

**Solution**: New process-oriented goal types:

- "Journal every trade this week" (tracked automatically via journal entry count vs trade count)
- "Follow my rules on 90% of trades" (tracked via compliance engine — `evaluateCompliance` already exists)
- "Only trade during my edge sessions" (tracked via session tags)
- "Risk no more than 1% per trade" (tracked via position sizing data)
- "Take a break after every loss" (tracked via time gap between trades after a loss)
- "Complete pre-trade checklist" (tracked via checklist completion — schema exists in coaching)
- Process goals weighted in a composite "discipline score" displayed on dashboard

#### 7.2 — Goal Streaks & Gamification [P1]

**Problem**: Goals are binary (achieved/failed). No momentum tracking.

**Solution**:

- Track consecutive days/weeks of meeting goals
- Streak badges: 3-day = bronze, 7-day = silver, 30-day = gold
- XP system: earn points for completing goals, journaling, following rules
- Levels that unlock dashboard customization options or AI insights
- Daily/weekly challenges generated by AI based on areas for improvement

#### 7.3 — AI-Suggested Goals [P1]

**Problem**: Traders don't always know what goals to set.

**Solution**: AI analyzes trader profile and suggests goals:

- "Improving exit timing could add ~$X/month. Goal: Increase RR capture efficiency from 65% to 75%"
- "Your revenge trading costs ~$X. Goal: 30-minute break after any loss >2%"
- "You're leaving money on the table in NY session. Goal: Hold NY trades 15 minutes longer"
- Each suggestion includes expected P&L impact
- One-click to create the suggested goal

#### 7.4 — Goal Dependencies & Roadmaps [P3]

**Problem**: Goals are independent. Can't create skill-building sequences.

**Solution**: Goal chains:

- Phase 1: "60% rule compliance" → Phase 2: "80% compliance" → Phase 3: "Maintain 80% for 30 days"
- Visual roadmap (horizontal timeline)
- Unlock next goal only after completing prerequisite

---

## 8. Rules & Compliance

### Current State

- Comprehensive rule schema: requireSL, requireTP, requireTags, max spread/slippage, planned risk/RR limits, max drawdown, scaling rules, hold time limits, session/day/symbol restrictions, max daily trades, max concurrent, max daily loss, max position size
- Rule sets per account or global
- Trade evaluation against rules (`evaluateCompliance`)
- Daily compliance reports
- Rule violation tracking per trade (`tradeRuleEvaluation` table)

### Improvements

#### 8.1 — Real-Time Rule Enforcement via EA [P0]

**Problem**: Rules are only evaluated after trades close. By then it's too late.

**Solution**: EA integration for pre-trade rule checks:

- Before opening a trade, EA sends proposed trade details to server
- Server evaluates against active rule set
- Returns allow/warn/block decision
- EA displays warning or blocks execution
- All blocked/warned attempts logged for accountability
- Requires: new webhook endpoint + EA enhancement

**Status correction**: the server-side endpoint already exists. The remaining work is EA integration, blocked-at-terminal UX, and operational logging polish.

#### 8.2 — Rule Impact Dashboard [P1]

**Problem**: Can't see how rules affect performance historically.

**Solution**: Dashboard showing:

- "If this rule had been active for the last 6 months, you'd have avoided X trades, saving $Y"
- Rule violation history with P&L impact per violation
- Most-violated rules ranked by frequency and cost
- Compliance trend over time chart (improving/declining?)
- "Rule ROI": cost of violations avoided vs trades missed

#### 8.3 — Conditional / Dynamic Rules [P2]

**Problem**: Rules are static. Can't express complex conditions.

**Solution**: Conditional rules:

- "After 2 consecutive losses, reduce max position size to 0.5%"
- "If daily loss exceeds 2%, block all trades for rest of day"
- "If win streak exceeds 5, reduce max position size by 30%" (overconfidence guard)
- "If tilt score > 7, alert and suggest break"
- IF-THEN rule builder UI

#### 8.4 — AI-Suggested Rules [P1]

**Problem**: Users have to manually identify what rules to create.

**Solution**: AI analyzes trade history and suggests rules:

- "73% of trades with spread > 3 pips are losses. Suggested rule: Max spread 2.5 pips"
- "Win rate drops to 35% after 3pm. Suggested rule: Stop trading after 3pm"
- Each suggestion includes historical impact analysis
- "Create Rule" button auto-populates the rule form
- Already partially implemented via `generateSuggestedRules` in AI engine

---

## 9. Alerts & Notifications

### Current State

- Alert rules: daily_loss, max_drawdown, win_streak, loss_streak, consecutive_green, consecutive_red
- Configurable thresholds (percent, usd, count), severity (info/warning/critical)
- In-app and email notification options
- Cooldown period between alerts
- Notifications hub (`notifications-hub.tsx`)
- `createNotification` utility

### Improvements

#### 9.1 — Multi-Channel Delivery [P1]

**Problem**: Only in-app and email.

**Solution**: Add:

- Telegram bot integration (popular among forex traders)
- Discord webhook integration
- Push notifications (Web Push API for PWA)
- Custom webhook URL (for traders with their own systems)

#### 9.2 — Smart Escalation [P2]

**Problem**: All alerts treated the same regardless of acknowledgment.

**Solution**: Escalation chains:

- Info → Log only
- Warning → In-app + sound
- Critical → All channels + EA popup + session pause recommendation
- Auto-escalate: if warning not acknowledged within X minutes, escalate

#### 9.3 — Pattern-Based Alerts [P1]

**Problem**: Only threshold-based alerts.

**Solution**: AI-powered behavioral alerts:

- "Your trading pattern matches your typical tilt behavior"
- "Trading more frequently than average — possible overtrading"
- "Position sizes increasing after losses — possible revenge trading"
- "Trading outside your edge sessions today"
- Uses existing AI engine: `detectTiltStatus`, `generateCoachingNudges`

#### 9.4 — Market Context Alerts [P2]

**Problem**: Alerts based only on trading performance, not market conditions.

**Solution**:

- "High-impact news in 15 minutes — consider position review"
- "Unusual volatility on your active pairs"
- "Watchlist pair reached target price level"
- Economic calendar integration already exists — enhance with alert triggers

---

## 10. Backtest Module

### Current State

- Session CRUD (create, list, archive, complete, delete, duplicate)
- Per-session trades (entry, TP hit, SL hit, manual close, cancel, modify)
- Data sources: Dukascopy, simulated, EA candles
- Indicator support: SMA, EMA, RSI, MACD, Bollinger Bands, ATR
- Analytics: overview stats, equity curve, trade list
- Backtest vs live comparison (`compareBacktestToLive`)
- Journal entries linkable to backtest sessions
- Replay mode (step through historical candles, place trades)

### Improvements

#### 10.1 — Strategy Template Library [P1]

**Problem**: Backtesting requires manually configuring every aspect.

**Solution**: Pre-built templates:

- ICT methodology (liquidity raid, breaker block, order block, FVG)
- SMC templates (CHoCH, BOS)
- Classical patterns (S/R, MA crossover, breakout)
- User can customize and save as own template
- Share templates via social features

#### 10.2 — Multi-Symbol Backtest [P2]

**Problem**: Sessions are single-symbol only.

**Solution**:

- Test same strategy across multiple symbols simultaneously
- Portfolio-level backtesting with correlation awareness
- Compare results per symbol
- Identify which symbols best suit each strategy

#### 10.3 — Backtest vs Live Gap Analysis [P1]

**Problem**: Comparison exists but doesn't explain the gap.

**Solution**: Enhanced comparison:

- Side-by-side equity curves
- Attribution: how much of the gap is from execution (slippage, spread), psychology (different sizing, early exits), or market conditions (different volatility regime)?
- "Execution gap" metric: theoretical P&L minus actual P&L
- Actionable suggestions to close the gap

#### 10.4 — Walk-Forward Validation [P3]

**Problem**: No out-of-sample validation for strategies.

**Solution**: Split data into optimize/validate periods:

- Test strategy on unseen data automatically
- Report in-sample vs out-of-sample performance
- Detect overfitting with statistical tests
- Suggest parameter adjustments based on robustness

---

## 11. Prop Firm Tracker

### Current State

- Prop firm registry with detection patterns (FTMO, FundedNext, E8Markets, etc.)
- Challenge rule definitions (daily loss, max drawdown, profit target, min trading days, consistency rules)
- Per-account tracking: phase, status, progress, high water marks, best day profit
- Auto-detection from broker server name
- Pass probability via Monte Carlo
- Account page shows prop accounts separately with status badges

### Improvements

#### 11.1 — Real-Time Challenge Dashboard [P0]

**Problem**: Prop tracker shows status but not trajectory or risk proximity.

**Solution**: Real-time dashboard per challenge showing:

- **Gauge charts**: Daily Loss Used (X/5%), Max Drawdown Used (X/10%), Profit Target Progress (X/10%)
- **Projection**: "At current pace, you'll reach target in 8 days (12 remaining)"
- **Risk thermometer**: How close to blowing limits (red zone / yellow zone / green zone)
- **"Safe to trade" indicator**: Based on remaining buffer and current volatility
- **Daily P&L chart** with limit lines overlaid (horizontal lines at -5% daily, -10% max)
- **Consistency rule tracker**: No single day > 30% of total profit (for firms like E8)
- Data already exists: `propPhaseCurrentProfit`, `propDailyHighWaterMark`, `propPhaseHighWaterMark`

#### 11.2 — Challenge Simulator [P1]

**Problem**: Can't predict challenge outcomes before starting.

**Solution**: Interactive simulator:

- Input average trade stats → simulate 1000 challenges
- Show: pass rate, average days to pass, average buffer remaining
- "What if" scenarios: "Reduce risk to 0.5% per trade → pass rate goes from 45% to 67%"
- Optimal position sizing recommendation for challenge passing
- Uses existing `runMonteCarloSimulation` with prop firm constraints

#### 11.3 — Multi-Phase Timeline [P2]

**Problem**: Prop challenges have multiple phases with different rules.

**Solution**:

- Visual timeline: Phase 1 → Phase 2 → Funded
- Different dashboards per phase (different rule limits apply)
- Phase transition: when Phase 1 "passed", prompt to create Phase 2 account
- Carry forward stats and lessons learned

#### 11.4 — Prop Firm Comparison Tool [P2]

**Problem**: Hard to choose between prop firms.

**Solution**: Side-by-side comparison:

- Rules, fees, profit splits, platforms, payout schedules
- "Best fit" recommendation based on trader's actual performance profile
- Community success rates per firm (from social data if available)

---

## 12. Social & Feed

### Current State

- Account following (verified accounts only, must opt-in)
- Feed events: trade_closed, execution_insight, discipline_break, streak_milestone, session_summary
- Trade annotations (comments on trades)
- Pattern following/matching
- Mirror comparisons (compare your performance to someone else's)
- Bookmarks and activity tracking
- Requires verification (EA-synced minimum)
- Feed page with event cards and filtering

### Improvements

#### 12.1 — Anonymous Performance Benchmarking [P0]

**Problem**: Social features require opting in and revealing identity. Many traders want to compare without exposure.

**Solution**: Anonymous benchmarking dashboard:

- "Your win rate is in the top 25% of platform traders"
- "Your consistency score is top 10% for your experience level"
- "Your avg hold time is below median — top performers hold 40% longer"
- No identity revealed — statistical comparison only
- Segment by: experience level, account size, asset class, prop/retail
- Opt-in data contribution (anonymized aggregation)

#### 12.2 — Trade Idea Sharing [P2]

**Problem**: Feed shows closed trades only (reactive, not actionable).

**Solution**: Verified traders can share:

- Pre-trade ideas with reasoning and analysis
- Attach their historical stats for that setup type
- Other traders can "follow" ideas and report results
- Rating system based on outcomes
- Filter ideas by symbol, session, strategy

#### 12.3 — Study Groups / Trading Circles [P3]

**Problem**: Social features are broadcast-only. No collaboration.

**Solution**: Small groups (3-10 traders):

- Shared trade feed within circle
- Weekly group challenges
- Peer review trades
- Group analytics (collective performance)
- Accountability partners with shared goal tracking

#### 12.4 — Verified Track Record System [P1]

**Problem**: Anyone can claim to be profitable.

**Solution**: Tiered verification:

- EA-synced: trades cryptographically verified
- Minimum trade count thresholds (50, 100, 500)
- Auditable equity curve (anyone can verify)
- "Verified since [date]" badge
- Required for premium social features (following, leaderboard, trade sharing)

---

## 13. Leaderboard

### Current State

- Categories: consistency, execution, discipline, risk
- Periods: 30d, 90d, all_time
- Percentile bands and rankings
- Sample validity checks (minimum trades)
- Shows metric values per entry
- Requires verified account

### Improvements

#### 13.1 — Specialization Leaderboards [P2]

**Problem**: Generic categories don't help traders find peers in their niche.

**Solution**: Leaderboards by:

- Instrument: "Best EURUSD trader"
- Session: "Best London session trader"
- Strategy/model: "Best ICT trader"
- Prop firm: "Most challenges passed"
- Account size tier: compare against similar-sized accounts

#### 13.2 — Achievement System [P1]

**Problem**: Leaderboard is rank-based only. Achievements motivate differently than rankings.

**Solution**: Achievement badges:

- "100 Trade Club", "500 Trade Warrior", "1000 Trade Veteran"
- "Consistency King" (30+ consecutive green days)
- "Risk Master" (never exceeded 2% daily drawdown in 90 days)
- "Iron Discipline" (100% rule compliance for 30 days)
- "Edge Finder" (identified and traded 3+ edge conditions)
- Displayed on profile and in social feed

#### 13.3 — Seasonal Competitions [P3]

**Problem**: Leaderboard is static. No urgency or engagement loop.

**Solution**: Time-boxed competitions:

- Monthly: "Most consistent trader of March"
- Weekly sprints: "Best win rate this week (min 10 trades)"
- Entry requires verified account
- Prizes: premium features, recognition badges

---

## 14. Trade Copier

### Current State

- Copy groups (master → slave relationships)
- Lot modes: fixed, multiplier, balance_ratio, risk_percent
- SL/TP modes: copy, fixed_pips, adjusted
- Risk controls: max lot, max daily loss, max trades/day, max drawdown, max slippage
- Symbol whitelist/blacklist, session filters
- Reverse trading mode, pending order copying
- Copy SL/TP modification tracking
- Per-slave configuration
- Stats tracking per group (profit, trade count)

### Improvements

#### 14.1 — Smart Copy Filters Based on Edge [P2]

**Problem**: Copier copies all trades from master indiscriminately.

**Solution**: Filter copies based on master's edge conditions:

- "Only copy trades matching master's top 3 edge conditions"
- "Only copy during master's best session"
- "Skip trades where master is on a losing streak (possible tilt)"
- Requires: computing edge conditions for master account

#### 14.2 — Copy Performance Attribution [P1]

**Problem**: Can't see which copied trades were profitable vs which lost money.

**Solution**: Dashboard showing:

- Copied trade P&L vs master trade P&L (per trade)
- Execution slippage between master and copy
- "Copy value-add": net benefit of copying vs not copying
- Best/worst performing copy groups over time

#### 14.3 — Copy Health Monitoring [P1]

**Problem**: No visibility into copy execution quality.

**Solution**: Health dashboard:

- Copy latency (time between master trade and copy execution)
- Failed copies (and why: slippage exceeded, daily limit hit, etc.)
- Drift tracking (how much copy P&L diverges from master over time)
- Alerts when copy quality degrades

---

## 15. Accounts Management

### Current State

- Account creation with broker, name, type (mt4/mt5/ctrader/ib/oanda)
- Broker server and account number tracking
- Data source preference (dukascopy, alphavantage, truefx, broker)
- Prop firm linking with auto-detection
- Verification levels (unverified, ea_synced, api_verified, prop_verified)
- Social opt-in per account
- Accounts page showing broker and prop accounts separately
- Account selector in sidebar

### Improvements

#### 15.1 — Multi-Account Aggregated View [P0]

**Problem**: Dashboard and all metrics are per-account only. Traders with multiple accounts can't see the big picture.

**Solution**: "All accounts" option in account selector that shows:

- Combined equity curve across all accounts
- Total P&L aggregated
- Performance comparison table (account vs account)
- Risk allocation visualization (exposure per account)
- Per-account contribution to overall performance
- Which account is performing best/worst

#### 15.2 — Account Health Score [P1]

**Problem**: No at-a-glance indicator of account health.

**Solution**: Health score (0-100) based on:

- Drawdown from peak (lower is better)
- Win rate trend (improving/declining)
- Risk compliance (following rules)
- Consistency (low variance in daily P&L)
- Color-coded in account selector: green (healthy) / yellow (caution) / red (at risk)

#### 15.3 — Broker API Integrations [P3]

**Problem**: Only EA-based sync and CSV upload. No direct API connections.

**Solution**: Add direct broker API integrations:

- cTrader Open API
- OANDA REST API
- Interactive Brokers TWS API
- TradingView webhook → trade log
- Auto-sync trades without EA dependency

#### 15.4 — Account Archiving & Data Management [P2]

**Problem**: No way to archive old accounts or manage data volume.

**Solution**:

- Archive accounts (hide from selector but preserve data)
- Export full account data (all trades, journal entries, analytics)
- Delete account with all associated data (GDPR)
- Data retention settings

---

## 16. Settings & Configuration

### Current State

- Settings pages: broker, ea-setup, api, alerts, compliance, connections, metrics, notifications, social, tags
- Settings sidebar navigation
- Broker configuration, EA download, API key management
- Tag management (session tags, model tags, protocol alignment)
- Metric configuration
- Notification preferences
- Social visibility settings

### Improvements

#### 16.1 — Custom Trading Session Configuration [P1]

**Problem**: Sessions are tagged but not configured with actual time windows.

**Solution**: Define custom trading sessions:

- Name, start time, end time, timezone
- Auto-tag trades based on open time falling within session window
- Use in rules: "only trade during defined sessions"
- Use in analytics: session-based breakdowns
- Default sessions provided: London (7-16 UTC), NY (13-22 UTC), Asian (0-9 UTC)

#### 16.2 — Centralized Risk Profile [P1]

**Problem**: Risk settings scattered across rules, alerts, copier, and goals.

**Solution**: Single risk profile page:

- Max risk per trade (%)
- Max daily risk (%)
- Max weekly risk (%)
- Max concurrent positions
- Max correlation exposure (don't stack same-direction correlated pairs)
- Position sizing defaults (fixed, risk-based, Kelly)
- Risk escalation rules (auto-reduce after N losses)
- These settings feed into: rules engine, copier, goals, dashboard widgets, AI recommendations

#### 16.3 — Timezone Management [P2]

**Problem**: Complex timezone handling (broker time vs UTC vs local).

**Solution**: Clear timezone configuration:

- Display timezone (user's local — auto-detected)
- Broker server timezone (configurable per account)
- Session definition timezone
- All timestamps converted consistently throughout the app
- Currently `ASSUMED_TZ_MINUTES = 0` in trades router — make configurable

#### 16.4 — Import/Export Configuration [P2]

**Problem**: Configuration (widgets, rules, goals, views) can't be backed up or shared.

**Solution**:

- Export all settings as JSON
- Import settings from JSON
- Share configurations (view presets, rule sets) with other users
- Reset to defaults option

---

## 17. EA / Webhook Integration

### Current State

- API key authentication (SHA-256 hashed)
- Webhook endpoints: trade sync (close), open trades sync, historical prices, account metrics
- Auto-detection of prop firms from broker server
- Trade close triggers: AI insights generation, profile refresh, notifications
- Open trade monitoring (polling every 5 seconds)
- Equity snapshot tracking
- Post-exit peak price tracking (for money-left-on-table analysis)
- Pre-trade evaluation endpoint exists server-side (`allow / warn / block`), but is not yet invoked by the EA flow

### Improvements

#### 17.1 — EA Health Dashboard [P1]

**Problem**: Can't tell if the EA is connected and running properly.

**Solution**: EA status page showing:

- Connection status: last heartbeat time, uptime percentage
- Sync latency: average time from trade close to dashboard update
- Data quality: missing fields, parse errors, rejected payloads
- Version compatibility: is EA version compatible with current API?
- Diagnostics: test connection button, view recent webhook payloads

#### 17.2 — Pre-Trade Webhook [P0]

**Problem**: EA only reports after trade execution.

**Solution**: New endpoint for pre-trade evaluation:

- EA sends proposed trade details before execution
- Server evaluates against rules, edge conditions, tilt status
- Returns: allow / warn (with reason) / block (with reason)
- EA displays warning or blocks based on response
- Log all pre-trade evaluations (approved, warned, blocked)
- Critical for real-time rule enforcement (8.1)

#### 17.3 — WebSocket for Real-Time Updates [P2]

**Problem**: Open trade data polled every 5 seconds.

**Solution**: WebSocket connection:

- Instant open trade updates as prices change
- Live P&L streaming to dashboard
- Immediate alert triggering (no 5-second delay)
- Lower server load than polling
- Fallback to polling if WebSocket connection drops

#### 17.4 — Generic Webhook Format [P2]

**Problem**: EA only works with MT4/MT5.

**Solution**: Standard JSON webhook format:

- Documented schema for trade open/close/modify events
- Support any platform that can send HTTP POST requests
- TradingView alert → webhook → trade log
- cTrader → webhook → trade log
- API documentation page with examples and testing tools

---

## 18. Onboarding & Landing Page

### Current State

- Sign up / login pages with email/password (Better Auth)
- Onboarding flow already exists as a 4-step wizard with profile, plan, account setup, and rules preset selection
- Landing page at `/`
- Public profile pages at `(public)/profile/[username]`
- Share pages at `(public)/share/[shareId]`

### Improvements

#### 18.1 — Guided Onboarding Flow [P0]

**Problem**: New users land on an empty dashboard with no guidance.

**Solution**: Step-by-step wizard:

1. **"What's your broker?"** → Create first account (broker selector, account name)
2. **"How do you trade?"** → Set up trading sessions, preferred instruments, timezone
3. **"Upload your first trades"** → CSV upload with guided column mapping OR connect EA
4. **"Set your first goal"** → Guided goal creation with AI suggestions
5. **"Your first insight"** → Show initial AI analysis of uploaded trades (even 10 trades gives useful data)

- Progress bar with skip options
- Can resume later (save onboarding state)
- "Quick start" (CSV upload) vs "Full setup" (EA connection) paths

**Status correction**: the core wizard exists. The missing pieces are persistence/resume, sample-data entry, richer import mapping, and stronger "first insight" handoff.

#### 18.2 — Sample data Mode [P2]

**Problem**: Users want to explore the app before committing to uploading their data.

**Solution**: "Try with sample data" option:

- Pre-loaded realistic 200-trade dataset
- Full functionality with sample account
- Clear "SAMPLE DATA" badges everywhere
- One-click to switch to real data (guided)

#### 18.3 — Landing Page Enhancement [P2]

**Problem**: Landing page doesn't effectively showcase the product.

**Solution**: Interactive landing page:

- Animated dashboard preview showing widgets in action
- "Ask a question" → demo AI response with sample data
- Feature comparison with competitors
- ROI calculator: "If you improve your exit timing by 10%, your monthly P&L increases by $X"
- Social proof: verified user statistics, achievement counts

---

## 19. Cross-Cutting Concerns

### 19.1 — Performance Optimization [P1]

- Redis/in-memory caching for computed profiles and aggregations (currently using basic `cache` utility)
- Pre-compute daily aggregation rollups (cron job at midnight)
- Lazy-load chart data (don't fetch all 10 chart types on dashboard load)
- Web Workers for heavy client-side calculations (Monte Carlo, profile computation)
- Connection pooling optimization for PostgreSQL

### 19.2 — Data Quality & Integrity [P1]

- Trade deduplication on webhook ingestion (already have ticket-based uniqueness, but edge cases exist)
- Data validation layer on all webhook payloads
- Audit log for data modifications
- Orphan detection (trades without accounts, journal entries without users)

### 19.3 — Keyboard Navigation [P2]

- Global shortcut palette (Cmd+K exists for AI)
- Section navigation: Cmd+1-9 for dashboard/trades/journal etc.
- Trade table: vim-style j/k navigation, Enter to expand
- Quick journal: Cmd+J from anywhere
- Quick AI query: Cmd+Shift+A from anywhere
- Already have `use-trade-keyboard-shortcuts.ts` — extend globally

### 19.4 — Theme & Accessibility [P2]

- Currently dark-mode primary. Ensure light mode is fully polished
- Auto-detect system preference
- High contrast mode for accessibility
- Consistent spacing, font sizes, color palette across all pages

### 19.5 — Mobile / PWA Support [P3]

- Service worker for offline access
- Push notifications via Web Push API
- Responsive layouts for all pages (currently optimized for desktop)
- Touch interactions (swipe, long-press)
- Offline queue for journal entries and notes

### 19.6 — Security Hardening [P1]

- Rate limiting on webhook and API endpoints
- API key scoping (read-only vs write)
- IP allowlisting for API keys
- Input sanitization audit (Drizzle ORM protects against SQL injection, but verify raw `sql` template literals in routers)
- Content Security Policy headers

---

## 20. Priority Matrix

### P0 — Core Value Proposition (Ship First)

| #   | Feature                                | Section             | Why                                           |
| --- | -------------------------------------- | ------------------- | --------------------------------------------- |
| 1   | Edge Summary Widget                    | Dashboard 1.1       | THE core promise — "find YOUR edge"           |
| 2   | Auto-Generated Trade Journal           | Journal 5.1         | Removes friction from #1 habit                |
| 3   | Proactive Edge Coaching                | AI 6.1              | AI pushes insights at the right moment        |
| 4   | Real-Time Prop Challenge Dashboard     | Prop 11.1           | High-value for largest user segment           |
| 5   | Multi-Account Aggregation              | Accounts 15.1       | Fundamental gap for multi-account traders     |
| 6   | Process Goals                          | Goals 7.1           | Shifts focus from outcomes to behavior change |
| 7   | Real-Time Rule Enforcement (Pre-Trade) | Rules 8.1 + EA 17.2 | Prevents mistakes BEFORE they happen          |
| 8   | Guided Onboarding                      | Onboarding 18.1     | First impression determines retention         |

### P1 — High-Impact Improvements (Ship Soon)

| #   | Feature                                  | Section              |
| --- | ---------------------------------------- | -------------------- |
| 9   | Trade Replay / Mini-Chart                | Trades 2.1           |
| 10  | Time-Contextual Dashboard                | Dashboard 1.2        |
| 11  | Psychology Dashboard                     | Journal 5.2          |
| 12  | Monte Carlo Equity Curve                 | Charts 4.1           |
| 13  | Anonymous Benchmarking                   | Social 12.1          |
| 14  | Calendar Goal Overlay & Heatmap          | Calendar 3.2, 3.3    |
| 15  | Rolling Performance Chart                | Charts 4.2           |
| 16  | Psychology-Performance Correlation Chart | Charts 4.5           |
| 17  | Smart Grouping in Trade Table            | Trades 2.2           |
| 18  | Trade Cost Analysis                      | Trades 2.5           |
| 19  | Inline Expandable Trade Detail           | Trades 2.6           |
| 20  | AI-Suggested Goals & Rules               | Goals 7.3, Rules 8.4 |
| 21  | Rule Impact Dashboard                    | Rules 8.2            |
| 22  | Pattern-Based Alerts                     | Alerts 9.3           |
| 23  | Multi-Channel Alerts                     | Alerts 9.1           |
| 24  | Challenge Simulator                      | Prop 11.2            |
| 25  | Backtest vs Live Gap Analysis            | Backtest 10.3        |
| 26  | Copy Performance Attribution             | Copier 14.2          |
| 27  | Account Health Score                     | Accounts 15.2        |
| 28  | Session Configuration                    | Settings 16.1        |
| 29  | Risk Profile                             | Settings 16.2        |
| 30  | EA Health Dashboard                      | EA 17.1              |
| 31  | Verified Track Record                    | Social 12.4          |
| 32  | Achievement System                       | Leaderboard 13.2     |
| 33  | Weekly/Monthly Review Templates          | Journal 5.4          |
| 34  | Pattern Discovery Engine                 | AI 6.3               |
| 35  | "Ask About This" Context Menu            | AI 6.2               |
| 36  | Comparative Period Widget                | Dashboard 1.3        |
| 37  | Strategy Template Library                | Backtest 10.1        |
| 38  | Performance & Caching                    | Cross-Cutting 19.1   |
| 39  | Security Hardening                       | Cross-Cutting 19.6   |
| 40  | Data Quality Checks                      | Cross-Cutting 19.2   |

### P2 — Differentiators (Ship Next)

| #   | Feature                             | Section            |
| --- | ----------------------------------- | ------------------ |
| 41  | "What If" Scenario Widget           | Dashboard 1.4      |
| 42  | Trade Correlation Matrix            | Trades 2.3         |
| 43  | Advanced Statistical Filters        | Trades 2.7         |
| 44  | Radar Chart for Strategy Comparison | Charts 4.3         |
| 45  | Risk-Adjusted Performance Charts    | Charts 4.4         |
| 46  | Journal Search & Cross-Reference    | Journal 5.5        |
| 47  | Conditional/Dynamic Rules           | Rules 8.3          |
| 48  | Smart Alert Escalation              | Alerts 9.2         |
| 49  | Multi-Phase Prop Tracking           | Prop 11.3          |
| 50  | Prop Firm Comparison Tool           | Prop 11.4          |
| 51  | Multi-Symbol Backtest               | Backtest 10.2      |
| 52  | Trade Idea Sharing                  | Social 12.2        |
| 53  | Smart Copy Filters                  | Copier 14.1        |
| 54  | Account Archiving                   | Accounts 15.4      |
| 55  | WebSocket Real-Time Updates         | EA 17.3            |
| 56  | Generic Webhook Format              | EA 17.4            |
| 57  | Sample data Mode                    | Onboarding 18.2    |
| 58  | Landing Page Enhancement            | Onboarding 18.3    |
| 59  | Timezone Management                 | Settings 16.3      |
| 60  | Config Import/Export                | Settings 16.4      |
| 61  | Enhanced Export                     | Trades 2.8         |
| 62  | Streak Context Column               | Trades 2.4         |
| 63  | Session-Aware Calendar              | Calendar 3.1       |
| 64  | Widget Quick Actions                | Dashboard 1.5      |
| 65  | Mobile Responsive Dashboard         | Dashboard 1.6      |
| 66  | Keyboard Navigation                 | Cross-Cutting 19.3 |
| 67  | Theme & Accessibility               | Cross-Cutting 19.4 |

### P3 — Future Vision

| #   | Feature                       | Section            |
| --- | ----------------------------- | ------------------ |
| 68  | Voice-to-Journal              | Journal 5.3        |
| 69  | AI Trade Plan Generator       | AI 6.4             |
| 70  | Goal Dependencies & Roadmaps  | Goals 7.4          |
| 71  | Walk-Forward Validation       | Backtest 10.4      |
| 72  | Study Groups / Circles        | Social 12.3        |
| 73  | Seasonal Competitions         | Leaderboard 13.3   |
| 74  | Specialization Leaderboards   | Leaderboard 13.1   |
| 75  | Broker API Integrations       | Accounts 15.3      |
| 76  | Mobile PWA                    | Cross-Cutting 19.5 |
| 77  | Goal Gamification (XP/Levels) | Goals 7.2          |
| 78  | Market Context Alerts         | Alerts 9.4         |

---

## How Everything Connects to "Finding Your Edge"

The central thesis of Profitabledge is: **every trader has a profitable edge hidden in their data — the app's job is to find it, surface it, and help them trade it consistently.**

Here's how each section contributes:

```
┌─────────────────────────────────────────────────────────────┐
│                     FIND THE EDGE                           │
│  Dashboard Edge Widget ← AI Pattern Discovery ← Trade Data │
│  Charts & Visualization ← Advanced Metrics ← EA/Webhook    │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    TRADE THE EDGE                            │
│  Pre-Trade Rule Check ← Rules Engine ← Edge Conditions      │
│  Session Coaching ← Tiltmeter ← Psychology Tracking          │
│  Trade Plans ← AI Suggestions ← Historical Performance       │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   REFINE THE EDGE                            │
│  Journal ← Auto-Generated Entries ← Trade Close Events       │
│  Goals ← Process Goals ← Rule Compliance Tracking            │
│  Backtest ← Strategy Templates ← vs Live Gap Analysis        │
│  Weekly Reviews ← AI Insights ← Pattern Discovery            │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                  PROVE THE EDGE                              │
│  Prop Challenge Dashboard ← Challenge Simulator              │
│  Verified Track Record ← Social Feed                         │
│  Leaderboard Rankings ← Achievement System                   │
│  Anonymous Benchmarking ← Community Data                     │
└─────────────────────────────────────────────────────────────┘
```

Every feature either helps **find**, **trade**, **refine**, or **prove** the trader's edge. Features that don't contribute to this loop should be deprioritized.

---

_This PRD contains 78 improvement items across 19 sections. Each can be broken into individual implementation epics. Start with P0 items — they deliver the core value proposition._
