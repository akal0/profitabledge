import { db } from "../db";
import { trade as tradeTable } from "../db/schema/trading";
import { eq, and, sql } from "drizzle-orm";

export type TradeScore = {
  score: number; // 0-10
  factors: {
    setupAlignment: { score: number; reason: string };
    rrOptimality: { score: number; reason: string };
    timeWindow: { score: number; reason: string };
    assetPerformance: { score: number; reason: string };
    sessionAlignment: { score: number; reason: string };
  };
  recommendation: string;
};

/**
 * Score an open trade based on historical performance patterns
 * Returns a score from 0-10 and breakdown of factors
 */
export async function scoreOpenTrade(
  tradeId: string,
  accountId: string
): Promise<TradeScore | null> {
  try {
    // Get the open trade
    const openTrade = await db
      .select()
      .from(tradeTable)
      .where(and(eq(tradeTable.id, tradeId), eq(tradeTable.accountId, accountId)))
      .limit(1);

    if (!openTrade[0] || openTrade[0].close) {
      return null; // Trade doesn't exist or is closed
    }

    const trade = openTrade[0];

    // Get historical closed trades for analysis (last 100)
    const historicalTrades = await db
      .select()
      .from(tradeTable)
      .where(
        and(
          eq(tradeTable.accountId, accountId),
          sql`${tradeTable.closeTime} IS NOT NULL`
        )
      )
      .orderBy(sql`${tradeTable.closeTime} DESC`)
      .limit(100);

    if (historicalTrades.length < 20) {
      // Not enough data to score
      return null;
    }

    const factors = {
      setupAlignment: scoreSetupAlignment(trade, historicalTrades),
      rrOptimality: scoreRROptimality(trade, historicalTrades),
      timeWindow: scoreTimeWindow(trade, historicalTrades),
      assetPerformance: scoreAssetPerformance(trade, historicalTrades),
      sessionAlignment: scoreSessionAlignment(trade, historicalTrades),
    };

    // Calculate weighted average score
    const weights = {
      setupAlignment: 0.25,
      rrOptimality: 0.2,
      timeWindow: 0.2,
      assetPerformance: 0.2,
      sessionAlignment: 0.15,
    };

    const totalScore =
      factors.setupAlignment.score * weights.setupAlignment +
      factors.rrOptimality.score * weights.rrOptimality +
      factors.timeWindow.score * weights.timeWindow +
      factors.assetPerformance.score * weights.assetPerformance +
      factors.sessionAlignment.score * weights.sessionAlignment;

    const recommendation = getRecommendation(totalScore, factors);

    return {
      score: Math.round(totalScore * 10) / 10, // Round to 1 decimal
      factors,
      recommendation,
    };
  } catch (error) {
    console.error("Error scoring trade:", error);
    return null;
  }
}

function scoreSetupAlignment(
  trade: any,
  historical: any[]
): { score: number; reason: string } {
  // Score based on protocol/model alignment
  const protocolMatches = historical.filter(
    (t) => t.protocolAlignment && Number(t.profit || 0) > 0
  );
  const protocolWinRate =
    protocolMatches.length > 0
      ? protocolMatches.filter((t) => Number(t.profit || 0) > 0).length /
        protocolMatches.length
      : 0.5;

  if (trade.protocolAlignment && protocolWinRate > 0.6) {
    return {
      score: 9,
      reason: `Protocol-aligned trades have ${(protocolWinRate * 100).toFixed(0)}% win rate`,
    };
  } else if (!trade.protocolAlignment) {
    return {
      score: 4,
      reason: "Trade not aligned with your protocol",
    };
  }

  return {
    score: 7,
    reason: "Standard setup alignment",
  };
}

function scoreRROptimality(
  trade: any,
  historical: any[]
): { score: number; reason: string } {
  if (!trade.plannedRr) {
    return { score: 5, reason: "No R:R data available" };
  }

  const tradeRR = Number(trade.plannedRr);

  // Analyze historical R:R performance
  const rrBuckets = new Map<string, { wins: number; total: number }>();
  historical.forEach((t) => {
    if (t.plannedRr == null || t.profit == null) return;
    const rr = Number(t.plannedRr);
    const bucket = rr < 2 ? "low" : rr < 3.5 ? "medium" : "high";
    const stats = rrBuckets.get(bucket) || { wins: 0, total: 0 };
    stats.total++;
    if (Number(t.profit) > 0) stats.wins++;
    rrBuckets.set(bucket, stats);
  });

  const tradeBucket = tradeRR < 2 ? "low" : tradeRR < 3.5 ? "medium" : "high";
  const stats = rrBuckets.get(tradeBucket);

  if (!stats || stats.total < 5) {
    return { score: 6, reason: "Insufficient R:R history" };
  }

  const winRate = stats.wins / stats.total;

  if (winRate > 0.6) {
    return {
      score: 9,
      reason: `Your ${tradeBucket} R:R trades have ${(winRate * 100).toFixed(0)}% win rate`,
    };
  } else if (winRate < 0.4) {
    return {
      score: 3,
      reason: `Your ${tradeBucket} R:R trades only have ${(winRate * 100).toFixed(0)}% win rate`,
    };
  }

  return {
    score: 6,
    reason: `${tradeBucket} R:R with ${(winRate * 100).toFixed(0)}% historical win rate`,
  };
}

function scoreTimeWindow(
  trade: any,
  historical: any[]
): { score: number; reason: string } {
  if (!trade.open) {
    return { score: 5, reason: "No entry time data" };
  }

  const entryHour = new Date(trade.open).getHours();

  // Analyze performance by hour
  const hourStats = new Map<number, { profit: number; count: number; wins: number }>();
  historical.forEach((t) => {
    if (!t.open || t.profit == null) return;
    const hour = new Date(t.open).getHours();
    const stats = hourStats.get(hour) || { profit: 0, count: 0, wins: 0 };
    stats.profit += Number(t.profit);
    stats.count++;
    if (Number(t.profit) > 0) stats.wins++;
    hourStats.set(hour, stats);
  });

  const stats = hourStats.get(entryHour);

  if (!stats || stats.count < 3) {
    return { score: 6, reason: "Limited data for this time" };
  }

  const winRate = stats.wins / stats.count;
  const avgProfit = stats.profit / stats.count;

  if (winRate > 0.6 && avgProfit > 0) {
    return {
      score: 9,
      reason: `${entryHour}:00 is your high-performance window (${(winRate * 100).toFixed(0)}% WR)`,
    };
  } else if (winRate < 0.4 || avgProfit < 0) {
    return {
      score: 3,
      reason: `${entryHour}:00 has been challenging for you (${(winRate * 100).toFixed(0)}% WR)`,
    };
  }

  return {
    score: 6,
    reason: `Standard performance at ${entryHour}:00`,
  };
}

function scoreAssetPerformance(
  trade: any,
  historical: any[]
): { score: number; reason: string } {
  if (!trade.symbol) {
    return { score: 5, reason: "No symbol data" };
  }

  const symbolTrades = historical.filter((t) => t.symbol === trade.symbol);

  if (symbolTrades.length < 5) {
    return { score: 6, reason: "Limited history with this asset" };
  }

  const wins = symbolTrades.filter((t) => Number(t.profit || 0) > 0).length;
  const winRate = wins / symbolTrades.length;
  const totalProfit = symbolTrades.reduce((sum, t) => sum + Number(t.profit || 0), 0);

  if (winRate > 0.6 && totalProfit > 0) {
    return {
      score: 9,
      reason: `${trade.symbol} is a top performer (${(winRate * 100).toFixed(0)}% WR)`,
    };
  } else if (winRate < 0.4 || totalProfit < 0) {
    return {
      score: 3,
      reason: `${trade.symbol} has low success rate for you (${(winRate * 100).toFixed(0)}% WR)`,
    };
  }

  return {
    score: 6,
    reason: `${trade.symbol}: ${(winRate * 100).toFixed(0)}% win rate`,
  };
}

function scoreSessionAlignment(
  trade: any,
  historical: any[]
): { score: number; reason: string } {
  if (!trade.session) {
    return { score: 5, reason: "No session data" };
  }

  const sessionTrades = historical.filter((t) => t.session === trade.session);

  if (sessionTrades.length < 5) {
    return { score: 6, reason: "Limited session history" };
  }

  const wins = sessionTrades.filter((t) => Number(t.profit || 0) > 0).length;
  const winRate = wins / sessionTrades.length;

  if (winRate > 0.6) {
    return {
      score: 9,
      reason: `${trade.session} session: ${(winRate * 100).toFixed(0)}% win rate`,
    };
  } else if (winRate < 0.4) {
    return {
      score: 3,
      reason: `${trade.session} session: only ${(winRate * 100).toFixed(0)}% win rate`,
    };
  }

  return {
    score: 6,
    reason: `${trade.session}: ${(winRate * 100).toFixed(0)}% historical WR`,
  };
}

function getRecommendation(score: number, factors: any): string {
  if (score >= 8) {
    return "✅ High-quality setup matching your best patterns. Trust your process.";
  } else if (score >= 6) {
    return "⚠️ Acceptable setup, but watch for the factors flagged above.";
  } else {
    return "❌ This trade deviates from your winning patterns. Consider passing or reducing size.";
  }
}
