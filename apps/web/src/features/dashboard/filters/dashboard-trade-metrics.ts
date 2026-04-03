"use client";

import { convertCurrencyAmount } from "@profitabledge/contracts/currency";

import type { AccountStats } from "@/stores/stats";
import { trpcClient } from "@/utils/trpc";

export type DashboardFilteredTrade = {
  id: string;
  accountId?: string | null;
  open?: string | null;
  close?: string | null;
  symbol?: string | null;
  rawSymbol?: string | null;
  symbolGroup?: string | null;
  tradeDirection?: string | null;
  profit?: number | null;
  commissions?: number | null;
  swap?: number | null;
  holdSeconds?: number | null;
  sessionTag?: string | null;
  modelTag?: string | null;
  customTags?: string[];
  realisedRR?: number | null;
  entrySpreadPips?: number | null;
  exitSpreadPips?: number | null;
  entrySlippagePips?: number | null;
  exitSlippagePips?: number | null;
  rrCaptureEfficiency?: number | null;
  exitEfficiency?: number | null;
  slModCount?: number | null;
  tpModCount?: number | null;
  partialCloseCount?: number | null;
  entryPeakPrice?: number | null;
  postExitPeakPrice?: number | null;
  closePrice?: number | null;
  volume?: number | null;
};

export type DashboardFilterDateRange = {
  startDate?: string | null;
  endDate?: string | null;
};

type ExecutionGrade = "A" | "B" | "C" | "D" | "F" | "N/A";

const TRADE_PAGE_LIMIT = 200;
const TRADE_PAGE_MAX = 100;

function startOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(value: Date, amount: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
}

function toIsoDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate()
  ).padStart(2, "0")}`;
}

function startOfWeekMonday(value: Date) {
  const next = startOfDay(value);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function parseFilterDateValue(value?: string | null) {
  if (!value) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }

  return new Date(year, month - 1, day);
}

export function getTradeTimestamp(trade: DashboardFilteredTrade) {
  return trade.open || trade.close || null;
}

export function getTradeTimeMs(trade: DashboardFilteredTrade) {
  const timestamp = getTradeTimestamp(trade);
  if (!timestamp) return Number.NaN;

  const ms = new Date(timestamp).getTime();
  return Number.isFinite(ms) ? ms : Number.NaN;
}

function getTradeDateMs(trade: DashboardFilteredTrade) {
  const tradeTimeMs = getTradeTimeMs(trade);
  if (!Number.isFinite(tradeTimeMs)) return Number.NaN;
  return startOfDay(new Date(tradeTimeMs)).getTime();
}

function getTradeProfit(trade: DashboardFilteredTrade) {
  return Number(trade.profit ?? 0);
}

function getTradeNetProfit(trade: DashboardFilteredTrade) {
  return (
    Number(trade.profit ?? 0) +
    Number(trade.commissions ?? 0) +
    Number(trade.swap ?? 0)
  );
}

function getTradeDisplaySymbol(trade: DashboardFilteredTrade) {
  return (
    trade.symbolGroup || trade.symbol || trade.rawSymbol || "(UNKNOWN)"
  ).trim();
}

function resolveTradeDirection(trade: DashboardFilteredTrade) {
  const direction = String(trade.tradeDirection || "").toLowerCase();
  return direction === "short" || direction === "sell" ? "short" : "long";
}

function meanDefined(values: Array<number | null | undefined>) {
  const definedValues = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );

  if (definedValues.length === 0) return null;

  return (
    definedValues.reduce((sum, value) => sum + value, 0) /
    definedValues.length
  );
}

function computeExecutionGrade(input: {
  avgEntrySpread?: number | null;
  avgExitSpread?: number | null;
  avgEntrySlippage?: number | null;
  avgExitSlippage?: number | null;
  avgRrCaptureEfficiency?: number | null;
  avgExitEfficiency?: number | null;
  tradeCount?: number | null;
  tradesWithExecutionData?: number | null;
}) {
  const avgSpread = meanDefined([input.avgEntrySpread, input.avgExitSpread]);
  const avgSlippage = meanDefined([
    input.avgEntrySlippage,
    input.avgExitSlippage,
  ]);

  const hasMetricData =
    avgSpread != null ||
    avgSlippage != null ||
    input.avgRrCaptureEfficiency != null ||
    input.avgExitEfficiency != null;
  const hasGradeData =
    Number(input.tradeCount ?? 0) > 0 &&
    Number(input.tradesWithExecutionData ?? 0) > 0 &&
    hasMetricData;

  if (!hasGradeData) {
    return {
      grade: "N/A" as ExecutionGrade,
      gradeScore: null,
    };
  }

  let gradeScore = 100;

  if (avgSpread != null) {
    if (avgSpread > 2) gradeScore -= 15;
    else if (avgSpread > 1) gradeScore -= 5;
  }

  if (avgSlippage != null) {
    if (avgSlippage > 1) gradeScore -= 20;
    else if (avgSlippage > 0.5) gradeScore -= 10;
  }

  if (
    input.avgRrCaptureEfficiency != null &&
    input.avgRrCaptureEfficiency < 50
  ) {
    gradeScore -= 10;
  }

  if (input.avgExitEfficiency != null && input.avgExitEfficiency < 50) {
    gradeScore -= 10;
  }

  gradeScore = Math.max(0, Math.min(100, gradeScore));

  const grade: ExecutionGrade =
    gradeScore >= 90
      ? "A"
      : gradeScore >= 80
        ? "B"
        : gradeScore >= 70
          ? "C"
          : gradeScore >= 60
            ? "D"
            : "F";

  return {
    grade,
    gradeScore,
  };
}

export function getDashboardTradeDateBounds(
  trades: DashboardFilteredTrade[],
  range?: DashboardFilterDateRange
) {
  const explicitStart = parseFilterDateValue(range?.startDate);
  const explicitEnd = parseFilterDateValue(range?.endDate);
  const tradeDayMs = trades
    .map((trade) => getTradeDateMs(trade))
    .filter((value) => Number.isFinite(value));

  const minTradeDate =
    tradeDayMs.length > 0 ? new Date(Math.min(...tradeDayMs)) : null;
  const maxTradeDate =
    tradeDayMs.length > 0 ? new Date(Math.max(...tradeDayMs)) : null;

  const start = explicitStart ?? minTradeDate ?? explicitEnd;
  const end = explicitEnd ?? maxTradeDate ?? explicitStart;

  if (!start || !end) {
    return null;
  }

  const normalizedStart = startOfDay(start);
  const normalizedEnd = startOfDay(end);

  return normalizedStart.getTime() <= normalizedEnd.getTime()
    ? { start: normalizedStart, end: normalizedEnd }
    : { start: normalizedEnd, end: normalizedStart };
}

export function deriveFilteredStats(trades: DashboardFilteredTrade[]) {
  const orderedTrades = [...trades].sort(
    (left, right) => getTradeTimeMs(right) - getTradeTimeMs(left)
  );
  const profits = orderedTrades.map(getTradeProfit);
  const totalTrades = profits.length;
  const wins = profits.filter((profit) => profit > 0).length;
  const losses = profits.filter((profit) => profit < 0).length;
  const breakeven = totalTrades - wins - losses;
  const totalProfit = profits.reduce((sum, profit) => sum + profit, 0);
  const grossProfit = profits
    .filter((profit) => profit > 0)
    .reduce((sum, profit) => sum + profit, 0);
  const grossLoss = Math.abs(
    profits
      .filter((profit) => profit < 0)
      .reduce((sum, profit) => sum + profit, 0)
  );
  const holdValues = orderedTrades
    .map((trade) => Number(trade.holdSeconds ?? 0))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const rrValues = orderedTrades
    .map((trade) => Number(trade.realisedRR))
    .filter((value) => Number.isFinite(value));
  const outcomeSequence = profits
    .filter((profit) => profit !== 0)
    .map((profit) => (profit > 0 ? "W" : "L")) as ("W" | "L")[];

  let winStreak = 0;
  for (const outcome of outcomeSequence) {
    if (outcome !== "W") {
      break;
    }
    winStreak += 1;
  }

  return {
    totalProfit,
    grossProfit,
    grossLoss,
    wins,
    losses,
    breakeven,
    winrate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
    averageHoldSeconds:
      holdValues.length > 0
        ? holdValues.reduce((sum, value) => sum + value, 0) / holdValues.length
        : 0,
    averageRMultiple:
      rrValues.length > 0
        ? rrValues.reduce((sum, value) => sum + value, 0) / rrValues.length
        : null,
    profitFactor:
      grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : 0,
    expectancy: totalTrades > 0 ? totalProfit / totalTrades : 0,
    winStreak,
    recentOutcomes: outcomeSequence.slice(0, 5),
    recentTrades: orderedTrades.slice(0, 5),
  } satisfies Partial<AccountStats> & {
    recentTrades: DashboardFilteredTrade[];
    grossLoss: number;
  };
}

function calculateSessionLabel(trade: DashboardFilteredTrade) {
  const timestamp = getTradeTimestamp(trade);
  if (!timestamp) return "Unknown";

  const hour = new Date(timestamp).getUTCHours();
  if (hour >= 0 && hour < 8) return "Asian";
  if (hour >= 8 && hour < 16) return "London";
  return "New York";
}

export function buildSessionPerformanceFromTrades(
  trades: DashboardFilteredTrade[]
) {
  if (trades.length === 0) {
    return null;
  }

  const sessions: Record<
    string,
    { trades: number; profit: number; wins: number }
  > = {
    Asian: { trades: 0, profit: 0, wins: 0 },
    London: { trades: 0, profit: 0, wins: 0 },
    "New York": { trades: 0, profit: 0, wins: 0 },
  };

  for (const trade of trades) {
    const session = calculateSessionLabel(trade);
    const profit = getTradeProfit(trade);

    if (!sessions[session]) {
      sessions[session] = { trades: 0, profit: 0, wins: 0 };
    }

    sessions[session].trades += 1;
    sessions[session].profit += profit;
    if (profit > 0) {
      sessions[session].wins += 1;
    }
  }

  return Object.entries(sessions).map(([name, value]) => ({
    name,
    trades: value.trades,
    profit: value.profit,
    winRate: value.trades > 0 ? (value.wins / value.trades) * 100 : 0,
  }));
}

export function buildTradeStreakCalendarFromTrades(
  trades: DashboardFilteredTrade[],
  anchorDate?: Date | null
) {
  if (trades.length === 0) {
    const end = startOfDay(anchorDate ?? new Date());
    const calendar = Array.from({ length: 30 }, (_, index) => {
      const date = addDays(end, index - 29);
      return {
        date: toIsoDate(date),
        profit: 0,
        count: 0,
      };
    });

    return {
      maxWinStreak: 0,
      maxLoseStreak: 0,
      calendar,
      totalGreenDays: 0,
      totalRedDays: 0,
    };
  }

  const tradesByDate: Record<string, { profit: number; count: number }> = {};

  for (const trade of trades) {
    const timestamp = getTradeTimestamp(trade);
    if (!timestamp) continue;

    const date = new Date(timestamp).toISOString().split("T")[0];
    if (!date) continue;

    if (!tradesByDate[date]) {
      tradesByDate[date] = { profit: 0, count: 0 };
    }

    tradesByDate[date].profit += getTradeProfit(trade);
    tradesByDate[date].count += 1;
  }

  const sortedDates = Object.keys(tradesByDate).sort();
  let maxWinStreak = 0;
  let maxLoseStreak = 0;
  let currentWinStreak = 0;
  let currentLoseStreak = 0;

  for (const date of sortedDates) {
    const dayProfit = tradesByDate[date].profit;
    if (dayProfit >= 0) {
      currentWinStreak += 1;
      currentLoseStreak = 0;
      maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
    } else {
      currentLoseStreak += 1;
      currentWinStreak = 0;
      maxLoseStreak = Math.max(maxLoseStreak, currentLoseStreak);
    }
  }

  const end = startOfDay(anchorDate ?? new Date());
  const calendar = Array.from({ length: 30 }, (_, index) => {
    const date = addDays(end, index - 29);
    const key = toIsoDate(date);
    const dayData = tradesByDate[key] || { profit: 0, count: 0 };
    return {
      date: key,
      profit: dayData.profit,
      count: dayData.count,
    };
  });

  return {
    maxWinStreak,
    maxLoseStreak,
    calendar,
    totalGreenDays: calendar.filter((day) => day.profit > 0).length,
    totalRedDays: calendar.filter((day) => day.profit < 0).length,
  };
}

export function buildProfitByDayFromTrades(
  trades: DashboardFilteredTrade[],
  range?: DashboardFilterDateRange
) {
  const bounds = getDashboardTradeDateBounds(trades, range);
  if (!bounds) {
    return [] as Array<{ dateISO: string; totalProfit: number; count: number }>;
  }

  const byDayMap = new Map<string, { totalProfit: number; count: number }>();
  for (
    let cursor = new Date(bounds.start);
    cursor.getTime() <= bounds.end.getTime();
    cursor = addDays(cursor, 1)
  ) {
    byDayMap.set(toIsoDate(cursor), { totalProfit: 0, count: 0 });
  }

  for (const trade of trades) {
    const tradeDateMs = getTradeDateMs(trade);
    if (!Number.isFinite(tradeDateMs)) continue;
    if (tradeDateMs < bounds.start.getTime() || tradeDateMs > bounds.end.getTime()) {
      continue;
    }

    const key = toIsoDate(new Date(tradeDateMs));
    const current = byDayMap.get(key) ?? { totalProfit: 0, count: 0 };
    current.totalProfit += getTradeProfit(trade);
    current.count += 1;
    byDayMap.set(key, current);
  }

  return Array.from(byDayMap.entries())
    .map(([dateISO, value]) => ({
      dateISO,
      totalProfit: value.totalProfit,
      count: value.count,
    }))
    .sort((left, right) => left.dateISO.localeCompare(right.dateISO));
}

export function buildTradeCountsFromTrades(
  trades: DashboardFilteredTrade[],
  range?: DashboardFilterDateRange
) {
  const byDay = buildProfitByDayFromTrades(trades, range).map((entry) => ({
    dateISO: entry.dateISO,
    count: entry.count,
  }));
  const byWeekMap = new Map<string, number>();
  const byMonthMap = new Map<string, number>();

  for (const entry of byDay) {
    const dayDate = new Date(entry.dateISO);
    const weekKey = toIsoDate(startOfWeekMonday(dayDate));
    const monthKey = toIsoDate(startOfMonth(dayDate)).slice(0, 7);

    byWeekMap.set(weekKey, (byWeekMap.get(weekKey) ?? 0) + entry.count);
    byMonthMap.set(monthKey, (byMonthMap.get(monthKey) ?? 0) + entry.count);
  }

  return {
    byDay,
    byWeek: Array.from(byWeekMap.entries())
      .map(([startISO, count]) => ({ startISO, count }))
      .sort((left, right) => left.startISO.localeCompare(right.startISO)),
    byMonth: Array.from(byMonthMap.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((left, right) => left.month.localeCompare(right.month)),
  };
}

export function buildProfitByAssetFromTrades(trades: DashboardFilteredTrade[]) {
  const bySymbol = new Map<string, { symbol: string; totalProfit: number }>();

  for (const trade of trades) {
    const key = getTradeDisplaySymbol(trade);
    const current = bySymbol.get(key) ?? { symbol: key, totalProfit: 0 };
    current.totalProfit += getTradeNetProfit(trade);
    bySymbol.set(key, current);
  }

  return Array.from(bySymbol.values()).sort(
    (left, right) => Math.abs(right.totalProfit) - Math.abs(left.totalProfit)
  );
}

export function buildLossesByAssetFromTrades(trades: DashboardFilteredTrade[]) {
  const bySymbol = new Map<
    string,
    {
      symbol: string;
      profitLoss: number;
      commissionsLoss: number;
      swapLoss: number;
    }
  >();

  for (const trade of trades) {
    const key = getTradeDisplaySymbol(trade);
    const current = bySymbol.get(key) ?? {
      symbol: key,
      profitLoss: 0,
      commissionsLoss: 0,
      swapLoss: 0,
    };

    const profit = Number(trade.profit ?? 0);
    const commissions = Number(trade.commissions ?? 0);
    const swap = Number(trade.swap ?? 0);

    current.profitLoss += profit < 0 ? Math.abs(profit) : 0;
    current.commissionsLoss += commissions < 0 ? Math.abs(commissions) : 0;
    current.swapLoss += swap < 0 ? Math.abs(swap) : 0;
    bySymbol.set(key, current);
  }

  return Array.from(bySymbol.values())
    .map((value) => ({
      symbol: value.symbol,
      profitLoss: value.profitLoss,
      commissionsLoss: value.commissionsLoss,
      swapLoss: value.swapLoss,
      totalLoss:
        value.profitLoss + value.commissionsLoss + value.swapLoss,
    }))
    .filter((value) => value.totalLoss > 0)
    .sort((left, right) => right.totalLoss - left.totalLoss);
}

export function buildExecutionStatsFromTrades(trades: DashboardFilteredTrade[]) {
  const tradesWithExecutionData = trades.filter(
    (trade) =>
      trade.entrySpreadPips != null ||
      trade.exitSpreadPips != null ||
      trade.entrySlippagePips != null ||
      trade.exitSlippagePips != null ||
      trade.rrCaptureEfficiency != null ||
      trade.exitEfficiency != null
  );
  const averages = {
    avgEntrySpread: meanDefined(trades.map((trade) => trade.entrySpreadPips)),
    avgExitSpread: meanDefined(trades.map((trade) => trade.exitSpreadPips)),
    avgEntrySlippage: meanDefined(
      trades.map((trade) => trade.entrySlippagePips)
    ),
    avgExitSlippage: meanDefined(
      trades.map((trade) => trade.exitSlippagePips)
    ),
    avgRrCaptureEfficiency: meanDefined(
      trades.map((trade) => trade.rrCaptureEfficiency)
    ),
    avgExitEfficiency: meanDefined(trades.map((trade) => trade.exitEfficiency)),
  };
  const totals = {
    totalSlModifications: trades.reduce(
      (sum, trade) => sum + Number(trade.slModCount ?? 0),
      0
    ),
    totalTpModifications: trades.reduce(
      (sum, trade) => sum + Number(trade.tpModCount ?? 0),
      0
    ),
    totalPartialCloses: trades.reduce(
      (sum, trade) => sum + Number(trade.partialCloseCount ?? 0),
      0
    ),
  };
  const grade = computeExecutionGrade({
    ...averages,
    tradeCount: trades.length,
    tradesWithExecutionData: tradesWithExecutionData.length,
  });

  return {
    ...averages,
    ...totals,
    tradeCount: trades.length,
    tradesWithExecutionData: tradesWithExecutionData.length,
    grade: grade.grade,
    gradeScore: grade.gradeScore,
  };
}

export function buildMoneyLeftOnTableFromTrades(
  trades: DashboardFilteredTrade[],
  options?: {
    currencyCode?: string | null;
    accountCurrencyById?: Map<string, string | null | undefined>;
    profitValuesAreConverted?: boolean;
  }
) {
  let totalDuringTrade = 0;
  let totalAfterExit = 0;
  let actualProfit = 0;
  let tradesWithPeakData = 0;
  let tradesWithPostExitData = 0;

  for (const trade of trades) {
    const sourceCurrency = options?.accountCurrencyById?.get(
      String(trade.accountId || "")
    );
    const convertValue = (value: number) =>
      convertCurrencyAmount(value, sourceCurrency, options?.currencyCode);
    const closePrice = Number(trade.closePrice ?? 0);
    const volume = Number(trade.volume ?? 1) || 1;
    const isLong = resolveTradeDirection(trade) === "long";

    if (trade.entryPeakPrice != null && trade.closePrice != null) {
      tradesWithPeakData += 1;
      const missedPips = isLong
        ? Math.max(0, Number(trade.entryPeakPrice) - closePrice)
        : Math.max(0, closePrice - Number(trade.entryPeakPrice));
      totalDuringTrade += convertValue(missedPips * volume * 10);
    }

    if (trade.postExitPeakPrice != null && trade.closePrice != null) {
      tradesWithPostExitData += 1;
      const additionalPips = isLong
        ? Math.max(0, Number(trade.postExitPeakPrice) - closePrice)
        : Math.max(0, closePrice - Number(trade.postExitPeakPrice));
      totalAfterExit += convertValue(additionalPips * volume * 10);
    }

    actualProfit += options?.profitValuesAreConverted
      ? getTradeProfit(trade)
      : convertValue(getTradeProfit(trade));
  }

  const totalMissed = totalDuringTrade + totalAfterExit;
  const potentialTotal = actualProfit + totalMissed;
  const captureRatio =
    potentialTotal > 0 ? (actualProfit / potentialTotal) * 100 : 100;

  return {
    totalMissedDuringTrade: Math.round(totalDuringTrade * 100) / 100,
    totalMissedAfterExit: Math.round(totalAfterExit * 100) / 100,
    totalMissed: Math.round(totalMissed * 100) / 100,
    actualProfit: Math.round(actualProfit * 100) / 100,
    potentialProfit: Math.round(potentialTotal * 100) / 100,
    captureRatio: Math.round(captureRatio * 10) / 10,
    tradesWithPeakData,
    tradesWithPostExitData,
    totalTrades: trades.length,
  };
}

function startDateToIso(value?: string | null) {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00.000`).toISOString();
}

function endDateToIso(value?: string | null) {
  if (!value) return undefined;
  return new Date(`${value}T23:59:59.999`).toISOString();
}

export async function fetchDashboardTrades(input: {
  accountId: string;
  startDate?: string | null;
  endDate?: string | null;
  symbols?: string[];
  sessionTags?: string[];
  modelTags?: string[];
  customTags?: string[];
}) {
  const trades: DashboardFilteredTrade[] = [];
  let cursor: { createdAtISO: string; id: string } | undefined;
  let pageCount = 0;

  do {
    const page = await trpcClient.trades.listInfinite.query({
      accountId: input.accountId,
      limit: TRADE_PAGE_LIMIT,
      startISO: startDateToIso(input.startDate),
      endISO: endDateToIso(input.endDate),
      symbols: input.symbols?.length ? input.symbols : undefined,
      sessionTags: input.sessionTags?.length ? input.sessionTags : undefined,
      modelTags: input.modelTags?.length ? input.modelTags : undefined,
      customTags: input.customTags?.length ? input.customTags : undefined,
      cursor,
    });

    trades.push(...(page.items as DashboardFilteredTrade[]));
    cursor = "nextCursor" in page ? page.nextCursor ?? undefined : undefined;
    pageCount += 1;
  } while (cursor && pageCount < TRADE_PAGE_MAX);

  return trades;
}
