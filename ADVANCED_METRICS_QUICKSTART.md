# Advanced Trading Metrics - Quick Start Guide

## ✅ Implementation Status

**ALL DONE!** The database migration has been applied successfully. The advanced metrics are now live and ready to use.

## 🚀 How to Use

### 1. Enable Columns in the UI

1. Navigate to the **Trades** page in your dashboard
2. Click the **Columns** visibility toggle (usually a button with column icon)
3. Enable any of these new metrics:
   - ✓ Manipulation (Pips)
   - ✓ MPE Manip Leg (R)
   - ✓ MPE Manip PE (R)
   - ✓ Max R:R
   - ✓ Realised R:R
   - ✓ RR Capture Efficiency (%)
   - ✓ Manip RR Efficiency (%)
   - ✓ Raw STDV
   - ✓ Raw STDV PE
   - ✓ STDV (Bucket)
   - ✓ Est. Weighted MPE (R) - *Requires ≥100 trades*
   - ✓ Outcome

### 2. Populate Base Data

For the metrics to calculate properly, you need to populate these base fields:

#### Required for R-based metrics:
- ✅ Already have: `sl`, `tp`, `open_price`, `close_price`

#### Required for manipulation metrics:
- 📝 **Need to add**: `manipulation_high`, `manipulation_low`

#### Optional (improves accuracy):
- 📝 `entry_peak_price` - Max favorable price during trade
- 📝 `post_exit_peak_price` - Max favorable price after exit (1 hour recommended)

### 3. Example: Manually Set Manipulation Data

```sql
-- Update a single trade with manipulation levels
UPDATE trade
SET
  manipulation_high = 1.0850,
  manipulation_low = 1.0800,
  entry_peak_price = 1.0870,
  post_exit_peak_price = 1.0890
WHERE id = 'your-trade-id';
```

Or via your CSV upload / EA integration (recommended).

### 4. Understanding the Display

#### Color Coding

**Green/Teal** = Excellent performance
- RR Capture ≥ 75%
- Manip RR Eff ≥ 100%
- Max R:R ≥ 2R

**Yellow** = Good performance
- RR Capture 50-74%
- Manip RR Eff 75-99%
- Max R:R 1-2R

**Amber** = Fair performance
- RR Capture 25-49%
- Manip RR Eff 50-74%

**Red** = Poor performance
- RR Capture < 25%
- Manip RR Eff < 50%
- Max R:R < 1R

**Gray** = Neutral / No data

#### Outcome Labels

- **Win** - Profitable trade
- **Loss** - Unprofitable trade
- **BE** (Break Even) - Loss within 0.5 pips OR only commissions/swap
- **PW** (Partial Win) - Partial TP hit (moved toward TP but didn't reach)

## 📊 Most Useful Metrics to Start With

**Recommended for beginners:**
1. **Outcome** - Quick win/loss classification
2. **Max R:R** - See what was possible
3. **Realised R:R** - See what you got
4. **RR Capture Efficiency** - How well you captured available R

**Recommended for advanced analysis:**
5. **MPE Manip Leg (R)** - Structural volatility
6. **STDV (Bucket)** - Regime classification
7. **Manip RR Efficiency** - Entry quality metric

**Unlock after 100+ trades:**
8. **Est. Weighted MPE (R)** - Data-driven TP targets

## 🔧 Configuration

### Adjust Alpha (α) for Estimated Weighted MPE

Default: `0.30` (conservative)

To change per-trade:
```sql
UPDATE trade
SET alpha_weighted_mpe = 0.35
WHERE id = 'your-trade-id';
```

Higher α = More weight on post-exit potential
Lower α = More conservative estimate

### Adjust BE Threshold

Default: `0.5` pips

To change:
```sql
UPDATE trade
SET be_threshold_pips = 1.0
WHERE id = 'your-trade-id';
```

## 🎯 Common Use Cases

### Use Case 1: Find High-Quality Entries

**Goal**: Find trades where you entered near the manipulation low

**Columns to enable**:
- Manip RR Efficiency (%)
- MPE Manip Leg (R)

**What to look for**:
- Manip RR Eff ≥ 80% = You entered close to optimal
- High MPE Manip Leg = Strong structural move

---

### Use Case 2: Identify Early Exits

**Goal**: Find trades where you exited too soon

**Columns to enable**:
- Max R:R
- Realised R:R
- RR Capture Efficiency (%)

**What to look for**:
- Max R:R > 2R but Realised R:R < 1R
- RR Capture < 50%
- This means you had a winner but exited early

---

### Use Case 3: Analyze by Volatility Regime

**Goal**: See if you perform better in specific volatility conditions

**Columns to enable**:
- STDV (Bucket)
- Outcome
- Max R:R

**What to do**:
1. Sort/filter by STDV Bucket
2. Compare win rates across buckets
3. Adjust strategy per regime

---

### Use Case 4: Set Data-Driven TP Targets

**Goal**: Use historical data to set realistic TPs

**Requirement**: ≥ 100 trades in account

**Columns to enable**:
- Est. Weighted MPE (R)
- Max R:R

**What to look for**:
- Compare Est. Weighted MPE vs your current TP targets
- If Est. Weighted MPE consistently shows 1.8R, but you're targeting 3R, you might be overreaching

---

## ❓ FAQ

**Q: All columns show "—" (no data)**
- A: You need to populate base data (manipulation_high/low, entry_peak_price)
- Solution: Import manipulation levels via CSV or EA

**Q: "Locked" appears in Est. Weighted MPE**
- A: Account has fewer than 100 trades
- Solution: Import more trades or wait until threshold is met

**Q: R-based metrics show null**
- A: SL is missing or zero
- Solution: Ensure SL is set for trades

**Q: Can I change the sample-size threshold?**
- A: Yes, edit `minTradesThreshold` in [advanced-metrics.ts:224](apps/server/src/lib/advanced-metrics.ts:224)

**Q: How is post-exit data collected?**
- A: Currently manual. Recommended: Fetch price data 1 hour after exit and store in `post_exit_peak_price`

---

## 🔗 Resources

- **Full Implementation Guide**: [ADVANCED_METRICS_IMPLEMENTATION.md](ADVANCED_METRICS_IMPLEMENTATION.md)
- **Calculation Library**: [apps/server/src/lib/advanced-metrics.ts](apps/server/src/lib/advanced-metrics.ts)
- **Database Schema**: [apps/server/src/db/schema/trading.ts:57-73](apps/server/src/db/schema/trading.ts)

---

**Need help?** Check the full implementation documentation or review the calculation logic in the source files.
