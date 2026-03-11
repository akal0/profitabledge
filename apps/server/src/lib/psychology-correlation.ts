/**
 * Psychology Correlation Service
 * 
 * Analyzes correlations between psychology states and trading performance.
 * Helps traders understand how their mental state affects their results.
 */

import { db } from "../db";
import { 
  journalEntry, 
  psychologyCorrelation,
  type PsychologySnapshot 
} from "../db/schema/journal";
import { trade, tradingAccount } from "../db/schema/trading";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

export interface CorrelationResult {
  metric: string;
  psychologyFactor: string;
  correlationCoefficient: number;
  sampleSize: number;
  significance: 'high' | 'medium' | 'low' | 'none';
  insights: {
    bestConditions: string;
    worstConditions: string;
    recommendation: string;
    dataPoints: { x: number; y: number }[];
  };
}

const PSYCHOLOGY_FACTORS: (keyof PsychologySnapshot)[] = [
  'mood',
  'confidence', 
  'energy',
  'focus',
  'fear',
  'greed'
];

const PERFORMANCE_METRICS = ['winRate', 'profit', 'rr', 'holdTime'] as const;

export async function calculatePsychologyCorrelations(
  userId: string,
  accountId?: string,
  periodDays: number = 30
): Promise<CorrelationResult[]> {
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - periodDays);
  
  const entriesWithPsychology = await db
    .select()
    .from(journalEntry)
    .where(and(
      eq(journalEntry.userId, userId),
      gte(journalEntry.createdAt, periodStart),
      sql`${journalEntry.psychology} IS NOT NULL`
    ))
    .orderBy(desc(journalEntry.createdAt));

  if (entriesWithPsychology.length < 10) {
    return [];
  }

  const entriesWithTrades = await Promise.all(
    entriesWithPsychology.map(async (entry) => {
      let linkedTrades: typeof trade.$inferSelect[] = [];
      
      if (entry.linkedTradeIds && entry.linkedTradeIds.length > 0) {
        const tradeConditions = entry.linkedTradeIds.map(tid => eq(trade.id, tid));
        linkedTrades = await db
          .select()
          .from(trade)
          .where(and(...tradeConditions, accountId ? eq(trade.accountId, accountId) : undefined!));
      } else if (entry.journalDate) {
        const dayStart = new Date(entry.journalDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(entry.journalDate);
        dayEnd.setHours(23, 59, 59, 999);
        
        linkedTrades = await db
          .select()
          .from(trade)
          .innerJoin(tradingAccount, eq(trade.accountId, tradingAccount.id))
          .where(and(
            eq(tradingAccount.userId, userId),
            gte(trade.closeTime, dayStart),
            lte(trade.closeTime, dayEnd),
            accountId ? eq(trade.accountId, accountId) : undefined!
          ))
          .then(rows => rows.map(r => r.trade));
      }
      
      return {
        entry,
        trades: linkedTrades,
        psychology: entry.psychology as PsychologySnapshot
      };
    })
  );

  const validEntries = entriesWithTrades.filter(e => e.trades.length > 0);
  
  if (validEntries.length < 10) {
    return [];
  }

  const results: CorrelationResult[] = [];
  
  for (const factor of PSYCHOLOGY_FACTORS) {
    for (const metric of PERFORMANCE_METRICS) {
      const correlation = calculateCorrelation(validEntries, factor, metric);
      if (correlation) {
        results.push(correlation);
      }
    }
  }

  await updateCorrelationCache(userId, accountId, results, periodStart, new Date());

  return results;
}

function calculateCorrelation(
  entries: Array<{ entry: typeof journalEntry.$inferSelect; trades: typeof trade.$inferSelect[]; psychology: PsychologySnapshot }>,
  factor: keyof PsychologySnapshot,
  metric: typeof PERFORMANCE_METRICS[number]
): CorrelationResult | null {
  const dataPoints: { x: number; y: number }[] = [];
  
  for (const { trades, psychology } of entries) {
    const factorValue = psychology[factor];
    if (typeof factorValue !== 'number') continue;
    
    for (const t of trades) {
      let metricValue: number | null = null;
      
      switch (metric) {
        case 'winRate':
          metricValue = Number(t.profit || 0) > 0 ? 1 : 0;
          break;
        case 'profit':
          metricValue = Number(t.profit || 0);
          break;
        case 'rr':
          if (t.plannedRR && Number(t.plannedRR) > 0) {
            const risk = Number(t.plannedRiskPips || 1);
            const profitPips = Number(t.pips || 0);
            metricValue = profitPips / risk;
          } else if (t.realisedRR) {
            metricValue = Number(t.realisedRR);
          }
          break;
        case 'holdTime':
          if (t.openTime && t.closeTime) {
            metricValue = (new Date(t.closeTime).getTime() - new Date(t.openTime).getTime()) / 1000 / 60;
          }
          break;
      }
      
      if (metricValue !== null) {
        dataPoints.push({ x: factorValue, y: metricValue });
      }
    }
  }
  
  if (dataPoints.length < 10) {
    return null;
  }
  
  const correlation = pearsonCorrelation(dataPoints);
  const significance = getSignificance(Math.abs(correlation), dataPoints.length);
  
  const { bestConditions, worstConditions, recommendation } = analyzeConditions(dataPoints, factor, metric);
  
  return {
    metric,
    psychologyFactor: factor,
    correlationCoefficient: correlation,
    sampleSize: dataPoints.length,
    significance,
    insights: {
      bestConditions,
      worstConditions,
      recommendation,
      dataPoints
    }
  };
}

function pearsonCorrelation(points: { x: number; y: number }[]): number {
  const n = points.length;
  if (n < 2) return 0;
  
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const sumY2 = points.reduce((s, p) => s + p.y * p.y, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  if (denominator === 0) return 0;
  
  return numerator / denominator;
}

function getSignificance(correlation: number, sampleSize: number): 'high' | 'medium' | 'low' | 'none' {
  if (sampleSize < 15) return 'none';
  if (correlation < 0.2) return 'none';
  if (correlation < 0.4) return 'low';
  if (correlation < 0.6) return 'medium';
  return 'high';
}

function analyzeConditions(
  points: { x: number; y: number }[],
  factor: string,
  metric: string
): { bestConditions: string; worstConditions: string; recommendation: string } {
  const byX: Record<number, number[]> = {};
  
  for (const p of points) {
    const bucket = Math.round(p.x);
    if (!byX[bucket]) byX[bucket] = [];
    byX[bucket].push(p.y);
  }
  
  const averages = Object.entries(byX).map(([bucket, values]) => ({
    bucket: Number(bucket),
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    count: values.length
  })).filter(a => a.count >= 2);
  
  averages.sort((a, b) => b.avg - a.avg);
  
  const best = averages[0];
  const worst = averages[averages.length - 1];
  
  const factorLabel = factor.charAt(0).toUpperCase() + factor.slice(1);
  const metricLabel = metric === 'winRate' ? 'Win Rate' : 
                      metric === 'profit' ? 'Profit' :
                      metric === 'rr' ? 'R:R Achieved' : 'Hold Time';
  
  let recommendation = '';
  const correlation = pearsonCorrelation(points);
  
  if (correlation > 0.3) {
    recommendation = `Higher ${factorLabel} tends to correlate with better ${metricLabel}. Consider trading only when ${factorLabel} is above ${(best?.bucket || 7) - 1}.`;
  } else if (correlation < -0.3) {
    recommendation = `Lower ${factorLabel} tends to correlate with better ${metricLabel}. Be cautious when ${factorLabel} is very high.`;
  } else {
    recommendation = `No strong correlation found between ${factorLabel} and ${metricLabel}. Focus on other factors.`;
  }
  
  return {
    bestConditions: best ? `${factorLabel} at ${best.bucket}/10: Avg ${metricLabel} ${formatMetric(best.avg, metric)}` : 'Insufficient data',
    worstConditions: worst ? `${factorLabel} at ${worst.bucket}/10: Avg ${metricLabel} ${formatMetric(worst.avg, metric)}` : 'Insufficient data',
    recommendation
  };
}

function formatMetric(value: number, metric: string): string {
  switch (metric) {
    case 'winRate':
      return `${(value * 100).toFixed(1)}%`;
    case 'profit':
      return `$${value.toFixed(2)}`;
    case 'rr':
      return `${value.toFixed(2)}R`;
    case 'holdTime':
      return `${value.toFixed(0)} min`;
    default:
      return value.toFixed(2);
  }
}

async function updateCorrelationCache(
  userId: string,
  accountId: string | undefined,
  results: CorrelationResult[],
  periodStart: Date,
  periodEnd: Date
): Promise<void> {
  await db
    .delete(psychologyCorrelation)
    .where(and(
      eq(psychologyCorrelation.userId, userId),
      accountId ? eq(psychologyCorrelation.accountId, accountId) : undefined!
    ));
  
  if (results.length === 0) return;
  
  await db.insert(psychologyCorrelation).values(
    results.map(r => ({
      userId,
      accountId,
      metric: r.metric,
      psychologyFactor: r.psychologyFactor,
      correlationCoefficient: r.correlationCoefficient.toString(),
      sampleSize: r.sampleSize,
      significance: r.significance,
      insights: r.insights,
      periodStart,
      periodEnd
    }))
  );
}

export async function getCachedCorrelations(
  userId: string,
  accountId?: string
): Promise<CorrelationResult[]> {
  const cached = await db
    .select()
    .from(psychologyCorrelation)
    .where(and(
      eq(psychologyCorrelation.userId, userId),
      accountId ? eq(psychologyCorrelation.accountId, accountId) : undefined!
    ))
    .orderBy(desc(psychologyCorrelation.correlationCoefficient));
  
  return cached.map(c => ({
    metric: c.metric,
    psychologyFactor: c.psychologyFactor,
    correlationCoefficient: Number(c.correlationCoefficient),
    sampleSize: c.sampleSize,
    significance: c.significance as 'high' | 'medium' | 'low' | 'none',
    insights: c.insights as CorrelationResult['insights']
  }));
}

export async function getBestTradingConditions(
  userId: string,
  accountId?: string
): Promise<{
  optimalPsychology: Partial<PsychologySnapshot>;
  recommendations: string[];
}> {
  const correlations = await getCachedCorrelations(userId, accountId);
  
  if (correlations.length === 0) {
    const recentCorrelations = await calculatePsychologyCorrelations(userId, accountId, 30);
    if (recentCorrelations.length === 0) {
      return {
        optimalPsychology: {},
        recommendations: ['Not enough data to determine optimal trading conditions. Keep journaling!']
      };
    }
    correlations.push(...recentCorrelations);
  }
  
  const optimal: Partial<PsychologySnapshot> = {};
  const recommendations: string[] = [];
  
  for (const factor of PSYCHOLOGY_FACTORS) {
    const factorCorrelations = correlations.filter(c => c.psychologyFactor === factor);
    if (factorCorrelations.length === 0) continue;
    
    const avgCorrelation = factorCorrelations.reduce((s, c) => s + c.correlationCoefficient, 0) / factorCorrelations.length;
    
    if (avgCorrelation > 0.3) {
      const highPerforming = factorCorrelations
        .flatMap(c => c.insights.dataPoints)
        .filter(p => p.y > 0)
        .sort((a, b) => b.x - a.x);
      
      if (highPerforming.length > 0) {
        const optimalValue = Math.round(highPerforming.slice(0, Math.ceil(highPerforming.length / 3))
          .reduce((s, p) => s + p.x, 0) / Math.ceil(highPerforming.length / 3));
        (optimal as any)[factor] = optimalValue;
        recommendations.push(`Trade when ${factor} is ${optimalValue}/10 or higher for better performance.`);
      }
    } else if (avgCorrelation < -0.3) {
      recommendations.push(`High ${factor} may negatively impact your trading. Consider mindfulness when ${factor} is elevated.`);
    }
  }
  
  return { optimalPsychology: optimal, recommendations };
}
