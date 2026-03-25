"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { trpcClient } from "@/utils/trpc";

const MT5_LIVE_LEASE_STORAGE_KEY = "profitabledge.mt5.liveLeaseId";
const MT5_LIVE_LEASE_HEARTBEAT_MS = 30_000;

type Mt5LeaseMutationInput = {
  connectionIds: string[];
  leaseId: string;
  route?: string | null;
};

type Mt5LeaseConnection = {
  id?: string | null;
  provider: string;
  isPaused: boolean;
};

type Mt5LeaseConnectionsClient = {
  heartbeatTerminalLeases: {
    mutate(input: Mt5LeaseMutationInput): Promise<unknown>;
  };
  releaseTerminalLeases: {
    mutate(input: Mt5LeaseMutationInput): Promise<unknown>;
  };
};

const mt5LeaseClient = trpcClient.connections as unknown as Mt5LeaseConnectionsClient;

function createLeaseId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `lease-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateLeaseId() {
  if (typeof window === "undefined") {
    return createLeaseId();
  }

  try {
    const existing = window.sessionStorage.getItem(MT5_LIVE_LEASE_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const next = createLeaseId();
    window.sessionStorage.setItem(MT5_LIVE_LEASE_STORAGE_KEY, next);
    return next;
  } catch {
    return createLeaseId();
  }
}

function normalizeMt5ConnectionIds(
  connections: Mt5LeaseConnection[] | undefined,
  maxConnectionCount?: number
) {
  const normalized = Array.from(
    new Set(
      (connections ?? [])
        .filter(
          (connection) =>
            connection.provider === "mt5-terminal" && !connection.isPaused
        )
        .map((connection) => connection.id)
        .filter((connectionId): connectionId is string => Boolean(connectionId))
    )
  ).sort();

  if (typeof maxConnectionCount !== "number") {
    return normalized;
  }

  if (maxConnectionCount <= 0) {
    return [];
  }

  return normalized.slice(0, maxConnectionCount);
}

async function sendLeaseMutation(
  kind: "heartbeat" | "release",
  input: Mt5LeaseMutationInput
) {
  try {
    if (kind === "heartbeat") {
      await mt5LeaseClient.heartbeatTerminalLeases.mutate(input);
      return;
    }

    await mt5LeaseClient.releaseTerminalLeases.mutate(input);
  } catch {
    // Best-effort only. A later heartbeat or the worker lease expiry will recover.
  }
}

export function useMt5LiveLeaseHeartbeat({
  connections,
  enabled,
  maxConnectionCount,
  route,
}: {
  connections: Mt5LeaseConnection[] | undefined;
  enabled: boolean;
  maxConnectionCount?: number;
  route?: string | null;
}) {
  const leaseIdRef = useRef<string>(getOrCreateLeaseId());
  const connectionIdsRef = useRef<string[]>([]);
  const activeConnectionIdsRef = useRef<string[]>([]);
  const mutationQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const routeRef = useRef<string | null>(route ?? null);
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof document === "undefined") {
      return true;
    }

    return document.visibilityState === "visible";
  });
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator === "undefined") {
      return true;
    }

    return navigator.onLine;
  });

  const connectionIds = useMemo(
    () => normalizeMt5ConnectionIds(connections, maxConnectionCount),
    [connections, maxConnectionCount]
  );
  const connectionIdsKey = useMemo(() => connectionIds.join("|"), [connectionIds]);
  const isLeaseActive = enabled && isVisible && isOnline && connectionIds.length > 0;

  connectionIdsRef.current = connectionIds;
  routeRef.current = route ?? null;

  const enqueueLeaseMutation = (
    kind: "heartbeat" | "release",
    input: Mt5LeaseMutationInput
  ) => {
    mutationQueueRef.current = mutationQueueRef.current
      .catch(() => undefined)
      .then(() => sendLeaseMutation(kind, input));

    return mutationQueueRef.current;
  };

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    const syncVisibility = () => {
      setIsVisible(document.visibilityState === "visible");
    };
    const syncOnline = () => {
      setIsOnline(navigator.onLine);
    };
    const releaseOnPageHide = () => {
      const leaseId = leaseIdRef.current;
      const connectionIds = activeConnectionIdsRef.current;

      if (connectionIds.length > 0) {
        void enqueueLeaseMutation("release", {
          connectionIds,
          leaseId,
          route: routeRef.current,
        });
      }
    };

    syncVisibility();
    syncOnline();

    document.addEventListener("visibilitychange", syncVisibility);
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    window.addEventListener("pagehide", releaseOnPageHide);

    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
      window.removeEventListener("pagehide", releaseOnPageHide);
    };
  }, []);

  useEffect(() => {
    const leaseId = leaseIdRef.current;
    const previousConnectionIds = activeConnectionIdsRef.current;
    const nextConnectionIds = connectionIdsRef.current;
    const previousKey = previousConnectionIds.join("|");
    const nextKey = connectionIdsKey;

    activeConnectionIdsRef.current = nextConnectionIds;

    if (!enabled) {
      if (previousConnectionIds.length > 0) {
        void enqueueLeaseMutation("release", {
          connectionIds: previousConnectionIds,
          leaseId,
          route: routeRef.current,
        });
      }
      return;
    }

    if (!isVisible || !isOnline) {
      if (previousConnectionIds.length > 0) {
        void enqueueLeaseMutation("release", {
          connectionIds: previousConnectionIds,
          leaseId,
          route: routeRef.current,
        });
      }
      return;
    }

    if (previousKey === nextKey) {
      if (nextConnectionIds.length > 0) {
        void enqueueLeaseMutation("heartbeat", {
          connectionIds: nextConnectionIds,
          leaseId,
          route: routeRef.current,
        });
      }
      return;
    }

    const nextSet = new Set(nextConnectionIds);
    const removedConnectionIds = previousConnectionIds.filter(
      (connectionId) => !nextSet.has(connectionId)
    );

    if (removedConnectionIds.length > 0) {
      void enqueueLeaseMutation("release", {
        connectionIds: removedConnectionIds,
        leaseId,
        route: routeRef.current,
      });
    }

    if (nextConnectionIds.length > 0) {
      void enqueueLeaseMutation("heartbeat", {
        connectionIds: nextConnectionIds,
        leaseId,
        route: routeRef.current,
      });
    }
  }, [connectionIdsKey, enabled, isOnline, isVisible]);

  useEffect(() => {
    if (!isLeaseActive) {
      return;
    }

    const leaseId = leaseIdRef.current;
    const heartbeat = () => {
      void enqueueLeaseMutation("heartbeat", {
        connectionIds: activeConnectionIdsRef.current,
        leaseId,
        route: routeRef.current,
      });
    };

    const intervalId = window.setInterval(heartbeat, MT5_LIVE_LEASE_HEARTBEAT_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isLeaseActive]);

  useEffect(() => {
    return () => {
      const leaseId = leaseIdRef.current;
      const connectionIds = activeConnectionIdsRef.current;

      if (connectionIds.length > 0) {
        void enqueueLeaseMutation("release", {
          connectionIds,
          leaseId,
          route: routeRef.current,
        });
      }
    };
  }, []);
}
