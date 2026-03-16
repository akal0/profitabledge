"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!session) {
      return;
    }

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
      hasAttemptedSessionRecovery
    ) {
      return;
    }

    let cancelled = false;
    setIsRecoveringSession(true);

    void (async () => {
      const confirmed = await waitForConfirmedSession(retryDelays);
      if (cancelled) {
        return;
      }

      setHasRecoveredSession(confirmed);

      if (confirmed) {
        try {
          await refetchSession();
        } catch {
          // Let the recovered-session flag keep protected queries alive.
        }

        if (cancelled) {
          return;
        }
      }

      setHasAttemptedSessionRecovery(true);
      setIsRecoveringSession(false);
    })();

    return () => {
      cancelled = true;
    };
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
