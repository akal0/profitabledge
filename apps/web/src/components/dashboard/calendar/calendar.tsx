"use client";

import { trpcClient } from "@/utils/trpc";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "../../ui/skeleton";
import { VariantBadge } from "../../ui/badges/variant-badge";
import { cn } from "@/lib/utils";
import { Button } from "../../ui/button";
import PickerComponent from "./picker";
import { useDateRangeStore } from "@/stores/date-range";

type DayRow = {
  dateISO: string;
  totalProfit: number;
  percent: number;
  count: number;
  dayNumber?: number;
};

export default function Calendar({ accountId }: { accountId?: string }) {
  const [days, setDays] = useState<DayRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [bounds, setBounds] = useState<{
    minISO: string;
    maxISO: string;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!accountId) return;
      setLoading(true);
      try {
        const b = await trpcClient.accounts.opensBounds.query({ accountId });
        if (mounted) setBounds(b);
        const data = await trpcClient.accounts.recentByDay.query({ accountId });
        if (mounted) {
          setDays(data);
          if (data.length > 0) {
            const start = new Date(data[0].dateISO);
            const end = new Date(data[data.length - 1].dateISO);
            setRange({ start, end });
            useDateRangeStore.getState().setRange(start, end);
            useDateRangeStore
              .getState()
              .setBounds(new Date(b.minISO), new Date(b.maxISO));
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [accountId]);

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-secondary dark:text-neutral-100">
          <span className="text-secondary font-medium">
            Here's an overview of your
          </span>{" "}
          most recent trades
        </h2>
        <div className="flex items-center gap-2">
          {days && days.length > 0 && bounds ? (
            <PickerComponent
              defaultStart={new Date(days[0].dateISO)}
              defaultEnd={new Date(days[days.length - 1].dateISO)}
              minDate={new Date(bounds.minISO)}
              maxDate={new Date(bounds.maxISO)}
              valueStart={range?.start}
              valueEnd={range?.end}
              onRangeChange={async (start, end) => {
                setRange({ start, end });
                useDateRangeStore.getState().setRange(start, end);
                const data = await trpcClient.accounts.recentByDay.query({
                  accountId: accountId!,
                  startISO: new Date(start).toISOString(),
                  endISO: new Date(end).toISOString(),
                });
                setDays(data);
              }}
            />
          ) : (
            <div className="h-9 w-48">
              <Skeleton className="h-full w-full rounded-none bg-sidebar-accent" />
            </div>
          )}
          <Button className="cursor-pointer flex transform items-center justify-center py-2.5 h-full transition-all active:scale-95 text-white w-max text-xs hover:!brightness-110 hover:text-white duration-250  border-[0.5px] border-white/5 bg-sidebar rounded-none hover:bg-sidebar-accent">
            View account stats
          </Button>
        </div>
      </div>

      <div className="flex w-full">
        {(loading || !days) &&
          Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="first:border last:border-l-0 not-last:border-l-0 not-first:border border-black/10 dark:border-white/10 bg-white dark:bg-sidebar p-5 w-full"
            >
              <div className="flex items-center justify-between mb-12">
                <Skeleton className="w-10 h-3 rounded-none bg-sidebar-accent" />
                <Skeleton className="w-16 h-3 rounded-none bg-sidebar-accent" />
              </div>
              <div className="flex items-end justify-between">
                <Skeleton className="w-24 h-4 rounded-none bg-sidebar-accent" />
              </div>
              <div className="text-xs text-secondary mt-2">
                <Skeleton className="w-16 h-4 rounded-none bg-sidebar-accent" />
              </div>
            </div>
          ))}
      </div>

      <div className="flex w-full">
        {days &&
          !loading &&
          days.map((d) => {
            const isGain = d.totalProfit >= 0;
            const pctLabel = `${isGain ? "+" : ""}${(d.percent || 0).toFixed(
              2
            )}%`;
            const moneyLabel = `$${Math.abs(d.totalProfit).toLocaleString(
              undefined,
              { maximumFractionDigits: 0 }
            )}`;
            return (
              <div
                key={d.dateISO}
                className=" first:border last:border-l-0 not-last:border-l-0 not-first:border border-black/10 dark:border-white/10 bg-white dark:bg-sidebar p-5 w-full"
              >
                <div className="flex items-center justify-between mb-8">
                  <span className="text-xs text-secondary font-medium">
                    {new Date(d.dateISO).getDate()}
                  </span>

                  <h1
                    className={cn(
                      "text-xs font-medium",
                      isGain ? "text-teal-400" : "text-rose-400",
                      d.totalProfit === 0 ? "text-white/25" : ""
                    )}
                  >
                    {pctLabel}
                  </h1>
                </div>
                <div className="flex items-end justify-between">
                  <div
                    className={cn(
                      "text-xl font-medium",
                      isGain ? "text-teal-400" : "text-rose-400",

                      d.totalProfit === 0 ? "text-white/50" : ""
                    )}
                  >
                    {isGain ? "$" : "-$"}
                    {Math.abs(d.totalProfit).toLocaleString()}
                  </div>
                </div>

                <div className="text-xs text-white/25 mt-1 font-medium">
                  {d.count} {d.count === 1 ? "trade" : "trades"}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
