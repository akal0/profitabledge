"use client";

import { queryClient, trpcOptions } from "@/utils/trpc";
import { ALL_ACCOUNTS_ID, useAccountStore } from "@/stores/account";
import { useDateRangeStore } from "@/stores/date-range";
import {
  addDays,
  clampRange,
  endOfMonth,
  startOfMonth,
} from "@/features/dashboard/calendar/lib/calendar-utils";

const DASHBOARD_WIDGET_TRADE_LIMIT = 200;
const DEFERRED_WARMUP_TIMEOUT_MS = 1200;

type WarmupAccount = {
  id: string;
};

type OpenBounds = {
  minISO: string;
  maxISO: string;
};

type WarmupTask = () => Promise<unknown>;

function isDashboardWorkspacePath(path: string) {
  const [pathname] = path.split("?");
  return pathname === "/dashboard";
}

function runWhenBrowserIdle(task: () => void) {
  if (typeof window === "undefined") {
    task();
    return;
  }

  const requestIdleCallback =
    "requestIdleCallback" in window
      ? window.requestIdleCallback.bind(window)
      : null;

  if (requestIdleCallback) {
    requestIdleCallback(() => task(), {
      timeout: DEFERRED_WARMUP_TIMEOUT_MS,
    });
    return;
  }

  window.setTimeout(task, DEFERRED_WARMUP_TIMEOUT_MS);
}

function resolveDashboardAccountSelection(accounts: WarmupAccount[]) {
  const selectedAccountId = useAccountStore.getState().selectedAccountId;

  if (selectedAccountId === ALL_ACCOUNTS_ID) {
    return ALL_ACCOUNTS_ID;
  }

  if (selectedAccountId && accounts.some((account) => account.id === selectedAccountId)) {
    return selectedAccountId;
  }

  return accounts[0]?.id;
}

function deriveDashboardRangeState(bounds: OpenBounds | null | undefined) {
  if (!bounds) {
    return null;
  }

  const minDate = new Date(bounds.minISO);
  const maxDate = new Date(bounds.maxISO);
  const visibleRange = clampRange(
    startOfMonth(maxDate),
    endOfMonth(maxDate),
    minDate,
    maxDate
  );
  const calendarFetchRange = {
    start: startOfMonth(visibleRange.start),
    end: addDays(endOfMonth(visibleRange.start), 14),
  };

  return {
    minDate,
    maxDate,
    visibleRange,
    calendarFetchRange,
  };
}

function syncDashboardStores(
  accountId: string | undefined,
  bounds: OpenBounds | null | undefined
) {
  useAccountStore.getState().setSelectedAccountId(accountId);

  const rangeState = deriveDashboardRangeState(bounds);

  if (!rangeState) {
    return null;
  }

  useDateRangeStore
    .getState()
    .setRange(rangeState.visibleRange.start, rangeState.visibleRange.end);
  useDateRangeStore
    .getState()
    .setBounds(rangeState.minDate, rangeState.maxDate);

  return rangeState;
}

export function syncPrefetchedDashboardWorkspace(targetPath: string) {
  if (!isDashboardWorkspacePath(targetPath)) {
    return;
  }

  const accounts = queryClient.getQueryData(
    trpcOptions.accounts.list.queryOptions().queryKey
  ) as WarmupAccount[] | undefined;

  if (!accounts) {
    return;
  }

  const selectedAccountId = resolveDashboardAccountSelection(accounts);

  if (!selectedAccountId) {
    useAccountStore.getState().setSelectedAccountId(undefined);
    return;
  }

  const bounds = queryClient.getQueryData(
    trpcOptions.accounts.opensBounds.queryOptions({
      accountId: selectedAccountId,
    }).queryKey
  ) as OpenBounds | null | undefined;

  if (!bounds) {
    return;
  }

  syncDashboardStores(selectedAccountId, bounds);
}

export function hasPrefetchedDashboardWorkspace(targetPath: string) {
  if (!isDashboardWorkspacePath(targetPath)) {
    return true;
  }

  const meState = queryClient.getQueryState(
    trpcOptions.users.me.queryOptions().queryKey
  );
  const billingState = queryClient.getQueryState(
    trpcOptions.billing.getState.queryOptions().queryKey
  );
  const accounts = queryClient.getQueryData(
    trpcOptions.accounts.list.queryOptions().queryKey
  ) as WarmupAccount[] | undefined;

  if (!meState?.dataUpdatedAt || !billingState?.dataUpdatedAt || !accounts) {
    return false;
  }

  const selectedAccountId = resolveDashboardAccountSelection(accounts);

  if (!selectedAccountId) {
    return true;
  }

  const bounds = queryClient.getQueryData(
    trpcOptions.accounts.opensBounds.queryOptions({
      accountId: selectedAccountId,
    }).queryKey
  ) as OpenBounds | null | undefined;

  if (!bounds) {
    return false;
  }

  const rangeState = deriveDashboardRangeState(bounds);
  const criticalKeys: Array<readonly unknown[]> = [
    trpcOptions.accounts.stats.queryOptions({
      accountId: selectedAccountId,
    }).queryKey,
    trpcOptions.trades.listInfinite.queryOptions({
      accountId: selectedAccountId,
      limit: DASHBOARD_WIDGET_TRADE_LIMIT,
    }).queryKey,
    selectedAccountId === ALL_ACCOUNTS_ID
      ? trpcOptions.accounts.aggregatedStats.queryOptions().queryKey
      : trpcOptions.accounts.liveMetrics.queryOptions({
          accountId: selectedAccountId,
        }).queryKey,
  ];

  if (rangeState?.visibleRange) {
    criticalKeys.push(
      trpcOptions.accounts.recentByDay.queryOptions({
        accountId: selectedAccountId,
        startISO: rangeState.visibleRange.start.toISOString(),
        endISO: rangeState.visibleRange.end.toISOString(),
      }).queryKey,
      trpcOptions.accounts.rangeSummary.queryOptions({
        accountId: selectedAccountId,
        startISO: rangeState.visibleRange.start.toISOString(),
        endISO: rangeState.visibleRange.end.toISOString(),
      }).queryKey
    );
  }

  if (rangeState?.calendarFetchRange) {
    criticalKeys.push(
      trpcOptions.accounts.recentByDay.queryOptions({
        accountId: selectedAccountId,
        startISO: rangeState.calendarFetchRange.start.toISOString(),
        endISO: rangeState.calendarFetchRange.end.toISOString(),
      }).queryKey
    );
  }

  return criticalKeys.every((queryKey) => {
    const state = queryClient.getQueryState(queryKey);
    return Boolean(state?.dataUpdatedAt);
  });
}

export async function prefetchDashboardWorkspace(targetPath: string) {
  if (!isDashboardWorkspacePath(targetPath)) {
    return;
  }

  const [, , accountsData] = await Promise.all([
    queryClient.fetchQuery({
      ...trpcOptions.users.me.queryOptions(),
      staleTime: 5 * 60_000,
    }),
    queryClient.fetchQuery({
      ...trpcOptions.billing.getState.queryOptions(),
      staleTime: 60_000,
    }),
    queryClient.fetchQuery({
      ...trpcOptions.accounts.list.queryOptions(),
      staleTime: 30_000,
    }),
  ]);

  const accounts = (accountsData as WarmupAccount[] | undefined) ?? [];
  const selectedAccountId = resolveDashboardAccountSelection(accounts);

  if (!selectedAccountId) {
    useAccountStore.getState().setSelectedAccountId(undefined);
    return;
  }

  const bounds =
    (await queryClient
      .fetchQuery({
        ...trpcOptions.accounts.opensBounds.queryOptions({
          accountId: selectedAccountId,
        }),
        staleTime: 30_000,
      })
      .catch(() => null)) as OpenBounds | null;

  const rangeState = syncDashboardStores(selectedAccountId, bounds);
  const visibleRange = rangeState?.visibleRange;
  const calendarFetchRange = rangeState?.calendarFetchRange;
  const hasScopedAccountSelection = selectedAccountId !== ALL_ACCOUNTS_ID;

  const criticalWarmups = [
    queryClient.prefetchQuery({
      ...trpcOptions.accounts.stats.queryOptions({ accountId: selectedAccountId }),
      staleTime: 30_000,
    }),
    queryClient.prefetchQuery({
      ...trpcOptions.trades.listInfinite.queryOptions({
        accountId: selectedAccountId,
        limit: DASHBOARD_WIDGET_TRADE_LIMIT,
      }),
      staleTime: 60_000,
    }),
    selectedAccountId === ALL_ACCOUNTS_ID
      ? queryClient.prefetchQuery({
          ...trpcOptions.accounts.aggregatedStats.queryOptions(),
          staleTime: 15_000,
        })
      : queryClient.prefetchQuery({
          ...trpcOptions.accounts.liveMetrics.queryOptions({
            accountId: selectedAccountId,
          }),
          staleTime: 4_000,
        }),
  ];

  if (visibleRange) {
    criticalWarmups.push(
      queryClient.prefetchQuery({
        ...trpcOptions.accounts.recentByDay.queryOptions({
          accountId: selectedAccountId,
          startISO: visibleRange.start.toISOString(),
          endISO: visibleRange.end.toISOString(),
        }),
        staleTime: 30_000,
      }),
      queryClient.prefetchQuery({
        ...trpcOptions.accounts.rangeSummary.queryOptions({
          accountId: selectedAccountId,
          startISO: visibleRange.start.toISOString(),
          endISO: visibleRange.end.toISOString(),
        }),
        staleTime: 30_000,
      })
    );
  }

  if (calendarFetchRange) {
    criticalWarmups.push(
      queryClient.prefetchQuery({
        ...trpcOptions.accounts.recentByDay.queryOptions({
          accountId: selectedAccountId,
          startISO: calendarFetchRange.start.toISOString(),
          endISO: calendarFetchRange.end.toISOString(),
        }),
        staleTime: 30_000,
      })
    );
  }

  await Promise.allSettled(criticalWarmups);

  const backgroundWarmups: WarmupTask[] = [
    () =>
      queryClient.prefetchQuery({
        ...trpcOptions.trades.listSymbols.queryOptions({
          accountId: selectedAccountId,
        }),
        staleTime: 60_000,
      }),
    () =>
      queryClient.prefetchQuery({
        ...trpcOptions.trades.listSessionTags.queryOptions({
          accountId: selectedAccountId,
        }),
        staleTime: 60_000,
      }),
    () =>
      queryClient.prefetchQuery({
        ...trpcOptions.trades.listModelTags.queryOptions({
          accountId: selectedAccountId,
        }),
        staleTime: 60_000,
      }),
    () =>
      queryClient.prefetchQuery({
        ...trpcOptions.trades.listCustomTags.queryOptions({
          accountId: selectedAccountId,
        }),
        staleTime: 60_000,
      }),
    () =>
      queryClient.prefetchQuery({
        ...trpcOptions.accounts.listTags.queryOptions(),
        staleTime: 60_000,
      }),
  ];

  if (hasScopedAccountSelection) {
    backgroundWarmups.push(
      () =>
        queryClient.prefetchQuery({
          ...trpcOptions.accounts.executionStats.queryOptions({
            accountId: selectedAccountId,
          }),
          staleTime: 60_000,
        }),
      () =>
        queryClient.prefetchQuery({
          ...trpcOptions.accounts.moneyLeftOnTable.queryOptions({
            accountId: selectedAccountId,
          }),
          staleTime: 60_000,
        }),
      () =>
        queryClient.prefetchQuery({
          ...trpcOptions.accounts.profitByDayOverall.queryOptions({
            accountId: selectedAccountId,
          }),
          staleTime: 60_000,
        }),
      () =>
        queryClient.prefetchQuery({
          ...trpcOptions.accounts.tradeCountsOverall.queryOptions({
            accountId: selectedAccountId,
          }),
          staleTime: 60_000,
        })
    );
  }

  const deferredWarmups: WarmupTask[] = [
    () =>
      queryClient.prefetchQuery({
        ...trpcOptions.connections.list.queryOptions(),
        staleTime: 15_000,
      }),
    () =>
      queryClient.prefetchQuery({
        ...trpcOptions.goals.list.queryOptions({
          accountId: selectedAccountId || undefined,
        }),
        staleTime: 60_000,
      }),
  ];

  if (hasScopedAccountSelection) {
    deferredWarmups.push(
      () =>
        queryClient.prefetchQuery({
          ...trpcOptions.accounts.lossesByAssetRange.queryOptions({
            accountId: selectedAccountId,
          }),
          staleTime: 60_000,
        }),
      () =>
        queryClient.prefetchQuery({
          ...trpcOptions.ai.getProfile.queryOptions({
            accountId: selectedAccountId,
          }),
          staleTime: 60_000,
        })
    );
  }

  if (visibleRange && hasScopedAccountSelection) {
    deferredWarmups.push(
      () =>
        queryClient.prefetchQuery({
          ...trpcOptions.accounts.profitByAssetRange.queryOptions({
            accountId: selectedAccountId,
            startISO: visibleRange.start.toISOString(),
            endISO: visibleRange.end.toISOString(),
          }),
          staleTime: 30_000,
        })
    );
  }

  void Promise.allSettled(backgroundWarmups.map((run) => run()));
  runWhenBrowserIdle(() => {
    void Promise.allSettled(deferredWarmups.map((run) => run()));
  });
}
