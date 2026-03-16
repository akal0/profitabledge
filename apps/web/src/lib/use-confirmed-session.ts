"use client";

import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
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
      isSessionPending ||
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

      setHasAttemptedSessionRecovery(true);
      setIsRecoveringSession(false);
    })();
  }, [
    autoRecover,
    hasAttemptedSessionRecovery,
    isRecoveringSession,
    isSessionPending,
    refetchSession,
    retryDelays,
    session,
  ]);

  return {
    session,
    isSessionPending,
    refetchSession,
    hasConfirmedSession: Boolean(session) || hasRecoveredSession,
    hasAttemptedSessionRecovery,
    isRecoveringSession,
  };
}
