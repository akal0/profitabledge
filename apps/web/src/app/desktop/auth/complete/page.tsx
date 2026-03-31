"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { DesktopAuthStateShell } from "@/components/auth/desktop-auth-state-shell";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { writeDesktopSessionBootstrap } from "@/lib/desktop-session-bootstrap";
import {
  sanitizeDesktopPath,
  verifyDesktopOneTimeToken,
} from "@/lib/desktop-social-auth";
import {
  CHECKOUT_SESSION_CONFIRM_RETRY_DELAYS_MS,
  waitForConfirmedSession,
} from "@/lib/session-confirmation";

const PRIMARY_BUTTON_CLASS =
  "h-max w-full rounded-sm bg-sidebar py-3 text-xs font-medium text-white shadow-none ring ring-white/10 transition-colors hover:bg-sidebar-accent hover:brightness-120 hover:text-white";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  if (error && typeof error === "object") {
    const candidate = error as {
      error?: { message?: string | null } | null;
      message?: string | null;
    };
    if (candidate.error?.message) {
      return candidate.error.message;
    }
    if (candidate.message) {
      return candidate.message;
    }
  }

  return "We couldn't complete the desktop sign-in.";
}

export default function DesktopAuthCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetPath = useMemo(
    () => sanitizeDesktopPath(searchParams?.get("path")),
    [searchParams]
  );
  const token = searchParams?.get("token") ?? null;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!token) {
        throw new Error("The desktop sign-in token is missing.");
      }

      await verifyDesktopOneTimeToken(token);

      const confirmed = await waitForConfirmedSession(
        CHECKOUT_SESSION_CONFIRM_RETRY_DELAYS_MS
      );
      if (!confirmed) {
        throw new Error("We couldn't confirm your desktop session.");
      }

      const sessionResult = await authClient.getSession();
      const sessionUser = sessionResult.data?.user ?? null;
      if (sessionUser?.id) {
        writeDesktopSessionBootstrap({
          authenticated: true,
          pending: false,
          user: {
            id: sessionUser.id,
            name: sessionUser.name ?? null,
            email: sessionUser.email ?? null,
            image: sessionUser.image ?? null,
          },
        });
      }

      if (!cancelled) {
        router.replace(targetPath);
      }
    })().catch((caughtError) => {
      if (!cancelled) {
        setError(getErrorMessage(caughtError));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router, targetPath, token]);

  if (!error) {
    return (
      <DesktopAuthStateShell
        title="Finalizing your desktop sign-in"
        description="The secure browser handoff is complete. We're confirming the desktop session before opening your workspace."
      >
        <div className="rounded-sm bg-sidebar/90 px-6 py-5 text-center ring ring-white/10">
          <p className="text-sm leading-6 text-white/72">
            Confirming your desktop session...
          </p>
        </div>
      </DesktopAuthStateShell>
    );
  }

  return (
    <DesktopAuthStateShell
      title="We couldn't finish your Google sign-in"
      description="The browser verified your session, but the desktop app couldn't finish establishing it."
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
