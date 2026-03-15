"use client";

import { useQuery } from "@tanstack/react-query";

import { AllAccountsOverview } from "@/components/dashboard/all-accounts-overview";
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
import { normalizeCurrencyCode } from "@/features/dashboard/widgets/lib/widget-shared";
import {
  accountIsEaSynced,
  accountSupportsLiveSync,
} from "@/features/accounts/lib/account-metadata";
import {
  pickPreferredAccountConnection,
  type ConnectionRow as DashboardConnectionRow,
} from "@/features/dashboard-shell/lib/connection-status";

type DashboardPageConnection = DashboardConnectionRow & {
  id: string;
  provider: string;
  lastSyncSuccessAt?: string | Date | null;
};

export default function Page() {
  const accountId = useAccountStore((state) => state.selectedAccountId);
  const { data: me } = useQuery(trpcOptions.users.me.queryOptions());
  const { data: accounts } = useQuery(trpcOptions.accounts.list.queryOptions());
  const { data: rawConnections } = useQuery(
    trpcOptions.connections.list.queryOptions()
  );

  const {
    widgets,
    widgetSpans,
    chartWidgets,
    calendarWidgets,
    calendarWidgetSpans,
    isWidgetsEditing,
    isCalendarEditing,
    isChartWidgetsEditing,
    valueMode,
    setValueMode,
    toggleWidget,
    resizeWidget,
    reorderWidgets,
    toggleChartWidget,
    reorderChartWidgets,
    toggleCalendarWidget,
    resizeCalendarWidget,
    reorderCalendarWidgets,
    enterWidgetsEdit,
    toggleWidgetsEdit,
    enterCalendarEdit,
    toggleCalendarEdit,
    enterChartWidgetsEdit,
    toggleChartWidgetsEdit,
    applyPreset,
    applyChartPreset,
  } = useDashboardHomeLayout(me);

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
  const connections =
    (rawConnections as DashboardPageConnection[] | undefined) ?? [];
  const selectedConnection =
    !isAllAccountsScope(accountId) && accountId
      ? (pickPreferredAccountConnection(
          connections,
          accountId
        ) as DashboardPageConnection | null)
      : null;
  const currencyCode = isAllAccountsScope(accountId)
    ? undefined
    : normalizeCurrencyCode(selectedAccount?.initialCurrency);
  const currencyLabel = currencyCode ?? "Currency";
  const supportsLiveWidgets =
    isAllAccountsScope(accountId) || accountSupportsLiveSync(selectedAccount);
  const accountAction: DashboardAccountAction | null = (() => {
    if (!accountId || isAllAccountsScope(accountId) || !selectedAccount) {
      return null;
    }

    if (selectedConnection) {
      return {
        type: "sync",
        label: "Sync account",
        timestampLabel: "Last synced",
        timestamp: selectedConnection.lastSyncSuccessAt ?? null,
        connectionId: selectedConnection.id,
        provider: selectedConnection.provider,
      };
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
    <main className="space-y-4 p-6 py-4">
      <DashboardOverviewHeader
        user={me ?? null}
        isEditing={isWidgetsEditing}
        valueMode={valueMode}
        currencyLabel={currencyLabel}
        accountAction={accountAction}
        widgets={widgets}
        widgetSpans={widgetSpans}
        onValueModeChange={setValueMode}
        onToggleEdit={toggleWidgetsEdit}
        onApplyPreset={applyPreset}
      />

      <div className="flex flex-1 flex-col gap-8">
        {accountId === ALL_ACCOUNTS_ID ? <AllAccountsOverview /> : null}

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

        <Calendar
          accountId={accountId}
          isEditing={isCalendarEditing}
          summaryWidgets={calendarWidgets}
          summaryWidgetSpans={calendarWidgetSpans}
          onToggleSummaryWidget={toggleCalendarWidget}
          onReorderSummaryWidget={reorderCalendarWidgets}
          onResizeSummaryWidget={resizeCalendarWidget}
          onEnterEdit={enterCalendarEdit}
          onToggleEdit={toggleCalendarEdit}
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
  );
}
