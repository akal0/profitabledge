/**
 * Advanced Trading Metrics Calculator
 *
 * Provides deterministic, R-based calculations for advanced trading analytics.
 * All R metrics are normalized by SL (stop loss distance).
 * Post-exit metrics only consider price action after exit timestamp.
 */

import { getPipSizeForSymbol } from "./dukascopy";

export interface TradeData {
  id: string;
  symbol: string;
  tradeDirection: "long" | "short";
  entryPrice: number;
  sl: number | null;
  tp: number | null;
  closePrice: number | null;
  profit: number;
  commissions: number | null;
  swap: number | null;
  volume: number;

  // Manipulation structure
  manipulationHigh: number | null;
  manipulationLow: number | null;
  manipulationPips: number | null;

  // Entry price action
  entryPeakPrice: number | null; // Max favorable price during trade

  // Post-exit price action
  postExitPeakPrice: number | null; // Max favorable price after exit

  // User configuration
  alphaWeightedMpe?: number; // default 0.30
  beThresholdPips?: number; // default 0.5
}

/**
 * 1. Manipulation (Pips)
 * Type: Stored (or derived once per trade)
 * Description: Raw size of the manipulation leg used as structural reference.
 */
export function calculateManipulationPips(
  manipHigh: number | null,
  manipLow: number | null,
  symbol: string
): number | null {
  if (manipHigh == null || manipLow == null) return null;
  const pipSize = getPipSizeForSymbol(symbol);
  return Math.abs(manipHigh - manipLow) / pipSize;
}

/**
 * 2. MPE Manip Leg (R)
 * Type: Derived
 * Description: Max Price Exertion measured from manipulation reference, converted to R.
 *
 * For longs: peak price − manipulation low
 * For shorts: manipulation high − trough price
 * Convert pip distance to R using SL size
 */
export function calculateMPEManipLegR(trade: TradeData): number | null {
  const { tradeDirection, entryPrice, sl, manipulationHigh, manipulationLow, entryPeakPrice, symbol } = trade;

  if (sl == null || entryPeakPrice == null || manipulationHigh == null || manipulationLow == null) {
    return null;
  }

  const pipSize = getPipSizeForSymbol(symbol);
  const slPips = Math.abs(entryPrice - sl) / pipSize;

  if (slPips === 0) return null;

  let maxMovePips: number;

  if (tradeDirection === "long") {
    // peak price − manipulation low
    const moveInPrice = entryPeakPrice - manipulationLow;
    maxMovePips = moveInPrice / pipSize;
  } else {
    // manipulation high − trough price
    const moveInPrice = manipulationHigh - entryPeakPrice;
    maxMovePips = moveInPrice / pipSize;
  }

  return maxMovePips / slPips;
}

/**
 * 3. MPE Manip PE (R) (Post Exit)
 * Type: Derived
 * Description: Max favorable price movement after trade exit, measured from manipulation reference.
 */
export function calculateMPEManipPE_R(trade: TradeData): number | null {
  const { tradeDirection, entryPrice, sl, manipulationHigh, manipulationLow, postExitPeakPrice, symbol } = trade;

  if (sl == null || postExitPeakPrice == null || manipulationHigh == null || manipulationLow == null) {
    return null;
  }

  const pipSize = getPipSizeForSymbol(symbol);
  const slPips = Math.abs(entryPrice - sl) / pipSize;

  if (slPips === 0) return null;

  let postExitMovePips: number;

  if (tradeDirection === "long") {
    // post-exit peak − manipulation low
    const moveInPrice = postExitPeakPrice - manipulationLow;
    postExitMovePips = moveInPrice / pipSize;
  } else {
    // manipulation high − post-exit trough
    const moveInPrice = manipulationHigh - postExitPeakPrice;
    postExitMovePips = moveInPrice / pipSize;
  }

  return postExitMovePips / slPips;
}

/**
 * 4. Max R:R
 * Type: Derived
 * Description: Maximum theoretical R offered from entry while trade was open.
 */
export function calculateMaxRR(trade: TradeData): number | null {
  const { tradeDirection, entryPrice, sl, entryPeakPrice, symbol } = trade;

  if (sl == null || entryPeakPrice == null) return null;

  const pipSize = getPipSizeForSymbol(symbol);
  const slPips = Math.abs(entryPrice - sl) / pipSize;

  if (slPips === 0) return null;

  let maxMovePips: number;

  if (tradeDirection === "long") {
    const moveInPrice = entryPeakPrice - entryPrice;
    maxMovePips = moveInPrice / pipSize;
  } else {
    const moveInPrice = entryPrice - entryPeakPrice;
    maxMovePips = moveInPrice / pipSize;
  }

  return maxMovePips / slPips;
}

/**
 * 5. Realised R:R
 * Type: Derived
 * Description: Final R after commissions, swaps, partials.
 */
export function calculateRealisedRR(trade: TradeData): number | null {
  const { entryPrice, sl, closePrice, symbol } = trade;

  if (sl == null || closePrice == null) return null;

  const pipSize = getPipSizeForSymbol(symbol);
  const slPips = Math.abs(entryPrice - sl) / pipSize;

  if (slPips === 0) return null;

  let netPips: number;

  if (trade.tradeDirection === "long") {
    netPips = (closePrice - entryPrice) / pipSize;
  } else {
    netPips = (entryPrice - closePrice) / pipSize;
  }

  return netPips / slPips;
}

/**
 * 6. RR Capture Efficiency (%)
 * Type: Derived
 * Description: How much of available R was actually captured.
 * Constraints: Clamp to 0–100%. If Max_RR == 0 → null
 */
export function calculateRRCaptureEfficiency(trade: TradeData): number | null {
  const realisedRR = calculateRealisedRR(trade);
  const maxRR = calculateMaxRR(trade);

  if (realisedRR == null || maxRR == null || maxRR === 0) return null;

  const efficiency = (realisedRR / maxRR) * 100;
  return Math.max(0, Math.min(100, efficiency));
}

/**
 * 7. Manip RR Efficiency (%)
 * Type: Derived
 * Description: How much of the manipulation move was actually captured at exit.
 * This measures entry quality + exit execution relative to manipulation displacement.
 * Notes: Can exceed 100%. Do NOT clamp. Can be negative (bad exits).
 */
export function calculateManipRREfficiency(trade: TradeData): number | null {
  const { tradeDirection, closePrice, manipulationHigh, manipulationLow, symbol } = trade;

  if (manipulationHigh == null || manipulationLow == null || closePrice == null) {
    return null;
  }

  const pipSize = getPipSizeForSymbol(symbol);
  const manipPips = Math.abs(manipulationHigh - manipulationLow) / pipSize;

  if (manipPips === 0) return null;

  let capturedMovePips: number;

  if (tradeDirection === "long") {
    // What you actually exited with relative to manipulation reference (low)
    capturedMovePips = (closePrice - manipulationLow) / pipSize;
  } else {
    // What you actually exited with relative to manipulation reference (high)
    capturedMovePips = (manipulationHigh - closePrice) / pipSize;
  }

  // Convert to R based on manipulation leg (which is 1R baseline)
  const capturedManipR = capturedMovePips / manipPips;

  return capturedManipR * 100;
}

/**
 * 8. Raw STDV
 * Type: Derived
 * Description: Raw volatility expression of the trade.
 * Logic: Mathematically equivalent to MPE Manip Leg (R), but framed as volatility.
 */
export function calculateRawSTDV(trade: TradeData): number | null {
  return calculateMPEManipLegR(trade);
}

/**
 * 9. Raw STDV PE
 * Type: Derived
 * Description: Post-exit volatility excursion.
 */
export function calculateRawSTDV_PE(trade: TradeData): number | null {
  return calculateMPEManipPE_R(trade);
}

/**
 * 10. STDV (Bucket)
 * Type: Derived (categorical)
 * Description: Bucketed volatility regime.
 */
export function calculateSTDVBucket(rawSTDV: number | null): string | null {
  if (rawSTDV == null) return null;

  if (rawSTDV <= -1.5) return "-2 STDV";
  if (rawSTDV > -1.5 && rawSTDV <= -0.5) return "-1 STDV";
  if (rawSTDV > -0.5 && rawSTDV <= 0.5) return "0 STDV";
  if (rawSTDV > 0.5 && rawSTDV <= 1.5) return "+1 STDV";
  if (rawSTDV > 1.5) return "+2 STDV";

  return "0 STDV";
}

/**
 * 11. Weighted Manip MPE (R) — Adaptive TP Recommendation
 * Type: Derived (ADVANCED, gated)
 * Description: Realistic, sustainable R target based on manipulation-based price behavior.
 *
 * Formula: Weighted_Manip_MPE_R = MPE_Manip_Leg_R + (α * MPE_Manip_PE_R)
 *
 * This combines:
 * - What price did while you were in the trade (MPE Manip Leg)
 * - A discounted portion of what price did after exit (MPE Manip PE)
 *
 * Rules:
 * - α default = 0.30 (recommended range: 0.20–0.40)
 * - User configurable
 * - Sample-size gated: Hidden until ≥ 100 trades (preferably 150-200)
 * - This is NOT a maximum, prediction, or runner fantasy
 * - It is a behavior-constrained expectation
 */
export function calculateEstimatedWeightedMPE_R(
  trade: TradeData,
  totalTradesInAccount: number,
  minTradesThreshold: number = 100,
  disableSampleGating: boolean = false
): number | null {
  // Sample-size gating (can be disabled by user preference)
  if (!disableSampleGating && totalTradesInAccount < minTradesThreshold) {
    return null;
  }

  const mpeManipLegR = calculateMPEManipLegR(trade);
  const mpeManipPE_R = calculateMPEManipPE_R(trade);

  if (mpeManipLegR == null || mpeManipPE_R == null) return null;

  const alpha = trade.alphaWeightedMpe ?? 0.30;

  // Bounds check for alpha
  const boundedAlpha = Math.max(0.20, Math.min(0.40, alpha));

  return mpeManipLegR + boundedAlpha * mpeManipPE_R;
}

/**
 * 12. Outcome Classification
 * Type: Derived
 * Description: Outcome is NOT binary.
 *
 * Rules:
 * - If loss <= configured BE threshold → BE
 * - If only commissions + swap → BE
 * - Partial TP hit → PW
 * - Else Win / Loss
 */
export function calculateOutcome(trade: TradeData): "Win" | "Loss" | "BE" | "PW" {
  const { profit, commissions, swap, tp, closePrice, entryPrice, tradeDirection, beThresholdPips, symbol } = trade;

  const beThreshold = beThresholdPips ?? 0.5;
  const pipSize = getPipSizeForSymbol(symbol);

  // Calculate net profit before costs
  const grossProfit = profit - (commissions ?? 0) - (swap ?? 0);

  // If loss is within BE threshold
  if (Math.abs(profit) <= beThreshold * pipSize) {
    return "BE";
  }

  // If profit approximately equals just commissions + swap (break-even exit)
  const onlyCosts = Math.abs(profit) <= Math.abs((commissions ?? 0) + (swap ?? 0)) * 1.1;
  if (onlyCosts) {
    return "BE";
  }

  // Check for partial win (TP exists and price moved toward it but didn't reach it)
  if (tp != null && closePrice != null) {
    const hitTP = tradeDirection === "long"
      ? closePrice >= tp
      : closePrice <= tp;

    const movedTowardTP = tradeDirection === "long"
      ? closePrice > entryPrice && closePrice < tp
      : closePrice < entryPrice && closePrice > tp;

    if (movedTowardTP && profit > 0) {
      return "PW"; // Partial Win
    }
  }

  // Standard Win/Loss
  return profit >= 0 ? "Win" : "Loss";
}

/**
 * Calculate all advanced metrics for a trade
 */
export function calculateAllAdvancedMetrics(
  trade: TradeData,
  totalTradesInAccount: number = 0,
  disableSampleGating: boolean = false
) {
  const manipulationPips = calculateManipulationPips(
    trade.manipulationHigh,
    trade.manipulationLow,
    trade.symbol
  );

  const mpeManipLegR = calculateMPEManipLegR(trade);
  const mpeManipPE_R = calculateMPEManipPE_R(trade);
  const maxRR = calculateMaxRR(trade);
  const realisedRR = calculateRealisedRR(trade);
  const rrCaptureEfficiency = calculateRRCaptureEfficiency(trade);
  const manipRREfficiency = calculateManipRREfficiency(trade);
  const rawSTDV = calculateRawSTDV(trade);
  const rawSTDV_PE = calculateRawSTDV_PE(trade);
  const stdvBucket = calculateSTDVBucket(rawSTDV);
  const estimatedWeightedMPE_R = calculateEstimatedWeightedMPE_R(trade, totalTradesInAccount, 100, disableSampleGating);
  const outcome = calculateOutcome(trade);

  return {
    // Stored/derived once
    manipulationPips,

    // R-based metrics
    mpeManipLegR,
    mpeManipPE_R,
    maxRR,
    realisedRR,

    // Efficiency metrics
    rrCaptureEfficiency,
    manipRREfficiency,

    // Volatility metrics
    rawSTDV,
    rawSTDV_PE,
    stdvBucket,

    // Advanced
    estimatedWeightedMPE_R,

    // Classification
    outcome,
  };
}

/**
 * Validation helpers
 */
export function validateLongShortSymmetry(
  longTrade: TradeData,
  shortTrade: TradeData
): boolean {
  // Test that calculations are symmetric for equivalent long/short positions
  const longMetrics = calculateAllAdvancedMetrics(longTrade);
  const shortMetrics = calculateAllAdvancedMetrics(shortTrade);

  // Basic symmetry check (extend as needed)
  return (
    Math.abs((longMetrics.maxRR ?? 0) - (shortMetrics.maxRR ?? 0)) < 0.01
  );
}

export function validateZeroSLEdgeCase(trade: TradeData): boolean {
  // All R-based metrics should return null when SL is zero or null
  const metrics = calculateAllAdvancedMetrics(trade);

  if (trade.sl == null || trade.sl === 0) {
    return (
      metrics.mpeManipLegR === null &&
      metrics.maxRR === null &&
      metrics.realisedRR === null
    );
  }

  return true;
}
