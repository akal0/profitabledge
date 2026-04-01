"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { useTabAttentionStore } from "@/stores/tab-attention";
import { queryClient, trpcOptions } from "@/utils/trpc";

const AWAY_TITLE = "Come back to find your profitabledge";
const BADGE_COLORS = {
  unread: "#ef4444",
  running: "#f97316",
} as const;

function buildTabIconHref(badgeColor?: string) {
  const badgeMarkup = badgeColor
    ? `<circle cx="24.5" cy="7.5" r="5.25" fill="${badgeColor}" stroke="#050505" stroke-width="1.75" />`
    : "";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="6" fill="#000"/>
      <text x="16" y="22.5" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="700" letter-spacing="-1" fill="#fff">pe.</text>
      ${badgeMarkup}
    </svg>
  `;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function getIconLinks() {
  const existing = Array.from(
    document.querySelectorAll<HTMLLinkElement>(
      "link[rel='icon'], link[rel='shortcut icon']"
    )
  );

  if (existing.length > 0) {
    return existing;
  }

  const created = document.createElement("link");
  created.rel = "icon";
  document.head.appendChild(created);
  return [created];
}

function isTauriDesktop() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function TabAttentionController() {
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const activeActivityCount = useTabAttentionStore(
    (state) => state.activeActivityCount
  );
  const realTitleRef = useRef("");
  const unreadSummaryQueryKey =
    trpcOptions.notifications.unreadSummary.queryOptions().queryKey;
  const notificationsListQueryKey = trpcOptions.notifications.list.queryOptions({
    limit: 25,
  }).queryKey;
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (isSessionPending || !session?.user?.id) {
      setUnreadCount(0);
      return;
    }

    const syncUnreadCount = () => {
      const summary = queryClient.getQueryData<{ unreadCount: number }>(
        unreadSummaryQueryKey
      );
      if (summary) {
        setUnreadCount(summary.unreadCount ?? 0);
        return;
      }

      const items = queryClient.getQueryData<Array<{ readAt: string | null }>>(
        notificationsListQueryKey
      );
      if (items) {
        setUnreadCount(items.filter((item) => !item.readAt).length);
      }
    };

    syncUnreadCount();
    return queryClient.getQueryCache().subscribe(() => {
      syncUnreadCount();
    });
  }, [
    isSessionPending,
    notificationsListQueryKey,
    session?.user?.id,
    unreadSummaryQueryKey,
  ]);

  const badgeVariant =
    activeActivityCount > 0
      ? "running"
      : unreadCount > 0
      ? "unread"
      : "idle";

  const faviconHref = useMemo(
    () =>
      buildTabIconHref(
        badgeVariant === "running"
          ? BADGE_COLORS.running
          : badgeVariant === "unread"
          ? BADGE_COLORS.unread
          : undefined
      ),
    [badgeVariant]
  );
  const isDesktop = isTauriDesktop();

  useEffect(() => {
    if (isDesktop) {
      return;
    }

    if (typeof document === "undefined") {
      return;
    }

    realTitleRef.current = document.title;

    const syncTitle = () => {
      if (document.hidden) {
        if (document.title !== AWAY_TITLE) {
          realTitleRef.current = document.title;
        }
        document.title = AWAY_TITLE;
        return;
      }

      if (realTitleRef.current) {
        document.title = realTitleRef.current;
      }
    };

    const observer = new MutationObserver(() => {
      const nextTitle = document.title;

      if (document.hidden) {
        if (nextTitle !== AWAY_TITLE) {
          realTitleRef.current = nextTitle;
          document.title = AWAY_TITLE;
        }
        return;
      }

      if (nextTitle !== AWAY_TITLE) {
        realTitleRef.current = nextTitle;
      }
    });

    observer.observe(document.head, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    syncTitle();
    document.addEventListener("visibilitychange", syncTitle);
    window.addEventListener("focus", syncTitle);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncTitle);
      window.removeEventListener("focus", syncTitle);
    };
  }, [isDesktop]);

  useEffect(() => {
    if (isDesktop) {
      return;
    }

    if (typeof document === "undefined") {
      return;
    }

    const links = getIconLinks();

    links.forEach((link) => {
      link.type = "image/svg+xml";
      link.href = faviconHref;
    });
  }, [faviconHref, isDesktop]);

  return null;
}
