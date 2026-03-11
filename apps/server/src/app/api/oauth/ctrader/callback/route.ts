/**
 * cTrader OAuth callback route.
 * Handles redirect after user authorizes the app on cTrader.
 * Exchanges code for tokens, stores encrypted, redirects to settings.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { platformConnection } from "@/db/schema/connections";
import { resolveUniqueConnectionDisplayName } from "@/lib/connections/display-name";
import { encryptCredentials } from "@/lib/providers/credential-cipher";
import { CTraderProvider } from "@/lib/providers/ctrader";

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

    if (!userId || provider !== "ctrader") {
      return NextResponse.redirect(`${settingsUrl}?error=invalid_state`);
    }

    // Exchange authorization code for tokens
    const ctrader = new CTraderProvider();
    const credentials = await ctrader.exchangeCode(
      code,
      process.env.CTRADER_REDIRECT_URI!
    );

    // Encrypt and store
    const { encrypted, iv } = encryptCredentials(
      JSON.stringify(credentials)
    );
    const expiresAt = credentials.expiresAt
      ? new Date(credentials.expiresAt)
      : null;
    const displayName = await resolveUniqueConnectionDisplayName({
      userId,
      provider: "ctrader",
      displayName: "cTrader Account",
    });

    const [conn] = await db
      .insert(platformConnection)
      .values({
        userId,
        provider: "ctrader",
        displayName,
        encryptedCredentials: encrypted,
        credentialIv: iv,
        tokenExpiresAt: expiresAt,
        status: "active",
      })
      .returning();

    return NextResponse.redirect(
      `${settingsUrl}?success=connected&connectionId=${conn.id}`
    );
  } catch (err: unknown) {
    console.error("[cTrader OAuth Callback]", err);
    return NextResponse.redirect(
      `${settingsUrl}?error=token_exchange_failed`
    );
  }
}
