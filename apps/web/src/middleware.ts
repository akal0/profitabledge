import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  buildStoredGrowthTouch,
  GROWTH_TOUCH_COOKIE,
  GROWTH_TOUCH_MAX_AGE_SECONDS,
  GROWTH_VISITOR_COOKIE,
  parseStoredGrowthTouch,
  readGrowthTouchFromSearchParams,
  serializeStoredGrowthTouch,
} from "@/features/growth/lib/growth-attribution";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  if (request.method !== "GET" && request.method !== "HEAD") {
    return response;
  }

  const existingTouch = parseStoredGrowthTouch(
    request.cookies.get(GROWTH_TOUCH_COOKIE)?.value
  );
  const visitorToken =
    request.cookies.get(GROWTH_VISITOR_COOKIE)?.value ??
    existingTouch?.visitorToken ??
    crypto.randomUUID();

  response.cookies.set(GROWTH_VISITOR_COOKIE, visitorToken, {
    path: "/",
    sameSite: "lax",
    maxAge: GROWTH_TOUCH_MAX_AGE_SECONDS,
  });

  const touch = readGrowthTouchFromSearchParams(
    request.nextUrl.searchParams,
    request.nextUrl.pathname
  );

  if (touch && !existingTouch) {
    response.cookies.set(
      GROWTH_TOUCH_COOKIE,
      serializeStoredGrowthTouch(buildStoredGrowthTouch(visitorToken, touch)),
      {
        path: "/",
        sameSite: "lax",
        maxAge: GROWTH_TOUCH_MAX_AGE_SECONDS,
      }
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.[^/]+$).*)",
  ],
};
