export const HELD_BACK_DASHBOARD_ROUTE_PREFIXES = [
  "/dashboard/feed",
  "/dashboard/leaderboard",
  "/dashboard/achievements",
  "/dashboard/settings/social",
] as const;

export function isHeldBackDashboardRoute(pathname: string | null | undefined) {
  if (!pathname) {
    return false;
  }

  return HELD_BACK_DASHBOARD_ROUTE_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
}
