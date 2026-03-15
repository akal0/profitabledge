import { db } from "../../db";
import { equitySnapshot } from "../../db/schema/connections";
import {
  tradeChecklistResult,
  tradeChecklistTemplate,
} from "../../db/schema/coaching";
import { tradeMedia, tradeNote } from "../../db/schema/journal";
import { tradeAnnotation } from "../../db/schema/social-redesign";
import { openTrade, trade, tradingAccount } from "../../db/schema/trading";
import { calculateAllAdvancedMetrics } from "../../lib/advanced-metrics";
import { createAutoTradeReviewEntry } from "../../lib/auto-journal";
import { generateFeedEventForTrade } from "../../lib/feed-event-generator";
import { seedDemoBacktestSessions } from "./demo-backtest";
import { seedDemoDigests } from "./demo-digests";
import { seedDemoGoalsAndAlerts } from "./demo-governance";
import {
  DEMO_ACCOUNT_NAME,
  DEMO_ACCOUNT_PREFIX,
  DEMO_BROKER,
  DEMO_BROKER_SERVER,
  seedDemoAiHistory,
} from "./demo-workspace";

export async function seedSampleAccount(userId: string) {
  const accountId = crypto.randomUUID();
  const now = Date.now();
  const nowDate = new Date(now);
  const initialBalance = 100_000;
  const tradeCount = 120;
  const openTradeCount = 5 + Math.floor(Math.random() * 9);
  const accountNumber = `${DEMO_ACCOUNT_PREFIX}${Math.floor(
    10_000_000 + Math.random() * 90_000_000
  )}`;

  const symbols = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "XAUUSD"] as const;
  const sessions = ["London", "New York", "Asian"] as const;
  const models = [
    "Liquidity Raid",
    "Breaker Block",
    "Supply Zone",
    "Trend Continuation",
  ] as const;
  const alignments = ["aligned", "against", "discretionary"] as const;
  const sessionColors: Record<(typeof sessions)[number], string> = {
    London: "#3B82F6",
    "New York": "#F97316",
    Asian: "#8B5CF6",
  };
  const modelColors: Record<(typeof models)[number], string> = {
    "Liquidity Raid": "#14B8A6",
    "Breaker Block": "#F59E0B",
    "Supply Zone": "#EF4444",
    "Trend Continuation": "#22C55E",
  };
  const basePrices: Record<(typeof symbols)[number], number> = {
    EURUSD: 1.085,
    GBPUSD: 1.27,
    USDJPY: 150.5,
    AUDUSD: 0.655,
    XAUUSD: 2050,
  };
  const pipSizes: Record<(typeof symbols)[number], number> = {
    EURUSD: 0.0001,
    GBPUSD: 0.0001,
    USDJPY: 0.01,
    AUDUSD: 0.0001,
    XAUUSD: 0.1,
  };
  const pipValuePerLot: Record<(typeof symbols)[number], number> = {
    EURUSD: 10,
    GBPUSD: 10,
    USDJPY: 6.67,
    AUDUSD: 10,
    XAUUSD: 10,
  };

  const formatPrice = (symbol: (typeof symbols)[number], value: number) =>
    value.toFixed(symbol === "XAUUSD" ? 2 : symbol === "USDJPY" ? 3 : 5);
  const pick = <T>(items: readonly T[]) =>
    items[Math.floor(Math.random() * items.length)];
  const roundTo = (value: number, decimals = 2) =>
    Number(value.toFixed(decimals));
  const formatDay = (date: Date) => date.toISOString().slice(0, 10);
  const startOfUtcDay = (date: Date) => {
    const next = new Date(date);
    next.setUTCHours(0, 0, 0, 0);
    return next;
  };
  const subtractUtcMonths = (date: Date, months: number) => {
    const next = startOfUtcDay(date);
    next.setUTCMonth(next.getUTCMonth() - months);
    return next;
  };
  const previousTradingDay = (date: Date) => {
    const previous = startOfUtcDay(date);
    previous.setUTCDate(previous.getUTCDate() - 1);
    while (previous.getUTCDay() === 0 || previous.getUTCDay() === 6) {
      previous.setUTCDate(previous.getUTCDate() - 1);
    }
    return previous;
  };
  const getTradingDaysBetween = (start: Date, end: Date) => {
    const days: Date[] = [];
    const cursor = startOfUtcDay(start);
    const endDay = startOfUtcDay(end);

    while (cursor.getTime() <= endDay.getTime()) {
      if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) {
        days.push(new Date(cursor));
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return days;
  };
  const clampNumber = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));
  const randBetween = (min: number, max: number) =>
    min + Math.random() * (max - min);
  const weightedPick = <T>(
    items: readonly T[],
    getWeight: (item: T) => number
  ) => {
    const weighted = items.map((item) => ({
      item,
      weight: Math.max(0.01, getWeight(item)),
    }));
    const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const entry of weighted) {
      roll -= entry.weight;
      if (roll <= 0) return entry.item;
    }
    return weighted[weighted.length - 1]!.item;
  };
  const createDemoTradeImage = ({
    symbol,
    title,
    accent,
    subtitle,
    metric,
  }: {
    symbol: string;
    title: string;
    accent: string;
    subtitle: string;
    metric: string;
  }) =>
    `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
        <rect width="1280" height="720" rx="24" fill="#0b0d10"/>
        <rect x="24" y="24" width="1232" height="672" rx="20" fill="#111418" stroke="#1f252d"/>
        <text x="64" y="96" fill="#7b8794" font-family="Arial, sans-serif" font-size="24">${symbol}</text>
        <text x="64" y="154" fill="#f8fafc" font-family="Arial, sans-serif" font-size="46" font-weight="700">${title}</text>
        <text x="64" y="206" fill="#94a3b8" font-family="Arial, sans-serif" font-size="22">${subtitle}</text>
        <rect x="64" y="252" width="1152" height="320" rx="18" fill="#0f1720" stroke="#1e293b"/>
        <path d="M96 504 C180 430 260 462 340 390 S520 308 612 344 S788 484 886 418 S1030 286 1180 324" stroke="${accent}" stroke-width="10" fill="none" stroke-linecap="round"/>
        <circle cx="1180" cy="324" r="10" fill="${accent}"/>
        <rect x="64" y="608" width="250" height="56" rx="14" fill="${accent}" fill-opacity="0.18" stroke="${accent}" />
        <text x="92" y="645" fill="${accent}" font-family="Arial, sans-serif" font-size="26" font-weight="700">${metric}</text>
      </svg>`
    )}`;
  type DemoPhase = {
    name: "foundation" | "leak-cluster" | "recovery" | "refined-edge";
    endIndex: number;
    baseEdge: number;
    discipline: number;
    sameDayProbability: number;
    revengeRisk: number;
    sessionWeights: Record<(typeof sessions)[number], number>;
    modelWeights: Record<(typeof models)[number], number>;
    alignmentWeights: Record<(typeof alignments)[number], number>;
  };
  const sessionOrder: Record<(typeof sessions)[number], number> = {
    Asian: 0,
    London: 1,
    "New York": 2,
  };
  const sessionWindows: Record<
    (typeof sessions)[number],
    { startHour: number; endHour: number }
  > = {
    Asian: { startHour: 0, endHour: 5 },
    London: { startHour: 7, endHour: 11 },
    "New York": { startHour: 13, endHour: 17 },
  };
  const phaseConfigs: DemoPhase[] = [
    {
      name: "foundation",
      endIndex: 27,
      baseEdge: 0.05,
      discipline: 0.72,
      sameDayProbability: 0.78,
      revengeRisk: 0.24,
      sessionWeights: { London: 1.5, "New York": 1.1, Asian: 0.7 },
      modelWeights: {
        "Liquidity Raid": 1.45,
        "Breaker Block": 1.2,
        "Supply Zone": 0.9,
        "Trend Continuation": 0.75,
      },
      alignmentWeights: { aligned: 1.55, discretionary: 0.95, against: 0.55 },
    },
    {
      name: "leak-cluster",
      endIndex: 53,
      baseEdge: -0.12,
      discipline: 0.32,
      sameDayProbability: 0.9,
      revengeRisk: 0.62,
      sessionWeights: { London: 0.9, "New York": 1.45, Asian: 1.2 },
      modelWeights: {
        "Liquidity Raid": 0.85,
        "Breaker Block": 0.95,
        "Supply Zone": 1.15,
        "Trend Continuation": 1.45,
      },
      alignmentWeights: { aligned: 0.7, discretionary: 1.2, against: 1.35 },
    },
    {
      name: "recovery",
      endIndex: 87,
      baseEdge: 0.03,
      discipline: 0.82,
      sameDayProbability: 0.72,
      revengeRisk: 0.14,
      sessionWeights: { London: 1.55, "New York": 1.0, Asian: 0.55 },
      modelWeights: {
        "Liquidity Raid": 1.5,
        "Breaker Block": 1.15,
        "Supply Zone": 0.9,
        "Trend Continuation": 0.7,
      },
      alignmentWeights: { aligned: 1.65, discretionary: 0.85, against: 0.45 },
    },
    {
      name: "refined-edge",
      endIndex: tradeCount - 1,
      baseEdge: 0.12,
      discipline: 0.9,
      sameDayProbability: 0.8,
      revengeRisk: 0.08,
      sessionWeights: { London: 1.65, "New York": 1.15, Asian: 0.4 },
      modelWeights: {
        "Liquidity Raid": 1.65,
        "Breaker Block": 1.25,
        "Supply Zone": 0.75,
        "Trend Continuation": 0.6,
      },
      alignmentWeights: { aligned: 1.8, discretionary: 0.75, against: 0.3 },
    },
  ];
  const forcedOutcomes = new Map<number, "win" | "loss" | "breakeven">([
    [28, "loss"],
    [29, "loss"],
    [30, "loss"],
    [31, "loss"],
    [43, "loss"],
    [44, "breakeven"],
    [45, "loss"],
    [61, "win"],
    [62, "win"],
    [63, "win"],
    [95, "win"],
    [96, "win"],
    [97, "win"],
    [108, "win"],
  ]);
  const getPhaseConfig = (index: number) =>
    phaseConfigs.find((phase) => index <= phase.endIndex) ??
    phaseConfigs.at(-1)!;
  const buildSessionTimestamp = (
    day: Date,
    session: (typeof sessions)[number]
  ) => {
    const window = sessionWindows[session];
    const timestamp = new Date(day);
    const hour =
      window.startHour +
      Math.floor(Math.random() * (window.endHour - window.startHour + 1));
    const minute = Math.floor(Math.random() * 60);
    const second = Math.floor(Math.random() * 60);
    timestamp.setUTCHours(hour, minute, second, 0);
    return timestamp.getTime();
  };
  const closedTradeWindowStart = subtractUtcMonths(nowDate, 6);
  const closedTradeWindowEnd = previousTradingDay(nowDate);
  const availableTradingDays = getTradingDaysBetween(
    closedTradeWindowStart,
    closedTradeWindowEnd
  );

  const closedTrades: (typeof trade.$inferInsert)[] = [];
  let runningBalance = initialBalance;
  let currentTradingDayIndex = 0;
  let currentTradingDay = new Date(
    availableTradingDays[currentTradingDayIndex] ?? closedTradeWindowEnd
  );
  const lastTradingDayIndex = Math.max(availableTradingDays.length - 1, 0);
  let previousCloseTs: number | null = null;
  let previousSession: (typeof sessions)[number] | null = null;
  let previousOutcome: "win" | "loss" | "breakeven" | null = null;
  let consecutiveLosses = 0;
  let consecutiveWins = 0;

  for (let i = 0; i < tradeCount; i++) {
    const phase = getPhaseConfig(i);
    let session = weightedPick(
      sessions,
      (candidate) => phase.sessionWeights[candidate]
    );
    const isRevengeTrade =
      previousOutcome === "loss" &&
      previousSession !== null &&
      Math.random() < phase.revengeRisk &&
      consecutiveLosses < 4;
    if (isRevengeTrade && previousSession) {
      session = previousSession;
    }

    const model = weightedPick(
      models,
      (candidate) => phase.modelWeights[candidate]
    );
    const alignment = weightedPick(
      alignments,
      (candidate) => phase.alignmentWeights[candidate]
    );
    const symbol = weightedPick(symbols, (candidate) => {
      let weight = 1;
      if (
        session === "London" &&
        (candidate === "EURUSD" ||
          candidate === "GBPUSD" ||
          candidate === "XAUUSD")
      ) {
        weight += 0.9;
      }
      if (
        session === "New York" &&
        (candidate === "XAUUSD" ||
          candidate === "AUDUSD" ||
          candidate === "USDJPY")
      ) {
        weight += 0.75;
      }
      if (
        session === "Asian" &&
        (candidate === "USDJPY" || candidate === "AUDUSD")
      ) {
        weight += 0.8;
      }
      if (phase.name === "refined-edge" && candidate === "EURUSD") {
        weight += 0.35;
      }
      if (phase.name === "leak-cluster" && candidate === "GBPUSD") {
        weight += 0.45;
      }
      return weight;
    });
    const longBias =
      session === "London" ? 0.58 : session === "New York" ? 0.52 : 0.46;
    const tradeDirection = Math.random() < longBias ? "long" : "short";
    const directionFactor = tradeDirection === "long" ? 1 : -1;
    const isGold = symbol === "XAUUSD";
    const pipSize = pipSizes[symbol];
    const pipValue = pipValuePerLot[symbol];
    const pricePrecision =
      symbol === "XAUUSD" ? 2 : symbol === "USDJPY" ? 3 : 5;
    const previousSessionOrder =
      previousSession != null ? sessionOrder[previousSession] : -1;
    const sessionPosition = sessionOrder[session];
    const openNewDay =
      i === 0 ||
      (!isRevengeTrade &&
        (sessionPosition <= previousSessionOrder ||
          Math.random() > phase.sameDayProbability));
    if (i > 0 && openNewDay) {
      currentTradingDayIndex = Math.min(
        lastTradingDayIndex,
        currentTradingDayIndex + (Math.random() < 0.18 ? 2 : 1)
      );
      currentTradingDay = new Date(
        availableTradingDays[currentTradingDayIndex] ?? currentTradingDay
      );
    }

    let openTs: number =
      isRevengeTrade && previousCloseTs
        ? previousCloseTs + (4 + Math.floor(Math.random() * 9)) * 60 * 1000
        : buildSessionTimestamp(currentTradingDay, session);
    if (previousCloseTs && openTs <= previousCloseTs) {
      if (currentTradingDayIndex < lastTradingDayIndex) {
        currentTradingDayIndex += 1;
        currentTradingDay = new Date(
          availableTradingDays[currentTradingDayIndex] ?? currentTradingDay
        );
        openTs = buildSessionTimestamp(currentTradingDay, session);
      } else {
        openTs =
          previousCloseTs + (4 + Math.floor(Math.random() * 9)) * 60 * 1000;
      }
    }

    const isSwingTrade = Math.random() < 0.12;
    const holdSeconds = isSwingTrade
      ? 22 * 3600 + Math.floor(Math.random() * 50 * 3600)
      : 12 * 60 + Math.floor(Math.random() * (6 * 60 * 60));
    const closeTs: number = openTs + holdSeconds * 1000;
    const openTime = new Date(openTs);
    const closeTime = new Date(closeTs);
    const volume = roundTo(
      isGold ? 0.2 + Math.random() * 0.8 : 0.2 + Math.random() * 1.2,
      2
    );
    const openPrice =
      basePrices[symbol] +
      (Math.random() - 0.5) *
        pipSize *
        (isGold ? 300 : symbol === "USDJPY" ? 220 : 180);
    let plannedRR = roundTo(
      phase.name === "refined-edge"
        ? 1.8 + Math.random() * 1.2
        : phase.name === "leak-cluster"
        ? 1.2 + Math.random() * 1.0
        : 1.4 + Math.random() * 1.3,
      2
    );
    if (model === "Liquidity Raid") plannedRR = roundTo(plannedRR + 0.18, 2);
    if (alignment === "against") plannedRR = roundTo(plannedRR - 0.12, 2);
    const riskPips = roundTo(
      isGold ? 45 + Math.random() * 85 : 12 + Math.random() * 28,
      1
    );
    const targetPips = roundTo(riskPips * plannedRR, 1);
    let edgeScore = phase.baseEdge;
    edgeScore +=
      session === "London" ? 0.11 : session === "New York" ? 0.02 : -0.11;
    edgeScore +=
      alignment === "aligned"
        ? 0.14
        : alignment === "discretionary"
        ? -0.03
        : -0.18;
    edgeScore +=
      model === "Liquidity Raid"
        ? 0.1
        : model === "Breaker Block"
        ? 0.05
        : model === "Supply Zone"
        ? -0.01
        : -0.08;
    if (
      session === "London" &&
      model === "Liquidity Raid" &&
      alignment === "aligned"
    ) {
      edgeScore += 0.16;
    }
    if (
      session === "New York" &&
      model === "Breaker Block" &&
      alignment === "aligned"
    ) {
      edgeScore += 0.08;
    }
    if (session === "Asian" && model === "Trend Continuation") {
      edgeScore -= 0.2;
    }
    if (
      session === "New York" &&
      alignment !== "aligned" &&
      (symbol === "GBPUSD" || symbol === "XAUUSD")
    ) {
      edgeScore -= 0.16;
    }
    if (
      phase.name === "refined-edge" &&
      session === "London" &&
      symbol === "EURUSD"
    ) {
      edgeScore += 0.08;
    }
    if (phase.name === "leak-cluster" && alignment !== "aligned") {
      edgeScore -= 0.08;
    }
    if (tradeDirection === "long" && session === "Asian") {
      edgeScore -= 0.03;
    }
    if (consecutiveLosses >= 2) {
      edgeScore += phase.name === "leak-cluster" ? -0.06 : -0.02;
    }
    if (consecutiveWins >= 3 && phase.name === "refined-edge") {
      edgeScore += 0.03;
    }

    const forcedOutcome = forcedOutcomes.get(i) ?? null;
    const winProbability = clampNumber(0.24, 0.82, 0.51 + edgeScore);
    const breakevenProbability = forcedOutcome
      ? 0
      : phase.name === "leak-cluster"
      ? 0.05
      : 0.08;

    let outcomeBucket: "win" | "loss" | "breakeven";
    if (forcedOutcome) {
      outcomeBucket = forcedOutcome;
    } else {
      const resultRoll = Math.random();
      if (resultRoll < winProbability) {
        outcomeBucket = "win";
      } else if (resultRoll < winProbability + breakevenProbability) {
        outcomeBucket = "breakeven";
      } else {
        outcomeBucket = "loss";
      }
    }

    let realisedRRSeed: number;
    if (outcomeBucket === "win") {
      const minWinRR =
        phase.name === "refined-edge"
          ? 1.2
          : phase.name === "foundation"
            ? 0.85
            : phase.name === "recovery"
              ? 0.95
              : 0.65;
      const maxWinRR =
        phase.name === "refined-edge"
          ? 2.8
          : phase.name === "foundation"
            ? 2.15
            : phase.name === "recovery"
              ? 2.25
              : 1.65;
      realisedRRSeed = roundTo(
        randBetween(minWinRR, maxWinRR) +
          (alignment === "aligned" ? 0.1 : -0.06) +
          (session === "London" ? 0.08 : 0),
        2
      );
    } else if (outcomeBucket === "breakeven") {
      realisedRRSeed = roundTo((Math.random() - 0.5) * 0.18, 2);
    } else {
      const baseLoss =
        alignment === "aligned"
          ? randBetween(0.35, 0.85)
          : randBetween(0.75, 1.12);
      realisedRRSeed = -roundTo(
        Math.min(
          1.3,
          baseLoss +
            (phase.name === "leak-cluster" ? 0.08 : 0) +
            (session === "Asian" && model === "Trend Continuation" ? 0.06 : 0)
        ),
        2
      );
    }

    const resultPips = roundTo(riskPips * realisedRRSeed, 1);
    const closePrice = openPrice + directionFactor * resultPips * pipSize;
    const sl = openPrice - directionFactor * riskPips * pipSize;
    const tp = openPrice + directionFactor * targetPips * pipSize;

    const favorablePips =
      resultPips >= 0
        ? Math.max(
            resultPips,
            roundTo(
              riskPips * (Math.abs(realisedRRSeed) + 0.2 + Math.random() * 0.8),
              1
            )
          )
        : roundTo(riskPips * (0.15 + Math.random() * 0.9), 1);
    const adversePips =
      resultPips < 0
        ? Math.max(
            Math.abs(resultPips),
            roundTo(riskPips * (0.7 + Math.random() * 0.5), 1)
          )
        : roundTo(riskPips * (0.12 + Math.random() * 0.75), 1);
    const postExitContinuationPips = roundTo(
      riskPips *
        (resultPips >= 0
          ? 0.15 + Math.random() * 0.9
          : 0.1 + Math.random() * 0.5),
      1
    );

    const entryPeakPrice =
      tradeDirection === "long"
        ? openPrice + favorablePips * pipSize
        : openPrice - favorablePips * pipSize;
    const postExitPeakPrice =
      tradeDirection === "long"
        ? closePrice + postExitContinuationPips * pipSize
        : closePrice - postExitContinuationPips * pipSize;
    const manipulationHigh =
      tradeDirection === "long"
        ? openPrice + favorablePips * pipSize
        : openPrice + adversePips * pipSize;
    const manipulationLow =
      tradeDirection === "long"
        ? openPrice - adversePips * pipSize
        : openPrice - favorablePips * pipSize;

    const poorExecutionBias =
      phase.name === "leak-cluster" || alignment !== "aligned";
    const commissionCost = roundTo(volume * (isGold ? 7.2 : 6.1), 2);
    const nightsCrossed = Math.floor(holdSeconds / 86_400);
    const swapValue =
      nightsCrossed === 0
        ? 0
        : roundTo(
            nightsCrossed *
              (Math.random() - 0.72) *
              volume *
              (isGold ? 5.5 : 1.8),
            2
          );
    const grossProfit = resultPips * volume * pipValue;
    const netProfit = roundTo(grossProfit - commissionCost + swapValue, 2);
    const entryMargin = roundTo(
      (volume * (isGold ? 100 : 100_000) * openPrice) / 100,
      2
    );
    const entryEquity = roundTo(
      runningBalance + (Math.random() - 0.5) * 250,
      2
    );
    const entryFreeMargin = roundTo(entryEquity - entryMargin, 2);
    const entryMarginLevel =
      entryMargin > 0 ? roundTo((entryEquity / entryMargin) * 100, 2) : null;
    const entryPeakDurationSeconds = Math.max(
      90,
      Math.min(
        holdSeconds - 60,
        Math.round(holdSeconds * (0.18 + Math.random() * 0.55))
      )
    );
    const postExitPeakDurationSeconds =
      5 * 60 + Math.floor(Math.random() * 55 * 60);
    const postExitSamplingDuration = Math.max(
      3600,
      postExitPeakDurationSeconds + 300
    );
    const entryPeakTimestamp = new Date(
      openTs + entryPeakDurationSeconds * 1000
    );
    const postExitPeakTimestamp = new Date(
      closeTs + postExitPeakDurationSeconds * 1000
    );
    const entrySpreadPips = roundTo(
      isGold
        ? 2.2 + Math.random() * (poorExecutionBias ? 2.6 : 1.6)
        : 0.4 + Math.random() * (poorExecutionBias ? 1.8 : 1.1),
      1
    );
    const exitSpreadPips = roundTo(
      entrySpreadPips +
        (Math.random() - 0.3) * (poorExecutionBias ? 0.8 : 0.5),
      1
    );
    const entrySlippagePips = roundTo(
      Math.random() *
        (poorExecutionBias ? (isGold ? 2.1 : 0.9) : isGold ? 1.1 : 0.35),
      1
    );
    const exitSlippagePips = roundTo(
      Math.random() *
        (poorExecutionBias ? (isGold ? 2.4 : 1.1) : isGold ? 1.2 : 0.45),
      1
    );
    const scaleInCount =
      Math.random() > (poorExecutionBias ? 0.68 : 0.82) ? 1 : 0;
    const scaleOutCount =
      Math.random() > (alignment === "aligned" ? 0.78 : 0.64) ? 1 : 0;
    const partialCloseCount =
      scaleOutCount > 0 ? 1 + Math.floor(Math.random() * 2) : 0;
    const entryDealCount = 1 + scaleInCount;
    const exitDealCount = 1 + partialCloseCount;
    const exitVolume = roundTo(
      Math.max(volume - (partialCloseCount > 0 ? volume * 0.15 : 0), 0.01),
      2
    );
    const alphaWeightedMpe = 0.3;
    const beThresholdPips = isGold ? 1 : 0.5;

    const exitReason =
      outcomeBucket === "win"
        ? Math.random() > 0.18
          ? "tp"
          : "expert"
        : outcomeBucket === "loss"
          ? Math.random() > 0.18
            ? "sl"
            : "expert"
          : "client";
    const tradeComment = `[ProfitEdge] ${exitReason}`;
    const tradeBrokerMeta = {
      comment: tradeComment,
      magicNumber: 11001,
      entryDeal: {
        dealId: 200000 + i,
        reason: "expert",
        type: tradeDirection === "long" ? "buy" : "sell",
      },
      exitDeal: {
        dealId: 200001 + i,
        reason: exitReason,
        type: tradeDirection === "long" ? "sell" : "buy",
      },
    };

    const advanced = calculateAllAdvancedMetrics(
      {
        id: `${accountId}-${i}`,
        symbol,
        tradeDirection,
        entryPrice: openPrice,
        sl,
        tp,
        closePrice,
        profit: netProfit,
        commissions: commissionCost,
        swap: swapValue,
        volume,
        manipulationHigh,
        manipulationLow,
        manipulationPips: null,
        entryPeakPrice,
        postExitPeakPrice,
        alphaWeightedMpe,
        beThresholdPips,
      },
      tradeCount,
      true
    );

    const tradeId = crypto.randomUUID();
    closedTrades.push({
      id: tradeId,
      accountId,
      ticket: `SIM-${String(i + 1).padStart(5, "0")}`,
      open: openTime.toISOString(),
      tradeType: tradeDirection,
      volume: volume.toFixed(2),
      symbol,
      openPrice: formatPrice(symbol, openPrice),
      sl: formatPrice(symbol, sl),
      tp: formatPrice(symbol, tp),
      close: closeTime.toISOString(),
      closePrice: formatPrice(symbol, closePrice),
      swap: swapValue.toFixed(2),
      commissions: commissionCost.toFixed(2),
      profit: netProfit.toFixed(2),
      pips: resultPips.toFixed(1),
      tradeDurationSeconds: holdSeconds.toString(),
      openTime,
      closeTime,
      useBrokerData: 1,
      manipulationHigh: formatPrice(symbol, manipulationHigh),
      manipulationLow: formatPrice(symbol, manipulationLow),
      manipulationPips:
        advanced.manipulationPips != null
          ? advanced.manipulationPips.toFixed(1)
          : null,
      entryPeakPrice: formatPrice(symbol, entryPeakPrice),
      entryPeakTimestamp,
      postExitPeakPrice: formatPrice(symbol, postExitPeakPrice),
      postExitPeakTimestamp,
      postExitSamplingDuration,
      entrySpreadPips: entrySpreadPips.toFixed(1),
      exitSpreadPips: exitSpreadPips.toFixed(1),
      entrySlippagePips: entrySlippagePips.toFixed(1),
      exitSlippagePips: exitSlippagePips.toFixed(1),
      slModCount: poorExecutionBias
        ? 2 + Math.floor(Math.random() * 3)
        : Math.floor(Math.random() * 2),
      tpModCount:
        alignment === "aligned"
          ? Math.floor(Math.random() * 2)
          : 1 + Math.floor(Math.random() * 2),
      partialCloseCount,
      exitDealCount,
      exitVolume: exitVolume.toFixed(2),
      entryDealCount,
      entryVolume: volume.toFixed(2),
      scaleInCount,
      scaleOutCount,
      trailingStopDetected:
        alignment === "aligned" ? Math.random() > 0.48 : Math.random() > 0.74,
      entryPeakDurationSeconds,
      postExitPeakDurationSeconds,
      entryBalance: runningBalance.toFixed(2),
      entryEquity: entryEquity.toFixed(2),
      entryMargin: entryMargin.toFixed(2),
      entryFreeMargin: entryFreeMargin.toFixed(2),
      entryMarginLevel:
        entryMarginLevel != null ? entryMarginLevel.toFixed(2) : null,
      alphaWeightedMpe: alphaWeightedMpe.toFixed(2),
      beThresholdPips: beThresholdPips.toFixed(2),
      sessionTag: session,
      sessionTagColor: sessionColors[session],
      modelTag: model,
      modelTagColor: modelColors[model],
      protocolAlignment: alignment,
      outcome: advanced.outcome,
      plannedRR:
        advanced.plannedRR != null ? advanced.plannedRR.toFixed(2) : null,
      plannedRiskPips:
        advanced.plannedRiskPips != null
          ? advanced.plannedRiskPips.toFixed(1)
          : null,
      plannedTargetPips:
        advanced.plannedTargetPips != null
          ? advanced.plannedTargetPips.toFixed(1)
          : null,
      mfePips: advanced.mfePips != null ? advanced.mfePips.toFixed(1) : null,
      maePips: advanced.maePips != null ? advanced.maePips.toFixed(1) : null,
      mpeManipLegR:
        advanced.mpeManipLegR != null ? advanced.mpeManipLegR.toFixed(2) : null,
      mpeManipPE_R:
        advanced.mpeManipPE_R != null ? advanced.mpeManipPE_R.toFixed(2) : null,
      maxRR: advanced.maxRR != null ? advanced.maxRR.toFixed(2) : null,
      rawSTDV: advanced.rawSTDV != null ? advanced.rawSTDV.toFixed(2) : null,
      rawSTDV_PE:
        advanced.rawSTDV_PE != null ? advanced.rawSTDV_PE.toFixed(2) : null,
      stdvBucket: advanced.stdvBucket,
      estimatedWeightedMPE_R:
        advanced.estimatedWeightedMPE_R != null
          ? advanced.estimatedWeightedMPE_R.toFixed(2)
          : null,
      realisedRR:
        advanced.realisedRR != null ? advanced.realisedRR.toFixed(2) : null,
      rrCaptureEfficiency:
        advanced.rrCaptureEfficiency != null
          ? advanced.rrCaptureEfficiency.toFixed(2)
          : null,
      manipRREfficiency:
        advanced.manipRREfficiency != null
          ? advanced.manipRREfficiency.toFixed(2)
          : null,
      exitEfficiency:
        advanced.exitEfficiency != null
          ? advanced.exitEfficiency.toFixed(2)
          : null,
      killzone: session,
      killzoneColor: sessionColors[session],
      brokerMeta: tradeBrokerMeta,
      createdAt: closeTime,
    });

    runningBalance = roundTo(runningBalance + netProfit, 2);
    previousCloseTs = closeTs;
    previousSession = session;
    previousOutcome = outcomeBucket;
    if (outcomeBucket === "loss") {
      consecutiveLosses += 1;
      consecutiveWins = 0;
    } else if (outcomeBucket === "win") {
      consecutiveWins += 1;
      consecutiveLosses = 0;
    } else {
      consecutiveWins = 0;
      consecutiveLosses = 0;
    }
  }

  const liveOpenTrades: (typeof openTrade.$inferInsert)[] = [];
  let totalFloatingPnl = 0;
  let totalOpenMargin = 0;

  for (let i = 0; i < openTradeCount; i++) {
    const symbol = pick(symbols);
    const session = pick(sessions);
    const direction = Math.random() > 0.5 ? "long" : "short";
    const directionFactor = direction === "long" ? 1 : -1;
    const isGold = symbol === "XAUUSD";
    const pipSize = pipSizes[symbol];
    const pipValue = pipValuePerLot[symbol];
    const volume = roundTo(
      isGold ? 0.2 + Math.random() * 0.6 : 0.2 + Math.random() * 1.0,
      2
    );
    const openPrice =
      basePrices[symbol] +
      (Math.random() - 0.5) *
        pipSize *
        (isGold ? 160 : symbol === "USDJPY" ? 120 : 100);
    const riskPips = roundTo(
      isGold ? 40 + Math.random() * 55 : 10 + Math.random() * 18,
      1
    );
    const targetPips = roundTo(riskPips * (1.6 + Math.random() * 1.2), 1);
    const openTs = now - (20 * 60 * 1000 + Math.random() * 8 * 60 * 60 * 1000);
    const currentPips = roundTo((Math.random() - 0.2) * riskPips * 0.9, 1);
    const currentPrice = openPrice + directionFactor * currentPips * pipSize;
    const sl = openPrice - directionFactor * riskPips * pipSize;
    const tp = openPrice + directionFactor * targetPips * pipSize;
    const commission = roundTo(volume * (isGold ? 3.4 : 2.8), 2);
    const swap = roundTo((Math.random() - 0.65) * volume * 0.8, 2);
    const floatingPnl = roundTo(
      currentPips * volume * pipValue - commission + swap,
      2
    );
    const margin = roundTo(
      (volume * (isGold ? 100 : 100_000) * openPrice) / 100,
      2
    );

    totalFloatingPnl += floatingPnl;
    totalOpenMargin += margin;

    liveOpenTrades.push({
      id: crypto.randomUUID(),
      accountId,
      ticket: `LIVE-${String(i + 1).padStart(4, "0")}`,
      symbol,
      tradeType: direction,
      volume: volume.toFixed(2),
      openPrice: formatPrice(symbol, openPrice),
      openTime: new Date(openTs),
      sl: formatPrice(symbol, sl),
      tp: formatPrice(symbol, tp),
      currentPrice: formatPrice(symbol, currentPrice),
      swap: swap.toFixed(2),
      commission: commission.toFixed(2),
      profit: floatingPnl.toFixed(2),
      sessionTag: session,
      sessionTagColor: sessionColors[session],
      slModCount: Math.floor(Math.random() * 2),
      tpModCount: Math.floor(Math.random() * 2),
      partialCloseCount: Math.random() > 0.8 ? 1 : 0,
      entryDealCount: 1,
      exitDealCount: 0,
      entryVolume: volume.toFixed(2),
      exitVolume: "0.00",
      scaleInCount: 0,
      scaleOutCount: 0,
      trailingStopDetected: Math.random() > 0.6,
      comment: `Live demo ${session} setup`,
      magicNumber: 1000 + i,
      lastUpdatedAt: nowDate,
      createdAt: new Date(openTs),
    });
  }

  const liveBalance = roundTo(runningBalance, 2);
  const liveEquity = roundTo(liveBalance + totalFloatingPnl, 2);
  const liveMargin = roundTo(totalOpenMargin, 2);
  const liveFreeMargin = roundTo(liveEquity - liveMargin, 2);

  const closedTradesByDay = new Map<
    string,
    { profit: number; count: number; closeTimes: Date[] }
  >();
  for (const row of closedTrades) {
    const dateKey = formatDay(row.closeTime as Date);
    const existing = closedTradesByDay.get(dateKey) || {
      profit: 0,
      count: 0,
      closeTimes: [],
    };
    existing.profit += Number(row.profit || 0);
    existing.count += 1;
    existing.closeTimes.push(row.closeTime as Date);
    closedTradesByDay.set(dateKey, existing);
  }

  const snapshots: (typeof equitySnapshot.$inferInsert)[] = [];
  let rollingBalance = initialBalance;

  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - dayOffset);
    const dateKey = formatDay(date);
    const dayData = closedTradesByDay.get(dateKey) || {
      profit: 0,
      count: 0,
      closeTimes: [],
    };
    const startingBalance = rollingBalance;
    const dailyProfit = roundTo(dayData.profit, 2);
    const endingBalance = roundTo(startingBalance + dailyProfit, 2);
    const floatingForDay = dayOffset === 0 ? totalFloatingPnl : 0;
    const endingEquity = roundTo(endingBalance + floatingForDay, 2);
    const dailyHighWaterMark = roundTo(
      Math.max(startingBalance, endingBalance, endingEquity) +
        (dayData.count > 0 ? Math.random() * 180 : 0),
      2
    );
    const lowEquity = roundTo(
      Math.min(startingBalance, endingBalance, endingEquity) -
        (dayData.count > 0 ? Math.random() * 140 : 0),
      2
    );
    const dailyDrawdown = roundTo(
      Math.max(0, dailyHighWaterMark - lowEquity),
      2
    );
    const dailyDrawdownPercent = roundTo(
      dailyHighWaterMark > 0 ? (dailyDrawdown / dailyHighWaterMark) * 100 : 0,
      2
    );

    snapshots.push({
      accountId,
      snapshotDate: dateKey,
      balance: endingBalance.toFixed(2),
      equity: endingEquity.toFixed(2),
      floatingPnl: floatingForDay.toFixed(2),
      highEquity: dailyHighWaterMark.toFixed(2),
      lowEquity: lowEquity.toFixed(2),
      closedTradesCount: dayData.count,
      dailyRealizedPnl: dailyProfit.toFixed(2),
      source: "manual",
      createdAt: new Date(date.getTime() + 18 * 60 * 60 * 1000),
      updatedAt: new Date(date.getTime() + 18 * 60 * 60 * 1000),
    });
    rollingBalance = endingBalance;
  }

  const [account] = await db
    .insert(tradingAccount)
    .values({
      id: accountId,
      userId,
      name: DEMO_ACCOUNT_NAME,
      broker: DEMO_BROKER,
      brokerType: "mt5",
      brokerServer: DEMO_BROKER_SERVER,
      accountNumber,
      preferredDataSource: "broker",
      averageSpreadPips: "1.20",
      initialBalance: initialBalance.toFixed(2),
      initialCurrency: "USD",
      isVerified: 1,
      liveBalance: liveBalance.toFixed(2),
      liveEquity: liveEquity.toFixed(2),
      liveMargin: liveMargin.toFixed(2),
      liveFreeMargin: liveFreeMargin.toFixed(2),
      lastSyncedAt: nowDate,
      propManualOverride: false,
      verificationLevel: "ea_synced",
      socialOptIn: true,
      socialVisibleSince: new Date(now - 14 * 24 * 60 * 60 * 1000),
      followerCount: 12,
      feedEventCount: 0,
    })
    .returning();

  for (let i = 0; i < closedTrades.length; i += 25) {
    await db.insert(trade).values(closedTrades.slice(i, i + 25));
  }

  if (liveOpenTrades.length > 0) {
    await db.insert(openTrade).values(liveOpenTrades);
  }

  for (let i = 0; i < snapshots.length; i += 25) {
    await db.insert(equitySnapshot).values(snapshots.slice(i, i + 25));
  }

  const checklistTemplateId = crypto.randomUUID();
  await db.insert(tradeChecklistTemplate).values({
    id: checklistTemplateId,
    accountId,
    userId,
    name: "Demo Pre-Trade Checklist",
    description: "Seeded checklist for the demo account",
    strategyTag: "Liquidity Raid",
    items: [
      { label: "Session bias is clear", isRequired: true, category: "context" },
      {
        label: "Risk is defined before entry",
        isRequired: true,
        category: "risk",
      },
      {
        label: "Entry matches model criteria",
        isRequired: true,
        category: "execution",
      },
      {
        label: "News and liquidity context checked",
        isRequired: false,
        category: "context",
      },
    ],
    isDefault: true,
  });

  const checklistSeedTrades = closedTrades.slice(-36);
  const checklistRows: (typeof tradeChecklistResult.$inferInsert)[] =
    checklistSeedTrades.map((row, index) => {
      const completionRate = Math.max(
        50,
        Math.min(100, 72 + ((index % 5) - 2) * 8 + Math.random() * 12)
      );
      const completedItems = Array.from({ length: 4 }, (_, itemIndex) => ({
        itemIndex,
        checked: itemIndex < Math.round((completionRate / 100) * 4),
        timestamp: new Date(
          (row.openTime as Date).getTime() - (4 - itemIndex) * 60 * 1000
        ).toISOString(),
      }));

      return {
        id: crypto.randomUUID(),
        templateId: checklistTemplateId,
        tradeId: row.id,
        accountId,
        userId,
        completedItems,
        completionRate: completionRate.toFixed(2),
        createdAt: new Date((row.openTime as Date).getTime() - 5 * 60 * 1000),
      };
    });

  if (checklistRows.length > 0) {
    await db.insert(tradeChecklistResult).values(checklistRows);
  }

  const reviewTradeIds = closedTrades
    .slice(-36)
    .map((row) => row.id)
    .filter((tradeId): tradeId is string => Boolean(tradeId));
  for (const tradeId of reviewTradeIds) {
    await createAutoTradeReviewEntry({ userId, tradeId });
  }

  const feedTradeIds = closedTrades
    .slice(-24)
    .map((row) => row.id)
    .filter((tradeId): tradeId is string => Boolean(tradeId));
  for (const tradeId of feedTradeIds) {
    await generateFeedEventForTrade(tradeId).catch((error) => {
      console.error(
        "[createSampleAccount] feed event generation failed",
        error
      );
    });
  }

  const richTradeSeedRows = closedTrades.slice(-18).reverse();
  const mediaRows: (typeof tradeMedia.$inferInsert)[] = [];
  const noteRows: (typeof tradeNote.$inferInsert)[] = [];
  const annotationRows: (typeof tradeAnnotation.$inferInsert)[] = [];

  richTradeSeedRows.forEach((row, index) => {
    if (!row.id) return;
    const symbol = row.symbol || "TRADE";
    const pnl = Number(row.profit || 0);
    const realizedRR = Number(row.realisedRR || 0);
    const session = row.sessionTag || "London";
    const model = row.modelTag || "Discretionary";
    const closeTime = (row.closeTime as Date) || nowDate;
    const entryAccent = pnl >= 0 ? "#14b8a6" : "#f59e0b";
    const analysisAccent = pnl >= 0 ? "#22c55e" : "#f43f5e";
    const tradeLabel = `${symbol} ${String(row.tradeType || "").toUpperCase()}`;
    const noteText = [
      `${tradeLabel} in ${session} using ${model}.`,
      pnl >= 0
        ? `Execution stayed patient and realized ${realizedRR.toFixed(2)}R.`
        : `Loss came from weak follow-through after entry and closed at ${realizedRR.toFixed(
            2
          )}R.`,
      `Next focus: ${
        pnl >= 0
          ? "repeat the same process without adding risk"
          : "tighten qualification before the click"
      }.`,
    ].join(" ");

    mediaRows.push(
      {
        id: crypto.randomUUID(),
        tradeId: row.id,
        userId,
        mediaType: "image",
        url: createDemoTradeImage({
          symbol,
          title: "Entry Context",
          accent: entryAccent,
          subtitle: `${session} session · ${model} · ${tradeLabel}`,
          metric: `Risk ${Number(row.plannedRiskPips || 0).toFixed(1)} pips`,
        }),
        thumbnailUrl: null,
        fileName: `${symbol.toLowerCase()}-entry-context.svg`,
        fileSize: 24_000,
        mimeType: "image/svg+xml",
        width: 1280,
        height: 720,
        altText: `${symbol} entry context screenshot`,
        caption: `${session} setup context`,
        description: `Seeded entry screenshot showing the setup context for ${tradeLabel}.`,
        isEntryScreenshot: true,
        isExitScreenshot: false,
        isAnalysis: false,
        sortOrder: 0,
        createdAt: new Date(closeTime.getTime() - 10 * 60 * 1000),
      },
      {
        id: crypto.randomUUID(),
        tradeId: row.id,
        userId,
        mediaType: "image",
        url: createDemoTradeImage({
          symbol,
          title: "Post-Trade Review",
          accent: analysisAccent,
          subtitle: `${
            pnl >= 0 ? "Winner managed" : "Loss reviewed"
          } · ${session}`,
          metric: `${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toFixed(2)}`,
        }),
        thumbnailUrl: null,
        fileName: `${symbol.toLowerCase()}-post-trade-review.svg`,
        fileSize: 26_000,
        mimeType: "image/svg+xml",
        width: 1280,
        height: 720,
        altText: `${symbol} analysis screenshot`,
        caption: "Post-trade markup",
        description: `Seeded post-trade review screenshot for ${tradeLabel}.`,
        isEntryScreenshot: false,
        isExitScreenshot: index % 3 === 0,
        isAnalysis: true,
        sortOrder: 1,
        createdAt: new Date(closeTime.getTime() - 2 * 60 * 1000),
      }
    );

    noteRows.push({
      id: crypto.randomUUID(),
      tradeId: row.id,
      userId,
      content: [
        {
          id: crypto.randomUUID(),
          type: "paragraph",
          content: noteText,
        },
      ],
      htmlContent: `<p>${noteText}</p>`,
      plainTextContent: noteText,
      wordCount: noteText.split(/\s+/).filter(Boolean).length,
      createdAt: new Date(closeTime.getTime() - 90 * 1000),
      updatedAt: new Date(closeTime.getTime() - 90 * 1000),
    });

    annotationRows.push({
      id: crypto.randomUUID(),
      tradeId: row.id,
      userId,
      content:
        pnl >= 0
          ? `${session} ${model} execution stayed within plan and paid as expected.`
          : `${session} trade slipped away after entry. Qualification needs to be tighter next time.`,
      annotationType:
        pnl >= 0
          ? "execution_note"
          : index % 2 === 0
            ? "rule_note"
            : "learning_note",
      isPublic: index < 6 && pnl >= 0,
      createdAt: new Date(closeTime.getTime() - 60 * 1000),
      editableUntil: new Date(closeTime.getTime() + 4 * 60 * 1000),
      editedAt: null,
    });
  });

  if (mediaRows.length > 0) {
    for (let i = 0; i < mediaRows.length; i += 25) {
      await db.insert(tradeMedia).values(mediaRows.slice(i, i + 25));
    }
  }

  if (noteRows.length > 0) {
    for (let i = 0; i < noteRows.length; i += 25) {
      await db.insert(tradeNote).values(noteRows.slice(i, i + 25));
    }
  }

  if (annotationRows.length > 0) {
    for (let i = 0; i < annotationRows.length; i += 25) {
      await db.insert(tradeAnnotation).values(annotationRows.slice(i, i + 25));
    }
  }

  const alignedTradeCount = closedTrades.filter(
    (row) => row.protocolAlignment === "aligned"
  ).length;
  const totalLosses = closedTrades.filter(
    (row) => Number(row.profit || 0) < 0
  ).length;
  const sortedClosedTrades = [...closedTrades].sort(
    (a, b) => (a.closeTime as Date).getTime() - (b.closeTime as Date).getTime()
  );
  let properBreaks = 0;
  for (let i = 0; i < sortedClosedTrades.length - 1; i++) {
    if (Number(sortedClosedTrades[i].profit || 0) >= 0) continue;
    const gapMinutes =
      ((sortedClosedTrades[i + 1].openTime as Date).getTime() -
        (sortedClosedTrades[i].closeTime as Date).getTime()) /
      60000;
    if (gapMinutes >= 15) properBreaks++;
  }

  const checklistCompletionRate =
    checklistRows.length > 0
      ? checklistRows.reduce(
          (sum, row) => sum + Number(row.completionRate || 0),
          0
        ) / checklistRows.length
      : 0;
  const journalRate = (reviewTradeIds.length / closedTrades.length) * 100;
  const ruleCompliance = (alignedTradeCount / closedTrades.length) * 100;
  const breakAfterLoss =
    totalLosses > 0 ? (properBreaks / totalLosses) * 100 : 100;
  const winRate =
    (closedTrades.filter((row) => Number(row.profit || 0) > 0).length /
      closedTrades.length) *
    100;
  const totalProfit = closedTrades.reduce(
    (sum, row) => sum + Number(row.profit || 0),
    0
  );
  const averageRR =
    closedTrades.reduce((sum, row) => sum + Number(row.realisedRR || 0), 0) /
    closedTrades.length;

  const tradeDayKeys = [...closedTradesByDay.keys()].sort();
  const fallbackGoalDay =
    closedTrades.at(-1)?.closeTime instanceof Date
      ? formatDay(closedTrades.at(-1)!.closeTime as Date)
      : formatDay(previousTradingDay(nowDate));
  await seedDemoGoalsAndAlerts({
    userId,
    accountId,
    now,
    tradeDayKeys,
    fallbackGoalDay,
    totalProfit,
    journalRate,
    ruleCompliance,
    checklistCompletionRate,
    breakAfterLoss,
    winRate,
    averageRR,
  });
  await seedDemoBacktestSessions({
    userId,
    now,
    basePrices: {
      EURUSD: basePrices.EURUSD,
      XAUUSD: basePrices.XAUUSD,
    },
    pipSizes: {
      EURUSD: pipSizes.EURUSD,
      XAUUSD: pipSizes.XAUUSD,
    },
    pipValuePerLot: {
      EURUSD: pipValuePerLot.EURUSD,
      XAUUSD: pipValuePerLot.XAUUSD,
    },
  });

  const {
    bestSession,
    bestSymbol,
    bestModel,
    weakestSymbol,
    weakestSession,
    weakestProtocol,
  } = await seedDemoDigests({
    userId,
    accountId,
    now,
    closedTrades,
    totalProfit,
    winRate,
    alignedTradeCount,
    totalLosses,
  });

  await seedDemoAiHistory({
    userId,
    accountId,
    now,
    bestSession,
    bestSymbol,
    bestModel,
    weakestSymbol,
    weakestSession,
    weakestProtocol,
  });

  return {
    account,
    tradeCount: closedTrades.length,
    openTradeCount: liveOpenTrades.length,
  };
}
