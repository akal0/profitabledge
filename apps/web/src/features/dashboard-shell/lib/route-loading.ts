import type { RouteLoadingVariant } from "@/components/ui/route-loading-fallback";
import { isHeldBackDashboardRoute } from "@/features/navigation/lib/held-back-routes";

export function resolveRouteLoadingVariant(pathname: string): RouteLoadingVariant {
  if (pathname.startsWith("/assistant")) return "assistant";
  if (pathname.startsWith("/dashboard/trades")) return "trades";
  if (pathname.startsWith("/dashboard/journal")) return "journal";
  if (pathname.startsWith("/dashboard/goals")) return "goals";
  if (pathname.startsWith("/dashboard/psychology")) return "psychology";
  if (pathname.startsWith("/dashboard/prop-tracker")) return "propTracker";
  if (pathname.startsWith("/dashboard/backtest")) return "backtest";
  if (pathname.startsWith("/dashboard/news")) return "economicCalendar";
  if (pathname.startsWith("/dashboard/settings/alerts")) return "settingsAlerts";
  if (pathname.startsWith("/dashboard/settings/billing")) return "settingsBilling";
  if (pathname.startsWith("/dashboard/settings/broker")) return "settingsBroker";
  if (pathname.startsWith("/dashboard/settings/connections")) return "settingsConnections";
  if (pathname.startsWith("/dashboard/settings/rules")) return "settingsRules";
  if (pathname.startsWith("/dashboard/settings/tags")) return "settingsTags";
  if (pathname.startsWith("/dashboard/settings")) return "settingsProfile";
  if (pathname.startsWith("/dashboard")) return "dashboard";

  return "dashboard";
}

export function isAccountScopedRoute(pathname: string): boolean {
  if (isHeldBackDashboardRoute(pathname)) {
    return false;
  }

  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/assistant") ||
    pathname.startsWith("/dashboard/trades") ||
    pathname.startsWith("/dashboard/journal") ||
    pathname.startsWith("/dashboard/goals") ||
    pathname.startsWith("/dashboard/psychology") ||
    pathname.startsWith("/dashboard/prop-tracker") ||
    pathname.startsWith("/dashboard/backtest") ||
    pathname.startsWith("/dashboard/news") ||
    pathname.startsWith("/dashboard/settings/alerts") ||
    pathname.startsWith("/dashboard/settings/billing") ||
    pathname.startsWith("/dashboard/settings/broker") ||
    pathname.startsWith("/dashboard/settings/connections") ||
    pathname.startsWith("/dashboard/settings/rules") ||
    pathname.startsWith("/dashboard/settings/tags")
  );
}

export function queryKeyIncludesAccountId(
  value: unknown,
  accountId: string | undefined
): boolean {
  if (!accountId) {
    return false;
  }

  if (value === accountId) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((item) => queryKeyIncludesAccountId(item, accountId));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((item) =>
      queryKeyIncludesAccountId(item, accountId)
    );
  }

  return false;
}
