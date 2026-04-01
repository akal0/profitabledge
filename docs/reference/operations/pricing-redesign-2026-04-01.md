# Profitabledge Pricing Redesign - 2026-04-01

Last updated: 2026-04-01

## Executive call

- Keep three core self-serve tiers, but rename and reprice them.
- Recommended public plans: `Explorer` `$0`, `Trader` `$24/mo` or `$19/mo annual`, `Elite` `$49/mo` or `$39/mo annual`.
- Keep the free tier generous on journaling and core review. Charge for live sync, advanced analytics, exports, prop tracking, and AI depth.
- Make annual the default view. Offer `7-day` Stripe trials on paid plans. Use the free tier as the no-card habit builder.
- Add a sales-led partner path for prop firms, mentors, and education, but do not clutter the core pricing page with an enterprise-first motion.

## Why this wins

- Profitabledge's current `$29 / $59` ladder sits at the high end of consumer trading journals for a product that still needs more top-of-funnel volume.
- Competitors with the healthiest self-serve conversion patterns usually do one of three things well:
  - strong free habit loop: TradesViz, TradingView, Notion, Supabase
  - clear mid-tier anchor: TraderSync, TradeZella, Tradervue
  - simple premium upsell for heavy users: Chartlog, Journalytix, Edgewonk
- A lower first paid step improves conversion without creating a four-tier maze.

## 1. Competitive Research Report

### 1.1 Competitor summary

| Competitor | Model | Free Tier | Cheapest Paid | Most Expensive | Annual Discount | Trial | Standout Gating |
|---|---|---:|---:|---:|---:|---|---|
| TradeZella | subscription | No public free tier | $29/mo | $49/mo | ~17% to ~32% | none shown | accounts, storage, playbooks, mentor invites, session replay |
| Kinfo | freemium | Yes | public price not shown | public price not shown | n/a | 14 days | advanced reports, CSV export, full history, spread detection, Excel |
| Edgewonk | subscription by term | No | $197/yr | $297/2yr | ~25% better on 2-year | no trial, 14-day refund | same feature set, only billing term changes |
| TradesViz | freemium | Yes | $19.99/mo | $29.99/mo | 25% | 7 days | executions/month, accounts, multi-asset, simulators, AI, advanced exit analysis |
| Tradervue | freemium + paid | hidden on live page | $29.95/mo | $49.95/mo | none shown | 7 days | exit analysis, commissions, advanced filters, risk/liquidity reports |
| Trademetria | freemium | Yes | $19.95/mo | $29.95/mo | 30% | no card, feature-limited free | orders/month, account count, open positions |
| Stonk Journal | free today | Yes | n/a | n/a | n/a | n/a | currently free; monetization not yet public |
| TradeInsights | freemium + beta premium | Yes | beta premium still free | beta premium still free | n/a | beta access | AI patterning, catalyst analysis, watchlists |
| Chartlog | subscription | No public free tier | $14.99/mo | $39.99/mo | 10% to 20% | trial length not shown | strategy tracking, basic vs advanced insights, custom reports |
| Myfxbook | free / ad-supported | Yes | no public paid tier found | no public paid tier found | n/a | n/a | monetizes attention, broker ecosystem, community trust |
| Forex Factory | free / ad-supported | Yes | free | free | n/a | n/a | forum journals + Trade Explorer are free |
| TradingView | freemium | Yes | localized, about $13-$15/mo monthly-equivalent at entry | Ultimate | ~13% to ~17% official | 30 days on most plans | alerts, chart count, indicator count, history depth, professional-only Ultimate |
| Journalytix | subscription + enterprise | No public free tier | $47/mo | enterprise custom | ~29% | free trial, length not stated | group analytics, leaderboard, prop/desk workflow |
| TraderSync | subscription | No public free tier | $29.95/mo | $79.95/mo | up to 50% | 7 days | accounts, replay precision, AI message caps, coach tools |
| Bloomberg Terminal | enterprise / custom | No | custom | custom | n/a | demo | sales-led, workflow breadth, network effects |
| LSEG Workspace / Refinitiv successor | enterprise / gated pricing | gated trial | login required | login required | n/a | trial | role-based premium data, analytics, integrations |

### 1.2 Detailed notes by competitor

#### TradeZella

- URL: `https://www.tradezella.com/pricing`
- Business model: subscription
- Last verified: 2026-04-01
- Public pricing:
  - `Basic` `$29/mo`
  - `Premium` `$49/mo`
  - `Essential` `$288/yr` (`$24/mo` effective)
  - `Pro` `$399/yr` (`$33.25/mo` effective)
- Public gating:
  - lower plan: `1 account`, `1 GB storage`, `3 playbooks`, `5 mentor invites`
  - higher plan: unlimited accounts, `5 GB storage`, unlimited playbooks, unlimited mentor invites, `Sessions Trade Replay`
- Pricing sentiment:
  - praise: worth it for serious traders, polished UI, journaling discipline
  - complaints: upper tier still feels expensive if you do not use mentoring or replay depth
- Tactics:
  - partner program with `20%` to `30%` commissions and some lifetime commission terms
- Sources:
  - `https://www.tradezella.com/pricing`
  - `https://www.tradezella.com/partners`
  - `https://www.trustpilot.com/review/tradezella.com`

#### Kinfo

- URL: `https://kinfo.com/kinfo-pro/`
- Business model: freemium social journal
- Last verified: 2026-04-01
- Public pricing visibility:
  - free signup confirmed
  - `PRO` and `PRO+` features are public
  - exact public prices were not visible on accessible official pages
- Public gating:
  - `PRO`: priority sync, advanced reports, CSV export, notes, screenshots, tags, custom periods, full history, sharing options
  - `PRO+`: spread detection, hidden trades, Excel integration
- Trial: `14 days free trial`
- Pricing sentiment:
  - praise: community/social angle and free value
  - complaint: weak pricing transparency
- Sources:
  - `https://kinfo.com/`
  - `https://kinfo.com/kinfo-pro/`
  - `https://kinfo.com/t4ac/`

#### Edgewonk

- URL: `https://edgewonk.com/pricing`
- Business model: subscription by term, same feature set
- Last verified: 2026-04-01
- Public pricing:
  - `12 months` `$197`
  - `24 months` `$297`
- Gating strategy: not feature-gated; only billing duration changes
- Badges: `Most popular` on `12 months`, `Best value` on `24 months`
- Trial/refund: no trial shown, `14-day money-back guarantee`
- Pricing sentiment:
  - praise: strong value, simple offer
  - complaint: annual upfront payment is a blocker
- Sources:
  - `https://edgewonk.com/pricing`
  - `https://www.trustpilot.com/review/edgewonk.com`

#### TradesViz

- URL: `https://www.tradesviz.com/pricing/`
- Business model: freemium subscription
- Last verified: 2026-04-01
- Public pricing:
  - `Basic` `$0`
  - `Pro` `$19.99/mo` or `$179/yr` (`$14.99/mo`)
  - `Platinum` `$29.99/mo` or about `$269.88/yr` (`$22.49/mo`)
- Trial: `7 day free trial` on paid tiers
- Badge: `Best Value` on `Pro`
- Public gating:
  - free: `3000 executions/month`, `1 account`, stock-only orientation
  - pro: unlimited imports, `10 accounts`, broader analytics
  - platinum: simulators, AI chat/Q&A, options flow, advanced exit analysis, backtesting and screener tooling
- Pricing sentiment:
  - praise: strongest value-per-dollar in the category
  - complaint: setup complexity and occasional data/billing frustration
- Sources:
  - `https://www.tradesviz.com/pricing/`
  - `https://www.trustpilot.com/review/www.tradesviz.com`

#### Tradervue

- URL: `https://www.tradervue.com/site/pricing/`
- Business model: freemium + paid monthly plans
- Last verified: 2026-04-01
- Public pricing:
  - `Silver` `$29.95/mo`
  - `Gold` `$49.95/mo`
- Trial: `7-day free trial`
- Badge: `Gold` marked `Most popular`
- Public gating:
  - paid plans already include unlimited imports/accounts/mentors and broker sync
  - `Gold` adds exit analysis, commissions, liquidity, risk reports, advanced filters, base currency choice, chart studies, shared trade P&L options
- Historical pricing evolution:
  - 2021 Wayback: free tier with `100 trades/month`
  - 2023 Wayback: free tier with `30 trades/month`
  - current live page: free tier still referenced, but limits are not exposed on-page
- Pricing sentiment:
  - praise: deep review workflow is worth it for active traders
  - complaint: expensive relative to newer alternatives like TradesViz
- Sources:
  - `https://www.tradervue.com/site/pricing/`
  - `https://web.archive.org/web/20210725195656/https://www.tradervue.com/site/pricing/`
  - `https://web.archive.org/web/20231109085922/https://www.tradervue.com/site/pricing/`

#### Trademetria

- URL: `https://trademetria.com/pricing`
- Business model: freemium subscription
- Last verified: 2026-04-01
- Public pricing:
  - `Free` `$0`
  - `Basic` `$19.95/mo` or `$169/yr`
  - `Pro` `$29.95/mo` or `$249/yr`
- Annual discount: `30%`
- Public gating:
  - free: `30 orders/month`, `1 account`, `3 open positions`
  - basic: `500 orders/month`, `1 account`, `200 open positions`
  - pro: unlimited imports, `50 accounts`, unlimited open positions
- Pricing sentiment:
  - praise: inexpensive, practical, strong support
  - complaint: sync reliability and regional affordability complaints
- Sources:
  - `https://trademetria.com/pricing`
  - `https://www.trustpilot.com/review/trademetria.com`

#### Stonk Journal

- URL: `https://stonkjournal.com/`
- Business model: free today
- Last verified: 2026-04-01
- Public pricing: no paid plans published
- Positioning: free, no ads, no data monetization on homepage; future features may not all remain free
- Pricing sentiment:
  - praise: free value and simple UI
  - complaint: manual-entry burden, occasional math/stat errors
- Sources:
  - `https://stonkjournal.com/`
  - `https://www.trustpilot.com/review/stonkjournal.com`

#### TradeInsights

- URL: `https://tradeinsights.net/pricing`
- Business model: freemium + beta premium
- Last verified: 2026-04-01
- Public pricing:
  - `Free` `$0 forever`
  - `Catalyst` public recurring price not shown, currently `Free during Beta`
- Public gating:
  - free includes unlimited trades, analytics, journal, import support, community visibility
  - catalyst adds AI and catalyst-specific pattern tooling
- Pricing sentiment: public market feedback still thin
- Sources:
  - `https://tradeinsights.net/pricing`

#### Chartlog

- URL: `https://www.chartlog.com/pricing/`
- Business model: subscription
- Last verified: 2026-04-01
- Public pricing:
  - `Lite` `$14.99/mo` or `$13.49/mo` yearly
  - `Standard` `$29.99/mo` or `$25.49/mo` yearly
  - `Pro` `$39.99/mo` or `$31.99/mo` yearly
- Annual discounts: `10%`, `15%`, `20%`
- Badge: `Standard` marked `Most Popular`
- Public gating:
  - lite: unlimited trades, journal, charting
  - standard: strategy tracking and basic insights
  - pro: advanced insights and custom reports
- Pricing sentiment:
  - praise: chart review and clean visual workflow
  - complaint: updates/support pace and some CSV frustrations
- Sources:
  - `https://www.chartlog.com/pricing/`

#### Myfxbook

- URL: `https://www.myfxbook.com/`
- Business model: free/ad-supported/community-led
- Last verified: 2026-04-01
- Public pricing: no public paid tiers found on accessible official pages
- Monetization likely comes from ads, broker ecosystem, and traffic
- Pricing sentiment: discussion focuses on trust and fake-result concerns more than price
- Sources:
  - `https://www.myfxbook.com/`

#### Forex Factory

- URL: `https://www.forexfactory.com/products`
- Business model: free/ad-supported/community ecosystem
- Last verified: 2026-04-01
- Journal features:
  - public `Trading Journals` forum
  - free `Trade Explorer`
- Public pricing: no paid journal subscription found
- Sources:
  - `https://www.forexfactory.com/products`
  - `https://www.forexfactory.com/tradeexplorer`

#### TradingView

- URL: `https://www.tradingview.com/pricing/`
- Business model: freemium subscription + market-data add-ons
- Last verified: 2026-04-01
- Public pricing observed on official page in localized GBP:
  - `Basic` free
  - `Essential` `12.95/mo` billed annually
  - `Plus` `29.95/mo` billed annually
  - `Premium` `59.95/mo` billed annually
  - `Ultimate` `199.95/mo` billed annually
- Public trial:
  - `30 days` on Essential, Plus, Premium
  - `14 days` on Ultimate
- Gating model:
  - free gets real product utility
  - upgrades triggered by alert counts, chart count, indicators, history depth, second/tick intervals, connections, market data
- Key lesson: usage-limited free beats a fake free tier
- Sources:
  - `https://www.tradingview.com/pricing/`
  - `https://www.tradingview.com/data-coverage/`

#### Journalytix

- URL: `https://journalytix.me/get-started/`
- Business model: subscription + enterprise
- Last verified: 2026-04-01
- Public pricing:
  - `Monthly` `$47/mo`
  - `Annual` `$399/yr` (`$33.25/mo`)
  - `Enterprise` contact sales
- Trial: free trial mentioned, duration not stated on pricing page
- Public gating: same core feature set on monthly and annual; enterprise for group/desk workflows
- Sources:
  - `https://journalytix.me/get-started/`

#### TraderSync

- URL: `https://tradersync.com/pricing/`
- Business model: subscription
- Last verified: 2026-04-01
- Public pricing:
  - `Pro` `$29.95/mo` or `$197.64/yr`
  - `Premium` `$49.95/mo` or `$299.64/yr`
  - `Elite` `$79.95/mo` or `$479.64/yr`
- Annual discount: up to `50%`
- Trial: `7-day free trial`
- Badge: `Premium` marked `Most Popular`
- Public gating:
  - accounts: `1 / unlimited / unlimited`
  - replay precision, AI message caps, coach tools, Level II, screeners, backtesting are laddered hard
- Pricing sentiment:
  - praise: power and support
  - complaint: very valuable features pushed high into the ladder
- Sources:
  - `https://tradersync.com/pricing/`
  - `https://tradersync.com/billing-cancellation-and-refund-policy/`

#### Bloomberg Terminal / LSEG Workspace

- Bloomberg URL: `https://professional.bloomberg.com/products/bloomberg-terminal/`
- LSEG URL: `https://www.lseg.com/en/data-analytics/products/workspace`
- Business model: sales-led enterprise
- Public price visibility: official public pages do not expose self-serve pricing; demos and gated purchase flow dominate
- Strategic use here: only as a reminder that enterprise pricing works when the product is mission-critical and deeply embedded, not for self-serve retail acquisition

## 2. Broader SaaS pricing patterns

| Product | Free vs paid split | Upgrade trigger | Annual discount | Enterprise/custom | Usage-based |
|---|---|---|---:|---|---|
| TradingView | strong free | alerts, chart depth, history, add-ons | ~13% to 17% | yes | market-data add-ons |
| Notion | strong free | collaboration, admin, AI | ~17% | yes | AI credits, custom domains |
| Linear | generous free | seat-based teamwork, admin, private teams | ~11% to 17% | yes | light add-ons |
| Figma | free viewers/commenters | editor/dev seats, org controls | visible on annual plans | yes | AI credits |
| Vercel | free + paid seats | team features and infra scale | none emphasized | yes | heavy usage-based |
| Supabase | strong free | production scale, backups, support | monthly-first | yes | heavy usage-based |

Key pattern takeaways:

- Free works best when it creates habit, not frustration.
- Self-serve plans should be easy to compare in under `10 seconds`.
- Usage-based pricing is best reserved for expensive or bursty components such as AI, storage, and premium data.
- Team/enterprise should be a separate motion, not the main pricing-page focus for retail traders.

## 3. Tier structure analysis

### Option A - keep 3 tiers

- Conversion likelihood: medium if entry price is reduced
- ARPU: strong
- Churn risk: moderate and manageable
- Competitive positioning: good if mid-tier sits closer to `$20-$25`
- Complexity: low

### Option B - 4 tiers

- Conversion likelihood: high at first glance
- ARPU: at risk from cannibalization
- Churn risk: higher in the cheap middle if value is thin
- Competitive positioning: crowded and harder to explain
- Complexity: high for onboarding, billing, and feature gating

### Option C - free / pro / team / enterprise

- Conversion likelihood: medium
- ARPU: good long term if team features exist
- Churn risk: okay
- Competitive positioning: premature for current product and audience
- Complexity: medium-high

### Option D - usage-based hybrid

- Conversion likelihood: lower for retail traders
- ARPU: potentially high
- Churn risk: high if bills feel unpredictable
- Competitive positioning: wrong core motion for this category
- Complexity: high

### Option E - free / pro only

- Conversion likelihood: highest simplicity
- ARPU: weaker because heavy users are under-monetized
- Churn risk: lower on confusion, higher on price objection
- Competitive positioning: too blunt for a product with live sync, prop tooling, and AI
- Complexity: very low

### Best choice

Choose a refined `Option A`:

- `Explorer` free
- `Trader` `$24/mo` or `$19/mo annual`
- `Elite` `$49/mo` or `$39/mo annual`
- plus sales-led `partner / prop / education` pricing off-page

Why this beats the alternatives:

- simpler than four tiers
- better conversion than the current `$29` entry
- preserves room for high-value multi-account and AI-heavy users
- matches category expectations better than a fake corporate `Institutional` label

## 4. Recommended plan structure (final)

| Aspect | Explorer | Trader | Elite |
|---|---|---|---|
| Name | Explorer | Trader | Elite |
| Monthly price | $0 | $24 | $49 |
| Annual price (per month) | - | $19 | $39 |
| Annual discount % | - | 21% | 20% |
| Trial days | - | 7 | 7 |
| Tagline | Build the habit before you size up. | The paid plan most traders actually need. | For multi-account traders who want the full stack. |
| CTA | Start free | Start 7-day trial | Start 7-day trial |
| Badge | - | Most popular | Best value |
| Persona | new trader, student of process, one-account user | funded trader, serious hobbyist, prop challenger | full-time or multi-account trader |
| Differentiation from tier below | free core journaling | live sync, prop tracker, exports, deeper analytics | more accounts, more live sync, more AI, elite analytics |

## 5. Price positioning map

- `$0-10`: free tiers from TradesViz, Trademetria, TradingView Basic, Stonk Journal, Forex Factory, Myfxbook, TradeInsights Free
- `$10-20`: Chartlog Lite, TradesViz annual Pro, Trademetria annual Basic, Edgewonk annualized, TraderSync annual Pro
- `$20-30`: TradeZella Basic, Tradervue Silver, Trademetria Pro, Profitabledge Trader, Chartlog Standard, TradesViz Platinum monthly
- `$30-50`: TradeZella Premium annualized, Journalytix annualized, Chartlog Pro, TraderSync Premium, Profitabledge Elite, Tradervue Gold
- `$50-80`: TraderSync Elite, TradingView Premium, current Profitabledge Institutional, some pro coaching bundles
- `$80-150`: sparse for retail journals; institutional tools and niche desks begin here
- `$150+`: TradingView Ultimate, Bloomberg / LSEG custom, institutional analytics workflows
- One-time or term-priced: Edgewonk and some annual-only offers functionally sit here

## 6. Annual vs monthly pricing

Recommendation:

- Show `annual` as the default view.
- Use `"$19/mo billed annually"` style for card headlines.
- Use a `20%` to `21%` annual discount.
- Skip quarterly for now; it adds billing noise without enough upside.

Why:

- trading tools already train buyers to expect annual anchors
- it lowers churn and lifts cash flow
- it makes a `$24` plan feel psychologically closer to the high-value `$19` anchor

## 7. Free trial strategy

Recommended motion:

- free tier: no card, always available
- paid tiers: `7-day` Stripe trial
- card required on paid trial because the free tier already handles low-friction exploration
- when trial ends: downgrade gracefully to Explorer and preserve all data

Estimated performance:

| Approach | Conversion | Friction | Support burden | Verdict |
|---|---:|---:|---:|---|
| 7-day paid trial with card | 20% to 35% | medium | medium | best now |
| 14-day no-card paid trial | higher signup, lower monetization | low | high | better later if onboarding gets stronger |
| 30-day full trial | high trial abuse risk | low | high | too generous for current stage |
| no trial, free tier only | lower paid conversion | low | low | too weak for premium AI and sync upsells |

## 8. Feature gating philosophy

Use `generous free + usage-limited free`.

- Keep core journaling, trade tracking, dashboard basics, and calendar free.
- Meter accounts, imports, live sync, AI, and exports.
- Gate deeper analytics, prop workflows, and advanced reporting into paid tiers.
- Reserve the most advanced execution and API tooling for Elite.

## 9. Feature Gating Master Matrix (final)

### Dashboard and widgets

| Feature | Explorer | Trader | Elite | Justification |
|---|---|---|---|---|
| Dashboard access | Yes | Yes | Yes | core habit builder |
| Account balance widget | Yes | Yes | Yes | basic review |
| Account equity (live) | No | Yes | Yes | tied to live sync |
| Win rate widget | Yes | Yes | Yes | basic review |
| Win streak widget | Yes | Yes | Yes | basic review |
| Profit factor widget | Yes | Yes | Yes | basic review |
| Hold time widget | Yes | Yes | Yes | basic review |
| Average RR widget | Yes | Yes | Yes | basic review |
| Asset profitability widget | Yes | Yes | Yes | useful free insight |
| Trade counts widget | Yes | Yes | Yes | basic review |
| Profit expectancy widget | Yes | Yes | Yes | basic review |
| Total losses widget | Yes | Yes | Yes | basic review |
| Consistency score widget | Yes | Yes | Yes | sticky habit loop |
| Open trades widget | No | Yes | Yes | live data value |
| Daily net P&L chart | Yes | Yes | Yes | core visual |
| Weekday performance chart | Yes | Yes | Yes | core visual |
| Performing assets chart | Yes | Yes | Yes | core visual |
| Widget drag-and-drop customization | Yes | Yes | Yes | personalization matters |
| Widget count limit | 6 | 16 | 16 | usage-based free |
| Comparison modes | No | Yes | Yes | paid workflow depth |
| Date range filtering | 90 days | full | full | basic free, depth paid |
| Calendar view with daily P&L | Yes | Yes | Yes | habit builder |

### Trade management

| Feature | Explorer | Trader | Elite | Justification |
|---|---|---|---|---|
| Trade table view | Yes | Yes | Yes | core tracking |
| Trade search | Yes | Yes | Yes | core tracking |
| Trade filtering (symbol, direction, date) | Yes | Yes | Yes | core tracking |
| Advanced filters (profit, session, model, protocol) | No | Yes | Yes | paid segmentation |
| CSV import (single file) | Yes | Yes | Yes | acquisition layer |
| CSV multi-file import | No | Yes | Yes | paid convenience |
| Manual trade entry | Yes | Yes | Yes | must stay free |
| Trade count limit | 300/mo | Unlimited | Unlimited | usage-limited free |
| Trade history depth | Full raw history | Full | Full | do not delete habit data |
| Trade export (CSV/PDF) | No | Yes | Yes | standard paid boundary |
| Trade tagging (session, model) | Yes | Yes | Yes | habit builder |
| Custom trade tags | No | Yes | Yes | advanced workflow |

### Connections and live sync

| Feature | Explorer | Trader | Elite | Justification |
|---|---|---|---|---|
| MT5 EA connection | Manual-only | Yes | Yes | live sync is paid |
| MT4 connection | Manual-only | Yes | Yes | live sync is paid |
| cTrader OAuth | Manual-only | Yes | Yes | live sync is paid |
| Match-Trader | Manual-only | Yes | Yes | live sync is paid |
| TradeLocker | Manual-only | Yes | Yes | live sync is paid |
| DXTrade | Manual-only | Yes | Yes | live sync is paid |
| Tradovate | Manual-only | Yes | Yes | live sync is paid |
| TopstepX | Manual-only | Yes | Yes | live sync is paid |
| Live sync slot count | 0 | 1 | 5 | clearest infrastructure gate |
| Sync frequency | Manual import | real-time | priority real-time | premium infrastructure |
| Historical backfill on connect | No | Yes | Yes | paid workload |

### Journal

| Feature | Explorer | Trader | Elite | Justification |
|---|---|---|---|---|
| Journal entry creation | Yes | Yes | Yes | must stay free |
| Rich text editing (all block types) | Yes | Yes | Yes | must stay free |
| Trade linking in journal | Yes | Yes | Yes | core workflow |
| Psychology tracking | Yes | Yes | Yes | habit builder |
| Pre/during/post phases | Yes | Yes | Yes | habit builder |
| Journal entry limit | Unlimited text | Unlimited | Unlimited | do not block routine |
| Image/video embeds | Limited storage | Yes | Yes | storage-based upsell |
| Journal search | Yes | Yes | Yes | core utility |
| Journal tags and folders | Tags only | Yes | Yes | folders can be paid |
| Journal AI analysis | No | Yes | Yes | premium interpretation |
| Journal templates | No | 10 | Unlimited | good mid-tier upsell |
| Journal export | No | Yes | Yes | paid boundary |

### Analytics and advanced metrics

| Feature | Explorer | Trader | Elite | Justification |
|---|---|---|---|---|
| Basic stats (WR, PF, total P&L) | Yes | Yes | Yes | core value |
| Win/loss streak tracking | Yes | Yes | Yes | core value |
| Symbol breakdown | Yes | Yes | Yes | useful free insight |
| Weekday analysis | Yes | Yes | Yes | useful free insight |
| Session/killzone analysis | No | Yes | Yes | paid segmentation |
| Strategy/model tag analysis | No | Yes | Yes | paid segmentation |
| Protocol alignment tracking | No | Yes | Yes | deeper coaching |
| Execution quality (spread, slippage) | No | No | Yes | elite-only advanced analytics |
| MFE/MAE analysis | No | Yes | Yes | classic paid upgrade |
| RR capture efficiency | No | Yes | Yes | paid upgrade |
| Exit efficiency | No | No | Yes | elite-only depth |
| Manipulation metrics | No | No | Yes | niche advanced insight |
| Volatility bucketing (STDV) | No | No | Yes | niche advanced insight |
| Drawdown analysis | Yes | Yes | Yes | important enough to keep visible |
| Equity curve | Yes | Yes | Yes | core visual |
| Time-of-day analysis | No | Yes | Yes | paid segmentation |
| Direction analysis | Yes | Yes | Yes | useful free insight |
| Volume/position sizing analysis | No | Yes | Yes | paid workflow |
| Planned vs actual RR comparison | No | Yes | Yes | paid workflow |
| Risk metrics (margin, leverage) | No | Yes | Yes | paid workflow |
| Consistency score with range selector | Limited | Yes | Yes | comparison depth paid |
| Period-over-period comparison | No | Yes | Yes | paid workflow |
| Custom date range analytics | 90 days | full | full | usage-limited free |

### Prop firm tracker

| Feature | Explorer | Trader | Elite | Justification |
|---|---|---|---|---|
| Prop firm assignment | No | Yes | Yes | prop-specific paid feature |
| Challenge phase tracking | No | Yes | Yes | prop-specific paid feature |
| Profit target monitoring | No | Yes | Yes | prop-specific paid feature |
| Daily loss limit tracking | No | Yes | Yes | prop-specific paid feature |
| Max drawdown monitoring | No | Yes | Yes | prop-specific paid feature |
| Trading days counter | No | Yes | Yes | prop-specific paid feature |
| Monte Carlo pass simulation | No | No | Yes | elite-only premium depth |
| Custom prop firm creation | No | No | Yes | elite-only customization |
| Auto-detection from broker | No | Yes | Yes | paid convenience |
| Prop firm account limit | 0 | 3 | Unlimited | clear usage ladder |
| Challenge history | No | Yes | Yes | paid workflow |
| Prop firm alerts | No | Yes | Yes | retention driver |

### AI and Edge

| Feature | Explorer | Trader | Elite | Justification |
|---|---|---|---|---|
| AI Assistant chat | No | Yes | Yes | clearest upsell |
| AI trade insights | No | Yes | Yes | clearest upsell |
| AI journal analysis | No | Yes | Yes | clearest upsell |
| AI pattern detection | No | Yes | Yes | premium insight |
| AI sentiment analysis | No | Yes | Yes | premium insight |
| Edge credit allowance | 30/mo | 300/mo | 1500/mo | usage-based AI ladder |
| Bring your own API key | Yes | Yes | Yes | transparency and flexibility |
| Custom AI prompts | No | Yes | Yes | paid workflow |
| AI-generated reports | No | Yes | Yes | premium output |

### Account management

| Feature | Explorer | Trader | Elite | Justification |
|---|---|---|---|---|
| Account count limit | 1 | 5 | Unlimited | main usage gate |
| Multi-account view | No | Yes | Yes | portfolio view is paid |
| Account switching | Yes | Yes | Yes | basic navigation |
| Demo account | Yes | Yes | Yes | onboarding aid |
| Account archiving | No | Yes | Yes | nice paid utility |
| Currency conversion | No | Yes | Yes | deeper analysis |

### Social features (future)

| Feature | Explorer | Trader | Elite | Justification |
|---|---|---|---|---|
| Public profile | Yes | Yes | Yes | discovery loop |
| Social opt-in | Yes | Yes | Yes | discovery loop |
| Leaderboard access | Read-only | Yes | Yes | community nudge |
| Follow other traders | No | Yes | Yes | paid participation |
| Community feed | No | Yes | Yes | monetize engagement |

### Reports and exports

| Feature | Explorer | Trader | Elite | Justification |
|---|---|---|---|---|
| Daily/weekly/monthly reports | No | Yes | Yes | standard paid boundary |
| PDF report generation | No | Yes | Yes | paid boundary |
| CSV data export | No | Yes | Yes | paid boundary |
| Email report delivery | No | Yes | Yes | retention driver |
| Custom report builder | No | No | Yes | elite-only power tool |
| Shareable performance links | No | 3 | Unlimited | good upsell |

### Notifications and alerts

| Feature | Explorer | Trader | Elite | Justification |
|---|---|---|---|---|
| Trade sync notifications | No | Yes | Yes | tied to sync |
| Prop rule breach alerts | No | Yes | Yes | tied to prop tracker |
| Daily P&L summary | No | Yes | Yes | retention feature |
| Weekly performance digest | No | Yes | Yes | retention feature |
| Custom alert rules | No | 5 | 25 | usage-based upsell |
| Push notifications | No | Yes | Yes | retention feature |
| Email notifications | Yes | Yes | Yes | baseline communication |

### Data and storage

| Feature | Explorer | Trader | Elite | Justification |
|---|---|---|---|---|
| Trade history retention | Full raw history | Full | Full | never punish habit |
| Journal storage | 250 MB | 5 GB | 25 GB | storage-based upsell |
| Data backup/download | No | Yes | Yes | paid utility |
| API access (read-only) | No | No | Yes | elite-only |
| API access (read-write) | No | No | Yes | elite-only |

## 10. Upgrade triggers and paywall patterns

### Trigger moments

| Trigger | User sees | CTA |
|---|---|---|
| Hits account limit | `You are using 1/1 accounts.` | `Unlock more accounts ->` |
| Opens reports | locked workspace preview | `Open reports on Trader ->` |
| Connects broker | live sync slots meter | `Enable live sync ->` |
| Opens prop tracker | locked overview shell | `Track your challenge ->` |
| Clicks AI Assistant | teaser with sample use cases | `Unlock AI coaching ->` |
| Needs export | disabled CSV/PDF export button | `Export on Trader ->` |
| Wants deeper metrics | blurred advanced panels | `See full analytics ->` |
| Exhausts credits | low-credit meter and warning | `Get more AI capacity ->` |

### Paywall patterns

| Pattern | Best use |
|---|---|
| Blur overlay | advanced analytics and Monte Carlo |
| Lock icon | nav items like reports and prop tracker |
| Usage meter | accounts, live sync slots, AI credits |
| Teaser preview | AI Assistant and journal AI |
| Soft nudge | advanced filters and custom alerts |
| Hard gate | API access and exports |

## 11. Downgrade experience and win-back

When a user downgrades or cancels:

- keep trades and journal entries intact
- keep raw trade history intact
- make extra accounts read-only instead of deleting them
- pause live sync and leave the connection record visible
- keep premium reports and AI history visible but non-refreshing

Recommended cancel flow:

1. Ask why they are leaving.
2. Offer annual save, pause, or roadmap capture.
3. If they still cancel, confirm end date and preserved data.
4. After cancel:
   - day 7: new features email
   - day 30: return offer with annual discount
   - day 90: last-chance reactivation note

## 12. Edge credits and AI monetization

### Updated allowances

- `Explorer`: `30` credits / month
- `Trader`: `300` credits / month
- `Elite`: `1,500` credits / month

### Cost model using current Gemini 2.5 Flash pricing

Assumptions use current server-side pricing constants:

- input: `$0.30 / 1M tokens`
- output: `$2.50 / 1M tokens`
- system charges credits in rounded `1 cent` units, so most lightweight calls cost `1` credit in practice

| AI feature | Example token mix | Raw cost | Charged credits | Notes |
|---|---:|---:|---:|---|
| Assistant query, simple | 2k in / 800 out | ~$0.0026 | 1 | fast coaching prompt |
| Assistant query, deeper | 7.5k in / 2.5k out | ~$0.0085 | 1 | still usually 1 credit |
| Journal analysis | 10k in / 2k out | ~$0.0080 | 1 | great paid upsell |
| Trade insight batch | 3k in / 1.2k out | ~$0.0039 | 1 | still cheap to serve |
| Pattern detection | 20k in / 4k out | ~$0.0160 | 2 | heavier workflow |

What users can do with the new allowances:

- `30` credits: roughly `15` to `30` preview interactions
- `300` credits: roughly `150` to `300` monthly interactions
- `1,500` credits: roughly `750` to `1,500` interactions

Recommendation:

- keep BYOK on all tiers
- add top-ups later, but start with simple packs such as `500 credits for $4.99`
- expose a visible credit meter in billing and AI surfaces
- warn at `15%` remaining or `25` credits, whichever is higher

## 13. Special pricing programs

Recommendation:

- Annual discount: yes, `20%+`
- Lifetime deal: no public evergreen lifetime plan; use rare launch or AppSumo-style experiments only if cash flow is needed
- Student/education discount: yes, `20%` on Trader annual via verification
- Prop firm partnerships: yes, coupon-based partner offers and bundle codes
- Team pricing: private only for mentors, cohorts, prop desks
- Early adopter pricing: grandfather existing paying users at current or better effective rate
- PPP: test selectively later, starting with India, Brazil, Nigeria, Philippines, and similar high-friction markets

## 14. Revenue projection

Assumptions:

- Free -> paid conversion: `10%`
- Monthly -> annual share: `35%`
- Paid mix: `75% Trader`, `25% Elite`
- Monthly churn: `4.8%` blended

At `1,000` users:

- `900` Explorer
- `75` Trader
- `25` Elite
- MRR equivalent: about `$2,806`
- ARR equivalent: about `$33,675`

At `10,000` users:

- `9,000` Explorer
- `750` Trader
- `250` Elite
- MRR equivalent: about `$28,063`
- ARR equivalent: about `$336,750`

Upside levers:

- better activation into first CSV import or first journal entry
- stronger in-product AI teaser moments
- prop-firm partnerships and creator offers
- annual share climbing from `35%` to `45%`

## Final recommendation

Ship this stack:

- `Explorer` / `Trader` / `Elite`
- `$0 / $24 / $49` monthly
- `$0 / $19 / $39` annual effective pricing
- `7-day` paid trials
- generous free journaling and core analytics
- paid live sync, prop tracking, exports, advanced reports, and AI depth

This is the highest-probability path to better conversion without weakening monetization for serious traders.
