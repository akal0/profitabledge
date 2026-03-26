import { NextResponse } from "next/server";

import { getWebPushPublicConfig } from "@/lib/push-web";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getWebPushPublicConfig());
}
