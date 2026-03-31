"use client";

import { resolvePostAuthPath } from "@/lib/post-auth-paths";
import { normalizeOriginUrl } from "@profitabledge/platform/origin-utils";

type SocialProvider = "google";

const DEFAULT_DESKTOP_AUTH_PATH = "/dashboard";
const DESKTOP_USER_AGENT_MARKER = "ProfitabledgeDesktop/1";
const DESKTOP_OPEN_EXTERNAL_EVENT = "profitabledge:open-external-url";
const DESKTOP_BRIDGE_READY_FLAG = "__PE_DESKTOP_BRIDGE_READY";
const DEFAULT_DESKTOP_BROWSER_AUTH_ORIGIN =
  "https://beta.profitabledge.com";
const LOCAL_DESKTOP_PROXY_ORIGINS = new Set([
  "http://localhost:3310",
  "http://127.0.0.1:3310",
]);

function inferDesktopBrowserAuthOrigin(serverOrigin: string | null) {
  if (!serverOrigin) {
    return null;
  }

  try {
    const url = new URL(serverOrigin);

    if (
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      url.port === "3000"
    ) {
      url.port = "3001";
      return url.origin;
    }

    if (url.hostname === "api.profitabledge.com") {
      url.hostname = "beta.profitabledge.com";
      return url.origin;
    }

    if (url.hostname === "www.api.profitabledge.com") {
      url.hostname = "beta.profitabledge.com";
      return url.origin;
    }
  } catch {
    // Use the explicit browser auth origin fallback below.
  }

  return null;
}

function resolveConfiguredDesktopBrowserAuthOrigin() {
  const configuredWebOrigin = normalizeOriginUrl(process.env.NEXT_PUBLIC_WEB_URL);
  if (configuredWebOrigin) {
    return configuredWebOrigin;
  }

  const configuredServerOrigin = normalizeOriginUrl(
    process.env.NEXT_PUBLIC_SERVER_URL
  );

  return (
    inferDesktopBrowserAuthOrigin(configuredServerOrigin ?? null) ||
    DEFAULT_DESKTOP_BROWSER_AUTH_ORIGIN
  );
}

function isTauriDesktop() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function isDesktopUserAgent() {
  return (
    typeof navigator !== "undefined" &&
    navigator.userAgent.includes(DESKTOP_USER_AGENT_MARKER)
  );
}

function isDesktopAuthContext() {
  return isTauriDesktop() || isDesktopUserAgent();
}

async function resolveDesktopBrowserAuthOrigin() {
  const envBrowserAuthOrigin = resolveConfiguredDesktopBrowserAuthOrigin();

  if (typeof window === "undefined") {
    return envBrowserAuthOrigin;
  }

  const currentOriginNormalized = normalizeOriginUrl(window.location.origin);
  const currentOrigin = currentOriginNormalized || window.location.origin;
  if (!LOCAL_DESKTOP_PROXY_ORIGINS.has(currentOrigin)) {
    return currentOrigin;
  }

  try {
    const response = await fetch("/desktop/internal/auth-origin", {
      cache: "no-store",
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error(`Desktop auth origin lookup failed with ${response.status}`);
    }
    const data = (await response.json()) as {
      browserAuthOrigin?: string | null;
    };
    const browserAuthOrigin = normalizeOriginUrl(
      data.browserAuthOrigin ?? undefined
    );
    if (browserAuthOrigin) {
      return browserAuthOrigin;
    }
  } catch {
    // Fall back to the configured browser auth origin if the desktop proxy
    // config endpoint is unavailable.
  }

  return envBrowserAuthOrigin;
}

function extractErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  if (error && typeof error === "object") {
    const candidate = error as {
      error?: { message?: string | null } | null;
      message?: string | null;
    };
    if (candidate.error?.message) {
      return candidate.error.message;
    }
    if (candidate.message) {
      return candidate.message;
    }
  }

  return fallback;
}

export function sanitizeDesktopPath(path: string | null | undefined) {
  if (!path) {
    return DEFAULT_DESKTOP_AUTH_PATH;
  }

  return resolvePostAuthPath(path) || DEFAULT_DESKTOP_AUTH_PATH;
}

function extractOneTimeToken(result: unknown) {
  if (!result || typeof result !== "object") {
    return null;
  }

  const candidate = result as {
    token?: string | null;
  };

  const token = candidate.token;
  return typeof token === "string" && token.length > 0 ? token : null;
}

export function buildDesktopDeepLink(path: string) {
  const params = new URLSearchParams({ path: sanitizeDesktopPath(path) });
  return `profitabledge://open?${params.toString()}`;
}

function requestDesktopExternalUrl(url: string) {
  if (typeof window === "undefined") {
    return false;
  }

  const bridgeReady = Boolean(
    (
      window as Window & {
        [DESKTOP_BRIDGE_READY_FLAG]?: boolean;
      }
    )[DESKTOP_BRIDGE_READY_FLAG]
  );

  if (!bridgeReady) {
    return false;
  }

  window.dispatchEvent(
    new CustomEvent(DESKTOP_OPEN_EXTERNAL_EVENT, {
      detail: { url },
    })
  );
  return true;
}

async function openDesktopExternalUrl(url: string) {
  if (isTauriDesktop()) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      return true;
    } catch {
      // Fall through to the desktop-shell bridge if the direct opener bridge
      // is unavailable in this webview context.
    }
  }

  if (requestDesktopExternalUrl(url)) {
    return true;
  }

  if (typeof window !== "undefined") {
    if (isTauriDesktop()) {
      return false;
    }

    window.location.assign(url);
    return true;
  }

  return false;
}

async function readAuthResponse<T>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, fallbackMessage));
  }

  return data;
}

export async function generateDesktopOneTimeToken() {
  const response = await fetch("/api/auth/one-time-token/generate", {
    cache: "no-store",
    credentials: "include",
  });
  const data = await readAuthResponse<{ token?: string | null }>(
    response,
    "We couldn't create a secure desktop sign-in token."
  );
  const token = extractOneTimeToken(data);
  if (!token) {
    throw new Error("We couldn't create a secure desktop sign-in token.");
  }
  return token;
}

export async function verifyDesktopOneTimeToken(token: string) {
  const response = await fetch("/api/auth/one-time-token/verify", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ token }),
  });

  await readAuthResponse(
    response,
    "We couldn't complete the desktop sign-in."
  );
}

export async function startDesktopSocialAuth(options: {
  provider: SocialProvider;
  path: string;
}) {
  if (!isDesktopAuthContext() || typeof window === "undefined") {
    return false;
  }

  const authOrigin = await resolveDesktopBrowserAuthOrigin();
  const beginUrl = new URL("/desktop/auth/begin", authOrigin);
  beginUrl.searchParams.set("provider", options.provider);
  beginUrl.searchParams.set("path", sanitizeDesktopPath(options.path));

  const opened = await openDesktopExternalUrl(beginUrl.toString());
  if (!opened) {
    throw new Error("We couldn't open the browser sign-in flow.");
  }

  return true;
}
