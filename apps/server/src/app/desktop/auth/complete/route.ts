import {
  buildDesktopDeepLink,
  renderDesktopLaunchPage,
  sanitizeDesktopAuthPath,
} from "@/lib/desktop-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const token = requestUrl.searchParams.get("token");
  const targetPath = sanitizeDesktopAuthPath(requestUrl.searchParams.get("path"));

  if (!token) {
    return Response.redirect(
      `${new URL("/desktop/auth/error", request.url).toString()}?error=The%20desktop%20sign-in%20token%20is%20missing.`,
      302
    );
  }

  const deepLink = buildDesktopDeepLink(
    `/desktop/auth/complete?${new URLSearchParams({
      token,
      path: targetPath,
    }).toString()}`
  );

  return new Response(
    renderDesktopLaunchPage({
      title: "Return to Profitabledge Desktop",
      message: "Continue the secure sign-in handoff inside the desktop app.",
      actionUrl: deepLink,
      actionLabel: "Open Desktop",
    }),
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
