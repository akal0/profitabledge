"use client";

import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

import type {
  AnnotationTool,
  ChartAnnotation,
} from "@/components/charts/trading-view-chart";

import { useReplayAutosave } from "./use-replay-autosave";
import { useReplayLocalPersistence } from "./use-replay-local-persistence";
import {
  buildReplaySessionPayload,
  buildReplaySimulationConfig,
  buildReplayWorkspaceState,
  type ReplaySessionPayload,
  type ReplaySimulationPayload,
  type ReplayWorkspacePayload,
} from "../lib/replay-persistence";
import {
  DEFAULT_FAVORITE_TOOLS_BAR_OFFSET,
  type BacktestPendingOrder,
  type BacktestTimeframe,
  type ContextDockSlot,
  type ContextPaneMode,
  type ContextPanePosition,
  type FavoriteToolsBarOffset,
  type IndicatorSettings,
  type LayoutPreset,
  type ReplayCheckpoint,
  type ReplayPatternTemplate,
  type ReplaySharedSnapshot,
  type ReplaySimulationConfig,
  type ReplayWorkspaceState,
  type ReviewPlaybackMode,
  type TimeInForce,
  type WorkspaceTab,
} from "../lib/replay-domain";
import type { ReplayWorkspacePreferencesPayload } from "../lib/replay-storage";
import { getDefaultContextTimeframes } from "../lib/replay-utils";

type UseReplayWorkspacePersistenceArgs = {
  sessionId: string | null;
  sessionName: string;
  sessionDescription: string;
  symbol: string;
  timeframe: BacktestTimeframe;
  startDate: string;
  endDate: string;
  currentIndex: number;
  playbackSpeed: number;
  indicators: IndicatorSettings;
  riskPercent: number;
  defaultSLPips: number;
  defaultTPPips: number;
  linkedRuleSetId: string | null;
  simulationConfig: ReplaySimulationConfig;
  candleCount: number;
  annotations: ChartAnnotation[];
  pendingOrders: BacktestPendingOrder[];
  checkpoints: ReplayCheckpoint[];
  activeContextTimeframes: BacktestTimeframe[];
  contextPanePositions: Partial<Record<BacktestTimeframe, ContextPanePosition>>;
  contextPaneModes: Partial<Record<BacktestTimeframe, ContextPaneMode>>;
  contextDockAssignments: Partial<Record<BacktestTimeframe, ContextDockSlot>>;
  favoriteToolsBarOffset: FavoriteToolsBarOffset;
  workspaceTab: WorkspaceTab;
  orderTicketTab: "order" | "dom";
  showBottomPanel: boolean;
  showRightPanel: boolean;
  showDrawingRail: boolean;
  showFavoriteToolsBar: boolean;
  layoutPreset: LayoutPreset;
  chartOrderSide: "long" | "short" | null;
  entryMode: "market" | "limit" | "stop" | "stop-limit";
  ticketPrice: string;
  ticketSecondaryPrice: string;
  ticketUnits: string;
  timeInForce: TimeInForce;
  ocoEnabled: boolean;
  showSLTP: boolean;
  annotationTool: AnnotationTool;
  annotationColor: string;
  annotationLabel: string;
  reviewPlaybackMode: ReviewPlaybackMode;
  patternLibrary: ReplayPatternTemplate[];
  sharedSnapshots: ReplaySharedSnapshot[];
  autoSaveRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  lastSavedSnapshotRef: MutableRefObject<string>;
  setWorkspaceTab: Dispatch<SetStateAction<WorkspaceTab>>;
  setOrderTicketTab: Dispatch<SetStateAction<"order" | "dom">>;
  setShowBottomPanel: Dispatch<SetStateAction<boolean>>;
  setShowRightPanel: Dispatch<SetStateAction<boolean>>;
  setShowDrawingRail: Dispatch<SetStateAction<boolean>>;
  setShowFavoriteToolsBar: Dispatch<SetStateAction<boolean>>;
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
  setFavoriteToolsBarOffset: Dispatch<SetStateAction<FavoriteToolsBarOffset>>;
  setLayoutPreset: Dispatch<SetStateAction<LayoutPreset>>;
  setChartOrderSide: Dispatch<SetStateAction<"long" | "short" | null>>;
  setEntryMode: Dispatch<
    SetStateAction<"market" | "limit" | "stop" | "stop-limit">
  >;
  setTicketPrice: Dispatch<SetStateAction<string>>;
  setTicketSecondaryPrice: Dispatch<SetStateAction<string>>;
  setTicketUnits: Dispatch<SetStateAction<string>>;
  setTimeInForce: Dispatch<SetStateAction<TimeInForce>>;
  setOcoEnabled: Dispatch<SetStateAction<boolean>>;
  setShowSLTP: Dispatch<SetStateAction<boolean>>;
  setAnnotationTool: Dispatch<SetStateAction<AnnotationTool>>;
  setAnnotationColor: Dispatch<SetStateAction<string>>;
  setAnnotationLabel: Dispatch<SetStateAction<string>>;
  setReviewPlaybackMode: Dispatch<SetStateAction<ReviewPlaybackMode>>;
  setLinkedRuleSetId: Dispatch<SetStateAction<string | null>>;
  setPatternLibrary: Dispatch<SetStateAction<ReplayPatternTemplate[]>>;
  setSharedSnapshots: Dispatch<SetStateAction<ReplaySharedSnapshot[]>>;
  setAnnotations: Dispatch<SetStateAction<ChartAnnotation[]>>;
  setPendingOrders: Dispatch<SetStateAction<BacktestPendingOrder[]>>;
  setCheckpoints: Dispatch<SetStateAction<ReplayCheckpoint[]>>;
};

export function useReplayWorkspacePersistence({
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
  candleCount,
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
}: UseReplayWorkspacePersistenceArgs) {
  const buildWorkspaceState = useCallback((): ReplayWorkspacePayload => {
    return buildReplayWorkspaceState({
      annotations,
      pendingOrders,
      checkpoints,
      workspaceTab,
      orderTicketTab,
      showBottomPanel,
      showRightPanel,
      showDrawingRail,
      showFavoriteToolsBar,
      selectedContextTimeframes: activeContextTimeframes,
      contextPanePositions,
      contextPaneModes,
      contextDockAssignments,
      favoriteToolsBarOffset,
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
      ruleSetId: linkedRuleSetId,
      patternLibrary,
      sharedSnapshots,
    });
  }, [
    activeContextTimeframes,
    annotationColor,
    annotationLabel,
    annotationTool,
    annotations,
    chartOrderSide,
    checkpoints,
    contextDockAssignments,
    contextPaneModes,
    contextPanePositions,
    entryMode,
    favoriteToolsBarOffset,
    layoutPreset,
    linkedRuleSetId,
    ocoEnabled,
    orderTicketTab,
    patternLibrary,
    pendingOrders,
    reviewPlaybackMode,
    sharedSnapshots,
    showBottomPanel,
    showDrawingRail,
    showFavoriteToolsBar,
    showRightPanel,
    showSLTP,
    ticketPrice,
    ticketSecondaryPrice,
    ticketUnits,
    timeInForce,
    workspaceTab,
  ]);

  const buildSimulationConfig = useCallback(
    (): ReplaySimulationPayload => buildReplaySimulationConfig(simulationConfig),
    [simulationConfig]
  );

  const buildSessionPayload = useCallback((): ReplaySessionPayload => {
    return buildReplaySessionPayload({
      sessionId: sessionId as string,
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
      workspaceState: buildWorkspaceState(),
      simulationConfig: buildSimulationConfig(),
    });
  }, [
    buildSimulationConfig,
    buildWorkspaceState,
    currentIndex,
    defaultSLPips,
    defaultTPPips,
    endDate,
    indicators,
    linkedRuleSetId,
    playbackSpeed,
    riskPercent,
    sessionDescription,
    sessionId,
    sessionName,
    startDate,
    symbol,
    timeframe,
  ]);

  const applyWorkspacePreferences = useCallback(
    (workspaceState: ReplayWorkspacePreferencesPayload) => {
      setWorkspaceTab(workspaceState.workspaceTab ?? "positions");
      setOrderTicketTab(workspaceState.orderTicketTab ?? "order");
      setShowBottomPanel(workspaceState.showBottomPanel ?? true);
      setShowRightPanel(workspaceState.showRightPanel ?? true);
      setShowDrawingRail(workspaceState.showDrawingRail ?? true);
      setShowFavoriteToolsBar(workspaceState.showFavoriteToolsBar ?? true);
      setSelectedContextTimeframes(
        workspaceState.selectedContextTimeframes ?? getDefaultContextTimeframes(timeframe)
      );
      setContextPanePositions(workspaceState.contextPanePositions ?? {});
      setContextPaneModes(workspaceState.contextPaneModes ?? {});
      setContextDockAssignments(workspaceState.contextDockAssignments ?? {});
      setFavoriteToolsBarOffset(
        workspaceState.favoriteToolsBarOffset ?? {
          ...DEFAULT_FAVORITE_TOOLS_BAR_OFFSET,
        }
      );
      setLayoutPreset(workspaceState.layoutPreset ?? "execution");
      setChartOrderSide(workspaceState.chartOrderSide ?? null);
      setEntryMode(workspaceState.entryMode ?? "limit");
      setTicketPrice(workspaceState.ticketPrice ?? "");
      setTicketSecondaryPrice(workspaceState.ticketSecondaryPrice ?? "");
      setTicketUnits(workspaceState.ticketUnits ?? "");
      setTimeInForce(workspaceState.timeInForce ?? "week");
      setOcoEnabled(workspaceState.ocoEnabled ?? false);
      setShowSLTP(workspaceState.showSLTP ?? true);
      setAnnotationTool(workspaceState.annotationTool ?? "none");
      setAnnotationColor(workspaceState.annotationColor ?? "#facc15");
      setAnnotationLabel(workspaceState.annotationLabel ?? "POI");
      setReviewPlaybackMode(workspaceState.reviewPlaybackMode ?? "manual");
      setLinkedRuleSetId(workspaceState.ruleSetId ?? null);
      setPatternLibrary(workspaceState.patternLibrary ?? []);
      setSharedSnapshots(workspaceState.sharedSnapshots ?? []);
    },
    [
      setAnnotationColor,
      setAnnotationLabel,
      setAnnotationTool,
      setChartOrderSide,
      setContextDockAssignments,
      setContextPaneModes,
      setContextPanePositions,
      setEntryMode,
      setFavoriteToolsBarOffset,
      setLayoutPreset,
      setLinkedRuleSetId,
      setOcoEnabled,
      setOrderTicketTab,
      setPatternLibrary,
      setReviewPlaybackMode,
      setSelectedContextTimeframes,
      setSharedSnapshots,
      setShowBottomPanel,
      setShowDrawingRail,
      setShowFavoriteToolsBar,
      setShowRightPanel,
      setShowSLTP,
      setTicketPrice,
      setTicketSecondaryPrice,
      setTicketUnits,
      setTimeInForce,
      setWorkspaceTab,
      timeframe,
    ]
  );

  const applyWorkspaceState = useCallback(
    (workspaceState: ReplayWorkspaceState) => {
      setAnnotations(workspaceState.annotations ?? []);
      setPendingOrders(workspaceState.pendingOrders ?? []);
      setCheckpoints(workspaceState.checkpoints ?? []);
      applyWorkspacePreferences(workspaceState);
    },
    [
      applyWorkspacePreferences,
      setAnnotations,
      setCheckpoints,
      setPendingOrders,
    ]
  );

  useReplayLocalPersistence({
    sessionId,
    annotations,
    pendingOrders,
    checkpoints,
    buildWorkspaceState,
    buildSimulationConfig,
  });

  useReplayAutosave({
    sessionId,
    candleCount,
    buildSessionPayload,
    autoSaveRef,
    lastSavedSnapshotRef,
  });

  return {
    buildWorkspaceState,
    buildSimulationConfig,
    buildSessionPayload,
    applyWorkspacePreferences,
    applyWorkspaceState,
  };
}
