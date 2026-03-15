"use client";

import { useEffect } from "react";

import type { ChartAnnotation } from "@/components/charts/trading-view-chart";

import type {
  BacktestPendingOrder,
  ReplayCheckpoint,
} from "../lib/replay-domain";
import {
  type ReplaySimulationPayload,
  type ReplayWorkspacePayload,
} from "../lib/replay-persistence";
import {
  writeReplayAnnotations,
  writeReplayCheckpoints,
  writeReplayPendingOrders,
  writeReplayWorkspacePreferences,
} from "../lib/replay-storage";

export function useReplayLocalPersistence(params: {
  sessionId: string | null;
  annotations: ChartAnnotation[];
  pendingOrders: BacktestPendingOrder[];
  checkpoints: ReplayCheckpoint[];
  buildWorkspaceState: () => ReplayWorkspacePayload;
  buildSimulationConfig: () => ReplaySimulationPayload;
}) {
  const {
    sessionId,
    annotations,
    pendingOrders,
    checkpoints,
    buildWorkspaceState,
    buildSimulationConfig,
  } = params;

  useEffect(() => {
    if (!sessionId) return;
    writeReplayAnnotations(sessionId, annotations);
  }, [annotations, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    writeReplayPendingOrders(sessionId, pendingOrders);
  }, [pendingOrders, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    writeReplayCheckpoints(sessionId, checkpoints);
  }, [checkpoints, sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    const {
      annotations: _annotations,
      pendingOrders: _pendingOrders,
      checkpoints: _checkpoints,
      ...workspacePreferences
    } = buildWorkspaceState();

    writeReplayWorkspacePreferences({
      sessionId,
      workspaceState: workspacePreferences,
      simulationConfig: buildSimulationConfig(),
    });
  }, [buildSimulationConfig, buildWorkspaceState, sessionId]);
}
