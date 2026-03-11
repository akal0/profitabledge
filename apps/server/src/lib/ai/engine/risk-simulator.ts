/**
 * Risk Simulator
 *
 * Monte Carlo simulation, risk-of-ruin calculation, and position sizing optimization.
 *
 * Features:
 * - Monte Carlo: 10,000 simulated equity paths from actual trade distribution
 * - Risk-of-Ruin: probability of hitting drawdown threshold
 * - Position Sizing: Kelly criterion, half-Kelly, fixed fractional recommendations
 * - Drawdown Intelligence: waterfall chart data, recovery analysis
 */

import { db } from "../../../db";
import { trade as tradeTable } from "../../../db/schema/trading";
import { eq, and, sql, desc } from "drizzle-orm";
import type { TraderProfileData } from "./types";
import {
  buildAccountScopeCondition,
  resolveScopedAccountIds,
} from "../../account-scope";

// ─── Types ──────────────────────────────────────────────────────

export interface MonteCarloResult {
  simulations: number;
  tradeCount: number; // how many trades per simulation
  percentiles: {
    p5: number[];   // worst case path
    p25: number[];  // below average
    p50: number[];  // median
    p75: number[];  // above average
    p95: number[];  // best case path
  };
  finalEquity: {
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
    mean: number;
  };
  maxDrawdown: {
    p5: number;   // worst 5% max DD
    p50: number;  // median max DD
    p95: number;  // best case max DD
  };
  probabilities: {
    profitableAfter: number;      // % of sims ending profitable
    doubleAccount: number;        // % reaching 200% of starting
    drawdownExceeds10: number;    // % hitting >10% DD
    drawdownExceeds20: number;    // % hitting >20% DD
    drawdownExceeds50: number;    // % hitting >50% DD
  };
}

export interface RiskOfRuinResult {
  probabilityOfRuin: number; // 0-100%
  expectedTradesBeforeRuin: number | null;
  safeRiskPerTrade: number; // recommended max risk %
  currentRisk: number | null; // estimated current risk %
  kellyCriterion: number; // optimal risk %
  halfKelly: number;
}

export interface DrawdownProfile {
  maxDrawdown: number; // % from peak
  maxDrawdownDollars: number;
  avgDrawdown: number;
  avgRecoveryTrades: number;
  currentDrawdownPct: number;
  currentDrawdownDollars: number;
  drawdownPeriods: DrawdownPeriod[];
  isInDrawdown: boolean;
}

export interface DrawdownPeriod {
  startIndex: number;
  endIndex: number;
  depth: number; // % from peak
  depthDollars: number;
  recoveryTrades: number;
  startDate?: string;
  endDate?: string;
}

export interface PositionSizeRecommendation {
  method: string;
  riskPerTrade: number; // % of account
  rationale: string;
  expectedGrowth: number; // expected % growth per trade
}

// ─── Helpers ────────────────────────────────────────────────────

function toNum(val: string | number | null | undefined): number {
  if (val == null) return 0;
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? 0 : n;
}

// ─── Monte Carlo Simulation ─────────────────────────────────────

export async function runMonteCarloSimulation(
  accountId: string,
  options: {
    simulations?: number;
    tradeCount?: number;
    startingEquity?: number;
    filters?: {
      symbol?: string;
      session?: string;
      edgeOnly?: boolean;
    };
  } = {},
  userId?: string
): Promise<MonteCarloResult> {
  const {
    simulations = 5000,
    tradeCount = 100,
    startingEquity = 10000,
  } = options;

  const scopedAccountIds = userId
    ? await resolveScopedAccountIds(userId, accountId)
    : [accountId];

  if (scopedAccountIds.length === 0) {
    throw new Error("Account not found");
  }

  // Get all closed trades to sample from
  const trades = await db
    .select({ profit: tradeTable.profit })
    .from(tradeTable)
    .where(
      and(
        buildAccountScopeCondition(tradeTable.accountId, scopedAccountIds),
        sql`${tradeTable.closeTime} IS NOT NULL`
      )
    );

  if (trades.length < 10) {
    throw new Error("Need at least 10 closed trades for Monte Carlo simulation");
  }

  const returns = trades.map((t) => toNum(t.profit));

  // Run simulations
  const allPaths: number[][] = [];
  const finalEquities: number[] = [];
  const maxDrawdowns: number[] = [];

  for (let sim = 0; sim < simulations; sim++) {
    const path: number[] = [startingEquity];
    let equity = startingEquity;
    let peak = startingEquity;
    let maxDD = 0;

    for (let i = 0; i < tradeCount; i++) {
      // Random sample with replacement
      const randomReturn = returns[Math.floor(Math.random() * returns.length)];
      equity += randomReturn;
      path.push(equity);

      if (equity > peak) peak = equity;
      const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
      if (dd > maxDD) maxDD = dd;
    }

    allPaths.push(path);
    finalEquities.push(equity);
    maxDrawdowns.push(maxDD);
  }

  // Calculate percentile paths (sample at every 10th trade for efficiency)
  const samplePoints = Math.min(tradeCount + 1, 51);
  const step = Math.max(1, Math.floor(tradeCount / (samplePoints - 1)));

  const percentilePaths = {
    p5: [] as number[],
    p25: [] as number[],
    p50: [] as number[],
    p75: [] as number[],
    p95: [] as number[],
  };

  for (let i = 0; i <= tradeCount; i += step) {
    const valuesAtPoint = allPaths.map((p) => p[Math.min(i, p.length - 1)]);
    valuesAtPoint.sort((a, b) => a - b);

    percentilePaths.p5.push(valuesAtPoint[Math.floor(simulations * 0.05)]);
    percentilePaths.p25.push(valuesAtPoint[Math.floor(simulations * 0.25)]);
    percentilePaths.p50.push(valuesAtPoint[Math.floor(simulations * 0.5)]);
    percentilePaths.p75.push(valuesAtPoint[Math.floor(simulations * 0.75)]);
    percentilePaths.p95.push(valuesAtPoint[Math.floor(simulations * 0.95)]);
  }

  // Final equity stats
  finalEquities.sort((a, b) => a - b);
  maxDrawdowns.sort((a, b) => a - b);

  const profitableCount = finalEquities.filter(
    (e) => e > startingEquity
  ).length;
  const doubleCount = finalEquities.filter(
    (e) => e >= startingEquity * 2
  ).length;
  const dd10Count = maxDrawdowns.filter((d) => d > 10).length;
  const dd20Count = maxDrawdowns.filter((d) => d > 20).length;
  const dd50Count = maxDrawdowns.filter((d) => d > 50).length;

  return {
    simulations,
    tradeCount,
    percentiles: percentilePaths,
    finalEquity: {
      p5: finalEquities[Math.floor(simulations * 0.05)],
      p25: finalEquities[Math.floor(simulations * 0.25)],
      p50: finalEquities[Math.floor(simulations * 0.5)],
      p75: finalEquities[Math.floor(simulations * 0.75)],
      p95: finalEquities[Math.floor(simulations * 0.95)],
      mean:
        finalEquities.reduce((s, v) => s + v, 0) / finalEquities.length,
    },
    maxDrawdown: {
      p5: maxDrawdowns[Math.floor(simulations * 0.95)], // worst 5%
      p50: maxDrawdowns[Math.floor(simulations * 0.5)],
      p95: maxDrawdowns[Math.floor(simulations * 0.05)], // best case
    },
    probabilities: {
      profitableAfter: (profitableCount / simulations) * 100,
      doubleAccount: (doubleCount / simulations) * 100,
      drawdownExceeds10: (dd10Count / simulations) * 100,
      drawdownExceeds20: (dd20Count / simulations) * 100,
      drawdownExceeds50: (dd50Count / simulations) * 100,
    },
  };
}

// ─── Risk of Ruin ───────────────────────────────────────────────

export function calculateRiskOfRuin(
  profile: TraderProfileData,
  riskPerTrade: number = 2, // % of account
  ruinThreshold: number = 50 // % drawdown
): RiskOfRuinResult {
  const winRate = profile.winRate / 100;
  const lossRate = 1 - winRate;

  const avgWin = Math.abs(profile.avgProfit);
  const avgLoss = Math.abs(profile.avgLoss);
  const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : 1;

  // Kelly Criterion: f* = (bp - q) / b
  // where b = payoff ratio, p = win probability, q = loss probability
  const kellyCriterion = Math.max(
    0,
    (payoffRatio * winRate - lossRate) / payoffRatio
  );
  const halfKelly = kellyCriterion / 2;

  // Risk of ruin formula (simplified)
  // RoR = ((1 - edge) / (1 + edge))^(capitalUnits)
  const edge = winRate * payoffRatio - lossRate;
  const capitalUnits = ruinThreshold / riskPerTrade;

  let probabilityOfRuin: number;
  if (edge <= 0) {
    // Negative expectancy → ruin is certain (given enough trades)
    probabilityOfRuin = 100;
  } else {
    const ratio = (1 - edge) / (1 + edge);
    probabilityOfRuin = Math.pow(ratio, capitalUnits) * 100;
  }

  // Expected trades before ruin (if RoR is high)
  let expectedTradesBeforeRuin: number | null = null;
  if (probabilityOfRuin > 10 && edge > 0) {
    expectedTradesBeforeRuin = Math.round(capitalUnits / (1 - winRate));
  }

  // Safe risk per trade: half-Kelly capped at 5%
  const safeRisk = Math.min(5, halfKelly * 100);

  return {
    probabilityOfRuin: Math.min(100, Math.max(0, probabilityOfRuin)),
    expectedTradesBeforeRuin,
    safeRiskPerTrade: Math.round(safeRisk * 100) / 100,
    currentRisk: riskPerTrade,
    kellyCriterion: Math.round(kellyCriterion * 10000) / 100, // as %
    halfKelly: Math.round(halfKelly * 10000) / 100, // as %
  };
}

// ─── Drawdown Profile ───────────────────────────────────────────

export async function computeDrawdownProfile(
  accountId: string,
  userId?: string
): Promise<DrawdownProfile> {
  const scopedAccountIds = userId
    ? await resolveScopedAccountIds(userId, accountId)
    : [accountId];

  if (scopedAccountIds.length === 0) {
    return {
      maxDrawdown: 0,
      maxDrawdownDollars: 0,
      avgDrawdown: 0,
      avgRecoveryTrades: 0,
      currentDrawdownPct: 0,
      currentDrawdownDollars: 0,
      drawdownPeriods: [],
      isInDrawdown: false,
    };
  }

  const trades = await db
    .select({
      id: tradeTable.id,
      profit: tradeTable.profit,
      closeTime: tradeTable.closeTime,
    })
    .from(tradeTable)
    .where(
      and(
        buildAccountScopeCondition(tradeTable.accountId, scopedAccountIds),
        sql`${tradeTable.closeTime} IS NOT NULL`
      )
    )
    .orderBy(tradeTable.closeTime);

  if (trades.length === 0) {
    return {
      maxDrawdown: 0,
      maxDrawdownDollars: 0,
      avgDrawdown: 0,
      avgRecoveryTrades: 0,
      currentDrawdownPct: 0,
      currentDrawdownDollars: 0,
      drawdownPeriods: [],
      isInDrawdown: false,
    };
  }

  // Build equity curve
  const equityCurve: number[] = [0];
  let equity = 0;
  for (const t of trades) {
    equity += toNum(t.profit);
    equityCurve.push(equity);
  }

  // Identify drawdown periods
  let peak = 0;
  let peakIndex = 0;
  let maxDD = 0;
  let maxDDDollars = 0;
  const periods: DrawdownPeriod[] = [];
  let currentPeriodStart: number | null = null;

  for (let i = 0; i < equityCurve.length; i++) {
    if (equityCurve[i] > peak) {
      // New peak — end any current drawdown period
      if (currentPeriodStart !== null) {
        const depthDollars = peak - Math.min(
          ...equityCurve.slice(currentPeriodStart, i + 1)
        );
        const depth = peak > 0 ? (depthDollars / peak) * 100 : 0;
        periods.push({
          startIndex: currentPeriodStart,
          endIndex: i,
          depth,
          depthDollars,
          recoveryTrades: i - currentPeriodStart,
          startDate: trades[currentPeriodStart - 1]?.closeTime?.toISOString?.() || undefined,
          endDate: trades[i - 1]?.closeTime?.toISOString?.() || undefined,
        });
        currentPeriodStart = null;
      }
      peak = equityCurve[i];
      peakIndex = i;
    } else {
      // In drawdown
      if (currentPeriodStart === null) {
        currentPeriodStart = i;
      }
      const dd = peak > 0 ? ((peak - equityCurve[i]) / peak) * 100 : 0;
      const ddDollars = peak - equityCurve[i];
      if (dd > maxDD) maxDD = dd;
      if (ddDollars > maxDDDollars) maxDDDollars = ddDollars;
    }
  }

  // Check if currently in drawdown
  const currentEquity = equityCurve[equityCurve.length - 1];
  const currentDDDollars = Math.max(0, peak - currentEquity);
  const currentDDPct = peak > 0 ? (currentDDDollars / peak) * 100 : 0;
  const isInDrawdown = currentPeriodStart !== null;

  const avgDD =
    periods.length > 0
      ? periods.reduce((s, p) => s + p.depth, 0) / periods.length
      : 0;
  const avgRecovery =
    periods.length > 0
      ? periods.reduce((s, p) => s + p.recoveryTrades, 0) / periods.length
      : 0;

  return {
    maxDrawdown: maxDD,
    maxDrawdownDollars: maxDDDollars,
    avgDrawdown: avgDD,
    avgRecoveryTrades: avgRecovery,
    currentDrawdownPct: currentDDPct,
    currentDrawdownDollars: currentDDDollars,
    drawdownPeriods: periods.slice(-10), // Last 10 periods
    isInDrawdown,
  };
}

// ─── Position Sizing Recommendations ────────────────────────────

export function getPositionSizeRecommendations(
  profile: TraderProfileData
): PositionSizeRecommendation[] {
  const winRate = profile.winRate / 100;
  const avgWin = Math.abs(profile.avgProfit);
  const avgLoss = Math.abs(profile.avgLoss);
  const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : 1;

  const kelly =
    payoffRatio > 0
      ? (payoffRatio * winRate - (1 - winRate)) / payoffRatio
      : 0;
  const halfKelly = kelly / 2;

  const recommendations: PositionSizeRecommendation[] = [];

  // Conservative fixed fractional
  recommendations.push({
    method: "Conservative (1% Risk)",
    riskPerTrade: 1,
    rationale:
      "Safe for all traders. Limits max single-trade loss to 1% of account. Good for building confidence.",
    expectedGrowth: winRate * 1 * payoffRatio - (1 - winRate) * 1,
  });

  // Moderate fixed fractional
  recommendations.push({
    method: "Moderate (2% Risk)",
    riskPerTrade: 2,
    rationale:
      "Standard recommendation. Balances growth and risk. Most professional traders use 1-2%.",
    expectedGrowth: winRate * 2 * payoffRatio - (1 - winRate) * 2,
  });

  // Half-Kelly (practical optimum)
  if (kelly > 0) {
    const hkPct = Math.round(halfKelly * 10000) / 100;
    recommendations.push({
      method: `Half-Kelly (${hkPct.toFixed(1)}% Risk)`,
      riskPerTrade: hkPct,
      rationale: `Mathematically optimal when halved for safety. Based on your ${(winRate * 100).toFixed(1)}% WR and ${payoffRatio.toFixed(2)}:1 payoff ratio.`,
      expectedGrowth: winRate * hkPct * payoffRatio - (1 - winRate) * hkPct,
    });
  }

  // Full Kelly (aggressive, for reference)
  if (kelly > 0) {
    const kPct = Math.round(kelly * 10000) / 100;
    recommendations.push({
      method: `Full Kelly (${kPct.toFixed(1)}% Risk)`,
      riskPerTrade: kPct,
      rationale:
        "Maximum mathematical growth rate. Very aggressive — large drawdowns expected. Not recommended for most traders.",
      expectedGrowth: winRate * kPct * payoffRatio - (1 - winRate) * kPct,
    });
  }

  return recommendations;
}
