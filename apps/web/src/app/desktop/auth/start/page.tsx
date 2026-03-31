"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { DesktopAuthStateShell } from "@/components/auth/desktop-auth-state-shell";
import { Button } from "@/components/ui/button";
import { sanitizeDesktopPath } from "@/lib/desktop-social-auth";

const PRIMARY_BUTTON_CLASS =
  "h-max w-full rounded-sm bg-sidebar py-3 text-xs font-medium text-white shadow-none ring ring-white/10 transition-colors hover:bg-sidebar-accent hover:brightness-120 hover:text-white";

function isSupportedProvider(value: string | null): value is "google" {
  return value === "google";
}

export default function DesktopAuthStartPage() {
  const searchParams = useSearchParams();
  const provider = searchParams?.get("provider") ?? null;
  const targetPath = useMemo(
    () => sanitizeDesktopPath(searchParams?.get("path")),
    [searchParams]
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupportedProvider(provider)) {
      setError("The requested sign-in provider is unavailable.");
      return;
    }

    const beginUrl = new URL("/desktop/auth/begin", window.location.origin);
    beginUrl.searchParams.set("provider", provider);
    beginUrl.searchParams.set("path", targetPath);
    window.location.replace(beginUrl.toString());
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
