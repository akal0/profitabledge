import { db } from "../db";
import { trade as tradeTable } from "../db/schema/trading";
import { eq, and, gte, desc, sql } from "drizzle-orm";

export type InsightType =
  | "overtrade_warning"
  | "low_winrate_session"
  | "exit_timing"
  | "rr_optimization"
  | "time_pattern"
  | "asset_performance"
  | "streak_alert"
  | "consistency_check";

export type Insight = {
  type: InsightType;
  title: string;
  message: string;
  severity: "info" | "warning" | "success";
  data?: Record<string, any>;
};

/**
 * Generate AI insights for a user's trading performance
 * Analyzes last 30 days of trades
 */
export async function generateInsights(accountId: string): Promise<Insight[]> {
  const insights: Insight[] = [];

  try {
    // Get trades from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const trades = await db
      .select()
      .from(tradeTable)
      .where(
        and(
          eq(tradeTable.accountId, accountId),
          gte(tradeTable.closeTime, thirtyDaysAgo),
          sql`${tradeTable.closeTime} IS NOT NULL`
        )
      )
      .orderBy(desc(tradeTable.closeTime))
      .limit(1000);

    if (trades.length < 10) {
      // Not enough data
      return [];
    }

    // 1. Check for overtrading patterns
    const tradesByDay = new Map<string, number>();
    trades.forEach((trade) => {
      if (!trade.closeTime) return;
      const day = trade.closeTime.toISOString().slice(0, 10);
      tradesByDay.set(day, (tradesByDay.get(day) || 0) + 1);
    });

    const avgTradesPerDay =
      Array.from(tradesByDay.values()).reduce((a, b) => a + b, 0) /
      tradesByDay.size;

    const overtradeDay = Array.from(tradesByDay.entries()).find(
      ([, count]) => count > avgTradesPerDay * 2
    );

    if (overtradeDay) {
      insights.push({
        type: "overtrade_warning",
        title: "Potential Overtrading Detected",
        message: `You took ${overtradeDay[1]} trades on ${new Date(
          overtradeDay[0]
        ).toLocaleDateString()}, which is ${Math.round(
          (overtradeDay[1] / avgTradesPerDay - 1) * 100
        )}% above your average. Overtrading often leads to lower quality setups.`,
        severity: "warning",
        data: { tradesCount: overtradeDay[1], date: overtradeDay[0] },
      });
    }

    // 2. Session win rate analysis
    const sessionStats = new Map<
      string,
      { wins: number; total: number; profit: number }
    >();
    trades.forEach((trade) => {
      if (!trade.sessionTag) return;
      const session = trade.sessionTag;
      const stats = sessionStats.get(session) || {
        wins: 0,
        total: 0,
        profit: 0,
      };
      stats.total++;
      if (Number(trade.profit || 0) > 0) stats.wins++;
      stats.profit += Number(trade.profit || 0);
      sessionStats.set(session, stats);
    });

    const lowWinRateSessions = Array.from(sessionStats.entries())
      .filter(([, stats]) => stats.total >= 5 && stats.wins / stats.total < 0.4)
      .sort((a, b) => b[1].total - a[1].total);

    if (lowWinRateSessions.length > 0) {
      const [session, stats] = lowWinRateSessions[0];
      insights.push({
        type: "low_winrate_session",
        title: `Low Win Rate in ${session} Session`,
        message: `Your win rate during ${session} is only ${(
          (stats.wins / stats.total) *
          100
        ).toFixed(1)}% (${stats.wins}/${
          stats.total
        } trades). Consider reducing trades during this session.`,
        severity: "warning",
        data: {
          session,
          winRate: stats.wins / stats.total,
          total: stats.total,
        },
      });
    }

    // 3. Exit timing analysis (MFE vs actual profit)
    const exitEfficiencyTrades = trades.filter(
      (t) =>
        t.mfePips != null &&
        t.profit != null &&
        t.sl != null &&
        t.openPrice != null
    );

    if (exitEfficiencyTrades.length >= 20) {
      const avgExitEfficiency =
        exitEfficiencyTrades.reduce((sum, t) => {
          const mfe = Math.abs(Number(t.mfePips || 0));
          const profit = Math.abs(Number(t.profit || 0));
          const entry = Number(t.openPrice);
          const sl = Number(t.sl);
          const risk = Math.abs(entry - sl);
          if (!Number.isFinite(risk) || risk <= 0) return sum;
          const actualR = profit / risk;
          const potentialR = mfe / risk;
          return sum + (potentialR > 0 ? actualR / potentialR : 0);
        }, 0) / exitEfficiencyTrades.length;

      if (avgExitEfficiency < 0.7) {
        insights.push({
          type: "exit_timing",
          title: "Early Exit Pattern Detected",
          message: `You're capturing ${(avgExitEfficiency * 100).toFixed(
            0
          )}% of potential profit on average. Consider holding winners longer or adjusting your exit strategy.`,
          severity: "info",
          data: { efficiency: avgExitEfficiency },
        });
      }
    }

    // 4. R:R optimization
    const rrBuckets = new Map<string, { wins: number; total: number }>();
    trades.forEach((trade) => {
      if (trade.plannedRR == null) return;
      const rr = Number(trade.plannedRR);
      const bucket = rr < 2 ? "low" : rr < 3 ? "medium" : "high";
      const stats = rrBuckets.get(bucket) || { wins: 0, total: 0 };
      stats.total++;
      if (Number(trade.profit || 0) > 0) stats.wins++;
      rrBuckets.set(bucket, stats);
    });

    const bestRRBucket = Array.from(rrBuckets.entries())
      .filter(([, stats]) => stats.total >= 5)
      .sort((a, b) => b[1].wins / b[1].total - a[1].wins / a[1].total)[0];

    if (bestRRBucket && bestRRBucket[0] !== "medium") {
      insights.push({
        type: "rr_optimization",
        title: "R:R Sweet Spot Found",
        message: `Your ${bestRRBucket[0]} R:R trades (${
          bestRRBucket[0] === "low" ? "<2:1" : ">3:1"
        }) have a ${(
          (bestRRBucket[1].wins / bestRRBucket[1].total) *
          100
        ).toFixed(1)}% win rate. Consider adjusting your target strategy.`,
        severity: "success",
        data: {
          bucket: bestRRBucket[0],
          winRate: bestRRBucket[1].wins / bestRRBucket[1].total,
        },
      });
    }

    // 5. Time of day performance
    const hourStats = new Map<number, { profit: number; count: number }>();
    trades.forEach((trade) => {
      if (!trade.closeTime || trade.profit == null) return;
      const hour = trade.closeTime.getHours();
      const stats = hourStats.get(hour) || { profit: 0, count: 0 };
      stats.profit += Number(trade.profit);
      stats.count++;
      hourStats.set(hour, stats);
    });

    const worstHours = Array.from(hourStats.entries())
      .filter(([, stats]) => stats.count >= 3)
      .sort((a, b) => a[1].profit - b[1].profit)
      .slice(0, 2);

    if (worstHours.length > 0 && worstHours[0][1].profit < 0) {
      const [hour, stats] = worstHours[0];
      insights.push({
        type: "time_pattern",
        title: "Low performance time window",
        message: `Trading around ${hour}:00 has resulted in $${Math.abs(
          stats.profit
        ).toFixed(2)} in losses (${
          stats.count
        } trades). Consider avoiding this time window.`,
        severity: "warning",
        data: { hour, profit: stats.profit, count: stats.count },
      });
    }

    // 6. Asset performance - show ONLY profitable symbols
    const symbolStats = new Map<
      string,
      { profit: number; count: number; wins: number }
    >();
    trades.forEach((trade) => {
      if (!trade.symbol || trade.profit == null) return;
      const stats = symbolStats.get(trade.symbol) || {
        profit: 0,
        count: 0,
        wins: 0,
      };
      stats.profit += Number(trade.profit);
      stats.count++;
      if (Number(trade.profit) > 0) stats.wins++;
      symbolStats.set(trade.symbol, stats);
    });

    // Filter for profitable symbols only (positive total profit)
    const topSymbol = Array.from(symbolStats.entries())
      .filter(([, stats]) => stats.count >= 5 && stats.profit > 0)
      .sort((a, b) => b[1].profit - a[1].profit)[0];

    if (topSymbol) {
      const winRate = (topSymbol[1].wins / topSymbol[1].count) * 100;
      insights.push({
        type: "asset_performance",
        title: `${topSymbol[0]} is Your Top Performer`,
        message: `${topSymbol[0]} has generated $${topSymbol[1].profit.toFixed(
          2
        )} with a ${winRate.toFixed(1)}% win rate (${
          topSymbol[1].count
        } trades). Consider focusing more on this asset.`,
        severity: "success",
        data: { symbol: topSymbol[0], profit: topSymbol[1].profit, winRate },
      });
    }

    // 7. Streak detection
    let currentStreak = 0;
    let streakType: "win" | "loss" | null = null;
    const recentTrades = trades.slice(0, 10);

    for (const trade of recentTrades) {
      if (trade.profit == null) continue;
      const isWin = Number(trade.profit) > 0;

      if (streakType === null) {
        streakType = isWin ? "win" : "loss";
        currentStreak = 1;
      } else if (
        (streakType === "win" && isWin) ||
        (streakType === "loss" && !isWin)
      ) {
        currentStreak++;
      } else {
        break;
      }
    }

    if (currentStreak >= 3) {
      if (streakType === "win") {
        insights.push({
          type: "streak_alert",
          title: `🔥 ${currentStreak} Win Streak!`,
          message: `You're on a ${currentStreak}-trade winning streak! Stay disciplined and stick to your process.`,
          severity: "success",
          data: { streak: currentStreak, type: "win" },
        });
      } else {
        insights.push({
          type: "streak_alert",
          title: `Losing Streak - Stay Focused`,
          message: `You've had ${currentStreak} consecutive losses. Take a break, review your setup checklist, and avoid revenge trading.`,
          severity: "warning",
          data: { streak: currentStreak, type: "loss" },
        });
      }
    }

    return insights;
  } catch (error) {
    console.error("Error generating insights:", error);
    return [];
  }
}

/**
 * Get a random insight for periodic notifications
 */
export async function getRandomInsight(
  accountId: string
): Promise<Insight | null> {
  const insights = await generateInsights(accountId);
  if (insights.length === 0) return null;
  return insights[Math.floor(Math.random() * insights.length)];
}
