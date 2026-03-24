import type { RouteLoadingVariant } from "@/components/ui/route-loading-fallback";
import { isHeldBackDashboardRoute } from "@/features/navigation/lib/held-back-routes";

export function resolveRouteLoadingVariant(pathname: string): RouteLoadingVariant {
  if (pathname.startsWith("/assistant")) return "assistant";
  if (pathname.startsWith("/dashboard/edges")) return "edges";
  if (pathname.startsWith("/dashboard/trades")) return "trades";
  if (pathname.startsWith("/dashboard/journal")) return "journal";
  if (pathname.startsWith("/dashboard/goals")) return "goals";
  if (pathname.startsWith("/dashboard/reports")) return "reports";
  if (pathname.startsWith("/dashboard/prop-tracker")) return "propTracker";
  if (pathname.startsWith("/dashboard/feed")) return "feed";
  if (pathname.startsWith("/dashboard/affiliate")) return "affiliate";
  if (pathname.startsWith("/dashboard/leaderboard")) return "leaderboard";
  if (pathname.startsWith("/dashboard/referrals")) return "referrals";
  if (pathname.startsWith("/dashboard/achievements")) return "achievements";
  if (pathname.startsWith("/dashboard/growth-admin")) return "growthAdmin";
  if (pathname.startsWith("/dashboard/growth")) return "growth";
  if (
    pathname.startsWith("/dashboard/calendar") ||
    pathname.startsWith("/dashboard/news")
  ) {
    return "economicCalendar";
  }
  if (pathname.startsWith("/dashboard/settings/alerts")) return "settingsAlerts";
  if (pathname.startsWith("/dashboard/settings/api")) return "settingsApi";
  if (pathname.startsWith("/dashboard/settings/ai")) return "settingsAi";
  if (pathname.startsWith("/dashboard/settings/billing")) return "settingsBilling";
  if (pathname.startsWith("/dashboard/settings/broker")) return "settingsBroker";
  if (pathname.startsWith("/dashboard/settings/compliance")) return "settingsCompliance";
  if (pathname.startsWith("/dashboard/settings/connections")) return "settingsConnections";
  if (pathname.startsWith("/dashboard/settings/ea-setup")) return "settingsEaSetup";
  if (pathname.startsWith("/dashboard/settings/edges")) return "settingsEdges";
  if (pathname.startsWith("/dashboard/settings/metrics")) return "settingsMetrics";
  if (pathname.startsWith("/dashboard/settings/notifications")) return "settingsNotifications";
  if (pathname.startsWith("/dashboard/settings/risk")) return "settingsRisk";
  if (pathname.startsWith("/dashboard/settings/rules")) return "settingsRules";
  if (pathname.startsWith("/dashboard/settings/sessions")) return "settingsSessions";
  if (pathname.startsWith("/dashboard/settings/social")) return "settingsSocial";
  if (pathname.startsWith("/dashboard/settings/support")) return "settingsSupport";
  if (pathname.startsWith("/dashboard/settings/symbol-mapping")) return "settingsSymbolMapping";
  if (pathname.startsWith("/dashboard/settings/tags")) return "settingsTags";
  if (pathname.startsWith("/dashboard/settings/timezone")) return "settingsTimezone";
  if (pathname.startsWith("/dashboard/settings")) return "settings";
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
    pathname.startsWith("/dashboard/edges") ||
    pathname.startsWith("/dashboard/trades") ||
    pathname.startsWith("/dashboard/journal") ||
    pathname.startsWith("/dashboard/goals") ||
    pathname.startsWith("/dashboard/prop-tracker") ||
    pathname.startsWith("/dashboard/calendar") ||
    pathname.startsWith("/dashboard/news") ||
    pathname.startsWith("/dashboard/settings/alerts") ||
    pathname.startsWith("/dashboard/settings/billing") ||
    pathname.startsWith("/dashboard/settings/broker") ||
    pathname.startsWith("/dashboard/settings/edges") ||
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
