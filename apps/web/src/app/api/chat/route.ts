import { NextRequest } from "next/server";

import { proxyToServer } from "@/lib/server-proxy";

export async function POST(request: NextRequest) {
  return proxyToServer(request, "/api/chat");
}
