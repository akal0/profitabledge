# ProfitablEdge AI Engine — Product Requirements Document

**Version**: 1.0
**Date**: March 3, 2026
**Author**: AI Architecture Team
**Status**: Draft — Pending Review

---

## Executive Summary

ProfitablEdge's AI engine currently covers **query understanding**, **profile computation**, **edge/leak detection**, **insight generation**, **live trade monitoring**, and **streaming visualization**. This PRD outlines the next evolution: transforming the AI from a **reactive analytics tool** into a **proactive trading coach** that watches, learns, warns, teaches, and adapts — with the goal of making every trader profitable by eliminating their leaks and amplifying their edge.

The improvements are grouped into **7 pillars**, ordered by user impact.

---

## Table of Contents

1. [Proactive AI Coach (Cypher-class)](#1-proactive-ai-coach)
2. [Trading Psychology Engine](#2-trading-psychology-engine)
3. [AI-Powered Trade Notes & Market Context](#3-ai-powered-trade-notes--market-context)
4. [Pre-Trade Planning & Discipline System](#4-pre-trade-planning--discipline-system)
5. [Advanced Risk Intelligence](#5-advanced-risk-intelligence)
6. [Conversation & Query Improvements](#6-conversation--query-improvements)
7. [Visualization & Reporting Upgrades](#7-visualization--reporting-upgrades)

Appendices:

- [A. Competitive Landscape](#appendix-a-competitive-landscape)
- [B. Technical Architecture](#appendix-b-technical-architecture)
- [C. Phased Roadmap](#appendix-c-phased-roadmap)

---

## Current State Assessment

### What We Have (Working)

- 74-field natural language query engine (Gemini 2.5 Flash)
- Trader profile with 54+ metrics (sessions, symbols, hold time, RR, execution, streaks, consistency, opportunity cost)
- Combinatorial edge/leak detection (2-4 dimensional analysis)
- 6-category insight engine (behavioral, efficiency, risk, pattern, anomaly, positive)
- Live trade monitor with 11 alert types and composite trade scoring
- Streaming orchestrator (6-stage pipeline with real-time events)
- 16 visualization types across 7 base chart components
- Command palette quick query (Cmd+K → condensed AI answer)
- Chat history with conversation context (multi-turn)
- Profile-aware query planning and answer assembly

### What's Missing

- No proactive coaching — AI only responds when asked
- No psychology/emotion tracking — biggest gap vs. Edgewonk
- No market context enrichment — trades exist in a vacuum
- No pre-trade planning — no discipline tracking system
- No temporal trend modeling — can't say "your win rate is declining"
- No risk simulation — no Monte Carlo, drawdown projections, or scenario testing
- No AI auto-tagging — manual session/model tags only
- No cross-account intelligence — profiles are isolated
- No learning loop — AI doesn't improve its recommendations over time
- No trade replay integration
- Conversation doesn't remember long-term preferences
- Limited onboarding — new traders with <30 trades get minimal value

---

## 1. Proactive AI Coach

**Priority**: P0 — This is the single highest-impact improvement
**Benchmark**: TraderSync Cypher, but deeper and more personalized

### 1.1 Scheduled Intelligence Digest

**What**: Every morning (configurable), generate a personalized "Daily Briefing" that the trader sees when they open the app.

**Contents**:

- **Yesterday's Review**: Automatic analysis of yesterday's trades — what went right, what went wrong, which trades matched your edge conditions, which were leaks
- **Today's Outlook**: Based on your profile, recommend which sessions to focus on, which symbols have been trending well for you, your current streak context ("You're on a 3-trade win streak — your data shows you tend to overtrade after streaks of 4+")
- **Weekly Progress**: Rolling 7-day win rate, profit factor, and consistency score vs. your 30-day average — are you improving?
- **One Thing to Focus On**: Single, actionable recommendation pulled from your worst leak or most promising edge ("Today, focus on only taking London session EURUSD trades — your 78% win rate setup")

**Delivery**:

- In-app notification panel (already built — `insight-panel.tsx`)
- Optional email digest (morning summary)
- Optional push notification for critical alerts

**Schema additions**:

```
trader_digest
  - id, accountId, userId
  - digestType: 'morning' | 'evening' | 'weekly'
  - content (jsonb): { review, outlook, progress, focusItem }
  - deliveredAt, readAt
  - createdAt
```

**Server implementation**:

- New file: `apps/server/src/lib/ai/engine/digest-generator.ts`
- Cron trigger: configurable schedule (default 7am user's timezone)
- Uses cached `TraderProfileData` + last 24h trade analysis
- Calls Gemini for natural language generation of the digest text (profile + recent data as context)

### 1.2 Post-Trade Instant Feedback

**What**: Within seconds of a trade closing (webhook trigger), generate a structured trade evaluation card.

**Contents**:

- **Trade Score**: 0-100 composite score (setup quality, timing, execution, risk management, outcome)
- **Edge Match**: Did this trade match any of your edge conditions? Which ones?
- **Leak Match**: Did this trade match any leak conditions? Flag with severity
- **vs. Your Average**: Hold time vs. your average, RR vs. your sweet spot, session fit
- **What If**: "If you had held 10 more minutes, price moved X more points in your favor" (from `postExitPeakPrice` data)
- **AI Comment**: 1-2 sentence natural language feedback ("Good discipline — this matched your best London setup. However, you exited 12 minutes early based on your sweet spot.")

**Delivery**:

- Toast notification on dashboard (already have `ai-insight-toast.tsx`)
- Persisted in `traderInsight` table with `triggerType: 'trade_close'`
- Visible in trade detail view

**Implementation**:

- Enhance existing `generateTradeCloseInsights()` in `insight-engine.ts`
- Add `scoreClosedTrade()` function that produces the structured evaluation
- New frontend component: `trade-feedback-card.tsx` — renders inline in the trade table row expansion or as a slide-over

### 1.3 Real-Time Session Coaching

**What**: When the trader has open trades, provide continuous coaching based on live data.

**Current state**: `live-monitor.ts` already detects anomalies and scores trades. Enhancement: make it conversational and proactive.

**Enhancements**:

- **Session State Awareness**: Track how many trades the trader has taken this session, their session P&L, and compare to profile norms ("You've taken 5 trades in 2 hours — you average 3. Consider slowing down")
- **Tilt Detection**: If recent trades show a pattern (3 consecutive losses, revenge-like re-entries within 2 minutes of a loss, increasing position sizes after losses), trigger a "Tilt Warning" alert
- **Dynamic Score Updates**: Push updated trade scores as market price changes (websocket or polling)
- **Contextual Nudges**: "Your hold time on this trade is approaching your sweet spot exit window" or "This trade is now at your average MAE — historically, 65% of your trades that reach this level end as losers"

**Implementation**:

- New file: `apps/server/src/lib/ai/engine/session-tracker.ts`
- Tracks: session start time, trade count, running P&L, time between trades, position size progression
- Consumes open trade updates from webhook
- Emits coaching events via the existing streaming infrastructure

### 1.4 Adaptive Recommendations

**What**: AI recommendations should evolve as the trader improves or regresses.

**How**:

- Track which recommendations the trader acts on (implicit: did they stop trading a leak condition?) and which they ignore
- Maintain a `recommendation_history` table tracking: recommendation, timestamp, outcome (did the trader's behavior change?)
- Use this feedback loop to prioritize future recommendations — don't repeat dismissed advice, escalate ignored critical leaks
- Confidence scoring: recommendations backed by more data get higher priority

**Schema**:

```
recommendation_log
  - id, accountId, userId
  - category, recommendation (text)
  - context (jsonb): what data supported this
  - acknowledged (boolean), acknowledgedAt
  - outcomeTracked (boolean): did behavior change?
  - effectivenessScore: -1 to 1 (negative = trader got worse)
  - createdAt
```

---

## 2. Trading Psychology Engine

**Priority**: P0 — Biggest gap vs. competition (Edgewonk Tiltmeter, M1NDTR8DE)
**Benchmark**: Edgewonk Tiltmeter + M1NDTR8DE coaching, but integrated into the AI engine

### 2.1 Emotion Tagging System

**What**: Allow traders to tag their emotional state at key moments — pre-trade, during trade, and post-trade.

**Implementation**:

**Quick Tag UI** (low friction is critical — traders won't fill out forms):

- Before entry: 1-tap emotion selector (Confident / Neutral / Anxious / FOMO / Revenge)
- During trade: optional mid-trade check-in ("How are you feeling about this trade?")
- After close: 1-tap exit emotion (Satisfied / Regretful / Relieved / Frustrated)
- Each tag is a single tap/click — maximum 2 seconds of friction

**Schema**:

```
trade_emotion
  - id, tradeId, accountId, userId
  - stage: 'pre_entry' | 'during' | 'post_exit'
  - emotion: string (from predefined list)
  - intensity: 1-5 (optional, defaults to 3)
  - note: text (optional free-text)
  - createdAt
```

**Predefined emotions** (extensible):

- Pre-entry: confident, neutral, anxious, fomo, revenge, bored, excited, hesitant
- During: calm, stressed, greedy, fearful, impatient, focused
- Post-exit: satisfied, regretful, relieved, frustrated, indifferent, proud

### 2.2 Tiltmeter — Emotion-to-P&L Correlation

**What**: Quantify how each emotional state correlates with trading outcomes.

**Analysis engine** (new file: `apps/server/src/lib/ai/engine/psychology-engine.ts`):

- Group trades by pre-entry emotion → compute win rate, avg profit, avg hold time per emotion
- Group by during-trade emotion → same metrics
- Cross-tabulate: emotion + session, emotion + symbol, emotion + time-of-day
- Tilt Score: 0-100 composite based on how well the trader's recent emotional patterns correlate with positive outcomes
- Tilt Detection: automated — if the last 3 trades all have "revenge" or "fomo" tags, trigger an alert

**Visualization**:

- Tiltmeter widget on dashboard — green (disciplined) to red (tilting) gauge
- Emotion heatmap: rows = emotions, columns = win/loss, cell intensity = trade count
- P&L by emotion bar chart: see which emotional states are profitable vs. destructive
- Trend line: tilt score over time — are you becoming more disciplined?

**AI Integration**:

- Profile includes psychology summary: "When you trade feeling confident, you win 72% of the time. When you trade on FOMO, you win 23%."
- Proactive alerts: "Your last 3 trades were tagged 'anxious' — consider taking a break"
- Daily digest includes emotion summary: "Yesterday, 4/6 trades were entered with confidence — your best emotional state"

### 2.3 Journaling with AI Analysis

**What**: Structured journaling with AI that reads entries and identifies psychological patterns.

**Current state**: `apps/web/src/components/journal/` exists but is disconnected from the AI engine.

**Enhancement**:

- After each journal entry, AI analyzes for: cognitive biases (confirmation bias, sunk cost, anchoring), emotional patterns, self-contradictions ("you said you'd stop trading after 3 losses but took 5 more trades")
- Weekly psychology report: common themes, emotional triggers, bias frequency
- AI identifies correlations between journal content and trade outcomes: "On days when you write about feeling 'rushed', your win rate drops 15%"

**Implementation**:

- New function: `analyzeJournalEntry(text, recentTrades)` in psychology-engine.ts
- Uses Gemini to extract: sentiment, detected biases, emotional state, commitment statements
- Cross-references with trade data from the same time period
- Stores analysis in `journal_analysis` table linked to the journal entry

### 2.4 Mental Performance Score

**What**: A composite score (0-100) that tracks the trader's mental/psychological fitness over time.

**Components**:

- Discipline Score (30%): How closely do actual trades follow stated rules/plan?
- Emotion Score (25%): How often are trades taken in optimal emotional states?
- Consistency Score (20%): Variance in daily trade count, position sizing, session distribution
- Recovery Score (15%): How well does the trader recover from losses? (Time between loss and next trade, outcome of post-loss trades)
- Self-Awareness Score (10%): How accurately does the trader predict their own performance? (Track self-assessments vs. actual outcomes)

**Visualization**: Mental Performance dashboard card with trend sparkline, breakdown into components, and comparison to the trader's own 30-day average.

---

## 3. AI-Powered Trade Notes & Market Context

**Priority**: P1 — Significant value-add, differentiator vs. most competitors
**Benchmark**: TradesViz AI Trade Summary (trade data + market data combined)

### 3.1 Auto-Generated Trade Notes

**What**: For every closed trade, automatically generate a contextual note that combines trade data with market conditions.

**Contents**:

- **Market Context**: What was the broader market doing? (Trend direction, volatility regime, any major news/events near the trade time)
- **Technical Context**: Price action at entry (near S/R? breakout? pullback?), candlestick patterns, trend alignment
- **Trade Evaluation**: Entry quality (near high/low of the move?), exit quality (captured what % of the available move?), risk management adherence
- **Comparison to Profile**: "This was a typical London scalp matching your best setup — 12min hold, 2.1 RR, EURUSD"

**Data Sources**:

- Existing trade data (prices, times, profit)
- New: integrate with a market data API for historical OHLCV candles around trade time
- New: economic calendar data (were there high-impact events within ±30 min of the trade?)

**Implementation**:

- New file: `apps/server/src/lib/ai/engine/trade-narrator.ts`
- Fetches: 1h and 15m candles around trade entry/exit from market data provider
- Fetches: economic events from calendar API within ±1 hour of trade
- Sends combined context to Gemini with structured prompt → generates 3-5 sentence narrative
- Persists as `autoNote` field on the trade record
- Lazy generation: computed on first view of the trade detail, then cached

**Schema addition** (on existing `trade` table):

```
ALTER TABLE trade ADD COLUMN auto_note text;
ALTER TABLE trade ADD COLUMN auto_note_generated_at timestamp;
ALTER TABLE trade ADD COLUMN market_context jsonb;
```

### 3.2 Economic Calendar Integration

**What**: Overlay economic events on the trade timeline to help traders understand how news impacts their performance.

**Features**:

- Calendar widget showing high/medium/low impact events
- Automatic tagging: trades taken within ±15min of high-impact news get tagged `near_news`
- Profile analysis: "Your win rate drops 20% when trading during NFP releases"
- AI awareness: when answering questions, the AI knows about nearby economic events

**Implementation**:

- Already have `apps/web/src/components/dashboard/calendar/economic-calendar.tsx` — enhance with trade overlay
- Server: periodic fetch of economic calendar data (forexfactory-style API)
- New derived field in query engine: `nearHighImpactNews: boolean`

### 3.3 AI Auto-Tagging

**What**: Automatically classify trades based on detected technical setup patterns.

**Tags to auto-detect**:

- **Setup type**: breakout, pullback, reversal, range-bound, momentum, mean-reversion
- **Market condition**: trending, ranging, volatile, quiet
- **Entry quality**: early, on-time, late, chasing
- **Exit quality**: target-hit, stopped-out, manual-early, manual-late, trailed
- **Session context**: pre-market, market-open, mid-session, market-close, overnight

**Implementation**:

- New file: `apps/server/src/lib/ai/engine/auto-tagger.ts`
- Uses price action around entry/exit (candle patterns, trend, S/R proximity)
- Rule-based first pass (faster, no LLM needed for basic classification)
- LLM enhancement for ambiguous cases (optional, calls Gemini with candlestick data)
- Tags stored in new `auto_tags` jsonb column on trade table
- Queryable through the existing NL query engine ("show me all breakout trades")

---

## 4. Pre-Trade Planning & Discipline System

**Priority**: P1 — Critical for closing the loop between analysis and action
**Benchmark**: TraderSync plan deviation tracking, Edgewonk checklist system

### 4.1 Trading Rules Engine

**What**: Let traders define their trading rules, and track adherence automatically.

**Rule types**:

- **Session rules**: "Only trade London and New York sessions"
- **Symbol rules**: "Only trade EURUSD, GBPUSD, US100"
- **Risk rules**: "Max 2% risk per trade", "Max 3 trades per day", "Stop after 2 consecutive losses"
- **Timing rules**: "No trades within 15min of high-impact news", "No trades after 4pm"
- **Setup rules**: "Only take trades with minimum 2:1 RR", "Only aligned protocol trades"

**Implementation**:

- Schema: `trading_rule` table (id, accountId, userId, category, ruleType, parameters jsonb, isActive, createdAt)
- Engine: `apps/server/src/lib/ai/engine/rules-engine.ts`
  - `evaluateTradeAgainstRules(trade, rules)` → returns compliance report
  - `getDailyRuleStatus(accountId, date)` → have any rules been violated today?
- Webhook integration: on trade open, evaluate against rules and generate alerts for violations
- Dashboard: rule compliance score and violation history

### 4.2 Pre-Trade Checklist

**What**: Customizable checklist that must be mentally completed before entering a trade.

**Features**:

- Define checklist items per strategy/setup (e.g., "Trend confirmed on higher timeframe", "RR minimum 2:1", "No high-impact news in next 30 min")
- Quick-fill UI: tap to check items before entry
- Track which checklist items correlate with winning vs. losing trades
- AI analysis: "Trades where you skip item #3 (trend confirmation) have a 25% lower win rate"

**Schema**:

```
trade_checklist_template
  - id, accountId, userId
  - name, items (jsonb array of { label, isRequired })
  - strategyTag (links to model tags)
  - createdAt

trade_checklist_result
  - id, tradeId, templateId
  - completedItems (jsonb array of { itemIndex, checked, timestamp })
  - completionRate (decimal)
  - createdAt
```

### 4.3 AI-Suggested Rules

**What**: Based on profile analysis, the AI suggests rules the trader should adopt.

**Examples**:

- "Your data shows you lose 80% of trades after 3pm. Consider adding a rule: no trades after 3pm."
- "When you take more than 4 trades per day, your average profit drops 65%. Consider a 4-trade daily limit."
- "Your GBPJPY trades have a -$12.50 expectancy. Consider removing it from your watchlist."

**Implementation**:

- Part of the insight engine — new insight category `rule_suggestion`
- Generated during scheduled insight runs
- Presented as actionable cards with a "Create Rule" button that auto-populates the rules engine

---

## 5. Advanced Risk Intelligence

**Priority**: P1 — Differentiator vs. basic journals
**Benchmark**: TradesViz Monte Carlo, Tradervue risk-of-ruin

### 5.1 Monte Carlo Simulation

**What**: Project future performance ranges based on historical trade distribution.

**Features**:

- Run 10,000 simulated trading sequences using the trader's actual trade distribution
- Show: expected equity curve (median), best case (95th percentile), worst case (5th percentile)
- Calculate: probability of reaching target account size, probability of drawdown exceeding X%, expected time to double account
- Filter simulations by strategy, session, symbol to compare scenarios ("What if I only traded my edge conditions?")

**Implementation**:

- New file: `apps/server/src/lib/ai/engine/risk-simulator.ts`
- Input: array of historical trade returns (or filtered subset)
- Output: `SimulationResult` with percentile curves, probabilities, statistics
- Frontend: area chart with confidence bands (5th/25th/50th/75th/95th percentiles)
- tRPC endpoint: `ai.runSimulation({ accountId, filters?, numSimulations? })`

### 5.2 Risk-of-Ruin Calculator

**What**: Based on the trader's actual statistics, calculate the probability of blowing the account.

**Inputs** (auto-populated from profile):

- Win rate
- Average win / average loss ratio
- Risk per trade (% of account)
- Ruin threshold (e.g., 50% drawdown)

**Output**:

- Probability of ruin (%)
- Expected number of trades before ruin (if applicable)
- "Safe" risk-per-trade recommendation
- Comparison: current risk vs. Kelly criterion optimal

### 5.3 Drawdown Intelligence

**What**: Go beyond simple max drawdown — understand drawdown dynamics.

**Features**:

- Drawdown waterfall chart: visualize every drawdown period (start, depth, recovery time)
- Drawdown triggers: AI identifies what causes drawdowns (specific sessions, symbols, emotional states, time-of-week)
- Recovery analysis: how long do recoveries take? Are they getting longer or shorter?
- Drawdown prediction: "Based on your current trajectory, there's a 35% chance of hitting 10% drawdown in the next 20 trades"

**Implementation**:

- Extend `trader-profile.ts` with `DrawdownProfile` containing: maxDrawdown, avgDrawdown, avgRecoveryTrades, drawdownFrequency, currentDrawdownDepth
- AI integration: drawdown context in profile → answers about risk ("Am I at risk of blowing my account?")

### 5.4 Position Sizing Optimizer

**What**: AI-recommended position sizes based on the trader's actual performance statistics.

**Methods**:

- Fixed fractional (simple)
- Kelly criterion (mathematically optimal but aggressive)
- Half-Kelly (practical)
- Anti-martingale (increase after wins)
- Setup-specific: different sizing for high-confidence edge conditions vs. exploratory trades

**Output**: "Based on your 58% win rate and 1.8 avg RR, Kelly criterion suggests risking 12.4% per trade. Half-Kelly (6.2%) is recommended for psychological comfort. Your current average risk is 2.1% — conservative but safe."

---

## 6. Conversation & Query Improvements

**Priority**: P1 — Improves daily usage quality
**Benchmark**: TradesViz multi-system AI, TraderSync Cypher proactivity

### 6.1 Long-Term Memory

**What**: The AI should remember the trader's preferences, goals, and past conversations across sessions.

**Current state**: Conversation context is limited to last 6 messages within a single chat.

**Enhancement**:

- Store extracted "facts" from conversations in a `trader_memory` table
- Examples: "User prefers to see data in pips, not dollars", "User's goal is to reach 60% win rate by April", "User is working on reducing revenge trading"
- At query time, inject relevant memories into the system prompt
- User can view, edit, and delete stored memories (transparency)

**Schema**:

```
trader_memory
  - id, userId
  - category: 'preference' | 'goal' | 'context' | 'instruction'
  - content (text)
  - source: 'extracted' | 'user_stated'
  - confidence (decimal)
  - lastReferencedAt
  - createdAt, updatedAt
```

**Implementation**:

- After each conversation, extract facts using Gemini: "Extract any preferences, goals, or important context from this conversation"
- Deduplicate against existing memories
- At query time: retrieve top 5 most relevant memories (by category match + recency)

### 6.2 Multi-Turn Reasoning Improvements

**What**: Better handling of follow-up questions and comparative queries.

**Current state**: Conversation history is passed but the plan generator doesn't deeply reason about context.

**Enhancement**:

- Explicit reference resolution: "those trades" → resolve to the previous query's result set
- Comparative follow-ups: "How does that compare to last month?" → auto-add timeframe comparison
- Drill-down support: "Why?" after a stat → trigger diagnostic intent with the same filters
- "What if" scenarios: "What if I removed my worst symbol?" → re-run analysis with exclusion filter

**Implementation**:

- Enhance `query-normalization.ts` with reference resolution
- New plan type in `query-plan.ts`: `followup` — includes reference to previous plan + modification
- Plan generator system prompt enhancement to handle conversational patterns

### 6.3 Voice Input

**What**: Allow traders to speak their questions instead of typing.

**Why**: Traders are often watching charts and can't type. Voice is faster for complex questions.

**Implementation**:

- Web Speech API (browser-native, no backend needed for transcription)
- Mic button in assistant chat input and command palette
- Transcribed text feeds directly into existing query pipeline
- Optional: voice response (text-to-speech for the answer) — use browser TTS

### 6.4 Proactive Question Suggestions

**What**: After answering a query, suggest 2-3 relevant follow-up questions the trader might want to ask.

**Current state**: No follow-up suggestions.

**Enhancement**:

- Based on the query type and results, generate contextual follow-ups
- Example: After "What's my win rate by session?" → suggest "Which session is most profitable?", "Show me my worst London trades", "How has my London win rate changed over time?"
- Personalized to the trader's profile — suggest questions about their weakest areas

**Implementation**:

- Add `suggestedFollowups: string[]` to the answer assembler output
- Gemini generates 2-3 follow-ups based on the query + result + profile
- Frontend renders as clickable pills below the answer

### 6.5 Smarter Onboarding for New Traders

**What**: Traders with fewer than 30 trades get a degraded experience. Fix this.

**Current state**: Guardrail blocks analysis under 3 trades, warns under 30.

**Enhancement**:

- 0-3 trades: Welcome flow, explain what the AI will do once they have data, set up rules/checklist
- 3-10 trades: Basic observations, "Here's what we see so far — trade more for deeper insights"
- 10-30 trades: Preliminary profile with caveats, initial edge/leak hypotheses
- 30+ trades: Full engine engagement
- At each milestone (10, 25, 50, 100, 250, 500 trades), generate a "Milestone Report" celebrating progress and providing increasingly detailed analysis

---

## 7. Visualization & Reporting Upgrades

**Priority**: P2 — Quality of life and presentation improvements
**Benchmark**: TradesViz 400+ visualizations, TraderSync trade replay

### 7.1 Interactive Equity Curve with AI Annotations

**What**: Equity curve that's annotated with AI insights at key inflection points.

**Features**:

- Plot cumulative P&L over time
- AI identifies inflection points: drawdown starts, recovery points, strategy changes, milestone trades
- Click on any annotation to see what happened: "This drawdown started after you switched to trading GBPJPY during Asian session — a leak condition"
- Overlay toggles: filter by session, symbol, strategy to see contribution to the equity curve

### 7.2 AI-Generated Performance Reports

**What**: Publishable performance reports with narrative analysis.

**Report types**:

- **Daily Report**: Today's trades, P&L, emotions, rule compliance, AI observations
- **Weekly Report**: 7-day summary with trends, improvements, concerns, focus areas
- **Monthly Report**: Full month analysis with comparison to previous months, goal progress, equity curve, top/bottom trades, behavioral patterns
- **Custom Period Report**: Any date range with full analysis

**Format**: PDF-exportable with charts, tables, and narrative text.

**Implementation**:

- New file: `apps/server/src/lib/ai/engine/report-generator.ts`
- Pulls from profile, insights, trades, emotions, rules compliance
- Gemini generates narrative sections (intro, analysis, recommendations, conclusion)
- Frontend: `apps/web/src/components/ai/performance-report.tsx`
- Existing `use-pdf-export.ts` handles PDF generation

### 7.3 Comparison Views

**What**: Side-by-side comparisons across any dimension.

**Examples**:

- This week vs. last week
- This month vs. previous month
- Strategy A vs. Strategy B
- Pre-rule adoption vs. post-rule adoption
- Winning trades vs. losing trades (deep attribute comparison)

**Implementation**:

- Enhance the compare intent in `query-executor.ts` to support more complex comparisons
- New comparison visualization: dual-panel layout with matching metrics
- AI narrative: "Your London session improved by 12% this month compared to last month. The main driver is..."

### 7.4 Dashboard Widget Customization

**What**: Let the AI suggest and auto-create dashboard widgets based on the trader's profile.

**Current state**: Fixed widget set on dashboard.

**Enhancement**:

- "Set up my dashboard" → AI analyzes profile and creates a personalized widget layout
- Suggestions: "Based on your trading style, I recommend: Tiltmeter, London Session Win Rate trend, EURUSD daily P&L, Current streak counter, RR distribution"
- Drag-and-drop widget reordering (existing)
- AI-powered "Widget of the Day": highlights the most relevant metric for today's context

### 7.5 Trade Replay Integration

**What**: Allow traders to replay trades with price action and AI commentary.

**Features**:

- Replay trade at configurable speed (1x, 2x, 5x, 10x)
- AI narrates: "Entry was placed here — near the session high. Price moved against you by 15 pips (your average MAE). At this point, 60% of your historical trades in this scenario recovered."
- Overlay trader's profile stats at key moments during replay
- Requires: historical candlestick data for the trade's time period

**Implementation**:

- Market data integration (same as trade notes — fetch candles around trade time)
- Frontend: `apps/web/src/components/ai/trade-replay.tsx` using canvas/SVG rendering
- Playback controls with step-forward/backward
- This is a larger feature — consider phasing

---

## Appendix A: Competitive Landscape

| Platform                      | NL Query | Proactive Coach    | Psychology | Auto-Notes | Risk Sim     | Trade Replay | Auto-Tag |
| ----------------------------- | -------- | ------------------ | ---------- | ---------- | ------------ | ------------ | -------- |
| **ProfitablEdge (current)**   | Yes      | Partial (insights) | No         | No         | No           | No           | No       |
| **ProfitablEdge (after PRD)** | Yes+     | Yes                | Yes        | Yes        | Yes          | Yes          | Yes      |
| TradeZella                    | No       | Alerts only        | Basic      | No         | No           | Yes (tick)   | No       |
| Tradervue                     | No       | No                 | No         | No         | Risk of ruin | No           | No       |
| Edgewonk                      | No       | No                 | Yes (best) | No         | No           | No           | No       |
| TradesViz                     | Yes      | Daily summary      | No         | Yes (best) | Monte Carlo  | No           | No       |
| TraderSync                    | No       | Yes (Cypher)       | Basic      | Yes        | No           | Yes (250ms)  | No       |
| TradeFuse                     | Yes      | No                 | No         | No         | Projections  | No           | No       |
| M1NDTR8DE                     | No       | Yes (coaching)     | Yes        | No         | No           | No           | No       |

**Key insight**: No single competitor covers all pillars. ProfitablEdge can be the first to integrate all of them into a unified, AI-native experience.

---

## Appendix B: Technical Architecture

### New Files (Server)

```
apps/server/src/lib/ai/engine/
├── digest-generator.ts        # P0: Daily briefing generation
├── psychology-engine.ts       # P0: Emotion analysis, tilt detection
├── session-tracker.ts         # P0: Real-time session coaching
├── trade-narrator.ts          # P1: AI auto-notes with market context
├── auto-tagger.ts             # P1: Automatic trade classification
├── rules-engine.ts            # P1: Trading rules evaluation
├── risk-simulator.ts          # P1: Monte Carlo + risk calculations
├── report-generator.ts        # P2: Performance report generation
└── memory-manager.ts          # P1: Long-term conversation memory
```

### New Files (Frontend)

```
apps/web/src/components/
├── ai/
│   ├── trade-feedback-card.tsx    # P0: Post-trade evaluation card
│   ├── performance-report.tsx     # P2: Report viewer/export
│   └── trade-replay.tsx           # P2: Trade replay player
├── dashboard/
│   ├── tiltmeter-widget.tsx       # P0: Psychology gauge
│   ├── emotion-tagger.tsx         # P0: Quick emotion tagging UI
│   ├── daily-briefing.tsx         # P0: Morning digest card
│   ├── rule-compliance.tsx        # P1: Rule status widget
│   └── risk-dashboard.tsx         # P1: Monte Carlo + risk metrics
└── journal/
    └── ai-journal-analysis.tsx    # P0: AI-analyzed journal entries
```

### New Database Tables

| Table                      | Priority | Purpose                            |
| -------------------------- | -------- | ---------------------------------- |
| `trade_emotion`            | P0       | Emotion tags per trade per stage   |
| `trader_digest`            | P0       | Daily/weekly briefings             |
| `recommendation_log`       | P0       | Track recommendation effectiveness |
| `trader_memory`            | P1       | Long-term AI memory                |
| `trading_rule`             | P1       | User-defined trading rules         |
| `trade_checklist_template` | P1       | Checklist definitions              |
| `trade_checklist_result`   | P1       | Per-trade checklist completions    |
| `journal_analysis`         | P1       | AI analysis of journal entries     |

### Modified Files

| File                        | Changes                                                                     |
| --------------------------- | --------------------------------------------------------------------------- |
| `streaming-orchestrator.ts` | New event types (digest, feedback, coaching), memory injection              |
| `plan-generator.ts`         | Memory context, psychology context, rule context in system prompt           |
| `answer-assembler.ts`       | Emotion correlations, rule compliance, follow-up suggestions                |
| `insight-engine.ts`         | Psychology insights, rule violation insights, milestone insights            |
| `trader-profile.ts`         | Drawdown profile, psychology summary, rule compliance score                 |
| `engine/types.ts`           | New interfaces for all new data structures                                  |
| `routers/ai.ts`             | New endpoints for all new features                                          |
| `routers/webhook.ts`        | Post-trade feedback trigger, rule evaluation trigger                        |
| `widget-block-renderer.tsx` | New viz types (tiltmeter, emotion heatmap, Monte Carlo, equity annotations) |
| `premium-assistant.tsx`     | Follow-up suggestions, voice input, memory management                       |
| `command-palette.tsx`       | Voice input, richer quick-query cards                                       |
| `app-sidebar.tsx`           | Briefing badge, rule violation badge                                        |

---

## Appendix C: Phased Roadmap

### Phase 1: Proactive Coach + Psychology Foundation (P0)

**Estimated scope**: ~15 new/modified files

1. Emotion tagging system (schema + UI + storage)
2. Post-trade instant feedback (enhance insight engine + new frontend card)
3. Tiltmeter widget (psychology engine + dashboard widget)
4. Daily briefing (digest generator + notification delivery)
5. Session coaching (session tracker + real-time alerts)
6. Adaptive recommendations (recommendation log + feedback loop)

**Success metrics**:

- Traders tag emotions on >50% of trades within first week
- Insight engagement rate (read/dismiss) >60%
- Post-trade feedback card viewed on >80% of closed trades

### Phase 2: Intelligence & Discipline (P1)

**Estimated scope**: ~12 new/modified files

1. Trading rules engine (rules CRUD + evaluation + alerts)
2. Pre-trade checklist (templates + per-trade tracking + correlation analysis)
3. AI-suggested rules (from profile + insights)
4. Auto-generated trade notes (market data integration + Gemini narration)
5. AI auto-tagging (rule-based + LLM enhancement)
6. Monte Carlo simulation (risk simulator + frontend chart)
7. Risk-of-ruin + position sizing optimizer
8. Long-term memory (memory manager + conversation injection)
9. Multi-turn reasoning improvements
10. Follow-up question suggestions
11. Smarter onboarding for new traders

**Success metrics**:

- Rule compliance tracking active on >40% of accounts
- Auto-notes generated for >90% of closed trades
- Monte Carlo simulation used at least once by >30% of active users

### Phase 3: Presentation & Polish (P2)

**Estimated scope**: ~8 new/modified files

1. AI-annotated equity curve
2. Performance reports (daily/weekly/monthly/custom + PDF)
3. Enhanced comparison views
4. AI-suggested dashboard widgets
5. Trade replay with AI commentary
6. Voice input
7. Economic calendar integration with trade overlay

**Success metrics**:

- > 20% of users export weekly/monthly reports
- Trade replay sessions average >2 minutes (engagement)
- Voice input used by >15% of mobile/tablet users

---

## Open Questions

1. **Market data provider**: Which API for historical OHLCV data? (Polygon, Alpha Vantage, Twelve Data, or the existing Dukascopy integration?)
2. **Economic calendar source**: ForexFactory scraping vs. paid API (Investing.com, FXStreet)?
3. **LLM cost management**: Auto-notes + auto-tags + digests could significantly increase Gemini API calls. Should we batch-process or use a local model for simpler tasks?
4. **Mobile experience**: Emotion tagging needs to be extremely low-friction on mobile. Should we build a dedicated mobile flow?
5. **Wearable integration**: Should we explore HRV/stress data from Apple Watch/Oura? No competitor does this — massive differentiator but complex.
6. **Multi-account intelligence**: Should the AI learn across accounts (e.g., demo vs. live comparison, aggregate edge detection)?
7. **Social/Community**: Should AI insights be shareable? Anonymized leaderboards by AI-detected trading style?

---

_This PRD represents a comprehensive evolution from "AI analytics tool" to "AI trading coach". The goal is clear: every feature exists to help the trader reach profitability by understanding their data, controlling their psychology, following their rules, and amplifying their edge._
