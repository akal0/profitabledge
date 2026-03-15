"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
} from "@/components/trades/trade-identifier-pill";
import { cn } from "@/lib/utils";
import { formatCurrencyValue } from "@/lib/trade-formatting";
import { trpcOptions } from "@/utils/trpc";
import type { TradeRow } from "@/features/trades/table/lib/trade-table-types";

type TradeDrawdownResult =
  | {
      id: string;
      adversePips: number | null;
      adverseUsd?: number | null;
      pctToSL?: number | null;
      pctToStoploss?: number | null;
      hit: "Stop loss" | "CLOSE" | "NONE" | "BE";
      note?: string;
    }
  | null
  | undefined;

export function DrawdownCell({
  trade,
  rowIndex,
}: {
  trade: TradeRow;
  rowIndex: number;
}) {
  const debug =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("duka") === "1";

  const query = useQuery({
    ...trpcOptions.trades.drawdownForTrade.queryOptions({
      id: trade.id,
      debug,
    }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const [reveal, setReveal] = React.useState(false);

  React.useEffect(() => {
    if (query.isSuccess) {
      const handle = setTimeout(() => setReveal(true), rowIndex * 250);
      return () => clearTimeout(handle);
    }

    setReveal(false);
  }, [query.isSuccess, rowIndex]);

  if (query.isLoading || !reveal) {
    return <Skeleton className="h-5 w-[120px] rounded-none bg-sidebar-accent" />;
  }

  const drawdown = query.data as TradeDrawdownResult;
  if (!drawdown) return <span className="text-white/40">—</span>;

  if (drawdown.note === "NO_Stop loss") {
    return (
      <span
        className={cn(
          TRADE_IDENTIFIER_PILL_CLASS,
          TRADE_IDENTIFIER_TONES.subdued
        )}
      >
        No Stop loss
      </span>
    );
  }

  if (drawdown.hit === "BE") {
    return (
      <span
        className={cn(
          TRADE_IDENTIFIER_PILL_CLASS,
          TRADE_IDENTIFIER_TONES.neutral
        )}
      >
        Stop loss moved
      </span>
    );
  }

  if (drawdown.adversePips == null) {
    return <span className="text-white/40">—</span>;
  }

  const adversePips = drawdown.adversePips;
  const adverseUsd = drawdown.adverseUsd;
  const pct = drawdown.pctToSL ?? drawdown.pctToStoploss ?? null;

  let ddParam = "percent";
  if (typeof window !== "undefined") {
    try {
      ddParam = new URLSearchParams(window.location.search).get("dd") || "percent";
    } catch {
      ddParam = "percent";
    }
  }

  const formatCompact = (value: number) => {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded)
      ? String(Math.trunc(rounded))
      : String(rounded);
  };

  let label: string;
  if (ddParam === "percent") {
    if (pct == null) {
      return <span className="text-white/40">—</span>;
    }
    label = `${Math.round(pct)}%`;
  } else if (ddParam === "usd") {
    label =
      adverseUsd != null
        ? formatCurrencyValue(Number(adverseUsd), {
            maximumFractionDigits: 2,
          })
        : "$0";
  } else {
    label = `${formatCompact(adversePips)} pips`;
  }

  const pctValue = Math.max(0, Math.min(100, Number(pct ?? 0)));
  let chipClass: string = TRADE_IDENTIFIER_TONES.neutral;
  if (pctValue < 25) {
    chipClass = TRADE_IDENTIFIER_TONES.positive;
  } else if (pctValue < 75) {
    chipClass = TRADE_IDENTIFIER_TONES.warning;
  } else if (pctValue < 99) {
    chipClass = TRADE_IDENTIFIER_TONES.amber;
  } else if (pctValue >= 99) {
    chipClass = TRADE_IDENTIFIER_TONES.negative;
  }

  return <span className={cn(TRADE_IDENTIFIER_PILL_CLASS, chipClass)}>{label}</span>;
}
