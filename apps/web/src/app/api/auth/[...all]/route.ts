import type { NextRequest } from "next/server";
import { proxyToServer } from "@/lib/server-proxy";

type Params = {
  params: Promise<{
    all: string[];
  }>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const DESKTOP_USER_AGENT_MARKER = "ProfitabledgeDesktop/1";

function normalizeOrigin(value: string | null | undefined) {
  const normalized = value?.trim().replace(/\/+$/, "") || null;
  return normalized === "null" ? null : normalized;
}

function getDesktopAuthForwarding(request: NextRequest) {
  const incomingOrigin = normalizeOrigin(request.headers.get("origin"));
  const incomingReferer = request.headers.get("referer")?.trim() || null;
  const requestUrl = new URL(request.url);
  const isDesktopRequest =
    request.headers
      .get("user-agent")
      ?.includes(DESKTOP_USER_AGENT_MARKER) === true;
  const overrides: {
    forwardOrigin?: string | null;
    forwardReferer?: string | null;
  } = {};

  if (isDesktopRequest || !incomingOrigin) {
    overrides.forwardOrigin = requestUrl.origin;
  }

  if (isDesktopRequest || !incomingReferer) {
    overrides.forwardReferer = request.url;
  }

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
