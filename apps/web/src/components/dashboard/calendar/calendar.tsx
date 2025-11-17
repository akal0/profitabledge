"use client";

import { trpcClient } from "@/utils/trpc";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "../../ui/skeleton";
import { VariantBadge } from "../../ui/badges/variant-badge";
import { cn } from "@/lib/utils";
import { Button } from "../../ui/button";
import PickerComponent from "./picker";
import { useDateRangeStore } from "@/stores/date-range";
import { useRouter } from "next/navigation";
import { useAccountStore } from "@/stores/account";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const [initialBalance, setInitialBalance] = useState<number | null>(null);
  const router = useRouter();
  const setSelectedAccountId = useAccountStore((s) => s.setSelectedAccountId);
  const [hoveredISO, setHoveredISO] = useState<string | null>(null);
  const [previews, setPreviews] = useState<
    Record<
      string,
      {
        loading: boolean;
        trades: Array<{
          id: string;
          symbol: string;
          open: string;
          profit: number;
          holdSeconds: number;
        }>;
      }
    >
  >({});

  const loadPreview = async (dateISO: string) => {
    if (!accountId) return;
    if (previews[dateISO]?.loading) return;
    if (previews[dateISO]?.trades && previews[dateISO].trades.length > 0)
      return;
    setPreviews((p) => ({ ...p, [dateISO]: { loading: true, trades: [] } }));
    try {
      // Fetch a larger recent slice, then filter by open date to avoid createdAt mismatch
      const res = await trpcClient.trades.listInfinite.query({
        accountId,
        limit: 200,
      } as any);
      const items = res.items as Array<{
        id: string;
        symbol: string;
        open: string;
        profit: number;
        holdSeconds: number;
      }>;
      const targetYMD = String(dateISO).slice(0, 10);
      const filtered = items.filter(
        (t) => String(t.open).slice(0, 10) === targetYMD
      );
      setPreviews((p) => ({
        ...p,
        [dateISO]: { loading: false, trades: filtered },
      }));
    } catch {
      setPreviews((p) => ({ ...p, [dateISO]: { loading: false, trades: [] } }));
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!accountId) return;
      setLoading(true);
      try {
        // Fetch account initial balance for % calculations
        const accounts = await trpcClient.accounts.list.query();
        if (mounted) {
          const acc = (accounts as any[])?.find?.((a) => a.id === accountId);
          const ib =
            acc?.initialBalance != null ? Number(acc.initialBalance) : null;
          setInitialBalance(Number.isFinite(ib) ? Number(ib) : null);
        }

        const b = await trpcClient.accounts.opensBounds.query({ accountId });
        if (mounted) setBounds(b);
        const data = await trpcClient.accounts.recentByDay.query({ accountId });
        if (mounted) {
          setDays([...(data as any[])] as DayRow[]);
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
                setDays([...(data as any[])] as DayRow[]);
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
              className="first:border last:border-l-0 not-last:border-l-0 not-first:border border-black/10 dark:border-white/5 bg-white dark:bg-sidebar p-5 w-full"
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
            const pctValue =
              initialBalance && initialBalance > 0
                ? (Number(d.totalProfit || 0) / initialBalance) * 100
                : 0;
            const pctLabel = `${pctValue >= 0 ? "+" : ""}${pctValue.toFixed(
              2
            )}%`;
            const moneyLabel = `$${Math.abs(d.totalProfit).toLocaleString(
              undefined,
              { maximumFractionDigits: 0 }
            )}`;
            return (
              <div
                key={d.dateISO}
                className=" first:border last:border-l-0 not-last:border-l-0 not-first:border border-black/10 dark:border-white/5 bg-white dark:bg-sidebar p-5 w-full cursor-pointer transition-colors duration-250 hover:bg-sidebar-accent"
                onClick={() => {
                  const day = new Date(d.dateISO);
                  const start = new Date(day);
                  start.setHours(0, 0, 0, 0);
                  const end = new Date(day);
                  end.setHours(23, 59, 59, 999);
                  // Update global date range for consistency across widgets
                  useDateRangeStore.getState().setRange(start, end);
                  // Ensure the selected account is active on the trades page
                  if (accountId) setSelectedAccountId(accountId);
                  const toYMD = (date: Date) => date.toISOString().slice(0, 10);
                  router.push(
                    `/dashboard/trades?oStart=${toYMD(start)}&oEnd=${toYMD(
                      end
                    )}`
                  );
                }}
                onMouseEnter={() => {
                  setHoveredISO(d.dateISO);
                  loadPreview(d.dateISO);
                }}
                onMouseLeave={() =>
                  setHoveredISO((cur) => (cur === d.dateISO ? null : cur))
                }
              >
                {hoveredISO === d.dateISO ? (
                  <div className="flex flex-col gap-3 h-full">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-secondary font-medium">
                        {Number(String(d.dateISO).slice(8, 10))}
                      </span>

                      <div className="flex items-center gap-2">
                        {(() => {
                          const total = Number(d.count || 0);
                          const shown =
                            previews[d.dateISO]?.trades?.length || 0;
                          const extra = Math.max(0, total - shown);
                          return extra > 0 ? (
                            <div className="">
                              <span className="inline-block rounded-xs bg-neutral-800/25 text-white/60 text-[10px] px-2 py-0.5 font-medium">
                                +{extra} trades
                              </span>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 place-content-end h-full">
                      {previews[d.dateISO]?.loading ? (
                        <>
                          <Skeleton className="h-4 w-24 rounded-none bg-sidebar-accent" />
                          <Skeleton className="h-4 w-20 rounded-none bg-sidebar-accent" />
                          <Skeleton className="h-4 w-16 rounded-none bg-sidebar-accent" />
                        </>
                      ) : previews[d.dateISO]?.trades?.length > 0 ? (
                        (() => {
                          const rows = previews[d.dateISO].trades;
                          const bySymbol = rows.reduce(
                            (
                              acc: Record<
                                string,
                                {
                                  totalProfit: number;
                                  items: Array<{ id: string; profit: number }>;
                                }
                              >,
                              r
                            ) => {
                              const key = (r.symbol || "(Unknown)").trim();
                              if (!acc[key])
                                acc[key] = { totalProfit: 0, items: [] };
                              acc[key].totalProfit += Number(r.profit || 0);
                              acc[key].items.push({
                                id: r.id,
                                profit: Number(r.profit || 0),
                              });
                              return acc;
                            },
                            {} as Record<
                              string,
                              {
                                totalProfit: number;
                                items: Array<{ id: string; profit: number }>;
                              }
                            >
                          );
                          const groups = Object.entries(bySymbol)
                            .map(([symbol, v]) => ({
                              symbol,
                              totalProfit: v.totalProfit,
                              items: v.items,
                            }))
                            .sort(
                              (a, b) =>
                                Math.abs(b.totalProfit) -
                                Math.abs(a.totalProfit)
                            )
                            .slice(0, 3);
                          return groups.map((g) => (
                            <div
                              key={g.symbol}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="text-xs font-medium text-white">
                                {g.symbol}
                              </span>
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "text-[10px] px-1.5 py-0.5 rounded-xs text-white/60 font-medium",
                                    Number(g.totalProfit || 0) >= 0
                                      ? "bg-teal-900/25 text-teal-400"
                                      : "bg-red-900/25 text-rose-400"
                                  )}
                                >
                                  {Number(g.totalProfit || 0) >= 0
                                    ? "+$"
                                    : "-$"}
                                  {Math.abs(
                                    Number(g.totalProfit || 0)
                                  ).toLocaleString()}
                                </span>
                                {g.items.length > 1 ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-xs bg-neutral-800/25 text-white/60 font-medium">
                                        x{g.items.length}
                                      </span>
                                    </TooltipTrigger>

                                    <TooltipContent
                                      sideOffset={6}
                                      className="bg-sidebar-accent text-white rounded-none bg-sidebar border border-white/5 min-w-[15rem] py-3"
                                    >
                                      <div className="flex flex-col gap-2">
                                        {g.items.map((it) => {
                                          const row = rows.find(
                                            (r) => r.id === it.id
                                          ) as any;
                                          const opened = row?.open
                                            ? new Date(
                                                row.open
                                              ).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                              })
                                            : "--:--";
                                          const s = Number(
                                            row?.holdSeconds || 0
                                          );
                                          const hh = Math.floor(s / 3600);
                                          const mm = Math.floor(
                                            (s % 3600) / 60
                                          );
                                          const ss = s % 60;
                                          const hold = [
                                            hh ? `${hh}h` : null,
                                            mm ? `${mm}m` : null,
                                            `${ss}s`,
                                          ]
                                            .filter(Boolean)
                                            .join(" ");
                                          return (
                                            <div
                                              key={it.id}
                                              className="flex items-center justify-between gap-3"
                                            >
                                              <span className="text-[11px] text-white/60">
                                                {opened}
                                              </span>
                                              <span className="text-[11px] text-white/40">
                                                {hold}
                                              </span>
                                              <span
                                                className={cn(
                                                  "text-[10px] px-1.5 py-0.5 rounded-xs  text-white/60 font-medium",
                                                  Number(row?.profit || 0) >= 0
                                                    ? "bg-teal-900/25 text-teal-400"
                                                    : "bg-red-900/25 text-rose-400"
                                                )}
                                              >
                                                {Number(row?.profit || 0) >= 0
                                                  ? "+$"
                                                  : "-$"}
                                                {Math.abs(
                                                  Number(row?.profit || 0)
                                                ).toLocaleString()}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : null}
                              </div>
                            </div>
                          ));
                        })()
                      ) : (
                        <span className="text-xs text-white/40">No trades</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-8">
                      <span className="text-xs text-secondary font-medium">
                        {Number(String(d.dateISO).slice(8, 10))}
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
                  </>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
