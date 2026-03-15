import type { NextRequest } from "next/server";
import { proxyToServer } from "@/lib/server-proxy";

type Params = {
  params: Promise<{
    all: string[];
  }>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function proxyAuthRequest(request: NextRequest, params: Params["params"]) {
  const { all } = await params;
  return proxyToServer(request, `/api/auth/${all.join("/")}`, {
    preserveSetCookie: true,
  });
}

export async function GET(request: NextRequest, { params }: Params) {
  return proxyAuthRequest(request, params);
}

export async function POST(request: NextRequest, { params }: Params) {
  return proxyAuthRequest(request, params);
}
