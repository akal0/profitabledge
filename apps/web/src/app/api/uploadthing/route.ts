import type { NextRequest } from "next/server";
import { proxyToServer } from "@/lib/server-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return proxyToServer(request, "/api/uploadthing");
}

export async function POST(request: NextRequest) {
  return proxyToServer(request, "/api/uploadthing");
}
