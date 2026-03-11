import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getFieldCatalogItems } from "@/lib/ai/plan-generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ fields: getFieldCatalogItems() });
    }

    return NextResponse.json({
      fields: getFieldCatalogItems(),
    });
  } catch (error) {
    return NextResponse.json({
      fields: getFieldCatalogItems(),
      error: "Auth unavailable",
    });
  }
}
