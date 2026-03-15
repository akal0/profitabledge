"use client";

import type {
  BacktestTimeframe,
  IndicatorSettings,
  ReplaySimulationConfig,
  ReplayWorkspaceState,
} from "./replay-domain";

export type ReplayWorkspacePayload = ReplayWorkspaceState &
  Record<string, unknown>;
export type ReplaySimulationPayload = ReplaySimulationConfig &
  Record<string, unknown>;

export type ReplaySessionPayload = {
  sessionId: string;
  name: string;
  description: string;
  symbol: string;
  timeframe: BacktestTimeframe;
  startDate: string;
  endDate: string;
  lastCandleIndex: number;
  playbackSpeed: number;
  indicatorConfig: IndicatorSettings;
  riskPercent: number;
  defaultSLPips: number;
  defaultTPPips: number;
  linkedRuleSetId: string | null;
  workspaceState: ReplayWorkspacePayload;
  simulationConfig: ReplaySimulationPayload;
};

type ReplayWorkspaceStateInput = Omit<ReplayWorkspaceState, "ruleSetId"> & {
  ruleSetId: string | null;
};

export function buildReplayWorkspaceState(
  input: ReplayWorkspaceStateInput
): ReplayWorkspacePayload {
  return {
    annotations: input.annotations,
    pendingOrders: input.pendingOrders,
    checkpoints: input.checkpoints,
    workspaceTab: input.workspaceTab,
    orderTicketTab: input.orderTicketTab,
    showBottomPanel: input.showBottomPanel,
    showRightPanel: input.showRightPanel,
    showDrawingRail: input.showDrawingRail,
    showFavoriteToolsBar: input.showFavoriteToolsBar,
    selectedContextTimeframes: input.selectedContextTimeframes,
    contextPanePositions: input.contextPanePositions,
    contextPaneModes: input.contextPaneModes,
    contextDockAssignments: input.contextDockAssignments,
    favoriteToolsBarOffset: input.favoriteToolsBarOffset,
    layoutPreset: input.layoutPreset,
    chartOrderSide: input.chartOrderSide,
    entryMode: input.entryMode,
    ticketPrice: input.ticketPrice,
    ticketSecondaryPrice: input.ticketSecondaryPrice,
    ticketUnits: input.ticketUnits,
    timeInForce: input.timeInForce,
    ocoEnabled: input.ocoEnabled,
    showSLTP: input.showSLTP,
    annotationTool: input.annotationTool,
    annotationColor: input.annotationColor,
    annotationLabel: input.annotationLabel,
    reviewPlaybackMode: input.reviewPlaybackMode,
    ruleSetId: input.ruleSetId,
    patternLibrary: input.patternLibrary,
    sharedSnapshots: input.sharedSnapshots,
  } as ReplayWorkspacePayload;
}

export function buildReplaySimulationConfig(
  input: ReplaySimulationConfig
): ReplaySimulationPayload {
  return {
    intrabarMode: input.intrabarMode,
    hideUpcomingHighImpactNews: input.hideUpcomingHighImpactNews,
  };
}

export function buildReplaySessionPayload(input: {
  sessionId: string;
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
  workspaceState: ReplayWorkspacePayload;
  simulationConfig: ReplaySimulationPayload;
}): ReplaySessionPayload {
  return {
    sessionId: input.sessionId,
    name: input.sessionName,
    description: input.sessionDescription,
    symbol: input.symbol,
    timeframe: input.timeframe,
    startDate: new Date(input.startDate).toISOString(),
    endDate: new Date(input.endDate).toISOString(),
    lastCandleIndex: Math.max(0, input.currentIndex),
    playbackSpeed: input.playbackSpeed,
    indicatorConfig: input.indicators,
    riskPercent: input.riskPercent,
    defaultSLPips: input.defaultSLPips,
    defaultTPPips: input.defaultTPPips,
    linkedRuleSetId: input.linkedRuleSetId,
    workspaceState: input.workspaceState,
    simulationConfig: input.simulationConfig,
  };
}
