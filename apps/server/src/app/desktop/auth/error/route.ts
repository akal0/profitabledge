import {
  buildDesktopLoginDeepLink,
  renderDesktopLaunchPage,
} from "@/lib/desktop-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getErrorMessage(request: Request) {
  const requestUrl = new URL(request.url);
  const error = requestUrl.searchParams.get("error")?.trim();
  if (!error) {
    return "We couldn't finish the desktop sign-in.";
  }

  return error;
}

export async function GET(request: Request) {
  return new Response(
    renderDesktopLaunchPage({
      title: "We couldn’t finish the desktop sign-in.",
      message: getErrorMessage(request),
      actionUrl: buildDesktopLoginDeepLink(),
      actionLabel: "Back to Login",
    }),
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
