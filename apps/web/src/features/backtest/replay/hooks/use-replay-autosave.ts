"use client";

import { useEffect, type MutableRefObject } from "react";

import type { ReplaySessionPayload } from "../lib/replay-persistence";
import { trpcClient } from "@/utils/trpc";

export function useReplayAutosave(params: {
  sessionId: string | null;
  candleCount: number;
  buildSessionPayload: () => ReplaySessionPayload;
  autoSaveRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  lastSavedSnapshotRef: MutableRefObject<string>;
}) {
  const {
    sessionId,
    candleCount,
    buildSessionPayload,
    autoSaveRef,
    lastSavedSnapshotRef,
  } = params;

  useEffect(() => {
    if (!sessionId || !candleCount) return;

    const payload = buildSessionPayload();
    const snapshot = JSON.stringify(payload);
    if (snapshot === lastSavedSnapshotRef.current) return;

    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      try {
        await trpcClient.backtest.updateSession.mutate(payload);
        lastSavedSnapshotRef.current = snapshot;
      } catch {
        // quiet autosave failure
      }
    }, 3000);

    return () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    };
  }, [autoSaveRef, buildSessionPayload, candleCount, lastSavedSnapshotRef, sessionId]);
}
