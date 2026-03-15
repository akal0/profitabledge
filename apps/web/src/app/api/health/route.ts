import { NextResponse } from "next/server";

import { buildWebHealthSnapshot } from "@/lib/web-health";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildWebHealthSnapshot(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
