"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  isAllAccountsScope,
  useAccountStore,
} from "@/stores/account";
import { useDashboardAssistantContextStore } from "@/stores/dashboard-assistant-context";
import {
  buildContextFromPath,
  type AssistantPageContextPayload,
} from "@/lib/assistant-page-context";

export type { AssistantPageContextPayload } from "@/lib/assistant-page-context";

export function useAssistantPageContext(
  source?: AssistantPageContextPayload["source"],
  overridePath?: string
): AssistantPageContextPayload {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const accountId = useAccountStore((state) => state.selectedAccountId);
  const dashboardWidgetIds = useDashboardAssistantContextStore(
    (state) => state.visibleWidgets
  );
  const dashboardChartWidgetIds = useDashboardAssistantContextStore(
    (state) => state.visibleChartWidgets
  );
  const focusedWidgetId = useDashboardAssistantContextStore(
    (state) => state.focusedWidgetId
  );

  return useMemo(() => {
    const effectivePath = overridePath || pathname || undefined;
    const context = buildContextFromPath(effectivePath, searchParams, source);
    const includeDashboardContext = context.surface === "dashboard";

    return {
      ...context,
      dashboardWidgetIds: includeDashboardContext ? dashboardWidgetIds : undefined,
      dashboardChartWidgetIds: includeDashboardContext
        ? dashboardChartWidgetIds
        : undefined,
      focusedWidgetId: includeDashboardContext ? focusedWidgetId : null,
      accountScope: isAllAccountsScope(accountId) ? "all" : "single",
    };
  }, [
    accountId,
    dashboardChartWidgetIds,
    dashboardWidgetIds,
    focusedWidgetId,
    overridePath,
    pathname,
    searchParams,
    source,
  ]);
}
