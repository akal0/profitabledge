"use client";

import { queryClient, trpcOptions } from "@/utils/trpc";
import { ALL_ACCOUNTS_ID, useAccountStore } from "@/stores/account";
import { useDateRangeStore } from "@/stores/date-range";
import {
  getAvailableDashboardCurrencyCodes,
  resolveDashboardCurrencyCode,
} from "@/features/dashboard/home/lib/dashboard-currency";
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
  initialCurrency?: string | null;
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

  if (
    selectedAccountId &&
    accounts.some((account) => account.id === selectedAccountId)
  ) {
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

function resolveDashboardWorkspaceCurrencyCode(
  accounts: WarmupAccount[],
  selectedAccountId: string
) {
  return resolveDashboardCurrencyCode({
    isAllAccounts: selectedAccountId === ALL_ACCOUNTS_ID,
    preferredCurrencyCode: useAccountStore.getState().allAccountsPreferredCurrencyCode,
    availableCurrencyCodes: getAvailableDashboardCurrencyCodes(accounts),
    selectedAccountCurrency:
      accounts.find((account) => account.id === selectedAccountId)?.initialCurrency ??
      null,
  });
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

  return true;
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

  const bounds = (await queryClient
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
  const currencyCode = resolveDashboardWorkspaceCurrencyCode(
    accounts,
    selectedAccountId
  );

  const eagerWarmups = [
    queryClient.prefetchQuery({
      ...trpcOptions.accounts.stats.queryOptions({
        accountId: selectedAccountId,
        currencyCode,
      }),
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
          ...trpcOptions.accounts.aggregatedStats.queryOptions({}),
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
    eagerWarmups.push(
      queryClient.prefetchQuery({
        ...trpcOptions.accounts.recentByDay.queryOptions({
          accountId: selectedAccountId,
          startISO: visibleRange.start.toISOString(),
          endISO: visibleRange.end.toISOString(),
          currencyCode,
        }),
        staleTime: 30_000,
      }),
      queryClient.prefetchQuery({
        ...trpcOptions.accounts.rangeSummary.queryOptions({
          accountId: selectedAccountId,
          startISO: visibleRange.start.toISOString(),
          endISO: visibleRange.end.toISOString(),
          currencyCode,
        }),
        staleTime: 30_000,
      })
    );
  }

  if (calendarFetchRange) {
    eagerWarmups.push(
      queryClient.prefetchQuery({
        ...trpcOptions.accounts.recentByDay.queryOptions({
          accountId: selectedAccountId,
          startISO: calendarFetchRange.start.toISOString(),
          endISO: calendarFetchRange.end.toISOString(),
          currencyCode,
        }),
        staleTime: 30_000,
      })
    );
  }

  void Promise.allSettled(eagerWarmups);

  const backgroundWarmups: WarmupTask[] = [];

  const deferredWarmups: WarmupTask[] = [
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
    () =>
      queryClient.prefetchQuery({
        ...trpcOptions.goals.list.queryOptions({
          accountId: selectedAccountId || undefined,
        }),
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
    deferredWarmups.push(() =>
        queryClient.prefetchQuery({
          ...trpcOptions.accounts.profitByAssetRange.queryOptions({
            accountId: selectedAccountId,
            startISO: visibleRange.start.toISOString(),
            endISO: visibleRange.end.toISOString(),
            currencyCode,
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
