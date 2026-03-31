"use client";

import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useDesktopSessionBootstrap } from "@/lib/desktop-session-bootstrap";
import {
  DEFAULT_SESSION_CONFIRM_RETRY_DELAYS_MS,
  waitForConfirmedSession,
} from "@/lib/session-confirmation";

type UseConfirmedSessionOptions = {
  autoRecover?: boolean;
  retryDelays?: readonly number[];
};

export function useConfirmedSession({
  autoRecover = true,
  retryDelays = DEFAULT_SESSION_CONFIRM_RETRY_DELAYS_MS,
}: UseConfirmedSessionOptions = {}) {
  const {
    data: session,
    isPending: isSessionPending,
    refetch: refetchSession,
  } = authClient.useSession();
  const desktopBootstrap = useDesktopSessionBootstrap();
  const [hasRecoveredSession, setHasRecoveredSession] = useState(false);
  const [hasAttemptedSessionRecovery, setHasAttemptedSessionRecovery] =
    useState(false);
  const [isRecoveringSession, setIsRecoveringSession] = useState(false);
  const hasStartedSessionRecovery = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const shouldTrustDesktopBootstrap =
    !session && desktopBootstrap.authenticated && !desktopBootstrap.pending;
  const effectiveIsSessionPending =
    shouldTrustDesktopBootstrap ? false : isSessionPending;
  const effectiveHasConfirmedSession =
    Boolean(session) || hasRecoveredSession || shouldTrustDesktopBootstrap;

  useEffect(() => {
    if (!session) {
      return;
    }

    hasStartedSessionRecovery.current = false;
    setHasRecoveredSession(false);
    setHasAttemptedSessionRecovery(false);
    setIsRecoveringSession(false);
  }, [session]);

  useEffect(() => {
    if (
      !autoRecover ||
      effectiveIsSessionPending ||
      session ||
      isRecoveringSession ||
      hasAttemptedSessionRecovery ||
      hasStartedSessionRecovery.current
    ) {
      return;
    }

    hasStartedSessionRecovery.current = true;
    setIsRecoveringSession(true);

    void (async () => {
      try {
        const confirmed = await waitForConfirmedSession(retryDelays);
        if (!isMountedRef.current) {
          return;
        }

        setHasRecoveredSession(confirmed);

        if (confirmed) {
          void Promise.resolve(refetchSession()).catch(() => {
            // Let the recovered-session flag keep protected queries alive.
          });
        }
      } finally {
        if (!isMountedRef.current) {
          return;
        }

        setHasAttemptedSessionRecovery(true);
        setIsRecoveringSession(false);
      }
    })();
  }, [
    autoRecover,
    hasAttemptedSessionRecovery,
    isRecoveringSession,
    effectiveIsSessionPending,
    refetchSession,
    retryDelays,
    session,
  ]);

  return {
    session,
    isSessionPending: effectiveIsSessionPending,
    refetchSession,
    hasConfirmedSession: effectiveHasConfirmedSession,
    hasAttemptedSessionRecovery:
      hasAttemptedSessionRecovery || shouldTrustDesktopBootstrap,
    isRecoveringSession,
  };
}
