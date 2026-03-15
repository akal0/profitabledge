export interface AchievementSnapshot {
  totalTrades: number;
  totalPnl: number;
  winRate: number;
  profitFactor: number;
  maxWinStreak: number;
  maxGreenStreak: number;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  isEarned: (snapshot: AchievementSnapshot) => boolean;
}

export const achievementDefinitions: AchievementDefinition[] = [
  {
    id: "first_trade",
    name: "First Trade",
    description: "Complete your first trade",
    icon: "🏁",
    isEarned: (snapshot) => snapshot.totalTrades >= 1,
  },
  {
    id: "ten_trades",
    name: "Getting Started",
    description: "Complete 10 trades",
    icon: "📊",
    isEarned: (snapshot) => snapshot.totalTrades >= 10,
  },
  {
    id: "fifty_trades",
    name: "Committed Trader",
    description: "Complete 50 trades",
    icon: "💪",
    isEarned: (snapshot) => snapshot.totalTrades >= 50,
  },
  {
    id: "hundred_trades",
    name: "Centurion",
    description: "Complete 100 trades",
    icon: "🎯",
    isEarned: (snapshot) => snapshot.totalTrades >= 100,
  },
  {
    id: "five_hundred_trades",
    name: "Veteran",
    description: "Complete 500 trades",
    icon: "⭐",
    isEarned: (snapshot) => snapshot.totalTrades >= 500,
  },
  {
    id: "first_profit",
    name: "In the Green",
    description: "Achieve overall positive P&L",
    icon: "💚",
    isEarned: (snapshot) => snapshot.totalPnl > 0,
  },
  {
    id: "fifty_win_rate",
    name: "Edge Found",
    description: "Maintain 50%+ win rate (50+ trades)",
    icon: "📈",
    isEarned: (snapshot) =>
      snapshot.totalTrades >= 50 && snapshot.winRate >= 50,
  },
  {
    id: "sixty_win_rate",
    name: "Sharp Shooter",
    description: "Maintain 60%+ win rate (100+ trades)",
    icon: "🎯",
    isEarned: (snapshot) =>
      snapshot.totalTrades >= 100 && snapshot.winRate >= 60,
  },
  {
    id: "profit_factor_2",
    name: "Double Edge",
    description: "Achieve profit factor above 2.0",
    icon: "💎",
    isEarned: (snapshot) =>
      snapshot.totalTrades >= 30 && snapshot.profitFactor >= 2,
  },
  {
    id: "win_streak_5",
    name: "Hot Streak",
    description: "Win 5 trades in a row",
    icon: "🔥",
    isEarned: (snapshot) => snapshot.maxWinStreak >= 5,
  },
  {
    id: "win_streak_10",
    name: "Unstoppable",
    description: "Win 10 trades in a row",
    icon: "🏆",
    isEarned: (snapshot) => snapshot.maxWinStreak >= 10,
  },
  {
    id: "green_week",
    name: "Green Week",
    description: "5 consecutive profitable days",
    icon: "📅",
    isEarned: (snapshot) => snapshot.maxGreenStreak >= 5,
  },
  {
    id: "green_month",
    name: "Green Month",
    description: "20 consecutive profitable days",
    icon: "🗓️",
    isEarned: (snapshot) => snapshot.maxGreenStreak >= 20,
  },
  {
    id: "thousand_pnl",
    name: "First Grand",
    description: "Earn $1,000 in total profit",
    icon: "💰",
    isEarned: (snapshot) => snapshot.totalPnl >= 1000,
  },
  {
    id: "ten_k_pnl",
    name: "Five Figures",
    description: "Earn $10,000 in total profit",
    icon: "🤑",
    isEarned: (snapshot) => snapshot.totalPnl >= 10000,
  },
];

export function parseAchievementNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildAchievementSnapshot(
  trades: Array<{
    profit: unknown;
    openTime?: Date | null;
    closeTime?: Date | null;
    createdAt: Date;
  }>
): AchievementSnapshot {
  const sortedTrades = [...trades].sort((left, right) => {
    const leftTime =
      left.closeTime?.getTime() ??
      left.openTime?.getTime() ??
      left.createdAt.getTime();
    const rightTime =
      right.closeTime?.getTime() ??
      right.openTime?.getTime() ??
      right.createdAt.getTime();
    return leftTime - rightTime;
  });

  const pnls = sortedTrades.map((row) => parseAchievementNumber(row.profit));
  const totalTrades = pnls.length;
  const totalPnl = pnls.reduce((sum, value) => sum + value, 0);
  const wins = pnls.filter((value) => value > 0).length;
  const grossWin = pnls
    .filter((value) => value > 0)
    .reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(
    pnls.filter((value) => value < 0).reduce((sum, value) => sum + value, 0)
  );

  let maxWinStreak = 0;
  let currentWinStreak = 0;

  for (const pnl of pnls) {
    if (pnl > 0) {
      currentWinStreak += 1;
      maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
    } else {
      currentWinStreak = 0;
    }
  }

  const dailyPnls = new Map<string, number>();
  for (const row of sortedTrades) {
    const timestamp = row.closeTime ?? row.openTime ?? row.createdAt;
    const dayKey = timestamp.toISOString().slice(0, 10);
    dailyPnls.set(
      dayKey,
      (dailyPnls.get(dayKey) ?? 0) + parseAchievementNumber(row.profit)
    );
  }

  let maxGreenStreak = 0;
  let currentGreenStreak = 0;
  for (const [, pnl] of [...dailyPnls.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    if (pnl > 0) {
      currentGreenStreak += 1;
      maxGreenStreak = Math.max(maxGreenStreak, currentGreenStreak);
    } else {
      currentGreenStreak = 0;
    }
  }

  return {
    totalTrades,
    totalPnl,
    winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0,
    maxWinStreak,
    maxGreenStreak,
  };
}

export function resolveEarnedAchievements(snapshot: AchievementSnapshot) {
  return achievementDefinitions.filter((achievement) =>
    achievement.isEarned(snapshot)
  );
}
