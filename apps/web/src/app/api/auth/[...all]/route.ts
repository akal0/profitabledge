import type { NextRequest } from "next/server";
import { proxyToServer } from "@/lib/server-proxy";

type Params = {
  params: Promise<{
    all: string[];
  }>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getDesktopAuthForwarding(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const overrides: {
    forwardOrigin?: string | null;
    forwardReferer?: string | null;
  } = {};

  overrides.forwardOrigin = requestUrl.origin;
  overrides.forwardReferer = request.url;

  return overrides;
}

async function proxyAuthRequest(request: NextRequest, params: Params["params"]) {
  const { all } = await params;
  return proxyToServer(request, `/api/auth/${all.join("/")}`, {
    preserveSetCookie: true,
    forwardAbortSignal: false,
    ...getDesktopAuthForwarding(request),
  });
}

export async function GET(request: NextRequest, { params }: Params) {
  return proxyAuthRequest(request, params);
}

export async function POST(request: NextRequest, { params }: Params) {
  return proxyAuthRequest(request, params);
}
