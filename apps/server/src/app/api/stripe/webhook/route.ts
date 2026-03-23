import { NextRequest, NextResponse } from "next/server";

import { getStripeClient, getStripeWebhookSecret } from "@/lib/billing/stripe";
import { syncStripeWebhookEvent } from "@/routers/billing";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 }
    );
  }

  const payload = await req.text();

  try {
    const event = getStripeClient().webhooks.constructEvent(
      payload,
      signature,
      getStripeWebhookSecret()
    );

    await syncStripeWebhookEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stripe webhook failed";
    console.error("[stripe-webhook]", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
