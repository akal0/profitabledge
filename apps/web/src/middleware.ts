import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Better Auth default session cookie name (no custom config on this app)
const SESSION_COOKIE = "better-auth.session_token";

const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/assistant", "/backtest"];
const AUTH_PREFIXES = ["/login", "/sign-up"];

function isAuthed(request: NextRequest): boolean {
  // Check both plain (http/dev) and __Secure- prefixed (https/prod) variants
  return Boolean(
    request.cookies.get(SESSION_COOKIE)?.value ||
      request.cookies.get(`__Secure-${SESSION_COOKIE}`)?.value
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = isAuthed(request);

  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) && !authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (AUTH_PREFIXES.some((p) => pathname.startsWith(p)) && authed) {
    const from = request.nextUrl.searchParams.get("from");
    const url = request.nextUrl.clone();
    url.pathname =
      from && PROTECTED_PREFIXES.some((p) => from.startsWith(p))
        ? from
        : "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/assistant/:path*",
    "/backtest/:path*",
    "/login",
    "/sign-up",
  ],
};
