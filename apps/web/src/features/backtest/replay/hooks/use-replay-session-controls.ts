"use client";

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useEffect } from "react";

import type {
  AnnotationTool,
  ChartAnnotation,
} from "@/components/charts/trading-view-chart";
import type {
  BacktestPendingOrder,
  BacktestTrade,
} from "@/features/backtest/replay/lib/replay-domain";
import { clearReplayPendingOrders } from "@/features/backtest/replay/lib/replay-storage";
import { trpcClient } from "@/utils/trpc";
import { toast } from "sonner";

export function useReplaySessionControls(input: {
  addCheckpoint: () => void;
  closeLatestEditableTrade: () => Promise<void>;
  closeTradeAtMarket: (
    tradeId: string,
    closeReason?: "manual" | "session_end"
  ) => Promise<void>;
  handlePlayPause: () => void;
  openTrade: (direction: "long" | "short") => Promise<void>;
  openTrades: BacktestTrade[];
  pendingOrderProcessingRef: MutableRefObject<Set<string>>;
  router: { push: (href: string) => void };
  selectedAnnotationId: string | null;
  sessionId: string | null;
  setAnnotationTool: Dispatch<SetStateAction<AnnotationTool>>;
  setAnnotations: Dispatch<SetStateAction<ChartAnnotation[]>>;
  setChartOrderSide: Dispatch<SetStateAction<"long" | "short" | null>>;
  setIsCompleting: Dispatch<SetStateAction<boolean>>;
  setPendingOrders: Dispatch<SetStateAction<BacktestPendingOrder[]>>;
  setSelectedAnnotationId: Dispatch<SetStateAction<string | null>>;
  setSelectedExecutionOverlayId: Dispatch<SetStateAction<string | null>>;
  stepReplay: (delta: number) => void;
}) {
  const completeSession = useCallback(async () => {
    if (!input.sessionId) return;

    input.setIsCompleting(true);
    try {
      for (const trade of input.openTrades) {
        await input.closeTradeAtMarket(trade.id, "session_end");
      }

      input.setPendingOrders([]);
      input.pendingOrderProcessingRef.current.clear();
      clearReplayPendingOrders(input.sessionId);
      await trpcClient.backtest.completeSession.mutate({
        sessionId: input.sessionId,
      });
      toast.success("Session completed");
      input.router.push("/backtest/sessions");
    } catch (error) {
      console.error("Failed to complete session:", error);
      toast.error("Failed to complete session");
    } finally {
      input.setIsCompleting(false);
    }
  }, [input]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.key) {
        case " ":
          event.preventDefault();
          input.handlePlayPause();
          break;
        case "ArrowRight":
          event.preventDefault();
          input.stepReplay(event.shiftKey ? 20 : 1);
          break;
        case "ArrowLeft":
          event.preventDefault();
          input.stepReplay(event.shiftKey ? -20 : -1);
          break;
        case "[":
          event.preventDefault();
          input.stepReplay(-5);
          break;
        case "]":
          event.preventDefault();
          input.stepReplay(5);
          break;
        case "b":
        case "B":
          event.preventDefault();
          void input.openTrade("long");
          break;
        case "s":
        case "S":
          event.preventDefault();
          void input.openTrade("short");
          break;
        case "x":
        case "X":
          event.preventDefault();
          void input.closeLatestEditableTrade();
          break;
        case "m":
        case "M":
          event.preventDefault();
          input.addCheckpoint();
          break;
        case "Escape":
          input.setAnnotationTool("none");
          input.setSelectedAnnotationId(null);
          input.setSelectedExecutionOverlayId(null);
          input.setChartOrderSide(null);
          break;
        case "Backspace":
        case "Delete":
          if (!input.selectedAnnotationId) return;
          event.preventDefault();
          input.setAnnotations((previous) =>
            previous.filter(
              (annotation) => annotation.id !== input.selectedAnnotationId
            )
          );
          input.setSelectedAnnotationId(null);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [input]);

  return { completeSession };
}
