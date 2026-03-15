"use client";

import type {
  AnnotationTool,
  ChartAnnotation,
} from "@/components/charts/trading-view-chart";

import {
  defaultSimulationConfig,
  type BacktestPendingOrder,
  type BacktestTimeframe,
  type ReplayCheckpoint,
  type ReplayPatternTemplate,
  type ReplaySharedSnapshot,
  type ReplaySimulationConfig,
  type ReplayWorkspaceState,
} from "./replay-domain";
import {
  getCheckpointStorageKey,
  getDefaultContextTimeframes,
  getDrawingStorageKey,
  getPendingOrdersStorageKey,
  getWorkspaceStorageKey,
  isBacktestTimeframe,
  sanitizeContextDockAssignments,
  sanitizeContextPaneModes,
  sanitizeContextPanePositions,
  sanitizeFavoriteToolsBarOffset,
} from "./replay-utils";
import {
  buildReplaySimulationConfig,
  type ReplaySimulationPayload,
} from "./replay-persistence";

type JsonRecord = Record<string, unknown>;

export type ReplayWorkspacePreferencesPayload = Omit<
  ReplayWorkspaceState,
  "annotations" | "pendingOrders" | "checkpoints"
>;

export type StoredReplayWorkspacePreferences = {
  workspaceState: ReplayWorkspacePreferencesPayload;
  simulationConfig: ReplaySimulationPayload;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function readJsonValue(key: string): unknown {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJsonValue(key: string, value: unknown) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function removeJsonValue(key: string) {
  if (!isBrowser()) return;
  window.localStorage.removeItem(key);
}

function readArrayValue<T>(key: string): T[] {
  const parsed = readJsonValue(key);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

function normalizeContextTimeframes(
  value: unknown,
  timeframe: BacktestTimeframe
): BacktestTimeframe[] {
  if (!Array.isArray(value)) {
    return getDefaultContextTimeframes(timeframe);
  }

  return value.reduce<BacktestTimeframe[]>((result, candidate) => {
    if (isBacktestTimeframe(candidate) && !result.includes(candidate)) {
      result.push(candidate);
    }
    return result;
  }, []);
}

function isAnnotationTool(value: unknown): value is AnnotationTool {
  return (
    value === "none" ||
    value === "trendline" ||
    value === "extended" ||
    value === "ray" ||
    value === "arrow" ||
    value === "horizontal" ||
    value === "vertical" ||
    value === "rectangle" ||
    value === "fib" ||
    value === "measure" ||
    value === "anchored-vwap" ||
    value === "note"
  );
}

export function normalizeReplaySimulationConfigCandidate(
  candidate: unknown
): ReplaySimulationPayload {
  return buildReplaySimulationConfig({
    ...defaultSimulationConfig,
    ...((candidate && typeof candidate === "object"
      ? candidate
      : {}) as Partial<ReplaySimulationConfig>),
  });
}

export function normalizeReplayWorkspaceStateCandidate(params: {
  candidate: unknown;
  timeframe: BacktestTimeframe;
}): ReplayWorkspaceState | null {
  const { candidate, timeframe } = params;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const parsed = candidate as JsonRecord;
  return {
    annotations: Array.isArray(parsed.annotations)
      ? (parsed.annotations as ChartAnnotation[])
      : [],
    pendingOrders: Array.isArray(parsed.pendingOrders)
      ? (parsed.pendingOrders as BacktestPendingOrder[])
      : [],
    checkpoints: Array.isArray(parsed.checkpoints)
      ? (parsed.checkpoints as ReplayCheckpoint[])
      : [],
    workspaceTab:
      parsed.workspaceTab === "positions" ||
      parsed.workspaceTab === "history" ||
      parsed.workspaceTab === "review"
        ? parsed.workspaceTab
        : "positions",
    orderTicketTab: parsed.orderTicketTab === "dom" ? "dom" : "order",
    showBottomPanel:
      typeof parsed.showBottomPanel === "boolean" ? parsed.showBottomPanel : true,
    showRightPanel:
      typeof parsed.showRightPanel === "boolean" ? parsed.showRightPanel : true,
    showDrawingRail:
      typeof parsed.showDrawingRail === "boolean" ? parsed.showDrawingRail : true,
    showFavoriteToolsBar:
      typeof parsed.showFavoriteToolsBar === "boolean"
        ? parsed.showFavoriteToolsBar
        : true,
    selectedContextTimeframes: normalizeContextTimeframes(
      parsed.selectedContextTimeframes,
      timeframe
    ),
    contextPanePositions: sanitizeContextPanePositions(parsed.contextPanePositions),
    contextPaneModes: sanitizeContextPaneModes(parsed.contextPaneModes),
    contextDockAssignments: sanitizeContextDockAssignments(parsed.contextDockAssignments),
    favoriteToolsBarOffset: sanitizeFavoriteToolsBarOffset(parsed.favoriteToolsBarOffset),
    layoutPreset:
      parsed.layoutPreset === "chart-only" ||
      parsed.layoutPreset === "review" ||
      parsed.layoutPreset === "coach"
        ? parsed.layoutPreset
        : "execution",
    chartOrderSide:
      parsed.chartOrderSide === "long" ||
      parsed.chartOrderSide === "short" ||
      parsed.chartOrderSide === null
        ? parsed.chartOrderSide
        : null,
    entryMode:
      parsed.entryMode === "market" ||
      parsed.entryMode === "stop" ||
      parsed.entryMode === "stop-limit"
        ? parsed.entryMode
        : "limit",
    ticketPrice: typeof parsed.ticketPrice === "string" ? parsed.ticketPrice : "",
    ticketSecondaryPrice:
      typeof parsed.ticketSecondaryPrice === "string"
        ? parsed.ticketSecondaryPrice
        : "",
    ticketUnits: typeof parsed.ticketUnits === "string" ? parsed.ticketUnits : "",
    timeInForce:
      parsed.timeInForce === "day" ||
      parsed.timeInForce === "gtc" ||
      parsed.timeInForce === "week"
        ? parsed.timeInForce
        : "week",
    ocoEnabled: typeof parsed.ocoEnabled === "boolean" ? parsed.ocoEnabled : false,
    showSLTP: typeof parsed.showSLTP === "boolean" ? parsed.showSLTP : true,
    annotationTool: isAnnotationTool(parsed.annotationTool) ? parsed.annotationTool : "none",
    annotationColor:
      typeof parsed.annotationColor === "string" ? parsed.annotationColor : "#facc15",
    annotationLabel:
      typeof parsed.annotationLabel === "string" ? parsed.annotationLabel : "POI",
    reviewPlaybackMode:
      parsed.reviewPlaybackMode === "events" ? "events" : "manual",
    ruleSetId:
      typeof parsed.ruleSetId === "string" || parsed.ruleSetId === null
        ? parsed.ruleSetId ?? null
        : null,
    patternLibrary: Array.isArray(parsed.patternLibrary)
      ? (parsed.patternLibrary as ReplayPatternTemplate[])
      : [],
    sharedSnapshots: Array.isArray(parsed.sharedSnapshots)
      ? (parsed.sharedSnapshots as ReplaySharedSnapshot[])
      : [],
  };
}

export function readReplayAnnotations(sessionId: string): ChartAnnotation[] {
  return readArrayValue<ChartAnnotation>(getDrawingStorageKey(sessionId));
}

export function writeReplayAnnotations(sessionId: string, annotations: ChartAnnotation[]) {
  writeJsonValue(getDrawingStorageKey(sessionId), annotations);
}

export function readReplayPendingOrders(sessionId: string): BacktestPendingOrder[] {
  return readArrayValue<BacktestPendingOrder>(getPendingOrdersStorageKey(sessionId));
}

export function writeReplayPendingOrders(
  sessionId: string,
  pendingOrders: BacktestPendingOrder[]
) {
  writeJsonValue(getPendingOrdersStorageKey(sessionId), pendingOrders);
}

export function clearReplayPendingOrders(sessionId: string) {
  removeJsonValue(getPendingOrdersStorageKey(sessionId));
}

export function readReplayCheckpoints(sessionId: string): ReplayCheckpoint[] {
  return readArrayValue<ReplayCheckpoint>(getCheckpointStorageKey(sessionId));
}

export function writeReplayCheckpoints(sessionId: string, checkpoints: ReplayCheckpoint[]) {
  writeJsonValue(getCheckpointStorageKey(sessionId), checkpoints);
}

export function clearReplayCheckpoints(sessionId: string) {
  removeJsonValue(getCheckpointStorageKey(sessionId));
}

export function readReplayWorkspacePreferences(params: {
  sessionId: string;
  timeframe: BacktestTimeframe;
}): StoredReplayWorkspacePreferences | null {
  const parsed = readJsonValue(getWorkspaceStorageKey(params.sessionId));
  const workspaceState = normalizeReplayWorkspaceStateCandidate({
    candidate: parsed,
    timeframe: params.timeframe,
  });

  if (!workspaceState) {
    return null;
  }

  const {
    annotations: _annotations,
    pendingOrders: _pendingOrders,
    checkpoints: _checkpoints,
    ...workspacePreferences
  } = workspaceState;

  return {
    workspaceState: workspacePreferences,
    simulationConfig:
      parsed && typeof parsed === "object"
        ? normalizeReplaySimulationConfigCandidate(
            (parsed as JsonRecord).simulationConfig
          )
        : normalizeReplaySimulationConfigCandidate(null),
  };
}

export function writeReplayWorkspacePreferences(params: {
  sessionId: string;
  workspaceState: ReplayWorkspacePreferencesPayload;
  simulationConfig: ReplaySimulationPayload;
}) {
  writeJsonValue(getWorkspaceStorageKey(params.sessionId), {
    ...params.workspaceState,
    simulationConfig: params.simulationConfig,
  });
}
