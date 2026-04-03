"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, TrendingDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select as ShSelect,
  SelectContent as ShSelectContent,
  SelectItem as ShSelectItem,
  SelectTrigger as ShSelectTrigger,
  SelectValue as ShSelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { trpcClient } from "@/utils/trpc";
import {
  useDashboardTradeFilters,
} from "@/features/dashboard/filters/dashboard-trade-filters";
import {
  buildLossesByAssetFromTrades,
  buildProfitByAssetFromTrades,
  buildProfitByDayFromTrades,
  buildTradeCountsFromTrades,
} from "@/features/dashboard/filters/dashboard-trade-metrics";

import InfinityIcon from "@/public/icons/infinity.svg";

import {
  DashboardWidgetFrame,
  formatCurrencyValue,
  formatSignedCurrencyValue,
  formatRMultiple,
  getRiskUnitForR,
  toNumber,
  toRValue,
  useAccountStats,
  type WidgetCardProps,
  type WidgetValueCardProps,
} from "../lib/widget-shared";
import { AnimatedNumber } from "@/components/ui/animated-number";

function isUsingFilteredWidgetState(
  accountId: string | undefined,
  dashboardTradeFilters: ReturnType<typeof useDashboardTradeFilters>
) {
  return Boolean(
    accountId &&
      dashboardTradeFilters?.hasActiveFilters &&
      dashboardTradeFilters.accountId === accountId
  );
}

export function TotalLossesCard({
  accountId,
  isEditing = false,
  valueMode = "usd",
  currencyCode,
  className,
}: WidgetValueCardProps) {
  type LossRow = {
    symbol: string;
    profitLoss: number;
    commissionsLoss: number;
    swapLoss: number;
    totalLoss: number;
  };

  const [rows, setRows] = useState<LossRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 3;
  const { data: statsData } = useAccountStats(accountId);
  const dashboardTradeFilters = useDashboardTradeFilters();
  const isUsingFilteredTrades = isUsingFilteredWidgetState(
    accountId,
    dashboardTradeFilters
  );
  const initialBalance = toNumber(statsData?.initialBalance ?? 0);
  const hasBaseline = initialBalance > 0;
  const riskUnit = getRiskUnitForR(statsData);

  useEffect(() => {
    if (isUsingFilteredTrades) {
      setRows(
        buildLossesByAssetFromTrades(
          dashboardTradeFilters?.filteredTrades ?? []
        ) as LossRow[]
      );
      setLoading(Boolean(dashboardTradeFilters?.isLoading));
      return;
    }

    (async () => {
      if (!accountId) return;
      setLoading(true);
      try {
        const data = await trpcClient.accounts.lossesByAssetRange.query({
          accountId,
        });
        setRows(Array.isArray(data) ? (data as LossRow[]) : []);
      } finally {
        setLoading(false);
      }
    })();
  }, [
    accountId,
    dashboardTradeFilters?.filteredTrades,
    dashboardTradeFilters?.isLoading,
    isUsingFilteredTrades,
  ]);

  useEffect(() => setPage(0), [rows]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageItems = useMemo(
    () => rows.slice(page * pageSize, page * pageSize + pageSize),
    [page, rows]
  );
  const maxTotal = useMemo(
    () => Math.max(1, ...pageItems.map((row) => Number(row.totalLoss || 0))),
    [pageItems]
  );

  const formatValue = (value: number) => {
    if (valueMode === "percent") {
      if (!hasBaseline) return "—";
      const pct = (Math.abs(value) / initialBalance) * 100;
      return `-${pct.toFixed(2)}%`;
    }

    if (valueMode === "rr") {
      const rr = toRValue(-Math.abs(value), riskUnit);
      return rr == null ? "—" : formatRMultiple(rr);
    }

    return `-${formatCurrencyValue(Math.abs(value), currencyCode, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  return (
    <DashboardWidgetFrame
      title="Total losses"
      icon={<TrendingDown className="size-3 stroke-4 text-white/40" />}
      isEditing={isEditing}
      className={className}
      contentClassName="flex h-full w-full flex-col"
      headerRight={
        !isEditing && rows.length > pageSize ? (
          <div className="flex h-7 items-center overflow-hidden rounded-sm ring ring-white/5 bg-sidebar">
            <Button
              className="size-7 rounded-none ring-0 bg-transparent p-0 text-xs text-white/50 hover:bg-sidebar-accent hover:brightness-120 hover:text-white disabled:opacity-40"
              disabled={page === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              <ChevronLeft className="size-3.5" />
            </Button>

            <span className="px-2 text-[10px] text-white/40">
              {page + 1}/{pageCount}
            </span>

            <Button
              className="size-7 rounded-none ring-0 bg-transparent p-0 text-xs text-white/50 hover:bg-sidebar-accent hover:brightness-120 hover:text-white disabled:opacity-40"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        ) : null
      }
    >
      <div className="flex h-full flex-col justify-end gap-3.5 overflow-y-auto p-3.5">
        {loading ? (
          Array.from({ length: pageSize }).map((_, index) => (
            <div key={`tl-skel-${index}`} className="flex w-full items-center gap-8">
              <Skeleton className="h-4 w-20 rounded-sm bg-sidebar" />
              <div className="flex w-full flex-1 items-center gap-2">
                <Skeleton className="h-3.5 w-full rounded-sm bg-sidebar" />
                <Skeleton className="h-4 w-12 rounded-sm bg-sidebar" />
              </div>
            </div>
          ))
        ) : pageItems.length === 0 ? (
          <div className="text-xs text-white/40">No losses found.</div>
        ) : (
          pageItems.map((row) => {
            const total = Number(row.totalLoss || 0);
            const pctTotal = Math.min(100, Math.round((total / maxTotal) * 100));
            const profitPct =
              total > 0 ? Math.round(((row.profitLoss || 0) / total) * 100) : 0;
            const commPct =
              total > 0
                ? Math.round(((row.commissionsLoss || 0) / total) * 100)
                : 0;
            const swapPct = Math.max(0, 100 - profitPct - commPct);

            return (
              <div key={row.symbol} className="flex w-full items-center gap-3">
                <div className="w-20 truncate text-xs text-white/40">
                  {row.symbol}
                </div>

                <div className="flex-1 rounded-sm bg-sidebar h-3.5">
                  <div className="h-full" style={{ width: `${pctTotal}%` }}>
                    <div className="flex h-full">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="h-full"
                            style={{
                              width: `${profitPct}%`,
                              backgroundColor: "#F76290",
                            }}
                          />
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white/60">Loss</span>
                            <span className="text-xs font-medium text-rose-400">
                              {formatValue(row.profitLoss || 0)}
                            </span>
                          </div>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="h-full"
                            style={{
                              width: `${commPct}%`,
                              backgroundColor: "#A1A1AA",
                            }}
                          />
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white/60">
                              Commissions
                            </span>
                            <span className="text-xs font-medium text-white/80">
                              {formatValue(row.commissionsLoss || 0)}
                            </span>
                          </div>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="h-full"
                            style={{
                              width: `${swapPct}%`,
                              backgroundColor: "#6B7280",
                            }}
                          />
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white/60">Swap</span>
                            <span className="text-xs font-medium text-white/80">
                              {formatValue(row.swapLoss || 0)}
                            </span>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>

                <div className="w-16 truncate text-right text-xs font-semibold text-rose-400">
                  {formatValue(total)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </DashboardWidgetFrame>
  );
}

export function ConsistencyScoreCard({
  accountId,
  isEditing = false,
  className,
}: WidgetCardProps) {
  const dashboardTradeFilters = useDashboardTradeFilters();
  const isUsingFilteredTrades = isUsingFilteredWidgetState(
    accountId,
    dashboardTradeFilters
  );
  const [range, setRange] = useState("all");
  const [byDay, setByDay] = useState<Array<{ dateISO: string; totalProfit: number }>>(
    []
  );
  const [options, setOptions] = useState<
    Array<{ key: string; label: string; startISO?: string; endISO?: string }>
  >([{ key: "all", label: "All time" }]);

  useEffect(() => {
    if (isUsingFilteredTrades) {
      const filteredByDay = buildProfitByDayFromTrades(
        dashboardTradeFilters?.filteredTrades ?? [],
        dashboardTradeFilters?.filters
      );
      setByDay(
        filteredByDay.map((day) => ({
          dateISO: day.dateISO,
          totalProfit: Number(day.totalProfit || 0),
        }))
      );
      return;
    }

    (async () => {
      if (!accountId) return;
      try {
        const bounds = await trpcClient.accounts.opensBounds.query({ accountId });
        const start = new Date(bounds.minISO);
        const end = new Date(bounds.maxISO);

        const nextOptions: Array<{
          key: string;
          label: string;
          startISO?: string;
          endISO?: string;
        }> = [{ key: "all", label: "All time" }];

        const add = (days: number, label: string) => {
          const endDate = new Date(end);
          const startDate = new Date(endDate);
          startDate.setDate(endDate.getDate() - (days - 1));
          if (startDate.getTime() < start.getTime()) return;
          nextOptions.push({
            key: `${days}d`,
            label,
            startISO: startDate.toISOString(),
            endISO: endDate.toISOString(),
          });
        };

        add(7, "Last 7 days");
        add(30, "Last 30 days");
        add(90, "Last 90 days");
        setOptions(nextOptions);
      } catch {
        setOptions([{ key: "all", label: "All time" }]);
      }
    })();
  }, [
    accountId,
    dashboardTradeFilters?.filteredTrades,
    dashboardTradeFilters?.filters,
    isUsingFilteredTrades,
  ]);

  useEffect(() => {
    if (isUsingFilteredTrades) {
      return;
    }

    (async () => {
      if (!accountId) return;
      try {
        const selected = options.find((option) => option.key === range);
        const data = await trpcClient.accounts.profitByDayOverall.query({
          accountId,
          startISO: selected?.startISO,
          endISO: selected?.endISO,
        });
        setByDay(
          data.byDay.map((day) => ({
            dateISO: day.dateISO,
            totalProfit: Number(day.totalProfit || 0),
          }))
        );
      } catch {
        setByDay([]);
      }
    })();
  }, [
    accountId,
    dashboardTradeFilters?.filteredTrades,
    dashboardTradeFilters?.filters,
    isUsingFilteredTrades,
    options,
    range,
  ]);

  const totalDays = byDay.length;
  const profitableDays = byDay.filter((day) => day.totalProfit > 0).length;
  const pct = totalDays > 0 ? (profitableDays / totalDays) * 100 : 0;
  const hasNoTrades = totalDays === 0;

  return (
    <DashboardWidgetFrame
      title="Consistency score"
      icon={
        <InfinityIcon className="size-4 fill-white/50 transition-all duration-250 group-hover:fill-white" />
      }
      isEditing={isEditing}
      className={className}
      headerRight={
        !isEditing && !hasNoTrades && !isUsingFilteredTrades ? (
          <div
            className="flex items-center gap-2"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <ShSelect value={range} onValueChange={setRange}>
              <ShSelectTrigger className="!h-max rounded-sm border border-white/5 bg-transparent px-3 py-1 text-[11px] text-white/60">
                <ShSelectValue placeholder="All time" />
              </ShSelectTrigger>
              <ShSelectContent align="end">
                {options.map((option) => (
                  <ShSelectItem
                    key={option.key}
                    value={option.key}
                    className="text-xs"
                  >
                    {option.label}
                  </ShSelectItem>
                ))}
              </ShSelectContent>
            </ShSelect>
          </div>
        ) : null
      }
    >
      <div className="flex h-full flex-col justify-end p-3.5">
        {hasNoTrades ? (
          <>
            <h1 className="text-2xl font-medium text-white/40">—</h1>
            <p className="text-xs font-medium text-secondary">
              No closed trades yet
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-medium text-white">
              <AnimatedNumber
                value={pct}
                format={(value) =>
                  value.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })
                }
                springOptions={{ bounce: 0, duration: 1200 }}
              />
              %
            </h1>
            <div className="text-xs text-secondary">
              {profitableDays} profitable days out of {totalDays}
            </div>
          </>
        )}
      </div>
    </DashboardWidgetFrame>
  );
}

export function AssetProfitabilityCard({
  accountId,
  isEditing = false,
  className,
  currencyCode,
}: WidgetCardProps) {
  const dashboardTradeFilters = useDashboardTradeFilters();
  const isUsingFilteredTrades = isUsingFilteredWidgetState(
    accountId,
    dashboardTradeFilters
  );
  const [showWorst, setShowWorst] = useState(false);
  const [rows, setRows] = useState<Array<{ symbol: string; totalProfit: number }>>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (isUsingFilteredTrades) {
      setRows(buildProfitByAssetFromTrades(dashboardTradeFilters?.filteredTrades ?? []));
      setLoading(Boolean(dashboardTradeFilters?.isLoading));
      return;
    }

    (async () => {
      if (!accountId) return;
      setLoading(true);
      try {
        const data = await trpcClient.accounts.profitByAssetRange.query({
          accountId,
        });
        setRows(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    })();
  }, [
    accountId,
    dashboardTradeFilters?.filteredTrades,
    dashboardTradeFilters?.isLoading,
    isUsingFilteredTrades,
  ]);

  const list = useMemo(() => {
    const filtered = rows.filter((row) => {
      const value = Number(row.totalProfit || 0);
      return showWorst ? value < 0 : value > 0;
    });

    filtered.sort((left, right) =>
      showWorst
        ? left.totalProfit - right.totalProfit
        : right.totalProfit - left.totalProfit
    );

    return filtered;
  }, [rows, showWorst]);

  const pageSize = 3;
  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const pageItems = useMemo(
    () => list.slice(page * pageSize, page * pageSize + pageSize),
    [list, page]
  );

  useEffect(() => {
    setPage(0);
  }, [rows, showWorst]);

  const maxAbs = useMemo(
    () => Math.max(1, ...pageItems.map((row) => Math.abs(Number(row.totalProfit || 0)))),
    [pageItems]
  );

  return (
    <DashboardWidgetFrame
      title="Asset profitability"
      isEditing={isEditing}
      className={className}
      contentClassName="flex h-full w-full flex-col"
      headerRight={
        !isEditing ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-end gap-1.5">
              <Switch checked={showWorst} onCheckedChange={setShowWorst} />
              <span className="text-[11px] text-white/50">
                {showWorst ? "Worst" : "Best"}
              </span>
            </div>

            {rows.length > pageSize ? (
              <div className="flex h-7 items-center overflow-hidden rounded-sm ring ring-white/5 bg-sidebar">
                <Button
                  className="size-7 rounded-none ring-0 bg-transparent p-0 text-xs text-white/50 hover:bg-sidebar-accent hover:brightness-120 hover:text-white disabled:opacity-40"
                  disabled={page === 0}
                  onClick={() => setPage((value) => Math.max(0, value - 1))}
                >
                  <ChevronLeft className="size-3.5" />
                </Button>

                <span className="px-2 text-[10px] text-white/40">
                  {page + 1}/{pageCount}
                </span>

                <Button
                  className="size-7 rounded-none ring-0 bg-transparent p-0 text-xs text-white/50 hover:bg-sidebar-accent hover:brightness-120 hover:text-white disabled:opacity-40"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            ) : null}
          </div>
        ) : null
      }
    >
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-3.5 p-3.5 pb-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={`asset-skel-${index}`} className="flex w-full items-center gap-8">
              <Skeleton className="h-4 w-24 rounded-sm bg-sidebar" />
              <div className="flex w-full flex-1 items-center gap-2">
                <Skeleton className="h-4 w-full rounded-sm bg-sidebar" />
                <Skeleton className="h-4 w-24 rounded-sm bg-sidebar" />
              </div>
            </div>
          ))
        ) : list.length === 0 ? (
          <div className="text-xs text-white/40">
            No assets with non-zero profit in range.
          </div>
        ) : (
          pageItems.map((row) => {
            const value = Number(row.totalProfit || 0);
            const pct = Math.min(100, Math.round((Math.abs(value) / maxAbs) * 100));
            const isGain = value >= 0;

            return (
              <div key={row.symbol} className="flex w-full items-center gap-3">
                <div className="w-20 truncate text-xs text-white/40">
                  {row.symbol}
                </div>

                <div className="h-3.5 flex-1 rounded-sm bg-sidebar">
                  <div
                    className={cn(
                      "h-full",
                      isGain ? "bg-teal-400" : "bg-rose-400"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div
                  className={cn(
                    "min-w-[5.5rem] whitespace-nowrap text-right text-xs font-semibold",
                    isGain ? "text-teal-400" : "text-rose-400"
                  )}
                >
                  {formatSignedCurrencyValue(value, currencyCode, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </DashboardWidgetFrame>
  );
}

export function TradeCountsCard({
  accountId,
  isEditing = false,
  className,
}: WidgetCardProps) {
  const dashboardTradeFilters = useDashboardTradeFilters();
  const isUsingFilteredTrades = isUsingFilteredWidgetState(
    accountId,
    dashboardTradeFilters
  );
  const [loading, setLoading] = useState(false);
  const [byDay, setByDay] = useState<Array<{ dateISO: string; count: number }>>(
    []
  );
  const [byWeek, setByWeek] = useState<Array<{ startISO: string; count: number }>>(
    []
  );
  const [byMonth, setByMonth] = useState<Array<{ month: string; count: number }>>(
    []
  );

  useEffect(() => {
    if (isUsingFilteredTrades) {
      const filteredCounts = buildTradeCountsFromTrades(
        dashboardTradeFilters?.filteredTrades ?? [],
        dashboardTradeFilters?.filters
      );
      setByDay([...filteredCounts.byDay]);
      setByWeek([...filteredCounts.byWeek]);
      setByMonth([...filteredCounts.byMonth]);
      setLoading(Boolean(dashboardTradeFilters?.isLoading));
      return;
    }

    (async () => {
      if (!accountId) return;
      setLoading(true);
      try {
        const data = await trpcClient.accounts.tradeCountsOverall.query({
          accountId,
        });
        setByDay([...data.byDay]);
        setByWeek([...data.byWeek]);
        setByMonth([...data.byMonth]);
      } finally {
        setLoading(false);
      }
    })();
  }, [
    accountId,
    dashboardTradeFilters?.filteredTrades,
    dashboardTradeFilters?.filters,
    dashboardTradeFilters?.isLoading,
    isUsingFilteredTrades,
  ]);

  const rows = useMemo(() => {
    const totalTrades = byDay.reduce((sum, item) => sum + (item.count || 0), 0);
    const totalDays = byDay.length || 1;
    const perDay = totalTrades / totalDays;

    const weekTotals = byWeek.map((item) => Number(item.count || 0));
    const perWeek =
      weekTotals.reduce((sum, count) => sum + count, 0) / (byWeek.length || 1);

    const monthTotals = byMonth.map((item) => Number(item.count || 0));
    const perMonth =
      monthTotals.reduce((sum, count) => sum + count, 0) / (byMonth.length || 1);

    return [
      { label: "Per day", value: perDay },
      { label: "Per week", value: perWeek },
      { label: "Per month", value: perMonth },
    ];
  }, [byDay, byMonth, byWeek]);

  const maxVal = useMemo(
    () => Math.max(1, ...rows.map((row) => Number(row.value || 0))),
    [rows]
  );

  const formatAverageTradeCount = (value: number) => {
    if (value === 0) return "0";
    if (value < 1) return value.toFixed(2);
    if (value < 10) return value.toFixed(1);
    return value.toFixed(0);
  };

  return (
    <DashboardWidgetFrame
      title="Average trade counts"
      isEditing={isEditing}
      className={className}
      contentClassName="flex h-full w-full flex-col"
    >
      <div className="flex h-full flex-col justify-end gap-3.5 overflow-y-auto p-3.5">
        {loading
          ? Array.from({ length: 3 }).map((_, index) => (
              <div key={`tc-skel-${index}`} className="flex w-full items-center gap-8">
                <Skeleton className="h-4 w-24 rounded-sm bg-sidebar" />
                <div className="flex w-full flex-1 items-center gap-2">
                  <Skeleton className="h-4 w-full rounded-sm bg-sidebar" />
                  <Skeleton className="h-4 w-12 rounded-sm bg-sidebar" />
                </div>
              </div>
            ))
          : rows.map((row) => {
              const value = Number(row.value || 0);
              const pct = Math.min(100, Math.round((Math.abs(value) / maxVal) * 100));

              return (
                <div key={row.label} className="flex w-full items-center">
                  <div className="w-20 truncate text-xs text-white/40">
                    {row.label}
                  </div>
                  <div className="flex w-full flex-1 items-center gap-3">
                    <div className="h-3.5 flex-1 rounded-sm bg-sidebar">
                      <div
                        className="h-full bg-white/75"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="w-12 truncate text-xs font-semibold text-white/70">
                      {formatAverageTradeCount(value)}
                    </div>
                  </div>
                </div>
              );
            })}
      </div>
    </DashboardWidgetFrame>
  );
}
