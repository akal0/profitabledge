"use client";

import { Layers3, TrendingUp, Wallet, Activity, ArrowRight } from "lucide-react";

import { trpcOptions } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useDashboardTradeFilters } from "@/features/dashboard/filters/dashboard-trade-filters";

function formatUsd(value: number) {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function AllAccountsOverview({ className }: { className?: string }) {
  const setSelectedAccountId = useAccountStore((state) => state.setSelectedAccountId);
  const dashboardTradeFilters = useDashboardTradeFilters();
  const { data: rawData, isLoading } = useQuery({
    ...trpcOptions.accounts.aggregatedStats.queryOptions(),
    staleTime: 15_000,
  });
  const defaultData = rawData as
    | {
        accounts: Array<{
          id: string;
          name: string;
          isPropAccount?: boolean;
          totalTrades: number;
          winRate: number;
          totalProfit: number;
          contribution: number;
        }>;
        totals: {
          totalBalance: number;
          totalProfit: number;
          overallWinRate: number;
          overallExpectancy: number;
        };
      }
    | undefined;

  const data = dashboardTradeFilters?.hasActiveFilters
    ? {
        accounts: dashboardTradeFilters.accountBreakdown,
        totals: {
          totalBalance: 0,
          totalProfit: Number(dashboardTradeFilters.filteredStats?.totalProfit ?? 0),
          overallWinRate: Number(dashboardTradeFilters.filteredStats?.winrate ?? 0),
          overallExpectancy: Number(dashboardTradeFilters.filteredStats?.expectancy ?? 0),
        },
      }
    : defaultData;

  if (isLoading && !dashboardTradeFilters?.hasActiveFilters) {
    return (
      <section
        className={cn(
          "border border-white/5 bg-sidebar rounded-sm p-5",
          className
        )}
      >
        <div className="h-24 animate-pulse bg-white/5 rounded-sm" />
      </section>
    );
  }

  if (!data) return null;

  const summaryItems = dashboardTradeFilters?.hasActiveFilters
    ? [
        {
          label: "Filtered Trades",
          value: String(dashboardTradeFilters.filteredTrades.length),
          icon: Wallet,
          tone: "text-teal-400",
        },
        {
          label: "Net Profit",
          value: formatUsd(data.totals.totalProfit),
          icon: TrendingUp,
          tone:
            data.totals.totalProfit >= 0 ? "text-teal-400" : "text-rose-400",
        },
        {
          label: "Win Rate",
          value: `${data.totals.overallWinRate.toFixed(1)}%`,
          icon: Activity,
          tone: "text-white",
        },
        {
          label: "Accounts",
          value: String(data.accounts.length),
          icon: Layers3,
          tone: "text-white",
        },
      ]
    : [
        {
          label: "Portfolio Balance",
          value: formatUsd(data.totals.totalBalance),
          icon: Wallet,
          tone: "text-teal-400",
        },
        {
          label: "Net Profit",
          value: formatUsd(data.totals.totalProfit),
          icon: TrendingUp,
          tone:
            data.totals.totalProfit >= 0 ? "text-teal-400" : "text-rose-400",
        },
        {
          label: "Win Rate",
          value: `${data.totals.overallWinRate.toFixed(1)}%`,
          icon: Activity,
          tone: "text-white",
        },
        {
          label: "Accounts",
          value: String(data.accounts.length),
          icon: Layers3,
          tone: "text-white",
        },
      ];

  const rankedAccounts = [...data.accounts].sort(
    (a, b) => b.totalProfit - a.totalProfit
  );

  return (
    <section
      className={cn(
        "border border-white/5 bg-sidebar rounded-sm p-1.5",
        className
      )}
    >
      <div className="bg-white dark:bg-sidebar-accent rounded-sm p-4 md:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
              {dashboardTradeFilters?.hasActiveFilters
                ? "Filtered Portfolio"
                : "All Accounts"}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              {dashboardTradeFilters?.hasActiveFilters
                ? "Cross-account filtered view"
                : "Cross-account portfolio view"}
            </h2>
            <p className="mt-1 text-sm text-white/45">
              {dashboardTradeFilters?.hasActiveFilters
                ? "Aggregate the currently filtered trades across tagged or selected accounts."
                : "Aggregate P&L, capital, and contribution across every linked account."}
            </p>
          </div>

          <div className="text-right">
            <p className="text-[10px] text-white/35">Expectancy</p>
            <p className="text-sm font-medium text-white/80">
              {formatUsd(data.totals.overallExpectancy)} / trade
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {summaryItems.map((item) => (
            <div key={item.label} className="border border-white/5 bg-black/10 p-3">
              <div className="flex items-center gap-2 text-white/40">
                <item.icon className="size-3.5" />
                <span className="text-[10px] uppercase tracking-[0.16em]">
                  {item.label}
                </span>
              </div>
              <p className={cn("mt-3 text-xl font-semibold", item.tone)}>
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-2">
          {rankedAccounts.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => setSelectedAccountId(account.id)}
              className="flex items-center gap-4 border border-white/5 bg-black/10 px-4 py-3 text-left transition-colors hover:bg-black/20"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">
                    {account.name}
                  </span>
                  {account.isPropAccount ? (
                    <span className="text-[10px] uppercase tracking-[0.16em] text-amber-300">
                      Prop
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-white/40">
                  {account.totalTrades} trades · {account.winRate.toFixed(1)}% WR
                </p>
              </div>

              <div className="text-right">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    account.totalProfit >= 0 ? "text-teal-400" : "text-rose-400"
                  )}
                >
                  {formatUsd(account.totalProfit)}
                </p>
                <p className="mt-1 text-[11px] text-white/35">
                  {account.contribution >= 0 ? "+" : ""}
                  {account.contribution.toFixed(0)}% contribution
                </p>
              </div>

              <ArrowRight className="size-4 text-white/25" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
