"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  type AnnotationTool,
  type CandleData,
  type ChartAnnotation,
} from "@/components/charts/trading-view-chart";
import { ReplayBottomDock } from "@/features/backtest/replay/components/replay-bottom-dock";
import { ReplayChartWorkspace } from "@/features/backtest/replay/components/replay-chart-workspace";
import { ReplayHeader } from "@/features/backtest/replay/components/replay-header";
import { ReplayMainChartPane } from "@/features/backtest/replay/components/replay-main-chart-pane";
import { NewSessionDialog } from "@/features/backtest/replay/components/new-session-dialog";
import { ReplayOrderPanel } from "@/features/backtest/replay/components/replay-order-panel";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { useReplayChartArtifacts } from "@/features/backtest/replay/hooks/use-replay-chart-artifacts";
import { useReplayCandleLoader } from "@/features/backtest/replay/hooks/use-replay-candle-loader";
import { useReplayContextPanels } from "@/features/backtest/replay/hooks/use-replay-context-panels";
import { useReplayExecutionOverlays } from "@/features/backtest/replay/hooks/use-replay-execution-overlays";
import { useReplayInteractions } from "@/features/backtest/replay/hooks/use-replay-interactions";
import { useReplayMarketState } from "@/features/backtest/replay/hooks/use-replay-market-state";
import { useReplayPageLifecycle } from "@/features/backtest/replay/hooks/use-replay-page-lifecycle";
import { useReplayRemoteData } from "@/features/backtest/replay/hooks/use-replay-remote-data";
import { useReplayReviewMode } from "@/features/backtest/replay/hooks/use-replay-review-mode";
import { useReplaySessionControls } from "@/features/backtest/replay/hooks/use-replay-session-controls";
import { useReplaySessionOperations } from "@/features/backtest/replay/hooks/use-replay-session-operations";
import { useReplayTradeEngine } from "@/features/backtest/replay/hooks/use-replay-trade-engine";
import { useReplayWorkspacePersistence } from "@/features/backtest/replay/hooks/use-replay-workspace-persistence";
import {
  CHALLENGE_PRESETS,
  DEFAULT_FAVORITE_TOOLS_BAR_OFFSET,
  SYMBOLS,
  TIMEFRAMES,
  defaultIndicatorSettings,
  defaultSimulationConfig,
  type BacktestPendingOrder,
  type BacktestTimeframe,
  type BacktestTrade,
  type ChallengeConfig,
  type ChallengePresetId,
  type ContextDockSlot,
  type ContextPaneMode,
  type ContextPanePosition,
  type FavoriteToolsBarOffset,
  type IndicatorSettings,
  type LayoutPreset,
  type MonteCarloResult,
  type ReplayCheckpoint,
  type ReplayNewsEvent,
  type ReplayPatternTemplate,
  type ReplaySharedSnapshot,
  type ReplaySimulationConfig,
  type ReviewPlaybackMode,
  type RuleSetOption,
  type RulebookCoachingResult,
  type TimeInForce,
  type WorkspaceTab,
} from "@/features/backtest/replay/lib/replay-domain";
import {
  clamp,
  getDefaultContextTimeframes,
  getEntryUnix,
  getExitUnix,
  getPipSize,
  getTimeframeCompactLabel,
  nearestCandleIndex,
} from "@/features/backtest/replay/lib/replay-utils";
import {
  DEFAULT_REPLAY_END_DATE,
  DEFAULT_REPLAY_START_DATE,
} from "@/features/backtest/replay/lib/replay-session";
import { cn } from "@/lib/utils";
import { trpcClient } from "@/utils/trpc";
import { toast } from "sonner";

function BacktestReplayPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramSessionId = searchParams?.get("sessionId") ?? null;
  const snapshotIdParam = searchParams?.get("snapshot") ?? null;

  const [sessionId, setSessionId] = useState<string | null>(paramSessionId);
  const [sessionName, setSessionName] = useState("Untitled Session");
  const [sessionDescription, setSessionDescription] = useState("");

  const [symbol, setSymbol] = useState("EURUSD");
  const [timeframe, setTimeframe] = useState<BacktestTimeframe>("m5");
  const [startDate, setStartDate] = useState(DEFAULT_REPLAY_START_DATE);
  const [endDate, setEndDate] = useState(DEFAULT_REPLAY_END_DATE);

  const [allCandles, setAllCandles] = useState<CandleData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [goToDateTime, setGoToDateTime] = useState("");
  const [isLoadingCandles, setIsLoadingCandles] = useState(false);

  const [trades, setTrades] = useState<BacktestTrade[]>([]);
  const [initialBalance, setInitialBalance] = useState(10000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [defaultSLPips, setDefaultSLPips] = useState(20);
  const [defaultTPPips, setDefaultTPPips] = useState(40);
  const [showSLTP, setShowSLTP] = useState(true);
  const [tradeDrafts, setTradeDrafts] = useState<Record<string, { sl: string; tp: string }>>({});
  const [pendingOrders, setPendingOrders] = useState<BacktestPendingOrder[]>([]);
  const [checkpoints, setCheckpoints] = useState<ReplayCheckpoint[]>([]);

  const [indicators, setIndicators] = useState<IndicatorSettings>(defaultIndicatorSettings);

  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("positions");
  const [orderTicketTab, setOrderTicketTab] = useState<"order" | "dom">("order");
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showDrawingRail, setShowDrawingRail] = useState(true);
  const [showFavoriteToolsBar, setShowFavoriteToolsBar] = useState(true);
  const [favoriteToolsBarOffset, setFavoriteToolsBarOffset] = useState<FavoriteToolsBarOffset>({
    ...DEFAULT_FAVORITE_TOOLS_BAR_OFFSET,
  });
  const [selectedContextTimeframes, setSelectedContextTimeframes] = useState<BacktestTimeframe[] | null>(null);
  const [contextPanePositions, setContextPanePositions] = useState<
    Partial<Record<BacktestTimeframe, ContextPanePosition>>
  >({});
  const [contextPaneModes, setContextPaneModes] = useState<Partial<Record<BacktestTimeframe, ContextPaneMode>>>({});
  const [contextDockAssignments, setContextDockAssignments] = useState<
    Partial<Record<BacktestTimeframe, ContextDockSlot>>
  >({});
  const [draggingContextPane, setDraggingContextPane] = useState<BacktestTimeframe | null>(null);
  const [draggingDockContextTimeframe, setDraggingDockContextTimeframe] = useState<BacktestTimeframe | null>(null);
  const [activeContextDockTarget, setActiveContextDockTarget] = useState<ContextDockSlot | null>(null);
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>("execution");
  const [reviewPlaybackMode, setReviewPlaybackMode] = useState<ReviewPlaybackMode>("manual");
  const [isReviewPlaybackRunning, setIsReviewPlaybackRunning] = useState(false);
  const [chartOrderSide, setChartOrderSide] = useState<"long" | "short" | null>(null);
  const [entryMode, setEntryMode] = useState<"market" | "limit" | "stop" | "stop-limit">("limit");
  const [ticketPrice, setTicketPrice] = useState("");
  const [ticketSecondaryPrice, setTicketSecondaryPrice] = useState("");
  const [ticketUnits, setTicketUnits] = useState("");
  const [timeInForce, setTimeInForce] = useState<TimeInForce>("week");
  const [ocoEnabled, setOcoEnabled] = useState(false);
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>([]);
  const [annotationTool, setAnnotationTool] = useState<AnnotationTool>("none");
  const [annotationColor, setAnnotationColor] = useState("#facc15");
  const [annotationLabel, setAnnotationLabel] = useState("POI");
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [selectedExecutionOverlayId, setSelectedExecutionOverlayId] = useState<string | null>(null);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string | undefined>(undefined);
  const [contextCandles, setContextCandles] = useState<Partial<Record<BacktestTimeframe, CandleData[]>>>({});
  const [barMagnifierCandles, setBarMagnifierCandles] = useState<CandleData[]>([]);
  const [barMagnifierTimeframe, setBarMagnifierTimeframe] = useState<BacktestTimeframe | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<ReplayNewsEvent[]>([]);
  const [reviewEventId, setReviewEventId] = useState<string | null>(null);
  const [simulationConfig, setSimulationConfig] = useState<ReplaySimulationConfig>(
    defaultSimulationConfig
  );
  const [ruleSets, setRuleSets] = useState<RuleSetOption[]>([]);
  const [linkedRuleSetId, setLinkedRuleSetId] = useState<string | null>(null);
  const [rulebookCoaching, setRulebookCoaching] = useState<RulebookCoachingResult | null>(null);
  const [isLoadingRulebook, setIsLoadingRulebook] = useState(false);
  const [patternLibrary, setPatternLibrary] = useState<ReplayPatternTemplate[]>([]);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [sharedSnapshots, setSharedSnapshots] = useState<ReplaySharedSnapshot[]>([]);
  const [selectedSharedSnapshotId, setSelectedSharedSnapshotId] = useState<string | null>(null);
  const [monteCarloResult, setMonteCarloResult] = useState<MonteCarloResult | null>(null);
  const [isRunningMonteCarlo, setIsRunningMonteCarlo] = useState(false);
  const [isDraggingFavoriteToolsBar, setIsDraggingFavoriteToolsBar] = useState(false);

  const [challengePreset, setChallengePreset] = useState<ChallengePresetId>("prop");
  const [challengeConfig, setChallengeConfig] = useState<ChallengeConfig>({
    profitTargetPct: CHALLENGE_PRESETS.prop.profitTargetPct,
    maxDrawdownPct: CHALLENGE_PRESETS.prop.maxDrawdownPct,
    dailyLossPct: CHALLENGE_PRESETS.prop.dailyLossPct,
    minTrades: CHALLENGE_PRESETS.prop.minTrades,
    enforce: CHALLENGE_PRESETS.prop.enforce,
  });
  const [nextTradeNotes, setNextTradeNotes] = useState("");
  const [nextTradeTags, setNextTradeTags] = useState("");

  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSnapshotRef = useRef("");
  const activeReplayConfigRef = useRef<string | null>(null);
  const candleRequestRef = useRef(0);
  const contextRequestRef = useRef(0);
  const barMagnifierRequestRef = useRef(0);
  const tradeMfeRef = useRef<Record<string, number>>({});
  const tradeMaeRef = useRef<Record<string, number>>({});
  const pendingOrderProcessingRef = useRef<Set<string>>(new Set());
  const chartWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const favoriteToolsBarRef = useRef<HTMLDivElement | null>(null);
  const dockTargetRefs = useRef<Partial<Record<ContextDockSlot, HTMLDivElement | null>>>({});
  const contextPaneDragRef = useRef<{
    timeframe: BacktestTimeframe;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const favoriteToolsBarDragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const contextDockDragRef = useRef<{ timeframe: BacktestTimeframe } | null>(null);
  const appliedSnapshotRef = useRef<string | null>(null);

  const pipSize = useMemo(() => getPipSize(symbol), [symbol]);

  const activeContextTimeframes = useMemo(() => {
    const base = selectedContextTimeframes ?? getDefaultContextTimeframes(timeframe);
    return base.filter(
      (contextTimeframe, index, collection) =>
        contextTimeframe !== timeframe && collection.indexOf(contextTimeframe) === index
    );
  }, [selectedContextTimeframes, timeframe]);

  const contextTimeframeSummary = useMemo(() => {
    if (!activeContextTimeframes.length) return "Add context";
    const labels = activeContextTimeframes.map(getTimeframeCompactLabel);
    return labels.length <= 2
      ? `Context TF · ${labels.join(", ")}`
      : `Context TF · ${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
  }, [activeContextTimeframes]);

  const contextVisibilityEnabled =
    layoutPreset !== "chart-only" && activeContextTimeframes.length > 0;

  const calculatePnL = useCallback(
    (trade: BacktestTrade, price: number) => {
      const diff =
        trade.direction === "long" ? price - trade.entryPrice : trade.entryPrice - price;
      return (diff / pipSize) * trade.volume * 10;
    },
    [pipSize]
  );

  const calculatePips = useCallback(
    (trade: BacktestTrade, price: number) => {
      const diff =
        trade.direction === "long" ? price - trade.entryPrice : trade.entryPrice - price;
      return diff / pipSize;
    },
    [pipSize]
  );

  const tradeLookup = useMemo(
    () => new Map(trades.map((trade) => [trade.id, trade] as const)),
    [trades]
  );

  const isTradeHistoricallyClosed = useCallback(
    (tradeId: string) => {
      const trade = tradeLookup.get(tradeId);
      return trade ? Boolean(getExitUnix(trade)) : false;
    },
    [tradeLookup]
  );

  const fetchCandles = useReplayCandleLoader({
    symbol,
    timeframe,
    startDate,
    endDate,
    requestRef: candleRequestRef,
    setAllCandles,
    setCurrentIndex,
    setGoToDateTime,
    setIsLoadingCandles,
  });

  const {
    buildWorkspaceState,
    buildSimulationConfig,
    buildSessionPayload,
    applyWorkspacePreferences,
    applyWorkspaceState,
  } = useReplayWorkspacePersistence({
    sessionId,
    sessionName,
    sessionDescription,
    symbol,
    timeframe,
    startDate,
    endDate,
    currentIndex,
    playbackSpeed,
    indicators,
    riskPercent,
    defaultSLPips,
    defaultTPPips,
    linkedRuleSetId,
    simulationConfig,
    candleCount: allCandles.length,
    annotations,
    pendingOrders,
    checkpoints,
    activeContextTimeframes,
    contextPanePositions,
    contextPaneModes,
    contextDockAssignments,
    favoriteToolsBarOffset,
    workspaceTab,
    orderTicketTab,
    showBottomPanel,
    showRightPanel,
    showDrawingRail,
    showFavoriteToolsBar,
    layoutPreset,
    chartOrderSide,
    entryMode,
    ticketPrice,
    ticketSecondaryPrice,
    ticketUnits,
    timeInForce,
    ocoEnabled,
    showSLTP,
    annotationTool,
    annotationColor,
    annotationLabel,
    reviewPlaybackMode,
    patternLibrary,
    sharedSnapshots,
    autoSaveRef,
    lastSavedSnapshotRef,
    setWorkspaceTab,
    setOrderTicketTab,
    setShowBottomPanel,
    setShowRightPanel,
    setShowDrawingRail,
    setShowFavoriteToolsBar,
    setSelectedContextTimeframes,
    setContextPanePositions,
    setContextPaneModes,
    setContextDockAssignments,
    setFavoriteToolsBarOffset,
    setLayoutPreset,
    setChartOrderSide,
    setEntryMode,
    setTicketPrice,
    setTicketSecondaryPrice,
    setTicketUnits,
    setTimeInForce,
    setOcoEnabled,
    setShowSLTP,
    setAnnotationTool,
    setAnnotationColor,
    setAnnotationLabel,
    setReviewPlaybackMode,
    setLinkedRuleSetId,
    setPatternLibrary,
    setSharedSnapshots,
    setAnnotations,
    setPendingOrders,
    setCheckpoints,
  });

  const { createNewSession, loadSession, saveSession } =
    useReplaySessionOperations({
      paramSessionId,
      sessionId,
      sessionName,
      sessionDescription,
      symbol,
      timeframe,
      startDate,
      endDate,
      initialBalance,
      riskPercent,
      defaultSLPips,
      defaultTPPips,
      linkedRuleSetId,
      indicators,
      buildWorkspaceState,
      buildSimulationConfig,
      buildSessionPayload,
      applyWorkspaceState,
      fetchCandles,
      setSessionId,
      setSessionName,
      setSessionDescription,
      setSymbol,
      setTimeframe,
      setStartDate,
      setEndDate,
      setInitialBalance,
      setRiskPercent,
      setDefaultSLPips,
      setDefaultTPPips,
      setPlaybackSpeed,
      setIndicators,
      setLinkedRuleSetId,
      setSimulationConfig,
      setTrades,
      setPendingOrders,
      setPatternLibrary,
      setSharedSnapshots,
      setShowNewSessionDialog,
      setIsSaving,
      activeReplayConfigRef,
      lastSavedSnapshotRef,
      tradeMfeRef,
      tradeMaeRef,
    });

  useReplayPageLifecycle({
    sessionId,
    timeframe,
    symbol,
    startDate,
    endDate,
    currentIndex,
    allCandles,
    fetchCandles,
    applyWorkspacePreferences,
    activeReplayConfigRef,
    tradeMfeRef,
    tradeMaeRef,
    contextPaneDragRef,
    favoriteToolsBarDragRef,
    contextDockDragRef,
    appliedSnapshotRef,
    setAnnotations,
    setSelectedAnnotationId,
    setPendingOrders,
    setCheckpoints,
    setSelectedCheckpointId,
    setSelectedContextTimeframes,
    setContextPanePositions,
    setContextPaneModes,
    setContextDockAssignments,
    setPatternLibrary,
    setSelectedPatternId,
    setSharedSnapshots,
    setSelectedSharedSnapshotId,
    setReviewPlaybackMode,
    setIsReviewPlaybackRunning,
    setShowDrawingRail,
    setShowFavoriteToolsBar,
    setDraggingContextPane,
    setDraggingDockContextTimeframe,
    setActiveContextDockTarget,
    setFavoriteToolsBarOffset,
    setIsDraggingFavoriteToolsBar,
    setSimulationConfig,
    setTrades,
    setIsPlaying,
    setSelectedExecutionOverlayId,
  });

  useEffect(() => {
    if (selectedAnnotationId && !annotations.some((item) => item.id === selectedAnnotationId)) {
      setSelectedAnnotationId(null);
    }
  }, [annotations, selectedAnnotationId]);

  useEffect(() => {
    if (selectedPatternId && !patternLibrary.some((item) => item.id === selectedPatternId)) {
      setSelectedPatternId(null);
    }
  }, [patternLibrary, selectedPatternId]);

  useEffect(() => {
    if (!selectedExecutionOverlayId) return;

    const overlayStillExists =
      selectedExecutionOverlayId.startsWith("trade:")
        ? trades.some(
            (trade) => `trade:${trade.id}` === selectedExecutionOverlayId && trade.status === "open"
          )
        : pendingOrders.some(
            (order) =>
              `order:${order.id}` === selectedExecutionOverlayId &&
              !order.filledAtUnix &&
              !order.cancelledAtUnix
          );

    if (!overlayStillExists) {
      setSelectedExecutionOverlayId(null);
    }
  }, [pendingOrders, selectedExecutionOverlayId, trades]);

  useEffect(() => {
    if (
      selectedSharedSnapshotId &&
      !sharedSnapshots.some((item) => item.id === selectedSharedSnapshotId)
    ) {
      setSelectedSharedSnapshotId(null);
    }
  }, [selectedSharedSnapshotId, sharedSnapshots]);

  useEffect(() => {
    if (selectedCheckpointId && !checkpoints.some((item) => item.id === selectedCheckpointId)) {
      setSelectedCheckpointId(undefined);
    }
  }, [checkpoints, selectedCheckpointId]);

  useReplayRemoteData({
    activeContextTimeframes,
    contextRequestRef,
    barMagnifierRequestRef,
    endDate,
    linkedRuleSetId,
    sessionId,
    simulationConfig,
    startDate,
    symbol,
    timeframe,
    tradesLength: trades.length,
    setBarMagnifierCandles,
    setBarMagnifierTimeframe,
    setCalendarEvents,
    setContextCandles,
    setIsLoadingRulebook,
    setRuleSets,
    setRulebookCoaching,
  });

  const {
    askPrice,
    availableFunds,
    bidPrice,
    calculatedIndicators,
    cashBalance,
    challengeHelper,
    challengeStatus,
    closedTrades,
    contextPaneSeries,
    currentBias,
    currentCandle,
    currentCandleDelta,
    currentCandleDeltaPct,
    currentIntrabarTrace,
    currentPrice,
    currentTime,
    currentTimeUnix,
    domLevels,
    effectivePriceNumber,
    effectiveTicketPrice,
    effectiveTicketUnits,
    effectiveUnitsNumber,
    effectiveVolume,
    equity,
    estimatedMargin,
    estimatedTargetAtTP,
    estimatedTradeValue,
    executionEnvironment,
    headerProgress,
    openPnL,
    openRisk,
    openTrades,
    priceDecimals,
    realizedPnL,
    replayPendingOrders,
    replayTrades,
    selectedAnnotation,
    stats,
    symbolDisplayName,
    timeframeCompactLabel,
    tradeSizer,
    visibleCandles,
  } = useReplayMarketState({
    allCandles,
    annotations,
    barMagnifierCandles,
    calendarEvents,
    challengeConfig,
    contextCandles,
    contextPaneModes,
    currentIndex,
    defaultSLPips,
    defaultTPPips,
    entryMode,
    indicators,
    initialBalance,
    pendingOrders,
    pipSize,
    riskPercent,
    selectedAnnotationId,
    showSLTP,
    simulationConfig,
    symbol,
    ticketPrice,
    ticketUnits,
    timeframe,
    trades,
    activeContextTimeframes,
    calculatePnL,
    calculatePips,
  });

  useEffect(() => {
    if (selectedAnnotation?.label) {
      setAnnotationLabel(selectedAnnotation.label);
      return;
    }
    if (!selectedAnnotation) {
      setAnnotationLabel("POI");
    }
  }, [selectedAnnotation]);

  const {
    latestIndicators,
    indicatorLines,
    contextSnapshots,
    markers,
    priceLines,
    executionOverlays,
  } = useReplayChartArtifacts({
    indicators,
    calculatedIndicators,
    activeContextTimeframes,
    contextCandles,
    currentTimeUnix,
    replayTrades,
    replayPendingOrders,
    openTrades,
    currentTime,
    visibleCandles,
    isTradeHistoricallyClosed,
  });

  const {
    persistTradeLocally,
    openTrade,
    handleChartOrderPlacement,
    closeTradeAtMarket,
    persistTradeLevels,
    saveTradeLevels,
    moveTradeToBreakEven,
    cancelPendingOrder,
    closeLatestEditableTrade,
  } = useReplayTradeEngine({
    sessionId,
    symbol,
    currentCandle: currentCandle ?? null,
    currentTime,
    currentTimeUnix,
    currentPrice,
    pipSize,
    showSLTP,
    defaultSLPips,
    defaultTPPips,
    entryMode,
    ticketPrice,
    ticketSecondaryPrice,
    ticketUnits,
    timeInForce,
    ocoEnabled,
    riskPercent,
    nextTradeNotes,
    nextTradeTags,
    challengeLocked: challengeStatus.challengeLocked,
    cashBalance,
    tradeSizerLotSize: tradeSizer.lotSize,
    executionEnvironment,
    latestIndicators,
    trades,
    openTrades,
    replayPendingOrders,
    tradeDrafts,
    currentIntrabarTrace,
    tradeMfeRef,
    tradeMaeRef,
    pendingOrderProcessingRef,
    setTrades,
    setPendingOrders,
    setTradeDrafts,
    setNextTradeNotes,
    setNextTradeTags,
    setEntryMode,
    setTicketPrice,
    setChartOrderSide,
    calculatePnL,
    calculatePips,
    isTradeHistoricallyClosed,
  });
  const {
    clearAnnotations,
    handleAnnotationLabelChange,
    stepReplay,
    handlePlayPause,
    handleRestart,
    addCheckpoint,
    jumpToCheckpoint,
    applySharedSnapshot,
    createSharedSnapshot,
    copySharedSnapshotLink,
    saveCurrentPattern,
    applyLayoutPreset,
    jumpToDateTime,
  } = useReplayInteractions({
    sessionId,
    snapshotIdParam,
    appliedSnapshotRef,
    symbol,
    timeframe,
    pipSize,
    nextTradeNotes,
    goToDateTime,
    currentIndex,
    currentTimeUnix,
    isPlaying,
    playbackSpeed,
    layoutPreset,
    workspaceTab,
    allCandles,
    activeContextTimeframes,
    checkpoints,
    sharedSnapshots,
    annotations,
    contextPanePositions,
    contextDockAssignments,
    contextPaneModes,
    currentCandle: currentCandle ?? null,
    setAnnotations,
    setSelectedAnnotationId,
    selectedAnnotationId,
    setAnnotationLabel,
    setCurrentIndex,
    setIsPlaying,
    setGoToDateTime,
    setCheckpoints,
    setSelectedCheckpointId,
    setLayoutPreset,
    setWorkspaceTab,
    setSelectedContextTimeframes,
    setContextPanePositions,
    setContextDockAssignments,
    setContextPaneModes,
    setSelectedSharedSnapshotId,
    setSharedSnapshots,
    setPatternLibrary,
    setSelectedPatternId,
    setShowRightPanel,
    setShowBottomPanel,
  });

  const { handleExecutionOverlayChange, handleExecutionOverlayCommit } =
    useReplayExecutionOverlays({
      symbol,
      currentPrice,
      spread: executionEnvironment.spread,
      pipSize,
      trades,
      tradeDrafts,
      isTradeHistoricallyClosed,
      persistTradeLocally,
      persistTradeLevels,
      setTradeDrafts,
      setPendingOrders,
    });

  const { completeSession } = useReplaySessionControls({
    addCheckpoint,
    closeLatestEditableTrade,
    closeTradeAtMarket,
    handlePlayPause,
    openTrade,
    openTrades,
    pendingOrderProcessingRef,
    router,
    selectedAnnotationId,
    sessionId,
    setAnnotationTool,
    setAnnotations,
    setChartOrderSide,
    setIsCompleting,
    setPendingOrders,
    setSelectedAnnotationId,
    setSelectedExecutionOverlayId,
    stepReplay,
  });

  const headerProgressPercentLabel = `${headerProgress.toFixed(1)}%`;
  const drawingToolLabel =
    annotationTool === "none"
      ? "Select"
      : annotationTool === "trendline"
      ? "Trend line"
      : annotationTool === "extended"
      ? "Extended line"
      : annotationTool === "ray"
      ? "Ray"
      : annotationTool === "arrow"
      ? "Arrow"
      : annotationTool === "horizontal"
      ? "Horizontal"
      : annotationTool === "vertical"
      ? "Vertical"
      : annotationTool === "rectangle"
      ? "Zone"
      : annotationTool === "fib"
      ? "Fib"
      : annotationTool === "measure"
      ? "Measure"
      : annotationTool === "anchored-vwap"
      ? "Anchored VWAP"
      : "Note";
  const challengeStateLabel = challengeConfig.enforce
    ? challengeStatus.challengeLocked
      ? "Locked"
      : challengePreset === "none"
      ? "Off"
      : "Active"
    : "Soft";

  const {
    contextDockedPanes,
    hasDockedContextPanes,
    showFloatingContextPanes,
    showSplitContextPanes,
    showContextDockTargets,
    toggleContextTimeframe,
    closeContextTimeframe,
    undockAllContextPanes,
    resetContextTimeframes,
    cycleContextPaneMode,
    handleContextDockDragStart,
    handleContextPanePointerDown,
    handleFavoriteToolsBarDragStart,
    centerFavoriteToolsBar,
    isFavoriteToolsBarCentered,
  } = useReplayContextPanels({
    timeframe,
    activeContextTimeframes,
    contextVisibilityEnabled,
    contextPaneSeries,
    contextPanePositions,
    contextPaneModes,
    contextDockAssignments,
    draggingContextPane,
    draggingDockContextTimeframe,
    activeContextDockTarget,
    favoriteToolsBarOffset,
    isDraggingFavoriteToolsBar,
    setSelectedContextTimeframes,
    setContextPanePositions,
    setContextPaneModes,
    setContextDockAssignments,
    setDraggingContextPane,
    setDraggingDockContextTimeframe,
    setActiveContextDockTarget,
    setFavoriteToolsBarOffset,
    setIsDraggingFavoriteToolsBar,
    chartWorkspaceRef,
    favoriteToolsBarRef,
    dockTargetRefs,
    contextPaneDragRef,
    favoriteToolsBarDragRef,
    contextDockDragRef,
  });

  const {
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
  } = useReplayReviewMode({
    allCandles,
    calendarEvents,
    checkpoints,
    closedTrades,
    currentTimeUnix,
    hideUpcomingHighImpactNews: simulationConfig.hideUpcomingHighImpactNews,
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
  });

  const runMonteCarlo = useCallback(async () => {
    if (!sessionId) return;

    setIsRunningMonteCarlo(true);
    try {
      const result = await trpcClient.backtest.runSimulation.query({
        sessionId,
        simulations: 1000,
        tradeCount: Math.max(40, closedTrades.length || 40),
        startingEquity: initialBalance,
      });
      setMonteCarloResult(result as MonteCarloResult);
      toast.success("Monte Carlo updated");
    } catch (err) {
      console.error("Failed to run Monte Carlo:", err);
      toast.error("Failed to run Monte Carlo");
    } finally {
      setIsRunningMonteCarlo(false);
    }
  }, [closedTrades.length, initialBalance, sessionId]);

  const seekReplay = useCallback(
    (index: number) => {
      setCurrentIndex(clamp(index, 0, Math.max(allCandles.length - 1, 0)));
      setIsPlaying(false);
    },
    [allCandles.length]
  );

  const mainChartPane = (
    <ReplayMainChartPane
      symbol={symbol}
      symbolDisplayName={symbolDisplayName}
      timeframeCompactLabel={timeframeCompactLabel}
      showSplitContextPanes={showSplitContextPanes}
      currentCandle={currentCandle ?? null}
      currentTimeUnix={currentTimeUnix}
      currentCandleDelta={currentCandleDelta}
      currentCandleDeltaPct={currentCandleDeltaPct}
      priceDecimals={priceDecimals}
      chartOrderSide={chartOrderSide}
      entryMode={entryMode}
      showDrawingRail={showDrawingRail}
      annotationTool={annotationTool}
      onAnnotationToolChange={setAnnotationTool}
      onClearAnnotations={clearAnnotations}
      annotationCount={annotations.length}
      showFavoriteToolsBar={showFavoriteToolsBar}
      favoriteToolsBarOffset={favoriteToolsBarOffset}
      favoriteToolsBarRef={favoriteToolsBarRef}
      onFavoriteToolsBarDragStart={handleFavoriteToolsBarDragStart}
      isDraggingFavoriteToolsBar={isDraggingFavoriteToolsBar}
      drawingToolLabel={drawingToolLabel}
      annotationColor={annotationColor}
      onAnnotationColorChange={setAnnotationColor}
      annotationLabel={annotationLabel}
      onAnnotationLabelChange={handleAnnotationLabelChange}
      showFloatingContextPanes={showFloatingContextPanes}
      contextPaneSeries={contextPaneSeries}
      contextPanePositions={contextPanePositions}
      draggingContextPane={draggingContextPane}
      onContextPanePointerDown={handleContextPanePointerDown}
      onCycleContextPaneMode={cycleContextPaneMode}
      onCloseContextTimeframe={closeContextTimeframe}
      visibleCandles={visibleCandles}
      markers={markers}
      priceLines={priceLines}
      indicatorLines={indicatorLines}
      executionOverlays={executionOverlays}
      annotations={annotations}
      selectedAnnotationId={selectedAnnotationId}
      selectedExecutionOverlayId={selectedExecutionOverlayId}
      onSelectedAnnotationChange={setSelectedAnnotationId}
      onSelectedExecutionOverlayChange={setSelectedExecutionOverlayId}
      onAnnotationsChange={setAnnotations}
      onExecutionOverlayChange={handleExecutionOverlayChange}
      onExecutionOverlayCommit={handleExecutionOverlayCommit}
      onChartClick={({ price }) =>
        void handleChartOrderPlacement({ chartOrderSide, price })
      }
      allCandles={allCandles}
      trades={trades}
      currentIndex={currentIndex}
      onSeekReplay={seekReplay}
      isPlaying={isPlaying}
      onStepReplay={stepReplay}
      onPlayPause={handlePlayPause}
      onRestart={handleRestart}
      playbackSpeed={playbackSpeed}
      onPlaybackSpeedChange={setPlaybackSpeed}
    />
  );

  const dockSlotPaneMap = contextDockedPanes.slots;
  const dockTrayPanes = contextDockedPanes.undocked;
  const dockedTopPane = dockSlotPaneMap.top;
  const dockedLeftTopPane = dockSlotPaneMap["left-top"];
  const dockedLeftBottomPane = dockSlotPaneMap["left-bottom"];
  const dockedBottomPane = dockSlotPaneMap.bottom;
  const dockedRightTopPane = dockSlotPaneMap["right-top"];
  const dockedRightBottomPane = dockSlotPaneMap["right-bottom"];

  return (
    <main className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background text-white">
      <NewSessionDialog
        open={showNewSessionDialog}
        onOpenChange={(open) => {
          setShowNewSessionDialog(open);
          if (!open && !sessionId) {
            router.push("/backtest/sessions");
          }
        }}
        sessionName={sessionName}
        setSessionName={setSessionName}
        sessionDescription={sessionDescription}
        setSessionDescription={setSessionDescription}
        symbol={symbol}
        setSymbol={setSymbol}
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        initialBalance={initialBalance}
        setInitialBalance={setInitialBalance}
        riskPercent={riskPercent}
        setRiskPercent={setRiskPercent}
        onCreate={createNewSession}
        symbols={SYMBOLS}
        timeframes={TIMEFRAMES}
      />

      <ReplayHeader
        onBack={() => router.push("/backtest/sessions")}
        symbol={symbol}
        onSymbolChange={setSymbol}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        goToDateTime={goToDateTime}
        onGoToDateTimeChange={setGoToDateTime}
        onJumpToDateTime={jumpToDateTime}
        onAddCheckpoint={addCheckpoint}
        canAddCheckpoint={Boolean(currentCandle)}
        checkpoints={checkpoints}
        selectedCheckpointId={selectedCheckpointId}
        onJumpToCheckpoint={jumpToCheckpoint}
        layoutPreset={layoutPreset}
        onLayoutPresetChange={applyLayoutPreset}
        contextTimeframeSummary={contextTimeframeSummary}
        activeContextTimeframes={activeContextTimeframes}
        onToggleContextTimeframe={toggleContextTimeframe}
        onResetContextTimeframes={resetContextTimeframes}
        onUndockAllContextPanes={undockAllContextPanes}
        hasDockedContextPanes={hasDockedContextPanes}
        showDrawingRail={showDrawingRail}
        onShowDrawingRailChange={setShowDrawingRail}
        showFavoriteToolsBar={showFavoriteToolsBar}
        onShowFavoriteToolsBarChange={setShowFavoriteToolsBar}
        onCenterFavoriteToolsBar={centerFavoriteToolsBar}
        isFavoriteToolsBarCentered={isFavoriteToolsBarCentered}
        showBottomPanel={showBottomPanel}
        onToggleBottomPanel={() => setShowBottomPanel((previous) => !previous)}
        showRightPanel={showRightPanel}
        onToggleRightPanel={() => setShowRightPanel((previous) => !previous)}
        onSaveSession={saveSession}
        isSaving={isSaving}
        sessionId={sessionId}
        onCompleteSession={completeSession}
        isCompleting={isCompleting}
        sessionName={sessionName}
        onSessionNameChange={setSessionName}
        symbolDisplayName={symbolDisplayName}
        timeframeCompactLabel={timeframeCompactLabel}
        currentBias={currentBias}
        contextSnapshots={contextSnapshots}
        headerProgressPercentLabel={headerProgressPercentLabel}
        headerProgress={headerProgress}
        currentTimeUnix={currentTimeUnix}
        hasCurrentCandle={Boolean(currentCandle)}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
        <div className={cn("flex min-w-0 flex-1 flex-col bg-sidebar", showRightPanel && "border-r border-white/5")}>
          <div className={cn("relative min-h-0 flex-1 overflow-hidden bg-background", showBottomPanel && "border-b border-white/5")}>
            <ReplayChartWorkspace
              isLoadingCandles={isLoadingCandles}
              chartWorkspaceRef={chartWorkspaceRef}
              showSplitContextPanes={showSplitContextPanes}
              mainChartPane={mainChartPane}
              dockedTopPane={dockedTopPane}
              dockedLeftTopPane={dockedLeftTopPane}
              dockedLeftBottomPane={dockedLeftBottomPane}
              dockedBottomPane={dockedBottomPane}
              dockedRightTopPane={dockedRightTopPane}
              dockedRightBottomPane={dockedRightBottomPane}
              dockTrayPanes={dockTrayPanes}
              draggingDockContextTimeframe={draggingDockContextTimeframe}
              onContextDockDragStart={handleContextDockDragStart}
              onCycleContextPaneMode={cycleContextPaneMode}
              onCloseContextTimeframe={closeContextTimeframe}
              showContextDockTargets={showContextDockTargets}
              activeContextDockTarget={activeContextDockTarget}
              dockTargetRefs={dockTargetRefs}
            />
          </div>

          {showBottomPanel ? (
            <ReplayBottomDock
              workspaceTab={workspaceTab}
              onWorkspaceTabChange={setWorkspaceTab}
              cashBalance={cashBalance}
              equity={equity}
              realizedPnL={realizedPnL}
              openPnL={openPnL}
              openRisk={openRisk}
              challengeStateLabel={challengeStateLabel}
              challengeHelper={challengeHelper}
              onClose={() => setShowBottomPanel(false)}
              openTrades={openTrades}
              replayPendingOrders={replayPendingOrders}
              symbol={symbol}
              currentPrice={currentPrice}
              closedTrades={closedTrades}
              scoreExplainers={scoreExplainers}
              scoreNarrative={scoreNarrative}
              reviewPlaybackMode={reviewPlaybackMode}
              isReviewPlaybackRunning={isReviewPlaybackRunning}
              onToggleWalkthrough={() => {
                setReviewPlaybackMode("events");
                setIsReviewPlaybackRunning((previous) => !previous);
                setWorkspaceTab("review");
              }}
              onStepReviewEvent={() => {
                setReviewPlaybackMode("events");
                stepReviewEvent(1);
              }}
              onResumeFromMistake={resumeFromMistake}
              hasCurrentCandle={Boolean(currentCandle)}
              onSaveCurrentPattern={saveCurrentPattern}
              onCreateSharedSnapshot={createSharedSnapshot}
              reviewComparisons={reviewComparisons}
              timelineEvents={timelineEvents}
              reviewEventId={reviewEventId}
              onJumpToTimelineEvent={jumpToTimelineEvent}
              isLoadingRulebook={isLoadingRulebook}
              linkedRuleSetId={linkedRuleSetId}
              onLinkedRuleSetChange={setLinkedRuleSetId}
              ruleSets={ruleSets}
              rulebookCoaching={rulebookCoaching}
              bestWorstSelf={bestWorstSelf}
              patternLibrary={patternLibrary}
              selectedPatternId={selectedPatternId}
              onSelectedPatternChange={setSelectedPatternId}
              patternMatches={patternMatches}
              onJumpToPatternMatch={(timeUnix: number) =>
                seekReplay(nearestCandleIndex(allCandles, timeUnix))
              }
              sharedSnapshots={sharedSnapshots}
              selectedSharedSnapshotId={selectedSharedSnapshotId}
              onApplySharedSnapshot={applySharedSnapshot}
              onCopySharedSnapshotLink={(snapshotId: string) => {
                void copySharedSnapshotLink(snapshotId);
              }}
              replayMistakes={replayMistakes}
              sessionId={sessionId}
              onRunMonteCarlo={() => {
                void runMonteCarlo();
              }}
              isRunningMonteCarlo={isRunningMonteCarlo}
              monteCarloResult={monteCarloResult}
              executionEnvironment={executionEnvironment}
              intrabarMode={simulationConfig.intrabarMode}
              barMagnifierTimeframe={barMagnifierTimeframe}
            />
          ) : null}
        </div>

        {showRightPanel ? (
          <ReplayOrderPanel
            symbol={symbol}
            symbolDisplayName={symbolDisplayName}
            challengeStateLabel={challengeStateLabel}
            onClose={() => setShowRightPanel(false)}
            orderTicketTab={orderTicketTab}
            onOrderTicketTabChange={setOrderTicketTab}
            onOpenTrade={(direction: "long" | "short") => {
              void openTrade(direction);
            }}
            bidPrice={bidPrice}
            askPrice={askPrice}
            entryMode={entryMode}
            onEntryModeChange={setEntryMode}
            chartOrderSide={chartOrderSide}
            onChartOrderSideChange={setChartOrderSide}
            effectiveTicketPrice={effectiveTicketPrice}
            onTicketPriceChange={setTicketPrice}
            ticketSecondaryPrice={ticketSecondaryPrice}
            onTicketSecondaryPriceChange={setTicketSecondaryPrice}
            effectiveTicketUnits={effectiveTicketUnits}
            ticketUnits={ticketUnits}
            onTicketUnitsChange={setTicketUnits}
            showSLTP={showSLTP}
            onShowSLTPChange={setShowSLTP}
            defaultTPPips={defaultTPPips}
            onDefaultTPPipsChange={setDefaultTPPips}
            defaultSLPips={defaultSLPips}
            onDefaultSLPipsChange={setDefaultSLPips}
            intrabarMode={simulationConfig.intrabarMode}
            onIntrabarModeChange={(value: ReplaySimulationConfig["intrabarMode"]) =>
              setSimulationConfig((previous) => ({
                ...previous,
                intrabarMode: value,
              }))
            }
            barMagnifierTimeframe={barMagnifierTimeframe}
            timeInForce={timeInForce}
            onTimeInForceChange={setTimeInForce}
            ocoEnabled={ocoEnabled}
            onOcoEnabledChange={setOcoEnabled}
            hideUpcomingHighImpactNews={simulationConfig.hideUpcomingHighImpactNews}
            onHideUpcomingHighImpactNewsChange={(checked: boolean) =>
              setSimulationConfig((previous) => ({
                ...previous,
                hideUpcomingHighImpactNews: checked,
              }))
            }
            riskPercent={riskPercent}
            onRiskPercentChange={setRiskPercent}
            estimatedMargin={estimatedMargin}
            estimatedTradeValue={estimatedTradeValue}
            availableFunds={availableFunds}
            estimatedTargetAtTP={estimatedTargetAtTP}
            replayPendingOrders={replayPendingOrders}
            onCancelPendingOrder={cancelPendingOrder}
            sessionId={sessionId}
            candleCount={allCandles.length}
            domLevels={domLevels}
          />
        ) : null}
      </div>
    </main>
  );
}

export default function BacktestReplayPage() {
  return (
    <React.Suspense
      fallback={
        <RouteLoadingFallback
          route="backtestReplay"
          className="min-h-screen bg-background dark:bg-sidebar"
        />
      }
    >
      <BacktestReplayPageContent />
    </React.Suspense>
  );
}
