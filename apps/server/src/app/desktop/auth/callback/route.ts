import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  buildDesktopDeepLink,
  renderDesktopLaunchPage,
  sanitizeDesktopAuthPath,
} from "@/lib/desktop-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildErrorRedirect(requestUrl: string, path: string, error: string) {
  const url = new URL("/desktop/auth/error", requestUrl);
  url.searchParams.set("path", path);
  url.searchParams.set("error", error);
  return url.toString();
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const targetPath = sanitizeDesktopAuthPath(requestUrl.searchParams.get("path"));
  const requestHeaders = await headers();

  try {
    const session = await auth.api.getSession({
      headers: requestHeaders,
    });

    if (!session?.user?.id) {
      return Response.redirect(
        buildErrorRedirect(
          request.url,
          targetPath,
          "We couldn't confirm your browser session."
        ),
        302
      );
    }

    const tokenResponse = await fetch(
      new URL("/api/auth/one-time-token/generate", request.url),
      {
        cache: "no-store",
        headers: {
          cookie: requestHeaders.get("cookie") ?? "",
        },
      }
    );

    const result = (await tokenResponse.json().catch(() => null)) as
      | { token?: string | null }
      | null;

    if (!tokenResponse.ok || !result?.token) {
      return Response.redirect(
        buildErrorRedirect(
          request.url,
          targetPath,
          "We couldn't create a secure desktop sign-in token."
        ),
        302
      );
    }

    const completePath = `/desktop/auth/complete?${new URLSearchParams({
      token: result.token,
      path: targetPath,
    }).toString()}`;
    const deepLink = buildDesktopDeepLink(completePath, request.url);

    return new Response(
      renderDesktopLaunchPage({
        title: "Opening Profitabledge…",
        message: "Finishing your browser sign-in and returning to the desktop app.",
        actionUrl: deepLink,
        actionLabel: "Open Profitabledge",
      }),
      {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "We couldn't finish the desktop handoff.";
    return Response.redirect(
      buildErrorRedirect(request.url, targetPath, message),
      302
    );
  }
}
