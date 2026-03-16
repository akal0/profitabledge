import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const GATED_PATHS = ["/login", "/sign-up"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!GATED_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const betaAccess = request.cookies.get("beta_access")?.value;

  if (betaAccess === "verified") {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/beta";
  url.searchParams.set("redirect", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/login", "/sign-up"],
};
