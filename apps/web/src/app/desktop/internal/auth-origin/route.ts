import { NextResponse } from "next/server";
import { normalizeOriginUrl } from "@profitabledge/platform/origin-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PRODUCTION_BROWSER_AUTH_ORIGIN =
  "https://www.profitabledge.com";
const DEFAULT_LOCAL_BROWSER_AUTH_ORIGIN = "http://localhost:3001";

function resolveBrowserAuthOrigin() {
  return (
    normalizeOriginUrl(process.env.NEXT_PUBLIC_WEB_URL) ||
    (process.env.NODE_ENV === "production"
      ? DEFAULT_PRODUCTION_BROWSER_AUTH_ORIGIN
      : DEFAULT_LOCAL_BROWSER_AUTH_ORIGIN)
  );
}

export async function GET() {
  return NextResponse.json(
    {
      browserAuthOrigin: resolveBrowserAuthOrigin(),
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}
