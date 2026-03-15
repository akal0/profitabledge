"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import type { ExecutionOverlayLevelKey } from "@/components/charts/trading-view-chart";
import type {
  BacktestPendingOrder,
  BacktestTrade,
} from "@/features/backtest/replay/lib/replay-domain";
import { recalculatePendingOrderRisk } from "@/features/backtest/replay/lib/replay-utils";

type TradeDrafts = Record<string, { sl: string; tp: string }>;

export function useReplayExecutionOverlays({
  symbol,
  currentPrice,
  spread,
  pipSize,
  trades,
  tradeDrafts,
  isTradeHistoricallyClosed,
  persistTradeLocally,
  persistTradeLevels,
  setTradeDrafts,
  setPendingOrders,
}: {
  symbol: string;
  currentPrice: number;
  spread: number;
  pipSize: number;
  trades: BacktestTrade[];
  tradeDrafts: TradeDrafts;
  isTradeHistoricallyClosed: (tradeId: string) => boolean;
  persistTradeLocally: (tradeId: string, patch: Partial<BacktestTrade>) => void;
  persistTradeLevels: (
    tradeId: string,
    nextSlRaw: string,
    nextTpRaw: string
  ) => Promise<void>;
  setTradeDrafts: React.Dispatch<React.SetStateAction<TradeDrafts>>;
  setPendingOrders: React.Dispatch<React.SetStateAction<BacktestPendingOrder[]>>;
}) {
  const handleExecutionOverlayChange = useCallback(
    (overlayId: string, levelKey: ExecutionOverlayLevelKey, price: number) => {
      const livePriceDecimals =
        symbol.includes("JPY") || symbol.includes("XAU") ? 3 : 5;
      const liveBidPrice = currentPrice
        ? Math.max(0, currentPrice - spread / 2)
        : 0;
      const liveAskPrice = currentPrice ? currentPrice + spread / 2 : 0;
      const normalizedPrice = Number(price.toFixed(livePriceDecimals));

      if (overlayId.startsWith("trade:")) {
        const tradeId = overlayId.replace("trade:", "");
        if (isTradeHistoricallyClosed(tradeId)) return;
        if (levelKey !== "sl" && levelKey !== "tp") return;

        const trade = trades.find((candidate) => candidate.id === tradeId);
        persistTradeLocally(tradeId, {
          [levelKey]: normalizedPrice,
          slPips:
            levelKey === "sl" && trade
              ? Math.abs((normalizedPrice - trade.entryPrice) / pipSize)
              : trade?.slPips,
          tpPips:
            levelKey === "tp" && trade
              ? Math.abs((normalizedPrice - trade.entryPrice) / pipSize)
              : trade?.tpPips,
        });
        setTradeDrafts((previous) => ({
          ...previous,
          [tradeId]: {
            sl:
              levelKey === "sl"
                ? normalizedPrice.toString()
                : previous[tradeId]?.sl ?? trade?.sl?.toString() ?? "",
            tp:
              levelKey === "tp"
                ? normalizedPrice.toString()
                : previous[tradeId]?.tp ?? trade?.tp?.toString() ?? "",
          },
        }));
        return;
      }

      if (!overlayId.startsWith("order:")) return;
      const orderId = overlayId.replace("order:", "");

      setPendingOrders((previous) =>
        previous.map((order) => {
          if (order.id !== orderId) return order;

          const nextOrder: BacktestPendingOrder =
            levelKey === "trigger"
              ? { ...order, triggerPrice: normalizedPrice }
              : levelKey === "entry"
                ? {
                    ...order,
                    entryPrice: normalizedPrice,
                    orderType:
                      order.orderType === "stop-limit"
                        ? "stop-limit"
                        : order.direction === "long"
                          ? normalizedPrice <= liveAskPrice
                            ? "limit"
                            : "stop"
                          : normalizedPrice >= liveBidPrice
                            ? "limit"
                            : "stop",
                  }
                : levelKey === "sl"
                  ? { ...order, sl: normalizedPrice }
                  : { ...order, tp: normalizedPrice };

          return recalculatePendingOrderRisk(nextOrder, pipSize);
        })
      );
    },
    [
      currentPrice,
      isTradeHistoricallyClosed,
      persistTradeLocally,
      pipSize,
      setPendingOrders,
      setTradeDrafts,
      spread,
      symbol,
      trades,
    ]
  );

  const handleExecutionOverlayCommit = useCallback(
    async (overlayId: string, levelKey: ExecutionOverlayLevelKey) => {
      if (overlayId.startsWith("trade:")) {
        const tradeId = overlayId.replace("trade:", "");
        if (isTradeHistoricallyClosed(tradeId)) {
          toast.error("Completed trades are locked during review");
          return;
        }
        if (levelKey !== "sl" && levelKey !== "tp") return;

        const draft = tradeDrafts[tradeId];
        const trade = trades.find((candidate) => candidate.id === tradeId);
        await persistTradeLevels(
          tradeId,
          draft?.sl ?? trade?.sl?.toString() ?? "",
          draft?.tp ?? trade?.tp?.toString() ?? ""
        );
        return;
      }

      if (overlayId.startsWith("order:")) {
        toast.success("Order levels updated");
      }
    },
    [isTradeHistoricallyClosed, persistTradeLevels, tradeDrafts, trades]
  );

  return {
    handleExecutionOverlayChange,
    handleExecutionOverlayCommit,
  };
}
