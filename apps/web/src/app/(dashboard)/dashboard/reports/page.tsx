"use client";

import {
  DashboardTradeFiltersProvider,
} from "@/features/dashboard/filters/dashboard-trade-filters";
import { ReportsWorkspace } from "@/features/reports/components/reports-workspace";
import { useAccountStore } from "@/stores/account";

export default function ReportsPage() {
  const accountId = useAccountStore((state) => state.selectedAccountId);

  return (
    <DashboardTradeFiltersProvider accountId={accountId} fetchMode="controls">
      <ReportsWorkspace />
    </DashboardTradeFiltersProvider>
  );
}
