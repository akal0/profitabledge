"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { DesktopAuthStateShell } from "@/components/auth/desktop-auth-state-shell";
import { Button } from "@/components/ui/button";

const PRIMARY_BUTTON_CLASS =
  "h-max w-full rounded-sm bg-sidebar py-3 text-xs font-medium text-white shadow-none ring ring-white/10 transition-colors hover:bg-sidebar-accent hover:brightness-120 hover:text-white";

function getErrorMessage(error: string | null) {
  const value = error?.trim();
  if (!value) {
    return "We couldn't finish the desktop sign-in.";
  }

  return value;
}

export default function DesktopAuthErrorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = useMemo(
    () => getErrorMessage(searchParams?.get("error") ?? null),
    [searchParams]
  );

  return (
    <DesktopAuthStateShell
      title="We couldn't finish your Google sign-in"
      description="The secure browser flow stopped before the desktop handoff could complete."
    >
      <div className="space-y-4">
        <div className="rounded-sm bg-sidebar/90 px-6 py-5 text-center ring ring-white/10">
          <p className="text-sm leading-6 text-white/72">{error}</p>
        </div>
        <Button
          onClick={() => router.replace("/login")}
          className={PRIMARY_BUTTON_CLASS}
        >
          Back to Login
        </Button>
      </div>
    </DesktopAuthStateShell>
  );
}
