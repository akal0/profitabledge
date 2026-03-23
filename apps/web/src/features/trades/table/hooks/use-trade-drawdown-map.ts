"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { createTradeDrawdownMap } from "../lib/trade-drawdown";
import { trpcOptions } from "@/utils/trpc";

type UseTradeDrawdownMapArgs = {
  tradeIds: string[];
};

export function useTradeDrawdownMap({ tradeIds }: UseTradeDrawdownMapArgs) {
  const debug =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("duka") === "1";

  const normalizedIds = React.useMemo(
    () => Array.from(new Set(tradeIds.filter(Boolean))).sort(),
    [tradeIds]
  );

  const queryOptions = trpcOptions.trades.drawdownForTrades.queryOptions({
    tradeIds: normalizedIds,
    debug,
  });

  const query = useQuery({
    ...queryOptions,
    enabled: normalizedIds.length > 0,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });

  const drawdownByTradeId = React.useMemo(
    () => createTradeDrawdownMap((query.data?.results ?? []) as any),
    [query.data]
  );

  return {
    drawdownByTradeId,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  };
}
