"use client";

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import type {
  CandleData,
  ChartAnnotation,
} from "@/components/charts/trading-view-chart";

import type {
  BacktestTrade,
  BacktestPendingOrder,
  BacktestTimeframe,
  ContextDockSlot,
  ContextPaneMode,
  ContextPanePosition,
  FavoriteToolsBarOffset,
  ReplayCheckpoint,
  ReplayPatternTemplate,
  ReplaySharedSnapshot,
  ReplaySimulationConfig,
  ReviewPlaybackMode,
} from "../lib/replay-domain";
import { DEFAULT_FAVORITE_TOOLS_BAR_OFFSET } from "../lib/replay-domain";
import {
  clearReplayCheckpoints,
  readReplayAnnotations,
  readReplayCheckpoints,
  readReplayPendingOrders,
  readReplayWorkspacePreferences,
} from "../lib/replay-storage";
import {
  parseReplayConfigIdentity,
  serializeReplayConfigIdentity,
} from "../lib/replay-session";
import { getDefaultContextTimeframes } from "../lib/replay-utils";
import type { ReplayFetchCandlesArgs } from "./use-replay-candle-loader";

type UseReplayPageLifecycleArgs = {
  sessionId: string | null;
  timeframe: BacktestTimeframe;
  symbol: string;
  startDate: string;
  endDate: string;
  currentIndex: number;
  allCandles: CandleData[];
  fetchCandles: (params?: ReplayFetchCandlesArgs) => Promise<unknown>;
  applyWorkspacePreferences: (workspaceState: Record<string, unknown>) => void;
  activeReplayConfigRef: MutableRefObject<string | null>;
  tradeMfeRef: MutableRefObject<Record<string, number>>;
  tradeMaeRef: MutableRefObject<Record<string, number>>;
  contextPaneDragRef: MutableRefObject<{
    timeframe: BacktestTimeframe;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>;
  favoriteToolsBarDragRef: MutableRefObject<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>;
  contextDockDragRef: MutableRefObject<{ timeframe: BacktestTimeframe } | null>;
  appliedSnapshotRef: MutableRefObject<string | null>;
  setAnnotations: Dispatch<SetStateAction<ChartAnnotation[]>>;
  setSelectedAnnotationId: Dispatch<SetStateAction<string | null>>;
  setPendingOrders: Dispatch<SetStateAction<BacktestPendingOrder[]>>;
  setCheckpoints: Dispatch<SetStateAction<ReplayCheckpoint[]>>;
  setSelectedCheckpointId: Dispatch<SetStateAction<string | undefined>>;
  setSelectedContextTimeframes: Dispatch<SetStateAction<BacktestTimeframe[] | null>>;
  setContextPanePositions: Dispatch<
    SetStateAction<Partial<Record<BacktestTimeframe, ContextPanePosition>>>
  >;
  setContextPaneModes: Dispatch<
    SetStateAction<Partial<Record<BacktestTimeframe, ContextPaneMode>>>
  >;
  setContextDockAssignments: Dispatch<
    SetStateAction<Partial<Record<BacktestTimeframe, ContextDockSlot>>>
  >;
  setPatternLibrary: Dispatch<SetStateAction<ReplayPatternTemplate[]>>;
  setSelectedPatternId: Dispatch<SetStateAction<string | null>>;
  setSharedSnapshots: Dispatch<SetStateAction<ReplaySharedSnapshot[]>>;
  setSelectedSharedSnapshotId: Dispatch<SetStateAction<string | null>>;
  setReviewPlaybackMode: Dispatch<SetStateAction<ReviewPlaybackMode>>;
  setIsReviewPlaybackRunning: Dispatch<SetStateAction<boolean>>;
  setShowDrawingRail: Dispatch<SetStateAction<boolean>>;
  setShowFavoriteToolsBar: Dispatch<SetStateAction<boolean>>;
  setDraggingContextPane: Dispatch<SetStateAction<BacktestTimeframe | null>>;
  setDraggingDockContextTimeframe: Dispatch<SetStateAction<BacktestTimeframe | null>>;
  setActiveContextDockTarget: Dispatch<SetStateAction<ContextDockSlot | null>>;
  setFavoriteToolsBarOffset: Dispatch<SetStateAction<FavoriteToolsBarOffset>>;
  setIsDraggingFavoriteToolsBar: Dispatch<SetStateAction<boolean>>;
  setSimulationConfig: Dispatch<SetStateAction<ReplaySimulationConfig>>;
  setTrades: Dispatch<SetStateAction<BacktestTrade[]>>;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  setSelectedExecutionOverlayId: Dispatch<SetStateAction<string | null>>;
};

export function useReplayPageLifecycle({
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
}: UseReplayPageLifecycleArgs) {
  useEffect(() => {
    if (!sessionId) {
      setAnnotations([]);
      setSelectedAnnotationId(null);
      return;
    }

    setAnnotations(readReplayAnnotations(sessionId));
    setSelectedAnnotationId(null);
  }, [sessionId, setAnnotations, setSelectedAnnotationId]);

  useEffect(() => {
    if (!sessionId) {
      setPendingOrders([]);
      return;
    }

    setPendingOrders(readReplayPendingOrders(sessionId));
  }, [sessionId, setPendingOrders]);

  useEffect(() => {
    if (!sessionId) {
      setCheckpoints([]);
      setSelectedCheckpointId(undefined);
      return;
    }

    setCheckpoints(readReplayCheckpoints(sessionId));
    setSelectedCheckpointId(undefined);
  }, [sessionId, setCheckpoints, setSelectedCheckpointId]);

  useEffect(() => {
    setSelectedContextTimeframes(null);
    setContextPanePositions({});
    setContextPaneModes({});
    setContextDockAssignments({});
    setPatternLibrary([]);
    setSelectedPatternId(null);
    setSharedSnapshots([]);
    setSelectedSharedSnapshotId(null);
    setReviewPlaybackMode("manual");
    setIsReviewPlaybackRunning(false);
    setShowDrawingRail(true);
    setShowFavoriteToolsBar(true);
    setDraggingContextPane(null);
    setDraggingDockContextTimeframe(null);
    setActiveContextDockTarget(null);
    setFavoriteToolsBarOffset({ ...DEFAULT_FAVORITE_TOOLS_BAR_OFFSET });
    setIsDraggingFavoriteToolsBar(false);
    contextPaneDragRef.current = null;
    contextDockDragRef.current = null;
    favoriteToolsBarDragRef.current = null;
    appliedSnapshotRef.current = null;
  }, [
    appliedSnapshotRef,
    contextDockDragRef,
    contextPaneDragRef,
    favoriteToolsBarDragRef,
    setActiveContextDockTarget,
    setContextDockAssignments,
    setContextPaneModes,
    setContextPanePositions,
    setDraggingContextPane,
    setDraggingDockContextTimeframe,
    setFavoriteToolsBarOffset,
    setIsDraggingFavoriteToolsBar,
    setIsReviewPlaybackRunning,
    setPatternLibrary,
    setReviewPlaybackMode,
    setSelectedContextTimeframes,
    setSelectedPatternId,
    setSelectedSharedSnapshotId,
    setSharedSnapshots,
    setShowDrawingRail,
    setShowFavoriteToolsBar,
    sessionId,
  ]);

  useEffect(() => {
    setSelectedContextTimeframes((previous) => {
      if (previous === null) {
        return getDefaultContextTimeframes(timeframe);
      }

      const filtered = previous.filter(
        (contextTimeframe, index, collection) =>
          contextTimeframe !== timeframe &&
          collection.indexOf(contextTimeframe) === index
      );

      return filtered.length === previous.length ? previous : filtered;
    });
  }, [setSelectedContextTimeframes, timeframe]);

  useEffect(() => {
    if (!sessionId) return;

    const storedWorkspace = readReplayWorkspacePreferences({
      sessionId,
      timeframe,
    });
    if (!storedWorkspace) return;

    applyWorkspacePreferences(storedWorkspace.workspaceState);
    setSimulationConfig(storedWorkspace.simulationConfig);
  }, [
    applyWorkspacePreferences,
    sessionId,
    setSimulationConfig,
    timeframe,
  ]);

  useEffect(() => {
    if (!sessionId) return;

    const previousConfig = parseReplayConfigIdentity(activeReplayConfigRef.current);
    const nextConfigObject = { symbol, timeframe, startDate, endDate };
    const nextConfig = serializeReplayConfigIdentity(nextConfigObject);

    if (activeReplayConfigRef.current === null) {
      activeReplayConfigRef.current = nextConfig;
      return;
    }

    if (activeReplayConfigRef.current === nextConfig) return;
    activeReplayConfigRef.current = nextConfig;

    const isTimeframeOnlyChange =
      previousConfig !== null &&
      previousConfig.symbol === nextConfigObject.symbol &&
      previousConfig.startDate === nextConfigObject.startDate &&
      previousConfig.endDate === nextConfigObject.endDate &&
      previousConfig.timeframe !== nextConfigObject.timeframe;

    if (!isTimeframeOnlyChange) {
      setTrades([]);
      setPendingOrders([]);
      setCheckpoints([]);
      tradeMfeRef.current = {};
      tradeMaeRef.current = {};
      setAnnotations([]);
      setSelectedAnnotationId(null);
      setSelectedExecutionOverlayId(null);
      setSelectedCheckpointId(undefined);
      clearReplayCheckpoints(sessionId);
    }

    setIsPlaying(false);
    void fetchCandles({
      symbol,
      timeframe,
      startDate,
      endDate,
      savedTimeUnix: Number(
        allCandles[Math.min(currentIndex, Math.max(allCandles.length - 1, 0))]?.time ??
          0
      ),
    });
  }, [
    activeReplayConfigRef,
    allCandles,
    currentIndex,
    endDate,
    fetchCandles,
    sessionId,
    setAnnotations,
    setCheckpoints,
    setPendingOrders,
    setSelectedAnnotationId,
    setSelectedCheckpointId,
    setSelectedExecutionOverlayId,
    setIsPlaying,
    setTrades,
    startDate,
    symbol,
    timeframe,
    tradeMaeRef,
    tradeMfeRef,
  ]);
}
