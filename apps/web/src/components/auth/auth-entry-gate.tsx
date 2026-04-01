"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { markLoginOnboardingBypass } from "@/lib/login-onboarding-bypass";
import {
  buildPostAuthContinuePath,
  buildPostLoginPath,
  resolvePostAuthPath,
} from "@/lib/post-auth-paths";
import { useConfirmedSession } from "@/lib/use-confirmed-session";

type AuthEntryGateProps = {
  children: ReactNode;
  mode?: "login" | "signup";
};

const AUTH_ENTRY_GATE_MAX_WAIT_MS = 900;

export function AuthEntryGate({
  children,
  mode = "signup",
}: AuthEntryGateProps) {
  const searchParams = useSearchParams();
  const { isSessionPending, hasConfirmedSession } = useConfirmedSession({
    autoRecover: false,
  });
  const hasStartedRedirectRef = useRef(false);
  const [canRenderChildren, setCanRenderChildren] = useState(
    () => !isSessionPending
  );

  const requestedReturnTo = useMemo(
    () => resolvePostAuthPath(searchParams?.get("returnTo")),
    [searchParams]
  );
  const postAuthPath = useMemo(
    () =>
      mode === "login"
        ? buildPostLoginPath(requestedReturnTo)
        : buildPostAuthContinuePath(requestedReturnTo),
    [mode, requestedReturnTo]
  );

  useEffect(() => {
    if (
      isSessionPending ||
      !hasConfirmedSession ||
      hasStartedRedirectRef.current
    ) {
      return;
    }

    hasStartedRedirectRef.current = true;

    if (mode === "login") {
      markLoginOnboardingBypass();
    }

    window.location.replace(postAuthPath);
  }, [hasConfirmedSession, isSessionPending, mode, postAuthPath]);

  useEffect(() => {
    if (hasConfirmedSession) {
      setCanRenderChildren(false);
      return;
    }

    if (!isSessionPending) {
      setCanRenderChildren(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setCanRenderChildren(true);
    }, AUTH_ENTRY_GATE_MAX_WAIT_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [hasConfirmedSession, isSessionPending]);

  if (hasConfirmedSession && !isSessionPending) {
    return (
      <RouteLoadingFallback
        route="continue"
        className="min-h-screen"
        message="You're already signed in. Opening your workspace..."
      />
    );
  }

  if (!canRenderChildren) {
    return (
      <RouteLoadingFallback
        route="continue"
        className="min-h-screen"
        message="Checking your session and opening your workspace..."
      />
    );
  }

  return <>{children}</>;
}
