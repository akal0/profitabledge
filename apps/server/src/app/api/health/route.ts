import { NextResponse } from "next/server";

import { buildServerHealthSnapshot } from "@/lib/ops/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildServerHealthSnapshot(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
