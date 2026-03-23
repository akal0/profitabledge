"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { buildPostAuthContinuePath, resolvePostAuthPath } from "@/lib/post-auth-paths";
import { useConfirmedSession } from "@/lib/use-confirmed-session";

type AuthEntryGateProps = {
  children: ReactNode;
};

export function AuthEntryGate({ children }: AuthEntryGateProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    isSessionPending,
    hasConfirmedSession,
    hasAttemptedSessionRecovery,
    isRecoveringSession,
  } = useConfirmedSession();

  const requestedReturnTo = useMemo(
    () => resolvePostAuthPath(searchParams?.get("returnTo")),
    [searchParams]
  );
  const postAuthContinuePath = useMemo(
    () => buildPostAuthContinuePath(requestedReturnTo),
    [requestedReturnTo]
  );

  useEffect(() => {
    if (isSessionPending || isRecoveringSession || !hasConfirmedSession) {
      return;
    }

    router.replace(postAuthContinuePath);
  }, [
    hasConfirmedSession,
    isRecoveringSession,
    isSessionPending,
    postAuthContinuePath,
    router,
  ]);

  if (isSessionPending || isRecoveringSession) {
    return (
      <RouteLoadingFallback
        route="continue"
        className="min-h-screen"
        message="Checking your session and opening your workspace..."
      />
    );
  }

  if (!hasConfirmedSession && !hasAttemptedSessionRecovery) {
    return (
      <RouteLoadingFallback
        route="continue"
        className="min-h-screen"
        message="Checking your session and opening your workspace..."
      />
    );
  }

  if (hasConfirmedSession) {
    return (
      <RouteLoadingFallback
        route="continue"
        className="min-h-screen"
        message="You're already signed in. Opening your workspace..."
      />
    );
  }

  return <>{children}</>;
}
