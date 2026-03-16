"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { trackAlphaEvent } from "@/lib/alpha-analytics";

export function useAlphaPageTracking(surface: string, enabled = true) {
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user?.id ?? null;
  const lastTrackedPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || isPending || !pathname || !userId) {
      return;
    }

    const queryString =
      typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
    const pagePath = queryString ? `${pathname}?${queryString}` : pathname;
    if (lastTrackedPathRef.current === pagePath) {
      return;
    }

    lastTrackedPathRef.current = pagePath;
    void trackAlphaEvent({
      category: "navigation",
      name: "page.view",
      summary: pathname,
      pagePath,
      metadata: {
        surface,
      },
    });
  }, [enabled, isPending, pathname, surface, userId]);

  useEffect(() => {
    lastTrackedPathRef.current = null;
  }, [userId]);
}
