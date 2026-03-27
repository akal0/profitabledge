import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getRecentUnreadNotificationsForUser } from "@/lib/push-web";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return NextResponse.json(
      { notification: null, notifications: [], unreadCount: 0 },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? "1");
  const { notifications, unreadCount } = await getRecentUnreadNotificationsForUser(
    session.user.id,
    Number.isFinite(requestedLimit) ? requestedLimit : 1
  );

  return NextResponse.json({
    notification: notifications[0] ?? null,
    notifications,
    unreadCount,
  });
}
