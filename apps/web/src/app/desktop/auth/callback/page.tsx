"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { DesktopAuthStateShell } from "@/components/auth/desktop-auth-state-shell";
import { Button } from "@/components/ui/button";
import {
  buildDesktopDeepLink,
  generateDesktopOneTimeToken,
  sanitizeDesktopPath,
} from "@/lib/desktop-social-auth";
import {
  CHECKOUT_SESSION_CONFIRM_RETRY_DELAYS_MS,
  waitForConfirmedSession,
} from "@/lib/session-confirmation";

const PRIMARY_BUTTON_CLASS =
  "h-max w-full rounded-sm bg-sidebar py-3 text-xs font-medium text-white shadow-none ring ring-white/10 transition-colors hover:bg-sidebar-accent hover:brightness-120 hover:text-white";

export default function DesktopAuthCallbackPage() {
  const searchParams = useSearchParams();
  const targetPath = useMemo(
    () => sanitizeDesktopPath(searchParams?.get("path")),
    [searchParams]
  );
  const [error, setError] = useState<string | null>(null);
  const [deepLinkUrl, setDeepLinkUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const confirmed = await waitForConfirmedSession(
        CHECKOUT_SESSION_CONFIRM_RETRY_DELAYS_MS
      );
      if (!confirmed) {
        throw new Error("We couldn't confirm your browser session.");
      }

      const token = await generateDesktopOneTimeToken();

      const completeParams = new URLSearchParams({
        token,
        path: targetPath,
      });
      const nextDeepLink = buildDesktopDeepLink(
        `/desktop/auth/complete?${completeParams.toString()}`
      );

      if (cancelled) {
        return;
      }

      setDeepLinkUrl(nextDeepLink);
      window.location.replace(nextDeepLink);
    })().catch((caughtError) => {
      if (cancelled) {
        return;
      }

      setError(
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : "We couldn't finish the desktop handoff."
      );
    });

    return () => {
      cancelled = true;
    };
  }, [targetPath]);

  if (!error) {
    return (
      <DesktopAuthStateShell
        title="Opening Profitabledge Desktop"
        description="Your browser session is confirmed. We're handing the secure session back to the desktop app now."
      >
        <div className="space-y-4">
          <div className="rounded-sm bg-sidebar/90 px-6 py-5 text-center ring ring-white/10">
            <p className="text-sm leading-6 text-white/72">
              Finishing the desktop handoff...
            </p>
          </div>
          {deepLinkUrl ? (
            <Button
              onClick={() => window.location.replace(deepLinkUrl)}
              className={PRIMARY_BUTTON_CLASS}
            >
              Open Desktop
            </Button>
          ) : null}
        </div>
      </DesktopAuthStateShell>
    );
  }

  return (
    <DesktopAuthStateShell
      title="We couldn't open Profitabledge Desktop"
      description="Your browser sign-in completed, but the secure handoff back to the desktop app did not."
    >
      <div className="space-y-4">
        <div className="rounded-sm bg-sidebar/90 px-6 py-5 text-center ring ring-white/10">
          <p className="text-sm leading-6 text-white/72">{error}</p>
        </div>
        {deepLinkUrl ? (
          <Button
            onClick={() => window.location.replace(deepLinkUrl)}
            className={PRIMARY_BUTTON_CLASS}
          >
            Open Desktop
          </Button>
        ) : null}
      </div>
    </DesktopAuthStateShell>
  );
}
