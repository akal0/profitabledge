interface TradeRow {
  pnl: string | null;
  pnlPercent: string | null;
  pnlPips: string | null;
  realizedRR: string | null;
  holdTimeSeconds: number | null;
  entryTime: Date;
  exitTime: Date | null;
  direction: string;
  mfePips: string | null;
  maePips: string | null;
}

export interface BacktestEquityPoint {
  time: string;
  equity: number;
  tradeIndex: number;
}

export interface BacktestDrawdownPoint {
  time: string;
  drawdown: number;
  drawdownPercent: number;
}

export function calculateSessionStats(
  trades: TradeRow[],
  initialBalance: number
) {
  if (trades.length === 0) {
    return {
      finalBalance: String(initialBalance),
      finalEquity: String(initialBalance),
      totalPnL: "0",
      totalPnLPercent: "0",
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: "0",
      profitFactor: "0",
      maxDrawdown: "0",
      maxDrawdownPercent: "0",
      sharpeRatio: "0",
      averageRR: "0",
      averageWin: "0",
      averageLoss: "0",
      largestWin: "0",
      largestLoss: "0",
      longestWinStreak: 0,
      longestLoseStreak: 0,
      averageHoldTimeSeconds: 0,
    };
  }

  const pnls = trades.map((trade) => Number(trade.pnl || 0));
  const totalPnL = pnls.reduce((sum, pnl) => sum + pnl, 0);
  const finalBalance = initialBalance + totalPnL;

  const wins = pnls.filter((pnl) => pnl > 0);
  const losses = pnls.filter((pnl) => pnl < 0);

  const totalWins = wins.reduce((sum, pnl) => sum + pnl, 0);
  const totalLosses = Math.abs(losses.reduce((sum, pnl) => sum + pnl, 0));

  const averageWin = wins.length > 0 ? totalWins / wins.length : 0;
  const averageLoss = losses.length > 0 ? totalLosses / losses.length : 0;
  const profitFactor =
    totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

  let peak = initialBalance;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  let runningBalance = initialBalance;
  for (const pnl of pnls) {
    runningBalance += pnl;
    if (runningBalance > peak) peak = runningBalance;
    const drawdown = peak - runningBalance;
    const drawdownPercentCandidate = peak > 0 ? drawdown / peak : 0;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    if (drawdownPercentCandidate > maxDrawdownPercent) {
      maxDrawdownPercent = drawdownPercentCandidate;
    }
  }

  const mean = pnls.length > 0 ? pnls.reduce((sum, pnl) => sum + pnl, 0) / pnls.length : 0;
  const variance =
    pnls.length > 1
      ? pnls.reduce((sum, pnl) => sum + (pnl - mean) ** 2, 0) /
        (pnls.length - 1)
      : 0;
  const standardDeviation = Math.sqrt(variance);
  const sharpeRatio =
    standardDeviation > 0 ? (mean / standardDeviation) * Math.sqrt(252) : 0;

  const realizedRiskRewards = trades
    .filter((trade) => trade.realizedRR !== null)
    .map((trade) => Number(trade.realizedRR));
  const averageRiskReward =
    realizedRiskRewards.length > 0
      ? realizedRiskRewards.reduce((sum, rr) => sum + rr, 0) /
        realizedRiskRewards.length
      : 0;

  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  for (const pnl of pnls) {
    if (pnl > 0) {
      currentWinStreak += 1;
      currentLossStreak = 0;
      if (currentWinStreak > longestWinStreak) {
        longestWinStreak = currentWinStreak;
      }
    } else {
      currentLossStreak += 1;
      currentWinStreak = 0;
      if (currentLossStreak > longestLossStreak) {
        longestLossStreak = currentLossStreak;
      }
    }
  }

  const holdTimes = trades
    .filter((trade) => trade.holdTimeSeconds !== null)
    .map((trade) => trade.holdTimeSeconds!);
  const averageHoldTimeSeconds =
    holdTimes.length > 0
      ? Math.round(holdTimes.reduce((sum, holdTime) => sum + holdTime, 0) / holdTimes.length)
      : 0;

  return {
    finalBalance: String(finalBalance),
    finalEquity: String(finalBalance),
    totalPnL: String(totalPnL),
    totalPnLPercent: String((totalPnL / initialBalance) * 100),
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate: String(trades.length > 0 ? (wins.length / trades.length) * 100 : 0),
    profitFactor: String(Math.min(profitFactor, 999)),
    maxDrawdown: String(maxDrawdown),
    maxDrawdownPercent: String(maxDrawdownPercent * 100),
    sharpeRatio: String(sharpeRatio),
    averageRR: String(averageRiskReward),
    averageWin: String(averageWin),
    averageLoss: String(averageLoss),
    largestWin: String(wins.length > 0 ? Math.max(...wins) : 0),
    largestLoss: String(losses.length > 0 ? Math.min(...losses) : 0),
    longestWinStreak,
    longestLoseStreak: longestLossStreak,
    averageHoldTimeSeconds,
  };
}

export function buildEquityCurve(
  trades: TradeRow[],
  initialBalance: number
): BacktestEquityPoint[] {
  const curve: BacktestEquityPoint[] = [
    { time: "", equity: initialBalance, tradeIndex: -1 },
  ];
  let runningEquity = initialBalance;

  for (const [tradeIndex, trade] of trades.entries()) {
    runningEquity += Number(trade.pnl || 0);
    curve.push({
      time: trade.exitTime?.toISOString() || trade.entryTime.toISOString(),
      equity: runningEquity,
      tradeIndex,
    });
  }

  return curve;
}

export function buildDrawdownSeries(
  equityCurve: BacktestEquityPoint[]
): BacktestDrawdownPoint[] {
  let peak = equityCurve[0]?.equity || 0;
  return equityCurve.map((point) => {
    if (point.equity > peak) peak = point.equity;
    const drawdown = peak - point.equity;
    const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;
    return { time: point.time, drawdown, drawdownPercent };
  });
}
