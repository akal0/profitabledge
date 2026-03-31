import { inferTabKindFromPath, type DesktopTabKind } from "./desktop-types";

export interface ParsedDesktopDeepLink {
  path: string;
  accountId: string | null;
  kind: DesktopTabKind;
}

function sanitizePath(path: string | null | undefined) {
  if (!path || !path.startsWith("/")) {
    return null;
  }

  return path;
}

function toRouteHref(url: URL) {
  return `${url.pathname}${url.search}${url.hash}`;
}

function toPathRoute(action: string, url: URL) {
  if (action === "assistant") {
    return `/assistant${url.search}${url.hash}`;
  }

  if (action === "reports") {
    return `/dashboard/reports${url.search}${url.hash}`;
  }

  return `/${action}${url.search}${url.hash}`;
}

export function parseDesktopDeepLink(
  rawUrl: string
): ParsedDesktopDeepLink | null {
  try {
    const url = new URL(rawUrl);
    const explicitPath = sanitizePath(url.searchParams.get("path"));
    if (explicitPath) {
      return {
        path: explicitPath,
        accountId: url.searchParams.get("accountId"),
        kind: inferTabKindFromPath(explicitPath),
      };
    }

    const action = url.hostname;
    if (action === "assistant") {
      const path = toPathRoute(action, url);
      return {
        path,
        accountId: url.searchParams.get("accountId"),
        kind: inferTabKindFromPath(path),
      };
    }

    if (action === "reports") {
      const path = toPathRoute(action, url);
      return {
        path,
        accountId: url.searchParams.get("accountId"),
        kind: inferTabKindFromPath(path),
      };
    }

    const fallbackPath = sanitizePath(toRouteHref(url));
    if (!fallbackPath) {
      return null;
    }

    return {
      path: fallbackPath,
      accountId: url.searchParams.get("accountId"),
      kind: inferTabKindFromPath(fallbackPath),
    };
  } catch {
    return null;
  }
}
