"use client";

import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { toast } from "sonner";

import type { CandleData } from "@/components/charts/trading-view-chart";
import { trpcClient } from "@/utils/trpc";

import type {
  BacktestPendingOrder,
  BacktestTimeframe,
  BacktestTrade,
  IndicatorSettings,
  ReplayPatternTemplate,
  ReplaySimulationConfig,
  ReplaySharedSnapshot,
  ReplayWorkspaceState,
} from "../lib/replay-domain";
import type {
  ReplaySessionPayload,
  ReplaySimulationPayload,
  ReplayWorkspacePayload,
} from "../lib/replay-persistence";
import {
  buildReplayTradeMetricIndex,
  normalizeReplaySessionRecord,
  serializeReplayConfigIdentity,
} from "../lib/replay-session";
import { normalizeReplayWorkspaceStateCandidate } from "../lib/replay-storage";

type FetchCandlesArgs = {
  symbol: string;
  timeframe: BacktestTimeframe;
  startDate: string;
  endDate: string;
  savedIndex?: number;
  savedTimeUnix?: number;
};

type UseReplaySessionOperationsArgs = {
  paramSessionId: string | null;
  sessionId: string | null;
  sessionName: string;
  sessionDescription: string;
  symbol: string;
  timeframe: BacktestTimeframe;
  startDate: string;
  endDate: string;
  initialBalance: number;
  riskPercent: number;
  defaultSLPips: number;
  defaultTPPips: number;
  linkedRuleSetId: string | null;
  indicators: IndicatorSettings;
  buildWorkspaceState: () => ReplayWorkspacePayload;
  buildSimulationConfig: () => ReplaySimulationPayload;
  buildSessionPayload: () => ReplaySessionPayload;
  applyWorkspaceState: (workspaceState: ReplayWorkspaceState) => void;
  fetchCandles: (params?: FetchCandlesArgs) => Promise<CandleData[]>;
  setSessionId: Dispatch<SetStateAction<string | null>>;
  setSessionName: Dispatch<SetStateAction<string>>;
  setSessionDescription: Dispatch<SetStateAction<string>>;
  setSymbol: Dispatch<SetStateAction<string>>;
  setTimeframe: Dispatch<SetStateAction<BacktestTimeframe>>;
  setStartDate: Dispatch<SetStateAction<string>>;
  setEndDate: Dispatch<SetStateAction<string>>;
  setInitialBalance: Dispatch<SetStateAction<number>>;
  setRiskPercent: Dispatch<SetStateAction<number>>;
  setDefaultSLPips: Dispatch<SetStateAction<number>>;
  setDefaultTPPips: Dispatch<SetStateAction<number>>;
  setPlaybackSpeed: Dispatch<SetStateAction<number>>;
  setIndicators: Dispatch<SetStateAction<IndicatorSettings>>;
  setLinkedRuleSetId: Dispatch<SetStateAction<string | null>>;
  setSimulationConfig: Dispatch<SetStateAction<ReplaySimulationConfig>>;
  setTrades: Dispatch<SetStateAction<BacktestTrade[]>>;
  setPendingOrders: Dispatch<SetStateAction<BacktestPendingOrder[]>>;
  setPatternLibrary: Dispatch<SetStateAction<ReplayPatternTemplate[]>>;
  setSharedSnapshots: Dispatch<SetStateAction<ReplaySharedSnapshot[]>>;
  setShowNewSessionDialog: Dispatch<SetStateAction<boolean>>;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
  activeReplayConfigRef: MutableRefObject<string | null>;
  lastSavedSnapshotRef: MutableRefObject<string>;
  tradeMfeRef: MutableRefObject<Record<string, number>>;
  tradeMaeRef: MutableRefObject<Record<string, number>>;
};

export function useReplaySessionOperations({
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
}: UseReplaySessionOperationsArgs) {
  const createNewSession = useCallback(async () => {
    try {
      const session = await trpcClient.backtest.createSession.mutate({
        name: sessionName,
        description: sessionDescription || undefined,
        symbol,
        timeframe,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        initialBalance,
        riskPercent,
        defaultSLPips,
        defaultTPPips,
        dataSource: "dukascopy",
        linkedRuleSetId,
        workspaceState: buildWorkspaceState(),
        simulationConfig: buildSimulationConfig(),
        indicatorConfig: indicators,
      });

      setSessionId(session.id);
      setTrades([]);
      setPendingOrders([]);
      tradeMfeRef.current = {};
      tradeMaeRef.current = {};
      activeReplayConfigRef.current = serializeReplayConfigIdentity({
        symbol,
        timeframe,
        startDate,
        endDate,
      });
      lastSavedSnapshotRef.current = "";
      setShowNewSessionDialog(false);

      await fetchCandles({
        symbol,
        timeframe,
        startDate,
        endDate,
      });
    } catch (error) {
      console.error("Failed to create session:", error);
      toast.error("Failed to create backtest session");
    }
  }, [
    activeReplayConfigRef,
    buildSimulationConfig,
    buildWorkspaceState,
    defaultSLPips,
    defaultTPPips,
    endDate,
    fetchCandles,
    indicators,
    initialBalance,
    lastSavedSnapshotRef,
    linkedRuleSetId,
    riskPercent,
    sessionDescription,
    sessionName,
    setPendingOrders,
    setSessionId,
    setShowNewSessionDialog,
    setTrades,
    startDate,
    symbol,
    timeframe,
    tradeMaeRef,
    tradeMfeRef,
  ]);

  const loadSession = useCallback(
    async (id: string) => {
      try {
        const session = normalizeReplaySessionRecord(
          await trpcClient.backtest.getSession.query({ sessionId: id })
        );

        setSessionId(session.sessionId);
        setSessionName(session.name);
        setSessionDescription(session.description);
        setSymbol(session.symbol);
        setTimeframe(session.timeframe);
        setStartDate(session.startDate);
        setEndDate(session.endDate);
        setInitialBalance(session.initialBalance);
        setRiskPercent(session.riskPercent);
        setDefaultSLPips(session.defaultSLPips);
        setDefaultTPPips(session.defaultTPPips);
        setPlaybackSpeed(session.playbackSpeed);
        setIndicators(session.indicators);
        setLinkedRuleSetId(session.linkedRuleSetId);
        setSimulationConfig(session.simulationConfig);

        setTrades(session.trades);
        tradeMfeRef.current = buildReplayTradeMetricIndex(session.trades, "mfePips");
        tradeMaeRef.current = buildReplayTradeMetricIndex(session.trades, "maePips");

        await fetchCandles(session.candleRequest);

        activeReplayConfigRef.current = session.activeReplayConfig;
        lastSavedSnapshotRef.current = session.savedSnapshot;

        const workspaceState = normalizeReplayWorkspaceStateCandidate({
          candidate: session.workspaceState,
          timeframe: session.timeframe,
        });
        if (workspaceState) {
          applyWorkspaceState(workspaceState);
        } else {
          setPatternLibrary([]);
          setSharedSnapshots([]);
        }
      } catch (error) {
        console.error("Failed to load session:", error);
        toast.error("Failed to load backtest session");
      }
    },
    [
      activeReplayConfigRef,
      applyWorkspaceState,
      fetchCandles,
      lastSavedSnapshotRef,
      setDefaultSLPips,
      setDefaultTPPips,
      setEndDate,
      setIndicators,
      setInitialBalance,
      setLinkedRuleSetId,
      setPatternLibrary,
      setPlaybackSpeed,
      setRiskPercent,
      setSessionDescription,
      setSessionId,
      setSessionName,
      setSharedSnapshots,
      setSimulationConfig,
      setStartDate,
      setSymbol,
      setTimeframe,
      setTrades,
      tradeMaeRef,
      tradeMfeRef,
    ]
  );

  const saveSession = useCallback(async () => {
    if (!sessionId) return;

    setIsSaving(true);
    try {
      const payload = buildSessionPayload();
      await trpcClient.backtest.updateSession.mutate(payload);
      lastSavedSnapshotRef.current = JSON.stringify(payload);
      toast.success("Session saved");
    } catch (error) {
      console.error("Failed to save session:", error);
      toast.error("Failed to save session");
    } finally {
    setIsSaving(false);
    }
  }, [
    buildSessionPayload,
    lastSavedSnapshotRef,
    sessionId,
    setIsSaving,
  ]);

  useEffect(() => {
    if (paramSessionId) {
      void loadSession(paramSessionId);
      return;
    }

    setShowNewSessionDialog(true);
  }, [loadSession, paramSessionId, setShowNewSessionDialog]);

  return {
    createNewSession,
    loadSession,
    saveSession,
  };
}
