import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Credentials", "true");
  // Comma-separated list of allowed origins; reflect request origin if present
  const originList =
    process.env.CORS_ORIGIN ||
    "http://localhost:3001,http://192.168.1.173:3001";
  const allowed = originList
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const reqOrigin = req.headers.get("origin") || "";
  const isDev = process.env.NODE_ENV !== "production";
  // In dev, reflect any origin to simplify LAN testing; otherwise require allowlist match
  const allow =
    reqOrigin && (isDev || allowed.includes(reqOrigin))
      ? reqOrigin
      : allowed[0] || "*";
  headers.set("Access-Control-Allow-Origin", allow);
  headers.set("Vary", "Origin");
  headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS,PUT,PATCH,DELETE"
  );

  // Reflect requested headers (covers x-uploadthing-* and others)
  const requested = req.headers.get("Access-Control-Request-Headers");
  headers.set(
    "Access-Control-Allow-Headers",
    requested ||
      "Content-Type, Authorization, X-Uploadthing-Package, X-Uploadthing-Version, X-Requested-With"
  );

  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }

  const res = NextResponse.next();
  headers.forEach((value, key) => res.headers.set(key, value));
  return res;
}

export const config = {
  matcher: "/:path*",
};
