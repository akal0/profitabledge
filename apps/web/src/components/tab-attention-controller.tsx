"use client";

import { useEffect, useMemo, useRef } from "react";

import { authClient } from "@/lib/auth-client";
import { useTabAttentionStore } from "@/stores/tab-attention";
import { useTRPC } from "@/utils/trpc";

const AWAY_TITLE = "Come back to find your profitable edge";
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

export function TabAttentionController() {
  const trpc = useTRPC();
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const activeActivityCount = useTabAttentionStore(
    (state) => state.activeActivityCount
  );
  const realTitleRef = useRef("");

  const { data: unreadNotifications = [] } = trpc.notifications.list.useQuery(
    { limit: 1, unreadOnly: true },
    {
      enabled: !isSessionPending && Boolean(session?.user?.id),
      refetchInterval: 60_000,
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
    }
  );

  const badgeVariant =
    activeActivityCount > 0
      ? "running"
      : unreadNotifications.length > 0
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

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const links = getIconLinks();

    links.forEach((link) => {
      link.type = "image/svg+xml";
      link.href = faviconHref;
    });
  }, [faviconHref]);

  return null;
}
