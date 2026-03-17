"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  hasPrefetchedDashboardWorkspace,
  prefetchDashboardWorkspace,
  syncPrefetchedDashboardWorkspace,
} from "@/features/dashboard/home/lib/dashboard-workspace-preload";

export function useDashboardWorkspaceReady() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspacePath = useMemo(() => {
    const safePathname = pathname ?? "/dashboard";
    const query = searchParams?.toString() ?? "";

    return query ? `${safePathname}?${query}` : safePathname;
  }, [pathname, searchParams]);
  const hasWarmCache = useMemo(
    () => hasPrefetchedDashboardWorkspace(workspacePath),
    [workspacePath]
  );
  const [isReady, setIsReady] = useState(hasWarmCache);

  useEffect(() => {
    if (hasWarmCache) {
      syncPrefetchedDashboardWorkspace(workspacePath);
      setIsReady(true);
      return;
    }

    let cancelled = false;

    setIsReady(false);

    void prefetchDashboardWorkspace(workspacePath)
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setIsReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasWarmCache, workspacePath]);

  return hasWarmCache || isReady;
}
