import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { normalizeOriginUrl } from "@profitabledge/platform";

const SERVER_URL =
  normalizeOriginUrl(process.env.NEXT_PUBLIC_SERVER_URL) ||
  "http://localhost:3000";

function resolveActivePlanKey(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const result = (payload as Record<string, unknown>).result;
  if (!result || typeof result !== "object") {
    return null;
  }

  const data = (result as Record<string, unknown>).data;
  if (!data || typeof data !== "object") {
    return null;
  }

  const directBilling = (data as Record<string, unknown>).billing;
  if (directBilling && typeof directBilling === "object") {
    return (
      (directBilling as Record<string, unknown>).activePlanKey as string | null
    );
  }

  const jsonBilling = (data as Record<string, unknown>).json;
  if (jsonBilling && typeof jsonBilling === "object") {
    const billing = (jsonBilling as Record<string, unknown>).billing;
    if (billing && typeof billing === "object") {
      return (billing as Record<string, unknown>).activePlanKey as string | null;
    }
  }

  return null;
}

async function requireEaSyncPlan(request: NextRequest) {
  const cookie = request.headers.get("cookie");

  if (!cookie) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const response = await fetch(`${SERVER_URL}/trpc/billing.getState`, {
    headers: {
      cookie,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Unable to verify EA plan access" },
      { status: response.status }
    );
  }

  const activePlanKey = resolveActivePlanKey(await response.json());
  if (activePlanKey !== "professional" && activePlanKey !== "institutional") {
    return NextResponse.json(
      { error: "Upgrade your plan to Trader or Elite to use EA sync" },
      { status: 403 }
    );
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const accessError = await requireEaSyncPlan(request);
    if (accessError) {
      return accessError;
    }

    // Path to EA file (relative to project root)
    const eaPath = path.join(
      process.cwd(),
      "../../EA/profitabledge_data_bridge.mq5"
    );

    // Check if file exists
    if (!fs.existsSync(eaPath)) {
      return NextResponse.json({ error: "EA file not found" }, { status: 404 });
    }

    // Read file content
    const content = fs.readFileSync(eaPath, "utf-8");

    // Return file as download
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="profitabledge_data_bridge.mq5"',
      },
    });
  } catch (error: any) {
    console.error("Error serving EA file:", error);
    return NextResponse.json(
      { error: "Failed to download EA file", details: error.message },
      { status: 500 }
    );
  }
}
