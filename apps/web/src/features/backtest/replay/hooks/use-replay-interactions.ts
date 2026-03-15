import { useCallback, useEffect } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { Time } from "lightweight-charts";
import type { CandleData, ChartAnnotation } from "@/components/charts/trading-view-chart";

import type {
  BacktestTimeframe,
  ContextDockSlot,
  ContextPaneMode,
  ContextPanePosition,
  LayoutPreset,
  ReplayCheckpoint,
  ReplayPatternTemplate,
  ReplaySharedSnapshot,
  WorkspaceTab,
} from "../lib/replay-domain";
import {
  buildPatternFeatureVector,
  clamp,
  getTimeframeCompactLabel,
  nearestCandleIndex,
  toDateTimeLocalValue,
} from "../lib/replay-utils";

type UseReplayInteractionsInput = {
  sessionId: string | null;
  snapshotIdParam: string | null;
  appliedSnapshotRef: MutableRefObject<string | null>;
  symbol: string;
  timeframe: BacktestTimeframe;
  pipSize: number;
  nextTradeNotes: string;
  goToDateTime: string;
  currentIndex: number;
  currentTimeUnix: number;
  isPlaying: boolean;
  playbackSpeed: number;
  layoutPreset: LayoutPreset;
  workspaceTab: WorkspaceTab;
  allCandles: CandleData[];
  activeContextTimeframes: BacktestTimeframe[];
  checkpoints: ReplayCheckpoint[];
  sharedSnapshots: ReplaySharedSnapshot[];
  annotations: ChartAnnotation[];
  contextPanePositions: Partial<Record<BacktestTimeframe, ContextPanePosition>>;
  contextDockAssignments: Partial<Record<BacktestTimeframe, ContextDockSlot>>;
  contextPaneModes: Partial<Record<BacktestTimeframe, ContextPaneMode>>;
  currentCandle: CandleData | null;
  setAnnotations: Dispatch<SetStateAction<ChartAnnotation[]>>;
  setSelectedAnnotationId: Dispatch<SetStateAction<string | null>>;
  selectedAnnotationId: string | null;
  setAnnotationLabel: Dispatch<SetStateAction<string>>;
  setCurrentIndex: Dispatch<SetStateAction<number>>;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  setGoToDateTime: Dispatch<SetStateAction<string>>;
  setCheckpoints: Dispatch<SetStateAction<ReplayCheckpoint[]>>;
  setSelectedCheckpointId: Dispatch<SetStateAction<string | undefined>>;
  setLayoutPreset: Dispatch<SetStateAction<LayoutPreset>>;
  setWorkspaceTab: Dispatch<SetStateAction<WorkspaceTab>>;
  setSelectedContextTimeframes: Dispatch<
    SetStateAction<BacktestTimeframe[] | null>
  >;
  setContextPanePositions: Dispatch<
    SetStateAction<Partial<Record<BacktestTimeframe, ContextPanePosition>>>
  >;
  setContextDockAssignments: Dispatch<
    SetStateAction<Partial<Record<BacktestTimeframe, ContextDockSlot>>>
  >;
  setContextPaneModes: Dispatch<
    SetStateAction<Partial<Record<BacktestTimeframe, ContextPaneMode>>>
  >;
  setSelectedSharedSnapshotId: Dispatch<SetStateAction<string | null>>;
  setSharedSnapshots: Dispatch<SetStateAction<ReplaySharedSnapshot[]>>;
  setPatternLibrary: Dispatch<SetStateAction<ReplayPatternTemplate[]>>;
  setSelectedPatternId: Dispatch<SetStateAction<string | null>>;
  setShowRightPanel: Dispatch<SetStateAction<boolean>>;
  setShowBottomPanel: Dispatch<SetStateAction<boolean>>;
};

export function useReplayInteractions({
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
  currentCandle,
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
}: UseReplayInteractionsInput) {
  const deleteSelectedAnnotation = useCallback(() => {
    if (!selectedAnnotationId) return;
    setAnnotations((previous) =>
      previous.filter((item) => item.id !== selectedAnnotationId)
    );
    setSelectedAnnotationId(null);
  }, [selectedAnnotationId, setAnnotations, setSelectedAnnotationId]);

  const clearAnnotations = useCallback(() => {
    setAnnotations([]);
    setSelectedAnnotationId(null);
  }, [setAnnotations, setSelectedAnnotationId]);

  const handleAnnotationLabelChange = useCallback(
    (value: string) => {
      setAnnotationLabel(value);
      if (!selectedAnnotationId) return;
      setAnnotations((previous) =>
        previous.map((item) =>
          item.id === selectedAnnotationId
            ? {
                ...item,
                label: value,
              }
            : item
        )
      );
    },
    [
      selectedAnnotationId,
      setAnnotationLabel,
      setAnnotations,
    ]
  );

  const stepReplay = useCallback(
    (delta: number) => {
      setCurrentIndex((previous) =>
        clamp(previous + delta, 0, Math.max(allCandles.length - 1, 0))
      );
      setIsPlaying(false);
    },
    [allCandles.length, setCurrentIndex, setIsPlaying]
  );

  const handlePlayPause = useCallback(() => {
    setIsPlaying((previous) => !previous);
  }, [setIsPlaying]);

  const handleRestart = useCallback(() => {
    const restartIndex =
      allCandles.length > 0 ? Math.min(120, allCandles.length - 1) : 0;
    setCurrentIndex(restartIndex);
    setGoToDateTime(toDateTimeLocalValue(allCandles[restartIndex]?.time ?? null));
    setIsPlaying(false);
  }, [allCandles, setCurrentIndex, setGoToDateTime, setIsPlaying]);

  const addCheckpoint = useCallback(() => {
    if (!currentCandle || !currentTimeUnix) return;
    const nextCheckpoint: ReplayCheckpoint = {
      id: crypto.randomUUID(),
      label: format(new Date(currentTimeUnix * 1000), "MMM d HH:mm"),
      timeUnix: currentTimeUnix,
      createdAtUnix: Math.floor(Date.now() / 1000),
    };

    setCheckpoints((previous) => {
      const withoutDuplicate = previous.filter(
        (checkpoint) => Math.abs(checkpoint.timeUnix - nextCheckpoint.timeUnix) > 1
      );
      return [...withoutDuplicate, nextCheckpoint].sort(
        (a, b) => a.timeUnix - b.timeUnix
      );
    });
    setSelectedCheckpointId(nextCheckpoint.id);
    toast.success("Checkpoint saved");
  }, [currentCandle, currentTimeUnix, setCheckpoints, setSelectedCheckpointId]);

  const jumpToCheckpoint = useCallback(
    (checkpointId: string) => {
      const checkpoint = checkpoints.find((item) => item.id === checkpointId);
      if (!checkpoint || !allCandles.length) return;
      const nextIndex = nearestCandleIndex(allCandles, checkpoint.timeUnix);
      setCurrentIndex(nextIndex);
      setGoToDateTime(
        toDateTimeLocalValue(allCandles[nextIndex]?.time ?? checkpoint.timeUnix)
      );
      setSelectedCheckpointId(checkpointId);
      setIsPlaying(false);
    },
    [
      allCandles,
      checkpoints,
      setCurrentIndex,
      setGoToDateTime,
      setIsPlaying,
      setSelectedCheckpointId,
    ]
  );

  const applySharedSnapshot = useCallback(
    (snapshotId: string) => {
      const snapshot = sharedSnapshots.find((item) => item.id === snapshotId);
      if (!snapshot || !allCandles.length) return;

      const nextIndex = clamp(snapshot.currentIndex, 0, Math.max(allCandles.length - 1, 0));
      setCurrentIndex(nextIndex);
      setLayoutPreset(snapshot.layoutPreset);
      setWorkspaceTab(snapshot.workspaceTab);
      setSelectedContextTimeframes(snapshot.selectedContextTimeframes);
      setContextPanePositions(snapshot.contextPanePositions);
      setContextDockAssignments(snapshot.contextDockAssignments);
      setContextPaneModes(snapshot.contextPaneModes);
      setAnnotations(snapshot.annotations);
      setSelectedSharedSnapshotId(snapshot.id);
      setGoToDateTime(
        toDateTimeLocalValue(allCandles[nextIndex]?.time ?? snapshot.timeUnix)
      );
      setIsPlaying(false);
      toast.success("Snapshot restored");
    },
    [
      allCandles,
      setAnnotations,
      setContextDockAssignments,
      setContextPaneModes,
      setContextPanePositions,
      setCurrentIndex,
      setGoToDateTime,
      setIsPlaying,
      setLayoutPreset,
      setSelectedContextTimeframes,
      setSelectedSharedSnapshotId,
      setWorkspaceTab,
      sharedSnapshots,
    ]
  );

  useEffect(() => {
    if (!snapshotIdParam || !allCandles.length) return;
    if (appliedSnapshotRef.current === snapshotIdParam) return;
    if (!sharedSnapshots.some((item) => item.id === snapshotIdParam)) return;

    appliedSnapshotRef.current = snapshotIdParam;
    applySharedSnapshot(snapshotIdParam);
  }, [
    allCandles.length,
    applySharedSnapshot,
    appliedSnapshotRef,
    sharedSnapshots,
    snapshotIdParam,
  ]);

  const createSharedSnapshot = useCallback(() => {
    if (!currentCandle || !currentTimeUnix) return;

    const snapshot: ReplaySharedSnapshot = {
      id: crypto.randomUUID(),
      label: `${symbol} ${getTimeframeCompactLabel(timeframe)} · ${format(
        new Date(currentTimeUnix * 1000),
        "MMM d HH:mm"
      )}`,
      createdAtUnix: Math.floor(Date.now() / 1000),
      timeUnix: currentTimeUnix,
      currentIndex,
      layoutPreset,
      workspaceTab,
      selectedContextTimeframes: activeContextTimeframes,
      contextPanePositions,
      contextDockAssignments,
      contextPaneModes,
      annotations,
    };

    setSharedSnapshots((previous) => [snapshot, ...previous].slice(0, 12));
    setSelectedSharedSnapshotId(snapshot.id);
    toast.success("Replay snapshot saved");
  }, [
    activeContextTimeframes,
    annotations,
    contextDockAssignments,
    contextPaneModes,
    contextPanePositions,
    currentCandle,
    currentIndex,
    currentTimeUnix,
    layoutPreset,
    setSelectedSharedSnapshotId,
    setSharedSnapshots,
    symbol,
    timeframe,
    workspaceTab,
  ]);

  const copySharedSnapshotLink = useCallback(
    async (snapshotId: string) => {
      if (!sessionId || typeof window === "undefined" || !navigator.clipboard) {
        return;
      }

      const url = `${window.location.origin}/backtest/replay?sessionId=${sessionId}&snapshot=${snapshotId}`;
      await navigator.clipboard.writeText(url);
      toast.success("Snapshot link copied");
    },
    [sessionId]
  );

  const saveCurrentPattern = useCallback(() => {
    if (!currentCandle || !currentTimeUnix) return;
    const featureVector = buildPatternFeatureVector(allCandles, currentIndex, pipSize);
    if (!featureVector) return;

    const pattern: ReplayPatternTemplate = {
      id: crypto.randomUUID(),
      name: `${symbol} ${getTimeframeCompactLabel(timeframe)} · ${format(
        new Date(currentTimeUnix * 1000),
        "MMM d HH:mm"
      )}`,
      createdAtUnix: Math.floor(Date.now() / 1000),
      anchorTimeUnix: currentTimeUnix,
      symbol,
      timeframe,
      featureVector,
      note: nextTradeNotes.trim() || undefined,
    };

    setPatternLibrary((previous) => [pattern, ...previous].slice(0, 20));
    setSelectedPatternId(pattern.id);
    toast.success("Pattern saved to library");
  }, [
    allCandles,
    currentCandle,
    currentIndex,
    currentTimeUnix,
    nextTradeNotes,
    pipSize,
    setPatternLibrary,
    setSelectedPatternId,
    symbol,
    timeframe,
  ]);

  const applyLayoutPreset = useCallback(
    (preset: LayoutPreset) => {
      setLayoutPreset(preset);
      if (preset === "chart-only") {
        setShowRightPanel(false);
        setShowBottomPanel(false);
        return;
      }
      if (preset === "review") {
        setShowRightPanel(false);
        setShowBottomPanel(true);
        setWorkspaceTab("review");
        return;
      }
      if (preset === "coach") {
        setShowRightPanel(true);
        setShowBottomPanel(true);
        setWorkspaceTab("review");
        return;
      }

      setShowRightPanel(true);
      setShowBottomPanel(true);
    },
    [
      setLayoutPreset,
      setShowBottomPanel,
      setShowRightPanel,
      setWorkspaceTab,
    ]
  );

  const jumpToDateTime = useCallback(() => {
    if (!goToDateTime || !allCandles.length) return;
    const targetUnix = Math.floor(new Date(goToDateTime).getTime() / 1000);
    if (!Number.isFinite(targetUnix)) return;
    const nextIndex = nearestCandleIndex(allCandles, targetUnix);
    setCurrentIndex(nextIndex);
    setIsPlaying(false);
  }, [allCandles, goToDateTime, setCurrentIndex, setIsPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    const intervalId = window.setInterval(() => {
      setCurrentIndex((previous) => {
        if (previous >= allCandles.length - 1) {
          setIsPlaying(false);
          return previous;
        }
        return previous + 1;
      });
    }, 180 / playbackSpeed);
    return () => window.clearInterval(intervalId);
  }, [allCandles.length, isPlaying, playbackSpeed, setCurrentIndex, setIsPlaying]);

  return {
    deleteSelectedAnnotation,
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
  };
}
