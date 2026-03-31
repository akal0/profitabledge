"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { DesktopAuthStateShell } from "@/components/auth/desktop-auth-state-shell";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { sanitizeDesktopPath } from "@/lib/desktop-social-auth";
import { getErrorMessage } from "@/lib/error-message";

const PRIMARY_BUTTON_CLASS =
  "h-max w-full rounded-sm bg-sidebar py-3 text-xs font-medium text-white shadow-none ring ring-white/10 transition-colors hover:bg-sidebar-accent hover:brightness-120 hover:text-white";

function isSupportedProvider(value: string | null): value is "google" {
  return value === "google";
}

function extractRedirectUrl(result: unknown) {
  if (!result || typeof result !== "object") {
    return null;
  }

  const candidate = result as {
    error?: unknown;
    data?: { url?: string | null } | null;
    url?: string | null;
  };

  if (candidate.error) {
    throw candidate.error;
  }

  const url = candidate.data?.url || candidate.url;
  return typeof url === "string" && url.length > 0 ? url : null;
}

export default function DesktopAuthStartPage() {
  const searchParams = useSearchParams();
  const provider = searchParams?.get("provider") ?? null;
  const targetPath = useMemo(
    () => sanitizeDesktopPath(searchParams?.get("path")),
    [searchParams]
  );
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;

    if (!isSupportedProvider(provider)) {
      setError("The requested sign-in provider is unavailable.");
      return;
    }

    const callbackUrl = new URL("/desktop/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("path", targetPath);

    const errorCallbackUrl = new URL("/desktop/auth/error", window.location.origin);
    errorCallbackUrl.searchParams.set("path", targetPath);

    void authClient.signIn
      .social({
        provider,
        callbackURL: callbackUrl.toString(),
        errorCallbackURL: errorCallbackUrl.toString(),
      })
      .then((result: unknown) => {
        const redirectUrl = extractRedirectUrl(result);
        if (redirectUrl) {
          window.location.assign(redirectUrl);
        }
      })
      .catch((caughtError: unknown) => {
        setError(
          getErrorMessage(caughtError, "We couldn't open the Google sign-in flow.")
        );
      });
  }, [provider, targetPath]);

  if (!error) {
    return (
      <DesktopAuthStateShell
        title="Continuing with Google"
        description="Your desktop sign-in is being handed off to the browser so the secure session can finish in one place."
      >
        <div className="rounded-sm bg-sidebar/90 px-6 py-5 text-center ring ring-white/10">
          <p className="text-sm leading-6 text-white/72">
            Opening Google sign-in...
          </p>
        </div>
      </DesktopAuthStateShell>
    );
  }

  return (
    <DesktopAuthStateShell
      title="We couldn't open Google sign-in"
      description="The browser handoff failed before the secure sign-in could begin."
    >
      <div className="space-y-4">
        <div className="rounded-sm bg-sidebar/90 px-6 py-5 text-center ring ring-white/10">
          <p className="text-sm leading-6 text-white/72">{error}</p>
        </div>
        <Button asChild className={PRIMARY_BUTTON_CLASS}>
          <Link href="/login">Back to Login</Link>
        </Button>
      </div>
    </DesktopAuthStateShell>
  );
}
