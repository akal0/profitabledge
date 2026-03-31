import { NextResponse } from "next/server";
import { normalizeOriginUrl } from "@profitabledge/platform/origin-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_POST_AUTH_PATH = "/dashboard";
const DEFAULT_LOCAL_SERVER_ORIGIN = "http://localhost:3000";
const DEFAULT_PRODUCTION_SERVER_ORIGIN = "https://www.api.profitabledge.com";
const AUTH_ROUTE_PREFIXES = ["/login", "/sign-up", "/beta", "/continue"] as const;

function resolveServerOrigin() {
  return (
    normalizeOriginUrl(process.env.NEXT_PUBLIC_SERVER_URL) ||
    normalizeOriginUrl(process.env.SERVER_URL) ||
    normalizeOriginUrl(process.env.BETTER_AUTH_URL) ||
    (process.env.NODE_ENV === "production"
      ? DEFAULT_PRODUCTION_SERVER_ORIGIN
      : DEFAULT_LOCAL_SERVER_ORIGIN)
  );
}

function matchesPathPrefix(path: string, prefix: string) {
  return (
    path === prefix ||
    path.startsWith(`${prefix}?`) ||
    path.startsWith(`${prefix}/`)
  );
}

function sanitizeDesktopPath(path: string | null) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return DEFAULT_POST_AUTH_PATH;
  }

  return AUTH_ROUTE_PREFIXES.some((prefix) => matchesPathPrefix(path, prefix))
    ? DEFAULT_POST_AUTH_PATH
    : path;
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const candidate = payload as {
    error?: { message?: string | null } | null;
    message?: string | null;
  };

  if (candidate.error?.message) {
    return candidate.error.message;
  }

  if (candidate.message) {
    return candidate.message;
  }

  return fallback;
}

function parseJsonSafely(text: string) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function appendSetCookieHeaders(source: Response, target: Headers) {
  const responseHeaders = source.headers as Headers & {
    getSetCookie?: () => string[];
    raw?: () => Record<string, string[]>;
  };

  if (typeof responseHeaders.getSetCookie === "function") {
    for (const cookie of responseHeaders.getSetCookie()) {
      target.append("set-cookie", cookie);
    }
    return;
  }

  if (typeof responseHeaders.raw === "function") {
    const raw = responseHeaders.raw();
    for (const cookie of raw["set-cookie"] || []) {
      target.append("set-cookie", cookie);
    }
    return;
  }

  const fallbackCookie = source.headers.get("set-cookie");
  if (fallbackCookie) {
    target.append("set-cookie", fallbackCookie);
  }
}

function buildErrorRedirect(
  requestUrl: URL,
  targetPath: string,
  error: string
) {
  const errorUrl = new URL("/desktop/auth/error", requestUrl.origin);
  errorUrl.searchParams.set("path", targetPath);
  errorUrl.searchParams.set("error", error);
  return NextResponse.redirect(errorUrl);
}

function isSupportedProvider(value: string | null): value is "google" {
  return value === "google";
}

function extractRedirectUrl(source: Response, payload: unknown) {
  const locationHeader = source.headers.get("location")?.trim();
  if (locationHeader) {
    return locationHeader;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as {
    data?: { url?: string | null } | null;
    url?: string | null;
  };

  const redirectUrl = candidate.data?.url || candidate.url;
  return typeof redirectUrl === "string" && redirectUrl.length > 0
    ? redirectUrl
    : null;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const provider = requestUrl.searchParams.get("provider");
  const targetPath = sanitizeDesktopPath(requestUrl.searchParams.get("path"));

  if (!isSupportedProvider(provider)) {
    return buildErrorRedirect(
      requestUrl,
      targetPath,
      "The requested sign-in provider is unavailable."
    );
  }

  const callbackUrl = new URL("/desktop/auth/callback", requestUrl.origin);
  callbackUrl.searchParams.set("path", targetPath);

  const errorCallbackUrl = new URL("/desktop/auth/error", requestUrl.origin);
  errorCallbackUrl.searchParams.set("path", targetPath);

  let upstreamResponse: Response;
  let payload: unknown = null;

  try {
    upstreamResponse = await fetch(
      `${resolveServerOrigin()}/api/auth/sign-in/social`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: requestUrl.origin,
          referer: request.url,
          cookie: request.headers.get("cookie") || "",
        },
        body: JSON.stringify({
          provider,
          callbackURL: callbackUrl.toString(),
          errorCallbackURL: errorCallbackUrl.toString(),
        }),
        redirect: "manual",
        cache: "no-store",
      }
    );

    const text = await upstreamResponse.text();
    payload = parseJsonSafely(text);
  } catch (error) {
    return buildErrorRedirect(
      requestUrl,
      targetPath,
      error instanceof Error && error.message
        ? error.message
        : "We couldn't start the browser sign-in flow."
    );
  }

  const redirectUrl = extractRedirectUrl(upstreamResponse, payload);
  if (!redirectUrl) {
    return buildErrorRedirect(
      requestUrl,
      targetPath,
      extractErrorMessage(
        payload,
        "We couldn't start the browser sign-in flow."
      )
    );
  }

  const response = NextResponse.redirect(redirectUrl);
  appendSetCookieHeaders(upstreamResponse, response.headers);
  response.headers.set("cache-control", "no-store");
  return response;
}
