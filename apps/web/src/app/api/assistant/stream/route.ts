import { NextRequest } from "next/server";

import { proxyToServer } from "@/lib/server-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return proxyToServer(request, "/api/assistant/stream");
}
