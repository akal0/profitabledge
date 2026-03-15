"use client";

import { toast } from "sonner";
import {
  useCallback,
  useEffect,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { CandleData } from "@/components/charts/trading-view-chart";

import {
  type BacktestTimeframe,
  type BacktestTrade,
  type ReplayCheckpoint,
  type ReplayMistake,
  type ReplayNewsEvent,
  type ReplayPatternMatch,
  type ReplayPatternTemplate,
  type ReplayTimelineEvent,
  type ReviewPlaybackMode,
  type WorkspaceTab,
  TIMEFRAME_TO_SECONDS,
} from "../lib/replay-domain";
import {
  buildPatternFeatureVector,
  clamp,
  extractScopedTag,
  formatPrice,
  formatSignedCurrency,
  getEntryUnix,
  getExitUnix,
  getPatternSimilarityScore,
  getSessionTagFromUnix,
  nearestCandleIndex,
  toDateTimeLocalValue,
} from "../lib/replay-utils";

type ReplayReviewStats = {
  noteCoverage: number;
  structureRate: number;
  processScore: number;
};

type UseReplayReviewModeArgs = {
  allCandles: CandleData[];
  calendarEvents: ReplayNewsEvent[];
  checkpoints: ReplayCheckpoint[];
  closedTrades: BacktestTrade[];
  currentTimeUnix: number;
  hideUpcomingHighImpactNews: boolean;
  initialBalance: number;
  isReviewPlaybackRunning: boolean;
  patternLibrary: ReplayPatternTemplate[];
  pipSize: number;
  playbackSpeed: number;
  replayTrades: BacktestTrade[];
  reviewEventId: string | null;
  reviewPlaybackMode: ReviewPlaybackMode;
  selectedPatternId: string | null;
  setCurrentIndex: Dispatch<SetStateAction<number>>;
  setGoToDateTime: Dispatch<SetStateAction<string>>;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  setIsReviewPlaybackRunning: Dispatch<SetStateAction<boolean>>;
  setReviewEventId: Dispatch<SetStateAction<string | null>>;
  setWorkspaceTab: Dispatch<SetStateAction<WorkspaceTab>>;
  stats: ReplayReviewStats;
  symbol: string;
  timeframe: BacktestTimeframe;
};

export function useReplayReviewMode({
  allCandles,
  calendarEvents,
  checkpoints,
  closedTrades,
  currentTimeUnix,
  hideUpcomingHighImpactNews,
  initialBalance,
  isReviewPlaybackRunning,
  patternLibrary,
  pipSize,
  playbackSpeed,
  replayTrades,
  reviewEventId,
  reviewPlaybackMode,
  selectedPatternId,
  setCurrentIndex,
  setGoToDateTime,
  setIsPlaying,
  setIsReviewPlaybackRunning,
  setReviewEventId,
  setWorkspaceTab,
  stats,
  symbol,
  timeframe,
}: UseReplayReviewModeArgs) {
  const replayMistakes = useMemo<ReplayMistake[]>(() => {
    const issues: ReplayMistake[] = [];
    const chronologicallyClosed = [...closedTrades].sort(
      (left, right) =>
        (getExitUnix(left) || getEntryUnix(left)) -
        (getExitUnix(right) || getEntryUnix(right))
    );

    chronologicallyClosed.forEach((trade, index) => {
      const exitUnix = getExitUnix(trade) || getEntryUnix(trade);
      const rrPlan =
        trade.slPips && trade.tpPips && trade.slPips > 0
          ? trade.tpPips / trade.slPips
          : 0;

      if (!trade.sl) {
        issues.push({
          id: `${trade.id}-no-sl`,
          type: "no-invalidation",
          title: "No invalidation level",
          detail:
            "Trade was placed without a stop loss, so the replay cannot grade invalidation discipline.",
          timeUnix: getEntryUnix(trade),
          tradeId: trade.id,
          severity: "high",
        });
      }

      if (rrPlan > 0 && rrPlan < 1.5) {
        issues.push({
          id: `${trade.id}-rr`,
          type: "poor-rr",
          title: "Subpar planned R:R",
          detail: `Planned reward-to-risk was ${rrPlan.toFixed(2)}R, below the 1.5R floor.`,
          timeUnix: getEntryUnix(trade),
          tradeId: trade.id,
          severity: "medium",
        });
      }

      if ((trade.riskPercent || 0) > 1.5) {
        issues.push({
          id: `${trade.id}-risk`,
          type: "oversized-risk",
          title: "Oversized risk",
          detail: `Trade risked ${(trade.riskPercent || 0).toFixed(2)}% when the replay model expects tighter sizing.`,
          timeUnix: getEntryUnix(trade),
          tradeId: trade.id,
          severity: "medium",
        });
      }

      if (
        typeof trade.maePips === "number" &&
        typeof trade.slPips === "number" &&
        trade.slPips > 0 &&
        trade.maePips < trade.slPips * 0.2 &&
        typeof trade.realizedRR === "number" &&
        trade.realizedRR < 0
      ) {
        issues.push({
          id: `${trade.id}-late`,
          type: "late-entry",
          title: "Late entry structure",
          detail:
            "The trade stopped out without meaningful adverse excursion, which usually means the entry was too late into the move.",
          timeUnix: getEntryUnix(trade),
          tradeId: trade.id,
          severity: "low",
        });
      }

      const previousTrade = chronologicallyClosed[index - 1];
      if (
        previousTrade &&
        (previousTrade.pnl || 0) < 0 &&
        getEntryUnix(trade) -
          (getExitUnix(previousTrade) || getEntryUnix(previousTrade)) <=
          20 * 60
      ) {
        issues.push({
          id: `${trade.id}-revenge`,
          type: "revenge-cluster",
          title: "Revenge cluster",
          detail: "A fresh trade was placed within 20 minutes of a losing exit.",
          timeUnix: getEntryUnix(trade),
          tradeId: trade.id,
          severity: "high",
        });
      }

      const hourCluster = chronologicallyClosed.filter(
        (candidate) =>
          Math.abs(getEntryUnix(candidate) - getEntryUnix(trade)) <= 60 * 60
      );
      if (hourCluster.length >= 4) {
        issues.push({
          id: `${trade.id}-cluster`,
          type: "overtrading-window",
          title: "Overtrading window",
          detail: `${hourCluster.length} trades were opened within one hour.`,
          timeUnix: exitUnix,
          tradeId: trade.id,
          severity: "medium",
        });
      }
    });

    return issues.sort((left, right) => left.timeUnix - right.timeUnix);
  }, [closedTrades]);

  const timelineEvents = useMemo<ReplayTimelineEvent[]>(() => {
    const drawdownEvents: ReplayTimelineEvent[] = [];
    let runningEquity = initialBalance;
    let peak = initialBalance;

    [...closedTrades]
      .sort(
        (left, right) =>
          (getExitUnix(left) || getEntryUnix(left)) -
          (getExitUnix(right) || getEntryUnix(right))
      )
      .forEach((trade) => {
        runningEquity += trade.pnl || 0;
        peak = Math.max(peak, runningEquity);
        const drawdownPct = peak > 0 ? ((peak - runningEquity) / peak) * 100 : 0;
        if (drawdownPct >= 3) {
          drawdownEvents.push({
            id: `dd-${trade.id}`,
            type: "drawdown",
            label: `${drawdownPct.toFixed(1)}% drawdown`,
            helper: "Equity slipped materially from the session peak.",
            timeUnix: getExitUnix(trade) || getEntryUnix(trade),
            tone: "negative",
            tradeId: trade.id,
          });
        }
      });

    const events: ReplayTimelineEvent[] = [
      ...checkpoints.map((checkpoint) => ({
        id: checkpoint.id,
        type: "checkpoint" as const,
        label: checkpoint.label,
        helper: "Manual checkpoint",
        timeUnix: checkpoint.timeUnix,
        tone: "neutral" as const,
      })),
      ...replayTrades.map((trade) => ({
        id: `entry-${trade.id}`,
        type: "trade-entry" as const,
        label: `${trade.direction === "long" ? "Buy" : "Sell"} entry`,
        helper: formatPrice(symbol, trade.entryPrice),
        timeUnix: getEntryUnix(trade),
        tone: "neutral" as const,
        tradeId: trade.id,
      })),
      ...closedTrades.map((trade) => ({
        id: `exit-${trade.id}`,
        type: "trade-exit" as const,
        label: `${trade.exitType || "manual"} exit`,
        helper: formatSignedCurrency(trade.pnl || 0),
        timeUnix: getExitUnix(trade) || getEntryUnix(trade),
        tone: (trade.pnl || 0) >= 0 ? ("positive" as const) : ("negative" as const),
        tradeId: trade.id,
      })),
      ...calendarEvents.map((event) => ({
        id: event.id,
        type: "news" as const,
        label:
          hideUpcomingHighImpactNews &&
          event.impact === "High" &&
          event.timeUnix > currentTimeUnix
            ? "Hidden macro event"
            : event.title,
        helper:
          hideUpcomingHighImpactNews &&
          event.impact === "High" &&
          event.timeUnix > currentTimeUnix
            ? "Hidden until reveal"
            : `${event.country} · ${event.impact}`,
        timeUnix: event.timeUnix,
        tone: event.impact === "High" ? ("negative" as const) : ("neutral" as const),
      })),
      ...drawdownEvents,
      ...replayMistakes.map((mistake) => ({
        id: mistake.id,
        type: "mistake" as const,
        label: mistake.title,
        helper: mistake.detail,
        timeUnix: mistake.timeUnix,
        tone: "negative" as const,
        tradeId: mistake.tradeId,
      })),
    ];

    return events.sort((left, right) => left.timeUnix - right.timeUnix);
  }, [
    calendarEvents,
    checkpoints,
    closedTrades,
    currentTimeUnix,
    hideUpcomingHighImpactNews,
    initialBalance,
    replayMistakes,
    replayTrades,
    symbol,
  ]);

  const reviewStepEvents = useMemo(
    () => timelineEvents.filter((event) => event.type !== "checkpoint"),
    [timelineEvents]
  );

  const scoreExplainers = useMemo(() => {
    return [
      {
        label: "Planned structure",
        value: `${Math.round(stats.structureRate * 100)}%`,
        helper: "Trades with both SL and TP defined.",
      },
      {
        label: "Notes coverage",
        value: `${Math.round(stats.noteCoverage * 100)}%`,
        helper: "Trades with context or review notes attached.",
      },
      {
        label: "Mistakes flagged",
        value: String(replayMistakes.length),
        helper: "Automatic review issues detected in the session.",
      },
    ];
  }, [replayMistakes.length, stats.noteCoverage, stats.structureRate]);

  const scoreNarrative = useMemo(() => {
    if (!replayTrades.length) {
      return "Start placing trades to build a review scorecard.";
    }

    const missingStructure = replayTrades.filter(
      (trade) => !trade.sl || !trade.tp
    ).length;
    const missingNotes = replayTrades.filter(
      (trade) => !trade.notes?.trim()
    ).length;
    const keyLeak = replayMistakes[0]?.title ?? "No major leak detected";

    return `${stats.processScore}/100 process score. ${missingStructure} trades still lack full structure, ${missingNotes} trades have no notes, and the top leak is ${keyLeak.toLowerCase()}.`;
  }, [replayMistakes, replayTrades, stats.processScore]);

  const reviewComparisons = useMemo(() => {
    const winningTrades = closedTrades.filter((trade) => (trade.pnl || 0) > 0);
    const losingTrades = closedTrades.filter((trade) => (trade.pnl || 0) < 0);
    const impulsiveTradeIds = new Set(
      replayMistakes
        .map((mistake) => mistake.tradeId)
        .filter((tradeId): tradeId is string => Boolean(tradeId))
    );
    const aPlusTrades = closedTrades.filter(
      (trade) => !impulsiveTradeIds.has(trade.id)
    );
    const impulsiveTrades = closedTrades.filter((trade) =>
      impulsiveTradeIds.has(trade.id)
    );
    const summarize = (bucket: BacktestTrade[]) => ({
      count: bucket.length,
      avgRR:
        bucket.length > 0
          ? bucket.reduce((sum, trade) => sum + (trade.realizedRR || 0), 0) /
            bucket.length
          : 0,
      avgHold:
        bucket.length > 0
          ? bucket.reduce((sum, trade) => sum + (trade.holdTimeSeconds || 0), 0) /
            bucket.length
          : 0,
      avgRisk:
        bucket.length > 0
          ? bucket.reduce((sum, trade) => sum + (trade.riskPercent || 0), 0) /
            bucket.length
          : 0,
    });

    return [
      {
        label: "Winning vs losing",
        leftLabel: "Winners",
        rightLabel: "Losers",
        left: summarize(winningTrades),
        right: summarize(losingTrades),
      },
      {
        label: "A+ vs impulsive",
        leftLabel: "A+",
        rightLabel: "Impulsive",
        left: summarize(aPlusTrades),
        right: summarize(impulsiveTrades),
      },
    ];
  }, [closedTrades, replayMistakes]);

  const selectedPattern = useMemo(
    () => patternLibrary.find((pattern) => pattern.id === selectedPatternId) ?? null,
    [patternLibrary, selectedPatternId]
  );

  const patternMatches = useMemo<ReplayPatternMatch[]>(() => {
    if (!selectedPattern || allCandles.length < 4) return [];

    const matches: ReplayPatternMatch[] = [];
    allCandles.forEach((_, index) => {
      const featureVector = buildPatternFeatureVector(allCandles, index, pipSize);
      if (!featureVector) return;

      const score = getPatternSimilarityScore(
        selectedPattern.featureVector,
        featureVector
      );
      const timeUnix = Number(allCandles[index]?.time ?? 0);
      if (!Number.isFinite(timeUnix)) return;
      if (
        Math.abs(timeUnix - selectedPattern.anchorTimeUnix) <=
        TIMEFRAME_TO_SECONDS[timeframe] * 2
      ) {
        return;
      }
      if (score < 0.72) return;

      matches.push({
        patternId: selectedPattern.id,
        timeUnix,
        score,
      });
    });

    return matches
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);
  }, [allCandles, pipSize, selectedPattern, timeframe]);

  const bestWorstSelf = useMemo(() => {
    const buckets = new Map<
      string,
      { label: string; count: number; totalPnl: number; wins: number; avgRRTotal: number }
    >();

    closedTrades.forEach((trade) => {
      const sessionBucket = getSessionTagFromUnix(getEntryUnix(trade));
      const modelBucket =
        extractScopedTag(trade.tags, "model:") ?? trade.tags?.[0] ?? "untagged";
      const keyBuckets = [
        { key: `session:${sessionBucket}`, label: `${sessionBucket} window` },
        { key: `setup:${modelBucket}`, label: modelBucket },
      ];

      keyBuckets.forEach(({ key, label }) => {
        const next = buckets.get(key) ?? {
          label,
          count: 0,
          totalPnl: 0,
          wins: 0,
          avgRRTotal: 0,
        };

        next.count += 1;
        next.totalPnl += trade.pnl || 0;
        next.wins += (trade.pnl || 0) > 0 ? 1 : 0;
        next.avgRRTotal += trade.realizedRR || 0;
        buckets.set(key, next);
      });
    });

    const ranked = [...buckets.values()]
      .filter((bucket) => bucket.count >= 2)
      .map((bucket) => ({
        ...bucket,
        avgRR: bucket.avgRRTotal / bucket.count,
        winRate: (bucket.wins / bucket.count) * 100,
      }))
      .sort((left, right) => right.totalPnl - left.totalPnl);

    return {
      best: ranked.slice(0, 2),
      worst: [...ranked].reverse().slice(0, 2),
    };
  }, [closedTrades]);

  const jumpToTimelineEvent = useCallback(
    (eventId: string) => {
      const event = timelineEvents.find((item) => item.id === eventId);
      if (!event || !allCandles.length) return;

      const nextIndex = nearestCandleIndex(allCandles, event.timeUnix);
      setCurrentIndex(nextIndex);
      setGoToDateTime(
        toDateTimeLocalValue(allCandles[nextIndex]?.time ?? event.timeUnix)
      );
      setReviewEventId(eventId);
      setIsPlaying(false);
      setWorkspaceTab("review");
    },
    [
      allCandles,
      setCurrentIndex,
      setGoToDateTime,
      setIsPlaying,
      setReviewEventId,
      setWorkspaceTab,
      timelineEvents,
    ]
  );

  const stepReviewEvent = useCallback(
    (direction: 1 | -1 = 1) => {
      if (!reviewStepEvents.length || !allCandles.length) return;

      const currentEventIndex =
        reviewEventId !== null
          ? reviewStepEvents.findIndex((event) => event.id === reviewEventId)
          : reviewStepEvents.findIndex((event) => event.timeUnix >= currentTimeUnix);
      const fallbackIndex =
        currentEventIndex === -1
          ? direction > 0
            ? -1
            : reviewStepEvents.length
          : currentEventIndex;
      const targetIndex = clamp(
        fallbackIndex + direction,
        0,
        Math.max(reviewStepEvents.length - 1, 0)
      );
      const targetEvent = reviewStepEvents[targetIndex];
      if (!targetEvent) return;
      jumpToTimelineEvent(targetEvent.id);
    },
    [
      allCandles.length,
      currentTimeUnix,
      jumpToTimelineEvent,
      reviewEventId,
      reviewStepEvents,
    ]
  );

  useEffect(() => {
    if (reviewPlaybackMode !== "events" || !isReviewPlaybackRunning) return;
    if (!reviewStepEvents.length) {
      setIsReviewPlaybackRunning(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const currentEventIndex =
        reviewEventId !== null
          ? reviewStepEvents.findIndex((event) => event.id === reviewEventId)
          : reviewStepEvents.findIndex((event) => event.timeUnix >= currentTimeUnix);

      if (currentEventIndex >= reviewStepEvents.length - 1) {
        setIsReviewPlaybackRunning(false);
        return;
      }

      stepReviewEvent(1);
    }, Math.max(500, 1400 / playbackSpeed));

    return () => window.clearTimeout(timeoutId);
  }, [
    currentTimeUnix,
    isReviewPlaybackRunning,
    playbackSpeed,
    reviewEventId,
    reviewPlaybackMode,
    reviewStepEvents,
    setIsReviewPlaybackRunning,
    stepReviewEvent,
  ]);

  const resumeFromMistake = useCallback(
    (mistakeId?: string) => {
      const targetMistake =
        replayMistakes.find((mistake) => mistake.id === mistakeId) ?? replayMistakes[0];
      if (!targetMistake || !allCandles.length) return;

      const anchorIndex = nearestCandleIndex(allCandles, targetMistake.timeUnix);
      const nextIndex = clamp(anchorIndex - 5, 0, Math.max(allCandles.length - 1, 0));
      setCurrentIndex(nextIndex);
      setGoToDateTime(
        toDateTimeLocalValue(allCandles[nextIndex]?.time ?? targetMistake.timeUnix)
      );
      setReviewEventId(targetMistake.id);
      setWorkspaceTab("review");
      setIsPlaying(false);
      toast.success("Replay rewound before the mistake");
    },
    [
      allCandles,
      replayMistakes,
      setCurrentIndex,
      setGoToDateTime,
      setIsPlaying,
      setReviewEventId,
      setWorkspaceTab,
    ]
  );

  return {
    replayMistakes,
    timelineEvents,
    reviewStepEvents,
    scoreExplainers,
    scoreNarrative,
    reviewComparisons,
    selectedPattern,
    patternMatches,
    bestWorstSelf,
    jumpToTimelineEvent,
    stepReviewEvent,
    resumeFromMistake,
  };
}
