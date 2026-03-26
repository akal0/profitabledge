import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  removeWebPushSubscription,
  upsertWebPushSubscription,
} from "@/lib/push-web";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return unauthorized();
  }

  const body = (await request.json()) as {
    subscription?: {
      endpoint?: string;
      keys?: {
        p256dh?: string;
        auth?: string;
      };
    };
  };

  const endpoint = body.subscription?.endpoint?.trim();
  const p256dhKey = body.subscription?.keys?.p256dh?.trim();
  const authKey = body.subscription?.keys?.auth?.trim();

  if (!endpoint || !p256dhKey || !authKey) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await upsertWebPushSubscription({
    userId: session.user.id,
    endpoint,
    p256dhKey,
    authKey,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return unauthorized();
  }

  const body = (await request.json()) as { endpoint?: string };
  const endpoint = body.endpoint?.trim();

  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  await removeWebPushSubscription({
    userId: session.user.id,
    endpoint,
  });

  return NextResponse.json({ ok: true });
}
