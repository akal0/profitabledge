"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight, Layers3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardTradeFilters } from "@/features/dashboard/filters/dashboard-trade-filters";
import {
  DashboardWidgetFrame,
  formatSignedCurrencyValue,
  type WidgetCardProps,
} from "@/features/dashboard/widgets/lib/widget-shared";
import { cn } from "@/lib/utils";
import { ALL_ACCOUNTS_ID, useAccountStore } from "@/stores/account";
import { useAccountTransitionStore } from "@/stores/account-transition";
import { trpcOptions } from "@/utils/trpc";

const PAGE_SIZE = 3;

type AccountBreakdownRow = {
  id: string;
  name: string;
  isPropAccount?: boolean;
  totalTrades: number;
  winRate: number;
  totalProfit: number;
  contribution: number;
};

export function AllAccountsBreakdownWidget({
  accountId,
  isEditing = false,
  className,
  currencyCode,
}: WidgetCardProps) {
  const [page, setPage] = useState(0);
  const setSelectedAccountId = useAccountStore(
    (state) => state.setSelectedAccountId
  );
  const beginAccountTransition = useAccountTransitionStore(
    (state) => state.beginAccountTransition
  );
  const dashboardTradeFilters = useDashboardTradeFilters();
  const isAllAccounts = accountId === ALL_ACCOUNTS_ID;
  const { data: rawData, isLoading } = useQuery({
    ...trpcOptions.accounts.aggregatedStats.queryOptions({
      currencyCode,
    }),
    enabled: isAllAccounts,
    staleTime: 15_000,
  });

  const accountRows = useMemo(() => {
    if (dashboardTradeFilters?.hasActiveFilters) {
      return dashboardTradeFilters.accountBreakdown as AccountBreakdownRow[];
    }

    return ((rawData as { accounts?: AccountBreakdownRow[] } | undefined)
      ?.accounts ?? []) as AccountBreakdownRow[];
  }, [
    dashboardTradeFilters?.accountBreakdown,
    dashboardTradeFilters?.hasActiveFilters,
    rawData,
  ]);

  const rankedAccounts = useMemo(
    () =>
      [...accountRows].sort(
        (left, right) => right.totalProfit - left.totalProfit
      ),
    [accountRows]
  );

  const totalPages = Math.max(1, Math.ceil(rankedAccounts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = rankedAccounts.slice(
    currentPage * PAGE_SIZE,
    currentPage * PAGE_SIZE + PAGE_SIZE
  );
  const pageSlots = Array.from(
    { length: PAGE_SIZE },
    (_, index) => pageItems[index] ?? null
  );

  if (!isAllAccounts) {
    return null;
  }

  return (
    <DashboardWidgetFrame
      title="Account contribution"
      icon={<Layers3 className="size-3.5 text-white/40" />}
      isEditing={isEditing}
      className={className}
      contentClassName="flex h-full min-h-0 w-full flex-col overflow-hidden"
      headerRight={
        !isEditing ? (
          <span className="text-[10px] text-white/35">
            {dashboardTradeFilters?.hasActiveFilters
              ? "Filtered"
              : "All accounts"}{" "}
            · {rankedAccounts.length}
          </span>
        ) : null
      }
    >
      {isLoading && !dashboardTradeFilters?.hasActiveFilters ? (
        <div className="flex flex-1 flex-col">
          {Array.from({ length: PAGE_SIZE }).map((_, index) => (
            <Fragment key={`account-breakdown-skeleton-${index}`}>
              {index > 0 ? <Separator /> : null}
              <div className="flex flex-1 items-center justify-between gap-3 px-4">
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-28 rounded-sm bg-sidebar" />
                  <Skeleton className="mt-2 h-3 w-24 rounded-sm bg-sidebar" />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Skeleton className="h-4 w-20 rounded-sm bg-sidebar" />
                  <Skeleton className="h-3 w-16 rounded-sm bg-sidebar" />
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      ) : rankedAccounts.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-white/40">
          {dashboardTradeFilters?.hasActiveFilters
            ? "No accounts matched the current filters."
            : "No accounts available."}
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-col overflow-hidden">
            {pageSlots.map((account, index) => (
              <Fragment key={account?.id ?? `account-breakdown-empty-${index}`}>
                {index > 0 ? <Separator /> : null}
                <div className="flex flex-1 items-center px-4">
                  {account ? (
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 text-left"
                      onClick={() => {
                        beginAccountTransition(account.id);
                        setSelectedAccountId(account.id);
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-xs font-medium text-white/85">
                            {account.name}
                          </span>
                          {account.isPropAccount ? (
                            <span className="rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[9px] text-amber-300">
                              Prop
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[11px] text-white/40">
                          {account.totalTrades} trades ·{" "}
                          {account.winRate.toFixed(1)}% WR
                        </p>
                      </div>

                      <div className="shrink-0 text-center">
                        <p className="text-xs font-medium text-white/70">
                          {account.contribution >= 0 ? "+" : ""}
                          {account.contribution.toFixed(1)}%
                        </p>
                        <p className="mt-1 text-[11px] text-white/35">
                          contribution
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            "text-xs font-semibold",
                            account.totalProfit >= 0
                              ? "text-teal-300"
                              : "text-rose-300"
                          )}
                        >
                          {formatSignedCurrencyValue(
                            account.totalProfit,
                            currencyCode,
                            {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            }
                          )}
                        </p>
                        <p className="mt-1 text-[11px] text-white/35">P&L</p>
                      </div>

                      <ArrowRight className="size-3.5 shrink-0 text-white/20" />
                    </button>
                  ) : null}
                </div>
              </Fragment>
            ))}
          </div>

          {totalPages > 1 ? (
            <>
              <Separator />
              <div className="flex items-center justify-between px-3.5 py-2">
                <span className="text-[11px] text-white/35">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-sm text-white/45 hover:bg-white/[0.05] hover:text-white"
                    onClick={() =>
                      setPage((previous) => Math.max(previous - 1, 0))
                    }
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-sm text-white/45 hover:bg-white/[0.05] hover:text-white"
                    onClick={() =>
                      setPage((previous) =>
                        Math.min(previous + 1, totalPages - 1)
                      )
                    }
                    disabled={currentPage >= totalPages - 1}
                  >
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </>
      )}
    </DashboardWidgetFrame>
  );
}
