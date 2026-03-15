import type { NextRequest } from "next/server";
import { proxyToServer } from "@/lib/server-proxy";

type Params = {
  params: Promise<{
    trpc: string;
  }>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function proxyTrpcRequest(request: NextRequest, params: Params["params"]) {
  const { trpc } = await params;
  return proxyToServer(request, `/trpc/${trpc}`);
}

export async function GET(request: NextRequest, { params }: Params) {
  return proxyTrpcRequest(request, params);
}

export async function POST(request: NextRequest, { params }: Params) {
  return proxyTrpcRequest(request, params);
}
