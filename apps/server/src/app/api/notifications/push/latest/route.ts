import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getLatestUnreadNotificationForUser } from "@/lib/push-web";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return NextResponse.json({ notification: null }, { status: 401 });
  }

  const latest = await getLatestUnreadNotificationForUser(session.user.id);
  return NextResponse.json({ notification: latest });
}
