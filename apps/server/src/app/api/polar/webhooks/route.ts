import { NextRequest, NextResponse } from "next/server";
import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import { getPolarWebhookSecret } from "@/lib/billing/polar";
import { syncPolarWebhookEvent } from "@/routers/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.text();

  try {
    const event = validateEvent(
      body,
      Object.fromEntries(request.headers.entries()),
      getPolarWebhookSecret()
    );

    await syncPolarWebhookEvent(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return NextResponse.json({ error: "Invalid Polar webhook signature" }, { status: 403 });
    }

    console.error("[PolarWebhook] Failed to process event", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
