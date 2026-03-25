"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef } from "react";

import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import Calendar from "@/features/dashboard/calendar/components/dashboard-calendar";
import { ChartWidgets } from "@/components/dashboard/chart-widgets";
import { Widgets } from "@/components/dashboard/widgets";
import type { DashboardAccountAction } from "@/components/dashboard/dashboard-action-buttons";
import { trpcOptions } from "@/utils/trpc";
import {
  ALL_ACCOUNTS_ID,
  isAllAccountsScope,
  useAccountStore,
} from "@/stores/account";
import { DashboardOverviewHeader } from "@/features/dashboard/home/components/dashboard-overview-header";
import { useDashboardHomeLayout } from "@/features/dashboard/home/hooks/use-dashboard-home-layout";
import {
  getAvailableDashboardCurrencyCodes,
  resolveDashboardCurrencyCode,
} from "@/features/dashboard/home/lib/dashboard-currency";
import {
  DashboardTradeFiltersBar,
  DashboardTradeFiltersProvider,
} from "@/features/dashboard/filters/dashboard-trade-filters";
import { WidgetShareScopeProvider } from "@/features/dashboard/widgets/lib/widget-share-scope";
import {
  accountIsEaSynced,
  accountSupportsLiveSync,
  isDemoWorkspaceAccount,
} from "@/features/accounts/lib/account-metadata";
import {
  pickPreferredAccountConnection,
  type ConnectionRow as DashboardConnectionRow,
} from "@/features/dashboard-shell/lib/connection-status";
import { useDashboardWorkspaceReady } from "@/features/dashboard/home/hooks/use-dashboard-workspace-ready";
import { AllAccountsBreakdownWidget } from "@/features/dashboard/widgets/components/all-accounts-breakdown-widget";

type DashboardPageConnection = DashboardConnectionRow & {
  id: string;
  provider: string;
  lastSyncSuccessAt?: string | Date | null;
};

function DashboardPageContent() {
  const widgetsExportRef = useRef<HTMLDivElement | null>(null);
  const accountId = useAccountStore((state) => state.selectedAccountId);
  const allAccountsPreferredCurrencyCode = useAccountStore(
    (state) => state.allAccountsPreferredCurrencyCode
  );
  const setAllAccountsPreferredCurrencyCode = useAccountStore(
    (state) => state.setAllAccountsPreferredCurrencyCode
  );
  const { data: me } = useQuery({
    ...trpcOptions.users.me.queryOptions(),
    staleTime: 5 * 60_000,
  });
  const { data: accounts } = useQuery({
    ...trpcOptions.accounts.list.queryOptions(),
    staleTime: 30_000,
  });
  const selectedAccount = accounts?.find(
    (account) => account.id === accountId
  ) as
    | {
        id: string;
        name?: string | null;
        broker?: string | null;
        initialCurrency?: string | null;
        isVerified?: number | boolean | null;
        verificationLevel?: string | null;
        lastSyncedAt?: string | Date | null;
        lastImportedAt?: string | Date | null;
      }
    | undefined;
  const shouldLoadConnections =
    Boolean(accountId) &&
    !isAllAccountsScope(accountId) &&
    accountSupportsLiveSync(selectedAccount);
  const { data: rawConnections } = useQuery({
    ...trpcOptions.connections.list.queryOptions(),
    enabled: shouldLoadConnections,
    staleTime: 15_000,
  });

  const {
    widgets,
    widgetSpans,
    chartWidgets,
    calendarWidgets,
    calendarWidgetSpans,
    isWidgetsEditing,
    isChartWidgetsEditing,
    valueMode,
    setValueMode,
    toggleWidget,
    resizeWidget,
    reorderWidgets,
    toggleChartWidget,
    reorderChartWidgets,
    enterWidgetsEdit,
    toggleWidgetsEdit,
    enterChartWidgetsEdit,
    toggleChartWidgetsEdit,
    applyPreset,
    applyChartPreset,
    applyCalendarPreset,
  } = useDashboardHomeLayout(me);

  const connections =
    (rawConnections as DashboardPageConnection[] | undefined) ?? [];
  const selectedConnection =
    !isAllAccountsScope(accountId) && accountId
      ? (pickPreferredAccountConnection(
          connections,
          accountId
        ) as DashboardPageConnection | null)
      : null;
  const availableCurrencyCodes = useMemo(
    () =>
      getAvailableDashboardCurrencyCodes(
        accounts as Array<{ initialCurrency?: string | null }> | undefined
      ),
    [accounts]
  );
  const currencyCode = resolveDashboardCurrencyCode({
    isAllAccounts: isAllAccountsScope(accountId),
    preferredCurrencyCode: allAccountsPreferredCurrencyCode,
    availableCurrencyCodes,
    selectedAccountCurrency: selectedAccount?.initialCurrency,
  });
  const currencyLabel = currencyCode ?? "Currency";
  const supportsLiveWidgets =
    isAllAccountsScope(accountId) || accountSupportsLiveSync(selectedAccount);
  const accountAction: DashboardAccountAction | null = (() => {
    if (!accountId || isAllAccountsScope(accountId) || !selectedAccount) {
      return null;
    }

    if (isDemoWorkspaceAccount(selectedAccount)) {
      return null;
    }

    if (selectedConnection) {
      return null;
    }

    if (accountIsEaSynced(selectedAccount)) {
      return {
        type: "timestamp",
        timestampLabel: "Last updated",
        timestamp: selectedAccount.lastSyncedAt ?? null,
      };
    }

    if (selectedAccount.lastImportedAt) {
      return {
        type: "timestamp",
        timestampLabel: "Last updated",
        timestamp: selectedAccount.lastImportedAt,
      };
    }

    return null;
  })();

  return (
    <DashboardTradeFiltersProvider accountId={accountId} fetchMode="filtered">
      <WidgetShareScopeProvider accountId={accountId}>
        <main className="space-y-4 p-6 py-4">
          <DashboardOverviewHeader
            user={me ?? null}
            isEditing={isWidgetsEditing}
            valueMode={valueMode}
            currencyLabel={currencyLabel}
            currencyOptions={
              isAllAccountsScope(accountId) ? availableCurrencyCodes : []
            }
            onCurrencyCodeChange={
              isAllAccountsScope(accountId)
                ? setAllAccountsPreferredCurrencyCode
                : undefined
            }
            accountAction={accountAction}
            leadingActions={<DashboardTradeFiltersBar mode="button" />}
            widgetsExportTargetRef={widgetsExportRef}
            widgets={widgets}
            widgetSpans={widgetSpans}
            onValueModeChange={setValueMode}
            onToggleEdit={toggleWidgetsEdit}
            onApplyPreset={applyPreset}
          />

          <div className="flex flex-1 flex-col gap-8">
            <div ref={widgetsExportRef} className="space-y-1.5">
              {accountId === ALL_ACCOUNTS_ID ? (
                <AllAccountsBreakdownWidget
                  accountId={accountId}
                  currencyCode={currencyCode}
                  className="h-[18rem]"
                />
              ) : null}
              <Widgets
                enabledWidgets={widgets}
                accountId={accountId}
                isEditing={isWidgetsEditing}
                valueMode={valueMode}
                currencyCode={currencyCode}
                supportsLiveWidgets={supportsLiveWidgets}
                onToggleWidget={toggleWidget}
                onReorder={reorderWidgets}
                onEnterEdit={enterWidgetsEdit}
                widgetSpans={widgetSpans}
                onResizeWidget={resizeWidget}
              />
            </div>

            <Calendar
              accountId={accountId}
              summaryWidgets={calendarWidgets}
              summaryWidgetSpans={calendarWidgetSpans}
              onApplyPreset={applyCalendarPreset}
            />

            <ChartWidgets
              accountId={accountId}
              enabledWidgets={chartWidgets}
              isEditing={isChartWidgetsEditing}
              onToggleWidget={toggleChartWidget}
              onReorder={reorderChartWidgets}
              onEnterEdit={enterChartWidgetsEdit}
              onToggleEdit={toggleChartWidgetsEdit}
              onApplyPreset={applyChartPreset}
            />
          </div>
        </main>
      </WidgetShareScopeProvider>
    </DashboardTradeFiltersProvider>
  );
}

export default function Page() {
  const isDashboardWorkspaceReady = useDashboardWorkspaceReady();

  if (!isDashboardWorkspaceReady) {
    return (
      <main className="flex min-h-full flex-1">
        <RouteLoadingFallback
          route="dashboard"
          className="min-h-[calc(100vh-10rem)]"
        />
      </main>
    );
  }

  return <DashboardPageContent />;
}
