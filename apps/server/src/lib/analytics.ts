export type TradeInput = {
  profit: string | number | null;
  openPrice?: string | number | null;
  closePrice?: string | number | null;
  sl?: string | number | null;
  tp?: string | number | null;
  volume?: string | number | null;
  symbol?: string | null;
  session?: string | null;
  openTime?: Date | string | null;
  closeTime?: Date | string | null;
  plannedRr?: string | number | null;
  realisedRR?: string | number | null;
  protocolAlignment?: string | null;
  maePips?: string | number | null;
  mfePips?: string | number | null;
  rrCaptureEfficiency?: string | number | null;
  manipRREfficiency?: string | number | null;
  exitEfficiency?: string | number | null;
};

export type TradeStats = {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  netPnL: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  expectancy: number;
  avgRR: number;
  medianRR: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  bestTrade: number;
  worstTrade: number;
  avgTradeDuration: number;
  SharpeRatio?: number;
};

export type SessionStats = {
  session: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalProfit: number;
  avgProfit: number;
};

export type SymbolStats = {
  symbol: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalProfit: number;
  avgProfit: number;
};

export type HourlyStats = {
  hour: number;
  trades: number;
  wins: number;
  profit: number;
  winRate: number;
};

export type RRBucketStats = {
  bucket: "low" | "medium" | "high";
  range: string;
  trades: number;
  wins: number;
  winRate: number;
};

export type DrawdownResult = {
  maxDrawdown: number;
  maxDrawdownPercent: number;
  peakEquity: number;
  troughEquity: number;
  drawdownDuration: number;
};

export type StreakInfo = {
  currentStreak: number;
  streakType: "win" | "loss" | null;
  longestWinStreak: number;
  longestLossStreak: number;
};

function toNumber(val: string | number | null | undefined): number {
  if (val == null) return 0;
  const num = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(num) ? 0 : num;
}

export function isWinningTrade(trade: TradeInput): boolean {
  return toNumber(trade.profit) > 0;
}

export function isLosingTrade(trade: TradeInput): boolean {
  return toNumber(trade.profit) < 0;
}

export function calculateWinRate(trades: TradeInput[]): number {
  if (trades.length === 0) return 0;
  const wins = trades.filter(isWinningTrade).length;
  return (wins / trades.length) * 100;
}

export function calculateWinCount(trades: TradeInput[]): number {
  return trades.filter(isWinningTrade).length;
}

export function calculateLossCount(trades: TradeInput[]): number {
  return trades.filter(isLosingTrade).length;
}

export function calculateTotalProfit(trades: TradeInput[]): number {
  return trades
    .filter(isWinningTrade)
    .reduce((sum, t) => sum + toNumber(t.profit), 0);
}

export function calculateTotalLoss(trades: TradeInput[]): number {
  return Math.abs(
    trades
      .filter(isLosingTrade)
      .reduce((sum, t) => sum + toNumber(t.profit), 0)
  );
}

export function calculateNetPnL(trades: TradeInput[]): number {
  return trades.reduce((sum, t) => sum + toNumber(t.profit), 0);
}

export function calculateAvgWin(trades: TradeInput[]): number {
  const winners = trades.filter(isWinningTrade);
  if (winners.length === 0) return 0;
  return calculateTotalProfit(winners) / winners.length;
}

export function calculateAvgLoss(trades: TradeInput[]): number {
  const losers = trades.filter(isLosingTrade);
  if (losers.length === 0) return 0;
  return calculateTotalLoss(losers) / losers.length;
}

export function calculateProfitFactor(trades: TradeInput[]): number {
  const totalProfit = calculateTotalProfit(trades);
  const totalLoss = calculateTotalLoss(trades);
  if (totalLoss === 0) return totalProfit > 0 ? Infinity : 0;
  return totalProfit / totalLoss;
}

export function calculateExpectancy(trades: TradeInput[]): number {
  const winRate = calculateWinRate(trades) / 100;
  const avgWin = calculateAvgWin(trades);
  const avgLoss = calculateAvgLoss(trades);
  return winRate * avgWin - (1 - winRate) * avgLoss;
}

export function calculateRRValues(trades: TradeInput[]): number[] {
  return trades
    .map((t) => toNumber(t.realisedRR))
    .filter((r) => r !== 0 && !isNaN(r))
    .sort((a, b) => a - b);
}

export function calculateAvgRR(trades: TradeInput[]): number {
  const rrValues = calculateRRValues(trades);
  if (rrValues.length === 0) return 0;
  return rrValues.reduce((sum, r) => sum + r, 0) / rrValues.length;
}

export function calculateMedianRR(trades: TradeInput[]): number {
  const rrValues = calculateRRValues(trades);
  if (rrValues.length === 0) return 0;
  const mid = Math.floor(rrValues.length / 2);
  return rrValues.length % 2 !== 0
    ? rrValues[mid]
    : (rrValues[mid - 1] + rrValues[mid]) / 2;
}

export function calculateDrawdown(trades: TradeInput[]): DrawdownResult {
  if (trades.length === 0) {
    return {
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      peakEquity: 0,
      troughEquity: 0,
      drawdownDuration: 0,
    };
  }

  let runningSum = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let peakEquity = 0;
  let troughEquity = 0;
  let drawdownStart = 0;

  for (let i = 0; i < trades.length; i++) {
    runningSum += toNumber(trades[i].profit);
    if (runningSum > peak) {
      peak = runningSum;
      peakEquity = runningSum;
      drawdownStart = i;
    }
    const drawdown = peak - runningSum;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      troughEquity = runningSum;
    }
  }

  const maxDrawdownPercent = peak > 0 ? (maxDrawdown / peak) * 100 : 0;

  return {
    maxDrawdown,
    maxDrawdownPercent,
    peakEquity,
    troughEquity,
    drawdownDuration: trades.length - drawdownStart,
  };
}

export function calculateStreaks(trades: TradeInput[]): StreakInfo {
  let currentStreak = 0;
  let streakType: "win" | "loss" | null = null;
  let longestWinStreak = 0;
  let longestLossStreak = 0;

  for (const trade of trades) {
    const isWin = isWinningTrade(trade);
    const isLoss = isLosingTrade(trade);

    if (streakType === null) {
      if (isWin) {
        streakType = "win";
        currentStreak = 1;
        longestWinStreak = 1;
      } else if (isLoss) {
        streakType = "loss";
        currentStreak = 1;
        longestLossStreak = 1;
      }
    } else if (streakType === "win" && isWin) {
      currentStreak++;
      longestWinStreak = Math.max(longestWinStreak, currentStreak);
    } else if (streakType === "loss" && isLoss) {
      currentStreak++;
      longestLossStreak = Math.max(longestLossStreak, currentStreak);
    } else if (isWin) {
      streakType = "win";
      currentStreak = 1;
    } else if (isLoss) {
      streakType = "loss";
      currentStreak = 1;
    } else {
      streakType = null;
      currentStreak = 0;
    }
  }

  return {
    currentStreak,
    streakType,
    longestWinStreak,
    longestLossStreak,
  };
}

export function calculateSessionStats(trades: TradeInput[]): SessionStats[] {
  const sessionMap = new Map<
    string,
    { trades: TradeInput[]; wins: number; profit: number }
  >();

  for (const trade of trades) {
    if (!trade.session) continue;
    const session = trade.session;
    const stats = sessionMap.get(session) || {
      trades: [],
      wins: 0,
      profit: 0,
    };
    stats.trades.push(trade);
    if (isWinningTrade(trade)) stats.wins++;
    stats.profit += toNumber(trade.profit);
    sessionMap.set(session, stats);
  }

  return Array.from(sessionMap.entries())
    .map(([session, stats]) => ({
      session,
      trades: stats.trades.length,
      wins: stats.wins,
      losses: stats.trades.length - stats.wins,
      winRate:
        stats.trades.length > 0
          ? (stats.wins / stats.trades.length) * 100
          : 0,
      totalProfit: stats.profit,
      avgProfit:
        stats.trades.length > 0
          ? stats.profit / stats.trades.length
          : 0,
    }))
    .sort((a, b) => b.winRate - a.winRate);
}

export function calculateSymbolStats(trades: TradeInput[]): SymbolStats[] {
  const symbolMap = new Map<
    string,
    { trades: TradeInput[]; wins: number; profit: number }
  >();

  for (const trade of trades) {
    if (!trade.symbol) continue;
    const symbol = trade.symbol;
    const stats = symbolMap.get(symbol) || {
      trades: [],
      wins: 0,
      profit: 0,
    };
    stats.trades.push(trade);
    if (isWinningTrade(trade)) stats.wins++;
    stats.profit += toNumber(trade.profit);
    symbolMap.set(symbol, stats);
  }

  return Array.from(symbolMap.entries())
    .map(([symbol, stats]) => ({
      symbol,
      trades: stats.trades.length,
      wins: stats.wins,
      losses: stats.trades.length - stats.wins,
      winRate:
        stats.trades.length > 0
          ? (stats.wins / stats.trades.length) * 100
          : 0,
      totalProfit: stats.profit,
      avgProfit:
        stats.trades.length > 0
          ? stats.profit / stats.trades.length
          : 0,
    }))
    .sort((a, b) => b.totalProfit - a.totalProfit);
}

export function calculateHourlyStats(trades: TradeInput[]): HourlyStats[] {
  const hourMap = new Map<number, { trades: number; wins: number; profit: number }>();

  for (const trade of trades) {
    if (!trade.closeTime) continue;
    const hour = new Date(trade.closeTime).getHours();
    const stats = hourMap.get(hour) || { trades: 0, wins: 0, profit: 0 };
    stats.trades++;
    if (isWinningTrade(trade)) stats.wins++;
    stats.profit += toNumber(trade.profit);
    hourMap.set(hour, stats);
  }

  return Array.from(hourMap.entries())
    .map(([hour, stats]) => ({
      hour,
      trades: stats.trades,
      wins: stats.wins,
      profit: stats.profit,
      winRate: stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0,
    }))
    .sort((a, b) => a.hour - b.hour);
}

export function calculateRRBucketStats(trades: TradeInput[]): RRBucketStats[] {
  const bucketMap = new Map<string, { trades: number; wins: number }>();

  for (const trade of trades) {
    const rr = toNumber(trade.plannedRr);
    if (rr === 0) continue;
    const bucket: "low" | "medium" | "high" =
      rr < 2 ? "low" : rr < 3.5 ? "medium" : "high";
    const stats = bucketMap.get(bucket) || { trades: 0, wins: 0 };
    stats.trades++;
    if (isWinningTrade(trade)) stats.wins++;
    bucketMap.set(bucket, stats);
  }

  const ranges: Record<"low" | "medium" | "high", string> = {
    low: "< 2:1",
    medium: "2:1 - 3.5:1",
    high: "> 3.5:1",
  };

  return (["low", "medium", "high"] as const).map((bucket) => {
    const stats = bucketMap.get(bucket) || { trades: 0, wins: 0 };
    return {
      bucket,
      range: ranges[bucket],
      trades: stats.trades,
      wins: stats.wins,
      winRate:
        stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0,
    };
  });
}

export function calculateProtocolAlignment(trades: TradeInput[]): {
  aligned: { count: number; winRate: number; profit: number };
  against: { count: number; winRate: number; profit: number };
  discretionary: { count: number; winRate: number; profit: number };
} {
  const groups = {
    aligned: { trades: [] as TradeInput[], profit: 0 },
    against: { trades: [] as TradeInput[], profit: 0 },
    discretionary: { trades: [] as TradeInput[], profit: 0 },
  };

  for (const trade of trades) {
    const alignment = trade.protocolAlignment?.toLowerCase();
    if (alignment === "aligned") {
      groups.aligned.trades.push(trade);
      groups.aligned.profit += toNumber(trade.profit);
    } else if (alignment === "against") {
      groups.against.trades.push(trade);
      groups.against.profit += toNumber(trade.profit);
    } else {
      groups.discretionary.trades.push(trade);
      groups.discretionary.profit += toNumber(trade.profit);
    }
  }

  return {
    aligned: {
      count: groups.aligned.trades.length,
      winRate: calculateWinRate(groups.aligned.trades),
      profit: groups.aligned.profit,
    },
    against: {
      count: groups.against.trades.length,
      winRate: calculateWinRate(groups.against.trades),
      profit: groups.against.profit,
    },
    discretionary: {
      count: groups.discretionary.trades.length,
      winRate: calculateWinRate(groups.discretionary.trades),
      profit: groups.discretionary.profit,
    },
  };
}

export function calculateExecutionEfficiency(trades: TradeInput[]): {
  avgRRCapture: number;
  avgManipRREfficiency: number;
  avgExitEfficiency: number;
} {
  const rrCaptures = trades
    .map((t) => toNumber(t.rrCaptureEfficiency))
    .filter((e) => e > 0);

  const manipEfficiencies = trades
    .map((t) => toNumber(t.manipRREfficiency))
    .filter((e) => e > 0);

  const exitEfficiencies = trades
    .map((t) => toNumber(t.exitEfficiency))
    .filter((e) => e > 0);

  return {
    avgRRCapture:
      rrCaptures.length > 0
        ? rrCaptures.reduce((s, e) => s + e, 0) / rrCaptures.length
        : 0,
    avgManipRREfficiency:
      manipEfficiencies.length > 0
        ? manipEfficiencies.reduce((s, e) => s + e, 0) / manipEfficiencies.length
        : 0,
    avgExitEfficiency:
      exitEfficiencies.length > 0
        ? exitEfficiencies.reduce((s, e) => s + e, 0) / exitEfficiencies.length
        : 0,
  };
}

export function calculateMFE_MAE(trades: TradeInput[]): {
  avgMFE: number;
  avgMAE: number;
  mfesOnWinners: number;
  maesOnWinners: number;
  mfesOnLosers: number;
  maesOnLosers: number;
} {
  const mfes = trades.map((t) => toNumber(t.mfePips)).filter((m) => m > 0);
  const maes = trades.map((t) => toNumber(t.maePips)).filter((m) => m > 0);

  const winners = trades.filter(isWinningTrade);
  const losers = trades.filter(isLosingTrade);

  const mfesWinners = winners.map((t) => toNumber(t.mfePips)).filter((m) => m > 0);
  const maesWinners = winners.map((t) => toNumber(t.maePips)).filter((m) => m > 0);
  const mfesLosers = losers.map((t) => toNumber(t.mfePips)).filter((m) => m > 0);
  const maesLosers = losers.map((t) => toNumber(t.maePips)).filter((m) => m > 0);

  const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);

  return {
    avgMFE: avg(mfes),
    avgMAE: avg(maes),
    mfesOnWinners: avg(mfesWinners),
    maesOnWinners: avg(maesWinners),
    mfesOnLosers: avg(mfesLosers),
    maesOnLosers: avg(maesLosers),
  };
}

export function calculateFullStats(trades: TradeInput[]): TradeStats {
  const drawdown = calculateDrawdown(trades);
  const winners = trades.filter(isWinningTrade);
  const losers = trades.filter(isLosingTrade);
  const profits = trades.map((t) => toNumber(t.profit));

  let avgDuration = 0;
  const durations: number[] = [];
  for (const trade of trades) {
    if (trade.openTime && trade.closeTime) {
      const open = new Date(trade.openTime);
      const close = new Date(trade.closeTime);
      durations.push((close.getTime() - open.getTime()) / 1000);
    }
  }
  if (durations.length > 0) {
    avgDuration = durations.reduce((s, d) => s + d, 0) / durations.length;
  }

  return {
    totalTrades: trades.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
    winRate: calculateWinRate(trades),
    totalProfit: calculateTotalProfit(trades),
    totalLoss: calculateTotalLoss(trades),
    netPnL: calculateNetPnL(trades),
    avgWin: calculateAvgWin(trades),
    avgLoss: calculateAvgLoss(trades),
    profitFactor: calculateProfitFactor(trades),
    expectancy: calculateExpectancy(trades),
    avgRR: calculateAvgRR(trades),
    medianRR: calculateMedianRR(trades),
    maxDrawdown: drawdown.maxDrawdown,
    maxDrawdownPercent: drawdown.maxDrawdownPercent,
    bestTrade: profits.length > 0 ? Math.max(...profits) : 0,
    worstTrade: profits.length > 0 ? Math.min(...profits) : 0,
    avgTradeDuration: avgDuration,
  };
}

export function getPerformanceScore(trades: TradeInput[]): {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  factors: {
    winRate: { score: number; weight: number };
    profitFactor: { score: number; weight: number };
    expectancy: { score: number; weight: number };
    drawdown: { score: number; weight: number };
    rr: { score: number; weight: number };
  };
} {
  const stats = calculateFullStats(trades);

  const winRateScore = stats.winRate >= 60 ? 10 : stats.winRate >= 50 ? 7 : stats.winRate >= 40 ? 5 : 3;
  const pfScore =
    stats.profitFactor >= 2 ? 10 : stats.profitFactor >= 1.5 ? 8 : stats.profitFactor >= 1 ? 6 : 3;
  const expScore = stats.expectancy >= 50 ? 10 : stats.expectancy >= 20 ? 7 : stats.expectancy >= 0 ? 5 : 2;
  const ddScore =
    stats.maxDrawdownPercent <= 5 ? 10 : stats.maxDrawdownPercent <= 10 ? 8 : stats.maxDrawdownPercent <= 20 ? 5 : 2;
  const rrScore = stats.avgRR >= 2 ? 10 : stats.avgRR >= 1 ? 7 : stats.avgRR >= 0.5 ? 5 : 3;

  const factors = {
    winRate: { score: winRateScore, weight: 0.25 },
    profitFactor: { score: pfScore, weight: 0.25 },
    expectancy: { score: expScore, weight: 0.2 },
    drawdown: { score: ddScore, weight: 0.15 },
    rr: { score: rrScore, weight: 0.15 },
  };

  const score =
    factors.winRate.score * factors.winRate.weight +
    factors.profitFactor.score * factors.profitFactor.weight +
    factors.expectancy.score * factors.expectancy.weight +
    factors.drawdown.score * factors.drawdown.weight +
    factors.rr.score * factors.rr.weight;

  const grade: "A" | "B" | "C" | "D" | "F" =
    score >= 8.5 ? "A" : score >= 7 ? "B" : score >= 5.5 ? "C" : score >= 4 ? "D" : "F";

  return { score, grade, factors };
}

export const analytics = {
  calculateWinRate,
  calculateWinCount,
  calculateLossCount,
  calculateTotalProfit,
  calculateTotalLoss,
  calculateNetPnL,
  calculateAvgWin,
  calculateAvgLoss,
  calculateProfitFactor,
  calculateExpectancy,
  calculateAvgRR,
  calculateMedianRR,
  calculateDrawdown,
  calculateStreaks,
  calculateSessionStats,
  calculateSymbolStats,
  calculateHourlyStats,
  calculateRRBucketStats,
  calculateProtocolAlignment,
  calculateExecutionEfficiency,
  calculateMFE_MAE,
  calculateFullStats,
  getPerformanceScore,
  isWinningTrade,
  isLosingTrade,
};

export default analytics;
