import {
  analytics,
  calculateRRValues,
  calculateSymbolStats,
  calculateStreaks,
  type TradeInput,
} from "../analytics";
import { buildPublicProofPath } from "./share-slug";
import {
  getTradeOriginLabel,
  resolveAccountConnectionTrust,
  resolveTradeOriginType,
  type TradeOriginType,
} from "./trust";
import type { StoredProfileEffects } from "../profile-effects";

type PublicProofShare = {
  accountId: string;
  accountName: string;
  broker: string | null;
  brokerType: string | null;
  brokerServer: string | null;
  accountNumber?: string | null;
  preferredDataSource?: string | null;
  createdAt: Date;
  traderName: string | null;
  traderImage?: string | null;
  traderBannerUrl?: string | null;
  traderBannerPosition?: string | null;
  traderProfileEffects?: StoredProfileEffects | null;
  verificationLevel: string | null;
  isVerified: number | boolean | null;
  lastSyncedAt?: Date | null;
  initialBalance?: string | number | null;
  initialCurrency?: string | null;
};

type StoredTradeRow = {
  id: string;
  symbol: string | null;
  profit: unknown;
  outcome: string | null;
  plannedRR: unknown;
  realisedRR: unknown;
  openTime: Date | null;
  closeTime: Date | null;
  createdAt: Date;
  originType: string | null;
  brokerMeta: Record<string, unknown> | null;
  ticket: string | null;
  useBrokerData: number | null;
};

type LiveTradePreviewRow = {
  id: string;
  symbol: string | null;
  tradeType: string | null;
  volume: number | null;
  openPrice: number | null;
  closePrice: number | null;
  profit: number | null;
  durationSeconds: number;
};

type BuildPublicProofPageDataInput = {
  share: PublicProofShare;
  username: string;
  publicAccountSlug: string;
  lastImportedAt?: Date | null;
  storedTradeRows: StoredTradeRow[];
  liveTradeRows: LiveTradePreviewRow[];
  editedTradesCount: number;
  removedTradesCount: number;
};

function parseNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildVerificationLabel(input: {
  verificationLevel: string | null | undefined;
  connectionKind:
    | "manual"
    | "ea_synced"
    | "broker_synced"
    | "csv_imported"
    | "demo";
}) {
  if (input.connectionKind === "demo") {
    return "Demo account";
  }

  switch (input.verificationLevel) {
    case "api_verified":
      return "Broker verified";
    case "ea_synced":
      return "EA verified";
    case "prop_verified":
      return "Prop verified";
    default:
      return "Self-reported";
  }
}

function resolveTradeTimestamp(row: {
  closeTime?: Date | null;
  openTime?: Date | null;
  createdAt: Date;
}) {
  return row.closeTime ?? row.openTime ?? row.createdAt;
}

function downsampleCurve(
  points: Array<{ x: string; y: number }>,
  maxPoints = 64
) {
  if (points.length <= maxPoints) return points;

  const step = points.length / maxPoints;
  const sampled: Array<{ x: string; y: number }> = [];
  for (let index = 0; index < maxPoints; index += 1) {
    const point = points[Math.min(points.length - 1, Math.floor(index * step))];
    if (point) sampled.push(point);
  }
  return sampled;
}

function buildMonthlyReturns(trades: StoredTradeRow[]) {
  const monthMap = new Map<
    string,
    { month: string; pnl: number; trades: number; wins: number }
  >();

  trades.forEach((trade) => {
    const timestamp = resolveTradeTimestamp(trade);
    const monthKey = timestamp.toISOString().slice(0, 7);
    const bucket = monthMap.get(monthKey) ?? {
      month: monthKey,
      pnl: 0,
      trades: 0,
      wins: 0,
    };

    bucket.pnl += parseNumber(trade.profit);
    bucket.trades += 1;

    if (
      trade.outcome === "Win" ||
      trade.outcome === "PW" ||
      (trade.outcome == null && parseNumber(trade.profit) > 0)
    ) {
      bucket.wins += 1;
    }

    monthMap.set(monthKey, bucket);
  });

  return Array.from(monthMap.values())
    .sort((left, right) => left.month.localeCompare(right.month))
    .map((bucket) => ({
      month: bucket.month,
      label: new Date(`${bucket.month}-01T00:00:00.000Z`).toLocaleDateString(
        "en-US",
        {
          month: "short",
          year: "numeric",
        }
      ),
      pnl: Number(bucket.pnl.toFixed(2)),
      trades: bucket.trades,
      winRate:
        bucket.trades > 0
          ? Number(((bucket.wins / bucket.trades) * 100).toFixed(1))
          : 0,
    }));
}

function buildDailyPerformance(trades: StoredTradeRow[]) {
  const dayMap = new Map<string, number>();

  trades.forEach((trade) => {
    const dayKey = resolveTradeTimestamp(trade).toISOString().slice(0, 10);
    dayMap.set(dayKey, (dayMap.get(dayKey) ?? 0) + parseNumber(trade.profit));
  });

  const days = Array.from(dayMap.entries()).map(([day, pnl]) => ({
    day,
    pnl: Number(pnl.toFixed(2)),
  }));

  days.sort((left, right) => left.pnl - right.pnl);

  const worstDay = days[0] ?? null;
  const bestDay = days[days.length - 1] ?? null;

  return {
    bestDay,
    worstDay,
  };
}

function buildDrawdownCurve(trades: StoredTradeRow[], initialBalance: number) {
  const sortedTrades = [...trades].sort(
    (left, right) =>
      resolveTradeTimestamp(left).getTime() -
      resolveTradeTimestamp(right).getTime()
  );

  let runningPnL = 0;
  let peakPnL = 0;

  const points = sortedTrades.map((trade) => {
    runningPnL += parseNumber(trade.profit);
    peakPnL = Math.max(peakPnL, runningPnL);
    const drawdown = peakPnL - runningPnL;

    return {
      x: resolveTradeTimestamp(trade).toISOString(),
      y: Number((initialBalance - drawdown).toFixed(2)),
    };
  });

  return downsampleCurve(points);
}

function toAnalyticsTradeRows(trades: StoredTradeRow[]): TradeInput[] {
  return trades.map((trade) => ({
    profit: parseNumber(trade.profit),
    symbol: trade.symbol,
    openTime: trade.openTime,
    closeTime: trade.closeTime,
    plannedRr: parseNumber(trade.plannedRR),
    realisedRR: parseNumber(trade.realisedRR),
  }));
}

function resolveLiveStatusLabel(input: {
  connectionKind:
    | "manual"
    | "ea_synced"
    | "broker_synced"
    | "csv_imported"
    | "demo";
  lastSyncedAt?: Date | null;
}) {
  if (input.connectionKind === "demo") {
    return "Provided by Profitabledge";
  }

  if (
    input.connectionKind === "manual" ||
    input.connectionKind === "csv_imported"
  ) {
    return "No live sync";
  }

  if (!input.lastSyncedAt) {
    return "Sync unavailable";
  }

  const ageMs = Date.now() - input.lastSyncedAt.getTime();
  if (ageMs <= 5 * 60 * 1000) {
    return "Live now";
  }

  if (ageMs <= 60 * 60 * 1000) {
    return "Sync delayed";
  }

  return "Sync stale";
}

export function buildPublicProofPageData(input: BuildPublicProofPageDataInput) {
  const closedTradeRows = input.storedTradeRows.filter(
    (row) => row.closeTime != null || row.outcome != null
  );
  const analyticsTrades = toAnalyticsTradeRows(closedTradeRows);
  const stats = analytics.calculateFullStats(analyticsTrades);
  const rrValues = calculateRRValues(analyticsTrades);
  const streaks = calculateStreaks(analyticsTrades);
  const symbolStats = calculateSymbolStats(analyticsTrades).slice(0, 5);
  const monthlyReturns = buildMonthlyReturns(closedTradeRows);
  const dailyPerformance = buildDailyPerformance(closedTradeRows);
  const connectionTrust = resolveAccountConnectionTrust({
    name: input.share.accountName,
    broker: input.share.broker,
    verificationLevel: input.share.verificationLevel,
    isVerified: input.share.isVerified,
    brokerType: input.share.brokerType,
    brokerServer: input.share.brokerServer,
    accountNumber: input.share.accountNumber ?? null,
    preferredDataSource: input.share.preferredDataSource ?? null,
    lastImportedAt: input.lastImportedAt ?? null,
  });
  const floatingPnl = input.liveTradeRows.reduce(
    (sum, trade) => sum + Number(trade.profit ?? 0),
    0
  );

  const sourceCounts = {
    brokerSync: input.liveTradeRows.length,
    csvImport: 0,
    manualEntry: 0,
  };

  input.storedTradeRows.forEach((row) => {
    const originType = resolveTradeOriginType({
      originType: row.originType,
      brokerMeta: row.brokerMeta,
      ticket: row.ticket,
      useBrokerData: row.useBrokerData,
      accountVerificationLevel: input.share.verificationLevel,
      accountIsVerified: input.share.isVerified,
    });

    if (originType === "broker_sync") sourceCounts.brokerSync += 1;
    if (originType === "csv_import") sourceCounts.csvImport += 1;
    if (originType === "manual_entry") sourceCounts.manualEntry += 1;
  });

  const legacyAuditGap = input.storedTradeRows.some(
    (row) => row.createdAt.getTime() < input.share.createdAt.getTime()
  );
  const totalRows = input.storedTradeRows.length + input.liveTradeRows.length;
  const winRate =
    closedTradeRows.length > 0
      ? Number(
          (
            (stats.winningTrades /
              Math.max(stats.winningTrades + stats.losingTrades, 1)) *
            100
          ).toFixed(1)
        )
      : 0;

  const accountBaseline = parseNumber(input.share.initialBalance);

  const curvePoints = downsampleCurve(
    [...closedTradeRows]
      .sort(
        (left, right) =>
          resolveTradeTimestamp(left).getTime() -
          resolveTradeTimestamp(right).getTime()
      )
      .reduce<Array<{ x: string; y: number }>>((points, trade) => {
        const previousEquity = points[points.length - 1]?.y ?? accountBaseline;
        points.push({
          x: resolveTradeTimestamp(trade).toISOString(),
          y: Number((previousEquity + parseNumber(trade.profit)).toFixed(2)),
        });
        return points;
      }, [])
  );

  return {
    path: buildPublicProofPath(input.username, input.publicAccountSlug),
    trader: {
      username: input.username,
      name: input.share.traderName,
      image: input.share.traderImage ?? null,
      profileBannerUrl: input.share.traderBannerUrl ?? null,
      profileBannerPosition: input.share.traderBannerPosition ?? null,
      profileEffects: input.share.traderProfileEffects ?? null,
    },
    account: {
      name: input.share.accountName,
      broker: input.share.broker,
      brokerServer: input.share.brokerServer,
      currency: input.share.initialCurrency ?? null,
    },
    proof: {
      connectionKind: connectionTrust.kind,
      connectionLabel: connectionTrust.label,
      verificationLevel: input.share.verificationLevel ?? "unverified",
      verificationLabel: buildVerificationLabel({
        verificationLevel: input.share.verificationLevel,
        connectionKind: connectionTrust.kind,
      }),
      auditCoverageStartsAt: input.share.createdAt,
      legacyAuditGap,
      lastSyncedAt: input.share.lastSyncedAt ?? null,
      liveStatusLabel: resolveLiveStatusLabel({
        connectionKind: connectionTrust.kind,
        lastSyncedAt: input.share.lastSyncedAt,
      }),
    },
    summary: {
      totalTrades: totalRows,
      closedTrades: closedTradeRows.length,
      openTradesCount: input.liveTradeRows.length,
      wins: stats.winningTrades,
      losses: stats.losingTrades,
      winRate,
      totalPnl: Number(stats.netPnL.toFixed(2)),
      floatingPnl: Number(floatingPnl.toFixed(2)),
      profitFactor:
        stats.profitFactor === Infinity
          ? 999
          : Number(stats.profitFactor.toFixed(2)),
      averageRR: rrValues.length > 0 ? Number(stats.avgRR.toFixed(2)) : null,
      medianRR: rrValues.length > 0 ? Number(stats.medianRR.toFixed(2)) : null,
      maxDrawdown: Number(stats.maxDrawdown.toFixed(2)),
      maxDrawdownPercent: Number(stats.maxDrawdownPercent.toFixed(2)),
      initialBalance: accountBaseline,
      curve: curvePoints,
      drawdownCurve: buildDrawdownCurve(closedTradeRows, accountBaseline),
    },
    stats: {
      expectancy: Number(stats.expectancy.toFixed(2)),
      avgWin: Number(stats.avgWin.toFixed(2)),
      avgLoss: Number(stats.avgLoss.toFixed(2)),
      bestTrade: Number(stats.bestTrade.toFixed(2)),
      worstTrade: Number(stats.worstTrade.toFixed(2)),
      avgTradeDurationSeconds: Math.round(stats.avgTradeDuration),
      longestWinStreak: streaks.longestWinStreak,
      longestLossStreak: streaks.longestLossStreak,
      monthlyReturns,
      topSymbols: symbolStats.map((row) => ({
        symbol: row.symbol,
        trades: row.trades,
        winRate: Number(row.winRate.toFixed(1)),
        totalProfit: Number(row.totalProfit.toFixed(2)),
      })),
      bestDay: dailyPerformance.bestDay,
      worstDay: dailyPerformance.worstDay,
    },
    trust: {
      editedTradesCount: input.editedTradesCount,
      removedTradesCount: input.removedTradesCount,
      sourceCounts,
      sourceBadges: (
        [
          {
            key: "broker_sync",
            count: sourceCounts.brokerSync,
            label: getTradeOriginLabel("broker_sync"),
          },
          {
            key: "csv_import",
            count: sourceCounts.csvImport,
            label: getTradeOriginLabel("csv_import"),
          },
          {
            key: "manual_entry",
            count: sourceCounts.manualEntry,
            label: getTradeOriginLabel("manual_entry"),
          },
        ] as const
      ).filter((row) => row.count > 0),
    },
    liveTrades: input.liveTradeRows.slice(0, 6),
  };
}
