"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  isAllAccountsScope,
  useAccountStore,
} from "@/stores/account";
import { useDashboardAssistantContextStore } from "@/stores/dashboard-assistant-context";

export type AssistantSurface =
  | "dashboard"
  | "journal"
  | "backtest"
  | "prop-tracker"
  | "psychology"
  | "trades"
  | "settings"
  | "assistant"
  | "unknown";

export interface AssistantPageContextPayload {
  pathname?: string;
  surface?: AssistantSurface;
  backtestSessionId?: string | null;
  propAccountId?: string | null;
  journalEntryId?: string | null;
  dashboardWidgetIds?: string[];
  dashboardChartWidgetIds?: string[];
  focusedWidgetId?: string | null;
  accountScope?: "single" | "all";
  source?: "floating-assistant" | "premium-assistant" | "dashboard-chat";
}

function inferSurface(pathname?: string | null): AssistantSurface {
  if (!pathname) return "unknown";
  if (pathname === "/assistant") return "assistant";
  if (pathname.startsWith("/dashboard/psychology")) return "psychology";
  if (pathname.startsWith("/dashboard/prop-tracker")) return "prop-tracker";
  if (pathname.startsWith("/dashboard/backtest") || pathname.startsWith("/backtest")) return "backtest";
  if (pathname.startsWith("/dashboard/journal")) return "journal";
  if (pathname.startsWith("/dashboard/trades")) return "trades";
  if (pathname.startsWith("/dashboard/settings")) return "settings";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  return "unknown";
}

function buildContextFromPath(
  rawPath: string | undefined,
  rawSearchParams?: { toString(): string } | null,
  source?: AssistantPageContextPayload["source"]
): AssistantPageContextPayload {
  if (!rawPath) {
    return {
      pathname: undefined,
      surface: "unknown",
      source,
    };
  }

  let pathname = rawPath;
  let searchParams = rawSearchParams
    ? new URLSearchParams(rawSearchParams.toString())
    : new URLSearchParams();

  if (rawPath.startsWith("/")) {
    const [pathOnly, queryString] = rawPath.split("?");
    pathname = pathOnly || rawPath;
    if (queryString) {
      searchParams = new URLSearchParams(queryString);
    }
  }

  const surface = inferSurface(pathname);
  const segments = pathname.split("/").filter(Boolean);
  let backtestSessionId: string | null = searchParams.get("sessionId");
  let propAccountId: string | null = null;
  let journalEntryId: string | null = null;

  if (surface === "backtest") {
    const reviewIdx = segments.findIndex((segment) => segment === "review");
    if (reviewIdx > 0 && segments[reviewIdx - 1]) {
      backtestSessionId = backtestSessionId || segments[reviewIdx - 1];
    }
  }

  if (surface === "prop-tracker") {
    const propIdx = segments.findIndex((segment) => segment === "prop-tracker");
    const maybeId = propIdx >= 0 ? segments[propIdx + 1] : null;
    if (maybeId && maybeId !== "simulator") {
      propAccountId = maybeId;
    }
  }

  if (surface === "journal") {
    journalEntryId = searchParams.get("entryId");
  }

  return {
    pathname,
    surface,
    backtestSessionId,
    propAccountId,
    journalEntryId,
    source,
  };
}

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
