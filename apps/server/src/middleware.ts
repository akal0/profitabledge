import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "");
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
