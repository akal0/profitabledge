/**
 * Backfill Advanced Metrics
 * 
 * Calculates and caches all advanced metrics for existing trades using
 * the functions from advanced-metrics.ts
 * 
 * Usage: bun run src/scripts/backfill-advanced-metrics.ts [accountId]
 */

import { db } from "../db";
import { trade, tradingAccount } from "../db/schema/trading";
import { eq } from "drizzle-orm";
import {
  calculateAllAdvancedMetrics,
  calculateMFEPips,
  calculateMAEPips,
  calculateOutcome,
  type TradeData,
} from "../lib/advanced-metrics";

async function backfillMetrics(accountId?: string) {
  console.log("🚀 Starting advanced metrics backfill...\n");

  // Get trades to process
  let trades;
  if (accountId) {
    console.log(`📊 Processing trades for account: ${accountId}`);
    trades = await db
      .select()
      .from(trade)
      .where(eq(trade.accountId, accountId));
  } else {
    console.log("📊 Processing ALL trades across all accounts");
    trades = await db.select().from(trade);
  }

  if (trades.length === 0) {
    console.log("❌ No trades found to process");
    return;
  }

  console.log(`Found ${trades.length} trades to process\n`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  // Get total trade count per account for sample-gated metrics
  const accountTradeCounts: Record<string, number> = {};
  for (const t of trades) {
    if (!accountTradeCounts[t.accountId]) {
      const count = await db
        .select()
        .from(trade)
        .where(eq(trade.accountId, t.accountId));
      accountTradeCounts[t.accountId] = count.length;
    }
  }

  for (const t of trades) {
    try {
      // Convert trade to TradeData format
      const tradeData: TradeData = {
        id: t.id,
        symbol: t.symbol || "",
        tradeDirection: (t.tradeType as "long" | "short") || "long",
        entryPrice: parseFloat(t.openPrice || "0"),
        sl: t.sl ? parseFloat(t.sl) : null,
        tp: t.tp ? parseFloat(t.tp) : null,
        closePrice: t.closePrice ? parseFloat(t.closePrice) : null,
        profit: parseFloat(t.profit || "0"),
        commissions: t.commissions ? parseFloat(t.commissions) : null,
        swap: t.swap ? parseFloat(t.swap) : null,
        volume: parseFloat(t.volume || "0"),
        manipulationHigh: t.manipulationHigh ? parseFloat(t.manipulationHigh) : null,
        manipulationLow: t.manipulationLow ? parseFloat(t.manipulationLow) : null,
        manipulationPips: t.manipulationPips ? parseFloat(t.manipulationPips) : null,
        entryPeakPrice: t.entryPeakPrice ? parseFloat(t.entryPeakPrice) : null,
        postExitPeakPrice: t.postExitPeakPrice ? parseFloat(t.postExitPeakPrice) : null,
        alphaWeightedMpe: t.alphaWeightedMpe ? parseFloat(t.alphaWeightedMpe) : 0.30,
        beThresholdPips: t.beThresholdPips ? parseFloat(t.beThresholdPips) : 0.5,
      };

      // Calculate all metrics
      const totalTradesInAccount = accountTradeCounts[t.accountId] || 0;
      const metrics = calculateAllAdvancedMetrics(
        tradeData,
        totalTradesInAccount,
        false // Don't disable sample gating
      );

      // Also calculate MFE/MAE if we have manipulation data (as peak price proxies)
      let mfePips = metrics.mfePips;
      let maePips = metrics.maePips;

      // If we don't have entryPeakPrice but have manipulation data, use it as proxy
      if (!mfePips && tradeData.manipulationHigh && tradeData.manipulationLow) {
        mfePips = calculateMFEPips(tradeData);
        maePips = calculateMAEPips(tradeData);
      }

      // Update the trade with calculated metrics
      await db
        .update(trade)
        .set({
          // Opportunity metrics
          mfePips: mfePips?.toString() || null,
          maePips: maePips?.toString() || null,
          mpeManipLegR: metrics.mpeManipLegR?.toString() || null,
          mpeManipPE_R: metrics.mpeManipPE_R?.toString() || null,
          maxRR: metrics.maxRR?.toString() || null,
          rawSTDV: metrics.rawSTDV?.toString() || null,
          rawSTDV_PE: metrics.rawSTDV_PE?.toString() || null,
          stdvBucket: metrics.stdvBucket || null,
          estimatedWeightedMPE_R: metrics.estimatedWeightedMPE_R?.toString() || null,

          // Intent metrics (if not already set)
          plannedRR: t.plannedRR || metrics.plannedRR?.toString() || null,
          plannedRiskPips: t.plannedRiskPips || metrics.plannedRiskPips?.toString() || null,
          plannedTargetPips: t.plannedTargetPips || metrics.plannedTargetPips?.toString() || null,

          // Execution metrics
          realisedRR: metrics.realisedRR?.toString() || null,
          outcome: t.outcome || metrics.outcome,

          // Efficiency metrics
          rrCaptureEfficiency: metrics.rrCaptureEfficiency?.toString() || null,
          manipRREfficiency: metrics.manipRREfficiency?.toString() || null,
          exitEfficiency: metrics.exitEfficiency?.toString() || null,
        })
        .where(eq(trade.id, t.id));

      processed++;

      if (processed % 100 === 0) {
        console.log(`✓ Processed ${processed}/${trades.length} trades...`);
      }
    } catch (error) {
      console.error(`❌ Error processing trade ${t.id}:`, error);
      errors++;
    }
  }

  console.log("\n📊 Backfill Summary:");
  console.log(`  ✓ Processed: ${processed}`);
  console.log(`  ⊘ Skipped: ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);
  console.log("\n✅ Backfill complete!");
}

// Run backfill
const accountId = process.argv[2]; // Optional: node script.ts accountId
backfillMetrics(accountId).catch(console.error);
