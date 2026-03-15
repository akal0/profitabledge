"use client";

import { Fragment, useCallback, useMemo } from "react";
import { trpc } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import { Skeleton } from "../ui/skeleton";
import { cn } from "@/lib/utils";
import { Lightbulb, TrendingUp, TrendingDown } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { WidgetWrapper } from "./widget-wrapper";
import {
  formatCurrencyValue,
  formatSignedCurrencyValue,
} from "@/features/dashboard/widgets/lib/widget-shared";

const WIDGET_CONTENT_SEPARATOR_CLASS =
  "-mx-3.5 shrink-0 self-stretch";

export function WhatIfWidget({
  accountId,
  isEditing = false,
  className,
  currencyCode,
}: {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
  currencyCode?: string;
}) {
  const storeAccountId = useAccountStore((s) => s.selectedAccountId);
  const effectiveAccountId = accountId || storeAccountId;

  const { data: tradesData, isLoading } = trpc.trades.list.useQuery(
    { accountId: effectiveAccountId || "", limit: 500 },
    { enabled: !!effectiveAccountId }
  );

  const trades = useMemo(() => tradesData?.trades || [], [tradesData]);
  const formatMoney = useCallback(
    (value: number, digits = 0) =>
      formatCurrencyValue(value, currencyCode, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }),
    [currencyCode]
  );
  const formatSignedMoney = (value: number, digits = 0) =>
    formatSignedCurrencyValue(value, currencyCode, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });

  const scenarios = useMemo(() => {
    if (trades.length < 5) return null;

    const parsed = trades.map((t: any) => ({
      profit: parseFloat(t.profit?.toString() || "0"),
      rr: parseFloat(t.realisedRR?.toString() || "0"),
      mfePips: parseFloat(t.mfePips?.toString() || "0"),
      tp: t.tp ? parseFloat(t.tp.toString()) : null,
      openPrice: t.openPrice ? parseFloat(t.openPrice.toString()) : null,
      closePrice: t.closePrice ? parseFloat(t.closePrice.toString()) : null,
      volume: parseFloat(t.volume?.toString() || "0"),
      type: t.tradeType,
      sessionTag: t.sessionTag,
    }));

    const actualPnl = parsed.reduce((s: number, t: { profit: number }) => s + t.profit, 0);

    // Scenario 1: Held to TP - for winning trades with TP, estimate if MFE exceeded current profit
    let heldToTpPnl = 0;
    let heldCount = 0;
    for (const t of parsed) {
      if (t.tp !== null && t.openPrice !== null && t.profit > 0) {
        const tpDistance = Math.abs(t.tp - t.openPrice);
        const closeDistance = t.closePrice !== null ? Math.abs(t.closePrice - t.openPrice) : 0;
        if (tpDistance > closeDistance && closeDistance > 0) {
          // Exited before TP
          const ratio = tpDistance / closeDistance;
          heldToTpPnl += t.profit * ratio;
          heldCount++;
        } else {
          heldToTpPnl += t.profit;
        }
      } else {
        heldToTpPnl += t.profit;
      }
    }

    // Scenario 2: Skip worst RR trades (bottom 10%)
    const sorted = [...parsed].sort((a, b) => a.rr - b.rr);
    const cutoff = Math.max(1, Math.floor(parsed.length * 0.1));
    const worstTrades = sorted.slice(0, cutoff);
    const worstPnl = worstTrades.reduce((s: number, t: { profit: number }) => s + t.profit, 0);
    const skippedWorstPnl = actualPnl - worstPnl;

    // Scenario 3: Only positive RR trades
    const positiveRR = parsed.filter((t: { rr: number }) => t.rr > 0);
    const positiveRRPnl = positiveRR.reduce((s: number, t: { profit: number }) => s + t.profit, 0);

    return [
      {
        name: "Held to TP",
        description: `${heldCount} trades exited early`,
        actual: actualPnl,
        potential: heldToTpPnl,
        delta: heldToTpPnl - actualPnl,
        insight: heldToTpPnl > actualPnl
          ? `You left ${formatMoney(heldToTpPnl - actualPnl)} on the table`
          : "You're managing exits well",
      },
      {
        name: "Skip Worst 10%",
        description: `Remove ${cutoff} worst trades`,
        actual: actualPnl,
        potential: skippedWorstPnl,
        delta: skippedWorstPnl - actualPnl,
        insight: `Worst ${cutoff} trades cost ${formatMoney(
          Math.abs(worstPnl)
        )}`,
      },
      {
        name: "Positive RR Only",
        description: `${positiveRR.length}/${parsed.length} trades`,
        actual: actualPnl,
        potential: positiveRRPnl,
        delta: positiveRRPnl - actualPnl,
        insight: positiveRRPnl > actualPnl
          ? `Filtering saves ${formatMoney(positiveRRPnl - actualPnl)}`
          : "Negative RR trades are costing your edge",
      },
    ];
  }, [formatMoney, trades]);

  if (isLoading) {
    return (
      <WidgetWrapper
        isEditing={isEditing}
        className={className}
        icon={Lightbulb}
        title="What If...?"
        showHeader
        contentClassName="flex-col justify-end p-3.5"
      >
        <Skeleton className="h-full w-full rounded-sm bg-sidebar" />
      </WidgetWrapper>
    );
  }

  return (
    <WidgetWrapper
      isEditing={isEditing}
      className={className}
      icon={Lightbulb}
      title="What If...?"
      showHeader
      contentClassName="flex-col h-full min-h-0 justify-end p-3.5"
    >
      {scenarios ? (
        <div className="flex flex-1 min-h-0 flex-col overflow-y-auto">
          {scenarios.map((s, index) => (
            <Fragment key={s.name}>
              {index > 0 ? (
                <Separator className={WIDGET_CONTENT_SEPARATOR_CLASS} />
              ) : null}
              <div className="flex flex-col gap-2 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white">{s.name}</p>
                    <p className="text-[10px] text-white/30">
                      {s.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {s.delta >= 0 ? (
                      <TrendingUp className="size-3 text-emerald-400" />
                    ) : (
                      <TrendingDown className="size-3 text-rose-400" />
                    )}
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        s.delta >= 0 ? "text-emerald-400" : "text-rose-400"
                      )}
                    >
                      {formatSignedMoney(s.delta)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-white/35">Actual</p>
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        s.actual >= 0 ? "text-emerald-400" : "text-rose-400"
                      )}
                    >
                      {formatSignedMoney(s.actual)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-white/35">Potential</p>
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        s.potential >= 0 ? "text-emerald-400" : "text-rose-400"
                      )}
                    >
                      {formatSignedMoney(s.potential)}
                    </p>
                  </div>
                </div>

                <p className="text-[10px] leading-relaxed text-white/35">
                  {s.insight}
                </p>
              </div>
            </Fragment>
          ))}
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-white/20 text-[10px]">
          Need at least 5 trades for scenarios
        </div>
      )}
    </WidgetWrapper>
  );
}
