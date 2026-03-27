import { NextRequest, NextResponse } from "next/server";
import { createOAuthConnection } from "@/lib/connections/oauth";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const webUrl = process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3001";
  const settingsUrl = `${webUrl}/dashboard/settings/connections`;

  if (error || !code || !state) {
    return NextResponse.redirect(`${settingsUrl}?error=oauth_denied`);
  }

  try {
    const stateData = JSON.parse(
      Buffer.from(state, "base64url").toString()
    );
    const { userId, provider } = stateData;

    if (!userId || provider !== "tradovate") {
      return NextResponse.redirect(`${settingsUrl}?error=invalid_state`);
    }

    const { connection } = await createOAuthConnection({
      userId,
      provider: "tradovate",
      code,
      displayName: "Tradovate Account",
    });

    return NextResponse.redirect(
      `${settingsUrl}?success=connected&connectionId=${connection.id}&provider=tradovate`
    );
  } catch (err: unknown) {
    console.error("[Tradovate OAuth Callback]", err);
    return NextResponse.redirect(
      `${settingsUrl}?error=token_exchange_failed`
    );
  }
}
