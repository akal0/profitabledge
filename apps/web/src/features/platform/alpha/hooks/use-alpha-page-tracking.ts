"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { trackAlphaEvent } from "@/lib/alpha-analytics";

export function useAlphaPageTracking(surface: string) {
  const pathname = usePathname();
  const lastTrackedPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) {
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
  }, [pathname, surface]);
}
